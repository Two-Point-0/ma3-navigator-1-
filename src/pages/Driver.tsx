import { useEffect, useMemo, useState } from "react";
import { Activity, Bus, Car, CircleStop, MapPin, Navigation, Power, Users, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { ROLE_STORAGE_KEY, type Ma3Role } from "@/components/Onboarding";

const LOCATION_KEY = "ma3_demo_driver_location";
type DriverStatus = "offline" | "broadcasting";

type SharedLocation = { lat: number; lng: number; accuracy: number; updatedAt: string; driverType: "matatu-driver" | "carpool-driver"; seatsAvailable: number; routeLabel: string };
type DemoCoordinates = { latitude: number; longitude: number; accuracy: number };

function saveLocation(location: SharedLocation) { localStorage.setItem(LOCATION_KEY, JSON.stringify(location)); window.dispatchEvent(new CustomEvent("ma3-location-update", { detail: location })); }

export default function DriverPage() {
  const role = (localStorage.getItem(ROLE_STORAGE_KEY) || "matatu-driver") as Ma3Role;
  const driverType = role === "carpool-driver" ? "carpool-driver" : "matatu-driver";
  const [status, setStatus] = useState<DriverStatus>("offline");
  const [coords, setCoords] = useState<DemoCoordinates | null>(null);
  const [seats, setSeats] = useState(driverType === "matatu-driver" ? 14 : 3);
  const [routeLabel, setRouteLabel] = useState(driverType === "matatu-driver" ? "Demo route · CBD — Westlands" : "Planned carpool · Karen — CBD");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const icon = driverType === "matatu-driver" ? <Bus size={20} /> : <Car size={20} />;

  const demoCoords = useMemo(() => ({ latitude: -1.2864, longitude: 36.8172, accuracy: 25 }), []);
  useEffect(() => { if (status !== "broadcasting") return; const publish = (position?: GeolocationPosition) => { const c = position?.coords || demoCoords; setCoords(c); const stamp = new Date().toISOString(); saveLocation({ lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, updatedAt: stamp, driverType, seatsAvailable: seats, routeLabel }); setLastSent(stamp); }; publish(); const id = navigator.geolocation?.watchPosition(publish, () => publish(), { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }); const timer = window.setInterval(() => publish(), 10000); return () => { if (id !== undefined && navigator.geolocation) navigator.geolocation.clearWatch(id); window.clearInterval(timer); }; }, [status, seats, routeLabel, driverType, demoCoords]);

  const toggle = () => { setStatus(s => s === "offline" ? "broadcasting" : "offline"); toast(status === "offline" ? "Location broadcast started" : "Location broadcast stopped"); };
  if (role !== "matatu-driver" && role !== "carpool-driver") return <div className="inner" style={{ paddingTop: 28 }}><div className="card" style={{ padding: 20, borderLeft: "3px solid var(--stop)" }}><p className="sec-label">Passenger workspace</p><h1 style={{ fontSize: "1.25rem" }}>Driver access is not enabled</h1><p style={{ color: "var(--muted2)", fontSize: ".8rem", lineHeight: 1.5 }}>Choose a driver role during onboarding before broadcasting location. Passenger accounts cannot publish coordinates.</p><Link href="/profile"><button className="btn btn-ready">Open profile</button></Link></div></div>;
  return <div className="inner" style={{ paddingTop: 12 }}><div className="card" style={{ padding: 18, borderTop: `3px solid ${status === "broadcasting" ? "var(--go)" : "var(--stop)"}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><div><p className="sec-label">Driver workspace</p><h1 style={{ fontSize: "1.4rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>{icon}{driverType === "matatu-driver" ? "Matatu driver" : "Carpool driver"}</h1><p style={{ color: "var(--muted2)", fontSize: ".75rem", lineHeight: 1.5, marginTop: 8 }}>This pilot shares location only while you explicitly broadcast. It does not create a booking, payment or public account by itself.</p></div><div style={{ color: status === "broadcasting" ? "var(--go)" : "var(--stop)" }}>{status === "broadcasting" ? <Wifi size={22} /> : <WifiOff size={22} />}</div></div><button onClick={toggle} className={status === "broadcasting" ? "btn btn-stop" : "btn btn-go"} style={{ width: "100%", marginTop: 18 }}><Power size={15} />{status === "broadcasting" ? "Stop location broadcast" : "Start location broadcast"}</button></div><div className="card" style={{ padding: 18, marginTop: 12 }}><p className="sec-label">Operating details</p><label>Route or trip</label><input className="finput" value={routeLabel} onChange={e => setRouteLabel(e.target.value)} /><label style={{ marginTop: 12 }}>{driverType === "matatu-driver" ? "Available seats" : "Seats offered"}</label><input className="finput" type="number" min={0} max={50} value={seats} onChange={e => setSeats(Math.max(0, Number(e.target.value)))} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}><div className="card" style={{ padding: 12 }}><MapPin size={16} style={{ color: "var(--go)" }} /><p className="sec-label" style={{ marginTop: 8 }}>Position</p><b style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem" }}>{coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "Waiting"}</b></div><div className="card" style={{ padding: 12 }}><Activity size={16} style={{ color: "var(--ready)" }} /><p className="sec-label" style={{ marginTop: 8 }}>Last sent</p><b style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem" }}>{lastSent ? new Date(lastSent).toLocaleTimeString() : "Not yet"}</b></div></div></div><div className="card" style={{ padding: 18, marginTop: 12, borderLeft: "3px solid var(--ready)" }}><p className="sec-label">Production handoff</p><p style={{ color: "var(--muted2)", fontSize: ".78rem", lineHeight: 1.55, margin: 0 }}>The current adapter uses browser storage so the interaction can be tested. For real passenger booking, replace <code>saveLocation</code> with authenticated Firebase Realtime Database or a server endpoint, add driver verification, consent, expiry, location throttling and security rules.</p></div></div>;
}
