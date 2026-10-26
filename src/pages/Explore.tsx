import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import maplibregl from "maplibre-gl";
import { MapPin, X, Box, Navigation, Search, Utensils, BedDouble, Landmark, Clock, Bus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import PageTabs from "@/components/PageTabs";
import { BusinessPin, PinCategory, PIN_CATEGORY_META } from "@/data/ma3_core";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const NAIROBI: [number, number] = [-1.2864, 36.8172];
type ExploreTab = "food" | "stay_shop" | "places";
type FeedStatus = "loading" | "ready" | "disconnected" | "error" | "zoom";
type ExploreCategory = "food" | "stay_shop" | "places";
const TABS = [{ id: "food", label: "Food & drink", Icon: Utensils }, { id: "stay_shop", label: "Stays & shopping", Icon: BedDouble }, { id: "places", label: "Kenya attractions", Icon: Landmark }] as const;
const EXPLORE_CATEGORIES: { id: ExploreCategory; label: string }[] = [
  { id: "food", label: "Food & drink" }, { id: "stay_shop", label: "Stays & shopping" }, { id: "places", label: "Sights & essentials" },
];
function exploreCategory(pin: BusinessPin): ExploreCategory {
  if (pin.category === "food") return "food";
  if (pin.category === "stay" || pin.category === "shop" || pin.category === "thrift") return "stay_shop";
  return "places";
}
const validCategories = new Set(Object.keys(PIN_CATEGORY_META));

function drawPinMarkers(map: maplibregl.Map, pins: BusinessPin[], filters: Set<ExploreCategory>, markers: React.MutableRefObject<Map<string, maplibregl.Marker>>, onTap: (pin: BusinessPin) => void) {
  markers.current.forEach((marker, id) => {
    const pin = pins.find(item => item.id === id);
    if (!pin || !filters.has(exploreCategory(pin))) { marker.remove(); markers.current.delete(id); }
  });
  pins.filter(pin => filters.has(exploreCategory(pin))).forEach(pin => {
    if (markers.current.has(pin.id)) return;
    const meta = PIN_CATEGORY_META[pin.category] ?? PIN_CATEGORY_META.other;
    const element = document.createElement("button");
    element.type = "button";
    element.setAttribute("aria-label", `${pin.name}, ${meta.label}`);
    element.title = `${pin.name} · ${meta.label}`;
    element.style.cssText = `width:28px;height:28px;border:2px solid white;border-radius:50% 50% 50% 3px;transform:rotate(-45deg);background:${meta.color};box-shadow:0 2px 9px rgba(0,0,0,.45);cursor:pointer`;
    element.addEventListener("click", event => { event.stopPropagation(); onTap(pin); });
    markers.current.set(pin.id, new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([pin.lon, pin.lat]).addTo(map));
  });
}

export default function ExplorePage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<ExploreTab>("food");
  const [pois, setPois] = useState<BusinessPin[]>([]);
  const [dataSnapshot, setDataSnapshot] = useState<string | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>(isSupabaseConfigured ? "loading" : "disconnected");
  const [filters, setFilters] = useState<Set<ExploreCategory>>(new Set(["food"]));
  const [activeHotspotCategory, setActiveHotspotCategory] = useState<ExploreCategory>("food");
  const [hotspotQuery, setHotspotQuery] = useState("");
  const [selectedPin, setSelectedPin] = useState<BusinessPin | null>(null);
  const [selectedPinCollapsed, setSelectedPinCollapsed] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(NAIROBI);
  const mapRef = useRef<MapLibreHandle>(null);
  const mapInst = useRef<maplibregl.Map | null>(null);
  const pinMarkers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const requestId = useRef(0);
  const moveListener = useRef<(() => void) | null>(null);

  const loadViewport = useCallback(async (map: maplibregl.Map) => {
    const current = ++requestId.current;
    if (!isSupabaseConfigured || !supabase) { setFeedStatus("disconnected"); setPois([]); setDataSnapshot(null); return; }
    if (map.getZoom() < 8) { setFeedStatus("zoom"); setPois([]); setDataSnapshot(null); return; }
    setFeedStatus("loading");
    const bounds = map.getBounds();
    const rows: any[] = [];
    const pageSize = 500;
    for (let offset = 0; offset < 2500; offset += pageSize) {
      const { data, error } = await supabase.from("explore_pois")
        .select("osm_id,name,category,subtype,latitude,longitude,county,locality,opening_hours,source_snapshot")
        .gte("latitude", bounds.getSouth()).lte("latitude", bounds.getNorth())
        .gte("longitude", bounds.getWest()).lte("longitude", bounds.getEast())
        .order("name").range(offset, offset + pageSize - 1);
      if (current !== requestId.current) return;
      if (error) { console.error("Explore POI query failed", error.message); setFeedStatus("error"); setPois([]); setDataSnapshot(null); return; }
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    if (current !== requestId.current) return;
    const snapshots = rows.map((row: any) => String(row.source_snapshot || "")).filter(Boolean).sort();
    setDataSnapshot(snapshots[snapshots.length - 1] || null);
    const parsed = rows.map((row: any): BusinessPin => ({
      id: String(row.osm_id), name: row.name || "Unnamed place",
      category: validCategories.has(row.category) ? row.category as PinCategory : "other",
      subType: row.subtype || undefined, lat: Number(row.latitude), lon: Number(row.longitude),
      county: row.county || undefined, locality: row.locality || undefined,
      openingHours: row.opening_hours || undefined, notes: undefined, addedBy: "OpenStreetMap",
    }));
    setPois(parsed);
    setFeedStatus(rows.length >= 2500 ? "zoom" : "ready");
  }, []);

  const visiblePins = useMemo(() => {
    return pois.filter(pin => filters.has(exploreCategory(pin)));
  }, [pois, filters]);
  const categoryResults = useMemo(() => {
    const query = hotspotQuery.trim().toLowerCase();
    if (!query) return [];
    return pois.filter(pin => exploreCategory(pin) === activeHotspotCategory &&
      `${pin.name} ${pin.subType ?? ""} ${pin.locality ?? ""} ${pin.county ?? ""}`.toLowerCase().includes(query)).slice(0, 8);
  }, [pois, activeHotspotCategory, hotspotQuery]);

  useEffect(() => {
    if (mapInst.current) drawPinMarkers(mapInst.current, visiblePins, filters, pinMarkers, setSelectedPin);
  }, [visiblePins, filters]);

  const handleMapLoad = (map: maplibregl.Map) => {
    mapInst.current = map;
    const load = () => void loadViewport(map);
    moveListener.current = load;
    map.on("moveend", load);
    load();
  };
  useEffect(() => () => {
    requestId.current++;
    if (mapInst.current && moveListener.current) mapInst.current.off("moveend", moveListener.current);
    pinMarkers.current.forEach(marker => marker.remove());
  }, []);
  const startMatatuDirections = async (pin: BusinessPin) => {
    setMapCenter([pin.lat, pin.lon]); setSelectedPin(null);
    mapRef.current?.flyTo(pin.lon, pin.lat, 16);
    if (pin.addedBy === "OpenStreetMap" && supabase) {
      void (async () => {
        let user = (await supabase!.auth.getUser()).data.user;
        if (!user) {
          const { data, error } = await supabase!.auth.signInAnonymously();
          if (error || !data.user) return;
          user = data.user;
        }
        const { data, error } = await supabase!.rpc("record_nganya_poi_navigation", { p_osm_id: pin.id });
        if (error) console.warn("Daily Explore challenge was not recorded:", error.message);
        else if (Number(data) > 0) toast("Ma3 directions started · +5 community points.");
      })();
    }
  };
  const activeTab = tab;
  const setSection = (value: string) => {
    const next = value as ExploreTab;
    setTab(next);
    setActiveHotspotCategory(next);
    setFilters(new Set([next]));
    setHotspotQuery(""); setSelectedPin(null);
  };
  const statusLabel = feedStatus === "loading" ? "Loading mapped places…" : feedStatus === "disconnected" ? "Places are not available right now" : feedStatus === "error" ? "Could not load places" : feedStatus === "zoom" ? "Zoom in for nearby places" : `Mapped places${dataSnapshot ? ` · ${dataSnapshot}` : ""}`;
  useEffect(() => { setSelectedPinCollapsed(true); }, [selectedPin?.id]);

  return <div style={{ position: "relative", height: "calc(100vh - var(--top-h) - var(--nav-h))", marginTop: "-12px", overflow: "hidden" }}>
    <MapLibreView ref={mapRef} center={mapCenter} zoom={13} pitch={is3D ? 48 : 0} bearing={is3D ? -14 : 0} height="100%" borderRadius={0} onLoad={handleMapLoad} />
    <div style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 50 }}>
      <PageTabs label="Explore sections" active={activeTab} tabs={TABS} onChange={setSection} />
      <div style={{ position: "relative", marginBottom: 7 }}><Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input data-page-search autoFocus className="finput" style={{ paddingLeft: 34, paddingRight: 34, background: "rgba(8,8,16,.9)" }} placeholder={`Search ${EXPLORE_CATEGORIES.find(category => category.id === activeHotspotCategory)?.label} by name or area…`} value={hotspotQuery} onChange={event => setHotspotQuery(event.target.value)} /><button aria-label="Clear hotspot search" onClick={() => setHotspotQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "var(--muted2)", cursor: "pointer" }}><X size={14} /></button></div>
      {activeHotspotCategory && hotspotQuery.trim() && <div className="ios-glass" style={{ marginBottom: 7, padding: 5, maxHeight: 180, overflowY: "auto" }}>{categoryResults.map(pin => <button key={pin.id} onClick={() => { setMapCenter([pin.lat, pin.lon]); mapRef.current?.flyTo(pin.lon, pin.lat, 16); setSelectedPin(pin); }} style={{ width: "100%", padding: "8px 9px", display: "flex", textAlign: "left", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--white)", cursor: "pointer" }}><MapPin size={13} style={{ color: "var(--ready)", marginRight: 8, flexShrink: 0 }} /><span><b style={{ display: "block", fontSize: ".68rem" }}>{pin.name}</b><small style={{ color: "var(--muted2)" }}>{pin.locality || pin.subType || "Mapped place"}</small></span></button>)}{categoryResults.length === 0 && <p style={{ padding: 10, color: "var(--muted2)", fontSize: ".63rem" }}>No matches in this map area. Pan or zoom to search nearby.</p>}</div>}
      <div style={{ display: "inline-flex", padding: "5px 9px", borderRadius: 8, background: "rgba(8,8,16,.82)", border: "1px solid var(--border)", color: "var(--muted2)", fontSize: ".55rem" }}>{statusLabel}</div>
    </div>
    <button aria-label={is3D ? "Switch to 2D map" : "Switch to 3D map"} onClick={() => setIs3D(value => !value)} style={{ position: "absolute", right: 12, bottom: 28, zIndex: 60, width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border2)", background: "rgba(8,8,16,.82)", color: "var(--ready)", display: "grid", placeItems: "center" }}><Box size={17} /></button>

    <AnimatePresence>{selectedPin && <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 26, stiffness: 300 }} className="bpanel open" style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200, maxHeight: selectedPinCollapsed ? "20vh" : "50vh", overflowY: "auto", padding: "8px 1rem 1.5rem" }}>
      <button aria-label={selectedPinCollapsed ? "Expand place details" : "Collapse place details to show map"} onClick={() => setSelectedPinCollapsed(value => !value)} style={{ display: "block", width: "100%", padding: "3px 0 8px", color: "var(--muted2)", border: 0, background: "transparent", cursor: "pointer" }}><span style={{ display: "block", width: 38, height: 4, borderRadius: 99, background: "var(--muted)", margin: "0 auto 6px" }} />{selectedPinCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}><div><p style={{ fontFamily: "var(--font-display)", fontSize: ".95rem", fontWeight: 900 }}>{selectedPin.name}</p><p style={{ fontSize: ".68rem", color: "var(--ready)" }}>{EXPLORE_CATEGORIES.find(category => category.id === exploreCategory(selectedPin))?.label || "Place"}{selectedPin.subType ? ` · ${selectedPin.subType}` : ""}</p></div><button className="icon-btn" onClick={() => setSelectedPin(null)}><X size={15} /></button></div>
      {!selectedPinCollapsed && <>
      {(selectedPin.locality || selectedPin.county) && <p style={{ fontSize: ".65rem", color: "var(--muted2)", marginBottom: 7 }}>{[selectedPin.locality, selectedPin.county].filter(Boolean).join(", ")}</p>}
      {selectedPin.openingHours && <p style={{ display: "flex", gap: 6, alignItems: "center", fontSize: ".65rem", color: "var(--muted2)", marginBottom: 7 }}><Clock size={12} />{selectedPin.openingHours}</p>}
      {(selectedPin.floor || selectedPin.unit) && <p style={{ fontSize: ".65rem", color: "var(--muted2)", marginBottom: 7 }}>{[selectedPin.floor, selectedPin.unit].filter(Boolean).join(" · ")}</p>}
      {selectedPin.notes && <p style={{ fontSize: ".7rem", color: "var(--muted2)", marginBottom: 9 }}>{selectedPin.notes}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}><button className="btn btn-go" style={{ width: "100%" }} onClick={() => { sessionStorage.setItem("ma3_destination", JSON.stringify({ name: selectedPin.name, lat: selectedPin.lat, lon: selectedPin.lon })); void startMatatuDirections(selectedPin); setLocation("/ma3"); }}><Bus size={13} /> Plan by Ma3</button><button className="btn btn-ready" style={{ width: "100%" }} onClick={() => { sessionStorage.setItem("ma3_fly_destination", JSON.stringify({ name: selectedPin.name, lat: selectedPin.lat, lon: selectedPin.lon })); setLocation("/fly"); }}><Navigation size={13} /> Travel options</button></div>
      </>}
    </motion.div>}</AnimatePresence>
  </div>;
}
