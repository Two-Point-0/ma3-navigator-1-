# Ma3 — Move · Market · Mirth
Nairobi's urban companion app. React + TypeScript + Vite + MapLibre GL + Firebase.

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

## Legacy Firebase Setup (optional)

These steps configure Firebase authentication and older app modules. They do **not** configure the newer Supabase-backed Explore, Market or Mirth features; follow [`docs/supabase-setup.md`](docs/supabase-setup.md) for those.

### Step 1 — Create a Firebase project
1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `ma3-app` → Continue
3. Disable Google Analytics (not needed) → **Create project**

### Step 2 — Enable Authentication
1. Left sidebar → **Authentication** → Get started
2. **Sign-in method** tab → Enable **Google** → Save
3. Also enable **Anonymous** (for guest users) → Save

### Step 3 — Create Firestore Database
1. Left sidebar → **Firestore Database** → Create database
2. Choose **Start in test mode** → pick a region near Kenya (e.g. `europe-west1`) → Done
3. Go to **Rules** tab → paste the contents of `firestore.rules` → **Publish**

### Step 4 — Get your config keys
1. Left sidebar → ⚙️ Project Settings → **Your apps** tab
2. Click **</>** (Web) → register app as `ma3-web` → Continue
3. Copy the `firebaseConfig` object — you'll see:
   ```js
   apiKey: "AIza...",
   authDomain: "ma3-app.firebaseapp.com",
   projectId: "ma3-app",
   ...
   ```

### Step 5 — Create your .env.local file
In the project root (same folder as package.json), create a file called `.env.local`:
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=ma3-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ma3-app
VITE_FIREBASE_STORAGE_BUCKET=ma3-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```
Replace each value with the ones from your Firebase project.
Then restart the dev server: `npm run dev`

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
6. Add environment variables: Site settings → Environment variables → add all your `VITE_FIREBASE_*` keys
7. Trigger a redeploy — your app is now live at `yoursite.netlify.app`

### Option B — Vercel (same idea, also works great)
```bash
npm install -g vercel
vercel              # follow prompts, adds env vars through the CLI
```

---

## Current backend and data status

- **Supabase** now backs Explore POIs, supermarket/product/price records, curated Nganya records, route votes, style ratings and non-cash points. Follow [`docs/supabase-setup.md`](docs/supabase-setup.md) to configure it; credentials are intentionally placeholders.
- **Firebase** remains in the earlier authentication and legacy app modules above. Firebase identities are separate from Supabase identities unless an explicit identity-linking flow is built.
- **Ma3 routes/stops** use an archived TUMI GTFS snapshot (validity through 2020-12-31) for search and rough, static geometry-based planning only. It is not a current timetable or live fleet feed; journey fares and times are estimates, and no fare payment is processed here.
- **Train** uses the local OpenStreetMap railway GeoJSON for mapped track features and station points. No timetable or departure estimates are shown.
- **Demand markers** are local to this device. Drivers do not receive them until a real shared backend is connected.
- A paid-booking challenge remains locked until there is a real provider and a server-verified order/payment event. Community points are not money.

---

## Project Structure

```
ma3-app2/
├── .env.example          ← browser-safe Supabase placeholders + optional legacy Firebase values
├── firestore.rules       ← paste into Firebase Console → Firestore → Rules
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
    │   ├── useAuth.ts             # Firebase auth state hook
    │   └── useFirestore.ts        # Legacy Firestore hooks for older modules
    ├── lib/
    │   ├── firebase.ts            # Firebase app init (Auth, Firestore, Storage)
    │   ├── journey.ts             # Archived route-geometry estimates; no live arrivals/train times
    │   ├── mapLayers.ts           # MapLibre GeoJSON layer helpers
    │   └── wallet.tsx             # In-memory wallet context (works without Firebase)
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
