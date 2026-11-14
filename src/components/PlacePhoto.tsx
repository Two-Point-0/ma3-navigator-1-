import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { APP_MODE } from "@/lib/appMode";

/** Shows the paid photo of an Explore place, and lets a signed-in person add one. The fee decides how long it is shown. */
const PLANS = [{ days: 7, fee: 20 }, { days: 30, fee: 50 }, { days: 90, fee: 120 }] as const; // deliberately small so more people list; change here any time

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not read that photo")), "image/jpeg", 0.82));
}

export default function PlacePhoto({ placeRef }: { placeRef: string }) {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [url, setUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [busy, setBusy] = useState(false);
  const [payWith, setPayWith] = useState<"fee" | "points">("fee");
  const [points, setPoints] = useState<number | null>(null);
  useEffect(() => { if (adding && supabase) void supabase.rpc("my_spendable_points").then(({ data }) => setPoints(typeof data === "number" ? data : null)); }, [adding]);

  useEffect(() => {
    setUrl(null); setAdding(false);
    if (!isSupabaseConfigured || !supabase) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase!.from("place_photos").select("image_path").eq("place_ref", placeRef).eq("status", "active").gt("paid_until", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
      if (alive && data?.[0]) setUrl(supabase!.storage.from("place-photos").getPublicUrl(data[0].image_path).data.publicUrl);
    })();
    return () => { alive = false; };
  }, [placeRef]);

  const upload = async (file: File | undefined) => {
    if (!file || !supabase || !user) return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const path = `${user.id}/${id}.jpg`;
      const up = await supabase.storage.from("place-photos").upload(path, await shrink(file), { contentType: "image/jpeg" });
      if (up.error) throw new Error(up.error.message);
      const ins = await supabase.from("place_photos").insert({ id, place_ref: placeRef, image_path: path });
      if (ins.error) throw new Error(ins.error.message);
      if (payWith === "points") {
        const spent = await supabase.rpc("activate_place_photo_with_points", { p_id: id, p_days: days });
        if (spent.error) { await supabase.from("place_photos").delete().eq("id", id); throw new Error(spent.error.message); }
        setUrl(supabase.storage.from("place-photos").getPublicUrl(path).data.publicUrl); setAdding(false);
        toast.success(`Photo is live for ${days} days. ${spent.data} points left.`);
        return;
      }
      if (APP_MODE.realPayments) { toast.info("Photo saved. It goes live once the fee is paid."); return; }
      const act = await supabase.rpc("activate_place_photo_demo", { p_id: id, p_days: days });
      if (act.error) throw new Error(act.error.message);
      setUrl(supabase.storage.from("place-photos").getPublicUrl(path).data.publicUrl);
      setAdding(false);
      toast.success(`Photo is live for ${days} days (demo, no payment taken).`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add the photo."); }
    finally { setBusy(false); }
  };

  return <div style={{ marginBottom: 8 }}>
    {url && <img src={url} alt="Place" loading="lazy" style={{ width: "100%", maxHeight: 190, objectFit: "cover", borderRadius: 12, display: "block" }} />}
    {!adding && <button className="btn btn-ghost" style={{ marginTop: 6, padding: "5px 10px", fontSize: ".58rem" }} onClick={() => signedIn ? setAdding(true) : toast.info("Sign in with Google or phone to add a photo.")}><ImagePlus size={12} /> {url ? "Replace photo" : "Add a photo of this place"}</button>}
    {adding && <div className="ios-glass" style={{ padding: 9, display: "grid", gap: 7 }}>
      <small style={{ color: "var(--muted2)", lineHeight: 1.45 }}>Only upload a photo you took or own. The fee sets how long it is shown.</small>
      <select className="finput" value={days} onChange={event => setDays(Number(event.target.value) as 7 | 30 | 90)}>{PLANS.map(plan => <option key={plan.days} value={plan.days}>{plan.days} days · KES {plan.fee}</option>)}</select>
      <div style={{ display: "flex", gap: 6 }}><button className={`btn ${payWith === "fee" ? "btn-ready" : "btn-ghost"}`} style={{ flex: 1, fontSize: ".6rem" }} onClick={() => setPayWith("fee")}>Pay a fee</button><button className={`btn ${payWith === "points" ? "btn-ready" : "btn-ghost"}`} style={{ flex: 1, fontSize: ".6rem" }} onClick={() => setPayWith("points")}>Use game points{points !== null ? ` (${points.toLocaleString()})` : ""}</button></div>
      {payWith === "points" && <small style={{ color: "var(--muted2)", lineHeight: 1.4 }}>Earn points in Mirth games. Points are hard to earn on purpose and have no cash value.</small>}
      <label className="btn btn-ready" style={{ justifyContent: "center", cursor: "pointer" }}>{busy ? "Uploading…" : "Choose photo"}<input type="file" accept="image/*" hidden disabled={busy} onChange={event => void upload(event.target.files?.[0])} /></label>
      <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
    </div>}
  </div>;
}
