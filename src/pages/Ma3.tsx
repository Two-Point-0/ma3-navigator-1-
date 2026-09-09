import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Navigation, X, Clock, Users, ArrowRight, Wallet,
  Star, Shield, Volume2, Gauge, Gem, Lock, Box,
  MapPin, BusFront, TrainFront, TrainTrack,
  Calendar, AlarmClock, Zap, Eye, EyeOff, BadgeCheck, Footprints,
} from "lucide-react";
import { toast } from "sonner";
import maplibregl from "maplibre-gl";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import { setLineLayer, setPointLayer, removeLineLayer, removePointLayer } from "@/lib/mapLayers";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import {
  searchStops, planJourney, StopMatch, JourneyOption,
  nextMatatuArrivalMin,
} from "@/lib/journey";
import { generateStopQueue, StopQueueEntry, haversineKm, etaMinutes, AVG_MATATU_SPEED_KMH } from "@/data/ma3_core";
import { RAIL_LINES, RAIL_STATIONS, railLineCoords, nextDeparture, NCR_FARE_ESTIMATE } from "@/data/ma3_rail";
import { useWallet } from "@/lib/wallet";

type Panel = "search" | "planner" | "matatu" | "train" | null;

const NAIROBI: [number, number] = [-1.2864, 36.8172];
const ROUTES = MA3_GTFS.routes;
const SHAPES = MA3_GTFS.shapes as unknown as Record<string, [number, number][]>;
const STOPS_RAW = MA3_GTFS.stops as unknown as Record<string, [string, number, number]>;
const ROUTE_STOPS = MA3_GTFS.routeStops as Record<string, string[]>;

type SearchResult =
  | { kind: "route"; route: typeof ROUTES[0] }
  | { kind: "stop"; stop: StopMatch };

interface LiveMatatu {
  id: string;
  routeId: string;
  plate: string;
  posIdx: number;
  progress: number;
  speedKmh: number;
  stats: { armour: number; combat: number; speed: number; value: number };
  rated: boolean;
  direction: "outbound" | "inbound";
}

function buildMatatus(n: number): LiveMatatu[] {
  const plates = ["KBZ","KDA","KCA","KCB","KCC","KDD","KDE","KBA","KCM","KDP"];
  return Array.from({ length: n }, (_, i) => {
    const route = ROUTES[i % ROUTES.length];
    const shape = SHAPES[route.id];
    const totalPts = shape?.length ?? 1;
    const startIdx = Math.floor((i / n) * totalPts) % Math.max(totalPts - 1, 1);
    return {
      id: `V${i + 1}`,
      routeId: route.id,
      plate: `${plates[i % plates.length]} ${100 + i * 7}${String.fromCharCode(65 + i % 26)}`,
      posIdx: startIdx,
      progress: Math.random(),
      speedKmh: AVG_MATATU_SPEED_KMH + Math.round((Math.random() - 0.5) * 8),
      stats: { armour: 40 + ~~(Math.random()*55), combat: 35 + ~~(Math.random()*60), speed: 45 + ~~(Math.random()*50), value: 30 + ~~(Math.random()*65) },
      rated: Math.random() > 0.75,
      direction: i % 2 === 0 ? "outbound" : "inbound",
    };
  });
}
const ALL_MATATUS = buildMatatus(ROUTES.length * 2);

function interpolatePos(shape: [number, number][], idx: number, progress: number): [number, number] {
  if (!shape || shape.length === 0) return NAIROBI;
  const a = shape[Math.min(idx, shape.length - 1)];
  const b = shape[Math.min(idx + 1, shape.length - 1)];
  return [a[0] + (b[0] - a[0]) * progress, a[1] + (b[1] - a[1]) * progress];
}

function busSVG(color: string): string {
  return `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.55)">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="13" rx="2"/><path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
      <circle cx="8" cy="16" r="1" fill="#fff" stroke="none"/><circle cx="16" cy="16" r="1" fill="#fff" stroke="none"/>
    </svg></div>`;
}
function trainStationSVG(): string {
  return `<div style="width:20px;height:20px;background:#1c1c2a;border:2px solid #f0ede8;border-radius:5px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.5)">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f0ede8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="2" width="16" height="16" rx="2"/><path d="M8 22l4-4 4 4"/><path d="M9 12h.01M15 12h.01"/><path d="M4 8h16"/>
    </svg></div>`;
}

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

function SBar({ label, icon, value, color }: { label: string; icon: React.ReactNode; value: number; color: string }) {
  return (
    <div className="sbar-wrap">
      <div className="sbar-label"><span style={{ display: "flex", alignItems: "center", gap: 4 }}>{icon}{label}</span><span style={{ color, fontFamily: "var(--font-mono)" }}>{value}</span></div>
      <div className="sbar-track"><motion.div className="sbar-fill" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: .6 }} style={{ background: color }} /></div>
    </div>
  );
}

const glassBtn = (active: boolean, accentColor = "var(--ready)"): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12,
  background: active ? "rgba(217,119,6,.16)" : "rgba(8,8,16,.76)",
  backdropFilter: "blur(16px)",
  border: `1px solid ${active ? "rgba(217,119,6,.5)" : "rgba(255,255,255,.12)"}`,
  color: active ? accentColor : "var(--muted2)",
  fontFamily: "var(--font)", fontWeight: 700, fontSize: ".7rem",
  cursor: "pointer", whiteSpace: "nowrap" as const,
  boxShadow: "0 2px 12px rgba(0,0,0,.4)", transition: ".18s",
});

export default function Ma3Page() {
  const [panel, setPanel]           = useState<Panel>(null);
  const [query, setQuery]           = useState("");
  const [selRoute, setSelRoute]     = useState<typeof ROUTES[0] | null>(null);
  const [fromVal, setFromVal]       = useState("");
  const [toVal, setToVal]           = useState("");
  const [fromStop, setFromStop]     = useState<StopMatch | null>(null);
  const [toStop, setToStop]         = useState<StopMatch | null>(null);
  const [journeyOpts, setJourneyOpts] = useState<JourneyOption[] | null>(null);
  const [lockedStop, setLockedStop] = useState<StopMatch | null>(null);
  const [stopQueue, setStopQueue]   = useState<StopQueueEntry[]>([]);
  const [selMatatu, setSelMatatu]   = useState<LiveMatatu | null>(null);
  const [selRailLine, setSelRailLine] = useState<string | null>(null);
  const [is3D, setIs3D]             = useState(false);
  const [mapCenter, setMapCenter]   = useState<[number, number]>(NAIROBI);
  const [showAllLive, setShowAllLive] = useState(false);
  const [savedJourneys, setSavedJourneys] = useState<{ label: string; from: StopMatch; to: StopMatch; time: string; days: string[] }[]>([]);
  const [saveForm, setSaveForm]     = useState(false);
  const [saveLabel, setSaveLabel]   = useState("");
  const [saveDays, setSaveDays]     = useState<string[]>([]);
  const [saveTime, setSaveTime]     = useState("07:30");
  const [showSaved, setShowSaved]   = useState(false);
  const [tripProgress, setTripProgress] = useState(0);
  const { wallet, pay }             = useWallet();

  const mapRef         = useRef<MapLibreHandle>(null);
  const mapInst        = useRef<maplibregl.Map | null>(null);
  const staticMarkers  = useRef<maplibregl.Marker[]>([]);
  const matatuMarkers  = useRef<Map<string, maplibregl.Marker>>(new Map());
  const matatuState    = useRef<LiveMatatu[]>(ALL_MATATUS.map(m => ({ ...m })));
  const animRef        = useRef<number>(0);
  const lastFrame       = useRef<number>(0);
  const progressTimer   = useRef<number>(0);

  const searchResults: SearchResult[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const routeMatches: SearchResult[] = ROUTES
      .filter(r => r.sn.toLowerCase().includes(q) || r.ln.toLowerCase().includes(q) || r.hs.toLowerCase().includes(q))
      .slice(0, 12)
      .map(route => ({ kind: "route" as const, route }));
    const stopMatches: SearchResult[] = searchStops(query, 12).map(stop => ({ kind: "stop" as const, stop }));
    return [...routeMatches, ...stopMatches];
  }, [query]);

  const clearStatic = useCallback(() => {
    const map = mapInst.current;
    if (!map) return;
    staticMarkers.current.forEach(m => m.remove());
    staticMarkers.current = [];
    ROUTES.forEach(r => {
      removeLineLayer(map, `route-${r.id}`);
      removeLineLayer(map, `route-passed-${r.id}`);
    });
    RAIL_LINES.forEach(l => removeLineLayer(map, `rail-${l.id}`));
    removePointLayer(map, "route-stops");
    removePointLayer(map, "planner-pts");
  }, []);

  const drawRoute = useCallback((map: maplibregl.Map, route: typeof ROUTES[0], progress = 0) => {
    clearStatic();
    const shape = SHAPES[route.id];
    if (shape?.length) {
      setLineLayer(map, `route-${route.id}`, shape, route.c, 5, progress > 0 ? 0.35 : 0.9);
      if (progress > 0) {
        const cutIdx = Math.floor(shape.length * progress);
        const passedSegment = shape.slice(0, Math.max(cutIdx, 1));
        if (passedSegment.length > 1) {
          setLineLayer(map, `route-passed-${route.id}`, passedSegment, "#ffffff", 5, 0.95);
        }
      }
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

  const drawRail = useCallback((map: maplibregl.Map, selectedId: string | null) => {
    clearStatic();
    RAIL_LINES.forEach(l => {
      const w = selectedId === l.id ? 6 : 3.5;
      const op = selectedId && selectedId !== l.id ? 0.3 : 0.9;
      setLineLayer(map, `rail-${l.id}`, railLineCoords(l), l.color, w, op);
    });
    Object.values(RAIL_STATIONS).forEach(s => {
      const el = document.createElement("div");
      el.innerHTML = trainStationSVG();
      el.title = s.name;
      staticMarkers.current.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([s.lon, s.lat]).addTo(map));
    });
  }, [clearStatic]);

  const startAnimation = useCallback((routeId?: string) => {
    cancelAnimationFrame(animRef.current);
    lastFrame.current = 0;
    const loop = (timestamp: number) => {
      if (!mapInst.current) { animRef.current = requestAnimationFrame(loop); return; }
      const dt = lastFrame.current ? (timestamp - lastFrame.current) / 1000 : 0.016;
      lastFrame.current = timestamp;
      matatuState.current.forEach(mt => {
        if (routeId && mt.routeId !== routeId) return;
        const shape = SHAPES[mt.routeId];
        if (!shape || shape.length < 2) return;
        const totalPts = shape.length;
        const seg = shape[mt.posIdx];
        const nextSeg = shape[Math.min(mt.posIdx + 1, totalPts - 1)];
        const segDist = haversineKm(seg[0], seg[1], nextSeg[0], nextSeg[1]);
        const segTime = segDist / (mt.speedKmh / 3600);
        const progressInc = segTime > 0 ? dt / segTime : 0.01;
        mt.progress += progressInc;
        if (mt.progress >= 1) {
          mt.progress = 0;
          if (mt.direction === "outbound") {
            mt.posIdx++;
            if (mt.posIdx >= totalPts - 1) { mt.direction = "inbound"; mt.posIdx = totalPts - 2; }
          } else {
            mt.posIdx--;
            if (mt.posIdx < 0) { mt.direction = "outbound"; mt.posIdx = 0; }
          }
        }
        const [lat, lon] = interpolatePos(shape, mt.posIdx, mt.progress);
        const existing = matatuMarkers.current.get(mt.id);
        if (existing) existing.setLngLat([lon, lat]);
        else {
          const route = ROUTES.find(r => r.id === mt.routeId);
          if (!route) return;
          const el = document.createElement("div");
          el.innerHTML = busSVG(route.c);
          el.title = `${mt.plate} — Route ${route.sn}`;
          el.style.cursor = "pointer";
          el.onclick = () => setSelMatatu(mt);
          const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lon, lat]).addTo(mapInst.current!);
          matatuMarkers.current.set(mt.id, marker);
        }
      });
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, []);

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    matatuMarkers.current.forEach(m => m.remove());
    matatuMarkers.current.clear();
  }, []);

  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    stopAnimation();
    clearStatic();
    if (panel === "matatu" || showAllLive) {
      startAnimation(panel === "matatu" && selRoute ? selRoute.id : undefined);
    } else if (panel === "train") {
      drawRail(map, selRailLine);
    } else if (selRoute) {
      drawRoute(map, selRoute, tripProgress);
      startAnimation(selRoute.id);
    }
  }, [panel, selRoute, selRailLine, showAllLive]);

  useEffect(() => {
    cancelAnimationFrame(progressTimer.current);
    if (!selRoute || panel !== "search") { setTripProgress(0); return; }
    let p = 0;
    const tick = () => {
      p = Math.min(1, p + 0.0025);
      setTripProgress(p);
      if (mapInst.current) drawRoute(mapInst.current, selRoute, p);
      if (p < 1) progressTimer.current = requestAnimationFrame(tick);
    };
    progressTimer.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(progressTimer.current);
  }, [selRoute, panel]);

  useEffect(() => () => { stopAnimation(); cancelAnimationFrame(progressTimer.current); }, []);

  const handleMapLoad = (map: maplibregl.Map) => { mapInst.current = map; };

  const selectRoute = (route: typeof ROUTES[0]) => {
    setSelRoute(route);
    setQuery(`${route.sn} — ${route.ln}`);
    setTripProgress(0);
    const map = mapInst.current;
    if (map) drawRoute(map, route, 0);
    startAnimation(route.id);
    const shape = SHAPES[route.id];
    if (shape?.length) setMapCenter([shape[~~(shape.length / 2)][0], shape[~~(shape.length / 2)][1]]);
  };

  const selectStopFromSearch = (stop: StopMatch) => {
    setQuery(stop.name);
    setMapCenter([stop.lat, stop.lon]);
    if (mapRef.current) mapRef.current.flyTo(stop.lon, stop.lat, 15);
    const servingRouteIds = (MA3_GTFS.stopRoutes as Record<string, string[]>)[stop.id] ?? [];
    const firstRoute = ROUTES.find(r => servingRouteIds.includes(r.id));
    if (firstRoute) selectRoute(firstRoute);
    toast(`📍 ${stop.name} — ${servingRouteIds.length} route${servingRouteIds.length !== 1 ? "s" : ""} serve this stop`);
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
          const shape = SHAPES[leg.routeId];
          if (shape) setLineLayer(map, `journey-leg-${i}`, shape, leg.routeColor ?? "#d97706", 4, 0.85);
        }
      });
      setPointLayer(map, "planner-pts", [
        { id: "from", lat: fromStop.lat, lon: fromStop.lon, color: "#16a34a", radius: 10 },
        { id: "to",   lat: toStop.lat,   lon: toStop.lon,   color: "#dc2626", radius: 10 },
      ], 10);
      if (opts[0]?.legs[0]?.routeId) startAnimation(opts[0].legs[0].routeId);
    }
  };

  const lockIn = (stop: StopMatch) => {
    setLockedStop(stop);
    setStopQueue(generateStopQueue(stop.lat, stop.lon, MA3_GTFS.stops as any));
    toast(`📍 Locked in at ${stop.name} — touts can see you!`);
  };

  const openPanel = (p: Panel) => setPanel(prev => prev === p ? null : p);
  const pitch = is3D ? 52 : 0;
  const bearing = is3D ? -14 : 0;

  return (
    <div style={{ position: "relative", height: "calc(100vh - var(--top-h) - var(--nav-h))", marginTop: "-12px" }}>
      <MapLibreView ref={mapRef} center={mapCenter} zoom={12} pitch={pitch} bearing={bearing}
        height="100%" borderRadius={0} onLoad={handleMapLoad} />

      <div style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 50, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={glassBtn(panel === "search", "var(--stop)")} onClick={() => openPanel("search")}>
          <Search size={13} /> Search
        </button>
        <button style={glassBtn(panel === "planner", "var(--go)")} onClick={() => openPanel("planner")}>
          <Navigation size={13} /> Plan
        </button>
        <button style={glassBtn(panel === "matatu", "var(--ready)")} onClick={() => openPanel("matatu")}>
          <BusFront size={13} /> Matatu
        </button>
        <button style={glassBtn(panel === "train", "#8b5cf6")} onClick={() => openPanel("train")}>
          <TrainFront size={13} /> Train
        </button>
        <button onClick={() => setShowAllLive(v => !v)}
          style={{ ...glassBtn(showAllLive, "#16a34a"), borderColor: showAllLive ? "rgba(22,163,74,.5)" : "rgba(255,255,255,.12)", color: showAllLive ? "#16a34a" : "var(--muted2)" }}>
          {showAllLive ? <Eye size={13} /> : <EyeOff size={13} />} Live
        </button>
        <button style={{ ...glassBtn(is3D, "#3b82f6"), marginLeft: "auto" }} onClick={() => setIs3D(d => !d)}>
          <Box size={13} /> 3D
        </button>
      </div>

      {/* ══════ UNIFIED SEARCH PANEL ══════ */}
      <AnimatePresence>
        {panel === "search" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bpanel open" style={{ maxHeight: "75vh" }}>
            <div className="bpanel-head">
              <div className="handle" />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} />
                  <input autoFocus className="finput" style={{ paddingLeft: 32 }}
                    placeholder="Route number, route name, or stop… e.g. 23W, Rongai, Kencom"
                    value={query} onChange={e => setQuery(e.target.value)} />
                  {query && (
                    <button onClick={() => { setQuery(""); setSelRoute(null); clearStatic(); stopAnimation(); }}
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
                      <p style={{ fontSize: ".6rem", color: "var(--muted2)" }}>{selRoute.ln} · {ROUTE_STOPS[selRoute.id]?.length ?? 0} stops</p>
                    </div>
                    <button onClick={() => { setSelRoute(null); setQuery(""); clearStatic(); stopAnimation(); }}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={13} /></button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: ".58rem", color: "var(--muted)" }}>Live progress along route</span>
                      <span style={{ fontSize: ".58rem", color: "#fff", fontFamily: "var(--font-mono)" }}>{Math.round(tripProgress * 100)}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: `${selRoute.c}25`, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${tripProgress * 100}%`, background: "#fff", borderRadius: 99, transition: "width .3s linear" }} />
                    </div>
                  </div>
                </motion.div>
              )}
              {!query && !selRoute && <p style={{ fontSize: ".64rem", color: "var(--muted)", textAlign: "center", padding: "10px 0" }}>Search by route number, route name, or stop name</p>}
            </div>

            <div className="bpanel-scroll" style={{ padding: "0 14px 20px" }}>
              {searchResults.map((res, i) => {
                if (res.kind === "route") {
                  const route = res.route;
                  const waitMin = nextMatatuArrivalMin(route.id, "");
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
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: ".6rem", color: "var(--ready)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>~{waitMin}m</div>
                        <div style={{ fontSize: ".55rem", color: "var(--muted)" }}>next</div>
                      </div>
                      <BusFront size={13} style={{ color: route.c, flexShrink: 0 }} />
                    </motion.button>
                  );
                } else {
                  const stop = res.stop;
                  const servingCount = ((MA3_GTFS.stopRoutes as Record<string, string[]>)[stop.id] ?? []).length;
                  return (
                    <motion.button key={`s-${stop.id}`} whileTap={{ scale: 0.97 }} onClick={() => selectStopFromSearch(stop)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 12, width: "100%", textAlign: "left", marginBottom: 5, background: "var(--glass)", border: "1px solid var(--border)", cursor: "pointer" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,.12)", border: "1.5px solid rgba(220,38,38,.3)", flexShrink: 0 }}>
                        <MapPin size={15} style={{ color: "var(--stop)" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: ".77rem", fontWeight: 600 }}>{stop.name}</p>
                        <p style={{ fontSize: ".6rem", color: "var(--muted)" }}>Bus stop · {servingCount} route{servingCount !== 1 ? "s" : ""}</p>
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
            className="bpanel open" style={{ maxHeight: "85vh" }}>
            <div className="bpanel-head">
              <div className="handle" />
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
                          const canAfford = wallet.balance >= opt.fareEstimate;
                          const waitMin = opt.legs[0]?.routeId ? nextMatatuArrivalMin(opt.legs[0].routeId, fromStop?.id ?? "") : 5;
                          return (
                            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                              className="card" style={{ padding: 12, marginBottom: 8, borderColor: opt.isFastest ? "rgba(22,163,74,.3)" : opt.isCheapest ? "rgba(217,119,6,.3)" : "var(--border2)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                                  {opt.isFastest && <span className="chip" style={{ background: "rgba(22,163,74,.12)", color: "var(--go)", border: "1px solid rgba(22,163,74,.3)" }}><Zap size={9} style={{ display: "inline" }} /> FASTEST</span>}
                                  {opt.isCheapest && <span className="chip" style={{ background: "rgba(217,119,6,.12)", color: "var(--ready)", border: "1px solid rgba(217,119,6,.3)" }}>💰 CHEAPEST</span>}
                                  {opt.usesRail && <span className="chip" style={{ background: "rgba(139,92,246,.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,.3)" }}><TrainFront size={9} style={{ display: "inline" }} /> TRAIN</span>}
                                </div>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", fontWeight: 700 }}>KES {opt.fareEstimate}</span>
                              </div>
                              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                                <div style={{ flex: 1, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "5px 8px", textAlign: "center" }}>
                                  <p style={{ fontSize: ".5rem", color: "var(--muted)", textTransform: "uppercase" }}>Wait</p>
                                  <p style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", color: "var(--ready)", fontWeight: 700 }}>{waitMin}m</p>
                                </div>
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
                                    : leg.type === "train"
                                    ? <span style={{ padding: "2px 8px", borderRadius: 99, background: "#8b5cf6", color: "#fff", fontSize: ".64rem", fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}><TrainFront size={9} /> Train</span>
                                    : <span style={{ padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,.1)", color: "var(--muted2)", fontSize: ".64rem", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}><Footprints size={9} /> Walk</span>}
                                  <span style={{ fontSize: ".66rem", color: "var(--muted2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {leg.fromStop.name} <ArrowRight size={9} style={{ display: "inline", verticalAlign: "middle" }} /> {leg.toStop.name}
                                  </span>
                                  <span style={{ fontSize: ".58rem", color: "var(--muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{leg.etaMin}m</span>
                                </div>
                              ))}
                              {opt.transfers > 0 && <p style={{ fontSize: ".6rem", color: "var(--ready)", marginBottom: 6 }}>⚠️ {opt.transfers} transfer — allow extra time</p>}
                              {opt.legs[0]?.routeId && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "rgba(22,163,74,.06)", borderRadius: 8, marginBottom: 8 }}>
                                  <BadgeCheck size={12} style={{ color: "var(--go)", flexShrink: 0 }} />
                                  <p style={{ fontSize: ".62rem", color: "var(--muted2)" }}>
                                    Board going <strong style={{ color: "var(--go)" }}>toward {toStop?.name}</strong> — wrong-direction matatus are filtered out.
                                  </p>
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn btn-go" style={{ flex: 1, padding: 8, fontSize: ".7rem", justifyContent: "center" }} onClick={() => lockIn(opt.legs[0].fromStop)}>
                                  <Lock size={11} /> Lock In
                                </button>
                                <button className="btn" disabled={!canAfford}
                                  style={{ padding: "8px 12px", fontSize: ".7rem", background: canAfford ? "rgba(217,119,6,.12)" : "rgba(220,38,38,.1)", border: `1px solid ${canAfford ? "rgba(217,119,6,.3)" : "rgba(220,38,38,.3)"}`, color: canAfford ? "var(--ready)" : "var(--stop)" }}
                                  onClick={() => { if (pay(opt.fareEstimate)) toast(`✅ KES ${opt.fareEstimate} paid`); else toast("Top up your wallet first"); }}>
                                  <Wallet size={11} /> Pay
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
                                setSaveForm(false); setSaveLabel(""); setSaveDays([]); toast("✅ Saved!");
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
                            <span style={{ fontSize: ".78rem", fontWeight: 700 }}>{lockedStop.name}</span>
                          </div>
                          <button onClick={() => { setLockedStop(null); setStopQueue([]); }} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={13} /></button>
                        </div>
                        <p style={{ fontSize: ".61rem", color: "var(--muted2)", marginBottom: 8 }}>Drivers see this demand board — no tout needs to shout.</p>
                        <div className="sec-label" style={{ marginBottom: 6 }}><Users size={9} style={{ display: "inline", marginRight: 3 }} />DEMAND AT THIS STAGE</div>
                        {stopQueue.slice(0, 6).map((q, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", background: "rgba(255,255,255,.03)", borderRadius: 8, marginBottom: 3 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(217,119,6,.15)", border: "1px solid rgba(217,119,6,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: ".6rem", fontWeight: 700, color: "var(--ready)", flexShrink: 0 }}>{q.paxCount}</div>
                            <span style={{ flex: 1, fontSize: ".7rem" }}>{q.destination}</span>
                            <span style={{ fontSize: ".57rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>~{etaMinutes(haversineKm(lockedStop.lat, lockedStop.lon, q.destLat, q.destLon))}m</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
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
        {panel === "matatu" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bpanel open" style={{ maxHeight: "55vh" }}>
            <div className="bpanel-head">
              <div className="handle" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <BusFront size={15} style={{ color: "var(--ready)" }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 900 }}>Live Matatus</span>
                  <span className="chip" style={{ background: "rgba(22,163,74,.1)", color: "var(--go)", border: "1px solid rgba(22,163,74,.25)", fontSize: ".56rem" }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--go)", marginRight: 4, animation: "dot-pulse 1.2s infinite" }} /> LIVE
                  </span>
                </div>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
            </div>
            <div className="bpanel-scroll" style={{ padding: "0 14px 20px" }}>
              {ALL_MATATUS.slice(0, 20).map(v => {
                const route = ROUTES.find(r => r.id === v.routeId);
                if (!route) return null;
                const waitMin = nextMatatuArrivalMin(v.routeId, "");
                return (
                  <motion.button key={v.id} whileTap={{ scale: 0.97 }} onClick={() => setSelMatatu(v)}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 11, width: "100%", marginBottom: 5, background: "var(--glass)", border: `1px solid ${selMatatu?.id === v.id ? route.c + "55" : "var(--border)"}`, cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: route.c, flexShrink: 0, animation: "dot-pulse 1.5s infinite" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: ".73rem", fontWeight: 700 }}>{v.plate}</p>
                      <p style={{ fontSize: ".57rem", color: "var(--muted)" }}>Route {route.sn} · {v.direction === "outbound" ? "→" : "←"} {v.speedKmh} km/h</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: ".6rem", color: "var(--ready)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{waitMin}m</div>
                      <div style={{ fontSize: ".52rem", color: "var(--muted)" }}>to stop</div>
                    </div>
                    {v.rated ? <span className="chip" style={{ background: "rgba(217,119,6,.12)", color: "var(--ready)", border: "1px solid rgba(217,119,6,.25)" }}>★</span> : <Star size={11} style={{ color: "var(--muted)" }} />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ TRAIN PANEL ══════ */}
      <AnimatePresence>
        {panel === "train" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bpanel open" style={{ maxHeight: "70vh" }}>
            <div className="bpanel-head">
              <div className="handle" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <TrainFront size={15} style={{ color: "#8b5cf6" }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 900 }}>NCR Commuter Train</span>
                </div>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
            </div>
            <div className="bpanel-scroll" style={{ padding: "0 14px 24px" }}>
              {RAIL_LINES.map(line => {
                const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
                const nextOut = nextDeparture(line.departuresFromCBD, nowMin);
                const nextIn  = nextDeparture(line.departuresToCBD,  nowMin);
                const origin  = RAIL_STATIONS[line.stations[0]];
                const term    = RAIL_STATIONS[line.stations[line.stations.length - 1]];
                const dist    = haversineKm(origin.lat, origin.lon, term.lat, term.lon);
                const active  = selRailLine === line.id;
                return (
                  <motion.div key={line.id} whileTap={{ scale: 0.98 }} className="card"
                    style={{ marginBottom: 8, padding: 12, cursor: "pointer", background: active ? `${line.color}10` : "var(--glass)", borderColor: active ? `${line.color}45` : "var(--border2)" }}
                    onClick={() => { const n = active ? null : line.id; setSelRailLine(n); if (mapInst.current) drawRail(mapInst.current, n); }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <TrainTrack size={13} style={{ color: line.color }} />
                      <span style={{ fontFamily: "var(--font-display)", fontSize: ".78rem", fontWeight: 700, color: line.color, flex: 1 }}>{line.name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: ".68rem", color: "var(--muted2)" }}>KES {NCR_FARE_ESTIMATE[line.id]}</span>
                    </div>
                    <p style={{ fontSize: ".61rem", color: "var(--muted2)", marginBottom: 6 }}>
                      {origin.name} → {term.name} · {line.stations.length} stations · ~{etaMinutes(dist, line.avgSpeedKmh)} min
                    </p>
                    <div style={{ display: "flex", gap: 6, marginBottom: active ? 8 : 0 }}>
                      <div style={{ flex: 1, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "5px 8px" }}>
                        <p style={{ fontSize: ".52rem", color: "var(--muted)", textTransform: "uppercase" }}>Next from CBD</p>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: ".76rem", color: "var(--ready)", fontWeight: 700 }}>{nextOut ? `${nextOut.time} (${nextOut.inMin}m)` : "—"}</p>
                      </div>
                      <div style={{ flex: 1, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "5px 8px" }}>
                        <p style={{ fontSize: ".52rem", color: "var(--muted)", textTransform: "uppercase" }}>Next to CBD</p>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: ".76rem", color: "var(--go)", fontWeight: 700 }}>{nextIn ? `${nextIn.time} (${nextIn.inMin}m)` : "—"}</p>
                      </div>
                    </div>
                    {active && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {line.stations.map(sid => (
                          <span key={sid} className="chip" style={{ background: `${line.color}12`, color: line.color, border: `1px solid ${line.color}28`, fontSize: ".57rem" }}>
                            <TrainFront size={8} style={{ display: "inline", marginRight: 3 }} />{RAIL_STATIONS[sid].name}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
              <p style={{ fontSize: ".57rem", color: "var(--muted)", textAlign: "center" }}>Schedule based on published Kenya Railways NCR timetable. Verify at station.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Matatu detail sheet */}
      <AnimatePresence>
        {selMatatu && (() => {
          const route = ROUTES.find(r => r.id === selMatatu.routeId);
          if (!route) return null;
          return (
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 300 }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 350, background: "var(--ink3)", borderTop: "1px solid var(--border2)", borderRadius: "22px 22px 0 0", padding: "1rem 1rem 1.8rem", backdropFilter: "blur(16px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: ".95rem", fontWeight: 700 }}>{selMatatu.plate}</p>
                  <p style={{ fontSize: ".63rem", color: route.c }}>Route {route.sn} — {route.hs}</p>
                  <p style={{ fontSize: ".6rem", color: "var(--muted2)", marginTop: 2 }}>
                    {selMatatu.direction === "outbound" ? `→ Going toward ${route.hs}` : `← Returning to CBD`} · {selMatatu.speedKmh} km/h
                  </p>
                </div>
                <button onClick={() => setSelMatatu(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
                <div style={{ flex: 1, padding: "7px 10px", borderRadius: 10, background: "rgba(217,119,6,.08)", border: "1px solid rgba(217,119,6,.2)", textAlign: "center" }}>
                  <p style={{ fontSize: ".52rem", color: "var(--muted)", textTransform: "uppercase" }}>To your stop</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: ".88rem", color: "var(--ready)", fontWeight: 700 }}>{nextMatatuArrivalMin(route.id, "")}m</p>
                </div>
                <div style={{ flex: 1, padding: "7px 10px", borderRadius: 10, background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.2)", textAlign: "center" }}>
                  <p style={{ fontSize: ".52rem", color: "var(--muted)", textTransform: "uppercase" }}>After boarding</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: ".88rem", color: "var(--go)", fontWeight: 700 }}>{fromStop && toStop ? `${etaMinutes(haversineKm(fromStop.lat, fromStop.lon, toStop.lat, toStop.lon))}m` : "—"}</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 12 }}>
                <SBar label="Armour" icon={<Shield size={10} />} value={selMatatu.stats.armour} color="#dc2626" />
                <SBar label="Combat" icon={<Volume2 size={10} />} value={selMatatu.stats.combat} color="#d97706" />
                <SBar label="Speed"  icon={<Gauge size={10} />}  value={selMatatu.stats.speed}  color="#16a34a" />
                <SBar label="Value"  icon={<Gem size={10} />}    value={selMatatu.stats.value}  color="#8b5cf6" />
              </div>
              {selMatatu.rated
                ? <div className="card" style={{ padding: 10, textAlign: "center", background: "rgba(217,119,6,.08)", borderColor: "rgba(217,119,6,.2)" }}>
                    <p style={{ fontSize: ".74rem", color: "var(--ready)", fontWeight: 600 }}>✅ Already Rated</p>
                  </div>
                : <button className="btn btn-primary" style={{ width: "100%", padding: 12, justifyContent: "center" }}
                    onClick={() => { toast(`⭐ Rated ${selMatatu.plate}! +5⚡`); setSelMatatu(null); }}>
                    <Star size={14} /> Rate This Nganya · +5⚡
                  </button>}
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
