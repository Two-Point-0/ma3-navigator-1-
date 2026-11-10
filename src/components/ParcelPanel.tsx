import { useEffect, useMemo, useState } from "react";
import { PackageCheck, Send, X } from "lucide-react";
import { haversineKm } from "@/data/ma3_core";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type RouteLite = { id: string; sn: string; ln: string; hs: string; c: string };
type ParcelStatus = "requested" | "assigned" | "picked_up" | "delivered" | "cancelled";
interface Parcel {
  id: string; routeId: string; routeName: string; pickup: string; dropoff: string;
  receiver: string; phone: string; size: string; fee: number; code: string;
  status: ParcelStatus; createdAt: number;
}

const SIZES = [{ id: "envelope", label: "Envelope", extra: 0 }, { id: "small", label: "Small box", extra: 40 }, { id: "medium", label: "Medium bag", extra: 90 }];
const STATUS_TONE: Record<ParcelStatus, string> = { requested: "var(--ready)", assigned: "var(--ready)", picked_up: "var(--ready)", delivered: "var(--go)", cancelled: "var(--stop)" };

interface Props {
  routes: readonly RouteLite[];
  routeStops: Record<string, string[]>;
  stops: Record<string, [string, number, number]>;
  onRoutePicked: (routeId: string | null) => void;
}

/** Parcel delivery by matatu: pick route + pickup stop + drop-off stop, receiver gets a code.
 *  Stage 1 only: listing and requesting. No payment is taken. */
export default function ParcelPanel({ routes, routeStops, stops, onRoutePicked }: Props) {
  const [routeId, setRouteId] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [receiver, setReceiver] = useState("");
  const [phone, setPhone] = useState("");
  const [size, setSize] = useState("small");
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [oneTimeCodes, setOneTimeCodes] = useState<Record<string, string>>({});
  const [loadingParcels, setLoadingParcels] = useState(false);
  const [routeQuery, setRouteQuery] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const load = async () => {
      setLoadingParcels(true);
      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) { if (!cancelled) { setParcels([]); setLoadingParcels(false); } return; }
      const refresh = async () => {
        const { data, error } = await supabase!.from("ma3_parcel_requests").select("id,route_id,route_name,pickup_label,dropoff_label,receiver_name,receiver_phone,parcel_size,estimated_fee_kes,status,created_at").eq("requester_id", user.id).order("created_at", { ascending: false }).limit(30);
        if (cancelled) return;
        if (error) toast.error("Could not load parcel requests.");
        else setParcels((data ?? []).map((row: any) => ({ id: row.id, routeId: row.route_id, routeName: row.route_name, pickup: row.pickup_label, dropoff: row.dropoff_label, receiver: row.receiver_name, phone: row.receiver_phone, size: row.parcel_size, fee: row.estimated_fee_kes, code: "", status: row.status, createdAt: new Date(row.created_at).getTime() })));
        setLoadingParcels(false);
      };
      await refresh();
      if (!cancelled) channel = supabase!.channel(`parcels-owner-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "ma3_parcel_requests", filter: `requester_id=eq.${user.id}` }, () => { void refresh(); }).subscribe();
    };
    void load().catch(() => { if (!cancelled) { setLoadingParcels(false); toast.error("Could not connect to parcel requests."); } });
    return () => { cancelled = true; if (channel) void supabase!.removeChannel(channel); };
  }, []);

  const matches = useMemo(() => {
    const q = routeQuery.trim().toLowerCase();
    if (!q) return [] as RouteLite[];
    return routes.filter(r => r.sn.toLowerCase().includes(q) || r.ln.toLowerCase().includes(q) || r.hs.toLowerCase().includes(q)).slice(0, 6);
  }, [routes, routeQuery]);

  const route = routes.find(r => r.id === routeId) ?? null;
  const stopList = useMemo(() => (routeId ? (routeStops[routeId] ?? []).filter(id => stops[id]) : []), [routeId, routeStops, stops]);
  const stopName = (id: string) => stops[id]?.[0] ?? id;

  const fee = useMemo(() => {
    if (!pickup || !dropoff || pickup === dropoff) return 0;
    const a = stops[pickup], b = stops[dropoff];
    if (!a || !b) return 0;
    const km = haversineKm(a[1], a[2], b[1], b[2]);
    const extra = SIZES.find(s => s.id === size)?.extra ?? 0;
    return Math.round((60 + km * 8 + extra) / 10) * 10;
  }, [pickup, dropoff, size, stops]);

  const pick = (r: RouteLite) => { setRouteId(r.id); setPickup(""); setDropoff(""); setRouteQuery(`${r.sn} · ${r.ln}`); onRoutePicked(r.id); };
  const ready = !!route && !!pickup && !!dropoff && pickup !== dropoff && receiver.trim().length > 1 && /^[0-9+ ]{9,15}$/.test(phone.trim());

  const request = async () => {
    if (!route || !ready) return;
    if (!supabase) { toast.error("Parcel requests are unavailable right now."); return; }
    let { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) { toast.error("Sign in to create a parcel request."); return; }
      user = data.user;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    const normalisedPhone = /^0[17]\d{8}$/.test(phoneDigits) ? `254${phoneDigits.slice(1)}` : /^254[17]\d{8}$/.test(phoneDigits) ? phoneDigits : "";
    if (!normalisedPhone) { toast.error("Enter a valid Kenyan mobile number."); return; }
    const { data, error } = await supabase.rpc("create_ma3_parcel_request", {
      p_route_id: route.id, p_route_name: `${route.sn} ${route.ln}`, p_pickup_stop_id: pickup,
      p_pickup_label: stopName(pickup), p_dropoff_stop_id: dropoff, p_dropoff_label: stopName(dropoff),
      p_receiver_name: receiver.trim(), p_receiver_phone: normalisedPhone, p_parcel_size: size, p_estimated_fee_kes: fee,
    });
    if (error || !data?.[0]?.request_id || !data?.[0]?.pickup_code) { toast.error(error?.message || "Could not create this parcel request."); return; }
    setOneTimeCodes(current => ({ ...current, [data[0].request_id]: data[0].pickup_code }));
    toast.success("Parcel request shared with eligible drivers on this route.");
    setPickup(""); setDropoff(""); setReceiver(""); setPhone("");
  };
  const cancelRequest = async (id: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("cancel_ma3_parcel_request", { p_request_id: id });
    if (error || !data) { toast.error(error?.message || "Only an unassigned request can be cancelled."); return; }
    toast("Parcel request cancelled.");
  };

  return (
    <div>
      <div className="ios-glass" style={{ padding: 10, marginBottom: 10 }}>
        <p style={{ fontSize: ".67rem", fontWeight: 700, color: "var(--ready)" }}>Send a parcel on a matatu route</p>
        <p style={{ marginTop: 4, fontSize: ".59rem", color: "var(--muted2)", lineHeight: 1.45 }}>Choose a route and two stops. Requests are shared with approved drivers on that route; no payment is taken here. Share the receiver code privately with the recipient.</p>
      </div>

      <label>Route
        <input className="finput" placeholder="Route number or name, e.g. 23W, Rongai" value={routeQuery}
          onChange={e => { setRouteQuery(e.target.value); if (routeId) { setRouteId(""); setPickup(""); setDropoff(""); onRoutePicked(null); } }} />
      </label>
      {matches.length > 0 && !route && (
        <div style={{ display: "grid", gap: 5, margin: "6px 0" }}>
          {matches.map(r => (
            <button key={r.id} className="card" onClick={() => pick(r)} style={{ padding: "8px 10px", textAlign: "left", color: "var(--white)", cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
              <b style={{ color: r.c, fontFamily: "var(--font-mono)", fontSize: ".66rem" }}>{r.sn}</b>
              <span style={{ fontSize: ".62rem", color: "var(--muted2)" }}>{r.ln} → {r.hs}</span>
            </button>
          ))}
        </div>
      )}

      {route && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <label>Pickup stop
            <select className="finput" value={pickup} onChange={e => setPickup(e.target.value)}>
              <option value="">Choose a stop…</option>
              {stopList.map((id, i) => <option key={`${id}-${i}`} value={id}>{stopName(id)}</option>)}
            </select>
          </label>
          <label>Drop-off stop
            <select className="finput" value={dropoff} onChange={e => setDropoff(e.target.value)}>
              <option value="">Choose a stop…</option>
              {stopList.map((id, i) => <option key={`${id}-${i}`} value={id}>{stopName(id)}</option>)}
            </select>
          </label>
          <label>Receiver name<input className="finput" value={receiver} onChange={e => setReceiver(e.target.value)} placeholder="Who collects it?" /></label>
          <label>Receiver phone<input className="finput" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07…" /></label>
          <div>
            <p className="sec-label">Parcel size</p>
            <div className="tab-row">{SIZES.map(s => <button key={s.id} className={`pill${size === s.id ? " on" : ""}`} onClick={() => setSize(s.id)}>{s.label}</button>)}</div>
          </div>
          <div className="ios-glass" style={{ padding: 9, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: ".62rem", color: "var(--muted2)" }}>Estimated fee (demo, pay the driver later)</span>
            <b style={{ color: "var(--ready)", fontFamily: "var(--font-mono)" }}>{fee ? `KES ${fee}` : "—"}</b>
          </div>
          <button className="btn btn-go" disabled={!ready} onClick={request} style={{ opacity: ready ? 1 : .5, width: "100%" }}><Send size={14} /> Request parcel pickup</button>
        </div>
      )}

      {parcels.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="sec-label">My parcels</p>
          <div style={{ display: "grid", gap: 7 }}>
            {parcels.map(p => (
              <div key={p.id} className="card" style={{ padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PackageCheck size={14} style={{ color: STATUS_TONE[p.status] }} />
                  <b style={{ fontSize: ".68rem", flex: 1 }}>{p.routeName}</b>
                  <span className="chip" style={{ color: STATUS_TONE[p.status], border: `1px solid ${STATUS_TONE[p.status]}`, textTransform: "capitalize" }}>{p.status}</span>
                </div>
                <p style={{ fontSize: ".6rem", color: "var(--muted2)", margin: "5px 0" }}>{p.pickup} → {p.dropoff} · for {p.receiver} · estimated KES {p.fee}</p>
                {p.status === "requested" && (
                  <>
                    {oneTimeCodes[p.id] && <p style={{ fontSize: ".6rem", margin: "0 0 6px" }}>One-time receiver code · share privately: <b style={{ fontFamily: "var(--font-mono)", letterSpacing: ".15em", color: "var(--ready)" }}>{oneTimeCodes[p.id]}</b></p>}
                    <button className="btn btn-stop" aria-label="Cancel parcel" onClick={() => void cancelRequest(p.id)}><X size={13} /> Cancel unassigned request</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {loadingParcels && <p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 10 }}>Loading your parcel requests…</p>}
      {!loadingParcels && parcels.length === 0 && <p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 10 }}>Your requests will appear here and sync across your signed-in devices.</p>}
    </div>
  );
}
