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

## Firebase Setup (do this once)

The app runs fully without Firebase — wallet, pins and votes just reset on refresh.
Adding Firebase makes everything **persistent and shared in real-time**.

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

## What Firebase Powers in Ma3

| Feature | Without Firebase | With Firebase |
|---------|-----------------|---------------|
| Wallet balance | Resets on refresh | Saved per user, real KES balance |
| Business pins | Lost on refresh | Permanent, shared across all users in real-time |
| Nganya VS votes | Resets on refresh | Real leaderboard, one vote per account enforced |
| Queue lock-in | Mock data | Real passengers locking in, drivers see live demand |
| User profile | Hardcoded name | Real Google account with photo |
| Guest mode | N/A | Anonymous auth — browse without signing in |

---

## Project Structure

```
ma3-app2/
├── .env.example          ← copy to .env.local and fill your Firebase keys
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
    │   ├── ma3_core.ts            # Types, wallet, pins, queue logic, seed data
    │   ├── ma3_gtfs.ts            # Real GTFS data — 136 routes, 2,351 stops
    │   └── ma3_rail.ts            # NCR rail — 5 lines, stations, real schedule times
    ├── hooks/
    │   ├── useAuth.ts             # Firebase auth state hook
    │   └── useFirestore.ts        # Wallet, pins, votes, queue — all Firestore hooks
    ├── lib/
    │   ├── firebase.ts            # Firebase app init (Auth, Firestore, Storage)
    │   ├── journey.ts             # GTFS routing engine (direct + 1-transfer planning)
    │   ├── mapLayers.ts           # MapLibre GeoJSON layer helpers
    │   └── wallet.tsx             # In-memory wallet context (works without Firebase)
    └── pages/
        ├── Home.tsx               # Dashboard
        ├── Login.tsx              # Google + guest sign-in
        ├── Ma3.tsx                # Track · Planner · Queue lock-in · Vehicles · Rail
        ├── Ndai.tsx               # Ride-hailing
        ├── Fly.tsx                # Flights + transfers
        ├── Market.tsx             # Price comparison + basket
        ├── Mirth.tsx              # Nganya VS · Tribal games · Culture
        ├── Explore.tsx            # Full-screen pin map (food/thrift/entertainment)
        ├── Profile.tsx            # Wallet top-up · Badges · History
        └── NotFound.tsx
```

---

## Pages Summary

| Route | Page | Key Feature |
|-------|------|-------------|
| `/` | Home | Wallet summary, quick stats, section links |
| `/login` | Login | Google sign-in or guest |
| `/ma3` | Ma3 Track | 4 tabs: routes on 3D map, planner, vehicles, NCR rail with live countdown |
| `/ndai` | Ndai Ride | Boda/Ndai/ProBox/Van booking with wallet payment |
| `/fly` | Fly | Domestic flights + airport transfers |
| `/market` | Market | Quickmart vs Naivas vs Carrefour price comparison + budget basket |
| `/explore` | Explore | Full-screen 3D map — tap to pin a business with floor/unit for multi-store buildings |
| `/mirth` | Mirth | Nganya VS battle + weekly vote, tribal games, Nairobi culture events |
| `/profile` | Profile | Wallet balance, daily/weekly/monthly plans, transaction history, badges |

---

## Notes
- **MapLibre** uses OpenFreeMap tiles — completely free, no token needed.
  If you get a Mapbox token later, change `DARK_STYLE` in `src/components/MapLibreView.tsx`.
- **GTFS data** is baked into `src/data/ma3_gtfs.ts` — no backend needed for routing.
- Never commit `.env.local` to GitHub — it's already in `.gitignore`.
