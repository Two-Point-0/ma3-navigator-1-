import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle, GraduationCap, Minus, Plus, Search, ShoppingCart, Trash2, Wheat, Droplets, Milk, Sandwich, Package, Egg, X, Database, LoaderCircle, MapPin, Navigation, LocateFixed, Bike, Bus, Car, Check, Store as StoreIcon } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { SelectedMarketBranch, useShoppingBasket } from "@/lib/shoppingBasket";
import PageTabs from "@/components/PageTabs";
import { useSheet } from "@/lib/useSheet";
import MapLibreView, { MapLibreHandle } from "@/components/MapLibreView";
import maplibregl from "maplibre-gl";
import { addBadgeMarker, setPointLayer } from "@/lib/mapLayers";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Store = "Naivas" | "Quickmart" | "Carrefour" | "Chandarana" | "Cleanshelf";
type TemplateId = "solo" | "bachelor" | "sister" | "family" | "campus" | "school" | "boys_trip" | "girls_trip" | "road_trip" | "smart";
type MarketTab = "planner" | "search" | "basket";
type Coordinates = { latitude: number; longitude: number };
type PriceEntry = { key: string; store: Store; amount: number; observedAt: string; branch: string | null; region: string | null; latitude: number | null; longitude: number | null; sourceType: string };
type Product = { id: string; sku: string; name: string; unit: string; category: string; brand: string | null; imageUrl: string | null; prices: PriceEntry[] };
type BasketLine = { p: Product; qty: number };
type BranchComparison = SelectedMarketBranch & { distanceKm: number | null };

const STORES: Store[] = ["Naivas", "Quickmart", "Carrefour", "Chandarana", "Cleanshelf"];
const STORE_SLUG: Record<Store, string> = { Naivas: "naivas", Quickmart: "quickmart", Carrefour: "carrefour", Chandarana: "chandarana", Cleanshelf: "cleanshelf" };
const slugStore = Object.fromEntries(Object.entries(STORE_SLUG).map(([store, slug]) => [slug, store])) as Record<string, Store | undefined>;
const tabList = (count: number) => [{ id: "basket", label: count ? `Checkout · ${count}` : "Compare prices", Icon: StoreIcon }, { id: "planner", label: "Plan a basket", Icon: GraduationCap }, { id: "search", label: "Find products", Icon: Search }] as const;
const PROFILE_LABELS: Record<TemplateId, { name: string; note: string }> = {
  solo: { name: "Solo essentials", note: "quick basics for one" }, bachelor: { name: "Bachelor pad", note: "easy meals, cleaning and everyday staples" }, sister: { name: "Home & care", note: "personal-care and home basics" },
  family: { name: "Family", note: "household essentials" }, campus: { name: "Campus", note: "student-friendly basics" },
  school: { name: "School run", note: "lunchbox, stationery and home staples" }, boys_trip: { name: "Boys' trip", note: "grill, snacks and shared basics" },
  girls_trip: { name: "Girls' trip", note: "snacks, self-care and group essentials" }, road_trip: { name: "Road-trip crew", note: "water, snacks and travel-day basics" },
  smart: { name: "Everyday", note: "balanced everyday basket" },
};
const STORE_ACCENT = "var(--ready)";

function iconFor(category: string) {
  const value = category.toLowerCase();
  if (/flour|grain|staple/.test(value)) return Wheat;
  if (/dairy|milk/.test(value)) return Milk;
  if (/oil|clean|household|soap/.test(value)) return Droplets;
  if (/bread|bakery/.test(value)) return Sandwich;
  if (/egg/.test(value)) return Egg;
  return Package;
}
function ProductImage({ product, size = 38 }: { product: Product; size?: number }) {
  const [failed, setFailed] = useState(false);
  const Icon = iconFor(product.category);
  const imageUrl = product.imageUrl && /^https:\/\//i.test(product.imageUrl) ? product.imageUrl : null;
  return <span style={{ width: size, height: size, flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: 9, background: "var(--glass2)", color: "var(--ready)" }}>
    {imageUrl && !failed ? <img src={imageUrl} alt={product.name} loading="lazy" onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Icon size={Math.min(size * .48, 20)} />}
  </span>;
}
function StoreBadge({ store }: { store: Store }) { return <span style={{ color: STORE_ACCENT, border: "1px solid rgba(217,119,6,.35)", background: "rgba(217,119,6,.1)", padding: "3px 7px", borderRadius: 7, fontSize: ".52rem", fontWeight: 800, letterSpacing: ".03em", whiteSpace: "nowrap" }}>{store.toUpperCase()}</span>; }
function coordinate(value: unknown): number | null { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function distanceKm(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude), dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function nearestPrice(product: Product, from: Coordinates | null) {
  if (!from) return null;
  let best: { price: PriceEntry; distanceKm: number } | null = null;
  for (const price of product.prices) {
    if (price.latitude === null || price.longitude === null) continue;
    const km = distanceKm(from, { latitude: price.latitude, longitude: price.longitude });
    if (!best || km < best.distanceKm) best = { price, distanceKm: km };
  }
  return best;
}
function DirectionsLink({ branch }: { branch: Pick<BranchComparison, "latitude" | "longitude"> }) {
  if (branch.latitude === null || branch.longitude === null) return null;
  return <a href={`https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ready)", fontSize: ".6rem", fontWeight: 700, textDecoration: "none" }}><Navigation size={11} /> Directions</a>;
}
function isMissingRelationOrColumn(message: string) { return /latest_market_prices|branch_id|retailer_branches|relationship|schema cache|does not exist/i.test(message); }

export default function MarketPage() {
  const mapRef = useRef<MapLibreHandle>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const sheet = useSheet("peek");
  const [, setLocation] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<MarketTab>("basket");
  const [template, setTemplate] = useState<TemplateId>("solo");
  const [schoolLevel, setSchoolLevel] = useState("primary");
  const [familyMembers, setFamilyMembers] = useState(4);
  const [query, setQuery] = useState("");
  const [plannerQuery, setPlannerQuery] = useState("");
  const [basketQuery, setBasketQuery] = useState("");
  const [compareQuery, setCompareQuery] = useState("");
  const [budget, setBudget] = useState("");
  const [detail, setDetail] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState("");
  const [budgetMode, setBudgetMode] = useState<"saver" | "balanced" | "premium">("balanced");
  const { items: sharedItems, selectedBranch, syncStatus, persistsAcrossDevices, addItem, updateQuantity, removeItem, replaceItems, setSelectedBranch } = useShoppingBasket();
  const basket = useMemo<BasketLine[]>(() => sharedItems.flatMap(item => {
    const product = products.find(candidate => candidate.id === item.productId);
    return product ? [{ p: product, qty: item.quantity }] : [];
  }), [sharedItems, products]);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [branchSchemaReady, setBranchSchemaReady] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [openBranch, setOpenBranch] = useState<string | null>(null);
  useEffect(() => { if (detail) setSheetOpen(false); }, [detail]);
  const activeCatalogQuery = tab === "search" ? query : tab === "planner" ? plannerQuery : compareQuery;
  const basketProductIds = sharedItems.map(item => item.productId);
  const basketProductKey = basketProductIds.join(",");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
    (async () => {
      const searchTerm = activeCatalogQuery.trim().replace(/[(),%_*]/g, " ").replace(/\s+/g, " ");
      if (searchTerm.length < 2 && basketProductIds.length === 0) {
        setProducts([]); setLoading(false); setLoadError(""); return;
      }
      setLoading(true); setLoadError("");
      try {
        let productRows: any[] = [];
        if (searchTerm.length >= 2) {
          const pattern = `%${searchTerm}%`;
          const { data, error } = await supabase!.from("products").select("id,sku,name,pack_size,category,brand,image_url").eq("active", true)
            .or(`name.ilike.${pattern},sku.ilike.${pattern},brand.ilike.${pattern},category.ilike.${pattern}`)
            .order("name").limit(40);
          if (error) throw error;
          productRows = data ?? [];
        }
        if (basketProductIds.length) {
          const { data, error } = await supabase!.from("products").select("id,sku,name,pack_size,category,brand,image_url").eq("active", true).in("id", basketProductIds);
          if (error) throw error;
          const ids = new Set(productRows.map(row => row.id));
          productRows.push(...(data ?? []).filter(row => !ids.has(row.id)));
        }
        if (cancelled) return;

        const priceRows: any[] = [];
        let hasBranchSchema = true;
        const productIds = productRows.map(row => row.id);
        for (let offset = 0; offset < 2500 && productIds.length; offset += 500) {
          let result: any = await supabase!.from("latest_market_prices")
            .select("product_id,price_kes,pack_size,source_type,retailer_id,branch_id,branch,region,branch_slug,branch_name,branch_region,latitude,longitude,observed_at,retailer_slug")
            .in("product_id", productIds).order("observed_at", { ascending: false }).range(offset, offset + 499);
          if (result.error && isMissingRelationOrColumn(result.error.message)) {
            result = await supabase!.from("price_observations")
              .select("product_id,price_kes,pack_size,source_type,retailer_id,branch_id,branch,region,observed_at,retailers(slug),retailer_branches(branch_slug,branch_name,region,latitude,longitude)")
              .in("product_id", productIds).in("source_type", ["seeded_demo", "manual_entry", "user_submitted"])
              .order("observed_at", { ascending: false }).range(offset, offset + 499);
            if (result.error && isMissingRelationOrColumn(result.error.message)) {
              hasBranchSchema = false;
              result = await supabase!.from("price_observations")
                .select("product_id,price_kes,pack_size,source_type,retailer_id,branch,region,observed_at,retailers(slug)")
                .in("product_id", productIds).in("source_type", ["seeded_demo", "manual_entry", "user_submitted"])
                .order("observed_at", { ascending: false }).range(offset, offset + 499);
            }
          }
          if (result.error) throw result.error;
          priceRows.push(...(result.data ?? []));
          if (!result.data || result.data.length < 500) break;
        }
        if (cancelled) return;
        const byProduct = new Map<string, Product>();
        productRows.forEach(row => byProduct.set(row.id, { id: row.id, sku: row.sku ?? row.id, name: row.name, unit: row.pack_size || "", category: row.category || "Other", brand: row.brand || null, imageUrl: row.image_url || null, prices: [] }));
        for (const row of priceRows) {
          const product = byProduct.get(row.product_id);
          const retailerJoin = row.retailers;
          const retailerSlug = row.retailer_slug || (Array.isArray(retailerJoin) ? retailerJoin[0]?.slug : retailerJoin?.slug);
          const store = slugStore[retailerSlug];
          if (!product || !store) continue;
          const branchJoin = row.retailer_branches;
          const branchInfo = Array.isArray(branchJoin) ? branchJoin[0] : branchJoin;
          const branchName = row.branch_name || branchInfo?.branch_name || row.branch || null;
          const region = row.branch_region || branchInfo?.region || row.region || null;
          const branchIdentity = row.branch_id || row.branch_slug || branchInfo?.branch_slug || `${(branchName || "unspecified").trim().toLowerCase()}|${(region || "").trim().toLowerCase()}`;
          const key = `${store}:${branchIdentity}`;
          if (product.prices.some(price => price.key === key)) continue;
          product.prices.push({ key, store, amount: Number(row.price_kes), observedAt: row.observed_at, branch: branchName, region, latitude: coordinate(row.latitude ?? branchInfo?.latitude), longitude: coordinate(row.longitude ?? branchInfo?.longitude), sourceType: row.source_type });
        }
        setProducts([...byProduct.values()]);
        setBranchSchemaReady(hasBranchSchema);
        setLoadError("");
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not read the catalogue.");
      } finally { if (!cancelled) setLoading(false); }
    })();
    }, activeCatalogQuery.trim().length >= 2 ? 250 : 0);
    return () => { cancelled = true; };
  }, [activeCatalogQuery, basketProductKey, tab]);

  useEffect(() => {
    if (!map) return;
    const branches = new Map<string, { id: string; lat: number; lon: number; color: string; radius: number }>();
    for (const product of products) for (const price of product.prices) {
      if (price.latitude === null || price.longitude === null) continue;
      branches.set(price.key, { id: price.key, lat: price.latitude, lon: price.longitude, color: "#d97706", radius: 6 });
    }
    setPointLayer(map, "market-branches", [...branches.values()], 6);
  }, [map, products]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term ? products.filter(item => `${item.name} ${item.sku} ${item.brand ?? ""} ${item.category}`.toLowerCase().includes(term)) : [];
    if (!nearMe || !userLocation) return matches;
    return [...matches].sort((a, b) => (nearestPrice(a, userLocation)?.distanceKm ?? Infinity) - (nearestPrice(b, userLocation)?.distanceKm ?? Infinity));
  }, [query, products, nearMe, userLocation]);
  const plannerMatches = useMemo(() => {
    const term = plannerQuery.trim().toLowerCase();
    return term ? products.filter(item => `${item.name} ${item.sku} ${item.brand ?? ""} ${item.category}`.toLowerCase().includes(term)).slice(0, 8) : [];
  }, [plannerQuery, products]);
  const compareMatches = useMemo(() => {
    const term = compareQuery.trim().toLowerCase();
    return term ? products.filter(item => `${item.name} ${item.sku} ${item.brand ?? ""} ${item.category}`.toLowerCase().includes(term)).slice(0, 10) : [];
  }, [compareQuery, products]);
  const visibleBasket = useMemo(() => {
    const term = basketQuery.trim().toLowerCase();
    return term ? basket.filter(({ p }) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(term)) : basket;
  }, [basket, basketQuery]);

  const branchComparisons = useMemo<BranchComparison[]>(() => {
    if (!basket.length) return [];
    const candidates = new Map<string, PriceEntry>();
    for (const line of basket) for (const price of line.p.prices) if (!candidates.has(price.key)) candidates.set(price.key, price);
    const complete: BranchComparison[] = [];
    for (const [key, candidate] of candidates) {
      let totalKes = 0;
      let hasAllItems = true;
      for (const line of basket) {
        const price = line.p.prices.find(item => item.key === key);
        if (!price) { hasAllItems = false; break; }
        totalKes += price.amount * line.qty;
      }
      if (!hasAllItems) continue;
      const hasPoint = candidate.latitude !== null && candidate.longitude !== null;
      complete.push({ key, store: candidate.store, branchName: candidate.branch || "Branch not supplied", region: candidate.region || "", latitude: candidate.latitude, longitude: candidate.longitude, totalKes, distanceKm: userLocation && hasPoint ? distanceKm(userLocation, { latitude: candidate.latitude!, longitude: candidate.longitude! }) : null });
    }
    return complete.sort((a, b) => a.totalKes - b.totalKes);
  }, [basket, userLocation]);
  const cheapestBranch = branchComparisons[0] ?? null;
  // Checkout shows three stores: the nearest ones once we know where you are, otherwise the cheapest.
  const checkoutOptions = useMemo<BranchComparison[]>(() => {
    if (!userLocation) return branchComparisons.slice(0, 3);
    const located = branchComparisons.filter(branch => branch.distanceKm !== null).sort((a, b) => a.distanceKm! - b.distanceKm!);
    const unlocated = branchComparisons.filter(branch => branch.distanceKm === null);
    return [...located, ...unlocated].slice(0, 3);
  }, [branchComparisons, userLocation]);
  const chosenOption = selectedBranch ? branchComparisons.find(branch => branch.key === selectedBranch.key) ?? null : null;
  const pinKey = checkoutOptions.map(option => `${option.key}:${Math.round(option.totalKes)}`).join("|");
  const fitKey = checkoutOptions.map(option => option.key).join("|");

  // Pins for the stores being compared (with their totals) and for you.
  useEffect(() => {
    if (!map) return;
    const added: maplibregl.Marker[] = [];
    if (tab === "basket") {
      checkoutOptions.forEach((option, index) => {
        if (option.latitude === null || option.longitude === null) return;
        const colour = selectedBranch?.key === option.key ? "#16a34a" : index === 0 ? "#d97706" : "#475569";
        added.push(addBadgeMarker(map, option.latitude, option.longitude, `${option.store} · KES ${Math.round(option.totalKes).toLocaleString()}`, colour));
      });
    }
    if (userLocation && (tab === "basket" || nearMe)) added.push(addBadgeMarker(map, userLocation.latitude, userLocation.longitude, "You", "#2563eb"));
    return () => { added.forEach(marker => marker.remove()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tab, pinKey, selectedBranch?.key, userLocation, nearMe]);

  // Zoom the map so you and the compared stores are all in view.
  useEffect(() => {
    if (!map || tab !== "basket") return;
    const points: [number, number][] = checkoutOptions.filter(option => option.latitude !== null && option.longitude !== null).map(option => [option.longitude!, option.latitude!]);
    if (userLocation) points.push([userLocation.longitude, userLocation.latitude]);
    if (points.length === 1) { mapRef.current?.flyTo(points[0][0], points[0][1], 14); return; }
    if (points.length < 2) return;
    const lons = points.map(point => point[0]), lats = points.map(point => point[1]);
    mapRef.current?.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], 90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tab, fitKey, userLocation]);
  const budgetNum = Number(budget) || 0;

  const addToBasket = (product: Product) => {
    add(product);
    toast.success(`${product.name} added to your basket`);
  };
  const add = (product: Product, quantity = 1) => addItem({ productId: product.id, sku: product.sku, name: product.name, unit: product.unit, category: product.category }, quantity);
  const adjust = (productId: string, delta: number) => {
    const item = sharedItems.find(candidate => candidate.productId === productId);
    if (item) updateQuantity(productId, item.quantity + delta);
  };
  const chooseBranch = (branch: BranchComparison) => setSelectedBranch({ key: branch.key, store: branch.store, branchName: branch.branchName, region: branch.region, latitude: branch.latitude, longitude: branch.longitude, totalKes: branch.totalKes });
  const toggleNearMe = () => {
    if (nearMe) { setNearMe(false); return; }
    setNearMe(true);
    if (!userLocation) requestLocation();
  };
  const placeName = (branch: { store: string; branchName: string }) => `${branch.store} ${branch.branchName}`;
  const goMa3 = (branch: BranchComparison) => {
    if (branch.latitude === null || branch.longitude === null) { toast("This branch has no map position yet, so Ma3 cannot plan a route to it."); return; }
    sessionStorage.setItem("ma3_destination", JSON.stringify({ name: placeName(branch), lat: branch.latitude, lon: branch.longitude }));
    setLocation("/ma3");
  };
  const goNdai = (branch: BranchComparison) => {
    if (branch.latitude === null || branch.longitude === null) { toast("This branch has no map position yet, so Ndai cannot set a destination."); return; }
    sessionStorage.setItem("ndai_destination", JSON.stringify({ tab: "ride", name: placeName(branch), lat: branch.latitude, lon: branch.longitude }));
    setLocation("/ndai");
  };
  const goBoda = (branch: BranchComparison) => {
    chooseBranch(branch);
    sessionStorage.setItem("ndai_destination", JSON.stringify({ tab: "delivery" }));
    setLocation("/ndai");
  };
  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationMessage("This browser cannot provide device location. You can still choose the cheapest branch."); return; }
    setLocating(true); setLocationMessage("");
    navigator.geolocation.getCurrentPosition(position => {
      setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationMessage("Your location stays in this browser session; it is not sent to Supabase.");
      setLocating(false);
    }, error => {
      setLocationMessage(error.code === 1 ? "Location permission was not granted. You can still choose the cheapest branch." : "Could not get your location. Try again or choose the cheapest branch.");
      setLocating(false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 });
  };
  const loadTemplate = () => {
    if (!products.length) { setTab("search"); return; }
    const group: Record<TemplateId, string[]> = {
      solo: ["staple", "food", "dairy", "protein"], bachelor: ["staple", "food", "dairy", "protein", "household", "clean"],
      sister: ["personal", "household", "dairy"], family: ["staple", "food", "dairy", "protein", "household"],
      campus: ["staple", "food", "dairy", "protein", "snack"], school: ["school", "stationery", "snack", "dairy", "staple"],
      boys_trip: ["snack", "drink", "beverage", "water", "protein", "meat", "staple"],
      girls_trip: ["snack", "drink", "beverage", "personal", "care", "fruit", "chocolate"],
      road_trip: ["snack", "drink", "beverage", "water", "fruit", "bread"],
      smart: ["staple", "food", "dairy", "protein", "household"],
    };
    const keywords = group[template];
    const picks = products.filter(product => keywords.some(word => `${product.category} ${product.name}`.toLowerCase().includes(word))).slice(0, template === "family" ? 12 : template.includes("trip") ? 10 : 8);
    const chosen = (picks.length ? picks : products.slice(0, 8)).map(product => ({ productId: product.id, sku: product.sku, name: product.name, unit: product.unit, category: product.category, quantity: template === "family" ? Math.max(1, Math.ceil(familyMembers / 4)) : budgetMode === "premium" ? 2 : 1 }));
    replaceItems(chosen); setTab("basket"); sheet.setSnap("half"); setSheetOpen(true);
  };
  const sheetStyle: React.CSSProperties = { ...sheet.panelProps.style, display: sheetOpen ? "block" : "none", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", background: "linear-gradient(155deg,rgba(18,20,34,.62),rgba(10,12,22,.5))", backdropFilter: "blur(20px) saturate(155%)", padding: "0 12px 20px" };
  const sheetGrip = <div style={{ position: "sticky", top: 0, zIndex: 2, background: "rgba(12,14,24,.58)", padding: "4px 4px 8px", margin: "0 -4px 9px" }}><button {...sheet.gripProps} style={{ ...sheet.gripProps.style, width: "100%", border: 0, background: "transparent", padding: "8px 0" }} /><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1, fontSize: ".55rem", color: "var(--muted2)" }}>Drag the bar to resize · {tab === "basket" ? "Compare branches" : tab === "planner" ? "Build a smart list" : "Find products"}</span>{sharedItems.length > 0 && tab !== "basket" && <button className="btn btn-ready" style={{ padding: "4px 9px", fontSize: ".58rem" }} onClick={() => setTab("basket")}><ShoppingCart size={11} /> Basket · {sharedItems.length}</button>}<button className="icon-btn" aria-label="Close panel" onClick={() => setSheetOpen(false)}><X size={12} /></button></div></div>;
  const status = loading ? "Loading the shared catalogue…" : loadError ? "Product prices are temporarily unavailable." : products.length ? "Prices show their observation date, branch and pack size." : "No product listings are available right now.";


  return <div className="page-wrap market-page" style={{ position: "relative", minHeight: "calc(100dvh - var(--top-h))", paddingTop: "calc(var(--top-h) + 8px)", paddingBottom: "var(--nav-h)" }}>
    <div style={{ position: "fixed", top: "var(--top-h)", left: 0, right: 0, bottom: "var(--nav-h)", zIndex: 0 }}><MapLibreView ref={mapRef} center={[-1.2864, 36.8172]} zoom={11} height="100%" borderRadius={0} onLoad={setMap} /></div>
    <div className="inner" style={{ position: "relative", zIndex: 1, paddingBottom: "60vh" }}>
    <header style={{ padding: "0 0 .7rem" }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><ShoppingCart size={18} style={{ color: "var(--ready)" }} /><h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>Market</h2><span style={{ marginLeft: "auto", color: "var(--muted2)", fontSize: ".54rem" }}>Store map</span></div></header>
    <PageTabs label="Market sections" active={tab} tabs={tabList(sharedItems.length)} onChange={value => { setTab(value as MarketTab); sheet.setSnap("peek"); setSheetOpen(true); }} />
    {tab === "planner" && <section className="ios-glass led-edge" style={sheetStyle}>{sheetGrip}<p style={{ color: "var(--muted2)", fontSize: ".61rem", lineHeight: 1.45, margin: "0 0 9px" }}>Plan a smart basket from the catalogue for home, school, or a trip. Product and branch prices are observations, not live stock or checkout quotes.</p><p role="status" style={{ color: "var(--muted2)", fontSize: ".55rem", lineHeight: 1.4, margin: "0 0 8px" }}>{status}</p><p className="sec-label">Smart shopping templates</p><p style={{ color: "var(--muted2)", fontSize: ".61rem", lineHeight: 1.45 }}>Pick a household or trip style to build a shared basket from available product listings. Missing products are skipped rather than invented.</p><div style={{ position: "relative", margin: "9px 0" }}><Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input className="finput" style={{ paddingLeft: 34 }} placeholder="Search items to add to your plan…" value={plannerQuery} onChange={event => setPlannerQuery(event.target.value)} /></div>{plannerQuery.trim() && <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>{plannerMatches.map(product => <button key={product.id} onClick={() => add(product)} className="card" style={{ padding: 9, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8, color: "var(--white)", cursor: "pointer" }}><span><b style={{ display: "block", fontSize: ".68rem" }}>{product.name}</b><small style={{ color: "var(--muted2)" }}>{product.category} · {product.unit}</small></span><Plus size={14} style={{ color: "var(--ready)" }} /></button>)}{plannerMatches.length === 0 && <small style={{ color: "var(--muted2)" }}>No catalogue items match that search.</small>}</div>}<select className="finput" value={template} onChange={event => setTemplate(event.target.value as TemplateId)}>{(Object.keys(PROFILE_LABELS) as TemplateId[]).map(id => <option key={id} value={id}>{PROFILE_LABELS[id].name} — {PROFILE_LABELS[id].note}</option>)}</select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><div><label>Spend style</label><select className="finput" value={budgetMode} onChange={event => setBudgetMode(event.target.value as typeof budgetMode)}><option value="saver">Budget friendly</option><option value="balanced">Balanced</option><option value="premium">More variety</option></select></div><div><label>Target spend, KES</label><input className="finput" type="number" min={0} value={budget} onChange={event => setBudget(event.target.value)} placeholder="Enter a budget" /></div></div>
      {template === "family" && <div style={{ marginTop: 12 }}><label>Household members</label><input className="finput" type="number" min={1} max={15} value={familyMembers} onChange={event => setFamilyMembers(Math.max(1, Number(event.target.value)))} /></div>}
      {(template === "school" || template === "campus") && <div style={{ marginTop: 12 }}><label>Learning level</label><select className="finput" value={schoolLevel} onChange={event => setSchoolLevel(event.target.value)}><option value="kindergarten">Kindergarten</option><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="university">University</option></select></div>}
      <button className="btn btn-ready" style={{ width: "100%", marginTop: 14 }} onClick={loadTemplate}><ShoppingCart size={14} /> Build {PROFILE_LABELS[template].name} basket</button>
      {!products.length && !loading && <p style={{ fontSize: ".61rem", color: "var(--muted2)", marginTop: 9 }}>{status}</p>}
    </section>}

    {tab === "search" && <section className="led-edge" style={sheetStyle}>{sheetGrip}<p style={{ color: "var(--muted2)", fontSize: ".61rem", lineHeight: 1.45, margin: "0 0 8px" }}>Browse the catalogue for items available through Boda Basket. Prices are observations, not live stock or checkout quotes; amber map pins mark geocoded branches.</p><p role="status" style={{ color: "var(--muted2)", fontSize: ".55rem", lineHeight: 1.4, margin: "0 0 8px" }}>{status}</p><div style={{ position: "relative", marginBottom: 10 }}><Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input className="finput" style={{ paddingLeft: 36 }} placeholder="Search item, brand, SKU or category…" value={query} onChange={event => setQuery(event.target.value)} autoFocus /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}><button className={`btn ${nearMe && userLocation ? "btn-go" : "btn-ready"}`} style={{ padding: "7px 10px", fontSize: ".61rem" }} onClick={toggleNearMe} disabled={locating}><LocateFixed size={12} />{locating ? "Finding you…" : nearMe && userLocation ? "Nearest shops first: on" : "Show nearest shops first"}</button>{nearMe && userLocation && <small style={{ color: "var(--muted2)", fontSize: ".56rem" }}>Sorted by the closest branch that has a price.</small>}</div>
      {locationMessage && <p style={{ color: "var(--muted2)", fontSize: ".57rem", margin: "0 0 8px" }}>{locationMessage}</p>}
      {!query && <div className="ios-glass" style={{ padding: 16, textAlign: "center", color: "var(--muted2)", fontSize: ".7rem" }}>Search products by name, brand, SKU or category.</div>}
      {loading && <p style={{ padding: 15, textAlign: "center", color: "var(--muted2)" }}><LoaderCircle size={15} /> Loading products…</p>}
      {!!query && <div style={{ display: "grid", gap: 8 }}>{filtered.map(product => { const cheapest = product.prices.length ? Math.min(...product.prices.map(price => price.amount)) : null; const nearest = nearMe && userLocation ? nearestPrice(product, userLocation) : null; const inBasket = sharedItems.find(item => item.productId === product.id); return <div key={product.id} style={{ display: "flex", gap: 6, alignItems: "stretch" }}><motion.button whileTap={{ scale: .98 }} onClick={() => setDetail(product)} className="card" style={{ flex: 1, minWidth: 0, padding: 12, textAlign: "left", color: "var(--white)", cursor: "pointer" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><ProductImage product={product} /><span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".76rem" }}>{product.name}</b><small style={{ color: "var(--muted2)" }}>{product.unit || "Pack size not set"} · {product.category}</small>{nearest && <small style={{ display: "block", color: "var(--ready)", marginTop: 2 }}>Nearest: {nearest.price.store} {nearest.price.branch || ""} · {nearest.distanceKm.toFixed(1)} km · KES {nearest.price.amount.toLocaleString()}</small>}</span><span style={{ textAlign: "right" }}>{cheapest !== null ? <><small style={{ display: "block", color: "var(--muted2)" }}>lowest seen</small><b style={{ color: "var(--go)", fontFamily: "var(--font-mono)", fontSize: ".76rem" }}>KES {cheapest.toLocaleString()}</b></> : <small style={{ color: "var(--muted2)" }}>No price yet</small>}</span></div></motion.button><button className="icon-btn" style={{ alignSelf: "center", width: 38, height: 38 }} aria-label={`Add ${product.name} to basket`} onClick={() => addToBasket(product)}>{inBasket ? <Check size={15} style={{ color: "var(--go)" }} /> : <Plus size={15} style={{ color: "var(--ready)" }} />}</button></div>; })}{query && filtered.length === 0 && <p style={{ textAlign: "center", color: "var(--muted2)", padding: 18 }}>No products match that search.</p>}</div>}
    </section>}

    {tab === "basket" && <section className="led-edge" style={sheetStyle}>{sheetGrip}<p style={{ color: "var(--muted2)", fontSize: ".61rem", lineHeight: 1.45, margin: "0 0 8px" }}>Compare item totals by supermarket branch and use amber map pins to find geocoded stores. Prices are observations, not live stock or checkout quotes.</p><p role="status" style={{ color: "var(--muted2)", fontSize: ".55rem", lineHeight: 1.4, margin: "0 0 8px" }}>{status}</p>
      <p className="sec-label">Compare your selected commodities across supermarket branches</p>
      <p style={{ color: "var(--muted2)", fontSize: ".6rem", lineHeight: 1.45, marginBottom: 8 }}>Search and add three or more items if you like. We total a branch only when it has a current observation for every selected basket item, across the five retailers.</p>
      <div style={{ position: "relative", marginBottom: 8 }}><Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input data-page-search className="finput" style={{ paddingLeft: 34 }} placeholder="Search commodities to add to compare…" value={compareQuery} onChange={event => setCompareQuery(event.target.value)} /></div>
      {!!compareMatches.length && <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>{compareMatches.map(product => { const Icon = iconFor(product.category); return <button key={product.id} className="card" onClick={() => { add(product); setCompareQuery(""); }} style={{ padding: 9, textAlign: "left", color: "var(--white)", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><Icon size={15} style={{ color: "var(--ready)" }} /><span style={{ flex: 1 }}><b style={{ display: "block", fontSize: ".67rem" }}>{product.name}</b><small style={{ color: "var(--muted2)" }}>{product.category} · {product.unit}</small></span><Plus size={14} style={{ color: "var(--ready)" }} /></button>; })}</div>}
      {!!basket.length && <div style={{ position: "relative", marginBottom: 9 }}><Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input className="finput" style={{ paddingLeft: 34 }} placeholder="Search your basket by item or category…" value={basketQuery} onChange={event => setBasketQuery(event.target.value)} /></div>}
      <div className="ios-glass" style={{ padding: 13, marginBottom: 10 }}><label>Budget in KES</label><input className="finput" type="number" min={0} value={budget} onChange={event => setBudget(event.target.value)} /><p style={{ marginTop: 7, color: "var(--muted2)", fontSize: ".61rem" }}>A branch is compared only when it has a latest observation for every basket item.</p></div>
      {!sharedItems.length ? <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--muted2)" }}><ShoppingCart size={32} style={{ margin: "0 auto 8px", color: "var(--ready)" }} /><p style={{ fontSize: ".76rem" }}>Your basket is empty</p><button className="btn btn-ready" style={{ marginTop: 10 }} onClick={() => setTab("search")}>Find catalogue items</button></div> : !basket.length ? <div className="ios-glass" style={{ padding: 14, color: "var(--muted2)", fontSize: ".68rem" }}>{loading ? "Loading your saved basket…" : "Some saved products are not in the current catalogue. Re-import the product list or remove those items from the local basket."}</div> : <>
        <div style={{ display: "grid", gap: 7, marginBottom: 12 }}>{visibleBasket.map(({ p, qty }) => { const Icon = iconFor(p.category); return <div key={p.id} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 8 }}><Icon size={17} style={{ color: "var(--ready)" }} /><span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".72rem" }}>{p.name}</b><small style={{ color: "var(--muted2)" }}>{p.unit}</small></span><button aria-label="Remove one" className="icon-btn" onClick={() => adjust(p.id, -1)}><Minus size={12} /></button><span style={{ minWidth: 16, textAlign: "center" }}>{qty}</span><button aria-label="Add one" className="icon-btn" onClick={() => adjust(p.id, 1)}><Plus size={12} /></button><button aria-label="Remove item" className="icon-btn" onClick={() => removeItem(p.id)}><Trash2 size={12} style={{ color: "var(--stop)" }} /></button></div>; })}{visibleBasket.length === 0 && <p style={{ color: "var(--muted2)", fontSize: ".63rem" }}>No basket items match that search.</p>}</div>
        <p style={{ color: "var(--muted2)", fontSize: ".58rem", lineHeight: 1.45, margin: "0 0 9px" }}>{persistsAcrossDevices ? (syncStatus === "error" ? "Could not back up your basket just now. It is still saved on this device." : "Your basket is saved to your account, so it will be here after you log out and in, or on another phone.") : "Your basket is saved on this device only. Sign in with Google or your phone to keep it on any device."}</p>
        <div className="ios-glass" style={{ padding: 13 }}><p className="sec-label">Checkout · {userLocation ? "your 3 nearest stores" : "the 3 cheapest stores"}</p>
          <p style={{ color: "var(--muted2)", fontSize: ".61rem", lineHeight: 1.5 }}>A store is listed only when it has a current price for every item in your basket. Distances are straight-line, not travel time, and prices are observations, not live stock.</p>
          <button onClick={requestLocation} className="btn btn-ready" style={{ width: "100%", margin: "5px 0 2px" }} disabled={locating}><LocateFixed size={13} />{locating ? "Finding your location…" : userLocation ? "Refresh nearby stores" : "Use my location to find the nearest stores"}</button>
          {locationMessage && <p style={{ color: "var(--muted2)", fontSize: ".58rem", marginTop: 6 }}>{locationMessage}</p>}
          {!branchComparisons.length && <p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 10 }}>No one branch has a current price for every basket item, so a checkout total cannot be shown yet. Remove an item or swap it for another.</p>}
          {checkoutOptions.map((branch, index) => {
            const picked = selectedBranch?.key === branch.key;
            const lowest = Math.min(...checkoutOptions.map(option => option.totalKes));
            const open = openBranch === branch.key;
            return <div key={branch.key} className="card" style={{ padding: 11, marginTop: 8, border: picked ? "1px solid var(--go)" : "1px solid var(--border2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 5px" }}><b style={{ fontSize: ".66rem", color: "var(--muted2)" }}>#{index + 1}</b><StoreBadge store={branch.store as Store} /><b style={{ fontSize: ".74rem" }}>{branch.branchName}</b></p>
                  <small style={{ color: "var(--muted2)" }}>{branch.region || "Region not supplied"}{branch.distanceKm !== null ? ` · ${branch.distanceKm.toFixed(1)} km straight-line` : ""}</small>
                  {branch.totalKes === lowest && checkoutOptions.length > 1 && <small style={{ display: "block", color: "var(--go)", marginTop: 3, fontWeight: 700 }}>Cheapest of these {checkoutOptions.length}</small>}
                </div>
                <b style={{ color: budgetNum && branch.totalKes > budgetNum ? "var(--stop)" : "var(--go)", fontFamily: "var(--font-mono)", fontSize: ".78rem", whiteSpace: "nowrap" }}>KES {branch.totalKes.toLocaleString()}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 9 }}>
                <button className="btn" style={{ padding: "7px 10px", fontSize: ".61rem" }} onClick={() => setOpenBranch(open ? null : branch.key)}>{open ? "Hide item prices" : "See item prices"}</button>
                <button onClick={() => chooseBranch(branch)} className="btn btn-ready" style={{ padding: "7px 10px", fontSize: ".61rem" }}>{picked ? <><Check size={12} /> Chosen</> : "Choose this store"}</button>
              </div>
              {open && <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 6 }}>{basket.map(({ p, qty }) => { const price = p.prices.find(item => item.key === branch.key); return <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", fontSize: ".62rem" }}><span>{qty} × {p.name}{p.unit ? ` · ${p.unit}` : ""}</span><span style={{ fontFamily: "var(--font-mono)" }}>KES {price ? (price.amount * qty).toLocaleString() : "—"}</span></div>; })}</div>}
            </div>;
          })}
          {cheapestBranch && !checkoutOptions.some(option => option.key === cheapestBranch.key) && <p style={{ color: "var(--muted2)", fontSize: ".6rem", marginTop: 9 }}>Cheapest of all {branchComparisons.length} stores: {cheapestBranch.store} · {cheapestBranch.branchName} at KES {cheapestBranch.totalKes.toLocaleString()}{cheapestBranch.distanceKm !== null ? ` (${cheapestBranch.distanceKm.toFixed(1)} km away)` : ""}. <button onClick={() => chooseBranch(cheapestBranch)} style={{ border: 0, background: "transparent", color: "var(--ready)", fontWeight: 700, cursor: "pointer", padding: 0 }}>Choose it</button></p>}
          {selectedBranch && !chosenOption && <p style={{ color: "var(--stop)", fontSize: ".61rem", marginTop: 10 }}>{selectedBranch.store} · {selectedBranch.branchName} no longer has a price for every item. Choose another store.</p>}
          {chosenOption && <div className="card" style={{ padding: 12, marginTop: 11, border: "1px solid var(--ready)" }}>
            <small className="sec-label">HOW DO YOU WANT TO SHOP AT {chosenOption.store.toUpperCase()} · {chosenOption.branchName.toUpperCase()}?</small>
            <p style={{ fontSize: ".66rem", margin: "6px 0 9px" }}>Basket total <b style={{ fontFamily: "var(--font-mono)", color: "var(--go)" }}>KES {chosenOption.totalKes.toLocaleString()}</b></p>
            <div style={{ display: "grid", gap: 7 }}>
              <button className="btn btn-go" style={{ width: "100%", justifyContent: "center" }} onClick={() => goMa3(chosenOption)}><Bus size={13} /> Go there by Ma3 (matatu)</button>
              <button className="btn btn-ready" style={{ width: "100%", justifyContent: "center" }} onClick={() => goNdai(chosenOption)}><Car size={13} /> Go there by Ndai (ride)</button>
              <button className="btn btn-ready" style={{ width: "100%", justifyContent: "center" }} onClick={() => goBoda(chosenOption)}><Bike size={13} /> Boda Basket: shop and deliver to me</button>
              <div style={{ textAlign: "center" }}><DirectionsLink branch={chosenOption} /></div>
            </div>
            <p style={{ color: "var(--muted2)", fontSize: ".56rem", lineHeight: 1.45, marginTop: 8 }}>Ma3 plans a route to the store. Ndai and Boda Basket are in demo mode for now: they set up the trip or delivery draft, but no real driver is requested and no payment is taken.</p>
          </div>}
          {branchComparisons.length > 3 && <><p className="sec-label" style={{ marginTop: 14 }}>All {branchComparisons.length} stores with a complete basket</p>
            {branchComparisons.map(branch => <div key={branch.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}><span style={{ minWidth: 0 }}><StoreBadge store={branch.store as Store} /><small style={{ display: "block", color: "var(--muted2)", marginTop: 4 }}>{branch.branchName} · {branch.region || "Region not supplied"}{branch.distanceKm !== null ? ` · ${branch.distanceKm.toFixed(1)} km` : ""}</small></span><span style={{ display: "flex", alignItems: "center", gap: 8 }}><b style={{ fontFamily: "var(--font-mono)", color: budgetNum && branch.totalKes > budgetNum ? "var(--stop)" : "var(--white)", fontSize: ".68rem", whiteSpace: "nowrap" }}>KES {branch.totalKes.toLocaleString()}</b><button aria-label={`Choose ${branch.store} ${branch.branchName}`} title="Choose this store" className="icon-btn" onClick={() => chooseBranch(branch)}><Check size={13} style={{ color: selectedBranch?.key === branch.key ? "var(--go)" : "var(--muted2)" }} /></button></span></div>)}</>}
          {!branchSchemaReady && <p style={{ marginTop: 10, color: "var(--muted2)", fontSize: ".59rem", lineHeight: 1.45 }}>Branch-level coordinates need `supabase/migrations/20261012000100_market_branches.sql` and CSV rows with `branch`, `latitude` and `longitude`. Until then, only branch-name comparisons may be available.</p>}
        </div>
      </>}
    </section>}

    {sharedItems.length > 0 && !sheetOpen && !detail && <button className="btn btn-ready" style={{ position: "fixed", left: 14, right: 14, bottom: "calc(var(--nav-h) + 10px)", zIndex: 40, justifyContent: "center", padding: 12 }} onClick={() => { setTab("basket"); sheet.setSnap("half"); setSheetOpen(true); }}><ShoppingCart size={14} /> Basket · {sharedItems.length} item{sharedItems.length === 1 ? "" : "s"} · Checkout</button>}
    <AnimatePresence>{detail && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,.55)", backdropFilter: "blur(7px)" }} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="ios-glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1101, maxWidth: 640, margin: "0 auto", padding: "1.2rem 1.2rem 2rem", borderRadius: "22px 22px 0 0", maxHeight: "80vh", overflowY: "auto" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><ProductImage product={detail} size={72} /><div style={{ flex: 1 }}><b>{detail.name}</b><small style={{ display: "block", color: "var(--muted2)" }}>{detail.sku} · {detail.unit}</small></div><button className="icon-btn" onClick={() => setDetail(null)}><X size={15} /></button></div><div style={{ display: "grid", gap: 7, margin: "15px 0" }}>{STORES.map(store => { const prices = detail.prices.filter(price => price.store === store); return prices.length ? prices.map(price => <div key={price.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", border: "1px solid var(--border2)", borderRadius: 10 }}><span><StoreBadge store={store} /><small style={{ display: "block", color: "var(--muted2)", marginTop: 4 }}>{price.branch || "Branch not supplied"}{price.region ? ` · ${price.region}` : ""}</small></span><span style={{ textAlign: "right" }}><b style={{ display: "block", fontFamily: "var(--font-mono)" }}>KES {price.amount.toLocaleString()}</b><small style={{ color: "var(--muted2)" }}>{new Date(price.observedAt).toLocaleDateString()} · {price.sourceType.replace(/_/g, " ")}</small></span></div>) : <div key={store} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", border: "1px solid var(--border2)", borderRadius: 10 }}><StoreBadge store={store} /><small style={{ color: "var(--muted2)" }}>No observation</small></div>; })}</div><button className="btn btn-ready" style={{ width: "100%" }} onClick={() => { addToBasket(detail); setDetail(null); }}><Plus size={14} /> Add to basket</button></motion.div></>}</AnimatePresence>
  </div></div>;
}
