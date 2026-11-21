import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Delete, Gauge, History, Loader2 } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { normaliseKenyanPhone, requestStkPush } from "@/lib/mpesa";
import { APP_MODE } from "@/lib/appMode";
import { supabase } from "@/lib/supabase";

type View = "balance" | "history" | "gauge";
const AVG_FARE = 60; // KES, rough Nairobi matatu fare used only for the gauge hint
const AMOUNTS = [100, 200, 500, 1000];
const DEMO_FARE = 70;
const DEMO_ROUTE = "Rongai Express · R-111 (demo)";
const STAGES = ["Boarded · Railways", "Bunyala Rd", "Mombasa Rd", "Nyayo Stadium"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "back"];

function ago(at: number) {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
/** A pretend QR code for the demo till screen (not scannable). */
function FakeQr() {
  const cells: JSX.Element[] = [];
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    const on = finder ? (() => { const fx = x % 14 > 6 ? x - 14 : x, fy = y > 13 ? y - 14 : y; return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); })() : ((x * 7 + y * 13 + x * y) % 5 < 2);
    if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  }
  return <svg viewBox="0 0 21 21" width="86" height="86" style={{ background: "#e9f4f2", padding: 4, borderRadius: 6 }} aria-hidden="true" fill="#07070d">{cells}</svg>;
}
const kes = (n: number) => `KES ${Math.abs(n).toLocaleString()}`;

/** Wallet drawn as the front of a matatu, in line art.
 *  Windscreen = balance + what you are typing, side mirrors = history / gauge,
 *  grille = the dial pad, number plate = send the M-Pesa prompt. Nothing opens in a new screen. */
export default function WalletPage() {
  const [, setLocation] = useLocation();
  const { wallet, history, topUp, pay, refresh } = useWallet();
  const [view, setView] = useState<View>("balance");
  const [field, setField] = useState<"phone" | "amount">("phone");
  const [phone, setPhone] = useState("");
  const [amountText, setAmountText] = useState("500");
  const [stage, setStage] = useState<"form" | "waiting" | "pending" | "done">("form");
  const [message, setMessage] = useState("");
  const [pendingTopupId, setPendingTopupId] = useState<string | null>(null);

  const level: "stop" | "ready" | "go" = wallet.balance < 100 ? "stop" : wallet.balance < 500 ? "ready" : "go";
  const levelText = { stop: "Low · top up", ready: "Getting low", go: "Good to go" }[level];
  const rides = Math.floor(wallet.balance / AVG_FARE);
  const gaugePct = Math.min(100, Math.round((wallet.balance / 1000) * 100));
  const value = Number(amountText || 0);
  const msisdn = normaliseKenyanPhone(phone);
  const valid = msisdn !== null && Number.isFinite(value) && value >= 10 && value <= 150000;

  const back = () => (window.history.length > 1 ? window.history.back() : setLocation("/"));
  const toggle = (next: View) => setView(v => (v === next ? "balance" : next));

  const press = (key: string) => {
    try { navigator.vibrate?.(8); } catch { /* not supported */ }
    if (key === "back") { field === "phone" ? setPhone(v => v.slice(0, -1)) : setAmountText(v => v.slice(0, -1)); return; }
    if (field === "phone") setPhone(v => (v.length < 13 ? v + key : v));
    else setAmountText(v => (v.length < 6 ? (v === "0" ? key : v + key) : v));
  };

  const watchTopup = async (id: string) => {
    if (!supabase) { setStage("pending"); setMessage("This request is still pending. Check again later; do not send another prompt yet."); return; }
    setStage("waiting");
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const { data, error } = await supabase.from("wallet_topups").select("status,result_description").eq("id", id).maybeSingle();
      if (error || !data) continue;
      if (data.status === "succeeded") { await refresh(); setMessage("M-Pesa payment confirmed and wallet balance updated."); setStage("done"); toast.success("Wallet top-up confirmed."); return; }
      if (data.status === "failed" || data.status === "expired") { setMessage(data.result_description || "The M-Pesa transaction was not completed."); setStage("form"); toast.error("M-Pesa payment was not completed."); return; }
    }
    setMessage("Still awaiting Safaricom confirmation. Do not start another top-up; check this request again shortly."); setStage("pending");
  };

  const send = async () => {
    if (!valid || !msisdn) { setField(msisdn === null ? "phone" : "amount"); return; }
    setStage("waiting");
    const result = await requestStkPush(msisdn, value);
    setMessage(result.message);
    if (!result.ok) { setStage("form"); toast.error(result.message); return; }
    if (result.demo) { topUp(value, "M-Pesa top-up (demo)"); setStage("done"); toast(`Demo: KES ${value.toLocaleString()} added`); return; }
    if (!result.topupId) { setStage("form"); toast.error("Payment request has no tracking ID."); return; }
    setPendingTopupId(result.topupId);
    void watchTopup(result.topupId);
  };

  const finish = () => { setStage("form"); setPhone(""); };

  // ── demo features (pretend, no real money) ──
  const [autoPay, setAutoPay] = useState(() => { try { return localStorage.getItem("ma3_wallet_autopay") !== "0"; } catch { return true; } });
  const [demo, setDemo] = useState<null | "tap" | "stage" | "till">(null);
  const [demoStep, setDemoStep] = useState(0);
  const [demoMsg, setDemoMsg] = useState("");
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const later = (fn: () => void, ms: number) => setTimeout(() => { if (alive.current) fn(); }, ms);
  const toggleAuto = () => setAutoPay(v => { try { localStorage.setItem("ma3_wallet_autopay", v ? "0" : "1"); } catch { /* ignore */ } toast(v ? "Auto-pay off (demo)" : "Auto-pay on (demo)"); return !v; });
  const charge = (amount: number, label: string) => {
    if (!pay(amount, label)) { setDemoMsg("Not enough balance. Load some first."); setDemoStep(9); return false; }
    setFlash(true); later(() => setFlash(false), 1500);
    setDemoMsg(`✓ KES ${amount} paid`); setDemoStep(9); try { navigator.vibrate?.([20, 40, 20]); } catch { /* ignore */ }
    return true;
  };
  const openDemo = (kind: "tap" | "stage" | "till") => {
    if (APP_MODE.realPayments) { toast("Coming soon"); return; }
    setView("balance"); setDemo(kind); setDemoStep(0); setDemoMsg("");
    if (kind === "stage") {
      setBusy(true);
      [1, 2, 3].forEach(i => later(() => setDemoStep(i), i * 1100));
      later(() => { setBusy(false); charge(DEMO_FARE, "Auto-stage · " + DEMO_ROUTE); }, 4 * 1100);
    }
  };
  const doTap = () => {
    setDemoStep(1); setBusy(true);
    later(() => { setBusy(false); if (autoPay) charge(DEMO_FARE, "Tap pay · " + DEMO_ROUTE); else setDemoStep(2); }, 1000);
  };
  const tillAmount = Number.isFinite(value) && value >= 10 ? value : 100;
  const closeDemo = () => { setDemo(null); setDemoMsg(""); setBusy(false); };

  return (
    <div className="mw-screen">
      <div className="mw-stage">
        {/* ── the matatu front, line art only, in the three app colours ── */}
        <svg className={`mw-svg${flash ? " flash" : ""}${busy || stage === "waiting" ? " busy" : ""}`} viewBox="0 0 390 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <pattern id="mw-mesh" width="14" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 L7 0 L14 6 L7 12 Z" className="l-a" strokeWidth=".8" opacity=".35" /></pattern>
          </defs>
          <path d="M0 718 H130" className="l-r" /><path d="M130 718 H260" className="l-a" /><path d="M260 718 H390" className="l-g" />
          <text x="195" y="744" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#8b93a0" fontFamily="JetBrains Mono, monospace" letterSpacing="2.6">MA3 DIGITAL TAP FARE · NAIROBI KENYA</text>
          {/* roof light bar */}
          <rect x="56" y="14" width="236" height="28" rx="14" className="l-r" />
          {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} className={`l-${["r", "a", "g"][i % 3]} mw-led`} style={{ animationDelay: `${i * 0.2}s` }} cx={84 + i * 37.5} cy="28" r="7" />)}
          <path d="M70 52 H318" className="l-g" strokeDasharray="10 8" opacity=".6" />
          {/* body: tapered, curved shoulders */}
          <path d="M26 700 C16 560 18 240 44 100 Q52 66 86 64 H304 Q338 66 346 100 C372 240 374 560 364 700" className="l-g" strokeWidth="2" />
          <path d="M36 696 C28 560 30 250 54 108" className="l-g" opacity=".3" /><path d="M354 696 C362 560 360 250 336 108" className="l-g" opacity=".3" />
          {/* name banner */}
          <path d="M62 74 H328 L322 94 H68 Z" className="l-a" />
          <text x="195" y="88" textAnchor="middle" fontSize="11.5" fontWeight="800" className="l-a" strokeWidth=".8" fontFamily="Unbounded, Syne, sans-serif" letterSpacing="4">MA3 · NAIROBI · NGANYA</text>
          {/* windscreen */}
          <rect x="56" y="98" width="278" height="220" rx="16" className="l-g" strokeWidth="2" />
          
          {/* mirror arms */}
          <path d="M46 150 L56 144 M46 268 L56 274" className="l-a" strokeWidth="2" /><path d="M344 150 L334 144 M344 268 L334 274" className="l-a" strokeWidth="2" />
          {/* art band: waves with ticks */}
          <rect x="56" y="324" width="278" height="28" rx="10" className="l-g" />
          <path d="M62 342 Q120 326 195 338 T328 332" className="l-r" /><path d="M62 346 Q120 330 195 342 T328 336" className="l-a" /><path d="M62 350 Q120 334 195 346 T328 340" className="l-g" />
          {Array.from({ length: 8 }).map((_, i) => <path key={i} d={`M${78 + i * 8} 332 v${3 + (i % 3) * 2}`} className="l-r" opacity=".8" />)}{Array.from({ length: 5 }).map((_, i) => <path key={i} d={`M${262 + i * 8} 332 v${3 + (i % 3) * 2}`} className="l-g" opacity=".8" />)}
          {/* headlights */}
          <path d="M58 366 L138 362 L132 404 L58 408 Z" className="l-r" /><path d="M332 366 L252 362 L258 404 L332 408 Z" className="l-r" />
          {[[84, 386], [114, 384], [306, 386], [276, 384]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="12" className="l-a" /><circle cx={x} cy={y} r="7" className="l-g" /><circle cx={x} cy={y} r="2.6" className="l-r mw-led" style={{ animationDelay: `${i * 0.3}s` }} /></g>)}
          {/* grille outline sits behind the dial pad; the pad draws its own cells */}
          <path d="M92 428 H298 L312 640 H78 Z" className="l-a" opacity=".0" />
          <circle cx="195" cy="436" r="13" className="l-r" strokeWidth="2" fill="#07070d" />
          <text x="195" y="442" textAnchor="middle" fontSize="16" fontWeight="900" className="l-a" strokeWidth="1" fontFamily="Unbounded, Syne, sans-serif">3</text>
          {/* wheel-arch arcs and bumper */}
          <path d="M70 668 Q64 636 98 628" className="l-g" /><path d="M320 668 Q326 636 292 628" className="l-g" />
          <rect x="40" y="666" width="310" height="24" rx="12" className="l-a" strokeWidth="1.8" />
          <circle cx="62" cy="678" r="7" className="l-r" /><circle cx="62" cy="678" r="3" className="l-a" /><circle cx="328" cy="678" r="7" className="l-r" /><circle cx="328" cy="678" r="3" className="l-a" />
          {[0, 1, 2, 3, 4].map(i => <circle key={i} className={`l-${["r", "a", "g"][(i + 1) % 3]} mw-led`} style={{ animationDelay: `${i * 0.25}s` }} cx={124 + i * 35.5} cy="678" r="4.5" />)}
          {/* wheels */}
          <path d="M22 664 V710 H48 V664" className="l-r" /><path d="M368 664 V710 H342 V664" className="l-r" />
          <path d="M30 672 V700 M36 672 V700 M42 672 V700" className="l-a" opacity=".6" /><path d="M360 672 V700 M354 672 V700 M348 672 V700" className="l-a" opacity=".6" />
        </svg>

        {/* ── windscreen display ── */}
        <div className="mw-windscreen">
          <div className="mw-ws-top">
            <span>{view === "history" ? "Rear view · trips" : view === "gauge" ? "Fuel gauge · limits" : "Ma3 Nganya pass"}</span>
            {view === "balance"
              ? <button type="button" className={`mw-auto${autoPay ? " on" : ""}`} onClick={toggleAuto} aria-pressed={autoPay}><i />{autoPay ? "Auto-pay on" : "Auto-pay off"}</button>
              : <span className={`mw-state mw-state-${level}`}><i />{levelText}</span>}
          </div>

          {view === "balance" && !demo && stage === "form" && (
            <>
              <p className="mw-balance"><span>KES</span> {wallet.balance.toLocaleString()}</p>
              <p className="mw-sub">{history[0] ? `${history[0].amount < 0 ? "Deducted" : "Added"} KES ${Math.abs(history[0].amount)} · ${history[0].label} · ${ago(history[0].at)}` : APP_MODE.realPayments ? "Wallet balance" : "Demo wallet · no real money"}</p>
              <div className="mw-fields">
                <button type="button" className={`mw-field${field === "phone" ? " on" : ""}`} onClick={() => setField("phone")}><small>Top-up M-Pesa</small><b>{phone || "07XX XXX XXX"}</b></button>
                <button type="button" className={`mw-field${field === "amount" ? " on" : ""}`} onClick={() => setField("amount")}><small>Load (KES)</small><b>{Number(amountText || 0).toLocaleString()}</b></button>
              </div>
              <div className="mw-chips">{AMOUNTS.map(a => <button key={a} type="button" className={`mw-chip${String(a) === amountText ? " on" : ""}`} onClick={() => { setAmountText(String(a)); setField("amount"); }}>{a.toLocaleString()}</button>)}</div>
              <div className="mw-acts">{([["Tap pay", "tap"], ["Auto-stage", "stage"], ["Till / QR", "till"]] as const).map(([t, k], i) => <button key={t} type="button" className={`mw-act mw-act-${["r", "a", "g"][i]}`} onClick={() => openDemo(k)}>{t}</button>)}</div>
            </>
          )}

          {view === "balance" && demo === "tap" && (
            <div className="mw-ws-msg">
              {demoStep === 0 && <><div className="mw-rings"><i /><i /><i /><b>)))</b></div><b>Tap pay · {DEMO_ROUTE}</b><span>Fare KES {DEMO_FARE}. Hold your phone to the reader (demo).</span><button type="button" className="mw-chip on" style={{ flex: "none", padding: "8px 18px" }} onClick={doTap}>Tap phone on reader</button></>}
              {demoStep === 1 && <><Loader2 size={26} style={{ color: "var(--ready)", animation: "spin3 1s linear infinite" }} /><b>Reading…</b></>}
              {demoStep === 2 && <><b>Confirm KES {DEMO_FARE}?</b><span>Auto-pay is off, so you confirm each fare.</span><button type="button" className="mw-chip on" style={{ flex: "none", padding: "8px 18px" }} onClick={() => charge(DEMO_FARE, "Tap pay · " + DEMO_ROUTE)}>Confirm</button></>}
              {demoStep === 9 && <b style={{ color: demoMsg.startsWith("✓") ? "var(--go)" : "var(--stop)" }}>{demoMsg}</b>}
              <button type="button" className="mw-link" onClick={closeDemo}>← Back to wallet</button>
            </div>
          )}

          {view === "balance" && demo === "stage" && (
            <div className="mw-ws-msg">
              <b>Auto-stage · {DEMO_ROUTE}</b>
              <div className="mw-stages">{STAGES.map((n, i) => <span key={n} className={demoStep >= i ? "on" : ""}><i />{n}</span>)}</div>
              {demoStep === 9 ? <b style={{ color: demoMsg.startsWith("✓") ? "var(--go)" : "var(--stop)" }}>{demoMsg}</b> : <span>You are riding. The fare is taken when you get off (demo).</span>}
              <button type="button" className="mw-link" onClick={closeDemo}>← Back to wallet</button>
            </div>
          )}

          {view === "balance" && demo === "till" && (
            <div className="mw-ws-msg">
              <FakeQr />
              <b>Till 600123 · Demo shop</b>
              {demoStep === 9 ? <b style={{ color: demoMsg.startsWith("✓") ? "var(--go)" : "var(--stop)" }}>{demoMsg}</b> : <button type="button" className="mw-chip on" style={{ flex: "none", padding: "8px 18px" }} onClick={() => charge(tillAmount, "Till 600123 (demo)")}>Pay KES {tillAmount.toLocaleString()}</button>}
              <button type="button" className="mw-link" onClick={closeDemo}>← Back to wallet</button>
            </div>
          )}

          {view === "balance" && !demo && stage === "waiting" && (
            <div className="mw-ws-msg"><Loader2 size={26} style={{ color: "var(--ready)", animation: "spin3 1s linear infinite" }} /><b>Check your phone</b><span>Waiting for the M-Pesa prompt to be confirmed…</span></div>
          )}
          {view === "balance" && !demo && stage === "pending" && (
            <div className="mw-ws-msg"><b style={{ color: "var(--ready)" }}>Payment still pending</b><span>{message}</span>
              <button type="button" className="mw-chip" style={{ flex: "none", padding: "7px 14px" }} disabled={!pendingTopupId} onClick={() => pendingTopupId && void watchTopup(pendingTopupId)}>Check status</button></div>
          )}
          {view === "balance" && !demo && stage === "done" && (
            <div className="mw-ws-msg"><b style={{ color: "var(--go)" }}>✓ {message}</b><button type="button" className="mw-chip" style={{ flex: "none", padding: "7px 14px" }} onClick={finish}>Done</button></div>
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
              {wallet.plan && <p className="mw-sub" style={{ marginTop: 6 }}>Plan: KES {wallet.planAmount} / {wallet.plan}</p>}
            </>
          )}
        </div>

        {/* ── side mirrors = buttons ── */}
        <button className={`mw-mirror mw-mirror-l${view === "history" ? " on" : ""}`} onClick={() => toggle("history")} aria-label="Rear view: show recent transactions" aria-pressed={view === "history"}>
          <History size={15} /><span className="mw-vt">Past</span><small className="mw-vt">Trips</small>
        </button>
        <button className={`mw-mirror mw-mirror-r${view === "gauge" ? " on" : ""}`} onClick={() => toggle("gauge")} aria-label="Fuel gauge: show how many rides your balance covers" aria-pressed={view === "gauge"}>
          <Gauge size={15} /><span className="mw-vt">Gauge</span><small className="mw-vt">Limits</small>
        </button>

        {/* ── grille = dial pad, tilted back like a real radiator grille ── */}
        <div className="mw-pad" role="group" aria-label="Dial pad">
          {KEYS.map(k => <button key={k} type="button" className="mw-key" aria-label={k === "back" ? "Delete" : k} onClick={() => press(k)} disabled={stage !== "form" || demo !== null}><em>{k === "back" ? <Delete size={17} /> : k}</em></button>)}
        </div>

        {/* ── number plate = load the wallet ── */}
        <button className="mw-plate" onClick={send} disabled={stage !== "form" || demo !== null} aria-label="Load wallet by M-Pesa">
          <small>KDG · 111M · NAIROBI</small><b>{valid ? `LOAD · KES ${value.toLocaleString()}` : msisdn === null ? "ENTER NUMBER" : "ENTER AMOUNT"}</b>
        </button>

        <span className="mw-badge">{APP_MODE.realPayments ? "KE · LIVE" : "R-111"}</span>
        <button className="mw-back" onClick={back} aria-label="Back"><ChevronLeft size={18} /></button>
      </div>
    </div>
  );
}
