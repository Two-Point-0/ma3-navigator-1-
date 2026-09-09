import { createContext, useContext, useState, ReactNode } from "react";

export interface HelpStep { icon: string; heading: string; body: string }
export interface HelpContent { title: string; steps: HelpStep[] }

export const PAGE_HELP: Record<string, HelpContent> = {
  "/": {
    title: "Ma3 App — Overview",
    steps: [
      { icon: "🚌", heading: "Move", body: "Use Ma3 to search routes by number or name, plan journeys (matatu, train, or both), and lock in at your stage so drivers see you." },
      { icon: "🛒", heading: "Market", body: "Compare supermarket prices across Quickmart, Naivas and Carrefour. Build a basket and see which store saves you money." },
      { icon: "🎮", heading: "Mirth", body: "Play head-to-head games like Chess, Ludo, Trivia and Mchongwano, vote daily, or check odds on major sports fixtures." },
      { icon: "📍", heading: "Explore", body: "Find food spots, thrift markets, entertainment and culture events on the map. Drop your own pin." },
      { icon: "💳", heading: "Wallet", body: "Your matatu-shaped Ma3 wallet pays for fares and Ndai rides. Top up daily, weekly, or monthly in Profile." },
    ],
  },
  "/ma3": {
    title: "Ma3 Track — How It Works",
    steps: [
      { icon: "🔍", heading: "Search", body: "Type a route number (23W) or a stop name (Rongai) — both routes and stops appear from the live database. Tap to select." },
      { icon: "🚏", heading: "All Stops Shown", body: "Selecting a route shows every real bus stop along its actual road path, not just the first and last." },
      { icon: "📍", heading: "Tube-Style Progress", body: "While a matatu is en route, the stretch of road it has already covered highlights differently from what's ahead — just like the London Underground line indicator." },
      { icon: "🧭", heading: "Plan a Journey", body: "Enter From and To. The planner checks every combination — direct matatu, transfer, or train+matatu — and tags the fastest and cheapest." },
      { icon: "🔒", heading: "Lock In", body: "After planning, lock in at your stage so the demand board shows drivers exactly who's waiting for where." },
      { icon: "🚂", heading: "Train Transfers", body: "If a train ride gets you meaningfully closer to your destination, the planner includes a walk + train + walk option automatically." },
    ],
  },
  "/ndai": {
    title: "Ndai Ride — How It Works",
    steps: [
      { icon: "🏍️", heading: "Pick a ride type", body: "Boda is fastest and cheapest. Ndai is a saloon car. ProBox fits 5. Van is for groups up to 8." },
      { icon: "📍", heading: "Pickup & destination", body: "Type both, or tap a popular destination shortcut." },
      { icon: "🚗", heading: "Find drivers", body: "See nearby drivers with rating, ETA, and fare." },
      { icon: "💳", heading: "Pay from wallet", body: "Fare is deducted the moment you book." },
    ],
  },
  "/fly": {
    title: "Fly — How It Works",
    steps: [
      { icon: "✈️", heading: "Real Routes", body: "Search domestic flights between JKIA, Wilson, Mombasa (Moi Intl) and Kisumu, with real airlines (Kenya Airways, Jambojet, Fly540)." },
      { icon: "🔍", heading: "Search & Filter", body: "Filter by origin, destination, or airline to find the route you need." },
      { icon: "🚗", heading: "Airport Transfers", body: "Book a shared shuttle or private car to/from JKIA or Wilson." },
    ],
  },
  "/market": {
    title: "Market — How It Works",
    steps: [
      { icon: "🏷️", heading: "Price Comparison", body: "Search products — see prices at Quickmart, Naivas and Carrefour side by side. Cheapest is highlighted." },
      { icon: "🛒", heading: "Basket Builder", body: "Add items, adjust quantities, see the total at each store." },
      { icon: "💰", heading: "Budget Planner", body: "Enter your budget to see which store keeps you within it." },
    ],
  },
  "/mirth": {
    title: "Mirth — How It Works",
    steps: [
      { icon: "🎮", heading: "Games", body: "Pick a game — Chess, Ludo, Trivia, Monopoly, or Mchongwano. Two-container VS layout for head-to-head matches, plus daily community voting." },
      { icon: "⚽", heading: "Bet", body: "See major fixtures (e.g. Barcelona vs Real Madrid) in the same VS layout, with indicative odds and a KES 100 stake preview. Tap through to a real betting site to place actual bets." },
      { icon: "⚠️", heading: "Indicative Odds", body: "Odds shown are illustrative, not live feeds from the bookmakers. Always confirm odds on the betting site before wagering." },
    ],
  },
  "/explore": {
    title: "Explore — How It Works",
    steps: [
      { icon: "📍", heading: "Map Pins", body: "Real Nairobi spots — food, thrift, entertainment, services, transport, and culture events — each with a matching icon." },
      { icon: "🎨", heading: "Categories", body: "Filter pins by category using the pills above the map." },
      { icon: "➕", heading: "Add a Pin", body: "Tap + Add Pin, then tap the map. For shared buildings, add floor and unit number." },
      { icon: "🎶", heading: "Culture & Events", body: "Live music, rhumba nights and cultural events now live here as pins — tap one to see time and venue." },
    ],
  },
  "/profile": {
    title: "Profile & Wallet",
    steps: [
      { icon: "🚌", heading: "Matatu Wallet", body: "Your wallet is shaped like a matatu and holds your KES balance." },
      { icon: "💳", heading: "Top Up", body: "Daily, Weekly or Monthly plans — pick an amount, it's added instantly." },
      { icon: "🏅", heading: "Badges", body: "Earned through app activity — rating, locking in, adding pins." },
    ],
  },
};

interface HelpContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  currentPath: string;
  setCurrentPath: (p: string) => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");
  return (
    <HelpContext.Provider value={{ open, setOpen, currentPath, setCurrentPath }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelp must be used within HelpProvider");
  return ctx;
}
