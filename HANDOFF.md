# Ma3 Navigator: handoff for another AI

## Owner
Muhia, junior dev in Nairobi. Wants plain simple explanations, complete paste-ready files (zips, not diffs), no needless questions, ONE command per code box, and exact click paths on Supabase/Vercel/GitHub. Windows PowerShell (use `npx.cmd`).

## Stack and places
React 18 + TypeScript + Vite, MapLibre, wouter, framer-motion, sonner, lucide-react 0.383, Supabase (free), Vercel.
- Repo: https://github.com/Two-Point-0/ma3-navigator-1- (branch main; push auto-deploys)
- Live: https://ma3-navigator-1.vercel.app
- Supabase project ref: uygefywqxtqpfaibjete
- Local: `C:\Users\denni\OneDrive\Desktop\project 2\ma3-navigator (1)`
- Never put secret keys in the browser or in chat. Only the publishable key goes in Vercel `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.

## How updates are delivered
AI gives a zip of changed files -> Expand-Archive -Force into project -> Remove-Item zip -> `npm run build` -> git add . -> git commit -m "..." -> git push origin main. DB changes: `npx.cmd supabase db push --remote` (type y).

## Done
Lucide vehicle icons (no circles); curved animated flight/SGR/train paths with plane/train and dashed trail; sights pop up along the path and open Explore; Explore (empty map, search sheet, category chips, full-screen posters); Ndai demo riders moving on real roads; matatu markers on polylines; built-in SGR route; AI-sounding text trimmed; poster system (PosterModal, `src/lib/posters.tsx`, `place_posters` table, `posters` and `business-images` buckets); 30 sights data; 31 Local categories; 100 demo Local businesses (seed + prompts).

## Key files
`src/pages/Explore.tsx`, `Fly.tsx`, `Ma3.tsx`; `src/components/PosterModal.tsx`, `LocalPanel.tsx`, `DemoRidersLayer.tsx`, `DemoVehicleLayer.tsx`; `src/lib/vehicleIcons.tsx`, `placeIcons.tsx`, `sightIcons.tsx`, `arc.ts`, `routeAnim.ts`, `posters.tsx`, `walkRoute.ts`; `src/data/sights.ts`, `sgrFallback.ts`; `docs/*`; `supabase/migrations`, `supabase/seed`.

## Gotchas
- MapLibre marker root element must not set its own `position`; wrap in a child.
- Don't pass changing center/zoom props to MapLibreView (zoom snap-back).
- RLS: local_businesses visible only if status 'active' and paid_until > now().

## Pending
1. User to confirm Vercel redeploy works and `/login` toast fixed; rotate exposed Supabase secret key; set Supabase Site URL to the live URL.
2. Run migration `20261125000000_place_posters.sql`; upload 30 sight posters to `posters/sights/<id>.jpg` (rename from Stitch export).
3. Generate 100 Local posters, upload to `business-images/demo/`, run `demo_local_businesses.sql`.
4. Run `demo_catalog.sql`; `make_roast_admin.sql` phone -> 254712345678; test login 0712345678 / 123456.
5. Check `select count(*) from explore_pois;` (87k import via `scripts/import-kenya-pois.mjs` may never have run).
6. Verify approximate park-gate coordinates.

## Added 2026-11-27
- Local list: thumbnail = top crop of the poster (`image_paths[1]` if present). Local sheet opens at half height; `.market-page > .inner` no longer blocks map touches.
- `src/components/MatatuRateCard.tsx`: StatBars (game bars), RateCardModal, FaceOffModal. Used in `DemoVehicleLayer` popup ("Rate card" button) and the Mirth nganya detail. Matatu pictures: Storage `posters/matatus/<plate-slug>.png`.
- `src/data/basketTemplates.ts` + table `basket_templates`: 14 ready-made baskets in Market > Compare. `ListCompare` has an item-by-item colour table (green cheapest, red dearest, amber same, remove products).
- Migration `20261127000000_rate_cards_basket_templates.sql` must be pushed (`npx.cmd supabase db push --remote`).
- Saved baskets, sharing by code and Boda Basket already existed (Market > Basket > My lists).
