import { useCallback, useEffect, useRef, useState } from "react";

type GameProps = { onStart?: () => void; onFinish?: (points: number) => void };
const btnStyle = { justifyContent: "center" } as const;

/** Shared bits: a "Play again" button and the line that tells the player how the score is counted. */
function Footer({ text, onAgain }: { text: string; onAgain: () => void }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}><button className="btn btn-ghost" onClick={onAgain}>New game</button><small style={{ color: "var(--muted2)", lineHeight: 1.4 }}>{text}</small></div>;
}

/* ───────────── 1. Matatu Match (memory cards) ───────────── */
const FACES = ["🚌", "🚕", "🏍️", "🚆", "✈️", "🥭", "🍞", "⚽"];
const shuffled = () => [...FACES, ...FACES].map(face => ({ face, key: Math.random() })).sort((a, b) => a.key - b.key).map(x => x.face);
export function MemoryGame({ onStart, onFinish }: GameProps) {
  const [cards, setCards] = useState(shuffled);
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const reported = useRef(false);
  useEffect(() => { onStart?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const won = done.size === cards.length;
  useEffect(() => {
    if (!won || reported.current) return;
    reported.current = true; onFinish?.(Math.max(10, Math.min(100, 100 - (moves - 8) * 6)));
  }, [won]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (index: number) => {
    if (open.length === 2 || open.includes(index) || done.has(index)) return;
    const next = [...open, index]; setOpen(next);
    if (next.length === 2) {
      setMoves(m => m + 1);
      window.setTimeout(() => {
        if (cards[next[0]] === cards[next[1]]) setDone(current => new Set([...current, next[0], next[1]]));
        setOpen([]);
      }, 650);
    }
  };
  const again = () => { onStart?.(); setCards(shuffled()); setOpen([]); setDone(new Set()); setMoves(0); reported.current = false; };
  return <div>
    <p style={{ fontSize: ".72rem", fontWeight: 700, marginBottom: 8 }}>{won ? `All matched in ${moves} moves!` : `Moves: ${moves} · matched ${done.size / 2}/8`}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>{cards.map((face, index) => { const shown = open.includes(index) || done.has(index); return <button key={index} onClick={() => flip(index)} aria-label={shown ? face : "Hidden card"} style={{ aspectRatio: "1", fontSize: "1.7rem", borderRadius: 12, border: `2px solid ${done.has(index) ? "var(--go)" : "var(--border2)"}`, background: shown ? "rgba(255,255,255,.1)" : "rgba(217,119,6,.18)", color: "var(--white)", cursor: "pointer", transition: ".2s" }}>{shown ? face : "?"}</button>; })}</div>
    <Footer text="Find all 8 pairs. Fewer moves = more points (best: 100)." onAgain={again} />
  </div>;
}

/* ───────────── 2. Join 2048 ───────────── */
type Grid = number[][];
const empty = (): Grid => Array.from({ length: 4 }, () => Array(4).fill(0));
function addTile(grid: Grid): Grid {
  const free: [number, number][] = []; grid.forEach((row, r) => row.forEach((v, c) => { if (!v) free.push([r, c]); }));
  if (!free.length) return grid;
  const [r, c] = free[Math.floor(Math.random() * free.length)];
  const next = grid.map(row => [...row]); next[r][c] = Math.random() < .9 ? 2 : 4; return next;
}
function slideRow(row: number[]) {
  const nums = row.filter(Boolean); let gained = 0; const out: number[] = [];
  for (let i = 0; i < nums.length; i++) { if (nums[i] === nums[i + 1]) { out.push(nums[i] * 2); gained += nums[i] * 2; i++; } else out.push(nums[i]); }
  while (out.length < 4) out.push(0);
  return { row: out, gained };
}
function move(grid: Grid, dir: "L" | "R" | "U" | "D") {
  let gained = 0;
  const rotate = (g: Grid) => g[0].map((_, c) => g.map(row => row[c]).reverse());
  const times = { L: 0, D: 1, R: 2, U: 3 }[dir];
  let g = grid; for (let i = 0; i < times; i++) g = rotate(g);
  const slid = g.map(row => { const result = slideRow(row); gained += result.gained; return result.row; });
  g = slid; for (let i = 0; i < (4 - times) % 4; i++) g = rotate(g);
  const changed = g.some((row, r) => row.some((v, c) => v !== grid[r][c]));
  return { grid: g, gained, changed };
}
const canMove = (grid: Grid) => (["L", "R", "U", "D"] as const).some(d => move(grid, d).changed);
const TILE: Record<number, string> = { 0: "rgba(255,255,255,.06)", 2: "#475569", 4: "#64748b", 8: "#d97706", 16: "#ea580c", 32: "#dc2626", 64: "#be123c", 128: "#16a34a", 256: "#15803d", 512: "#0e7490", 1024: "#4338ca", 2048: "#f5b301" };
export function Game2048({ onStart, onFinish }: GameProps) {
  const [grid, setGrid] = useState<Grid>(() => addTile(addTile(empty())));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const reported = useRef(false);
  const touch = useRef<[number, number] | null>(null);
  useEffect(() => { onStart?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = useCallback((finalScore: number) => { if (reported.current) return; reported.current = true; setOver(true); onFinish?.(Math.min(100, Math.floor(finalScore / 40))); }, [onFinish]);
  const go = (dir: "L" | "R" | "U" | "D") => {
    if (over) return;
    const result = move(grid, dir); if (!result.changed) return;
    const next = addTile(result.grid); const total = score + result.gained;
    setGrid(next); setScore(total);
    if (!canMove(next)) finish(total);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { const map: Record<string, "L" | "R" | "U" | "D"> = { ArrowLeft: "L", ArrowRight: "R", ArrowUp: "U", ArrowDown: "D" }; if (map[event.key]) { event.preventDefault(); go(map[event.key]); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  });
  const again = () => { onStart?.(); setGrid(addTile(addTile(empty()))); setScore(0); setOver(false); reported.current = false; };
  return <div>
    <p style={{ fontSize: ".72rem", fontWeight: 700, marginBottom: 8 }}>{over ? `Game over · score ${score}` : `Score ${score} · swipe or use the arrows`}</p>
    <div onTouchStart={event => { touch.current = [event.touches[0].clientX, event.touches[0].clientY]; }} onTouchEnd={event => { if (!touch.current) return; const dx = event.changedTouches[0].clientX - touch.current[0], dy = event.changedTouches[0].clientY - touch.current[1]; touch.current = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : (dy > 0 ? "D" : "U")); }}
      style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, padding: 6, borderRadius: 14, background: "rgba(255,255,255,.05)", touchAction: "none", maxWidth: 340, margin: "0 auto" }}>
      {grid.flat().map((value, index) => <div key={index} style={{ aspectRatio: "1", display: "grid", placeItems: "center", borderRadius: 10, background: TILE[value] ?? "#f5b301", color: "#fff", fontWeight: 800, fontSize: value > 999 ? ".9rem" : "1.15rem" }}>{value || ""}</div>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, maxWidth: 200, margin: "10px auto 0" }}>
      <span /><button className="btn btn-ghost" style={btnStyle} onClick={() => go("U")} aria-label="Up">▲</button><span />
      <button className="btn btn-ghost" style={btnStyle} onClick={() => go("L")} aria-label="Left">◀</button><button className="btn btn-ghost" style={btnStyle} onClick={() => go("D")} aria-label="Down">▼</button><button className="btn btn-ghost" style={btnStyle} onClick={() => go("R")} aria-label="Right">▶</button>
    </div>
    {!over && <button className="btn btn-ready" style={{ display: "flex", margin: "10px auto 0" }} onClick={() => finish(score)}>Finish and send my score</button>}
    <Footer text="Merge equal tiles. Every 40 game points = 1 Route King point (max 100)." onAgain={again} />
  </div>;
}

/* ───────────── 3. Matatu Snake ───────────── */
const N = 15;
type Pt = [number, number];
export function SnakeGame({ onStart, onFinish }: GameProps) {
  const [snake, setSnake] = useState<Pt[]>([[7, 7], [6, 7], [5, 7]]);
  const [food, setFood] = useState<Pt>([11, 7]);
  const [over, setOver] = useState(false);
  const [eaten, setEaten] = useState(0);
  const dir = useRef<Pt>([1, 0]); const queued = useRef<Pt>([1, 0]);
  const reported = useRef(false); const touch = useRef<[number, number] | null>(null);
  useEffect(() => { onStart?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const turn = (d: Pt) => { if (d[0] === -dir.current[0] && d[1] === -dir.current[1]) return; queued.current = d; };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { const m: Record<string, Pt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; if (m[event.key]) { event.preventDefault(); turn(m[event.key]); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (over) return;
    const timer = window.setInterval(() => {
      setSnake(current => {
        dir.current = queued.current;
        const head: Pt = [current[0][0] + dir.current[0], current[0][1] + dir.current[1]];
        if (head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || current.some(([x, y]) => x === head[0] && y === head[1])) { setOver(true); return current; }
        const ate = head[0] === food[0] && head[1] === food[1];
        const next = [head, ...current]; if (!ate) next.pop();
        if (ate) {
          setEaten(count => count + 1);
          let spot: Pt; do { spot = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (next.some(([x, y]) => x === spot[0] && y === spot[1]));
          setFood(spot);
        }
        return next;
      });
    }, 150);
    return () => window.clearInterval(timer);
  }, [over, food]);
  useEffect(() => { if (over && !reported.current) { reported.current = true; onFinish?.(Math.min(100, eaten * 5)); } }, [over]); // eslint-disable-line react-hooks/exhaustive-deps
  const again = () => { onStart?.(); setSnake([[7, 7], [6, 7], [5, 7]]); setFood([11, 7]); dir.current = [1, 0]; queued.current = [1, 0]; setEaten(0); setOver(false); reported.current = false; };
  return <div>
    <p style={{ fontSize: ".72rem", fontWeight: 700, marginBottom: 8 }}>{over ? `Crashed! Matatus collected: ${eaten}` : `Matatus collected: ${eaten}`}</p>
    <div onTouchStart={event => { touch.current = [event.touches[0].clientX, event.touches[0].clientY]; }} onTouchEnd={event => { if (!touch.current) return; const dx = event.changedTouches[0].clientX - touch.current[0], dy = event.changedTouches[0].clientY - touch.current[1]; touch.current = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; turn(Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1]); }} style={{ touchAction: "none", maxWidth: 340, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${N} ${N}`} style={{ width: "100%", borderRadius: 12, background: "#0b1020" }}>
        {snake.map(([x, y], i) => <rect key={i} x={x + .06} y={y + .06} width=".88" height=".88" rx=".2" fill={i === 0 ? "#f5b301" : "#16a34a"} />)}
        <text x={food[0] + .5} y={food[1] + .8} textAnchor="middle" fontSize=".85">🚌</text>
      </svg>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, maxWidth: 200, margin: "10px auto 0" }}>
      <span /><button className="btn btn-ghost" style={btnStyle} onClick={() => turn([0, -1])} aria-label="Up">▲</button><span />
      <button className="btn btn-ghost" style={btnStyle} onClick={() => turn([-1, 0])} aria-label="Left">◀</button><button className="btn btn-ghost" style={btnStyle} onClick={() => turn([0, 1])} aria-label="Down">▼</button><button className="btn btn-ghost" style={btnStyle} onClick={() => turn([1, 0])} aria-label="Right">▶</button>
    </div>
    <Footer text="Collect matatus, don't hit walls or yourself. 5 points each (max 100)." onAgain={again} />
  </div>;
}

/* ───────────── 4. Whack-a-Matatu (30 seconds) ───────────── */
export function WhackGame({ onStart, onFinish }: GameProps) {
  const [lit, setLit] = useState<number | null>(null);
  const [hits, setHits] = useState(0); const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(30); const [running, setRunning] = useState(false);
  const reported = useRef(false);
  const start = () => { onStart?.(); setHits(0); setMisses(0); setLeft(30); setLit(null); reported.current = false; setRunning(true); };
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setLeft(value => value - 1), 1000);
    const pop = window.setInterval(() => setLit(Math.floor(Math.random() * 9)), 700);
    return () => { window.clearInterval(tick); window.clearInterval(pop); };
  }, [running]);
  useEffect(() => { if (running && left <= 0) { setRunning(false); setLit(null); if (!reported.current) { reported.current = true; onFinish?.(Math.max(0, Math.min(100, hits * 4 - misses * 2))); } } }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (index: number) => { if (!running) return; if (index === lit) { setHits(h => h + 1); setLit(null); } else setMisses(m => m + 1); };
  return <div>
    <p style={{ fontSize: ".72rem", fontWeight: 700, marginBottom: 8 }}>{running ? `Time ${left}s · hits ${hits}` : left <= 0 ? `Time up! ${hits} hits, ${misses} misses` : "Tap the matatu as it pops up. 30 seconds."}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, maxWidth: 300, margin: "0 auto" }}>{Array.from({ length: 9 }, (_, index) => <button key={index} onClick={() => tap(index)} aria-label={index === lit ? "Matatu" : "Empty stage"} style={{ aspectRatio: "1", fontSize: "2rem", borderRadius: 16, border: "2px solid var(--border2)", background: index === lit ? "rgba(245,179,1,.28)" : "rgba(255,255,255,.05)", cursor: "pointer", transition: ".1s" }}>{index === lit ? "🚌" : ""}</button>)}</div>
    {!running && <button className="btn btn-ready" style={{ display: "flex", margin: "12px auto 0" }} onClick={start}>{left <= 0 ? "Play again" : "Start"}</button>}
    <small style={{ display: "block", color: "var(--muted2)", marginTop: 8, lineHeight: 1.4, textAlign: "center" }}>4 points per hit, minus 2 per miss (max 100).</small>
  </div>;
}
