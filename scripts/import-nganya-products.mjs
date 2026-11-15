// Loads your Nganya products (name, description, price, category) and their pictures into Supabase.
//
//   1. Save your product list as a CSV (Excel: File > Save As > "CSV UTF-8"). One row per product.
//   2. Put all the pictures in ONE folder. Name each picture after the product's sku, e.g. NG-MOD-001.png
//      (or list the exact file name in an "image" column). Extra pictures like NG-MOD-001-2.png are ignored for now.
//   3. In PowerShell, from the project folder:
//        $env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
//        $env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Paste the secret key"
//        node scripts/import-nganya-products.mjs "C:\path\products.csv" "C:\path\images" --dry        (practice run, changes nothing)
//        node scripts/import-nganya-products.mjs "C:\path\products.csv" "C:\path\images" --mark-cleared --activate
//        Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY ; Remove-Item Env:SUPABASE_URL
//
//   --dry           only report what would happen
//   --mark-cleared  you confirm you own the art/designs (sets rights to "cleared" where the CSV leaves it blank). Needed before anything can be sold.
//   --activate      products that have a price and stock become "on sale". Without it they show as "Coming soon".
// Column names are flexible: name/title, description/details/product_concept, category/type, price/price_kes, stock/stock_qty, image/image_file, sku/code.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

const flags = process.argv.slice(2).filter(a => a.startsWith("--")); const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const dry = flags.includes("--dry"), markCleared = flags.includes("--mark-cleared"), activate = flags.includes("--activate");
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY; const [csvPath, imageDir] = args;
if (!csvPath || (!dry && (!url || !key))) { console.error("Usage: node scripts/import-nganya-products.mjs products.csv imagesFolder [--dry] [--mark-cleared] [--activate]\nAlso set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see the top of this file)."); process.exit(1); }

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, ""); const rows = []; let row = [], cell = "", quoted = false;
  const sep = (text.split("\n", 1)[0].match(/;/g) || []).length > (text.split("\n", 1)[0].match(/,/g) || []).length ? ";" : ",";
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true; else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += ch; }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.some(c => c.trim()));
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase().replace(/[\s-]+/g, "_"), (r[i] ?? "").trim()])));
}
const pick = (row, names) => { for (const n of names) if (row[n]) return row[n]; return ""; };
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const files = imageDir ? walk(imageDir).filter(f => mime[extname(f).toLowerCase()]) : [];
const findImage = (sku, name, explicit) => {
  const wanted = (explicit ? basename(explicit) : "").toLowerCase();
  const byName = f => basename(f).toLowerCase();
  return files.find(f => wanted && byName(f) === wanted) || files.find(f => slug(basename(f, extname(f))) === slug(sku)) || files.find(f => slug(basename(f, extname(f))) === slug(name))
    || files.find(f => slug(basename(f, extname(f))).startsWith(slug(sku))) || null;
};
// Old-style keys are long and start with "eyJ" and go in both headers. New-style keys start with "sb_secret_" and go only in "apikey".
const headers = url ? (key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key }) : {};
// Optional: if the "sharp" helper is installed, pictures are shrunk to WebP before upload (shop loads much faster). Otherwise they upload as they are.
let sharp = null; try { sharp = (await import("sharp")).default; } catch { /* not installed, fine */ }
if (!dry) console.log(sharp ? "Picture shrinking: ON (WebP)" : "Picture shrinking: off (install the helper to turn on: npm install sharp --no-save)");
const rows = parseCsv(readFileSync(csvPath, "utf8"));
let done = 0, pictures = 0; const noImage = [], bad = [];
for (const [index, row] of rows.entries()) {
  const name = pick(row, ["name", "title", "product_name", "product"]); if (!name) { bad.push(`row ${index + 2}: no name`); continue; }
  const sku = pick(row, ["sku", "code", "id", "product_id"]) || `NG-${slug(name).toUpperCase().slice(0, 24)}`;
  const description = pick(row, ["description", "details", "product_concept", "desc", "about"]);
  const category = slug(pick(row, ["category", "type", "collection", "group"]) || "other");
  const priceText = pick(row, ["price_kes", "price", "kes", "selling_price"]).replace(/[^0-9.]/g, ""); const price = priceText === "" ? null : Number(priceText);
  const stock = Number(pick(row, ["stock_qty", "stock", "quantity", "qty"]).replace(/[^0-9]/g, "")) || 0;
  let status = pick(row, ["status"]).toLowerCase(); if (!["concept", "draft", "active", "sold_out"].includes(status)) status = "concept";
  if (activate && price !== null && stock > 0) status = "active";
  const rights = pick(row, ["rights_status", "rights"]) || (markCleared ? "cleared" : "pending");
  const onSale = status === "active" && price !== null && stock > 0 && rights === "cleared";
  const image = findImage(sku, name, pick(row, ["image", "image_file", "picture", "photo", "filename", "suggested_image_filename"]));
  if (!image) noImage.push(sku);
  const note = `${sku} · ${name} · ${category} · ${price === null ? "no price" : "KES " + price} · stock ${stock} · ${onSale ? "ON SALE" : "coming soon"} · ${image ? basename(image) : "NO PICTURE"}`;
  if (dry) { console.log(note); done++; continue; }
  let imagePath = null;
  if (image) {
    let ext = extname(image).toLowerCase(); let bytes = readFileSync(image);
    if (sharp && ext !== ".gif") { bytes = await sharp(bytes).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(); ext = ".webp"; }
    imagePath = `${slug(sku)}${ext}`;
    const response = await fetch(`${url}/storage/v1/object/nganya-products/${encodeURIComponent(imagePath)}`, { method: "POST", headers: { ...headers, "Content-Type": mime[ext], "x-upsert": "true" }, body: bytes });
    if (response.ok) pictures++; else { console.warn(`  ✗ Picture upload failed for ${sku}:`, await response.text()); imagePath = null; }
  }
  const response = await fetch(`${url}/rest/v1/nganya_products?on_conflict=sku`, { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ sku, name, description, category, price_kes: price, stock_qty: stock, status, image_path: imagePath, alt_text: pick(row, ["alt_text", "alt", "suggested_alt_text"]).replace(/^Suggested alt text.*?: /, "") || name,
      artist_credit: pick(row, ["artist_credit", "artist"]) || null, owner_credit: pick(row, ["owner_credit", "owner"]) || null, rights_status: rights, sponsored: pick(row, ["sponsored"]) === "true", sort_order: index + 1, visible: true }) });
  if (!response.ok) console.warn(`  ✗ ${sku} failed:`, await response.text()); else { done++; console.log(`  ✓ ${String(done).padStart(2)}/${rows.length} ${sku} ${name}${imagePath ? " + picture" : " (no picture)"}`); }
}
if (!dry) { const check = await fetch(`${url}/rest/v1/nganya_products?select=sku`, { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } }); console.log(`\nCheck: Supabase now holds ${check.headers.get("content-range")?.split("/")[1] ?? "?"} products in total.`); }
console.log(`\n${dry ? "PRACTICE RUN. " : ""}${done} of ${rows.length} products ${dry ? "would be saved" : "saved"}${dry ? "" : `, ${pictures} pictures uploaded`}.`);
if (noImage.length) console.log(`No picture found for: ${noImage.join(", ")} (name the picture after the sku, or add an "image" column).`);
if (bad.length) console.log("Skipped:", bad.join("; "));
