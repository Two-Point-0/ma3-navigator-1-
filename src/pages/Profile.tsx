import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, CreditCard, Clock, Shield, Star, ChevronRight,
  Check, X, Bus, MapPin, Lock, Flame, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import { WALLET_PLAN_OPTIONS, WalletPlan } from "@/data/ma3_core";

const BADGES = [
  { icon: "🚌", label: "Ma3 Rider",    desc: "Completed first ride",        earned: true  },
  { icon: "⭐", label: "Rater",         desc: "Rated 5+ nganyas",            earned: true  },
  { icon: "🔒", label: "Lock-In Pro",  desc: "Locked in at 10 stops",       earned: false },
  { icon: "🎮", label: "Mirth Maven",  desc: "Played 5+ Mirth games",       earned: true  },
  { icon: "📍", label: "Explorer",     desc: "Added a business pin",        earned: false },
  { icon: "🏆", label: "OG Rider",     desc: "Member since Day 1",          earned: true  },
];

const TX = [
  { label: "Route 23W – CBD to Rongai", amount: -80,   time: "Today, 8:14 AM" },
  { label: "Weekly top-up",             amount: +1000,  time: "Mon, 7:00 AM"   },
  { label: "Route 11A – Highridge",     amount: -50,    time: "Sun, 5:45 PM"  },
  { label: "Route 58 – Westlands",      amount: -50,    time: "Sat, 9:30 AM"  },
  { label: "Monthly top-up",            amount: +5000,  time: "Jun 1"          },
];

// Matatu-shaped SVG wallet
function MatatuWallet({ balance }: { balance: number }) {
  return (
    <div style={{ position: "relative", width: "100%", padding: "1px" }}>
      <svg viewBox="0 0 340 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", filter: "drop-shadow(0 8px 24px rgba(0,0,0,.5))" }}>
        {/* Matatu body */}
        <rect x="4" y="18" width="332" height="118" rx="14" fill="#0e0e18" stroke="rgba(217,119,6,.35)" strokeWidth="1.5"/>
        {/* Top stripe */}
        <rect x="4" y="18" width="332" height="22" rx="14" fill="rgba(217,119,6,.12)"/>
        <rect x="4" y="32" width="332" height="8" fill="rgba(217,119,6,.12)"/>
        {/* Front windshield bump */}
        <rect x="290" y="4" width="46" height="32" rx="8" fill="#0e0e18" stroke="rgba(217,119,6,.35)" strokeWidth="1.5"/>
        <rect x="294" y="8" width="38" height="22" rx="6" fill="rgba(100,180,255,.08)" stroke="rgba(100,180,255,.2)" strokeWidth="1"/>
        {/* Windows */}
        {[20, 70, 120, 170, 220].map(x => (
          <rect key={x} x={x} y={47} width={38} height={24} rx={5} fill="rgba(68,138,255,.08)" stroke="rgba(68,138,255,.18)" strokeWidth="1"/>
        ))}
        {/* Wheels */}
        <circle cx="60" cy="140" r="16" fill="#1c1c2a" stroke="rgba(217,119,6,.4)" strokeWidth="2"/>
        <circle cx="60" cy="140" r="8" fill="#0e0e18" stroke="rgba(217,119,6,.3)" strokeWidth="1.5"/>
        <circle cx="280" cy="140" r="16" fill="#1c1c2a" stroke="rgba(217,119,6,.4)" strokeWidth="2"/>
        <circle cx="280" cy="140" r="8" fill="#0e0e18" stroke="rgba(217,119,6,.3)" strokeWidth="1.5"/>
        {/* Balance display area */}
        <rect x="20" y="75" width="240" height="50" rx="10" fill="rgba(0,0,0,.4)"/>
        {/* Decorative route line */}
        <line x1="20" y1="58" x2="265" y2="58" stroke="rgba(217,119,6,.15)" strokeWidth="1" strokeDasharray="4 3"/>
      </svg>
      {/* Balance text overlay */}
      <div style={{ position: "absolute", top: "50%", left: 28, transform: "translateY(-25%)" }}>
        <p style={{ fontSize: ".55rem", color: "rgba(217,119,6,.7)", letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 2 }}>Wallet Balance</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.7rem", fontWeight: 700, color: "var(--ready)", lineHeight: 1 }}>
          KES {balance.toLocaleString()}
        </p>
        <p style={{ fontSize: ".58rem", color: "var(--muted2)", marginTop: 4 }}>Ma3 Transit Wallet</p>
      </div>
      {/* Bus icon */}
      <div style={{ position: "absolute", top: "28%", right: 68, transform: "translateY(-50%)" }}>
        <Bus size={22} style={{ color: "rgba(217,119,6,.5)" }} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { wallet, topUp, setPlan, cancelPlan } = useWallet();
  const [showTopUp, setShowTopUp] = useState(false);
  const [selPlan, setSelPlan] = useState<WalletPlan>("weekly");
  const [selAmt, setSelAmt] = useState<number | null>(null);

  const renewsIn = wallet.planRenewsAt
    ? Math.max(0, Math.round((wallet.planRenewsAt - Date.now()) / (1000 * 60 * 60)))
    : null;

  const doTopUp = () => {
    if (!selAmt) { toast("Pick an amount first"); return; }
    if (wallet.plan) {
      setPlan(selPlan, selAmt);
      toast(`✅ ${WALLET_PLAN_OPTIONS[selPlan].label} activated — KES ${selAmt.toLocaleString()} added`);
    } else {
      topUp(selAmt);
      toast(`✅ KES ${selAmt.toLocaleString()} added to wallet`);
    }
    setShowTopUp(false);
    setSelAmt(null);
  };

  return (
    <div className="page-wrap">
      <div className="inner">
        {/* Avatar header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: ".8rem 0 1rem" }}>
          <div style={{ width: 62, height: 62, borderRadius: 20, background: "linear-gradient(135deg, var(--ready), var(--stop))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.7rem" }}>🧑‍🦱</div>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 900 }}>Ma3 Rider</p>
            <p style={{ fontSize: ".62rem", color: "var(--muted)", marginTop: 2 }}>Nairobi · OG Member</p>
            <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
              {BADGES.filter(b => b.earned).map(b => (
                <span key={b.label} title={b.label} style={{ fontSize: ".95rem" }}>{b.icon}</span>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
          </div>
        </div>

        {/* Matatu-shaped wallet */}
        <div style={{ marginBottom: 12 }}>
          <MatatuWallet balance={wallet.balance} />
        </div>

        {/* Plan indicator */}
        {wallet.plan && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.2)", marginBottom: 10 }}>
            <Clock size={13} style={{ color: "var(--go)" }} />
            <span style={{ fontSize: ".68rem", color: "var(--go)", fontWeight: 600 }}>
              {WALLET_PLAN_OPTIONS[wallet.plan].label} · KES {wallet.planAmount}/{WALLET_PLAN_OPTIONS[wallet.plan].periodLabel}
              {renewsIn !== null && ` · renews in ${renewsIn}h`}
            </span>
            <button onClick={() => { cancelPlan(); toast("Plan cancelled"); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: ".65rem" }}>Cancel</button>
          </div>
        )}

        {/* Top Up button */}
        <button className="btn btn-primary" style={{ width: "100%", padding: 12, justifyContent: "center", marginBottom: 14 }} onClick={() => setShowTopUp(s => !s)}>
          <CreditCard size={15} /> Top Up Wallet
        </button>

        {/* Top-up form */}
        <AnimatePresence>
          {showTopUp && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginBottom: 14 }}>
              <div className="card" style={{ padding: 16, borderColor: "rgba(217,119,6,.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: ".88rem", fontWeight: 700 }}>Top Up</p>
                  <button onClick={() => setShowTopUp(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={16} /></button>
                </div>
                {/* Plan selector */}
                <label style={{ marginBottom: 6 }}>Plan Type</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {(["daily", "weekly", "monthly"] as WalletPlan[]).map(p => (
                    <button key={p} onClick={() => { setSelPlan(p); setSelAmt(null); }}
                      style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${selPlan === p ? "rgba(217,119,6,.45)" : "var(--border2)"}`, background: selPlan === p ? "rgba(217,119,6,.1)" : "var(--glass)", color: selPlan === p ? "var(--ready)" : "var(--muted2)", fontSize: ".68rem", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                      {p}
                    </button>
                  ))}
                </div>
                {/* Amount selector */}
                <label style={{ marginBottom: 6 }}>Amount (KES)</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {WALLET_PLAN_OPTIONS[selPlan].suggested.map(amt => (
                    <button key={amt} onClick={() => setSelAmt(amt)}
                      style={{ padding: "8px 14px", borderRadius: 99, border: `1px solid ${selAmt === amt ? "rgba(217,119,6,.5)" : "var(--border2)"}`, background: selAmt === amt ? "rgba(217,119,6,.12)" : "var(--glass)", color: selAmt === amt ? "var(--ready)" : "var(--white)", fontFamily: "var(--font-mono)", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <button className="btn btn-go" style={{ width: "100%", padding: 11, justifyContent: "center" }} onClick={doTopUp}>
                  <Check size={14} /> Confirm — KES {selAmt?.toLocaleString() ?? "—"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Badges */}
        <div className="sec-label" style={{ marginBottom: 8 }}>Badges</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
          {BADGES.map(b => (
            <div key={b.label} className="card" style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: b.earned ? 1 : 0.45 }}>
              <span style={{ fontSize: "1.3rem" }}>{b.icon}</span>
              <div>
                <p style={{ fontSize: ".72rem", fontWeight: 700 }}>{b.label}</p>
                <p style={{ fontSize: ".58rem", color: "var(--muted)" }}>{b.desc}</p>
              </div>
              {b.earned && <Check size={12} style={{ color: "var(--go)", marginLeft: "auto", flexShrink: 0 }} />}
            </div>
          ))}
        </div>

        {/* Transactions */}
        <div className="sec-label" style={{ marginBottom: 8 }}>Transaction History</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
          {TX.map((tx, i) => (
            <div key={i} className="card" style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: ".74rem", fontWeight: 600 }}>{tx.label}</p>
                <p style={{ fontSize: ".6rem", color: "var(--muted)", marginTop: 2 }}>{tx.time}</p>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", fontWeight: 700, color: tx.amount > 0 ? "var(--go)" : "var(--stop)" }}>
                {tx.amount > 0 ? "+" : ""}KES {Math.abs(tx.amount)}
              </span>
            </div>
          ))}
        </div>

        {/* Settings */}
        <div className="sec-label" style={{ marginBottom: 8 }}>Account</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 24 }}>
          {[
            { Icon: Shield,   label: "Privacy & Safety" },
            { Icon: Star,     label: "Ratings & Reviews" },
            { Icon: Calendar, label: "Journey History" },
          ].map(({ Icon, label }) => (
            <div key={label} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onClick={() => toast(`${label} — coming soon`)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={15} style={{ color: "var(--muted2)" }} />
                <span style={{ fontSize: ".8rem" }}>{label}</span>
              </div>
              <ChevronRight size={14} style={{ color: "var(--muted)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
