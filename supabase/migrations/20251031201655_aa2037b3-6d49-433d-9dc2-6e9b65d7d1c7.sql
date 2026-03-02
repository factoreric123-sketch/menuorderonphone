-- Phase 1: Backfill subscriptions for existing users
INSERT INTO public.subscriptions (user_id, status, plan_type)
SELECT id, 'active', 'free' 
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions);

-- Phase 2: Add foreign key cascades for data integrity
ALTER TABLE public.subcategories
DROP CONSTRAINT IF EXISTS subcategories_category_id_fkey,
ADD CONSTRAINT subcategories_category_id_fkey 
  FOREIGN KEY (category_id) 
  REFERENCES public.categories(id) 
  ON DELETE CASCADE;

ALTER TABLE public.dishes
DROP CONSTRAINT IF EXISTS dishes_subcategory_id_fkey,
ADD CONSTRAINT dishes_subcategory_id_fkey 
  FOREIGN KEY (subcategory_id) 
  REFERENCES public.subcategories(id) 
  ON DELETE CASCADE;

-- Phase 2: Fix search_path in database functions
CREATE OR REPLACE FUNCTION public.batch_update_order_indexes(table_name text, updates jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item JSONB;
BEGIN
  IF table_name NOT IN ('categories', 'subcategories', 'dishes') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    EXECUTE format(
      'UPDATE %I SET order_index = $1 WHERE id = $2',
      table_name
    ) USING (item->>'order_index')::INTEGER, (item->>'id')::UUID;
  END LOOP;
END;
$function$;