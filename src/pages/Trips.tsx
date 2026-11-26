import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Route as RouteIcon, Wallet, Fuel, Plus, Trash2, UserRound, Bus, Car, Compass } from "lucide-react";
import PageTabs from "@/components/PageTabs";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { ROLE_STORAGE_KEY, type Ma3Role } from "@/components/Onboarding";

const TABS = [{ id: "routes", label: "My routes", Icon: RouteIcon }, { id: "earn", label: "Earnings", Icon: Wallet }, { id: "fuel", label: "Fuel saved", Icon: Fuel }] as const;
const ROLE_OPTIONS: { id: Ma3Role; label: string; Icon: typeof UserRound }[] = [
  { id: "passenger", label: "Abiria · Passenger", Icon: UserRound }, { id: "matatu-driver", label: "Dereva wa Ma3", Icon: Bus },
  { id: "carpool-driver", label: "Dereva wa Carpool", Icon: Car }, { id: "tour-driver", label: "Dereva wa Ziara", Icon: Compass },
];
type Saved = { id: string; name: string; origin_label: string | null; destination_label: string | null };
type Spend = { route_name: string; month: string; total_kes: number; trips: number };
type Earning = { id: string; earned_on: string; amount_kes: number; fuel_cost_kes: number | null; source: string };
const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

export default function TripsPage() {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [tab, setTab] = useState<string>("routes");
  const [role, setRole] = useState<Ma3Role>(() => (localStorage.getItem(ROLE_STORAGE_KEY) || "passenger") as Ma3Role);
  const [routes, setRoutes] = useState<Saved[]>([]);
  const [spend, setSpend] = useState<Spend[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [form, setForm] = useState({ name: "", from: "", to: "" });
  const [fare, setFare] = useState<Record<string, string>>({});
  const [earn, setEarn] = useState({ amount: "", fuel: "", source: "fares" });
  const [fuel, setFuel] = useState({ km: "40", price: "190", lper100: "8", people: "3" });

  const load = useCallback(async () => {
    if (!supabase || !signedIn) return;
    const [r, s, e] = await Promise.all([
      supabase.from("saved_routes").select("id,name,origin_label,destination_label").order("created_at"),
      supabase.rpc("my_monthly_route_spend"),
      supabase.from("driver_earnings").select("id,earned_on,amount_kes,fuel_cost_kes,source").order("earned_on", { ascending: false }).limit(200),
    ]);
    setRoutes(r.data ?? []); setSpend((s.data as Spend[]) ?? []); setEarnings(e.data ?? []);
  }, [signedIn]);
  useEffect(() => { void load(); }, [load]);

  const chooseRole = (id: Ma3Role) => { localStorage.setItem(ROLE_STORAGE_KEY, id); setRole(id); toast.success("Saved. The Drive button shows in the menu for drivers."); window.setTimeout(() => window.location.reload(), 600); };

  const addRoute = async () => {
    if (!supabase || !form.name.trim()) return toast.error("Give the route a name, like To work.");
    const { error } = await supabase.from("saved_routes").insert({ name: form.name.trim(), origin_label: form.from.trim() || null, destination_label: form.to.trim() || null });
    if (error) return toast.error(error.message);
    setForm({ name: "", from: "", to: "" }); void load();
  };
  const logFare = async (routeId: string) => {
    const amount = Number(fare[routeId]);
    if (!supabase || !(amount >= 0) || !fare[routeId]) return toast.error("Type how much you paid.");
    const { error } = await supabase.from("trip_spend").insert({ saved_route_id: routeId, amount_kes: amount });
    if (error) return toast.error(error.message);
    setFare(current => ({ ...current, [routeId]: "" })); void load();
  };
  const removeRoute = async (id: string) => { await supabase?.from("saved_routes").delete().eq("id", id); void load(); };
  const logEarning = async () => {
    const amount = Number(earn.amount);
    if (!supabase || !earn.amount || !(amount >= 0)) return toast.error("Type the amount you earned.");
    const { error } = await supabase.from("driver_earnings").insert({ amount_kes: amount, fuel_cost_kes: earn.fuel ? Number(earn.fuel) : null, source: earn.source });
    if (error) return toast.error(error.message);
    setEarn({ amount: "", fuel: "", source: earn.source }); void load();
  };

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthEarned = earnings.filter(item => item.earned_on.startsWith(thisMonth)).reduce((sum, item) => sum + Number(item.amount_kes), 0);
  const monthFuel = earnings.filter(item => item.earned_on.startsWith(thisMonth)).reduce((sum, item) => sum + Number(item.fuel_cost_kes ?? 0), 0);
  const fuelMath = useMemo(() => {
    const km = Number(fuel.km) || 0, price = Number(fuel.price) || 0, per100 = Number(fuel.lper100) || 0, people = Math.max(1, Number(fuel.people) || 1);
    const total = (km * per100 / 100) * price;
    return { total, share: total / people, saved: total - total / people };
  }, [fuel]);

  return <div className="inner" style={{ paddingTop: 12, paddingBottom: 90 }}>
    <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", marginBottom: 8 }}>My trips and money</h2>
    <div className="ios-glass" style={{ padding: 10, marginBottom: 10 }}>
      <p className="sec-label" style={{ marginBottom: 6 }}>I am a…</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{ROLE_OPTIONS.map(({ id, label, Icon }) => <button key={id} className={`btn ${role === id ? "btn-ready" : "btn-ghost"}`} style={{ padding: "6px 10px", fontSize: ".62rem" }} onClick={() => chooseRole(id)}><Icon size={12} /> {label}</button>)}</div>
    </div>
    <PageTabs label="Trips sections" active={tab} tabs={TABS} onChange={setTab} />
    {!isSupabaseConfigured || !signedIn ? <div className="ios-glass" style={{ padding: 14, marginTop: 10, fontSize: ".7rem", color: "var(--muted2)" }}>Sign in with Google or phone to save routes and track money. Guests cannot save.</div> : <>

    {tab === "routes" && <section style={{ marginTop: 10, display: "grid", gap: 9 }}>
      <div className="ios-glass" style={{ padding: 11, display: "grid", gap: 7 }}>
        <b style={{ fontSize: ".74rem" }}>Save a route you use often</b>
        <input className="finput" placeholder="Name (to work, to school, to shags…)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}><input className="finput" placeholder="From" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} /><input className="finput" placeholder="To" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} /></div>
        <button className="btn btn-ready" onClick={() => void addRoute()}><Plus size={13} /> Save route</button>
      </div>
      {routes.map(route => <div key={route.id} className="card" style={{ padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1 }}><b style={{ fontSize: ".74rem" }}>{route.name}</b><small style={{ display: "block", color: "var(--muted2)" }}>{[route.origin_label, route.destination_label].filter(Boolean).join(" → ")}</small></span><button className="icon-btn" aria-label="Delete route" onClick={() => void removeRoute(route.id)}><Trash2 size={13} /></button></div>
        <div style={{ display: "flex", gap: 6, marginTop: 7 }}><input className="finput" inputMode="decimal" placeholder="Fare paid today (KES)" value={fare[route.id] ?? ""} onChange={e => setFare({ ...fare, [route.id]: e.target.value })} /><button className="btn btn-go" onClick={() => void logFare(route.id)}>Add</button></div>
      </div>)}
      <p className="sec-label">Monthly spend per route</p>
      {spend.length === 0 ? <small style={{ color: "var(--muted2)" }}>Add a fare above and your monthly total appears here.</small> : spend.map(row => <div key={row.route_name + row.month} className="card" style={{ padding: 9, display: "flex", justifyContent: "space-between", fontSize: ".7rem" }}><span>{row.route_name} · {row.month}<small style={{ display: "block", color: "var(--muted2)" }}>{row.trips} trip{row.trips === 1 ? "" : "s"}</small></span><b style={{ color: "var(--ready)" }}>{kes(Number(row.total_kes))}</b></div>)}
    </section>}

    {tab === "earn" && <section style={{ marginTop: 10, display: "grid", gap: 9 }}>
      <div className="ios-glass" style={{ padding: 11, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, textAlign: "center" }}>
        <div><small style={{ color: "var(--muted2)" }}>Earned this month</small><b style={{ display: "block", color: "var(--go)" }}>{kes(monthEarned)}</b></div>
        <div><small style={{ color: "var(--muted2)" }}>Fuel this month</small><b style={{ display: "block", color: "var(--ready)" }}>{kes(monthFuel)}</b></div>
      </div>
      <div className="ios-glass" style={{ padding: 11, display: "grid", gap: 7 }}>
        <b style={{ fontSize: ".74rem" }}>Add today's earnings</b>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}><input className="finput" inputMode="decimal" placeholder="Earned (KES)" value={earn.amount} onChange={e => setEarn({ ...earn, amount: e.target.value })} /><input className="finput" inputMode="decimal" placeholder="Fuel spent (optional)" value={earn.fuel} onChange={e => setEarn({ ...earn, fuel: e.target.value })} /></div>
        <select className="finput" value={earn.source} onChange={e => setEarn({ ...earn, source: e.target.value })}><option value="fares">Fares</option><option value="carpool">Carpool</option><option value="tours">Tours</option><option value="parcels">Parcels</option></select>
        <button className="btn btn-ready" onClick={() => void logEarning()}><Plus size={13} /> Save</button>
      </div>
      {earnings.slice(0, 15).map(item => <div key={item.id} className="card" style={{ padding: 9, display: "flex", justifyContent: "space-between", fontSize: ".68rem" }}><span>{item.earned_on} · {item.source}</span><b>{kes(Number(item.amount_kes))}</b></div>)}
      <small style={{ color: "var(--muted2)", lineHeight: 1.45 }}>Numbers you type yourself. Private to you.</small>
    </section>}

    {tab === "fuel" && <section style={{ marginTop: 10 }} className="ios-glass">
      <div style={{ padding: 12, display: "grid", gap: 8 }}>
        <b style={{ fontSize: ".74rem" }}>Carpool fuel saving</b>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <label>Trip km<input className="finput" inputMode="decimal" value={fuel.km} onChange={e => setFuel({ ...fuel, km: e.target.value })} /></label>
          <label>Fuel price (KES/litre)<input className="finput" inputMode="decimal" value={fuel.price} onChange={e => setFuel({ ...fuel, price: e.target.value })} /></label>
          <label>Litres per 100 km<input className="finput" inputMode="decimal" value={fuel.lper100} onChange={e => setFuel({ ...fuel, lper100: e.target.value })} /></label>
          <label>People in the car<input className="finput" inputMode="numeric" value={fuel.people} onChange={e => setFuel({ ...fuel, people: e.target.value })} /></label>
        </div>
        <div className="card" style={{ padding: 10, fontSize: ".72rem", lineHeight: 1.6 }}>Fuel for the trip: <b>{kes(fuelMath.total)}</b><br />Each person's share: <b style={{ color: "var(--go)" }}>{kes(fuelMath.share)}</b><br />Saved by sharing: <b style={{ color: "var(--ready)" }}>{kes(fuelMath.saved)}</b></div>
        <small style={{ color: "var(--muted2)", lineHeight: 1.45 }}>Carpool is cost-sharing only. Drivers must not profit from passengers, or a PSV licence is needed.</small>
      </div>
    </section>}
    </>}
  </div>;
}
