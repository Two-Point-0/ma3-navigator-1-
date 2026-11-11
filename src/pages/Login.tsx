import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { CircleHelp, Eye, LogIn, Phone, ShieldCheck } from "lucide-react";
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

function toKenyanE164(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  throw new Error("Enter a Kenyan mobile such as 0712 345 678 or +254 712 345 678.");
}

export default function LoginPage() {
  const { signInWithGoogle, sendPhoneOtp, verifyPhoneOtp, signInAsGuest } = useAuthContext();
  const [, navigate] = useLocation();
  const [panel, setPanel] = useState<LoginPanel>("signin");
  const [phoneValue, setPhoneValue] = useState("");
  const [sentPhone, setSentPhone] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const handleGoogle = async () => {
    try { await signInWithGoogle(); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not start Google sign-in."); }
  };

  const handleSendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendingOtp(true);
    try {
      const phone = toKenyanE164(phoneValue);
      await sendPhoneOtp(phone);
      setSentPhone(phone);
      setOtpValue("");
      toast(`Verification code sent to ${phone}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send a phone verification code.");
    } finally { setSendingOtp(false); }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otpValue.trim())) { toast("Enter the 6-digit code from the SMS."); return; }
    setVerifyingOtp(true);
    try {
      await verifyPhoneOtp(sentPhone, otpValue.trim());
      toast("Phone verified. You are signed in.");
      navigate("/");
    } catch (error) {
      toast(error instanceof Error ? error.message : "That code could not be verified. Request a new code and try again.");
    } finally { setVerifyingOtp(false); }
  };

  const handleGuest = async () => {
    try { await signInAsGuest(); navigate("/"); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not start guest access."); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "var(--ink)" }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <PageTabs label="Sign-in options" active={panel} tabs={LOGIN_TABS} onChange={id => setPanel(id as LoginPanel)} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: "3.5rem", fontWeight: 900, letterSpacing: "-.03em", marginBottom: 8 }}>Ma<span style={{ color: "var(--ready)" }}>3</span></div>
        <p style={{ fontSize: ".68rem", color: "var(--muted2)", letterSpacing: ".22em", textTransform: "uppercase", marginBottom: "1.6rem" }}>Move · Market · Mirth</p>

        {panel === "signin" && <div style={{ display: "grid", gap: 14 }}>
          <button onClick={handleGoogle} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px 20px", borderRadius: 12, background: "#fff", color: "#000", border: "none", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".84rem", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
            Continue with Google
          </button>
          <div className="card" style={{ padding: 15, textAlign: "left" }}>
            <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".76rem", fontWeight: 800, marginBottom: 9 }}><Phone size={14} style={{ color: "var(--go)" }} />Sign in with your phone</p>
            <form onSubmit={handleSendOtp} style={{ display: "grid", gap: 8 }}>
              <label htmlFor="signin-phone">Kenyan mobile number</label>
              <input id="signin-phone" className="finput" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678 or +254 712 345 678" value={phoneValue} onChange={event => setPhoneValue(event.target.value)} />
              <button className="btn btn-go" type="submit" disabled={sendingOtp}>{sendingOtp ? "Sending code…" : sentPhone ? "Send a new code" : "Send verification code"}</button>
            </form>
            {sentPhone && <form onSubmit={handleVerifyOtp} style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: ".64rem", lineHeight: 1.45, color: "var(--muted2)" }}>Enter the 6-digit SMS code sent to {sentPhone}.</p>
              <label htmlFor="signin-otp">SMS verification code</label>
              <input id="signin-otp" className="finput" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" value={otpValue} onChange={event => setOtpValue(event.target.value.replace(/\D/g, "").slice(0, 6))} />
              <button className="btn btn-ready" type="submit" disabled={verifyingOtp}>{verifyingOtp ? "Verifying…" : "Verify and sign in"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setSentPhone(""); setOtpValue(""); }}>Change number</button>
            </form>}
            <p style={{ display: "flex", gap: 6, margin: "10px 0 0", fontSize: ".58rem", lineHeight: 1.45, color: "var(--muted)" }}><ShieldCheck size={13} style={{ flexShrink: 0 }} />Phone OTP works after an SMS provider is configured in Supabase. SMS provider charges may apply.</p>
          </div>
        </div>}

        {panel === "guest" && <button onClick={handleGuest} style={{ width: "100%", padding: "12px 20px", borderRadius: 12, background: "var(--glass2)", border: "1px solid var(--border2)", color: "var(--white)", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".82rem", cursor: "pointer" }}>Continue as Guest</button>}
        {panel === "about" && <div className="card" style={{ padding: 16, textAlign: "left" }}><p style={{ fontSize: ".75rem", fontWeight: 700, marginBottom: 6 }}>What each option does</p><p style={{ fontSize: ".64rem", color: "var(--muted2)", lineHeight: 1.6 }}>Use phone verification on both test phones so the driver and passenger have separate verified accounts. Guest mode is for browsing. The wallet remains a prototype until M-Pesa sandbox credentials are configured and tested.</p></div>}

        <p style={{ fontSize: ".62rem", color: "var(--muted)", marginTop: "1.5rem", lineHeight: 1.6 }}>No sign-in option charges money. Phone SMS delivery depends on your configured provider and its terms.</p>
      </motion.div>
    </div>
  );
}