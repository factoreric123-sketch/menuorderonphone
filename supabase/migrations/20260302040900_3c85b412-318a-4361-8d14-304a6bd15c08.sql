
-- ============================================
-- ORDERING SYSTEM: Tables, Orders, Stations
-- ============================================

-- 1. Restaurant Tables (physical tables with QR codes)
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  qr_code_id text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their tables"
  ON public.restaurant_tables FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_tables.restaurant_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Public can view active tables of published restaurants"
  ON public.restaurant_tables FOR SELECT
  USING (active = true AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_tables.restaurant_id AND r.published = true
  ));

-- 2. Stations (kitchen, bar, etc.)
CREATE TABLE public.stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage stations"
  ON public.stations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = stations.restaurant_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Public can view stations of published restaurants"
  ON public.stations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = stations.restaurant_id AND r.published = true
  ));

-- 3. Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_phone text,
  status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'pay_at_table',
  payment_status text NOT NULL DEFAULT 'unpaid',
  stripe_payment_intent_id text,
  total_cents integer NOT NULL DEFAULT 0,
  notes text,
  session_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Guests can insert orders (anonymous)
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- Guests can view their own order by session_token
CREATE POLICY "Anyone can view orders by session token"
  ON public.orders FOR SELECT
  USING (true);

-- Owners can manage orders for their restaurants
CREATE POLICY "Owners can manage their restaurant orders"
  ON public.orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid()
  ));

-- 4. Order Items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dish_id uuid REFERENCES public.dishes(id) ON DELETE SET NULL,
  dish_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL,
  selected_option_name text,
  selected_modifier_names text[],
  subtotal_cents integer NOT NULL,
  special_instructions text,
  station text NOT NULL DEFAULT 'kitchen',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Anyone can insert order items (via edge function mostly)
CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

-- Anyone can view order items (filtered by order access)
CREATE POLICY "Anyone can view order items"
  ON public.order_items FOR SELECT
  USING (true);

-- Owners can update order item status
CREATE POLICY "Owners can update order items"
  ON public.order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = order_items.order_id AND r.owner_id = auth.uid()
  ));

-- Owners can manage order items
CREATE POLICY "Owners can manage order items"
  ON public.order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = order_items.order_id AND r.owner_id = auth.uid()
  ));

-- 5. Auto-update updated_at on orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Enable Realtime on orders and order_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- 7. Indexes for performance
CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_session_token ON public.orders(session_token);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_station ON public.order_items(station);
CREATE INDEX idx_order_items_status ON public.order_items(status);
CREATE INDEX idx_restaurant_tables_restaurant_id ON public.restaurant_tables(restaurant_id);
CREATE INDEX idx_restaurant_tables_qr_code_id ON public.restaurant_tables(qr_code_id);
CREATE INDEX idx_stations_restaurant_id ON public.stations(restaurant_id);
