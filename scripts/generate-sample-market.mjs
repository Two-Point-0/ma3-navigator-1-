// Generates SAMPLE supermarket data (500+ products, thousands of prices) in the exact CSV format
// that scripts/import-market-csv.mjs expects.  Run:  node scripts/generate-sample-market.mjs
// Everything is labelled source_type=seeded_demo, verified=false. These are NOT real prices.
import { writeFile, mkdir } from "node:fs/promises";

let seed = 20261027;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const jitter = (spread) => 1 + (rand() * 2 - 1) * spread;

// category, product name, brands, [pack, base price KES]
const CATALOGUE = [
  ["Staples", "Maize flour (unga)", ["Jogoo", "Pembe", "Soko", "Dola", "Ajab", "Hostess"], [["1 kg", 120], ["2 kg", 215], ["5 kg", 520]]],
  ["Staples", "Wheat flour", ["Exe", "Pembe", "Ajab", "Mombasa Maize Millers"], [["1 kg", 135], ["2 kg", 255]]],
  ["Staples", "Rice (pishori)", ["Daawat", "Mwea", "Tilda", "Pearl", "Basmati Gold"], [["1 kg", 210], ["2 kg", 400], ["5 kg", 980]]],
  ["Staples", "Rice (long grain)", ["Ndiwa", "Pearl", "Fresh Fri", "Daawat"], [["1 kg", 165], ["2 kg", 320]]],
  ["Staples", "Sugar", ["Mumias", "Kabras", "Sony", "Kensugar", "Butali"], [["1 kg", 190], ["2 kg", 365]]],
  ["Staples", "Spaghetti", ["Santa Lucia", "Del Monte", "Kenpasta", "Dola"], [["400 g", 85], ["500 g", 105]]],
  ["Staples", "Macaroni", ["Santa Lucia", "Kenpasta", "Dola"], [["400 g", 85], ["500 g", 100]]],
  ["Staples", "Beans (dry)", ["Mwitu", "Soko", "Nyayo", "Local"], [["1 kg", 190], ["2 kg", 370]]],
  ["Staples", "Green grams (ndengu)", ["Soko", "Local", "Njugu"], [["500 g", 120], ["1 kg", 230]]],
  ["Staples", "Lentils", ["Soko", "Pearl", "Local"], [["500 g", 125], ["1 kg", 240]]],
  ["Staples", "Salt", ["Kensalt", "Maldon", "Chef", "Kapa"], [["500 g", 40], ["1 kg", 70]]],
  ["Staples", "Porridge flour", ["Jogoo", "Soko", "Pembe", "Kenya Millers"], [["500 g", 105], ["1 kg", 200]]],
  ["Cooking", "Cooking oil", ["Elianto", "Rina", "Fresh Fri", "Kimbo", "Golden Fry", "Postman"], [["500 ml", 210], ["1 L", 395], ["2 L", 770], ["3 L", 1130]]],
  ["Cooking", "Cooking fat", ["Kasuku", "Kimbo", "Cowboy", "Prestige"], [["250 g", 150], ["500 g", 290]]],
  ["Cooking", "Margarine", ["Blue Band", "Prestige", "Kasuku", "Royco"], [["250 g", 170], ["500 g", 320]]],
  ["Cooking", "Tomato paste", ["Pomodoro", "Del Monte", "Kenchic", "Tomato Gold"], [["70 g", 40], ["200 g", 85]]],
  ["Cooking", "Stock cubes", ["Royco", "Knorr", "Maggi"], [["10 pack", 55], ["24 pack", 120]]],
  ["Cooking", "Curry powder", ["Pilau Masala", "Kitui", "Pwani", "Royco"], [["50 g", 70], ["100 g", 120]]],
  ["Dairy", "Fresh milk", ["Brookside", "Tuzo", "Ilara", "Daima", "New KCC"], [["500 ml", 65], ["1 L", 120]]],
  ["Dairy", "Long-life milk", ["Brookside", "Tuzo", "Daima", "Fresha", "Ilara"], [["500 ml", 70], ["1 L", 130]]],
  ["Dairy", "Yoghurt", ["Brookside", "Daima", "Fresha", "Tuzo"], [["250 ml", 70], ["500 ml", 125]]],
  ["Dairy", "Cheese slices", ["Brookside", "Happy Cow", "Alpine"], [["200 g", 330], ["400 g", 620]]],
  ["Dairy", "Eggs", ["Kenchic", "Local farm", "Pembe"], [["Tray of 30", 490], ["6 pack", 110]]],
  ["Dairy", "Butter", ["Brookside", "Alpine", "Lurpak"], [["250 g", 420], ["500 g", 780]]],
  ["Breakfast", "Bread (white)", ["Superloaf", "Festive", "Broadway", "Elliots"], [["400 g", 60], ["800 g", 110]]],
  ["Breakfast", "Bread (brown)", ["Superloaf", "Festive", "Broadway", "Elliots"], [["400 g", 70], ["800 g", 120]]],
  ["Breakfast", "Tea leaves", ["Ketepa", "Tazo", "Kericho Gold", "Chai Bora", "Zesta"], [["100 g", 80], ["250 g", 175], ["500 g", 335]]],
  ["Breakfast", "Tea bags", ["Ketepa Pride", "Kericho Gold", "Lipton", "Zesta"], [["50 bags", 130], ["100 bags", 250]]],
  ["Breakfast", "Instant coffee", ["Nescafe", "Dormans", "Africafe", "Kenya Coffee"], [["50 g", 210], ["100 g", 390], ["200 g", 740]]],
  ["Breakfast", "Cornflakes", ["Kellogg's", "Weetabix", "Jungle Oats", "Pride"], [["250 g", 290], ["500 g", 540]]],
  ["Breakfast", "Oats", ["Jungle Oats", "Quaker", "Pride"], [["500 g", 300], ["1 kg", 560]]],
  ["Breakfast", "Peanut butter", ["Peptang", "Cadbury", "Nutri", "Skippy"], [["250 g", 230], ["400 g", 360]]],
  ["Breakfast", "Jam", ["Kenya Orchards", "Wilkin", "Golden Fry"], [["400 g", 240], ["450 g", 270]]],
  ["Drinks", "Soda", ["Coca-Cola", "Fanta", "Sprite", "Pepsi", "Stoney", "Krest"], [["300 ml", 45], ["500 ml", 70], ["1.25 L", 130], ["2 L", 195]]],
  ["Drinks", "Bottled water", ["Dasani", "Keringet", "Highlands", "Aquamist", "Quencher"], [["500 ml", 40], ["1 L", 70], ["5 L", 250]]],
  ["Drinks", "Juice", ["Minute Maid", "Del Monte", "Delmonte", "Pick n Peel", "Afia"], [["500 ml", 100], ["1 L", 190], ["2 L", 350]]],
  ["Drinks", "Energy drink", ["Red Bull", "Monster", "Predator", "Power Play"], [["250 ml", 210], ["500 ml", 160]]],
  ["Drinks", "Drinking chocolate", ["Cadbury", "Nestle Milo", "Ovaltine"], [["200 g", 330], ["400 g", 610]]],
  ["Snacks", "Biscuits", ["Crown", "Britania", "Oreo", "Tuc", "Mikado", "Digestive"], [["100 g", 50], ["200 g", 100], ["400 g", 190]]],
  ["Snacks", "Crisps", ["Pringles", "Lays", "Kenchic", "Kettle", "Crisps Plus"], [["50 g", 60], ["100 g", 110], ["165 g", 340]]],
  ["Snacks", "Chocolate bar", ["Cadbury", "Nestle", "Snickers", "Kit Kat"], [["45 g", 85], ["100 g", 190]]],
  ["Snacks", "Sweets", ["Mentos", "Haribo", "Lolly", "Fruity"], [["50 g", 40], ["150 g", 110]]],
  ["Snacks", "Groundnuts", ["Nuts Plus", "Local", "Kitui"], [["250 g", 140], ["500 g", 270]]],
  ["Fresh produce", "Tomatoes", ["Local farm"], [["1 kg", 90], ["500 g", 50]]],
  ["Fresh produce", "Onions", ["Local farm", "Red Bull Farms"], [["1 kg", 110], ["500 g", 60]]],
  ["Fresh produce", "Potatoes", ["Local farm", "Nyandarua"], [["1 kg", 85], ["2 kg", 160]]],
  ["Fresh produce", "Sukuma wiki", ["Local farm"], [["bunch", 20], ["500 g", 35]]],
  ["Fresh produce", "Spinach", ["Local farm"], [["bunch", 25], ["500 g", 45]]],
  ["Fresh produce", "Cabbage", ["Local farm"], [["medium", 60], ["large", 100]]],
  ["Fresh produce", "Carrots", ["Local farm"], [["1 kg", 90], ["500 g", 50]]],
  ["Fresh produce", "Bananas", ["Local farm", "Ripe"], [["1 kg", 90], ["bunch", 150]]],
  ["Fresh produce", "Avocado", ["Hass", "Fuerte"], [["each", 30], ["4 pack", 110]]],
  ["Fresh produce", "Oranges", ["Local farm"], [["1 kg", 150], ["6 pack", 130]]],
  ["Fresh produce", "Watermelon", ["Local farm"], [["1 kg", 60], ["whole", 220]]],
  ["Fresh produce", "Mangoes", ["Apple", "Ngowe"], [["1 kg", 160], ["each", 40]]],
  ["Meat & fish", "Beef", ["Farmers Choice", "Choice Cuts", "Butcher"], [["500 g", 340], ["1 kg", 650]]],
  ["Meat & fish", "Chicken (whole)", ["Kenchic", "Farmers Choice", "Brookside"], [["1.2 kg", 560], ["1.6 kg", 740]]],
  ["Meat & fish", "Sausages", ["Farmers Choice", "Choice Meats", "Kenchic", "Quality Meats"], [["500 g", 380], ["1 kg", 700]]],
  ["Meat & fish", "Tilapia", ["Lake Victoria", "Fresh Catch"], [["each", 350], ["1 kg", 480]]],
  ["Meat & fish", "Omena (dried fish)", ["Lake Victoria", "Local"], [["250 g", 110], ["500 g", 210]]],
  ["Household", "Washing powder", ["Omo", "Ariel", "Sunlight", "Toss", "Ushindi"], [["500 g", 170], ["1 kg", 320], ["2 kg", 610]]],
  ["Household", "Bar soap", ["Menengai", "Geisha", "Sunlight", "Dettol"], [["200 g", 60], ["800 g", 190]]],
  ["Household", "Dish soap", ["Sunlight", "Vim", "Ajax", "Domestos"], [["500 ml", 150], ["1 L", 270]]],
  ["Household", "Bleach", ["Jik", "Domestos", "Harpic"], [["500 ml", 110], ["1 L", 180]]],
  ["Household", "Toilet paper", ["Rose", "Kleenex", "Softcare", "Fay", "Velvex"], [["4 rolls", 150], ["10 rolls", 360]]],
  ["Household", "Tissue paper", ["Rose", "Fay", "Kleenex"], [["single box", 110], ["3 pack", 280]]],
  ["Household", "Matchbox", ["Kibo", "Cobra", "Lion"], [["10 pack", 40], ["20 pack", 70]]],
  ["Household", "Charcoal", ["Local", "Jikoni"], [["2 kg", 90], ["5 kg", 210]]],
  ["Household", "Cooking gas refill", ["Total", "K-Gas", "ProGas", "Hashi"], [["6 kg", 1000], ["13 kg", 2300]]],
  ["Personal care", "Toothpaste", ["Colgate", "Close Up", "Aquafresh", "Oral-B"], [["50 ml", 110], ["100 ml", 190]]],
  ["Personal care", "Body lotion", ["Vaseline", "Nivea", "Johnson's", "Dove"], [["200 ml", 280], ["400 ml", 480]]],
  ["Personal care", "Shower gel", ["Dove", "Lux", "Nivea", "Dettol"], [["250 ml", 290], ["500 ml", 480]]],
  ["Personal care", "Deodorant", ["Nivea", "Rexona", "Sure", "Axe"], [["150 ml", 330], ["50 ml roll-on", 210]]],
  ["Personal care", "Shampoo", ["Dove", "Head & Shoulders", "Pantene", "Sunsilk"], [["200 ml", 270], ["400 ml", 490]]],
  ["Personal care", "Sanitary pads", ["Always", "Kotex", "Softcare", "Molped"], [["8 pack", 110], ["16 pack", 210]]],
  ["Personal care", "Petroleum jelly", ["Vaseline", "Blue Seal", "Baby Care"], [["50 ml", 80], ["250 ml", 220]]],
  ["Baby", "Diapers", ["Pampers", "Huggies", "Softcare", "Molfix"], [["Small 30", 850], ["Medium 40", 1100], ["Large 40", 1250]]],
  ["Baby", "Baby milk formula", ["Nan", "Lactogen", "Cerelac", "SMA"], [["400 g", 1100], ["800 g", 2050]]],
  ["Baby", "Baby wipes", ["Pampers", "Huggies", "Softcare"], [["56 wipes", 260], ["80 wipes", 340]]],
  ["School & office", "Exercise book", ["Kenya Stationers", "Croxley", "Bic"], [["48 pages", 35], ["96 pages", 60]]],
  ["School & office", "Pens", ["Bic", "Parker", "Pilot"], [["single", 15], ["10 pack", 130]]],
  ["School & office", "Pencils", ["Staedtler", "Faber-Castell", "Bic"], [["10 pack", 90], ["12 pack", 110]]],
  ["Electronics", "Phone charger", ["Oraimo", "Samsung", "Tecno"], [["2A", 550], ["fast charge", 900]]],
  ["Electronics", "Batteries AA", ["Duracell", "Eveready", "Panasonic"], [["4 pack", 220], ["8 pack", 420]]],
  ["Electronics", "Light bulb LED", ["Philips", "Osram", "Ibra"], [["9 W", 220], ["12 W", 290]]],
];

const RETAILERS = [
  { slug: "naivas", mult: 1.0 }, { slug: "quickmart", mult: 0.97 }, { slug: "carrefour", mult: 1.06 },
  { slug: "chandarana", mult: 1.04 }, { slug: "cleanshelf", mult: 1.02 },
];
// Approximate AREA centre points (not exact store locations). Replace with real branch coordinates before launch.
const AREAS = [
  { region: "Westlands", lat: -1.2676, lon: 36.8108 }, { region: "Kilimani", lat: -1.2921, lon: 36.7872 },
  { region: "CBD", lat: -1.2833, lon: 36.8219 }, { region: "Rongai", lat: -1.3963, lon: 36.7436 },
  { region: "Kasarani", lat: -1.2218, lon: 36.897 }, { region: "Buruburu", lat: -1.286, lon: 36.865 },
];
const BRANCHES = [
  ["naivas", "Westlands", 0], ["naivas", "CBD", 2], ["naivas", "Rongai", 3], ["naivas", "Kasarani", 4],
  ["quickmart", "Kilimani", 1], ["quickmart", "Buruburu", 5], ["quickmart", "Rongai", 3],
  ["carrefour", "Westlands", 0], ["carrefour", "Kilimani", 1],
  ["chandarana", "Westlands", 0], ["chandarana", "Kilimani", 1],
  ["cleanshelf", "CBD", 2], ["cleanshelf", "Buruburu", 5],
];

const slugify = v => v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const csv = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const row = a => a.map(csv).join(",");

const products = [];
let n = 0;
for (const [category, name, brands, packs] of CATALOGUE) {
  for (const brand of brands) {
    const brandMult = 0.9 + rand() * 0.25;
    for (const [pack, base] of packs) {
      n++;
      products.push({ sku: `SAMPLE-${String(n).padStart(4, "0")}`, name: `${brand} ${name}`, normalized: `${brand} ${name}`.toLowerCase(), category, brand, pack, base: base * brandMult });
    }
  }
}
if (products.length < 500) throw new Error(`Only ${products.length} products; need 500+.`);

const productRows = [row(["sku", "name", "normalized_name", "category", "brand", "pack_size", "barcode", "image_url", "active"])];
for (const p of products) productRows.push(row([p.sku, p.name, p.normalized, p.category, p.brand, p.pack, "", "", "true"]));

const observed = "2026-10-27T08:00:00Z";
const priceRows = [row(["sku", "retailer_slug", "branch", "branch_slug", "region", "latitude", "longitude", "price_kes", "pack_size", "source_type", "source_url", "observed_at", "verified"])];
const retailerMult = Object.fromEntries(RETAILERS.map(r => [r.slug, r.mult]));
let count = 0;
for (const p of products) {
  for (const [retailer, region, areaIdx] of BRANCHES) {
    if (rand() > 0.86) continue; // not every product is on every shelf
    const area = AREAS[areaIdx];
    let price = p.base * retailerMult[retailer] * jitter(0.035);
    price = price >= 100 ? Math.round(price / 5) * 5 : Math.round(price);
    const branch = `${region} (sample)`;
    priceRows.push(row([p.sku, retailer, branch, `${slugify(branch)}-${slugify(region)}`, region, area.lat, area.lon, price, p.pack, "seeded_demo", "", observed, "false"]));
    count++;
  }
}

await mkdir("supabase/sample_data", { recursive: true });
await writeFile("supabase/sample_data/products.csv", productRows.join("\n") + "\n");
await writeFile("supabase/sample_data/price_observations.csv", priceRows.join("\n") + "\n");
console.log(`Wrote ${products.length} products and ${count} sample prices to supabase/sample_data/`);
