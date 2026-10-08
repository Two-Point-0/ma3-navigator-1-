# Ma3 Supabase setup and catalogue import

The attached handover is correct to use one Supabase project and one PostgreSQL database. This implementation keeps the app in demo mode until legal, insurance, privacy and verification work is complete.

## Create the backend

1. Create one project at [Supabase](https://supabase.com/).
2. In **SQL Editor**, run `supabase/migrations/20261008_initial_ma3.sql`.
3. Run `supabase/seed/demo_catalog.sql`.
4. In **Project Settings → API**, copy only the project URL and the `anon` public key.
5. Copy `.env.example` to `.env.local` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Never put the `service_role` key in `.env.local`, Vite code, GitHub or a browser. It bypasses Row Level Security.

## Catalogue import

Do not expose a public CSV uploader. A trusted administrator should validate the file and load it through a protected server-side script or the Supabase dashboard after review.

Products CSV:

```csv
sku,name,normalized_name,category,brand,pack_size,barcode
MAIZE-2KG,Maize flour,maize flour,Staples,,2 kg,
```

Prices CSV:

```csv
sku,retailer_slug,branch,region,price_kes,pack_size,source_type,observed_at,verified
MAIZE-2KG,naivas,Nairobi CBD,Nairobi,145,2 kg,seeded_demo,2026-10-08,false
```

The import process must reject missing SKU, unknown retailer slug, negative or non-numeric prices, mismatched pack sizes and duplicate observations for the same product, retailer, branch and observation date. Demo rows should use `seeded_demo` and `verified=false`. A future partner feed should use `partner_data` or `retailer_feed` only after written permission.

## Permitted price sources

Do not scrape DealMtaani or Money254 without written permission or a licensed feed. Public availability is not a scraping licence. Use seeded demonstration rows, retailer submissions, permissioned feeds, or moderated user shelf checks. Show the source type, observation date and an explicit “verify before purchase” notice.

## Run the app

From the repository:

```powershell
npm install
npm run build
npm run dev
```

Open `/market`. Without Supabase variables, the app deliberately uses local demo values. With Supabase variables, the Market page can read public active products and demo price observations through RLS. Real catalogue administration should be added as a protected server-side workflow, not a public frontend screen.

## Production gates still required

Before changing demo flags, implement server-side checks for user identity, vehicle ownership, licence, passenger-appropriate insurance, roadworthiness, location consent, data retention and transport-law classification. Keep `APP_MODE.demo` true until counsel and the insurer approve the exact pilot model.
