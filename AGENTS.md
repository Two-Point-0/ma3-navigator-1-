# Instructions for AI agents working on this folder (Ma3 Navigator)

Owner: Muhia. The owner is a junior developer and wants plain-language explanations. Give complete, paste-ready files, never diffs. Do not ask unnecessary questions.

## Git rules (most important)

- The GitHub repo `Two-Point-0/ma3-navigator-1-` must always hold the final code on the `main` branch.
- Work directly on `main`. Do NOT create branches, do NOT open pull requests, do NOT run `git checkout` to another branch.
- Why: this folder is inside OneDrive. Switching branches deletes folders (for example `supabase/functions/_shared`) and OneDrive locks them, which causes "Deletion of directory failed" prompts. If one appears, answer `n`.
- Before starting work, run:
  `git branch --show-current` (must print `main`), then `git pull`.
- If the branch is not `main`, STOP and tell the owner. Do not switch it yourself.

## After every finished change

1. `npm run build` must finish with "built in ..." and no red errors. Never push code that fails the build.
2. `git status --short` and read it. Only commit files that belong to the change.
3. NEVER commit `.env`, `.env.local`, secret keys, `project-overview.txt`, `dist/`, `.work/` or `node_modules/`.
4. Commit and push to main:
   ```
   git add <the files you changed>
   git commit -m "short description of what changed"
   git push
   ```
   A plain `git push` is enough while on `main`. If the push is rejected, run `git pull` and push again. Never use `git push --force`.
5. Tell the owner in one or two plain sentences what changed.

## Backend rules

- Supabase is the ONLY backend. Firebase has been removed. Do not add Firebase, Mongo or another database.
- Database changes go in a new file in `supabase/migrations/`, named with the next date, for example `20261114_describe_change.sql`. Never edit a migration that was already applied; add a new one.
- The browser may only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The service-role/secret key must never appear in any file, in the frontend, in Git or in chat. It is typed into the terminal only for import scripts.
- Large datasets (products, prices, Explore places, Ma3 routes, Nganya images) live in Supabase and are fetched on demand. Do not bundle them into the app.
- Real M-Pesa payments and real driver broadcasting stay off (`src/lib/appMode.ts`) until the owner says they are tested.
- Never invent real data (flights, prices, schedules). Sample data must be labelled as sample.

## Useful commands

- Run the app: `npm install` then `npm run dev` (http://localhost:3000)
- Check the build: `npm run build`
- Supabase: `npx.cmd supabase db push --remote --dry-run`, then `npx.cmd supabase db push --remote` (without --remote this CLI targets a local Docker database)
- Docs for data imports: `docs/supabase-setup.md`

## Where things are

- Plain-language tour of every file and how pages share data: `docs/project-tour.md`. Read it before changing an unfamiliar area.
- The three top buttons on every page (`PageTabs`) look identical. Only the `tone` prop (idle / go / ready / stop) changes their glow, based on app state. Do not give each button its own colour.
- Maps: use `fitAboveSheet` and `frameMap` so the whole route stays visible above the bottom sheet.
