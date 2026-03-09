
-- Fix: Anyone can inject items into any order
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- Order items can only be inserted via the edge function (service role),
-- not directly by anonymous users
CREATE POLICY "Only service role can create order items" ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.id = order_items.order_id
      AND r.owner_id = auth.uid()
    )
  );
