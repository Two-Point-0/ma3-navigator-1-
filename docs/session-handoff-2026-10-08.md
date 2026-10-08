

## Unified backend handover update — 8 October 2026

The attached implementation brief was reviewed and the safe MVP portion was implemented. The repository now contains a single-backend Supabase path while retaining the existing Firebase scaffolding temporarily for compatibility. Supabase is optional during local development: if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are absent, the app uses clearly labelled local demo data.

New backend files:

- `src/lib/supabase.ts` — browser-safe Supabase client using only the URL and anon key.
- `src/lib/appMode.ts` — central demo-mode flags.
- `supabase/migrations/20261008_initial_ma3.sql` — unified tables, latest-price view and explicit RLS policies.
- `supabase/seed/demo_catalog.sql` — five retailers, demo products and seeded prices.
- `docs/supabase-setup.md` — Supabase dashboard, environment and import instructions.

The Market page now compares five stores: Naivas, Quickmart, Carrefour, Chandarana Foodplus and Cleanshelf. It keeps bachelor, family and school templates, product search, basket quantities, basket totals and the cheapest overall store. It can hydrate matching demo catalogue rows from Supabase when configured, and falls back to local demo values when it is not. It never presents seeded values as live or official prices.

Ndai booking, carpool payment and delivery payment are blocked while `APP_MODE.demo` is true. Driver mode uses simulated coordinates while demo mode is true and labels the action as a demo location preview. The backend SQL keeps sensitive tables behind RLS and allows only public active products, retailers and seeded demo prices to be read anonymously.

The build completed successfully after these changes. Existing warnings concern Firebase dynamic/static imports and the large generated JavaScript bundle; they are not TypeScript errors. Before production, migrate authentication and wallet persistence to the same Supabase project or deliberately document the temporary Firebase bridge, then remove unused Firebase code.
