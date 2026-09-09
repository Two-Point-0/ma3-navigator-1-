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

export function removeLineLayer(map: maplibregl.Map, id: string) {
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
  try { if (map.getLayer(id)) map.removeLayer(id); } catch {}
  try { if (map.getSource(`src-${id}`)) map.removeSource(`src-${id}`); } catch {}
}

export function addBadgeMarker(map: maplibregl.Map, lat: number, lon: number, text: string, color: string): maplibregl.Marker {
  const el = document.createElement("div");
  el.style.cssText = `background:${color};color:#fff;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap;font-family:'DM Mono',monospace;box-shadow:0 2px 6px rgba(0,0,0,.45);pointer-events:none`;
  el.textContent = text;
  return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lon, lat]).addTo(map);
}
