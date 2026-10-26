// src/pages/Login.tsx
import { motion } from "framer-motion";
import { useState } from "react";
import { CircleHelp, Eye, LogIn } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { useLocation } from "wouter";
import PageTabs from "@/components/PageTabs";
import { toast } from "sonner";

type LoginPanel = "signin" | "guest" | "about";
const LOGIN_TABS = [
  { id: "signin", label: "Sign in", Icon: LogIn },
  { id: "guest", label: "Guest", Icon: Eye },
  { id: "about", label: "About", Icon: CircleHelp },
] as const;

export default function LoginPage() {
  const { signInWithGoogle, signInAsGuest } = useAuthContext();
  const [, navigate] = useLocation();
  const [panel, setPanel] = useState<LoginPanel>("signin");

  const handleGoogle = async () => {
    try { await signInWithGoogle(); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not start Google sign-in."); }
  };

  const handleGuest = async () => {
    try { await signInAsGuest(); navigate("/"); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not start guest access."); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "var(--ink)" }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <PageTabs label="Sign-in options" active={panel} tabs={LOGIN_TABS} onChange={id => setPanel(id as LoginPanel)} />
        {/* Logo */}
        <div style={{ fontFamily: "var(--font-display)", fontSize: "3.5rem", fontWeight: 900, letterSpacing: "-.03em", marginBottom: 8 }}>
          Ma<span style={{ color: "var(--ready)" }}>3</span>
        </div>
        <p style={{ fontSize: ".68rem", color: "var(--muted2)", letterSpacing: ".22em", textTransform: "uppercase", marginBottom: "2.5rem" }}>
          Move · Market · Mirth
        </p>

        {panel === "signin" && (
          <button onClick={handleGoogle} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px 20px", borderRadius: 12, background: "#fff", color: "#000", border: "none", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".84rem", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>
        )}
        {panel === "guest" && (
          <button onClick={handleGuest} style={{ width: "100%", padding: "12px 20px", borderRadius: 12, background: "var(--glass2)", border: "1px solid var(--border2)", color: "var(--white)", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".82rem", cursor: "pointer" }}>
            Continue as Guest
          </button>
        )}
        {panel === "about" && (
          <div className="card" style={{ padding: 16, textAlign: "left" }}>
            <p style={{ fontSize: ".75rem", fontWeight: 700, marginBottom: 6 }}>What each option does</p>
            <p style={{ fontSize: ".64rem", color: "var(--muted2)", lineHeight: 1.6 }}>Guest mode lets you browse. Sign in to keep account features, profile photos and community activity connected to your account.</p>
          </div>
        )}

        <p style={{ fontSize: ".62rem", color: "var(--muted)", marginTop: "1.5rem", lineHeight: 1.6 }}>
          No option charges money. The wallet shown in the prototype is demo-only and does not represent a real balance.
        </p>
      </motion.div>
    </div>
  );
}
