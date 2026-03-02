import { useEffect } from 'react';

/**
 * DNS prefetch and TCP preconnect for instant loading
 * Warms up the connection before any data requests
 */
export const Preconnect = () => {
  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    if (!supabaseUrl) return;

    // Only add if not already present
    const existingPreconnect = document.querySelector(`link[href="${supabaseUrl}"]`);
    if (existingPreconnect) return;

    // DNS prefetch
    const dnsPrefetch = document.createElement('link');
    dnsPrefetch.rel = 'dns-prefetch';
    dnsPrefetch.href = supabaseUrl;
    document.head.appendChild(dnsPrefetch);

    // TCP + TLS preconnect
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = supabaseUrl;
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);

    return () => {
      // Cleanup on unmount
      dnsPrefetch.remove();
      preconnect.remove();
    };
  }, []);

  return null;
};
