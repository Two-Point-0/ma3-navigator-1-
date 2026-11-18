// One search for every "From" and "To" box: stops, rail stations, well-known places, pinned spots and "my location".
// In Kenya every pick-up point is simply called a "stop", so that is the word we show.
import { searchStops } from "@/lib/journey";
import { LANDMARKS } from "@/data/landmarks";
import { BUNDLED_NETWORK } from "@/lib/rail";
import { SEED_PINS } from "@/data/ma3_core";

export type PlaceKind = "stop" | "rail" | "landmark" | "pin" | "me";
export interface Place { id: string; kind: PlaceKind; name: string; lat: number; lon: number; stopId?: string; stationId?: string }

export const KIND_LABEL: Record<PlaceKind, string> = { stop: "Stop", rail: "Train station", landmark: "Place", pin: "Pinned spot", me: "My location" };

export function searchPlaces(query: string, limit = 9): Place[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const matches = (text: string) => words.every(word => text.toLowerCase().includes(word));
  const rank = (name: string) => (name.toLowerCase() === q ? 0 : name.toLowerCase().startsWith(q) ? 1 : 2);
  const places: Place[] = [];
  for (const landmark of LANDMARKS) if (matches(landmark.name)) places.push({ id: landmark.id, kind: "landmark", name: landmark.name, lat: landmark.lat, lon: landmark.lon });
  for (const pin of SEED_PINS) if (matches(pin.name)) places.push({ id: `pin-${pin.id}`, kind: "landmark", name: pin.name, lat: pin.lat, lon: pin.lon });
  for (const station of BUNDLED_NETWORK.stations) if (matches(station.name)) places.push({ id: `rail-${station.id}`, kind: "rail", name: `${station.name} station`, lat: station.lat, lon: station.lon, stationId: station.id });
  places.sort((a, b) => rank(a.name) - rank(b.name));
  const seen = new Set(places.map(place => place.name.toLowerCase()));
  for (const stop of searchStops(query, 30)) {
    const key = stop.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({ id: `stop-${stop.id}`, kind: "stop", name: stop.name, lat: stop.lat, lon: stop.lon, stopId: stop.id });
  }
  return places.slice(0, limit);
}

export const stopToPlace = (stop: { id: string; name: string; lat: number; lon: number }): Place => ({ id: `stop-${stop.id}`, kind: "stop", name: stop.name, lat: stop.lat, lon: stop.lon, stopId: stop.id });
