import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { TreePine, PawPrint, Landmark, Castle, Waves, Mountain, Palmtree, Drama, Trees, type LucideIcon } from "lucide-react";
import maplibregl from "maplibre-gl";
import type { SightKind } from "@/data/sights";

export const KIND_ICON: Record<SightKind, LucideIcon> = {
  park: TreePine, reserve: Trees, museum: Landmark, heritage: Castle, lake: Waves, mountain: Mountain, beach: Palmtree, culture: Drama, wildlife: PawPrint,
};

export function kindSvg(kind: SightKind, size = 16, color = "#ffffff"): string {
  return renderToStaticMarkup(createElement(KIND_ICON[kind], { size, color, strokeWidth: 2.2 }));
}

/** The pin for a picked sight: its Lucide icon, no circle. Tapping it opens the poster. */
export function sightPin(map: maplibregl.Map, sight: { kind: SightKind; lat: number; lon: number }, label: string, onTap: () => void): maplibregl.Marker {
  const root = document.createElement("div");
  root.style.cssText = "cursor:pointer;line-height:0";
  root.setAttribute("role", "button");
  root.setAttribute("aria-label", `${label}, open poster`);
  const box = document.createElement("div");
  box.style.cssText = "position:relative;width:38px;height:38px;filter:drop-shadow(0 1px 3px #000a)";
  const layer = (color: string, width: number) => `<span style="position:absolute;inset:0;display:grid;place-items:center">${renderToStaticMarkup(createElement(KIND_ICON[sight.kind], { size: 36, color, strokeWidth: width }))}</span>`;
  box.innerHTML = layer("#0b1530", 5.6) + layer("#f59e0b", 2.4);
  const tag = document.createElement("span");
  tag.textContent = label;
  tag.style.cssText = "position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:2px;white-space:nowrap;font:700 11px system-ui;color:#fff;text-shadow:0 1px 3px #000,0 0 2px #000;pointer-events:none";
  box.appendChild(tag);
  root.appendChild(box);
  root.addEventListener("click", ev => { ev.stopPropagation(); onTap(); });
  return new maplibregl.Marker({ element: root, anchor: "center" }).setLngLat([sight.lon, sight.lat]).addTo(map);
}
