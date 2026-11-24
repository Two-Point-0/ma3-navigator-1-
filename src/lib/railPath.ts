import OSMRailways from "@/data/nairobi_railways_osm.json";
import { haversineKm } from "@/lib/journey";

type Pt = [number, number]; // [lat, lon]
interface Graph { ids: string[]; pts: Pt[]; adj: { to: number; km: number }[][]; cell: Map<string, number[]> }

const CELL = 0.01; // about 1.1 km grid for fast nearest-node lookups
const cellKey = (lat: number, lon: number) => `${Math.floor(lat / CELL)},${Math.floor(lon / CELL)}`;
let graph: Graph | null = null;

function build(): Graph {
  const index = new Map<string, number>();
  const pts: Pt[] = [];
  const adj: { to: number; km: number }[][] = [];
  const node = (lon: number, lat: number) => {
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`;
    let i = index.get(key);
    if (i === undefined) { i = pts.length; index.set(key, i); pts.push([lat, lon]); adj.push([]); }
    return i;
  };
  const link = (a: number, b: number) => {
    if (a === b) return;
    const km = haversineKm(pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
    adj[a].push({ to: b, km }); adj[b].push({ to: a, km });
  };
  for (const feature of (OSMRailways as any).features as any[]) {
    if (feature.properties?.railway !== "rail") continue;
    const g = feature.geometry;
    const lines: number[][][] = g?.type === "LineString" ? [g.coordinates] : g?.type === "MultiLineString" ? g.coordinates : [];
    for (const line of lines) for (let i = 1; i < line.length; i++) link(node(line[i - 1][0], line[i - 1][1]), node(line[i][0], line[i][1]));
  }
  const cell = new Map<string, number[]>();
  pts.forEach(([lat, lon], i) => { const k = cellKey(lat, lon); (cell.get(k) ?? cell.set(k, []).get(k)!).push(i); });

  // The map data has small gaps where one track piece nearly touches another (for example near the SGR terminus).
  // Join separate pieces whose ends are within 150 m, so a train path can cross from one piece to the next.
  const parent = pts.map((_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  adj.forEach((list, a) => list.forEach(({ to }) => { parent[find(a)] = find(to); }));
  const best = new Map<string, { a: number; b: number; km: number }>();
  pts.forEach(([lat, lon], a) => {
    const cy = Math.floor(lat / CELL), cx = Math.floor(lon / CELL);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const b of cell.get(`${cy + dy},${cx + dx}`) ?? []) {
      if (b <= a || find(a) === find(b)) continue;
      const km = haversineKm(lat, lon, pts[b][0], pts[b][1]);
      if (km > 0.15) continue;
      const pair = [find(a), find(b)].sort().join("-");
      if (!best.has(pair) || km < best.get(pair)!.km) best.set(pair, { a, b, km });
    }
  });
  best.forEach(({ a, b }) => link(a, b));
  return { ids: [], pts, adj, cell };
}

function nearestNode(g: Graph, p: Pt, maxKm: number): number {
  let bestI = -1, bestKm = maxKm;
  const cy = Math.floor(p[0] / CELL), cx = Math.floor(p[1] / CELL);
  for (let ring = 0; ring <= Math.ceil(maxKm / 1.1) + 1; ring++) {
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      for (const i of g.cell.get(`${cy + dy},${cx + dx}`) ?? []) {
        const km = haversineKm(p[0], p[1], g.pts[i][0], g.pts[i][1]);
        if (km < bestKm) { bestKm = km; bestI = i; }
      }
    }
    if (bestI >= 0 && ring >= 1) break;
  }
  return bestI;
}

function shortest(g: Graph, from: number, to: number): number[] {
  const dist = new Float64Array(g.pts.length).fill(Infinity);
  const prev = new Int32Array(g.pts.length).fill(-1);
  const heap: [number, number][] = [[0, from]];
  dist[from] = 0;
  const up = (i: number) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i: number) => { for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  while (heap.length) {
    const [d, u] = heap[0];
    const last = heap.pop()!; if (heap.length) { heap[0] = last; down(0); }
    if (d > dist[u]) continue;
    if (u === to) break;
    for (const { to: v, km } of g.adj[u]) if (d + km < dist[v]) { dist[v] = d + km; prev[v] = u; heap.push([d + km, v]); up(heap.length - 1); }
  }
  if (!Number.isFinite(dist[to])) return [];
  const out = [to];
  while (out[0] !== from) { const p = prev[out[0]]; if (p < 0) return []; out.unshift(p); }
  return out;
}

/** The train path between two stations, following the real rails. Falls back to a straight line only when no track connects them. */
export function railPathBetween(a: Pt, b: Pt): Pt[] {
  graph ??= build();
  const from = nearestNode(graph, a, 2), to = nearestNode(graph, b, 2);
  if (from < 0 || to < 0) return [a, b];
  const nodes = shortest(graph, from, to);
  const straight = haversineKm(a[0], a[1], b[0], b[1]);
  const path = nodes.map(i => graph!.pts[i]);
  if (path.length < 2) return [a, b];
  let km = 0; for (let i = 1; i < path.length; i++) km += haversineKm(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
  if (km > Math.max(straight * 3, straight + 6)) return [a, b]; // a huge detour means the data is wrong, do not draw it
  return [a, ...path, b];
}

/** A whole train leg, station by station, so one missing piece of track never flattens the entire line. */
export function railPathThrough(stations: { lat: number; lon: number }[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < stations.length; i++) {
    const seg = railPathBetween([stations[i - 1].lat, stations[i - 1].lon], [stations[i].lat, stations[i].lon]);
    out.push(...(out.length ? seg.slice(1) : seg));
  }
  return out;
}
