# Mirth Games — quick start

## Run the app

In the project root, install dependencies and start the Vite server:

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:3000`). To enable Supabase-backed profile, friend-room, weekly-score and existing Mirth features, create an ignored `.env.local` in the repository root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Use only the Supabase project URL and publishable key in the browser. Never put the service-role/secret key in `.env.local`, a `VITE_` variable, source code or GitHub. For an existing Supabase project, follow the migration steps in [the Supabase setup guide](supabase-setup.md); inspect `npx.cmd supabase db push --dry-run` before applying pending migrations.

## Add or review Trivia questions

The offline Kenya question list is `src/data/kenyaTrivia.ts`. Each record has a question, a correct answer and three wrong options; the Kenya round currently shuffles five questions from this file. Keep facts conservative, note a reliable source in your review process, and run a human fact-check before marking content launch-ready. The current list has not been expanded to the requested 200-question review bank. “World” questions are fetched on demand from Open Trivia Database; the panel shows its CC BY-SA 4.0 attribution.

Do not put private answer keys in a public table or return `answer_index` directly to an unauthenticated browser. A future Supabase question bank should expose questions without answers and check submissions through a server-side RPC/Edge Function.

## Add a game to the lobby

1. Put the game UI in a component under `src/components/`; keep it mobile-first and give it `onStart` and `onFinish(points)` callbacks.
2. Add a card with a unique `id` to the `GAMES` array in `src/pages/Mirth.tsx`.
3. Lazy-import the module near the other `Lazy...` declarations and add its render branch in the selected-game modal. `onFinish` should pass a bounded score (0–100) to `submitFinishedScore`.
4. If the game should have a friend-room code, add its ID to `ROOM_GAMES` in `src/components/MirthSocialPanel.tsx`. Add an allowed game ID and any scoring-duration setting through a **new** Supabase migration; do not rewrite a migration already applied to a project.
5. Run `npm run build`, then test the complete start, finish, personal-best and Supabase score path. Do not assume that a local best is a server leaderboard entry.

## Current prototype scope

Nganya Tycoon is a local human-versus-bot property-board prototype; the chess, Ludo, Trivia and arcade modules are playable local prototypes of different depth. Weekly scores and XP depend on the prepared Supabase migration and the existing validated score RPC. Friend-room creation/joining is a lobby foundation only: shared moves, authoritative multiplayer state, reconnects and online game synchronization are not implemented yet. The Ma3 rail suggestion data is also clearly marked prototype-only and must be replaced with verified Kenya Railways service data before launch.
