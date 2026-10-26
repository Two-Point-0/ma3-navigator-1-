# Ma3 — Supabase setup and data integration

The app reads shared Explore, Market and Mirth data from Supabase. The matching local checkout is `C:\Users\denni\OneDrive\Desktop\project 2\ma3-navigator (1)` (the `main` checkout of [`Two-Point-0/ma3-navigator-1-`](https://github.com/Two-Point-0/ma3-navigator-1-)). Open this folder in VS Code.

## 1. Create the Supabase project

1. Create a project at [Supabase](https://supabase.com/).
2. In **SQL Editor**, run these scripts in order:
   1. `supabase/migrations/20261008_initial_ma3.sql`
   2. `supabase/migrations/20261009_explore_market_nganya.sql`
   3. `supabase/migrations/20261012_ma3_transit_tables.sql`
   4. `supabase/seed/demo_catalog.sql` (only seeds the five retailer reference rows—no fake products or shelf prices).
3. In **Project Settings → API**, copy the project URL and public `anon` key. Do **not** use a service-role/secret key in the app.
4. Copy `.env.example` to `.env.local` in the repository root and fill:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

   `.env.local` is Git-ignored. Restart the dev server after changing it.

## 2. Upload products and five-store prices

Market compares observations for **Naivas, Quickmart, Carrefour, Chandarana and Cleanshelf**. These templates contain only headers, deliberately:

- `supabase/import_templates/products.csv`: one product/SKU per row. Required `sku`, `name`, `pack_size`; optional normalized name, category, brand, barcode, image URL and active flag.
- `supabase/import_templates/price_observations.csv`: one *observed product × retailer × branch × date* per row. Required `sku`, `retailer_slug`, `region`, `price_kes`; include `branch`, `pack_size`, `source_type`, `source_url`, `observed_at` and `verified` where known.

For 100 commodities and five supermarkets, put up to 100 rows in the product file and up to 500 observations in the price file. Match pack sizes exactly and give every observation its own checked date/branch. Use the exact slugs `naivas`, `quickmart`, `carrefour`, `chandarana`, `cleanshelf`. Record personally checked data as `manual_entry`; only use `retailer_feed`/`partner_data` when you have permission. Keep `verified=false` until an authorised reviewer confirms the value.

In a VS Code **PowerShell** terminal at the repository root, paste the Supabase service-role key into the terminal prompt (not chat, source files or `.env.local`) and import:

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR_SECRET_SERVICE_ROLE_KEY"
node scripts/import-market-csv.mjs --products supabase/import_templates/products.csv --prices supabase/import_templates/price_observations.csv
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

Products import before prices. The CSV importer validates data and upserts repeat imports by SKU or observation key. It never exposes the privileged key to the browser. The app presents the most recent available price for each retailer; if a basket item is missing at a store, that basket total is marked **Missing price** instead of guessing.

## 3. Import the HOTOSM Kenya POIs into Explore

These three archives are **not identical copies**. Choose only `hotosm_ken_points_of_interest_osm_geojson.zip`: its OSM snapshot is **2026-09-06**, with 87,595 features (71,195 points, 15,829 polygons, 553 lines and 18 multipolygons). The `.gpkg.zip` is another format of that same dated export, but this importer reads GeoJSON. The `(1).geojson.zip` was generated later but contains an older **2026-08-07** OSM snapshot (87,275 features); do not import both snapshots. Extract the selected ZIP to a temporary folder, then import its `points_of_interest.geojson` file:

```powershell
$archive = "C:\Users\denni\OneDrive\Desktop\project 1\hotosm_ken_points_of_interest_osm_geojson.zip"
$extract = Join-Path $env:TEMP "ma3-pois-2026-09-06-$([guid]::NewGuid().ToString('N'))"
Expand-Archive -LiteralPath $archive -DestinationPath $extract
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR_SECRET_SERVICE_ROLE_KEY"
node scripts/import-kenya-pois.mjs (Join-Path $extract "points_of_interest.geojson") 2026-09-06
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

The importer upserts by OSM element ID, maps the actual export fields (`name_en`, `name_latin`, county/locality codes), and records the source snapshot date—not the day you ran the import. It imports supported point, line and area features as map anchors; non-point features use an approximate representative coordinate, and their full geometry is not rendered. Re-running the same snapshot is safe, but importing a different snapshot does not automatically delete features removed upstream, so do not mix archive versions. Explore queries the current map viewport from Supabase rather than shipping the national dump to the browser. OSM-derived data may be incomplete or stale; opening hours are not guaranteed. Attribution is displayed on the map; OSM material is subject to the [OpenStreetMap ODbL](https://www.openstreetmap.org/copyright).

## 4. Curate Nganya, daily votes, style ratings and points

Fill `supabase/import_templates/nganya_matatus.csv` with admin-reviewed records (`display_name,sacco,route_code,route_label,image_url,active`). Run:

```powershell
node scripts/import-market-csv.mjs --matatus supabase/import_templates/nganya_matatus.csv
```

In Supabase **Authentication → Providers**, enable **Anonymous Sign-ins** for a prototype. Mirth's Nganya vote is saved in Supabase, not as a mock count. Database rules enforce **one vote per account per route per Nairobi calendar day**; a voter may choose a different route the same day. Anonymous voting can be abused by creating multiple accounts, so it should not decide a prize until anti-bot/rate-limit and moderation controls exist.

The Nganya detail popup lets signed-in accounts rate **artwork, sound, lighting and comfort** from 1–5. Public scores are aggregated only; the app labels them subjective community style ratings, not safety measures. A successful route vote awards 10 non-cash community points; navigating to a valid mapped POI from Explore awards 5 points once per POI/day. These awards are written by database trigger/function, not trusted to browser-supplied point values.

The third daily challenge—**complete a paid booking/order**—is intentionally locked. This repository currently has no verified payment/order webhook; demo wallet or toast actions must never be credited as a real purchase. Once a legitimate provider and backend webhook exist, add a server-verified transaction event before awarding any points. Points have no cash value, cannot be staked and are not redeemable.

## 5. Nganya of the year: finalists and prediction picks

The migration creates `nganya_seasons`, `nganya_season_entries` and `nganya_season_picks`. The Mirth **Betting** tab is a *free, non-cash prediction* panel: there is no payment, wager, cash prize or points stake in this prototype. It appears only after a trusted organiser publishes a season and approved entrants.

**The schema does not automatically eliminate entrants.** Before starting a public contest, an organiser needs to publish dates, entrant verification rules, route representation, cut-off/appeal windows, deterministic tie-breaks, moderation and final-event rules. A reasonable process: open route-level voting in scheduled rounds; limit one vote per account/route/day; freeze and retain each round's tally; review unusual account bursts; advance a published shortlist; and publish exactly 30 finalists before the finale. Do not claim an automatic end-of-year Top 30 until the scheduled, audited advancement job is built and tested.

A trusted admin can create a season and entrants with the Supabase SQL editor or a protected admin tool. Example season header (choose and publish the real dates first):

```sql
insert into public.nganya_seasons (title, season_year, opens_on, closes_on, status)
values ('Nganya of the Year', 2026, '2026-10-15', '2026-12-15', 'draft');
```

Insert the approved candidates into `nganya_season_entries` for that season. To open the vote, change the season to `open`; to publish the final shortlist, first set `finalist=true` on exactly 30 audited entries, then set `status='finalists'`. `nganya_season_picks` allows one free forecast per Supabase account. Use a privileged server/admin workflow only—never give the service key to the frontend. Pick-cutoff and finalist transitions are currently **manual/admin-managed**; no cron or automated elimination has been configured.

## 6. Run the app and check the feeds

```powershell
npm install
npm run dev
```

Open **http://localhost:3000/**. Ma3 Live remains a clearly labelled placeholder until an authorised, real-time AVL/GPS feed is connected via a protected server-side adapter. The local TUMI GTFS snapshot ends **2020-12-31** and describes archived bus routes/stops, not live positions or current schedules. The Train layer displays mapped OSM rail polylines and station features only; it is not a timetable or proof of current service. Verify operations with Kenya Railways.

## 7. Ma3 transit data: move the large snapshot to the backend

Yes—routes, stop lookup and route geometry are better served from Supabase (or a small authenticated API) than bundled into the browser. The current `src/data/ma3_gtfs.ts` snapshot is about **477 KB raw** and includes archived route, stop and shape data. It remains a local fallback in this checkout for now; the new tables below are prepared, but the page has not yet been switched to query them. Do not delete the snapshot until the Supabase import and replacement query have been verified.

The migration creates read-only `ma3_routes`, `ma3_stops`, `ma3_route_stops` and `ma3_route_shapes` tables. Generate import CSVs locally from the archived snapshot (this writes only to `.work/`):

```powershell
node scripts/export-ma3-transit-csv.mjs .work/ma3-transit-csv
```

In Supabase **Table Editor**, import in this order: `ma3_routes.csv`, `ma3_stops.csv`, `ma3_route_stops.csv`, then `ma3_route_shapes.csv`. The script keeps route geometry as JSON arrays of `[latitude, longitude]`; the app's map adapter must convert to MapLibre's `[longitude, latitude]` ordering. The CSV templates under `supabase/import_templates/` are header-only alternatives if you are supplying a different feed. Never label this archived TUMI dataset as live service data.

For a lean runtime, the next client step is to query stop names with a server-side text filter and a small result limit, fetch route-stop rows only for selected routes, fetch a route shape only on selection, and use a backend RPC for route/transfer planning. Keep the public anon key in the browser and any service-role importer key in a local terminal only. The current planner is still based on the archived matatu snapshot.

The rail layer is mapped OpenStreetMap geometry and station points, not a timetable or a verified operating service. Walking and archived matatu legs are available in the current planner; rail-to-matatu routing remains a placeholder until an authoritative railway GTFS/service feed provides station IDs, route order and service data. Do not invent rail fares or arrival times from track geometry alone.

## 8. Repository hygiene notes

- Never commit `.env.local` or a service key.
- The two HOTOSM GeoJSON ZIP files are duplicates; use one. The GeoPackage ZIP is an alternative representation, not more POIs.
- This checkout has npm and pnpm lock/workspace artefacts. Use the package manager matching this checkout's `package.json` and do not regenerate a second lockfile.
- Build-generated TypeScript/Vite outputs (`*.tsbuildinfo`, generated `vite.config.js`/`.d.ts`) are not source. Review `git status` before removing any untracked local output; this guide does not delete user files.


## 9. Flight routes and map overlays

Run `supabase/migrations/20261014_flight_routes_and_nganya_route_shapes.sql` after the existing Nganya/SGR/profile migration. Flight results are read from `flight_routes`; each row must have the route type, carrier/flight number, origin/destination airport codes, dated departure and arrival, source URL, source refresh timestamp, and the actual route `geometry` as GeoJSON `LineString` or `MultiLineString` in `[longitude, latitude]` order. Use `supabase/import_templates/flight_routes.csv` as the column template. Do not fabricate flights, prices, or a straight-line path. Refresh or deactivate expired schedules.

Nganya vehicle records remain in `nganya_matatus` and are registered by the authorized administrator or data steward after verification. Do not let the public create or publish voteable entries. Route paths are maintained separately in `nganya_route_shapes`, keyed by the same route code; use `supabase/import_templates/nganya_route_shapes.csv`, add the sourced GeoJSON path and citation, and mark it active only after review. Mirth draws only the two routes currently selected for the annual face-off. User-submitted route suggestions (if enabled later) must go into a private review queue and must never auto-register a vehicle.

The Fly and Market pages display MapLibre basemaps; overlays only appear when geocoded rows have been imported. SGR's line, stations, and timetable stay separate in `sgr_routes`, `sgr_stations`, and `sgr_schedules`. A SGR polyline alone is not evidence of a currently operating service.

## 10. Explore destinations and Ma3 handoff

Explore queries `explore_pois` for the visible map viewport. Its three tabs group points into Food & drink, Stays & shopping (including clothing shops), and Sights & essentials (including tourist destinations and other mapped POIs). A selected destination can hand its name and coordinates to Ma3. Ma3 finds the nearest stop in the archived TUMI GTFS snapshot and preselects it as the destination; a user still needs to choose their origin and review the suggested route. The bundled snapshot is dated through 2020-12-31, so present it as an archived route estimate, not a current timetable or live service. When fresh GTFS or a verified routing feed is available, import it and replace that source before claiming current service.

The UI intentionally does not display setup instructions. Keep credentials, import commands, service-role use, moderator workflow, and this data guidance in project documentation. Never put Supabase service-role credentials in the frontend.


## 11. Lightweight Mirth games

The Trivia card can request a small round from the public Open Trivia Database only when a user opens Trivia; this avoids bundling question banks into the initial app. The service is keyless/free, limits each request to 50 questions, permits only one category per request, and documents a five-second per-IP rate limit. Its questions use CC BY-SA 4.0, so keep attribution in the Trivia panel and follow that license for redistributed adaptations. Do not make a request on every keystroke or for every app visitor at page load. Source: https://opentdb.com/api_config.php.

Game rules and visuals do not need to be hard-copied to a remote database. For compact single-player games, keep logic in small lazy-loaded modules; use a backend only for accounts, saves, matchmaking, multiplayer state, leaderboards or moderation. For chess UI, check component licenses carefully: Lichess Chessground is GPL-3.0-or-later, has no chess rules engine, and requires a GPL-compatible distribution when used in a website. Source: https://github.com/lichess-org/chessground.

## 12. Private profile photos

Run `supabase/migrations/20261015_private_profile_photos.sql` after `20261014_nganya_sgr_profile_media.sql`. The follow-up migration makes the `profile-photos` bucket private and grants authenticated users read access only to objects under their own `<auth-user-id>/` folder. The app stores that object path (not a public URL or signed URL) in `profiles.avatar_url` and Auth metadata, then requests a short-lived signed URL for display. Do not make this bucket public or add a public `storage.objects` read policy. Existing public-URL metadata is converted back to an owned object path when it can be safely matched to the current user's folder.
