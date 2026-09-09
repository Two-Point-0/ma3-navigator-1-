import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plane, PlaneTakeoff, PlaneLanding, Clock, Search, Car, MapPin } from "lucide-react";
import { toast } from "sonner";

const AIRPORTS = [
  { code: "NBO", name: "Jomo Kenyatta International", city: "Nairobi" },
  { code: "WIL", name: "Wilson Airport",               city: "Nairobi" },
  { code: "MBA", name: "Moi International Airport",    city: "Mombasa" },
  { code: "KIS", name: "Kisumu International Airport", city: "Kisumu" },
];

const FLIGHTS = [
  { airline: "Kenya Airways", from: "NBO", to: "MBA", dep: "06:00", arr: "07:10", durMin: 70, price: 5800 },
  { airline: "Jambojet",      from: "NBO", to: "MBA", dep: "08:30", arr: "09:40", durMin: 70, price: 3200 },
  { airline: "Fly540",        from: "NBO", to: "MBA", dep: "16:45", arr: "18:00", durMin: 75, price: 2900 },
  { airline: "Kenya Airways", from: "NBO", to: "KIS", dep: "10:20", arr: "11:15", durMin: 55, price: 6500 },
  { airline: "Jambojet",      from: "NBO", to: "KIS", dep: "14:00", arr: "14:50", durMin: 50, price: 3800 },
  { airline: "Jambojet",      from: "MBA", to: "NBO", dep: "12:10", arr: "13:20", durMin: 70, price: 3200 },
  { airline: "Fly540",        from: "KIS", to: "NBO", dep: "07:30", arr: "08:25", durMin: 55, price: 3600 },
  { airline: "Safarilink",    from: "WIL", to: "MBA", dep: "09:00", arr: "10:20", durMin: 80, price: 7200 },
  { airline: "Safarilink",    from: "WIL", to: "KIS", dep: "11:30", arr: "12:35", durMin: 65, price: 6800 },
  { airline: "Jambojet",      from: "NBO", to: "MBA", dep: "19:15", arr: "20:25", durMin: 70, price: 2750 },
];

const TRANSFERS = [
  { name: "JKIA → CBD Shuttle",     eta: "35 min", price: 600,  type: "Shuttle" },
  { name: "JKIA → CBD Private Car", eta: "25 min", price: 1800, type: "Car" },
  { name: "Wilson → Westlands",     eta: "20 min", price: 800,  type: "Shuttle" },
  { name: "Wilson → CBD Private",   eta: "18 min", price: 1200, type: "Car" },
];

export default function FlyPage() {
  const [tab, setTab] = useState<"flights" | "transfers">("flights");
  const [query, setQuery] = useState("");
  const [fromFilter, setFromFilter] = useState<string | null>(null);

  const filtered = useMemo(() => FLIGHTS.filter(f =>
    (!fromFilter || f.from === fromFilter) &&
    (!query || f.to.toLowerCase().includes(query.toLowerCase()) ||
      f.airline.toLowerCase().includes(query.toLowerCase()) ||
      f.from.toLowerCase().includes(query.toLowerCase()))
  ), [query, fromFilter]);

  return (
    <div className="inner">
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "1rem 0 .8rem" }}>
        <Plane size={17} style={{ color: "var(--ready)" }} />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 900 }}>Fly</h2>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["flights", "transfers"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`mtab ${tab === t ? "on" : ""}`} style={{ flex: 1, justifyContent: "center", textTransform: "capitalize" }}>
            {t === "flights" ? <Plane size={12} /> : <Car size={12} />} {t}
          </button>
        ))}
      </div>

      {tab === "flights" && (
        <>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input className="finput" style={{ paddingLeft: 34 }} placeholder="Search destination or airline…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          <div className="tab-row" style={{ marginBottom: 12 }}>
            <button onClick={() => setFromFilter(null)} className="pill"
              style={{ background: !fromFilter ? "rgba(217,119,6,.12)" : "var(--glass)", borderColor: !fromFilter ? "rgba(217,119,6,.4)" : "var(--border)", color: !fromFilter ? "var(--ready)" : "var(--muted2)" }}>
              All
            </button>
            {AIRPORTS.map(a => (
              <button key={a.code} onClick={() => setFromFilter(a.code)} className="pill"
                style={{ display: "flex", alignItems: "center", gap: 5, background: fromFilter === a.code ? "rgba(217,119,6,.12)" : "var(--glass)", borderColor: fromFilter === a.code ? "rgba(217,119,6,.4)" : "var(--border)", color: fromFilter === a.code ? "var(--ready)" : "var(--muted2)" }}>
                <MapPin size={10} />
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{a.code}</span>
                <span style={{ fontSize: ".58rem" }}>{a.city}</span>
              </button>
            ))}
          </div>

          <div className="sec-label" style={{ marginBottom: 8 }}>{filtered.length} Flights Found</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((f, i) => {
              const hrs = Math.floor(f.durMin / 60), mins = f.durMin % 60;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(217,119,6,.12)", border: "1px solid rgba(217,119,6,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plane size={13} style={{ color: "var(--ready)" }} />
                    </div>
                    <span style={{ fontSize: ".75rem", fontWeight: 700 }}>{f.airline}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: ".9rem", fontWeight: 700 }}>{f.dep}</p>
                      <p style={{ fontSize: ".6rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 2 }}><PlaneTakeoff size={9} />{f.from}</p>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div style={{ width: "100%", height: 1, background: "var(--border2)", position: "relative" }}>
                        <Plane size={10} style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%) rotate(90deg)", color: "var(--ready)" }} />
                      </div>
                      <span style={{ fontSize: ".55rem", color: "var(--muted)" }}>~{hrs}h {mins > 0 ? `${mins}m` : ""}</span>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: ".9rem", fontWeight: 700 }}>{f.arr}</p>
                      <p style={{ fontSize: ".6rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 2 }}><PlaneLanding size={9} />{f.to}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: ".85rem", fontWeight: 700, color: "var(--ready)" }}>KES {f.price.toLocaleString()}</p>
                      <button className="btn btn-primary" style={{ marginTop: 4, padding: "5px 12px", fontSize: ".65rem" }} onClick={() => toast(`✈️ Redirecting to ${f.airline} booking…`)}>
                        Book
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ textAlign: "center", fontSize: ".74rem", color: "var(--muted)", padding: "1.5rem 0" }}>No flights match your search</p>
            )}
          </div>
        </>
      )}

      {tab === "transfers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="sec-label" style={{ marginBottom: 4 }}>Airport Transfers</div>
          {TRANSFERS.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(217,119,6,.1)", border: "1px solid rgba(217,119,6,.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Car size={16} style={{ color: "var(--ready)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: ".8rem" }}>{t.name}</p>
                <div style={{ display: "flex", gap: 10, marginTop: 3 }}>
                  <span style={{ fontSize: ".62rem", color: "var(--muted)", display: "flex", gap: 4, alignItems: "center" }}><Clock size={10} />{t.eta}</span>
                  <span className="chip" style={{ background: "var(--glass2)", border: "1px solid var(--border)", fontSize: ".55rem" }}>{t.type}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", fontWeight: 700, color: "var(--ready)" }}>KES {t.price}</p>
                <button className="btn btn-primary" style={{ marginTop: 4, padding: "5px 12px", fontSize: ".65rem" }} onClick={() => toast(`🚗 Booking ${t.name}…`)}>
                  Book
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
