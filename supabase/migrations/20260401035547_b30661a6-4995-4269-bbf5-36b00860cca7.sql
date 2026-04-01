
-- 1. Fix orders INSERT policy: restrict to anon+authenticated but require restaurant exists
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders for valid restaurants"
ON public.orders FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id
    AND r.published = true
    AND r.ordering_enabled = true
  )
);

-- 2. Fix order_items: tighten the ALL policy to authenticated only
DROP POLICY IF EXISTS "Owners can manage order items" ON public.order_items;
CREATE POLICY "Owners can manage order items"
ON public.order_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.id = order_items.order_id AND r.owner_id = auth.uid()
  )
);

-- 3. Fix functions missing search_path
CREATE OR REPLACE FUNCTION public.ensure_menu_link_for_restaurant(p_restaurant_id uuid)
RETURNS TABLE(restaurant_hash text, menu_id text, url text, is_accessible boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_hash text;
  v_menu_id text;
  v_full_hex text;
  v_num_base bigint;
  v_restaurant_published boolean;
  v_link_exists boolean;
BEGIN
  SELECT published INTO v_restaurant_published
  FROM public.restaurants
  WHERE id = p_restaurant_id AND owner_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found or access denied';
  END IF;
  SELECT true, ml.restaurant_hash, ml.menu_id
  INTO v_link_exists, v_hash, v_menu_id
  FROM public.menu_links ml
  WHERE ml.restaurant_id = p_restaurant_id AND ml.active = true
  LIMIT 1;
  IF NOT v_link_exists THEN
    v_full_hex := encode(digest(p_restaurant_id::text, 'sha256'), 'hex');
    v_hash := substring(v_full_hex, 1, 8);
    v_num_base := ('x' || substring(v_full_hex, 9, 8))::bit(32)::bigint;
    v_menu_id := lpad((v_num_base % 100000)::text, 5, '0');
    INSERT INTO public.menu_links (restaurant_id, restaurant_hash, menu_id, active)
    VALUES (p_restaurant_id, v_hash, v_menu_id, true)
    ON CONFLICT (restaurant_id) DO UPDATE
    SET active = true, updated_at = now()
    RETURNING menu_links.restaurant_hash, menu_links.menu_id
    INTO v_hash, v_menu_id;
  END IF;
  RETURN QUERY
  SELECT v_hash, v_menu_id, '/m/' || v_hash || '/' || v_menu_id, v_restaurant_published;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_menu_link_accessible(p_restaurant_hash text, p_menu_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_accessible boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.menu_links ml
    INNER JOIN public.restaurants r ON r.id = ml.restaurant_id
    WHERE ml.restaurant_hash = p_restaurant_hash
      AND ml.menu_id = p_menu_id
      AND ml.active = true
      AND r.published = true
  ) INTO v_accessible;
  RETURN v_accessible;
END;
$function$;

-- 4. Revoke API access from materialized view
ALTER MATERIALIZED VIEW IF EXISTS public.hot_menu_data OWNER TO postgres;
REVOKE ALL ON public.hot_menu_data FROM anon, authenticated;
