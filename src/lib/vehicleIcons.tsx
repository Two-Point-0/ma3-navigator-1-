import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Bus, Car, Plane, TrainFront } from "lucide-react";

export type VehicleKind = "matatu" | "car" | "boda" | "plane" | "train";

/** Lucide has no motorbike, so this one is drawn in the same style (24px grid, 2px round strokes). */
const BODA_SVG = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17l3.2-6.5h5.3L16 17"/><path d="M13.5 10.5L12 7h3.2"/><path d="M8.2 10.5H6.5"/></svg>`;

export function vehicleSvg(kind: VehicleKind, size = 18): string {
  if (kind === "boda") return BODA_SVG(size);
  const Icon = kind === "matatu" ? Bus : kind === "car" ? Car : kind === "plane" ? Plane : TrainFront;
  return renderToStaticMarkup(createElement(Icon, { size, color: "#ffffff", strokeWidth: 2.1 }));
}

/**
 * One look for every vehicle: a dark navy disc with a white ring and a white Lucide icon.
 * Navy + white never matches a route colour (green, orange, red, blue, purple), so the vehicle always stands out from the line.
 */
export function vehicleElement(kind: VehicleKind, opts: { badge?: string; label: string; size?: number } = { label: "" }): HTMLDivElement {
  const size = opts.size ?? 34;
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", opts.label);
  el.style.cssText = `position:relative;width:${size}px;height:${size}px;border-radius:50%;background:#0b1530;border:2.5px solid #fff;box-shadow:0 2px 10px #000b,0 0 0 2px #0b153099;display:flex;align-items:center;justify-content:center;cursor:pointer`;
  const inner = document.createElement("div");
  inner.className = "veh-ico";
  inner.style.cssText = "display:flex;align-items:center;justify-content:center;transition:transform .25s linear";
  inner.innerHTML = vehicleSvg(kind, Math.round(size * 0.52));
  el.appendChild(inner);
  if (opts.badge) {
    const b = document.createElement("span");
    b.textContent = opts.badge;
    b.style.cssText = "position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;color:#0b1530;border-radius:99px;padding:0 5px;font:800 9px system-ui;line-height:14px;white-space:nowrap;box-shadow:0 1px 4px #0008";
    el.appendChild(b);
  }
  return el;
}
