import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { vehicleElement } from "@/lib/vehicleIcons";
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
        const el = vehicleElement(d.kind === "boda" ? "boda" : "car", { label: `Demo ${d.kind} ${d.plate}` });
        const pop = new maplibregl.Popup({ offset: 14, closeButton: false }).setText(`DEMO ${d.kind} · ${d.plate} · practice driver, not a real trip`);
        return new maplibregl.Marker({ element: el }).setLngLat([d.lon, d.lat]).setPopup(pop).addTo(map);
      });
    })();
    return () => { dead = true; markers.current.forEach(m => m.remove()); markers.current = []; };
  }, [map]);
  return null;
}
