import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X,
  Wheat, Droplets, Milk, Sandwich, Package, Egg,
} from "lucide-react";

type Store = "Naivas" | "Quickmart" | "Carrefour" | "Chandarana";

interface Product {
  id: string;
  name: string;
  unit: string;
  category: string;
  Icon: React.ElementType;
  prices: Record<Store, number>;
}

const PRODUCTS: Product[] = [
  { id: "p1", name: "Maize Flour",  unit: "2 kg",   category: "Grains",    Icon: Wheat,    prices: { Naivas: 139, Quickmart: 154, Carrefour: 124, Chandarana: 149 } },
  { id: "p2", name: "Rice",         unit: "2 kg",   category: "Grains",    Icon: Package,  prices: { Naivas: 324, Quickmart: 307, Carrefour: 306, Chandarana: 324 } },
  { id: "p3", name: "Wheat Flour",  unit: "2 kg",   category: "Grains",    Icon: Wheat,    prices: { Naivas: 129, Quickmart: 135, Carrefour: 129, Chandarana: 135 } },
  { id: "p4", name: "Sugar",        unit: "2 kg",   category: "Grains",    Icon: Package,  prices: { Naivas: 298, Quickmart: 309, Carrefour: 300, Chandarana: 324 } },
  { id: "p5", name: "Cooking Oil",  unit: "1 L",    category: "Oils",      Icon: Droplets, prices: { Naivas: 299, Quickmart: 312, Carrefour: 298, Chandarana: 299 } },
  { id: "p6", name: "Cooking Fat",  unit: "1 kg",   category: "Oils",      Icon: Droplets, prices: { Naivas: 355, Quickmart: 343, Carrefour: 342, Chandarana: 339 } },
  { id: "p7", name: "Fresh Milk",   unit: "500 ml", category: "Dairy",     Icon: Milk,     prices: { Naivas: 42,  Quickmart: 43,  Carrefour: 42,  Chandarana: 45  } },
  { id: "p8", name: "Bread",        unit: "400 g",  category: "Household", Icon: Sandwich, prices: { Naivas: 55,  Quickmart: 65,  Carrefour: 54,  Chandarana: 63  } },
  { id: "p9", name: "Toilet Paper", unit: "2-pack", category: "Household", Icon: Package,  prices: { Naivas: 145, Quickmart: 80,  Carrefour: 88,  Chandarana: 75  } },
  { id: "p10", name: "Eggs",        unit: "Tray 30",category: "Proteins",  Icon: Egg,      prices: { Naivas: 560, Quickmart: 600, Carrefour: 628, Chandarana: 510 } },
];

const STORES: Store[] = ["Naivas", "Quickmart", "Carrefour", "Chandarana"];

const STORE_BRAND: Record<Store, { color: string; short: string }> = {
  Naivas:     { color: "#0a8a3e", short: "NAIVAS" },
  Quickmart:  { color: "#e8590c", short: "QUICKMART" },
  Carrefour:  { color: "#004e9e", short: "CARREFOUR" },
  Chandarana: { color: "#7a1fa2", short: "CHANDARANA" },
};

const CATEGORIES = ["All", "Grains", "Oils", "Dairy", "Proteins", "Household"];

function StoreBadge({ store, size = "sm" }: { store: Store; size?: "sm" | "md" }) {
  const b = STORE_BRAND[store];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: size === "sm" ? "2px 7px" : "3px 9px",
      borderRadius: 6, background: `${b.color}1a`, border: `1px solid ${b.color}40`,
      fontFamily: "var(--font-display)", fontWeight: 800,
      fontSize: size === "sm" ? ".52rem" : ".58rem",
      color: b.color, letterSpacing: ".02em",
    }}>
      {b.short}
    </span>
  );
}

export default function MarketPage() {
  const [tab, setTab]       = useState<"search" | "basket">("search");
  const [query, setQuery]   = useState("");
  const [cat, setCat]       = useState("All");
  const [basket, setBasket] = useState<{ p: Product; qty: number }[]>([]);
  const [budget, setBudget] = useState("2000");
  const [detail, setDetail] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter(p =>
      (cat === "All" || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
  }, [query, cat]);

  const addToBasket = (p: Product) => {
    setBasket(prev => {
      const ex = prev.find(b => b.p.id === p.id);
      if (ex) return prev.map(b => b.p.id === p.id ? { ...b, qty: b.qty + 1 } : b);
      return [...prev, { p, qty: 1 }];
    });
    setDetail(null);
  };

  const adjBasket = (id: string, delta: number) => {
    setBasket(prev => prev.map(b => b.p.id === id ? { ...b, qty: Math.max(0, b.qty + delta) } : b).filter(b => b.qty > 0));
  };

  const totalAt = (store: Store) => basket.reduce((s, b) => s + b.p.prices[store] * b.qty, 0);
  const bestStore = STORES.reduce((a, b) => totalAt(a) <= totalAt(b) ? a : b);
  const budgetNum = parseInt(budget) || 0;

  return (
    <div className="page-wrap">
      <div className="inner">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 0 .8rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <ShoppingCart size={17} style={{ color: "var(--ready)" }} />
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 900 }}>Market</h2>
            </div>
            <p style={{ fontSize: ".6rem", color: "var(--muted2)" }}>Compare real Nairobi supermarket prices</p>
          </div>
          {basket.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 99, background: "rgba(217,119,6,.1)", border: "1px solid rgba(217,119,6,.25)" }}>
              <ShoppingCart size={11} style={{ color: "var(--ready)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem", color: "var(--ready)", fontWeight: 700 }}>{basket.length}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["search", "basket"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`mtab ${tab === t ? "on" : ""}`} style={{ flex: 1, justifyContent: "center", padding: "10px 0" }}>
              {t === "search" ? <Search size={13} /> : <ShoppingCart size={13} />}
              {t === "search" ? "1 · Find Products" : `2 · Basket (${basket.length})`}
            </button>
          ))}
        </div>

        {tab === "search" && (
          <div>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} />
              <input className="finput" style={{ paddingLeft: 36, padding: "12px 13px 12px 36px", fontSize: ".88rem" }}
                placeholder="Search e.g. Sugar, Rice, Cooking Oil…"
                value={query} onChange={e => setQuery(e.target.value)} />
            </div>

            <div className="tab-row" style={{ marginBottom: 14 }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCat(c)} className="pill"
                  style={{ background: cat === c ? "rgba(217,119,6,.12)" : "var(--glass)", borderColor: cat === c ? "rgba(217,119,6,.4)" : "var(--border)", color: cat === c ? "var(--ready)" : "var(--muted2)" }}>
                  {c}
                </button>
              ))}
            </div>

            {!query && cat === "All" && (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--muted)" }}>
                <Search size={32} style={{ opacity: .25, margin: "0 auto 10px" }} />
                <p style={{ fontSize: ".74rem" }}>Search a product or pick a category</p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(p => {
                const minPrice = Math.min(...STORES.map(s => p.prices[s]));
                const bestStoreForP = STORES.reduce((a, b) => p.prices[a] <= p.prices[b] ? a : b);
                const inBasket = basket.find(b => b.p.id === p.id);
                const Icon = p.Icon;
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="card" style={{ padding: 13, cursor: "pointer" }} onClick={() => setDetail(p)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(217,119,6,.1)", border: "1px solid rgba(217,119,6,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={20} style={{ color: "var(--ready)" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: ".84rem", fontWeight: 700 }}>{p.name}</p>
                        <p style={{ fontSize: ".62rem", color: "var(--muted2)", marginBottom: 4 }}>{p.unit}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StoreBadge store={bestStoreForP} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: ".8rem", fontWeight: 700, color: "var(--go)" }}>KES {minPrice}</span>
                          <span style={{ fontSize: ".58rem", color: "var(--muted)" }}>cheapest</span>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); addToBasket(p); }}
                        style={{ padding: "8px 14px", borderRadius: 10, background: inBasket ? "rgba(22,163,74,.15)" : "rgba(217,119,6,.12)", border: `1px solid ${inBasket ? "rgba(22,163,74,.35)" : "rgba(217,119,6,.3)"}`, color: inBasket ? "var(--go)" : "var(--ready)", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".7rem", cursor: "pointer", flexShrink: 0 }}>
                        {inBasket ? `✓ ${inBasket.qty}` : <><Plus size={12} /> Add</>}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "basket" && (
          <div>
            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
              <label>3 · Your Budget (KES)</label>
              <input className="finput" type="number" value={budget} onChange={e => setBudget(e.target.value)} style={{ fontSize: ".9rem", padding: "11px 13px" }} />
            </div>

            {basket.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--muted)" }}>
                <ShoppingCart size={36} style={{ opacity: .3, margin: "0 auto 10px" }} />
                <p style={{ fontSize: ".8rem" }}>Your basket is empty</p>
                <p style={{ fontSize: ".66rem", marginTop: 4 }}>Go to "Find Products" and tap Add</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                  {basket.map(({ p, qty }) => {
                    const Icon = p.Icon;
                    const cheapestPrice = Math.min(...STORES.map(s => p.prices[s]));
                    return (
                      <div key={p.id} className="card" style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(217,119,6,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={16} style={{ color: "var(--ready)" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: ".78rem", fontWeight: 700 }}>{p.name}</p>
                          <p style={{ fontSize: ".6rem", color: "var(--muted)" }}>{p.unit}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button onClick={() => adjBasket(p.id, -1)} style={{ width: 26, height: 26, borderRadius: 7, background: "var(--glass2)", border: "1px solid var(--border2)", color: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={11} /></button>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", minWidth: 18, textAlign: "center" }}>{qty}</span>
                          <button onClick={() => adjBasket(p.id, 1)} style={{ width: 26, height: 26, borderRadius: 7, background: "var(--glass2)", border: "1px solid var(--border2)", color: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={11} /></button>
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", color: "var(--ready)", minWidth: 56, textAlign: "right" }}>KES {cheapestPrice * qty}</span>
                        <button onClick={() => setBasket(prev => prev.filter(b => b.p.id !== p.id))} style={{ background: "none", border: "none", color: "var(--stop)", cursor: "pointer" }}><Trash2 size={14} /></button>
                      </div>
                    );
                  })}
                </div>

                <div className="card" style={{ padding: 16, background: "rgba(22,163,74,.04)", borderColor: "rgba(22,163,74,.2)" }}>
                  <p style={{ fontSize: ".62rem", fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--go)", marginBottom: 12 }}>4 · Best Store for Your Basket</p>
                  {STORES.map(s => {
                    const total = totalAt(s);
                    const isBest = s === bestStore;
                    const over = budgetNum > 0 && total > budgetNum;
                    const b = STORE_BRAND[s];
                    return (
                      <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 11, marginBottom: 7, background: isBest ? `${b.color}12` : "rgba(0,0,0,.25)", border: `1.5px solid ${isBest ? b.color + "45" : "var(--border)"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isBest && <span style={{ fontSize: ".85rem" }}>✅</span>}
                          <StoreBadge store={s} size="md" />
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: ".9rem", fontWeight: 700, color: over ? "var(--stop)" : isBest ? b.color : "var(--white)" }}>
                          KES {total} {over && "⚠️"}
                        </span>
                      </div>
                    );
                  })}
                  {budgetNum > 0 && (
                    <p style={{ fontSize: ".7rem", color: totalAt(bestStore) <= budgetNum ? "var(--go)" : "var(--stop)", marginTop: 10, textAlign: "center" }}>
                      {totalAt(bestStore) <= budgetNum
                        ? `✅ Within budget — KES ${budgetNum - totalAt(bestStore)} left over at ${bestStore}`
                        : `⚠️ Over budget by KES ${totalAt(bestStore) - budgetNum} even at the cheapest store`}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <p style={{ fontSize: ".58rem", color: "var(--muted)", textAlign: "center", marginTop: 16 }}>
          Prices sourced from Money254's published Nairobi shopping tracker. No free live pricing API exists — figures update periodically with app releases.
        </p>
      </div>

      <AnimatePresence>
        {detail && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetail(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1100, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1101, background: "var(--ink3)", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", padding: "1.2rem 1.2rem 2rem", maxWidth: 640, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(217,119,6,.12)", border: "1px solid rgba(217,119,6,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <detail.Icon size={26} style={{ color: "var(--ready)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 900 }}>{detail.name}</p>
                  <p style={{ fontSize: ".7rem", color: "var(--muted2)" }}>{detail.unit} · {detail.category}</p>
                </div>
                <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {STORES.map(s => {
                  const pr = detail.prices[s];
                  const minP = Math.min(...STORES.map(x => detail.prices[x]));
                  const isBest = pr === minP;
                  const b = STORE_BRAND[s];
                  return (
                    <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderRadius: 12, background: isBest ? `${b.color}12` : "var(--glass)", border: `1.5px solid ${isBest ? b.color + "40" : "var(--border2)"}` }}>
                      <StoreBadge store={s} size="md" />
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isBest && <span className="chip" style={{ background: "rgba(22,163,74,.12)", color: "var(--go)", border: "1px solid rgba(22,163,74,.25)" }}>CHEAPEST</span>}
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: isBest ? b.color : "var(--white)" }}>KES {pr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-primary" style={{ width: "100%", padding: 13, justifyContent: "center" }} onClick={() => addToBasket(detail)}>
                <ShoppingCart size={15} /> Add to Basket
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
