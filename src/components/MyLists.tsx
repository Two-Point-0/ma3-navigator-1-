import { useCallback, useEffect, useState } from "react";
import { Copy, Download, ListPlus, Share2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { useShoppingBasket, type ShoppingBasketItem } from "@/lib/shoppingBasket";

type SavedList = { id: string; name: string; join_code: string | null; items: ShoppingBasketItem[]; is_owner: boolean; member_count: number; updated_at: string };

/** Named shopping lists. Save your basket under a name, load it later, and share it with friends by a 6-letter code. */
export default function MyLists() {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const { items, replaceItems } = useShoppingBasket();
  const [lists, setLists] = useState<SavedList[]>([]);
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [open, setOpen] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!supabase || !signedIn) return;
    const { data, error } = await supabase.rpc("my_shared_baskets");
    if (!error) setLists((data ?? []) as SavedList[]);
  }, [signedIn]);
  useEffect(() => {
    void load();
    if (!supabase || !signedIn) return;
    const timer = window.setInterval(() => void load(), 15000);
    const channel = supabase.channel("my-lists").on("postgres_changes", { event: "*", schema: "public", table: "shared_baskets" }, () => void load()).subscribe();
    return () => { window.clearInterval(timer); void supabase!.removeChannel(channel); };
  }, [load, signedIn]);

  const run = async (fn: () => Promise<unknown>, done?: string) => { setBusy(true); try { await fn(); if (done) toast.success(done); await load(); } catch (error) { toast.error((error as Error).message); } setBusy(false); };
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await supabase!.rpc(fn, args); if (error) throw new Error(error.message); return data; };
  const share = async (list: SavedList) => {
    const message = `Join my shopping list "${list.name}" on Ma3 Market. Open Market > Basket > My lists and enter the code ${list.join_code}.`;
    try { if (navigator.share) await navigator.share({ title: "Ma3 shopping list", text: message }); else { await navigator.clipboard.writeText(message); toast.success("Invite copied. Paste it in WhatsApp."); } } catch { /* cancelled */ }
  };

  if (!supabase) return null;
  return <details className="ios-glass" style={{ padding: 10, marginBottom: 10 }}>
    <summary style={{ cursor: "pointer", fontSize: ".72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}><ListPlus size={14} style={{ color: "var(--ready)" }} /> My lists &amp; sharing{lists.length ? ` · ${lists.length}` : ""}</summary>
    {!signedIn ? <p style={{ fontSize: ".62rem", color: "var(--muted2)", lineHeight: 1.5, margin: "8px 0 0" }}>Sign in with your phone or Google to save named lists and share them with friends. <Link href="/login"><u>Sign in</u></Link></p> : <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}><input className="finput" maxLength={40} placeholder="Name this basket, e.g. Weekend shopping" value={name} onChange={event => setName(event.target.value)} /><button className="btn btn-ready" disabled={busy || !name.trim() || !items.length} onClick={() => void run(async () => { await rpc("create_shared_basket", { p_name: name, p_items: items }); setName(""); }, "List saved")}>Save</button></div>
      {!items.length && <small style={{ color: "var(--muted2)" }}>Add items to your basket first, then save it under a name.</small>}
      <div style={{ display: "flex", gap: 6 }}><input className="finput" maxLength={8} placeholder="Friend's code, e.g. K7M2QX" value={code} onChange={event => setCode(event.target.value.toUpperCase())} /><button className="btn btn-ghost" disabled={busy || code.trim().length < 4} onClick={() => void run(async () => { await rpc("join_shared_basket", { p_code: code }); setCode(""); }, "Joined the list")}><UserPlus size={12} /> Join</button></div>
      {lists.map(list => <div key={list.id} className="card" style={{ padding: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: ".72rem" }}>{list.name}</b><small style={{ display: "block", color: "var(--muted2)" }}>{list.items.length} item{list.items.length === 1 ? "" : "s"} · <Users size={10} style={{ verticalAlign: -1 }} /> {list.member_count} {list.member_count === 1 ? "person" : "people"}{list.is_owner ? "" : " · shared with you"}</small></span><button className="btn btn-ghost" style={{ padding: "5px 8px", fontSize: ".58rem" }} onClick={() => setOpen(open === list.id ? null : list.id)}>{open === list.id ? "Hide" : "Open"}</button></div>
        {open === list.id && <div style={{ marginTop: 8 }}>
          {list.items.map(item => <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: ".62rem", padding: "2px 0" }}><span>{item.name}{item.unit ? ` · ${item.unit}` : ""}</span><b>× {item.quantity}</b></div>)}
          {!list.items.length && <small style={{ color: "var(--muted2)" }}>This list is empty.</small>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <button className="btn btn-go" style={{ padding: "6px 9px", fontSize: ".6rem" }} disabled={!list.items.length} onClick={() => { replaceItems(list.items); toast.success(`"${list.name}" is now your basket`); }}><Download size={12} /> Use as my basket</button>
            <button className="btn btn-ready" style={{ padding: "6px 9px", fontSize: ".6rem" }} disabled={busy || !items.length} onClick={() => void run(() => rpc("update_shared_basket", { p_id: list.id, p_items: items }), "List updated for everyone")}>Save my basket into it</button>
            {list.is_owner && list.join_code && <><button className="btn btn-ghost" style={{ padding: "6px 9px", fontSize: ".6rem" }} onClick={() => void share(list)}><Share2 size={12} /> Share</button><button className="btn btn-ghost" style={{ padding: "6px 9px", fontSize: ".6rem" }} onClick={() => { void navigator.clipboard?.writeText(list.join_code!); toast.success("Code copied"); }}><Copy size={12} /> Code {list.join_code}</button></>}
            <button className="btn btn-ghost" style={{ padding: "6px 9px", fontSize: ".6rem", color: "var(--stop)" }} onClick={() => { if (window.confirm(list.is_owner ? "Delete this list for everyone?" : "Leave this list?")) void run(() => rpc("leave_or_delete_shared_basket", { p_id: list.id })); }}><Trash2 size={12} /> {list.is_owner ? "Delete" : "Leave"}</button>
          </div>
          {!list.is_owner && <small style={{ display: "block", color: "var(--muted2)", marginTop: 6 }}>Changes you save here are seen by everyone on the list.</small>}
        </div>}
      </div>)}
    </div>}
  </details>;
}
