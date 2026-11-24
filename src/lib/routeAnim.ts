import maplibregl from "maplibre-gl";
import { vehicleElement } from "@/lib/vehicleIcons";
import type { LonLat } from "@/lib/arc";

export interface RouteAnimOptions {
  color: string;
  kind: "plane" | "train";
  /** Draw the broken (dashed) line along the whole path. */
  dashes?: boolean;
  /** Seconds for one trip along the path. */
  seconds?: number;
}

function lengths(path: LonLat[]) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return cum;
}

/**
 * A moving vehicle icon that travels along a path, leaving a bright trail, with a dashed line ahead of it.
 * Returns a function that removes everything again.
 */
export function animateRoute(map: maplibregl.Map, id: string, path: LonLat[], opts: RouteAnimOptions): () => void {
  if (path.length < 2) return () => {};
  const cum = lengths(path), total = cum[cum.length - 1] || 1e-9;
  const line = (coords: LonLat[]): GeoJSON.Feature => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
  const round = { "line-cap": "round", "line-join": "round" } as const;
  const dashSrc = `src-${id}-dash`, doneSrc = `src-${id}-done`;
  try {
    if (opts.dashes !== false) {
      map.addSource(dashSrc, { type: "geojson", data: line(path) });
      map.addLayer({ id: `${id}-dash`, type: "line", source: dashSrc, layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": opts.color, "line-width": 3, "line-opacity": 0.85, "line-dasharray": [1.6, 2.2] } });
    }
    map.addSource(doneSrc, { type: "geojson", data: line(path.slice(0, 2)) });
    map.addLayer({ id: `${id}-done-glow`, type: "line", source: doneSrc, layout: round, paint: { "line-color": opts.color, "line-width": 10, "line-blur": 6, "line-opacity": 0.4 } });
    map.addLayer({ id: `${id}-done`, type: "line", source: doneSrc, layout: round, paint: { "line-color": opts.color, "line-width": 4, "line-opacity": 1 } });
  } catch { /* if layers fail the icon still moves */ }

  const el = vehicleElement(opts.kind, { label: opts.kind === "plane" ? "Flight" : "Train", size: 36 });
  const inner = el.querySelector<HTMLElement>(".veh-ico");
  el.style.pointerEvents = "none";
  const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(path[0]).addTo(map);

  const at = (frac: number) => {
    const target = frac * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const seg = cum[i] - cum[i - 1] || 1e-9;
    const f = Math.min(1, Math.max(0, (target - cum[i - 1]) / seg));
    const p: LonLat = [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f];
    return { p, i };
  };
  const place = (frac: number) => {
    const { p, i } = at(frac);
    marker.setLngLat(p);
    // The plane icon points to the top-right, so turn it by the direction of travel minus 45 degrees.
    if (inner && opts.kind === "plane") {
      const a = map.project(path[i - 1]), b = map.project(path[i]);
      const bearing = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
      inner.style.transform = `rotate(${bearing - 45}deg)`;
    }
    try { (map.getSource(doneSrc) as maplibregl.GeoJSONSource | undefined)?.setData(line([...path.slice(0, i), p])); } catch { /* removed */ }
  };

  let raf = 0, dead = false;
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* ignore */ }
  if (reduce) place(1);
  else {
    const ms = (opts.seconds ?? 7) * 1000, pause = 900;
    const start = performance.now();
    const frame = (now: number) => {
      if (dead) return;
      const t = (now - start) % (ms + pause);
      const f = Math.min(1, t / ms);
      place(f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2); // ease in and out like a real take-off and landing
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  return () => {
    dead = true; cancelAnimationFrame(raf); marker.remove();
    for (const l of [`${id}-dash`, `${id}-done`, `${id}-done-glow`]) { try { if (map.getLayer(l)) map.removeLayer(l); } catch { /* ignore */ } }
    for (const s of [dashSrc, doneSrc]) { try { if (map.getSource(s)) map.removeSource(s); } catch { /* ignore */ } }
  };
}
