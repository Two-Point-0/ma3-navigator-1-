// src/pages/Login.tsx
import { motion } from "framer-motion";
import { useAuthContext } from "@/context/AuthContext";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { signInWithGoogle, signInAsGuest } = useAuthContext();
  const [, navigate] = useLocation();

  const handleGoogle = async () => {
    await signInWithGoogle();
    navigate("/");
  };

  const handleGuest = async () => {
    await signInAsGuest();
    navigate("/");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "var(--ink)" }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        {/* Logo */}
        <div style={{ fontFamily: "var(--font-display)", fontSize: "3.5rem", fontWeight: 900, letterSpacing: "-.03em", marginBottom: 8 }}>
          Ma<span style={{ color: "var(--ready)" }}>3</span>
        </div>
        <p style={{ fontSize: ".68rem", color: "var(--muted2)", letterSpacing: ".22em", textTransform: "uppercase", marginBottom: "2.5rem" }}>
          Move · Market · Mirth
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Google sign-in */}
          <button
            onClick={handleGoogle}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px 20px", borderRadius: 12, background: "#fff", color: "#000", border: "none", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".84rem", cursor: "pointer" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
            <span style={{ fontSize: ".62rem", color: "var(--muted)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
          </div>

          {/* Guest */}
          <button
            onClick={handleGuest}
            style={{ padding: "12px 20px", borderRadius: 12, background: "var(--glass2)", border: "1px solid var(--border2)", color: "var(--white)", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".82rem", cursor: "pointer" }}
          >
            👀 Continue as Guest
          </button>
        </div>

        <p style={{ fontSize: ".62rem", color: "var(--muted)", marginTop: "1.5rem", lineHeight: 1.6 }}>
          Guest accounts can browse all pages. Sign in with Google to save your wallet, pins, and votes across devices.
        </p>
      </motion.div>
    </div>
  );
}
