import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import maplibregl from "maplibre-gl";
import { MapPin, X, Box, Navigation, Search, Utensils, BedDouble, Landmark, Clock, Bus, Car, ArrowLeft, ExternalLink, Image as ImageIcon, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import PageTabs, { TabTone } from "@/components/PageTabs";
import PosterModal, { type PosterData } from "@/components/PosterModal";
import { useSheet } from "@/lib/useSheet";
import { fitAboveSheet } from "@/lib/mapLayers";
import { BusinessPin, PinCategory, PIN_CATEGORY_META } from "@/data/ma3_core";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { iconMarker, placeIconFor } from "@/lib/placeIcons";
import { sightPin, KIND_ICON } from "@/lib/sightIcons";
import { sightPoster, rowPoster, fetchPlacePoster, POSTER_COLUMNS, type PlacePosterRow } from "@/lib/posters";
import { SIGHTS, KIND_LABEL, searchSights, sightById, type SightEntry, type SightKind } from "@/data/sights";

const NAIROBI: [number, number] = [-1.2864, 36.8172];
type ExploreTab = "food" | "stay_shop" | "places";
type FeedStatus = "loading" | "ready" | "disconnected" | "error" | "zoom";
const TABS = [{ id: "food", label: "Food", Icon: Utensils }, { id: "stay_shop", label: "Stay", Icon: BedDouble }, { id: "places", label: "Sights", Icon: Landmark }] as const;
const TAB_TEXT: Record<ExploreTab, { title: string; hint: string }> = {
  food: { title: "Food & drink", hint: "Search food, a cafe or a place" },
  stay_shop: { title: "Stay & shop", hint: "Search hotels, lodges, shops" },
  places: { title: "Sights", hint: "Search parks, museums, beaches" },
};
const KIND_CHIPS: { id: SightKind | "all"; label: string }[] = [
  { id: "all", label: "All" }, { id: "park", label: "National parks" }, { id: "reserve", label: "Reserves" }, { id: "museum", label: "Museums" }, { id: "heritage", label: "Heritage" },
  { id: "beach", label: "Beaches" }, { id: "lake", label: "Lakes" }, { id: "mountain", label: "Mountains" }, { id: "wildlife", label: "Wildlife" }, { id: "culture", label: "Culture" },
];
function exploreCategory(pin: BusinessPin): ExploreTab {
  if (pin.category === "food") return "food";
  if (pin.category === "stay" || pin.category === "shop" || pin.category === "thrift") return "stay_shop";
  return "places";
}
const validCategories = new Set(Object.keys(PIN_CATEGORY_META));
const niceName = (value: string) => value.replace(/_/g, " ");
const shortName = (name: string) => name.replace(/ National (Park|Reserve)| Reserve| Conservancy/, "");

function toPin(row: any): BusinessPin {
  return {
    id: String(row.osm_id), name: row.name || "Unnamed place", category: validCategories.has(row.category) ? row.category as PinCategory : "other",
    subType: row.subtype || undefined, lat: Number(row.latitude), lon: Number(row.longitude), county: row.county || undefined, locality: row.locality || undefined,
    openingHours: row.opening_hours || undefined, notes: undefined, addedBy: "OpenStreetMap",
  };
}
function posterPin(row: PlacePosterRow): BusinessPin {
  return { id: row.place_ref, name: row.title, category: validCategories.has(row.category ?? "") ? row.category as PinCategory : "other", subType: row.subtype || undefined, lat: Number(row.lat), lon: Number(row.lon), locality: row.address || undefined, notes: undefined, addedBy: "Ma3" };
}

function drawPinMarkers(map: maplibregl.Map, pins: BusinessPin[], markers: React.MutableRefObject<Map<string, maplibregl.Marker>>, onTap: (pin: BusinessPin) => void) {
  const keep = new Set(pins.map(pin => pin.id));
  markers.current.forEach((marker, id) => { if (!keep.has(id)) { marker.remove(); markers.current.delete(id); } });
  pins.forEach(pin => {
    if (markers.current.has(pin.id)) return;
    const meta = PIN_CATEGORY_META[pin.category] ?? PIN_CATEGORY_META.other;
    markers.current.set(pin.id, iconMarker(map, pin.lat, pin.lon, placeIconFor(pin.category, pin.subType), meta.color, `${pin.name} · ${meta.label}`, () => onTap(pin), { size: 30 }));
  });
}

function Row({ index, icon: Icon, title, sub, onClick }: { index: number; icon: typeof MapPin; title: string; sub?: string; onClick: () => void }) {
  return <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.025, duration: .18 }} onClick={onClick}
    style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", textAlign: "left", padding: "9px 8px", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", color: "var(--white)", cursor: "pointer" }}>
    <Icon size={16} style={{ color: "var(--ready)", flexShrink: 0 }} />
    <span style={{ minWidth: 0 }}><b style={{ display: "block", fontSize: ".72rem" }}>{title}</b>{sub && <small style={{ color: "var(--muted2)", fontSize: ".58rem" }}>{sub}</small>}</span>
  </motion.button>;
}

export default function ExplorePage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<ExploreTab | null>(null);
  const [pois, setPois] = useState<BusinessPin[]>([]);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>(isSupabaseConfigured ? "ready" : "disconnected");
  const [query, setQuery] = useState("");
  const [remoteHits, setRemoteHits] = useState<BusinessPin[]>([]);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [kind, setKind] = useState<SightKind | "all">("all");
  const [selectedPin, setSelectedPin] = useState<BusinessPin | null>(null);
  const [sightEntry, setSightEntry] = useState<SightEntry | null>(null);
  const [posterRow, setPosterRow] = useState<PlacePosterRow | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(NAIROBI);
  const sheet = useSheet("peek");
  const mapRef = useRef<MapLibreHandle>(null);
  const mapInst = useRef<maplibregl.Map | null>(null);
  const pinMarkers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const sightMarker = useRef<maplibregl.Marker | null>(null);
  const requestId = useRef(0);
  const moveListener = useRef<(() => void) | null>(null);
  const activeTab = useRef<ExploreTab | null>(null);
  const groupColumn = useRef(true);

  const loadViewport = useCallback(async (map: maplibregl.Map) => {
    const current = ++requestId.current;
    const group = activeTab.current;
    if (!group) { setPois([]); return; }
    if (!isSupabaseConfigured || !supabase) { setFeedStatus("disconnected"); setPois([]); return; }
    if (map.getZoom() < 8) { setFeedStatus("zoom"); setPois([]); return; }
    setFeedStatus("loading");
    const bounds = map.getBounds();
    const rows: any[] = [];
    const pageSize = 500;
    for (let offset = 0; offset < 2500; offset += pageSize) {
      const build = (withGroup: boolean) => {
        let request = supabase!.from("explore_pois").select("osm_id,name,category,subtype,latitude,longitude,county,locality,opening_hours")
          .gte("latitude", bounds.getSouth()).lte("latitude", bounds.getNorth()).gte("longitude", bounds.getWest()).lte("longitude", bounds.getEast());
        if (withGroup) request = request.eq("explore_group", group);
        return request.order("name").range(offset, offset + pageSize - 1);
      };
      let { data, error } = await build(groupColumn.current);
      if (error && groupColumn.current && /explore_group/i.test(error.message)) { groupColumn.current = false; ({ data, error } = await build(false)); }
      if (current !== requestId.current) return;
      if (error) { setFeedStatus("error"); setPois([]); return; }
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    if (current !== requestId.current) return;
    setPois(rows.map(toPin));
    setFeedStatus(rows.length >= 2500 ? "zoom" : "ready");
  }, []);

  const tabPois = useMemo(() => pois.filter(pin => !tab || exploreCategory(pin) === tab), [pois, tab]);
  const subtypeChips = useMemo(() => {
    const counts = new Map<string, number>();
    tabPois.forEach(pin => { const key = pin.subType ?? "other"; counts.set(key, (counts.get(key) ?? 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  }, [tabPois]);

  // Pins appear ONLY for a type the person picked, or the one place they opened. The map starts empty.
  const pinsToDraw = useMemo(() => {
    const [lat, lon] = mapCenter;
    const near = (items: BusinessPin[]) => [...items].sort((a, b) => Math.hypot(a.lat - lat, a.lon - lon) - Math.hypot(b.lat - lat, b.lon - lon)).slice(0, 150);
    const list = subtype ? near(tabPois.filter(pin => (pin.subType ?? "other") === subtype)) : [];
    if (selectedPin && !list.some(pin => pin.id === selectedPin.id)) list.push(selectedPin);
    return list;
  }, [tabPois, subtype, selectedPin, mapCenter]);
  useEffect(() => { if (mapInst.current) drawPinMarkers(mapInst.current, pinsToDraw, pinMarkers, selectPlace); }, [pinsToDraw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search: what is already loaded, plus a name search across the whole list.
  useEffect(() => {
    const q = query.trim();
    if (!tab || tab === "places" || q.length < 1 || !supabase || !isSupabaseConfigured) { setRemoteHits([]); return; }
    let dead = false;
    const timer = window.setTimeout(async () => {
      const [a, b] = await Promise.all([
        supabase!.from("explore_pois").select("osm_id,name,category,subtype,latitude,longitude,county,locality,opening_hours").ilike("name", `${q.replace(/[%_,]/g, " ")}%`).limit(25),
        supabase!.from("place_posters").select(POSTER_COLUMNS).eq("active", true).ilike("title", `%${q.replace(/[%_,]/g, " ")}%`).not("lat", "is", null).limit(8),
      ]);
      if (dead) return;
      const found = [...((b.data ?? []) as PlacePosterRow[]).map(posterPin), ...(a.data ?? []).map(toPin)];
      setRemoteHits(found.filter(pin => exploreCategory(pin) === tab));
    }, 220);
    return () => { dead = true; window.clearTimeout(timer); };
  }, [query, tab]);

  const placeHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const all = [...remoteHits, ...tabPois.filter(pin => `${pin.name} ${pin.subType ?? ""}`.toLowerCase().includes(q))].filter(pin => !seen.has(pin.id) && seen.add(pin.id));
    const rank = (pin: BusinessPin) => pin.name.toLowerCase().startsWith(q) ? 0 : pin.name.toLowerCase().split(/\s+/).some(word => word.startsWith(q)) ? 1 : 2;
    return all.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 12);
  }, [remoteHits, tabPois, query]);
  const typeHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? subtypeChips.filter(([name]) => niceName(name).includes(q)).slice(0, 5) : [];
  }, [subtypeChips, query]);
  const sightList = useMemo((): SightEntry[] => {
    if (query.trim()) return searchSights(query, 14);
    return SIGHTS.filter(sight => kind === "all" || sight.kind === kind).sort((a, b) => b.fame - a.fame || a.name.localeCompare(b.name));
  }, [query, kind]);

  const handleMapLoad = (map: maplibregl.Map) => {
    mapInst.current = map;
    if (import.meta.env.DEV) (window as unknown as { __map?: maplibregl.Map }).__map = map;
    const load = () => { const c = map.getCenter(); setMapCenter([c.lat, c.lng]); void loadViewport(map); };
    moveListener.current = load;
    map.on("moveend", load);
    const wanted = new URLSearchParams(window.location.search).get("sight");
    const found = wanted ? sightById(wanted) : undefined;
    if (found) window.setTimeout(() => { pickSight(found); setPosterOpen(true); }, 0);
  };
  useEffect(() => () => {
    requestId.current++;
    if (mapInst.current && moveListener.current) mapInst.current.off("moveend", moveListener.current);
    pinMarkers.current.forEach(marker => marker.remove());
    sightMarker.current?.remove();
  }, []);
  useEffect(() => { mapInst.current?.easeTo({ pitch: is3D ? 48 : 0, bearing: is3D ? -14 : 0, duration: 600 }); }, [is3D]);

  const pickSight = (entry: SightEntry) => {
    setSelectedPin(null); setPosterRow(null); setSightEntry(entry); setPosterOpen(false);
    sheet.setSnap("half");
    mapRef.current?.flyTo(entry.lon, entry.lat, entry.parentId ? 12 : 9);
  };
  useEffect(() => {
    sightMarker.current?.remove(); sightMarker.current = null;
    if (!sightEntry || !mapInst.current) return;
    sightMarker.current = sightPin(mapInst.current, sightEntry, sightEntry.gateName ?? shortName(sightEntry.name), () => setPosterOpen(true));
    return () => { sightMarker.current?.remove(); sightMarker.current = null; };
  }, [sightEntry]);

  function selectPlace(pin: BusinessPin) {
    setSightEntry(null); setSelectedPin(pin); setPosterRow(null); setPosterOpen(false);
    sheet.setSnap("half");
    if (mapInst.current) fitAboveSheet(mapInst.current, [[pin.lon, pin.lat]], Math.round(window.innerHeight * 0.3), 16);
    void fetchPlacePoster(pin.id).then(row => { if (row) { setPosterRow(row); setPosterOpen(true); } });
  }
  const setSection = (value: string) => {
    const next = value as ExploreTab;
    setTab(next); activeTab.current = next;
    setQuery(""); setSubtype(null); setKind("all"); setPois([]); setSelectedPin(null); setSightEntry(null); setPosterRow(null); setPosterOpen(false);
    sheet.setSnap("half");
    if (mapInst.current) void loadViewport(mapInst.current);
  };
  const closeAll = () => { setTab(null); activeTab.current = null; setQuery(""); setSubtype(null); setSelectedPin(null); setSightEntry(null); setPosterOpen(false); setPois([]); };
  const backToList = () => { setSelectedPin(null); setSightEntry(null); setPosterRow(null); setPosterOpen(false); };

  const goTo = (key: string, target: { name: string; lat: number; lon: number }, page: string, tabName?: string) => {
    sessionStorage.setItem(key, JSON.stringify({ ...(tabName ? { tab: tabName } : {}), ...target }));
    if (key === "ma3_destination" && selectedPin?.addedBy === "OpenStreetMap" && supabase) {
      void (async () => {
        let user = (await supabase!.auth.getUser()).data.user;
        if (!user) { const { data, error } = await supabase!.auth.signInAnonymously(); if (error || !data.user) return; user = data.user; }
        const { data } = await supabase!.rpc("record_nganya_poi_navigation", { p_osm_id: selectedPin.id });
        if (Number(data) > 0) toast("Directions started · +5 community points.");
      })();
    }
    setLocation(page);
  };

  // What the open poster shows.
  const detailTarget = sightEntry ? { name: sightEntry.name, lat: sightEntry.lat, lon: sightEntry.lon } : selectedPin ? { name: selectedPin.name, lat: selectedPin.lat, lon: selectedPin.lon } : null;
  const poster: PosterData | null = sightEntry ? sightPoster(sightEntry) : posterRow && selectedPin ? rowPoster(posterRow, placeIconFor(selectedPin.category, selectedPin.subType)) : null;
  const parentSight = sightEntry ? SIGHTS.find(sight => sight.id === (sightEntry.parentId ?? sightEntry.id)) : undefined;
  const travelButtons = detailTarget && <>
    <button className="btn btn-go" style={{ width: "100%" }} onClick={() => goTo("ma3_destination", detailTarget, "/ma3")}><Bus size={14} /> Plan by Ma3</button>
    <button className="btn btn-ready" style={{ width: "100%" }} onClick={() => goTo("ndai_destination", detailTarget, "/ndai", "ride")}><Car size={14} /> Plan by Ndai</button>
    {sightEntry && <button className="btn btn-ghost" style={{ width: "100%" }} onClick={() => goTo("ma3_fly_destination", detailTarget, "/fly")}><Navigation size={14} /> Flights & SGR</button>}
    {(parentSight?.website ?? posterRow?.website) && <a className="btn btn-ghost" style={{ display: "flex", justifyContent: "center", gap: 6 }} href={(parentSight?.website ?? posterRow?.website)!} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Website</a>}
  </>;
  const gateList = parentSight?.gates && parentSight.gates.length > 0 && <div style={{ margin: "8px 0 4px" }}>
    <small style={{ color: "#94a3b8", fontSize: ".58rem", textTransform: "uppercase", letterSpacing: ".05em" }}>Entrances</small>
    {parentSight.gates.map(gate => <button key={gate.id} onClick={() => { const next = sightById(`${parentSight.id}--${gate.id}`); if (next) { pickSight(next); setPosterOpen(true); } }}
      style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", textAlign: "left", padding: "9px 2px", border: 0, borderBottom: "1px solid #ffffff1f", background: "transparent", color: "#f8fafc", cursor: "pointer" }}>
      <DoorOpen size={15} style={{ color: "#fbbf24", flexShrink: 0 }} /><span><b style={{ display: "block", fontSize: ".72rem" }}>{gate.name}</b><small style={{ color: "#94a3b8", fontSize: ".58rem" }}>{gate.note}</small></span></button>)}
  </div>;

  const tabTone: TabTone = !tab ? "idle" : tab === "places" ? "go" : feedStatus === "ready" ? "go" : feedStatus === "loading" || feedStatus === "zoom" ? "ready" : "stop";
  const statusLabel = tab === "places" ? "" : feedStatus === "loading" ? "Loading…" : feedStatus === "disconnected" || feedStatus === "error" ? "Places are not available right now" : feedStatus === "zoom" ? "Zoom in to see more" : "";
  const inDetail = Boolean(sightEntry || selectedPin);
  const sheetShown = Boolean(tab || inDetail);
  useEffect(() => { if (!sheetShown) sheet.setSnap("peek"); }, [sheetShown]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div style={{ position: "relative", height: "calc(100dvh - var(--top-h) - var(--nav-h))", marginTop: "-12px", overflow: "hidden" }}>
    <MapLibreView ref={mapRef} center={NAIROBI} zoom={13} height="100%" borderRadius={0} onLoad={handleMapLoad} />
    <div style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 50 }}>
      <PageTabs label="Explore sections" tone={tabTone} active={tab ?? ""} tabs={TABS} onChange={setSection} />
    </div>
    <button aria-label={is3D ? "Switch to 2D map" : "Switch to 3D map"} onClick={() => setIs3D(value => !value)} style={{ position: "absolute", right: 12, top: 66, zIndex: 40, width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border2)", background: "rgba(8,8,16,.82)", color: "var(--ready)", display: "grid", placeItems: "center" }}><Box size={17} /></button>

    <div {...sheet.panelProps} style={{ ...sheet.panelProps.style, display: sheetShown ? undefined : "none" }}>
      <div className="bpanel-head" style={{ padding: "2px 14px 8px" }}>
        <button {...sheet.gripProps} />
        {inDetail ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          {tab && <button className="icon-btn" aria-label="Back to results" onClick={backToList}><ArrowLeft size={15} /></button>}
          <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontFamily: "var(--font-display)", fontSize: ".95rem", fontWeight: 900, lineHeight: 1.2 }}>{sightEntry ? sightEntry.name : selectedPin!.name}</p></div>
          <button className="icon-btn" aria-label="Close" onClick={() => { backToList(); if (!tab) sheet.setSnap("peek"); }}><X size={15} /></button>
        </div> : tab && <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: ".95rem", fontWeight: 900 }}>{TAB_TEXT[tab].title}</p>
            <button className="icon-btn" aria-label="Close" onClick={closeAll}><X size={15} /></button>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ready)", zIndex: 1, pointerEvents: "none" }} />
            <input aria-label={TAB_TEXT[tab].hint} className="finput" style={{ paddingLeft: 34 }} placeholder={TAB_TEXT[tab].hint} value={query} onChange={event => setQuery(event.target.value)} onFocus={() => sheet.setSnap("full")} />
          </div>
          {statusLabel && <p style={{ margin: "6px 2px 0", fontSize: ".56rem", color: "var(--muted2)" }}>{statusLabel}</p>}
        </div>}
      </div>
      <div className="bpanel-scroll" style={{ padding: "0 14px 20px" }}>
        {inDetail ? <>
          {sightEntry ? <>
            <p style={{ fontSize: ".66rem", color: "var(--ready)", marginBottom: 6 }}>{KIND_LABEL[sightEntry.kind]} · {sightEntry.county}{sightEntry.gateName ? ` · ${sightEntry.gateName}` : ""}</p>
            <p style={{ fontSize: ".72rem", lineHeight: 1.5, marginBottom: 10 }}>{sightEntry.summary}</p>
          </> : <>
            <p style={{ fontSize: ".66rem", color: "var(--muted2)", marginBottom: 6 }}>{[selectedPin!.subType && niceName(selectedPin!.subType), selectedPin!.locality, selectedPin!.county].filter(Boolean).join(" · ")}</p>
            {selectedPin!.openingHours && <p style={{ display: "flex", gap: 6, alignItems: "center", fontSize: ".66rem", color: "var(--muted2)", marginBottom: 8 }}><Clock size={12} />{selectedPin!.openingHours}</p>}
          </>}
          <div style={{ display: "grid", gap: 7 }}>
            {poster && <button className="btn btn-go" style={{ width: "100%" }} onClick={() => setPosterOpen(true)}><ImageIcon size={14} /> Open poster</button>}
            {travelButtons}
          </div>
        </> : tab === "places" ? <>
          {!query.trim() && <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>{KIND_CHIPS.map(chip => <button key={chip.id} className={`btn ${kind === chip.id ? "btn-ready" : "btn-ghost"}`} style={{ padding: "5px 11px", fontSize: ".62rem", flexShrink: 0, whiteSpace: "nowrap" }} onClick={() => setKind(chip.id)}>{chip.label}</button>)}</div>}
          <AnimatePresence mode="popLayout">
            {sightList.map((entry, index) => <Row key={entry.id} index={index} icon={KIND_ICON[entry.kind]} title={entry.name} sub={entry.gateName ? `Entrance · ${entry.county}` : `${KIND_LABEL[entry.kind]} · ${entry.county}`} onClick={() => pickSight(entry)} />)}
          </AnimatePresence>
          {query.trim() && sightList.length === 0 && <p style={{ color: "var(--muted2)", fontSize: ".64rem", padding: 8 }}>No match. Try the first letters of the name.</p>}
        </> : tab ? <>
          {query.trim() ? <>
            {typeHits.map(([name, count], index) => { const TypeIcon = placeIconFor(null, name); return <Row key={`t-${name}`} index={index} icon={TypeIcon} title={`All ${niceName(name)}`} sub={`${count} nearby · show on map`} onClick={() => { setSubtype(name); setQuery(""); sheet.setSnap("half"); }} />; })}
            {placeHits.map((pin, index) => <Row key={pin.id} index={index + typeHits.length} icon={placeIconFor(pin.category, pin.subType)} title={pin.name} sub={[pin.subType && niceName(pin.subType), pin.locality || pin.county].filter(Boolean).join(" · ")} onClick={() => selectPlace(pin)} />)}
            {!typeHits.length && !placeHits.length && <p style={{ color: "var(--muted2)", fontSize: ".64rem", padding: 8 }}>No match. Try the first letters of the name.</p>}
          </> : <>
            {subtypeChips.length > 0 ? <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {subtypeChips.map(([name, count]) => { const ChipIcon = placeIconFor(null, name); return <button key={name} className={`btn ${subtype === name ? "btn-ready" : "btn-ghost"}`} style={{ padding: "6px 11px", fontSize: ".62rem", whiteSpace: "nowrap", display: "inline-flex", gap: 5, alignItems: "center" }} onClick={() => setSubtype(subtype === name ? null : name)}><ChipIcon size={12} />{niceName(name)} · {count}</button>; })}
              </div>
              {subtype && <p style={{ fontSize: ".6rem", color: "var(--muted2)", marginTop: 8 }}>Showing {niceName(subtype)} on the map. Tap a pin for details.</p>}
            </> : <p style={{ color: "var(--muted2)", fontSize: ".66rem", lineHeight: 1.5 }}>{feedStatus === "zoom" ? "Zoom in on the map to see what is nearby." : "Move the map to an area to see the types of places there."}</p>}
          </>}
        </> : null}
      </div>
    </div>
    <PosterModal poster={posterOpen ? poster : null} onClose={() => setPosterOpen(false)} actions={travelButtons}>{gateList}</PosterModal>
  </div>;
}
