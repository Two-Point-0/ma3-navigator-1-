# Ma3 Navigator: a plain-language tour of every file and folder

Written for Muhia (and any AI agent that opens this folder). No jargon where a simple word works.

## The big picture in four sentences

1. The **app** (everything in `src/`) is what people see in the browser. When you deploy to Vercel, only the built app goes online.
2. The **database** lives at **Supabase** (the website, not your folder). Products, prices, Explore places, flights and saved baskets live there.
3. The app **asks Supabase for only what it needs** at that moment (for example "places inside this part of the map").
4. Files such as `products.csv` are **delivery vans, not shelves**. You use them once to load data into Supabase. After that the data sits at Supabase and the CSV is not needed by the app.

## Where do the CSV files live, and what happens when I deploy?

| Question | Answer |
|---|---|
| Where are the CSVs now? | In your folder (and GitHub), inside `supabase/sample_data/` and `supabase/import_templates/`. |
| Does the deployed app contain them? | **No.** Vercel builds only `src/`. The CSVs are not inside the app, so visitors never download them. |
| Where is the data people see? | In your **Supabase** project, in tables (open Supabase, then Table Editor). |
| How does the app get it? | The page asks Supabase (for example "give me products matching 'maize'"), and Supabase sends back a few rows. |
| If I want new products? | Edit a CSV, run the import script once, and the new rows appear at Supabase. You do not redeploy the app. |
| Can I delete the CSVs after importing? | Yes, but keep them: they are your backup and the starting point for next time. |

One exception to remember: the Ma3 matatu route and stop data (`src/data/ma3_gtfs.ts`, about 470 KB) is **inside the app code**, not at Supabase. It loads together with the Ma3 page. Moving it to Supabase is possible later (the tables and import script `--matatus` exist).

---

## Top-level files (the "front of the house")

| Name | What it does, in one sentence |
|---|---|
| `README.md` | The welcome sheet for the project. Parts of it still mention Firebase, which has been removed. |
| `AGENTS.md` | Rules for AI helpers: work on `main` only, never commit secret keys, run the build before pushing. |
| `package.json` | The shopping list of tools the app needs, plus the commands `npm run dev` and `npm run build`. |
| `package-lock.json` | The exact versions npm installed, so every computer gets the same tools. This is the one npm uses. |
| `pnpm-lock.yaml`, `pnpm-workspace.yaml` | The same idea for a different tool (pnpm). You use npm, so these are leftovers. VS Code complains about having two. Safe to delete **both** only once you are sure you will always use npm (Vercel picks its tool by which lock file it sees). |
| `index.html` | The single web page the whole app lives inside. Everything else is drawn into it. |
| `vite.config.ts` | Settings for Vite, the tool that runs and builds the app. |
| `tsconfig.json`, `tsconfig.node.json` | Rules for TypeScript, the stricter flavour of JavaScript we write. |
| `tailwind.config.js`, `postcss.config.js` | Settings for the styling tools. |
| `firestore.rules` | **Old Firebase leftover.** Firebase was removed, so this file does nothing and can be deleted. |
| `.gitignore` | A list of things Git must never upload (secrets, `node_modules`, `dist`). |
| `.env.local` | **Your private settings** (the Supabase address and publishable key). Never uploaded to GitHub. On Vercel you re-enter these two values in Project Settings, then Environment Variables. |
| `node_modules/` | Thousands of downloaded tool files. Created by `npm install`. Never edited, never uploaded. |
| `dist/` | The finished, packed-up app made by `npm run build`. This is what actually goes online. Never uploaded to GitHub. |

## `docs/`: written notes

Plain notes for humans: `supabase-setup.md` (how the backend is set up), `legal-compliance.md` (what Kenyan rules say about carrying passengers and using price data), `payments-and-parcels.md`, `driver-architecture.md`, `glass-sheet-wallet-update.md`, `session-handoff-2026-10-08.md`, and this tour. None of them is used by the app.

## `scripts/`: one-off helper programs you run in the terminal

| File | What it does |
|---|---|
| `import-market-csv.mjs` | Reads `products.csv` / `price_observations.csv` (or the Ma3 transit CSVs) and uploads them into Supabase. Needs the secret key typed in the terminal. |
| `import-kenya-pois.mjs` | Reads the HOTOSM places file (about 87,000 places) and uploads it into Supabase for the Explore page. |
| `generate-sample-market.mjs` | Makes the **sample** products and prices (labelled sample, not real shop prices). |
| `export-ma3-transit-csv.mjs` | Turns the route data inside the app into CSV files you can upload. |

## `supabase/`: everything about the database

| Folder | What it holds |
|---|---|
| `migrations/` | Numbered recipe cards that build the database tables (one file per change, run in date order with `npx.cmd supabase db push --remote`). Never edit an old one; add a new one. |
| `sample_data/` | The big sample `products.csv` and `price_observations.csv` (about 1 MB). Used only for importing. |
| `import_templates/` | Empty CSVs showing the column names for each kind of data (flights, Ma3 routes, Nganya matatus, products, prices). Fill one in, then import. |
| `seed/demo_catalog.sql` | A tiny starter catalogue you can paste into the Supabase SQL Editor. |
| `functions/` | Small programs that run on Supabase's servers for M-Pesa (`mpesa-stk-push`, `mpesa-callback`). They stay off until payments are tested. |
| `config.toml` | Settings for the Supabase command-line tool. |

## `src/`: the app itself

### Startup files
| File | Job |
|---|---|
| `main.tsx` | The ignition key: starts the app inside `index.html`. |
| `App.tsx` | The map of the app: shows the top bar and bottom menu and decides which page to show for each address (`/ma3`, `/market`, `/explore`...). |
| `index.css` | The look of the app: colours (green, amber, red), buttons, sheets, tabs. |
| `geojson.d.ts` | A small note that lets TypeScript understand map data files. |

### `src/pages/`: one file per screen

| Page | What it is | Where its data comes from |
|---|---|---|
| `Home.tsx` | The landing screen with big buttons to each part. | Nothing to fetch. |
| `Ma3.tsx` | Matatu routes, trip planner, train stations, parcels. The routes drawn on the map get **named stops, arrows, and live progress** with an alert when to get off. | Routes and stops come from `src/data/ma3_gtfs.ts` (inside the app). The rider's own phone GPS is used for progress. Pickup counts and traffic reports go to Supabase. |
| `Ndai.tsx` | Rides, carpool, and Boda Basket delivery (demo mode). | Takes the destination handed over by Market/Explore (`ndai_destination`). Real drivers and payments are off. |
| `Market.tsx` | Search products, add to basket, **checkout with the 3 nearest stores**, get there by Ma3, Ndai or Boda Basket. | Products and prices are fetched **from Supabase** when you search. The basket is saved in your browser and, when signed in, in Supabase. |
| `Explore.tsx` | The map of about 87,000 places in 3 groups: Food & drink, Stays & shopping, Sights & essentials. | Fetched **from Supabase** for the part of the map on screen, only for the group you tapped. |
| `Fly.tsx` | Flights and SGR trains. | `flight_routes` and `sgr_*` tables at Supabase. Booking is done on the airline or Google Flights (Ma3 sells nothing). |
| `Mirth.tsx` | Games hub (trivia works; chess and ludo not yet built). | Trivia questions come from the free Open Trivia DB website. |
| `Wallet.tsx` | The wallet screen (M-Pesa in demo mode). | `lib/wallet.tsx`. |
| `Profile.tsx` | Account, photo, settings. | Supabase (your profile and private photo). |
| `LocationShare.tsx` | Share your location privately with chosen people. | Supabase. |
| `Driver.tsx` | Driver tools (demo mode). | Supabase. |
| `Login.tsx` | Sign in with Google, phone code, or as a guest. | Supabase Auth. |
| `NotFound.tsx` | "That page does not exist". | None. |

### `src/components/`: reusable pieces used by several pages
`MapLibreView.tsx` (the map, now with + / − zoom buttons), `PageTabs.tsx` (the three top buttons; all look the same and only glow by the app's state), `TriviaGame.tsx`, `ParcelPanel.tsx`, `LiveDriverMapLayer.tsx`, `DriverLiveAvailability.tsx`, `DriverParcelInbox.tsx`, `DriverTrafficReports.tsx`, `DriverStopAlerts.tsx` (tells the driver, stop by stop, how many app-using passengers are getting off or waiting to board, with a beep and vibration within 400 m), `GlobalHelpSheet.tsx`, `Onboarding.tsx`, `ErrorBoundary.tsx` (shows a friendly message instead of a blank screen if something breaks).

### `src/context/`
`AuthContext.tsx`: remembers who is signed in and gives every page the sign-in functions.

### `src/lib/`: shared helpers (no screens)
| File | Job |
|---|---|
| `supabase.ts` | The one connection to Supabase, using the two public settings from `.env.local`. |
| `appMode.ts` | The switch that keeps real M-Pesa and real driver matching **off** (demo mode). |
| `shoppingBasket.tsx` | The basket: instant in the browser, backed up to Supabase when signed in. |
| `journey.ts` | The trip planner: finds routes between two stops. |
| `tripProgress.ts` | Works out how far along the route a rider is, which stops are next, and whether they are moving, slow or stopped. |
| `mapLayers.ts` | Drawing helpers: route lines with arrows, named stops, pins, and "zoom so everything shows above the sheet". |
| `useSheet.ts` | The slide-up panel behaviour shared by all pages. |
| `wallet.tsx`, `mpesa.ts` | Wallet and payment helpers (demo mode). |
| `help.tsx` | The help text shown in the help sheet. |

### `src/data/`: facts stored inside the app
`ma3_gtfs.ts` (matatu routes, stops, road shapes), `ma3_core.ts` (shared types and the distance calculation), `nairobi_railways_osm.json` and `.md` (train lines and stations).

## How the pages talk to each other

Pages pass a note through the browser's short-term memory (`sessionStorage`), like leaving a sticky note:

- Explore or Market writes **`ma3_destination`**, then opens `/ma3`. Ma3 reads the note, finds the nearest stop, and if your phone shares its location, draws the whole trip.
- Explore or Market writes **`ndai_destination`**, then opens `/ndai`. Ndai opens the ride tab (or Boda Basket delivery).
- Explore writes **`ma3_fly_destination`**, then opens `/fly`.

The shopping basket is shared by Market and Ndai through `lib/shoppingBasket.tsx`, so what you choose in Market is what Boda Basket delivers.

## The three state colours (same everywhere)

Green means moving / ready / good. Amber means slow / loading / needs attention. Red means stopped / problem. The three top buttons on every page look identical; only the glow colour changes with the app's state (for example on Ma3 it follows your speed while you ride; on Explore it follows whether places are loading, ready or failed).

## How the driver gets "someone is getting off" alerts

1. The passenger follows a trip in Ma3 and boards (auto-detected or by tapping "I am on board").
2. Ma3 calls `set_my_ma3_alighting` at Supabase with the route and the stop to get off at. The passenger must have a verified phone.
3. The driver page asks `get_ma3_alighting_counts` every 8 seconds. It only answers for a verified, approved driver on that route, and returns counts per stop, never who.
4. Within 400 m of a stop with passengers getting off, the driver's phone beeps, vibrates and shows the stop. Only passengers who use the app are counted.
5. When the passenger arrives, stops the trip or closes the card, the request is cancelled. It also expires after 90 minutes.
