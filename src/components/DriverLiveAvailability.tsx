import { useEffect, useMemo, useState } from "react";
import { Bus, Copy, MapPin, Power, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { useAuthContext } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Approval = { status: "pending" | "approved" | "suspended"; route_ids: string[] };
type Coords = { latitude: number; longitude: number; accuracy: number };
const ROUTES = MA3_GTFS.routes;

interface DriverLiveAvailabilityProps {
  routeId: string;
  onRouteChange: (routeId: string) => void;
  seats: number;
  onSeatsChange: (seats: number) => void;
}

export default function DriverLiveAvailability({ routeId, onRouteChange, seats, onSeatsChange }: DriverLiveAvailabilityProps) {
  const { user, loading } = useAuthContext();
  const [approval, setApproval] = useState<Approval | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [online, setOnline] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const approvedRoutes = useMemo(() => approval?.status === "approved"
    ? ROUTES.filter(route => approval.route_ids.includes(route.id)) : [], [approval]);

  useEffect(() => {
    if (loading) return;
    if (!supabase || !isSupabaseConfigured) { setApprovalLoading(false); setMessage("Connect Supabase and apply the driver-live migration to enable online tracking."); return; }
    if (!user) { setApproval(null); setApprovalLoading(false); return; }
    let active = true;
    setApprovalLoading(true);
    void supabase.from("ma3_driver_profiles").select("status,route_ids").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      setApproval(data as Approval | null);
      setApprovalLoading(false);
    });
    return () => { active = false; };
  }, [loading, user?.id]);

  useEffect(() => {
    if (approvedRoutes.length && !approvedRoutes.some(route => route.id === routeId)) onRouteChange(approvedRoutes[0].id);
  }, [approvedRoutes, routeId, onRouteChange]);

  useEffect(() => {
    if (!online || !user?.id || !supabase) return;
    const client = supabase;
    let stopped = false;
    let latest: GeolocationPosition | null = null;
    let lastWrite = 0;
    const publish = async (position: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastWrite < 8_000) return;
      lastWrite = now;
      const { error } = await client.from("ma3_driver_live_locations").upsert({
        user_id: user.id,
        route_id: routeId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
        seats_available: seats,
      }, { onConflict: "user_id" });
      if (stopped) return;
      if (error) {
        setMessage(`Could not publish GPS: ${error.message}`);
        setOnline(false);
        return;
      }
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
      setLastSent(new Date().toISOString());
      setMessage("Online on your approved route · GPS refreshes while this page is active.");
    };
    if (!navigator.geolocation) {
      setMessage("This browser does not provide GPS location.");
      setOnline(false);
      return;
    }
    setMessage("Waiting for phone GPS permission and a location fix…");
    const watchId = navigator.geolocation.watchPosition(position => {
      latest = position;
      void publish(position);
    }, error => {
      if (stopped) return;
      setMessage(error.code === error.PERMISSION_DENIED
        ? "Location access was denied. Allow this site in phone settings, then select Go Online again."
        : error.message || "Could not read the phone GPS.");
      setOnline(false);
    }, { enableHighAccuracy: true, maximumAge: 3_000, timeout: 20_000 });
    const heartbeat = window.setInterval(() => { if (latest) void publish(latest); }, 10_000);
    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
      void client.from("ma3_driver_live_locations").delete().eq("user_id", user.id);
    };
  }, [online, user?.id, routeId, seats]);

  const goOnline = () => {
    setMessage("");
    if (!supabase || !isSupabaseConfigured) { setMessage("Connect Supabase and apply the driver-live migration first."); return; }
    if (!user) { setMessage("Sign in to your driver account first."); return; }
    if (approval?.status !== "approved" || !approvedRoutes.some(route => route.id === routeId)) {
      setMessage("This driver account or route is not approved for public rider maps."); return;
    }
    if (!consent) { setMessage("Tick the location consent box before going online."); return; }
    if (!navigator.geolocation) { setMessage("This browser does not provide GPS location."); return; }
    setOnline(true);
  };

  const copyAccountId = async () => {
    if (!user?.id) return;
    try { await navigator.clipboard.writeText(user.id); toast("Driver account ID copied"); }
    catch { toast("Select the account ID below and copy it"); }
  };

  const currentRoute = approvedRoutes.find(route => route.id === routeId);

  return <section className="card" style={{ padding: 16, borderTop: `3px solid ${online ? "var(--go)" : "var(--ready)"}`, marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <div><p className="sec-label">Live driver availability</p><h2 style={{ fontSize: "1.05rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Bus size={18} style={{ color: online ? "var(--go)" : "var(--ready)" }} />{online ? "Online for riders" : "Offline"}</h2></div>
      {online ? <Wifi size={20} style={{ color: "var(--go)" }} /> : <WifiOff size={20} style={{ color: "var(--muted2)" }} />}
    </div>

    {!user && !loading && <div className="ios-glass" style={{ padding: 11, marginTop: 12 }}><p style={{ margin: "0 0 8px", color: "var(--muted2)", fontSize: ".7rem" }}>Sign in to the driver account. Online location requires an approved driver profile.</p><Link href="/login"><button className="btn btn-ready">Sign in</button></Link></div>}
    {approvalLoading && <p style={{ marginTop: 10, color: "var(--muted2)", fontSize: ".68rem" }}>Checking route approval…</p>}
    {user && !approvalLoading && <div className="ios-glass" style={{ padding: 11, marginTop: 12 }}>
      {!approval
        ? <p style={{ margin: 0, color: "var(--ready)", fontSize: ".7rem", lineHeight: 1.5 }}>Driver account is pending admin approval. Riders cannot see this account until an authorised reviewer approves it.</p>
        : approval.status !== "approved"
          ? <p style={{ margin: 0, color: "var(--ready)", fontSize: ".7rem", lineHeight: 1.5 }}>Driver status: {approval.status}. Public live location is available only after verification and approval.</p>
          : approvedRoutes.length === 0
            ? <p style={{ margin: 0, color: "var(--ready)", fontSize: ".7rem", lineHeight: 1.5 }}>No Ma3 routes have been approved for this driver account yet.</p>
            : <>
              <label htmlFor="live-driver-route">Approved route · riders see this vehicle on this route</label>
              <select id="live-driver-route" className="finput" value={routeId} onChange={event => onRouteChange(event.target.value)} disabled={online}>
                {approvedRoutes.map(route => <option key={route.id} value={route.id}>{route.sn} · {route.ln}</option>)}
              </select>
              <label htmlFor="live-driver-seats" style={{ marginTop: 10 }}>Seats currently available</label>
              <input id="live-driver-seats" className="finput" type="number" min={0} max={100} value={seats} onChange={event => onSeatsChange(Math.max(0, Math.min(100, Number(event.target.value))))} disabled={online} />
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, textTransform: "none", letterSpacing: 0, color: "var(--muted2)", fontSize: ".67rem", lineHeight: 1.45 }}>
                <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={online} />
                I choose to show my live GPS dot, approved route and seat count to signed-in riders while I am online. I can go offline at any time.
              </label>
              {online
                ? <button type="button" className="btn btn-stop" style={{ width: "100%", marginTop: 12 }} onClick={() => { setOnline(false); setCoords(null); setMessage("Going offline and removing the live driver marker…"); }}><Power size={15} />Go offline · end shift</button>
                : <button type="button" className="btn btn-go" style={{ width: "100%", marginTop: 12 }} disabled={!consent || !currentRoute} onClick={goOnline}><Power size={15} />Go online · start GPS</button>}
            </>}
    </div>}

    {message && <p role="status" style={{ margin: "9px 0 0", color: message.toLowerCase().includes("could not") || message.toLowerCase().includes("denied") ? "var(--stop)" : "var(--muted2)", fontSize: ".66rem", lineHeight: 1.5 }}>{message}</p>}
    {online && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
      <div className="ios-glass" style={{ padding: 9 }}><p className="sec-label">Live position</p><span style={{ fontFamily: "var(--font-mono)", fontSize: ".65rem" }}>{coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} · ±${Math.round(coords.accuracy)} m` : "Waiting for GPS…"}</span></div>
      <div className="ios-glass" style={{ padding: 9 }}><p className="sec-label">Last update</p><span style={{ fontFamily: "var(--font-mono)", fontSize: ".65rem" }}>{lastSent ? new Date(lastSent).toLocaleTimeString() : "Waiting…"}</span></div>
    </div>}

    {user && <div style={{ marginTop: 10, display: "flex", gap: 7, alignItems: "flex-start", color: "var(--muted2)", fontSize: ".63rem", lineHeight: 1.5 }}><ShieldCheck size={14} style={{ color: "var(--ready)", flexShrink: 0 }} /><span>Tracking is active only after you choose Go Online and allow GPS. This PWA must remain open; screen-off/background tracking is not guaranteed. Rider maps hide a vehicle if its GPS update is older than 45 seconds. For reliable all-shift background tracking, use a native Android foreground-location service.</span></div>}
    {user && approval?.status !== "approved" && <details style={{ marginTop: 9, color: "var(--muted2)", fontSize: ".62rem" }}><summary>Copy account ID for the project administrator</summary><div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 6 }}><code style={{ overflowWrap: "anywhere" }}>{user.id}</code><button className="btn btn-ghost" type="button" onClick={() => void copyAccountId()}><Copy size={12} />Copy</button></div></details>}
  </section>;
}
