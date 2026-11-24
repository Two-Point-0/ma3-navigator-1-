import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Navigation, X, ArrowRight, Lock, Box,
  MapPin, BusFront, TrainFront, Package,
  Calendar, AlarmClock, Zap, Eye, BadgeCheck, Footprints, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import maplibregl from "maplibre-gl";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import PageTabs from "@/components/PageTabs";
import LiveDriverMapLayer from "@/components/LiveDriverMapLayer";
import { useAuthContext } from "@/context/AuthContext";
import DemoVehicleLayer, { type DemoLeg } from "@/components/DemoVehicleLayer";
import ParcelPanel from "@/components/ParcelPanel";
import { hideSheets, showSheets, useSheet } from "@/lib/useSheet";
import { fetchWalkPath } from "@/lib/walkRoute";
import { railPathThrough } from "@/lib/railPath";
import { animateRoute } from "@/lib/routeAnim";
import { setLineLayer, setPointLayer, removeLineLayer, removePointLayer, setRouteLine, setLabelledStops, setStationIcons, fitAboveSheet, LabelledStop } from "@/lib/mapLayers";
import { classifyMotion, computeTripProgress, MOTION_LABEL, MOTION_TONE, stopsAlongRoute, MotionState } from "@/lib/tripProgress";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import {
  searchStops, planJourney, planDoorToDoor, nearestStops, getStop, StopMatch, JourneyOption,
} from "@/lib/journey";
import PlacePicker from "@/components/PlacePicker";
import { Place, stopToPlace } from "@/lib/places";
import { useRailNetwork, planRailTrip, RailTrip } from "@/lib/rail";
import { haversineKm, AVG_MATATU_SPEED_KMH } from "@/data/ma3_core";
import OSMRailways from "@/data/nairobi_railways_osm.json";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Panel = "search" | "planner" | "parcel" | "train" | null;

const NAIROBI: [number, number] = [-1.2864, 36.8172];
const ROUTES = MA3_GTFS.routes;
const SHAPES = MA3_GTFS.shapes as unknown as Record<string, [number, number][]>;
const STOPS_RAW = MA3_GTFS.stops as unknown as Record<string, [string, number, number]>;
const ROUTE_STOPS = MA3_GTFS.routeStops as Record<string, string[]>;
const MA3_TABS = [
  { id: "search", label: "Matatu", Icon: BusFront },
  { id: "parcel", label: "Parcel", Icon: Package },
  { id: "train", label: "Rail", Icon: TrainFront },
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

export default function Ma3Page() {
  const [, setLocation] = useLocation();
  const { user } = useAuthContext();
  const [panel, setPanel]           = useState<Panel>(null);
  const [query, setQuery]           = useState("");
  const [selRoute, setSelRoute]     = useState<typeof ROUTES[0] | null>(null);
  const [fromVal, setFromVal]       = useState("");
  const [toVal, setToVal]           = useState("");
  const [fromStop, setFromStop]     = useState<StopMatch | null>(null);
  const [toStop, setToStop]         = useState<StopMatch | null>(null);
  const [journeyOpts, setJourneyOpts] = useState<JourneyOption[] | null>(null);
  const [journeyCtx, setJourneyCtx] = useState<{ from: { lat: number; lon: number }; to: { lat: number; lon: number }; extra: [number, number][] } | null>(null);
  // Start and Stop can be any place: a stop, a landmark, a pinned spot on the map, or "my location".
  const [fromPlace, setFromPlace] = useState<Place | null>(null);
  const [toPlace, setToPlace] = useState<Place | null>(null);
  const fromDerived = useRef<string | null>(null);
  const toDerived = useRef<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [pickTarget, setPickTarget] = useState<"from" | "to" | "railFrom" | "railTo" | null>(null);
  const pickTargetRef = useRef<typeof pickTarget>(null);
  pickTargetRef.current = pickTarget;
  const railNet = useRailNetwork();
  const [railFromPlace, setRailFromPlace] = useState<Place | null>(null);
  const [railToPlace, setRailToPlace] = useState<Place | null>(null);
  const [railFromText, setRailFromText] = useState("");
  const [railToText, setRailToText] = useState("");
  const [railTrips, setRailTrips] = useState<RailTrip[] | null>(null);
  const [railPlanning, setRailPlanning] = useState(false);
  // After a search, scroll the answer into view so nobody has to hunt for it.
  useEffect(() => { if (!journeyOpts && !railTrips) return; const id = window.setTimeout(() => document.getElementById(panel === "train" ? "rail-results" : "journey-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 450); return () => window.clearTimeout(id); }, [journeyOpts, railTrips]);
  const [lockedStop, setLockedStop] = useState<{ stop: StopMatch; routeId: string; status: "waiting" | "walking"; expiresAt: string } | null>(null);
  const [trackedLeg, setTrackedLeg] = useState<JourneyOption["legs"][number] | null>(null);
  const [trackedPosition, setTrackedPosition] = useState<[number, number] | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState("");
  const arrivalAlerted = useRef(false);
  const [boarded, setBoarded] = useState(false);
  const [followMe, setFollowMe] = useState(false);
  const [trackedSpeed, setTrackedSpeed] = useState<number | null>(null);
  const lastFix = useRef<{ t: number; lat: number; lon: number } | null>(null);
  const speedEma = useRef<number | null>(null);
  const alertStage = useRef(0);
  const lastFrame = useRef<[number, number][] | null>(null);
  const coveredPx = useRef(0);
  const [is3D, setIs3D]             = useState(false);
  const [mapCenter, setMapCenter]   = useState<[number, number]>(NAIROBI);
  const [exploreDestination, setExploreDestination] = useState<{ name: string; lat: number; lon: number; stop: StopMatch; distanceKm: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [liveDriversEnabled, setLiveDriversEnabled] = useState(false);
  const [liveDriversStatus, setLiveDriversStatus] = useState("Live vehicles are off; this passenger phone's location is not shared.");
  const [savedJourneys, setSavedJourneys] = useState<{ label: string; from: StopMatch; to: StopMatch; time: string; days: string[] }[]>([]);
  const [saveForm, setSaveForm]     = useState(false);
  const [saveLabel, setSaveLabel]   = useState("");
  const [saveDays, setSaveDays]     = useState<string[]>([]);
  const [saveTime, setSaveTime]     = useState("07:30");
  const [showSaved, setShowSaved]   = useState(false);
  const sheet = useSheet("peek");
  const startPlace: Place | null = fromPlace && fromDerived.current === (fromStop?.id ?? null) ? fromPlace : fromStop ? stopToPlace(fromStop) : null;
  const endPlace: Place | null = toPlace && toDerived.current === (toStop?.id ?? null) ? toPlace : toStop ? stopToPlace(toStop) : null;
  const pickStart = (place: Place) => {
    const near = place.stopId ? getStop(place.stopId) : nearestStops(place.lat, place.lon, 1, 3)[0] ?? null;
    fromDerived.current = near?.id ?? null; setFromPlace(place); setFromStop(near); setFromVal(place.name); setJourneyOpts(null);
  };
  const pickEnd = (place: Place) => {
    const near = place.stopId ? getStop(place.stopId) : nearestStops(place.lat, place.lon, 1, 3)[0] ?? null;
    toDerived.current = near?.id ?? null; setToPlace(place); setToStop(near); setToVal(place.name); setJourneyOpts(null);
  };
  const typeStart = (value: string) => { setFromVal(value); if (!value) { setFromPlace(null); setFromStop(null); fromDerived.current = null; setJourneyOpts(null); setJourneyCtx(null); } };
  const typeEnd = (value: string) => { setToVal(value); if (!value) { setToPlace(null); setToStop(null); toDerived.current = null; setJourneyOpts(null); setJourneyCtx(null); } };
  const panelMinimized = sheet.minimized;
  coveredPx.current = panel ? sheet.height : 0;
  /** Zoom the map to show the given [lat, lon] points above the open panel. */
  const frameMap = useCallback((points: [number, number][]) => {
    const map = mapInst.current;
    if (!map || !points.length) return;
    lastFrame.current = points;
    fitAboveSheet(map, points.map(([lat, lon]) => [lon, lat] as [number, number]), coveredPx.current, 15);
  }, []);
  // When the panel is dragged taller or shorter, keep the whole trip in view above it.
  useEffect(() => { if (lastFrame.current && !followMe) frameMap(lastFrame.current); }, [sheet.snap, panel]);
  const setPanelMinimized = (value: boolean | ((current: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(sheet.minimized) : value;
    sheet.setSnap(next ? "peek" : "full");
  };
  const [railStationQuery, setRailStationQuery] = useState("");
  const [railPick, setRailPick] = useState(0);
  const visibleRailStations = useMemo(() => {
    const term = railStationQuery.trim().toLowerCase();
    return railNet.stations.filter(station => !term || station.name.toLowerCase().includes(term));
  }, [railStationQuery, railNet]);

  const mapRef         = useRef<MapLibreHandle>(null);
  const mapInst        = useRef<maplibregl.Map | null>(null);
  const staticMarkers  = useRef<maplibregl.Marker[]>([]);

  const searchResults: SearchResult[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Every word typed must appear somewhere (so "ngong rd cbd" works), and better matches float to the top:
    // exact route number first, then names that start with the text, then names that contain it.
    const words = q.split(/\s+/).filter(Boolean);
    const score = (text: string, exact: string) => {
      const hay = text.toLowerCase();
      if (!words.every(word => hay.includes(word))) return -1;
      if (hay === q || exact.toLowerCase() === q) return 3;
      return hay.startsWith(q) || exact.toLowerCase().startsWith(q) ? 2 : 1;
    };
    const routeMatches: SearchResult[] = ROUTES
      .map(route => ({ route, rank: score(`${route.sn} ${route.ln} ${route.hs}`, route.sn) }))
      .filter(item => item.rank > 0).sort((a, b) => b.rank - a.rank).slice(0, 12)
      .map(item => ({ kind: "route" as const, route: item.route }));
    const stopMatches: SearchResult[] = searchStops(query, 12).map(stop => ({ kind: "stop" as const, stop }));
    const railMatches: SearchResult[] = railNet.stations
      .map(station => ({ station, rank: score(station.name, station.name) }))
      .filter(item => item.rank > 0).sort((a, b) => b.rank - a.rank).slice(0, 8)
      .map(item => ({ kind: "rail" as const, station: item.station }));
    return [...routeMatches, ...stopMatches, ...railMatches];
  }, [query, railNet]);

  const paintToken = useRef(0);
  /** Draw a walk as a straight dashed line now, then swap in the real street path when it arrives. */
  const paintWalk = (map: maplibregl.Map, id: string, from: [number, number], to: [number, number]) => {
    setLineLayer(map, id, [from, to], "#94a3b8", 3, 0.95, true);
    const token = paintToken.current;
    void fetchWalkPath(from, to).then(path => {
      if (path && token === paintToken.current && mapInst.current === map) setLineLayer(map, id, path, "#94a3b8", 3, 0.95, true);
    });
  };

  const railAnim = useRef<(() => void)[]>([]);
  const clearStatic = useCallback(() => {
    paintToken.current++;
    railAnim.current.forEach(stop => stop());
    railAnim.current = [];
    const map = mapInst.current;
    if (!map) return;
    staticMarkers.current.forEach(m => m.remove());
    staticMarkers.current = [];
    ROUTES.forEach(r => {
      removeLineLayer(map, `route-${r.id}`);
    });
    Array.from({ length: 16 }, (_, i) => i).forEach(i => removeLineLayer(map, `journey-leg-${i}`));
    [0, 1, 2, 3].forEach(i => removeLineLayer(map, `rail-trip-${i}`));
    removePointLayer(map, "rail-trip-stations");
    if (map.getLayer("osm-rail-line")) map.removeLayer("osm-rail-line");
    if (map.getLayer("osm-rail-stations")) map.removeLayer("osm-rail-stations");
    if (map.getSource("osm-railways")) map.removeSource("osm-railways");
    removeLineLayer(map, "selected-rail-segment");
    removePointLayer(map, "selected-rail-stations");
    removePointLayer(map, "rail-stations-all");
    removePointLayer(map, "route-stops");
    removePointLayer(map, "planner-pts");
    removePointLayer(map, "journey-stops");
  }, []);

  const drawRoute = useCallback((map: maplibregl.Map, route: typeof ROUTES[0]) => {
    clearStatic();
    const shape = SHAPES[route.id];
    if (shape?.length) {
      setRouteLine(map, `route-${route.id}`, shape, route.c, 5, 0.95);
      const mid = shape[~~(shape.length / 2)];
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:${route.c};color:#fff;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;font-family:'DM Mono',monospace;box-shadow:0 2px 6px rgba(0,0,0,.4)">${route.sn}</div>`;
      staticMarkers.current.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([mid[1], mid[0]]).addTo(map));
    }
    const stopIds = ROUTE_STOPS[route.id] ?? [];
    const pts = stopIds.map((sid, i) => {
      const s = STOPS_RAW[sid];
      return s ? { id: sid, name: s[0], lat: s[1], lon: s[2], color: route.c, terminal: i === 0 || i === stopIds.length - 1 } : null;
    }).filter(Boolean) as LabelledStop[];
    setLabelledStops(map, "route-stops", pts);
    frameMap(shape?.length ? shape : pts.map(point => [point.lat, point.lon] as [number, number]));
  }, [clearStatic, frameMap]);

  /** Paint a "get to the station" part of a train trip: walks follow streets, matatu parts follow their route colour. */
  const paintAccessLegs = (map: maplibregl.Map, option: JourneyOption | null, base: number, points: [number, number][]) => {
    option?.legs.forEach((leg, i) => {
      const id = `journey-leg-${base + i}`;
      if (leg.type === "walk") { const line: [number, number][] = [[leg.fromStop.lat, leg.fromStop.lon], [leg.toStop.lat, leg.toStop.lon]]; paintWalk(map, id, line[0], line[1]); points.push(...line); return; }
      if (!leg.routeId) return;
      const segment = shapeBetweenStops(leg.routeId, leg.fromStop, leg.toStop);
      if (segment.length > 1) { setRouteLine(map, id, segment, leg.routeColor ?? "#d97706", 5, 0.95); points.push(...segment); }
    });
  };

  const drawRail = useCallback((map: maplibregl.Map, trip?: RailTrip, from?: Place | null, to?: Place | null) => {
    clearStatic();
    if (!trip) {
      // Only the stations the person has picked or searched for. The rest stay off the map.
      const picked = [from, to].filter((place): place is Place => Boolean(place?.stationId));
      if (picked.length) {
        setStationIcons(map, "rail-stations-all", picked.map(place => ({ id: place.stationId!, lat: place.lat, lon: place.lon, name: place.name.replace(/ station$/, ""), color: "#d97706" })));
        frameMap(picked.map(place => [place.lat, place.lon] as [number, number]));
      }
      return;
    }
    const points: [number, number][] = [];
    const stationPins: { id: string; lat: number; lon: number; name: string; color: string }[] = [];
    trip.rail.legs.forEach((leg, index) => {
      const path = railPathThrough(leg.stations);
      setLineLayer(map, `rail-trip-${index}`, path, leg.line.color, 5, .96); points.push(...path);
      railAnim.current.push(animateRoute(map, `rail-anim-${index}`, path.map(([lat, lon]) => [lon, lat] as [number, number]), { color: leg.line.color, kind: "train", dashes: false, seconds: Math.max(6, Math.min(16, path.length / 30)) }));
      leg.stations.forEach(station => stationPins.push({ id: `${leg.line.id}-${station.id}`, lat: station.lat, lon: station.lon, name: station.name, color: leg.line.color }));
    });
    setStationIcons(map, "rail-trip-stations", stationPins);
    if (trip.access) paintAccessLegs(map, trip.access, 0, points);
    else if (from && !(from.stationId && from.stationId === trip.board.id)) { const line: [number, number][] = [[from.lat, from.lon], [trip.board.lat, trip.board.lon]]; paintWalk(map, "journey-leg-0", line[0], line[1]); points.push(...line); }
    if (trip.egress) paintAccessLegs(map, trip.egress, 8, points);
    else if (to && !(to.stationId && to.stationId === trip.alight.id)) { const line: [number, number][] = [[trip.alight.lat, trip.alight.lon], [to.lat, to.lon]]; paintWalk(map, "journey-leg-8", line[0], line[1]); points.push(...line); }
    if (from && to) setPointLayer(map, "planner-pts", [{ id: "from", lat: from.lat, lon: from.lon, color: "#16a34a", radius: 10 }, { id: "to", lat: to.lat, lon: to.lon, color: "#dc2626", radius: 10 }], 10);
    frameMap(points);
  }, [clearStatic, railNet, frameMap]);

  // One place decides what is on the map, so the matatu lines and the train lines can never mix.
  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    clearStatic();
    if (panel === "train") {
      drawRail(map, railTrips ? railTrips[Math.min(railPick, railTrips.length - 1)] : undefined, railFromPlace, railToPlace);
    } else if (panel === "planner" && journeyOpts?.length && journeyCtx) {
      paintJourney(map, journeyOpts, journeyCtx.from, journeyCtx.to, journeyCtx.extra);
    } else if (panel && panel !== "parcel" && selRoute) {
      drawRoute(map, selRoute);
    }
  }, [panel, selRoute, mapReady, drawRail, railTrips, railPick, journeyOpts, journeyCtx]);

  /** Empty the matatu side of the map (route line, journey lines) so the page is blank for a fresh search. */
  const wipeMatatu = () => { setSelRoute(null); setJourneyOpts(null); setJourneyCtx(null); };
  /** Moving between Matatu, Parcel and Rail starts clean: nothing from the other tab stays on the map. */
  const switchTab = (value: "search" | "parcel" | "train") => {
    const group = (p: Panel) => (p === "train" ? "train" : p === "parcel" ? "parcel" : p ? "search" : null);
    if (group(panel) !== value) { wipeMatatu(); setRailTrips(null); clearStatic(); }
    setPanelMinimized(false); setPanel(value);
  };

  const handleMapLoad = (map: maplibregl.Map) => { mapInst.current = map; if (import.meta.env.DEV) (window as unknown as { __ma3map?: maplibregl.Map }).__ma3map = map; setMapReady(true); };

  useEffect(() => {
    if (!trackedLeg || !trackingActive) return;
    if (!navigator.geolocation) { setTrackingStatus("Location is not available on this device."); setTrackingActive(false); return; }
    setTrackingStatus("Waiting for your phone location…");
    lastFix.current = null; speedEma.current = null; setTrackedSpeed(null);
    const watchId = navigator.geolocation.watchPosition(position => {
      const { latitude, longitude } = position.coords;
      let speed = position.coords.speed;
      if ((speed === null || Number.isNaN(speed)) && lastFix.current) {
        const seconds = (position.timestamp - lastFix.current.t) / 1000;
        if (seconds > 0.5) speed = (haversineKm(lastFix.current.lat, lastFix.current.lon, latitude, longitude) * 1000) / seconds;
      }
      lastFix.current = { t: position.timestamp, lat: latitude, lon: longitude };
      if (speed !== null && Number.isFinite(speed)) { speedEma.current = speedEma.current === null ? speed : speedEma.current * 0.6 + speed * 0.4; setTrackedSpeed(speedEma.current); }
      setTrackedPosition([latitude, longitude]);
    }, () => {
      setTrackingStatus("Location permission is needed to follow your trip on the map.");
      setTrackingActive(false);
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackedLeg, trackingActive]);

  const trackedRoute = useMemo(() => trackedLeg?.routeId && trackedLeg.type === "matatu" ? shapeBetweenStops(trackedLeg.routeId, trackedLeg.fromStop, trackedLeg.toStop) : [], [trackedLeg]);
  const trackedStops = useMemo(() => {
    if (!trackedLeg?.routeId || trackedRoute.length < 2) return [];
    const candidates = (ROUTE_STOPS[trackedLeg.routeId] ?? []).flatMap(id => { const stop = STOPS_RAW[id]; return stop ? [{ id, name: stop[0], lat: stop[1], lon: stop[2] }] : []; });
    return stopsAlongRoute(trackedRoute, candidates, trackedLeg.fromStop, trackedLeg.toStop);
  }, [trackedLeg, trackedRoute]);
  const progress = useMemo(() => computeTripProgress(trackedRoute, trackedStops, trackedPosition), [trackedRoute, trackedStops, trackedPosition]);
  const moveState: MotionState = trackingActive ? classifyMotion(trackedSpeed) : "unknown";
  const tabTone = trackingActive ? MOTION_TONE[moveState] : "idle";

  // Draw the leg once: outlined line with direction arrows, every stop named along it, whole trip in view.
  useEffect(() => {
    const map = mapInst.current;
    if (!mapReady || !map) return;
    if (!trackedLeg?.routeId || trackedLeg.type !== "matatu") {
      removeLineLayer(map, "tracked-journey-route"); removeLineLayer(map, "tracked-journey-progress"); removePointLayer(map, "tracked-journey-points"); removePointLayer(map, "tracked-journey-stops");
      return;
    }
    if (trackedRoute.length < 2) { setTrackingStatus("No mapped route shape is available for this leg."); return; }
    setRouteLine(map, "tracked-journey-route", trackedRoute, trackedLeg.routeColor ?? "#d97706", 5, .6);
    setFollowMe(false);
    frameMap(trackedRoute);
  }, [mapReady, trackedLeg, trackedRoute, frameMap]);

  // Once on board, tell the driver (anonymously) which stop you get off at.
  const alightShared = useRef<string | null>(null);
  useEffect(() => {
    const routeId = trackedLeg?.routeId;
    if (boarded && routeId && trackedLeg && supabase && user?.phone_confirmed_at) {
      void supabase.rpc("set_my_ma3_alighting", { p_route_id: routeId, p_stop_id: trackedLeg.toStop.id }).then(({ error }) => {
        if (error) { console.warn("Driver was not told your stop", error.message); return; }
        alightShared.current = routeId; toast(`Driver told: someone is getting off at ${trackedLeg.toStop.name}.`);
      });
      return;
    }
    if (alightShared.current && supabase) { void supabase.rpc("cancel_my_ma3_alighting", { p_route_id: alightShared.current }); alightShared.current = null; }
  }, [boarded, trackedLeg, user?.phone_confirmed_at]);

  // Update the moving dot, the progress line and the greyed-out passed stops.
  useEffect(() => {
    const map = mapInst.current;
    if (!mapReady || !map || !trackedLeg?.routeId || trackedRoute.length < 2 || !progress) return;
    const routeColor = trackedLeg.routeColor ?? "#d97706";
    setLabelledStops(map, "tracked-journey-stops", trackedStops.map((stop, index) => ({
      id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon, color: routeColor,
      terminal: index === 0 || index === trackedStops.length - 1, passed: progress.passedIds.has(stop.id) && index !== trackedStops.length - 1,
    })));
    const location = trackedPosition;
    if (!location) {
      setPointLayer(map, "tracked-journey-points", [
        { id: "board-stop", lat: trackedLeg.fromStop.lat, lon: trackedLeg.fromStop.lon, color: "#16a34a", radius: 8 },
        { id: "alight-stop", lat: trackedLeg.toStop.lat, lon: trackedLeg.toStop.lon, color: "#dc2626", radius: 8 },
      ], 8);
      return;
    }
    const nearest = trackedRoute.findIndex(point => point[0] === progress.snapped[0] && point[1] === progress.snapped[1]);
    setLineLayer(map, "tracked-journey-progress", trackedRoute.slice(0, Math.max(1, nearest) + 1), routeColor, 7, 1);
    const dotColor = moveState === "moving" ? "#16a34a" : moveState === "stopped" ? "#dc2626" : "#d97706";
    setPointLayer(map, "tracked-journey-points", [
      { id: "phone-location", lat: progress.snapped[0], lon: progress.snapped[1], color: dotColor, radius: 9 },
      { id: "alight-stop", lat: trackedLeg.toStop.lat, lon: trackedLeg.toStop.lon, color: "#dc2626", radius: 8 },
    ], 8);
    setTrackingStatus(progress.offRouteKm > 1.5 ? "You appear off this archived route; the dot is snapped to the nearest route point." : boarded ? `On board · get off at ${trackedLeg.toStop.name}` : `Follow your phone to ${trackedLeg.fromStop.name}, then board.`);
    if (followMe) map.easeTo({ center: [progress.snapped[1], progress.snapped[0]], duration: 550 });
    // Auto-detect boarding: moving at vehicle speed, along the route, away from the start.
    if (!boarded && progress.offRouteKm < 0.3 && progress.travelledKm > 0.2 && (trackedSpeed ?? 0) >= 2.5) {
      setBoarded(true); toast("Looks like you are on board. I will tell you when to get off.");
    }
    if (boarded && alertStage.current < 1 && progress.stopsLeft <= 1 && progress.remainingKm > 0.15) {
      alertStage.current = 1; toast(`Next stop is yours: ${trackedLeg.toStop.name}. Get ready to get off.`); try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
    }
    if (haversineKm(location[0], location[1], trackedLeg.toStop.lat, trackedLeg.toStop.lon) <= .15 && !arrivalAlerted.current) {
      arrivalAlerted.current = true; alertStage.current = 2; setBoarded(false); setTrackingStatus(`Near ${trackedLeg.toStop.name}, your selected stop.`); setTrackingActive(false); toast(`You are at ${trackedLeg.toStop.name}. Get off now.`); try { navigator.vibrate?.([400, 150, 400, 150, 400]); } catch { /* not supported */ }
    }
  }, [mapReady, trackedLeg, trackedRoute, trackedStops, progress, trackedPosition, boarded, followMe, moveState, trackedSpeed]);

  useEffect(() => {
    const map = mapInst.current;
    if (!mapReady || !map || !exploreDestination) return;
    setPointLayer(map, "explore-destination", [
      { id: "nearest-ma3-stop", lat: exploreDestination.stop.lat, lon: exploreDestination.stop.lon, color: "#16a34a", radius: 7 },
      { id: "destination", lat: exploreDestination.lat, lon: exploreDestination.lon, color: "#dc2626", radius: 9 },
    ], 7);
    setLineLayer(map, "explore-walk-approx", [[exploreDestination.stop.lat, exploreDestination.stop.lon], [exploreDestination.lat, exploreDestination.lon]], "#16a34a", 3, .9, true);
    frameMap([[exploreDestination.stop.lat, exploreDestination.stop.lon], [exploreDestination.lat, exploreDestination.lon]]);
  }, [mapReady, exploreDestination]);

  const selectRoute = (route: typeof ROUTES[0]) => {
    setSelRoute(route); setPanelMinimized(true);
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
      // If the phone shares its location, plan the whole trip now and zoom out to show all of it.
      if (nearest.distance <= 30 && navigator.geolocation) navigator.geolocation.getCurrentPosition(position => {
        const here = Object.entries(STOPS_RAW).map(([id, st]) => ({ id, name: st[0], lat: st[1], lon: st[2], d: haversineKm(position.coords.latitude, position.coords.longitude, st[1], st[2]) })).sort((a, b) => a.d - b.d)[0];
        if (!here || here.id === stop.id) return;
        const origin: StopMatch = { id: here.id, name: here.name, lat: here.lat, lon: here.lon };
        setFromStop(origin); setFromVal(`Near ${origin.name}`);
        runJourney(origin, stop, [[destination.lat!, destination.lon!], [position.coords.latitude, position.coords.longitude]]);
        toast(`Trip planned from near ${origin.name} to ${destination.name}.`);
      }, () => { /* no location: the rider picks a start */ }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
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

  const stationToPlace = (station: { id: string; name: string; lat: number; lon: number }): Place => ({ id: `rail-${station.id}`, kind: "rail", name: `${station.name} station`, lat: station.lat, lon: station.lon, stationId: station.id });
  const selectRailStation = (station: { id: string; name: string; lat: number; lon: number }) => {
    setQuery(station.name);
    setMapCenter([station.lat, station.lon]);
    mapRef.current?.flyTo(station.lon, station.lat, 14);
    setPanel("train");
    setPanelMinimized(false);
    const place = stationToPlace(station);
    if (!railFromPlace || railToPlace) { setRailFromPlace(place); setRailFromText(place.name); setRailToPlace(null); setRailToText(""); }
    else if (place.stationId !== railFromPlace.stationId) { setRailToPlace(place); setRailToText(place.name); }
    setRailTrips(null);
  };

  const findRailTrip = () => {
    if (!railFromPlace || !railToPlace) { toast("Choose a Start and a Stop (destination) first."); return; }
    setRailPlanning(true); setRailTrips(null);
    setTimeout(() => {
      try {
        const trips = planRailTrip(railNet,
          { name: railFromPlace.name, lat: railFromPlace.lat, lon: railFromPlace.lon, stationId: railFromPlace.stationId },
          { name: railToPlace.name, lat: railToPlace.lat, lon: railToPlace.lon, stationId: railToPlace.stationId });
        if (!trips.length) { toast("No train connection between those places yet. Try the Matatu tab."); return; }
        setRailPick(0); setRailTrips(trips); setPanelMinimized(false); sheet.setSnap("half");
      } finally { setRailPlanning(false); }
    }, 40);
  };

  // Drop a pin anywhere on the map: I find the nearest stop to it and to you, and plan the matatu trip.
  const [pickMode, setPickMode] = useState(false);
  const pickModeRef = useRef(false);
  pickModeRef.current = pickMode;
  const nearestStopTo = (lat: number, lon: number): (StopMatch & { km: number }) | null => {
    const best = Object.entries(STOPS_RAW).map(([id, st]) => ({ id, name: st[0], lat: st[1], lon: st[2], km: haversineKm(lat, lon, st[1], st[2]) })).sort((a, b) => a.km - b.km)[0];
    return best ?? null;
  };
  const startMapPick = (target: "from" | "to" | "railFrom" | "railTo") => {
    setPickTarget(target); hideSheets();
    toast(target === "from" || target === "railFrom" ? "Tap the map where you are starting." : "Tap the map where you want to go.");
  };
  const handleMapTap = (lng: number, lat: number) => {
    const target = pickTargetRef.current;
    if (target) {
      setPickTarget(null); showSheets();
      const near = nearestStops(lat, lng, 1, 3)[0];
      const place: Place = { id: `pin-${lat.toFixed(5)}-${lng.toFixed(5)}`, kind: "pin", name: near ? `Pinned spot near ${near.name}` : "Pinned spot", lat, lon: lng };
      const map = mapInst.current;
      if (map) setPointLayer(map, "pin-destination", [{ id: "pin", lat, lon: lng, color: target === "from" || target === "railFrom" ? "#16a34a" : "#dc2626", radius: 10 }], 10);
      if (target === "from") pickStart(place);
      else if (target === "to") pickEnd(place);
      else if (target === "railFrom") { setRailFromPlace(place); setRailFromText(place.name); setRailTrips(null); }
      else { setRailToPlace(place); setRailToText(place.name); setRailTrips(null); }
      return;
    }
    if (!pickModeRef.current) return;
    setPickMode(false); showSheets();
    const map = mapInst.current;
    if (map) setPointLayer(map, "pin-destination", [{ id: "pin", lat, lon: lng, color: "#dc2626", radius: 10 }], 10);
    const destinationStop = nearestStopTo(lat, lng);
    if (!destinationStop || destinationStop.km > 3) { toast("No archived Ma3 stop within 3 km of that pin. Try a pin closer to a main road."); return; }
    setToStop(destinationStop); setToVal(`Pin · near ${destinationStop.name}`);
    if (!navigator.geolocation) { toast("Pin saved. Choose your From stop to plan the trip."); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const origin = nearestStopTo(position.coords.latitude, position.coords.longitude);
      if (!origin || origin.id === destinationStop.id) { toast("You are already by that stop."); return; }
      setFromStop(origin); setFromVal(`Near ${origin.name}`);
      runJourney(origin, destinationStop, [[lat, lng], [position.coords.latitude, position.coords.longitude]]);
      toast(`Best matatu trip planned: ${origin.name} to ${destinationStop.name}.`);
    }, () => toast("Pin saved. Allow location, or choose your From stop, to plan the trip."), { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  };

  /** Paints the chosen journey on the map. Called from the effect below, so a tab change can never wipe or keep the wrong lines. */
  const paintJourney = (map: maplibregl.Map, opts: JourneyOption[], from: { lat: number; lon: number }, to: { lat: number; lon: number }, extraPoints: [number, number][] = []) => {
    const allPoints: [number, number][] = [[from.lat, from.lon], [to.lat, to.lon], ...extraPoints];
    const journeyStops: LabelledStop[] = [];
    opts[0]?.legs.forEach((leg, i) => {
      if (leg.type === "walk") {
        const line: [number, number][] = [[leg.fromStop.lat, leg.fromStop.lon], [leg.toStop.lat, leg.toStop.lon]];
        paintWalk(map, `journey-leg-${i}`, line[0], line[1]); allPoints.push(...line);
        return;
      }
      if (!leg.routeId) return;
      const segment = shapeBetweenStops(leg.routeId, leg.fromStop, leg.toStop);
      if (segment.length > 1) { setRouteLine(map, `journey-leg-${i}`, segment, leg.routeColor ?? "#d97706", 5, 0.95); allPoints.push(...segment); }
      const candidates = (ROUTE_STOPS[leg.routeId] ?? []).flatMap(id => { const stop = STOPS_RAW[id]; return stop ? [{ id, name: stop[0], lat: stop[1], lon: stop[2] }] : []; });
      const named = stopsAlongRoute(segment, candidates, leg.fromStop, leg.toStop);
      named.forEach((stop, index) => journeyStops.push({ id: `${leg.routeId}-${stop.id}`, name: stop.name, lat: stop.lat, lon: stop.lon, color: leg.routeColor ?? "#d97706", terminal: index === 0 || index === named.length - 1 }));
    });
    if (journeyStops.length) setLabelledStops(map, "journey-stops", journeyStops);
    setPointLayer(map, "planner-pts", [
      { id: "from", lat: from.lat, lon: from.lon, color: "#16a34a", radius: 10 },
      { id: "to",   lat: to.lat,   lon: to.lon,   color: "#dc2626", radius: 10 },
    ], 10);
    frameMap(allPoints);
  };


  const drawJourney = (opts: JourneyOption[], from: { lat: number; lon: number }, to: { lat: number; lon: number }, extraPoints: [number, number][] = []) => {
    setSelRoute(null); setRailTrips(null);
    setJourneyCtx({ from, to, extra: extraPoints });
    setJourneyOpts(opts); setPanel("planner"); setPanelMinimized(false); sheet.setSnap("half");
    setMapCenter([from.lat, from.lon]);
  };

  const runJourney = (from: StopMatch, to: StopMatch, extraPoints: [number, number][] = []) => {
    const opts = planJourney(from.id, to.id);
    if (!opts.length) { toast("No route found. Try nearby stops."); return; }
    drawJourney(opts, from, to, extraPoints);
  };

  /** Start to Stop between ANY two places: the app finds the nearby stops, the matatus, the changes and the walking. */
  const runPlaces = (a: Place, b: Place) => {
    setPlanning(true); setJourneyOpts(null);
    setTimeout(() => {
      try {
        const opts = planDoorToDoor(a, b);
        if (!opts.length) { toast("No matatu connection found between those places yet. Try a spot closer to a main road."); return; }
        drawJourney(opts, a, b);
      } finally { setPlanning(false); }
    }, 40);
  };

  const findJourney = () => {
    if (!startPlace || !endPlace) { toast("Choose a Start and a Stop (destination) first."); return; }
    runPlaces(startPlace, endPlace);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast("Location is not available in this browser"); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude, lon = position.coords.longitude;
      pickStart({ id: "me", kind: "me", name: "My location", lat, lon });
      setMapCenter([lat, lon]); mapRef.current?.flyTo(lon, lat, 15);
      toast("Your location is set as the Start.");
    }, () => toast("Location permission was not granted"), { enableHighAccuracy: true, timeout: 10000 });
  };

  const lockIn = async (leg: JourneyOption["legs"][number]) => {
    if (!leg.routeId) { toast("Choose a matatu leg before marking a pickup stop."); return; }
    const client = supabase;
    if (!isSupabaseConfigured || !client) { toast("Connect Supabase before sharing pickup demand."); return; }
    if (!user?.phone_confirmed_at) { toast("Verify your phone number before sharing pickup demand."); setLocation("/login"); return; }
    try {
      const { data, error } = await client.rpc("set_my_ma3_stop_intent", { p_route_id: leg.routeId, p_stop_id: leg.fromStop.id, p_status: "waiting", p_latitude: null, p_longitude: null, p_accuracy_m: null });
      if (error) throw error;
      setLockedStop({ stop: leg.fromStop, routeId: leg.routeId, status: "waiting", expiresAt: String(data) });
      toast(`${leg.fromStop.name} shared as an anonymous waiting count for 30 minutes.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not share your pickup stop. Check the Supabase setup.");
    }
  };

  const markWalkingToStop = () => {
    if (!lockedStop) return;
    if (!user?.phone_confirmed_at) { toast("Verify your phone number before sharing pickup demand."); setLocation("/login"); return; }
    if (!navigator.geolocation) { toast("One-time location checking is not available in this browser."); return; }
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude, accuracy } = position.coords;
      if (accuracy > 100) { toast("GPS accuracy is too low. Try again outdoors with precise location enabled."); return; }
      const distanceKm = haversineKm(latitude, longitude, lockedStop.stop.lat, lockedStop.stop.lon);
      if (distanceKm > 0.8) { toast(`You are about ${Math.round(distanceKm * 1000)} m from ${lockedStop.stop.name}; walking status starts within 800 m.`); return; }
      const client = supabase;
      if (!isSupabaseConfigured || !client) { toast("Connect Supabase before sharing walking status."); return; }
      try {
        const { data, error } = await client.rpc("set_my_ma3_stop_intent", { p_route_id: lockedStop.routeId, p_stop_id: lockedStop.stop.id, p_status: "walking", p_latitude: latitude, p_longitude: longitude, p_accuracy_m: accuracy });
        if (error) throw error;
        setLockedStop(current => current ? { ...current, status: "walking", expiresAt: String(data) } : current);
        toast(`Walking-to-stop count shared for ${lockedStop.stop.name}. Your exact location is not stored.`);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not confirm walking status.");
      }
    }, error => toast(error.code === error.PERMISSION_DENIED ? "Allow one-time location access to confirm walking proximity." : "Could not get a reliable location fix; try again."), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  };

  const cancelStopWaiting = async () => {
    if (!lockedStop || !supabase) { setLockedStop(null); return; }
    const { error } = await supabase.rpc("cancel_my_ma3_stop_waiting", { p_route_id: lockedStop.routeId, p_stop_id: lockedStop.stop.id });
    if (error) { toast("Could not remove the pickup request yet."); return; }
    setLockedStop(null); toast("Pickup request removed.");
  };

  const openPanel = (p: Panel) => { setPanelMinimized(false); setPanel(prev => prev === p ? null : p); };
  const pitch = is3D ? 52 : 0;
  const bearing = is3D ? -14 : 0;

  const demoLegs = useMemo<DemoLeg[]>(() => {
    if (panel === "train") return [];
    if (panel === "planner" && journeyOpts?.[0]) {
      return journeyOpts[0].legs.filter(l => l.type === "matatu" && l.routeId).map(l => ({ routeId: l.routeId!, fromId: l.fromStop.id, toId: l.toStop.id, fromName: l.fromStop.name }));
    }
    return selRoute ? [{ routeId: selRoute.id }] : [];
  }, [panel, journeyOpts, selRoute]);

  return (
    <div style={{ position: "relative", height: "calc(100dvh - var(--top-h) - var(--nav-h))", marginTop: "-12px" }}>
      <MapLibreView ref={mapRef} center={mapCenter} zoom={12} pitch={pitch} bearing={bearing}
        height="100%" borderRadius={0} onLoad={handleMapLoad} onClick={handleMapTap} />
      <DemoVehicleLayer map={mapReady ? mapInst.current : null} legs={demoLegs} />
      <LiveDriverMapLayer map={mapReady ? mapInst.current : null} routeId={selRoute?.id ?? null}
        enabled={liveDriversEnabled} phoneVerified={Boolean(user?.phone_confirmed_at)} onStatus={setLiveDriversStatus} />

      <div style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 50 }}>
        <PageTabs label="Ma3 sections" tone={tabTone} active={panel === "parcel" || panel === "train" ? panel : panel ? "search" : ""} tabs={MA3_TABS}
          onChange={value => switchTab(value as "search" | "parcel" | "train")} />
      </div>

      {/* ══════ UNIFIED SEARCH PANEL ══════ */}
      <AnimatePresence>
        {panel === "search" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            {...sheet.panelProps}>
            <div className="bpanel-head">
              <button {...sheet.gripProps} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} />
                  <input data-page-search autoFocus className="finput" style={{ paddingLeft: 32 }}
                    placeholder="Route number, route name, or stop… e.g. 23W, Rongai, Kencom"
                    value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value) { setSelRoute(null); clearStatic(); } }} />
                  {query && (
                    <button onClick={() => { setQuery(""); setSelRoute(null); clearStatic(); }}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <button className={`btn ${pickMode ? "btn-go" : "btn-ready"}`} style={{ marginTop: 8, padding: "8px 12px", fontSize: ".64rem" }}
                onClick={() => { setPickMode(value => !value); if (!pickMode) { toast("Tap the map where you want to go."); hideSheets(); } else showSheets(); }}>
                <MapPin size={13} /> {pickMode ? "Tap the map now…" : "Drop a pin to where you are going"}
              </button>
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
                    <button className={liveDriversEnabled ? "btn btn-ready" : "btn btn-ghost"} style={{ width: "100%", marginTop: 7, justifyContent: "center", fontSize: ".64rem", padding: 8 }}
                      aria-pressed={liveDriversEnabled}
                      onClick={() => { if (!user?.phone_confirmed_at) { setLocation("/login"); return; } setLiveDriversEnabled(value => !value); }}>
                      {liveDriversEnabled ? "Hide live vehicles" : "Show live vehicles on this route"}
                    </button>
                    <p style={{ margin: "5px 0 0", fontSize: ".57rem", color: "var(--muted2)", lineHeight: 1.4 }}>{liveDriversStatus} This does not share passenger GPS.</p>
                  </div>
                </motion.div>
              )}
              {exploreDestination && !panelMinimized && <div className="ios-glass" style={{ padding: 9, marginTop: 8, fontSize: ".59rem", color: "var(--muted2)" }}>Destination: {exploreDestination.name}. Green dashed line is a straight-line approximation to the nearest archived stop ({exploreDestination.distanceKm.toFixed(1)} km), not a pedestrian route.{exploreDestination.distanceKm > 30 && <><p style={{ margin: "6px 0" }}>Outside the mapped Ma3 coverage; check available flight options instead.</p><button className="btn btn-ready" style={{ width: "100%" }} onClick={() => { sessionStorage.setItem("ma3_fly_destination", JSON.stringify({ name: exploreDestination.name, lat: exploreDestination.lat, lon: exploreDestination.lon })); setLocation("/fly"); }}>Open Fly with destination</button></>}</div>}
              {!panelMinimized && !query.trim() && (
                <div className="ios-glass" style={{ marginTop: 8, padding: 10 }}>
                  <p className="sec-label" style={{ marginBottom: 7 }}>Plan your trip: Start to Stop</p>
                  <div style={{ display: "grid", gap: 8 }}>
                    <PlacePicker text={fromVal} onText={typeStart} onPlace={pickStart} color="var(--go)" placeholder="Start: a stop, a place, or my location" onPickOnMap={() => startMapPick("from")} />
                    <PlacePicker text={toVal} onText={typeEnd} onPlace={pickEnd} color="var(--stop)" placeholder="Stop (where you are going)" onPickOnMap={() => startMapPick("to")} />
                    <button className="btn btn-go" style={{ width: "100%", padding: 9, justifyContent: "center", fontSize: ".7rem" }} onClick={findJourney} disabled={planning}>
                      {planning ? <><Loader2 size={12} className="spin" /> Finding your best way…</> : <><Navigation size={12} /> Show me the way</>}
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
            {...sheet.panelProps}>
            <div className="bpanel-head">
              <button {...sheet.gripProps} />
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
                      <label style={{ marginBottom: 4, display: "block" }}>1 · Start</label>
                      <PlacePicker text={fromVal} onText={typeStart} onPlace={pickStart} color="var(--go)" placeholder="Where are you starting?" onPickOnMap={() => startMapPick("from")} />
                    </div>
                    <div>
                      <label style={{ marginBottom: 4, display: "block" }}>2 · Stop (destination)</label>
                      <PlacePicker text={toVal} onText={typeEnd} onPlace={pickEnd} color="var(--stop)" placeholder="Where are you going?" onPickOnMap={() => startMapPick("to")} />
                    </div>
                    <button className="btn btn-stop" style={{ width: "100%", padding: 11, justifyContent: "center", fontSize: ".78rem", marginTop: 4 }} onClick={findJourney} disabled={planning}>
                      {planning ? <><Loader2 size={13} className="spin" /> Finding your best way…</> : <><Search size={13} /> FIND MY WAY</>}
                    </button>
                  </div>

                  <AnimatePresence>
                    {journeyOpts && (
                      <div id="journey-results">
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
                              {opt.legs.find(leg => leg.type === "matatu") && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "rgba(22,163,74,.06)", borderRadius: 8, marginBottom: 8 }}>
                                  <BadgeCheck size={12} style={{ color: "var(--go)", flexShrink: 0 }} />
                                  <p style={{ fontSize: ".62rem", color: "var(--muted2)" }}>
                                    Board route <strong style={{ color: "var(--go)" }}>{opt.legs.find(leg => leg.type === "matatu")?.routeShortName}</strong> at the stop <strong>{opt.legs.find(leg => leg.type === "matatu")?.fromStop.name}</strong>; change as shown if needed.
                                  </p>
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn btn-go" style={{ flex: 1, padding: 8, fontSize: ".7rem", justifyContent: "center" }} onClick={() => { const firstMatatu = opt.legs.find(leg => leg.type === "matatu"); if (firstMatatu) void lockIn(firstMatatu); }} disabled={!opt.legs.some(leg => leg.type === "matatu")}>
                                  <Lock size={11} /> Share pickup
                                </button>
                                <button className="btn btn-ghost" style={{ flex: 1, padding: 8, fontSize: ".7rem", justifyContent: "center" }} onClick={() => { const firstMatatu = opt.legs.find(leg => leg.type === "matatu"); if (!firstMatatu) return; arrivalAlerted.current = false; alertStage.current = 0; setBoarded(false); setTrackedPosition(null); setTrackedLeg(firstMatatu); setTrackingActive(true); setPanelMinimized(true); toast("Allow location access to follow your phone along the mapped route."); }} disabled={!opt.legs.some(leg => leg.type === "matatu")}>
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
                        <p style={{ fontSize: ".61rem", color: "var(--muted2)", lineHeight: 1.5 }}>{lockedStop.status === "walking" ? "Walking intent is shared as an anonymous count for 10 minutes. A one-time GPS fix was checked against an 800 m straight-line radius; exact coordinates are not stored or shown to drivers." : "Your selected stop is shared as a self-reported anonymous waiting count for 30 minutes. Drivers cannot see your account or phone location."}</p>
                        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8, justifyContent: "center", fontSize: ".64rem", padding: 8 }} onClick={markWalkingToStop}>
                          <Navigation size={11} /> {lockedStop.status === "walking" ? "Refresh walking status" : "I’m walking to this stop"}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {trackedLeg && <div className="ios-glass" style={{ marginBottom: 8, padding: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: trackingActive ? (moveState === "moving" ? "var(--go)" : moveState === "stopped" ? "var(--stop)" : "var(--ready)") : "var(--muted2)", boxShadow: trackingActive ? "0 0 8px currentColor" : "none" }} />
                      <b style={{ flex: 1, fontSize: ".68rem" }}>{trackingActive ? `${MOTION_LABEL[moveState]}${trackedSpeed !== null && moveState !== "unknown" ? ` · ${Math.round(trackedSpeed * 3.6)} km/h` : ""}` : "Trip paused"}</b>
                      <button className="icon-btn" aria-label="Stop following ride" onClick={() => { setTrackingActive(false); setTrackedLeg(null); setTrackedPosition(null); setBoarded(false); }}><X size={13} /></button>
                    </div>
                    <p style={{ margin: "7px 0 2px", fontSize: ".8rem", fontWeight: 800 }}>Get off at {trackedLeg.toStop.name}</p>
                    {progress && <p style={{ margin: 0, fontSize: ".66rem", color: "var(--muted2)" }}>
                      {boarded || !trackedPosition ? `${progress.stopsLeft} stop${progress.stopsLeft === 1 ? "" : "s"} to go · ${progress.remainingKm.toFixed(1)} km left · about ${Math.max(1, Math.round(progress.remainingKm / AVG_MATATU_SPEED_KMH * 60))} min` : `${Math.round(haversineKm(trackedPosition[0], trackedPosition[1], trackedLeg.fromStop.lat, trackedLeg.fromStop.lon) * 1000)} m to ${trackedLeg.fromStop.name}, where you board`}
                    </p>}
                    {progress && boarded && progress.upcoming.length > 0 && <p style={{ margin: "6px 0 0", fontSize: ".62rem" }}><span style={{ color: "var(--muted2)" }}>Coming up: </span>{progress.upcoming.map((stop, index) => <span key={stop.id}>{index ? " › " : ""}<b>{stop.name}</b></span>)}</p>}
                    <p style={{ margin: "6px 0 0", fontSize: ".6rem", color: "var(--muted2)" }}>{trackingStatus}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {!boarded && <button className="btn btn-go" style={{ flex: 1, padding: 7, fontSize: ".62rem", justifyContent: "center" }} onClick={() => { setBoarded(true); toast("On board. I will tell you when to get off."); }}>I am on board</button>}
                      <button className="btn btn-ready" style={{ flex: 1, padding: 7, fontSize: ".62rem", justifyContent: "center" }} onClick={() => { if (followMe) { setFollowMe(false); frameMap(trackedRoute); } else { setFollowMe(true); if (progress) mapRef.current?.flyTo(progress.snapped[1], progress.snapped[0], 15); } }}>{followMe ? "Show whole trip" : "Follow me"}</button>
                    </div>
                    <p style={{ marginTop: 6, fontSize: ".54rem", lineHeight: 1.45, color: "var(--muted2)" }}>Uses your phone's location against the archived route shape. It does not show the driver's live location or guarantee current service. Times are estimates.</p>
                  </div>}
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
                          onClick={() => { pickStart(stopToPlace(j.from)); pickEnd(stopToPlace(j.to)); setShowSaved(false); runPlaces(stopToPlace(j.from), stopToPlace(j.to)); }}>
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

      {/* ══════ PARCEL DELIVERY PANEL ══════ */}
      <AnimatePresence>
        {panel === "parcel" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            {...sheet.panelProps}>
            <div className="bpanel-head">
              <button {...sheet.gripProps} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Package size={15} style={{ color: "var(--ready)" }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 900 }}>Parcel delivery</span>
                  <span className="chip" style={{ background: "rgba(217,119,6,.1)", color: "var(--ready)", border: "1px solid rgba(217,119,6,.25)", fontSize: ".56rem" }}>DEMO · NO PAYMENT</span>
                </div>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
            </div>
            <div className="bpanel-scroll" style={{ padding: "0 14px 24px" }}>
              <ParcelPanel routes={ROUTES} routeStops={ROUTE_STOPS} stops={STOPS_RAW}
                onRoutePicked={id => setSelRoute(id ? ROUTES.find(r => r.id === id) ?? null : null)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ TRAIN PANEL ══════ */}
      <AnimatePresence>
        {panel === "train" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            {...sheet.panelProps}>
            <div className="bpanel-head">
              <button {...sheet.gripProps} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <TrainFront size={15} style={{ color: "var(--ready)" }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 900 }}>Rail</span>
                </div>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <p style={{ margin: "7px 0 0", fontSize: ".59rem", color: "var(--muted2)", lineHeight: 1.45 }}>Pick where you start and where you are going. I connect the matatu or walk to the train station, the train, and the way on to your stop.</p>
            </div>
            <div className="bpanel-scroll" style={{ padding: "0 14px 24px" }}>
              <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                <PlacePicker text={railFromText} onText={value => { setRailFromText(value); if (!value) { setRailFromPlace(null); setRailTrips(null); } }}
                  onPlace={place => { setRailFromPlace(place); setRailFromText(place.name); setRailTrips(null); }} color="var(--go)" placeholder="Start: a station, a place, or my location" onPickOnMap={() => startMapPick("railFrom")} />
                <PlacePicker text={railToText} onText={value => { setRailToText(value); if (!value) { setRailToPlace(null); setRailTrips(null); } }}
                  onPlace={place => { setRailToPlace(place); setRailToText(place.name); setRailTrips(null); }} color="var(--stop)" placeholder="Stop (where you are going)" onPickOnMap={() => startMapPick("railTo")} />
                <button className="btn btn-go" style={{ width: "100%", padding: 10, justifyContent: "center", fontSize: ".72rem" }} onClick={findRailTrip} disabled={railPlanning}>
                  {railPlanning ? <><Loader2 size={12} className="spin" /> Finding your best way…</> : <><TrainFront size={12} /> Show me the train way</>}
                </button>
              </div>

              {railTrips && <div id="rail-results" />}
              {railTrips && railTrips.map((trip, index) => {
                const walkOnlyKm = (option: JourneyOption | null) => option && option.legs.every(leg => leg.type === "walk") ? option.totalDistanceKm : 0;
                const longWalk = (option: JourneyOption | null) => walkOnlyKm(option) > 1.2;
                const goNdai = (pickup: string, dest: string) => setLocation(`/ndai?pickup=${encodeURIComponent(pickup)}&dest=${encodeURIComponent(dest)}`);
                const connectRow = (label: string, option: JourneyOption | null, pickup: Place | null, dest: Place | null) => option && longWalk(option) ? (
                  <div style={{ ...stepStyle, flexDirection: "column", alignItems: "stretch", gap: 6, background: "rgba(217,119,6,.08)" }}>
                    <span style={{ color: "var(--ready)" }}>{label} is a long walk ({option.totalDistanceKm.toFixed(1)} km) and no matatu was found for it.</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost" style={{ flex: 1, padding: 7, fontSize: ".66rem", justifyContent: "center" }} onClick={e => { e.stopPropagation(); goNdai(pickup?.name ?? "", dest?.name ?? ""); }}>Book a Ndai</button>
                      <button className="btn btn-ghost" style={{ flex: 1, padding: 7, fontSize: ".66rem", justifyContent: "center" }} onClick={e => { e.stopPropagation(); if (pickup && dest) { setFromVal(pickup.name); setToVal(dest.name); setFromPlace(pickup); setToPlace(dest); runPlaces(pickup, dest); } }}>Try a matatu</button>
                    </div>
                  </div>) : null;
                const describe = (option: JourneyOption | null) => option ? option.legs.map(leg => leg.type === "walk" ? `Walk ${leg.etaMin} min` : `Matatu ${leg.routeShortName} (${leg.fromStop.name} to ${leg.toStop.name})`).join(" › ") : "";
                const stepStyle = { display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 8px", background: "rgba(0,0,0,.3)", borderRadius: 8, marginBottom: 4, fontSize: ".64rem", color: "var(--muted2)", lineHeight: 1.4 } as const;
                return (
                  <motion.div key={`${trip.board.id}-${trip.alight.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
                    className="card" onClick={() => setRailPick(index)} style={{ padding: 12, marginBottom: 8, cursor: "pointer", borderColor: index === railPick ? "rgba(217,119,6,.55)" : "var(--border2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span className="chip" style={{ background: index === 0 ? "rgba(22,163,74,.12)" : "rgba(255,255,255,.06)", color: index === 0 ? "var(--go)" : "var(--muted2)", border: "1px solid var(--border2)" }}>{index === 0 ? "BEST WAY" : `OPTION ${index + 1}`}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: ".8rem", fontWeight: 700 }}>~{trip.totalMin >= 60 ? `${Math.floor(trip.totalMin / 60)}h ${trip.totalMin % 60}m` : `${trip.totalMin}m`} · ~KES {trip.totalFare}</span>
                    </div>
                    {trip.access && <div style={stepStyle}><Footprints size={11} style={{ marginTop: 2, flexShrink: 0 }} /><span><strong style={{ color: "var(--white)" }}>Get to {trip.board.name} station</strong> · {describe(trip.access)} · ~{trip.access.totalEtaMin} min</span></div>}
                    {connectRow("Getting to the station", trip.access, railFromPlace ?? null, stationToPlace(trip.board))}
                    {trip.rail.legs.map((leg, legIndex) => (
                      <div key={legIndex}>
                        {legIndex > 0 && <div style={{ ...stepStyle, background: "rgba(217,119,6,.08)", color: "var(--ready)" }}><ArrowRight size={11} style={{ marginTop: 2, flexShrink: 0 }} /><span>Change trains at {leg.from.name}</span></div>}
                        <div style={stepStyle}>
                          <span style={{ padding: "1px 8px", borderRadius: 99, background: leg.line.color, color: "#fff", fontSize: ".58rem", fontWeight: 800, flexShrink: 0 }}><TrainFront size={9} style={{ display: "inline", verticalAlign: "-1px" }} /></span>
                          <span><strong style={{ color: "var(--white)" }}>{leg.from.name} to {leg.to.name}</strong> · {leg.line.name} · {leg.stations.length - 1} stop{leg.stations.length - 1 === 1 ? "" : "s"}, {leg.km.toFixed(1)} km · ~{leg.rideMin} min ride + ~{leg.waitMin} min wait · ~KES {leg.fare}</span>
                        </div>
                      </div>
                    ))}
                    {trip.egress && <div style={stepStyle}><Footprints size={11} style={{ marginTop: 2, flexShrink: 0 }} /><span><strong style={{ color: "var(--white)" }}>From {trip.alight.name} station to your stop</strong> · {describe(trip.egress)} · ~{trip.egress.totalEtaMin} min</span></div>}
                    {connectRow("The last stretch", trip.egress, stationToPlace(trip.alight), railToPlace ?? null)}
                  </motion.div>
                );
              })}
              {railTrips && <p style={{ fontSize: ".56rem", color: "var(--muted)", lineHeight: 1.45, marginBottom: 10 }}>Prototype estimate: train times, waits and fares are placeholders until the Kenya Railways timetable is loaded. Always check the station notice board.</p>}

              <p className="sec-label">All train stations</p>
              <div style={{ position: "relative", margin: "7px 0 8px" }}><Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input data-page-search className="finput" style={{ paddingLeft: 32 }} placeholder="Search train stations…" value={railStationQuery} onChange={event => setRailStationQuery(event.target.value)} /></div>
              {visibleRailStations.map(station => <button key={station.id} className="card" onClick={() => selectRailStation(station)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 6, cursor: "pointer", color: "var(--white)" }}><TrainFront size={14} style={{ color: station.id === railFromPlace?.stationId ? "var(--go)" : station.id === railToPlace?.stationId ? "var(--stop)" : "var(--ready)" }} /><span style={{ fontSize: ".72rem", fontWeight: 700, flex: 1 }}>{station.name}</span><span style={{ fontSize: ".56rem", color: "var(--muted2)" }}>{station.id === railFromPlace?.stationId ? "Start" : station.id === railToPlace?.stationId ? "Stop" : "Tap to choose"}</span></button>)}
              {visibleRailStations.length === 0 && <p style={{ fontSize: ".65rem", color: "var(--muted2)" }}>No stations match that search.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
