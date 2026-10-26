import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "src", "data", "ma3_gtfs.ts");
const outputDir = path.resolve(process.argv[2] || path.join(repoRoot, ".work", "ma3-transit-csv"));
const sourceValidUntil = "2020-12-31";

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
function csv(headers, rows) {
  return [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const source = await readFile(sourcePath, "utf8");
const match = source.match(/^export const MA3_GTFS = (.*);\s*$/s);
if (!match) throw new Error(`Could not parse the archived snapshot at ${sourcePath}`);
const data = JSON.parse(match[1]);
for (const key of ["routes", "stops", "routeStops", "shapes"]) {
  if (!data[key]) throw new Error(`The snapshot is missing required section: ${key}`);
}

const routes = data.routes.map(route => [route.id, route.sn, route.ln, route.hs, route.c, sourceValidUntil]);
const stops = Object.entries(data.stops).map(([id, value]) => [id, value[0], value[1], value[2], sourceValidUntil]);
const routeStops = Object.entries(data.routeStops).flatMap(([routeId, stopIds]) =>
  stopIds.map((stopId, index) => [routeId, stopId, index + 1]));
const routeShapes = Object.entries(data.shapes).map(([routeId, coordinates]) => [routeId, JSON.stringify(coordinates), sourceValidUntil]);

await mkdir(outputDir, { recursive: true });
const files = [
  ["ma3_routes.csv", ["route_id", "short_name", "long_name", "headsign", "color", "source_valid_until"], routes],
  ["ma3_stops.csv", ["stop_id", "name", "latitude", "longitude", "source_valid_until"], stops],
  ["ma3_route_stops.csv", ["route_id", "stop_id", "stop_sequence"], routeStops],
  ["ma3_route_shapes.csv", ["route_id", "coordinates", "source_valid_until"], routeShapes],
];
for (const [name, headers, rows] of files) {
  await writeFile(path.join(outputDir, name), csv(headers, rows), "utf8");
  console.log(`${name}: ${rows.length} rows`);
}
console.log(`CSV files written to ${outputDir}`);
console.log("Source validity end date is retained as archived metadata, not a current service date.");
