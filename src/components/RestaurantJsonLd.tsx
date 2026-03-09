import { useMemo } from 'react';

interface RestaurantJsonLdProps {
  restaurant: {
    name: string;
    slug: string;
    tagline?: string;
    address?: string;
    phone?: string;
    hero_image_url?: string;
    business_hours?: Record<string, { open: string; close: string; closed?: boolean }>;
  };
  categories: Array<{
    name: string;
    subcategories: Array<{
      dishes: Array<{
        name: string;
        description?: string;
        price: string;
        image_url?: string;
      }>;
    }>;
  }>;
}

/**
 * Renders JSON-LD structured data for SEO.
 * Schema.org Restaurant + Menu markup for Google rich results.
 */
export const RestaurantJsonLd = ({ restaurant, categories }: RestaurantJsonLdProps) => {
  const jsonLd = useMemo(() => {
    const menuSections = categories.map((cat) => ({
      '@type': 'MenuSection',
      name: cat.name,
      hasMenuItem: cat.subcategories?.flatMap((sub) =>
        sub.dishes?.map((dish) => ({
          '@type': 'MenuItem',
          name: dish.name,
          description: dish.description || undefined,
          offers: {
            '@type': 'Offer',
            price: dish.price.replace(/[^0-9.]/g, ''),
            priceCurrency: 'USD',
          },
          image: dish.image_url || undefined,
        }))
      ),
    }));

    const schema: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: restaurant.name,
      description: restaurant.tagline || `${restaurant.name} digital menu`,
      url: `https://exact-clone-sync.lovable.app/menu/${restaurant.slug}`,
      hasMenu: {
        '@type': 'Menu',
        hasMenuSection: menuSections,
      },
    };

    if (restaurant.address) schema.address = { '@type': 'PostalAddress', streetAddress: restaurant.address };
    if (restaurant.phone) schema.telephone = restaurant.phone;
    if (restaurant.hero_image_url) schema.image = restaurant.hero_image_url;

    return schema;
  }, [restaurant, categories]);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
};
