

## Missing Features Analysis — Thinking Like a Restaurant

After reviewing the full codebase, here are practical features that a real restaurant would need but are currently missing:

### 1. Table Turnover / Clear Table Action
When a table finishes and pays, there's no way to "clear" the table (mark order as completed from the floor plan). Currently you can only mark paid — but the order stays active. A **"Clear Table"** button would mark the order as completed, freeing the table visually.

### 2. Server/Waiter Assignment
Real restaurants assign servers to tables/sections. Adding a simple `server_name` text field to `restaurant_tables` would let managers see who's responsible for which table at a glance on the floor plan.

### 3. Floor Plan Sections/Zones
Restaurants have indoor, outdoor, bar, patio sections. A lightweight label or section grouping (e.g., colored zones on the canvas) helps staff navigate larger layouts.

### 4. Table Status Beyond Orders
Tables can be **reserved**, **dirty** (needs bussing), or **unavailable** (broken chair, VIP hold). Currently status is only derived from orders. Adding a `table_status` column (available, reserved, dirty, unavailable) gives staff more control.

### 5. Quick Stats on Floor Plan Header
Show live summary stats in the floor plan header: **X occupied / Y total tables**, **total active revenue**, **avg wait time**. This is a glance-level dashboard that every restaurant manager wants.

### 6. Cross-Navigation Between Views
The Kitchen, Orders, and Floor Plan pages don't link to each other well. Adding nav buttons between all three views (Kitchen ↔ Floor Plan ↔ Orders) from each page header.

---

### Implementation Plan

**Database migration:**
```sql
ALTER TABLE public.restaurant_tables 
  ADD COLUMN server_name text,
  ADD COLUMN table_status text DEFAULT 'available';
```

**File changes:**

1. **`FloorPlan.tsx`** — Add summary stats bar (occupied count, revenue, avg time). Add "Clear Table" action. Add nav links to Kitchen/Orders. 

2. **`FloorPlanCanvas.tsx`** — Show server name on table. Color-code tables by `table_status` (reserved = purple, dirty = orange, unavailable = gray). Add status overlay icons.

3. **`TableOrderPanel.tsx`** — Add "Clear Table" button (sets order to completed). Add server name field (editable inline). Add table status dropdown (available/reserved/dirty/unavailable).

4. **`Kitchen.tsx` / `OrdersAdmin.tsx`** — Add Floor Plan nav button in header.

5. **`src/integrations/supabase/types.ts`** — Will auto-update after migration.

**No new pages or components needed** — all enhancements are within existing files.

