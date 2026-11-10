import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { WalletPlan, WalletState, WALLET_PLAN_OPTIONS } from "@/data/ma3_core";
import { APP_MODE } from "@/lib/appMode";
import { supabase } from "@/lib/supabase";

export interface WalletTx {
  id: string;
  kind: "topup" | "payment" | "earning" | "plan";
  amount: number; // positive = money in, negative = money out
  label: string;
  at: number;
}

interface WalletContextType {
  wallet: WalletState;
  history: WalletTx[];
  topUp: (amount: number, label?: string) => void;
  setPlan: (plan: WalletPlan, amount: number) => void;
  cancelPlan: () => void;
  pay: (amount: number, label?: string) => boolean;
  earn: (amount: number, label?: string) => void;
  refresh: () => Promise<void>;
  zap: number;
  addZap: (n: number) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    balance: APP_MODE.realPayments ? 0 : 2325,
    plan: APP_MODE.realPayments ? null : "weekly",
    planAmount: APP_MODE.realPayments ? 0 : 1000,
    planRenewsAt: APP_MODE.realPayments ? null : Date.now() + WALLET_PLAN_OPTIONS.weekly.periodMs,
  });
  const [zap, setZap] = useState(APP_MODE.realPayments ? 0 : 2325);
  const [history, setHistory] = useState<WalletTx[]>([
    ...(APP_MODE.realPayments ? [] : [{ id: "seed", kind: "topup" as const, amount: 2325, label: "Demo starting balance", at: Date.now() - 3600_000 }]),
  ]);
  const refresh = useCallback(async () => {
    if (!APP_MODE.realPayments || !supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setWallet({ balance: 0, plan: null, planAmount: 0, planRenewsAt: null }); setHistory([]); return; }
    const [{ data: account, error: accountError }, { data: transactions, error: transactionsError }] = await Promise.all([
      supabase.from("wallet_accounts").select("balance_kes").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("id,kind,amount_kes,label,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (accountError) throw accountError;
    if (transactionsError) throw transactionsError;
    setWallet(current => ({ ...current, balance: Number(account?.balance_kes ?? 0) }));
    setZap(Number(account?.balance_kes ?? 0));
    setHistory((transactions ?? []).map((row: any) => ({ id: row.id, kind: row.kind, amount: Number(row.amount_kes), label: row.label, at: new Date(row.created_at).getTime() })));
  }, []);

  useEffect(() => {
    if (!APP_MODE.realPayments || !supabase) return;
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const connect = async () => {
      const { data: { user } } = await supabase!.auth.getUser();
      userId = user?.id ?? null;
      await refresh();
      if (!userId) return;
      channel = supabase!.channel(`wallet-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "wallet_accounts", filter: `user_id=eq.${userId}` }, () => { void refresh(); })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${userId}` }, () => { void refresh(); })
        .subscribe();
    };
    void connect().catch(error => console.warn("Could not load server wallet", error));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { if (channel) void supabase!.removeChannel(channel); channel = null; void connect().catch(error => console.warn("Could not refresh server wallet", error)); });
    return () => { subscription.unsubscribe(); if (channel) void supabase!.removeChannel(channel); };
  }, [refresh]);
  const log = (kind: WalletTx["kind"], amount: number, label: string) =>
    setHistory(h => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, amount, label, at: Date.now() }, ...h].slice(0, 50));

  const topUp = (amount: number, label = "Wallet top-up") => {
    if (APP_MODE.realPayments) return;
    setWallet(w => ({ ...w, balance: w.balance + amount }));
    log("topup", amount, label);
  };

  const setPlan = (plan: WalletPlan, amount: number) => {
    if (APP_MODE.realPayments) return;
    setWallet(w => ({
      ...w,
      plan,
      planAmount: amount,
      planRenewsAt: Date.now() + WALLET_PLAN_OPTIONS[plan].periodMs,
      balance: w.balance + amount,
    }));
    log("plan", amount, `${WALLET_PLAN_OPTIONS[plan].label} (demo)`);
  };

  const cancelPlan = () => {
    setWallet(w => ({ ...w, plan: null, planRenewsAt: null }));
  };

  const pay = (amount: number, label = "Payment") => {
    if (APP_MODE.realPayments) return false;
    if (wallet.balance < amount) return false;
    setWallet(w => ({ ...w, balance: w.balance - amount }));
    log("payment", -amount, label);
    return true;
  };

  // Driver/courier earnings (carpool cost-share contributions, delivery fees) credited to wallet
  const earn = (amount: number, label = "Earnings") => {
    if (APP_MODE.realPayments) return;
    setWallet(w => ({ ...w, balance: w.balance + amount }));
    log("earning", amount, label);
  };

  const addZap = (n: number) => setZap(z => z + n);

  return (
    <WalletContext.Provider value={{ wallet, history, topUp, setPlan, cancelPlan, pay, earn, refresh, zap, addZap }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
