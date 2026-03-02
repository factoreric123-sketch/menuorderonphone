import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";

/**
 * Legacy route redirect component
 * Handles old QR codes using /:slug pattern by redirecting to canonical /menu/:slug
 */
const MenuRedirect = () => {
  const { slug } = useParams<{ slug: string }>();

  // Sanitize and normalize the slug
  const cleanSlug = (slug || '')
    .trim()
    .toLowerCase()
    .replace(/^:+/, '') // remove leading colons
    .replace(/^menu\//, '') // strip accidental menu/ prefix
    .replace(/\/+/g, '/') // collapse multiple slashes
    .split('/')
    .filter(Boolean)
    .pop() || '';

  // If no valid slug, redirect to home
  if (!cleanSlug) {
    return <Navigate to="/" replace />;
  }

  // Redirect to canonical /menu/:slug route
  return <Navigate to={`/menu/${cleanSlug}`} replace />;
};

export default MenuRedirect;
