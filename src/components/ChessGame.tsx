import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";

const GLYPH: Record<string, string> = { wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔", bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚" };
const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

function material(game: Chess) {
  let total = 0;
  for (const row of game.board()) for (const piece of row) if (piece) total += (piece.color === "w" ? 1 : -1) * VALUE[piece.type];
  return total;
}
// Computer plays black. It looks two moves ahead and picks the best material result (easy to beat on purpose).
function pickComputerMove(game: Chess) {
  const moves = game.moves();
  if (!moves.length) return null;
  let best = moves[0], bestScore = Infinity;
  for (const move of moves) {
    game.move(move);
    let worst = -Infinity;
    if (game.isCheckmate()) worst = -99999;
    else for (const reply of game.moves()) { game.move(reply); worst = Math.max(worst, material(game)); game.undo(); }
    if (worst === -Infinity) worst = material(game);
    game.undo();
    const score = worst + Math.random() * 12;
    if (score < bestScore) { bestScore = score; best = move; }
  }
  return best;
}

/** You play white against the computer. onFinish gets 100 for a win, 50 for a draw, 15 for a loss. */
export default function ChessGame({ onFinish, onStart }: { onFinish?: (points: number) => void; onStart?: () => void }) {
  useEffect(() => { onStart?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const game = useRef(new Chess());
  const [tick, setTick] = useState(0);
  const [from, setFrom] = useState<Square | null>(null);
  const reported = useRef(false);
  const board = useMemo(() => game.current.board(), [tick]);
  const targets = useMemo(() => from ? game.current.moves({ square: from, verbose: true }).map(move => move.to) : [], [from, tick]);

  const finishIfOver = () => {
    const g = game.current;
    if (!g.isGameOver() || reported.current) return;
    reported.current = true;
    onFinish?.(g.isCheckmate() ? (g.turn() === "b" ? 100 : 15) : 50);
  };
  const tap = (square: Square) => {
    const g = game.current;
    if (g.isGameOver() || g.turn() !== "w") return;
    if (from && targets.includes(square)) {
      const move = g.moves({ square: from, verbose: true }).find(item => item.to === square);
      g.move({ from, to: square, promotion: move?.promotion ? "q" : undefined });
      setFrom(null); setTick(value => value + 1); finishIfOver();
      if (!g.isGameOver()) window.setTimeout(() => { const reply = pickComputerMove(g); if (reply) g.move(reply); setTick(value => value + 1); finishIfOver(); }, 350);
      return;
    }
    const piece = g.get(square);
    setFrom(piece && piece.color === "w" ? square : null);
  };
  const reset = () => { onStart?.(); game.current = new Chess(); reported.current = false; setFrom(null); setTick(value => value + 1); };
  const g = game.current;
  const status = g.isCheckmate() ? (g.turn() === "b" ? "You won!" : "Computer won.") : g.isDraw() ? "Draw." : g.turn() === "w" ? (g.inCheck() ? "Your move (you are in check)" : "Your move") : "Computer is thinking…";

  return <div>
    <p style={{ fontSize: ".72rem", fontWeight: 700, marginBottom: 6 }}>{status}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", aspectRatio: "1", maxWidth: 360, margin: "0 auto", border: "2px solid var(--border2)", borderRadius: 8, overflow: "hidden" }}>
      {board.flatMap((row, r) => row.map((piece, c) => {
        const square = (String.fromCharCode(97 + c) + (8 - r)) as Square;
        const dark = (r + c) % 2 === 1;
        return <button key={square} aria-label={square} onClick={() => tap(square)} style={{ border: 0, padding: 0, aspectRatio: "1", fontSize: "clamp(1.1rem,6vw,1.9rem)", lineHeight: 1, cursor: "pointer", color: piece?.color === "w" ? "#fff" : "#111", textShadow: piece?.color === "w" ? "0 0 2px #000,0 0 2px #000" : "none", background: from === square ? "#d97706" : targets.includes(square) ? "#16a34a" : dark ? "#7c5a3a" : "#e2c9a0" }}>{piece ? GLYPH[piece.color + piece.type] : ""}</button>;
      }))}
    </div>
    <button className="btn btn-ghost" style={{ marginTop: 9 }} onClick={reset}>New game</button>
    <small style={{ display: "block", color: "var(--muted2)", marginTop: 6 }}>You are white. Tap a piece, then a green square. A win is 100 Route King points, a draw 50, a loss 15.</small>
  </div>;
}
