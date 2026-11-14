import { Link } from "wouter";
import { motion } from "framer-motion";
import { Bus, Car, Plane, Store, MapPin, Gamepad2, Wallet, Route, Share2, Shield } from "lucide-react";

// Each space shows its three buttons. Colours follow the traffic light used across the app: red, amber, green.
const SECTIONS = [
  { href: "/ma3", icon: Bus, color: "var(--stop)", label: "Ma3", tabs: ["Matatu", "Parcel", "Rail"] },
  { href: "/ndai", icon: Car, color: "var(--ready)", label: "Ndai", tabs: ["Ride", "Carpool", "Tours"] },
  { href: "/fly", icon: Plane, color: "var(--go)", label: "Fly", tabs: ["Domestic", "SGR", "International"] },
  { href: "/market", icon: Store, color: "var(--stop)", label: "Market", tabs: ["Compare", "Basket", "Local"] },
  { href: "/explore", icon: MapPin, color: "var(--ready)", label: "Explore", tabs: ["Food", "Stay & shop", "Sights"] },
  { href: "/mirth", icon: Gamepad2, color: "var(--go)", label: "Mirth", tabs: ["Games", "Nganya", "Shop"] },
];
const QUICK = [
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/trips", icon: Route, label: "My trips" },
  { href: "/location-share", icon: Share2, label: "Share location" },
  { href: "/legal", icon: Shield, label: "Privacy & terms" },
];

export default function HomePage() {
  return (
    <div className="inner" style={{ paddingBottom: 90 }}>
      <div style={{ textAlign: "center", padding: "1.2rem 0 1rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.8rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-.03em" }}>
          Ma<span style={{ color: "var(--ready)" }}>3</span>
        </h1>
        <p style={{ fontSize: ".62rem", color: "var(--muted2)", letterSpacing: ".22em", textTransform: "uppercase", marginTop: 6 }}>Move · Market · Mirth</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {SECTIONS.map(({ href, icon: Icon, color, label, tabs }, index) => (
          <motion.div key={href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .035 * index }}>
            <Link href={href}>
              <div className="card" style={{ padding: "14px 10px 12px", cursor: "pointer", textAlign: "center", borderColor: `color-mix(in srgb,${color} 45%,transparent)`, background: `color-mix(in srgb,${color} 8%,transparent)` }}>
                <div style={{ width: 52, height: 52, margin: "0 auto 8px", borderRadius: 16, display: "grid", placeItems: "center", background: `color-mix(in srgb,${color} 18%,transparent)`, border: `2px solid ${color}` }}><Icon size={26} style={{ color }} /></div>
                <b style={{ display: "block", fontFamily: "var(--font-display)", fontSize: ".95rem" }}>{label}</b>
                <small style={{ display: "block", color: "var(--muted2)", fontSize: ".56rem", marginTop: 4, lineHeight: 1.5 }}>{tabs.join(" · ")}</small>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {QUICK.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}><div className="card" style={{ padding: "10px 6px", textAlign: "center", cursor: "pointer" }}><Icon size={18} style={{ color: "var(--muted2)" }} /><small style={{ display: "block", fontSize: ".58rem", marginTop: 4 }}>{label}</small></div></Link>
        ))}
      </div>
    </div>
  );
}
