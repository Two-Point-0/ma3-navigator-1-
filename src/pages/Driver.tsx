import { useEffect, useState } from "react";
import { AlertTriangle, Bus, Car, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { ROLE_STORAGE_KEY, type Ma3Role } from "@/components/Onboarding";
import PageTabs from "@/components/PageTabs";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import DriverLiveAvailability from "@/components/DriverLiveAvailability";
import DriverParcelInbox from "@/components/DriverParcelInbox";
import DriverTrafficReports from "@/components/DriverTrafficReports";
import DriverStopAlerts from "@/components/DriverStopAlerts";

const DRIVER_TABS = [
  { id: "broadcast", label: "Broadcast", Icon: Bus },
  { id: "vehicle", label: "Vehicle", Icon: Car },
  { id: "safety", label: "Safety", Icon: ShieldCheck },
] as const;
const MATATU_ROUTES = MA3_GTFS.routes;
const ROUTE_STOPS = MA3_GTFS.routeStops as Record<string, string[]>;
const STOPS = MA3_GTFS.stops as unknown as Record<string, [string, number, number]>;

export default function DriverPage() {
  const role = (localStorage.getItem(ROLE_STORAGE_KEY) || "passenger") as Ma3Role;
  const driverType = role === "carpool-driver" ? "carpool-driver" : "matatu-driver";
  const [routeId, setRouteId] = useState(MATATU_ROUTES[0]?.id ?? "");
  const [seats, setSeats] = useState(driverType === "matatu-driver" ? 14 : 3);
  const [activeSection, setActiveSection] = useState("broadcast");
  const [driverOnline, setDriverOnline] = useState(false);
  const [checks, setChecks] = useState({ licence: false, insurance: false, roadworthy: false, consent: false });
  const [waitingCounts, setWaitingCounts] = useState<Record<string, { waiting: number; walking: number }>>({});
  const [demandStatus, setDemandStatus] = useState("Waiting for stop-demand data");
  const ready = Object.values(checks).every(Boolean);
  const selectedRoute = MATATU_ROUTES.find(route => route.id === routeId);
  const vehicleIcon = driverType === "matatu-driver" ? <Bus size={20} /> : <Car size={20} />;
  const checkItems: [keyof typeof checks, string][] = driverType === "matatu-driver" ? [
    ["licence", "I hold the correct current driving licence."],
    ["insurance", "The vehicle has current passenger/PSV insurance for its actual use."],
    ["roadworthy", "The vehicle has current inspection and roadworthiness evidence."],
    ["consent", "I understand live GPS is only shared while I am online."],
  ] : [
    ["licence", "I hold a current driving licence."],
    ["insurance", "I have confirmed passenger cost-sharing with my insurer."],
    ["roadworthy", "The vehicle is roadworthy and properly registered."],
    ["consent", "I understand live GPS is only shared while I am online."],
  ];

  useEffect(() => {
    if (driverType !== "matatu-driver") return;
    const client = supabase;
    if (!isSupabaseConfigured || !client) { setDemandStatus("Connect Supabase to view opted-in pickup counts."); return; }
    let cancelled = false;
    const loadDemand = async () => {
      try {
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        if (!authData.user?.phone_confirmed_at) {
          if (!cancelled) { setWaitingCounts({}); setDemandStatus("Sign in with a verified phone number; only an approved driver on this route can view demand."); }
          return;
        }
        const { data, error } = await client.rpc("get_ma3_waiting_counts", { p_route_id: routeId });
        if (error) throw error;
        if (cancelled) return;
        setWaitingCounts(Object.fromEntries((data ?? []).map((row: { stop_id: string; waiting_count: number; walking_count: number }) => [row.stop_id, { waiting: Number(row.waiting_count), walking: Number(row.walking_count) }])));
        setDemandStatus("Verified, route-approved driver view · anonymous counts only · refreshed every 15 seconds · walking status expires after 10 minutes");
      } catch (error) {
        if (!cancelled) { setWaitingCounts({}); setDemandStatus(error instanceof Error ? error.message : "Could not load pickup counts."); }
      }
    };
    void loadDemand();
    const timer = window.setInterval(() => void loadDemand(), 15_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [driverType, routeId]);

  const jumpToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(`driver-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (role !== "matatu-driver" && role !== "carpool-driver") return <div className="inner" style={{ paddingTop: 28 }}>
    <div className="card" style={{ padding: 20, borderLeft: "3px solid var(--stop)" }}>
      <p className="sec-label">Passenger workspace</p>
      <h1 style={{ fontSize: "1.25rem" }}>Driver operations are not enabled</h1>
      <p style={{ color: "var(--muted2)", fontSize: ".8rem", lineHeight: 1.5 }}>Passenger accounts can still opt in to location sharing with a paired account. Driver broadcasts are available only in the approved driver workspace.</p>
      <Link href="/location-share"><button className="btn btn-go">Open location sharing</button></Link>
    </div>
  </div>;

  return <div className="inner" style={{ paddingTop: 12 }}>
    <PageTabs label="Driver sections" active={activeSection} tabs={DRIVER_TABS} onChange={jumpToSection} />
    <div id="driver-broadcast" style={{ scrollMarginTop: 16 }}>
      <DriverLiveAvailability routeId={routeId} onRouteChange={setRouteId} seats={seats} onSeatsChange={setSeats} onOnlineChange={setDriverOnline} />
    </div>

    {driverType === "matatu-driver" && <DriverStopAlerts routeId={routeId} online={driverOnline} />}

    {driverType === "matatu-driver" && <DriverTrafficReports routeId={routeId} routeName={selectedRoute?.sn ?? routeId} />}

    <section className="ios-glass" style={{ padding: 18, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <ShieldCheck size={17} style={{ color: ready ? "var(--go)" : "var(--ready)" }} />
        <p className="sec-label" style={{ margin: 0 }}>Readiness reminders · self-attested only</p>
      </div>
      {checkItems.map(([key, label]) => <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 9, textTransform: "none", letterSpacing: 0, fontSize: ".72rem", marginBottom: 9, color: "var(--muted2)" }}>
        <input type="checkbox" checked={checks[key]} onChange={event => setChecks(previous => ({ ...previous, [key]: event.target.checked }))} />{label}
      </label>)}
      <p style={{ margin: "8px 0 0", fontSize: ".6rem", lineHeight: 1.5, color: "var(--muted)" }}>These checkboxes do not verify documents. Public driver approval must be performed by an authorised reviewer in Supabase.</p>
    </section>

    <section id="driver-vehicle" className="card" style={{ padding: 18, marginTop: 12, scrollMarginTop: 16 }}>
      <p className="sec-label">Operating details</p>
      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>{vehicleIcon}<div><b style={{ fontSize: ".78rem" }}>{driverType === "matatu-driver" ? "Matatu route" : "Carpool trip"}</b><p style={{ color: "var(--muted2)", fontSize: ".68rem", marginTop: 4 }}>{selectedRoute ? `${selectedRoute.sn} · ${selectedRoute.ln}` : "Select an approved route in Live driver availability above"}</p></div></div>
      <p style={{ color: "var(--muted2)", fontSize: ".64rem", lineHeight: 1.5, marginTop: 10 }}>The same approved route and seat count are used by the live rider map and route pickup-demand panel.</p>
    </section>

    {driverType === "matatu-driver" && <section className="ios-glass" style={{ padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Bus size={16} style={{ color: "var(--ready)" }} /><p className="sec-label" style={{ margin: 0, flex: 1 }}>Stage pickup demand</p><span style={{ color: "var(--ready)", fontSize: ".58rem" }}>15 sec refresh</span></div>
      <p style={{ margin: "7px 0 10px", color: "var(--muted2)", fontSize: ".58rem", lineHeight: 1.45 }}>{demandStatus}. “Walking” means a one-time GPS proximity check within an 800 m straight-line radius; it is not a confirmed booking. No passenger account, phone number, or exact location is shown.</p>
      <div style={{ display: "grid", gap: 5 }}>{(ROUTE_STOPS[routeId] ?? []).map(stopId => {
        const stop = STOPS[stopId]; if (!stop) return null;
        const counts = waitingCounts[stopId] ?? { waiting: 0, walking: 0 };
        return <div key={stopId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 9, background: "var(--glass)", border: "1px solid var(--border)" }}><span style={{ fontSize: ".65rem", flex: 1 }}>{stop[0]}</span><span style={{ color: counts.waiting ? "var(--ready)" : "var(--muted2)", fontSize: ".59rem", fontFamily: "var(--font-mono)" }}>{counts.waiting} waiting</span><span style={{ color: counts.walking ? "var(--go)" : "var(--muted2)", fontSize: ".59rem", fontFamily: "var(--font-mono)" }}>{counts.walking} walking</span></div>;
      })}</div>
    </section>}
    {driverType === "matatu-driver" && <DriverParcelInbox />}

    <section id="driver-safety" className="card" style={{ padding: 18, marginTop: 12, borderLeft: "3px solid var(--ready)", scrollMarginTop: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><AlertTriangle size={16} style={{ color: "var(--ready)" }} /><p style={{ color: "var(--muted2)", fontSize: ".72rem", lineHeight: 1.55, margin: 0 }}>Insurance, licensing, inspection and privacy checks are legal launch requirements where the operating model makes Ma3 a passenger-transport or transport-network service. Cost-sharing limits do not replace those requirements.</p></div>
    </section>
  </div>;
}
