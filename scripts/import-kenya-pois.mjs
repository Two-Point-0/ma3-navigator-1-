import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const input = process.argv[2];
const sourceSnapshot = process.argv[3] || "2026-09-06";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!input) throw new Error('Usage: node scripts/import-kenya-pois.mjs "C:\\path\\to\\points_of_interest.geojson" [YYYY-MM-DD snapshot-date]');
if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceSnapshot) || new Date(`${sourceSnapshot}T00:00:00Z`).toISOString().slice(0, 10) !== sourceSnapshot) {
  throw new Error("Snapshot date must be a valid YYYY-MM-DD date from the source archive (default: 2026-09-06).");
}
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this terminal only. Never place the service key in .env.local or frontend code.");

const parsed = JSON.parse(await readFile(input, "utf8"));
if (!Array.isArray(parsed.features)) throw new Error("Expected a GeoJSON FeatureCollection with a features array.");
const field = (properties, names) => {
  for (const name of names) {
    const value = properties[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return null;
};
function mapCategory(properties) {
  const raw = (field(properties, ["category", "amenity", "shop", "tourism", "leisure", "healthcare", "office", "craft", "historic", "man_made"]) || "other").toLowerCase();
  if (/restaurant|cafe|fast_food|food|bar|pub|marketplace|bakery/.test(raw)) return "food";
  if (properties.shop || /shop|supermarket|convenience|clothes|mall/.test(raw)) return "shop";
  if (/bus_station|railway|transport|taxi|ferry|airport/.test(raw)) return "transport";
  if (/school|college|university|kindergarten|library/.test(raw)) return "education";
  if (/clinic|hospital|dentist|doctors|pharmacy|health|veterinary/.test(raw)) return "health";
  if (/place_of_worship|church|mosque|temple|synagogue/.test(raw)) return "worship";
  if (/hotel|guest_house|hostel|motel|lodge|camp_site|accommodation/.test(raw)) return "stay";
  if (/tourism|attraction|museum|gallery|monument|zoo|viewpoint|theme_park/.test(raw)) return "tourism";
  if (/water|toilet|drinking_water|water_point/.test(raw)) return "water";
  if (/park|playground|sports|pitch|stadium/.test(raw)) return "culture";
  if (/government|police|fire_station|post_office|bank|atm|service/.test(raw)) return "service";
  return "other";
}
function ringCentroid(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let area2 = 0;
  let xTotal = 0;
  let yTotal = 0;
  for (let index = 0; index < ring.length - 1; index++) {
    const [x1, y1] = ring[index] || [];
    const [x2, y2] = ring[index + 1] || [];
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    const cross = x1 * y2 - x2 * y1;
    area2 += cross;
    xTotal += (x1 + x2) * cross;
    yTotal += (y1 + y2) * cross;
  }
  if (Math.abs(area2) < 1e-12) return null;
  return { coordinate: [xTotal / (3 * area2), yTotal / (3 * area2)], area: Math.abs(area2) / 2 };
}
function representativeCoordinate(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const coordinates = geometry.coordinates;
  if (geometry.type === "Point") return coordinates;
  if (geometry.type === "MultiPoint") return coordinates[0] || null;
  if (geometry.type === "LineString") return coordinates[Math.floor(coordinates.length / 2)] || null;
  if (geometry.type === "MultiLineString") {
    const longest = [...coordinates].sort((a, b) => b.length - a.length)[0];
    return longest?.[Math.floor(longest.length / 2)] || null;
  }
  if (geometry.type === "Polygon") return ringCentroid(coordinates[0])?.coordinate || coordinates[0]?.[0] || null;
  if (geometry.type === "MultiPolygon") {
    const candidates = coordinates.map(polygon => ringCentroid(polygon?.[0])).filter(Boolean).sort((a, b) => b.area - a.area);
    return candidates[0]?.coordinate || null;
  }
  return null;
}

const pois = [];
const geometryCounts = {};
let skipped = 0;
for (const feature of parsed.features) {
  const geometryType = feature?.geometry?.type || "missing";
  geometryCounts[geometryType] = (geometryCounts[geometryType] || 0) + 1;
  const coordinate = representativeCoordinate(feature?.geometry);
  if (!Array.isArray(coordinate) || coordinate.length < 2) { skipped++; continue; }
  const [longitude, latitude] = coordinate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { skipped++; continue; }
  const properties = feature.properties || {};
  const category = mapCategory(properties);
  const subtype = field(properties, ["amenity", "shop", "tourism", "man_made", "leisure", "healthcare", "office", "craft", "historic"]);
  const name = field(properties, ["name", "name_en", "name_latin", "name_sw", "official_name", "operator"])
    || `Unlabelled ${subtype || category} place`;
  const sourceId = field(properties, ["osm_id", "@id", "id"]) || String(feature.id || "");
  const osm_id = sourceId || `hotosm-${createHash("sha256").update(`${latitude},${longitude}|${name}`).digest("hex").slice(0, 24)}`;
  pois.push({
    osm_id,
    name,
    category,
    subtype,
    latitude,
    longitude,
    county: field(properties, ["county", "adm1_name", "addr:county", "is_in:county"]),
    locality: field(properties, ["locality", "addr_city", "city", "town", "village", "suburb", "addr:suburb", "adm2_name", "adm3_name"]),
    opening_hours: field(properties, ["opening_hours"]),
    source_snapshot: sourceSnapshot,
  });
}
if (!pois.length) throw new Error("No usable GeoJSON features were found; inspect the archive's geometry types.");
const endpoint = `${url.replace(/\/$/, "")}/rest/v1/explore_pois?on_conflict=osm_id`;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" };
for (let index = 0; index < pois.length; index += 500) {
  const batch = pois.slice(index, index + 500);
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(batch) });
  if (!response.ok) throw new Error(`Import failed at row ${index + 1}: HTTP ${response.status} ${await response.text()}`);
  console.log(`Imported ${Math.min(index + batch.length, pois.length)} / ${pois.length} map anchors`);
}
console.log(`Complete: ${pois.length} POI map anchors upserted from the ${sourceSnapshot} snapshot; ${skipped} features skipped.`);
console.log(`Source geometry inventory: ${JSON.stringify(geometryCounts)}. Polygon and line features use approximate representative map points; the app does not render their full shapes.`);
