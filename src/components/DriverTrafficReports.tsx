import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { AlertTriangle, Clock3, MapPin, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import MapLibreView from "@/components/MapLibreView";
import { useAuthContext } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type IssueType = "pothole" | "collision" | "police_checkpoint" | "roadworks" | "flooding" | "obstruction" | "congestion" | "other";
type TrafficReport = {
  id: string;
  route_id: string;
  issue_type: IssueType;
  note: string;
  latitude: number;
  longitude: number;
  created_at: string;
  expires_at: string;
};
type PendingPoint = { latitude: number; longitude: number };

const ISSUE_OPTIONS: { value: IssueType; label: string; marker: string; colour: string }[] = [
  { value: "pothole", label: "Pothole / damaged road", marker: "P", colour: "#f59e0b" },
  { value: "collision", label: "Crash / collision", marker: "A", colour: "#ef4444" },
  { value: "police_checkpoint", label: "Police / traffic checkpoint", marker: "C", colour: "#8b5cf6" },
  { value: "roadworks", label: "Roadworks", marker: "W", colour: "#f97316" },
  { value: "flooding", label: "Flooding / water", marker: "F", colour: "#3b82f6" },
  { value: "obstruction", label: "Obstruction / debris", marker: "O", colour: "#dc2626" },
  { value: "congestion", label: "Heavy congestion", marker: "T", colour: "#d97706" },
  { value: "other", label: "Other road hazard", marker: "!", colour: "#14b8a6" },
];
const REPORT_SELECT = "id,route_id,issue_type,note,latitude,longitude,created_at,expires_at";
const shapes = MA3_GTFS.shapes as unknown as Record<string, [number, number][]>;

function makePointCollection(reports: TrafficReport[], pending: PendingPoint | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = reports.map(report => {
    const type = ISSUE_OPTIONS.find(option => option.value === report.issue_type);
    return {
      type: "Feature",
      properties: { id: report.id, issue_type: report.issue_type, marker: type?.marker ?? "!", colour: type?.colour ?? "#14b8a6" },
      geometry: { type: "Point", coordinates: [report.longitude, report.latitude] },
    };
  });
  if (pending) features.push({
    type: "Feature",
    properties: { id: "pending", issue_type: "pending", marker: "?", colour: "#ffffff" },
    geometry: { type: "Point", coordinates: [pending.longitude, pending.latitude] },
  });
  return { type: "FeatureCollection", features };
}

export default function DriverTrafficReports({ routeId, routeName }: { routeId: string; routeName: string }) {
  const { user, loading } = useAuthContext();
  const [canReport, setCanReport] = useState(false);
  const [checking, setChecking] = useState(true);
  const [accessMessage, setAccessMessage] = useState("");
  const [reports, setReports] = useState<TrafficReport[]>([]);
  const [placeMode, setPlaceMode] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
  const [issueType, setIssueType] = useState<IssueType>("pothole");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const placeModeRef = useRef(false);
  const selectPointRef = useRef<(point: PendingPoint) => void>(() => undefined);
  const routeCoordinates = shapes[routeId] ?? [];

  const center = useMemo<[number, number]>(() => {
    if (!routeCoordinates.length) return [-1.2864, 36.8172];
    const total = routeCoordinates.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
    return [total[0] / routeCoordinates.length, total[1] / routeCoordinates.length];
  }, [routeId]);

  useEffect(() => { placeModeRef.current = placeMode; }, [placeMode]);
  useEffect(() => {
    selectPointRef.current = point => {
      setPendingPoint(point);
      setPlaceMode(false);
      setAccessMessage("Route point selected. Choose the issue type, then submit the report.");
    };
  }, []);

  useEffect(() => {
    let active = true;
    setCanReport(false);
    setReports([]);
    setChecking(true);
    if (loading) return () => { active = false; };
    if (!isSupabaseConfigured || !supabase) {
      setAccessMessage("Traffic reporting is ready after Supabase is connected and the traffic-report migration is applied.");
      setChecking(false);
      return () => { active = false; };
    }
    if (!user) {
      setAccessMessage("Sign in with a verified driver account approved for this route to report or view traffic issues.");
      setChecking(false);
      return () => { active = false; };
    }
    if (!user.phone_confirmed_at) {
      setAccessMessage("Verify this account’s phone number before reporting route issues.");
      setChecking(false);
      return () => { active = false; };
    }
    const client = supabase;
    void client.from("ma3_driver_profiles").select("status,route_ids").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAccessMessage("Could not check route approval. Confirm Supabase migrations and sign-in, then retry.");
        else if (data?.status === "approved" && (data.route_ids as string[] | null)?.includes(routeId)) {
          setCanReport(true);
          setAccessMessage("Only verified drivers approved for this route can create or view reports. Reports expire automatically from the live map.");
        } else setAccessMessage("This account is not approved for the selected route. Ask the project administrator to approve the driver and route first.");
        setChecking(false);
      });
    return () => { active = false; };
  }, [loading, user?.id, user?.phone_confirmed_at, routeId]);

  const refreshReports = useCallback(async () => {
    const client = supabase;
    if (!client || !isSupabaseConfigured || !canReport) return;
    const { data, error } = await client.from("ma3_traffic_reports").select(REPORT_SELECT)
      .eq("route_id", routeId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
    if (error) {
      setAccessMessage("Could not load route reports. Check that the traffic-report migration has been applied.");
      return;
    }
    setReports((data ?? []) as unknown as TrafficReport[]);
  }, [canReport, routeId]);

  useEffect(() => {
    if (!canReport || !supabase) return;
    const client = supabase;
    void refreshReports();
    const channel = client.channel(`ma3-traffic-${routeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ma3_traffic_reports", filter: `route_id=eq.${routeId}` }, () => void refreshReports())
      .subscribe();
    const expiryTimer = window.setInterval(() => {
      setReports(current => current.filter(report => new Date(report.expires_at).getTime() > Date.now()));
      void refreshReports();
    }, 30_000);
    return () => { window.clearInterval(expiryTimer); void client.removeChannel(channel); };
  }, [canReport, routeId, refreshReports]);

  const pointCollection = useMemo(() => makePointCollection(reports, pendingPoint), [reports, pendingPoint]);
  const pointCollectionRef = useRef(pointCollection);
  pointCollectionRef.current = pointCollection;
  useEffect(() => {
    const source = mapRef.current?.getSource("driver-traffic-points") as maplibregl.GeoJSONSource | undefined;
    source?.setData(pointCollection);
  }, [pointCollection]);

  useEffect(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = placeMode ? "crosshair" : "";
  }, [placeMode]);

  const onMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    if (routeCoordinates.length >= 2) {
      const routeFeature: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature", properties: { route_id: routeId },
        geometry: { type: "LineString", coordinates: routeCoordinates.map(([lat, lon]) => [lon, lat]) },
      };
      map.addSource("driver-report-route-source", { type: "geojson", data: routeFeature });
      map.addLayer({
        id: "driver-report-route-casing", type: "line", source: "driver-report-route-source",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#071317", "line-width": 11, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "driver-report-route-line", type: "line", source: "driver-report-route-source",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#16a34a", "line-width": 6, "line-opacity": 0.95 },
      });
      map.on("click", "driver-report-route-line", event => {
        if (!placeModeRef.current) return;
        selectPointRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      });
      map.on("mouseenter", "driver-report-route-line", () => {
        if (placeModeRef.current) map.getCanvas().style.cursor = "crosshair";
      });
      map.on("mouseleave", "driver-report-route-line", () => {
        if (placeModeRef.current) map.getCanvas().style.cursor = "crosshair";
      });
      const lngs = routeCoordinates.map(point => point[1]);
      const lats = routeCoordinates.map(point => point[0]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 38, duration: 0 });
    }
    map.addSource("driver-traffic-points", { type: "geojson", data: pointCollectionRef.current });
    map.addLayer({
      id: "driver-traffic-report-dots", type: "circle", source: "driver-traffic-points",
      paint: {
        "circle-radius": ["case", ["==", ["get", "id"], "pending"], 10, 8],
        "circle-color": ["get", "colour"], "circle-stroke-width": 2, "circle-stroke-color": "#080810",
      },
    });
    map.addLayer({
      id: "driver-traffic-report-labels", type: "symbol", source: "driver-traffic-points",
      layout: { "text-field": ["get", "marker"], "text-size": 10, "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true },
      paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,.6)", "text-halo-width": 1 },
    });
  }, [routeId, routeCoordinates]);

  const startPlacement = () => {
    setPendingPoint(null);
    setNote("");
    setPlaceMode(true);
    setAccessMessage("Tap directly on the highlighted route line to place the report. Submit only when safely stopped.");
  };

  const submitReport = async () => {
    const client = supabase;
    if (!client || !canReport || !pendingPoint) return;
    setSaving(true);
    const { error } = await client.from("ma3_traffic_reports").insert({
      route_id: routeId,
      issue_type: issueType,
      note: note.trim(),
      latitude: pendingPoint.latitude,
      longitude: pendingPoint.longitude,
    });
    setSaving(false);
    if (error) {
      setAccessMessage(error.message.includes("limit") ? error.message : "Report could not be sent. Check connection and route approval, then try again.");
      return;
    }
    toast("Road issue reported to approved drivers on this route");
    setPendingPoint(null);
    setNote("");
    setAccessMessage("Report sent. It is not an official emergency or road-service notice.");
    await refreshReports();
  };

  const routeLabel = routeName || routeId;
  const validShape = routeCoordinates.length >= 2;
  const policeSelected = issueType === "police_checkpoint";

  return <section className="card" style={{ padding: 16, marginTop: 12, borderTop: "3px solid var(--ready)" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
      <div><p className="sec-label">Driver road reports</p><h2 style={{ fontSize: "1rem", margin: 0 }}>Route issues · {routeLabel}</h2></div>
      <span className="chip" style={{ background: "rgba(217,119,6,.12)", color: "var(--ready)", border: "1px solid rgba(217,119,6,.28)" }}><MapPin size={12} /> Driver reports</span>
    </div>
    <p style={{ fontSize: ".66rem", lineHeight: 1.5, color: "var(--muted2)", margin: "8px 0 10px" }}>
      Use only when safely stopped. Tap <b>+</b>, then tap the green route line where the issue is. Choose a type and submit; don’t operate the phone while driving.
    </p>
    {validShape ? <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border2)" }}>
      <MapLibreView key={routeId} center={center} zoom={11} height={300} borderRadius={14} onLoad={onMapLoad} />
      <button type="button" className={`gbtn${placeMode ? " on" : ""}`} aria-label={placeMode ? "Cancel route point selection" : "Add a road report"}
        onClick={() => placeMode ? setPlaceMode(false) : startPlacement()}
        disabled={!canReport || checking}
        style={{ position: "absolute", top: 10, right: 10, zIndex: 5, background: placeMode ? "rgba(217,119,6,.94)" : "rgba(8,8,16,.9)", color: "#fff", borderColor: "rgba(255,255,255,.35)", padding: "10px 14px", opacity: !canReport || checking ? .55 : 1 }}>
        {placeMode ? <X size={16} /> : <Plus size={17} />}{placeMode ? "Cancel" : "Report issue"}
      </button>
      {placeMode && <div role="status" style={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 5, padding: "8px 10px", borderRadius: 10, background: "rgba(8,8,16,.92)", color: "var(--white)", fontSize: ".64rem", textAlign: "center", border: "1px solid rgba(217,119,6,.5)" }}>Tap the highlighted green route line at the issue location</div>}
    </div> : <div className="ios-glass" style={{ padding: 14 }}><p style={{ margin: 0, fontSize: ".68rem", color: "var(--muted2)" }}>No bundled route line is available for this route, so map reporting is disabled.</p></div>}

    {pendingPoint && <div className="ios-glass" style={{ padding: 12, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><p className="sec-label" style={{ margin: 0 }}>New report point selected</p><button className="icon-btn" type="button" aria-label="Cancel report" onClick={() => setPendingPoint(null)}><X size={15} /></button></div>
      <label htmlFor="traffic-issue-type" style={{ marginTop: 10 }}>Issue type</label>
      <select id="traffic-issue-type" className="finput" value={issueType} onChange={event => setIssueType(event.target.value as IssueType)}>
        {ISSUE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <label htmlFor="traffic-issue-note" style={{ marginTop: 10 }}>Short note · optional</label>
      <input id="traffic-issue-note" className="finput" maxLength={140} value={note} onChange={event => setNote(event.target.value)} placeholder="Brief factual detail; no names or number plates" />
      {policeSelected && <p style={{ margin: "8px 0 0", fontSize: ".62rem", color: "var(--ready)", lineHeight: 1.45 }}>For road-safety awareness only. Do not use reports to evade law enforcement.</p>}
      <button type="button" className="btn btn-ready" disabled={saving} onClick={() => void submitReport()} style={{ width: "100%", marginTop: 11, opacity: saving ? .65 : 1 }}>
        <Send size={14} />{saving ? "Sending report…" : "Submit road report"}
      </button>
    </div>}

    {accessMessage && <p role="status" style={{ margin: "9px 0 0", fontSize: ".63rem", lineHeight: 1.5, color: accessMessage.includes("not approved") || accessMessage.includes("Could not") ? "var(--ready)" : "var(--muted2)" }}>{checking ? "Checking driver approval…" : accessMessage}</p>}
    {!canReport && !checking && <p style={{ margin: "5px 0 0", fontSize: ".58rem", lineHeight: 1.45, color: "var(--muted)" }}>Reports are private to verified, route-approved drivers; passenger accounts cannot read the report map.</p>}

    {canReport && <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}><Clock3 size={13} style={{ color: "var(--ready)" }} /><p className="sec-label" style={{ margin: 0, flex: 1 }}>Current route reports</p><span style={{ fontSize: ".58rem", color: "var(--muted2)" }}>Live · expires by type</span></div>
      {reports.length === 0 ? <p style={{ margin: 0, fontSize: ".64rem", color: "var(--muted2)" }}>No current reports on this route.</p> : <div style={{ display: "grid", gap: 6 }}>
        {reports.map(report => {
          const option = ISSUE_OPTIONS.find(item => item.value === report.issue_type);
          const minutes = Math.max(1, Math.ceil((new Date(report.expires_at).getTime() - Date.now()) / 60_000));
          return <div key={report.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 9px", borderRadius: 10, background: "var(--glass)", border: "1px solid var(--border)" }}>
            <span style={{ width: 23, height: 23, flexShrink: 0, borderRadius: 99, display: "grid", placeItems: "center", background: option?.colour ?? "var(--ready)", color: "#fff", fontWeight: 800, fontSize: ".65rem" }}>{option?.marker ?? "!"}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".65rem" }}>{option?.label ?? "Road hazard"}</b>{report.note && <small style={{ display: "block", marginTop: 2, fontSize: ".58rem", color: "var(--muted2)", overflowWrap: "anywhere" }}>{report.note}</small>}</span>
            <span style={{ fontSize: ".56rem", color: "var(--muted2)", whiteSpace: "nowrap" }}>{minutes}m left</span>
          </div>;
        })}
      </div>}
    </div>}
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 10, color: "var(--muted)", fontSize: ".57rem", lineHeight: 1.45 }}><AlertTriangle size={13} style={{ color: "var(--ready)", flexShrink: 0 }} /><span>Reports are driver-submitted, not verified emergency alerts. Avoid names, number plates and sensitive personal details. For immediate danger, use local emergency services and follow official road instructions.</span></div>
  </section>;
}
