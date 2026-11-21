import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Delete, Download, Gauge, History, Landmark, Loader2, QrCode, Route as RouteIcon, Smartphone, Wallet as WalletIcon } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { normaliseKenyanPhone, requestStkPush } from "@/lib/mpesa";
import { APP_MODE } from "@/lib/appMode";
import { supabase } from "@/lib/supabase";

type Panel = "home" | "load" | "statement" | "gauge" | "tap" | "stage" | "till";
const AVG_FARE = 60; // KES, rough Nairobi matatu fare used only for the gauge hint
const AMOUNTS = [100, 200, 500, 1000];
const LIMITS = [200, 500, 1000, 0];
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
 *  The windscreen stays clear and shows only what you pick. A wiper sweeps the old view away before the new one appears.
 *  Dashboard buttons choose the action, mirrors = statement / gauge, grille = dial pad, plate = main action. */
export default function WalletPage() {
  const [, setLocation] = useLocation();
  const { wallet, history, topUp, pay, refresh } = useWallet();
  const [panel, setPanel] = useState<Panel>("home");
  const [shown, setShown] = useState<Panel>("home");
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [method, setMethod] = useState<"mpesa" | "bank">("mpesa");
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [field, setField] = useState<"phone" | "amount">("phone");
  const [phone, setPhone] = useState("");
  const [amountText, setAmountText] = useState("500");
  const [stage, setStage] = useState<"form" | "waiting" | "pending" | "done">("form");
  const [message, setMessage] = useState("");
  const [pendingTopupId, setPendingTopupId] = useState<string | null>(null);
  const [autoPay, setAutoPay] = useState(() => { try { return localStorage.getItem("ma3_wallet_autopay") !== "0"; } catch { return true; } });
  const [limit, setLimit] = useState(() => { try { return Number(localStorage.getItem("ma3_wallet_limit") ?? "0") || 0; } catch { return 0; } });
  const [demoStep, setDemoStep] = useState(0);
  const [demoMsg, setDemoMsg] = useState("");
  const [alertKind, setAlertKind] = useState<"" | "ok" | "fail">("");
  const [spin, setSpin] = useState(0);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  /** LED alert: roof, headlight and bumper lights light up green/amber on success, flash red on a refusal. */
  const ping = (kind: "ok" | "fail") => { setAlertKind(kind); try { navigator.vibrate?.(kind === "ok" ? [20, 40, 20] : [60, 40, 60]); } catch { /* ignore */ } setTimeout(() => { if (alive.current) setAlertKind(""); }, 2200); };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const later = (fn: () => void, ms: number) => setTimeout(() => { if (alive.current) fn(); }, ms);

  const level: "stop" | "ready" | "go" = wallet.balance < 100 ? "stop" : wallet.balance < 500 ? "ready" : "go";
  const rides = Math.floor(wallet.balance / AVG_FARE);
  const gaugePct = Math.min(100, Math.round((wallet.balance / 1000) * 100));
  const value = Number(amountText || 0);
  const msisdn = normaliseKenyanPhone(phone);
  const amountOk = Number.isFinite(value) && value >= 10 && value <= 150000;
  const valid = amountOk && (method === "bank" || msisdn !== null);
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const spentToday = history.filter(h => h.amount < 0 && h.at >= startOfDay).reduce((n, h) => n + Math.abs(h.amount), 0);

  const back = () => (window.history.length > 1 ? window.history.back() : setLocation("/"));

  /** Switch what the windscreen shows: wiper sweeps the old view away, then the new one is revealed. */
  const go = (next: Panel) => {
    setSpin(n => n + 1);
    if (next === panel) return;
    setPanel(next); setDemoStep(0); setDemoMsg(""); setBusy(false);
    if (next === "load" || next === "till") setField(next === "till" ? "amount" : "phone");
    const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (calm) { setShown(next); return; }
    setPhase("out");
    later(() => { setShown(next); setPhase("in"); }, 600);
    later(() => setPhase("idle"), 1080);
    if (next === "stage") startStage();
  };
  const startStage = () => {
    if (APP_MODE.realPayments) return;
    later(() => {
      setBusy(true);
      [1, 2, 3].forEach(i => later(() => setDemoStep(i), i * 1100));
      later(() => { setBusy(false); charge(DEMO_FARE, "Auto-stage · " + DEMO_ROUTE); }, 4 * 1100);
    }, 1100);
  };
  const needDemo = (next: Panel) => {
    if (APP_MODE.realPayments && (next === "tap" || next === "stage" || next === "till")) { toast("Coming soon"); return; }
    go(next);
  };

  const press = (key: string) => {
    try { navigator.vibrate?.(8); } catch { /* not supported */ }
    setSpin(n => n + 1);
    if (panel !== "load" && panel !== "till") { go("load"); setPhone(key === "back" ? "" : key); return; }
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

  const sendMpesa = async () => {
    if (!valid || !msisdn) { setField(msisdn === null ? "phone" : "amount"); return; }
    setStage("waiting");
    const result = await requestStkPush(msisdn, value);
    setMessage(result.message);
    if (!result.ok) { setStage("form"); ping("fail"); toast.error(result.message); return; }
    if (result.demo) { topUp(value, "M-Pesa top-up (demo)"); ping("ok"); setStage("done"); toast(`Demo: KES ${value.toLocaleString()} added`); return; }
    if (!result.topupId) { setStage("form"); toast.error("Payment request has no tracking ID."); return; }
    setPendingTopupId(result.topupId);
    void watchTopup(result.topupId);
  };
  const confirmBank = () => {
    if (!amountOk) { setField("amount"); return; }
    if (APP_MODE.realPayments) { toast("Bank loading is coming soon"); return; }
    topUp(value, "Bank transfer (demo)"); ping("ok");
    setMessage(`Demo: KES ${value.toLocaleString()} received from your bank.`); setStage("done");
  };
  const finish = () => { setStage("form"); setPhone(""); go("home"); };

  const toggleAuto = () => setAutoPay(v => { try { localStorage.setItem("ma3_wallet_autopay", v ? "0" : "1"); } catch { /* ignore */ } toast(v ? "Auto-pay off (demo)" : "Auto-pay on (demo)"); return !v; });
  const chooseLimit = (n: number) => { setLimit(n); try { localStorage.setItem("ma3_wallet_limit", String(n)); } catch { /* ignore */ } };
  const charge = (amount: number, label: string) => {
    if (limit > 0 && spentToday + amount > limit) { setDemoMsg(`Daily limit KES ${limit.toLocaleString()} reached.`); setDemoStep(9); ping("fail"); return false; }
    if (!pay(amount, label)) { setDemoMsg("Not enough balance. Load some first."); setDemoStep(9); ping("fail"); return false; }
    ping("ok");
    setDemoMsg(`✓ KES ${amount} paid`); setDemoStep(9); try { navigator.vibrate?.([20, 40, 20]); } catch { /* ignore */ }
    return true;
  };
  const doTap = () => {
    setDemoStep(1); setBusy(true);
    later(() => { setBusy(false); if (autoPay) charge(DEMO_FARE, "Tap pay · " + DEMO_ROUTE); else setDemoStep(2); }, 1000);
  };
  const tillAmount = amountOk ? value : 100;
  const exportCsv = () => {
    const rows = ["date,description,amount_kes", ...history.map(h => `${new Date(h.at).toISOString()},"${h.label.replace(/"/g, "'")}",${h.amount}`)];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "ma3-wallet-statement.csv"; link.click(); URL.revokeObjectURL(url);
    toast("Statement downloaded");
  };

  const rowsShown = history.filter(h => filter === "all" || (filter === "in" ? h.amount >= 0 : h.amount < 0)).slice(0, 30);
  const totalIn = history.filter(h => h.amount >= 0).reduce((n, h) => n + h.amount, 0);
  const totalOut = history.filter(h => h.amount < 0).reduce((n, h) => n + Math.abs(h.amount), 0);
  const okColor = (m: string) => (m.startsWith("✓") ? "var(--go)" : "var(--stop)");
  const padOn = stage === "form";

  const plate = (() => {
    if (panel === "load") return method === "bank"
      ? { top: "BANK · DEMO", text: amountOk ? `I'VE PAID · KES ${value.toLocaleString()}` : "ENTER AMOUNT", act: confirmBank, off: stage !== "form" }
      : { top: "KDG · 111M · NAIROBI", text: valid ? `SEND · KES ${value.toLocaleString()}` : msisdn === null ? "ENTER NUMBER" : "ENTER AMOUNT", act: sendMpesa, off: stage !== "form" };
    return { top: "KDG · 111M · NAIROBI", text: "LOAD WALLET", act: () => go("load"), off: false };
  })();

  return (
    <div className="mw-screen">
      <button className="mw-back" onClick={back} aria-label="Back"><ChevronLeft size={18} /></button>
      <span className="mw-badge">{APP_MODE.realPayments ? "LIVE" : "R-111"}</span>
      <div className="mw-stage">
        {/* ── the matatu front, line art only, in the three app colours ── */}
        <svg className={`mw-svg${alertKind ? " " + alertKind : ""}${busy || stage === "waiting" ? " busy" : ""}`} viewBox="0 0 390 800" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="amber-diamond-mesh" width="12" height="12" patternUnits="userSpaceOnUse"><path className="l-a" strokeWidth="0.65" d="M0 0 12 12M12 0 0 12" /></pattern>
            <clipPath id="grille-clip"><path d="M63 470H327L350 669H40Z" /></clipPath>
          </defs>
          <rect width="390" height="800" fill="#000" />
          <g strokeWidth="1.5">
          <path className="l-g" d="M75 48Q195 35 315 48Q338 55 342 91H48Q52 55 75 48Z" />
          <path className="l-a" d="M108 46H282M122 52H268" />
          <path className="l-g" d="M103 22H287" />
          <path className="l-a" d="M126 29H264" />
          <path className="l-g" d="M103 57H135M147 57H178M190 57H221M233 57H264M276 57H287" />
          <circle className="l-g mw-led" style={{ animationDelay: "0.72s" }} cx="118" cy="22" r="4" />
          <circle className="l-a mw-led" style={{ animationDelay: "0.48s" }} cx="144" cy="22" r="4" />
          <circle className="l-r mw-led" style={{ animationDelay: "0.24s" }} cx="170" cy="22" r="4" />
          <circle className="l-g mw-led" style={{ animationDelay: "0.00s" }} cx="196" cy="22" r="4" />
          <circle className="l-a mw-led" style={{ animationDelay: "0.60s" }} cx="222" cy="22" r="4" />
          <circle className="l-r mw-led" style={{ animationDelay: "0.36s" }} cx="248" cy="22" r="4" />
          <circle className="l-g mw-led" style={{ animationDelay: "0.12s" }} cx="274" cy="22" r="4" />
          
          
          
          
          
          <path className="l-a" d="M65 63H325L335 91H55Z" />
          <path className="l-r" d="M71 68H319L326 86H64Z" />
          
          
          <path className="l-g" d="M84 48Q48 52 47 115L45 695Q45 737 53 770H337Q345 737 345 695L343 115Q342 52 306 48" />
          <path className="l-g" d="M57 119V733M333 119V733" />
          <path className="l-a" d="M66 94H324M66 359V393M324 359V393" />
          
          <path className="l-g" d="M50 146 36 153M50 345 36 338M340 146 354 153M340 345 354 338" />
          <path className="l-a" d="M44 154 35 160M346 154 355 160" />
          <rect className="l-a" x="5" y="143" width="39" height="224" rx="18" />
          <rect className="l-g" x="10" y="149" width="29" height="212" rx="14" />
          <rect className="l-a" x="346" y="143" width="39" height="224" rx="18" />
          <rect className="l-g" x="351" y="149" width="29" height="212" rx="14" />
          <circle className="l-g" cx="24.5" cy="345" r="3" />
          <circle className="l-g" cx="365.5" cy="345" r="3" />
          
          <rect className="l-g" x="47" y="107" width="296" height="251" rx="17" />
          <path className="l-a" d="M58 120H332M58 346H332" />
          <path className="l-r" d="M120 109 94 206M274 109l24 67" opacity=".22" />
          
          
          <path className="l-g" d="M53 414H132M258 414H337" />
          <path className="l-a" d="M58 419H127M263 419H332" />
          <circle className="l-a" cx="75" cy="429" r="14" />
          <circle className="l-g" cx="75" cy="429" r="9" />
          <circle className="l-r mw-led" style={{ animationDelay: "0.00s" }} cx="75" cy="429" r="4" />
          <circle className="l-a" cx="118" cy="429" r="14" />
          <circle className="l-g" cx="118" cy="429" r="9" />
          <circle className="l-r mw-led" style={{ animationDelay: "0.45s" }} cx="118" cy="429" r="4" />
          <circle className="l-a" cx="272" cy="429" r="14" />
          <circle className="l-g" cx="272" cy="429" r="9" />
          <circle className="l-r mw-led" style={{ animationDelay: "0.30s" }} cx="272" cy="429" r="4" />
          <circle className="l-a" cx="315" cy="429" r="14" />
          <circle className="l-g" cx="315" cy="429" r="9" />
          <circle className="l-r mw-led" style={{ animationDelay: "0.00s" }} cx="315" cy="429" r="4" />
          <path className="l-r" d="M84 452H120M270 452H306" />
          
          <path className="l-a" d="M63 470H327L350 669H40Z" />
          <path className="l-g" d="M72 479H318L338 659H52Z" />
          <path d="M58 479H332L344 661H46Z" fill="url(#amber-diamond-mesh)" clipPath="url(#grille-clip)" opacity="0.64" />
          <path className="l-a" d="M62 525H332M57 571H337M51 617H343" />
          <path className="l-g" d="M151 477 144 662M239 477 247 662" />
          
          
          
          
          <path className="l-r" d="M54 682H336L341 727H49Z" />
          <path className="l-a" d="M59 688H331L335 721H55Z" />
          <circle className="l-g" cx="67" cy="704" r="3" />
          <circle className="l-g" cx="323" cy="704" r="3" />
          
          <path className="l-r" d="M48 729Q55 704 81 697M342 729Q335 704 309 697" />
          <path className="l-g" d="M49 730Q53 711 75 705M341 730Q337 711 315 705" />
          <path className="l-g" strokeWidth="2.6" d="M30 727H360Q374 727 376 741V782Q376 794 360 794H30Q14 794 14 782V741Q14 727 30 727Z" />
          <path className="l-r" strokeWidth="2" d="M44 690 22 727M346 690 368 727" />
          <path className="l-a" strokeWidth="2" d="M56 690 38 727M334 690 352 727" />
          <path className="l-a" strokeWidth="2" d="M30 788H360" />
          <path className="l-a" strokeWidth="2.2" d="M38 735H352Q366 735 366 747V772Q366 782 352 782H38Q24 782 24 772V747Q24 735 38 735Z" />
          <circle className="l-r" cx="44" cy="758" r="9" />
          <circle className="l-a" cx="44" cy="758" r="4" />
          <circle className="l-g" cx="346" cy="758" r="9" />
          <circle className="l-a" cx="346" cy="758" r="4" />
          <circle className="l-r mw-led" style={{ animationDelay: "0.40s" }} cx="112" cy="758" r="4" />
          <circle className="l-a mw-led" style={{ animationDelay: "0.60s" }} cx="153" cy="758" r="4" />
          <circle className="l-g mw-led" style={{ animationDelay: "0.00s" }} cx="195" cy="758" r="4" />
          <circle className="l-r mw-led" style={{ animationDelay: "0.40s" }} cx="237" cy="758" r="4" />
          <circle className="l-a mw-led" style={{ animationDelay: "0.60s" }} cx="278" cy="758" r="4" />
          
          <path className="l-r" strokeWidth="2" d="M60 770 86 782M330 770 304 782" />
          
          <path className="l-g" d="M19 798H127M263 798H371" />
          <path className="l-a" d="M141 798H181M209 798H249" />
          <path className="l-r" d="M185 798H205" />
          <path className="l-r" d="M70 407Q128 399 195 406T320 406" opacity=".6" />
          <path className="l-a" d="M70 410Q128 402 195 409T320 409" opacity=".6" />
          </g>
          <text x="195" y="793" textAnchor="middle" fontSize="7" fontWeight="700" fill="#8b93a0" fontFamily="JetBrains Mono, monospace" letterSpacing="2.2" opacity="0">.</text>
        </svg>

        {/* ── windscreen: clear glass; shows only what you picked ── */}
        <div className="mw-windscreen">
          <div className={`mw-wscontent ${phase === "out" ? "wipe-out" : phase === "in" ? "wipe-in" : ""}`}>
            {shown !== "home" && (
              <div className="mw-ws-top">
                <span>{{ home: "", load: "Load wallet", statement: "Statement", gauge: "Fuel gauge · limits", tap: "Tap pay", stage: "Auto-stage", till: "Till / QR" }[shown]}</span>
                <button type="button" className="mw-link" onClick={() => go("home")}>← Balance</button>
              </div>
            )}

            {shown === "home" && (
              <div className="mw-ws-msg"><p className="mw-balance mw-balance-big"><span>KES</span> {wallet.balance.toLocaleString()}</p></div>
            )}

            {shown === "load" && stage === "form" && (
              <>
                <div className="mw-seg"><button type="button" className={method === "mpesa" ? "on" : ""} onClick={() => { setMethod("mpesa"); setField("phone"); }}><Smartphone size={12} /> M-Pesa</button><button type="button" className={method === "bank" ? "on" : ""} onClick={() => { setMethod("bank"); setField("amount"); }}><Landmark size={12} /> Bank</button></div>
                {method === "mpesa" ? (
                  <div className="mw-fields">
                    <button type="button" className={`mw-field${field === "phone" ? " on" : ""}`} onClick={() => setField("phone")}><small>M-Pesa number</small><b>{phone || "07XX XXX XXX"}</b></button>
                    <button type="button" className={`mw-field${field === "amount" ? " on" : ""}`} onClick={() => setField("amount")}><small>Amount</small><b>{Number(amountText || 0).toLocaleString()}</b></button>
                  </div>
                ) : (
                  <>
                    <p className="mw-sub" style={{ marginTop: 6 }}>Pay from your bank app to Paybill <b>400200</b>, account <b>MA3-WALLET</b>. {APP_MODE.realPayments ? "" : "Demo: no real transfer is made."}</p>
                    <div className="mw-fields" style={{ gridTemplateColumns: "1fr" }}><button type="button" className="mw-field on"><small>Amount (KES)</small><b>{Number(amountText || 0).toLocaleString()}</b></button></div>
                  </>
                )}
                <div className="mw-chips">{AMOUNTS.map(a => <button key={a} type="button" className={`mw-chip${String(a) === amountText ? " on" : ""}`} onClick={() => { setAmountText(String(a)); setField("amount"); }}>{a.toLocaleString()}</button>)}</div>
              </>
            )}
            {shown === "load" && stage === "waiting" && <div className="mw-ws-msg"><Loader2 size={26} style={{ color: "var(--ready)", animation: "spin3 1s linear infinite" }} /><b>Check your phone</b><span>Waiting for the M-Pesa prompt to be confirmed…</span></div>}
            {shown === "load" && stage === "pending" && <div className="mw-ws-msg"><b style={{ color: "var(--ready)" }}>Payment still pending</b><span>{message}</span><button type="button" className="mw-chip" style={{ flex: "none", padding: "7px 14px" }} disabled={!pendingTopupId} onClick={() => pendingTopupId && void watchTopup(pendingTopupId)}>Check status</button></div>}
            {shown === "load" && stage === "done" && <div className="mw-ws-msg"><b style={{ color: "var(--go)" }}>✓ {message}</b><button type="button" className="mw-chip on" style={{ flex: "none", padding: "7px 14px" }} onClick={finish}>Done</button></div>}

            {shown === "statement" && (
              <>
                <div className="mw-seg">{(["all", "in", "out"] as const).map(f => <button key={f} type="button" className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "in" ? "Money in" : "Spent"}</button>)}</div>
                <p className="mw-sub" style={{ marginTop: 4 }}>In <b className="in">KES {totalIn.toLocaleString()}</b> · Out <b className="out">KES {totalOut.toLocaleString()}</b></p>
                <div className="mw-list">
                  {rowsShown.length === 0 && <p className="mw-sub">Nothing here yet.</p>}
                  {rowsShown.map(tx => (
                    <div key={tx.id} className="mw-row">
                      {tx.amount >= 0 ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                      <span>{tx.label}<small>{ago(tx.at)}</small></span>
                      <b className={tx.amount >= 0 ? "in" : "out"}>{tx.amount >= 0 ? "+" : "−"}{kes(tx.amount)}</b>
                    </div>
                  ))}
                </div>
                <button type="button" className="mw-chip" style={{ flex: "none", marginTop: 4, padding: "5px 10px" }} onClick={exportCsv}><Download size={11} style={{ verticalAlign: "-2px" }} /> Download statement (CSV)</button>
              </>
            )}

            {shown === "gauge" && (
              <>
                <p className="mw-balance" style={{ fontSize: "clamp(1.1rem,5.6vw,1.5rem)" }}>≈ {rides} rides left</p>
                <div className="mw-gauge" role="img" aria-label={`Balance level ${gaugePct} percent`}>
                  <span className="g-r" /><span className="g-a" /><span className="g-g" />
                  <i style={{ left: `${Math.max(2, Math.min(98, gaugePct))}%` }} />
                </div>
                <p className="mw-sub">At about KES {AVG_FARE} a ride. Red under 100, amber under 500, green above.</p>
                <p className="mw-sub" style={{ marginTop: 6 }}>Daily spend limit (spent today KES {spentToday.toLocaleString()})</p>
                <div className="mw-chips">{LIMITS.map(n => <button key={n} type="button" className={`mw-chip${limit === n ? " on" : ""}`} onClick={() => chooseLimit(n)}>{n === 0 ? "None" : n.toLocaleString()}</button>)}</div>
                {wallet.plan && <p className="mw-sub" style={{ marginTop: 4 }}>Plan: KES {wallet.planAmount} / {wallet.plan}</p>}
              </>
            )}

            {shown === "tap" && (
              <div className="mw-ws-msg">
                {demoStep === 0 && <><button type="button" className={`mw-auto${autoPay ? " on" : ""}`} onClick={toggleAuto} aria-pressed={autoPay}><i />{autoPay ? "Auto-pay on" : "Auto-pay off"}</button><div className="mw-rings"><i /><i /><i /><b>)))</b></div><b>{DEMO_ROUTE}</b><span>Fare KES {DEMO_FARE}. Hold your phone to the reader (demo).</span><button type="button" className="mw-chip on" style={{ flex: "none", padding: "8px 18px" }} onClick={doTap}>Tap phone on reader</button></>}
                {demoStep === 1 && <><Loader2 size={26} style={{ color: "var(--ready)", animation: "spin3 1s linear infinite" }} /><b>Reading…</b></>}
                {demoStep === 2 && <><b>Confirm KES {DEMO_FARE}?</b><span>Auto-pay is off, so you confirm each fare.</span><button type="button" className="mw-chip on" style={{ flex: "none", padding: "8px 18px" }} onClick={() => charge(DEMO_FARE, "Tap pay · " + DEMO_ROUTE)}>Confirm</button></>}
                {demoStep === 9 && <b style={{ color: okColor(demoMsg) }}>{demoMsg}</b>}
              </div>
            )}

            {shown === "stage" && (
              <div className="mw-ws-msg">
                <b>{DEMO_ROUTE}</b>
                <div className="mw-stages">{STAGES.map((n, i) => <span key={n} className={demoStep >= i ? "on" : ""}><i />{n}</span>)}</div>
                {demoStep === 9 ? <b style={{ color: okColor(demoMsg) }}>{demoMsg}</b> : <span>You are riding. The fare is taken when you get off (demo).</span>}
              </div>
            )}

            {shown === "till" && (
              <div className="mw-ws-msg">
                <FakeQr />
                <b>Till 600123 · Demo shop</b>
                {demoStep === 9 ? <b style={{ color: okColor(demoMsg) }}>{demoMsg}</b> : <button type="button" className="mw-chip on" style={{ flex: "none", padding: "8px 18px" }} onClick={() => charge(tillAmount, "Till 600123 (demo)")}>Pay KES {tillAmount.toLocaleString()}</button>}
                <span>Type the amount on the grille keypad.</span>
              </div>
            )}
          </div>
          <div className={`mw-wiper ${phase}`} aria-hidden="true" />
        </div>

        {/* ── dashboard buttons: choose what the windscreen shows ── */}
        <div className="mw-dash" role="toolbar" aria-label="Wallet actions">
          {([["load", "Load", WalletIcon], ["tap", "Pay", Smartphone], ["stage", "Stage", RouteIcon], ["till", "Till/QR", QrCode]] as const).map(([k, t, Icon], i) => (
            <button key={k} type="button" className={`mw-dbtn mw-dbtn-${["g", "r", "a", "g"][i]}${panel === k ? " on" : ""}`} onClick={() => needDemo(k)} aria-pressed={panel === k}><Icon size={14} /><span>{t}</span></button>
          ))}
        </div>

        {/* ── side mirrors = buttons ── */}
        <button className={`mw-mirror mw-mirror-l${panel === "statement" ? " on" : ""}`} onClick={() => go("statement")} aria-label="Rear view: statement of past transactions" aria-pressed={panel === "statement"}>
          <History size={15} /><span className="mw-vt">Past</span><small className="mw-vt">Trips</small>
        </button>
        <button className={`mw-mirror mw-mirror-r${panel === "gauge" ? " on" : ""}`} onClick={() => go("gauge")} aria-label="Fuel gauge and spending limit" aria-pressed={panel === "gauge"}>
          <Gauge size={15} /><span className="mw-vt">Gauge</span><small className="mw-vt">Limits</small>
        </button>

        {/* ── grille = dial pad: 12 real buttons laid over the drawn grille cells ── */}
        <div className="mw-keys2" role="group" aria-label="Dial pad">
          {KEYS.map((k, i) => {
            const r = Math.floor(i / 3), c = i % 3;
            const y0 = [479, 525, 571, 617][r], y1 = [525, 571, 617, 659][r];
            const t = ((y0 + y1) / 2 - 479) / 180, L = 72 - 20 * t, R = 318 + 20 * t, w = (R - L) / 3;
            return (
              <button key={k} type="button" className="mw-k" aria-label={k === "back" ? "Delete" : k} onClick={() => press(k)} disabled={!padOn}
                style={{ left: `${(L + c * w + 2) / 3.9}%`, top: `${(y0 + 2) / 8}%`, width: `${(w - 4) / 3.9}%`, height: `${(y1 - y0 - 4) / 8}%` }}>
                <em>{k === "back" ? <Delete size={17} /> : k}</em>
              </button>
            );
          })}
        </div>

        {/* ── number plate = main action ── */}
        <button className="mw-plate" onClick={plate.act} disabled={plate.off} aria-label={plate.text}>
          <small>{plate.top}</small><b>{plate.text}</b>
        </button>

        <span key={spin} className={`mw-three${spin ? " spin" : ""}`} aria-hidden="true">3</span>
      </div>
    </div>
  );
}
