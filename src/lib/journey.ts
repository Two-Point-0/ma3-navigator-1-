// Journey planning engine - uses real GTFS data with road-mapped polylines
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { haversineKm, etaMinutes, AVG_MATATU_SPEED_KMH } from "@/data/ma3_core";
import { RAIL_LINES, RAIL_STATIONS, RAIL_MATATU_INTERCHANGES, NCR_FARE_ESTIMATE } from "@/data/ma3_rail";

type StopTuple = [string, number, number]; // [name, lat, lon]

export interface StopMatch {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface JourneyLeg {
  type: "matatu" | "walk" | "train";
  routeId?: string;
  routeShortName?: string;
  routeColor?: string;
  fromStop: StopMatch;
  toStop: StopMatch;
  distanceKm: number;
  etaMin: number;
  fareKes: number;
  isTrainLeg?: boolean;
}

export interface JourneyOption {
  legs: JourneyLeg[];
  totalEtaMin: number;
  totalDistanceKm: number;
  transfers: number;
  fareEstimate: number;
  isFastest?: boolean;
  isCheapest?: boolean;
  usesRail?: boolean;
  matatusToBoard?: number; // how many matatus from current stop going YOUR direction
}

const stopsRaw = MA3_GTFS.stops as unknown as Record<string, StopTuple>;
const routeStops = MA3_GTFS.routeStops as Record<string, string[]>;
const stopRoutes = MA3_GTFS.stopRoutes as Record<string, string[]>;
const routesById = new Map(MA3_GTFS.routes.map(r => [r.id, r]));

export function searchStops(query: string, limit = 8): StopMatch[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: StopMatch[] = [];
  for (const [id, s] of Object.entries(stopsRaw)) {
    if ((s[0] as string).toLowerCase().includes(q)) {
      out.push({ id, name: s[0] as string, lat: s[1] as number, lon: s[2] as number });
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function getStop(id: string): StopMatch | null {
  const s = stopsRaw[id];
  if (!s) return null;
  return { id, name: s[0] as string, lat: s[1] as number, lon: s[2] as number };
}

function fareForDist(km: number): number {
  if (km < 3) return 30;
  if (km < 6) return 50;
  if (km < 12) return 70;
  if (km < 20) return 100;
  return 130;
}

function segmentDist(routeId: string, fromIdx: number, toIdx: number): number {
  const stops = routeStops[routeId];
  if (!stops) return 0;
  let dist = 0;
  const a = Math.min(fromIdx, toIdx);
  const b = Math.max(fromIdx, toIdx);
  for (let i = a; i < b; i++) {
    const sa = getStop(stops[i]);
    const sb = getStop(stops[i + 1]);
    if (sa && sb) dist += haversineKm(sa.lat, sa.lon, sb.lat, sb.lon);
  }
  return dist;
}

// Check if a route goes FROM stop A TOWARD stop B (correct direction)
// Returns true if stop A comes before stop B on the route
function isCorrectDirection(routeId: string, fromStopId: string, toStopId: string): boolean {
  const stops = routeStops[routeId];
  if (!stops) return false;
  const fIdx = stops.indexOf(fromStopId);
  const tIdx = stops.indexOf(toStopId);
  return fIdx !== -1 && tIdx !== -1 && fIdx < tIdx;
}

// Count matatus on a route approaching a stop going toward destination
export function countMatatusApproaching(routeId: string, boardingStopId: string): number {
  // In real app this would query live vehicle positions
  // Mock: random 1-4 based on route + stop hash
  const hash = (routeId + boardingStopId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return 1 + (hash % 4);
}

// Estimate time until next matatu arrives (based on headway simulation)
export function nextMatatuArrivalMin(routeId: string, boardingStopId: string): number {
  const hash = (routeId + boardingStopId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return 2 + (hash % 12); // 2-14 min
}

export function planJourney(fromStopId: string, toStopId: string): JourneyOption[] {
  const from = getStop(fromStopId);
  const to = getStop(toStopId);
  if (!from || !to) return [];

  const options: JourneyOption[] = [];
  const fromRoutes = stopRoutes[fromStopId] || [];
  const toRoutes = stopRoutes[toStopId] || [];

  // ── 1. Direct matatu routes (CORRECT direction only) ──
  const directRoutes = fromRoutes.filter(r =>
    toRoutes.includes(r) && isCorrectDirection(r, fromStopId, toStopId)
  );

  directRoutes.slice(0, 3).forEach(routeId => {
    const stops = routeStops[routeId];
    if (!stops) return;
    const fIdx = stops.indexOf(fromStopId);
    const tIdx = stops.indexOf(toStopId);
    if (fIdx === -1 || tIdx === -1 || fIdx >= tIdx) return;
    const dist = segmentDist(routeId, fIdx, tIdx);
    const route = routesById.get(routeId)!;
    const waitMin = nextMatatuArrivalMin(routeId, fromStopId);
    const rideMin = etaMinutes(dist);
    options.push({
      legs: [{
        type: "matatu", routeId, routeShortName: route.sn, routeColor: route.c,
        fromStop: from, toStop: to,
        distanceKm: dist, etaMin: rideMin, fareKes: fareForDist(dist),
      }],
      totalEtaMin: waitMin + rideMin,
      totalDistanceKm: dist,
      transfers: 0,
      fareEstimate: fareForDist(dist),
      matatusToBoard: countMatatusApproaching(routeId, fromStopId),
    });
  });

  // ── 2. 1-transfer matatu options ──
  if (options.length < 2) {
    outer:
    for (const r1 of fromRoutes.slice(0, 14)) {
      const s1 = routeStops[r1]; if (!s1) continue;
      const fIdx1 = s1.indexOf(fromStopId); if (fIdx1 === -1) continue;
      for (const r2 of toRoutes.slice(0, 14)) {
        if (r1 === r2) continue;
        const s2 = routeStops[r2]; if (!s2) continue;
        const tIdx2 = s2.indexOf(toStopId); if (tIdx2 === -1) continue;
        // find shared stop that is AFTER fromStop on r1 AND BEFORE toStop on r2
        const shared = s1.slice(fIdx1 + 1).find(sid =>
          s2.includes(sid) && sid !== fromStopId && sid !== toStopId &&
          s2.indexOf(sid) < tIdx2
        );
        if (!shared) continue;
        const sharedStop = getStop(shared); if (!sharedStop) continue;
        const tIdx1 = s1.indexOf(shared);
        const fIdx2 = s2.indexOf(shared);
        if (tIdx1 <= fIdx1 || fIdx2 >= tIdx2) continue;
        const dist1 = segmentDist(r1, fIdx1, tIdx1);
        const dist2 = segmentDist(r2, fIdx2, tIdx2);
        const route1 = routesById.get(r1)!, route2 = routesById.get(r2)!;
        const wait1 = nextMatatuArrivalMin(r1, fromStopId);
        const wait2 = nextMatatuArrivalMin(r2, shared);
        options.push({
          legs: [
            { type: "matatu", routeId: r1, routeShortName: route1.sn, routeColor: route1.c, fromStop: from, toStop: sharedStop, distanceKm: dist1, etaMin: etaMinutes(dist1), fareKes: fareForDist(dist1) },
            { type: "matatu", routeId: r2, routeShortName: route2.sn, routeColor: route2.c, fromStop: sharedStop, toStop: to, distanceKm: dist2, etaMin: etaMinutes(dist2), fareKes: fareForDist(dist2) },
          ],
          totalEtaMin: wait1 + etaMinutes(dist1) + wait2 + etaMinutes(dist2),
          totalDistanceKm: dist1 + dist2,
          transfers: 1,
          fareEstimate: fareForDist(dist1) + fareForDist(dist2),
          matatusToBoard: countMatatusApproaching(r1, fromStopId),
        });
        if (options.length >= 4) break outer;
      }
    }
  }

  // ── 3. Walking fallback if very close ──
  const directDist = haversineKm(from.lat, from.lon, to.lat, to.lon);
  if (directDist < 2.5 && options.length === 0) {
    const walkMin = Math.round((directDist / 4.8) * 60);
    options.push({
      legs: [{ type: "walk", fromStop: from, toStop: to, distanceKm: directDist, etaMin: walkMin, fareKes: 0 }],
      totalEtaMin: walkMin,
      totalDistanceKm: directDist,
      transfers: 0,
      fareEstimate: 0,
    });
  }

  // ── 3. Train + matatu combined option (via known rail/matatu interchanges) ──
  for (const interchange of RAIL_MATATU_INTERCHANGES) {
    const stationStop = getStop(interchange.matatuStopId);
    if (!stationStop) continue;
    const distToInterchange = haversineKm(from.lat, from.lon, stationStop.lat, stationStop.lon);
    // Only worth suggesting if the interchange is reasonably close to the start, or IS the start
    const startsAtInterchange = fromStopId === interchange.matatuStopId || distToInterchange < 1.5;
    if (!startsAtInterchange) continue;

    for (const line of RAIL_LINES) {
      const stationOrigin = RAIL_STATIONS[line.stations[0]];
      const stationTerm = RAIL_STATIONS[line.stations[line.stations.length - 1]];
      // does this rail line's far terminus get meaningfully closer to destination?
      const distTermToDest = haversineKm(stationTerm.lat, stationTerm.lon, to.lat, to.lon);
      const distOriginToDest = haversineKm(stationOrigin.lat, stationOrigin.lon, to.lat, to.lon);
      if (distTermToDest >= distOriginToDest) continue; // train doesn't help get closer
      if (distTermToDest > 2.5) continue; // still too far from destination after the train ride

      const railDist = haversineKm(stationOrigin.lat, stationOrigin.lon, stationTerm.lat, stationTerm.lon);
      const railMin = etaMinutes(railDist, line.avgSpeedKmh);
      const walkDist = distTermToDest;
      const walkMin = Math.round((walkDist / 4.8) * 60);

      options.push({
        legs: [
          { type: "walk", fromStop: from, toStop: stationStop, distanceKm: distToInterchange, etaMin: Math.round((distToInterchange / 4.8) * 60), fareKes: 0 },
          { type: "train", fromStop: { id: stationOrigin.id, name: stationOrigin.name, lat: stationOrigin.lat, lon: stationOrigin.lon }, toStop: { id: stationTerm.id, name: stationTerm.name, lat: stationTerm.lat, lon: stationTerm.lon }, distanceKm: railDist, etaMin: railMin, fareKes: NCR_FARE_ESTIMATE[line.id] ?? 80, isTrainLeg: true },
          { type: "walk", fromStop: { id: stationTerm.id, name: stationTerm.name, lat: stationTerm.lat, lon: stationTerm.lon }, toStop: to, distanceKm: walkDist, etaMin: walkMin, fareKes: 0 },
        ],
        totalEtaMin: Math.round((distToInterchange / 4.8) * 60) + 5 /* wait for train */ + railMin + walkMin,
        totalDistanceKm: distToInterchange + railDist + walkDist,
        transfers: 1,
        fareEstimate: NCR_FARE_ESTIMATE[line.id] ?? 80,
        usesRail: true,
      });
    }
  }

  // ── Sort: fastest first, then by fare ──
  options.sort((a, b) => a.totalEtaMin !== b.totalEtaMin ? a.totalEtaMin - b.totalEtaMin : a.fareEstimate - b.fareEstimate);

  // ── Tag fastest & cheapest ──
  if (options.length > 0) options[0].isFastest = true;
  const cheapest = [...options].sort((a, b) => a.fareEstimate - b.fareEstimate)[0];
  if (cheapest) cheapest.isCheapest = true;

  return options.slice(0, 4);
}

export { haversineKm, etaMinutes, AVG_MATATU_SPEED_KMH };
