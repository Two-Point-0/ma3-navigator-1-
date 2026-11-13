import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { haversineKm } from "@/data/ma3_core";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const STOPS = MA3_GTFS.stops as unknown as Record<string, [string, number, number]>;
const ROUTE_STOPS = MA3_GTFS.routeStops as Record<string, string[]>;
const ALERT_RADIUS_KM = 0.4;

type Demand = { off: number; on: number };

/** Short two-tone beep so the driver notices without looking at the phone. */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); gain.gain.value = 0.15;
    osc.frequency.setValueAtTime(880, ctx.currentTime); osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.32);
  } catch { /* sound not allowed; the screen alert still shows */ }
}

/**
 * For the driver: tells you, stop by stop, how many passengers are getting off (and waiting to board).
 * Counts are anonymous. Only passengers who use the app and chose to share are counted.
 */
export default function DriverStopAlerts({ routeId, online }: { routeId: string; online: boolean }) {
  const [demand, setDemand] = useState<Record<string, Demand>>({});
  const [status, setStatus] = useState("Go online to see who is getting off at each stop.");
  const [position, setPosition] = useState<[number, number] | null>(null);
  const alerted = useRef<Set<string>>(new Set());

  // Ask the server every 8 seconds while online.
  useEffect(() => {
    if (!online) { setDemand({}); setStatus("Go online to see who is getting off at each stop."); alerted.current.clear(); return; }
    const client = supabase;
    if (!isSupabaseConfigured || !client) { setStatus("Connect Supabase to see passenger stop alerts."); return; }
    let cancelled = false;
    const load = async () => {
      const [off, on] = await Promise.all([
        client.rpc("get_ma3_alighting_counts", { p_route_id: routeId }),
        client.rpc("get_ma3_waiting_counts", { p_route_id: routeId }),
      ]);
      if (cancelled) return;
      if (off.error) { setStatus(off.error.message); return; }
      const next: Record<string, Demand> = {};
      for (const row of (off.data ?? []) as { stop_id: string; alighting_count: number }[]) next[row.stop_id] = { off: Number(row.alighting_count), on: 0 };
      for (const row of (on.data ?? []) as { stop_id: string; waiting_count: number; walking_count: number }[]) {
        next[row.stop_id] = { off: next[row.stop_id]?.off ?? 0, on: Number(row.waiting_count) + Number(row.walking_count) };
      }
      setDemand(next);
      setStatus("Anonymous counts from passengers using the app · refreshed every 8 seconds");
    };
    void load();
    const timer = window.setInterval(() => void load(), 8_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [online, routeId]);

  // Watch the driver's own position to know how close each stop is.
  useEffect(() => {
    if (!online || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => setPosition([p.coords.latitude, p.coords.longitude]),
      () => setStatus("Allow location so I can warn you as you near a stop."),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [online]);

  const rows = useMemo(() => (ROUTE_STOPS[routeId] ?? []).flatMap((stopId, index) => {
    const stop = STOPS[stopId]; const d = demand[stopId];
    if (!stop || !d || (d.off === 0 && d.on === 0)) return [];
    const km = position ? haversineKm(position[0], position[1], stop[1], stop[2]) : null;
    return [{ stopId, name: stop[0], index, km, ...d }];
  }).sort((a, b) => (a.km ?? a.index) - (b.km ?? b.index)), [demand, position, routeId]);

  // Alert once when you come within 400 m of a stop where someone is getting off.
  useEffect(() => {
    for (const row of rows) {
      if (row.km === null) continue;
      if (row.off > 0 && row.km <= ALERT_RADIUS_KM && !alerted.current.has(row.stopId)) {
        alerted.current.add(row.stopId);
        toast(`${row.name}: ${row.off} passenger${row.off === 1 ? "" : "s"} getting off`, { duration: 8000 });
        try { navigator.vibrate?.([300, 120, 300]); } catch { /* not supported */ }
        beep();
      }
      if (row.km > 0.9) alerted.current.delete(row.stopId);
    }
  }, [rows]);

  const next = rows.find(row => row.off > 0);
  const tone = !online ? "var(--muted2)" : next && next.km !== null && next.km <= ALERT_RADIUS_KM ? "var(--stop)" : next ? "var(--ready)" : "var(--go)";

  return <section className="card" style={{ padding: 16, marginTop: 12, borderTop: `3px solid ${tone}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><BellRing size={17} style={{ color: tone }} /><p className="sec-label" style={{ margin: 0 }}>Stop alerts · who is getting off</p></div>
    {online && <p style={{ margin: "10px 0 2px", fontSize: ".9rem", fontWeight: 800 }}>{next ? `Next to stop: ${next.name}${next.km !== null ? ` · ${next.km < 1 ? `${Math.round(next.km * 1000)} m` : `${next.km.toFixed(1)} km`}` : ""}` : "No one has said they are getting off ahead. You do not need to ask."}</p>}
    {online && next && <p style={{ margin: 0, fontSize: ".7rem", color: "var(--muted2)" }}>{next.off} passenger{next.off === 1 ? "" : "s"} getting off there.</p>}
    {rows.length > 0 && <div style={{ display: "grid", gap: 5, marginTop: 10 }}>{rows.map(row => <div key={row.stopId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 9, background: "var(--glass)", border: "1px solid var(--border)" }}>
      <span style={{ fontSize: ".7rem" }}><b>{row.name}</b>{row.km !== null && <small style={{ color: "var(--muted2)" }}> · {row.km < 1 ? `${Math.round(row.km * 1000)} m` : `${row.km.toFixed(1)} km`}</small>}</span>
      <span style={{ display: "flex", gap: 10, fontFamily: "var(--font-mono)", fontSize: ".68rem" }}>
        {row.off > 0 && <span style={{ color: "var(--stop)", display: "flex", alignItems: "center", gap: 3 }}><ArrowDown size={12} />{row.off} off</span>}
        {row.on > 0 && <span style={{ color: "var(--go)", display: "flex", alignItems: "center", gap: 3 }}><ArrowUp size={12} />{row.on} on</span>}
      </span></div>)}</div>}
    <p style={{ margin: "10px 0 0", fontSize: ".58rem", lineHeight: 1.45, color: "var(--muted2)" }}>{status}. Only passengers using the app are counted, so keep looking out for others. Counts never show names, phones or locations.</p>
  </section>;
}
