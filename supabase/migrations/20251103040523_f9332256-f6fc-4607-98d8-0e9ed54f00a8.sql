-- Add composite indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_dishes_subcategory_order ON dishes(subcategory_id, order_index);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_order ON subcategories(category_id, order_index);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_order ON categories(restaurant_id, order_index);
CREATE INDEX IF NOT EXISTS idx_dish_options_dish_order ON dish_options(dish_id, order_index);
CREATE INDEX IF NOT EXISTS idx_dish_modifiers_dish_order ON dish_modifiers(dish_id, order_index);

-- Add foreign key constraints with CASCADE for data integrity
ALTER TABLE categories 
ADD CONSTRAINT fk_categories_restaurant 
FOREIGN KEY (restaurant_id) 
REFERENCES restaurants(id) 
ON DELETE CASCADE;

ALTER TABLE subcategories 
ADD CONSTRAINT fk_subcategories_category 
FOREIGN KEY (category_id) 
REFERENCES categories(id) 
ON DELETE CASCADE;

ALTER TABLE dishes 
ADD CONSTRAINT fk_dishes_subcategory 
FOREIGN KEY (subcategory_id) 
REFERENCES subcategories(id) 
ON DELETE CASCADE;

ALTER TABLE dish_options 
ADD CONSTRAINT fk_dish_options_dish 
FOREIGN KEY (dish_id) 
REFERENCES dishes(id) 
ON DELETE CASCADE;

ALTER TABLE dish_modifiers 
ADD CONSTRAINT fk_dish_modifiers_dish 
FOREIGN KEY (dish_id) 
REFERENCES dishes(id) 
ON DELETE CASCADE;

-- Update batch_update_order_indexes_optimized to include new tables
CREATE OR REPLACE FUNCTION public.batch_update_order_indexes_optimized(table_name text, updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  query text;
BEGIN
  -- Validate table name to prevent SQL injection
  IF table_name NOT IN ('categories', 'subcategories', 'dishes', 'dish_options', 'dish_modifiers') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;

  -- Build and execute single UPDATE FROM query
  query := format(
    'UPDATE %I SET order_index = updates.new_order
     FROM (SELECT (value->>''id'')::uuid as id, (value->>''order_index'')::integer as new_order 
           FROM jsonb_array_elements($1)) as updates
     WHERE %I.id = updates.id',
    table_name, table_name
  );

  EXECUTE query USING updates;
END;
$$;

-- Optimize get_restaurant_full_menu function for better performance
CREATE OR REPLACE FUNCTION public.get_restaurant_full_menu(p_restaurant_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  WITH restaurant_data AS (
    SELECT row_to_json(r) as restaurant
    FROM restaurants r 
    WHERE r.id = p_restaurant_id
  ),
  categories_data AS (
    SELECT json_agg(
      json_build_object(
        'id', c.id,
        'name', c.name,
        'restaurant_id', c.restaurant_id,
        'order_index', c.order_index,
        'created_at', c.created_at,
        'subcategories', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', s.id,
              'name', s.name,
              'category_id', s.category_id,
              'order_index', s.order_index,
              'created_at', s.created_at,
              'dishes', (
                SELECT COALESCE(json_agg(
                  json_build_object(
                    'id', d.id,
                    'name', d.name,
                    'description', d.description,
                    'price', d.price,
                    'image_url', d.image_url,
                    'is_new', d.is_new,
                    'order_index', d.order_index,
                    'subcategory_id', d.subcategory_id,
                    'has_options', d.has_options,
                    'created_at', d.created_at
                  ) ORDER BY d.order_index
                ), '[]'::json)
                FROM dishes d
                WHERE d.subcategory_id = s.id
              )
            ) ORDER BY s.order_index
          ), '[]'::json)
          FROM subcategories s
          WHERE s.category_id = c.id
        )
      ) ORDER BY c.order_index
    ) as categories
    FROM categories c
    WHERE c.restaurant_id = p_restaurant_id
  )
  SELECT json_build_object(
    'restaurant', (SELECT restaurant FROM restaurant_data),
    'categories', COALESCE((SELECT categories FROM categories_data), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;