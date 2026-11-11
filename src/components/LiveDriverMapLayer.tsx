import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DriverLocation = {
  route_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  seats_available: number;
  last_seen: string;
};

interface LiveDriverMapLayerProps {
  map: maplibregl.Map | null;
  routeId: string | null;
  enabled: boolean;
  phoneVerified: boolean;
  onStatus: (message: string) => void;
}

export default function LiveDriverMapLayer({ map, routeId, enabled, phoneVerified, onStatus }: LiveDriverMapLayerProps) {
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    const client = supabase;
    let cancelled = false;
    if (!enabled) { setDrivers([]); onStatus("Live markers are off; this passenger phone's location is not shared."); return; }
    if (!routeId) { setDrivers([]); onStatus("Choose a Ma3 route to find live vehicles."); return; }
    if (!isSupabaseConfigured || !client) { setDrivers([]); onStatus("Connect Supabase and apply the live-driver migration first."); return; }
    if (!phoneVerified) { setDrivers([]); onStatus("Sign in with a verified phone number to see live drivers."); return; }

    const load = async () => {
      const cutoff = new Date(Date.now() - 45_000).toISOString();
      const { data, error } = await client.from("ma3_driver_live_locations")
        .select("route_id,latitude,longitude,accuracy_m,seats_available,last_seen")
        .eq("route_id", routeId).gte("last_seen", cutoff).order("last_seen", { ascending: false });
      if (cancelled) return;
      if (error) { setDrivers([]); onStatus("Could not load live vehicles. Check the migration, phone verification and route approval."); return; }
      const rows = (data ?? []) as DriverLocation[];
      setDrivers(rows);
      onStatus(rows.length ? `${rows.length} approved vehicle${rows.length === 1 ? "" : "s"} online · positions expire after 45 seconds.` : "No approved driver is online on this route right now.");
    };

    void load();
    const channel = client.channel(`ma3-live-${routeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ma3_driver_live_locations", filter: `route_id=eq.${routeId}` }, () => { void load(); })
      .subscribe();
    const refreshTimer = window.setInterval(() => { void load(); }, 15_000);
    return () => { cancelled = true; window.clearInterval(refreshTimer); void client.removeChannel(channel); };
  }, [enabled, routeId, phoneVerified, map, onStatus]);

  useEffect(() => {
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
    if (!map || !enabled || !routeId) return;
    const nextMarkers = drivers.map(driver => {
      const element = document.createElement("div");
      element.textContent = "BUS";
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", `Live vehicle, ${driver.seats_available} seats available`);
      element.style.cssText = "background:#138a55;color:#fff;border:2px solid #d9ffe9;border-radius:99px;padding:5px 8px;font:800 10px system-ui;letter-spacing:.04em;box-shadow:0 2px 12px #0009;white-space:nowrap";
      const updated = new Date(driver.last_seen).toLocaleTimeString();
      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setText(`Approved live vehicle · ${driver.seats_available} seats reported · GPS accuracy about ${Math.round(driver.accuracy_m)} m · updated ${updated}`);
      return new maplibregl.Marker({ element, anchor: "center" }).setLngLat([driver.longitude, driver.latitude]).setPopup(popup).addTo(map);
    });
    markers.current = nextMarkers;
    return () => { nextMarkers.forEach(marker => marker.remove()); if (markers.current === nextMarkers) markers.current = []; };
  }, [map, enabled, routeId, drivers]);

  return null;
}
