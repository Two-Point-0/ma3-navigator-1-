

## Move and Market UX update — 8 October 2026

The latest UX request was implemented. Move now keeps the map as the primary surface with a compact top control set: Search and Live. The separate Plan, Matatu and Train top buttons were removed. Searching can return matatu routes, bus stops and mapped railway stations. Selecting a route exposes Start and Destination fields inside the bottom sheet. The user can also request browser location; Ma3 finds the nearest mapped stop and adds the walking-to-stop start context.

Bottom sheets use a smaller default height and a clickable handle to lower the sheet without closing it. Train stations open the train sheet from search. Live remains the entry point for nearby simulated matatus. Train geometry now includes a filtered HOTOSM/OpenStreetMap Nairobi railway asset at `src/data/nairobi_railways_osm.json`, with source attribution in `src/data/nairobi_railways_osm.md` and in the train sheet. The asset is ODbL-derived and passenger timetable accuracy must still be checked against Kenya Railways.

Market now uses searchable Shop plans rather than displaying a large template grid. Profiles include Solo Chapa, Sister Safi, Fam Safi, Campus Chapa, School Starter and Smart Mtaa. The user chooses a spend style—Budget friendly, Smart balance or More variety—and a target KES amount. The product catalogue stays hidden until the user searches. The backend import templates are `supabase/import_templates/products.csv` and `supabase/import_templates/price_observations.csv`.

The repository was built successfully after these changes. To see them in the Windows clone, pull the latest main branch rather than applying old patch files.
