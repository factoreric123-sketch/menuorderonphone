import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    console.log('[resolve-menu] Resolving slug:', slug);

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Missing slug parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client with anon key for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Sanitize slug
    const cleanSlug = slug
      .trim()
      .toLowerCase()
      .replace(/^:+/, '')
      .replace(/^menu\//, '')
      .split('/')
      .filter(Boolean)
      .pop() || '';

    console.log('[resolve-menu] Clean slug:', cleanSlug);

    if (!cleanSlug) {
      return new Response(
        JSON.stringify({ error: 'Invalid slug format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Query for restaurant (RLS allows reading published restaurants)
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('id, slug, published')
      .eq('slug', cleanSlug)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[resolve-menu] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Database error', details: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!restaurant) {
      console.log('[resolve-menu] Restaurant not found');
      return new Response(
        JSON.stringify({ error: 'Restaurant not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!restaurant.published) {
      console.log('[resolve-menu] Restaurant not published');
      return new Response(
        JSON.stringify({ error: 'Menu not published' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build canonical URL
    const publicSiteUrl = Deno.env.get('VITE_PUBLIC_SITE_URL') || supabaseUrl.replace('//', '//menutap.');
    const canonicalUrl = `${publicSiteUrl}/menu/${restaurant.slug}`;

    console.log('[resolve-menu] Redirecting to:', canonicalUrl);

    // Return 302 redirect to canonical menu URL
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': canonicalUrl,
      },
    });

  } catch (error) {
    console.error('[resolve-menu] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
