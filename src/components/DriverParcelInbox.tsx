import { useCallback, useEffect, useState } from "react";
import { Check, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type OpenRequest = { id: string; route_id: string; route_name: string; pickup_label: string; dropoff_label: string; parcel_size: string; estimated_fee_kes: number; created_at: string };
type AssignedRequest = OpenRequest & { receiver_name: string; receiver_phone: string; status: string };

export default function DriverParcelInbox() {
  const [userId, setUserId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [open, setOpen] = useState<OpenRequest[]>([]);
  const [assigned, setAssigned] = useState<AssignedRequest[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUserId(null); setApproved(false); setOpen([]); setAssigned([]); setLoading(false); return; }
    setUserId(user.id);
    const { data: profile, error: profileError } = await supabase.from("ma3_driver_profiles").select("status").eq("user_id", user.id).maybeSingle();
    if (profileError) { setLoading(false); return; }
    const isApproved = profile?.status === "approved";
    setApproved(isApproved);
    if (!isApproved) { setOpen([]); setAssigned([]); setLoading(false); return; }
    const [openResult, assignedResult] = await Promise.all([
      supabase.rpc("list_open_ma3_parcel_requests"),
      supabase.from("ma3_parcel_requests").select("id,route_id,route_name,pickup_label,dropoff_label,parcel_size,estimated_fee_kes,receiver_name,receiver_phone,status,created_at").eq("assigned_driver_id", user.id).in("status", ["assigned", "picked_up"]).order("created_at", { ascending: true }),
    ]);
    if (openResult.error) toast.error("Could not load open parcel requests.");
    if (assignedResult.error) toast.error("Could not load your assigned parcels.");
    setOpen((openResult.data ?? []) as OpenRequest[]);
    setAssigned((assignedResult.data ?? []) as AssignedRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const claim = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.rpc("claim_ma3_parcel_request", { p_request_id: id });
    if (error) { toast.error(error.message || "Could not claim this parcel."); return; }
    toast.success("Parcel assigned to you.");
    await refresh();
  };

  const confirmDelivery = async (id: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("confirm_ma3_parcel_delivery", { p_request_id: id, p_pickup_code: codes[id] || "" });
    if (error || data !== true) { toast.error(error?.message || "The receiver code did not match."); return; }
    setCodes(current => { const next = { ...current }; delete next[id]; return next; });
    toast.success("Delivery confirmed.");
    await refresh();
  };

  return <section className="ios-glass" style={{ padding: 16, marginTop: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Package size={16} style={{ color: "var(--ready)" }} /><p className="sec-label" style={{ margin: 0, flex: 1 }}>Parcel requests</p><button className="icon-btn" aria-label="Refresh parcel requests" onClick={() => void refresh()}><RefreshCw size={13} /></button></div>
    {!userId && <p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 8 }}>Sign in to check driver access.</p>}
    {userId && !approved && <p style={{ color: "var(--muted2)", fontSize: ".62rem", lineHeight: 1.5, marginTop: 8 }}>Parcel dispatch is available to drivers whose account and routes have been approved.</p>}
    {loading && <p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 8 }}>Loading parcel requests…</p>}
    {approved && <>
      <p style={{ color: "var(--muted2)", fontSize: ".58rem", lineHeight: 1.45, marginTop: 8 }}>Open listings omit receiver contact details. Claim a route request to see the information needed to complete it.</p>
      <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
        {open.map(request => <div className="card" key={request.id} style={{ padding: 10 }}>
          <b style={{ fontSize: ".67rem" }}>{request.route_name}</b>
          <p style={{ fontSize: ".6rem", color: "var(--muted2)", margin: "5px 0" }}>{request.pickup_label} → {request.dropoff_label} · {request.parcel_size} · estimated KES {request.estimated_fee_kes}</p>
          <button className="btn btn-ready" onClick={() => void claim(request.id)}>Accept parcel request</button>
        </div>)}
        {open.length === 0 && <p style={{ color: "var(--muted2)", fontSize: ".6rem" }}>No open requests on your approved routes.</p>}
      </div>
      {assigned.length > 0 && <div style={{ marginTop: 12 }}><p className="sec-label">Assigned to you</p><div style={{ display: "grid", gap: 7 }}>{assigned.map(request => <div className="card" key={request.id} style={{ padding: 10 }}>
        <b style={{ fontSize: ".67rem" }}>{request.route_name}</b>
        <p style={{ fontSize: ".6rem", color: "var(--muted2)", margin: "5px 0" }}>{request.pickup_label} → {request.dropoff_label} · {request.receiver_name} · {request.receiver_phone}</p>
        <div style={{ display: "flex", gap: 6 }}><input className="finput" inputMode="numeric" maxLength={6} placeholder="Receiver's 6-digit code" value={codes[request.id] ?? ""} onChange={event => setCodes(current => ({ ...current, [request.id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))} /><button className="btn btn-go" disabled={(codes[request.id] ?? "").length !== 6} onClick={() => void confirmDelivery(request.id)}><Check size={13} /> Confirm</button></div>
      </div>)}</div></div>}
    </>}
  </section>;
}
