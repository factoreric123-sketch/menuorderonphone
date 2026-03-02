-- Add filter ordering configuration to restaurants table
ALTER TABLE public.restaurants 
  ADD COLUMN allergen_filter_order JSONB DEFAULT '["gluten","dairy","eggs","fish","shellfish","nuts","soy","pork","beef","poultry"]',
  ADD COLUMN dietary_filter_order JSONB DEFAULT '["vegetarian","vegan"]',
  ADD COLUMN badge_display_order JSONB DEFAULT '["isNew","isSpecial","isPopular","isChefRecommendation"]';