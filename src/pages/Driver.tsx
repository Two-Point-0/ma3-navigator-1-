import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bus, Car, MapPin, Power, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ROLE_STORAGE_KEY, type Ma3Role } from "@/components/Onboarding";
import PageTabs from "@/components/PageTabs";
import { APP_MODE } from "@/lib/appMode";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const LOCATION_KEY = "ma3_demo_driver_location";
type DriverStatus = "offline" | "broadcasting";
type SharedLocation = { lat: number; lng: number; accuracy: number; updatedAt: string; driverType: "matatu-driver" | "carpool-driver"; seatsAvailable: number; routeLabel: string };
type DemoCoordinates = { latitude: number; longitude: number; accuracy: number };
const DRIVER_TABS = [
  { id: "broadcast", label: "Broadcast", Icon: Wifi },
  { id: "vehicle", label: "Vehicle", Icon: Bus },
  { id: "safety", label: "Safety", Icon: ShieldCheck },
] as const;
const MATATU_ROUTES = MA3_GTFS.routes;
const ROUTE_STOPS = MA3_GTFS.routeStops as Record<string, string[]>;
const STOPS = MA3_GTFS.stops as unknown as Record<string, [string, number, number]>;

function saveLocation(location: SharedLocation) {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
  window.dispatchEvent(new CustomEvent("ma3-location-update", { detail: location }));
}

export default function DriverPage() {
  const role = (localStorage.getItem(ROLE_STORAGE_KEY) || "passenger") as Ma3Role;
  const driverType = role === "carpool-driver" ? "carpool-driver" : "matatu-driver";
  const [status, setStatus] = useState<DriverStatus>("offline");
  const [coords, setCoords] = useState<DemoCoordinates | null>(null);
  const [seats, setSeats] = useState(driverType === "matatu-driver" ? 14 : 3);
  const [routeLabel, setRouteLabel] = useState(driverType === "matatu-driver" ? "Demo route · CBD — Westlands" : "Planned carpool · Karen — CBD");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("broadcast");
  const [checks, setChecks] = useState({ licence: false, insurance: false, roadworthy: false, consent: false });
  const [routeId, setRouteId] = useState(MATATU_ROUTES[0]?.id ?? "");
  const [waitingCounts, setWaitingCounts] = useState<Record<string, number>>({});
  const [demandStatus, setDemandStatus] = useState("Waiting for stop-demand data");
  const demoCoords = useMemo(() => ({ latitude: -1.2864, longitude: 36.8172, accuracy: 25 }), []);
  const ready = Object.values(checks).every(Boolean);
  const icon = driverType === "matatu-driver" ? <Bus size={20} /> : <Car size={20} />;
  const checkItems = driverType === "matatu-driver" ? [
    ["licence", "I hold the correct current driving licence."],
    ["insurance", "The vehicle has current passenger/PSV insurance for its actual use."],
    ["roadworthy", "The vehicle has current inspection and roadworthiness evidence."],
    ["consent", "I consent to location sharing while this broadcast is active."],
  ] : [
    ["licence", "I hold a current driving licence."],
    ["insurance", "I have confirmed with my insurer that passenger cost-sharing is covered."],
    ["roadworthy", "The vehicle is roadworthy and properly registered."],
    ["consent", "I consent to location sharing while this broadcast is active."],
  ];

  useEffect(() => {
    if (driverType !== "matatu-driver") return;
    if (!isSupabaseConfigured || !supabase) { setDemandStatus("Connect Supabase to view opted-in pickup counts."); return; }
    let cancelled = false;
    const loadDemand = async () => {
      try {
        let user = (await supabase!.auth.getUser()).data.user;
        if (!user) {
          const { data, error } = await supabase!.auth.signInAnonymously();
          if (error || !data.user) throw error ?? new Error("A guest session is required.");
          user = data.user;
        }
        const { data, error } = await supabase!.rpc("get_ma3_waiting_counts", { p_route_id: routeId });
        if (error) throw error;
        if (cancelled) return;
        setWaitingCounts(Object.fromEntries((data ?? []).map((row: { stop_id: string; waiting_count: number }) => [row.stop_id, Number(row.waiting_count)])));
        setDemandStatus("Anonymous, self-reported pickup counts · refreshed every 15 seconds · requests expire after 30 minutes");
      } catch (error) {
        if (!cancelled) { setWaitingCounts({}); setDemandStatus(error instanceof Error ? error.message : "Could not load pickup counts."); }
      }
    };
    void loadDemand();
    const timer = window.setInterval(() => void loadDemand(), 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [driverType, routeId]);

  useEffect(() => {
    if (status !== "broadcasting") return;
    const publish = (position?: GeolocationPosition) => {
      const c = APP_MODE.demo ? demoCoords : position?.coords || demoCoords;
      setCoords(c);
      const stamp = new Date().toISOString();
      saveLocation({ lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, updatedAt: stamp, driverType, seatsAvailable: seats, routeLabel });
      setLastSent(stamp);
    };
    publish();
    const id = navigator.geolocation?.watchPosition(publish, () => publish(), { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    const timer = window.setInterval(() => publish(), 10000);
    return () => { if (id !== undefined && navigator.geolocation) navigator.geolocation.clearWatch(id); window.clearInterval(timer); };
  }, [status, seats, routeLabel, driverType, demoCoords]);

  const toggle = () => {
    if (status === "offline" && !ready) { toast("Complete the readiness checks before broadcasting"); return; }
    setStatus(current => current === "offline" ? "broadcasting" : "offline");
    toast(status === "offline" ? (APP_MODE.demo ? "Demo location preview started" : "Location broadcast started") : "Location broadcast stopped");
  };
  const jumpToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(`driver-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (role !== "matatu-driver" && role !== "carpool-driver") return <div className="inner" style={{ paddingTop: 28 }}><div className="card" style={{ padding: 20, borderLeft: "3px solid var(--stop)" }}><p className="sec-label">Passenger workspace</p><h1 style={{ fontSize: "1.25rem" }}>Driver access is not enabled</h1><p style={{ color: "var(--muted2)", fontSize: ".8rem", lineHeight: 1.5 }}>Choose a driver role during onboarding before broadcasting location. Passenger accounts cannot publish coordinates.</p><Link href="/profile"><button className="btn btn-ready">Open profile</button></Link></div></div>;

  return <div className="inner" style={{ paddingTop: 12 }}>
    <PageTabs label="Driver sections" active={activeSection} tabs={DRIVER_TABS} onChange={jumpToSection} />
    <div id="driver-broadcast" className="card" style={{ padding: 18, borderTop: `3px solid ${status === "broadcasting" ? "var(--go)" : "var(--stop)"}`, scrollMarginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><div><p className="sec-label">Driver workspace</p><h1 style={{ fontSize: "1.4rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>{icon}{driverType === "matatu-driver" ? "Matatu driver" : "Carpool driver"}</h1><p style={{ color: "var(--muted2)", fontSize: ".75rem", lineHeight: 1.5, marginTop: 8 }}>{APP_MODE.demo ? "Demo mode: fictional vehicle data and simulated coordinates only." : "Location is shared only while you explicitly broadcast."} This pilot does not create a booking or verify documents automatically.</p></div><div style={{ color: status === "broadcasting" ? "var(--go)" : "var(--stop)" }}>{status === "broadcasting" ? <Wifi size={22} /> : <WifiOff size={22} />}</div></div>
      <button onClick={toggle} className={status === "broadcasting" ? "btn btn-stop" : "btn btn-go"} style={{ width: "100%", marginTop: 18 }}><Power size={15} />{status === "broadcasting" ? "Stop location preview" : "Start demo location preview"}</button>
    </div>
    <div className="ios-glass" style={{ padding: 18, marginTop: 12 }}><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}><ShieldCheck size={17} style={{ color: ready ? "var(--go)" : "var(--ready)" }} /><p className="sec-label" style={{ margin: 0 }}>Readiness before live operations</p></div>{checkItems.map(([key, label]) => <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 9, textTransform: "none", letterSpacing: 0, fontSize: ".72rem", marginBottom: 9, color: "var(--muted2)" }}><input type="checkbox" checked={checks[key as keyof typeof checks]} onChange={event => setChecks(previous => ({ ...previous, [key]: event.target.checked }))} />{label}</label>)}<p style={{ margin: "8px 0 0", fontSize: ".6rem", lineHeight: 1.5, color: "var(--muted)" }}>These are attestations for the prototype. Before public matching, Ma3 must verify the records with an approved workflow and backend gate.</p></div>
    <div id="driver-vehicle" className="card" style={{ padding: 18, marginTop: 12, scrollMarginTop: 16 }}><p className="sec-label">Operating details</p><label>Route or trip</label><input className="finput" value={routeLabel} onChange={event => setRouteLabel(event.target.value)} />{driverType === "matatu-driver" && <label style={{ marginTop: 10 }}>Match pickup counts to route<select className="finput" value={routeId} onChange={event => setRouteId(event.target.value)}>{MATATU_ROUTES.map(route => <option key={route.id} value={route.id}>{route.sn} · {route.ln}</option>)}</select></label>}<label style={{ marginTop: 12 }}>{driverType === "matatu-driver" ? "Available seats" : "Seats offered"}</label><input className="finput" type="number" min={0} max={50} value={seats} onChange={event => setSeats(Math.max(0, Number(event.target.value)))} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}><div className="card" style={{ padding: 12 }}><MapPin size={16} style={{ color: "var(--go)" }} /><p className="sec-label" style={{ marginTop: 8 }}>Position</p><b style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem" }}>{coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "Waiting"}</b></div><div className="card" style={{ padding: 12 }}><Activity size={16} style={{ color: "var(--ready)" }} /><p className="sec-label" style={{ marginTop: 8 }}>Last sent</p><b style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem" }}>{lastSent ? new Date(lastSent).toLocaleTimeString() : "Not yet"}</b></div></div></div>
    {driverType === "matatu-driver" && <div className="ios-glass" style={{ padding: 16, marginTop: 12 }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><Bus size={16} style={{ color: "var(--ready)" }} /><p className="sec-label" style={{ margin: 0, flex: 1 }}>Waiting pickup requests</p><span style={{ color: "var(--ready)", fontSize: ".58rem" }}>15 sec refresh</span></div><p style={{ margin: "7px 0 10px", color: "var(--muted2)", fontSize: ".58rem", lineHeight: 1.45 }}>{demandStatus}. Counts are anonymous and self-reported; they are not confirmed bookings or guaranteed passengers.</p><div style={{ display: "grid", gap: 5 }}>{(ROUTE_STOPS[routeId] ?? []).map(stopId => { const stop = STOPS[stopId]; if (!stop) return null; const count = waitingCounts[stopId] ?? 0; return <div key={stopId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 8px", borderRadius: 9, background: "var(--glass)", border: "1px solid var(--border)" }}><span style={{ fontSize: ".65rem" }}>{stop[0]}</span><b style={{ minWidth: 26, textAlign: "center", color: count ? "var(--ready)" : "var(--muted2)", fontFamily: "var(--font-mono)" }}>{count}</b></div>; })}</div></div>}
    <div id="driver-safety" className="card" style={{ padding: 18, marginTop: 12, borderLeft: "3px solid var(--ready)", scrollMarginTop: 16 }}><div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><AlertTriangle size={16} style={{ color: "var(--ready)" }} /><p style={{ color: "var(--muted2)", fontSize: ".72rem", lineHeight: 1.55, margin: 0 }}>Insurance, licensing, inspection and privacy checks are legal launch requirements where the operating model makes Ma3 a passenger transport or transport-network service. Cost-sharing limits do not replace those requirements.</p></div></div>
  </div>;
}
