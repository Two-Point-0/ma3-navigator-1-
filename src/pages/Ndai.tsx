import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Navigation, Clock, Wallet, Star, X,
  CheckCircle, Phone, MessageCircle,
  Bike, Car, Crown, Users, Share2, Package, Info, Plus,
} from "lucide-react";
import { toast } from "sonner";
import maplibregl from "maplibre-gl";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import { useWallet } from "@/lib/wallet";
import { MA3_GTFS } from "@/data/ma3_gtfs";

const NAIROBI: [number, number] = [-1.2864, 36.8172];

type Tab = "ride" | "carpool" | "delivery";

const RIDE_TYPES = [
  { id: "bike",    label: "Bike",    Icon: Bike,  desc: "Boda · 1 seat",      eta: 4,  base: 150 },
  { id: "share",   label: "Share",   Icon: Users, desc: "Pooled · save 30%", eta: 8,  base: 220 },
  { id: "comfort", label: "Comfort", Icon: Car,   desc: "Saloon · 4 seats",   eta: 7,  base: 320 },
  { id: "lux",     label: "Lux",     Icon: Crown, desc: "Premium · 4 seats", eta: 6,  base: 650 },
  { id: "van",     label: "Van",     Icon: Users, desc: "Group · 8 seats",   eta: 12, base: 500 },
];

const POPULAR = [
  { name: "JKIA Airport",    icon: "✈️" },
  { name: "Two Rivers Mall",  icon: "🛍️" },
  { name: "The Hub Karen",    icon: "🛍️" },
  { name: "Westgate Mall",    icon: "🛍️" },
  { name: "CBD Kencom",       icon: "🏙️" },
  { name: "KNH Hospital",     icon: "🏥" },
];

const DRIVERS = [
  { name: "James K.", plate: "KDA 456B", rating: 4.9, eta: 3, photo: "👨🏾" },
  { name: "Mary W.",  plate: "KCA 882C", rating: 4.7, eta: 5, photo: "👩🏾" },
  { name: "David M.", plate: "KCB 211A", rating: 4.8, eta: 7, photo: "👨🏿" },
];

const ROUTES = MA3_GTFS.routes;
interface CarpoolOffer {
  id: string;
  driverName: string;
  photo: string;
  plate: string;
  carModel: string;
  fromArea: string;
  toArea: string;
  departTime: string;
  seatsAvailable: number;
  contribution: number;
  rating: number;
  routeId: string;
}

function buildCarpoolOffers(): CarpoolOffer[] {
  const names = ["Peter N.", "Grace W.", "Samuel K.", "Faith M.", "Brian O.", "Nancy A."];
  const cars = ["Toyota Axio", "Mazda Demio", "Subaru Forester", "Toyota Premio", "Nissan Note", "Honda Fit"];
  const photos = ["👨🏽", "👩🏾", "👨🏿", "👩🏽", "👨🏾", "👩🏿"];
  return ROUTES.slice(0, 6).map((r, i) => ({
    id: `cp${i}`,
    driverName: names[i],
    photo: photos[i],
    plate: `K${["C","D","B"][i % 3]}${String.fromCharCode(65 + i)} ${100 + i * 11}${String.fromCharCode(70 + i)}`,
    carModel: cars[i],
    fromArea: r.ln.split("–")[0]?.trim() || "CBD",
    toArea: r.hs,
    departTime: ["06:45", "07:00", "07:15", "07:30", "06:30", "07:10"][i],
    seatsAvailable: 1 + (i % 3),
    contribution: 100 + i * 30,
    rating: 4.3 + (i % 5) * 0.1,
    routeId: r.id,
  }));
}
const CARPOOL_OFFERS = buildCarpoolOffers();

type RideStage = "idle" | "searching" | "drivers" | "booked";

export default function NdaiPage() {
  const [tab, setTab]         = useState<Tab>("ride");
  const [stage, setStage]     = useState<RideStage>("idle");
  const [rideId, setRideId]   = useState("comfort");
  const [pickup, setPickup]   = useState("");
  const [dest, setDest]       = useState("");
  const [driver, setDriver]   = useState<typeof DRIVERS[0] | null>(null);
  const { pay } = useWallet();
  const mapRef = useRef<MapLibreHandle>(null);
  const mapInst = useRef<maplibregl.Map | null>(null);

  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerFrom, setOfferFrom]   = useState("");
  const [offerTo, setOfferTo]       = useState("");
  const [offerTime, setOfferTime]   = useState("07:30");
  const [offerSeats, setOfferSeats] = useState(2);
  const [offerAmt, setOfferAmt]     = useState(150);
  const [myOffers, setMyOffers]     = useState<CarpoolOffer[]>([]);
  const [bookedCarpool, setBookedCarpool] = useState<CarpoolOffer | null>(null);

  const [delFrom, setDelFrom] = useState("");
  const [delTo, setDelTo]     = useState("");
  const [delSize, setDelSize] = useState<"small" | "medium" | "large">("small");
  const [delStage, setDelStage] = useState<"idle" | "booked">("idle");

  const selected = RIDE_TYPES.find(r => r.id === rideId)!;
  const fare = selected.base + Math.floor(Math.random() * 80);
  const DELIVERY_PRICES = { small: 150, medium: 250, large: 400 };

  const handleSearch = () => {
    if (!pickup || !dest) { toast("Enter pickup and destination"); return; }
    setStage("searching");
    setTimeout(() => setStage("drivers"), 1800);
  };

  const handleBook = (d: typeof DRIVERS[0]) => {
    if (!pay(fare)) { toast("Insufficient wallet balance — top up in Profile"); return; }
    setDriver(d);
    setStage("booked");
    toast(`🚕 ${d.name} is on the way!`);
  };

  const handleCancel = () => { setStage("idle"); setDriver(null); setPickup(""); setDest(""); };

  const bookCarpool = (offer: CarpoolOffer) => {
    if (!pay(offer.contribution)) { toast("Insufficient wallet balance — top up in Profile"); return; }
    setBookedCarpool(offer);
    toast(`✅ Seat reserved with ${offer.driverName} — KES ${offer.contribution} cost-share paid`);
  };

  const postOffer = () => {
    if (!offerFrom || !offerTo) { toast("Enter your route"); return; }
    const newOffer: CarpoolOffer = {
      id: `mine${Date.now()}`, driverName: "You", photo: "🧑", plate: "Your car",
      carModel: "Your vehicle", fromArea: offerFrom, toArea: offerTo,
      departTime: offerTime, seatsAvailable: offerSeats, contribution: offerAmt,
      rating: 5.0, routeId: ROUTES[0].id,
    };
    setMyOffers(p => [...p, newOffer]);
    setShowOfferForm(false);
    toast("📍 Your commute is now visible to nearby passengers");
  };

  const bookDelivery = () => {
    if (!delFrom || !delTo) { toast("Enter pickup and drop-off"); return; }
    const price = DELIVERY_PRICES[delSize];
    if (!pay(price)) { toast("Insufficient wallet balance"); return; }
    setDelStage("booked");
    toast(`📦 Courier assigned — KES ${price} paid`);
  };

  return (
    <div style={{ position: "relative", height: "calc(100vh - var(--top-h) - var(--nav-h))", marginTop: "-12px" }}>
      <MapLibreView ref={mapRef} center={NAIROBI} zoom={13} height="100%" borderRadius={0}
        onLoad={m => { mapInst.current = m; }} />

      <div style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 50, display: "flex", gap: 6 }}>
        {([
          { id: "ride" as Tab, label: "Ride", Icon: Car },
          { id: "carpool" as Tab, label: "Carpool", Icon: Share2 },
          { id: "delivery" as Tab, label: "Delivery", Icon: Package },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12, background: tab === t.id ? "rgba(217,119,6,.22)" : "rgba(8,8,16,.78)", backdropFilter: "blur(16px)", border: `1px solid ${tab === t.id ? "rgba(217,119,6,.55)" : "rgba(255,255,255,.13)"}`, color: tab === t.id ? "var(--ready)" : "var(--muted2)", fontFamily: "var(--font)", fontWeight: 800, fontSize: ".74rem", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,.4)" }}>
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ══════ RIDE TAB (amber/yellow-taxi theme) ══════ */}
      <AnimatePresence>
        {tab === "ride" && stage !== "booked" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200, background: "rgba(10,10,18,.97)", backdropFilter: "blur(20px)", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", borderTop: "3px solid var(--ready)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div className="handle" />
            </div>
            <div style={{ display: "flex", gap: 6, padding: "6px 14px 10px", overflowX: "auto", scrollbarWidth: "none" }}>
              {RIDE_TYPES.map(rt => {
                const active = rideId === rt.id;
                return (
                  <button key={rt.id} onClick={() => setRideId(rt.id)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 12, flexShrink: 0, background: active ? "rgba(217,119,6,.16)" : "var(--glass)", border: `1.5px solid ${active ? "rgba(217,119,6,.5)" : "var(--border)"}`, cursor: "pointer", transition: ".15s" }}>
                    <rt.Icon size={18} style={{ color: active ? "var(--ready)" : "var(--muted2)" }} />
                    <span style={{ fontSize: ".68rem", fontWeight: 700, color: active ? "var(--ready)" : "var(--muted2)" }}>{rt.label}</span>
                    <span style={{ fontSize: ".55rem", color: "var(--muted)" }}>{rt.desc}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "0 14px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, borderRadius: "50%", background: "var(--go)", border: "2px solid #000", zIndex: 1 }} />
                <input className="finput" style={{ paddingLeft: 32 }} placeholder="Pickup location"
                  value={pickup} onChange={e => setPickup(e.target.value)} />
              </div>
              <div style={{ position: "relative" }}>
                <MapPin size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--stop)", zIndex: 1 }} />
                <input className="finput" style={{ paddingLeft: 32 }} placeholder="Where to?"
                  value={dest} onChange={e => setDest(e.target.value)} />
              </div>
              {!dest && (
                <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
                  {POPULAR.map(p => (
                    <button key={p.name} onClick={() => setDest(p.name)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 99, background: "var(--glass2)", border: "1px solid var(--border)", color: "var(--muted2)", fontSize: ".65rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                      <span>{p.icon}</span>{p.name}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: "var(--glass)", border: "1px solid var(--border2)", display: "flex", gap: 12 }}>
                  <span style={{ fontSize: ".68rem", color: "var(--muted2)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11} style={{ color: "var(--ready)" }} /> ~{selected.eta} min
                  </span>
                  <span style={{ fontSize: ".68rem", color: "var(--ready)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Wallet size={11} /> KES {fare}
                  </span>
                </div>
                <button onClick={handleSearch}
                  style={{ padding: "10px 22px", borderRadius: 12, background: "var(--ready)", border: "none", color: "#000", fontFamily: "var(--font)", fontWeight: 800, fontSize: ".82rem", cursor: "pointer" }}>
                  Find
                </button>
              </div>
            </div>

            <AnimatePresence>
              {stage === "searching" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: "10px 14px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
                        style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ready)" }} />
                    ))}
                  </div>
                  <p style={{ fontSize: ".74rem", color: "var(--muted2)" }}>Finding nearby {selected.label}s…</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {stage === "drivers" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ padding: "4px 14px 20px" }}>
                  <p className="sec-label" style={{ marginBottom: 8 }}>Nearby Drivers</p>
                  {DRIVERS.map((d, i) => (
                    <motion.div key={d.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "var(--glass)", border: "1px solid var(--border2)", marginBottom: 7 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(217,119,6,.16)", border: "1.5px solid rgba(217,119,6,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>
                        {d.photo}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: ".82rem" }}>{d.name}</p>
                        <p style={{ fontSize: ".6rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{d.plate}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Star size={10} style={{ color: "var(--ready)", fill: "var(--ready)" }} />
                          <span style={{ fontSize: ".65rem", color: "var(--ready)", fontWeight: 700 }}>{d.rating}</span>
                          <span style={{ fontSize: ".6rem", color: "var(--muted)" }}>· {d.eta} min away</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", fontWeight: 700, color: "var(--ready)", marginBottom: 4 }}>KES {fare}</p>
                        <button onClick={() => handleBook(d)}
                          style={{ padding: "7px 14px", borderRadius: 99, background: "var(--ready)", border: "none", color: "#000", fontFamily: "var(--font)", fontWeight: 800, fontSize: ".72rem", cursor: "pointer" }}>
                          Book
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booked ride state */}
      <AnimatePresence>
        {tab === "ride" && stage === "booked" && driver && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 300 }}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200, background: "rgba(10,10,18,.97)", backdropFilter: "blur(20px)", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", padding: "1rem 1rem 2rem" }}>
            <div className="handle" />
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260 }}>
                <CheckCircle size={42} style={{ color: "var(--go)", margin: "0 auto 8px" }} />
              </motion.div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 900, color: "var(--go)" }}>Driver On The Way</p>
              <p style={{ fontSize: ".7rem", color: "var(--muted2)", marginTop: 3 }}>ETA ~{driver.eta} min · KES {fare} paid ✓</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "var(--glass)", border: "1px solid var(--border2)", marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(217,119,6,.16)", border: "1.5px solid rgba(217,119,6,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", flexShrink: 0 }}>
                {driver.photo}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: ".9rem" }}>{driver.name}</p>
                <p style={{ fontSize: ".65rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{driver.plate}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Star size={11} style={{ color: "var(--ready)", fill: "var(--ready)" }} />
                  <span style={{ fontSize: ".7rem", color: "var(--ready)", fontWeight: 700 }}>{driver.rating}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => toast("📞 Calling driver…")} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(22,163,74,.14)", border: "1px solid rgba(22,163,74,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Phone size={15} style={{ color: "var(--go)" }} />
                </button>
                <button onClick={() => toast("💬 Opening chat…")} style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(217,119,6,.14)", border: "1px solid rgba(217,119,6,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <MessageCircle size={15} style={{ color: "var(--ready)" }} />
                </button>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: "var(--glass2)", overflow: "hidden", marginBottom: 14 }}>
              <motion.div initial={{ width: "0%" }} animate={{ width: "65%" }} transition={{ duration: 2, ease: "easeInOut" }}
                style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, var(--ready), var(--go))" }} />
            </div>
            <button onClick={handleCancel}
              style={{ width: "100%", padding: 12, borderRadius: 12, background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.3)", color: "var(--stop)", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".8rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <X size={14} /> Cancel Ride
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ CARPOOL TAB — legal cost-share commute ══════ */}
      <AnimatePresence>
        {tab === "carpool" && !bookedCarpool && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="bpanel open" style={{ maxHeight: "80vh" }}>
            <div className="bpanel-head">
              <div className="handle" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Share2 size={15} style={{ color: "var(--ready)" }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 900 }}>Commute Carpool</span>
                </div>
                <button onClick={() => setShowOfferForm(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 99, background: "rgba(22,163,74,.14)", border: "1px solid rgba(22,163,74,.3)", color: "var(--go)", fontSize: ".66rem", fontWeight: 700, cursor: "pointer" }}>
                  <Plus size={12} /> Offer a ride
                </button>
              </div>
              <div style={{ display: "flex", gap: 7, padding: "8px 10px", borderRadius: 10, background: "rgba(217,119,6,.06)", border: "1px solid rgba(217,119,6,.2)", marginBottom: 8 }}>
                <Info size={13} style={{ color: "var(--ready)", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: ".6rem", color: "var(--muted2)", lineHeight: 1.5 }}>
                  This is cost-sharing between commuters heading the same way — drivers set a flat fuel-cost contribution, not a metered taxi fare. Not a PSV/TNC commercial ride.
                </p>
              </div>
            </div>

            <AnimatePresence>
              {showOfferForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", padding: "0 14px" }}>
                  <div className="card" style={{ padding: 12, marginBottom: 10, borderColor: "rgba(22,163,74,.25)" }}>
                    <p style={{ fontSize: ".74rem", fontWeight: 700, marginBottom: 8 }}>I'm driving to work — post my route</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 8 }}>
                      <input className="finput" placeholder="From (e.g. Rongai)" value={offerFrom} onChange={e => setOfferFrom(e.target.value)} />
                      <input className="finput" placeholder="To (e.g. CBD / Westlands)" value={offerTo} onChange={e => setOfferTo(e.target.value)} />
                      <div style={{ display: "flex", gap: 7 }}>
                        <input type="time" className="finput" value={offerTime} onChange={e => setOfferTime(e.target.value)} style={{ flex: 1 }} />
                        <select className="finput" value={offerSeats} onChange={e => setOfferSeats(Number(e.target.value))} style={{ width: 90 }}>
                          {[1,2,3].map(n => <option key={n} value={n}>{n} seat{n>1?"s":""}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ marginBottom: 4, display: "block" }}>Cost-share per passenger (KES)</label>
                        <input type="number" className="finput" value={offerAmt} onChange={e => setOfferAmt(Number(e.target.value))} />
                      </div>
                    </div>
                    <button className="btn btn-go" style={{ width: "100%", padding: 10, justifyContent: "center" }} onClick={postOffer}>
                      <Navigation size={13} /> Post My Commute
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bpanel-scroll" style={{ padding: "0 14px 20px" }}>
              <p className="sec-label" style={{ marginBottom: 8 }}>Commuters heading your way</p>
              {[...myOffers, ...CARPOOL_OFFERS].map(offer => (
                <motion.div key={offer.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="card" style={{ padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, background: "rgba(22,163,74,.12)", border: "1.5px solid rgba(22,163,74,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
                      {offer.photo}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: ".8rem" }}>{offer.driverName}</p>
                      <p style={{ fontSize: ".6rem", color: "var(--muted)" }}>{offer.carModel} · {offer.plate}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <Star size={10} style={{ color: "var(--ready)", fill: "var(--ready)" }} />
                      <span style={{ fontSize: ".68rem", color: "var(--ready)", fontWeight: 700 }}>{offer.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: ".68rem" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--go)" }} />
                    <span>{offer.fromArea}</span>
                    <Navigation size={9} style={{ color: "var(--muted)" }} />
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--stop)" }} />
                    <span>{offer.toArea}</span>
                    <span style={{ marginLeft: "auto", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{offer.departTime}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: ".64rem", color: "var(--muted2)" }}>{offer.seatsAvailable} seat{offer.seatsAvailable > 1 ? "s" : ""} left</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", color: "var(--ready)", fontWeight: 700 }}>KES {offer.contribution}</span>
                      <button onClick={() => bookCarpool(offer)}
                        style={{ padding: "7px 14px", borderRadius: 99, background: "var(--ready)", border: "none", color: "#000", fontWeight: 800, fontSize: ".68rem", cursor: "pointer" }}>
                        Reserve seat
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Carpool booked confirmation */}
      <AnimatePresence>
        {tab === "carpool" && bookedCarpool && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 300 }}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200, background: "rgba(10,10,18,.97)", backdropFilter: "blur(20px)", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", padding: "1rem 1rem 2rem" }}>
            <div className="handle" />
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <CheckCircle size={40} style={{ color: "var(--go)", margin: "0 auto 8px" }} />
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 900, color: "var(--go)" }}>Seat Reserved</p>
              <p style={{ fontSize: ".68rem", color: "var(--muted2)", marginTop: 3 }}>
                {bookedCarpool.driverName} · {bookedCarpool.departTime} · KES {bookedCarpool.contribution} paid
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "var(--glass)", border: "1px solid var(--border2)", marginBottom: 12 }}>
              <span style={{ fontSize: "1.4rem" }}>{bookedCarpool.photo}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: ".8rem", fontWeight: 700 }}>{bookedCarpool.carModel}</p>
                <p style={{ fontSize: ".62rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{bookedCarpool.plate}</p>
              </div>
              <button onClick={() => toast("📞 Calling driver…")} style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(22,163,74,.14)", border: "1px solid rgba(22,163,74,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Phone size={14} style={{ color: "var(--go)" }} />
              </button>
            </div>
            <button onClick={() => setBookedCarpool(null)}
              style={{ width: "100%", padding: 11, borderRadius: 12, background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.3)", color: "var(--stop)", fontWeight: 700, fontSize: ".78rem", cursor: "pointer" }}>
              Cancel Reservation
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ DELIVERY TAB ══════ */}
      <AnimatePresence>
        {tab === "delivery" && delStage === "idle" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200, background: "rgba(10,10,18,.97)", backdropFilter: "blur(20px)", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", padding: "1rem 1rem 1.6rem" }}>
            <div className="handle" />
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              <Package size={16} style={{ color: "var(--ready)" }} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: ".9rem", fontWeight: 900 }}>Send a Package</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 9, height: 9, borderRadius: "50%", background: "var(--go)", border: "2px solid #000" }} />
                <input className="finput" style={{ paddingLeft: 30 }} placeholder="Pickup location" value={delFrom} onChange={e => setDelFrom(e.target.value)} />
              </div>
              <div style={{ position: "relative" }}>
                <MapPin size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--stop)" }} />
                <input className="finput" style={{ paddingLeft: 30 }} placeholder="Drop-off location" value={delTo} onChange={e => setDelTo(e.target.value)} />
              </div>
            </div>
            <p className="sec-label" style={{ marginBottom: 6 }}>Package size</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(["small", "medium", "large"] as const).map(size => (
                <button key={size} onClick={() => setDelSize(size)}
                  style={{ flex: 1, padding: "10px 4px", borderRadius: 10, border: `1px solid ${delSize === size ? "rgba(217,119,6,.45)" : "var(--border2)"}`, background: delSize === size ? "rgba(217,119,6,.1)" : "var(--glass)", color: delSize === size ? "var(--ready)" : "var(--muted2)", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "capitalize" }}>{size}</p>
                  <p style={{ fontSize: ".58rem", fontFamily: "var(--font-mono)", marginTop: 2 }}>KES {DELIVERY_PRICES[size]}</p>
                </button>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: "100%", padding: 12, justifyContent: "center" }} onClick={bookDelivery}>
              <Package size={14} /> Book Courier — KES {DELIVERY_PRICES[delSize]}
            </button>
          </motion.div>
        )}
        {tab === "delivery" && delStage === "booked" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 300 }}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200, background: "rgba(10,10,18,.97)", backdropFilter: "blur(20px)", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", padding: "1rem 1rem 2rem", textAlign: "center" }}>
            <div className="handle" />
            <CheckCircle size={40} style={{ color: "var(--go)", margin: "10px auto" }} />
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 900, color: "var(--go)", marginBottom: 4 }}>Courier On The Way</p>
            <p style={{ fontSize: ".7rem", color: "var(--muted2)", marginBottom: 16 }}>{delFrom} → {delTo}</p>
            <button onClick={() => { setDelStage("idle"); setDelFrom(""); setDelTo(""); }}
              style={{ width: "100%", padding: 11, borderRadius: 12, background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.3)", color: "var(--stop)", fontWeight: 700, fontSize: ".78rem", cursor: "pointer" }}>
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
