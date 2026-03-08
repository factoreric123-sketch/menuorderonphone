
-- Add ordering_enabled and tax_rate to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS ordering_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,4) NOT NULL DEFAULT 0;

-- Add available column to dishes
ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true;

-- Add tax_cents column to orders for record keeping
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0;
