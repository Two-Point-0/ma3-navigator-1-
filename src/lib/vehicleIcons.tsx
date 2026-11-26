import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Bus, Car, Plane, TrainFront } from "lucide-react";

export type VehicleKind = "matatu" | "car" | "boda" | "plane" | "train";

/** Lucide has no motorbike, so this one is drawn in the same style (24px grid, round strokes). */
const bodaSvg = (size: number, color: string, width: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17l3.2-6.5h5.3L16 17"/><path d="M13.5 10.5L12 7h3.2"/><path d="M8.2 10.5H6.5"/></svg>`;

export function vehicleSvg(kind: VehicleKind, size = 18, color = "#ffffff", width = 2.1): string {
  if (kind === "boda") return bodaSvg(size, color, width);
  const Icon = kind === "matatu" ? Bus : kind === "car" ? Car : kind === "plane" ? Plane : TrainFront;
  return renderToStaticMarkup(createElement(Icon, { size, color, strokeWidth: width }));
}

/**
 * A bare vehicle icon: white with a dark outline, so it reads on any map and never matches a route colour.
 * The outer element must NOT set its own position: MapLibre positions markers through it.
 */
export function vehicleElement(kind: VehicleKind, opts: { badge?: string; label: string; size?: number } = { label: "" }): HTMLDivElement {
  const size = opts.size ?? 30;
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", opts.label);
  el.style.cssText = "cursor:pointer;line-height:0";
  const box = document.createElement("div");
  box.style.cssText = `position:relative;width:${size}px;height:${size}px`;
  const ico = document.createElement("div");
  ico.className = "veh-ico";
  ico.style.cssText = "position:absolute;inset:0;transition:transform .25s linear;filter:drop-shadow(0 1px 2px #0009)";
  ico.innerHTML = `<span style="position:absolute;inset:0">${vehicleSvg(kind, size, "#0b1530", 5.4)}</span><span style="position:absolute;inset:0">${vehicleSvg(kind, size, "#ffffff", 2.1)}</span>`;
  box.appendChild(ico);
  if (opts.badge) {
    const b = document.createElement("span");
    b.textContent = opts.badge;
    b.style.cssText = "position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#0b1530;color:#fff;border:1.5px solid #fff;border-radius:99px;padding:0 5px;font:800 9px system-ui;line-height:13px;white-space:nowrap";
    box.appendChild(b);
  }
  el.appendChild(box);
  return el;
}
