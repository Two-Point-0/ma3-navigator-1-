// One search for every "From" and "To" box: stops, rail stations, well-known places, pinned spots and "my location".
// In Kenya every pick-up point is simply called a "stop", so that is the word we show.
import { searchStops } from "@/lib/journey";
import { LANDMARKS } from "@/data/landmarks";
import { AREAS } from "@/data/areas";
import { BUNDLED_NETWORK } from "@/lib/rail";
import { SEED_PINS } from "@/data/ma3_core";

export type PlaceKind = "stop" | "rail" | "landmark" | "pin" | "me";
export interface Place { id: string; kind: PlaceKind; name: string; lat: number; lon: number; stopId?: string; stationId?: string }

export const KIND_LABEL: Record<PlaceKind, string> = { stop: "Stop", rail: "Train station", landmark: "Place", pin: "Pinned spot", me: "My location" };

const norm = (text: string) => text.toLowerCase().replace(/['’`.]/g, "").replace(/\s+/g, " ").trim();
/** True when two words differ by at most one letter (one typo, one missing or one extra letter). */
function closeWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

export function searchPlaces(query: string, limit = 9): Place[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const words = q.split(" ").filter(Boolean);
  // every typed word must appear in the name (as a part of a word) or be one letter away from a word in it
  const matches = (text: string) => { const n = norm(text); const parts = n.split(" "); return words.every(word => n.includes(word) || parts.some(part => closeWord(word, part))); };
  const rank = (name: string) => { const n = norm(name); return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3; };
  const places: Place[] = [];
  for (const landmark of LANDMARKS) if (matches(landmark.name)) places.push({ id: landmark.id, kind: "landmark", name: landmark.name, lat: landmark.lat, lon: landmark.lon });
  for (const area of AREAS) if (matches(area.name)) places.push({ id: area.id, kind: "landmark", name: area.name, lat: area.lat, lon: area.lon });
  for (const pin of SEED_PINS) if (matches(pin.name)) places.push({ id: `pin-${pin.id}`, kind: "landmark", name: pin.name, lat: pin.lat, lon: pin.lon });
  for (const station of BUNDLED_NETWORK.stations) if (matches(station.name)) places.push({ id: `rail-${station.id}`, kind: "rail", name: `${station.name} station`, lat: station.lat, lon: station.lon, stationId: station.id });
  places.sort((a, b) => rank(a.name) - rank(b.name));
  const seen = new Set(places.map(place => norm(place.name)));
  for (const stop of searchStops(query, 30)) {
    const key = norm(stop.name);
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({ id: `stop-${stop.id}`, kind: "stop", name: stop.name, lat: stop.lat, lon: stop.lon, stopId: stop.id });
  }
  return places.slice(0, limit);
}

/** Free map search (OpenStreetMap data through Photon) for any place not in our own lists, e.g. a small estate or a building. */
export async function searchMapPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const text = query.trim();
  if (text.length < 3) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=6&lang=en&lat=-1.2921&lon=36.8219&bbox=36.45,-1.65,37.25,-0.85`;
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return [];
    const json = await response.json();
    return (json.features ?? []).flatMap((feature: any, index: number): Place[] => {
      const [lon, lat] = feature.geometry?.coordinates ?? [];
      const p = feature.properties ?? {};
      if (typeof lat !== "number" || typeof lon !== "number" || !p.name) return [];
      const where = p.district || p.locality || p.city || p.county;
      return [{ id: `map-${p.osm_id ?? index}-${lat.toFixed(4)}`, kind: "landmark", name: where && where !== p.name ? `${p.name}, ${where}` : p.name, lat, lon }];
    });
  } catch { return []; }
}

export const stopToPlace = (stop: { id: string; name: string; lat: number; lon: number }): Place => ({ id: `stop-${stop.id}`, kind: "stop", name: stop.name, lat: stop.lat, lon: stop.lon, stopId: stop.id });
