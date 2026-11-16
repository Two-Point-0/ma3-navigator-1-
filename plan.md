# Ma3 Navigator updates — implementation plan

## Goal
Improve map-control visibility, make origin/destination selection clearer across Ma3 transport searches, add provisional station-to-station rail connection suggestions, and advance the Mirth games hub using the existing React/Vite/Supabase stack.

## Approach
- Keep shared app navigation and visual style; pin the Ma3 controls in the viewport while the MapLibre canvas remains draggable beneath them.
- Keep existing archived matatu routing, but present it explicitly as a route estimate. Add labelled boarding/start and destination/alighting selectors independent of choosing a particular route first.
- Add a clearly labelled sample railway corridor dataset with a review CSV and migration seed. The CSV is not a direct upload because the database stores station sequences as a Postgres array. Use the data only for prototype connection suggestions; do not imply verified timetables, fares or current service.
- Reuse existing local games, game sessions, score validation and Route King database flow. Add low-risk lobby improvements and avoid exposing room state to browser writes; live multiplayer requires server-side move validation.
- Preserve the existing Supabase project layout, migrations and public browser-key model. Never add service-role credentials to frontend code.

## Project structure
- `src/pages/Ma3.tsx`: transport tabs, start/destination selection, rail suggestions and map overlay.
- `src/data/prototype_rail_connections.ts`: local sample graph used as offline-safe fallback.
- `supabase/import_templates/rail_prototype_lines.csv`: editable review copy of sample data, not a direct import file.
- `supabase/migrations/20261118000000_mirth_prototype_foundation.sql`: sample rail rows and secured Mirth profile/leaderboard/room schema.
- `src/pages/Mirth.tsx` and game components: games lobby and playable single-player games.
- `docs/supabase-setup.md`: hands-on backend setup steps and limitations.
- `docs/mirth-games-quickstart.md`: local run, environment variables, questions and new-game instructions.

## Design direction
- Existing app's near-black night-map aesthetic, using its amber/green/red state system, compact stage/route-board cards and accessible high-contrast labels.
- Keep game cards mobile-first; make local/offline play work without a Supabase connection.

## Boundaries
- Existing Ma3 feed is archived and existing OSM rail mapping is not a timetable. Prototype railway connections must remain visibly marked as unverified sample data.
- Supabase room tables provide a secure foundation only; they do not make multiplayer gameplay authoritative until a server-side move-validation function is implemented.
- Credentials, remote project linking, migration application and data verification require the owner to perform the documented steps locally.
