import { useParams } from "react-router-dom";
import { useRestaurant } from "@/hooks/useRestaurants";
import { useCategories } from "@/hooks/useCategories";
import { useSubcategories } from "@/hooks/useSubcategories";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PublicMenuStatic from "./PublicMenuStatic";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface PublicMenuProps {
  slugOverride?: string;
}

const PublicMenu = ({ slugOverride }: PublicMenuProps) => {
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = slugOverride || urlSlug;

  const { data: restaurant, isLoading: restaurantLoading } = useRestaurant(slug || "");

  // Fetch full menu data in the same shape PublicMenuStatic expects
  const { data: categories } = useCategories(restaurant?.id || "", {
    enabled: !!restaurant?.id && restaurant?.published === true,
  });

  const allSubcategoryIds = categories?.map(c => c.id) || [];

  // Fetch subcategories for all categories
  const { data: allSubcategories } = useQuery({
    queryKey: ['all-subcategories', allSubcategoryIds],
    queryFn: async () => {
      if (!allSubcategoryIds.length) return [];
      const { data } = await supabase
        .from('subcategories')
        .select('*')
        .in('category_id', allSubcategoryIds)
        .order('order_index');
      return data || [];
    },
    enabled: allSubcategoryIds.length > 0,
  });

  // Fetch all dishes for all subcategories
  const allSubIds = allSubcategories?.map(s => s.id) || [];
  const { data: allDishes } = useQuery({
    queryKey: ['all-dishes-for-menu', allSubIds],
    queryFn: async () => {
      if (!allSubIds.length) return [];
      const { data } = await supabase
        .from('dishes')
        .select('*')
        .in('subcategory_id', allSubIds)
        .order('order_index');
      return data || [];
    },
    enabled: allSubIds.length > 0,
  });

  if (restaurantLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-64 bg-muted/50 animate-pulse" />
        <div className="container mx-auto px-4 py-6 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Restaurant Not Found</h1>
          <p className="text-muted-foreground">This menu doesn't exist or has been removed.</p>
          <Button onClick={() => window.location.href = '/'}>Return Home</Button>
        </div>
      </div>
    );
  }

  if (!restaurant.published) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Menu Not Available</h1>
          <p className="text-muted-foreground">This menu hasn't been published yet.</p>
          <Button onClick={() => window.location.href = '/'}>Return Home</Button>
        </div>
      </div>
    );
  }

  // Build the categories structure that PublicMenuStatic expects
  const fullCategories = (categories || []).map(cat => {
    const subs = (allSubcategories || []).filter(s => s.category_id === cat.id);
    return {
      ...cat,
      subcategories: subs.map(sub => ({
        ...sub,
        dishes: (allDishes || []).filter(d => d.subcategory_id === sub.id),
      })),
    };
  });

  return (
    <PublicMenuStatic
      restaurant={restaurant}
      categories={fullCategories}
      orderingEnabled={true}
    />
  );
};

export default PublicMenu;
