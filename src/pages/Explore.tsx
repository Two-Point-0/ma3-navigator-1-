import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import maplibregl from "maplibre-gl";
import {
  MapPin, X, Star, Plus, Box, Navigation, Search,
  Utensils, ShoppingBag, Music, Wrench, Bus, Drama,
  Coffee, Fish, Beef, Salad, Wine, Camera, Hash, Clock,
} from "lucide-react";
import { toast } from "sonner";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import { BusinessPin, PinCategory, PIN_CATEGORY_META, SEED_PINS } from "@/data/ma3_core";

const NAIROBI: [number, number] = [-1.2864, 36.8172];

// Icon per subcategory
function subIcon(cat: PinCategory, sub?: string): string {
  const s = (sub ?? "").toLowerCase();
  if (cat === "food") {
    if (s.includes("nyama") || s.includes("beef") || s.includes("choma")) return "🥩";
    if (s.includes("fish") || s.includes("tilapia")) return "🐟";
    if (s.includes("pilau") || s.includes("biryani") || s.includes("rice")) return "🍚";
    if (s.includes("pizza")) return "🍕";
    if (s.includes("burger")) return "🍔";
    if (s.includes("coffee") || s.includes("cafe")) return "☕";
    if (s.includes("chicken")) return "🍗";
    return "🍖";
  }
  if (cat === "thrift") {
    if (s.includes("fabric") || s.includes("textile")) return "🧵";
    if (s.includes("fashion") || s.includes("clothing") || s.includes("mitumba")) return "👗";
    return "👕";
  }
  if (cat === "entertainment") {
    if (s.includes("reggae") || s.includes("rasta")) return "🌿";
    if (s.includes("rhumba") || s.includes("congolese")) return "💃";
    if (s.includes("band") || s.includes("live")) return "🎸";
    if (s.includes("jazz")) return "🎷";
    if (s.includes("afro")) return "🎵";
    if (s.includes("comedy")) return "🎭";
    return "🎶";
  }
  if (cat === "culture") {
    if (s.includes("reggae")) return "🌿";
    if (s.includes("rhumba")) return "💃";
    if (s.includes("afro")) return "🎵";
    if (s.includes("benga")) return "🎸";
    if (s.includes("coastal") || s.includes("taarab")) return "🌊";
    return "🎭";
  }
  if (cat === "service") {
    if (s.includes("supermarket") || s.includes("grocery")) return "🛒";
    if (s.includes("hospital") || s.includes("clinic") || s.includes("pharmacy")) return "🏥";
    if (s.includes("mpesa") || s.includes("bank") || s.includes("atm")) return "💳";
    return "🔧";
  }
  if (cat === "transport") return "🚌";
  return "📍";
}

// Draw pin markers with emoji icons directly on the map
function drawPinMarkers(
  map: maplibregl.Map,
  pins: BusinessPin[],
  filters: Set<PinCategory>,
  markers: React.MutableRefObject<Map<string, maplibregl.Marker>>,
  onTap: (p: BusinessPin) => void
) {
  // Remove markers no longer visible
  markers.current.forEach((m, id) => {
    const pin = pins.find(p => p.id === id);
    if (!pin || !filters.has(pin.category)) {
      m.remove();
      markers.current.delete(id);
    }
  });

  // Add new markers
  pins.filter(p => filters.has(p.category)).forEach(pin => {
    if (markers.current.has(pin.id)) return;
    const meta = PIN_CATEGORY_META[pin.category];
    const icon = subIcon(pin.category, pin.subType);
    const el = document.createElement("div");
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">
        <div style="width:34px;height:34px;border-radius:50%;background:${meta.color};border:2.5px solid rgba(255,255,255,.85);
          display:flex;align-items:center;justify-content:center;font-size:15px;
          box-shadow:0 3px 10px rgba(0,0,0,.45);transition:transform .15s">
          ${icon}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
          border-top:6px solid ${meta.color};margin-top:-1px"></div>
      </div>`;
    el.addEventListener("click", (e) => { e.stopPropagation(); onTap(pin); });
    el.addEventListener("mouseenter", () => (el.querySelector("div div") as HTMLElement).style.transform = "scale(1.2)");
    el.addEventListener("mouseleave", () => (el.querySelector("div div") as HTMLElement).style.transform = "scale(1)");
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([pin.lon, pin.lat]).addTo(map);
    markers.current.set(pin.id, marker);
  });
}

const CATEGORY_ICONS: Record<PinCategory, React.ElementType> = {
  food: Utensils, thrift: ShoppingBag, entertainment: Music, culture: Drama, service: Wrench, transport: Bus,
};

export default function ExplorePage() {
  const [pins, setPins] = useState<BusinessPin[]>(SEED_PINS);
  const [filters, setFilters] = useState<Set<PinCategory>>(new Set(Object.keys(PIN_CATEGORY_META) as PinCategory[]));
  const [selectedPin, setSelectedPin] = useState<BusinessPin | null>(null);
  const [placing, setPlacing] = useState(false);
  const [pendingCoord, setPendingCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [is3D, setIs3D] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(NAIROBI);
  const [searchQ, setSearchQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<PinCategory>("food");
  const [newSub, setNewSub] = useState("");
  const [newFloor, setNewFloor] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const mapRef = useRef<MapLibreHandle>(null);
  const mapInst = useRef<maplibregl.Map | null>(null);
  const pinMarkers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const pendingMarker = useRef<maplibregl.Marker | null>(null);

  const visiblePins = useMemo(() => {
    const q = searchQ.toLowerCase();
    return pins.filter(p =>
      filters.has(p.category) &&
      (!q || p.name.toLowerCase().includes(q) || (p.subType ?? "").toLowerCase().includes(q))
    );
  }, [pins, filters, searchQ]);

  useEffect(() => {
    if (!mapInst.current) return;
    drawPinMarkers(mapInst.current, visiblePins, filters, pinMarkers, setSelectedPin);
  }, [visiblePins, filters]);

  const handleMapLoad = (map: maplibregl.Map) => {
    mapInst.current = map;
    drawPinMarkers(map, visiblePins, filters, pinMarkers, setSelectedPin);
  };

  const handleMapClick = (lng: number, lat: number) => {
    if (!placing) return;
    setPendingCoord({ lat, lon: lng });
    // Move pending marker
    if (pendingMarker.current) { pendingMarker.current.remove(); pendingMarker.current = null; }
    if (mapInst.current) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:${PIN_CATEGORY_META[newCat].color};border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:14px;animation:dot-pulse 1.2s infinite">${subIcon(newCat)}</div>`;
      pendingMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(mapInst.current);
    }
    toast("📍 Location set — fill in details below");
  };

  const toggleFilter = (cat: PinCategory) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const savePin = () => {
    if (!pendingCoord) { toast("Tap the map first to drop a pin"); return; }
    if (!newName.trim()) { toast("Give your spot a name"); return; }
    const pin: BusinessPin = {
      id: `u${Date.now()}`, name: newName.trim(), category: newCat,
      subType: newSub.trim() || undefined,
      lat: pendingCoord.lat, lon: pendingCoord.lon,
      floor: newFloor.trim() || undefined,
      unit: newUnit.trim() || undefined,
      notes: newNotes.trim() || undefined,
      addedBy: "You", rating: 0, votes: 0,
    };
    setPins(p => [...p, pin]);
    setFilters(prev => new Set([...prev, newCat]));
    cancelPlacing();
    toast(`✅ ${pin.name} added to the map!`);
    setMapCenter([pin.lat, pin.lon]);
  };

  const cancelPlacing = () => {
    setPlacing(false); setPendingCoord(null);
    if (pendingMarker.current) { pendingMarker.current.remove(); pendingMarker.current = null; }
    setNewName(""); setNewSub(""); setNewFloor(""); setNewUnit(""); setNewNotes("");
  };

  const navigateTo = (pin: BusinessPin) => {
    setMapCenter([pin.lat, pin.lon]);
    setSelectedPin(null);
    if (mapRef.current) mapRef.current.flyTo(pin.lon, pin.lat, 16);
    toast(`🧭 Showing ${pin.name}`);
  };

  return (
    <div style={{ position: "relative", height: "calc(100vh - var(--top-h) - var(--nav-h))", marginTop: "-12px", overflow: "hidden" }}>

      {/* Full-screen map */}
      <MapLibreView
        ref={mapRef}
        center={mapCenter}
        zoom={13}
        pitch={is3D ? 52 : 0}
        bearing={is3D ? -16 : 0}
        height="100%"
        borderRadius={0}
        onLoad={handleMapLoad}
        onClick={handleMapClick}
      />

      {/* Top overlay */}
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 50 }}>
        {/* Header row */}
        <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 12, background: "rgba(8,8,16,.8)", backdropFilter: "blur(16px)", border: "1px solid var(--border2)" }}>
            <MapPin size={14} style={{ color: "var(--ready)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: ".82rem", fontWeight: 900 }}>Explore</span>
            <span style={{ fontSize: ".62rem", color: "var(--muted)" }}>{visiblePins.length} spots</span>
          </div>
          <button onClick={() => setShowSearch(s => !s)}
            style={{ padding: "8px 12px", borderRadius: 12, background: showSearch ? "rgba(217,119,6,.18)" : "rgba(8,8,16,.8)", backdropFilter: "blur(16px)", border: `1px solid ${showSearch ? "rgba(217,119,6,.45)" : "var(--border2)"}`, color: showSearch ? "var(--ready)" : "var(--muted2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font)", fontWeight: 700, fontSize: ".7rem" }}>
            <Search size={13} />
          </button>
          <button onClick={() => setIs3D(d => !d)}
            style={{ padding: "8px 12px", borderRadius: 12, background: is3D ? "rgba(59,130,246,.18)" : "rgba(8,8,16,.8)", backdropFilter: "blur(16px)", border: `1px solid ${is3D ? "rgba(59,130,246,.45)" : "var(--border2)"}`, color: is3D ? "#3b82f6" : "var(--muted2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font)", fontWeight: 700, fontSize: ".7rem" }}>
            <Box size={13} /> 3D
          </button>
          <button onClick={placing ? cancelPlacing : () => setPlacing(true)}
            style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 12, backdropFilter: "blur(16px)", border: `1px solid ${placing ? "rgba(220,38,38,.45)" : "rgba(217,119,6,.35)"}`, background: placing ? "rgba(220,38,38,.18)" : "rgba(217,119,6,.15)", color: placing ? "var(--stop)" : "var(--ready)", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".7rem", display: "flex", alignItems: "center", gap: 5 }}>
            {placing ? <X size={13} /> : <Plus size={13} />} {placing ? "Cancel" : "Add Pin"}
          </button>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginBottom: 7 }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} />
                <input className="finput" style={{ paddingLeft: 32, background: "rgba(8,8,16,.85)", backdropFilter: "blur(16px)" }}
                  placeholder="Search spots by name or type…"
                  value={searchQ} onChange={e => setSearchQ(e.target.value)} autoFocus />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category filters */}
        <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none" }}>
          {(Object.entries(PIN_CATEGORY_META) as [PinCategory, typeof PIN_CATEGORY_META[PinCategory]][]).map(([cat, meta]) => {
            const Icon = CATEGORY_ICONS[cat];
            const on = filters.has(cat);
            return (
              <button key={cat} onClick={() => toggleFilter(cat)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 99, flexShrink: 0, backdropFilter: "blur(14px)", border: `1px solid ${on ? meta.color + "55" : "rgba(255,255,255,.12)"}`, background: on ? `${meta.color}18` : "rgba(8,8,16,.75)", color: on ? meta.color : "var(--muted2)", fontFamily: "var(--font)", fontWeight: 700, fontSize: ".66rem", cursor: "pointer", transition: ".15s" }}>
                <Icon size={11} /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pin placement instructions */}
      <AnimatePresence>
        {placing && !pendingCoord && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "absolute", bottom: 110, left: 12, right: 12, zIndex: 100, padding: "12px 14px", borderRadius: 14, background: "rgba(217,119,6,.15)", backdropFilter: "blur(16px)", border: "1px solid rgba(217,119,6,.35)", textAlign: "center" }}>
            <p style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--ready)" }}>👆 Tap the exact location on the map</p>
            <p style={{ fontSize: ".63rem", color: "var(--muted2)", marginTop: 3 }}>For multi-store buildings, mark the same spot — add floor & unit number in the form.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New pin form */}
      <AnimatePresence>
        {pendingCoord && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200, background: "rgba(10,10,20,.97)", backdropFilter: "blur(20px)", border: "1px solid var(--border2)", borderRadius: "22px 22px 0 0", padding: "1rem 1rem 1.8rem", maxHeight: "72vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: ".9rem", fontWeight: 900 }}>📍 Mark Your Spot</p>
              <button onClick={cancelPlacing} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: ".6rem", color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 12 }}>
              {pendingCoord.lat.toFixed(5)}, {pendingCoord.lon.toFixed(5)}
            </p>

            <label>Spot / Business Name *</label>
            <input className="finput" style={{ marginBottom: 10 }} placeholder="e.g. Mama Njeri's Nyama Choma" value={newName} onChange={e => setNewName(e.target.value)} />

            <label style={{ marginBottom: 6 }}>Category *</label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {(Object.entries(PIN_CATEGORY_META) as [PinCategory, typeof PIN_CATEGORY_META[PinCategory]][]).map(([cat, meta]) => (
                <button key={cat} onClick={() => setNewCat(cat)}
                  style={{ padding: "6px 12px", borderRadius: 99, border: `1px solid ${newCat === cat ? meta.color + "55" : "var(--border)"}`, background: newCat === cat ? `${meta.color}18` : "var(--glass)", color: newCat === cat ? meta.color : "var(--muted2)", fontSize: ".66rem", fontWeight: 700, cursor: "pointer", transition: ".15s" }}>
                  {subIcon(cat)} {meta.label}
                </button>
              ))}
            </div>

            <label>Specialty / Type (optional)</label>
            <input className="finput" style={{ marginBottom: 10 }} placeholder="e.g. Nyama Choma, Reggae Night, Mitumba" value={newSub} onChange={e => setNewSub(e.target.value)} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <label>Floor (multi-storey)</label>
                <input className="finput" placeholder="e.g. 2nd Floor" value={newFloor} onChange={e => setNewFloor(e.target.value)} />
              </div>
              <div>
                <label>Shop / Unit No.</label>
                <input className="finput" placeholder="e.g. Suite 14A" value={newUnit} onChange={e => setNewUnit(e.target.value)} />
              </div>
            </div>

            <label>Notes (optional)</label>
            <input className="finput" style={{ marginBottom: 14 }} placeholder="What makes it special?" value={newNotes} onChange={e => setNewNotes(e.target.value)} />

            <button className="btn btn-primary" style={{ width: "100%", padding: 13, justifyContent: "center", fontSize: ".84rem" }} onClick={savePin}>
              <MapPin size={15} /> Drop Pin on Map
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pin detail popup */}
      <AnimatePresence>
        {selectedPin && !pendingCoord && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200, background: "rgba(10,10,20,.97)", backdropFilter: "blur(20px)", border: "1px solid var(--border2)", borderRadius: "22px 22px 0 0", padding: "1rem 1rem 1.6rem" }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border2)", margin: "0 auto 14px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: `${PIN_CATEGORY_META[selectedPin.category].color}18`, border: `1.5px solid ${PIN_CATEGORY_META[selectedPin.category].color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                  {subIcon(selectedPin.category, selectedPin.subType)}
                </div>
                <div>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: ".95rem", fontWeight: 900 }}>{selectedPin.name}</p>
                  <p style={{ fontSize: ".68rem", color: PIN_CATEGORY_META[selectedPin.category].color }}>
                    {selectedPin.subType || PIN_CATEGORY_META[selectedPin.category].label}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedPin(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {(selectedPin.floor || selectedPin.unit) && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {selectedPin.floor && <span className="chip" style={{ background: "var(--glass2)", border: "1px solid var(--border2)" }}>🏢 {selectedPin.floor}</span>}
                {selectedPin.unit && <span className="chip" style={{ background: "var(--glass2)", border: "1px solid var(--border2)" }}>🚪 {selectedPin.unit}</span>}
              </div>
            )}
            {selectedPin.eventTime && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Clock size={12} style={{ color: "var(--ready)" }} />
                <span style={{ fontSize: ".72rem", color: "var(--ready)", fontWeight: 700 }}>{selectedPin.eventTime}</span>
                {selectedPin.genre && <span className="chip" style={{ background: "rgba(217,119,6,.1)", border: "1px solid rgba(217,119,6,.25)", color: "var(--ready)" }}>{selectedPin.genre}</span>}
              </div>
            )}
            {selectedPin.notes && <p style={{ fontSize: ".74rem", color: "var(--muted2)", marginBottom: 10, lineHeight: 1.5 }}>{selectedPin.notes}</p>}
            {(selectedPin.rating ?? 0) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Star size={14} style={{ color: "var(--ready)", fill: "var(--ready)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", fontWeight: 700, color: "var(--ready)" }}>{selectedPin.rating}</span>
                <span style={{ fontSize: ".65rem", color: "var(--muted)" }}>({selectedPin.votes} votes)</span>
              </div>
            )}
            <button className="btn btn-go" style={{ width: "100%", padding: 12, justifyContent: "center" }} onClick={() => navigateTo(selectedPin)}>
              <Navigation size={15} /> Navigate Here
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
