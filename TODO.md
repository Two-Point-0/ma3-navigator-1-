# Worklist

## Completed in this update

- [x] Pin the Ma3 map and top section controls so the controls stay in place while the map moves underneath.
- [x] Make Matatu boarding/start and get-off/destination choices explicit before choosing a route.
- [x] Add separate Rail boarding/alighting fields and clearly marked sample connection suggestions.
- [x] Add a review CSV and a Supabase migration with prototype rail rows.
- [x] Add the Mirth game cards, local personal bests, daily Trivia/arcade completion indicators, a Tycoon prototype, weekly leaderboard/profile/room foundations, and a setup guide.
- [x] Run the TypeScript/Vite production build successfully (review warning: existing large map/app bundles).

## Still required before launch or claiming full spec completion

- [ ] Apply and test the new Supabase migration in the owner's project; configure `.env.local` with only the URL and publishable key.
- [ ] Replace provisional rail station sequences/interchange with an authorised, verified Kenya Railways service feed and test real transfers.
- [ ] Implement full Tycoon 2–4 player support, trading, auctions, debt/mortgages, remaining cards and rule tests.
- [ ] Complete the specified arcade features (Phaser loops, hazards/combos/lives, difficulty/progression and per-game persistence).
- [ ] Expand Trivia to the requested categories, 10-question timed round, lifelines/explanations and a reviewed 200-question dataset.
- [ ] Add shared game audio/mute, richer game-over effects, reduced-motion review and remaining haptics/animations.
- [ ] Build authoritative online moves/reconnects/presence for Chess, Ludo, Trivia and other room games; current room codes are lobby-only.
