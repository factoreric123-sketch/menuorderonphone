-- Add badge columns to dishes table
ALTER TABLE public.dishes 
  ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_chef_recommendation BOOLEAN DEFAULT false;