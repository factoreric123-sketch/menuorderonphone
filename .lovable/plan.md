

# Admin Portal for Order Management

## Current State

The app already has a **Kitchen ticket board** (`/dashboard/:restaurantId/tickets`) focused on real-time station work. But there's no proper admin view for restaurant owners to manage all orders holistically -- seeing payment status, order history, cancelling/refunding, filtering by date, etc.

## What to Build

A new **Orders Admin page** at `/dashboard/:restaurantId/orders` with two views:

### 1. Active Orders Panel (default view)
- Real-time list of all non-completed orders in a clean table layout
- Columns: Order #, Guest Name, Table, Items summary, Total, Payment Status, Order Status, Time, Actions
- Actions per order: View details (expand), Advance status, Cancel, Print
- Color-coded payment status badges (paid/unpaid/refunded)
- Auto-refreshes via Supabase Realtime (reuses the same pattern as Kitchen.tsx)

### 2. Order History Tab
- All completed/cancelled orders in a searchable, filterable table
- Date range filter, status filter, payment status filter
- Expandable rows showing full item details
- Summary stats at top: total orders today, total revenue, average order value

### 3. Order Detail Expandable Row
- Full item list with quantities, options, modifiers, special instructions
- Guest info (name, phone, table)
- Timeline of status changes
- Payment info (method, status, stripe ID if applicable)
- Actions: mark paid (for pay-at-table), cancel, reprint

### Navigation
- Add an **"Orders"** button to `RestaurantCard` on the Dashboard (alongside existing "Ticket Dashboard")
- Add the route `/dashboard/:restaurantId/orders` to App.tsx
- Link from the Kitchen board header to the Orders admin and vice versa

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/pages/OrdersAdmin.tsx` | **New** - Full orders management page with tabs (Active / History) |
| `src/App.tsx` | Add route for `/dashboard/:restaurantId/orders` |
| `src/components/RestaurantCard.tsx` | Add "Manage Orders" button |
| `src/pages/Kitchen.tsx` | Add link to Orders Admin in header |

## Technical Approach

- Reuse the same Supabase Realtime subscription pattern from Kitchen.tsx
- Use the existing `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` UI components for the order list
- Use `Tabs` component for Active/History switching
- Use `Collapsible` for expandable order detail rows
- Date filtering with `date-fns` (already installed)
- No database changes needed -- all data is already in `orders` and `order_items` tables with proper RLS

