import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ListChecks, LoaderCircle, LocateFixed, Search, Table2, X } from "lucide-react";
import { BASKET_TEMPLATES, type BasketTemplate } from "@/data/basketTemplates";
import { supabase } from "@/lib/supabase";

type Coordinates = { latitude: number; longitude: number };
export type ListChoice = { key: string; store: string; branchName: string; region: string; latitude: number | null; longitude: number | null; totalKes: number };
export type ListLine = { productId: string; sku: string; name: string; unit: string; category: string; quantity: number };

type Candidate = { id: string; sku: string; name: string; unit: string; category: string; brand: string | null; score: number };
type Price = { key: string; store: string; branch: string; region: string; lat: number | null; lon: number | null; amount: number };
type Row = { raw: string; term: string; qty: number; candidates: Candidate[]; picked: number };
type Option = ListChoice & { complete: boolean; missing: string[]; distanceKm: number | null; lines: { name: string; qty: number; unit: string; each: number | null; skip: boolean }[] };

const STOP = new Set(["of", "the", "a", "an", "and", "pack", "packet", "pkt", "bottle", "tin", "bag", "for", "some", "pcs", "piece", "pieces"]);
const SIZE = /^\d+(\.\d+)?(kg|g|gm|ml|l|ltr|ltrs|litre|litres|pcs)?$/;
const STORE_NAME: Record<string, string> = { naivas: "Naivas", quickmart: "Quickmart", carrefour: "Carrefour", chandarana: "Chandarana", cleanshelf: "Cleanshelf" };

export function parseList(text: string): { raw: string; term: string; qty: number; sizes: string[]; tokens: string[] }[] {
  return text.split(/[\n,;]+/).map(part => part.trim()).filter(Boolean).slice(0, 30).map(raw => {
    let working = raw.replace(/^[\-\*•\d]+[\.\)]\s+/, "").trim(); // "1. milk" or "- milk"
    let qty = 1;
    const lead = working.match(/^(\d{1,2})\s*(?:x|×)?\s+(?!(?:kg|g|gm|ml|l|ltr|ltrs|litres?)\b)(.+)$/i);
    const trail = working.match(/^(.+?)\s*(?:x|×)\s*(\d{1,2})$/i);
    if (lead) { qty = Number(lead[1]); working = lead[2]; } else if (trail) { qty = Number(trail[2]); working = trail[1]; }
    const words = working.toLowerCase().replace(/[^a-z0-9.\s]/g, " ").split(/\s+/).filter(Boolean);
    const sizes = words.filter(word => SIZE.test(word) && /[a-z]/.test(word));
    const tokens = words.filter(word => !STOP.has(word) && !SIZE.test(word) && word.length > 1);
    return { raw, term: tokens.join(" "), qty: Math.max(1, Math.min(99, qty)), sizes, tokens };
  }).filter(item => item.tokens.length);
}

const clean = (text: string) => text.replace(/[(),%_*]/g, " ").trim();

async function fetchPrices(ids: string[]): Promise<Map<string, Price[]>> {
  const out = new Map<string, Price[]>();
  const seen = new Set<string>();
  const add = (row: any) => {
    const slug = row.retailer_slug || (Array.isArray(row.retailers) ? row.retailers[0]?.slug : row.retailers?.slug);
    const store = STORE_NAME[slug];
    if (!store) return;
    const info = Array.isArray(row.retailer_branches) ? row.retailer_branches[0] : row.retailer_branches;
    const branch = row.branch_name || info?.branch_name || row.branch || "Branch not supplied";
    const region = row.branch_region || info?.region || row.region || "";
    const identity = row.branch_id || row.branch_slug || info?.branch_slug || `${String(branch).trim().toLowerCase()}|${String(region).trim().toLowerCase()}`;
    const key = `${store}:${identity}`;
    const mark = `${row.product_id}|${key}`;
    if (seen.has(mark)) return; seen.add(mark);
    const lat = row.latitude ?? info?.latitude, lon = row.longitude ?? info?.longitude;
    const list = out.get(row.product_id) ?? [];
    list.push({ key, store, branch, region, lat: lat === null || lat === undefined || lat === "" ? null : Number(lat), lon: lon === null || lon === undefined || lon === "" ? null : Number(lon), amount: Number(row.price_kes) });
    out.set(row.product_id, list);
  };
  for (let start = 0; start < ids.length; start += 25) {
    const chunk = ids.slice(start, start + 25);
    for (let offset = 0; offset < 4000; offset += 1000) {
      let result: any = await supabase!.from("latest_market_prices")
        .select("product_id,price_kes,retailer_slug,branch_id,branch,region,branch_slug,branch_name,branch_region,latitude,longitude,observed_at")
        .in("product_id", chunk).order("observed_at", { ascending: false }).range(offset, offset + 999);
      if (result.error) {
        result = await supabase!.from("price_observations")
          .select("product_id,price_kes,branch_id,branch,region,observed_at,retailers(slug),retailer_branches(branch_slug,branch_name,region,latitude,longitude)")
          .in("product_id", chunk).in("source_type", ["seeded_demo", "manual_entry", "user_submitted"]).order("observed_at", { ascending: false }).range(offset, offset + 999);
        if (result.error) result = await supabase!.from("price_observations")
          .select("product_id,price_kes,branch,region,observed_at,retailers(slug)")
          .in("product_id", chunk).in("source_type", ["seeded_demo", "manual_entry", "user_submitted"]).order("observed_at", { ascending: false }).range(offset, offset + 999);
      }
      if (result.error) throw result.error;
      (result.data ?? []).forEach(add);
      if (!result.data || result.data.length < 1000) break;
    }
  }
  return out;
}

/** Paste a shopping list. The app finds each item, then totals the WHOLE list at each single supermarket branch. Items are never split across shops. */
export default function ListCompare({ userLocation, requestLocation, locating, onResults, onChoose }: {
  userLocation: Coordinates | null; requestLocation: () => void; locating: boolean;
  onResults: (options: ListChoice[]) => void; onChoose: (lines: ListLine[], branch: ListChoice) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [prices, setPrices] = useState<Map<string, Price[]>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ignoreDistance, setIgnoreDistance] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [table, setTable] = useState(false);
  const [templates, setTemplates] = useState<BasketTemplate[]>(BASKET_TEMPLATES);
  const [templateQuery, setTemplateQuery] = useState("");
  useEffect(() => {
    if (!supabase) return;
    void supabase.from("basket_templates").select("id,name,blurb,items").eq("active", true).order("sort").then(({ data }) => {
      if (data?.length) setTemplates(data.map(row => ({ id: String(row.id), name: row.name, blurb: row.blurb ?? "", items: row.items ?? [] })));
    });
  }, []);
  const shownTemplates = templates.filter(template => !templateQuery.trim() || `${template.name} ${template.blurb} ${template.items.join(" ")}`.toLowerCase().includes(templateQuery.trim().toLowerCase()));
  const useTemplate = (template: BasketTemplate) => { const filled = template.items.join("\n"); setText(filled); void run(filled); };

  const run = async (override?: string) => {
    if (!supabase) { setError("Connect Supabase to compare prices."); return; }
    setExcluded(new Set());
    const items = parseList(override ?? text);
    if (!items.length) { setError("Paste or type at least one item, one per line."); return; }
    setBusy(true); setError(""); setRows([]); setNotFound([]); onResults([]);
    try {
      const found: Row[] = []; const missed: string[] = [];
      await Promise.all(items.map(async item => {
        const conditions = item.tokens.slice(0, 3).flatMap(token => { const t = clean(token); return [`name.ilike.%${t}%`, `brand.ilike.%${t}%`, `category.ilike.%${t}%`]; }).join(",");
        const { data, error: queryError } = await supabase!.from("products").select("id,sku,name,pack_size,category,brand").eq("active", true).or(conditions).limit(40);
        if (queryError) throw queryError;
        const candidates: Candidate[] = (data ?? []).map(row => {
          const hay = `${row.name} ${row.brand ?? ""}`.toLowerCase(), cat = `${row.category ?? ""}`.toLowerCase();
          let score = 0;
          item.tokens.forEach(token => { if (hay.includes(token)) score += 3; else if (cat.includes(token)) score += 1; });
          if (hay.startsWith(item.tokens[0])) score += 1;
          if (item.sizes.some(size => `${row.name} ${row.pack_size ?? ""}`.toLowerCase().replace(/\s/g, "").includes(size))) score += 2;
          if (score >= item.tokens.length * 3) score += 2; // every word matched in the name
          return { id: row.id, sku: row.sku ?? row.id, name: row.name, unit: row.pack_size || "", category: row.category || "Other", brand: row.brand || null, score };
        }).filter(candidate => candidate.score >= 3).sort((a, b) => b.score - a.score).slice(0, 5);
        if (!candidates.length) missed.push(item.raw); else found.push({ raw: item.raw, term: item.term, qty: item.qty, candidates, picked: 0 });
      }));
      found.sort((a, b) => items.findIndex(i => i.raw === a.raw) - items.findIndex(i => i.raw === b.raw));
      const priceMap = await fetchPrices([...new Set(found.flatMap(row => row.candidates.map(candidate => candidate.id)))]);
      // Among equally good matches, start with the one that has prices at the most branches.
      found.forEach(row => {
        const best = row.candidates[0].score;
        const tied = row.candidates.map((candidate, index) => ({ index, candidate })).filter(item => item.candidate.score >= best - 1);
        tied.sort((a, b) => (priceMap.get(b.candidate.id)?.length ?? 0) - (priceMap.get(a.candidate.id)?.length ?? 0));
        row.picked = tied[0].index;
      });
      setPrices(priceMap); setRows(found); setNotFound(missed);
      if (!found.length) setError("None of those items were found in the catalogue. Try simpler names, like sugar or milk.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read prices."); }
    setBusy(false);
  };

  const options = useMemo<Option[]>(() => {
    if (!rows.length) return [];
    const branches = new Map<string, Price>();
    rows.forEach(row => (prices.get(row.candidates[row.picked].id) ?? []).forEach(price => { if (!branches.has(price.key)) branches.set(price.key, price); }));
    const list: Option[] = [];
    branches.forEach((branch, key) => {
      let total = 0; const missing: string[] = []; const lines: Option["lines"] = [];
      rows.forEach((row, rowIndex) => {
        const product = row.candidates[row.picked]; const skip = excluded.has(rowIndex);
        const price = (prices.get(product.id) ?? []).find(item => item.key === key);
        if (!price) { if (!skip) missing.push(product.name); lines.push({ name: product.name, qty: row.qty, unit: product.unit, each: null, skip }); return; }
        if (!skip) total += price.amount * row.qty;
        lines.push({ name: product.name, qty: row.qty, unit: product.unit, each: price.amount, skip });
      });
      const hasPoint = branch.lat !== null && branch.lon !== null;
      const km = userLocation && hasPoint ? haversine(userLocation, { latitude: branch.lat!, longitude: branch.lon! }) : null;
      list.push({ key, store: branch.store, branchName: branch.branch, region: branch.region, latitude: branch.lat, longitude: branch.lon, totalKes: Math.round(total * 100) / 100, complete: missing.length === 0, missing, distanceKm: km, lines });
    });
    return list;
  }, [rows, prices, userLocation, excluded]);

  const complete = options.filter(option => option.complete);
  const ranked = useMemo(() => {
    if (complete.length) {
      if (ignoreDistance || !userLocation) return [...complete].sort((a, b) => a.totalKes - b.totalKes).slice(0, 3);
      const near = complete.filter(option => option.distanceKm !== null).sort((a, b) => a.distanceKm! - b.distanceKm!).slice(0, 3);
      return near.length ? near.sort((a, b) => a.totalKes - b.totalKes) : [...complete].sort((a, b) => a.totalKes - b.totalKes).slice(0, 3);
    }
    return [...options].sort((a, b) => a.missing.length - b.missing.length || a.totalKes - b.totalKes).slice(0, 3);
  }, [options, complete, ignoreDistance, userLocation]);

  const pinKey = ranked.map(option => `${option.key}:${option.totalKes}`).join("|");
  useMemo(() => { onResults(ranked); }, [pinKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dearest = complete.length ? Math.max(...complete.map(option => option.totalKes)) : 0;
  const average = complete.length ? complete.reduce((sum, option) => sum + option.totalKes, 0) / complete.length : 0;
  const swap = (rowIndex: number, picked: number) => setRows(current => current.map((row, index) => index === rowIndex ? { ...row, picked } : row));
  const setQty = (rowIndex: number, delta: number) => setRows(current => current.map((row, index) => index === rowIndex ? { ...row, qty: Math.max(1, Math.min(99, row.qty + delta)) } : row));
  const toLines = (): ListLine[] => rows.filter((_, index) => !excluded.has(index)).map(row => { const product = row.candidates[row.picked]; return { productId: product.id, sku: product.sku, name: product.name, unit: product.unit, category: product.category, quantity: row.qty }; });

  // Which items made the winner cheaper or dearer than the average of the complete stores.
  const why = (option: Option) => {
    if (!complete.length || complete.length < 2) return [];
    return rows.map((row, index) => {
      if (excluded.has(index)) return null;
      const product = row.candidates[row.picked];
      const others = complete.map(c => c.lines[index].each).filter((value): value is number => value !== null);
      const mine = option.lines[index].each;
      if (mine === null || others.length < 2) return null;
      const avg = others.reduce((a, b) => a + b, 0) / others.length;
      return { name: product.name, diff: (mine - avg) * row.qty };
    }).filter((item): item is { name: string; diff: number } => item !== null && Math.abs(item.diff) >= 1).sort((a, b) => a.diff - b.diff);
  };

  return <div>
    <p className="sec-label">Ready-made baskets</p>
    <div style={{ position: "relative", marginBottom: 7 }}><Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input className="finput" style={{ paddingLeft: 32 }} placeholder="Search baskets: student, baby, party, cleaning…" value={templateQuery} onChange={event => setTemplateQuery(event.target.value)} /></div>
    <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 8 }}>{shownTemplates.map(template => <button key={template.id} className="card" disabled={busy} onClick={() => useTemplate(template)} style={{ flex: "0 0 150px", padding: 9, textAlign: "left", color: "var(--white)", cursor: "pointer" }}><b style={{ display: "block", fontSize: ".66rem", lineHeight: 1.25 }}>{template.name}</b><small style={{ display: "block", color: "var(--muted2)", fontSize: ".55rem", marginTop: 3 }}>{template.items.length} items · {template.blurb}</small></button>)}{!shownTemplates.length && <small style={{ color: "var(--muted2)" }}>No basket matches. Type your own list below.</small>}</div>
    <p style={{ color: "var(--muted2)", fontSize: ".61rem", lineHeight: 1.45, margin: "0 0 8px" }}>Paste or type your whole shopping list, one item per line (you can add a number, like "2 sugar"). We total the <b>whole list</b> at each single supermarket, so you never have to run between shops.</p>
    <textarea className="finput" rows={5} style={{ resize: "vertical", lineHeight: 1.5 }} placeholder={"salt\nsugar 2kg\n2 cooking oil\nmaize flour\nmilk"} value={text} onChange={event => setText(event.target.value)} />
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <button className="btn btn-ready" style={{ flex: 1, justifyContent: "center" }} onClick={() => void run()} disabled={busy || !text.trim()}>{busy ? <LoaderCircle size={13} /> : <ListChecks size={13} />} {busy ? "Finding prices…" : "Find the best supermarket"}</button>
      {!!text && <button className="btn btn-ghost" onClick={() => { setText(""); setRows([]); setNotFound([]); setError(""); onResults([]); }}>Clear</button>}
    </div>
    {error && <p role="alert" style={{ color: "var(--stop)", fontSize: ".62rem", marginTop: 8 }}>{error}</p>}

    {!!rows.length && <>
      <div style={{ display: "flex", gap: 6, margin: "12px 0 6px", flexWrap: "wrap" }}>
        <button className={`btn ${ignoreDistance ? "btn-ready" : "btn-ghost"}`} style={{ padding: "6px 10px", fontSize: ".6rem" }} onClick={() => setIgnoreDistance(true)}>Cheapest overall</button>
        <button className={`btn ${!ignoreDistance ? "btn-ready" : "btn-ghost"}`} style={{ padding: "6px 10px", fontSize: ".6rem" }} onClick={() => { setIgnoreDistance(false); if (!userLocation) requestLocation(); }} disabled={locating}><LocateFixed size={11} /> {locating ? "Finding you…" : "Nearest to me"}</button>
      </div>
      <p className="sec-label">{complete.length ? `3 best stores for your whole list${!ignoreDistance && userLocation ? " (nearest)" : ""}` : "No single store has everything"}</p>
      {!complete.length && <p style={{ color: "var(--muted2)", fontSize: ".61rem", lineHeight: 1.45 }}>No branch prices every item. These are the closest. Try swapping an item.</p>}
      {complete.length > 1 && <button className="btn btn-ready" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => setTable(true)}><Table2 size={13} /> Compare item by item</button>}
      {ranked.map((option, index) => {
        const reasons = index === 0 || option.complete ? why(option) : [];
        const open = openKey === option.key;
        return <div key={option.key} className="card" style={{ padding: 11, marginTop: 8, border: index === 0 && option.complete ? "1px solid var(--go)" : "1px solid var(--border2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: "0 0 4px", fontSize: ".74rem" }}><b style={{ color: "var(--muted2)" }}>#{index + 1}</b> <b>{option.store}</b> · {option.branchName}</p>
              <small style={{ color: "var(--muted2)" }}>{option.region || "Region not supplied"}{option.distanceKm !== null ? ` · ${option.distanceKm.toFixed(1)} km away` : ""}</small>
              {option.complete && dearest > option.totalKes && <small style={{ display: "block", color: "var(--go)", fontWeight: 700, marginTop: 3 }}>Saves KES {Math.round(dearest - option.totalKes).toLocaleString()} compared with the dearest store{average > option.totalKes ? ` (KES ${Math.round(average - option.totalKes).toLocaleString()} under average)` : ""}</small>}
              {!option.complete && <small style={{ display: "block", color: "var(--stop)", marginTop: 3 }}>Missing: {option.missing.join(", ")}</small>}
            </div>
            <b style={{ color: "var(--go)", fontFamily: "var(--font-mono)", fontSize: ".82rem", whiteSpace: "nowrap" }}>KES {Math.round(option.totalKes).toLocaleString()}</b>
          </div>
          {!!reasons.length && <p style={{ color: "var(--muted2)", fontSize: ".58rem", lineHeight: 1.5, margin: "7px 0 0" }}>{reasons.slice(0, 2).filter(item => item.diff < 0).map(item => `${item.name} is KES ${Math.round(-item.diff)} cheaper here than average`).join(" · ")}{reasons.some(item => item.diff > 0) ? `${reasons.some(item => item.diff < 0) ? " · " : ""}${reasons.slice(-1).filter(item => item.diff > 0).map(item => `${item.name} costs KES ${Math.round(item.diff)} more here, but the whole list still comes out cheaper`).join("")}` : ""}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 9 }}>
            <button className="btn" style={{ padding: "7px 10px", fontSize: ".61rem" }} onClick={() => setOpenKey(open ? null : option.key)}>{open ? "Hide prices" : "See every price"}</button>
            <button className="btn btn-ready" style={{ padding: "7px 10px", fontSize: ".61rem" }} onClick={() => onChoose(toLines(), option)}><Check size={12} /> Shop here</button>
          </div>
          {open && <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 6 }}>{option.lines.map((line, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", fontSize: ".62rem" }}><span>{line.qty} × {line.name}{line.unit ? ` · ${line.unit}` : ""}</span><span style={{ fontFamily: "var(--font-mono)" }}>{line.each === null ? "not priced" : `KES ${Math.round(line.each * line.qty).toLocaleString()}`}</span></div>)}</div>}
        </div>;
      })}

      <p className="sec-label" style={{ marginTop: 14 }}>What we matched for your list</p>
      <div style={{ display: "grid", gap: 6 }}>{rows.map((row, rowIndex) => <div key={row.raw + rowIndex} className="card" style={{ padding: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0 }}><small style={{ color: "var(--muted2)" }}>You wrote: {row.raw}</small>
            <select className="finput" style={{ marginTop: 4, fontSize: ".66rem", padding: "6px 8px" }} value={row.picked} onChange={event => swap(rowIndex, Number(event.target.value))}>{row.candidates.map((candidate, index) => <option key={candidate.id} value={index}>{candidate.name}{candidate.unit ? ` · ${candidate.unit}` : ""}</option>)}</select></span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><button className="icon-btn" aria-label="Less" onClick={() => setQty(rowIndex, -1)}>−</button><b>{row.qty}</b><button className="icon-btn" aria-label="More" onClick={() => setQty(rowIndex, 1)}>+</button></span>
        </div>
      </div>)}</div>
    </>}
    {!!notFound.length && <p style={{ color: "var(--ready)", fontSize: ".6rem", marginTop: 9, lineHeight: 1.45 }}>Not found in the catalogue, so left out: {notFound.join(", ")}.</p>}
    <p style={{ color: "var(--muted2)", fontSize: ".55rem", lineHeight: 1.45, marginTop: 10 }}>Prices are recent observations, not live shelf prices.</p>
    {table && <CompareTable options={ranked} rows={rows} excluded={excluded} toggle={index => setExcluded(current => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} onClose={() => setTable(false)} />}
  </div>;
}

function haversine(a: Coordinates, b: Coordinates) {
  const rad = (d: number) => d * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Stores across the top, products down the side. Per row: cheapest green, dearest red, all equal amber. Remove a product to see how the totals change. */
function CompareTable({ options, rows, excluded, toggle, onClose }: { options: Option[]; rows: Row[]; excluded: Set<number>; toggle: (index: number) => void; onClose: () => void }) {
  const GREEN = "rgba(22,163,74,.34)", RED = "rgba(220,38,38,.36)", AMBER = "rgba(245,158,11,.30)";
  const shade = (value: number | null, all: (number | null)[]) => {
    const present = all.filter((v): v is number => v !== null);
    if (value === null || present.length < 2) return value === null ? "transparent" : AMBER;
    const lo = Math.min(...present), hi = Math.max(...present);
    if (lo === hi) return AMBER;
    return value === lo ? GREEN : value === hi ? RED : "transparent";
  };
  const totals = options.map(option => option.totalKes);
  const cell: React.CSSProperties = { padding: "7px 6px", borderBottom: "1px solid var(--border)", textAlign: "right", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" };
  return createPortal(<div role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(2,6,16,.78)", display: "grid", placeItems: "center", padding: 10 }}>
    <div onClick={event => event.stopPropagation()} style={{ width: "min(100%, 720px)", maxHeight: "92dvh", overflow: "auto", borderRadius: 18, background: "#0a0e1c", border: "1px solid var(--border2)", padding: 12, color: "var(--white)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><b style={{ fontSize: ".8rem" }}>Item by item</b><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={15} /></button></div>
      <p style={{ fontSize: ".58rem", color: "var(--muted2)", lineHeight: 1.5, margin: "0 0 8px" }}><span style={{ background: GREEN, padding: "1px 6px", borderRadius: 5 }}>cheapest</span> <span style={{ background: RED, padding: "1px 6px", borderRadius: 5 }}>dearest</span> <span style={{ background: AMBER, padding: "1px 6px", borderRadius: 5 }}>same price</span> &nbsp;Tap × to leave a product out and see the new totals.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".62rem" }}>
        <thead><tr><th style={{ textAlign: "left", padding: "6px 6px", position: "sticky", left: 0, background: "#0a0e1c" }}>Product</th>{options.map(option => <th key={option.key} style={{ padding: "6px 6px", textAlign: "right", verticalAlign: "bottom" }}><b>{option.store}</b><small style={{ display: "block", color: "var(--muted2)", fontWeight: 500 }}>{option.branchName}</small></th>)}</tr></thead>
        <tbody>{rows.map((row, index) => {
          const product = row.candidates[row.picked]; const skip = excluded.has(index);
          const values = options.map(option => { const line = option.lines[index]; return line && line.each !== null ? line.each * row.qty : null; });
          return <tr key={index} style={{ opacity: skip ? .38 : 1 }}>
            <td style={{ padding: "7px 6px", borderBottom: "1px solid var(--border)", position: "sticky", left: 0, background: "#0a0e1c", maxWidth: 170 }}><button aria-label={skip ? "Add back" : "Leave out"} onClick={() => toggle(index)} style={{ marginRight: 6, border: 0, background: "transparent", color: skip ? "var(--go)" : "var(--stop)", cursor: "pointer", fontWeight: 800 }}>{skip ? "+" : "×"}</button><span style={{ textDecoration: skip ? "line-through" : "none" }}>{row.qty > 1 ? `${row.qty} × ` : ""}{product.name}{product.unit ? ` · ${product.unit}` : ""}</span></td>
            {values.map((value, column) => <td key={column} style={{ ...cell, background: skip ? "transparent" : shade(value, values) }}>{value === null ? "—" : Math.round(value).toLocaleString()}</td>)}
          </tr>; })}
          <tr><td style={{ padding: "8px 6px", fontWeight: 800, position: "sticky", left: 0, background: "#0a0e1c" }}>Total (KES)</td>{totals.map((total, column) => <td key={column} style={{ ...cell, fontWeight: 800, background: shade(total, totals), borderBottom: 0 }}>{Math.round(total).toLocaleString()}</td>)}</tr>
        </tbody></table></div>
    </div>
  </div>, document.body);
}
