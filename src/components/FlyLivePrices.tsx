import { useState } from "react";
import { LoaderCircle, Plane } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Offer = { price: string; currency: string; carrier?: string; cabin?: string; stops: number; departs?: string; arrives?: string; duration?: string };
const time = (iso?: string) => iso ? new Date(iso).toLocaleString("en-KE", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "";

/** Optional live prices and classes. Works only after the flight-offers function and its keys are set up; otherwise shows a calm message. */
export default function FlyLivePrices({ origin, destination, date }: { origin: string; destination: string; date: string }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const code = (value: string) => (value.match(/\b[A-Z]{3}\b/) ?? [value.slice(0, 3).toUpperCase()])[0];
  const run = async () => {
    if (!supabase) return;
    setLoading(true); setNote(""); setOffers(null);
    const { data, error } = await supabase.functions.invoke("flight-offers", { body: { origin: code(origin), destination: code(destination), date } });
    setLoading(false);
    if (error || !data?.offers) { setNote("Live prices are not switched on yet, or none were found. The routes above still work."); return; }
    setOffers(data.offers); if (!data.offers.length) setNote("No live offers for that day.");
  };
  return <div className="ios-glass" style={{ padding: 10, marginTop: 10 }}>
    <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => void run()} disabled={loading || !origin || !destination || !date}>{loading ? <LoaderCircle size={13} /> : <Plane size={13} />} Check live prices and classes</button>
    {note && <p style={{ color: "var(--muted2)", fontSize: ".6rem", lineHeight: 1.45, marginTop: 7 }}>{note}</p>}
    {offers?.map((offer, index) => <div key={index} className="card" style={{ padding: 8, marginTop: 6, fontSize: ".64rem", display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span>{offer.carrier} · {offer.cabin?.toLowerCase()} · {offer.stops === 0 ? "direct" : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}<small style={{ display: "block", color: "var(--muted2)" }}>{time(offer.departs)} → {time(offer.arrives)}</small></span>
      <b style={{ color: "var(--ready)" }}>{offer.currency} {Math.round(Number(offer.price)).toLocaleString()}</b>
    </div>)}
    <small style={{ display: "block", color: "var(--muted2)", marginTop: 6 }}>Prices are guides from a travel data provider. Book on the airline's own site.</small>
  </div>;
}
