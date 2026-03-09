-- Fix get_restaurant_menu_optimized to include available, modifiers, options, and all restaurant settings
CREATE OR REPLACE FUNCTION public.get_restaurant_menu_optimized(p_slug text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant_id uuid;
  result json;
BEGIN
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE slug = p_slug AND published = true
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RETURN json_build_object('error', 'Restaurant not found');
  END IF;

  WITH restaurant_data AS (
    SELECT
      id, name, slug, tagline, hero_image_url, theme,
      allergen_filter_order, dietary_filter_order,
      badge_display_order, show_allergen_filter,
      show_images, show_prices, show_currency_symbol,
      force_two_decimals, badge_colors, grid_columns,
      layout_style, layout_density, image_size, card_image_shape,
      menu_font, menu_font_size, text_overlay,
      ordering_enabled, tax_rate, phone, address, business_hours,
      published
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
                'available', d.available,
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
                'order_index', d.order_index,
                'options', (
                  SELECT COALESCE(json_agg(
                    json_build_object(
                      'id', opt.id,
                      'name', opt.name,
                      'price', opt.price,
                      'order_index', opt.order_index
                    ) ORDER BY opt.order_index
                  ), '[]'::json)
                  FROM dish_options opt
                  WHERE opt.dish_id = d.id
                ),
                'modifiers', (
                  SELECT COALESCE(json_agg(
                    json_build_object(
                      'id', mod.id,
                      'name', mod.name,
                      'price', mod.price,
                      'order_index', mod.order_index
                    ) ORDER BY mod.order_index
                  ), '[]'::json)
                  FROM dish_modifiers mod
                  WHERE mod.dish_id = d.id
                )
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
$function$;