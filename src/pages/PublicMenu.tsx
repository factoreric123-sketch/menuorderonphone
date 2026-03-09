import { useParams } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PublicMenuStatic from "./PublicMenuStatic";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RestaurantJsonLd } from "@/components/RestaurantJsonLd";

interface PublicMenuProps {
  slugOverride?: string;
}

const PublicMenu = ({ slugOverride }: PublicMenuProps) => {
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = slugOverride || urlSlug;

  // Single RPC call replaces 4 waterfall queries (restaurant + categories + subcategories + dishes)
  const { data: menuData, isLoading, error } = useQuery({
    queryKey: ['public-menu', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug');
      const { data, error } = await supabase.rpc('get_restaurant_menu_optimized', {
        p_slug: slug,
      });
      if (error) throw error;
      const parsed = data as any;
      if (parsed?.error) throw new Error(parsed.error);
      return parsed as { restaurant: any; categories: any[] };
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5, // 5 min cache for public menus
  });

  const restaurant = menuData?.restaurant;
  const categories = menuData?.categories || [];

  useDocumentTitle(
    restaurant?.name ? `${restaurant.name} Menu` : "Menu",
    restaurant?.tagline || "View our digital menu"
  );

  if (isLoading) {
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

  if (error || !restaurant) {
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

  return (
    <>
      <RestaurantJsonLd restaurant={restaurant} categories={categories} />
      <PublicMenuStatic
        restaurant={restaurant}
        categories={categories}
        orderingEnabled={restaurant.ordering_enabled === true}
      />
    </>
  );
};

export default PublicMenu;
