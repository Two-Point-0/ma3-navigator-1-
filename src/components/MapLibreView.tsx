import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapLibreHandle {
  getMap: () => maplibregl.Map | null;
  flyTo: (lon: number, lat: number, zoom?: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]], padding?: number) => void;
}

interface MapLibreViewProps {
  center: [number, number]; // [lat, lon]
  zoom?: number;
  pitch?: number;
  bearing?: number;
  height?: number | string;
  borderRadius?: number;
  onLoad?: (map: maplibregl.Map) => void;
  onClick?: (lng: number, lat: number) => void;
}

// OpenFreeMap — tokenless, open-source vector tiles (OpenMapTiles schema),
// supports real building-height extrusion data unlike raster tiles.
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

function add3DBuildingLayer(map: maplibregl.Map) {
  if (map.getLayer("3d-buildings")) return;
  try {
    const layers = map.getStyle().layers ?? [];
    let labelLayerId: string | undefined;
    for (const l of layers) {
      if (l.type === "symbol" && (l.layout as any)?.["text-field"]) { labelLayerId = l.id; break; }
    }
    map.addLayer(
      {
        id: "3d-buildings",
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 13,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": [
            "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 8],
            0, "#2a2a3a", 50, "#3a3a52", 150, "#4a4a6a", 300, "#5a5a82",
          ],
          "fill-extrusion-height": [
            "interpolate", ["linear"], ["zoom"],
            13, 0, 16, ["coalesce", ["get", "render_height"], 8],
          ],
          "fill-extrusion-base": [
            "case", [">=", ["zoom"], 16],
            ["coalesce", ["get", "render_min_height"], 0], 0,
          ],
          "fill-extrusion-opacity": 0.78,
        },
      } as any,
      labelLayerId
    );
  } catch {
    // source-layer "building" not present in this style — silently skip
  }
}

const MapLibreView = forwardRef<MapLibreHandle, MapLibreViewProps>(function MapLibreView(
  { center, zoom = 12, pitch = 0, bearing = 0, height = 280, borderRadius = 0, onLoad, onClick },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    flyTo: (lon, lat, z) => mapRef.current?.flyTo({ center: [lon, lat], zoom: z ?? mapRef.current.getZoom(), duration: 800, essential: true }),
    fitBounds: (bounds, padding = 60) => mapRef.current?.fitBounds(bounds, { padding, duration: 800 }),
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [center[1], center[0]],
      zoom, pitch, bearing,
      attributionControl: false,
      antialias: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      add3DBuildingLayer(map);
      setReady(true);
      onLoad?.(map);
    });

    // If the vector style fails to load (network hiccup), fall back to reliable raster tiles
    let fellBack = false;
    map.on("error", (e) => {
      if (fellBack) return;
      const msg = (e?.error as any)?.message ?? "";
      if (msg.toLowerCase().includes("style") || msg.toLowerCase().includes("openfreemap") || msg.toLowerCase().includes("fetch")) {
        fellBack = true;
        try {
          map.setStyle({
            version: 8,
            sources: {
              carto: {
                type: "raster",
                tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
                tileSize: 256,
              },
            },
            layers: [{ id: "carto-dark", type: "raster", source: "carto", minzoom: 0, maxzoom: 20 }],
          } as any);
        } catch {}
      }
    });

    if (onClick) {
      map.on("click", e => onClick(e.lngLat.lng, e.lngLat.lat));
    }

    return () => { map.remove(); mapRef.current = null; setReady(false); };
  }, []);

  // Smooth recenter / pitch change
  useEffect(() => {
    if (mapRef.current && ready) {
      mapRef.current.easeTo({ center: [center[1], center[0]], zoom, pitch, bearing, duration: 600, essential: true });
    }
  }, [center[0], center[1], zoom, pitch, bearing, ready]);

  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius, overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 60%, rgba(8,8,16,.35) 100%)", borderRadius }} />
    </div>
  );
});

export default MapLibreView;
