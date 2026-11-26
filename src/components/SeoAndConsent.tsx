import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { analyticsAvailable, readConsent, setConsent, startAnalytics, trackPage } from "@/lib/analytics";

const PAGES: Record<string, [string, string]> = {
  "/": ["Ma3 · Move, Market, Mirth for Nairobi", "Matatu routes, live drivers, rides, flights and SGR, supermarket price comparison and Kenyan games in one Nairobi app."],
  "/ma3": ["Ma3 · Nairobi matatu routes and live drivers", "Find your matatu route, see approved drivers live on the map, send parcels and check rail."],
  "/ndai": ["Ndai · Rides, carpool and tours in Nairobi", "Book a ride or boda, share a carpool, or find a tour van."],
  "/fly": ["Fly · Domestic, SGR and international trips from Kenya", "Search flights and SGR trains from Nairobi and see routes on the map."],
  "/market": ["Market · Compare supermarket prices in Nairobi", "Paste your shopping list and see which single supermarket is cheapest for the whole list."],
  "/explore": ["Explore · Eat, stay and shop in Nairobi", "Find restaurants, stays, shops and places around Nairobi on the map."],
  "/mirth": ["Mirth · Games, Mchongwano live roasts and Nganya shop", "Play Ludo, chess, trivia and quick games, watch live Mchongwano roast battles, and shop Nganya merchandise."],
  "/legal": ["Privacy and terms · Ma3", "How Ma3 handles your data, the terms of use, shop terms and roast rules."],
};

/** Sets a proper title and description for every page (helps Google and shared links) and runs the consent card for analytics. */
export default function SeoAndConsent() {
  const [location] = useLocation();
  const [asked, setAsked] = useState(() => readConsent() !== null || !analyticsAvailable);
  useEffect(() => { startAnalytics(); }, []);
  useEffect(() => {
    const base = "/" + (location.split("/")[1] ?? ""); const [title, description] = PAGES[location] ?? PAGES[base] ?? PAGES["/"];
    document.title = title;
    let tag = document.querySelector('meta[name="description"]'); if (!tag) { tag = document.createElement("meta"); tag.setAttribute("name", "description"); document.head.appendChild(tag); }
    tag.setAttribute("content", description);
    const canonical = document.querySelector('link[rel="canonical"]'); canonical?.setAttribute("href", `${window.location.origin}${location === "/" ? "/" : location}`);
    trackPage(location, title);
  }, [location]);
  if (asked) return null;
  return <div role="dialog" aria-label="Usage statistics" className="ios-glass" style={{ position: "fixed", left: 10, right: 10, bottom: "calc(var(--nav-h) + 12px)", maxWidth: 520, margin: "0 auto", zIndex: 1200, padding: 12, borderRadius: 16 }}>
    <p style={{ fontSize: ".66rem", lineHeight: 1.5, margin: "0 0 8px" }}>Help improve Ma3? We count visits and screens used. No name, phone or location is sent.</p>
    <div style={{ display: "flex", gap: 8 }}><button className="btn btn-ready" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setConsent("yes"); setAsked(true); }}>Allow</button><button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setConsent("no"); setAsked(true); }}>No thanks</button></div>
  </div>;
}
