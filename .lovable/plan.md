

# QR Code Ordering, Payments, and Kitchen Ticket Board

## Overview

Add a complete dine-in ordering system: guests scan a table QR code, browse the menu, customize items, add to cart, checkout (Stripe or pay-at-table), and track their order live. Staff see a real-time ticket board to manage incoming orders by station.

---

## Phase 1: Database Schema

Create 4 new tables via Supabase migration:

### `restaurant_tables`
Represents physical tables in a restaurant, each with a unique QR identifier.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| restaurant_id | uuid FK restaurants | |
| label | text | "Table 5", "Bar 2" |
| qr_code_id | text, unique | Embedded in table-specific QR |
| active | boolean, default true | |
| created_at | timestamptz | |

### `orders`
A guest's order, tied to a restaurant and optionally a table.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| restaurant_id | uuid FK restaurants | |
| table_id | uuid FK restaurant_tables, nullable | |
| guest_name | text | |
| guest_phone | text, nullable | |
| status | text, default 'pending' | pending/confirmed/preparing/ready/completed/cancelled |
| payment_method | text | 'stripe' or 'pay_at_table' |
| payment_status | text, default 'unpaid' | unpaid/paid/refunded |
| stripe_payment_intent_id | text, nullable | |
| total_cents | integer | |
| notes | text, nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `order_items`
Line items within an order, with snapshots of dish data at order time.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| order_id | uuid FK orders | |
| dish_id | uuid FK dishes | |
| dish_name | text | Snapshot |
| quantity | integer | |
| unit_price_cents | integer | |
| selected_option_name | text, nullable | |
| selected_modifier_names | text[], nullable | |
| subtotal_cents | integer | |
| special_instructions | text, nullable | |
| station | text, default 'kitchen' | kitchen/bar/dessert |
| status | text, default 'pending' | pending/preparing/ready |
| created_at | timestamptz | |

### `stations`
Configurable stations per restaurant for ticket routing.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| restaurant_id | uuid FK restaurants | |
| name | text | "Kitchen", "Bar" |
| order_index | integer | |
| created_at | timestamptz | |

### RLS Policies
- **orders / order_items**: Public INSERT (anonymous guests can place orders). SELECT for restaurant owners (via restaurants.owner_id = auth.uid()). Public SELECT filtered by a session token stored in the order.
- **restaurant_tables**: Public SELECT for active tables of published restaurants. Owner ALL.
- **stations**: Owner ALL, public SELECT for published restaurants.

### Realtime
Enable Supabase Realtime on `orders` and `order_items` tables so both guest order-status page and staff ticket board get live updates.

---

## Phase 2: Guest Ordering Flow

### 2a. Table-Aware QR Code Generation (Editor)
- Add a **"Tables"** management section in the Editor or a new tab in the existing restaurant settings dialog
- Each table gets a unique `qr_code_id` (auto-generated short string)
- QR codes encode URL: `/m/{restaurant_hash}/{menu_id}?table={qr_code_id}`
- Extend the existing `QRCodeModal` to support per-table QR generation, or create a new `TableQRManager` component

### 2b. Cart System (Client-Side State)
- Create a `CartContext` (React Context + useReducer) stored in localStorage for persistence across page refreshes
- Cart actions: addItem, removeItem, updateQuantity, clearCart
- Each cart item stores: dishId, dishName, price, quantity, selectedOption, selectedModifiers, specialInstructions, station
- Cart is scoped per restaurant (keyed by restaurant_id)

### 2c. Cart UI on Public Menu
- Add a floating **cart button** (bottom-right FAB) on `PublicMenuStatic` showing item count badge
- Clicking opens a **cart drawer** (Sheet from bottom on mobile, side sheet on desktop)
- Cart drawer shows: item list with quantities, customizations, subtotal per item, total, "Checkout" button
- Modify `DishDetailDialog` to add an **"Add to Cart"** button with quantity selector (+/- stepper)

### 2d. Checkout Page
- New route: `/order/{restaurant_hash}/{menu_id}` or inline checkout within the cart drawer
- Guest enters: name (required), phone (optional), special notes
- Payment method selector: "Pay Online" (Stripe) or "Pay at Table"
- For Stripe: call a new `create-order-payment` edge function that creates a Stripe PaymentIntent and returns client_secret
- Use Stripe Elements (embedded payment form) for card input -- requires adding `@stripe/stripe-js` and `@stripe/react-stripe-js` packages
- For pay-at-table: order is submitted directly with payment_status='unpaid'

### 2e. Order Confirmation + Live Status
- After checkout, navigate to `/order-status/{order_id}`
- Subscribe to Supabase Realtime on the order row
- Show order status progression: Pending -> Confirmed -> Preparing -> Ready -> Completed
- Simple animated status bar with checkmarks

---

## Phase 3: Edge Functions

### `create-order` (new)
- Accepts: restaurant_id, table_id, guest_name, items[], payment_method, notes
- Validates items against actual dishes/prices in DB (prevents price tampering)
- Creates order + order_items rows
- If payment_method is 'stripe': creates Stripe PaymentIntent, returns client_secret
- If payment_method is 'pay_at_table': returns order_id immediately
- verify_jwt = false (anonymous guests)

### `confirm-order-payment` (new)
- Webhook or client-side confirmation after Stripe payment succeeds
- Updates order.payment_status to 'paid'
- verify_jwt = false

### Update `stripe-webhook` (existing)
- Add handler for `payment_intent.succeeded` to auto-confirm order payment

---

## Phase 4: Staff Ticket Board

### 4a. New Route: `/kitchen/{restaurantId}`
- Protected route (owner must be logged in)
- Real-time subscription to `order_items` joined with `orders` for the restaurant
- Filter by station tabs (Kitchen, Bar, All)
- Each ticket card shows: table label, dish name, quantity, modifiers, special instructions, time elapsed
- Color-coded status: pending (yellow), preparing (blue), ready (green)
- Click to cycle status: pending -> preparing -> ready
- Audio notification on new orders (optional, simple beep)

### 4b. Order History
- Tab or link to view completed orders
- Simple table: order ID, table, items, total, time, payment status
- Filterable by date

---

## Phase 5: Table Management UI

- New section in Editor sidebar or restaurant settings
- CRUD for tables: add/edit/delete table labels
- Bulk QR code download (ZIP of PNGs, one per table)
- Station management: add/edit default stations (Kitchen, Bar, Dessert)

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/contexts/CartContext.tsx` | Cart state management |
| `src/components/cart/CartDrawer.tsx` | Cart slide-out UI |
| `src/components/cart/CartFAB.tsx` | Floating cart button |
| `src/components/cart/CartItem.tsx` | Single cart item row |
| `src/components/cart/CheckoutForm.tsx` | Guest info + payment |
| `src/pages/OrderStatus.tsx` | Live order tracking |
| `src/pages/Kitchen.tsx` | Staff ticket board |
| `src/components/kitchen/TicketCard.tsx` | Single order ticket |
| `src/components/kitchen/StationTabs.tsx` | Station filter tabs |
| `src/components/editor/TableManager.tsx` | Table CRUD in editor |
| `supabase/functions/create-order/index.ts` | Order creation + Stripe PI |
| `supabase/functions/confirm-order-payment/index.ts` | Payment confirmation |

### Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add routes for /order-status/:id, /kitchen/:restaurantId |
| `src/pages/PublicMenuStatic.tsx` | Add CartFAB, pass onAddToCart to DishDetailDialog |
| `src/components/DishDetailDialog.tsx` | Add "Add to Cart" button with quantity |
| `src/pages/MenuShortDisplay.tsx` | Parse ?table= query param, pass to menu |
| `supabase/config.toml` | Add new edge function configs |
| `supabase/functions/stripe-webhook/index.ts` | Handle payment_intent.succeeded for orders |

---

## Technical Notes

- **Stripe Elements** requires adding `@stripe/stripe-js` and `@stripe/react-stripe-js` npm packages
- **Price validation**: The `create-order` edge function must re-fetch dish prices from DB and compute totals server-side -- never trust client-sent prices
- **Realtime**: Uses Supabase Realtime channels (postgres_changes) on orders and order_items tables
- **No auth required for guests**: All guest-facing endpoints use verify_jwt = false; orders are identified by a unique order ID
- **Station assignment**: Default station is "kitchen"; can be overridden per-dish in future phases via a station field on the dishes table

---

## Implementation Order

1. Database migration (tables, RLS, realtime)
2. Cart context + CartFAB + CartDrawer
3. "Add to Cart" button in DishDetailDialog
4. `create-order` edge function
5. Checkout flow (guest info form + Stripe Elements)
6. Order status page with realtime
7. Kitchen ticket board
8. Table management UI + per-table QR codes
9. Wire up stripe-webhook for payment confirmation

