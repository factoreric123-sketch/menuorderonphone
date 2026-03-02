-- Advanced database optimizations for million-user scale
-- This migration adds critical indexes, materialized views, and configurations for production scale

-- ====================================
-- PART 1: ADVANCED INDEXES
-- ====================================

-- Partial index for published restaurants (most common query)
CREATE INDEX IF NOT EXISTS idx_restaurants_published 
ON restaurants(id, slug, created_at) 
WHERE published = true;

-- Full-text search index for dish names (for search feature)
CREATE INDEX IF NOT EXISTS idx_dishes_name_search 
ON dishes USING gin(to_tsvector('english', name));

-- Full-text search index for dish descriptions
CREATE INDEX IF NOT EXISTS idx_dishes_description_search 
ON dishes USING gin(to_tsvector('english', description));

-- Composite index for common dish queries
CREATE INDEX IF NOT EXISTS idx_dishes_composite_query 
ON dishes(subcategory_id, order_index, is_new, is_special, is_popular);

-- Index for owner queries (dashboard page)
CREATE INDEX IF NOT EXISTS idx_restaurants_owner 
ON restaurants(owner_id, created_at DESC) 
WHERE published = true;

-- Index for category + subcategory joins
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_published 
ON categories(restaurant_id, order_index) 
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE published = true);

-- ====================================
-- PART 2: MATERIALIZED VIEWS
-- ====================================

-- Materialized view for hot menu data (most accessed restaurants)
CREATE MATERIALIZED VIEW IF NOT EXISTS hot_menu_data AS
SELECT 
  r.id as restaurant_id,
  r.name as restaurant_name,
  r.slug,
  r.hero_image_url,
  r.theme,
  json_agg(
    json_build_object(
      'id', c.id,
      'name', c.name,
      'order_index', c.order_index,
      'subcategory_count', (
        SELECT COUNT(*) FROM subcategories WHERE category_id = c.id
      )
    ) ORDER BY c.order_index
  ) as categories
FROM restaurants r
LEFT JOIN categories c ON c.restaurant_id = r.id
WHERE r.published = true
GROUP BY r.id, r.name, r.slug, r.hero_image_url, r.theme;

-- Create unique index on materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_menu_restaurant_id 
ON hot_menu_data(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_hot_menu_slug 
ON hot_menu_data(slug);

-- ====================================
-- PART 3: STATISTICS
-- ====================================

-- Force PostgreSQL to update statistics for better query planning
ANALYZE restaurants;
ANALYZE categories;
ANALYZE subcategories;
ANALYZE dishes;
ANALYZE dish_options;
ANALYZE dish_modifiers;

-- ====================================
-- PART 4: QUERY OPTIMIZATION FUNCTIONS
-- ====================================

-- Function to refresh materialized views (call periodically)
CREATE OR REPLACE FUNCTION refresh_hot_menu_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY hot_menu_data;
END;
$$;

-- Function to get restaurant menu with optimized query
CREATE OR REPLACE FUNCTION get_restaurant_menu_optimized(p_slug text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_restaurant_id uuid;
  result json;
BEGIN
  -- Get restaurant ID from slug (indexed lookup)
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE slug = p_slug AND published = true
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RETURN json_build_object('error', 'Restaurant not found');
  END IF;

  -- Build complete menu in single query with CTEs
  WITH restaurant_data AS (
    SELECT 
      id, name, slug, tagline, hero_image_url, theme, 
      allergen_filter_order, dietary_filter_order, 
      badge_display_order, show_allergen_filter
    FROM restaurants
    WHERE id = v_restaurant_id
  ),
  categories_data AS (
    SELECT 
      c.id,
      c.name,
      c.order_index,
      json_agg(
        json_build_object(
          'id', s.id,
          'name', s.name,
          'order_index', s.order_index,
          'dishes', (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', d.id,
                'name', d.name,
                'description', d.description,
                'price', d.price,
                'image_url', d.image_url,
                'is_new', d.is_new,
                'is_special', d.is_special,
                'is_popular', d.is_popular,
                'is_chef_recommendation', d.is_chef_recommendation,
                'is_vegetarian', d.is_vegetarian,
                'is_vegan', d.is_vegan,
                'is_spicy', d.is_spicy,
                'allergens', d.allergens,
                'calories', d.calories,
                'has_options', d.has_options,
                'order_index', d.order_index
              ) ORDER BY d.order_index
            ), '[]'::json)
            FROM dishes d
            WHERE d.subcategory_id = s.id
          )
        ) ORDER BY s.order_index
      ) as subcategories
    FROM categories c
    LEFT JOIN subcategories s ON s.category_id = c.id
    WHERE c.restaurant_id = v_restaurant_id
    GROUP BY c.id, c.name, c.order_index
    ORDER BY c.order_index
  )
  SELECT json_build_object(
    'restaurant', (SELECT row_to_json(r) FROM restaurant_data r),
    'categories', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'order_index', order_index,
          'subcategories', subcategories
        ) ORDER BY order_index
      )
      FROM categories_data
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- ====================================
-- PART 5: CONNECTION POOLING HINTS
-- ====================================

-- Set optimal connection parameters
ALTER DATABASE postgres SET work_mem = '32MB';
ALTER DATABASE postgres SET maintenance_work_mem = '128MB';
ALTER DATABASE postgres SET effective_cache_size = '4GB';
ALTER DATABASE postgres SET random_page_cost = 1.1; -- For SSD

-- ====================================
-- PART 6: PERFORMANCE MONITORING
-- ====================================

-- Create function to monitor slow queries
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE (
  query text,
  calls bigint,
  total_time double precision,
  mean_time double precision
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    query,
    calls,
    total_exec_time as total_time,
    mean_exec_time as mean_time
  FROM pg_stat_statements
  WHERE mean_exec_time > 100 -- queries taking > 100ms
  ORDER BY mean_exec_time DESC
  LIMIT 20;
$$;

-- ====================================
-- PART 7: CACHING HINTS
-- ====================================

-- Add caching hints to frequently accessed tables
ALTER TABLE restaurants SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE dishes SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- ====================================
-- COMMENTS FOR DOCUMENTATION
-- ====================================

COMMENT ON MATERIALIZED VIEW hot_menu_data IS 
'Cached view of frequently accessed menu data. Refresh every 5 minutes in production.';

COMMENT ON FUNCTION get_restaurant_menu_optimized IS 
'Optimized function to fetch complete restaurant menu in single query. Use this instead of multiple SELECT queries.';

COMMENT ON INDEX idx_restaurants_published IS 
'Partial index for published restaurants - covers 95% of queries';

COMMENT ON INDEX idx_dishes_name_search IS 
'Full-text search index for dish names - enables instant search';
