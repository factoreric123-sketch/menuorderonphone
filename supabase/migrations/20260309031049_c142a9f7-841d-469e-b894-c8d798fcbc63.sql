
-- Clean up data for factoreric123@gmail.com (85b9126f-4e32-4b3e-9740-b7fb79ed31c3)
-- and efactor09@gmail.com (286cd39b-50cf-4fc6-87db-9e6ff51a7cdd)

-- Delete order items for their restaurants
DELETE FROM public.order_items WHERE order_id IN (
  SELECT o.id FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);

-- Delete orders
DELETE FROM public.orders WHERE restaurant_id IN (
  SELECT id FROM public.restaurants WHERE owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);

-- Delete dish modifiers & options
DELETE FROM public.dish_modifiers WHERE dish_id IN (
  SELECT d.id FROM public.dishes d
  JOIN public.subcategories s ON s.id = d.subcategory_id
  JOIN public.categories c ON c.id = s.category_id
  JOIN public.restaurants r ON r.id = c.restaurant_id
  WHERE r.owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);
DELETE FROM public.dish_options WHERE dish_id IN (
  SELECT d.id FROM public.dishes d
  JOIN public.subcategories s ON s.id = d.subcategory_id
  JOIN public.categories c ON c.id = s.category_id
  JOIN public.restaurants r ON r.id = c.restaurant_id
  WHERE r.owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);

-- Delete dishes
DELETE FROM public.dishes WHERE restaurant_id IN (
  SELECT id FROM public.restaurants WHERE owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);

-- Delete subcategories
DELETE FROM public.subcategories WHERE category_id IN (
  SELECT c.id FROM public.categories c
  JOIN public.restaurants r ON r.id = c.restaurant_id
  WHERE r.owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);

-- Delete categories
DELETE FROM public.categories WHERE restaurant_id IN (
  SELECT id FROM public.restaurants WHERE owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);

-- Delete tables, stations, menu_links
DELETE FROM public.restaurant_tables WHERE restaurant_id IN (
  SELECT id FROM public.restaurants WHERE owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);
DELETE FROM public.stations WHERE restaurant_id IN (
  SELECT id FROM public.restaurants WHERE owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);
DELETE FROM public.menu_links WHERE restaurant_id IN (
  SELECT id FROM public.restaurants WHERE owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd')
);

-- Delete restaurants
DELETE FROM public.restaurants WHERE owner_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd');

-- Delete subscriptions, profiles, user_roles, user_themes
DELETE FROM public.subscriptions WHERE user_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd');
DELETE FROM public.profiles WHERE user_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd');
DELETE FROM public.user_roles WHERE user_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd');
DELETE FROM public.user_themes WHERE user_id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd');

-- Delete auth users
DELETE FROM auth.users WHERE id IN ('85b9126f-4e32-4b3e-9740-b7fb79ed31c3', '286cd39b-50cf-4fc6-87db-9e6ff51a7cdd');
