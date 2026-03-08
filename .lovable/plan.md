

# What's Missing to Make TapTab Production-Ready

After reviewing the full codebase, database, edge functions, and feature set, here's a clear picture of what you have and what's still needed.

## What's Already Built (Working)
- Menu editor with drag-and-drop, categories, subcategories, dishes, options, modifiers
- Public menu display with QR code short links
- Cart + Checkout flow (guest ordering, pay-at-table)
- Order status page with realtime updates
- Kitchen ticket board with station filtering and audio alerts
- Orders admin dashboard with active/history tabs, stats, and filtering
- Table management with QR code generation
- Stripe subscription billing for premium plans
- Auth, dashboard, restaurant CRUD
- Theme system with custom fonts, colors, layout options

## What's Missing — Priority Order

### 1. Online Payment (Stripe Checkout for Orders)
The checkout page has "Pay Online" **disabled** with "Coming soon." Stripe is already connected for subscriptions, but there's no integration to accept payment for actual food orders. This is a major gap for restaurants that want online ordering.

**What to build:** A `create-payment-intent` edge function that creates a Stripe PaymentIntent for the order total, returns a client secret, and the Checkout page embeds Stripe Elements or redirects to Stripe Checkout. The existing `stripe-webhook` already handles `payment_intent.succeeded`.

### 2. Email/SMS Notifications
No notifications are sent when:
- A new order is placed (restaurant owner doesn't get alerted unless they're staring at the Kitchen/Orders page)
- Order status changes (guest only sees it if they keep the status page open)

**What to build:** Use the existing Resend API key to send email alerts to restaurant owners on new orders, and optionally email/SMS the guest when order status changes.

### 3. Restaurant Settings for Ordering
The `ordering_enabled` flag exists in the database but there's no visible UI toggle in the restaurant settings to turn online ordering on/off. The `tax_rate` field also needs a settings UI.

**What to build:** Add ordering toggle and tax rate input to `RestaurantSettingsDialog.tsx`.

### 4. Print Receipts / Kitchen Tickets
Both the Kitchen and Orders Admin pages reference a `Printer` icon but there's no actual print implementation.

**What to build:** A print-friendly CSS layout that opens `window.print()` with a formatted ticket/receipt.

### 5. Dish Availability Toggle
The `available` column exists on dishes and the `create-order` edge function checks it, but there's no UI in the editor to mark a dish as "86'd" / sold out.

**What to build:** A toggle in the dish editor row and a "Sold Out" badge on the public menu.

### 6. Business Hours / Open-Closed Status
No way for restaurants to set operating hours or auto-disable ordering when closed.

### 7. Analytics Dashboard
No revenue reporting, order trends, or popular items dashboard for restaurant owners.

### 8. Mobile Responsiveness for Admin Pages
The Kitchen and Orders Admin pages were built for desktop. They need testing and polish on mobile/tablet since restaurant staff often use iPads.

### 9. Multi-Language Support
For an international SaaS, menus should support translations.

### 10. PWA / Offline Support
The `site.webmanifest` exists but there's no service worker for offline menu viewing.

---

## Recommended Next Steps (in order)

| Priority | Feature | Effort |
|----------|---------|--------|
| 1 | Add ordering toggle + tax rate to restaurant settings UI | Small |
| 2 | Add dish availability toggle ("86" a dish) | Small |
| 3 | Enable Stripe online payment for orders | Medium |
| 4 | Add email notifications on new orders (Resend) | Medium |
| 5 | Add print support for kitchen tickets | Small |
| 6 | Add analytics/revenue dashboard | Medium |
| 7 | Business hours + auto-close | Medium |

Items 1-2 are quick wins you can ship today. Item 3 (online payment) is the biggest missing piece for real restaurant use.

