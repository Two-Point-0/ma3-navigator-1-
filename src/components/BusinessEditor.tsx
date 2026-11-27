import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { planOf, type LocalBusiness, type LocalItem } from "@/lib/localPlans";
import { BizImg, shrinkImage } from "@/lib/bizImages";

type Booking = { id: string; name: string; phone: string; service: string | null; wanted_at: string | null; note: string | null; status: string };

/** Where an owner (or you, as admin) edits everything on a business page. */
export default function BusinessEditor({ business, onClose, onSaved }: { business: LocalBusiness; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthContext();
  const plan = planOf(business.category);
  const [form, setForm] = useState({ name: business.name, tagline: business.tagline ?? "", description: business.description ?? "", hours: business.hours ?? "", phone: business.phone ?? "", whatsapp: business.whatsapp ?? "", website: business.website ?? "", address: business.address ?? "", services: (business.services ?? []).join(", ") });
  const [photos, setPhotos] = useState<string[]>(business.image_paths ?? []);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ name: "", price: "", note: "" });
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const folder = business.owner_id ?? user?.id ?? "x";

  const loadItems = async () => { const { data } = await supabase!.from("local_business_items").select("*").eq("business_id", business.id).order("sort").order("name"); setItems((data ?? []) as LocalItem[]); };
  const loadBookings = async () => { if (!plan.bookings) return; const { data } = await supabase!.from("local_bookings").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(50); setBookings((data ?? []) as Booking[]); };
  useEffect(() => { void loadItems(); void loadBookings(); }, [business.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, []);

  const saveDetails = async () => {
    setBusy(true);
    const { error } = await supabase!.from("local_businesses").update({
      name: form.name.trim(), tagline: form.tagline.trim() || null, description: form.description.trim(), hours: form.hours.trim() || null,
      phone: form.phone.trim() || null, whatsapp: form.whatsapp.trim() || null, website: form.website.trim() || null, address: form.address.trim() || null,
      services: form.services.split(",").map(text => text.trim()).filter(Boolean).slice(0, 20), image_paths: photos }).eq("id", business.id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Page saved."); onSaved();
  };
  const upload = async (file: File, name: string) => {
    const path = `${folder}/${business.id}/${name}.jpg`;
    const { error } = await supabase!.storage.from("business-images").upload(path, await shrinkImage(file), { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(error.message);
    return path;
  };
  const addPhoto = async (file?: File) => {
    if (!file) return;
    if (photos.length >= 5) return void toast.error("Up to 5 photos.");
    try { setBusy(true); const path = await upload(file, `p${Date.now()}`); setPhotos(current => [...current, path]); toast.success("Photo added. Press Save page to keep it."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); } finally { setBusy(false); }
  };
  const addItem = async (file?: File) => {
    if (!draft.name.trim()) return void toast.error("Type a name first.");
    try {
      setBusy(true);
      const image_path = file ? await upload(file, `i${Date.now()}`) : null;
      const { error } = await supabase!.from("local_business_items").insert({ business_id: business.id, kind: plan.itemKind, name: draft.name.trim(), price_kes: draft.price ? Number(draft.price) : null, note: draft.note.trim() || null, image_path, sort: items.length });
      if (error) throw new Error(error.message);
      setDraft({ name: "", price: "", note: "" }); await loadItems();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add"); } finally { setBusy(false); }
  };
  const patchItem = async (id: string, patch: Partial<LocalItem>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
    const { error } = await supabase!.from("local_business_items").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const removeItem = async (id: string) => { await supabase!.from("local_business_items").delete().eq("id", id); void loadItems(); };
  const setBooking = async (id: string, status: string) => { await supabase!.from("local_bookings").update({ status }).eq("id", id); void loadBookings(); };

  const field = (key: keyof typeof form, text: string, area = false) => <label style={{ display: "grid", gap: 3, fontSize: ".62rem", color: "#94a3b8" }}>{text}{area ? <textarea className="finput" rows={3} value={form[key]} onChange={event => set(key, event.target.value)} /> : <input className="finput" value={form[key]} onChange={event => set(key, event.target.value)} />}</label>;
  const box: React.CSSProperties = { border: "1px solid #ffffff1f", borderRadius: 14, padding: 12, background: "#ffffff0a", marginTop: 12 };

  return createPortal(<div style={{ position: "fixed", inset: 0, zIndex: 9992, background: "#070b17", color: "#f8fafc", overflowY: "auto" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 14px calc(40px + env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn btn-ghost" style={{ padding: "6px 11px", fontSize: ".62rem" }} onClick={onClose}><ArrowLeft size={12} /> Back</button>
        <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={15} /></button></div>
      <h1 style={{ margin: "10px 0 2px", fontSize: "1.2rem" }}>Edit: {business.name}</h1>
      <small style={{ color: "#fbbf24" }}>{plan.label} · KES {plan.fee}/month</small>

      <div style={box}>
        <b style={{ fontSize: ".74rem" }}>Basics</b>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {field("name", "Business name")}{field("tagline", "One line about you (optional)")}{field("description", "About your business", true)}
          {field("hours", "Opening hours, e.g. Mon–Sat 8am–7pm")}{field("phone", "Phone")}{field("whatsapp", "WhatsApp")}{field("address", "Address / landmark")}
          {field("website", "Your website (optional). A button will send customers there")}{field("services", "Extra tags, separated by commas")}
        </div>
      </div>

      <div style={box}>
        <b style={{ fontSize: ".74rem" }}>Photos ({photos.length}/5)</b>
        <p style={{ margin: "3px 0 8px", fontSize: ".58rem", color: "#94a3b8" }}>The first photo is the one shown first on your page and in the search list.</p>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>{photos.map((path, index) => <span key={path} style={{ position: "relative", flexShrink: 0 }}><BizImg path={path} top style={{ width: 70, height: 70, borderRadius: 10 }} />
          <button aria-label="Remove" onClick={() => setPhotos(photos.filter((_, i) => i !== index))} style={{ position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: "50%", border: 0, background: "#dc2626", color: "#fff", cursor: "pointer" }}><X size={11} /></button></span>)}</div>
        <label className="btn btn-ghost" style={{ marginTop: 8, padding: 9, justifyContent: "center", cursor: "pointer" }}><ImagePlus size={14} /> Add a photo<input type="file" accept="image/*" hidden onChange={event => { void addPhoto(event.target.files?.[0]); event.target.value = ""; }} /></label>
      </div>

      <div style={box}>
        <b style={{ fontSize: ".74rem" }}>{plan.itemsWord} ({items.length}/{plan.maxItems})</b>
        <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
          {items.map(item => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr 74px auto", gap: 6, alignItems: "center" }}>
            {item.image_path ? <BizImg path={item.image_path} style={{ width: 44, height: 44, borderRadius: 8 }} /> : <span />}
            <input className="finput" style={{ padding: "7px 8px", fontSize: ".7rem" }} defaultValue={item.name} onBlur={event => event.target.value !== item.name && void patchItem(item.id, { name: event.target.value })} />
            <input className="finput" inputMode="decimal" style={{ padding: "7px 8px", fontSize: ".7rem" }} defaultValue={item.price_kes ?? ""} placeholder="KES" onBlur={event => void patchItem(item.id, { price_kes: event.target.value ? Number(event.target.value) : null })} />
            <span style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost" style={{ padding: "5px 7px", fontSize: ".55rem" }} onClick={() => void patchItem(item.id, { in_stock: !item.in_stock })}>{item.in_stock ? "In stock" : "Out"}</button>
              <button aria-label="Delete" className="btn btn-ghost" style={{ padding: "5px 7px" }} onClick={() => void removeItem(item.id)}><Trash2 size={12} /></button></span>
          </div>)}
        </div>
        {items.length < plan.maxItems && <div style={{ display: "grid", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid #ffffff1f" }}>
          <input className="finput" placeholder={plan.itemKind === "service" ? "Service name, e.g. Haircut" : plan.itemKind === "medicine" ? "Medicine name, e.g. Paracetamol 500mg" : "Product name, e.g. Sukuma wiki bunch"} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 6 }}><input className="finput" inputMode="decimal" placeholder="Price KES" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} /><input className="finput" placeholder="Note (optional)" value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button className="btn btn-ready" style={{ justifyContent: "center", padding: 9 }} disabled={busy} onClick={() => void addItem()}><Plus size={14} /> Add</button>
            <label className="btn btn-ghost" style={{ justifyContent: "center", padding: 9, cursor: "pointer" }}><ImagePlus size={14} /> Add with photo<input type="file" accept="image/*" hidden onChange={event => { void addItem(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
        </div>}
      </div>

      {plan.bookings && <div style={box}><b style={{ fontSize: ".74rem" }}>Booking requests</b>
        {!bookings.length && <p style={{ margin: "6px 0 0", fontSize: ".62rem", color: "#94a3b8" }}>None yet.</p>}
        {bookings.map(booking => <div key={booking.id} style={{ marginTop: 8, padding: 8, borderRadius: 10, background: "#ffffff0d", fontSize: ".66rem" }}>
          <b>{booking.name}</b> · <a href={`tel:${booking.phone}`} style={{ color: "#fbbf24" }}>{booking.phone}</a><br />
          {booking.service ?? "Any service"}{booking.wanted_at ? ` · ${new Date(booking.wanted_at).toLocaleString()}` : ""}{booking.note ? ` · ${booking.note}` : ""}
          <div style={{ display: "flex", gap: 6, marginTop: 5, alignItems: "center" }}><small style={{ color: "#94a3b8" }}>{booking.status}</small>
            {booking.status === "new" && <><button className="btn btn-go" style={{ padding: "3px 9px", fontSize: ".58rem" }} onClick={() => void setBooking(booking.id, "confirmed")}>Confirm</button><button className="btn btn-ghost" style={{ padding: "3px 9px", fontSize: ".58rem" }} onClick={() => void setBooking(booking.id, "declined")}>Decline</button></>}</div>
        </div>)}</div>}

      <button className="btn btn-go" style={{ width: "100%", justifyContent: "center", padding: 13, marginTop: 14 }} disabled={busy} onClick={() => void saveDetails()}><Save size={14} /> {busy ? "Working…" : "Save page"}</button>
    </div>
  </div>, document.body);
}
