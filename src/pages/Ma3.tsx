import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Navigation, X, ArrowRight, Lock, Box,
  MapPin, BusFront, TrainFront,
  Calendar, AlarmClock, Zap, Eye, BadgeCheck, Footprints,
} from "lucide-react";
import { toast } from "sonner";
import maplibregl from "maplibre-gl";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import PageTabs from "@/components/PageTabs";
import { setLineLayer, setPointLayer, removeLineLayer, removePointLayer } from "@/lib/mapLayers";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import {
  searchStops, planJourney, StopMatch, JourneyOption,
} from "@/lib/journey";
import { haversineKm } from "@/data/ma3_core";
import OSMRailways from "@/data/nairobi_railways_osm.json";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Panel = "search" | "planner" | "live" | "train" | null;

const NAIROBI: [number, number] = [-1.2864, 36.8172];
const ROUTES = MA3_GTFS.routes;
const SHAPES = MA3_GTFS.shapes as unknown as Record<string, [number, number][]>;
const STOPS_RAW = MA3_GTFS.stops as unknown as Record<string, [string, number, number]>;
const ROUTE_STOPS = MA3_GTFS.routeStops as Record<string, string[]>;
const MA3_TABS = [
  { id: "search", label: "Matatu routes", Icon: Search },
  { id: "live", label: "Live fleet", Icon: Eye },
  { id: "train", label: "Rail stations", Icon: TrainFront },
] as const;

type SearchResult =
  | { kind: "route"; route: typeof ROUTES[0] }
  | { kind: "stop"; stop: StopMatch }
  | { kind: "rail"; station: OSMStation };

type OSMStation = { id: string; name: string; lat: number; lon: number };
const OSM_STATIONS: OSMStation[] = (OSMRailways as any).features
  .filter((feature: any) => feature.properties?.railway === "station" && feature.geometry?.type === "Point" && feature.properties?.name)
  .map((feature: any, index: number) => ({
    id: String(feature.id ?? feature.properties["@id"] ?? `${feature.properties.name}-${index}`),
    name: String(feature.properties.name), lat: Number(feature.geometry.coordinates[1]), lon: Number(feature.geometry.coordinates[0]),
  }));

function StopAC({ value, onChange, onSelect, placeholder, color }: {
  value: string; onChange: (v: string) => void; onSelect: (s: StopMatch) => void;
  placeholder: string; color: string;
}) {
  const results = useMemo(() => searchStops(value), [value]);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Navigation size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color, zIndex: 1 }} />
      <input className="finput" style={{ paddingLeft: 32 }} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 3, background: "#0c0c18", border: "1px solid var(--border2)", borderRadius: 11, overflow: "hidden", zIndex: 100, maxHeight: 190, overflowY: "auto" }}>
          {results.map(s => (
            <button key={s.id} onClick={() => onSelect(s)} onMouseDown={e => e.preventDefault()}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 12px", fontSize: ".73rem", color: "var(--white)", background: "transparent", border: "none", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
              <MapPin size={9} style={{ color, flexShrink: 0 }} /> {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function shapeBetweenStops(routeId: string, from: StopMatch, to: StopMatch): [number, number][] {
  const shape = SHAPES[routeId];
  if (!shape?.length) return [];
  const nearestIndex = (stop: StopMatch) => shape.reduce((best, point, index) => {
    const distance = haversineKm(stop.lat, stop.lon, point[0], point[1]);
    return distance < best.distance ? { index, distance } : best;
  }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
  const fromIndex = nearestIndex(from);
  const toIndex = nearestIndex(to);
  const segment = shape.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1);
  return fromIndex <= toIndex ? segment : segment.reverse();
}

function findRailPath(from: OSMStation, to: OSMStation): [number, number][] {
  type Edge = { id: string; distance: number };
  const graph = new Map<string, Edge[]>();
  const coordinates = new Map<string, [number, number]>();
  const keyFor = (lon: number, lat: number) => `${lon.toFixed(5)},${lat.toFixed(5)}`;
  const addEdge = (a: [number, number], b: [number, number]) => {
    const aId = keyFor(a[0], a[1]), bId = keyFor(b[0], b[1]);
    coordinates.set(aId, [Number(aId.split(",")[1]), Number(aId.split(",")[0])]);
    coordinates.set(bId, [Number(bId.split(",")[1]), Number(bId.split(",")[0])]);
    const distance = haversineKm(a[1], a[0], b[1], b[0]);
    graph.set(aId, [...(graph.get(aId) ?? []), { id: bId, distance }]);
    graph.set(bId, [...(graph.get(bId) ?? []), { id: aId, distance }]);
  };
  const features = (OSMRailways as any).features as any[];
  for (const feature of features) {
    if (feature.properties?.railway !== "rail") continue;
    const geometry = feature.geometry;
    const lines = geometry?.type === "LineString" ? [geometry.coordinates] : geometry?.type === "MultiLineString" ? geometry.coordinates : [];
    for (const line of lines) for (let index = 1; index < line.length; index++) addEdge(line[index - 1], line[index]);
  }
  const nearest = (station: OSMStation) => {
    let id = "", best = Infinity;
    for (const [candidate, [lat, lon]] of coordinates) {
      const distance = haversineKm(station.lat, station.lon, lat, lon);
      if (distance < best) { best = distance; id = candidate; }
    }
    return best < 2 ? id : "";
  };
  const start = nearest(from), finish = nearest(to);
  if (!start || !finish) return [];
  const distances = new Map<string, number>([[start, 0]]), previous = new Map<string, string>();
  const heap: { id: string; distance: number }[] = [];
  const push = (item: { id: string; distance: number }) => { heap.push(item); let index = heap.length - 1; while (index > 0) { const parent = (index - 1) >> 1; if (heap[parent].distance <= item.distance) break; heap[index] = heap[parent]; index = parent; } heap[index] = item; };
  const pop = () => { const first = heap[0], last = heap.pop(); if (heap.length && last) { let index = 0; while (index * 2 + 1 < heap.length) { let child = index * 2 + 1; if (child + 1 < heap.length && heap[child + 1].distance < heap[child].distance) child++; if (heap[child].distance >= last.distance) break; heap[index] = heap[child]; index = child; } heap[index] = last; } return first; };
  push({ id: start, distance: 0 });
  while (heap.length) {
    const current = pop()!;
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === finish) break;
    for (const edge of graph.get(current.id) ?? []) {
      const next = current.distance + edge.distance;
      if (next >= (distances.get(edge.id) ?? Infinity)) continue;
      distances.set(edge.id, next); previous.set(edge.id, current.id); push({ id: edge.id, distance: next });
    }
  }
  if (!distances.has(finish)) return [];
  const path = [finish];
  while (path[0] !== start) { const parent = previous.get(path[0]); if (!parent) return []; path.unshift(parent); }
  return path.map(id => coordinates.get(id)!).filter(Boolean);
}

export default function Ma3Page() {
  const [, setLocation] = useLocation();
  const [panel, setPanel]           = useState<Panel>(null);
  const [query, setQuery]           = useState("");
  const [selRoute, setSelRoute]     = useState<typeof ROUTES[0] | null>(null);
  const [fromVal, setFromVal]       = useState("");
  const [toVal, setToVal]           = useState("");
  const [fromStop, setFromStop]     = useState<StopMatch | null>(null);
  const [toStop, setToStop]         = useState<StopMatch | null>(null);
  const [journeyOpts, setJourneyOpts] = useState<JourneyOption[] | null>(null);
  const [lockedStop, setLockedStop] = useState<{ stop: StopMatch; routeId: string } | null>(null);
  const [trackedLeg, setTrackedLeg] = useState<JourneyOption["legs"][number] | null>(null);
  const [trackedPosition, setTrackedPosition] = useState<[number, number] | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState("");
  const arrivalAlerted = useRef(false);
  const [is3D, setIs3D]             = useState(false);
  const [mapCenter, setMapCenter]   = useState<[number, number]>(NAIROBI);
  const [exploreDestination, setExploreDestination] = useState<{ name: string; lat: number; lon: number; stop: StopMatch; distanceKm: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [savedJourneys, setSavedJourneys] = useState<{ label: string; from: StopMatch; to: StopMatch; time: string; days: string[] }[]>([]);
  const [saveForm, setSaveForm]     = useState(false);
  const [saveLabel, setSaveLabel]   = useState("");
  const [saveDays, setSaveDays]     = useState<string[]>([]);
  const [saveTime, setSaveTime]     = useState("07:30");
  const [showSaved, setShowSaved]   = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(true);
  const [railStationQuery, setRailStationQuery] = useState("");
  const [railFromId, setRailFromId] = useState("");
  const [railToId, setRailToId] = useState("");
  const railFrom = OSM_STATIONS.find(station => station.id === railFromId);
  const railTo = OSM_STATIONS.find(station => station.id === railToId);
  const visibleRailStations = useMemo(() => {
    const term = railStationQuery.trim().toLowerCase();
    return OSM_STATIONS.filter(station => !term || station.name.toLowerCase().includes(term));
  }, [railStationQuery]);

  const mapRef         = useRef<MapLibreHandle>(null);
  const mapInst        = useRef<maplibregl.Map | null>(null);
  const staticMarkers  = useRef<maplibregl.Marker[]>([]);

  const searchResults: SearchResult[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const routeMatches: SearchResult[] = ROUTES
      .filter(r => r.sn.toLowerCase().includes(q) || r.ln.toLowerCase().includes(q) || r.hs.toLowerCase().includes(q))
      .slice(0, 12)
      .map(route => ({ kind: "route" as const, route }));
    const stopMatches: SearchResult[] = searchStops(query, 12).map(stop => ({ kind: "stop" as const, stop }));
    const railMatches: SearchResult[] = OSM_STATIONS
      .filter(station => station.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map(station => ({ kind: "rail" as const, station }));
    return [...routeMatches, ...stopMatches, ...railMatches];
  }, [query]);

  const clearStatic = useCallback(() => {
    const map = mapInst.current;
    if (!map) return;
    staticMarkers.current.forEach(m => m.remove());
    staticMarkers.current = [];
    ROUTES.forEach(r => {
      removeLineLayer(map, `route-${r.id}`);
    });
    [0, 1, 2].forEach(i => removeLineLayer(map, `journey-leg-${i}`));
    if (map.getLayer("osm-rail-line")) map.removeLayer("osm-rail-line");
    if (map.getLayer("osm-rail-stations")) map.removeLayer("osm-rail-stations");
    if (map.getSource("osm-railways")) map.removeSource("osm-railways");
    removeLineLayer(map, "selected-rail-segment");
    removePointLayer(map, "selected-rail-stations");
    removePointLayer(map, "route-stops");
    removePointLayer(map, "planner-pts");
  }, []);

  const drawRoute = useCallback((map: maplibregl.Map, route: typeof ROUTES[0]) => {
    clearStatic();
    const shape = SHAPES[route.id];
    if (shape?.length) {
      setLineLayer(map, `route-${route.id}`, shape, route.c, 5, 0.9);
      const mid = shape[~~(shape.length / 2)];
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:${route.c};color:#fff;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;font-family:'DM Mono',monospace;box-shadow:0 2px 6px rgba(0,0,0,.4)">${route.sn}</div>`;
      staticMarkers.current.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([mid[1], mid[0]]).addTo(map));
    }
    const stopIds = ROUTE_STOPS[route.id] ?? [];
    const pts = stopIds.map((sid, i) => {
      const s = STOPS_RAW[sid];
      return s ? { id: sid, lat: s[1], lon: s[2], color: route.c, radius: (i === 0 || i === stopIds.length - 1) ? 6 : 4 } : null;
    }).filter(Boolean) as { id: string; lat: number; lon: number; color: string; radius: number }[];
    setPointLayer(map, "route-stops", pts, 4);
  }, [clearStatic]);

  const drawRail = useCallback((map: maplibregl.Map, from?: OSMStation, to?: OSMStation) => {
    clearStatic();
    if (!from || !to) return;
    const path = findRailPath(from, to);
    if (path.length > 1) {
      setLineLayer(map, "selected-rail-segment", path, "#d97706", 4, .96);
      setPointLayer(map, "selected-rail-stations", [from, to].map((station, index) => ({ id: station.id, lat: station.lat, lon: station.lon, color: index ? "#dc2626" : "#16a34a", radius: 7 })), 7);
      const latitudes = path.map(point => point[0]), longitudes = path.map(point => point[1]);
      map.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], { padding: 64, maxZoom: 14 });
    }
  }, [clearStatic]);

  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    clearStatic();
    if (panel === "live") {
      // Live positions are not drawn until a verified location feed is configured.
    } else if (panel === "train") {
      drawRail(map, railFrom, railTo);
    } else if (selRoute) {
      drawRoute(map, selRoute);
    }
  }, [panel, selRoute, mapReady, drawRail, railFromId, railToId]);

  const handleMapLoad = (map: maplibregl.Map) => { mapInst.current = map; setMapReady(true); };

  useEffect(() => {
    if (!trackedLeg || !trackingActive) return;
    if (!navigator.geolocation) { setTrackingStatus("Location is not available on this device."); setTrackingActive(false); return; }
    setTrackingStatus("Waiting for your phone location…");
    const watchId = navigator.geolocation.watchPosition(position => {
      setTrackedPosition([position.coords.latitude, position.coords.longitude]);
    }, () => {
      setTrackingStatus("Location permission is needed to follow your trip on the map.");
      setTrackingActive(false);
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackedLeg, trackingActive]);

  useEffect(() => {
    const map = mapInst.current;
    if (!mapReady || !map) return;
    if (!trackedLeg?.routeId || trackedLeg.type !== "matatu") {
      removeLineLayer(map, "tracked-journey-route"); removeLineLayer(map, "tracked-journey-progress"); removePointLayer(map, "tracked-journey-points");
      return;
    }
    const route = shapeBetweenStops(trackedLeg.routeId, trackedLeg.fromStop, trackedLeg.toStop);
    if (route.length < 2) { setTrackingStatus("No mapped route shape is available for this leg."); return; }
    setLineLayer(map, "tracked-journey-route", route, trackedLeg.routeColor ?? "#d97706", 5, .42);
    const location = trackedPosition;
    if (location) {
      let nearest = 0, nearestKm = Infinity;
      route.forEach(([lat, lon], index) => { const distance = haversineKm(location[0], location[1], lat, lon); if (distance < nearestKm) { nearestKm = distance; nearest = index; } });
      const snapped = route[nearest];
      setLineLayer(map, "tracked-journey-progress", route.slice(0, nearest + 1), "#16a34a", 6, .98);
      setPointLayer(map, "tracked-journey-points", [
        { id: "phone-location", lat: snapped[0], lon: snapped[1], color: nearestKm <= .8 ? "#16a34a" : "#d97706", radius: 9 },
        { id: "alight-stop", lat: trackedLeg.toStop.lat, lon: trackedLeg.toStop.lon, color: "#dc2626", radius: 8 },
      ], 8);
      setTrackingStatus(nearestKm > 1.5 ? "You appear off this archived route; the dot is snapped to the nearest route point." : `Following your phone on the route to ${trackedLeg.toStop.name}.`);
      map.easeTo({ center: [snapped[1], snapped[0]], duration: 550 });
      if (haversineKm(location[0], location[1], trackedLeg.toStop.lat, trackedLeg.toStop.lon) <= .15 && !arrivalAlerted.current) {
        arrivalAlerted.current = true; setTrackingStatus(`Near ${trackedLeg.toStop.name} — your selected stop.`); setTrackingActive(false); toast(`You are near ${trackedLeg.toStop.name}.`);
      }
    } else {
      setPointLayer(map, "tracked-journey-points", [
        { id: "board-stop", lat: trackedLeg.fromStop.lat, lon: trackedLeg.fromStop.lon, color: "#16a34a", radius: 8 },
        { id: "alight-stop", lat: trackedLeg.toStop.lat, lon: trackedLeg.toStop.lon, color: "#dc2626", radius: 8 },
      ], 8);
    }
  }, [mapReady, trackedLeg, trackedPosition]);

  useEffect(() => {
    const map = mapInst.current;
    if (!mapReady || !map || !exploreDestination) return;
    setPointLayer(map, "explore-destination", [
      { id: "nearest-ma3-stop", lat: exploreDestination.stop.lat, lon: exploreDestination.stop.lon, color: "#16a34a", radius: 7 },
      { id: "destination", lat: exploreDestination.lat, lon: exploreDestination.lon, color: "#dc2626", radius: 9 },
    ], 7);
    setLineLayer(map, "explore-walk-approx", [[exploreDestination.stop.lat, exploreDestination.stop.lon], [exploreDestination.lat, exploreDestination.lon]], "#16a34a", 3, .9, true);
    mapRef.current?.fitBounds([[Math.min(exploreDestination.stop.lon, exploreDestination.lon), Math.min(exploreDestination.stop.lat, exploreDestination.lat)], [Math.max(exploreDestination.stop.lon, exploreDestination.lon), Math.max(exploreDestination.stop.lat, exploreDestination.lat)]], 72);
  }, [mapReady, exploreDestination]);

  const selectRoute = (route: typeof ROUTES[0]) => {
    setSelRoute(route);
    setQuery(`${route.sn} — ${route.ln}`);
    const map = mapInst.current;
    if (map) drawRoute(map, route);
    const shape = SHAPES[route.id];
    if (shape?.length) setMapCenter([shape[~~(shape.length / 2)][0], shape[~~(shape.length / 2)][1]]);
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("ma3_destination");
    if (!raw) return;
    sessionStorage.removeItem("ma3_destination");
    try {
      const destination = JSON.parse(raw) as { name?: string; lat?: number; lon?: number };
      if (!destination.name || !Number.isFinite(destination.lat) || !Number.isFinite(destination.lon)) return;
      const nearest = Object.entries(STOPS_RAW).map(([id, stop]) => ({ id, name: stop[0], lat: stop[1], lon: stop[2], distance: haversineKm(destination.lat!, destination.lon!, stop[1], stop[2]) })).sort((a, b) => a.distance - b.distance)[0];
      if (!nearest) { setQuery(destination.name); setPanel("search"); return; }
      const stop: StopMatch = { id: nearest.id, name: nearest.name, lat: nearest.lat, lon: nearest.lon };
      setExploreDestination({ name: destination.name, lat: destination.lat!, lon: destination.lon!, stop, distanceKm: nearest.distance });
      setToStop(stop); setToVal(stop.name); setFromStop(null); setFromVal(""); setJourneyOpts(null);
      setQuery(`${destination.name} · nearest mapped stop: ${nearest.name}`); setPanel("search"); setPanelMinimized(false);
      setMapCenter([nearest.lat, nearest.lon]); mapRef.current?.flyTo(nearest.lon, nearest.lat, 14);
      const servingRouteIds = (MA3_GTFS.stopRoutes as Record<string, string[]>)[nearest.id] ?? [];
      const firstRoute = nearest.distance <= 30 ? ROUTES.find(route => servingRouteIds.includes(route.id)) : undefined;
      if (firstRoute) { selectRoute(firstRoute); toast(`Closest archived Ma3 stop: ${nearest.name}. Select your origin to plan the matatu legs.`); }
      else toast(`No Ma3 stop is mapped within 30 km of ${destination.name}. Try Fly for longer-distance travel.`);
    } catch { sessionStorage.removeItem("ma3_destination"); }
  }, []);

  const selectStopFromSearch = (stop: StopMatch) => {
    setQuery(stop.name);
    setMapCenter([stop.lat, stop.lon]);
    if (mapRef.current) mapRef.current.flyTo(stop.lon, stop.lat, 15);
    const servingRouteIds = (MA3_GTFS.stopRoutes as Record<string, string[]>)[stop.id] ?? [];
    const firstRoute = ROUTES.find(r => servingRouteIds.includes(r.id));
    if (firstRoute) selectRoute(firstRoute);
    toast(`${stop.name} selected — choose a start and destination below`);
  };

  const selectRailStation = (station: OSMStation) => {
    setQuery(station.name);
    setMapCenter([station.lat, station.lon]);
    mapRef.current?.flyTo(station.lon, station.lat, 14);
    setPanel("train");
    setPanelMinimized(false);
    if (!railFromId || railToId) { setRailFromId(station.id); setRailToId(""); }
    else if (station.id !== railFromId) setRailToId(station.id);
  };

  const findJourney = () => {
    if (!fromStop || !toStop) { toast("Pick both From and To stops"); return; }
    const opts = planJourney(fromStop.id, toStop.id);
    if (!opts.length) { toast("No route found — try nearby stops"); return; }
    setJourneyOpts(opts);
    setMapCenter([fromStop.lat, fromStop.lon]);
    const map = mapInst.current;
    if (map) {
      clearStatic();
      opts[0]?.legs.forEach((leg, i) => {
        if (leg.routeId) {
          const segment = shapeBetweenStops(leg.routeId, leg.fromStop, leg.toStop);
          if (segment.length > 1) setLineLayer(map, `journey-leg-${i}`, segment, leg.routeColor ?? "#d97706", 5, 0.95);
        }
      });
      setPointLayer(map, "planner-pts", [
        { id: "from", lat: fromStop.lat, lon: fromStop.lon, color: "#16a34a", radius: 10 },
        { id: "to",   lat: toStop.lat,   lon: toStop.lon,   color: "#dc2626", radius: 10 },
      ], 10);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast("Location is not available in this browser"); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const nearest = Object.entries(STOPS_RAW).map(([id, stop]) => ({ id, name: stop[0], lat: stop[1], lon: stop[2], distance: haversineKm(lat, lon, stop[1], stop[2]) })).sort((a, b) => a.distance - b.distance)[0];
      if (!nearest) return;
      const stop: StopMatch = { id: nearest.id, name: nearest.name, lat: nearest.lat, lon: nearest.lon };
      setFromStop(stop); setFromVal(`Near ${stop.name}`); setJourneyOpts(null); setMapCenter([lat, lon]); mapRef.current?.flyTo(lon, lat, 15);
      toast(`Walking to ${stop.name} added as your start`);
    }, () => toast("Location permission was not granted"), { enableHighAccuracy: true, timeout: 10000 });
  };

  const lockIn = async (leg: JourneyOption["legs"][number]) => {
    if (!leg.routeId) { toast("Choose a matatu leg before marking a pickup stop."); return; }
    if (!isSupabaseConfigured || !supabase) { toast("Connect Supabase to share anonymous stop demand with drivers."); return; }
    try {
      let user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) throw error ?? new Error("Could not create a guest session.");
        user = data.user;
      }
      const { error } = await supabase.rpc("set_my_ma3_stop_waiting", { p_route_id: leg.routeId, p_stop_id: leg.fromStop.id });
      if (error) throw error;
      setLockedStop({ stop: leg.fromStop, routeId: leg.routeId });
      toast(`${leg.fromStop.name} shared as an anonymous pickup request for 30 minutes.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not share your pickup stop. Check the Supabase setup.");
    }
  };

  const cancelStopWaiting = async () => {
    if (!lockedStop || !supabase) { setLockedStop(null); return; }
    const { error } = await supabase.rpc("cancel_my_ma3_stop_waiting", { p_route_id: lockedStop.routeId, p_stop_id: lockedStop.stop.id });
    if (error) { toast("Could not remove the pickup request yet."); return; }
    setLockedStop(null); toast("Pickup request removed.");
  };

  const openPanel = (p: Panel) => { setPanelMinimized(true); setPanel(prev => prev === p ? null : p); };
  const pitch = is3D ? 52 : 0;
  const bearing = is3D ? -14 : 0;

  return (
    <div style={{ position: "relative", height: "calc(100vh - var(--top-h) - var(--nav-h))", marginTop: "-12px" }}>
      <MapLibreView ref={mapRef} center={mapCenter} zoom={12} pitch={pitch} bearing={bearing}
        height="100%" borderRadius={0} onLoad={handleMapLoad} />

      <div style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 50 }}>
        <PageTabs label="Ma3 sections" active={panel === "live" || panel === "train" ? panel : "search"} tabs={MA3_TABS}
          onChange={value => { setPanelMinimized(true); setPanel(value as "search" | "live" | "train"); }} />
      </div>

      {/* ══════ UNIFIED SEARCH PANEL ══════ */}
      <AnimatePresence>
        {panel === "search" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bpanel open" style={{ maxHeight: panelMinimized ? "20vh" : "50vh" }}>
            <div className="bpanel-head">
              <button aria-label="Minimize search panel" className="handle" onClick={() => setPanelMinimized(v => !v)} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} />
                  <input data-page-search autoFocus className="finput" style={{ paddingLeft: 32 }}
                    placeholder="Route number, route name, or stop… e.g. 23W, Rongai, Kencom"
                    value={query} onChange={e => setQuery(e.target.value)} />
                  {query && (
                    <button onClick={() => { setQuery(""); setSelRoute(null); clearStatic(); }}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>

              {selRoute && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: `${selRoute.c}12`, border: `1px solid ${selRoute.c}35` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${selRoute.c}22`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: ".62rem", fontWeight: 900, color: selRoute.c }}>
                      {selRoute.sn}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: ".74rem", fontWeight: 700, color: selRoute.c }}>{selRoute.hs}</p>
                      <p style={{ fontSize: ".6rem", color: "var(--muted2)" }}>{selRoute.ln}</p>
                    </div>
                    <button onClick={() => { setSelRoute(null); setQuery(""); clearStatic(); }}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={13} /></button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: ".58rem", color: "var(--muted)" }}>Archived route shape · static map geometry only</span>
                    </div>
                  </div>
                </motion.div>
              )}
              {exploreDestination && !panelMinimized && <div className="ios-glass" style={{ padding: 9, marginTop: 8, fontSize: ".59rem", color: "var(--muted2)" }}>Destination: {exploreDestination.name}. Green dashed line is a straight-line approximation to the nearest archived stop ({exploreDestination.distanceKm.toFixed(1)} km), not a pedestrian route.{exploreDestination.distanceKm > 30 && <><p style={{ margin: "6px 0" }}>Outside the mapped Ma3 coverage; check available flight options instead.</p><button className="btn btn-ready" style={{ width: "100%" }} onClick={() => { sessionStorage.setItem("ma3_fly_destination", JSON.stringify({ name: exploreDestination.name, lat: exploreDestination.lat, lon: exploreDestination.lon })); setLocation("/fly"); }}>Open Fly with destination</button></>}</div>}
              {selRoute && !panelMinimized && (
                <div className="ios-glass" style={{ marginTop: 8, padding: 10 }}>
              <p className="sec-label" style={{ marginBottom: 7 }}>Plan from your location</p>
                  <div style={{ display: "grid", gap: 6 }}>
                    <StopAC value={fromVal} onChange={setFromVal} color="var(--go)" placeholder="Start or current stop"
                      onSelect={s => { setFromStop(s); setFromVal(s.name); setJourneyOpts(null); }} />
                    <button className="btn btn-ghost" style={{ justifyContent: "center", padding: 8, fontSize: ".65rem" }} onClick={useCurrentLocation}><MapPin size={11} /> Use my current location</button>
                    <StopAC value={toVal} onChange={setToVal} color="var(--stop)" placeholder="Destination stop"
                      onSelect={s => { setToStop(s); setToVal(s.name); setJourneyOpts(null); }} />
                    <button className="btn btn-go" style={{ width: "100%", padding: 9, justifyContent: "center", fontSize: ".7rem" }} onClick={findJourney}>
                      <Navigation size={12} /> Show archived route estimates
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bpanel-scroll" style={{ padding: "0 14px 20px" }}>
              {searchResults.map((res, i) => {
                if (res.kind === "route") {
                  const route = res.route;
                  return (
                    <motion.button key={`r-${route.id}`} whileTap={{ scale: 0.97 }} onClick={() => selectRoute(route)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 12, width: "100%", textAlign: "left", marginBottom: 5, background: selRoute?.id === route.id ? `${route.c}14` : "var(--glass)", border: `1px solid ${selRoute?.id === route.id ? route.c + "40" : "var(--border)"}`, cursor: "pointer" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: ".6rem", fontWeight: 900, background: `${route.c}18`, border: `1.5px solid ${route.c}40`, color: route.c, flexShrink: 0 }}>
                        {route.sn}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: ".77rem", fontWeight: 600 }}>{route.hs}</p>
                        <p style={{ fontSize: ".6rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route.ln}</p>
                      </div>
                      <BusFront size={13} style={{ color: route.c, flexShrink: 0 }} />
                    </motion.button>
                  );
                } else if (res.kind === "rail") {
                  const station = res.station;
                  return (
                    <motion.button key={`rail-${station.id}`} whileTap={{ scale: 0.97 }} onClick={() => selectRailStation(station)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 12, width: "100%", textAlign: "left", marginBottom: 5, background: "var(--glass)", border: "1px solid var(--border)", cursor: "pointer" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(139,92,246,.12)", border: "1.5px solid rgba(139,92,246,.3)", flexShrink: 0 }}><TrainFront size={15} style={{ color: "#a78bfa" }} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: ".77rem", fontWeight: 600 }}>{station.name}</p><p style={{ fontSize: ".6rem", color: "var(--muted)" }}>OpenStreetMap station feature</p></div>
                      <ArrowRight size={13} style={{ color: "#a78bfa" }} />
                    </motion.button>
                  );
                } else {
                  const stop = res.stop;
                  return (
                    <motion.button key={`s-${stop.id}`} whileTap={{ scale: 0.97 }} onClick={() => selectStopFromSearch(stop)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 12, width: "100%", textAlign: "left", marginBottom: 5, background: "var(--glass)", border: "1px solid var(--border)", cursor: "pointer" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,.12)", border: "1.5px solid rgba(220,38,38,.3)", flexShrink: 0 }}>
                        <MapPin size={15} style={{ color: "var(--stop)" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: ".77rem", fontWeight: 600 }}>{stop.name}</p>
                        <p style={{ fontSize: ".6rem", color: "var(--muted)" }}>Stop from the archived route dataset</p>
                      </div>
                      <span className="chip" style={{ background: "rgba(220,38,38,.1)", color: "var(--stop)", border: "1px solid rgba(220,38,38,.25)" }}>STOP</span>
                    </motion.button>
                  );
                }
              })}
              {query && searchResults.length === 0 && (
                <p style={{ textAlign: "center", fontSize: ".7rem", color: "var(--muted)", padding: "1.5rem 0" }}>No routes or stops match "{query}"</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ PLANNER PANEL ══════ */}
      <AnimatePresence>
        {panel === "planner" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bpanel open" style={{ maxHeight: panelMinimized ? "20vh" : "50vh" }}>
            <div className="bpanel-head">
              <button aria-label="Minimize panel" className="handle" onClick={() => setPanelMinimized(v => !v)} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 900 }}>Journey Planner</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setShowSaved(s => !s)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 99, background: showSaved ? "rgba(217,119,6,.15)" : "var(--glass)", border: `1px solid ${showSaved ? "rgba(217,119,6,.4)" : "var(--border)"}`, color: showSaved ? "var(--ready)" : "var(--muted2)", fontSize: ".64rem", fontWeight: 700, cursor: "pointer" }}>
                    <Calendar size={11} /> {savedJourneys.length}
                  </button>
                  <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
                </div>
              </div>
            </div>

            <div className="bpanel-scroll" style={{ padding: "0 14px 28px" }}>
              {!showSaved ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
                    <div>
                      <label style={{ marginBottom: 4, display: "block" }}>1 · From</label>
                      <StopAC value={fromVal} onChange={setFromVal} color="var(--go)" placeholder="Your current stop"
                        onSelect={s => { setFromStop(s); setFromVal(s.name); setJourneyOpts(null); }} />
                    </div>
                    <div>
                      <label style={{ marginBottom: 4, display: "block" }}>2 · To</label>
                      <StopAC value={toVal} onChange={setToVal} color="var(--stop)" placeholder="Your destination"
                        onSelect={s => { setToStop(s); setToVal(s.name); setJourneyOpts(null); }} />
                    </div>
                    <button className="btn btn-stop" style={{ width: "100%", padding: 11, justifyContent: "center", fontSize: ".78rem", marginTop: 4 }} onClick={findJourney}>
                      <Search size={13} /> FIND ALL ROUTES
                    </button>
                  </div>

                  <AnimatePresence>
                    {journeyOpts && (
                      <div>
                        <p style={{ fontSize: ".6rem", color: "var(--muted)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>
                          3 · {journeyOpts.length} option{journeyOpts.length !== 1 ? "s" : ""} found
                        </p>
                        {journeyOpts.map((opt, i) => {
                          return (
                            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                              className="card" style={{ padding: 12, marginBottom: 8, borderColor: opt.isFastest ? "rgba(22,163,74,.3)" : opt.isCheapest ? "rgba(217,119,6,.3)" : "var(--border2)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                                  {opt.isFastest && <span className="chip" style={{ background: "rgba(22,163,74,.12)", color: "var(--go)", border: "1px solid rgba(22,163,74,.3)" }}><Zap size={9} style={{ display: "inline" }} /> SHORTEST ESTIMATE</span>}
                                  {opt.isCheapest && <span className="chip" style={{ background: "rgba(217,119,6,.12)", color: "var(--ready)", border: "1px solid rgba(217,119,6,.3)" }}>LOWER EST. FARE</span>}
                                </div>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", fontWeight: 700 }}>~KES {opt.fareEstimate}</span>
                              </div>
                              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                                <div style={{ flex: 1, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "5px 8px", textAlign: "center" }}>
                                  <p style={{ fontSize: ".5rem", color: "var(--muted)", textTransform: "uppercase" }}>Ride</p>
                                  <p style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", color: "var(--white)", fontWeight: 700 }}>{opt.legs.reduce((s, l) => s + l.etaMin, 0)}m</p>
                                </div>
                                <div style={{ flex: 1, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "5px 8px", textAlign: "center" }}>
                                  <p style={{ fontSize: ".5rem", color: "var(--muted)", textTransform: "uppercase" }}>Total</p>
                                  <p style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", color: "var(--go)", fontWeight: 700 }}>{opt.totalEtaMin}m</p>
                                </div>
                              </div>
                              {opt.legs.map((leg, li) => (
                                <div key={li} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", background: "rgba(0,0,0,.3)", borderRadius: 8, marginBottom: 4 }}>
                                  {leg.type === "matatu"
                                    ? <span style={{ padding: "2px 8px", borderRadius: 99, background: leg.routeColor, color: "#fff", fontFamily: "var(--font-mono)", fontSize: ".64rem", fontWeight: 700, flexShrink: 0 }}>{leg.routeShortName}</span>
                                    : <span style={{ padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,.1)", color: "var(--muted2)", fontSize: ".64rem", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}><Footprints size={9} /> Walk</span>}
                                  <span style={{ fontSize: ".66rem", color: "var(--muted2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {leg.fromStop.name} <ArrowRight size={9} style={{ display: "inline", verticalAlign: "middle" }} /> {leg.toStop.name}
                                  </span>
                                  <span style={{ fontSize: ".58rem", color: "var(--muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{leg.etaMin}m</span>
                                </div>
                              ))}
                              {opt.transfers > 0 && <p style={{ fontSize: ".6rem", color: "var(--ready)", marginBottom: 6 }}>Transfer: {opt.transfers} transfer — allow extra time</p>}
                              {opt.legs[0]?.routeId && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "rgba(22,163,74,.06)", borderRadius: 8, marginBottom: 8 }}>
                                  <BadgeCheck size={12} style={{ color: "var(--go)", flexShrink: 0 }} />
                                  <p style={{ fontSize: ".62rem", color: "var(--muted2)" }}>
                                    Board route <strong style={{ color: "var(--go)" }}>{opt.legs[0].routeShortName}</strong> at {opt.legs[0].fromStop.name}; transfer as shown if needed.
                                  </p>
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn btn-go" style={{ flex: 1, padding: 8, fontSize: ".7rem", justifyContent: "center" }} onClick={() => { const firstMatatu = opt.legs.find(leg => leg.type === "matatu"); if (firstMatatu) void lockIn(firstMatatu); }} disabled={!opt.legs.some(leg => leg.type === "matatu")}>
                                  <Lock size={11} /> Share pickup
                                </button>
                                <button className="btn btn-ghost" style={{ flex: 1, padding: 8, fontSize: ".7rem", justifyContent: "center" }} onClick={() => { const firstMatatu = opt.legs.find(leg => leg.type === "matatu"); if (!firstMatatu) return; arrivalAlerted.current = false; setTrackedPosition(null); setTrackedLeg(firstMatatu); setTrackingActive(true); setPanelMinimized(true); toast("Allow location access to follow your phone along the mapped route."); }} disabled={!opt.legs.some(leg => leg.type === "matatu")}>
                                  <Navigation size={11} /> Track ride
                                </button>
                                <button className="btn btn-ghost" style={{ padding: "8px 10px" }} onClick={() => setSaveForm(true)}>
                                  <Calendar size={12} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {saveForm && journeyOpts && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", marginBottom: 10 }}>
                        <div className="card" style={{ padding: 12 }}>
                          <p style={{ fontSize: ".74rem", fontWeight: 700, marginBottom: 8 }}>Save this journey</p>
                          <input className="finput" placeholder="Label e.g. Morning Commute" value={saveLabel} onChange={e => setSaveLabel(e.target.value)} style={{ marginBottom: 8 }} />
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                              <button key={d} onClick={() => setSaveDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])}
                                style={{ padding: "5px 10px", borderRadius: 99, fontSize: ".62rem", fontWeight: 700, cursor: "pointer", background: saveDays.includes(d) ? "rgba(217,119,6,.15)" : "var(--glass)", border: `1px solid ${saveDays.includes(d) ? "rgba(217,119,6,.4)" : "var(--border)"}`, color: saveDays.includes(d) ? "var(--ready)" : "var(--muted2)" }}>{d}</button>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 7 }}>
                            <input type="time" className="finput" value={saveTime} onChange={e => setSaveTime(e.target.value)} style={{ flex: 1 }} />
                            <button className="btn btn-go" style={{ padding: "9px 16px" }}
                              onClick={() => {
                                if (!fromStop || !toStop || !saveLabel) { toast("Fill in From, To and a label"); return; }
                                setSavedJourneys(p => [...p, { label: saveLabel, from: fromStop, to: toStop, time: saveTime, days: saveDays }]);
                                setSaveForm(false); setSaveLabel(""); setSaveDays([]); toast("Saved");
                              }}>Save</button>
                            <button className="btn btn-ghost" style={{ padding: "9px 13px" }} onClick={() => setSaveForm(false)}><X size={14} /></button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {lockedStop && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="card" style={{ padding: 12, borderColor: "rgba(217,119,6,.3)", background: "rgba(217,119,6,.04)", marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Lock size={12} style={{ color: "var(--ready)" }} />
                            <span style={{ fontSize: ".78rem", fontWeight: 700 }}>{lockedStop.stop.name}</span>
                          </div>
                          <button aria-label="Cancel pickup request" onClick={() => void cancelStopWaiting()} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={13} /></button>
                        </div>
                        <p style={{ fontSize: ".61rem", color: "var(--muted2)", lineHeight: 1.5 }}>Your pickup stop is shared as an anonymous count for this route. It expires after 30 minutes; drivers cannot see your account or phone location.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {trackedLeg && <div className="ios-glass" style={{ marginBottom: 8, padding: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><Navigation size={13} style={{ color: trackingActive ? "var(--go)" : "var(--ready)" }} /><b style={{ flex: 1, fontSize: ".68rem" }}>{trackingStatus || `Ride to ${trackedLeg.toStop.name}`}</b><button className="icon-btn" aria-label="Stop following ride" onClick={() => { setTrackingActive(false); setTrackedLeg(null); setTrackedPosition(null); }}><X size={13} /></button></div><p style={{ marginTop: 5, fontSize: ".56rem", lineHeight: 1.45, color: "var(--muted2)" }}>Uses your phone's location to show progress on the archived route shape. It does not show the driver's live location or guarantee current service.</p></div>}
                </>
              ) : (
                <div>
                  {savedJourneys.length === 0 && (
                    <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--muted)" }}>
                      <Calendar size={32} style={{ opacity: .3, margin: "0 auto 8px" }} />
                      <p style={{ fontSize: ".74rem" }}>No saved journeys yet</p>
                    </div>
                  )}
                  {savedJourneys.map((j, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 12, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <AlarmClock size={14} style={{ color: "var(--ready)" }} />
                          <span style={{ fontWeight: 700, fontSize: ".82rem" }}>{j.label}</span>
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", color: "var(--ready)", fontWeight: 700 }}>{j.time}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--go)" }} />
                        <span style={{ fontSize: ".68rem" }}>{j.from.name}</span>
                        <ArrowRight size={10} style={{ color: "var(--muted)" }} />
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--stop)" }} />
                        <span style={{ fontSize: ".68rem" }}>{j.to.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                        {j.days.map(d => <span key={d} className="chip" style={{ background: "rgba(217,119,6,.1)", border: "1px solid rgba(217,119,6,.25)", color: "var(--ready)" }}>{d}</span>)}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-go" style={{ flex: 1, padding: 8, fontSize: ".7rem", justifyContent: "center" }}
                          onClick={() => { setFromStop(j.from); setFromVal(j.from.name); setToStop(j.to); setToVal(j.to.name); setShowSaved(false); setTimeout(findJourney, 80); }}>
                          <Navigation size={12} /> Start
                        </button>
                        <button className="btn btn-ghost" style={{ padding: "8px 12px" }} onClick={() => setSavedJourneys(p => p.filter((_, idx) => idx !== i))}>
                          <X size={13} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ MATATU PANEL ══════ */}
      <AnimatePresence>
        {panel === "live" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bpanel open" style={{ maxHeight: panelMinimized ? "20vh" : "50vh" }}>
            <div className="bpanel-head">
              <button aria-label="Minimize panel" className="handle" onClick={() => setPanelMinimized(v => !v)} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <BusFront size={15} style={{ color: "var(--ready)" }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 900 }}>Live fleet</span>
                  <span className="chip" style={{ background: "rgba(217,119,6,.1)", color: "var(--ready)", border: "1px solid rgba(217,119,6,.25)", fontSize: ".56rem" }}>
                    FEED NOT CONNECTED
                  </span>
                </div>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
            </div>
            <div className="bpanel-scroll" style={{ padding: "0 14px 20px" }}>
              <div className="ios-glass" style={{ padding: 13 }}>
                <p style={{ fontSize: ".75rem", fontWeight: 700 }}>No verified real-time vehicle feed is connected.</p>
                <p style={{ marginTop: 6, color: "var(--muted2)", fontSize: ".64rem", lineHeight: 1.5 }}>This map will stay clear rather than invent vehicle positions. Connect a permissioned AVL/GPS feed through a protected server-side adapter before enabling live locations.</p>
                <p style={{ marginTop: 7, color: "var(--muted)", fontSize: ".57rem" }}>Archived route geometry is not a live feed and does not report a vehicle's current position.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ TRAIN PANEL ══════ */}
      <AnimatePresence>
        {panel === "train" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bpanel open" style={{ maxHeight: panelMinimized ? "20vh" : "50vh" }}>
            <div className="bpanel-head">
              <button aria-label="Minimize panel" className="handle" onClick={() => setPanelMinimized(v => !v)} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <TrainFront size={15} style={{ color: "var(--ready)" }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 900 }}>Rail map</span>
                </div>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <p style={{ margin: "7px 0 0", fontSize: ".59rem", color: "var(--muted2)", lineHeight: 1.45 }}>Choose a start station, then an end station.</p>
            </div>
            <div className="bpanel-scroll" style={{ padding: "0 14px 24px" }}>
              <div className="ios-glass" style={{ padding: 10, marginBottom: 10 }}>
                <p style={{ fontSize: ".67rem", fontWeight: 700, color: "var(--ready)" }}>Rail route preview</p>
                <p style={{ marginTop: 4, fontSize: ".59rem", color: "var(--muted2)", lineHeight: 1.45 }}>{!railFrom ? "Choose your boarding station." : !railTo ? `Board at ${railFrom.name}; choose an alighting station.` : `${railFrom.name} → ${railTo.name}`}</p>
              </div>
              <p className="sec-label">Mapped railway stations</p>
              <div style={{ position: "relative", margin: "7px 0 8px" }}><Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input data-page-search className="finput" style={{ paddingLeft: 32 }} placeholder="Search mapped railway stations…" value={railStationQuery} onChange={event => setRailStationQuery(event.target.value)} /></div>
              {visibleRailStations.map(station => <button key={station.id} className="card" onClick={() => selectRailStation(station)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 6, cursor: "pointer", color: "var(--white)" }}><TrainFront size={14} style={{ color: station.id === railFromId ? "var(--go)" : station.id === railToId ? "var(--stop)" : "var(--ready)" }} /><span style={{ flex: 1, fontSize: ".72rem" }}>{station.name}</span><span style={{ fontSize: ".56rem", color: "var(--muted2)" }}>{station.id === railFromId ? "Board" : station.id === railToId ? "Alight" : "Choose"}</span></button>)}
              {visibleRailStations.length === 0 && <p style={{ fontSize: ".65rem", color: "var(--muted2)" }}>{OSM_STATIONS.length ? "No stations match that search." : "No named station points in this OSM snapshot."}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
