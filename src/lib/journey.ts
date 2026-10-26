// Journey planning engine - uses real GTFS data with road-mapped polylines
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { haversineKm, etaMinutes, AVG_MATATU_SPEED_KMH } from "@/data/ma3_core";

type StopTuple = [string, number, number]; // [name, lat, lon]

export interface StopMatch {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface JourneyLeg {
  type: "matatu" | "walk";
  routeId?: string;
  routeShortName?: string;
  routeColor?: string;
  fromStop: StopMatch;
  toStop: StopMatch;
  distanceKm: number;
  etaMin: number;
  fareKes: number;
}

export interface JourneyOption {
  legs: JourneyLeg[];
  totalEtaMin: number;
  totalDistanceKm: number;
  transfers: number;
  fareEstimate: number;
  isFastest?: boolean;
  isCheapest?: boolean;
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
    const rideMin = etaMinutes(dist);
    options.push({
      legs: [{
        type: "matatu", routeId, routeShortName: route.sn, routeColor: route.c,
        fromStop: from, toStop: to,
        distanceKm: dist, etaMin: rideMin, fareKes: fareForDist(dist),
      }],
      totalEtaMin: rideMin,
      totalDistanceKm: dist,
      transfers: 0,
      fareEstimate: fareForDist(dist),
    });
  });

  // Explore downstream transfer stops breadth-first; route changes are limited
  // to four so results stay useful without proposing circular journeys.
  type State = { stopId: string; legs: JourneyLeg[]; usedRoutes: Set<string> };
  const queue: State[] = fromRoutes.map(routeId => ({ stopId: fromStopId, legs: [], usedRoutes: new Set([routeId]) }));
  const seen = new Set<string>(options.map(option => option.legs.map(leg => `${leg.routeId}:${leg.fromStop.id}:${leg.toStop.id}`).join("|")));
  let expanded = 0;
  for (let cursor = 0; cursor < queue.length && expanded < 12000 && options.length < 80; cursor++) {
    const state = queue[cursor];
    const usedRoutes = [...state.usedRoutes];
    const lastRoute = usedRoutes[usedRoutes.length - 1];
    if (!lastRoute) continue;
    const stops = routeStops[lastRoute];
    const fromIndex = stops?.indexOf(state.stopId) ?? -1;
    if (!stops || fromIndex < 0) continue;
    for (let index = fromIndex + 1; index < stops.length; index++) {
      const nextStopId = stops[index];
      const nextStop = getStop(nextStopId);
      if (!nextStop) continue;
      const distance = segmentDist(lastRoute, fromIndex, index);
      const route = routesById.get(lastRoute);
      if (!route) continue;
      const leg: JourneyLeg = { type: "matatu", routeId: lastRoute, routeShortName: route.sn, routeColor: route.c,
        fromStop: state.legs.length ? state.legs[state.legs.length - 1].toStop : from, toStop: nextStop,
        distanceKm: distance, etaMin: etaMinutes(distance), fareKes: fareForDist(distance) };
      const legs = [...state.legs, leg];
      if (nextStopId === toStopId) {
        const signature = legs.map(item => `${item.routeId}:${item.fromStop.id}:${item.toStop.id}`).join("|");
        if (!seen.has(signature)) {
          seen.add(signature);
          options.push({ legs, totalEtaMin: legs.reduce((sum, item) => sum + item.etaMin, 0),
            totalDistanceKm: legs.reduce((sum, item) => sum + item.distanceKm, 0),
            transfers: legs.length - 1, fareEstimate: legs.reduce((sum, item) => sum + item.fareKes, 0) });
        }
        break;
      }
      if (state.usedRoutes.size >= 5) continue;
      for (const nextRouteId of stopRoutes[nextStopId] ?? []) {
        if (state.usedRoutes.has(nextRouteId)) continue;
        expanded++;
        const transferKey = `${nextStopId}|${nextRouteId}|${[...state.usedRoutes].sort().join(",")}`;
        if (seen.has(transferKey)) continue;
        seen.add(transferKey);
        queue.push({ stopId: nextStopId, legs, usedRoutes: new Set([...state.usedRoutes, nextRouteId]) });
      }
    }
  }

  // ── 3. Walking fallback if very close ──
  const directDist = haversineKm(from.lat, from.lon, to.lat, to.lon);
  if (directDist <= 0.8 && options.length === 0) {
    const walkMin = Math.round((directDist / 4.8) * 60);
    options.push({
      legs: [{ type: "walk", fromStop: from, toStop: to, distanceKm: directDist, etaMin: walkMin, fareKes: 0 }],
      totalEtaMin: walkMin,
      totalDistanceKm: directDist,
      transfers: 0,
      fareEstimate: 0,
    });
  }

  // These are distance/speed estimates from an archived route snapshot, not service times.
  // ── Sort: shorter estimate first, then by rough fare band ──
  options.sort((a, b) => a.totalEtaMin !== b.totalEtaMin ? a.totalEtaMin - b.totalEtaMin : a.fareEstimate - b.fareEstimate);

  // ── Tag fastest & cheapest ──
  if (options.length > 0) options[0].isFastest = true;
  const cheapest = [...options].sort((a, b) => a.fareEstimate - b.fareEstimate)[0];
  if (cheapest) cheapest.isCheapest = true;

  return options.slice(0, 4);
}

export { haversineKm, etaMinutes, AVG_MATATU_SPEED_KMH };
