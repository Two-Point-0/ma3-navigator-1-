# Ma3 Navigator — project context (paste/upload this into Claude Projects)

**Owner:** Muhia (Nairobi, junior dev). Explain everything in plain layman words. Give complete paste-ready files or zips, never diffs. ONE command per code box. Don't ask unnecessary questions.

**App:** Ma3 — Move · Market · Mirth. React 18 + TypeScript + Vite, MapLibre, wouter, framer-motion, sonner, lucide, Supabase, Vercel.
**Repo:** https://github.com/Two-Point-0/ma3-navigator-1- (branch main only)
**Local folder:** C:\Users\denni\OneDrive\Desktop\project 2\ma3-navigator (1)
**Live:** ma3-navigator-1.vercel.app (Vercel, account Two-point-0, Hobby)
**Supabase ref:** uygefywqxtqpfaibjete

## Deploy routine (PowerShell, one at a time)
1. Extract zip: Expand-Archive -Path ".\<zip>" -DestinationPath . -Force
2. npx.cmd supabase db push --remote   (only when a new migration exists)
3. npm run build
4. git add .
5. git status --short   (must NOT list .env.local, zips, Nganya_Products_Import.*, stitch images, project-overview.txt)
6. git commit -m "message"
7. git push origin main

## Design rules
- Brand tokens: red `--stop`, amber `--ready`/gold, green `--go`.
- Top 3 page tabs glow RED; bottom menu glows AMBER on the current page. Top bar + tabs never scroll on map pages.
- Call every stage a "stop" in the UI.
- Games tiles: green = played a lot, amber = tried, red = not played yet.

## Key code
- src/lib/journey.ts: matatu routing (136 routes from src/data/ma3_gtfs.ts, treated two-way), planDoorToDoor.
- src/lib/rail.ts + src/data/railNetwork.ts: rail planner (mock data; CSVs in supabase/seed/rail).
- src/lib/places.ts + components/PlacePicker.tsx: Start/Stop picker (type, My location, tap on map).
- Nganya shop: table nganya_products, bucket nganya-products; products stay "Coming soon".

## Prototype data (replace before launch)
Rail times, fares, some station coordinates are estimates. Landmarks are approximate.

## Demo (placeholder) vehicles
- Table demo_vehicles (migration 20261119000000): 2 matatus per direction on every route + 4 Ndai cars + 4 bodas. Marked DEMO.
- Matatu markers move along the route line by the clock (same on every phone). Only vehicles heading the rider's way show on a searched journey.
- demo_book_seat / demo_cancel_booking functions give a pretend booking (no money) for testing with a real phone login. Table demo_bookings.
- Replace with real driver data (ma3_driver_live_locations) before launch.

## Decided architecture (roles) — ONE app, not several
- One app, one login. Choose a role at first launch (and change later in Profile): Passenger, Matatu driver/owner, Carpool driver, Tour operator, Ndai rider-driver (car), Boda rider.
- Passenger pages are identical for everyone. Each role only adds a "Drive/Work" tab and role-specific screens (Driver.tsx pattern).
- Matatu driver mode: seat total, documents upload (licence, PSV badge, insurance, inspection, logbook), approval by admin, then goes live on route line; sees waiting passengers per stop and boarded count.
- Ndai / boda: documents + vehicle details, incoming ride requests screen.
- Later, wrap the same web app with Capacitor for Play Store/App Store; still one codebase.

## Not built yet
Big games spec (Nganya Tycoon, Chess, Ludo, Trivia, Whack-a-Matatu, Matatu Match, Snake). Plan in phases.

## Another AI also edited this repo (commit d488970)
It added Nganya Tycoon (single player vs bot), weekly leaderboard, Mirth social/room-code panel, personal bests, and migration 20261120000000_mirth_prototype_foundation.sql. Merged with the Start/Stop planner, rail network and demo vehicles. The rail "prototype" data from that commit is superseded by supabase/seed/rail and src/data/railNetwork.ts.
Always run `git fetch origin` and check for new commits before pushing.


## Wallet (matatu-front, line art) — updated 2026-11-21
- /wallet is reached from the first card on Home (no more top-left button). Account & settings is a separate Home card.
- src/pages/Wallet.tsx: SVG outline of a nganya front in the 3 app colours. Windscreen = balance + number/amount boxes + chips; grille = tilted dial pad (CSS perspective); plate = send M-Pesa prompt; mirrors = Past/Trips and Gauge/Limits.
- Demo-only features (APP_MODE.realPayments=false): Auto-pay toggle, Tap pay, Auto-stage (simulated ride, fare KES 70 on route R-111), Till/QR (fake QR). They use wallet.pay(); in real-payments mode they show "Coming soon".
- Games: GameShell is portaled to <body> (full screen); DicePopup used by Ludo and Nairobi Tycoon; Ludo has 2-4 players, computer/pass-and-play/online room (roomTransport).
- Still to build: matatu ride chat + game challenge, Explore sub-category buttons inside Food/Stays/Sights popups, Nairobi themes for other games.

## Nov 22 batch
- Wallet: green body outline flares around the bumper and glows (LED strip) after payments; red on failure. Wallet name = nickname set in Account & settings (`src/lib/account.ts`, localStorage `ma3_nickname`); route chip/charge label = most-paid route from wallet history (falls back to the demo route).
- `/profile` is now one "Account & settings" container with sub-pages: Profile & name, My trips (Trips.tsx), Privacy & terms (Legal.tsx). Wallet section removed from it. Home no longer lists /trips and /legal separately (routes still exist).
- Journey engine: walking change radius 1.5 km (terminus to terminus), deferred walk states sorted nearest-first, search budget 60000. Added areas Wangige, Langata, Kikuyu, Zambezi, Githurai, Kahawa, Gikomba, Kiserian, Ongata Rongai, Thome, Mwiki. Verified Wangige to Langata/Embakasi/Thika/Karen/Ngong/Kitengela all return matatu + walk + matatu plans.
- `supabase/seed/demo_flights.sql`: demo flights for Fly. Docs F and G in docs/launch-checklist.md.
