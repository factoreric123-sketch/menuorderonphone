

# Wire Up the Complete QR Ordering Flow

## Current State

The full ordering system is already built but has one critical gap: the **Table Manager** component exists (`src/components/editor/TableManager.tsx`) but is **not wired into the Editor page**. Without it, restaurant owners can't create tables or generate QR codes.

Everything else is functional end-to-end:
- Guest scans QR -> `MenuShortDisplay` reads the `?table=` param -> passes `tableQrCodeId` to `PublicMenuStatic`
- `PublicMenuStatic` shows the menu with cart FAB and "Add to Cart" in dish detail dialogs
- Cart drawer -> Checkout page -> calls `create-order` edge function
- Order status page with live Supabase Realtime updates
- Kitchen ticket board at `/kitchen/:restaurantId` with station filtering and status cycling

## What Needs to Happen

### 1. Add Table Manager to the Editor
Wire the `TableManager` component into the Editor page so owners can:
- Create tables (e.g., "Table 1", "Bar Seat 3")
- Generate per-table QR codes that encode `?table={qr_code_id}`
- Download QR code PNGs

This will be added as a new section or tab in the Editor, accessible via a "Tables" button in the `EditorTopBar`. The `menuUrl` prop needs to be populated from the restaurant's existing `menu_links` data.

### 2. Add Kitchen Board Link to Dashboard/Editor
Add a visible way for owners to navigate to `/kitchen/:restaurantId` from the Editor or Dashboard, so they can monitor incoming orders.

### 3. Verify Edge Function Deployment
Ensure the `create-order` edge function is deployed and working, since it's the backbone of the ordering flow.

---

## Technical Details

### Editor Changes (`src/pages/Editor.tsx`)
- Import `TableManager` from `@/components/editor/TableManager`
- Fetch the restaurant's `menu_links` to get the base menu URL (`/m/{hash}/{menuId}`)
- Add a "Tables & QR" button/tab in the editor that reveals the `TableManager`
- Pass `restaurantId` and `menuUrl` props

### EditorTopBar Changes (`src/components/editor/EditorTopBar.tsx`)
- Add a "Tables" or "QR Codes" button that toggles a panel/dialog showing the `TableManager`
- Add a "Kitchen Board" link button that opens `/kitchen/:restaurantId`

### File Changes Summary
| File | Change |
|------|--------|
| `src/pages/Editor.tsx` | Import TableManager, fetch menu_links, add Tables section |
| `src/components/editor/EditorTopBar.tsx` | Add "Tables" and "Kitchen" buttons |

No database changes needed -- all tables (`restaurant_tables`, `orders`, `order_items`, `stations`) already exist with proper RLS policies.

