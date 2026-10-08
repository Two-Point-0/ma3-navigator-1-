import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, CheckCircle, ExternalLink, GraduationCap, Minus, Plus, Search, ShoppingCart, Trash2, Users, Wheat, Droplets, Milk, Sandwich, Package, Egg, X } from "lucide-react";

type Store = "Naivas" | "Quickmart" | "Carrefour";
type TemplateId = "bachelor" | "family" | "school";
type Product = { id: string; name: string; unit: string; category: string; Icon: React.ElementType; prices: Record<Store, number> };
type BasketLine = { p: Product; qty: number };

const STORES: Store[] = ["Naivas", "Quickmart", "Carrefour"];
const SOURCE_URLS = { dealMtaani: "https://dealmtaani.co.ke/terms-of-service", money254: "https://money254.co.ke/" };
const STORE_BRAND: Record<Store, { color: string; short: string }> = { Naivas: { color: "#16a34a", short: "NAIVAS" }, Quickmart: { color: "#d97706", short: "QUICKMART" }, Carrefour: { color: "#dc2626", short: "CARREFOUR" } };

const PRODUCTS: Product[] = [
  { id: "maize", name: "Maize flour", unit: "2 kg", category: "Staples", Icon: Wheat, prices: { Naivas: 145, Quickmart: 152, Carrefour: 139 } },
  { id: "rice", name: "Rice", unit: "2 kg", category: "Staples", Icon: Package, prices: { Naivas: 325, Quickmart: 310, Carrefour: 319 } },
  { id: "wheat", name: "Wheat flour", unit: "2 kg", category: "Staples", Icon: Wheat, prices: { Naivas: 130, Quickmart: 136, Carrefour: 129 } },
  { id: "sugar", name: "Sugar", unit: "2 kg", category: "Staples", Icon: Package, prices: { Naivas: 298, Quickmart: 309, Carrefour: 300 } },
  { id: "oil", name: "Cooking oil", unit: "1 litre", category: "Kitchen", Icon: Droplets, prices: { Naivas: 299, Quickmart: 312, Carrefour: 298 } },
  { id: "milk", name: "Fresh milk", unit: "500 ml", category: "Dairy", Icon: Milk, prices: { Naivas: 42, Quickmart: 43, Carrefour: 42 } },
  { id: "bread", name: "Bread", unit: "400 g", category: "Kitchen", Icon: Sandwich, prices: { Naivas: 55, Quickmart: 65, Carrefour: 54 } },
  { id: "eggs", name: "Eggs", unit: "Tray of 30", category: "Protein", Icon: Egg, prices: { Naivas: 560, Quickmart: 600, Carrefour: 628 } },
  { id: "beans", name: "Beans", unit: "1 kg", category: "Protein", Icon: Package, prices: { Naivas: 230, Quickmart: 245, Carrefour: 220 } },
  { id: "chicken", name: "Chicken", unit: "1 kg", category: "Protein", Icon: Package, prices: { Naivas: 520, Quickmart: 540, Carrefour: 499 } },
  { id: "tea", name: "Tea leaves", unit: "250 g", category: "Kitchen", Icon: Package, prices: { Naivas: 145, Quickmart: 150, Carrefour: 139 } },
  { id: "salt", name: "Salt", unit: "1 kg", category: "Kitchen", Icon: Package, prices: { Naivas: 55, Quickmart: 59, Carrefour: 52 } },
  { id: "detergent", name: "Laundry detergent", unit: "1 kg", category: "Household", Icon: Droplets, prices: { Naivas: 220, Quickmart: 230, Carrefour: 209 } },
  { id: "toilet", name: "Toilet paper", unit: "10-pack", category: "Household", Icon: Package, prices: { Naivas: 420, Quickmart: 399, Carrefour: 435 } },
  { id: "soap", name: "Bathing soap", unit: "Pack of 3", category: "Household", Icon: Package, prices: { Naivas: 180, Quickmart: 175, Carrefour: 189 } },
  { id: "sanitary", name: "Sanitary pads", unit: "Pack of 10", category: "Personal care", Icon: Package, prices: { Naivas: 180, Quickmart: 175, Carrefour: 195 } },
  { id: "snacks", name: "School snack pack", unit: "Assorted", category: "School", Icon: Package, prices: { Naivas: 260, Quickmart: 250, Carrefour: 275 } },
  { id: "notebooks", name: "Exercise books", unit: "Pack of 10", category: "School", Icon: Package, prices: { Naivas: 420, Quickmart: 399, Carrefour: 450 } },
  { id: "pencils", name: "Pencils and erasers", unit: "School set", category: "School", Icon: Package, prices: { Naivas: 180, Quickmart: 165, Carrefour: 190 } },
];

const TEMPLATE_ITEMS: Record<TemplateId, string[]> = {
  bachelor: ["maize", "rice", "oil", "milk", "bread", "eggs", "beans", "tea", "salt", "detergent", "toilet"],
  family: ["maize", "rice", "wheat", "sugar", "oil", "milk", "bread", "eggs", "beans", "chicken", "tea", "salt", "detergent", "toilet", "soap"],
  school: ["maize", "rice", "milk", "bread", "eggs", "beans", "detergent", "soap", "snacks", "notebooks", "pencils"],
};

function StoreBadge({ store }: { store: Store }) { const b = STORE_BRAND[store]; return <span style={{ color: b.color, border: `1px solid ${b.color}55`, background: `${b.color}16`, padding: "3px 7px", borderRadius: 7, fontSize: ".52rem", fontWeight: 900, letterSpacing: ".04em" }}>{b.short}</span>; }

export default function MarketPage() {
  const [tab, setTab] = useState<"planner" | "search" | "basket">("planner");
  const [template, setTemplate] = useState<TemplateId>("bachelor");
  const [schoolLevel, setSchoolLevel] = useState("primary");
  const [familyMembers, setFamilyMembers] = useState(4);
  const [query, setQuery] = useState("");
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [budget, setBudget] = useState("2000");
  const [detail, setDetail] = useState<Product | null>(null);

  const byId = (id: string) => PRODUCTS.find(p => p.id === id)!;
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return PRODUCTS.filter(p => !q || `${p.name} ${p.category}`.toLowerCase().includes(q)); }, [query]);
  const totalAt = (store: Store) => basket.reduce((sum, line) => sum + line.p.prices[store] * line.qty, 0);
  const totals = STORES.map(store => ({ store, total: totalAt(store) }));
  const bestStore = totals.reduce((a, b) => a.total <= b.total ? a : b, totals[0]).store;
  const budgetNum = Number(budget) || 0;

  const add = (p: Product, qty = 1) => setBasket(current => { const found = current.find(line => line.p.id === p.id); return found ? current.map(line => line.p.id === p.id ? { ...line, qty: line.qty + qty } : line) : [...current, { p, qty }]; });
  const adjust = (id: string, delta: number) => setBasket(current => current.map(line => line.p.id === id ? { ...line, qty: Math.max(0, line.qty + delta) } : line).filter(line => line.qty > 0));
  const loadTemplate = () => { const scale = template === "family" ? Math.max(1, Math.ceil(familyMembers / 4)) : 1; setBasket(TEMPLATE_ITEMS[template].map(id => ({ p: byId(id), qty: scale }))); setTab("basket"); };

  return <div className="page-wrap"><div className="inner">
    <header style={{ padding: "1rem 0 .8rem" }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><ShoppingCart size={18} style={{ color: "var(--ready)" }} /><h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>Smart Shopping Planner</h2></div><p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 5 }}>Build a basket, then compare the same items across selected supermarkets.</p></header>
    <div className="tab-row" style={{ marginBottom: 12 }}>{(["planner", "search", "basket"] as const).map(item => <button key={item} onClick={() => setTab(item)} className={`mtab ${tab === item ? "on" : ""}`}><>{item === "planner" ? <GraduationCap size={13} /> : item === "search" ? <Search size={13} /> : <ShoppingCart size={13} />}</>{item === "planner" ? "Templates" : item === "search" ? "Products" : `Basket${basket.length ? ` · ${basket.length}` : ""}`}</button>)}</div>
    {tab === "planner" && <section className="ios-glass" style={{ padding: 14 }}><p className="sec-label">Start with a household profile</p><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>{(["bachelor", "family", "school"] as TemplateId[]).map(id => <button key={id} onClick={() => setTemplate(id)} className={`pill ${template === id ? "on" : ""}`} style={{ minHeight: 58, whiteSpace: "normal" }}><span style={{ display: "block", fontWeight: 800 }}>{id === "bachelor" ? "Bachelor" : id === "family" ? "Family" : "School"}</span><small style={{ display: "block", marginTop: 4, color: "var(--muted2)" }}>{id === "school" ? "Learner level" : id === "family" ? "Members" : "Essentials"}</small></button>)}</div>
      {template === "family" && <div style={{ marginTop: 12 }}><label>Household members</label><input className="finput" type="number" min={1} max={15} value={familyMembers} onChange={e => setFamilyMembers(Math.max(1, Number(e.target.value)))} /><p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 6 }}>The basket scales for the household. Add age-specific items after loading it.</p></div>}
      {template === "school" && <div style={{ marginTop: 12 }}><label>School level</label><select className="finput" value={schoolLevel} onChange={e => setSchoolLevel(e.target.value)}><option value="kindergarten">Kindergarten</option><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="university">University</option></select><p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 6 }}>Starter basket for {schoolLevel}; adjust quantities in Basket.</p></div>}
      <button className="btn btn-ready" style={{ width: "100%", marginTop: 14 }} onClick={loadTemplate}><ShoppingCart size={14} /> Load {template} basket</button>
    </section>}
    {tab === "search" && <section><div style={{ position: "relative", marginBottom: 10 }}><Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input className="finput" style={{ paddingLeft: 36 }} placeholder="Search maize flour, rice, soap…" value={query} onChange={e => setQuery(e.target.value)} /></div><div style={{ display: "grid", gap: 8 }}>{filtered.map(p => { const Icon = p.Icon; const min = Math.min(...STORES.map(s => p.prices[s])); const store = STORES.find(s => p.prices[s] === min)!; return <motion.button key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setDetail(p)} className="card" style={{ padding: 12, textAlign: "left", color: "var(--white)", cursor: "pointer" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon size={20} style={{ color: "var(--ready)" }} /><span style={{ flex: 1 }}><b style={{ display: "block", fontSize: ".78rem" }}>{p.name}</b><small style={{ color: "var(--muted2)" }}>{p.unit} · {p.category}</small></span><span style={{ textAlign: "right" }}><StoreBadge store={store} /><b style={{ display: "block", color: "var(--go)", fontFamily: "var(--font-mono)", fontSize: ".76rem", marginTop: 4 }}>KES {min}</b></span></div></motion.button>; })}</div></section>}
    {tab === "basket" && <section><div className="ios-glass" style={{ padding: 14, marginBottom: 10 }}><label>Budget in KES</label><input className="finput" type="number" value={budget} onChange={e => setBudget(e.target.value)} /><p style={{ marginTop: 7, color: "var(--muted2)", fontSize: ".62rem" }}>Compare the full basket, not just the cheapest individual items.</p></div>{basket.length === 0 ? <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--muted)" }}><ShoppingCart size={34} style={{ margin: "0 auto 8px" }} /><p style={{ fontSize: ".76rem" }}>Your basket is empty</p></div> : <><div style={{ display: "grid", gap: 7, marginBottom: 12 }}>{basket.map(({ p, qty }) => { const Icon = p.Icon; return <div key={p.id} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 9 }}><Icon size={17} style={{ color: "var(--ready)" }} /><span style={{ flex: 1 }}><b style={{ display: "block", fontSize: ".74rem" }}>{p.name}</b><small style={{ color: "var(--muted)" }}>{p.unit}</small></span><button className="icon-btn" onClick={() => adjust(p.id, -1)}><Minus size={12} /></button><span style={{ minWidth: 16, textAlign: "center", fontFamily: "var(--font-mono)" }}>{qty}</span><button className="icon-btn" onClick={() => adjust(p.id, 1)}><Plus size={12} /></button><button className="icon-btn" onClick={() => setBasket(current => current.filter(line => line.p.id !== p.id))}><Trash2 size={12} style={{ color: "var(--stop)" }} /></button></div>; })}</div><div className="ios-glass" style={{ padding: 14 }}><p className="sec-label">Basket comparison</p>{totals.map(({ store, total }) => { const best = store === bestStore; const over = budgetNum > 0 && total > budgetNum; return <div key={store} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}><span style={{ display: "flex", alignItems: "center", gap: 7 }}>{best && <CheckCircle size={14} style={{ color: "var(--go)" }} />}<StoreBadge store={store} /></span><span style={{ fontFamily: "var(--font-mono)", color: over ? "var(--stop)" : best ? "var(--go)" : "var(--white)" }}>KES {total}</span></div>; })}<p style={{ marginTop: 12, textAlign: "center", color: totalAt(bestStore) <= budgetNum ? "var(--go)" : "var(--stop)", fontSize: ".68rem" }}>{totalAt(bestStore) <= budgetNum ? `Within budget at ${bestStore}` : `Above budget at every selected store`}</p></div></>}</section>}
    <div className="ios-glass" style={{ marginTop: 14, padding: 11, display: "flex", gap: 8, alignItems: "flex-start" }}><AlertTriangle size={15} style={{ color: "var(--ready)", flexShrink: 0 }} /><p style={{ color: "var(--muted2)", fontSize: ".58rem", lineHeight: 1.5, margin: 0 }}>Indicative prices only. Ma3 does not claim live retailer inventory or endorsement. Prices may change by date, branch, pack size and promotions. Verify at the retailer before purchase. Data should be entered from permissioned retailer feeds, written partner submissions, or user-submitted checks. See <a href={SOURCE_URLS.dealMtaani} target="_blank" rel="noreferrer" style={{ color: "var(--ready)" }}>DealMtaani terms</a> before using any third-party data.</p></div>
    <p style={{ color: "var(--muted)", fontSize: ".55rem", textAlign: "center", marginTop: 8 }}>Seeded comparison set · last checked in the app release · source links are reference material, not a scraping permission.</p>
  </div>
  <AnimatePresence>{detail && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,.55)", backdropFilter: "blur(7px)" }} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="ios-glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1101, maxWidth: 640, margin: "0 auto", padding: "1.2rem 1.2rem 2rem", borderRadius: "22px 22px 0 0" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><detail.Icon size={22} style={{ color: "var(--ready)" }} /><div><b>{detail.name}</b><small style={{ display: "block", color: "var(--muted2)" }}>{detail.unit} · {detail.category}</small></div></div><button className="icon-btn" onClick={() => setDetail(null)}><X size={15} /></button></div><div style={{ display: "grid", gap: 7, margin: "16px 0" }}>{STORES.map(store => <div key={store} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", border: "1px solid var(--border2)", borderRadius: 10 }}><StoreBadge store={store} /><span style={{ fontFamily: "var(--font-mono)" }}>KES {detail.prices[store]}</span></div>)}</div><button className="btn btn-ready" style={{ width: "100%" }} onClick={() => { add(detail); setDetail(null); }}><Plus size={14} /> Add to basket</button></motion.div></>}</AnimatePresence>
  </div>;
}
