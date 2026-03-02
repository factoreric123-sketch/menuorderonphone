-- Add editor view mode preference to restaurants table
ALTER TABLE public.restaurants 
  ADD COLUMN editor_view_mode TEXT DEFAULT 'grid' CHECK (editor_view_mode IN ('grid', 'table'));