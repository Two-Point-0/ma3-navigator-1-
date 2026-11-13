import maplibregl from "maplibre-gl";

export function setLineLayer(
  map: maplibregl.Map, id: string,
  coords: [number, number][], // [lat, lon][]
  color: string, weight = 3, opacity = 0.85,
  dashed = false
) {
  const geojson: GeoJSON.Feature = {
    type: "Feature", properties: {},
    geometry: { type: "LineString", coordinates: coords.map(([lat, lon]) => [lon, lat]) },
  };
  const src = `src-${id}`;
  if (map.getSource(src)) {
    (map.getSource(src) as maplibregl.GeoJSONSource).setData(geojson);
    try {
      map.setPaintProperty(id, "line-color", color);
      map.setPaintProperty(id, "line-width", weight);
      map.setPaintProperty(id, "line-opacity", opacity);
    } catch {}
  } else {
    map.addSource(src, { type: "geojson", data: geojson });
    const paint: any = { "line-color": color, "line-width": weight, "line-opacity": opacity };
    if (dashed) (paint as any)["line-dasharray"] = [3, 3];
    map.addLayer({ id, type: "line", source: src, layout: { "line-cap": "round", "line-join": "round" }, paint });
  }
}

const flows = new Map<string, number>();
function stopFlow(id: string) {
  const handle = flows.get(id);
  if (handle !== undefined) cancelAnimationFrame(handle);
  flows.delete(id);
}
/** Slowly moving dashes along the line so riders can see which way the matatu travels. */
function startFlow(map: maplibregl.Map, id: string) {
  stopFlow(id);
  try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch { /* ignore */ }
  const steps = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
  let step = 0, last = 0;
  const frame = (time: number) => {
    if (!map.getLayer(`${id}-flow`)) { flows.delete(id); return; }
    if (time - last > 90) {
      last = time; step = (step + 1) % steps.length;
      try { map.setPaintProperty(`${id}-flow`, "line-dasharray", steps[step]); } catch { /* layer was removed */ }
    }
    flows.set(id, requestAnimationFrame(frame));
  };
  flows.set(id, requestAnimationFrame(frame));
}

export function removeLineLayer(map: maplibregl.Map, id: string) {
  stopFlow(id);
  for (const extra of [`${id}-arrows`, `${id}-flow`, `${id}-casing`, `${id}-glow`]) {
    try { if (map.getLayer(extra)) map.removeLayer(extra); } catch {}
  }
  try { if (map.getLayer(id)) map.removeLayer(id); } catch {}
  try { if (map.getSource(`src-${id}`)) map.removeSource(`src-${id}`); } catch {}
}

export interface PointFeature {
  id: string; lat: number; lon: number; color: string; radius?: number;
  props?: Record<string, unknown>;
}

export function setPointLayer(map: maplibregl.Map, id: string, points: PointFeature[], defaultRadius = 5) {
  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: points.map(p => ({
      type: "Feature",
      properties: { id: p.id, color: p.color, radius: p.radius ?? defaultRadius, ...p.props },
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    })),
  };
  const src = `src-${id}`;
  if (map.getSource(src)) {
    (map.getSource(src) as maplibregl.GeoJSONSource).setData(geojson);
  } else {
    map.addSource(src, { type: "geojson", data: geojson });
    map.addLayer({
      id, type: "circle", source: src,
      paint: {
        "circle-radius": ["get", "radius"],
        "circle-color": ["get", "color"],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "rgba(8,8,16,.8)",
        "circle-opacity": 0.95,
      },
    });
  }
}

export function removePointLayer(map: maplibregl.Map, id: string) {
  try { if (map.getLayer(`${id}-labels`)) map.removeLayer(`${id}-labels`); } catch {}
  try { if (map.getLayer(id)) map.removeLayer(id); } catch {}
  try { if (map.getSource(`src-${id}`)) map.removeSource(`src-${id}`); } catch {}
}

export function addBadgeMarker(map: maplibregl.Map, lat: number, lon: number, text: string, color: string): maplibregl.Marker {
  const el = document.createElement("div");
  el.style.cssText = `background:${color};color:#fff;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap;font-family:'DM Mono',monospace;box-shadow:0 2px 6px rgba(0,0,0,.45);pointer-events:none`;
  el.textContent = text;
  return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lon, lat]).addTo(map);
}

/**
 * A modern route line: a soft dark outline under the coloured line, plus small
 * direction chevrons so the rider can see which way the matatu travels.
 */
export function setRouteLine(map: maplibregl.Map, id: string, coords: [number, number][], color: string, weight = 5, opacity = 0.95) {
  const already = Boolean(map.getLayer(id));
  setLineLayer(map, id, coords, color, weight, opacity);
  if (already) return;
  const src = `src-${id}`;
  const round = { "line-cap": "round", "line-join": "round" } as const;
  try {
    // glow (soft halo in the route's own colour) and dark outline sit under the line
    map.addLayer({ id: `${id}-glow`, type: "line", source: src, layout: round, paint: { "line-color": color, "line-width": weight + 10, "line-blur": 8, "line-opacity": 0.32 * opacity } }, id);
    map.addLayer({ id: `${id}-casing`, type: "line", source: src, layout: round, paint: { "line-color": "#080810", "line-width": weight + 3.5, "line-opacity": 0.6 } }, id);
    // moving dashes and chevrons sit on top
    map.addLayer({ id: `${id}-flow`, type: "line", source: src, layout: { "line-cap": "butt", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": Math.max(1.5, weight - 3), "line-opacity": 0.55, "line-dasharray": [0, 4, 3] } });
    map.addLayer({ id: `${id}-arrows`, type: "symbol", source: src,
      layout: { "symbol-placement": "line", "symbol-spacing": 80, "text-field": "›", "text-font": ["Noto Sans Bold"], "text-size": 18, "text-keep-upright": false, "text-rotation-alignment": "map", "text-allow-overlap": true },
      paint: { "text-color": "#ffffff", "text-opacity": 0.8, "text-halo-color": color, "text-halo-width": 1 } });
    startFlow(map, id);
  } catch { /* extras need map text fonts; the coloured line itself still shows */ }
}

export interface LabelledStop { id: string; lat: number; lon: number; name: string; color: string; terminal?: boolean; passed?: boolean }

/** Stop dots with their names written beside them. The map hides names that would overlap, so zooming in reveals more. */
export function setLabelledStops(map: maplibregl.Map, id: string, stops: LabelledStop[]) {
  const labelled = Boolean(map.getLayer(`${id}-labels`));
  setPointLayer(map, id, stops.map(stop => ({
    id: stop.id, lat: stop.lat, lon: stop.lon, color: stop.passed ? "#64748b" : stop.color, radius: stop.terminal ? 7 : 4.5,
    props: { name: stop.name, terminal: Boolean(stop.terminal), passed: Boolean(stop.passed) },
  })), 4.5);
  if (labelled) return;
  try {
    map.addLayer({ id: `${id}-labels`, type: "symbol", source: `src-${id}`,
      layout: {
        "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"],
        "text-size": ["case", ["get", "terminal"], 13, 11], "text-anchor": "top", "text-offset": [0, 0.9],
        "text-optional": true, "text-max-width": 8,
        "symbol-sort-key": ["case", ["get", "terminal"], 0, 1],
      },
      paint: { "text-color": ["case", ["get", "passed"], "#94a3b8", "#ffffff"], "text-halo-color": "#080810", "text-halo-width": 1.6 } });
  } catch { /* if map text is unavailable the dots still show */ }
}

/**
 * Zoom the map so every point is visible ABOVE the bottom sheet.
 * `sheetPx` is how tall the sheet currently is, so nothing hides behind it.
 */
export function fitAboveSheet(map: maplibregl.Map, points: [number, number][], sheetPx: number, maxZoom = 15) {
  if (!points.length) return;
  if (points.length === 1) { map.easeTo({ center: points[0], zoom: Math.max(map.getZoom(), 15), duration: 700, padding: { top: 70, left: 20, right: 20, bottom: sheetPx + 10 } }); return; }
  const lons = points.map(point => point[0]), lats = points.map(point => point[1]);
  map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
    { padding: { top: 90, left: 36, right: 36, bottom: sheetPx + 24 }, maxZoom, duration: 800 });
}
