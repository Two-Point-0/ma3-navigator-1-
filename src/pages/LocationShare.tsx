import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Link2, MapPin, Navigation, Power, ShieldCheck, UserRound, Wifi, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type maplibregl from "maplibre-gl";
import MapLibreView, { type MapLibreHandle } from "@/components/MapLibreView";
import PageTabs from "@/components/PageTabs";
import { useAuthContext } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type PairRow = { id: string; member_one: string; member_two: string; created_at: string };
type LocationRow = { user_id: string; latitude: number; longitude: number; accuracy_m: number; updated_at: string };
type PointFeature = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { kind: "you" | "paired"; label: string } };
type PointCollection = { type: "FeatureCollection"; features: PointFeature[] };

const TABS = [
  { id: "pair", label: "Pair", Icon: Link2 },
  { id: "share", label: "Share", Icon: Navigation },
  { id: "map", label: "Map", Icon: MapPin },
] as const;
const EMPTY_FEATURES: PointCollection = { type: "FeatureCollection", features: [] };
const NAIROBI: [number, number] = [-1.286389, 36.817223];
const isFresh = (updatedAt: string) => Date.now() - new Date(updatedAt).getTime() <= 90_000;
const shortId = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;

export default function LocationSharePage() {
  const { user, loading: authLoading } = useAuthContext();
  const [activeTab, setActiveTab] = useState("pair");
  const [pairs, setPairs] = useState<PairRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [stateLoading, setStateLoading] = useState(true);
  const [shareError, setShareError] = useState("");
  const [invite, setInvite] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [ownPoint, setOwnPoint] = useState<LocationRow | null>(null);
  const mapRef = useRef<MapLibreHandle>(null);
  const pointDataRef = useRef<PointCollection>(EMPTY_FEATURES);
  const lastWriteAtRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!supabase || !user?.id) return;
    const { data: pairData, error: pairError } = await supabase
      .from("ma3_location_share_pairs")
      .select("id,member_one,member_two,created_at")
      .or(`member_one.eq.${user.id},member_two.eq.${user.id}`)
      .order("created_at", { ascending: true });
    if (pairError) { setShareError(pairError.message); return; }
    setPairs((pairData ?? []) as PairRow[]);
    const { data: locationData, error: locationError } = await supabase
      .from("ma3_live_locations")
      .select("user_id,latitude,longitude,accuracy_m,updated_at");
    if (locationError) { setShareError(locationError.message); return; }
    setLocations((locationData ?? []) as LocationRow[]);
    setShareError("");
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setPairs([]); setLocations([]); setStateLoading(false); return; }
    let live = true;
    const load = async () => {
      setStateLoading(true);
      await refresh();
      if (live) setStateLoading(false);
    };
    void load();
    const channel = supabase.channel(`ma3-private-locations-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ma3_live_locations" }, () => { void refresh(); })
      .subscribe();
    return () => {
      live = false;
      void supabase?.removeChannel(channel);
    };
  }, [authLoading, user?.id, refresh]);

  const pairedIds = useMemo(() => pairs.map(pair => pair.member_one === user?.id ? pair.member_two : pair.member_one), [pairs, user?.id]);
  const visibleLocations = useMemo(() => locations.filter(row => isFresh(row.updated_at)), [locations]);
  const peerLocations = useMemo(() => visibleLocations.filter(row => row.user_id !== user?.id && pairedIds.includes(row.user_id)), [visibleLocations, user?.id, pairedIds]);
  const ownVisiblePoint = sharing ? ownPoint : visibleLocations.find(row => row.user_id === user?.id) ?? null;
  const center: [number, number] = ownVisiblePoint
    ? [ownVisiblePoint.latitude, ownVisiblePoint.longitude]
    : peerLocations[0] ? [peerLocations[0].latitude, peerLocations[0].longitude] : NAIROBI;

  const updateMapData = useCallback((own: LocationRow | null, peers: LocationRow[]) => {
    const features: PointFeature[] = [];
    if (own && isFresh(own.updated_at)) features.push({
      type: "Feature", geometry: { type: "Point", coordinates: [own.longitude, own.latitude] }, properties: { kind: "you", label: "Your phone" },
    });
    for (const point of peers) features.push({
      type: "Feature", geometry: { type: "Point", coordinates: [point.longitude, point.latitude] }, properties: { kind: "paired", label: "Paired phone" },
    });
    pointDataRef.current = { type: "FeatureCollection", features };
    const map = mapRef.current?.getMap();
    const source = map?.getSource("ma3-paired-live-locations") as maplibregl.GeoJSONSource | undefined;
    source?.setData(pointDataRef.current as never);
  }, []);

  useEffect(() => { updateMapData(ownVisiblePoint, peerLocations); }, [ownVisiblePoint, peerLocations, updateMapData]);

  useEffect(() => {
    if (!sharing || !user?.id || !supabase || !navigator.geolocation) return;
    const client = supabase;
    let stopped = false;
    const publish = async (position: GeolocationPosition) => {
      const now = Date.now();
      const row: LocationRow = {
        user_id: user.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
        updated_at: new Date(now).toISOString(),
      };
      setOwnPoint(row);
      if (now - lastWriteAtRef.current < 10_000) return;
      lastWriteAtRef.current = now;
      const { error } = await client.from("ma3_live_locations").upsert({
        user_id: row.user_id,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy_m: row.accuracy_m,
      }, { onConflict: "user_id" });
      if (error && !stopped) {
        setShareError(error.message);
        setSharing(false);
      }
    };
    const watchId = navigator.geolocation.watchPosition(
      position => { void publish(position); },
      error => {
        if (stopped) return;
        setShareError(error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow location for this site in phone settings, then try again."
          : error.message || "The phone could not read its location.");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      setOwnPoint(null);
      void supabase?.from("ma3_live_locations").delete().eq("user_id", user.id);
    };
  }, [sharing, user?.id]);

  const createInvite = async () => {
    if (!supabase) return;
    setBusy(true); setShareError("");
    const { data, error } = await supabase.rpc("create_ma3_location_share_invite");
    setBusy(false);
    if (error) { setShareError(error.message); return; }
    setInvite(String(data ?? ""));
  };

  const acceptInvite = async () => {
    if (!supabase) return;
    setBusy(true); setShareError("");
    const { data, error } = await supabase.rpc("accept_ma3_location_share_invite", { p_token: inviteInput.trim().toLowerCase() });
    setBusy(false);
    if (error) { setShareError(error.message); return; }
    setInviteInput("");
    toast(`Paired with account ${shortId(String(data))}`);
    await refresh();
  };

  const revokePair = async (otherUserId: string) => {
    if (!supabase) return;
    setBusy(true); setShareError("");
    const { error } = await supabase.rpc("revoke_ma3_location_share_pair", { p_other_user_id: otherUserId });
    setBusy(false);
    if (error) { setShareError(error.message); return; }
    setSharing(false);
    toast("Location-sharing connection removed");
    await refresh();
  };

  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(invite); toast("One-time invite copied"); }
    catch { toast("Copy is unavailable; select and copy the invite code"); }
  };

  const startSharing = () => {
    if (!supabase || !isSupabaseConfigured) { setShareError("Connect this app to Supabase and apply the location-sharing migration first."); return; }
    if (!pairedIds.length) { setShareError("Pair with the other phone before sharing a precise location."); setActiveTab("pair"); return; }
    if (!navigator.geolocation) { setShareError("This browser does not provide location services."); return; }
    setShareError("");
    setSharing(true);
  };

  if (authLoading) return <div className="inner" style={{ paddingTop: 24, color: "var(--muted2)" }}>Loading account…</div>;

  return <div className="inner" style={{ paddingTop: 12, paddingBottom: 22 }}>
    <PageTabs label="Location sharing" active={activeTab} tabs={TABS} onChange={setActiveTab} />
    <header style={{ padding: "16px 2px 12px" }}>
      <p className="sec-label">Private two-phone test</p>
      <h1 style={{ margin: 0, fontSize: "1.45rem", display: "flex", alignItems: "center", gap: 9 }}><Navigation size={22} style={{ color: "var(--go)" }} /> Share location</h1>
      <p style={{ margin: "8px 0 0", color: "var(--muted2)", fontSize: ".74rem", lineHeight: 1.55 }}>
        Pair these accounts first. Each phone then chooses independently whether to share its live GPS position; only explicitly paired accounts can see it.
      </p>
    </header>

    {!isSupabaseConfigured && <div className="card" style={{ padding: 14, marginBottom: 12, borderLeft: "3px solid var(--ready)" }}><b>Backend setup needed</b><p style={{ margin: "6px 0 0", color: "var(--muted2)", fontSize: ".72rem", lineHeight: 1.5 }}>This feature uses Supabase Auth, Realtime and the migration <code>20261107_private_location_sharing.sql</code>. It does not fall back to demo or local-storage coordinates.</p></div>}

    {!user && <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <p style={{ margin: "0 0 10px", color: "var(--muted2)", fontSize: ".76rem", lineHeight: 1.55 }}>Sign in on both phones with separate Supabase accounts before pairing. For a quick sandbox check you can use guest accounts; verify OTP later if testing the phone-number sign-in flow.</p>
      <Link href="/login"><button className="btn btn-ready">Sign in or create guest account</button></Link>
    </div>}

    <div className="card" style={{ padding: 14, marginBottom: 12, display: "flex", gap: 9, alignItems: "flex-start", borderLeft: "3px solid var(--go)" }}>
      <ShieldCheck size={17} style={{ color: "var(--go)", flexShrink: 0, marginTop: 2 }} />
      <p style={{ margin: 0, color: "var(--muted2)", fontSize: ".68rem", lineHeight: 1.5 }}><b style={{ color: "var(--white)" }}>Privacy controls:</b> a one-time invite is valid for 15 minutes; location is never public, no location history is kept, peer positions stop being readable after 90 seconds without an update, and either account can disconnect at any time. Sharing stops when you leave this page or press Stop.</p>
    </div>

    {shareError && <div role="alert" className="card" style={{ padding: 12, marginBottom: 12, borderLeft: "3px solid var(--stop)", color: "var(--muted2)", fontSize: ".72rem" }}><AlertTriangle size={15} style={{ color: "var(--stop)", verticalAlign: "middle", marginRight: 7 }} />{shareError}</div>}

    {activeTab === "pair" && <section className="card" style={{ padding: 16 }}>
      <p className="sec-label">Step 1 · Connect your two accounts</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 12 }}>
        <div className="ios-glass" style={{ padding: 14 }}>
          <h2 style={{ fontSize: ".9rem", margin: "0 0 6px" }}>On the first phone</h2>
          <p style={{ margin: "0 0 12px", color: "var(--muted2)", fontSize: ".68rem", lineHeight: 1.5 }}>Create a one-time code, then send it privately to the other phone. Anyone holding it can request a pair during its 15-minute lifetime.</p>
          <button className="btn btn-ready" type="button" disabled={!user || !isSupabaseConfigured || busy} onClick={() => void createInvite()}><Link2 size={14} />{busy ? "Working…" : "Create pairing code"}</button>
          {invite && <div style={{ marginTop: 12 }}><label htmlFor="location-invite-code">One-time code · expires in 15 minutes</label><div style={{ display: "flex", gap: 6 }}><input id="location-invite-code" className="finput" readOnly value={invite} style={{ fontFamily: "var(--font-mono)", fontSize: ".68rem" }} /><button className="btn btn-go" type="button" onClick={() => void copyInvite()} aria-label="Copy pairing code"><Copy size={15} /></button></div></div>}
        </div>
        <div className="ios-glass" style={{ padding: 14 }}>
          <h2 style={{ fontSize: ".9rem", margin: "0 0 6px" }}>On the second phone</h2>
          <p style={{ margin: "0 0 12px", color: "var(--muted2)", fontSize: ".68rem", lineHeight: 1.5 }}>Sign in as the second account, paste the code from the first phone, and accept. Pairing alone does not start location sharing.</p>
          <label htmlFor="location-invite-input">Paste pairing code</label>
          <input id="location-invite-input" className="finput" autoComplete="off" spellCheck={false} value={inviteInput} onChange={event => setInviteInput(event.target.value)} placeholder="48-character code" />
          <button className="btn btn-go" type="button" disabled={!user || !isSupabaseConfigured || busy || inviteInput.trim().length !== 48} style={{ marginTop: 9 }} onClick={() => void acceptInvite()}><Check size={14} />Accept and pair</button>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <p className="sec-label">Paired accounts ({pairs.length})</p>
        {stateLoading ? <p style={{ color: "var(--muted2)", fontSize: ".7rem" }}>Checking connections…</p> : pairs.length === 0
          ? <p style={{ color: "var(--muted2)", fontSize: ".7rem" }}>No phones are paired yet.</p>
          : <div style={{ display: "grid", gap: 7 }}>{pairs.map(pair => {
            const peerId = pair.member_one === user?.id ? pair.member_two : pair.member_one;
            return <div key={pair.id} className="ios-glass" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px" }}>
              <UserRound size={16} style={{ color: "var(--go)" }} /><span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: ".7rem" }}>{shortId(peerId)}</span>
              <button className="btn btn-stop" type="button" disabled={busy} onClick={() => void revokePair(peerId)}>Disconnect</button>
            </div>;
          })}</div>}
        <p style={{ color: "var(--muted)", fontSize: ".6rem", lineHeight: 1.45 }}>Account IDs are shown in shortened form; phone numbers are not exposed by this feature. Anyone you pair with can see your precise current position while you are sharing.</p>
      </div>
    </section>}

    {activeTab === "share" && <section className="card" style={{ padding: 16 }}>
      <p className="sec-label">Step 2 · Choose on this phone</p>
      <h2 style={{ fontSize: "1rem", margin: "0 0 6px" }}>Your location sharing</h2>
      <p style={{ color: "var(--muted2)", fontSize: ".72rem", lineHeight: 1.5, margin: "0 0 14px" }}>GPS permission is requested only after you press Start. While enabled, this page sends the latest phone location to Supabase about every 10 seconds; stopping or leaving the page clears your row. Keep this tab open while testing.</p>
      {sharing
        ? <button className="btn btn-stop" type="button" style={{ width: "100%" }} onClick={() => setSharing(false)}><Power size={15} />Stop sharing this phone</button>
        : <button className="btn btn-go" type="button" style={{ width: "100%" }} disabled={!user || !isSupabaseConfigured || pairedIds.length === 0} onClick={startSharing}><Power size={15} />Start sharing this phone</button>}
      {!pairedIds.length && <p style={{ margin: "9px 0 0", color: "var(--ready)", fontSize: ".67rem" }}>Pair the other phone first. Both accounts have their own Start and Stop control.</p>}
      <div className="ios-glass" style={{ marginTop: 14, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {sharing ? <Wifi size={16} style={{ color: "var(--go)" }} /> : <WifiOff size={16} style={{ color: "var(--muted2)" }} />}
          <b style={{ fontSize: ".75rem" }}>{sharing ? "This phone is sharing" : "This phone is not sharing"}</b>
        </div>
        <p style={{ margin: "7px 0 0", color: "var(--muted2)", fontSize: ".67rem", fontFamily: "var(--font-mono)" }}>{ownPoint && sharing ? `${ownPoint.latitude.toFixed(6)}, ${ownPoint.longitude.toFixed(6)} · ±${Math.round(ownPoint.accuracy_m)} m` : "No live coordinates are being sent"}</p>
      </div>
      <div style={{ marginTop: 14 }}><p className="sec-label">Paired phone status</p>{pairedIds.length === 0 ? <p style={{ color: "var(--muted2)", fontSize: ".7rem" }}>No paired phone.</p> : pairedIds.map(peerId => {
        const peer = peerLocations.find(row => row.user_id === peerId);
        return <div key={peerId} className="ios-glass" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", marginTop: 6 }}><span style={{ fontFamily: "var(--font-mono)", fontSize: ".67rem" }}>{shortId(peerId)}</span><span style={{ color: peer ? "var(--go)" : "var(--muted2)", fontSize: ".65rem" }}>{peer ? `Sharing · ±${Math.round(peer.accuracy_m)} m` : "Not sharing / stale"}</span></div>;
      })}</div>
    </section>}

    {activeTab === "map" && <section className="card" style={{ padding: 12 }}>
      <p className="sec-label" style={{ padding: "3px 4px 8px" }}>Latest shared positions · auto-updating</p>
      <MapLibreView ref={mapRef} center={center} zoom={ownVisiblePoint || peerLocations.length ? 14 : 11} height={380} borderRadius={14} onLoad={(map) => {
        map.addSource("ma3-paired-live-locations", { type: "geojson", data: pointDataRef.current } as maplibregl.GeoJSONSourceSpecification);
        map.addLayer({
          id: "ma3-paired-live-location-points", type: "circle", source: "ma3-paired-live-locations",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5, 15, 10],
            "circle-color": ["match", ["get", "kind"], "you", "#22c55e", "#38bdf8"],
            "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
          },
        });
      }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 3px 2px" }}>
        <span style={{ color: "var(--go)", fontSize: ".66rem" }}>● Your phone {ownVisiblePoint ? `· ±${Math.round(ownVisiblePoint.accuracy_m)} m` : "· not sharing"}</span>
        {peerLocations.map(point => <span key={point.user_id} style={{ color: "#38bdf8", fontSize: ".66rem" }}>● Paired phone {shortId(point.user_id)} · ±{Math.round(point.accuracy_m)} m</span>)}
      </div>
      {!peerLocations.length && <p style={{ margin: "8px 3px 2px", color: "var(--muted2)", fontSize: ".68rem" }}>No paired phone is sharing a fresh position. Ask that phone to open Share and press Start.</p>}
    </section>}

    <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}><Link href="/profile"><button className="btn btn-ready"><UserRound size={14} />Account & sign-in settings</button></Link></div>
  </div>;
}
