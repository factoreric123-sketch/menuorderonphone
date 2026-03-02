-- Create table for short, robust public menu links like /m/{restaurant_hash}/{menu_id}
-- This enables deterministic, shareable links decoupled from slugs

-- 1) Table
CREATE TABLE IF NOT EXISTS public.menu_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  restaurant_hash text NOT NULL,
  menu_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id),
  UNIQUE (restaurant_hash, menu_id)
);

-- 2) RLS
ALTER TABLE public.menu_links ENABLE ROW LEVEL SECURITY;

-- 3) Update timestamp trigger (safe to replace if already exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE TRIGGER trg_menu_links_updated_at
BEFORE UPDATE ON public.menu_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Policies
-- Owners can fully manage links for their restaurants
CREATE POLICY "Owners can manage their menu_links"
ON public.menu_links
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_links.restaurant_id AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_links.restaurant_id AND r.owner_id = auth.uid()
  )
);

-- Public can select active links for published restaurants
CREATE POLICY "Public can view active menu_links for published restaurants"
ON public.menu_links
FOR SELECT
USING (
  active = true AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_links.restaurant_id AND r.published = true
  )
);

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_menu_links_restaurant_id ON public.menu_links(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_links_pair ON public.menu_links(restaurant_hash, menu_id);
