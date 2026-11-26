import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { vehicleElement } from "@/lib/vehicleIcons";
import { fetchDrivePath } from "@/lib/walkRoute";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Pt = [number, number]; // [lat, lon]
interface Rider { id: string; kind: "car" | "boda"; plate: string; label: string; marker: maplibregl.Marker; at: Pt; path: Pt[]; cum: number[]; dist: number; waitUntil: number; moving: boolean; busy: boolean }

const km = (a: Pt, b: Pt) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180));
const SPEED_KMH: Record<string, number> = { car: 150, boda: 190 }; // mock speed, fast enough to see on the map

/** Practice Ndai cars and bodas. Some drive along real roads, others wait for a ride. Real drivers replace these later. */
export default function DemoRidersLayer({ map }: { map: maplibregl.Map | null }) {
  const riders = useRef<Rider[]>([]);
  const popup = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!map || !supabase || !isSupabaseConfigured) return;
    let dead = false;
    let timer = 0;

    const newTrip = async (r: Rider) => {
      if (r.busy || dead) return;
      r.busy = true;
      const angle = Math.random() * Math.PI * 2, reach = 0.012 + Math.random() * 0.02; // about 1.3 to 3.5 km away
      const goal: Pt = [r.at[0] + Math.sin(angle) * reach, r.at[1] + Math.cos(angle) * reach];
      const path = await fetchDrivePath(r.at, goal);
      r.busy = false;
      if (dead) return;
      if (!path) { r.waitUntil = Date.now() + 8000; return; }
      const cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + km(path[i - 1], path[i]));
      r.path = path; r.cum = cum; r.dist = 0; r.at = path[0];
    };

    void (async () => {
      const { data } = await supabase!.from("demo_vehicles").select("id,kind,plate,label,lat,lon").in("kind", ["car", "boda"]);
      if (dead || !data) return;
      riders.current = data.filter((d: any) => d.lat != null && d.lon != null).map((d: any, index: number): Rider => {
        const el = vehicleElement(d.kind === "boda" ? "boda" : "car", { label: `Demo ${d.kind} ${d.plate}`, size: 30 });
        const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([d.lon, d.lat]).addTo(map);
        const rider: Rider = { id: d.id, kind: d.kind, plate: d.plate, label: d.label ?? d.plate, marker, at: [d.lat, d.lon], path: [], cum: [], dist: 0, waitUntil: 0, moving: index % 3 !== 2, busy: false };
        el.addEventListener("click", ev => {
          ev.stopPropagation();
          popup.current?.remove();
          const box = document.createElement("div");
          box.style.cssText = "font:600 12px system-ui;color:#f8fafc;min-width:170px";
          box.innerHTML = `<div style="font-weight:800;font-size:13px">${rider.plate} <span style="background:#f59e0b;color:#111;border-radius:6px;padding:1px 5px;font-size:10px">DEMO</span></div><div>${rider.kind === "boda" ? "Boda" : "Ndai car"} · ${rider.moving ? "on the move" : "waiting for a ride"}</div>`;
          popup.current = new maplibregl.Popup({ offset: 16, closeButton: false, maxWidth: "240px" }).setLngLat(rider.marker.getLngLat()).setDOMContent(box).addTo(map);
        });
        return rider;
      });
      // Start the moving ones one by one so the free road service is not flooded.
      riders.current.filter(r => r.moving).forEach((r, i) => window.setTimeout(() => void newTrip(r), 400 * i));
      let last = performance.now();
      timer = window.setInterval(() => {
        const now = performance.now(), dt = (now - last) / 3_600_000; last = now;
        for (const r of riders.current) {
          if (!r.moving || !r.path.length) continue;
          r.dist += SPEED_KMH[r.kind] * dt;
          const total = r.cum[r.cum.length - 1];
          if (r.dist >= total) { // arrived: rest a few seconds, then take a new trip
            r.at = r.path[r.path.length - 1]; r.path = []; r.waitUntil = Date.now() + 4000 + Math.random() * 8000;
            r.marker.setLngLat([r.at[1], r.at[0]]);
            continue;
          }
          let i = 1; while (i < r.cum.length - 1 && r.cum[i] < r.dist) i++;
          const f = (r.dist - r.cum[i - 1]) / ((r.cum[i] - r.cum[i - 1]) || 1e-9);
          const a = r.path[i - 1], b = r.path[i];
          r.marker.setLngLat([a[1] + (b[1] - a[1]) * f, a[0] + (b[0] - a[0]) * f]);
        }
        for (const r of riders.current) if (r.moving && !r.path.length && !r.busy && Date.now() >= r.waitUntil) void newTrip(r);
      }, 120);
    })();

    return () => { dead = true; window.clearInterval(timer); riders.current.forEach(r => r.marker.remove()); riders.current = []; popup.current?.remove(); };
  }, [map]);
  return null;
}
