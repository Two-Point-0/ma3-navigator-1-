import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Practice Ndai cars and bodas around town so the Ndai map is never empty. Real drivers replace these later. */
export default function DemoRidersLayer({ map }: { map: maplibregl.Map | null }) {
  const markers = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    if (!map || !supabase || !isSupabaseConfigured) return;
    let dead = false;
    void (async () => {
      const { data } = await supabase!.from("demo_vehicles").select("id,kind,plate,label,seats_total,lat,lon").in("kind", ["car", "boda"]);
      if (dead || !data) return;
      markers.current = data.filter((d: any) => d.lat != null && d.lon != null).map((d: any) => {
        const el = document.createElement("div");
        el.textContent = d.kind === "boda" ? "BODA" : "CAR";
        el.style.cssText = `background:${d.kind === "boda" ? "#16a34a" : "#d97706"};color:#fff;border:2px dashed #fde68a;border-radius:99px;padding:4px 8px;font:800 10px system-ui;box-shadow:0 2px 10px #000a`;
        const pop = new maplibregl.Popup({ offset: 14, closeButton: false }).setText(`DEMO ${d.kind} · ${d.plate} · practice driver, not a real trip`);
        return new maplibregl.Marker({ element: el }).setLngLat([d.lon, d.lat]).setPopup(pop).addTo(map);
      });
    })();
    return () => { dead = true; markers.current.forEach(m => m.remove()); markers.current = []; };
  }, [map]);
  return null;
}
