import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { FINISH, SAFE, START, applyMove, computerChoice, hasWon, legalMoves, newTokens, type Tokens } from "@/lib/ludoRules";


// The 52 squares of the shared track on a 15 x 15 grid, going round clockwise from your start square.
const seg = (c: number, r: number, dc: number, dr: number, n: number): [number, number][] => Array.from({ length: n }, (_, i) => [c + dc * i, r + dr * i]);
const TRACK: [number, number][] = [
  ...seg(1, 6, 1, 0, 5), ...seg(6, 5, 0, -1, 6), ...seg(7, 0, 1, 0, 2), ...seg(8, 1, 0, 1, 5), ...seg(9, 6, 1, 0, 6), ...seg(14, 7, 0, 1, 2),
  ...seg(13, 8, -1, 0, 5), ...seg(8, 9, 0, 1, 6), ...seg(7, 14, -1, 0, 2), ...seg(6, 13, 0, -1, 5), ...seg(5, 8, -1, 0, 6), ...seg(0, 7, 0, -1, 2),
];
const HOME_COL: Record<0 | 1, [number, number][]> = { 0: seg(1, 7, 1, 0, 5), 1: seg(13, 7, -1, 0, 5) };
const BASE: Record<0 | 1, [number, number][]> = { 0: [[1.8, 1.8], [4.2, 1.8], [1.8, 4.2], [4.2, 4.2]], 1: [[10.8, 10.8], [13.2, 10.8], [10.8, 13.2], [13.2, 13.2]] };
const COLORS = { 0: "#16a34a", 1: "#dc2626" } as const;
function where(side: 0 | 1, p: number, index: number): [number, number] {
  if (p === -1) return BASE[side][index];
  if (p === FINISH) return [6.6 + index * .28 + (side === 1 ? .6 : 0), 7.5 + (side === 1 ? .3 : -.3)];
  if (p > 51) { const cell = HOME_COL[side][p - 52]; return [cell[0] + .5, cell[1] + .5]; }
  const cell = TRACK[(START[side] + p) % 52]; return [cell[0] + .5, cell[1] + .5];
}

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
  const board = <svg viewBox="0 0 15 15" style={{ width: "100%", maxWidth: 420, display: "block", margin: "0 auto 10px", borderRadius: 12, background: "#0b1020" }} role="img" aria-label="Ludo board">
    <rect x="0" y="0" width="6" height="6" fill="#14532d" opacity=".55" /><rect x="9" y="9" width="6" height="6" fill="#7f1d1d" opacity=".55" />
    <rect x="9" y="0" width="6" height="6" fill="#1e293b" /><rect x="0" y="9" width="6" height="6" fill="#1e293b" />
    {[[1.1, 1.1], [9, 9]].map(([x, y], i) => <rect key={i} x={x + .9} y={y + .9} width="3.2" height="3.2" rx=".5" fill="rgba(255,255,255,.08)" />)}
    {TRACK.map(([c, r], i) => <g key={i}><rect x={c} y={r} width="1" height="1" fill={i === 0 ? "#16a34a" : i === 26 ? "#dc2626" : "#e5e7eb"} stroke="#0b1020" strokeWidth=".06" />{SAFE.has(i) && <text x={c + .5} y={r + .72} textAnchor="middle" fontSize=".7" fill={i === 0 || i === 26 ? "#fff" : "#f59e0b"}>★</text>}</g>)}
    {HOME_COL[0].map(([c, r], i) => <rect key={"a" + i} x={c} y={r} width="1" height="1" fill="#22c55e" stroke="#0b1020" strokeWidth=".06" opacity={.5 + i * .1} />)}
    {HOME_COL[1].map(([c, r], i) => <rect key={"b" + i} x={c} y={r} width="1" height="1" fill="#ef4444" stroke="#0b1020" strokeWidth=".06" opacity={.5 + i * .1} />)}
    <polygon points="6,6 9,6 7.5,7.5" fill="#1e293b" /><polygon points="6,9 9,9 7.5,7.5" fill="#1e293b" /><polygon points="6,6 6,9 7.5,7.5" fill="#22c55e" /><polygon points="9,6 9,9 7.5,7.5" fill="#ef4444" />
    {([0, 1] as const).flatMap(side => tokens[side].map((p, i) => {
      const [x, y] = where(side, p, i); const movable = side === 0 && moves.includes(i);
      return <g key={`${side}${i}`} style={{ transform: `translate(${x}px,${y}px)`, transition: "transform .35s ease", cursor: movable ? "pointer" : "default" }} onClick={() => choose(i)}>
        {movable && <circle r=".62" fill="none" stroke="#f5b301" strokeWidth=".12"><animate attributeName="r" values=".5;.7;.5" dur="1s" repeatCount="indefinite" /></circle>}
        <circle r=".4" fill={COLORS[side]} stroke="#fff" strokeWidth=".1" />{side === 0 && <text y=".16" textAnchor="middle" fontSize=".5" fontWeight="700" fill="#fff">{i + 1}</text>}
      </g>;
    }))}
  </svg>;
  const home = (side: 0 | 1) => tokens[side].filter(p => p === FINISH).length;

  return <div>
    <p style={{ fontSize: ".72rem", fontWeight: 700, marginBottom: 8 }}>{message}</p>
    {board}
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".62rem", marginBottom: 8 }}><span style={{ color: COLORS[0] }}><b>You</b> (green) · {home(0)}/4 home</span><span style={{ color: COLORS[1] }}><b>Computer</b> (red) · {home(1)}/4 home</span></div>
    {roll !== null && moves.length > 0 && <div style={{ display: "grid", gridTemplateColumns: `repeat(${moves.length},1fr)`, gap: 6, marginBottom: 8 }}>{moves.map(i => <button key={i} className="btn btn-go" style={{ justifyContent: "center" }} onClick={() => choose(i)}>Move token {i + 1}<small style={{ marginLeft: 4 }}>({label(tokens[0][i])})</small></button>)}</div>}
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button className="btn btn-ready" onClick={roller} disabled={turn !== 0 || roll !== null || over}><Dices size={14} /> Roll dice</button>
      {roll !== null && <b style={{ fontSize: "1.6rem", width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 10, background: "#fff", color: "#111" }}>{roll}</b>}
      <button className="btn btn-ghost" onClick={() => { onStart?.(); setTokens(newTokens()); setTurn(0); setRoll(null); reported.current = false; setMessage("Roll the dice to start."); }}>New game</button>
    </div>
    <small style={{ display: "block", color: "var(--muted2)", marginTop: 6, lineHeight: 1.45 }}>A simplified two-player Ludo. Win = 100 Route King points. If you lose you still get 10 points plus 10 for each token you got home.</small>
  </div>;
}
