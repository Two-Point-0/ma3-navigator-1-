import { Link } from "wouter";
import { motion } from "framer-motion";
import { Bus, Car, Plane, Store, MapPin, Gamepad2, ArrowRight, Wallet, Route, Search, TrainFront, ShoppingCart, Trophy, Sparkles, Compass, UserCircle } from "lucide-react";

const SECTIONS = [
  { href: "/ma3", icon: Bus, color: "var(--stop)", label: "Ma3", desc: "Route search · Live · Train", features: ["Find a matatu route or stop", "Check current live-feed status", "Search rail stations and line"] },
  { href: "/ndai", icon: Car, color: "var(--stop)", label: "Ndai", desc: "Ride · Carpool · Boda Basket", features: ["Search pickup and destination", "Find a shared ride", "Send a Market basket by boda"] },
  { href: "/fly", icon: Plane, color: "var(--ready)", label: "Fly", desc: "Domestic · International · SGR", features: ["Search Kenyan flights", "Search regional / international flights", "Browse sourced SGR routes"] },
  { href: "/market", icon: Store, color: "var(--ready)", label: "Market", desc: "Compare · Smart shopping · Find items", features: ["Compare a shared basket across branches", "Build a household or trip template", "Search the product catalogue"] },
  { href: "/explore", icon: MapPin, color: "var(--go)", label: "Explore", desc: "Eat & drink · Stay & shop · Places", features: ["Search food and drink hotspots", "Find stays and shops", "Discover landmarks and essentials"] },
  { href: "/mirth", icon: Gamepad2, color: "var(--go)", label: "Mirth", desc: "Games · Nganya · Annual board", features: ["Search community games", "Browse and vote for registered Nganya", "Search annual vote rankings"] },
];

export default function HomePage() {
  return (
    <div className="inner">
      <div style={{ textAlign: "center", padding: "1.5rem 0 1.2rem" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".3em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
            Nairobi's Urban Companion
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "3.2rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-.03em", marginBottom: 8 }}>
            Ma<span style={{ color: "var(--ready)" }}>3</span>
          </h1>
          <p style={{ fontSize: ".72rem", color: "var(--muted2)", letterSpacing: ".2em", textTransform: "uppercase" }}>Move · Market · Mirth</p>
        </motion.div>
      </div>

      <Link href="/profile">
        <div className="card" style={{ padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(217,119,6,.06)", borderColor: "rgba(217,119,6,.24)", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(217,119,6,.12)", border: "1px solid rgba(217,119,6,.25)", display: "grid", placeItems: "center" }}>
              <Wallet size={16} style={{ color: "var(--ready)" }} />
            </div>
            <span>
              <b style={{ display: "block", fontSize: ".76rem" }}>Wallet</b>
              <small style={{ color: "var(--muted2)", fontSize: ".59rem" }}>Open account and payment settings</small>
            </span>
          </div>
          <ArrowRight size={14} style={{ color: "var(--muted2)" }} />
        </div>
      </Link>

      <p className="sec-label" style={{ marginBottom: 9 }}>Your six spaces</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 9, marginBottom: 14 }}>
        {SECTIONS.map(({ href, icon: Icon, color, label, desc, features }, index) => (
          <motion.div key={href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .04 * index }}>
            <Link href={href}><div className="card" style={{ padding: 13, height: "100%", cursor: "pointer", background: `linear-gradient(135deg,color-mix(in srgb,${color} 12%,transparent),rgba(255,255,255,.035))`, borderColor: `color-mix(in srgb,${color} 38%,transparent)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}><div style={{ width: 37, height: 37, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb,${color} 14%,transparent)`, border: `1px solid color-mix(in srgb,${color} 40%,transparent)` }}><Icon size={18} style={{ color }} /></div><div style={{ flex: 1 }}><b style={{ display: "block", fontFamily: "var(--font-display)", fontSize: ".79rem" }}>{label}</b><small style={{ color: "var(--muted2)", fontSize: ".57rem" }}>{desc}</small></div><ArrowRight size={14} style={{ color: "var(--muted2)" }} /></div>
              <div style={{ display: "grid", gap: 5 }}>{features.map((feature, featureIndex) => { const FeatureIcon = [Search, Route, TrainFront, ShoppingCart, Compass, Trophy, Sparkles][(index + featureIndex) % 7]; return <div key={feature} style={{ display: "flex", gap: 7, alignItems: "center", color: "var(--muted2)", fontSize: ".58rem" }}><FeatureIcon size={11} style={{ color, flexShrink: 0 }} />{feature}</div>; })}</div>
            </div></Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
