import { useCallback, useEffect, useRef, useState } from "react";

/** 8-ball pool. Drag back from the white ball like a catapult, let go to shoot. Play the computer or pass the phone. */
const W = 300, H = 560, R = 9.5, POCKET = 19, RAIL = 14;
const POCKETS: [number, number][] = [[RAIL - 4, RAIL - 4], [W - RAIL + 4, RAIL - 4], [RAIL - 6, H / 2], [W - RAIL + 6, H / 2], [RAIL - 4, H - RAIL + 4], [W - RAIL + 4, H - RAIL + 4]];
const COLOURS = ["#f5f5f4", "#facc15", "#2563eb", "#dc2626", "#7c3aed", "#f97316", "#16a34a", "#7f1d1d", "#0a0a0a", "#facc15", "#2563eb", "#dc2626", "#7c3aed", "#f97316", "#16a34a", "#7f1d1d"];
const MAX_POWER = 21;

type Ball = { n: number; x: number; y: number; vx: number; vy: number; in: boolean };
type Group = "solid" | "stripe";
const groupOf = (n: number): Group | "eight" | "cue" => n === 0 ? "cue" : n === 8 ? "eight" : n < 8 ? "solid" : "stripe";

function rack(): Ball[] {
  const balls: Ball[] = [{ n: 0, x: W / 2, y: H * 0.74, vx: 0, vy: 0, in: false }];
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  let k = 0;
  for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) balls.push({ n: order[k++], x: W / 2 + (i - row / 2) * (R * 2 + 0.6), y: H * 0.28 + row * (R * 1.75 + 0.5), vx: 0, vy: 0, in: false });
  return balls;
}

export default function PoolGame({ onStart, onFinish }: { onStart?: () => void; onFinish?: (points: number) => void }) {
  const [mode, setMode] = useState<"menu" | "cpu" | "pass">("menu");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const balls = useRef<Ball[]>(rack());
  const moving = useRef(false);
  const turn = useRef(0); // 0 = you / player 1, 1 = computer / player 2
  const groups = useRef<(Group | null)[]>([null, null]);
  const aim = useRef<{ x: number; y: number } | null>(null);
  const shot = useRef<{ first: number | null; potted: number[]; player: number } | null>(null);
  const over = useRef(false);
  const cpuPending = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [status, setStatus] = useState("");
  const [, bump] = useState(0);
  const refresh = () => bump(v => v + 1);

  const names = () => modeRef.current === "cpu" ? ["You", "Computer"] : ["Player 1", "Player 2"];
  const poss = (p: number) => names()[p] === "You" ? "Your" : `${names()[p]}'s`;
  const say = (text: string) => setStatus(text);
  const remaining = (g: Group | null) => g ? balls.current.filter(b => !b.in && groupOf(b.n) === g).length : 7;

  const start = (m: "cpu" | "pass") => {
    balls.current = rack(); turn.current = 0; groups.current = [null, null]; over.current = false; moving.current = false; shot.current = null; aim.current = null;
    setMode(m); modeRef.current = m; onStart?.();
    say(m === "cpu" ? "Your break. Drag back from the white ball and let go." : "Player 1 breaks. Drag back from the white ball.");
  };

  const finish = (winner: number, why: string) => {
    over.current = true;
    const n = names();
    say(`${n[winner]} wins. ${why}`);
    const mineWon = modeRef.current === "cpu" ? winner === 0 : true;
    onFinish?.(mineWon ? 100 : 20);
    refresh();
  };

  const fire = useCallback((angle: number, power: number) => {
    if (moving.current || over.current) return;
    const cue = balls.current[0];
    cue.vx = Math.cos(angle) * power; cue.vy = Math.sin(angle) * power;
    moving.current = true; shot.current = { first: null, potted: [], player: turn.current };
    try { navigator.vibrate?.(15); } catch { /* unsupported */ }
  }, []);

  /** the rules, applied once every ball has stopped */
  const endShot = () => {
    const s = shot.current!; shot.current = null; moving.current = false;
    const me = s.player, n = names();
    const cuePotted = s.potted.includes(0);
    const own = groups.current[me];
    let foul = cuePotted || s.first === null;
    if (s.first !== null && own) {
      const firstGroup = groupOf(s.first);
      const ownLeft = remaining(own) + s.potted.filter(p => groupOf(p) === own).length > 0;
      if (firstGroup !== own && !(firstGroup === "eight" && !ownLeft)) foul = true;
    }
    // the black ball
    if (s.potted.includes(8)) {
      const clearedBefore = own ? balls.current.filter(b => groupOf(b.n) === own && !b.in).length === 0 : false;
      if (clearedBefore && !foul) return finish(me, "The black 8 went in.");
      return finish(1 - me, `${n[me]} potted the 8 too early or fouled.`);
    }
    // choose groups on the first clean pot
    const object = s.potted.filter(p => p !== 0);
    if (!own && object.length && !foul) {
      const g = groupOf(object[0]) as Group;
      groups.current[me] = g; groups.current[1 - me] = g === "solid" ? "stripe" : "solid";
    }
    const mine = groups.current[me];
    const potMine = !!mine && object.some(p => groupOf(p) === mine);
    const potAny = !mine && object.length > 0;
    if (cuePotted) { const cue = balls.current[0]; cue.in = false; cue.x = W / 2; cue.y = H * 0.74; cue.vx = cue.vy = 0; }
    if (!foul && (potMine || potAny)) {
      say(`${n[me]} potted a ball${groups.current[me] ? ` (${groups.current[me]}s)` : ""} and plays again.`);
    } else {
      turn.current = 1 - me;
      say(foul ? `Foul by ${n[me]}${cuePotted ? " (white ball potted)" : s.first === null ? " (hit nothing)" : " (wrong ball first)"}. ${poss(turn.current)} turn. ${groups.current[turn.current] ? `They are ${groups.current[turn.current]}s.` : ""}` : `No pot. ${poss(turn.current)} turn.`);
    }
    refresh();
  };

  // physics and drawing
  useEffect(() => {
    if (mode === "menu") return;
    const canvas = canvasRef.current!; const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const step = () => {
      const list = balls.current.filter(b => !b.in);
      if (moving.current) {
        for (let sub = 0; sub < 3; sub++) {
          for (const b of list) {
            b.x += b.vx / 3; b.y += b.vy / 3;
            if (b.x < RAIL + R) { b.x = RAIL + R; b.vx = Math.abs(b.vx) * .86; }
            if (b.x > W - RAIL - R) { b.x = W - RAIL - R; b.vx = -Math.abs(b.vx) * .86; }
            if (b.y < RAIL + R) { b.y = RAIL + R; b.vy = Math.abs(b.vy) * .86; }
            if (b.y > H - RAIL - R) { b.y = H - RAIL - R; b.vy = -Math.abs(b.vy) * .86; }
          }
          for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const a = list[i], c = list[j];
            const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
            if (d > 0 && d < R * 2) {
              const nx = dx / d, ny = dy / d, overlap = (R * 2 - d) / 2;
              a.x -= nx * overlap; a.y -= ny * overlap; c.x += nx * overlap; c.y += ny * overlap;
              const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
              if (rel < 0) { a.vx += rel * nx; a.vy += rel * ny; c.vx -= rel * nx; c.vy -= rel * ny; }
              if (shot.current && shot.current.first === null && (a.n === 0 || c.n === 0)) shot.current.first = a.n === 0 ? c.n : a.n;
            }
          }
          for (const b of list) for (const [px, py] of POCKETS) if (Math.hypot(b.x - px, b.y - py) < POCKET) { b.in = true; b.vx = b.vy = 0; shot.current?.potted.push(b.n); }
        }
        let still = true;
        for (const b of list) { b.vx *= 0.977; b.vy *= 0.977; if (Math.hypot(b.vx, b.vy) < 0.12) { b.vx = b.vy = 0; } else still = false; }
        if (still) endShot();
      } else if (!over.current && modeRef.current === "cpu" && turn.current === 1) {
        if (!cpuPending.current) { cpuPending.current = true; window.setTimeout(() => { cpuPending.current = false; if (!moving.current && turn.current === 1 && !over.current && modeRef.current === "cpu") computerShot(); }, 800); }
      }
      draw();
      raf = requestAnimationFrame(step);
    };
    const draw = () => {
      const dpr = window.devicePixelRatio || 1, cw = canvas.clientWidth, scale = cw / W;
      if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(H * scale * dpr); }
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#5b3a1e"; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 18); ctx.fill();
      ctx.fillStyle = "#0f6b3c"; ctx.beginPath(); ctx.roundRect(RAIL - 3, RAIL - 3, W - 2 * RAIL + 6, H - 2 * RAIL + 6, 8); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(RAIL, H * 0.74 - 0); ctx.lineTo(W - RAIL, H * 0.74); ctx.stroke();
      ctx.fillStyle = "#050505"; for (const [px, py] of POCKETS) { ctx.beginPath(); ctx.arc(px, py, POCKET * .85, 0, 7); ctx.fill(); }
      for (const b of balls.current) {
        if (b.in) continue;
        const stripe = b.n > 8;
        ctx.fillStyle = stripe ? "#f5f5f4" : COLOURS[b.n]; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.fill();
        if (stripe) { ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.clip(); ctx.fillStyle = COLOURS[b.n]; ctx.fillRect(b.x - R, b.y - R * .55, R * 2, R * 1.1); ctx.restore(); }
        if (b.n > 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, R * .42, 0, 7); ctx.fill(); ctx.fillStyle = "#000"; ctx.font = "bold 6.5px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(b.n), b.x, b.y + .3); }
        ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.stroke();
      }
      if (aim.current && !moving.current && !over.current) {
        const cue = balls.current[0], dx = cue.x - aim.current.x, dy = cue.y - aim.current.y, len = Math.min(Math.hypot(dx, dy), 130);
        if (len > 4) {
          const ang = Math.atan2(dy, dx);
          ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cue.x, cue.y); ctx.lineTo(cue.x + Math.cos(ang) * 170, cue.y + Math.sin(ang) * 170); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = "#f5b301"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cue.x - Math.cos(ang) * (R + 4), cue.y - Math.sin(ang) * (R + 4)); ctx.lineTo(cue.x - Math.cos(ang) * (R + 4 + len * .7), cue.y - Math.sin(ang) * (R + 4 + len * .7)); ctx.stroke();
        }
      }
    };
    const computerShot = () => {
      if (over.current) return;
      const cue = balls.current[0];
      const g = groups.current[1];
      const live = balls.current.filter(b => !b.in && b.n !== 0);
      let targets = g ? live.filter(b => groupOf(b.n) === g) : live.filter(b => b.n !== 8);
      if (g && !targets.length) targets = live.filter(b => b.n === 8);
      if (!targets.length) targets = live;
      let best: { ang: number; score: number; dist: number } | null = null;
      for (const t of targets) for (const [px, py] of POCKETS) {
        const bx = px - t.x, by = py - t.y, bl = Math.hypot(bx, by);
        const gx = t.x - (bx / bl) * R * 2, gy = t.y - (by / bl) * R * 2;
        const cx = gx - cue.x, cy = gy - cue.y, cl = Math.hypot(cx, cy);
        const cos = (cx * bx + cy * by) / (cl * bl);
        if (cos < 0.25) continue;
        // skip shots with another ball in the way
        const blocked = live.some(o => o !== t && distToSegment(o.x, o.y, cue.x, cue.y, gx, gy) < R * 1.9);
        const score = cos * 100 - cl * 0.08 - bl * 0.05 - (blocked ? 60 : 0);
        if (!best || score > best.score) best = { ang: Math.atan2(cy, cx), score, dist: cl + bl };
      }
      const ang = (best ? best.ang : Math.atan2(targets[0].y - cue.y, targets[0].x - cue.x)) + (Math.random() - .5) * 0.07;
      const power = Math.min(MAX_POWER, 7 + (best ? best.dist : 200) / 28);
      aim.current = null;
      fire(ang, power);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mode, fire]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };
  const canAim = () => !moving.current && !over.current && (modeRef.current === "pass" || turn.current === 0);
  const down = (e: React.PointerEvent) => { if (!canAim()) return; (e.target as Element).setPointerCapture?.(e.pointerId); aim.current = point(e); };
  const move = (e: React.PointerEvent) => { if (aim.current && canAim()) aim.current = point(e); };
  const up = () => {
    if (!aim.current || !canAim()) { aim.current = null; return; }
    const cue = balls.current[0], dx = cue.x - aim.current.x, dy = cue.y - aim.current.y, len = Math.hypot(dx, dy);
    aim.current = null;
    if (len < 8) return;
    fire(Math.atan2(dy, dx), Math.min(MAX_POWER, (Math.min(len, 130) / 130) * MAX_POWER));
  };

  if (mode === "menu") return <div style={{ display: "grid", gap: 12, maxWidth: 520, width: "100%", margin: "0 auto" }}>
    <div style={{ textAlign: "center" }}><div style={{ fontSize: "2.4rem" }}>🎱</div><h3 style={{ margin: "4px 0", fontFamily: "var(--font-display)" }}>Pool · 8-ball</h3>
      <p style={{ margin: 0, fontSize: ".66rem", color: "var(--muted2)" }}>Pot all your balls (spots or stripes), then the black 8. Drag back from the white ball like a catapult and let go. Potting the white ball or hitting the wrong ball first is a foul.</p></div>
    <button className="btn btn-go" style={{ padding: 12 }} onClick={() => start("cpu")}>Play the computer</button>
    <button className="btn btn-ready" style={{ padding: 12 }} onClick={() => start("pass")}>Two players, one phone</button>
  </div>;

  const n = names();
  const tray = (p: number) => <span style={{ fontSize: ".62rem", color: turn.current === p ? "var(--go)" : "var(--muted2)", fontWeight: turn.current === p ? 800 : 500 }}>{n[p]}: {groups.current[p] ? `${groups.current[p]}s, ${remaining(groups.current[p])} left` : "open"}</span>;
  return <div style={{ display: "grid", gap: 8, justifyItems: "center", width: "100%" }}>
    <div style={{ display: "flex", justifyContent: "space-between", width: "min(100%, calc((100dvh - 230px) * 0.536))" }}>{tray(0)}{tray(1)}</div>
    <p aria-live="polite" style={{ margin: 0, fontSize: ".64rem", color: "#cffafe", textAlign: "center", minHeight: 30 }}>{status}</p>
    <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ width: "min(100%, calc((100dvh - 230px) * 0.536))", aspectRatio: `${W}/${H}`, touchAction: "none", borderRadius: 18, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }} />
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn btn-ghost" style={{ padding: "7px 14px" }} onClick={() => start(mode as "cpu" | "pass")}>New game</button>
      <button className="btn btn-ghost" style={{ padding: "7px 14px" }} onClick={() => setMode("menu")}>Change mode</button>
    </div>
  </div>;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
