

# What's Missing to Make This Production-Ready for Restaurants

## What You Already Have (Working)
- Menu editor with categories, subcategories, dishes, options, modifiers
- Public menu display with QR code scanning
- Cart + checkout flow (guest ordering via edge function)
- Order status page with real-time updates
- Kitchen ticket board (real-time)
- Orders admin portal
- Table management with QR codes
- Stripe subscription billing for restaurant owners
- Theme customization, image uploads, allergen filters

## What's Missing (Prioritized)

### 1. Restaurant Ordering Toggle (Critical)
Right now `orderingEnabled` is hardcoded to `true`. Restaurants need a setting to **turn ordering on/off** in their restaurant settings. Without this, every menu becomes an ordering platform whether the owner wants it or not.

**Change:** Add `ordering_enabled` boolean column to `restaurants` table, wire it into the settings dialog, and pass it through to the public menu.

### 2. Restaurant Hours / Open/Closed Status (Critical)
No concept of business hours. Customers can place orders at 3 AM. Need:
- Operating hours per day of the week
- Auto-disable ordering when closed
- "Currently Closed" banner on menu

**Change:** New `restaurant_hours` table or JSON column, plus frontend display logic.

### 3. Order Notifications (High)
Kitchen staff won't know when orders come in unless they're staring at the screen. Need:
- Audio alert sound when new order arrives
- Browser notification permission request
- Optional: email/SMS notification via edge function

**Change:** Add audio playback on new realtime event in Kitchen.tsx and OrdersAdmin.tsx.

### 4. Receipt / Order Confirmation for Guests (High)
After placing an order, the guest only sees a status page. No confirmation details like estimated time, order number displayed prominently, or ability to show the order to staff.

**Change:** Enhance OrderStatus page with a clear order number, summary, and estimated wait time.

### 5. Menu Item Availability (High)
No way to mark items as "sold out" or "unavailable" temporarily. Staff need a quick toggle.

**Change:** Add `available` boolean to `dishes` table, toggle in editor, hide/grey-out on public menu.

### 6. Stripe Online Payment Integration for Orders (Medium)
The checkout page shows a "Credit Card" option but it just sets `payment_method: 'stripe'` without actually creating a Stripe PaymentIntent. Online payments don't actually work yet.

**Change:** Create a `create-payment-intent` edge function, integrate Stripe Elements or redirect to Stripe Checkout for order payments.

### 7. Printer Integration / Thermal Receipt Printing (Medium)
The `printTicket` function opens a browser print dialog. Real restaurants use thermal receipt printers (Star, Epson). Consider:
- ESC/POS compatible formatting
- Or at minimum, better print CSS optimized for 80mm/58mm receipt paper

### 8. Multi-Language Menu Support (Low-Medium)
Many restaurants serve international customers. No i18n support exists.

### 9. Tips / Gratuity Option (Low-Medium)
No way for customers to add a tip during checkout.

### 10. Tax Calculation (Critical for US restaurants)
No tax is calculated on orders. The `total_cents` is just item subtotals. Need configurable tax rate per restaurant.

**Change:** Add `tax_rate` to restaurants table, calculate tax in the `create-order` edge function.

---

## Recommended Implementation Order

| Priority | Feature | Effort |
|----------|---------|--------|
| 1 | Tax calculation | Small - add column + update edge function |
| 2 | Ordering toggle per restaurant | Small - add column + settings UI |
| 3 | Item availability (sold out) | Small - add column + toggle |
| 4 | Audio notifications for new orders | Small - add sound file + play on event |
| 5 | Business hours / open-closed | Medium - new table + schedule logic |
| 6 | Stripe payment for customer orders | Medium - new edge function + Stripe Elements |
| 7 | Tips/gratuity at checkout | Small - UI + column |
| 8 | Better receipt/order confirmation | Small - enhance OrderStatus page |
| 9 | Thermal printer formatting | Medium |
| 10 | Multi-language | Large |

## Summary

The core ordering pipeline works end-to-end. The biggest gaps for a real restaurant launch are: **tax calculation**, **ordering on/off toggle**, **sold-out items**, and **new order alerts**. These are all relatively small changes. After those, Stripe payment for guest orders and business hours would round it out for production use.

