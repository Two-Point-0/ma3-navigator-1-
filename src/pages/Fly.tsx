import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Database, LoaderCircle, MapPin, Navigation, Plane, Search, TrainFront, ChevronUp, ChevronDown, Clock, X } from "lucide-react";
import maplibregl from "maplibre-gl";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import PageTabs from "@/components/PageTabs";
import { removeLineLayer, removePointLayer, setLineLayer, setPointLayer } from "@/lib/mapLayers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type FlyTab = "domestic" | "international" | "sgr";
type Coordinate = [number, number];
type FlightRoute = { id: string; service_type: "domestic" | "international"; airline: string; flight_number: string; origin_code: string; origin_name: string; destination_code: string; destination_name: string; departure_at: string; arrival_at: string; fare_kes: number | null; geometry: any; source_url: string; source_updated_at: string };
type SgrRoute = { id: string; name: string; operator: string; geometry: any; source_url: string | null; source_updated_at: string | null };
type SgrStation = { id: string; name: string; route_id: string | null; latitude: number; longitude: number; sequence_number: number | null };
type SgrSchedule = { id: string; train_code: string; route_id: string; origin_station_id: string; destination_station_id: string; departure_at: string; arrival_at: string; fare_kes: number | null; source_url: string; source_updated_at: string };
type Airport = { code: string; name: string; label: string };

const TABS = [
  { id: "domestic", label: "Kenya flights", Icon: Plane },
  { id: "international", label: "Global flights", Icon: Navigation },
  { id: "sgr", label: "SGR stations", Icon: TrainFront },
] as const;
const AIRPORTS: Airport[] = [
  { code: "NBO", name: "Nairobi", label: "Nairobi (NBO)" }, { code: "WIL", name: "Wilson", label: "Wilson (WIL)" },
  { code: "MBA", name: "Mombasa", label: "Mombasa (MBA)" }, { code: "KIS", name: "Kisumu", label: "Kisumu (KIS)" },
  { code: "EDL", name: "Eldoret", label: "Eldoret (EDL)" }, { code: "MYD", name: "Malindi", label: "Malindi (MYD)" },
  { code: "EBB", name: "Entebbe", label: "Entebbe (EBB)" }, { code: "DAR", name: "Dar es Salaam", label: "Dar es Salaam (DAR)" },
  { code: "KGL", name: "Kigali", label: "Kigali (KGL)" }, { code: "ADD", name: "Addis Ababa", label: "Addis Ababa (ADD)" },
  { code: "DXB", name: "Dubai", label: "Dubai (DXB)" }, { code: "DOH", name: "Doha", label: "Doha (DOH)" },
];
const NAIROBI: [number, number] = [-1.2864, 36.8172];

function geometryLines(value: any): Coordinate[][] {
  if (!value) return [];
  if (value.type === "Feature") return geometryLines(value.geometry);
  if (value.type === "FeatureCollection") return (value.features ?? []).flatMap((feature: any) => geometryLines(feature));
  if (value.type === "LineString") return [value.coordinates ?? []];
  if (value.type === "MultiLineString") return value.coordinates ?? [];
  if (value.type === "GeometryCollection") return (value.geometries ?? []).flatMap((geometry: any) => geometryLines(geometry));
  if (Array.isArray(value) && value.length && Array.isArray(value[0]) && typeof value[0][0] === "number") return [value as Coordinate[]];
  return [];
}
function nearestVertexIndex(line: Coordinate[], station: SgrStation): number {
  let nearest = 0, nearestDistance = Infinity;
  line.forEach(([lon, lat], index) => {
    const distance = (lon - station.longitude) ** 2 + (lat - station.latitude) ** 2;
    if (distance < nearestDistance) { nearest = index; nearestDistance = distance; }
  });
  return nearest;
}
function railSegment(geometry: any, from: SgrStation | undefined, to: SgrStation | undefined): Coordinate[][] {
  const lines = geometryLines(geometry).filter(line => line.length > 1);
  if (!from || !to) return lines;
  const candidate = lines.map(line => {
    const first = nearestVertexIndex(line, from), last = nearestVertexIndex(line, to);
    const gap = (line[first][0] - from.longitude) ** 2 + (line[first][1] - from.latitude) ** 2
      + (line[last][0] - to.longitude) ** 2 + (line[last][1] - to.latitude) ** 2;
    return { line, first, last, gap };
  }).sort((a, b) => a.gap - b.gap)[0];
  if (!candidate) return [];
  const start = Math.min(candidate.first, candidate.last), end = Math.max(candidate.first, candidate.last);
  const segment = candidate.line.slice(start, end + 1);
  return segment.length > 1 ? [segment] : [];
}
function displayAirport(value: string) { return AIRPORTS.find(item => item.code === value || item.label.toLowerCase() === value.toLowerCase() || item.name.toLowerCase() === value.toLowerCase())?.label ?? value; }
function airportCode(value: string) { const match = value.match(/\(([A-Z0-9]{3})\)/i); return match?.[1]?.toUpperCase() ?? AIRPORTS.find(item => item.name.toLowerCase() === value.toLowerCase())?.code ?? value.trim().toUpperCase(); }

export default function FlyPage() {
  const mapRef = useRef<MapLibreHandle>(null);
  const dragStart = useRef<{ y: number; height: number } | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [tab, setTab] = useState<FlyTab>("domestic");
  const [sheetHeight, setSheetHeight] = useState(20);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [origin, setOrigin] = useState("Nairobi (NBO)");
  const [destination, setDestination] = useState("Mombasa (MBA)");
  const [travelDate, setTravelDate] = useState("");
  const [flightRoutes, setFlightRoutes] = useState<FlightRoute[]>([]);
  const [flightLoading, setFlightLoading] = useState(false);
  const [flightError, setFlightError] = useState("");
  const [selectedFlight, setSelectedFlight] = useState<FlightRoute | null>(null);
  const [sgrRoutes, setSgrRoutes] = useState<SgrRoute[]>([]);
  const [sgrStations, setSgrStations] = useState<SgrStation[]>([]);
  const [sgrSchedules, setSgrSchedules] = useState<SgrSchedule[]>([]);
  const [selectedSgrId, setSelectedSgrId] = useState("");
  const [stationQuery, setStationQuery] = useState("");
  const [sgrOriginId, setSgrOriginId] = useState("");
  const [sgrDestinationId, setSgrDestinationId] = useState("");
  const [sgrLoading, setSgrLoading] = useState(false);
  const [sgrError, setSgrError] = useState("");
  const [touristDestination, setTouristDestination] = useState<{ name: string; lat: number; lon: number } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("ma3_fly_destination");
    if (!raw) return;
    sessionStorage.removeItem("ma3_fly_destination");
    try {
      const value = JSON.parse(raw) as { name?: string; lat?: number; lon?: number };
      if (!value.name || !Number.isFinite(value.lat) || !Number.isFinite(value.lon)) return;
      const point = { name: value.name, lat: value.lat!, lon: value.lon! };
      setTouristDestination(point); setTab("domestic"); setFlightError(`Explore destination: ${point.name}. Choose the nearest available airport above, then search sourced flights.`);
      setOrigin("Nairobi (NBO)"); setDestination(""); mapRef.current?.flyTo(point.lon, point.lat, 9);
    } catch { sessionStorage.removeItem("ma3_fly_destination"); }
  }, []);

  const sgrRoute = sgrRoutes.find(route => route.id === selectedSgrId) ?? sgrRoutes[0] ?? null;
  const routeStations = useMemo(() => sgrStations.filter(station => !sgrRoute || station.route_id === sgrRoute.id)
    .filter(station => !stationQuery.trim() || station.name.toLowerCase().includes(stationQuery.trim().toLowerCase())), [sgrStations, sgrRoute, stationQuery]);
  const allRouteStations = useMemo(() => sgrStations.filter(station => !sgrRoute || station.route_id === sgrRoute.id), [sgrStations, sgrRoute]);
  const selectedSgrOrigin = allRouteStations.find(station => station.id === sgrOriginId) ?? allRouteStations[0];
  const selectedSgrDestination = allRouteStations.find(station => station.id === sgrDestinationId) ?? allRouteStations[allRouteStations.length - 1];
  const stationName = (id: string) => sgrStations.find(station => station.id === id)?.name ?? id;

  useEffect(() => {
    if (tab !== "sgr" || !isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    setSgrLoading(true); setSgrError("");
    void (async () => {
      const [routesResult, stationsResult, schedulesResult] = await Promise.all([
        supabase!.from("sgr_routes").select("id,name,operator,geometry,source_url,source_updated_at").eq("active", true).order("name"),
        supabase!.from("sgr_stations").select("id,name,route_id,latitude,longitude,sequence_number").eq("active", true).order("sequence_number"),
        supabase!.from("sgr_schedules").select("id,train_code,route_id,origin_station_id,destination_station_id,departure_at,arrival_at,fare_kes,source_url,source_updated_at").eq("active", true).gte("departure_at", new Date(Date.now() - 86400000).toISOString()).order("departure_at").limit(100),
      ]);
      if (cancelled) return;
      const error = routesResult.error || stationsResult.error || schedulesResult.error;
      if (error) setSgrError(error.message);
      else {
        const routes = (routesResult.data ?? []) as SgrRoute[];
        setSgrRoutes(routes); setSgrStations((stationsResult.data ?? []) as SgrStation[]); setSgrSchedules((schedulesResult.data ?? []) as SgrSchedule[]);
        setSelectedSgrId(current => current || routes[0]?.id || "");
      }
      setSgrLoading(false);
    })().catch(error => { if (!cancelled) { setSgrError(error instanceof Error ? error.message : "Could not load SGR data."); setSgrLoading(false); } });
    return () => { cancelled = true; };
  }, [tab]);

  const searchFlights = async () => {
    setFlightError(""); setFlightRoutes([]); setSelectedFlight(null);
    if (!isSupabaseConfigured || !supabase) { setFlightError("Sourced flight schedules are temporarily unavailable."); return; }
    const originCode = airportCode(origin), destinationCode = airportCode(destination);
    if (!originCode || !destinationCode || originCode === destinationCode) { setFlightError("Choose two different airports to search."); return; }
    setFlightLoading(true);
    try {
      let request = supabase.from("flight_routes").select("id,service_type,airline,flight_number,origin_code,origin_name,destination_code,destination_name,departure_at,arrival_at,fare_kes,geometry,source_url,source_updated_at")
        .eq("active", true).eq("service_type", tab).eq("origin_code", originCode).eq("destination_code", destinationCode)
        .gte("departure_at", travelDate ? new Date(`${travelDate}T00:00:00`).toISOString() : new Date(Date.now() - 86400000).toISOString())
        .order("departure_at").limit(30);
      if (travelDate) request = request.lt("departure_at", new Date(new Date(`${travelDate}T00:00:00`).getTime() + 86400000).toISOString());
      const { data, error } = await request;
      if (error) throw error;
      setFlightRoutes((data ?? []) as FlightRoute[]);
      if (!data?.length) setFlightError("No sourced flights match those airports and date. Try another airport or travel date.");
    } catch (error) { setFlightError(error instanceof Error ? error.message : "Could not search the flight-route catalogue."); }
    finally { setFlightLoading(false); }
  };

  useEffect(() => {
    if (!map) return;
    for (let index = 0; index < 20; index++) removeLineLayer(map, `fly-track-${index}`);
    removePointLayer(map, "fly-stations");
    removePointLayer(map, "fly-tourist-destination");
    const geometry = tab === "sgr" ? sgrRoute?.geometry : selectedFlight?.geometry;
    const lines = tab === "sgr" ? railSegment(geometry, selectedSgrOrigin, selectedSgrDestination) : geometryLines(geometry).filter(line => line.length > 1);
    lines.forEach((line, index) => setLineLayer(map, `fly-track-${index}`, line.map(([lon, lat]) => [lat, lon]), tab === "sgr" ? "#d97706" : "#16a34a", 4, 0.95));
    if (tab === "sgr" && sgrRoute) {
      const originSequence = selectedSgrOrigin?.sequence_number ?? -Infinity;
      const destinationSequence = selectedSgrDestination?.sequence_number ?? Infinity;
      const points = sgrStations.filter(station => station.route_id === sgrRoute.id && station.sequence_number !== null
        && station.sequence_number >= Math.min(originSequence, destinationSequence) && station.sequence_number <= Math.max(originSequence, destinationSequence))
        .map(station => ({ id: station.id, lat: station.latitude, lon: station.longitude, color: station.id === sgrOriginId || station.id === sgrDestinationId ? "#16a34a" : "#d97706", radius: station.id === sgrOriginId || station.id === sgrDestinationId ? 7 : 4 }));
      setPointLayer(map, "fly-stations", points, 5);
    }
    if (touristDestination) setPointLayer(map, "fly-tourist-destination", [{ id: "explore-destination", lat: touristDestination.lat, lon: touristDestination.lon, color: "#dc2626", radius: 8 }], 8);
    const points = lines.flat();
    if (points.length && mapRef.current) {
      const lons = points.map(point => point[0]), lats = points.map(point => point[1]);
      mapRef.current.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], 72);
    }
  }, [map, tab, sgrRoute, sgrStations, selectedFlight, touristDestination, selectedSgrOrigin, selectedSgrDestination, sgrOriginId, sgrDestinationId]);

  const onDragStart = (event: React.PointerEvent<HTMLDivElement>) => { dragStart.current = { y: event.clientY, height: sheetHeight }; event.currentTarget.setPointerCapture(event.pointerId); };
  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => { if (dragStart.current) setSheetHeight(Math.max(20, Math.min(50, dragStart.current.height + ((dragStart.current.y - event.clientY) / window.innerHeight) * 100))); };
  return <div style={{ position: "relative", height: "calc(100dvh - var(--top-h) - var(--nav-h))", marginTop: "-12px", overflow: "hidden" }}>
    <MapLibreView ref={mapRef} center={NAIROBI} zoom={5} height="100%" borderRadius={0} onLoad={setMap} />
    <div style={{ position: "absolute", top: 8, left: 10, right: 10, zIndex: 20, maxWidth: 640, margin: "0 auto" }}>
      <header style={{ padding: "8px 10px", borderRadius: 14, background: "rgba(8,8,16,.78)", backdropFilter: "blur(12px)" }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><Plane size={17} style={{ color: "var(--ready)" }} /><h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem" }}>Fly & Rail</h2><span style={{ marginLeft: "auto", color: "var(--muted2)", fontSize: ".56rem" }}>Sourced route map</span></div></header>
      <div style={{ marginTop: 7 }}><PageTabs label="Travel sections" active={tab} tabs={TABS} onChange={value => { setTab(value as FlyTab); setSheetHeight(20); setSelectedFlight(null); setSheetOpen(true); }} /></div>
    </div>

    <section className="bpanel open" style={{ display: sheetOpen ? "flex" : "none", position: "absolute", left: 0, right: 0, bottom: 0, height: `${sheetHeight}vh`, maxHeight: "calc(100% - 106px)", zIndex: 15, overflowY: "auto" }}>
      <div className="bpanel-head" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={() => { dragStart.current = null; }} style={{ position: "sticky", top: 0, zIndex: 2, padding: "9px 14px 7px", background: "rgba(12,14,24,.58)", touchAction: "none", cursor: "ns-resize" }}><div style={{ width: 38, height: 4, borderRadius: 99, background: "var(--muted)", margin: "0 auto 7px" }} /><div style={{ display: "flex", alignItems: "center", gap: 7 }}><b style={{ fontSize: ".76rem", flex: 1 }}>{tab === "sgr" ? "SGR route & departures" : `${tab === "domestic" ? "Domestic" : "International"} flight search`}</b><button className="icon-btn" aria-label={sheetHeight > 35 ? "Collapse search panel" : "Expand search panel"} onClick={() => setSheetHeight(value => value > 35 ? 20 : 50)}>{sheetHeight > 35 ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button><button className="icon-btn" aria-label="Close panel" onClick={() => setSheetOpen(false)}><X size={14} /></button></div></div>
      <div style={{ padding: "0 14px 22px", maxWidth: 720, margin: "0 auto" }}>
        {tab !== "sgr" && <>
          <p style={{ color: "var(--muted2)", fontSize: ".61rem", lineHeight: 1.45, margin: "2px 0 10px" }}>Search available flight schedules. Selecting a result draws its verified route on the map.</p>
          {touristDestination && <p className="ios-glass" style={{ padding: 8, marginBottom: 8, color: "var(--muted2)", fontSize: ".59rem" }}><MapPin size={12} style={{ color: "var(--stop)", verticalAlign: "-2px" }} /> Explore destination pinned: {touristDestination.name}. Select the nearest available airport; this pin marks the place, not an airport.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>From<input data-page-search className="finput" list="fly-airports" placeholder="Search airport…" value={origin} onChange={event => setOrigin(event.target.value)} /></label>
            <label>To<input className="finput" list="fly-airports" placeholder="Search airport…" value={destination} onChange={event => setDestination(event.target.value)} /></label>
            <datalist id="fly-airports">{AIRPORTS.filter(airport => tab === "domestic" ? ["NBO", "WIL", "MBA", "KIS", "EDL", "MYD"].includes(airport.code) : true).map(airport => <option key={airport.code} value={airport.label} />)}</datalist>
            <label style={{ gridColumn: "1 / -1" }}>Travel date<input className="finput" type="date" value={travelDate} onChange={event => setTravelDate(event.target.value)} /></label>
          </div>
          <button className="btn btn-ready" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => void searchFlights()} disabled={flightLoading}><Search size={13} />{flightLoading ? "Searching sourced flights…" : "Search flights"}</button>
          {flightError && <p role="status" style={{ color: "var(--muted2)", fontSize: ".62rem", lineHeight: 1.45, marginTop: 8 }}>{flightError}</p>}
          {flightLoading && <p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 8 }}><LoaderCircle size={13} /> Loading routes…</p>}
          <div style={{ display: "grid", gap: 7, marginTop: 9 }}>{flightRoutes.map(flight => <button key={flight.id} className="card" onClick={() => { setSelectedFlight(flight); setSheetHeight(37); }} style={{ width: "100%", padding: 11, textAlign: "left", color: "var(--white)", cursor: "pointer", borderColor: selectedFlight?.id === flight.id ? "var(--go)" : "var(--border2)" }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><Plane size={15} style={{ color: "var(--go)" }} /><span style={{ flex: 1 }}><b style={{ display: "block", fontSize: ".72rem" }}>{flight.airline} · {flight.flight_number}</b><small style={{ color: "var(--muted2)" }}>{flight.origin_name} ({flight.origin_code}) → {flight.destination_name} ({flight.destination_code})</small></span>{flight.fare_kes !== null && <b style={{ color: "var(--ready)", fontSize: ".68rem" }}>KES {Number(flight.fare_kes).toLocaleString()}</b>}</div><small style={{ display: "flex", gap: 5, alignItems: "center", color: "var(--muted2)", marginTop: 6 }}><Clock size={10} />{new Date(flight.departure_at).toLocaleString()} · path supplied by source</small></button>)}</div>
          {selectedFlight && <div className="ios-glass" style={{ padding: 10, marginTop: 8, fontSize: ".6rem", color: "var(--muted2)" }}>Showing {selectedFlight.flight_number} route line on the map. <a href={selectedFlight.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ready)" }}>Source ↗</a> · updated {new Date(selectedFlight.source_updated_at).toLocaleDateString()}</div>}
        </>}

        {tab === "sgr" && <>
          {(sgrError || !sgrRoutes.length) && <div className="ios-glass" style={{ padding: 10, margin: "2px 0 9px", display: "flex", gap: 7, fontSize: ".61rem", lineHeight: 1.45, color: "var(--muted2)" }}><Database size={13} style={{ color: "var(--ready)", flexShrink: 0 }} /><span>{sgrError ? "SGR route information is temporarily unavailable." : "No SGR route information is available yet."}</span></div>}
          {sgrLoading && <p style={{ color: "var(--muted2)", fontSize: ".64rem" }}><LoaderCircle size={14} /> Loading rail data…</p>}
          {sgrRoute ? <>
            <label>Rail service<select className="finput" value={sgrRoute.id} onChange={event => setSelectedSgrId(event.target.value)}>{sgrRoutes.map(route => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>
            <p style={{ color: "var(--muted2)", fontSize: ".58rem", marginTop: 5 }}>{sgrRoute.operator}{sgrRoute.source_updated_at ? ` · updated ${new Date(sgrRoute.source_updated_at).toLocaleDateString()}` : ""}{sgrRoute.source_url ? <> · <a href={sgrRoute.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ready)" }}>source</a></> : ""}</p>
            <div style={{ position: "relative", margin: "9px 0" }}><Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input data-page-search className="finput" style={{ paddingLeft: 32 }} placeholder="Search SGR stations…" value={stationQuery} onChange={event => setStationQuery(event.target.value)} /></div>
            <div className="card" style={{ padding: 10, display: "grid", gap: 8 }}><p className="sec-label">Choose your SGR journey</p><label>Board at<select className="finput" value={selectedSgrOrigin?.id ?? ""} onChange={event => setSgrOriginId(event.target.value)}>{allRouteStations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label><label>Alight at<select className="finput" value={selectedSgrDestination?.id ?? ""} onChange={event => setSgrDestinationId(event.target.value)}>{allRouteStations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label><p style={{ fontSize: ".57rem", color: "var(--muted2)" }}>The map highlights the sourced track between these stations only.</p><div>{routeStations.map(station => <button key={station.id} onClick={() => setSgrDestinationId(station.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 0", width: "100%", textAlign: "left", color: "var(--white)", background: "transparent", border: 0, borderBottom: "1px solid var(--border)", cursor: "pointer" }}><MapPin size={12} style={{ color: station.id === sgrDestinationId ? "var(--go)" : "var(--ready)" }} /><span style={{ flex: 1, fontSize: ".63rem" }}>{station.name}</span><small style={{ color: "var(--muted2)" }}>Alight</small></button>)}</div></div>
            <div className="card" style={{ padding: 10, marginTop: 8 }}><p className="sec-label">Published departures</p>{sgrSchedules.filter(schedule => schedule.route_id === sgrRoute.id).map(schedule => <div key={schedule.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}><b style={{ fontSize: ".67rem" }}>{schedule.train_code} · {stationName(schedule.origin_station_id)} → {stationName(schedule.destination_station_id)}</b><p style={{ color: "var(--muted2)", fontSize: ".59rem", marginTop: 4 }}>{new Date(schedule.departure_at).toLocaleString()} – {new Date(schedule.arrival_at).toLocaleTimeString()}{schedule.fare_kes !== null ? ` · KES ${Number(schedule.fare_kes).toLocaleString()}` : ""}</p><small style={{ fontSize: ".54rem", color: "var(--muted2)" }}>Source refreshed {new Date(schedule.source_updated_at).toLocaleDateString()} · <a href={schedule.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ready)" }}>source</a></small></div>)}{!sgrSchedules.some(schedule => schedule.route_id === sgrRoute.id) && <p style={{ color: "var(--muted2)", fontSize: ".6rem", marginTop: 6 }}>No sourced timetable rows published yet.</p>}</div>
          </> : <div className="ios-glass" style={{ padding: 12, color: "var(--muted2)", fontSize: ".68rem" }}>SGR route and station information will appear here when published.</div>}
          <div className="ios-glass" style={{ padding: 9, marginTop: 8, display: "flex", gap: 7, color: "var(--muted2)", fontSize: ".56rem", lineHeight: 1.45 }}><AlertTriangle size={12} style={{ color: "var(--ready)", flexShrink: 0 }} />Only verified track geometry and dated official/authorized timetable data belong here. A map line alone is not evidence that a passenger train is operating.</div>
        </>}
      </div>
    </section>
  </div>;
}
