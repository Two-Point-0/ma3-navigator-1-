# Launch guide: from the zip to a live app (step by step)

## A. Put the new files in (replacing the old ones)
You do NOT edit files by hand. The zip holds complete files. Extracting it over your project replaces the old ones.

**Easiest way (File Explorer):**
1. Download `ma3-launch.zip`. Find it (usually Downloads or Desktop).
2. Right-click it, choose **Extract All...**
3. In the box that opens, click **Browse** and choose your project folder: `C:\Users\denni\OneDrive\Desktop\project 2\ma3-navigator (1)`. Click **Extract**.
4. Windows asks about files that already exist. Choose **Replace the files in the destination** (tick "Do this for all"). New files are simply added.

**Or with PowerShell** (VS Code, Terminal, New Terminal): `Expand-Archive -Path "C:\Users\denni\OneDrive\Desktop\ma3-launch.zip" -DestinationPath . -Force`

5. In the VS Code terminal run `git status` first. If it lists changes you did not make yourself (the other AI's edits), run `git stash -u` before extracting. This parks them safely.
6. Run `npm install` (the zip adds the chess library).
7. Run `git rm pnpm-lock.yaml pnpm-workspace.yaml` (you use npm, and leaving these can break the Vercel build).

## B. Database
8. `npx.cmd supabase db push --remote --dry-run` (a practice run). It should list the new migrations starting 20261115... and 20261116... (6 in all if none were applied before; fewer is fine if you already ran some).
9. `npx.cmd supabase db push --remote`

## C. Supabase clicks
10. supabase.com, your project, Authentication, Providers, Phone: switch on. In "Test Phone Numbers and OTPs" add `254724726032=123456` and `254182578382=123456`.
11. Open the app on each phone, sign in with its number and code 123456.
12. SQL Editor, New query, paste the text of `supabase/seed/approve_test_driver.sql`, click Run (the phone inside must match the driver phone).
13. Storage: the buckets `business-images`, `nganya-products`, `place-photos` should exist and be Public.

## D. Your details in the legal pages
14. Open `src/data/legalText.ts` in VS Code. At the top replace the three `[square bracket]` items with your real name or business name, contact email and address. Save. (Leave the "Draft" banner until a lawyer has checked.)

## E. Products
15. In PowerShell, one line at a time:
`$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"`
`$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Paste the secret key"`
`node scripts/import-nganya-products.mjs supabase/import_templates/nganya_products.csv "C:\path\to\images"`
`Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY ; Remove-Item Env:SUPABASE_URL`
(The secret key is in Supabase, Project Settings, API Keys. Never share it.)

## F. Check, then push
16. `npm run build` (it must finish with "built").
17. `git add .` then `git status --short`. If `.env.local` or `project-overview.txt` appear, run `git restore --staged .env.local project-overview.txt`.
18. `git commit -m "Launch build: legal pages, Route King rules, icons, trips, tours, games"`
19. `git push origin main`

## G. Vercel
20. vercel.com, your project, Settings, Environment Variables. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (same values as in `.env.local`) for Production. Then Deployments, newest one, Redeploy. A push to `main` also starts a deployment.
21. Open the live link on your phone and check: Home, each page's three buttons, sign in, Mirth Games (play a game, see Route King), Market Local, Ndai Tours, Explore (tap a place, add a photo), Home, Privacy & terms.

## H. Before real money or public launch
Read `docs/OWNER-DECISIONS.md` and `docs/legal-review-brief.md`.
