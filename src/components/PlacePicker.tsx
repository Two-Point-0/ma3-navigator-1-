import { useEffect, useMemo, useState } from "react";
import { Crosshair, MapPin, Navigation, TrainFront, Map as MapIcon, Landmark } from "lucide-react";
import { toast } from "sonner";
import { KIND_LABEL, Place, searchMapPlaces, searchPlaces } from "@/lib/places";

interface Props {
  /** What the person typed (or the name of the place they chose). */
  text: string;
  onText: (value: string) => void;
  onPlace: (place: Place) => void;
  placeholder: string;
  /** Colour of the little marker: green for Start, red for Stop. */
  color: string;
  /** If given, a "Tap on map" button appears and this is called when it is pressed. */
  onPickOnMap?: () => void;
  autoFocus?: boolean;
  pageSearch?: boolean;
}

const iconFor = (kind: Place["kind"], color: string) => {
  const props = { size: 12, style: { color, flexShrink: 0 } as const };
  if (kind === "rail") return <TrainFront {...props} />;
  if (kind === "landmark") return <Landmark {...props} />;
  if (kind === "me") return <Crosshair {...props} />;
  return <MapPin {...props} />;
};

/** One start/stop box used everywhere: type a name, use your location, or tap the map. */
export default function PlacePicker({ text, onText, onPlace, placeholder, color, onPickOnMap, autoFocus, pageSearch }: Props) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const local = useMemo(() => searchPlaces(text), [text]);
  const [remote, setRemote] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  // Not found in our own lists? Ask the free map search, so any place in Nairobi and around can be typed.
  useEffect(() => {
    setRemote([]);
    if (!open || text.trim().length < 3 || local.length >= 4) { setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => { void searchMapPlaces(text, controller.signal).then(found => { if (!controller.signal.aborted) { setRemote(found); setSearching(false); } }); }, 450);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [text, open, local.length]);
  const results = useMemo(() => {
    const seen = new Set(local.map(place => place.name.toLowerCase()));
    return [...local, ...remote.filter(place => !seen.has(place.name.toLowerCase()))].slice(0, 10);
  }, [local, remote]);

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast("Location is not available in this browser."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setLocating(false);
      onPlace({ id: "me", kind: "me", name: "My location", lat: position.coords.latitude, lon: position.coords.longitude });
    }, () => { setLocating(false); toast("Allow location access, or type a place or tap the map instead."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  };

  const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 99, background: "var(--glass2)", border: "1px solid var(--border)", color: "var(--muted2)", fontSize: ".6rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };

  return (
    <div>
      <div style={{ position: "relative" }}>
        <Navigation size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color, zIndex: 1 }} />
        <input className="finput" style={{ paddingLeft: 32 }} value={text} placeholder={placeholder} autoFocus={autoFocus}
          {...(pageSearch ? { "data-page-search": true } : {})}
          onChange={event => onText(event.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)} />
        {open && (results.length > 0 || searching) && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 3, background: "#0c0c18", border: "1px solid var(--border2)", borderRadius: 11, overflow: "hidden", zIndex: 100, maxHeight: 220, overflowY: "auto" }}>
            {results.map(place => (
              <button key={place.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onPlace(place); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 12px", fontSize: ".72rem", color: "var(--white)", background: "transparent", border: "none", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                {iconFor(place.kind, color)}
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</span>
                <span style={{ fontSize: ".52rem", color: "var(--muted)", letterSpacing: ".06em", textTransform: "uppercase" }}>{KIND_LABEL[place.kind]}</span>
              </button>
            ))}
            {searching && <div style={{ padding: "8px 12px", fontSize: ".6rem", color: "var(--muted2)" }}>Searching the map…</div>}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
        <button type="button" style={chip} onClick={useMyLocation} disabled={locating}><Crosshair size={11} /> {locating ? "Finding you…" : "My location"}</button>
        {onPickOnMap && <button type="button" style={chip} onClick={onPickOnMap}><MapIcon size={11} /> Tap on map</button>}
      </div>
    </div>
  );
}
