import { useEffect, useRef, useState } from "react";
import { hideSheets, showSheets } from "@/lib/useSheet";
import { Link, useLocation } from "wouter";
import maplibregl from "maplibre-gl";
import { toast } from "sonner";
import { ArrowLeft, Bus, Car, Check, ImagePlus, LocateFixed, MapPin, MessageCircle, Navigation, Phone, PlusCircle, Search, Store, Trash2, X } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { APP_MODE } from "@/lib/appMode";
import { LOCAL_CATEGORIES, iconMarker, localCategoryIcon } from "@/lib/placeIcons";

/** Placeholder fee until you decide the real price. It is only shown, nothing is charged while payments are in demo mode. */
export const LOCAL_LISTING_FEE_KES = 50;

type Business = {
  id: string; name: string; category: string; description: string; services: string[]; phone: string | null; whatsapp: string | null;
  address: string | null; latitude: number; longitude: number; image_paths: string[]; distance_km?: number | null;
  status?: string; paid_until?: string | null;
};
type Mode = "choose" | "shop" | "register" | "mine";
type Coords = { latitude: number; longitude: number };

const imageUrl = (path: string) => supabase!.storage.from("business-images").getPublicUrl(path).data.publicUrl;
const categoryLabel = (id: string) => LOCAL_CATEGORIES.find(item => item.id === id)?.label ?? id;

function cleanPhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.startsWith("254")) return `+${digits}`;
  return digits;
}

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not read that photo")), "image/jpeg", 0.82));
}

export default function LocalPanel({ map, userLocation, requestLocation, fixedCategory }: { map: maplibregl.Map | null; userLocation: Coords | null; requestLocation: () => void; fixedCategory?: string }) {
  const { user } = useAuthContext();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("choose");
  const signedIn = Boolean(user && !user.is_anonymous);

  // ---- shop ----
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(fixedCategory ?? "");
  const [results, setResults] = useState<Business[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Business | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (mode !== "shop" || !supabase) return;
    if (!query.trim() && !category) { setResults(null); return; } // nothing is searched or pinned until the person asks
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase!.rpc("search_local_businesses", { p_query: query, p_category: category || null, p_lat: userLocation?.latitude ?? null, p_lon: userLocation?.longitude ?? null, p_limit: 40 });
      setSearching(false);
      if (error) { toast.error("Could not search businesses. Has the latest database update been applied?"); setResults([]); return; }
      setResults((data ?? []) as Business[]);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [mode, query, category, userLocation]);

  useEffect(() => {
    markers.current.forEach(marker => marker.remove()); markers.current = [];
    if (!map || mode !== "shop" || !results?.length) return;
    markers.current = results.map(item => iconMarker(map, item.latitude, item.longitude, localCategoryIcon(item.category), selected?.id === item.id ? "#16a34a" : "#d97706", item.name, () => setSelected(item), { label: item.name }));
    if (!selected) {
      const lons = results.map(item => item.longitude), lats = results.map(item => item.latitude);
      if (results.length === 1) map.easeTo({ center: [lons[0], lats[0]], zoom: 15, duration: 600 });
      else map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: { top: 90, left: 40, right: 40, bottom: 330 }, maxZoom: 15, duration: 700 });
    }
    return () => { markers.current.forEach(marker => marker.remove()); markers.current = []; };
  }, [map, mode, results, selected]);

  // ---- register ----
  const [mine, setMine] = useState<Business[]>([]);
  const loadMine = async () => {
    if (!supabase || !signedIn) return;
    const { data } = await supabase.from("local_businesses").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
    setMine((data ?? []) as Business[]);
  };
  useEffect(() => { if (mode === "mine") void loadMine(); }, [mode, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const blank = { name: "", category: fixedCategory ?? "mboga", description: "", services: "", phone: "", whatsapp: "", address: "", licence: "" };
  const [form, setForm] = useState(blank);
  const [spot, setSpot] = useState<Coords | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const spotMarker = useRef<maplibregl.Marker | null>(null);
  const set = (key: keyof typeof blank, value: string) => setForm(current => ({ ...current, [key]: value }));

  useEffect(() => {
    spotMarker.current?.remove(); spotMarker.current = null;
    if (map && mode === "register" && spot) spotMarker.current = iconMarker(map, spot.latitude, spot.longitude, localCategoryIcon(form.category), "#dc2626", "Your business location");
    return () => { spotMarker.current?.remove(); spotMarker.current = null; };
  }, [map, mode, spot, form.category]);

  const pickOnMap = () => {
    if (!map) return;
    setPicking(true); hideSheets(); toast("Tap the exact spot of your business on the map.");
    map.getCanvas().style.cursor = "crosshair";
    map.once("click", event => { setSpot({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }); setPicking(false); showSheets(); map.getCanvas().style.cursor = ""; });
  };
  const useMyLocation = () => {
    if (userLocation) { setSpot(userLocation); map?.easeTo({ center: [userLocation.longitude, userLocation.latitude], zoom: 16 }); return; }
    requestLocation(); toast("Allow location, then tap this button again.");
  };

  const submit = async () => {
    if (!supabase || !signedIn) return;
    const phone = cleanPhone(form.phone);
    if (form.name.trim().length < 2) return void toast.error("Enter the business name.");
    if (form.description.trim().length < 10) return void toast.error("Describe what you sell or do (at least 10 letters).");
    if (!/^\+?\d{9,15}$/.test(phone)) return void toast.error("Enter a phone number customers can call.");
    const needsLicence = form.category === "tours" || form.category === "transport";
    if (needsLicence && form.licence.trim().length < 4) return void toast.error("Tour and transport businesses must give their licence number (for example TRA or NTSA).");
    if (!spot) return void toast.error("Pin your business on the map first.");
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const paths: string[] = [];
      for (let i = 0; i < Math.min(5, photos.length); i++) {
        const blob = await shrink(photos[i]);
        const path = `${user!.id}/${id}/${i + 1}.jpg`;
        const { error } = await supabase.storage.from("business-images").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (error) throw new Error(`Photo ${i + 1} failed: ${error.message}`);
        paths.push(path);
      }
      const { error } = await supabase.from("local_businesses").insert({
        id, name: form.name.trim(), category: form.category, description: form.description.trim(), phone, whatsapp: form.whatsapp ? cleanPhone(form.whatsapp) : null,
        services: form.services.split(",").map(item => item.trim()).filter(Boolean).slice(0, 20), address: form.address.trim() || null, licence_no: needsLicence ? form.licence.trim() : null,
        latitude: spot.latitude, longitude: spot.longitude, image_paths: paths });
      if (error) throw new Error(error.message);
      toast.success("Business saved. Pay the listing fee to make it visible.");
      setForm(blank); setSpot(null); setPhotos([]); setMode("mine");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the business."); }
    finally { setSaving(false); }
  };

  const activate = async (item: Business) => {
    const { error } = await supabase!.rpc("activate_local_business_demo", { p_id: item.id });
    if (error) return void toast.error(error.message);
    toast.success(`${item.name} is live for 30 days (demo payment).`); void loadMine();
  };
  const remove = async (item: Business) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    const { error } = await supabase!.from("local_businesses").delete().eq("id", item.id);
    if (error) return void toast.error(error.message);
    void loadMine();
  };

  const back = (to: Mode) => <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: ".6rem", marginBottom: 9 }} onClick={() => { setMode(to); setSelected(null); }}><ArrowLeft size={12} /> Back</button>;
  if (!isSupabaseConfigured) return <p style={{ color: "var(--muted2)", fontSize: ".66rem" }}>Local businesses need the Supabase backend. Add the two Supabase settings to .env.local.</p>;

  // ---- choose ----
  if (mode === "choose") return <div style={{ display: "grid", gap: 9 }}>
    <button className="card" style={{ padding: 14, textAlign: "left", color: "var(--white)", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }} onClick={() => setMode("shop")}>
      <Search size={22} style={{ color: "var(--ready)" }} /><span><b style={{ display: "block", fontSize: ".8rem" }}>Shop</b><small style={{ color: "var(--muted2)" }}>Find mama mboga, salons, mechanics and more near you</small></span></button>
    <button className="card" style={{ padding: 14, textAlign: "left", color: "var(--white)", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }} onClick={() => setMode("register")}>
      <Store size={22} style={{ color: "var(--go)" }} /><span><b style={{ display: "block", fontSize: ".8rem" }}>Register your business</b><small style={{ color: "var(--muted2)" }}>Pin it on the map with photos and a one-page listing. You can register more than one.</small></span></button>
    {signedIn && <button className="btn btn-ghost" style={{ justifyContent: "center", padding: 9, fontSize: ".66rem" }} onClick={() => setMode("mine")}>My businesses</button>}
  </div>;

  // ---- shop: business page ----
  if (mode === "shop" && selected) {
    const wa = (selected.whatsapp || selected.phone || "").replace(/\D/g, "");
    const message = encodeURIComponent(`Hello ${selected.name}, I found you on Ma3 and would like to order / ask about: `);
    return <div>
      {back("shop")}
      {selected.image_paths.length > 0 && <div style={{ display: "grid", gridTemplateColumns: selected.image_paths.length === 1 ? "1fr" : "repeat(2,1fr)", gap: 5, marginBottom: 10 }}>
        {selected.image_paths.map((path, index) => <img key={path} src={imageUrl(path)} alt={`${selected.name} photo ${index + 1}`} loading="lazy" style={{ width: "100%", height: index === 0 && selected.image_paths.length % 2 === 1 ? 170 : 110, objectFit: "cover", borderRadius: 11, gridColumn: index === 0 && selected.image_paths.length % 2 === 1 ? "1 / -1" : undefined }} />)}
      </div>}
      <p style={{ fontFamily: "var(--font-display)", fontSize: ".95rem", fontWeight: 900, margin: 0 }}>{selected.name}</p>
      <p style={{ margin: "3px 0 8px", fontSize: ".62rem", color: "var(--ready)" }}>{categoryLabel(selected.category)}{selected.distance_km != null ? ` · ${selected.distance_km.toFixed(1)} km away` : ""}</p>
      <p style={{ fontSize: ".7rem", lineHeight: 1.55 }}>{selected.description}</p>
      {selected.services.length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "8px 0" }}>{selected.services.map(item => <span key={item} className="chip" style={{ background: "var(--glass2)", border: "1px solid var(--border2)" }}>{item}</span>)}</div>}
      {selected.address && <p style={{ fontSize: ".62rem", color: "var(--muted2)" }}><MapPin size={11} /> {selected.address}</p>}
      <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
        {selected.phone && <a className="btn btn-go" style={{ padding: 10, textDecoration: "none" }} href={`tel:${selected.phone}`}><Phone size={13} /> Call {selected.phone}</a>}
        {wa && <a className="btn btn-ready" style={{ padding: 10, textDecoration: "none" }} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${wa}?text=${message}`}><MessageCircle size={13} /> Order on WhatsApp</a>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <button className="btn btn-ghost" style={{ padding: 9, fontSize: ".64rem" }} onClick={() => { sessionStorage.setItem("ma3_destination", JSON.stringify({ name: selected.name, lat: selected.latitude, lon: selected.longitude })); setLocation("/ma3"); }}><Bus size={12} /> Go by Ma3</button>
          <button className="btn btn-ghost" style={{ padding: 9, fontSize: ".64rem" }} onClick={() => { sessionStorage.setItem("ndai_destination", JSON.stringify({ tab: "ride", name: selected.name, lat: selected.latitude, lon: selected.longitude })); setLocation("/ndai"); }}><Car size={12} /> Go by Ndai</button>
        </div>
        <a className="btn btn-ghost" style={{ padding: 9, fontSize: ".64rem", textDecoration: "none" }} target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}><Navigation size={12} /> Directions in Google Maps</a>
      </div>
      <p style={{ marginTop: 8, fontSize: ".55rem", color: "var(--muted2)", lineHeight: 1.45 }}>Ma3 does not take payment for local businesses. You order and pay the seller directly.</p>
    </div>;
  }

  // ---- shop: search ----
  if (mode === "shop") return <div>
    {back("choose")}
    <div style={{ position: "relative" }}><Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} />
      <input className="finput" style={{ paddingLeft: 32 }} placeholder="Search: mboga, salon, mechanic, maize flour…" value={query} onChange={event => setQuery(event.target.value)} /></div>
    {!fixedCategory && <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 0" }}>
      <button className={`btn ${category === "" ? "btn-ready" : "btn-ghost"}`} style={{ padding: "5px 11px", fontSize: ".6rem", flexShrink: 0 }} onClick={() => setCategory("")}>All</button>
      {LOCAL_CATEGORIES.map(({ id, label, Icon }) => <button key={id} className={`btn ${category === id ? "btn-ready" : "btn-ghost"}`} style={{ padding: "5px 11px", fontSize: ".6rem", flexShrink: 0 }} onClick={() => setCategory(category === id ? "" : id)}><Icon size={12} /> {label.split(" / ")[0]}</button>)}
    </div>}
    <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: ".6rem", marginBottom: 8 }} onClick={requestLocation}><LocateFixed size={12} /> {userLocation ? "Nearest first (location on)" : "Use my location to sort by nearest"}</button>
    {results === null && <p style={{ fontSize: ".64rem", color: "var(--muted2)", lineHeight: 1.5 }}>Type what you need, or tap a category. Matching businesses appear on the map.</p>}
    {searching && <p style={{ fontSize: ".62rem", color: "var(--muted2)" }}>Searching…</p>}
    {results && !searching && results.length === 0 && <p style={{ fontSize: ".64rem", color: "var(--muted2)" }}>No registered business matches yet. Know someone who sells this? Ask them to register on Local.</p>}
    {results?.map(item => { const Icon = localCategoryIcon(item.category); return <button key={item.id} className="card" onClick={() => { setSelected(item); map?.easeTo({ center: [item.longitude, item.latitude], zoom: 16, duration: 600 }); }} style={{ width: "100%", padding: 10, marginBottom: 7, display: "flex", gap: 10, alignItems: "center", textAlign: "left", color: "var(--white)", cursor: "pointer" }}>
      {item.image_paths[0] ? <img src={imageUrl(item.image_paths[0])} alt="" loading="lazy" style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover" }} /> : <span style={{ width: 46, height: 46, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--glass2)" }}><Icon size={20} style={{ color: "var(--ready)" }} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".72rem" }}>{item.name}</b><small style={{ color: "var(--muted2)" }}>{categoryLabel(item.category)}{item.distance_km != null ? ` · ${item.distance_km.toFixed(1)} km` : ""}</small></span></button>; })}
  </div>;

  // ---- my businesses ----
  if (mode === "mine") return <div>
    {back("choose")}
    {!signedIn && <p style={{ fontSize: ".66rem" }}><Link href="/login" style={{ color: "var(--ready)" }}>Sign in</Link> to see your businesses.</p>}
    {signedIn && mine.length === 0 && <p style={{ fontSize: ".66rem", color: "var(--muted2)" }}>You have not registered a business yet.</p>}
    {mine.map(item => { const live = item.status === "active" && item.paid_until && new Date(item.paid_until) > new Date(); return <div key={item.id} className="card" style={{ padding: 11, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: ".74rem" }}>{item.name}</b>
        <span className="chip" style={{ background: live ? "rgba(22,163,74,.18)" : "rgba(217,119,6,.18)", color: live ? "var(--go)" : "var(--ready)" }}>{live ? `Live until ${new Date(item.paid_until!).toLocaleDateString()}` : "Awaiting payment"}</span></div>
      <small style={{ color: "var(--muted2)" }}>{categoryLabel(item.category)}</small>
      <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
        <button className="btn btn-go" style={{ padding: "7px 11px", fontSize: ".62rem" }} onClick={() => activate(item)}><Check size={12} /> {live ? "Renew" : "Pay"} KES {LOCAL_LISTING_FEE_KES}{APP_MODE.realPayments ? "" : " (demo)"}</button>
        <button className="btn btn-ghost" style={{ padding: "7px 11px", fontSize: ".62rem" }} onClick={() => remove(item)}><Trash2 size={12} /> Delete</button></div>
    </div>; })}
    <button className="btn btn-ready" style={{ width: "100%", justifyContent: "center", padding: 10, marginTop: 4 }} onClick={() => setMode("register")}><PlusCircle size={14} /> Register another business</button>
    {!APP_MODE.realPayments && <p style={{ marginTop: 8, fontSize: ".55rem", color: "var(--muted2)", lineHeight: 1.45 }}>Payments are in demo mode: the Pay button switches the listing on for 30 days without charging. Real M-Pesa payment will replace it once it is tested.</p>}
  </div>;

  // ---- register ----
  return <div>
    {back("choose")}
    {!signedIn ? <div className="card" style={{ padding: 13 }}><p style={{ fontSize: ".7rem", margin: "0 0 8px" }}>Sign in with Google or your phone to register a business. Guests cannot, so that listings have a real owner.</p><Link href="/login" className="btn btn-go" style={{ padding: "9px 16px", textDecoration: "none" }}>Sign in</Link></div> : <>
      <p className="sec-label">About your business</p>
      <input className="finput" placeholder="Business name (e.g. Mama Njeri Veggies)" value={form.name} maxLength={80} onChange={event => set("name", event.target.value)} />
      <select className="finput" style={{ marginTop: 7 }} value={form.category} onChange={event => set("category", event.target.value)}>{LOCAL_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <textarea className="finput" style={{ marginTop: 7, minHeight: 78 }} placeholder="What do you sell or do? Opening hours, prices, delivery…" value={form.description} maxLength={1200} onChange={event => set("description", event.target.value)} />
      <input className="finput" style={{ marginTop: 7 }} placeholder="Services or items, separated by commas (tomatoes, onions, sukuma)" value={form.services} onChange={event => set("services", event.target.value)} />
      <p className="sec-label" style={{ marginTop: 12 }}>How customers reach you</p>
      <input className="finput" inputMode="tel" placeholder="Phone (07…)" value={form.phone} onChange={event => set("phone", event.target.value)} />
      <input className="finput" style={{ marginTop: 7 }} inputMode="tel" placeholder="WhatsApp (optional, if different)" value={form.whatsapp} onChange={event => set("whatsapp", event.target.value)} />
      {(form.category === "tours" || form.category === "transport") && <input className="finput" style={{ marginTop: 7 }} placeholder="Licence number (TRA tour licence or NTSA/PSV)" value={form.licence} maxLength={40} onChange={event => set("licence", event.target.value)} />}
      <input className="finput" style={{ marginTop: 7 }} placeholder="Landmark (e.g. next to Total petrol station)" value={form.address} maxLength={160} onChange={event => set("address", event.target.value)} />
      <p className="sec-label" style={{ marginTop: 12 }}>Pin your location</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        <button className="btn btn-ready" style={{ padding: 9, fontSize: ".62rem" }} onClick={useMyLocation}><LocateFixed size={12} /> I am here now</button>
        <button className={`btn ${picking ? "btn-go" : "btn-ghost"}`} style={{ padding: 9, fontSize: ".62rem" }} onClick={pickOnMap}><MapPin size={12} /> {picking ? "Tap the map…" : "Tap on the map"}</button></div>
      <p style={{ fontSize: ".58rem", color: spot ? "var(--go)" : "var(--muted2)", marginTop: 5 }}>{spot ? `Pinned at ${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)}` : "Not pinned yet. You can zoom the map first for accuracy."}</p>
      <p className="sec-label" style={{ marginTop: 12 }}>Photos (up to 5)</p>
      <label className="btn btn-ghost" style={{ padding: 10, cursor: "pointer", justifyContent: "center" }}><ImagePlus size={14} /> Choose photos ({photos.length}/5)
        <input type="file" accept="image/*" multiple hidden onChange={event => setPhotos(Array.from(event.target.files ?? []).slice(0, 5))} /></label>
      {photos.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 7, overflowX: "auto" }}>{photos.map((file, index) => <span key={file.name + index} style={{ position: "relative", flexShrink: 0 }}><img src={URL.createObjectURL(file)} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 9 }} /><button aria-label="Remove photo" onClick={() => setPhotos(photos.filter((_, i) => i !== index))} style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", border: 0, background: "var(--stop)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={10} /></button></span>)}</div>}
      <div className="card" style={{ padding: 11, marginTop: 12 }}><b style={{ fontSize: ".7rem" }}>Listing fee: KES {LOCAL_LISTING_FEE_KES} per month, per business</b>
        <p style={{ margin: "4px 0 0", fontSize: ".58rem", color: "var(--muted2)", lineHeight: 1.45 }}>You save first, then pay on the next screen. {APP_MODE.realPayments ? "Pay with M-Pesa." : "Payments are in demo mode, so nothing is charged yet."}</p></div>
      <button className="btn btn-go" style={{ width: "100%", justifyContent: "center", padding: 12, marginTop: 10 }} disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save and continue"}</button>
    </>}
  </div>;
}
