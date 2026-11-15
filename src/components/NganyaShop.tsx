import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BusFront, Check, Heart, Minus, Plus, Search, ShoppingBag, Users } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { NGANYA_CATALOGUE, NGANYA_CATEGORIES, type CatalogueItem } from "@/data/nganyaCatalogue";

type Product = CatalogueItem & { id?: string; price: number | null; stock: number; status: string; rights: string; artist?: string | null; owner?: string | null };
const CART_KEY = "ma3_nganya_cart_v1";
const imageUrl = (file: string) => supabase ? supabase.storage.from("nganya-products").getPublicUrl(file).data.publicUrl : "";
const onSale = (p: Product) => p.status === "active" && p.rights === "cleared" && p.price !== null && p.price > 0 && p.stock > 0;

function readCart(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? "{}"); } catch { return {}; }
}

function Picture({ p, size }: { p: Product; size: number }) {
  const [broken, setBroken] = useState(false);
  if (!p.image || broken || !isSupabaseConfigured) {
    return <div aria-label={p.alt} style={{ width: "100%", height: size, borderRadius: 12, background: "rgba(217,119,6,.10)", display: "grid", placeItems: "center", color: "var(--ready)" }}><BusFront size={Math.round(size / 3)} /></div>;
  }
  return <img src={imageUrl(p.image)} alt={p.alt} loading="lazy" onError={() => setBroken(true)} style={{ width: "100%", height: size, objectFit: "cover", borderRadius: 12, display: "block" }} />;
}

export default function NganyaShop() {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [products, setProducts] = useState<Product[]>(() => NGANYA_CATALOGUE.map(item => ({ ...item, price: null, stock: 0, status: "concept", rights: "pending" })));
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Product | null>(null);
  const [cart, setCart] = useState<Record<string, number>>(readCart);
  const [view, setView] = useState<"shop" | "cart">("shop");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [saccos, setSaccos] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [routeSacco, setRouteSacco] = useState("");
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* private window */ } }, [cart]);

  // The Supabase copy (with real prices and photos) replaces the bundled copy when it exists.
  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase!.from("nganya_products").select("id,sku,name,description,category,price_kes,stock_qty,status,image_path,alt_text,artist_credit,owner_credit,rights_status").eq("visible", true).order("sort_order");
      if (data?.length) setProducts(data.map((row: any) => ({ id: row.id, sku: row.sku, name: row.name, description: row.description, category: row.category, image: row.image_path ?? "", alt: row.alt_text ?? row.name, price: row.price_kes === null ? null : Number(row.price_kes), stock: row.stock_qty, status: row.status, rights: row.rights_status, artist: row.artist_credit, owner: row.owner_credit })));
      const { data: groups } = await supabase!.from("saccos").select("id,name,kind").order("name");
      setSaccos(groups ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!supabase || !signedIn || !user) return;
    void (async () => {
      const [{ data: mine }, { data: likes }] = await Promise.all([
        supabase!.from("sacco_members").select("sacco_id").eq("user_id", user.id),
        supabase!.from("nganya_product_interest").select("product_id").eq("user_id", user.id),
      ]);
      setJoined(new Set((mine ?? []).map((row: any) => row.sacco_id)));
      setLiked(new Set((likes ?? []).map((row: any) => row.product_id)));
    })();
  }, [signedIn, user?.id]);

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return products.filter(p => (!category || p.category === category) && (!text || `${p.name} ${p.description} ${p.sku} ${NGANYA_CATEGORIES[p.category] ?? p.category}`.toLowerCase().includes(text)));
  }, [products, category, query]);
  const categoryList = useMemo(() => { const out: Record<string, string> = { ...NGANYA_CATEGORIES }; for (const p of products) if (!out[p.category]) out[p.category] = p.category.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()); return Object.entries(out).filter(([id]) => products.some(p => p.category === id)); }, [products]);
  const counts = useMemo(() => { const out: Record<string, number> = {}; for (const p of products) out[p.category] = (out[p.category] ?? 0) + 1; return out; }, [products]);
  const lines = products.filter(p => p.id && cart[p.id] && onSale(p));
  const total = lines.reduce((sum, p) => sum + (p.price ?? 0) * cart[p.id!], 0);
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const change = (p: Product, delta: number) => {
    if (!p.id) return;
    setCart(current => { const next = { ...current, [p.id!]: Math.max(0, Math.min(99, (current[p.id!] ?? 0) + delta)) }; if (!next[p.id!]) delete next[p.id!]; return next; });
  };

  const toggleInterest = async (p: Product) => {
    if (!supabase || !p.id) { toast.info("Interest taps start once the catalogue is loaded to Supabase."); return; }
    if (!signedIn || !user) { toast.info("Sign in to tap 'I would buy this'."); return; }
    const has = liked.has(p.id);
    const result = has ? await supabase.from("nganya_product_interest").delete().eq("product_id", p.id).eq("user_id", user.id) : await supabase.from("nganya_product_interest").insert({ product_id: p.id });
    if (result.error) { toast.error("Could not save that tap."); return; }
    setLiked(current => { const next = new Set(current); if (has) next.delete(p.id!); else next.add(p.id!); return next; });
  };

  const join = async (id: string) => {
    if (!supabase || !signedIn) { toast.info("Sign in to join a sacco."); return; }
    const { error } = await supabase.from("sacco_members").insert({ sacco_id: id });
    if (error && !String(error.message).includes("duplicate")) { toast.error("Could not join right now."); return; }
    setJoined(current => new Set(current).add(id));
    toast.success("You are on the interest list. No money is taken and no membership benefits are promised yet.");
  };

  const checkout = async () => {
    if (!supabase || !signedIn) { toast.info("Sign in to place an order."); return; }
    if (!agreed) { toast.error("Please tick the box to accept the terms and privacy notice."); return; }
    if (phone.replace(/\D/g, "").length < 9) { toast.error("Add a phone number so we can reach you."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_nganya_order", { p_items: lines.map(p => ({ productId: p.id, quantity: cart[p.id!] })), p_phone: phone, p_note: note || null, p_route_sacco: routeSacco || null, p_accept_terms: agreed });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCart({}); setView("shop");
    toast.success(`Order saved${data?.[0]?.new_total_kes ? ` · KES ${Number(data[0].new_total_kes).toLocaleString()}` : ""}. Payment is in demo mode, nothing was charged.`);
  };

  if (open) {
    const sale = onSale(open);
    return <section>
      <button className="pill" onClick={() => setOpen(null)} style={{ marginBottom: 9 }}><ArrowLeft size={11} /> All products</button>
      <Picture p={open} size={210} />
      <b style={{ display: "block", fontSize: ".9rem", margin: "10px 0 3px" }}>{open.name}</b>
      <small style={{ color: "var(--muted2)" }}>{categoryList.find(([id]) => id === open.category)?.[1] ?? open.category} · {open.sku}</small>
      <p style={{ fontSize: ".7rem", lineHeight: 1.55, margin: "9px 0" }}>{open.description}</p>
      <div className="ios-glass" style={{ padding: 10, marginBottom: 9, fontSize: ".64rem", lineHeight: 1.5 }}>
        {sale ? <b style={{ color: "var(--go)" }}>KES {open.price!.toLocaleString()} · {open.stock} in stock</b> : <b style={{ color: "var(--ready)" }}>Coming soon. This is a concept, not on sale yet.</b>}
        <div style={{ color: "var(--muted2)", marginTop: 4 }}>Artwork rights: {open.rights}{open.artist ? ` · artist ${open.artist}` : ""}{open.owner ? ` · owner ${open.owner}` : ""}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ready" style={{ flex: 1 }} onClick={() => void toggleInterest(open)}><Heart size={13} fill={open.id && liked.has(open.id) ? "currentColor" : "none"} /> I would buy this</button>
        {sale && <button className="btn btn-go" style={{ flex: 1 }} onClick={() => { change(open, 1); toast.success("Added to your cart"); }}><ShoppingBag size={13} /> Add to cart</button>}
      </div>
      {open.sku === "NG-GAME-046" && <p style={{ color: "var(--muted)", fontSize: ".58rem", marginTop: 9 }}>Future idea only. No NFT or token is being built or sold.</p>}
    </section>;
  }

  if (view === "cart") {
    return <section>
      <button className="pill" onClick={() => setView("shop")} style={{ marginBottom: 9 }}><ArrowLeft size={11} /> Keep browsing</button>
      {lines.length === 0 && <div className="ios-glass" style={{ padding: 14, textAlign: "center", color: "var(--muted2)", fontSize: ".7rem" }}>Your cart is empty. Only products with a price and stock can be added.</div>}
      <div style={{ display: "grid", gap: 7 }}>{lines.map(p => <div key={p.id} className="card" style={{ padding: 9, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, fontSize: ".7rem" }}><b>{p.name}</b><small style={{ display: "block", color: "var(--muted2)" }}>KES {p.price!.toLocaleString()} each</small></span>
        <button className="icon-btn" aria-label="Less" onClick={() => change(p, -1)}><Minus size={13} /></button><b>{cart[p.id!]}</b><button className="icon-btn" aria-label="More" onClick={() => change(p, 1)}><Plus size={13} /></button>
      </div>)}</div>
      {lines.length > 0 && <div className="ios-glass" style={{ padding: 11, marginTop: 10, display: "grid", gap: 8 }}>
        <b style={{ fontSize: ".8rem" }}>Total KES {total.toLocaleString()}</b>
        <label>Phone<input className="finput" inputMode="tel" placeholder="07xx xxx xxx" value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <label>Delivery note<input className="finput" placeholder="Where and when" value={note} onChange={e => setNote(e.target.value)} /></label>
        <label>Credit a route group (optional)<select className="finput" value={routeSacco} onChange={e => setRouteSacco(e.target.value)}><option value="">None</option>{saccos.filter(s => s.kind === "route").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: ".58rem", lineHeight: 1.45, color: "var(--muted2)" }}><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />I accept the <a href="/legal?tab=shop" target="_blank" rel="noreferrer" style={{ color: "var(--ready)" }}>shop terms</a> and the <a href="/legal?tab=privacy" target="_blank" rel="noreferrer" style={{ color: "var(--ready)" }}>privacy notice</a>. My phone number is used only to handle this order.</label>
        <button className="btn btn-go" disabled={busy} onClick={() => void checkout()}>{busy ? "Saving…" : "Place order (demo, no payment)"}</button>
        {!signedIn && <small style={{ color: "var(--muted2)" }}>Sign in with Google or phone to order.</small>}
      </div>}
    </section>;
  }

  const platform = saccos.find(s => s.kind === "platform");
  return <section>
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
      <div style={{ position: "relative", flex: 1 }}><Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ready)" }} /><input data-page-search className="finput" style={{ paddingLeft: 34 }} placeholder={`Search ${products.length} products…`} value={query} onChange={e => setQuery(e.target.value)} /></div>
      <button className="pill" onClick={() => setView("cart")} aria-label="Open cart"><ShoppingBag size={12} /> {cartCount}</button>
    </div>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 6 }}>
      <button className={`pill ${category === "" ? "on" : ""}`} onClick={() => setCategory("")}>All {products.length}</button>
      {categoryList.map(([id, label]) => <button key={id} className={`pill ${category === id ? "on" : ""}`} onClick={() => setCategory(id)} style={{ whiteSpace: "nowrap" }}>{label} {counts[id] ?? 0}</button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{shown.map(p => <button key={p.sku} className="card" onClick={() => setOpen(p)} style={{ padding: 7, textAlign: "left", color: "var(--white)", cursor: "pointer" }}>
      <Picture p={p} size={92} />
      <b style={{ display: "block", fontSize: ".68rem", margin: "6px 0 2px", lineHeight: 1.25 }}>{p.name}</b>
      <small style={{ color: onSale(p) ? "var(--go)" : "var(--ready)" }}>{onSale(p) ? `KES ${p.price!.toLocaleString()}` : "Coming soon"}</small>
    </button>)}</div>
    {shown.length === 0 && <p style={{ textAlign: "center", color: "var(--muted2)", padding: 16, fontSize: ".7rem" }}>No product matches that search.</p>}
    <div className="ios-glass" style={{ padding: 11, marginTop: 12 }}>
      <b style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".74rem" }}><Users size={14} style={{ color: "var(--ready)" }} />Ma3 Community List</b>
      <p style={{ color: "var(--muted2)", fontSize: ".6rem", lineHeight: 1.5, margin: "5px 0 8px" }}>A free interest list for people who want to be part of a future matatu-community sacco. It is not a registered sacco, takes no money and promises no benefits. Planned split of product sales: 70% app, 15% route group, 15% matatu owner, subject to signed agreements. Amounts are recorded and held, and nothing is paid out until the agreements are verified.</p>
      {platform ? (joined.has(platform.id) ? <span className="chip" style={{ color: "var(--go)" }}><Check size={11} /> You are a member</span> : <button className="btn btn-ready" onClick={() => void join(platform.id)}>Join the interest list</button>) : <small style={{ color: "var(--muted2)" }}>Joining opens after the database update is applied.</small>}
    </div>
  </section>;
}
