import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { toast } from "sonner";
import { CalendarCheck, Clock, FileImage, Globe, MapPin, MessageCircle, Pencil, Phone, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { localCategoryIcon, LOCAL_CATEGORIES } from "@/lib/placeIcons";
import { planOf, type LocalBusiness, type LocalItem } from "@/lib/localPlans";
import { BizImg } from "@/lib/bizImages";
import PosterModal from "@/components/PosterModal";
import { bizImageUrl, swapExt } from "@/lib/bizImages";

const label = (id: string) => LOCAL_CATEGORIES.find(item => item.id === id)?.label ?? id;

/** One scrollable page for a business. Text is real text (always sharp). The old poster is one tap away. */
export default function BusinessPage({ business, onClose, onEdit, children }: { business: LocalBusiness; onClose: () => void; onEdit?: () => void; children?: ReactNode }) {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const plan = planOf(business.category);
  const Icon = localCategoryIcon(business.category);
  const [full, setFull] = useState<LocalBusiness>(business);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [query, setQuery] = useState("");
  const [poster, setPoster] = useState(false);
  const [book, setBook] = useState<{ service: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.from("local_businesses").select("*").eq("id", business.id).maybeSingle().then(({ data }) => { if (data) setFull({ ...business, ...(data as LocalBusiness) }); });
    void supabase.from("local_business_items").select("*").eq("business_id", business.id).order("sort").order("name").then(({ data }) => setItems((data ?? []) as LocalItem[]));
  }, [business.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !poster) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [onClose, poster]);

  const shown = useMemo(() => items.filter(item => !query.trim() || `${item.name} ${item.note ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);
  const photos = full.image_paths.slice(0, 3);
  const wa = (full.whatsapp || full.phone || "").replace(/\D/g, "");
  const ask = encodeURIComponent(`Hello ${full.name}, I found you on Ma3 and would like to ask about: `);
  const section: React.CSSProperties = { margin: "18px 0 0" };
  const heading: React.CSSProperties = { margin: "0 0 8px", fontSize: ".72rem", fontWeight: 800, letterSpacing: ".04em", color: "#94a3b8", textTransform: "uppercase" };

  return createPortal(<div role="dialog" aria-modal="true" aria-label={full.name} style={{ position: "fixed", inset: 0, zIndex: 9990, background: "#070b17", color: "#f8fafc", overflowY: "auto", overscrollBehavior: "contain" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: "calc(40px + env(safe-area-inset-bottom))" }}>
      <button aria-label="Close" onClick={onClose} style={{ position: "fixed", top: "max(14px, env(safe-area-inset-top))", right: 14, zIndex: 3, width: 42, height: 42, borderRadius: "50%", border: "1px solid #ffffff55", background: "#0b1530cc", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={20} /></button>
      {onEdit && <button onClick={onEdit} style={{ position: "fixed", top: "max(14px, env(safe-area-inset-top))", right: 66, zIndex: 3, height: 42, padding: "0 14px", borderRadius: 99, border: "1px solid #fbbf24", background: "#0b1530cc", color: "#fbbf24", display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontWeight: 800, fontSize: ".7rem" }}><Pencil size={14} /> Edit page</button>}

      {/* photos */}
      <div style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", background: "linear-gradient(135deg,#0b1530,#1d4ed8)" }}>
        {photos.length ? photos.map((path, index) => <div key={path} style={{ flex: "0 0 100%", scrollSnapAlign: "start", height: 250 }}><BizImg path={path} top={index === 0} style={{ width: "100%", height: "100%" }} fallback={<div style={{ height: "100%", display: "grid", placeItems: "center" }}><Icon size={54} color="#fff" /></div>} /></div>) : <div style={{ flex: "0 0 100%", height: 200, display: "grid", placeItems: "center" }}><Icon size={54} color="#fff" /></div>}
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        <small style={{ color: "#fbbf24", fontWeight: 800, display: "inline-flex", gap: 5, alignItems: "center" }}><Icon size={13} /> {label(full.category)}{business.distance_km != null ? ` · ${business.distance_km.toFixed(1)} km away` : ""}</small>
        <h1 style={{ margin: "4px 0 4px", fontFamily: "var(--font-display)", fontSize: "1.55rem", lineHeight: 1.15 }}>{full.name}</h1>
        {full.tagline && <p style={{ margin: "0 0 8px", color: "#cbd5e1", fontSize: ".85rem" }}>{full.tagline}</p>}
        {full.hours && <p style={{ margin: "0 0 8px", display: "flex", gap: 6, alignItems: "center", fontSize: ".74rem", color: "#86efac" }}><Clock size={13} /> {full.hours}</p>}
        {full.address && <p style={{ margin: 0, display: "flex", gap: 6, alignItems: "center", fontSize: ".74rem", color: "#cbd5e1" }}><MapPin size={13} /> {full.address}</p>}

        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {full.phone && <a className="btn btn-go" style={{ padding: 11, textDecoration: "none", display: "flex", justifyContent: "center", gap: 6 }} href={`tel:${full.phone}`}><Phone size={14} /> Call {full.phone}</a>}
          {wa && <a className="btn btn-ready" style={{ padding: 11, textDecoration: "none", display: "flex", justifyContent: "center", gap: 6 }} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${wa}?text=${ask}`}><MessageCircle size={14} /> WhatsApp</a>}
          {full.website && <a className="btn btn-ghost" style={{ padding: 11, textDecoration: "none", display: "flex", justifyContent: "center", gap: 6 }} target="_blank" rel="noopener noreferrer" href={/^https?:\/\//.test(full.website) ? full.website : `https://${full.website}`}><Globe size={14} /> Visit website</a>}
        </div>

        {full.description && <section style={section}><h2 style={heading}>About</h2><p style={{ margin: 0, fontSize: ".82rem", lineHeight: 1.6, color: "#e2e8f0" }}>{full.description}</p></section>}
        {!!full.services.length && <section style={section}><h2 style={heading}>Also</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{full.services.map(text => <span key={text} style={{ border: "1px solid #ffffff2e", borderRadius: 99, padding: "4px 10px", fontSize: ".7rem" }}>{text}</span>)}</div></section>}

        {/* items */}
        <section style={section}>
          <h2 style={heading}>{plan.itemsWord}</h2>
          {!items.length && <p style={{ margin: 0, fontSize: ".72rem", color: "#94a3b8" }}>The owner has not added anything here yet.</p>}
          {items.length > 5 && <div style={{ position: "relative", marginBottom: 8 }}><Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#fbbf24" }} /><input className="finput" style={{ paddingLeft: 32 }} placeholder={`Search ${plan.itemsWord.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} /></div>}
          <div style={{ display: "grid", gap: 8 }}>{shown.map(item => <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "center", border: "1px solid #ffffff1f", borderRadius: 14, padding: 8, background: "#ffffff0a", opacity: item.in_stock ? 1 : .55 }}>
            {item.image_path ? <BizImg path={item.image_path} style={{ width: plan.maxItems <= 3 ? 84 : 56, height: plan.maxItems <= 3 ? 84 : 56, borderRadius: 11, flexShrink: 0 }} /> : null}
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".82rem" }}>{item.name}</b>{item.note && <small style={{ color: "#94a3b8" }}>{item.note}</small>}{!item.in_stock && <small style={{ display: "block", color: "#f87171" }}>Out of stock</small>}</div>
            <div style={{ textAlign: "right" }}>{item.price_kes != null && <b style={{ fontFamily: "var(--font-mono)", color: "#fbbf24", fontSize: ".82rem" }}>KES {Number(item.price_kes).toLocaleString()}</b>}
              {plan.bookings && <button className="btn btn-ready" style={{ display: "block", marginTop: 4, padding: "4px 10px", fontSize: ".6rem" }} onClick={() => setBook({ service: item.name })}>Book</button>}</div>
          </div>)}</div>
        </section>

        {plan.bookings && <section style={section}><h2 style={heading}>Booking</h2><button className="btn btn-ready" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={() => setBook({ service: "" })}><CalendarCheck size={14} /> Book an appointment</button></section>}

        <section style={{ ...section, display: "grid", gap: 8 }}>
          {children}
          {!!business.image_paths.length && <button className="btn btn-ghost" style={{ justifyContent: "center", padding: 10 }} onClick={() => setPoster(true)}><FileImage size={14} /> View full poster</button>}
          <p style={{ margin: "6px 0 0", fontSize: ".58rem", color: "#94a3b8", lineHeight: 1.5 }}>Ma3 does not take payment for local businesses. You order and pay the seller directly.</p>
        </section>
      </div>
    </div>

    {poster && <PosterModal poster={{ id: `${full.id}-poster`, title: full.name, imageUrls: business.image_paths.length ? [bizImageUrl(business.image_paths[0]), bizImageUrl(swapExt(business.image_paths[0]))] : undefined, icon: Icon, facts: [] }} onClose={() => setPoster(false)} />}
    {book && <BookingForm business={full} service={book.service} items={items} signedIn={signedIn} onClose={() => setBook(null)} />}
  </div>, document.body);
}

function BookingForm({ business, service, items, signedIn, onClose }: { business: LocalBusiness; service: string; items: LocalItem[]; signedIn: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", service, when: "", note: "" });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const send = async () => {
    if (!supabase) return;
    if (form.name.trim().length < 2 || form.phone.replace(/\D/g, "").length < 9) return void toast.error("Enter your name and a phone number.");
    setBusy(true);
    const { error } = await supabase.from("local_bookings").insert({ business_id: business.id, name: form.name.trim(), phone: form.phone.trim(), service: form.service || null, wanted_at: form.when ? new Date(form.when).toISOString() : null, note: form.note.trim() || null });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Request sent. The business will confirm by phone."); onClose();
  };
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9995, background: "rgba(2,6,16,.78)", display: "grid", placeItems: "end center" }}>
    <div onClick={event => event.stopPropagation()} style={{ width: "min(100%, 520px)", maxHeight: "90dvh", overflowY: "auto", background: "#0a0e1c", border: "1px solid #ffffff2e", borderRadius: "20px 20px 0 0", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>Book at {business.name}</b><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={15} /></button></div>
      {!signedIn ? <p style={{ fontSize: ".74rem", margin: "12px 0" }}><Link href="/login" style={{ color: "#fbbf24" }}>Sign in</Link> first, so the business can reach you.</p> : <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        <input className="finput" placeholder="Your name" value={form.name} onChange={event => set("name", event.target.value)} />
        <input className="finput" inputMode="tel" placeholder="Phone (07…)" value={form.phone} onChange={event => set("phone", event.target.value)} />
        <select className="finput" value={form.service} onChange={event => set("service", event.target.value)}><option value="">Service (optional)</option>{items.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select>
        <input className="finput" type="datetime-local" value={form.when} onChange={event => set("when", event.target.value)} />
        <textarea className="finput" rows={3} placeholder="Anything they should know" value={form.note} onChange={event => set("note", event.target.value)} />
        <button className="btn btn-go" style={{ justifyContent: "center", padding: 11 }} disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : "Send request"}</button>
      </div>}
    </div>
  </div>;
}
