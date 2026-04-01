
# Production Readiness Improvements — Round 5

Based on the security scan (35 findings), code review, and competitor analysis, here are the highest-impact improvements remaining.

---

## 1. Fix 35 Supabase Security Warnings (Critical)

The security scan found serious issues that must be fixed before any real deployment:

- **Overly permissive RLS policies**: Some tables have `WITH CHECK (true)` on INSERT/UPDATE/DELETE — any anonymous user could write data
- **Anonymous access on sensitive tables**: `orders`, `order_items`, `subscriptions`, `profiles` allow anonymous access via policies targeting the `anon` role
- **Functions missing `search_path`**: Multiple database functions don't set `search_path`, which is a privilege escalation vector
- **Materialized view exposed in API**: A materialized view is accessible via the public API

**Changes:**
- Create a migration that tightens all RLS policies to require `auth.uid()` where appropriate
- Set `search_path = public` on all custom functions
- Revoke API access from the materialized view
- Keep public SELECT on `dishes`, `categories`, `subcategories` (needed for public menus) but restrict write operations to authenticated owners only

---

## 2. Add Google OAuth Sign-In

Competitors like GloriaFood and MenuDrive all offer social login. Currently only email/password is supported.

**Changes:**
- Add a "Sign in with Google" button to `Auth.tsx`
- Use `supabase.auth.signInWithOAuth({ provider: 'google' })` — no backend changes needed
- Style consistently with existing auth form

---

## 3. Add Loading/Empty States to Dashboard

The dashboard has no empty state for new users and minimal loading feedback.

**Changes:**
- Add an onboarding empty state when `restaurants.length === 0` with a clear CTA to create first restaurant
- Add skeleton loading for restaurant cards and stats
- Show a welcome message with the user's email

---

## 4. Menu Search Improvement — Debounced Input

The public menu search in `PublicMenuStatic.tsx` filters on every keystroke. On large menus this causes jank.

**Changes:**
- Add a 200ms debounce to the search input using a simple `useEffect` + `setTimeout` pattern
- No new dependencies needed

---

## 5. Error Handling in Checkout Flow

The checkout page (`Checkout.tsx`) invokes an edge function but has minimal error handling for network failures and no retry mechanism.

**Changes:**
- Add a retry button on order submission failure
- Show specific error messages (network error vs. server error vs. rate limit)
- Disable the submit button and show a spinner during submission (partially exists, needs polish)

---

## Technical Details

| Area | Files Changed |
|------|--------------|
| Security (RLS) | New migration file |
| Google OAuth | `src/pages/Auth.tsx` |
| Dashboard UX | `src/pages/Dashboard.tsx` |
| Search debounce | `src/pages/PublicMenuStatic.tsx` |
| Checkout errors | `src/pages/Checkout.tsx` |

Priority order: Security fixes (#1) > Google OAuth (#2) > Dashboard UX (#3) > Search (#4) > Checkout (#5)
