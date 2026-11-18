// Rail planner for the Ma3 "Rail" tab. Works from any two places: it finds the nearest stations, the best
// line (with an interchange at Nairobi Central if needed) and the matatu/walk to reach the station.
// All timings and fares are prototype estimates until the real Kenya Railways data is loaded.
import { useEffect, useState } from "react";
import { haversineKm } from "@/data/ma3_core";
import {
  RAIL_LINES_BUNDLED, RAIL_STATIONS_BUNDLED, RAIL_LINE_STATIONS_BUNDLED,
  RailLineRow, RailStationRow, RailLineStationRow,
} from "@/data/railNetwork";
import { planDoorToDoor, walkOnly, PlacePoint, JourneyOption } from "@/lib/journey";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface RailNetwork { lines: RailLineRow[]; stations: RailStationRow[]; lineStations: RailLineStationRow[] }
export const BUNDLED_NETWORK: RailNetwork = { lines: RAIL_LINES_BUNDLED, stations: RAIL_STATIONS_BUNDLED, lineStations: RAIL_LINE_STATIONS_BUNDLED };

/** Uses the Supabase copy when it exists (so you can edit stations without a new release), otherwise the bundled copy. */
export function useRailNetwork(): RailNetwork {
  const [network, setNetwork] = useState<RailNetwork>(BUNDLED_NETWORK);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let alive = true;
    (async () => {
      try {
        const [lines, stations, links] = await Promise.all([
          supabase!.from("rail_lines").select("*"), supabase!.from("rail_stations").select("*"), supabase!.from("rail_line_stations").select("*"),
        ]);
        if (!alive || lines.error || stations.error || links.error) return;
        if (!lines.data?.length || !stations.data?.length || !links.data?.length) return;
        setNetwork({
          lines: lines.data.map((row: any) => ({ id: row.id, name: row.name, color: row.color, speedKmh: Number(row.speed_kmh), waitMin: Number(row.wait_min), baseFare: Number(row.base_fare), perKm: Number(row.per_km) })),
          stations: stations.data.map((row: any) => ({ id: row.id, name: row.name, lat: Number(row.lat), lon: Number(row.lon), approx: Boolean(row.approx) })),
          lineStations: links.data.map((row: any) => ({ lineId: row.line_id, seq: Number(row.seq), stationId: row.station_id })),
        });
      } catch { /* keep the bundled copy */ }
    })();
    return () => { alive = false; };
  }, []);
  return network;
}

export interface RailLeg {
  line: RailLineRow; from: RailStationRow; to: RailStationRow; stations: RailStationRow[];
  km: number; rideMin: number; waitMin: number; fare: number;
}
export interface RailPlan { legs: RailLeg[]; totalMin: number; totalKm: number; fare: number; transfers: number }
export interface RailTrip {
  board: RailStationRow; alight: RailStationRow; rail: RailPlan;
  access: JourneyOption | null; egress: JourneyOption | null;
  totalMin: number; totalFare: number;
}

const TRANSFER_EXTRA_MIN = 4;
const DWELL_MIN = 1;

const fareFor = (line: RailLineRow, km: number) => Math.max(line.baseFare, Math.round((line.baseFare + line.perKm * km) / 10) * 10);

function lineStationList(network: RailNetwork, lineId: string): RailStationRow[] {
  const byId = new Map(network.stations.map(station => [station.id, station]));
  return network.lineStations.filter(row => row.lineId === lineId).sort((a, b) => a.seq - b.seq)
    .map(row => byId.get(row.stationId)).filter((station): station is RailStationRow => Boolean(station));
}

/** Best rail trip between two stations (Dijkstra over "station + line" states, interchanges cost extra). */
export function planRail(network: RailNetwork, fromId: string, toId: string): RailPlan | null {
  if (fromId === toId) return null;
  type Node = { station: string; line: string };
  const key = (node: Node) => `${node.station}|${node.line}`;
  const lines = new Map(network.lines.map(line => [line.id, line]));
  const lists = new Map(network.lines.map(line => [line.id, lineStationList(network, line.id)]));
  const dist = new Map<string, number>(), prev = new Map<string, { node: Node; via: "ride" | "change" | "start" }>();
  const queue: { node: Node; cost: number }[] = [];
  for (const line of network.lines) {
    const list = lists.get(line.id)!;
    if (list.some(station => station.id === fromId)) { const node = { station: fromId, line: line.id }; dist.set(key(node), line.waitMin); prev.set(key(node), { node, via: "start" }); queue.push({ node, cost: line.waitMin }); }
  }
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { node, cost } = queue.shift()!;
    if (cost > (dist.get(key(node)) ?? Infinity)) continue;
    if (node.station === toId) break;
    const line = lines.get(node.line)!, list = lists.get(node.line)!;
    const index = list.findIndex(station => station.id === node.station);
    for (const step of [-1, 1]) {
      const next = list[index + step];
      if (!next) continue;
      const here = list[index];
      const minutes = (haversineKm(here.lat, here.lon, next.lat, next.lon) / line.speedKmh) * 60 + DWELL_MIN;
      const nextNode = { station: next.id, line: node.line }, nextCost = cost + minutes;
      if (nextCost < (dist.get(key(nextNode)) ?? Infinity)) { dist.set(key(nextNode), nextCost); prev.set(key(nextNode), { node, via: "ride" }); queue.push({ node: nextNode, cost: nextCost }); }
    }
    for (const other of network.lines) {
      if (other.id === node.line || !lists.get(other.id)!.some(station => station.id === node.station)) continue;
      const nextNode = { station: node.station, line: other.id }, nextCost = cost + other.waitMin + TRANSFER_EXTRA_MIN;
      if (nextCost < (dist.get(key(nextNode)) ?? Infinity)) { dist.set(key(nextNode), nextCost); prev.set(key(nextNode), { node, via: "change" }); queue.push({ node: nextNode, cost: nextCost }); }
    }
  }
  let best: Node | null = null, bestCost = Infinity;
  for (const line of network.lines) { const node = { station: toId, line: line.id }; const cost = dist.get(key(node)); if (cost !== undefined && cost < bestCost) { best = node; bestCost = cost; } }
  if (!best) return null;
  const chain: { node: Node; via: string }[] = [];
  for (let cursor: Node = best; ;) {
    const link = prev.get(key(cursor))!; chain.unshift({ node: cursor, via: link.via });
    if (link.via === "start") break;
    cursor = link.node;
  }
  const legs: RailLeg[] = [];
  const stationById = new Map(network.stations.map(station => [station.id, station]));
  let current: { line: RailLineRow; ids: string[] } | null = null;
  for (const { node, via } of chain) {
    if (via === "start") { current = { line: lines.get(node.line)!, ids: [node.station] }; }
    else if (via === "ride" && current) current.ids.push(node.station);
    else if (via === "change" && current) { legs.push(finishLeg(current, stationById)); current = { line: lines.get(node.line)!, ids: [node.station] }; }
  }
  if (current) legs.push(finishLeg(current, stationById));
  const useful = legs.filter(leg => leg.stations.length > 1);
  if (!useful.length) return null;
  return {
    legs: useful, totalMin: Math.round(bestCost), totalKm: useful.reduce((sum, leg) => sum + leg.km, 0),
    fare: useful.reduce((sum, leg) => sum + leg.fare, 0), transfers: useful.length - 1,
  };
}

function finishLeg(current: { line: RailLineRow; ids: string[] }, stationById: Map<string, RailStationRow>): RailLeg {
  const stations = current.ids.map(id => stationById.get(id)!).filter(Boolean);
  let km = 0;
  for (let i = 1; i < stations.length; i++) km += haversineKm(stations[i - 1].lat, stations[i - 1].lon, stations[i].lat, stations[i].lon);
  const rideMin = Math.round((km / current.line.speedKmh) * 60 + (stations.length - 1) * DWELL_MIN);
  return { line: current.line, from: stations[0], to: stations[stations.length - 1], stations, km, rideMin, waitMin: current.line.waitMin, fare: fareFor(current.line, km) };
}

export function nearestStations(network: RailNetwork, lat: number, lon: number, count = 2, maxKm = 10): (RailStationRow & { km: number })[] {
  return network.stations.map(station => ({ ...station, km: haversineKm(lat, lon, station.lat, station.lon) }))
    .sort((a, b) => a.km - b.km).filter(station => station.km <= maxKm).slice(0, count);
}

/** Full trip from any start to any destination: get to the station, ride the train, get to the destination. */
export function planRailTrip(network: RailNetwork, from: PlacePoint & { stationId?: string }, to: PlacePoint & { stationId?: string }): RailTrip[] {
  const byId = new Map(network.stations.map(station => [station.id, station]));
  const boardList = from.stationId && byId.get(from.stationId) ? [byId.get(from.stationId)!] : nearestStations(network, from.lat, from.lon, 2);
  const alightList = to.stationId && byId.get(to.stationId) ? [byId.get(to.stationId)!] : nearestStations(network, to.lat, to.lon, 2);
  const accessCache = new Map<string, JourneyOption | null>(), egressCache = new Map<string, JourneyOption | null>();
  const bestOf = (a: PlacePoint, b: PlacePoint): JourneyOption | null => {
    if (haversineKm(a.lat, a.lon, b.lat, b.lon) < 0.08) return null;
    return planDoorToDoor(a, b, 2)[0] ?? walkOnly(a, b);
  };
  const trips: RailTrip[] = [];
  for (const board of boardList) for (const alight of alightList) {
    if (board.id === alight.id) continue;
    const rail = planRail(network, board.id, alight.id);
    if (!rail) continue;
    const startsAtStation = Boolean(from.stationId) && board.id === from.stationId;
    const endsAtStation = Boolean(to.stationId) && alight.id === to.stationId;
    if (!startsAtStation && !accessCache.has(board.id)) accessCache.set(board.id, bestOf(from, { name: `${board.name} station`, lat: board.lat, lon: board.lon }));
    if (!endsAtStation && !egressCache.has(alight.id)) egressCache.set(alight.id, bestOf({ name: `${alight.name} station`, lat: alight.lat, lon: alight.lon }, to));
    const access = startsAtStation ? null : accessCache.get(board.id) ?? null;
    const egress = endsAtStation ? null : egressCache.get(alight.id) ?? null;
    trips.push({
      board, alight, rail, access, egress,
      totalMin: rail.totalMin + (access?.totalEtaMin ?? 0) + (egress?.totalEtaMin ?? 0),
      totalFare: rail.fare + (access?.fareEstimate ?? 0) + (egress?.fareEstimate ?? 0),
    });
  }
  trips.sort((a, b) => a.totalMin - b.totalMin);
  return trips.slice(0, 3);
}
