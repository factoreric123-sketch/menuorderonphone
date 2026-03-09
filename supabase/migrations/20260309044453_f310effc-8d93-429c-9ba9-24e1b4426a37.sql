
-- =============================================
-- CRITICAL FIX: Lock down orders & order_items SELECT policies
-- Currently USING (true) exposes ALL customer data publicly
-- =============================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can view orders by session token" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;

-- Orders: Only viewable by restaurant owner OR matching session token
CREATE POLICY "Orders viewable by owner or session token" ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid()
    )
    OR
    session_token = coalesce(
      current_setting('request.headers', true)::json->>'x-session-token',
      ''
    )
  );

-- Order items: Only viewable by restaurant owner or if parent order is accessible
CREATE POLICY "Order items viewable by owner or session token" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.id = order_items.order_id
      AND (
        r.owner_id = auth.uid()
        OR o.session_token = coalesce(
          current_setting('request.headers', true)::json->>'x-session-token',
          ''
        )
      )
    )
  );

-- =============================================
-- FIX: Set search_path on functions missing it
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE 
      WHEN NEW.raw_user_meta_data->>'user_type' = 'instructor' THEN 'instructor'
      ELSE 'learner'
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, plan_type)
  VALUES (new.id, 'active', 'free');
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_hot_menu_data()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY hot_menu_data;
END;
$$;
