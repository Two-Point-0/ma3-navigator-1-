# Posters: how they connect

A poster is a full-screen picture + key facts that opens when you tap a pin.

## Sights (30 curated, in `src/data/sights.ts`)
- Picture file name = sight id, e.g. `maasai-mara.png` (jpg also works). Tall Stitch pages open as a scrollable page.
- `node scripts/prepare-posters.mjs "stitch images"` renames Stitch exports for you into `poster-ready/`.
- Upload: Supabase > Storage > bucket **posters** > create folder **sights** > drag the JPGs in.
- Landscape 3:2, 1200x800, JPG, under 300 KB.
- Fallback if the bucket has no file: `public/sights/<id>.jpg` in the repo.

## Other mapped places (87k places)
- Table `place_posters` (migration `20261125000000_place_posters.sql`). `place_ref` = the place's osm_id. Add `poster_url`, `description`, etc. The pin then opens the poster.

## Local businesses (Market > Local)
- Table `local_businesses`. First entry of `image_paths` (bucket **business-images**) is the poster.
- 100 demo businesses: `docs/local-business-posters.md`, prompts in `docs/local-poster-prompts.txt`, seed `supabase/seed/demo_local_businesses.sql`.
