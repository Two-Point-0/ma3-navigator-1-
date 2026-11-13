import { haversineKm } from "@/data/ma3_core";

/** How the phone is moving. Drives the colours: green = moving, amber = slow, red = stopped. */
export type MotionState = "unknown" | "moving" | "slow" | "stopped";

export function classifyMotion(speedMs: number | null): MotionState {
  if (speedMs === null || !Number.isFinite(speedMs)) return "unknown";
  if (speedMs >= 3) return "moving";   // about 11 km/h or faster
  if (speedMs >= 0.8) return "slow";   // crawling in traffic or walking pace
  return "stopped";
}

export const MOTION_LABEL: Record<MotionState, string> = { unknown: "Finding your speed", moving: "Moving", slow: "Slow", stopped: "Stopped" };
export const MOTION_TONE: Record<MotionState, "idle" | "go" | "ready" | "stop"> = { unknown: "ready", moving: "go", slow: "ready", stopped: "stop" };

export interface RouteStop { id: string; name: string; lat: number; lon: number; alongKm: number }

export interface TripProgress {
  totalKm: number;
  travelledKm: number;
  remainingKm: number;
  offRouteKm: number;
  snapped: [number, number];
  nextStop: RouteStop | null;
  /** stops still ahead, including the one to get off at */
  stopsLeft: number;
  upcoming: RouteStop[];
  passedIds: Set<string>;
}

function cumulativeKm(route: [number, number][]) {
  const cumulative = [0];
  for (let i = 1; i < route.length; i++) cumulative.push(cumulative[i - 1] + haversineKm(route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]));
  return cumulative;
}

function nearestIndex(route: [number, number][], lat: number, lon: number) {
  let index = 0, best = Infinity;
  route.forEach(([routeLat, routeLon], i) => { const d = haversineKm(lat, lon, routeLat, routeLon); if (d < best) { best = d; index = i; } });
  return { index, distanceKm: best };
}

/**
 * Names the stops that sit along this part of the route, in travel order.
 * `candidates` are the route's stops; the board and alight stops are always first and last.
 */
export function stopsAlongRoute(route: [number, number][], candidates: { id: string; name: string; lat: number; lon: number }[], board: { id: string; name: string; lat: number; lon: number }, alight: { id: string; name: string; lat: number; lon: number }): RouteStop[] {
  if (route.length < 2) return [];
  const cumulative = cumulativeKm(route);
  const total = cumulative[cumulative.length - 1];
  const along: RouteStop[] = [];
  for (const stop of candidates) {
    if (stop.id === board.id || stop.id === alight.id) continue;
    const near = nearestIndex(route, stop.lat, stop.lon);
    if (near.distanceKm > 0.35) continue;
    if (cumulative[near.index] <= 0.05 || cumulative[near.index] >= total - 0.05) continue;
    along.push({ ...stop, alongKm: cumulative[near.index] });
  }
  along.sort((a, b) => a.alongKm - b.alongKm);
  return [{ ...board, alongKm: 0 }, ...along, { ...alight, alongKm: total }];
}

export function computeTripProgress(route: [number, number][], stops: RouteStop[], position: [number, number] | null): TripProgress | null {
  if (route.length < 2) return null;
  const cumulative = cumulativeKm(route);
  const totalKm = cumulative[cumulative.length - 1];
  const near = position ? nearestIndex(route, position[0], position[1]) : { index: 0, distanceKm: 0 };
  const travelledKm = cumulative[near.index];
  const ahead = stops.filter(stop => stop.alongKm > travelledKm + 0.03);
  return {
    totalKm, travelledKm, remainingKm: Math.max(0, totalKm - travelledKm), offRouteKm: near.distanceKm,
    snapped: route[near.index],
    nextStop: ahead[0] ?? null, stopsLeft: ahead.length, upcoming: ahead.slice(0, 4),
    passedIds: new Set(stops.filter(stop => stop.alongKm <= travelledKm + 0.03).map(stop => stop.id)),
  };
}
