import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, CreditCard, Clock, Shield, Star, ChevronRight,
  Check, X, Bus, MapPin, Lock, Flame, Calendar, Camera, LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { setNickname, useNickname } from "@/lib/account";
import TripsPage from "@/pages/Trips";
import LegalPage from "@/pages/Legal";
import PageTabs from "@/components/PageTabs";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const PROFILE_TABS = [
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
function ProfileDetails() {
  const nickname = useNickname();
  const [nameDraft, setNameDraft] = useState(nickname);
  const [activeSection, setActiveSection] = useState("activity");
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

        <section id="profile-activity" style={{ marginBottom: 16 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>Recent Activity</div>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <p style={{ fontSize: ".78rem", fontWeight: 700, marginBottom: 4 }}>No verified activity yet</p>
            <p style={{ fontSize: ".64rem", color: "var(--muted2)", lineHeight: 1.5 }}>Your history will show here.</p>
          </div>
          <div className="sec-label" style={{ marginBottom: 8 }}>Achievements</div>
          <div className="card" style={{ padding: 14 }}>
            <p style={{ fontSize: ".64rem", color: "var(--muted2)", lineHeight: 1.5 }}>Your badges will show here.</p>
          </div>
        </section>

        <div id="profile-account" className="sec-label" style={{ marginBottom: 8 }}>Account</div>
        <div className="card" style={{ padding: 14, marginBottom: 24 }}>
          <label htmlFor="nick" style={{ marginBottom: 6 }}>Your name on Ma3</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="nick" value={nameDraft} maxLength={24} onChange={e => setNameDraft(e.target.value)} placeholder="e.g. Muhia" style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={() => { setNickname(nameDraft); toast("Name saved. Your wallet now uses it."); }}>Save</button>
          </div>
          <p style={{ fontSize: ".62rem", color: "var(--muted2)", lineHeight: 1.5, marginTop: 6 }}>This name appears on your wallet.</p>
        </div>
      </div>
    </div>
  );
}

type View = "menu" | "profile" | "trips" | "privacy";
const MENU: { id: Exclude<View, "menu">; label: string; hint: string; Icon: typeof Shield }[] = [
  { id: "profile", label: "Profile & name", hint: "Photo, your name on Ma3, activity", Icon: Camera },
  { id: "trips", label: "My trips", hint: "Saved routes, earnings and fuel saved", Icon: Bus },
  { id: "privacy", label: "Privacy & terms", hint: "How Ma3 handles your data", Icon: Shield },
];

/** One container: everything about the account lives under here, with its own sub-pages. */
export default function AccountSettingsPage() {
  const [view, setView] = useState<View>("menu");
  const current = MENU.find(m => m.id === view);
  return (
    <div>
      <div className="inner" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {view !== "menu" && <button className="btn" onClick={() => setView("menu")} aria-label="Back to Account & settings" style={{ padding: "6px 10px" }}>‹ Back</button>}
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 900 }}>{current ? current.label : "Account & settings"}</h1>
        </div>
      </div>
      {view === "menu" && (
        <div className="inner" style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 12 }}>
          {MENU.map(({ id, label, hint, Icon }) => (
            <div key={id} role="button" tabIndex={0} className="card" onClick={() => setView(id)} onKeyDown={e => { if (e.key === "Enter") setView(id); }} style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={16} style={{ color: "var(--muted2)" }} />
                <span><b style={{ display: "block", fontSize: ".8rem" }}>{label}</b><small style={{ color: "var(--muted2)", fontSize: ".6rem" }}>{hint}</small></span>
              </span>
              <ChevronRight size={14} style={{ color: "var(--muted)" }} />
            </div>
          ))}
        </div>
      )}
      {view === "profile" && <ProfileDetails />}
      {view === "trips" && <TripsPage />}
      {view === "privacy" && <LegalPage />}
    </div>
  );
}
