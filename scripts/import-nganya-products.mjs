// Loads the Nganya product catalogue CSV into Supabase and uploads the product pictures.
// From the project folder, in PowerShell:
//   $env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Paste the secret key"
//   node scripts/import-nganya-products.mjs supabase/import_templates/nganya_products.csv "C:\path\to\images"
//   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY ; Remove-Item Env:SUPABASE_URL
// The images folder holds files named like the CSV's suggested_image_filename (for example NG-MOD-001-main.webp).
// A product with no price stays "Coming soon" in the shop. Change price_kes, stock_qty and status (active) in the CSV, then run this again.
import { readFileSync, existsSync } from "node:fs";
import { basename, extname, join } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [csvPath, imageDir] = process.argv.slice(2);
if (!url || !key || !csvPath) { console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or the CSV path."); process.exit(1); }

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.some(c => c.trim()));
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const rows = parseCsv(readFileSync(csvPath, "utf8"));
const alt = text => text.replace(/^Suggested alt text.*?: /, "");
let done = 0, pictures = 0;
for (const [index, row] of rows.entries()) {
  if (!row.sku || !row.name) { console.warn("Skipped a row without sku or name"); continue; }
  const price = row.price_kes === "" ? null : Number(row.price_kes);
  if (price !== null && Number.isNaN(price)) { console.warn("Bad price for", row.sku); continue; }
  const status = ["concept", "draft", "active", "sold_out"].includes(row.status) ? row.status : "concept";
  const onSale = status === "active" && price !== null && Number(row.stock_qty) > 0;
  let imagePath = null;
  const wanted = basename(row.suggested_image_filename || "");
  if (wanted && imageDir && existsSync(join(imageDir, wanted))) {
    const file = join(imageDir, wanted); imagePath = wanted;
    const response = await fetch(`${url}/storage/v1/object/nganya-products/${encodeURIComponent(imagePath)}`, {
      method: "POST", headers: { ...headers, "Content-Type": mime[extname(file).toLowerCase()] ?? "application/octet-stream", "x-upsert": "true" }, body: readFileSync(file) });
    if (response.ok) pictures++; else { console.warn("Picture upload failed for", row.sku, await response.text()); imagePath = null; }
  }
  const response = await fetch(`${url}/rest/v1/nganya_products?on_conflict=sku`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ sku: row.sku, name: row.name, description: row.product_concept, category: row.category || "other", price_kes: price, stock_qty: Number(row.stock_qty) || 0,
      status: onSale || status !== "active" ? status : "concept", image_path: imagePath, alt_text: alt(row.suggested_alt_text || ""), artist_credit: row.artist_credit || null, owner_credit: row.owner_credit || null,
      rights_status: row.rights_status || "pending", sponsored: row.sponsored === "true", sort_order: index + 1, visible: true }) });
  if (!response.ok) console.warn("Row failed", row.sku, await response.text()); else done++;
}
console.log(`Done: ${done} of ${rows.length} products saved, ${pictures} pictures uploaded.`);
