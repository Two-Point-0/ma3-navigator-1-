// Journey planning engine - uses real GTFS data with road-mapped polylines
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { haversineKm, etaMinutes, AVG_MATATU_SPEED_KMH, AVG_WALK_SPEED_KMH } from "@/data/ma3_core";

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

// The archived data often lists ONE real bus stop under several ids (one per route group). Treat same-name stops within
// 350 m as the same interchange so riders can change buses there.
const sameStop = new Map<string, string[]>();
(() => {
  const byName = new Map<string, string[]>();
  for (const [id, s] of Object.entries(stopsRaw)) {
    const key = String(s[0]).toLowerCase().replace(/\s+/g, " ").trim();
    const list = byName.get(key); if (list) list.push(id); else byName.set(key, [id]);
  }
  for (const ids of byName.values()) {
    if (ids.length < 2) continue;
    for (const a of ids) {
      const sa = stopsRaw[a];
      const near = ids.filter(b => b !== a && haversineKm(sa[1] as number, sa[2] as number, stopsRaw[b][1] as number, stopsRaw[b][2] as number) <= 0.35);
      if (near.length) sameStop.set(a, near);
    }
  }
})();

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
// The archived data stores each route in ONE direction only, but a matatu runs the same road both ways,
// so a route can be ridden from either stop toward the other.
function isCorrectDirection(routeId: string, fromStopId: string, toStopId: string): boolean {
  const stops = routeStops[routeId];
  if (!stops) return false;
  const fIdx = stops.indexOf(fromStopId);
  const tIdx = stops.indexOf(toStopId);
  return fIdx !== -1 && tIdx !== -1 && fIdx !== tIdx;
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
    if (fIdx === -1 || tIdx === -1 || fIdx === tIdx) return;
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
  const fromHubs = [fromStopId, ...(sameStop.get(fromStopId) ?? [])];
  const toHubs = new Set<string>([toStopId, ...(sameStop.get(toStopId) ?? [])]);
  const queue: State[] = fromHubs.flatMap(hub => (stopRoutes[hub] ?? []).map(routeId => ({ stopId: hub, legs: [], usedRoutes: new Set([routeId]) })));
  const seen = new Set<string>(options.map(option => option.legs.map(leg => `${leg.routeId}:${leg.fromStop.id}:${leg.toStop.id}`).join("|")));
  for (const first of queue) for (const routeId of first.usedRoutes) seen.add(`board|${first.stopId}|${routeId}`);
  let expanded = 0;
  for (let cursor = 0; cursor < queue.length && expanded < 12000 && options.length < 80; cursor++) {
    const state = queue[cursor];
    const usedRoutes = [...state.usedRoutes];
    const lastRoute = usedRoutes[usedRoutes.length - 1];
    if (!lastRoute) continue;
    const stops = routeStops[lastRoute];
    const fromIndex = stops?.indexOf(state.stopId) ?? -1;
    if (!stops || fromIndex < 0) continue;
    for (const direction of [1, -1]) for (let index = fromIndex + direction; index >= 0 && index < stops.length; index += direction) {
      const nextStopId = stops[index];
      const nextStop = getStop(nextStopId);
      if (!nextStop) continue;
      const distance = segmentDist(lastRoute, fromIndex, index);
      const route = routesById.get(lastRoute);
      if (!route) continue;
      const leg: JourneyLeg = { type: "matatu", routeId: lastRoute, routeShortName: route.sn, routeColor: route.c,
        fromStop: getStop(state.stopId) ?? from, toStop: nextStop,
        distanceKm: distance, etaMin: etaMinutes(distance), fareKes: fareForDist(distance) };
      const legs = [...state.legs, leg];
      if (toHubs.has(nextStopId)) {
        const signature = legs.map(item => `${item.routeId}:${item.fromStop.id}:${item.toStop.id}`).join("|");
        if (!seen.has(signature)) {
          seen.add(signature);
          options.push({ legs, totalEtaMin: legs.reduce((sum, item) => sum + item.etaMin, 0),
            totalDistanceKm: legs.reduce((sum, item) => sum + item.distanceKm, 0),
            transfers: legs.length - 1, fareEstimate: legs.reduce((sum, item) => sum + item.fareKes, 0) });
        }
        break;
      }
      if (state.usedRoutes.size >= 4) continue;
      for (const hub of [nextStopId, ...(sameStop.get(nextStopId) ?? [])]) {
        for (const nextRouteId of stopRoutes[hub] ?? []) {
          if (state.usedRoutes.has(nextRouteId)) continue;
          expanded++;
          const transferKey = `board|${hub}|${nextRouteId}`; // board each route at each stop only once: the first (fewest changes) way there wins
          if (seen.has(transferKey)) continue;
          seen.add(transferKey);
          queue.push({ stopId: hub, legs, usedRoutes: new Set([...state.usedRoutes, nextRouteId]) });
        }
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




// ── Walking changes: after getting off, walk a few minutes to a DIFFERENT stop (e.g. Koja → the next terminus) ──
const WALK_CHANGE_KM = 1.5; // terminus to terminus in town can be a 15-20 minute walk
let stopGrid: Map<string, string[]> | null = null;
const cellKey = (lat: number, lon: number) => `${Math.floor(lat / 0.007)}:${Math.floor(lon / 0.007)}`;
const walkNeighbourCache = new Map<string, { hub: string; routeId: string }[]>();
/** For every route that passes within a short walk of this stop: the nearest stop on that route to board at. */
function walkNeighbours(stopId: string): { hub: string; routeId: string }[] {
  const cached = walkNeighbourCache.get(stopId);
  if (cached) return cached;
  if (!stopGrid) {
    stopGrid = new Map();
    for (const [id, tuple] of Object.entries(stopsRaw)) {
      if (!(stopRoutes[id] ?? []).length) continue;
      const key = cellKey(tuple[1], tuple[2]);
      const list = stopGrid.get(key) ?? []; list.push(id); stopGrid.set(key, list);
    }
  }
  const here = stopsRaw[stopId];
  const out: { hub: string; routeId: string }[] = [];
  if (here) {
    const equivalent = new Set([stopId, ...(sameStop.get(stopId) ?? [])]);
    const best = new Map<string, { hub: string; km: number }>();
    const [la, lo] = [Math.floor(here[1] / 0.007), Math.floor(here[2] / 0.007)];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (const id of stopGrid.get(`${la + dy}:${lo + dx}`) ?? []) {
      if (equivalent.has(id)) continue;
      const t = stopsRaw[id];
      const km = haversineKm(here[1], here[2], t[1], t[2]);
      if (km > WALK_CHANGE_KM) continue;
      for (const routeId of stopRoutes[id] ?? []) {
        const prev = best.get(routeId);
        if (!prev || km < prev.km) best.set(routeId, { hub: id, km });
      }
    }
    for (const [routeId, item] of best) out.push({ hub: item.hub, routeId });
  }
  walkNeighbourCache.set(stopId, out);
  return out;
}

/** Breadth-first search from ANY of several boarding stops to ANY of several alighting stops (fewest changes first). */
function searchJourneys(fromIds: string[], toIds: string[], maxOptions = 60, maxRides = 3): JourneyOption[] {
  const options: JourneyOption[] = [];
  type State = { stopId: string; legs: JourneyLeg[]; usedRoutes: Set<string> };
  const toHubs = new Set<string>(toIds.flatMap(id => [id, ...(sameStop.get(id) ?? [])]));
  const queue: State[] = [];
  const seen = new Set<string>();
  for (const id of fromIds) for (const hub of [id, ...(sameStop.get(id) ?? [])]) for (const routeId of stopRoutes[hub] ?? []) {
    const key = `board|${hub}|${routeId}`;
    if (seen.has(key)) continue;
    seen.add(key); queue.push({ stopId: hub, legs: [], usedRoutes: new Set([routeId]) });
  }
  let expanded = 0;
  const deferred: State[] = []; // states that start with a walking change: tried only after every plain ride/change is exhausted
  for (let pass = 0; pass < 2; pass++) {
  if (pass === 1) { if (options.length >= 8) break; queue.length = 0; deferred.sort((a, b) => a.legs.reduce((n, l) => n + (l.type === "walk" ? l.distanceKm : 0), 0) - b.legs.reduce((n, l) => n + (l.type === "walk" ? l.distanceKm : 0), 0)); queue.push(...deferred); expanded = 0; }
  for (let cursor = 0; cursor < queue.length && expanded < 60000 && options.length < maxOptions; cursor++) {
    const state = queue[cursor];
    const lastRoute = [...state.usedRoutes].pop();
    if (!lastRoute) continue;
    const stops = routeStops[lastRoute];
    const fromIndex = stops?.indexOf(state.stopId) ?? -1;
    const route = routesById.get(lastRoute);
    const here = getStop(state.stopId);
    if (!stops || fromIndex < 0 || !route || !here) continue;
    for (const direction of [1, -1]) for (let index = fromIndex + direction; index >= 0 && index < stops.length; index += direction) {
      const nextStopId = stops[index];
      const nextStop = getStop(nextStopId);
      if (!nextStop) continue;
      const distance = segmentDist(lastRoute, fromIndex, index);
      const leg: JourneyLeg = { type: "matatu", routeId: lastRoute, routeShortName: route.sn, routeColor: route.c, fromStop: here, toStop: nextStop,
        distanceKm: distance, etaMin: etaMinutes(distance), fareKes: fareForDist(distance) };
      const legs = [...state.legs, leg];
      if (toHubs.has(nextStopId)) {
        const signature = legs.map(item => `${item.routeId}:${item.fromStop.id}:${item.toStop.id}`).join("|");
        if (!seen.has(signature)) {
          seen.add(signature);
          options.push({ legs, totalEtaMin: legs.reduce((sum, item) => sum + item.etaMin, 0), totalDistanceKm: legs.reduce((sum, item) => sum + item.distanceKm, 0),
            transfers: legs.filter(item => item.type === "matatu").length - 1, fareEstimate: legs.reduce((sum, item) => sum + item.fareKes, 0) });
        }
        break;
      }
      if (state.usedRoutes.size >= maxRides) continue;
      for (const hub of [nextStopId, ...(sameStop.get(nextStopId) ?? [])]) for (const nextRouteId of stopRoutes[hub] ?? []) {
        if (state.usedRoutes.has(nextRouteId)) continue;
        expanded++;
        const key = `board|${hub}|${nextRouteId}`;
        if (seen.has(key)) continue;
        seen.add(key); queue.push({ stopId: hub, legs, usedRoutes: new Set([...state.usedRoutes, nextRouteId]) });
      }
      // Or get off here, WALK a few minutes to a different stop, and board the next matatu there (one walking change per trip).
      if (pass === 0 && !legs.some(item => item.type === "walk")) {
        for (const { hub, routeId: nextRouteId } of walkNeighbours(nextStopId)) {
          if (state.usedRoutes.has(nextRouteId)) continue;
          const key = `board|${hub}|${nextRouteId}`;
          if (seen.has(key)) continue;
          const target = getStop(hub);
          if (!target) continue;
          seen.add(key);
          deferred.push({ stopId: hub, legs: [...legs, walkLeg(nextStop, target)], usedRoutes: new Set([...state.usedRoutes, nextRouteId]) });
        }
      }
    }
  }
  }
  return options;
}

// ── Start → Stop for ANY place (a stop, a landmark, a pinned spot or "my location") ──
export interface PlacePoint { name: string; lat: number; lon: number; stopId?: string }

/** The best stops near a point: close by, and served by many routes (so riders get real choices). */
export function nearestStops(lat: number, lon: number, count = 3, maxKm = 1.5): (StopMatch & { km: number })[] {
  const all = Object.entries(stopsRaw).map(([id, s]) => ({ id, name: s[0] as string, lat: s[1] as number, lon: s[2] as number, km: haversineKm(lat, lon, s[1] as number, s[2] as number) }))
    .sort((a, b) => a.km - b.km);
  const pool: (StopMatch & { km: number })[] = [];
  const names = new Set<string>();
  for (const stop of all) {
    if (pool.length >= 30) break;
    if (pool.length > 0 && stop.km > maxKm) break;
    const key = stop.name.toLowerCase();
    if (names.has(key)) continue;
    names.add(key); pool.push(stop);
  }
  const score = (stop: StopMatch & { km: number }) => stop.km - 0.045 * Math.min(12, (stopRoutes[stop.id] ?? []).length);
  return pool.sort((a, b) => score(a) - score(b)).slice(0, count);
}

const WALK_DETOUR = 1.25; // streets are never straight lines

function walkLeg(a: { id?: string; name: string; lat: number; lon: number }, b: { id?: string; name: string; lat: number; lon: number }): JourneyLeg {
  const km = haversineKm(a.lat, a.lon, b.lat, b.lon) * WALK_DETOUR;
  return {
    type: "walk", fromStop: { id: a.id ?? `pt-${a.lat.toFixed(4)}-${a.lon.toFixed(4)}`, name: a.name, lat: a.lat, lon: a.lon },
    toStop: { id: b.id ?? `pt-${b.lat.toFixed(4)}-${b.lon.toFixed(4)}`, name: b.name, lat: b.lat, lon: b.lon },
    distanceKm: km, etaMin: Math.max(1, Math.round((km / AVG_WALK_SPEED_KMH) * 60)), fareKes: 0,
  };
}

export function walkOnly(from: PlacePoint, to: PlacePoint): JourneyOption {
  const leg = walkLeg(from, to);
  return { legs: [leg], totalEtaMin: leg.etaMin, totalDistanceKm: leg.distanceKm, transfers: 0, fareEstimate: 0 };
}

/**
 * Door to door: walk to the best nearby stop, ride (with transfers if needed), walk from the last stop.
 * Works from any two points, so riders never need to know the name of a stop.
 */
export function planDoorToDoor(from: PlacePoint, to: PlacePoint, maxStops = 3): JourneyOption[] {
  const straight = haversineKm(from.lat, from.lon, to.lat, to.lon);
  const out: JourneyOption[] = [];
  if (straight <= 1.0) out.push(walkOnly(from, to));
  const pool = (p: PlacePoint, radius: number) => {
    const near = nearestStops(p.lat, p.lon, 30, radius);
    const exact = p.stopId ? getStop(p.stopId) : null;
    const list = exact ? [{ ...exact, km: 0 }, ...near.filter(item => item.id !== exact.id)] : near;
    return list.length ? list : nearestStops(p.lat, p.lon, 1, 5);
  };
  const attempt = (radius: number, maxRides = 3) => {
    const starts = pool(from, radius);
    // Any stop near the destination is a fine place to get off, not only the busiest few.
    const exactEnd = to.stopId ? getStop(to.stopId) : null;
    const ends = Object.entries(stopsRaw).filter(([id, t]) => (stopRoutes[id] ?? []).length && haversineKm(to.lat, to.lon, t[1], t[2]) <= radius)
      .map(([id, t]) => ({ id, name: t[0] as string, lat: t[1] as number, lon: t[2] as number, km: haversineKm(to.lat, to.lon, t[1], t[2]) })).sort((a, b) => a.km - b.km).slice(0, 120);
    if (exactEnd && !ends.some(stop => stop.id === exactEnd.id)) ends.unshift({ ...exactEnd, km: 0 });
    if (!ends.length) ends.push(...pool(to, radius));
    const startKm = new Map(starts.map(stop => [stop.id, stop.km])), endKm = new Map(ends.map(stop => [stop.id, stop.km]));
    const found = searchJourneys(starts.map(stop => stop.id), ends.map(stop => stop.id), 60, maxRides);
    const bestBySequence = new Map<string, JourneyOption>();
    for (const option of found) {
      const ride = option.legs;
      const rides = ride.filter(leg => leg.type === "matatu");
      const first = walkLeg(from, ride[0].fromStop), last = walkLeg(ride[ride.length - 1].toStop, to);
      const legs: JourneyLeg[] = [];
      if (first.distanceKm > 0.06) legs.push(first);
      legs.push(...ride);
      if (last.distanceKm > 0.06) legs.push(last);
      const waiting = 4 * rides.length; // honest allowance for waiting at each boarding
      const built: JourneyOption = {
        legs, totalEtaMin: legs.reduce((sum, leg) => sum + leg.etaMin, 0) + waiting,
        totalDistanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
        transfers: option.transfers, fareEstimate: legs.reduce((sum, leg) => sum + leg.fareKes, 0),
      };
      void startKm; void endKm;
      const key = ride.map(leg => leg.routeId ?? "walk").join(">");
      const existing = bestBySequence.get(key);
      if (!existing || built.totalEtaMin < existing.totalEtaMin) bestBySequence.set(key, built);
    }
    out.push(...bestBySequence.values());
  };
  attempt(1.3);
  const hasRide = () => out.some(option => option.legs.some(leg => leg.type === "matatu"));
  if (!hasRide()) attempt(2.4);
  if (!hasRide()) attempt(2.4, 4); // long trips: allow a third change

  out.sort((a, b) => a.totalEtaMin - b.totalEtaMin || a.fareEstimate - b.fareEstimate);
  const top = out.slice(0, 4).map(option => ({ ...option, isFastest: false, isCheapest: false }));
  if (top.length) top[0].isFastest = true;
  const cheapest = [...top].sort((a, b) => a.fareEstimate - b.fareEstimate)[0];
  if (cheapest) cheapest.isCheapest = true;
  return top;
}

export { haversineKm, etaMinutes, AVG_MATATU_SPEED_KMH };
