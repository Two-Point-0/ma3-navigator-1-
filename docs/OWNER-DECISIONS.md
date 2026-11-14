# Owner decisions: what I set, and where to change it

| # | What | Value I set | Where to change it |
|---|---|---|---|
| 1 | Local business listing (pins and adverts) | **KES 50 per 30 days** (deliberately low so more businesses join; going to KES 30 is fine) | `LOCAL_LISTING_FEE_KES` in `src/components/LocalPanel.tsx` |
| 2 | Place photo fee | **7 days KES 20, 30 days KES 50, 90 days KES 120** | `PLANS` in `src/components/PlacePhoto.tsx` |
| 3 | Place photo with game points | 7 days = 10,000 points, 30 days = 30,000, 90 days = 80,000. Only 2,000 points a day count, so a 7-day photo needs at least 5 days of play (about 10+ hours) | Supabase, Table Editor, `app_settings`: `photo_points_7/30/90`, `points_daily_cap` |
| 4 | Route King rules | New king shielded 15 minutes. Challenge breaks the shield if you beat the king's best single game (+25 bonus). Beaten king has a 24-hour rematch (comeback bonus +15). New king bonus +10. Defend (score 60+) +10. Board covers 5 days, weekend points double | `app_settings`: `king_shield_minutes`, `king_rematch_hours`, `king_window_days`, `king_bonus_crown`, `king_bonus_comeback`, `king_bonus_challenge_win`, `king_bonus_defend` |
| 5 | Anti-cheat | A game must be started on the server, score only accepted after a minimum play time (Trivia 25 s, Chess 90 s, Ludo 90 s), one score per game, max 60 games an hour | `app_settings`: `min_seconds_trivia/chess/ludo` |
| 6 | Product prices, stock, artwork rights | Blank = "Coming soon" | CSV or Supabase: set `price_kes`, `stock_qty`, `status = active`, `rights_status = cleared` (only after the artist licence is signed) |
| 7 | Revenue split | 70% app, 15% route group, 15% vehicle owner, all HELD | `revenue_split_rules` table, after lawyer review |
| 8 | Privacy notice, Terms of use, Shop terms | Drafted in plain language, shown in the app at **Home, Privacy & terms** | Edit `src/data/legalText.ts`. Fill the 3 `[square bracket]` items at the top. Then delete the "Draft text" banner in `src/pages/Legal.tsx` after a lawyer checks it |
| 9 | Live flight prices | Function written, off | See "Amadeus key" below |
| 10 | Test phones | Not in the code | Supabase, see the deploy guide |

## Why game scores can still be cheated, and the real fix
Chess, Ludo and Trivia run on the player's phone. A determined person could fake a result. What I added makes that much harder (server-started games, minimum play time, one score per game, daily point cap, shield on crowns). That is enough while points are only for fun and for small things like place photos.

If points ever buy something valuable (cash, airtime, big discounts), do this instead:
1. **Trivia:** keep the questions and correct answers only on the server, and let the server mark each answer.
2. **Chess and Ludo:** make each move go to the server, which checks the move is legal and plays the computer itself. Then the phone cannot fake a win.
3. Add a human check for the top winners before prizes are paid.
This is real work (a few days). Do it before points have value, not after.

## Amadeus key: what it is and where to get it
Amadeus is a travel data company that gives developers free test access to flight prices. A "key" is just a password pair so Amadeus knows the requests come from you.
1. Go to developers.amadeus.com and click Register (free).
2. Sign in, open "My Self-Service Workspace", click "Create new app", name it Ma3.
3. Open the app. Copy the **API Key** and **API Secret**.
4. In PowerShell from your project folder:
   `npx.cmd supabase secrets set AMADEUS_CLIENT_ID=PASTE_KEY AMADEUS_CLIENT_SECRET=PASTE_SECRET APP_ORIGIN=https://YOUR-VERCEL-LINK`
   `npx.cmd supabase functions deploy flight-offers`
5. The test key returns sample prices. Real prices need Amadeus to approve production use (free sign-up form, it can take days). Until then the app's button works but shows test data, so keep the "guide only" note.
Never put the key in the app code or GitHub.
