import TripsPage from "@/pages/Trips";
import LegalPage from "@/pages/Legal";
import "maplibre-gl/dist/maplibre-gl.css";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { Toaster } from "sonner";
import { motion } from "framer-motion";
import { Bus, Car, Plane, Home, Store, MapPin, Gamepad2, HelpCircle, Navigation } from "lucide-react";
import { Suspense, lazy, useState, useEffect } from "react";
import { WalletProvider } from "@/lib/wallet";
import { ShoppingBasketProvider } from "@/lib/shoppingBasket";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";
import Onboarding, { useOnboarding } from "@/components/Onboarding";
import { HelpProvider, useHelp } from "@/lib/help";
import GlobalHelpSheet from "@/components/GlobalHelpSheet";

const LoginPage = lazy(() => import("@/pages/Login"));
const HomePage = lazy(() => import("@/pages/Home"));
const Ma3Page = lazy(() => import("@/pages/Ma3"));
const NdaiPage = lazy(() => import("@/pages/Ndai"));
const FlyPage = lazy(() => import("@/pages/Fly"));
const MarketPage = lazy(() => import("@/pages/Market"));
const MirthPage = lazy(() => import("@/pages/Mirth"));
const ExplorePage = lazy(() => import("@/pages/Explore"));
const ProfilePage = lazy(() => import("@/pages/Profile"));
const LocationSharePage = lazy(() => import("@/pages/LocationShare"));
const DriverPage = lazy(() => import("@/pages/Driver"));
const WalletPage = lazy(() => import("@/pages/Wallet"));
const NotFound = lazy(() => import("@/pages/NotFound"));

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
  const { setOpen: setHelpOpen, setCurrentPath } = useHelp();

  // Keep the logo clear of the phone's notch / dynamic island.
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden";
    document.body.appendChild(probe);
    const apply = () => document.documentElement.style.setProperty("--top-h", `${44 + probe.getBoundingClientRect().height}px`);
    apply();
    window.addEventListener("resize", apply);
    return () => { window.removeEventListener("resize", apply); probe.remove(); };
  }, []);

  useEffect(() => {
    setSpin(true);
    const t = setTimeout(() => setSpin(false), 800);
    setCurrentPath(location);
    return () => clearTimeout(t);
  }, [location]);

  return (
    <div className="topbar">
      <div className="logo-float" style={{ textAlign: "center" }}>
        <div className="app-logo" style={{ justifyContent: "center" }}>
          <span style={{ color: "var(--white)" }}>Ma</span>
          <motion.span
            className="logo-3"
            animate={spin ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          >
            3
          </motion.span>
        </div>
      </div>
      <button className="icon-btn" aria-label="What does this page do?" title="Help" onClick={() => setHelpOpen(true)}
        style={{ position: "absolute", right: "0.9rem", bottom: 4, background: "rgba(14,14,24,.72)" }}>
        <HelpCircle size={16} />
      </button>
    </div>
  );
}

function BottomNav() {
  const [location] = useLocation();
  const role = localStorage.getItem("ma3_user_role");
  const visibleItems = NAV_ITEMS.filter(item => item.href !== "/driver" || role === "matatu-driver" || role === "carpool-driver" || role === "tour-driver");
  const isActive = (href: string) =>
    href === "/" ? location === "/" || location === "" : location.startsWith(href);

  return (
    <nav className="bottom-nav">
      {visibleItems.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link key={href} href={href} aria-label={label} title={label}>
            <div className={`bn ${active ? "on" : ""}`}>
              <div className="bn-ic"><Icon size={20} strokeWidth={active ? 2.4 : 2} /></div>
              <span className="bn-lbl">{label}</span>
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
            style={{ color: phase >= 2 ? "var(--go)" : phase >= 1 ? "var(--ready)" : "var(--stop)", display: "inline-block", transformOrigin: "center 60%" }}
          >3</motion.span>
        </motion.div>
      </div>
      <div style={{ width: 160, height: 3, background: "var(--glass2)", borderRadius: 99, marginTop: "1.2rem", overflow: "hidden" }}>
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 2.6, ease: "easeInOut" }}
          style={{ height: "100%", background: "linear-gradient(90deg,var(--stop),var(--ready),var(--go))", borderRadius: 99 }}
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
        <Suspense fallback={<div className="inner" style={{ paddingTop: 24, color: "var(--muted2)", fontSize: ".75rem" }}>Loading page…</div>}>
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
          <Route path="/location-share" component={LocationSharePage} />
          <Route path="/driver" component={DriverPage} />
          <Route path="/wallet" component={WalletPage} />
          <Route path="/trips" component={TripsPage} />
          <Route path="/legal" component={LegalPage} />
          <Route component={NotFound} />
        </Switch>
        </Suspense>
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
    <ShoppingBasketProvider>
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
    </ShoppingBasketProvider>
    </WalletProvider>
    </AuthProvider>
  );
}
