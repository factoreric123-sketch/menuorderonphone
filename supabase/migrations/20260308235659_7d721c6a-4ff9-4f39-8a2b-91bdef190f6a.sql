-- Add position columns to restaurant_tables for floor plan layout
ALTER TABLE public.restaurant_tables
ADD COLUMN IF NOT EXISTS position_x integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS position_y integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS width integer DEFAULT 80,
ADD COLUMN IF NOT EXISTS height integer DEFAULT 80,
ADD COLUMN IF NOT EXISTS shape text DEFAULT 'square';