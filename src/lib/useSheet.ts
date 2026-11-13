import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

/**
 * One shared behaviour for every bottom popup in the app.
 *  - always sits ABOVE the bottom nav, so inputs are never covered
 *  - drag the grip to three heights: peek / half (map visible) / full
 *  - tap the grip to step through the heights
 *  - lifts above the phone keyboard so you can always type
 */
export type SheetSnap = "peek" | "half" | "full";
const ORDER: SheetSnap[] = ["peek", "half", "full"];
const RATIO: Record<SheetSnap, number> = { peek: 0.3, half: 0.62, full: 1 };

function cssPx(name: string, fallback: number) {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

function readViewport() {
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  const keyboard = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  return { height, keyboard };
}

export function useSheet(initial: SheetSnap = "peek", options: { aboveNav?: boolean } = {}) {
  const aboveNav = options.aboveNav !== false;
  const [snap, setSnap] = useState<SheetSnap>(initial);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [viewport, setViewport] = useState(readViewport);
  const drag = useRef({ startY: 0, startH: 0, moved: false });

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setViewport(readViewport());
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const keyboardOpen = viewport.keyboard > 80;
  const topH = typeof document === "undefined" ? 52 : cssPx("--top-h", 52);
  const navH = !aboveNav ? 0 : typeof document === "undefined" ? 76 : cssPx("--nav-h", 76);
  const bottom = keyboardOpen ? viewport.keyboard : navH;
  // keep the 3 top tabs visible unless the keyboard is up and space is tight
  const reserve = keyboardOpen ? 8 : aboveNav ? 62 : 16;
  const maxH = Math.max(160, viewport.height - topH - reserve - (keyboardOpen ? 0 : navH));
  const snapPx = (s: SheetSnap) => Math.max(130, Math.round(maxH * RATIO[s]));
  const baseH = dragHeight ?? snapPx(snap);
  const height = keyboardOpen ? Math.min(maxH, Math.max(baseH, 280)) : baseH;

  const cycle = useCallback(() => {
    setSnap(current => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startH: height, moved: false };
    setDragHeight(height);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragHeight === null) return;
    const delta = drag.current.startY - event.clientY;
    if (Math.abs(delta) > 5) drag.current.moved = true;
    setDragHeight(Math.max(90, Math.min(maxH, drag.current.startH + delta)));
  };
  const onPointerUp = () => {
    if (dragHeight === null) return;
    if (!drag.current.moved) { setDragHeight(null); cycle(); return; }
    const nearest = ORDER.reduce((best, s) => Math.abs(snapPx(s) - dragHeight) < Math.abs(snapPx(best) - dragHeight) ? s : best);
    setDragHeight(null);
    setSnap(nearest);
  };

  const panelStyle: CSSProperties = {
    position: "fixed",
    left: 0, right: 0, margin: "0 auto",
    width: "min(100vw, 720px)",
    bottom, height, maxHeight: "none",
    zIndex: 880,
    overflowY: "auto",
    transition: dragHeight !== null ? "none" : "height .25s ease, bottom .2s ease",
  };

  return {
    snap,
    /** current sheet height in pixels, for framing the map above it */
    height,
    setSnap,
    cycle,
    minimized: snap === "peek",
    /** spread on the sliding panel: <motion.div {...sheet.panelProps}> */
    panelProps: { className: "bpanel open", style: panelStyle, "data-sheet": snap } as const,
    /** spread on the grip button: <button {...sheet.gripProps} /> */
    gripProps: {
      type: "button" as const,
      className: "handle sheet-grip",
      "aria-label": "Drag to resize, or tap to change height",
      style: { touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as CSSProperties,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
