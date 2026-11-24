import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { vehicleElement } from "@/lib/vehicleIcons";

/** One matatu the rider is going to use. With no from/to, vehicles in BOTH directions are shown. */
export interface DemoLeg { routeId: string; fromId?: string; toId?: string; fromName?: string }

type Row = { id: string; route_id: string; direction: "forward" | "reverse"; plate: string; label: string | null; seats_total: number; seats_taken: number; speed_kmh: number; phase: number };

const SHAPES = MA3_GTFS.shapes as unknown as Record<string, [number, number][]>;
const ROUTE_STOPS = MA3_GTFS.routeStops as Record<string, string[]>;
const STOPS = MA3_GTFS.stops as unknown as Record<string, [string, number, number]>;
const ROUTES = new Map(MA3_GTFS.routes.map(r => [r.id, r]));

const lenCache = new Map<string, { cum: number[]; total: number }>();
function measure(routeId: string) {
  let m = lenCache.get(routeId);
  if (m) return m;
  const shape = SHAPES[routeId] ?? [];
  const cum = [0];
  for (let i = 1; i < shape.length; i++) {
    const [a, b] = [shape[i - 1], shape[i]];
    const dy = (b[0] - a[0]) * 111.32, dx = (b[1] - a[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180);
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  m = { cum, total: cum[cum.length - 1] || 0.001 };
  lenCache.set(routeId, m);
  return m;
}

/** Where the vehicle is right now. Same answer on every phone because it only depends on the clock. */
function positionOf(v: Row, now: number): [number, number] | null {
  const shape = SHAPES[v.route_id];
  if (!shape || shape.length < 2) return null;
  const { cum, total } = measure(v.route_id);
  const hours = now / 3_600_000;
  let p = (v.phase + (hours * v.speed_kmh) / total) % 1;
  if (v.direction === "reverse") p = 1 - p;
  const target = p * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1e-9;
  const f = Math.min(1, Math.max(0, (target - cum[i - 1]) / seg));
  return [shape[i - 1][0] + (shape[i][0] - shape[i - 1][0]) * f, shape[i - 1][1] + (shape[i][1] - shape[i - 1][1]) * f];
}

function stopIndex(routeId: string, id?: string): number {
  if (!id) return -1;
  return (ROUTE_STOPS[routeId] ?? []).indexOf(id);
}

function directionOfLeg(leg: DemoLeg): "forward" | "reverse" | null {
  const a = stopIndex(leg.routeId, leg.fromId), b = stopIndex(leg.routeId, leg.toId);
  if (a < 0 || b < 0 || a === b) return null;
  return b > a ? "forward" : "reverse";
}

function headingName(routeId: string, dir: "forward" | "reverse"): string {
  const ids = ROUTE_STOPS[routeId] ?? [];
  const id = dir === "forward" ? ids[ids.length - 1] : ids[0];
  return STOPS[id]?.[0] ?? "the end of the route";
}

interface Props { map: maplibregl.Map | null; legs: DemoLeg[]; onStatus?: (message: string) => void }

export default function DemoVehicleLayer({ map, legs, onStatus }: Props) {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [rows, setRows] = useState<Row[]>([]);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popup = useRef<maplibregl.Popup | null>(null);
  const rowsRef = useRef<Row[]>([]);
  const legsRef = useRef<DemoLeg[]>([]);
  const signedInRef = useRef(false);
  signedInRef.current = signedIn;
  legsRef.current = legs;
  rowsRef.current = rows;

  const routeKey = useMemo(() => Array.from(new Set(legs.map(l => l.routeId))).sort().join(","), [legs]);
  // Which (route, direction) pairs to show.
  const wanted = useMemo(() => {
    const out = new Set<string>();
    for (const leg of legs) {
      const dir = directionOfLeg(leg);
      if (dir) out.add(`${leg.routeId}|${dir}`);
      else { out.add(`${leg.routeId}|forward`); out.add(`${leg.routeId}|reverse`); }
    }
    return out;
  }, [legs]);

  const load = async () => {
    if (!supabase || !isSupabaseConfigured || !routeKey) { setRows([]); return; }
    const { data, error } = await supabase.from("demo_vehicles").select("id,route_id,direction,plate,label,seats_total,seats_taken,speed_kmh,phase").eq("kind", "matatu").in("route_id", routeKey.split(","));
    if (error) { setRows([]); onStatus?.("Demo vehicles are not loaded yet. Run the latest database update."); return; }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    void load();
    if (!routeKey) return;
    const timer = window.setInterval(() => { void load(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [routeKey]);

  const shown = useMemo(() => rows.filter(r => wanted.has(`${r.route_id}|${r.direction}`)), [rows, wanted]);

  useEffect(() => {
    if (onStatus) onStatus(shown.length ? `${shown.length} demo matatu${shown.length === 1 ? "" : "s"} on this route (practice vehicles).` : "");
  }, [shown.length]);

  const book = async (v: Row, boardStop: string) => {
    if (!supabase) return;
    if (!signedInRef.current) { toast("Sign in with your phone first, then book."); return; }
    const { data, error } = await supabase.rpc("demo_book_seat", { p_vehicle_id: v.id, p_seats: 1, p_board_stop: boardStop });
    if (error) { toast(error.message || "Could not book that seat."); return; }
    toast.success(`Demo seat booked on ${v.plate}. Code ${String((data as any)?.id ?? "").slice(0, 6).toUpperCase()}. No money was taken.`);
    popup.current?.remove();
    void load();
  };

  const openCard = (v: Row, lngLat: [number, number]) => {
    if (!map) return;
    popup.current?.remove();
    const leg = legsRef.current.find(l => l.routeId === v.route_id);
    const board = leg?.fromName ?? "Anywhere on the route";
    const left = v.seats_total - v.seats_taken;
    const box = document.createElement("div");
    box.style.cssText = "font:600 12px system-ui;color:#111;min-width:190px";
    const route = ROUTES.get(v.route_id);
    box.innerHTML = `<div style="font-weight:800;font-size:13px">${v.plate} <span style="background:#f59e0b;color:#111;border-radius:6px;padding:1px 5px;font-size:10px">DEMO</span></div>
      <div>Route ${route?.sn ?? ""} → heading to <b>${headingName(v.route_id, v.direction)}</b></div>
      <div>${left} of ${v.seats_total} seats free</div>
      <div style="color:#555;margin:3px 0 6px">Board at: ${board}</div>`;
    const btn = document.createElement("button");
    btn.textContent = left > 0 ? "Book 1 seat (practice)" : "Full";
    btn.disabled = left <= 0;
    btn.style.cssText = "width:100%;padding:8px;border:0;border-radius:9px;background:#d97706;color:#fff;font:800 12px system-ui;cursor:pointer";
    btn.onclick = () => { void book(v, board); };
    box.appendChild(btn);
    popup.current = new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: "260px" }).setLngLat(lngLat).setDOMContent(box).addTo(map);
  };

  // Create / remove markers when the list changes.
  useEffect(() => {
    if (!map) return;
    const live = markers.current;
    const keep = new Set(shown.map(v => v.id));
    live.forEach((m, id) => { if (!keep.has(id)) { m.remove(); live.delete(id); } });
    shown.forEach(v => {
      if (live.has(v.id)) return;
      const route = ROUTES.get(v.route_id);
      const arrow = v.direction === "forward" ? "▶" : "◀";
      const el = vehicleElement("matatu", { badge: `${route?.sn ?? ""} ${arrow}`, label: `Demo matatu ${v.plate}` });
      const pos = positionOf(v, Date.now()) ?? [0, 0];
      const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([pos[1], pos[0]]).addTo(map);
      el.addEventListener("click", ev => { ev.stopPropagation(); const p = positionOf(v, Date.now()); if (p) openCard(v, [p[1], p[0]]); });
      live.set(v.id, marker);
    });
  }, [map, shown]);

  // Move them every second.
  useEffect(() => {
    if (!map) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const v of rowsRef.current) {
        const m = markers.current.get(v.id);
        const p = positionOf(v, now);
        if (m && p) m.setLngLat([p[1], p[0]]);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [map]);

  useEffect(() => () => { markers.current.forEach(m => m.remove()); markers.current.clear(); popup.current?.remove(); }, []);
  useEffect(() => { if (!routeKey) popup.current?.remove(); }, [routeKey]);

  return null;
}
