import { useCallback, useEffect, useState } from "react";
import { Check, Pause, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";

type Driver = { user_id: string; full_name: string | null; vehicle_plate: string | null; contact: string | null; status: "pending" | "approved" | "suspended"; requested_route_ids: string[]; route_ids: string[]; created_at: string };
const routeName = (id: string) => { const route = MA3_GTFS.routes.find(item => item.id === id); return route ? `${route.sn} ${route.ln}` : id; };

/** Owner-only page: approve or suspend drivers. Add yourself first with supabase/seed/make_roast_admin.sql. */
export default function AdminPage() {
  const { user } = useAuthContext();
  const [admin, setAdmin] = useState<boolean | null>(null); const [drivers, setDrivers] = useState<Driver[]>([]);
  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data: isAdmin } = await supabase.rpc("roast_is_admin"); setAdmin(Boolean(isAdmin));
    if (!isAdmin) return;
    const { data, error } = await supabase.rpc("admin_list_drivers"); if (error) toast.error(error.message); else setDrivers((data ?? []) as Driver[]);
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  const set = async (id: string, status: string) => { const { error } = await supabase!.rpc("admin_set_driver_status", { p_user: id, p_status: status }); if (error) toast.error(error.message); else { toast.success(`Driver ${status}`); void load(); } };
  if (!user) return <div className="page-wrap"><div className="inner"><p>Sign in first. <Link href="/login"><u>Sign in</u></Link></p></div></div>;
  if (admin === null) return <div className="page-wrap"><div className="inner"><p style={{ color: "var(--muted2)" }}>Checking…</p></div></div>;
  if (!admin) return <div className="page-wrap"><div className="inner"><p style={{ color: "var(--muted2)", fontSize: ".74rem" }}>This page is for the app owner only.</p></div></div>;
  return <div className="page-wrap"><div className="inner">
    <h1 style={{ fontSize: "1.1rem", margin: "0 0 4px" }}><ShieldCheck size={16} style={{ verticalAlign: -2, color: "var(--ready)" }} /> Admin · drivers</h1>
    <p style={{ color: "var(--muted2)", fontSize: ".64rem", margin: "0 0 12px", lineHeight: 1.5 }}>Call the driver or check the plate before approving.</p>
    {!drivers.length && <p style={{ color: "var(--muted2)", fontSize: ".7rem" }}>No driver has applied yet.</p>}
    <div style={{ display: "grid", gap: 8 }}>{drivers.map(driver => <div key={driver.user_id} className="card" style={{ padding: 11, borderColor: driver.status === "pending" ? "var(--ready)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: ".76rem" }}>{driver.full_name ?? "(no name)"}</b><small style={{ color: driver.status === "approved" ? "var(--go)" : driver.status === "pending" ? "var(--ready)" : "var(--stop)", fontWeight: 800, textTransform: "uppercase" }}>{driver.status}</small></div>
      <small style={{ display: "block", color: "var(--muted2)", margin: "3px 0" }}>{driver.vehicle_plate ?? "no plate"} · {driver.contact ?? "no contact"}</small>
      <small style={{ display: "block", lineHeight: 1.5 }}>Wants: {(driver.requested_route_ids.length ? driver.requested_route_ids : driver.route_ids).map(routeName).join(", ") || "none"}</small>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {driver.status !== "approved" && <button className="btn btn-go" onClick={() => void set(driver.user_id, "approved")}><Check size={12} /> Approve</button>}
        {driver.status === "approved" && <button className="btn btn-ghost" onClick={() => void set(driver.user_id, "suspended")}><Pause size={12} /> Suspend</button>}
        {driver.status === "suspended" && <button className="btn btn-ghost" onClick={() => void set(driver.user_id, "pending")}>Back to pending</button>}
      </div>
    </div>)}</div>
  </div></div>;
}
