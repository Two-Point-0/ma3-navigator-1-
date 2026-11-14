import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { FINISH, applyMove, computerChoice, hasWon, legalMoves, newTokens, type Tokens } from "@/lib/ludoRules";

const label = (p: number) => p === -1 ? "In base" : p === FINISH ? "Home!" : p > 51 ? "Home column" : `Square ${p + 1}`;

/** You (green) race four tokens home against the computer (red). Roll a 6 to leave base. A 6 gives another roll. Landing on a lone opponent sends it back, except on safe squares. */
export default function LudoGame({ onFinish, onStart }: { onFinish?: (points: number) => void; onStart?: () => void }) {
  useEffect(() => { onStart?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tokens, setTokens] = useState<Tokens>(newTokens);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [roll, setRoll] = useState<number | null>(null);
  const [message, setMessage] = useState("Roll the dice to start.");
  const reported = useRef(false);
  const over = hasWon(tokens, 0) || hasWon(tokens, 1);

  useEffect(() => {
    if (!over || reported.current) return;
    reported.current = true;
    const home = tokens[0].filter(p => p === FINISH).length;
    onFinish?.(hasWon(tokens, 0) ? 100 : 10 + home * 10);
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterMove = (next: Tokens, side: 0 | 1, rolled: number) => {
    setTokens(next); setRoll(null);
    if (hasWon(next, side)) { setMessage(side === 0 ? "You won! All four tokens are home." : "The computer won."); return; }
    setTurn(rolled === 6 ? side : (side === 0 ? 1 : 0));
    setMessage(rolled === 6 ? (side === 0 ? "A six! Roll again." : "Computer rolled a six and goes again.") : side === 0 ? "Computer's turn…" : "Your turn. Roll the dice.");
  };

  const roller = () => {
    if (turn !== 0 || roll !== null || over) return;
    const value = 1 + Math.floor(Math.random() * 6);
    if (!legalMoves(tokens, 0, value).length) { setMessage(`You rolled ${value}. No move possible.`); setTurn(1); return; }
    setRoll(value); setMessage(`You rolled ${value}. Tap a token to move it.`);
  };
  const choose = (index: number) => {
    if (turn !== 0 || roll === null || !legalMoves(tokens, 0, roll).includes(index)) return;
    const result = applyMove(tokens, 0, index, roll);
    afterMove(result.tokens, 0, roll);
    if (result.captured) setMessage("You captured a computer token!");
  };

  useEffect(() => {
    if (turn !== 1 || over) return;
    const timer = window.setTimeout(() => {
      const value = 1 + Math.floor(Math.random() * 6);
      const pick = computerChoice(tokens, value);
      if (pick === null) { setMessage(`Computer rolled ${value} and could not move.`); setTurn(0); return; }
      const result = applyMove(tokens, 1, pick, value);
      afterMove(result.tokens, 1, value);
      if (result.captured) setMessage(`Computer rolled ${value} and captured one of your tokens.`);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [turn, tokens, over]); // eslint-disable-line react-hooks/exhaustive-deps

  const moves = roll !== null ? legalMoves(tokens, 0, roll) : [];
  const row = (side: 0 | 1, name: string, color: string) => <div style={{ marginBottom: 10 }}>
    <b style={{ fontSize: ".7rem", color }}>{name}</b>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 5 }}>{tokens[side].map((p, i) => <button key={i} disabled={side !== 0 || !moves.includes(i)} onClick={() => choose(i)} style={{ padding: "8px 4px", borderRadius: 10, border: `2px solid ${side === 0 && moves.includes(i) ? "#f5b301" : color}`, background: "rgba(255,255,255,.05)", color: "var(--white)", fontSize: ".58rem", cursor: side === 0 && moves.includes(i) ? "pointer" : "default" }}>
      <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: color, margin: "0 auto 4px" }} />Token {i + 1}<br />{label(p)}
      <span style={{ display: "block", height: 4, background: "rgba(255,255,255,.15)", borderRadius: 2, marginTop: 4 }}><span style={{ display: "block", height: 4, width: `${Math.max(0, p) / FINISH * 100}%`, background: color, borderRadius: 2 }} /></span>
    </button>)}</div></div>;

  return <div>
    <p style={{ fontSize: ".72rem", fontWeight: 700, marginBottom: 8 }}>{message}</p>
    {row(1, "Computer", "#dc2626")}
    {row(0, "You", "#16a34a")}
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button className="btn btn-ready" onClick={roller} disabled={turn !== 0 || roll !== null || over}><Dices size={14} /> Roll dice</button>
      {roll !== null && <b style={{ fontSize: "1.4rem" }}>{roll}</b>}
      <button className="btn btn-ghost" onClick={() => { onStart?.(); setTokens(newTokens()); setTurn(0); setRoll(null); reported.current = false; setMessage("Roll the dice to start."); }}>New game</button>
    </div>
    <small style={{ display: "block", color: "var(--muted2)", marginTop: 6, lineHeight: 1.45 }}>A simplified two-player Ludo. Win = 100 Route King points. If you lose you still get 10 points plus 10 for each token you got home.</small>
  </div>;
}
