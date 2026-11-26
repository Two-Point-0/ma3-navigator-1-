import maplibregl from "maplibre-gl";
import { vehicleElement } from "@/lib/vehicleIcons";
import type { LonLat } from "@/lib/arc";
import { kindSvg } from "@/lib/sightIcons";
import type { SightEntry } from "@/data/sights";

/** A sight the vehicle flies or rides past. It pops up beside the line when the vehicle gets there. */
export interface PathSight { sight: SightEntry; frac: number; at: LonLat; onOpen: (sight: SightEntry) => void }

export interface RouteAnimOptions {
  color: string;
  kind: "plane" | "train";
  /** Draw the broken (dashed) line along the whole path. */
  dashes?: boolean;
  /** Seconds for one trip along the path. */
  seconds?: number;
  /** Sights near the path. Each pops up beside the line as the vehicle passes it. */
  sights?: PathSight[];
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

  const pops = (opts.sights ?? []).map((item, n) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.setAttribute("aria-label", `${item.sight.name}, open in Explore`);
    chip.style.cssText = "display:flex;align-items:center;gap:6px;background:#0b1530;color:#fff;border:2px solid #fff;border-radius:99px;padding:4px 10px 4px 6px;font:700 11px system-ui;white-space:nowrap;box-shadow:0 2px 10px #000b;cursor:pointer;opacity:0;transform:scale(.6);transition:opacity .35s ease,transform .35s ease;pointer-events:none";
    chip.innerHTML = `<span style="display:flex">${kindSvg(item.sight.kind, 16)}</span>${item.sight.name.replace(/ National (Park|Reserve)| Reserve| Conservancy/, "").replace(/</g, "&lt;")}`;
    chip.addEventListener("click", ev => { ev.stopPropagation(); item.onOpen(item.sight); });
    const side = n % 2 === 0 ? -1 : 1; // alternate sides so neighbours never overlap
    const m = new maplibregl.Marker({ element: chip, anchor: side < 0 ? "right" : "left", offset: [side * 18, side * -22] }).setLngLat(item.at).addTo(map);
    return { chip, m, frac: item.frac, shown: false };
  });
  const showPops = (frac: number) => {
    for (const pop of pops) {
      const on = frac >= pop.frac - 0.02;
      if (on === pop.shown) continue;
      pop.shown = on;
      pop.chip.style.opacity = on ? "1" : "0";
      pop.chip.style.transform = on ? "scale(1)" : "scale(.6)";
      pop.chip.style.pointerEvents = on ? "auto" : "none";
    }
  };
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
    showPops(frac);
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
  if (reduce) { place(1); pops.forEach(pop => { pop.chip.style.opacity = "1"; pop.chip.style.transform = "scale(1)"; pop.chip.style.pointerEvents = "auto"; }); }
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
    dead = true; cancelAnimationFrame(raf); marker.remove(); pops.forEach(pop => pop.m.remove());
    for (const l of [`${id}-dash`, `${id}-done`, `${id}-done-glow`]) { try { if (map.getLayer(l)) map.removeLayer(l); } catch { /* ignore */ } }
    for (const s of [dashSrc, doneSrc]) { try { if (map.getSource(s)) map.removeSource(s); } catch { /* ignore */ } }
  };
}
