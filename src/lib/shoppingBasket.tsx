import { createContext, ReactNode, useContext, useState } from "react";

const BASKET_KEY = "ma3_market_basket_v1";
const BRANCH_KEY = "ma3_market_branch_v1";

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

interface ShoppingBasketContextValue {
  items: ShoppingBasketItem[];
  selectedBranch: SelectedMarketBranch | null;
  addItem: (item: Omit<ShoppingBasketItem, "quantity">, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  replaceItems: (items: ShoppingBasketItem[]) => void;
  clearItems: () => void;
  setSelectedBranch: (branch: SelectedMarketBranch | null) => void;
}

const ShoppingBasketContext = createContext<ShoppingBasketContextValue | null>(null);

function loadItems(): ShoppingBasketItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(BASKET_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ShoppingBasketItem =>
      !!item && typeof item.productId === "string" && typeof item.name === "string" &&
      Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
    ).map(item => ({ ...item, quantity: Math.floor(Number(item.quantity)) }));
  } catch { return []; }
}

function loadBranch(): SelectedMarketBranch | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(BRANCH_KEY) || "null");
    if (!value || typeof value !== "object") return null;
    const branch = value as SelectedMarketBranch;
    return typeof branch.key === "string" && typeof branch.store === "string" ? branch : null;
  } catch { return null; }
}

export function ShoppingBasketProvider({ children }: { children: ReactNode }) {
  const [items, setItemsState] = useState<ShoppingBasketItem[]>(loadItems);
  const [selectedBranch, setSelectedBranchState] = useState<SelectedMarketBranch | null>(loadBranch);

  const replaceItems = (next: ShoppingBasketItem[]) => {
    setItemsState(next);
    localStorage.setItem(BASKET_KEY, JSON.stringify(next));
  };
  const addItem: ShoppingBasketContextValue["addItem"] = (item, quantity = 1) => {
    const current = items.find(row => row.productId === item.productId);
    replaceItems(current
      ? items.map(row => row.productId === item.productId ? { ...row, quantity: row.quantity + quantity } : row)
      : [...items, { ...item, quantity }]);
  };
  const updateQuantity = (productId: string, quantity: number) => {
    replaceItems(quantity > 0
      ? items.map(row => row.productId === productId ? { ...row, quantity: Math.floor(quantity) } : row)
      : items.filter(row => row.productId !== productId));
  };
  const removeItem = (productId: string) => replaceItems(items.filter(row => row.productId !== productId));
  const clearItems = () => {
    replaceItems([]);
    setSelectedBranch(null);
  };
  const setSelectedBranch = (branch: SelectedMarketBranch | null) => {
    setSelectedBranchState(branch);
    if (branch) localStorage.setItem(BRANCH_KEY, JSON.stringify(branch));
    else localStorage.removeItem(BRANCH_KEY);
  };

  return <ShoppingBasketContext.Provider value={{ items, selectedBranch, addItem, updateQuantity, removeItem, replaceItems, clearItems, setSelectedBranch }}>
    {children}
  </ShoppingBasketContext.Provider>;
}

export function useShoppingBasket() {
  const context = useContext(ShoppingBasketContext);
  if (!context) throw new Error("useShoppingBasket must be used within ShoppingBasketProvider");
  return context;
}
