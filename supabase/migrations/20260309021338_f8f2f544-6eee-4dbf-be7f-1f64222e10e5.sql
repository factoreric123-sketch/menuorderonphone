ALTER TABLE public.restaurant_tables 
  ADD COLUMN IF NOT EXISTS server_name text,
  ADD COLUMN IF NOT EXISTS table_status text DEFAULT 'available';