import "maplibre-gl/dist/maplibre-gl.css";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { Toaster, toast } from "sonner";
import { motion } from "framer-motion";
import { Bus, Car, Plane, Home, Store, MapPin, Gamepad2, Bell, Zap, HelpCircle, Navigation } from "lucide-react";
import { useState, useEffect } from "react";
import { WalletProvider, useWallet } from "@/lib/wallet";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";
import LoginPage from "@/pages/Login";
import Onboarding, { useOnboarding } from "@/components/Onboarding";
import { HelpProvider, useHelp } from "@/lib/help";
import GlobalHelpSheet from "@/components/GlobalHelpSheet";

import HomePage from "@/pages/Home";
import Ma3Page from "@/pages/Ma3";
import NdaiPage from "@/pages/Ndai";
import FlyPage from "@/pages/Fly";
import MarketPage from "@/pages/Market";
import MirthPage from "@/pages/Mirth";
import ExplorePage from "@/pages/Explore";
import ProfilePage from "@/pages/Profile";
import DriverPage from "@/pages/Driver";
import NotFound from "@/pages/NotFound";

const NAV_ITEMS = [
  { href: "/ma3", label: "Ma3", Icon: Bus },
  { href: "/ndai", label: "Ndai", Icon: Car },
  { href: "/driver", label: "Drive", Icon: Navigation },
  { href: "/fly", label: "Fly", Icon: Plane },
  { href: "/", label: "Home", Icon: Home },
  { href: "/market", label: "Market", Icon: Store },
  { href: "/explore", label: "Explore", Icon: MapPin },
  { href: "/mirth", label: "Mirth", Icon: Gamepad2 },
];

function TopBar() {
  const [spin, setSpin] = useState(false);
  const [location] = useLocation();
  const { wallet } = useWallet();
  const { setOpen: setHelpOpen, setCurrentPath } = useHelp();

  useEffect(() => {
    setSpin(true);
    const t = setTimeout(() => setSpin(false), 800);
    setCurrentPath(location);
    return () => clearTimeout(t);
  }, [location]);

  return (
    <div className="topbar">
      <div style={{ position: "absolute", left: "1.1rem" }}>
        <Link href="/profile">
          <div className="token-pill" style={{ cursor: "pointer" }}>
            <Zap size={12} /><span>{wallet.balance.toLocaleString()}</span>
          </div>
        </Link>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="app-logo">
          <span style={{ color: "var(--white)" }}>Ma</span>
          <motion.span
            className="logo-3"
            animate={spin ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          >
            3
          </motion.span>
        </div>
        <span className="logo-sub">Move · Market · Mirth</span>
      </div>
      <div style={{ position: "absolute", right: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
        <div className="icon-btn" onClick={() => setHelpOpen(true)} title="Help">
          <HelpCircle size={16} />
        </div>
        <div className="icon-btn" onClick={() => toast("Notifications coming soon!")}>
          <Bell size={16} />
        </div>
      </div>
    </div>
  );
}

function BottomNav() {
  const [location] = useLocation();
  const role = localStorage.getItem("ma3_user_role");
  const visibleItems = NAV_ITEMS.filter(item => item.href !== "/driver" || role === "matatu-driver" || role === "carpool-driver");
  const isActive = (href: string) =>
    href === "/" ? location === "/" || location === "" : location.startsWith(href);

  return (
    <nav className="bottom-nav">
      {visibleItems.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link key={href} href={href}>
            <div className={`bn ${active ? "on" : ""}`}>
              <div className="bn-ic"><Icon size={18} /></div>
              <div className="bn-lbl">{label}</div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function Loader() {
  const [phase, setPhase] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 1400);
    const t3 = setTimeout(() => setDone(true), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (done) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 20000, background: "var(--ink)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      transition: "opacity .6s, visibility .6s",
    }}>
      <div style={{ position: "relative", height: 100, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <motion.div
          initial={{ opacity: 1, scale: 1 }}
          animate={phase >= 1 ? { opacity: 0, scale: 1.2 } : {}}
          style={{ position: "absolute", fontFamily: "var(--font-display)", fontSize: "3.2rem", fontWeight: 900, letterSpacing: "-.03em", color: "var(--white)", whiteSpace: "nowrap" }}
        >
          Ma<span style={{ color: "var(--muted2)" }}>thr</span><span style={{ color: "var(--gold)" }}>ee</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : {}}
          style={{ position: "absolute", fontFamily: "var(--font-display)", fontSize: "3.2rem", fontWeight: 900, letterSpacing: "-.03em", color: "var(--white)", whiteSpace: "nowrap" }}
        >
          Ma<motion.span
            animate={phase >= 2 ? { rotate: 360 } : {}}
            transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ color: "var(--gold)", display: "inline-block", transformOrigin: "center 60%" }}
          >3</motion.span>
        </motion.div>
      </div>
      <div style={{ width: 160, height: 3, background: "var(--glass2)", borderRadius: 99, marginTop: "1.2rem", overflow: "hidden" }}>
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 2.6, ease: "easeInOut" }}
          style={{ height: "100%", background: "linear-gradient(90deg,var(--gold),var(--sage))", borderRadius: 99 }}
        />
      </div>
      <div style={{ position: "absolute", bottom: 28, display: "flex", gap: 12, alignItems: "center" }}>
        {["Move", "·", "Market", "·", "Mirth"].map((w, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.6, times: [0, 0.15, 0.85, 1], delay: i * 0.3 }}
            style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".25em", textTransform: "uppercase", whiteSpace: "nowrap" }}
          >
            {w}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function AppShell() {
  const { show: showOnboarding, finish: finishOnboarding } = useOnboarding();
  return (
    <HelpProvider>
    {showOnboarding && <Onboarding onDone={finishOnboarding} />}
    <div style={{ minHeight: "100vh", background: "var(--ink)" }}>
      <TopBar />
      <GlobalHelpSheet />
      <div className="page-wrap">
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/" component={HomePage} />
          <Route path="/ma3" component={Ma3Page} />
          <Route path="/ndai" component={NdaiPage} />
          <Route path="/fly" component={FlyPage} />
          <Route path="/market" component={MarketPage} />
          <Route path="/mirth" component={MirthPage} />
          <Route path="/explore" component={ExplorePage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/driver" component={DriverPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <BottomNav />
    </div>
    </HelpProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
    <WalletProvider>
      <WouterRouter>
        <Loader />
        <AppShell />
      </WouterRouter>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(0,200,150,.15)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(0,200,150,.4)",
            borderRadius: 14,
            color: "var(--sage)",
            fontWeight: 600,
            fontSize: ".8rem",
            fontFamily: "var(--font)",
          },
        }}
      />
    </WalletProvider>
    </AuthProvider>
  );
}
