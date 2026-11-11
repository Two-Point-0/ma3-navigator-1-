import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Gauge, History, Loader2, Smartphone, X } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { normaliseKenyanPhone, requestStkPush } from "@/lib/mpesa";
import { APP_MODE } from "@/lib/appMode";
import { useSheet } from "@/lib/useSheet";
import { supabase } from "@/lib/supabase";

type View = "balance" | "history" | "gauge";
const AVG_FARE = 60; // KES, rough Nairobi matatu fare used only for the gauge hint
const AMOUNTS = [100, 200, 500, 1000];

function ago(at: number) {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
const kes = (n: number) => `KES ${Math.abs(n).toLocaleString()}`;

/** Wallet drawn as the front of a matatu. Windscreen = balance & transactions,
 *  side mirrors = buttons (rear-view history / fuel gauge), number plate = load wallet. */
export default function WalletPage() {
  const [, setLocation] = useLocation();
  const { wallet, history } = useWallet();
  const [view, setView] = useState<View>("balance");
  const [loadOpen, setLoadOpen] = useState(false);

  const level: "stop" | "ready" | "go" = wallet.balance < 100 ? "stop" : wallet.balance < 500 ? "ready" : "go";
  const levelText = { stop: "Low · top up", ready: "Getting low", go: "Good to go" }[level];
  const last = history[0];
  const rides = Math.floor(wallet.balance / AVG_FARE);
  const gaugePct = Math.min(100, Math.round((wallet.balance / 1000) * 100));

  const back = () => (window.history.length > 1 ? window.history.back() : setLocation("/"));
  const toggle = (next: View) => setView(v => (v === next ? "balance" : next));

  return (
    <div className="mw-screen">
      <div className="mw-stage">
        {/* ── the matatu front, drawn in SVG ── */}
        <svg className="mw-svg" viewBox="0 0 390 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="mw-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbfbf8" /><stop offset="1" stopColor="#c9c9c4" /></linearGradient>
            <linearGradient id="mw-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a1317" /><stop offset="1" stopColor="#101b21" /></linearGradient>
            <linearGradient id="mw-mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a3a44" /><stop offset="1" stopColor="#0b1116" /></linearGradient>
            <pattern id="mw-grille" width="14" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 L7 0 L14 6 L7 12 Z" fill="none" stroke="#2b2f36" strokeWidth="1.2" /></pattern>
          </defs>
          <rect width="390" height="760" fill="#0b0b14" />
          <rect y="690" width="390" height="70" fill="#15151f" />
          {/* roof LED bar: multicolour chase */}
          <rect x="62" y="18" width="266" height="26" rx="6" fill="#0b0b10" stroke="#2a2a36" />
          {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} className={`mw-led mw-led-${i % 3}`} style={{ animationDelay: `${i * 0.25}s` }} cx={86 + i * 43.5} cy="31" r="8" />)}
          {/* roof vents */}
          {Array.from({ length: 13 }).map((_, i) => <rect key={i} x={36 + i * 24.5} y="52" width="19" height="17" rx="5" fill="#0d0d12" stroke="#303038" />)}
          {/* body */}
          <path d="M26 74 Q26 66 36 66 H354 Q364 66 364 74 V672 Q364 690 346 690 H44 Q26 690 26 672 Z" fill="url(#mw-body)" />
          {/* windscreen */}
          <rect x="40" y="86" width="310" height="262" rx="14" fill="url(#mw-glass)" stroke="#05080a" strokeWidth="3" />
          <path d="M40 330 L350 330 L350 348 L40 348 Z" fill="#06090b" opacity=".6" />
          {/* dash band + bonnet notch */}
          <rect x="40" y="352" width="310" height="58" rx="10" fill="#eceae6" />
          <path d="M165 414 L225 414 L208 434 L182 434 Z" fill="#101014" />
          {/* headlights */}
          <path d="M44 452 L150 478 L142 516 L44 500 Z" fill="#101014" />
          <path d="M346 452 L240 478 L248 516 L346 500 Z" fill="#101014" />
          <path d="M54 466 L132 486" stroke="#fff" strokeWidth="5" strokeLinecap="round" className="mw-beam" />
          <path d="M336 466 L258 486" stroke="#fff" strokeWidth="5" strokeLinecap="round" className="mw-beam" />
          {/* grille */}
          <path d="M120 470 H270 L290 600 L278 668 H112 L100 600 Z" fill="#0c0d11" />
          <path d="M120 470 H270 L290 600 L278 668 H112 L100 600 Z" fill="url(#mw-grille)" />
          <circle cx="195" cy="520" r="22" fill="#0c0d11" stroke="var(--ready)" strokeWidth="3" />
          <text x="195" y="530" textAnchor="middle" fontSize="28" fontWeight="900" fill="var(--ready)" fontFamily="Unbounded, Syne, sans-serif">3</text>
          {/* bumper with traffic-light lamps */}
          <rect x="60" y="672" width="270" height="16" rx="8" fill="#101014" />
          {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} className={`mw-led mw-led-${(i + 1) % 3}`} style={{ animationDelay: `${i * 0.25}s` }} cx={92 + i * 41.2} cy="680" r="5" />)}
          {/* wheels peeking */}
          <rect x="6" y="640" width="26" height="62" rx="8" fill="#0b0b0f" /><rect x="358" y="640" width="26" height="62" rx="8" fill="#0b0b0f" />
          {/* mirror arms */}
          <rect x="26" y="150" width="14" height="10" fill="#0b0b0f" /><rect x="350" y="150" width="14" height="10" fill="#0b0b0f" />
        </svg>

        {/* ── windscreen display ── */}
        <div className="mw-windscreen">
          <div className="mw-ws-top">
            <span>{view === "history" ? "Rear view · transactions" : view === "gauge" ? "Fuel gauge" : "Available balance"}</span>
            <span className={`mw-state mw-state-${level}`}><i />{levelText}</span>
          </div>

          {view === "balance" && (
            <>
              <p className="mw-balance">KES {wallet.balance.toLocaleString()}</p>
              <p className="mw-sub">{APP_MODE.realPayments ? "Wallet balance" : "Demo wallet · no real money"}</p>
              {last && (
                <p className="mw-last">
                  {last.amount >= 0 ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                  <span>{last.label}</span>
                  <b className={last.amount >= 0 ? "in" : "out"}>{last.amount >= 0 ? "+" : "−"}{kes(last.amount)}</b>
                  <small>{ago(last.at)}</small>
                </p>
              )}
              {wallet.plan && <p className="mw-sub" style={{ marginTop: 6 }}>Plan: KES {wallet.planAmount} / {wallet.plan}</p>}
            </>
          )}

          {view === "history" && (
            <div className="mw-list">
              {history.slice(0, 12).map(tx => (
                <div key={tx.id} className="mw-row">
                  {tx.amount >= 0 ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                  <span>{tx.label}<small>{ago(tx.at)}</small></span>
                  <b className={tx.amount >= 0 ? "in" : "out"}>{tx.amount >= 0 ? "+" : "−"}{kes(tx.amount)}</b>
                </div>
              ))}
            </div>
          )}

          {view === "gauge" && (
            <>
              <p className="mw-balance" style={{ fontSize: "clamp(1.4rem,7vw,2rem)" }}>≈ {rides} rides left</p>
              <div className="mw-gauge" role="img" aria-label={`Balance level ${gaugePct} percent`}>
                <span className="g-r" /><span className="g-a" /><span className="g-g" />
                <i style={{ left: `${Math.max(2, Math.min(98, gaugePct))}%` }} />
              </div>
              <p className="mw-sub">Estimate at KES {AVG_FARE} per ride. Red under 100, amber under 500, green above.</p>
            </>
          )}
        </div>

        {/* ── side mirrors = buttons ── */}
        <button className={`mw-mirror mw-mirror-l${view === "history" ? " on" : ""}`} onClick={() => toggle("history")} aria-label="Rear view: show recent transactions" aria-pressed={view === "history"}>
          <History size={14} /><span>Past</span>
        </button>
        <button className={`mw-mirror mw-mirror-r${view === "gauge" ? " on" : ""}`} onClick={() => toggle("gauge")} aria-label="Fuel gauge: show how many rides your balance covers" aria-pressed={view === "gauge"}>
          <Gauge size={14} /><span>Gauge</span>
        </button>

        {/* ── number plate = load wallet ── */}
        <button className="mw-plate" onClick={() => setLoadOpen(true)} aria-label="Load wallet">
          <small>KE · MA3</small><b>LOAD WALLET</b>
        </button>
        <p className="mw-hint">Mirrors: past &amp; gauge · Plate: add money</p>

        <button className="mw-back" onClick={back} aria-label="Back"><ChevronLeft size={18} /></button>
      </div>

      {loadOpen && <LoadSheet onClose={() => setLoadOpen(false)} />}
    </div>
  );
}

function LoadSheet({ onClose }: { onClose: () => void }) {
  const { topUp, refresh } = useWallet();
  const sheet = useSheet("half", { aboveNav: false });
  const [amount, setAmount] = useState(500);
  const [custom, setCustom] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<"form" | "waiting" | "pending" | "done">("form");
  const [message, setMessage] = useState("");
  const [pendingTopupId, setPendingTopupId] = useState<string | null>(null);

  const watchTopup = async (id: string) => {
    if (!supabase) { setStage("pending"); setMessage("This request is still pending. Check again later; do not send another prompt yet."); return; }
    setStage("waiting");
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const { data, error } = await supabase.from("wallet_topups").select("status,result_description").eq("id", id).maybeSingle();
      if (error || !data) continue;
      if (data.status === "succeeded") {
        await refresh(); setMessage("M-Pesa payment confirmed and wallet balance updated."); setStage("done"); toast.success("Wallet top-up confirmed."); return;
      }
      if (data.status === "failed" || data.status === "expired") {
        setMessage(data.result_description || "The M-Pesa transaction was not completed."); setStage("form"); toast.error("M-Pesa payment was not completed."); return;
      }
    }
    setMessage("Still awaiting Safaricom confirmation. Do not start another top-up; check this request again shortly."); setStage("pending");
  };

  const value = useMemo(() => (custom ? Number(custom) : amount), [custom, amount]);
  const msisdn = normaliseKenyanPhone(phone);
  const valid = msisdn !== null && Number.isFinite(value) && value >= 10 && value <= 150000;

  const send = async () => {
    if (!valid || !msisdn) return;
    setStage("waiting");
    const result = await requestStkPush(msisdn, value);
    setMessage(result.message);
    if (!result.ok) { setStage("form"); toast.error(result.message); return; }
    if (result.demo) { topUp(value, "M-Pesa top-up (demo)"); setStage("done"); toast(`Demo: KES ${value.toLocaleString()} added`); return; }
    if (!result.topupId) { setStage("form"); toast.error("Payment request has no tracking ID."); return; }
    setPendingTopupId(result.topupId);
    void watchTopup(result.topupId);
  };

  return (
    <div {...sheet.panelProps} style={{ ...sheet.panelProps.style, zIndex: 2000 }}>
      <div className="bpanel-head" style={{ padding: "2px 16px 8px" }}>
        <button {...sheet.gripProps} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Smartphone size={15} style={{ color: "var(--go)" }} />
          <b style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: ".88rem" }}>Load wallet</b>
          <span className="chip" style={{ color: "var(--ready)", border: "1px solid rgba(217,119,6,.35)", fontSize: ".55rem" }}>{APP_MODE.realPayments ? "M-PESA" : "DEMO"}</span>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={14} /></button>
        </div>
      </div>
      <div className="bpanel-scroll" style={{ padding: "0 16px 20px" }}>
        {stage === "form" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <p className="sec-label">Amount (KES)</p>
              <div className="tab-row">{AMOUNTS.map(a => <button key={a} className={`pill${!custom && amount === a ? " on" : ""}`} onClick={() => { setAmount(a); setCustom(""); }}>{a.toLocaleString()}</button>)}</div>
              <input className="finput" style={{ marginTop: 8 }} inputMode="numeric" placeholder="Other amount" value={custom} onChange={e => setCustom(e.target.value.replace(/[^0-9]/g, ""))} />
            </div>
            <label>M-Pesa number<input className="finput" inputMode="tel" placeholder="07XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} /></label>
            <button className="btn btn-go" disabled={!valid} style={{ width: "100%", opacity: valid ? 1 : .5 }} onClick={send}>Send M-Pesa prompt · KES {Number.isFinite(value) ? value.toLocaleString() : 0}</button>
            <p style={{ fontSize: ".58rem", color: "var(--muted2)", lineHeight: 1.5 }}>
              {APP_MODE.realPayments ? "You will get a prompt on your phone. Enter your M-Pesa PIN to confirm." : "Demo mode: this pretends to send the prompt and adds fake credits. No real money moves."}
            </p>
            <p style={{ fontSize: ".58rem", color: "var(--muted)" }}>Card and bank top-ups: coming later.</p>
          </div>
        )}
        {stage === "waiting" && (
          <div style={{ textAlign: "center", padding: "26px 0" }}>
            <Loader2 size={30} style={{ color: "var(--ready)", animation: "spin3 1s linear infinite" }} />
            <p style={{ marginTop: 12, fontWeight: 700, fontSize: ".78rem" }}>Check your phone</p>
            <p style={{ color: "var(--muted2)", fontSize: ".62rem" }}>Waiting for the M-Pesa prompt to be confirmed…</p>
          </div>
        )}
        {stage === "pending" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ color: "var(--ready)", fontWeight: 700, fontSize: ".8rem" }}>Payment request still pending</p>
            <p style={{ color: "var(--muted2)", fontSize: ".62rem", marginTop: 6, lineHeight: 1.5 }}>{message}</p>
            <button className="btn btn-ready" style={{ marginTop: 12 }} disabled={!pendingTopupId} onClick={() => pendingTopupId && void watchTopup(pendingTopupId)}>Check payment status</button>
          </div>
        )}
        {stage === "done" && (
          <div style={{ textAlign: "center", padding: "22px 0" }}>
            <p style={{ color: "var(--go)", fontWeight: 800, fontSize: ".9rem" }}>✓ {message}</p>
            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onClose}>Back to the matatu</button>
          </div>
        )}
      </div>
    </div>
  );
}
