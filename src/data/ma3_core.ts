// Shared types and static reference data for Ma3 app

export interface RouteInfo {
  id: string;
  sn: string; // short name
  ln: string; // long name
  hs: string; // headsign
  c: string;  // color
}

export interface StopInfo {
  name: string;
  lat: number;
  lon: number;
}

export const AVG_MATATU_SPEED_KMH = 22; // realistic Nairobi traffic average
export const AVG_WALK_SPEED_KMH = 4.8;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function etaMinutes(distanceKm: number, speedKmh: number = AVG_MATATU_SPEED_KMH): number {
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60));
}

// ---- WALLET ----
export type WalletPlan = "daily" | "weekly" | "monthly";

export interface WalletState {
  balance: number; // KES
  plan: WalletPlan | null;
  planAmount: number;
  planRenewsAt: number | null; // epoch ms
}

export const WALLET_PLAN_OPTIONS: Record<WalletPlan, { label: string; suggested: number[]; periodLabel: string; periodMs: number }> = {
  daily:   { label: "Daily Top-up",   suggested: [100, 200, 300, 500],   periodLabel: "day",   periodMs: 24 * 60 * 60 * 1000 },
  weekly:  { label: "Weekly Top-up",  suggested: [500, 1000, 1500, 2000], periodLabel: "week",  periodMs: 7 * 24 * 60 * 60 * 1000 },
  monthly: { label: "Monthly Top-up", suggested: [2000, 3500, 5000, 8000], periodLabel: "month", periodMs: 30 * 24 * 60 * 60 * 1000 },
};

// ---- BUSINESS PINS (Explore page) ----
export type PinCategory = "food" | "thrift" | "entertainment" | "culture" | "service" | "transport";

export const PIN_CATEGORY_META: Record<PinCategory, { label: string; color: string; icon: string }> = {
  food:          { label: "Food & Eats",      color: "#16a34a", icon: "🍖" },
  thrift:        { label: "Thrift / Mitumba", color: "#d97706", icon: "👕" },
  entertainment: { label: "Entertainment",    color: "#d97706", icon: "🎶" },
  culture:       { label: "Culture & Events", color: "#d97706", icon: "🎭" },
  service:       { label: "Services",         color: "#16a34a", icon: "🛠️" },
  transport:     { label: "Transport Hub",    color: "#dc2626", icon: "🚌" },
};

export interface BusinessPin {
  id: string;
  name: string;
  category: PinCategory;
  subType?: string; // e.g. "Nyama Choma", "Rhumba Night"
  lat: number;
  lon: number;
  floor?: string;
  unit?: string;
  notes?: string;
  addedBy?: string;
  rating?: number;
  votes?: number;
  eventTime?: string; // e.g. "Fri 9PM" — for culture/entertainment events
  genre?: string;     // e.g. "Rhumba", "Reggae", "Afrobeats"
}

// Seed pins around Nairobi reflecting Kenyan culture (nyama choma joints, thrift markets, entertainment spots)
export const SEED_PINS: BusinessPin[] = [
  { id:"p1", name:"Kenyatta Market Nyama Choma", category:"food", subType:"Nyama Choma", lat:-1.2978, lon:36.8267, rating:4.6, votes:312, notes:"Famous goat & beef roast row" },
  { id:"p2", name:"Mama Oliech Fish", category:"food", subType:"Fish & Ugali", lat:-1.2902, lon:36.7956, rating:4.8, votes:540, notes:"Legendary tilapia, Kibera Drive" },
  { id:"p3", name:"Toi Market", category:"thrift", subType:"Mitumba", lat:-1.3084, lon:36.7831, rating:4.4, votes:890, notes:"One of Nairobi's biggest secondhand clothes markets" },
  { id:"p4", name:"Gikomba Market", category:"thrift", subType:"Mitumba & Fabrics", lat:-1.2842, lon:36.8378, rating:4.3, votes:1204, notes:"East Africa's largest mitumba market" },
  { id:"p5", name:"B-Club Westlands", category:"entertainment", subType:"Rhumba Night", lat:-1.2640, lon:36.8055, floor:"2nd Floor", unit:"Suite 12", rating:4.7, votes:430, notes:"Fri Rhumba nights, live band" },
  { id:"p6", name:"Choices Lounge", category:"entertainment", subType:"Reggae Night", lat:-1.2701, lon:36.8189, floor:"Rooftop", rating:4.5, votes:265, notes:"Thursday reggae sessions" },
  { id:"p7", name:"K1 Klubhouse", category:"entertainment", subType:"Live Band", lat:-1.2613, lon:36.8003, rating:4.6, votes:710, notes:"Outdoor garden, live bands every weekend" },
  { id:"p8", name:"Carnivore Grounds", category:"food", subType:"Nyama Choma & Pilau", lat:-1.3192, lon:36.7861, rating:4.7, votes:1890, notes:"Iconic Nairobi nyama choma restaurant" },
  { id:"p9", name:"Quickmart Kasarani", category:"service", subType:"Supermarket", lat:-1.2231, lon:36.8979, rating:4.2, votes:155 },
  { id:"p10", name:"Eastleigh Garissa Lodge", category:"thrift", subType:"Fashion & Textiles", lat:-1.2718, lon:36.8466, rating:4.1, votes:980, notes:"Wholesale fashion hub" },
  { id:"p11", name:"Pilau Corner Eastleigh", category:"food", subType:"Pilau & Biryani", lat:-1.2722, lon:36.8459, rating:4.5, votes:340 },
  { id:"p12", name:"Sarakasi Dome", category:"culture", subType:"Live Events", lat:-1.2666, lon:36.8438, rating:4.6, votes:520, notes:"Concerts and cultural shows", eventTime:"Sat 6PM", genre:"Multi-genre" },
  // Culture / events — moved here from the old Mirth tribal/culture tab
  { id:"p13", name:"Friday Rhumba Night", category:"culture", subType:"Rhumba", lat:-1.2640, lon:36.8055, eventTime:"Fri 9PM", genre:"Rhumba", notes:"Live Congolese rhumba band, B-Club Westlands" },
  { id:"p14", name:"Sunday Reggae Session", category:"culture", subType:"Reggae", lat:-1.2701, lon:36.8189, eventTime:"Sun 4PM", genre:"Reggae", notes:"Roots reggae all afternoon, Choices Lounge" },
  { id:"p15", name:"Afrobeats Fiesta", category:"culture", subType:"Afrobeats", lat:-1.2613, lon:36.8003, eventTime:"Sat 8PM", genre:"Afrobeats", notes:"K1 Klubhouse weekend party" },
  { id:"p16", name:"Taarab & Chakacha Night", category:"culture", subType:"Coastal", lat:-1.2666, lon:36.8438, eventTime:"Sat 6PM", genre:"Coastal", notes:"Sarakasi Dome cultural showcase" },
  { id:"p17", name:"Kikuyu Benga Night", category:"culture", subType:"Benga", lat:-1.3192, lon:36.7861, eventTime:"Thu 7PM", genre:"Benga", notes:"Live benga band, Carnivore Grounds" },
];

// ---- VEHICLE / DRIVER QUEUE LOGIC ----
export interface StopQueueEntry {
  destination: string;          // stop name passenger wants to alight at / area
  destLat: number;
  destLon: number;
  paxCount: number;             // how many waiting for this destination
}

// Generates a mock "waiting passengers by destination" queue for a stop,
// so a driver/tout arriving can instantly see where demand is concentrated
// without calling out destinations one by one (the "makanga problem").
export function generateStopQueue(stopLat: number, stopLon: number, stops: Record<string, StopInfo>): StopQueueEntry[] {
  const names = Object.values(stops);
  if (!names.length) return [];
  const entries: StopQueueEntry[] = [];
  const sampleSize = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < sampleSize; i++) {
    const s = names[Math.floor(Math.random() * names.length)];
    if (haversineKm(stopLat, stopLon, s.lat, s.lon) < 0.05) continue;
    entries.push({
      destination: s.name,
      destLat: s.lat,
      destLon: s.lon,
      paxCount: 1 + Math.floor(Math.random() * 9),
    });
  }
  // merge duplicates
  const merged = new Map<string, StopQueueEntry>();
  entries.forEach(e => {
    const existing = merged.get(e.destination);
    if (existing) existing.paxCount += e.paxCount;
    else merged.set(e.destination, { ...e });
  });
  return Array.from(merged.values()).sort((a, b) => b.paxCount - a.paxCount);
}
