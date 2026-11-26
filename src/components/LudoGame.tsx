import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Copy, Globe2, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";
import DicePopup from "@/components/DicePopup";
import { FINISH, SAFE, SEAT_COLOUR, SEAT_NAME, START, SEATS, computerChoice, newGame, reduce, type LudoAction, type LudoSeat, type LudoState, type Seat } from "@/lib/ludoRules";
import { localIdentity, openRoom, rememberName, type Room, type RoomMember } from "@/lib/roomTransport";

/* ─── Board: a 15 x 15 grid with a 52-square shared track. Each colour enters at its own arm of the cross. ─── */
const seg = (c: number, r: number, dc: number, dr: number, n: number): [number, number][] => Array.from({ length: n }, (_, i) => [c + dc * i, r + dr * i]);
const TRACK: [number, number][] = [
  ...seg(1, 6, 1, 0, 5), ...seg(6, 5, 0, -1, 6), ...seg(7, 0, 1, 0, 2), ...seg(8, 1, 0, 1, 5), ...seg(9, 6, 1, 0, 6), ...seg(14, 7, 0, 1, 2),
  ...seg(13, 8, -1, 0, 5), ...seg(8, 9, 0, 1, 6), ...seg(7, 14, -1, 0, 2), ...seg(6, 13, 0, -1, 5), ...seg(5, 8, -1, 0, 6), ...seg(0, 7, 0, -1, 2),
];
const HOME_COL: Record<Seat, [number, number][]> = { 0: seg(1, 7, 1, 0, 5), 1: seg(7, 1, 0, 1, 5), 2: seg(13, 7, -1, 0, 5), 3: seg(7, 13, 0, -1, 5) };
const rot = (p: [number, number], times: number): [number, number] => { let q = p; for (let i = 0; i < times; i++) q = [15 - q[1], q[0]]; return q; };
const BASE0: [number, number][] = [[1.8, 1.8], [4.2, 1.8], [1.8, 4.2], [4.2, 4.2]];
const BASE: Record<Seat, [number, number][]> = { 0: BASE0, 1: BASE0.map(p => rot(p, 1)), 2: BASE0.map(p => rot(p, 2)), 3: BASE0.map(p => rot(p, 3)) };
const BASE_BOX: Record<Seat, [number, number]> = { 0: [0, 0], 1: [9, 0], 2: [9, 9], 3: [0, 9] };
function where(seat: Seat, p: number, index: number): [number, number] {
  if (p === -1) return BASE[seat][index];
  if (p === FINISH) { const q = rot([6.55, 7.5 + (index - 1.5) * 0.34], seat); return q; }
  if (p > 51) { const cell = HOME_COL[seat][p - 52]; return [cell[0] + 0.5, cell[1] + 0.5]; }
  const cell = TRACK[(START[seat] + p) % 52]; return [cell[0] + 0.5, cell[1] + 0.5];
}

type Mode = "cpu" | "pass" | "online";
type Screen = "menu" | "lobby" | "game";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const btn: React.CSSProperties = { justifyContent: "center", padding: "10px 12px" };

interface Props { onFinish?: (points: number) => void; onStart?: () => void; /** open straight into this online room (a challenge from the matatu chat) */ joinCode?: string }

export default function LudoGame({ onFinish, onStart, joinCode }: Props) {
  const me = useMemo<RoomMember>(() => localIdentity(), []);
  const [name, setName] = useState(me.name);
  const [screen, setScreen] = useState<Screen>(joinCode ? "lobby" : "menu");
  const [mode, setMode] = useState<Mode>(joinCode ? "online" : "cpu");
  const [count, setCount] = useState<2 | 3 | 4>(4);
  const [state, setState] = useState<LudoState | null>(null);
  const [code, setCode] = useState(joinCode ?? "");
  const [codeInput, setCodeInput] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [roomStatus, setRoomStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const roomRef = useRef<Room | null>(null);
  const stateRef = useRef<LudoState | null>(null);
  const hostRef = useRef(false);
  const reported = useRef(false);
  stateRef.current = state; hostRef.current = isHost;

  useEffect(() => () => roomRef.current?.leave(), []);

  const broadcast = (next: LudoState) => roomRef.current?.send({ t: "state", state: next });

  /** Apply an action. On a guest phone the host decides; everywhere else it is applied right here. */
  const act = useCallback((action: LudoAction) => {
    const current = stateRef.current; if (!current) return;
    if (roomRef.current && !hostRef.current) { roomRef.current.send({ t: "act", action }); return; }
    const next = reduce(current, action);
    if (next === current) return;
    stateRef.current = next; setState(next);
    if (roomRef.current) broadcast(next);
  }, []);

  /* ── online room plumbing ── */
  const joinRoom = (roomCode: string, host: boolean) => {
    rememberName(name.trim() || me.name);
    const identity: RoomMember = { id: me.id, name: name.trim() || me.name };
    roomRef.current?.leave();
    const room = openRoom(`ludo-${roomCode}`, identity);
    roomRef.current = room; setCode(roomCode); setIsHost(host); hostRef.current = host; setMode("online"); setScreen("lobby");
    room.onStatus(setRoomStatus);
    room.onMembers(list => {
      setMembers(list);
      // someone left in the middle of a game: the computer takes over their seat
      const current = stateRef.current;
      if (hostRef.current && current && current.phase !== "over") {
        const gone = current.seats.filter(seat => seat.kind === "human" && seat.owner && !list.some(member => member.id === seat.owner));
        if (gone.length) {
          const next: LudoState = { ...current, rev: current.rev + 1, seats: current.seats.map(seat => gone.includes(seat) ? { ...seat, kind: "cpu", owner: null, name: `${seat.name} (computer)` } : seat), msg: "A player left. The computer took their seat." };
          stateRef.current = next; setState(next); broadcast(next);
        }
      }
    });
    room.onMessage((msg, from) => {
      if (msg?.t === "state" && !hostRef.current) {
        const incoming = msg.state as LudoState;
        if (!stateRef.current || incoming.rev >= stateRef.current.rev) { stateRef.current = incoming; setState(incoming); setScreen("game"); }
      } else if (msg?.t === "act" && hostRef.current) {
        const current = stateRef.current; if (!current) return;
        const seat = current.seats.find(item => item.seat === current.turn);
        if (!seat || seat.owner !== from.id) return; // only the player whose turn it is can act
        act(msg.action as LudoAction);
      } else if (msg?.t === "need-state" && hostRef.current && stateRef.current) {
        room.send({ t: "state", state: stateRef.current });
      }
    });
    if (!host) window.setTimeout(() => room.send({ t: "need-state" }), 700);
  };
  useEffect(() => { if (joinCode) joinRoom(joinCode.toUpperCase(), false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── starting games ── */
  const seatNames = ["Green", "Yellow", "Red", "Blue"];
  const startOnline = () => {
    const humans = members.slice(0, count);
    const seats: LudoSeat[] = SEATS.slice(0, count).map((seat, i) => humans[i]
      ? { seat, kind: "human", owner: humans[i].id, name: humans[i].name }
      : { seat, kind: "cpu", owner: null, name: `${seatNames[seat]} (computer)` });
    const game = newGame(seats);
    begin(game); broadcast(game);
  };
  const begin = (game: LudoState) => { reported.current = false; onStart?.(); stateRef.current = game; setState(game); setScreen("game"); };

  /* ── who is playing right now? ── */
  const turnSeat = state?.seats.find(item => item.seat === state.turn);
  const online = Boolean(roomRef.current);
  const myTurn = Boolean(state && turnSeat && state.phase !== "over" && turnSeat.kind === "human" && (online ? turnSeat.owner === me.id : true));
  const cpuDrives = Boolean(state && turnSeat && turnSeat.kind === "cpu" && (!online || isHost) && state.phase !== "over");

  // the computer chooses its piece a moment after rolling
  useEffect(() => {
    if (!state || !cpuDrives || state.phase !== "move" || state.roll === null) return;
    const timer = window.setTimeout(() => {
      const pick = computerChoice(state.tokens, state.turn, state.roll!);
      if (pick !== null) act({ type: "move", index: pick });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [state?.rev, cpuDrives]); // eslint-disable-line react-hooks/exhaustive-deps

  // report the score when the game ends
  useEffect(() => {
    if (!state || state.phase !== "over" || reported.current) return;
    reported.current = true;
    const mine = state.seats.filter(item => item.kind === "human" && (online ? item.owner === me.id : true));
    const won = mine.some(item => item.seat === state.winner);
    const home = Math.max(0, ...mine.map(item => state.tokens[item.seat].filter(p => p === FINISH).length));
    onFinish?.(won ? 100 : 10 + home * 10);
    try { navigator.vibrate?.([60, 40, 90]); } catch { /* unsupported */ }
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const movable: number[] = [];
  if (state && state.phase === "move" && myTurn && state.roll !== null) {
    state.tokens[state.turn].forEach((p, i) => { if ((p === -1 && state.roll === 6) || (p !== -1 && p + state.roll! <= FINISH)) movable.push(i); });
  }

  const leave = () => { roomRef.current?.leave(); roomRef.current = null; setIsHost(false); setMembers([]); setState(null); setScreen("menu"); };

  /* ─────────────── screens ─────────────── */
  if (screen === "menu") return <div style={{ display: "grid", gap: 12, alignContent: "start", maxWidth: 520, width: "100%", margin: "0 auto" }}>
    <div style={{ textAlign: "center" }}><div style={{ fontSize: "2.4rem" }}>🎲</div><h3 style={{ margin: "4px 0", fontFamily: "var(--font-display)" }}>Ludo · 2 to 4 players</h3>
      <p style={{ margin: 0, fontSize: ".66rem", color: "var(--muted2)" }}>Roll a 6 to start. Get all four pieces home. Land on a lone piece to send it back (not on stars).</p></div>
    <div>
      <b style={{ fontSize: ".66rem" }}>How many players?</b>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>{([2, 3, 4] as const).map(n => <button key={n} className={count === n ? "btn btn-ready" : "btn btn-ghost"} style={{ ...btn, flex: 1 }} onClick={() => setCount(n)}>{n} players</button>)}</div>
    </div>
    <div style={{ display: "grid", gap: 8 }}>
      <button className="btn btn-go" style={{ ...btn, justifyContent: "flex-start", gap: 10 }} onClick={() => { setMode("cpu"); startLocalWith("cpu"); }}><Bot size={18} /><span style={{ textAlign: "left" }}><b>Play the computer</b><br /><small>You against {count - 1} computer player{count > 2 ? "s" : ""}</small></span></button>
      <button className="btn btn-ready" style={{ ...btn, justifyContent: "flex-start", gap: 10 }} onClick={() => { setMode("pass"); startLocalWith("pass"); }}><Smartphone size={18} /><span style={{ textAlign: "left" }}><b>Pass and play</b><br /><small>Friends take turns on this one phone</small></span></button>
      <button className="btn btn-ghost" style={{ ...btn, justifyContent: "flex-start", gap: 10 }} onClick={() => joinRoom(makeCode(), true)}><Globe2 size={18} /><span style={{ textAlign: "left" }}><b>Online room</b><br /><small>Friends join from their own phones with a code. Missing players are played by the computer.</small></span></button>
    </div>
    <div className="ios-glass" style={{ padding: 10 }}>
      <b style={{ fontSize: ".64rem" }}>Have a code from a friend?</b>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <input className="finput" value={codeInput} maxLength={4} placeholder="CODE" onChange={e => setCodeInput(e.target.value.toUpperCase())} style={{ flex: 1, textAlign: "center", letterSpacing: ".3em", fontWeight: 800 }} />
        <button className="btn btn-go" style={btn} disabled={codeInput.length < 4} onClick={() => joinRoom(codeInput, false)}>Join</button>
      </div>
    </div>
  </div>;

  function startLocalWith(m: Mode) {
    const seats: LudoSeat[] = SEATS.slice(0, count).map(seat => m === "cpu"
      ? { seat, kind: seat === 0 ? "human" : "cpu", owner: null, name: seat === 0 ? (name.trim() || "You") : `${seatNames[seat]} (computer)` }
      : { seat, kind: "human", owner: null, name: `${seatNames[seat]} player` });
    begin(newGame(seats));
  }

  if (screen === "lobby") return <div style={{ display: "grid", gap: 12, alignContent: "start", maxWidth: 520, width: "100%", margin: "0 auto" }}>
    <div style={{ textAlign: "center" }}>
      <small style={{ color: "var(--muted2)" }}>{isHost ? "Share this code with your friends" : "You joined room"}</small>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
        <b style={{ fontSize: "2.2rem", letterSpacing: ".3em", fontFamily: "var(--font-display)", color: "var(--ready)" }}>{code}</b>
        <button className="icon-btn" aria-label="Copy code" onClick={() => { void navigator.clipboard?.writeText(code); toast("Code copied"); }}><Copy size={14} /></button>
      </div>
      <small style={{ color: roomStatus === "live" ? "var(--go)" : "var(--muted2)" }}>{roomStatus === "live" ? "Room is open" : roomStatus === "offline" ? "Cannot reach the room right now" : "Connecting…"}</small>
    </div>
    <div>
      <b style={{ fontSize: ".66rem" }}>Your name</b>
      <input className="finput" value={name} maxLength={18} onChange={e => setName(e.target.value)} style={{ marginTop: 5 }} />
    </div>
    <div className="ios-glass" style={{ padding: 10 }}>
      <b style={{ fontSize: ".66rem", display: "flex", alignItems: "center", gap: 6 }}><Users size={13} /> In the room ({members.length})</b>
      <div style={{ display: "grid", gap: 5, marginTop: 6 }}>{members.map((m, i) => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".7rem" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: SEAT_COLOUR[i % 4] }} />{m.name}{m.id === me.id ? " (you)" : ""}</div>)}</div>
    </div>
    {isHost ? <>
      <div><b style={{ fontSize: ".66rem" }}>Seats at the table</b><div style={{ display: "flex", gap: 8, marginTop: 6 }}>{([2, 3, 4] as const).map(n => <button key={n} className={count === n ? "btn btn-ready" : "btn btn-ghost"} style={{ ...btn, flex: 1 }} onClick={() => setCount(n)}>{n}</button>)}</div>
        <small style={{ color: "var(--muted2)" }}>Empty seats are played by the computer.</small></div>
      <button className="btn btn-go" style={btn} onClick={startOnline}>Start the game ({Math.min(members.length, count)} player{members.length > 1 ? "s" : ""}{members.length < count ? ` + ${count - members.length} computer` : ""})</button>
    </> : <p style={{ textAlign: "center", fontSize: ".7rem", color: "var(--muted2)" }}>Waiting for the host to start…</p>}
    <button className="btn btn-ghost" style={btn} onClick={leave}>Leave room</button>
  </div>;

  if (!state) return null;
  const home = (seat: Seat) => state.tokens[seat].filter(p => p === FINISH).length;
  const diceOpen = state.phase === "roll" && (myTurn || cpuDrives);

  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {state.seats.map(item => <motion.div key={item.seat} animate={{ scale: state.turn === item.seat && state.phase !== "over" ? 1.06 : 1 }} style={{ padding: "5px 10px", borderRadius: 99, fontSize: ".6rem", fontWeight: 700, background: state.turn === item.seat ? `${SEAT_COLOUR[item.seat]}33` : "rgba(255,255,255,.04)", border: `1.5px solid ${state.turn === item.seat ? SEAT_COLOUR[item.seat] : "var(--border)"}`, color: SEAT_COLOUR[item.seat] }}>
        {item.name.length > 16 ? item.name.slice(0, 15) + "…" : item.name} · {home(item.seat)}/4
      </motion.div>)}
    </div>
    <p aria-live="polite" style={{ margin: 0, minHeight: 32, textAlign: "center", fontSize: ".74rem", fontWeight: 700 }}>{state.msg}</p>
    <svg viewBox="0 0 15 15" style={{ width: "min(100%, calc(100dvh - 250px))", aspectRatio: "1", borderRadius: 14, background: "#0b1020", boxShadow: "0 12px 40px rgba(0,0,0,.5)" }} role="img" aria-label="Ludo board">
      {SEATS.map(seat => { const active = state.seats.some(item => item.seat === seat); const [bx, by] = BASE_BOX[seat]; return <g key={seat}>
        <rect x={bx} y={by} width="6" height="6" fill={SEAT_COLOUR[seat]} opacity={active ? 0.45 : 0.12} />
        <rect x={bx + 1} y={by + 1} width="4" height="4" rx=".7" fill="rgba(255,255,255,.1)" />
      </g>; })}
      {TRACK.map(([c, r], i) => { const owner = SEATS.find(seat => START[seat] === i); return <g key={i}>
        <rect x={c} y={r} width="1" height="1" fill={owner !== undefined ? SEAT_COLOUR[owner] : "#e5e7eb"} stroke="#0b1020" strokeWidth=".06" />
        {SAFE.has(i) && owner === undefined && <text x={c + .5} y={r + .72} textAnchor="middle" fontSize=".7" fill="#9ca3af">★</text>}
      </g>; })}
      {SEATS.map(seat => HOME_COL[seat].map(([c, r], i) => <rect key={`${seat}-${i}`} x={c} y={r} width="1" height="1" fill={SEAT_COLOUR[seat]} stroke="#0b1020" strokeWidth=".06" opacity={.45 + i * .1} />))}
      <polygon points="6,6 9,6 7.5,7.5" fill={SEAT_COLOUR[1]} /><polygon points="9,6 9,9 7.5,7.5" fill={SEAT_COLOUR[2]} /><polygon points="6,9 9,9 7.5,7.5" fill={SEAT_COLOUR[3]} /><polygon points="6,6 6,9 7.5,7.5" fill={SEAT_COLOUR[0]} />
      {state.seats.flatMap(item => state.tokens[item.seat].map((p, i) => {
        const [x, y] = where(item.seat, p, i);
        const canMove = item.seat === state.turn && movable.includes(i);
        return <g key={`${item.seat}${i}`} onClick={() => canMove && act({ type: "move", index: i })} style={{ transform: `translate(${x}px,${y}px)`, transition: "transform .4s cubic-bezier(.34,1.4,.64,1)", cursor: canMove ? "pointer" : "default" }}>
          {canMove && <><circle r=".95" fill="transparent" /><circle r=".62" fill="none" stroke="#fff" strokeWidth=".14"><animate attributeName="r" values=".5;.82;.5" dur=".9s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;.3;1" dur=".9s" repeatCount="indefinite" /></circle></>}
          <circle r={canMove ? .46 : .4} fill={SEAT_COLOUR[item.seat]} stroke={canMove ? "#fff" : "#0b1020"} strokeWidth=".12" />
          <circle r=".16" fill="rgba(255,255,255,.55)" />
        </g>;
      }))}
    </svg>
    {state.phase === "over" && <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 420 }}>
      {!online && <button className="btn btn-go" style={{ ...btn, flex: 1 }} onClick={() => begin(newGame(state.seats.map(s => ({ ...s }))))}>Play again</button>}
      {online && isHost && <button className="btn btn-go" style={{ ...btn, flex: 1 }} onClick={() => begin(newGame(state.seats.map(s => ({ ...s }))) ) } >Play again</button>}
      <button className="btn btn-ghost" style={{ ...btn, flex: 1 }} onClick={leave}>Back to menu</button>
    </div>}
    {state.phase !== "over" && <button className="btn btn-ghost" style={{ ...btn, fontSize: ".6rem" }} onClick={leave}>{online ? "Leave game" : "Quit game"}</button>}
    <DicePopup open={diceOpen} auto={cpuDrives} label={turnSeat?.name} color={SEAT_COLOUR[state.turn]} onRolled={values => act({ type: "rolled", value: values[0] })} />
  </div>;
}
