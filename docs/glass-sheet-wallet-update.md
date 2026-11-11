# Update: shared popup, traffic-light theme, parcel tab, matatu wallet, sample data

## What changed
- `src/lib/useSheet.ts` – one hook used by every bottom popup (Ma3, Ndai, Fly, Explore, Mirth, Market).
  Sits above the bottom nav, drag/tap the bar for peek / half / full, lifts above the phone keyboard.
- `src/index.css` – LED edge (red→amber→green cycle) on popups, red/amber/green top tabs, wallet styles.
  Respects "reduce motion".
- `src/components/PageTabs.tsx` – 3-tab rows are coloured left red, middle amber, right green.
- Ma3 tabs: Matatu routes · Parcel delivery · Train stations (`src/components/ParcelPanel.tsx`).
- Fly tabs: Domestic · International · SGR.
- Explore: search moved from under the tabs into the bottom popup.
- Wallet: `/wallet` (`src/pages/Wallet.tsx`), matatu front, windscreen = balance, side mirrors = buttons
  (Past = recent transactions, Gauge = rides left), number plate = Load wallet.
  `src/lib/wallet.tsx` now keeps a transaction history. `src/lib/mpesa.ts` = demo STK push (real mode
  calls a Supabase Edge Function `mpesa-stk-push`, which still has to be written and deployed).
- Sample data: `node scripts/generate-sample-market.mjs` → `supabase/sample_data/*.csv`
  (668 products, ~7,400 prices, all `seeded_demo`, `verified=false`, branch coordinates are area centres).

## Import the sample data
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-market-csv.mjs \
      --products supabase/sample_data/products.csv --prices supabase/sample_data/price_observations.csv
(Keep the service-role key in the terminal only, never in .env.local with a VITE_ prefix.)
