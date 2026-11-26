import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { toast } from "sonner";
import { Radio, Compass } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { iconMarker } from "@/lib/placeIcons";
import { Bus } from "lucide-react";

type Van = { id: string; name: string };

/** Driver side: pick one of your paid tour listings and show it live while you are driving. Nothing is stored except the latest point. */
export function TourVanLive() {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [vans, setVans] = useState<Van[]>([]);
  const [vanId, setVanId] = useState("");
  const [live, setLive] = useState(false);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!supabase || !signedIn || !user) return;
    void (async () => {
      const { data } = await supabase!.from("local_businesses").select("id,name").eq("owner_id", user.id).eq("category", "tours").eq("status", "active");
      setVans(data ?? []); if (data?.[0]) setVanId(data[0].id);
    })();
  }, [signedIn, user?.id]);

  const stop = async () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null; setLive(false);
    if (supabase && vanId) await supabase.from("tour_van_live").delete().eq("business_id", vanId);
  };
  useEffect(() => () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); }, []);

  const start = () => {
    if (!supabase || !user || !vanId) return;
    if (!navigator.geolocation) { toast.error("This phone cannot share its location."); return; }
    watch.current = navigator.geolocation.watchPosition(async position => {
      if (Date.now() - lastSent.current < 10000) return;
      lastSent.current = Date.now();
      const { error } = await supabase!.from("tour_van_live").upsert({ business_id: vanId, owner_id: user.id, latitude: position.coords.latitude, longitude: position.coords.longitude, last_seen: new Date().toISOString() });
      if (error) toast.error(error.message);
    }, () => toast.error("Allow location to go live."), { enableHighAccuracy: true, maximumAge: 5000 });
    setLive(true);
  };

  if (!isSupabaseConfigured) return <div className="ios-glass" style={{ padding: 14, fontSize: ".7rem", color: "var(--muted2)" }}>Connect Supabase to go live.</div>;
  if (!signedIn) return <div className="ios-glass" style={{ padding: 14, fontSize: ".7rem", color: "var(--muted2)" }}>Sign in with Google or phone to list and show your tour van.</div>;
  return <section className="ios-glass" style={{ padding: 14, display: "grid", gap: 9 }}>
    <b style={{ display: "flex", gap: 7, alignItems: "center", fontSize: ".8rem" }}><Compass size={15} style={{ color: "var(--ready)" }} />Tour van live location</b>
    {vans.length === 0 ? <p style={{ fontSize: ".66rem", color: "var(--muted2)", lineHeight: 1.5, margin: 0 }}>No active tour listing. Open Ndai, then Tours, then Register.</p> : <>
      <select className="finput" value={vanId} onChange={event => setVanId(event.target.value)} disabled={live}>{vans.map(van => <option key={van.id} value={van.id}>{van.name}</option>)}</select>
      {live ? <button className="btn btn-stop" onClick={() => void stop()}><Radio size={13} /> Stop showing my van</button> : <button className="btn btn-go" onClick={start}><Radio size={13} /> Go live</button>}
      <small style={{ color: "var(--muted2)", lineHeight: 1.45 }}>Travellers see your van only while you are live. No history is kept.</small>
    </>}
  </section>;
}

/** Rider side: draws live tour vans on the Ndai map. */
export function TourVanLayer({ map, active }: { map: maplibregl.Map | null; active: boolean }) {
  const markers = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    if (!map || !active || !supabase) return;
    let alive = true;
    const draw = async () => {
      const { data: live } = await supabase!.from("tour_van_live").select("business_id,latitude,longitude");
      if (!alive || !live) return;
      const { data: names } = live.length ? await supabase!.from("local_businesses").select("id,name").in("id", live.map(row => row.business_id)) : { data: [] };
      markers.current.forEach(marker => marker.remove());
      markers.current = live.map(row => iconMarker(map, row.latitude, row.longitude, Bus, "#16a34a", `${names?.find(item => item.id === row.business_id)?.name ?? "Tour van"} · live`, undefined, { size: 34, label: names?.find(item => item.id === row.business_id)?.name }));
    };
    void draw();
    const timer = window.setInterval(() => void draw(), 10000);
    return () => { alive = false; window.clearInterval(timer); markers.current.forEach(marker => marker.remove()); markers.current = []; };
  }, [map, active]);
  return null;
}
