import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const BASKET_KEY = "ma3_market_basket_v1";
const BRANCH_KEY = "ma3_market_branch_v1";
const SAVE_DELAY_MS = 700;

export interface ShoppingBasketItem {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  quantity: number;
}

export interface SelectedMarketBranch {
  key: string;
  store: string;
  branchName: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  totalKes: number;
}

/** local = browser only; saving/saved/error = backup to the signed-in account. */
export type BasketSyncStatus = "local" | "saving" | "saved" | "error";

interface ShoppingBasketContextValue {
  items: ShoppingBasketItem[];
  selectedBranch: SelectedMarketBranch | null;
  syncStatus: BasketSyncStatus;
  /** True only for a signed-in (non-guest) account, whose basket follows it to any device. */
  persistsAcrossDevices: boolean;
  addItem: (item: Omit<ShoppingBasketItem, "quantity">, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  replaceItems: (items: ShoppingBasketItem[]) => void;
  clearItems: () => void;
  setSelectedBranch: (branch: SelectedMarketBranch | null) => void;
}

const ShoppingBasketContext = createContext<ShoppingBasketContextValue | null>(null);

function cleanItems(value: unknown): ShoppingBasketItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ShoppingBasketItem =>
    !!item && typeof item.productId === "string" && typeof item.name === "string" &&
    Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
  ).map(item => ({
    productId: item.productId, sku: String(item.sku ?? item.productId), name: item.name,
    unit: String(item.unit ?? ""), category: String(item.category ?? "Other"),
    quantity: Math.min(99, Math.floor(Number(item.quantity))),
  }));
}

function cleanBranch(value: unknown): SelectedMarketBranch | null {
  if (!value || typeof value !== "object") return null;
  const branch = value as SelectedMarketBranch;
  return typeof branch.key === "string" && typeof branch.store === "string" ? branch : null;
}

function loadItems(): ShoppingBasketItem[] {
  try { return cleanItems(JSON.parse(localStorage.getItem(BASKET_KEY) || "[]")); } catch { return []; }
}

function loadBranch(): SelectedMarketBranch | null {
  try { return cleanBranch(JSON.parse(localStorage.getItem(BRANCH_KEY) || "null")); } catch { return null; }
}

function writeLocal(items: ShoppingBasketItem[], branch: SelectedMarketBranch | null) {
  try {
    localStorage.setItem(BASKET_KEY, JSON.stringify(items));
    if (branch) localStorage.setItem(BRANCH_KEY, JSON.stringify(branch));
    else localStorage.removeItem(BRANCH_KEY);
  } catch { /* private mode or full storage: the in-memory basket still works */ }
}

/** Saved items win on quantity; items only on this device are added. */
function mergeItems(saved: ShoppingBasketItem[], local: ShoppingBasketItem[]): ShoppingBasketItem[] {
  const merged = [...saved];
  for (const item of local) if (!merged.some(row => row.productId === item.productId)) merged.push(item);
  return merged;
}

export function ShoppingBasketProvider({ children }: { children: ReactNode }) {
  const [items, setItemsState] = useState<ShoppingBasketItem[]>(loadItems);
  const [selectedBranch, setSelectedBranchState] = useState<SelectedMarketBranch | null>(loadBranch);
  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [syncStatus, setSyncStatus] = useState<BasketSyncStatus>("local");
  const latest = useRef({ items, selectedBranch });
  latest.current = { items, selectedBranch };
  const hydratedFor = useRef<string | null>(null);
  const previousUser = useRef<string | null>(null);

  const commit = (nextItems: ShoppingBasketItem[], nextBranch: SelectedMarketBranch | null) => {
    latest.current = { items: nextItems, selectedBranch: nextBranch };
    setItemsState(nextItems);
    setSelectedBranchState(nextBranch);
    writeLocal(nextItems, nextBranch);
  };
  const replaceItems = (next: ShoppingBasketItem[]) => commit(next, latest.current.selectedBranch);
  const setSelectedBranch = (branch: SelectedMarketBranch | null) => commit(latest.current.items, branch);
  const addItem: ShoppingBasketContextValue["addItem"] = (item, quantity = 1) => {
    const current = latest.current.items;
    const existing = current.find(row => row.productId === item.productId);
    replaceItems(existing
      ? current.map(row => row.productId === item.productId ? { ...row, quantity: Math.min(99, row.quantity + quantity) } : row)
      : [...current, { ...item, quantity }]);
  };
  const updateQuantity = (productId: string, quantity: number) => {
    const current = latest.current.items;
    replaceItems(quantity > 0
      ? current.map(row => row.productId === productId ? { ...row, quantity: Math.min(99, Math.floor(quantity)) } : row)
      : current.filter(row => row.productId !== productId));
  };
  const removeItem = (productId: string) => replaceItems(latest.current.items.filter(row => row.productId !== productId));
  const clearItems = () => commit([], null);

  // Watch the sign-in state.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
      setIsGuest(Boolean(data.session?.user.is_anonymous));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setIsGuest(Boolean(session?.user.is_anonymous));
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // On sign-in, load the saved basket and merge it with this device's basket.
  // On sign-out, clear the device basket so the next person does not inherit it.
  useEffect(() => {
    const wasSignedIn = previousUser.current;
    previousUser.current = userId;
    if (!supabase || !userId) {
      hydratedFor.current = null;
      setSyncStatus("local");
      if (wasSignedIn) commit([], null);
      return;
    }
    let cancelled = false;
    setSyncStatus("saving");
    void (async () => {
      const { data, error } = await supabase!.rpc("get_current_basket");
      if (cancelled) return;
      if (error) { console.warn("Could not load the saved basket", error.message); setSyncStatus("error"); return; }
      const saved = data && typeof data === "object" ? data as { items?: unknown; branch?: unknown } : {};
      const mergedItems = mergeItems(cleanItems(saved.items), latest.current.items);
      const mergedBranch = latest.current.selectedBranch ?? cleanBranch(saved.branch);
      hydratedFor.current = userId;
      commit(mergedItems, mergedBranch);
      setSyncStatus("saved");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // After every change, save the basket to the account (debounced).
  useEffect(() => {
    if (!supabase || !userId || hydratedFor.current !== userId) return;
    setSyncStatus("saving");
    const timer = window.setTimeout(() => {
      void supabase!.rpc("save_current_basket", {
        p_items: items.map(item => ({ productId: item.productId, quantity: item.quantity })),
        p_branch: selectedBranch,
      }).then(({ error }) => {
        if (error) { console.warn("Could not save the basket", error.message); setSyncStatus("error"); }
        else setSyncStatus("saved");
      });
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [items, selectedBranch, userId]);

  return <ShoppingBasketContext.Provider value={{ items, selectedBranch, syncStatus, persistsAcrossDevices: Boolean(userId) && !isGuest, addItem, updateQuantity, removeItem, replaceItems, clearItems, setSelectedBranch }}>
    {children}
  </ShoppingBasketContext.Provider>;
}

export function useShoppingBasket() {
  const context = useContext(ShoppingBasketContext);
  if (!context) throw new Error("useShoppingBasket must be used within ShoppingBasketProvider");
  return context;
}
