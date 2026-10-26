import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  if (field !== "" || row.length) { row.push(field); if (row.some(value => value.trim() !== "")) rows.push(row); }
  if (!rows.length) throw new Error("CSV is empty.");
  const headers = rows.shift().map((value, i) => (i === 0 ? value.replace(/^\uFEFF/, "") : value).trim());
  return rows.map((values, line) => Object.fromEntries(headers.map((key, i) => [key, (values[i] ?? "").trim()])))
    .map((item, i) => ({ ...item, __line: i + 2 }));
}

async function readCsv(path) { return parseCsv(await readFile(path, "utf8")); }
function chunks(items, size = 300) { const out = []; for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size)); return out; }
function required(row, key, fileLabel) { if (!row[key]) throw new Error(`${fileLabel}, CSV row ${row.__line}: ${key} is required.`); return row[key]; }
function slugify(value) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function optionalCoordinate(row, key, min, max) {
  if (!row[key]) return null;
  const value = Number(row[key]);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`price_observations.csv, row ${row.__line}: ${key} must be between ${min} and ${max}.`);
  return value;
}

const args = process.argv.slice(2);
const arg = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] ?? null; };
const productsPath = arg("--products"), pricesPath = arg("--prices"), matatusPath = arg("--matatus");
if (!productsPath && !pricesPath && !matatusPath) throw new Error("Usage: node scripts/import-market-csv.mjs [--products <products.csv>] [--prices <price_observations.csv>] [--matatus <nganya_matatus.csv>]");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this terminal only; never use VITE_ variables for the service-role key.");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

if (productsPath) {
  const source = await readCsv(productsPath);
  const bySku = new Map();
  for (const row of source) {
    const sku = required(row, "sku", "products.csv");
    const name = required(row, "name", "products.csv");
    const active = row.active === "" ? true : row.active.toLowerCase() === "true";
    if (row.active && !["true", "false"].includes(row.active.toLowerCase())) throw new Error(`products.csv, row ${row.__line}: active must be true or false.`);
    bySku.set(sku, { sku, name, normalized_name: row.normalized_name || name.toLowerCase().trim(), category: row.category || "Other", brand: row.brand || null, pack_size: required(row, "pack_size", "products.csv"), barcode: row.barcode || null, image_url: row.image_url || null, active });
  }
  const items = [...bySku.values()];
  for (const batch of chunks(items)) {
    const { error } = await supabase.from("products").upsert(batch, { onConflict: "sku" });
    if (error) throw new Error(`Product upsert failed: ${error.message}`);
  }
  console.log(`Upserted ${items.length} distinct products.`);
}

if (pricesPath) {
  const source = await readCsv(pricesPath);
  const rows = source.map(row => {
    const sku = required(row, "sku", "price_observations.csv");
    const retailer_slug = required(row, "retailer_slug", "price_observations.csv");
    const branch = row.branch || "";
    if (row.branch_slug && !branch) throw new Error(`price_observations.csv, row ${row.__line}: branch is required when branch_slug is supplied.`);
    const branch_slug = branch ? (row.branch_slug || `${slugify(branch)}-${slugify(row.region || "")}`) : null;
    const region = required(row, "region", "price_observations.csv");
    const latitude = optionalCoordinate(row, "latitude", -90, 90);
    const longitude = optionalCoordinate(row, "longitude", -180, 180);
    if ((latitude === null) !== (longitude === null)) throw new Error(`price_observations.csv, row ${row.__line}: latitude and longitude must either both be present or both be blank.`);
    if (latitude !== null && !branch_slug) throw new Error(`price_observations.csv, row ${row.__line}: branch is required when coordinates are supplied.`);
    const amount = Number(required(row, "price_kes", "price_observations.csv"));
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`price_observations.csv, row ${row.__line}: price_kes must be a non-negative number.`);
    const source_type = row.source_type || "manual_entry";
    if (!["manual_entry", "seeded_demo", "user_submitted", "partner_data", "retailer_feed"].includes(source_type)) throw new Error(`price_observations.csv, row ${row.__line}: unsupported source_type ${source_type}.`);
    const dateInput = row.observed_at || new Date().toISOString();
    const observedDate = new Date(dateInput);
    if (Number.isNaN(observedDate.getTime())) throw new Error(`price_observations.csv, row ${row.__line}: observed_at is not a valid date.`);
    const verified = row.verified ? row.verified.toLowerCase() === "true" : false;
    if (row.verified && !["true", "false"].includes(row.verified.toLowerCase())) throw new Error(`price_observations.csv, row ${row.__line}: verified must be true or false.`);
    const dateKey = observedDate.toISOString().slice(0, 10);
    const import_key = createHash("sha256").update([sku, retailer_slug, branch_slug || branch, region, dateKey, source_type].join("\u001f")).digest("hex");
    return { sku, retailer_slug, branch, branch_slug, region, latitude, longitude, price_kes: amount, pack_size: row.pack_size || null, source_type, source_url: row.source_url || null, observed_at: observedDate.toISOString(), verified, import_key, __line: row.__line };
  });

  const slugs = [...new Set(rows.map(row => row.retailer_slug))];
  const skuSet = [...new Set(rows.map(row => row.sku))];
  const [{ data: retailers, error: retailerError }, { data: products, error: productError }] = await Promise.all([
    supabase.from("retailers").select("id,slug").in("slug", slugs),
    supabase.from("products").select("id,sku,pack_size").in("sku", skuSet),
  ]);
  if (retailerError) throw new Error(`Retailer lookup failed: ${retailerError.message}`);
  if (productError) throw new Error(`Product lookup failed: ${productError.message}. Import products.csv before price_observations.csv.`);
  const retailerBySlug = new Map((retailers ?? []).map(item => [item.slug, item]));
  const productBySku = new Map((products ?? []).map(item => [item.sku, item]));
  const branchesByKey = new Map();
  for (const row of rows) {
    const retailer = retailerBySlug.get(row.retailer_slug);
    if (!retailer) throw new Error(`price_observations.csv, row ${row.__line}: unknown retailer_slug ${row.retailer_slug}; valid slugs are naivas, quickmart, carrefour, chandarana, cleanshelf.`);
    if (!row.branch_slug) continue;
    const key = `${retailer.id}:${row.branch_slug}`;
    const previous = branchesByKey.get(key);
    if (previous && previous.latitude !== null && row.latitude !== null && (previous.latitude !== row.latitude || previous.longitude !== row.longitude)) {
      throw new Error(`price_observations.csv, row ${row.__line}: branch ${row.branch} has conflicting coordinates in this file.`);
    }
    branchesByKey.set(key, {
      key, retailer_id: retailer.id, branch_slug: row.branch_slug, branch_name: row.branch || row.branch_slug,
      region: row.region, latitude: previous?.latitude ?? row.latitude, longitude: previous?.longitude ?? row.longitude, active: true,
    });
  }
  const branchIdByKey = new Map();
  for (const batch of chunks([...branchesByKey.values()])) {
    const { data, error } = await supabase.from("retailer_branches")
      .upsert(batch.map(({ key, ...branch }) => branch), { onConflict: "retailer_id,branch_slug" })
      .select("id,retailer_id,branch_slug");
    if (error) throw new Error(`Retailer branch upsert failed: ${error.message}. Apply 20261012_market_branches.sql first.`);
    for (const branch of data ?? []) branchIdByKey.set(`${branch.retailer_id}:${branch.branch_slug}`, branch.id);
  }
  const observations = rows.map(({ __line, ...row }) => {
    const retailer = retailerBySlug.get(row.retailer_slug);
    const product = productBySku.get(row.sku);
    if (!retailer) throw new Error(`price_observations.csv, row ${__line}: unknown retailer_slug ${row.retailer_slug}; valid slugs are naivas, quickmart, carrefour, chandarana, cleanshelf.`);
    if (!product) throw new Error(`price_observations.csv, row ${__line}: SKU ${row.sku} does not exist; add it to products.csv and import that file first.`);
    if (row.pack_size && product.pack_size && row.pack_size !== product.pack_size) throw new Error(`price_observations.csv, row ${__line}: pack_size does not match SKU ${row.sku} (${product.pack_size}).`);
    const branch_id = row.branch_slug ? branchIdByKey.get(`${retailer.id}:${row.branch_slug}`) : null;
    if (row.branch_slug && !branch_id) throw new Error(`price_observations.csv, row ${__line}: could not resolve branch ${row.branch}.`);
    return { product_id: product.id, retailer_id: retailer.id, branch_id, price_kes: row.price_kes, pack_size: row.pack_size || product.pack_size, source_type: row.source_type, source_url: row.source_url, observed_at: row.observed_at, verified: row.verified, import_key: row.import_key, branch: row.branch || null, region: row.region };
  });
  const unique = new Map(observations.map(item => [item.import_key, item]));
  for (const batch of chunks([...unique.values()])) {
    const { error } = await supabase.from("price_observations").upsert(batch, { onConflict: "import_key" });
    if (error) throw new Error(`Price observation upsert failed: ${error.message}`);
  }
  console.log(`Upserted ${branchesByKey.size} retailer branches and ${unique.size} distinct price observations.`);
}

if (matatusPath) {
  const source = await readCsv(matatusPath);
  const byKey = new Map();
  for (const row of source) {
    const display_name = required(row, "display_name", "nganya_matatus.csv");
    const route_code = required(row, "route_code", "nganya_matatus.csv");
    const active = row.active === "" ? true : row.active.toLowerCase() === "true";
    if (row.active && !["true", "false"].includes(row.active.toLowerCase())) throw new Error(`nganya_matatus.csv, row ${row.__line}: active must be true or false.`);
    const item = { display_name, sacco: row.sacco || null, route_code, route_label: row.route_label || null, image_url: row.image_url || null, active };
    const import_key = createHash("sha256").update([display_name, item.sacco ?? "", route_code, item.route_label ?? "", item.image_url ?? ""].join("\u001f")).digest("hex");
    byKey.set(import_key, { ...item, import_key });
  }
  const items = [...byKey.values()];
  for (const batch of chunks(items)) {
    const { error } = await supabase.from("nganya_matatus").upsert(batch, { onConflict: "import_key" });
    if (error) throw new Error(`Nganya matatu upsert failed: ${error.message}`);
  }
  console.log(`Upserted ${items.length} distinct curated Nganya records.`);
}
