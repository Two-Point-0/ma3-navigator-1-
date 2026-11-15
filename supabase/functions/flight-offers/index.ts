// Live flight prices from Amadeus Self-Service (free test tier). Needs two secrets, set in Supabase:
//   supabase secrets set AMADEUS_CLIENT_ID=... AMADEUS_CLIENT_SECRET=...   (and APP_ORIGIN=https://your-site)
// Until they exist the function answers "not configured" and the app keeps using its own flight_routes table.
// >>> OWNER ACTION: create a free account at developers.amadeus.com, make an app, copy the key and secret. <<<
// The test host returns sample data. Switch AMADEUS_HOST to https://api.amadeus.com only after Amadeus approves production use.
import { callbackCors } from "../_shared/daraja.ts";

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const cache = new Map<string, { at: number; body: unknown }>(); // 10 minute cache protects the free limit

Deno.serve(async req => {
  const cors = callbackCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors.headers });
  if (!cors.allowed) return json({ error: "Origin not allowed" }, 403, cors.headers);
  const id = Deno.env.get("AMADEUS_CLIENT_ID"), secret = Deno.env.get("AMADEUS_CLIENT_SECRET");
  if (!id || !secret) return json({ error: "Live prices are not switched on yet" }, 503, cors.headers);
  if (!req.headers.get("Authorization")) return json({ error: "Sign in first" }, 401, cors.headers);

  let input: { origin?: string; destination?: string; date?: string };
  try { input = await req.json(); } catch { return json({ error: "Bad request" }, 400, cors.headers); }
  const origin = (input.origin ?? "").toUpperCase(), destination = (input.destination ?? "").toUpperCase(), date = input.date ?? "";
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Use 3-letter airport codes and a date" }, 400, cors.headers);

  const key = `${origin}-${destination}-${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 600000) return json(hit.body, 200, cors.headers);

  const host = Deno.env.get("AMADEUS_HOST") ?? "https://test.api.amadeus.com";
  const tokenResponse = await fetch(`${host}/v1/security/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }) });
  if (!tokenResponse.ok) return json({ error: "Price service sign-in failed" }, 502, cors.headers);
  const { access_token } = await tokenResponse.json();
  const offers = await fetch(`${host}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${date}&adults=1&currencyCode=KES&max=8`, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!offers.ok) return json({ error: "No prices returned for that search" }, 502, cors.headers);
  const data = await offers.json();
  const body = {
    offers: (data.data ?? []).map((offer: any) => ({
      price: offer.price?.grandTotal, currency: offer.price?.currency,
      carrier: offer.validatingAirlineCodes?.[0],
      cabin: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin,
      stops: Math.max(0, (offer.itineraries?.[0]?.segments?.length ?? 1) - 1),
      departs: offer.itineraries?.[0]?.segments?.[0]?.departure?.at,
      arrives: offer.itineraries?.[0]?.segments?.slice(-1)[0]?.arrival?.at,
      duration: offer.itineraries?.[0]?.duration,
    })),
  };
  cache.set(key, { at: Date.now(), body });
  return json(body, 200, cors.headers);
});
