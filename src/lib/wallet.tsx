import { createContext, useContext, useState, ReactNode } from "react";
import { WalletPlan, WalletState, WALLET_PLAN_OPTIONS } from "@/data/ma3_core";

interface WalletContextType {
  wallet: WalletState;
  topUp: (amount: number) => void;
  setPlan: (plan: WalletPlan, amount: number) => void;
  cancelPlan: () => void;
  pay: (amount: number) => boolean;
  earn: (amount: number) => void;
  zap: number;
  addZap: (n: number) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    balance: 2325,
    plan: "weekly",
    planAmount: 1000,
    planRenewsAt: Date.now() + WALLET_PLAN_OPTIONS.weekly.periodMs,
  });
  const [zap, setZap] = useState(2325);

  const topUp = (amount: number) => {
    setWallet(w => ({ ...w, balance: w.balance + amount }));
  };

  const setPlan = (plan: WalletPlan, amount: number) => {
    setWallet(w => ({
      ...w,
      plan,
      planAmount: amount,
      planRenewsAt: Date.now() + WALLET_PLAN_OPTIONS[plan].periodMs,
      balance: w.balance + amount,
    }));
  };

  const cancelPlan = () => {
    setWallet(w => ({ ...w, plan: null, planRenewsAt: null }));
  };

  const pay = (amount: number) => {
    if (wallet.balance < amount) return false;
    setWallet(w => ({ ...w, balance: w.balance - amount }));
    return true;
  };

  // Driver/courier earnings (carpool cost-share contributions, delivery fees) credited to wallet
  const earn = (amount: number) => {
    setWallet(w => ({ ...w, balance: w.balance + amount }));
  };

  const addZap = (n: number) => setZap(z => z + n);

  return (
    <WalletContext.Provider value={{ wallet, topUp, setPlan, cancelPlan, pay, earn, zap, addZap }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
