import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, CreditCard, Clock, Shield, Star, ChevronRight,
  Check, X, Bus, MapPin, Lock, Flame, Calendar, Camera, LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import { WALLET_PLAN_OPTIONS, WalletPlan } from "@/data/ma3_core";
import PageTabs from "@/components/PageTabs";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const PROFILE_TABS = [
  { id: "wallet", label: "Wallet", Icon: CreditCard },
  { id: "activity", label: "Activity", Icon: Clock },
  { id: "account", label: "Account", Icon: Shield },
] as const;

function privateAvatarPath(value: unknown, userId: string): string | null {
  if (typeof value !== "string" || !value) return null;
  let path = value.split("?")[0];
  const bucketMarker = "/profile-photos/";
  const markerAt = path.indexOf(bucketMarker);
  if (markerAt >= 0) path = path.slice(markerAt + bucketMarker.length);
  try { path = decodeURIComponent(path); } catch {}
  return path.startsWith(`${userId}/`) && !path.includes("..") ? path : null;
}

// Matatu-shaped SVG wallet
function MatatuWallet({ balance }: { balance: number }) {
  return (
    <div style={{ position: "relative", width: "100%", padding: "1px" }}>
      <svg viewBox="0 0 340 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", filter: "drop-shadow(0 8px 24px rgba(0,0,0,.5))" }}>
        {/* Matatu body */}
        <rect x="4" y="18" width="332" height="118" rx="14" fill="#0e0e18" stroke="rgba(217,119,6,.35)" strokeWidth="1.5"/>
        {/* Top stripe */}
        <rect x="4" y="18" width="332" height="22" rx="14" fill="rgba(217,119,6,.12)"/>
        <rect x="4" y="32" width="332" height="8" fill="rgba(217,119,6,.12)"/>
        {/* Front windshield bump */}
        <rect x="290" y="4" width="46" height="32" rx="8" fill="#0e0e18" stroke="rgba(217,119,6,.35)" strokeWidth="1.5"/>
        <rect x="294" y="8" width="38" height="22" rx="6" fill="rgba(100,180,255,.08)" stroke="rgba(100,180,255,.2)" strokeWidth="1"/>
        {/* Windows */}
        {[20, 70, 120, 170, 220].map(x => (
          <rect key={x} x={x} y={47} width={38} height={24} rx={5} fill="rgba(68,138,255,.08)" stroke="rgba(68,138,255,.18)" strokeWidth="1"/>
        ))}
        {/* Wheels */}
        <circle cx="60" cy="140" r="16" fill="#1c1c2a" stroke="rgba(217,119,6,.4)" strokeWidth="2"/>
        <circle cx="60" cy="140" r="8" fill="#0e0e18" stroke="rgba(217,119,6,.3)" strokeWidth="1.5"/>
        <circle cx="280" cy="140" r="16" fill="#1c1c2a" stroke="rgba(217,119,6,.4)" strokeWidth="2"/>
        <circle cx="280" cy="140" r="8" fill="#0e0e18" stroke="rgba(217,119,6,.3)" strokeWidth="1.5"/>
        {/* Balance display area */}
        <rect x="20" y="75" width="240" height="50" rx="10" fill="rgba(0,0,0,.4)"/>
        {/* Decorative route line */}
        <line x1="20" y1="58" x2="265" y2="58" stroke="rgba(217,119,6,.15)" strokeWidth="1" strokeDasharray="4 3"/>
      </svg>
      {/* Balance text overlay */}
      <div style={{ position: "absolute", top: "50%", left: 28, transform: "translateY(-25%)" }}>
        <p style={{ fontSize: ".55rem", color: "rgba(217,119,6,.7)", letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 2 }}>Demo Balance</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.7rem", fontWeight: 700, color: "var(--ready)", lineHeight: 1 }}>
          KES {balance.toLocaleString()}
        </p>
        <p style={{ fontSize: ".58rem", color: "var(--muted2)", marginTop: 4 }}>This device only · no real money</p>
      </div>
      {/* Bus icon */}
      <div style={{ position: "absolute", top: "28%", right: 68, transform: "translateY(-50%)" }}>
        <Bus size={22} style={{ color: "rgba(217,119,6,.5)" }} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { wallet, topUp, setPlan, cancelPlan } = useWallet();
  const [showTopUp, setShowTopUp] = useState(false);
  const [selPlan, setSelPlan] = useState<WalletPlan>("weekly");
  const [selAmt, setSelAmt] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState("wallet");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const jumpToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(`profile-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        const user = (await supabase!.auth.getUser()).data.user;
        if (!user) return;
        const { data: profile } = await supabase!.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
        const saved = profile?.avatar_url || user.user_metadata?.avatar_url || localStorage.getItem("ma3_profile_avatar_path") || localStorage.getItem("ma3_profile_avatar_url");
        const objectPath = privateAvatarPath(saved, user.id);
        if (!objectPath) return;
        const { data, error } = await supabase!.storage.from("profile-photos").createSignedUrl(objectPath, 60 * 60 * 24);
        if (error) throw error;
        if (!cancelled && data?.signedUrl) { setAvatarUrl(data.signedUrl); localStorage.setItem("ma3_profile_avatar_path", objectPath); }
      } catch (error) { console.warn("Could not load profile avatar", error); }
    })();
    return () => { cancelled = true; };
  }, []);

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast("Choose a JPG, PNG or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Choose an image under 5 MB."); return; }
    if (!isSupabaseConfigured || !supabase) { toast("Profile photo uploads are temporarily unavailable."); return; }
    setAvatarUploading(true);
    try {
      let user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) throw new Error("Sign in before uploading a profile photo.");
        user = data.user;
      }
      const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
      const objectPath = `${user.id}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(objectPath, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data: signed, error: signedError } = await supabase.storage.from("profile-photos").createSignedUrl(objectPath, 60 * 60 * 24);
      if (signedError || !signed?.signedUrl) throw signedError || new Error("Could not display the uploaded profile photo.");
      const { error: metadataError } = await supabase.auth.updateUser({ data: { avatar_url: objectPath } });
      if (metadataError) throw metadataError;
      const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, avatar_url: objectPath }, { onConflict: "id" });
      if (profileError) throw profileError;
      setAvatarUrl(signed.signedUrl); localStorage.setItem("ma3_profile_avatar_path", objectPath);
      toast("Profile photo uploaded.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not upload this photo. Try again later.");
    } finally { setAvatarUploading(false); if (avatarInputRef.current) avatarInputRef.current.value = ""; }
  };

  const doTopUp = () => {
    if (!selAmt) { toast("Pick an amount first"); return; }
    if (wallet.plan) {
      setPlan(selPlan, selAmt);
      toast(`Demo plan selected — KES ${selAmt.toLocaleString()} demo credit; no payment was processed.`);
    } else {
      topUp(selAmt);
      toast(`KES ${selAmt.toLocaleString()} demo credit added on this device; no payment was processed.`);
    }
    setShowTopUp(false);
    setSelAmt(null);
  };

  return (
    <div className="page-wrap">
      <div className="inner">
        <PageTabs label="Profile sections" active={activeSection} tabs={PROFILE_TABS} onChange={jumpToSection} />
        {/* Avatar header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: ".8rem 0 1rem" }}>
          <button onClick={() => avatarInputRef.current?.click()} title="Upload profile photo" aria-label="Upload profile photo" disabled={avatarUploading} style={{ width: 66, height: 66, padding: 0, borderRadius: 20, overflow: "hidden", border: "1px solid var(--border2)", background: "linear-gradient(135deg, var(--ready), var(--stop))", display: "grid", placeItems: "center", color: "var(--white)", cursor: "pointer", position: "relative", flexShrink: 0 }}>
            {avatarUrl ? <img src={avatarUrl} alt="Your profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "1.7rem" }}>👤</span>}
            <span style={{ position: "absolute", right: 3, bottom: 3, width: 21, height: 21, borderRadius: 8, background: "var(--ink)", display: "grid", placeItems: "center" }}>{avatarUploading ? <LoaderCircle size={12} /> : <Camera size={12} />}</span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void uploadAvatar(event.target.files?.[0])} style={{ display: "none" }} />
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 900 }}>Profile</p>
            <p style={{ fontSize: ".62rem", color: "var(--muted)", marginTop: 2 }}>{avatarUrl ? "Tap photo to change it" : "Tap the avatar to upload a profile photo"}</p>
          </div>
          <div style={{ marginLeft: "auto" }}>
          </div>
        </div>

        {/* Matatu-shaped wallet */}
          <div id="profile-wallet" style={{ marginBottom: 12 }}>
            <MatatuWallet balance={wallet.balance} />
            <p style={{ fontSize: ".62rem", color: "var(--muted2)", lineHeight: 1.5, marginTop: 4 }}>Prototype balance only. No payment is taken, no funds are added to an account, and this is not a stored-value wallet.</p>
        </div>

        {/* Plan indicator */}
        {wallet.plan && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.2)", marginBottom: 10 }}>
            <Clock size={13} style={{ color: "var(--go)" }} />
            <span style={{ fontSize: ".68rem", color: "var(--go)", fontWeight: 600 }}>
              Demo plan · KES {wallet.planAmount}/{WALLET_PLAN_OPTIONS[wallet.plan].periodLabel} · no subscription or payment
            </span>
            <button onClick={() => { cancelPlan(); toast("Demo plan cleared"); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: ".65rem" }}>Clear</button>
          </div>
        )}

        {/* Top Up button */}
        <button className="btn btn-primary" style={{ width: "100%", padding: 12, justifyContent: "center", marginBottom: 14 }} onClick={() => setShowTopUp(s => !s)}>
          <CreditCard size={15} /> Add Demo Credit
        </button>

        {/* Top-up form */}
        <AnimatePresence>
          {showTopUp && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginBottom: 14 }}>
              <div className="card" style={{ padding: 16, borderColor: "rgba(217,119,6,.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 700 }}>Add demo credit</p>
                  <button onClick={() => setShowTopUp(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={16} /></button>
                </div>
                <p style={{ fontSize: ".62rem", color: "var(--muted2)", lineHeight: 1.5, marginBottom: 10 }}>This only changes the local prototype balance; no real payment is processed.</p>
                {/* Plan selector */}
                <label style={{ marginBottom: 6 }}>Demo plan length</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {(["daily", "weekly", "monthly"] as WalletPlan[]).map(p => (
                    <button key={p} onClick={() => { setSelPlan(p); setSelAmt(null); }}
                      style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${selPlan === p ? "rgba(217,119,6,.45)" : "var(--border2)"}`, background: selPlan === p ? "rgba(217,119,6,.1)" : "var(--glass)", color: selPlan === p ? "var(--ready)" : "var(--muted2)", fontSize: ".68rem", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                      {p}
                    </button>
                  ))}
                </div>
                {/* Amount selector */}
                <label style={{ marginBottom: 6 }}>Demo amount (KES)</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {WALLET_PLAN_OPTIONS[selPlan].suggested.map(amt => (
                    <button key={amt} onClick={() => setSelAmt(amt)}
                      style={{ padding: "8px 14px", borderRadius: 99, border: `1px solid ${selAmt === amt ? "rgba(217,119,6,.5)" : "var(--border2)"}`, background: selAmt === amt ? "rgba(217,119,6,.12)" : "var(--glass)", color: selAmt === amt ? "var(--ready)" : "var(--white)", fontFamily: "var(--font-mono)", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <button className="btn btn-go" style={{ width: "100%", padding: 11, justifyContent: "center" }} onClick={doTopUp}>
                  <Check size={14} /> Add demo credit — KES {selAmt?.toLocaleString() ?? "—"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section id="profile-activity" style={{ marginBottom: 16 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>Recent Activity</div>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <p style={{ fontSize: ".78rem", fontWeight: 700, marginBottom: 4 }}>No verified activity yet</p>
            <p style={{ fontSize: ".64rem", color: "var(--muted2)", lineHeight: 1.5 }}>Trip, payment and price-contribution history will appear here only after a connected service confirms it.</p>
          </div>
          <div className="sec-label" style={{ marginBottom: 8 }}>Achievements</div>
          <div className="card" style={{ padding: 14 }}>
            <p style={{ fontSize: ".64rem", color: "var(--muted2)", lineHeight: 1.5 }}>Verified achievements will appear after the backend records the qualifying action. No sample badges are shown.</p>
          </div>
        </section>

        {/* Settings */}
        <div id="profile-account" className="sec-label" style={{ marginBottom: 8 }}>Account</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 24 }}>
          {[
            { Icon: Shield,   label: "Privacy & Safety" },
            { Icon: Star,     label: "Ratings & Reviews" },
            { Icon: Calendar, label: "Journey History" },
          ].map(({ Icon, label }) => (
            <div key={label} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onClick={() => toast(`${label} — coming soon`)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={15} style={{ color: "var(--muted2)" }} />
                <span style={{ fontSize: ".8rem" }}>{label}</span>
              </div>
              <ChevronRight size={14} style={{ color: "var(--muted)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
