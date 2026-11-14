// The 50 Nganya product concepts. This bundled copy lets the Mirth Shop show the catalogue
// even before the Supabase import is done. The Supabase table is the source of truth once imported.
// Prices are deliberately blank: nothing here is on sale until you confirm a price, stock and the licence.
export interface CatalogueItem { sku: string; name: string; category: string; description: string; image: string; alt: string }
export const NGANYA_CATEGORIES: Record<string, string> = {
  "models-toys": "Models & toys", "books-colouring": "Books & colouring", "wearables": "Wearables", "home-electronics": "Home & electronics", "games-digital": "Games & digital",
};
export const NGANYA_CATALOGUE: CatalogueItem[] = [
 {
  "sku": "NG-MOD-001",
  "name": "1:64 Nganya Die-cast Collector Van",
  "category": "models-toys",
  "description": "1:64 Nganya die-cast collector van with a fictional route board and a small display base.",
  "image": "NG-MOD-001-main.webp",
  "alt": "1:64 Nganya die-cast collector van with a fictional route board and a small display base."
 },
 {
  "sku": "NG-MOD-002",
  "name": "1:24 Premium Display Model",
  "category": "models-toys",
  "description": "1:24 premium display model intended for collectors, with removable display stand and original livery.",
  "image": "NG-MOD-002-main.webp",
  "alt": "1:24 premium display model intended for collectors, with removable display stand and original livery."
 },
 {
  "sku": "NG-MOD-003",
  "name": "Magnetic Livery Panel Kit",
  "category": "models-toys",
  "description": "Interchangeable magnetic sticker and panel kit for customising a compatible display model.",
  "image": "NG-MOD-003-main.webp",
  "alt": "Interchangeable magnetic sticker and panel kit for customising a compatible display model."
 },
 {
  "sku": "NG-MOD-004",
  "name": "1:24 LED Window Speaker (Concept)",
  "category": "models-toys",
  "description": "1:24 Bluetooth speaker concept with LED-lit windows and a removable service panel.",
  "image": "NG-MOD-004-main.webp",
  "alt": "1:24 Bluetooth speaker concept with LED-lit windows and a removable service panel."
 },
 {
  "sku": "NG-MOD-005",
  "name": "LED Key-holder Model",
  "category": "models-toys",
  "description": "Small LED key-holder model for an entry-level collectible or gift.",
  "image": "NG-MOD-005-main.webp",
  "alt": "Small LED key-holder model for an entry-level collectible or gift."
 },
 {
  "sku": "NG-MOD-006",
  "name": "Key-holder Mini Speaker (Concept)",
  "category": "models-toys",
  "description": "Miniature key-holder speaker concept, subject to engineering and battery feasibility review.",
  "image": "NG-MOD-006-main.webp",
  "alt": "Miniature key-holder speaker concept, subject to engineering and battery feasibility review."
 },
 {
  "sku": "NG-MOD-007",
  "name": "Remote-control Nganya",
  "category": "models-toys",
  "description": "Remote-control Nganya model for indoor play, with replaceable original body artwork.",
  "image": "NG-MOD-007-main.webp",
  "alt": "Remote-control Nganya model for indoor play, with replaceable original body artwork."
 },
 {
  "sku": "NG-MOD-008",
  "name": "Tabletop Nganya Racer",
  "category": "models-toys",
  "description": "Nganya racing model for a tabletop or slot-car-style course.",
  "image": "NG-MOD-008-main.webp",
  "alt": "Nganya racing model for a tabletop or slot-car-style course."
 },
 {
  "sku": "NG-MOD-009",
  "name": "3-in-1 Display, Audio & Power Model (Concept)",
  "category": "models-toys",
  "description": "3-in-1 concept model combining display lighting, a small audio feature and a removable power module, subject to feasibility review.",
  "image": "NG-MOD-009-main.webp",
  "alt": "3-in-1 concept model combining display lighting, a small audio feature and a removable power module, subject to feasibility review."
 },
 {
  "sku": "NG-MOD-010",
  "name": "Build-it-yourself Nganya Kit",
  "category": "models-toys",
  "description": "Build-it-yourself model kit with shell, wheels, decals and a paper assembly guide.",
  "image": "NG-MOD-010-main.webp",
  "alt": "Build-it-yourself model kit with shell, wheels, decals and a paper assembly guide."
 },
 {
  "sku": "NG-BOOK-011",
  "name": "Little Nganya Colouring Book",
  "category": "books-colouring",
  "description": "Early-years colouring book with large, simple Nganya-inspired outlines for young children.",
  "image": "NG-BOOK-011-main.webp",
  "alt": "Early-years colouring book with large, simple Nganya-inspired outlines for young children."
 },
 {
  "sku": "NG-BOOK-012",
  "name": "Matatus & City Scenes Colouring Book",
  "category": "books-colouring",
  "description": "Children’s colouring book with different fictional matatu silhouettes and city scenes.",
  "image": "NG-BOOK-012-main.webp",
  "alt": "Children’s colouring book with different fictional matatu silhouettes and city scenes."
 },
 {
  "sku": "NG-BOOK-013",
  "name": "Nganya Patterns Adult Colouring Book",
  "category": "books-colouring",
  "description": "Detailed adult colouring book featuring original patterns, fabrics, lights and vehicle ornamentation.",
  "image": "NG-BOOK-013-main.webp",
  "alt": "Detailed adult colouring book featuring original patterns, fabrics, lights and vehicle ornamentation."
 },
 {
  "sku": "NG-BOOK-014",
  "name": "Design Your Own Nganya Workbook",
  "category": "books-colouring",
  "description": "“Design Your Own Nganya” workbook with blank body panels and livery-planning pages.",
  "image": "NG-BOOK-014-main.webp",
  "alt": "“Design Your Own Nganya” workbook with blank body panels and livery-planning pages."
 },
 {
  "sku": "NG-BOOK-015",
  "name": "Colour-by-number Poster Book",
  "category": "books-colouring",
  "description": "Colour-by-number poster book using simple numbered regions and a printed colour key.",
  "image": "NG-BOOK-015-main.webp",
  "alt": "Colour-by-number poster book using simple numbered regions and a printed colour key."
 },
 {
  "sku": "NG-BOOK-016",
  "name": "Route Maze & Activity Book",
  "category": "books-colouring",
  "description": "Route-maze and activity book with fictional stage-to-stage puzzles, word searches and spot-the-difference activities.",
  "image": "NG-BOOK-016-main.webp",
  "alt": "Route-maze and activity book with fictional stage-to-stage puzzles, word searches and spot-the-difference activities."
 },
 {
  "sku": "NG-BOOK-017",
  "name": "Nganya Colouring Postcards",
  "category": "books-colouring",
  "description": "Set of Nganya colouring postcards for colouring, gifting or classroom activities.",
  "image": "NG-BOOK-017-main.webp",
  "alt": "Set of Nganya colouring postcards for colouring, gifting or classroom activities."
 },
 {
  "sku": "NG-BOOK-018",
  "name": "Reusable Colouring Mat (Concept)",
  "category": "books-colouring",
  "description": "Reusable colouring mat concept with wipe-clean surface and washable markers, subject to material-safety checks.",
  "image": "NG-BOOK-018-main.webp",
  "alt": "Reusable colouring mat concept with wipe-clean surface and washable markers, subject to material-safety checks."
 },
 {
  "sku": "NG-BOOK-019",
  "name": "Printable Colouring Bundle",
  "category": "books-colouring",
  "description": "Printable digital colouring bundle with PNG/PDF pages and a clear personal-use licence.",
  "image": "NG-BOOK-019-main.webp",
  "alt": "Printable digital colouring bundle with PNG/PDF pages and a clear personal-use licence."
 },
 {
  "sku": "NG-BOOK-020",
  "name": "Illustrated Nganya Storybook",
  "category": "books-colouring",
  "description": "Short illustrated children’s storybook with colouring pages, following a fictional bus on a safe city journey.",
  "image": "NG-BOOK-020-main.webp",
  "alt": "Short illustrated children’s storybook with colouring pages, following a fictional bus on a safe city journey."
 },
 {
  "sku": "NG-WEAR-021",
  "name": "Nganya Art Key Fob",
  "category": "wearables",
  "description": "Acrylic or wood key fob with original Nganya illustration and replaceable ring.",
  "image": "NG-WEAR-021-main.webp",
  "alt": "Acrylic or wood key fob with original Nganya illustration and replaceable ring."
 },
 {
  "sku": "NG-WEAR-022",
  "name": "Bus-art Lanyard",
  "category": "wearables",
  "description": "Fabric lanyard with repeating original bus-art pattern and detachable clip.",
  "image": "NG-WEAR-022-main.webp",
  "alt": "Fabric lanyard with repeating original bus-art pattern and detachable clip."
 },
 {
  "sku": "NG-WEAR-023",
  "name": "Nganya Enamel Pin Set",
  "category": "wearables",
  "description": "Enamel pin set with a bus silhouette, wheel, and fictional route-board design.",
  "image": "NG-WEAR-023-main.webp",
  "alt": "Enamel pin set with a bus silhouette, wheel, and fictional route-board design."
 },
 {
  "sku": "NG-WEAR-024",
  "name": "Embroidered Patch Set",
  "category": "wearables",
  "description": "Embroidered sew-on patch set featuring fictional Nganya motifs.",
  "image": "NG-WEAR-024-main.webp",
  "alt": "Embroidered sew-on patch set featuring fictional Nganya motifs."
 },
 {
  "sku": "NG-WEAR-025",
  "name": "Nganya Art T-shirt",
  "category": "wearables",
  "description": "T-shirt with licensed-or-original Nganya artwork and an optional artist credit on the label.",
  "image": "NG-WEAR-025-main.webp",
  "alt": "T-shirt with licensed-or-original Nganya artwork and an optional artist credit on the label."
 },
 {
  "sku": "NG-WEAR-026",
  "name": "Art-panel Hoodie (Concept)",
  "category": "wearables",
  "description": "Hoodie with removable or replaceable art panel concept.",
  "image": "NG-WEAR-026-main.webp",
  "alt": "Hoodie with removable or replaceable art panel concept."
 },
 {
  "sku": "NG-WEAR-027",
  "name": "Nganya Emblem Cap",
  "category": "wearables",
  "description": "Bucket hat or cap with a small embroidered original Nganya emblem.",
  "image": "NG-WEAR-027-main.webp",
  "alt": "Bucket hat or cap with a small embroidered original Nganya emblem."
 },
 {
  "sku": "NG-WEAR-028",
  "name": "Bus, Wheel & Music Socks",
  "category": "wearables",
  "description": "Socks with a repeating bus, wheel and music-note pattern.",
  "image": "NG-WEAR-028-main.webp",
  "alt": "Socks with a repeating bus, wheel and music-note pattern."
 },
 {
  "sku": "NG-WEAR-029",
  "name": "Nganya City-art Tote Bag",
  "category": "wearables",
  "description": "Reusable tote bag with an original Nganya city-art illustration.",
  "image": "NG-WEAR-029-main.webp",
  "alt": "Reusable tote bag with an original Nganya city-art illustration."
 },
 {
  "sku": "NG-WEAR-030",
  "name": "Reversible Nganya Bandana",
  "category": "wearables",
  "description": "Reversible scarf or bandana using two coordinated original Nganya patterns.",
  "image": "NG-WEAR-030-main.webp",
  "alt": "Reversible scarf or bandana using two coordinated original Nganya patterns."
 },
 {
  "sku": "NG-HOME-031",
  "name": "Nganya Fridge Magnet Set",
  "category": "home-electronics",
  "description": "Fridge magnet set with several small fictional matatu shapes and colour themes.",
  "image": "NG-HOME-031-main.webp",
  "alt": "Fridge magnet set with several small fictional matatu shapes and colour themes."
 },
 {
  "sku": "NG-HOME-032",
  "name": "Desktop Nganya Speaker",
  "category": "home-electronics",
  "description": "Desktop Bluetooth speaker with a custom Nganya shell and steady optional accent lighting.",
  "image": "NG-HOME-032-main.webp",
  "alt": "Desktop Bluetooth speaker with a custom Nganya shell and steady optional accent lighting."
 },
 {
  "sku": "NG-HOME-033",
  "name": "5.1 Nganya Speaker Set (Concept)",
  "category": "home-electronics",
  "description": "Concept 5.1 home-theatre set, where each of five speaker shells carries a different licensed-or-original vehicle art theme.",
  "image": "NG-HOME-033-main.webp",
  "alt": "Concept 5.1 home-theatre set, where each of five speaker shells carries a different licensed-or-original vehicle art theme."
 },
 {
  "sku": "NG-HOME-034",
  "name": "7.1 Nganya Speaker Set (Concept)",
  "category": "home-electronics",
  "description": "Concept 7.1 home-theatre set with seven distinct speaker-shell designs.",
  "image": "NG-HOME-034-main.webp",
  "alt": "Concept 7.1 home-theatre set with seven distinct speaker-shell designs."
 },
 {
  "sku": "NG-HOME-035",
  "name": "Touch Nganya Night Light",
  "category": "home-electronics",
  "description": "Touch-controlled Nganya night light with a steady glow and safe low-voltage power design.",
  "image": "NG-HOME-035-main.webp",
  "alt": "Touch-controlled Nganya night light with a steady glow and safe low-voltage power design."
 },
 {
  "sku": "NG-HOME-036",
  "name": "Nganya Power Bank (Concept)",
  "category": "home-electronics",
  "description": "Power bank with a fictional bus-inspired outer shell, subject to battery and transport safety review.",
  "image": "NG-HOME-036-main.webp",
  "alt": "Power bank with a fictional bus-inspired outer shell, subject to battery and transport safety review."
 },
 {
  "sku": "NG-HOME-037",
  "name": "Bus-stage Phone Stand",
  "category": "home-electronics",
  "description": "Phone stand or passive audio dock shaped like a bus stage.",
  "image": "NG-HOME-037-main.webp",
  "alt": "Phone stand or passive audio dock shaped like a bus stage."
 },
 {
  "sku": "NG-HOME-038",
  "name": "Route-board Wall Clock",
  "category": "home-electronics",
  "description": "Wall clock with an original route-board-inspired face and silent hands concept.",
  "image": "NG-HOME-038-main.webp",
  "alt": "Wall clock with an original route-board-inspired face and silent hands concept."
 },
 {
  "sku": "NG-HOME-039",
  "name": "Desk Destination Sign",
  "category": "home-electronics",
  "description": "LED display sign or desk marquee with changeable fictional destination panels.",
  "image": "NG-HOME-039-main.webp",
  "alt": "LED display sign or desk marquee with changeable fictional destination panels."
 },
 {
  "sku": "NG-HOME-040",
  "name": "Nganya Mug & Coaster Set",
  "category": "home-electronics",
  "description": "Mug and coaster gift set with a coordinated original Nganya illustration.",
  "image": "NG-HOME-040-main.webp",
  "alt": "Mug and coaster gift set with a coordinated original Nganya illustration."
 },
 {
  "sku": "NG-GAME-041",
  "name": "Nganya Racing Game, PC (Concept)",
  "category": "games-digital",
  "description": "PC Nganya racing game concept using properly sourced or fictionalised route-inspired tracks.",
  "image": "NG-GAME-041-main.webp",
  "alt": "PC Nganya racing game concept using properly sourced or fictionalised route-inspired tracks."
 },
 {
  "sku": "NG-GAME-042",
  "name": "Nganya Arcade Racer, Mobile (Concept)",
  "category": "games-digital",
  "description": "Mobile arcade racing game with short races, accessible controls and a fictional vehicle garage.",
  "image": "NG-GAME-042-main.webp",
  "alt": "Mobile arcade racing game with short races, accessible controls and a fictional vehicle garage."
 },
 {
  "sku": "NG-GAME-043",
  "name": "Livery & Track Expansion Pack (Concept)",
  "category": "games-digital",
  "description": "Optional livery and track expansion pack using only written-licensed vehicle art and verified route data.",
  "image": "NG-GAME-043-main.webp",
  "alt": "Optional livery and track expansion pack using only written-licensed vehicle art and verified route data."
 },
 {
  "sku": "NG-GAME-044",
  "name": "Nganya Digital Sticker Pack",
  "category": "games-digital",
  "description": "Downloadable Nganya digital sticker pack for messaging, with a personal-use licence and artist credit.",
  "image": "NG-GAME-044-main.webp",
  "alt": "Downloadable Nganya digital sticker pack for messaging, with a personal-use licence and artist credit."
 },
 {
  "sku": "NG-GAME-045",
  "name": "QR Provenance Card",
  "category": "games-digital",
  "description": "QR-linked digital provenance card for a licensed physical product, with a web page showing the artist and permission record.",
  "image": "NG-GAME-045-main.webp",
  "alt": "QR-linked digital provenance card for a licensed physical product, with a web page showing the artist and permission record."
 },
 {
  "sku": "NG-GAME-046",
  "name": "NFT-linked Collectible Edition (Future Concept)",
  "category": "games-digital",
  "description": "Optional NFT-linked collectible edition, deferred until rights, platform, custody, consumer, tax and legal review.",
  "image": "NG-GAME-046-main.webp",
  "alt": "Optional NFT-linked collectible edition, deferred until rights, platform, custody, consumer, tax and legal review."
 },
 {
  "sku": "NG-GAME-047",
  "name": "Route Rivals Card Game",
  "category": "games-digital",
  "description": "Party card game “Route Rivals” built around fictional routes, safe decision prompts and vehicle-art cards.",
  "image": "NG-GAME-047-main.webp",
  "alt": "Party card game “Route Rivals” built around fictional routes, safe decision prompts and vehicle-art cards."
 },
 {
  "sku": "NG-GAME-048",
  "name": "Nganya City Jigsaw Puzzle",
  "category": "games-digital",
  "description": "Jigsaw puzzle using commissioned original Nganya artwork, with difficulty tiers to be defined after prototyping.",
  "image": "NG-GAME-048-main.webp",
  "alt": "Jigsaw puzzle using commissioned original Nganya artwork, with difficulty tiers to be defined after prototyping."
 },
 {
  "sku": "NG-GAME-049",
  "name": "Junior Livery Design Kit",
  "category": "games-digital",
  "description": "Junior design challenge kit with blank livery sheets, crayons and a fair judging guide.",
  "image": "NG-GAME-049-main.webp",
  "alt": "Junior design challenge kit with blank livery sheets, crayons and a fair judging guide."
 },
 {
  "sku": "NG-GAME-050",
  "name": "Nganya Maker Guide",
  "category": "games-digital",
  "description": "Digital or printed maker guide with a parts list, assembly sketches, maintenance notes and artist/owner credits.",
  "image": "NG-GAME-050-main.webp",
  "alt": "Digital or printed maker guide with a parts list, assembly sketches, maintenance notes and artist/owner credits."
 }
];
