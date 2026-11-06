# Ma3 — Move · Market · Mirth
Nairobi's urban companion app. React + TypeScript + Vite + MapLibre GL + Supabase/Postgres/PostGIS.

---

## Quick Start (VS Code)

```bash
# 1. Extract the zip, open the folder in VS Code
# 2. Open terminal: Ctrl + ` (backtick)

npm install          # installs everything (~2 min first time)
npm run dev          # starts dev server
# Open: http://localhost:3000
```

---

## Supabase setup

Supabase is the app's only backend: Auth, Postgres, PostGIS, Realtime and Storage. Follow [`docs/supabase-setup.md`](docs/supabase-setup.md) to create the project, enable the required providers and PostGIS extension, apply migrations, and configure imports. The browser uses only the project URL and public anon/publishable key; never put a service-role key in the frontend.

---

## Deploy to Netlify (share as a link)

### Option A — Drag and drop (fastest, no account linking needed)
```bash
npm run build        # creates the /dist folder
```
1. Go to https://app.netlify.com/drop
2. Drag the **dist** folder onto the page
3. Netlify gives you a live URL instantly — share it on WhatsApp

### Option B — Connect GitHub (auto-deploys on every push, better for ongoing work)
1. Push your project to a GitHub repo
2. Go to https://app.netlify.com → **Add new site** → Import from Git
3. Select your repo
4. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy site**
6. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
7. Trigger a redeploy — your app is now live at `yoursite.netlify.app`

### Option B — Vercel (same idea, also works great)
```bash
npm install -g vercel
vercel              # follow prompts, adds env vars through the CLI
```

---

## Current backend and data status

- **Supabase** is the sole authentication and persistence provider. It backs Explore POIs, supermarket/product/price records, curated Nganya records, route votes, style ratings and non-cash points. Follow [`docs/supabase-setup.md`](docs/supabase-setup.md) to configure it; credentials are intentionally placeholders.
- **Security review:** See [`docs/security-audit-2026-11-06.md`](docs/security-audit-2026-11-06.md) for code changes, limits and the manual production checklist. Apply all database migrations, set exact Auth redirect URLs, and publish only the `dist` folder.
- Existing accounts from earlier providers are not migrated automatically; returning users will need to create or link a Supabase Auth account.
- **Ma3 routes/stops** use an archived TUMI GTFS snapshot (validity through 2020-12-31) for search and rough, static geometry-based planning only. It is not a current timetable or live fleet feed; journey fares and times are estimates, and no fare payment is processed here.
- **Train** uses the local OpenStreetMap railway GeoJSON for mapped track features and station points. No timetable or departure estimates are shown.
- **Demand markers** are local to this device. Drivers do not receive them until a real shared backend is connected.
- A paid-booking challenge remains locked until there is a real provider and a server-verified order/payment event. Community points are not money.

---

## Project Structure

```
ma3-app2/
├── .env.example          ← browser-safe Supabase placeholders only
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── App.tsx                    # Shell: topbar, bottomnav, loader, routing
    ├── index.css                  # Global design system (CSS vars, all components)
    ├── main.tsx
    ├── components/
    │   └── MapLibreView.tsx       # Reusable 3D MapLibre map (pitch, bearing, 3D buildings)
    ├── context/
    │   └── AuthContext.tsx        # Global auth state (Google + guest sign-in)
    ├── data/
    │   ├── ma3_core.ts            # Types and routing helpers; no generated passenger queue
    │   ├── ma3_gtfs.ts            # Archived TUMI route/stop snapshot (validity through 2020)
    │   └── nairobi_railways_osm.json # Mapped OpenStreetMap railway geometry/stations
    ├── hooks/
    │   └── useAuth.ts             # Supabase auth state hook
    ├── lib/
    │   ├── supabase.ts            # Supabase client (Auth, Postgres, Realtime, Storage)
    │   ├── journey.ts             # Archived route-geometry estimates; no live arrivals/train times
    │   ├── mapLayers.ts           # MapLibre GeoJSON layer helpers
    │   └── wallet.tsx             # In-memory demo wallet; not real money
    └── pages/
        ├── Home.tsx               # Dashboard
        ├── Login.tsx              # Google + guest sign-in
        ├── Ma3.tsx                # Search · Live feed placeholder · OSM Train map
        ├── Ndai.tsx               # Ride-hailing
        ├── Fly.tsx                # Flights + transfers
        ├── Market.tsx             # Supabase catalogue and five-retailer price comparison
        ├── Mirth.tsx              # Searchable games · Nganya routes/votes · free season picks
        ├── Explore.tsx            # HOTOSM POIs, searchable map and categories
        ├── Profile.tsx            # Wallet top-up · Badges · History
        └── NotFound.tsx
```

---

## Pages Summary

| Route | Page | Key Feature |
|-------|------|-------------|
| `/` | Home | Wallet summary and section links |
| `/login` | Login | Google sign-in or guest |
| `/ma3` | Ma3 | Three controls: Search, Live feed status, and OSM Train map |
| `/ndai` | Ndai Ride | Boda/Ndai/ProBox/Van booking with wallet payment |
| `/fly` | Fly | Domestic flights + airport transfers |
| `/market` | Market | Supabase-backed product prices across five retailer records; CSV imports documented |
| `/explore` | Explore | Search and browse Supabase-backed HOTOSM points of interest |
| `/mirth` | Mirth | Searchable games, route-scoped Nganya voting and free season predictions |
| `/profile` | Profile | Wallet balance, daily/weekly/monthly plans, transaction history, badges |

---

## Notes
- **MapLibre** uses OpenFreeMap tiles — completely free, no token needed.
  If you get a Mapbox token later, change `DARK_STYLE` in `src/components/MapLibreView.tsx`.
- **Ma3 route data** is an archived snapshot, not a current service feed. The Train map uses OSM railway geometry; actual live locations/timetables are not connected.
- **Supabase data setup and imports** are documented in `docs/supabase-setup.md`.
- Never commit `.env.local` to GitHub — it's already in `.gitignore`.
