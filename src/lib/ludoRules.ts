// Ludo rules for 2 to 4 players, kept separate from the screen so they can be tested.
// Each token has progress p: -1 = in base, 0..51 = on the shared 52-square track, 52..56 = home column, 57 = home (finished).
export const FINISH = 57;
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export type Seat = 0 | 1 | 2 | 3;
export const SEATS: Seat[] = [0, 1, 2, 3];
/** Where each colour enters the shared track: left, top, right, bottom arm of the cross. */
export const START: Record<Seat, number> = { 0: 0, 1: 13, 2: 26, 3: 39 };
export const SEAT_NAME = ["Green", "Yellow", "Red", "Blue"] as const;
export const SEAT_COLOUR = ["#16a34a", "#eab308", "#dc2626", "#2563eb"] as const;
export type Tokens = number[][];

export const newTokens = (active: Seat[]): Tokens => SEATS.map(seat => (active.includes(seat) ? [-1, -1, -1, -1] : []));
export const square = (seat: Seat, p: number) => (START[seat] + p) % 52;

export function legalMoves(tokens: Tokens, seat: Seat, roll: number): number[] {
  const out: number[] = [];
  tokens[seat].forEach((p, i) => {
    if (p === -1) { if (roll === 6) out.push(i); }
    else if (p + roll <= FINISH) out.push(i);
  });
  return out;
}

/** Moves a token. Returns the new tokens and the tokens that were sent back to base (a capture). */
export function applyMove(tokens: Tokens, seat: Seat, index: number, roll: number): { tokens: Tokens; captured: { seat: Seat; index: number }[] } {
  const next = tokens.map(row => [...row]);
  const p = next[seat][index];
  const to = p === -1 ? 0 : p + roll;
  next[seat][index] = to;
  const captured: { seat: Seat; index: number }[] = [];
  if (to <= 51) {
    const sq = square(seat, to);
    if (!SAFE.has(sq)) {
      SEATS.forEach(other => {
        if (other === seat) return;
        next[other].forEach((q, i) => { if (q >= 0 && q <= 51 && square(other, q) === sq) { next[other][i] = -1; captured.push({ seat: other, index: i }); } });
      });
    }
  }
  return { tokens: next, captured };
}

export const hasWon = (tokens: Tokens, seat: Seat) => tokens[seat].length > 0 && tokens[seat].every(p => p === FINISH);
export const nextSeat = (active: Seat[], seat: Seat): Seat => { const i = active.indexOf(seat); return active[(i + 1) % active.length]; };

/** Simple computer choice: capture > finish > leave base > move the furthest token. */
export function computerChoice(tokens: Tokens, seat: Seat, roll: number): number | null {
  const options = legalMoves(tokens, seat, roll);
  if (!options.length) return null;
  const score = (i: number) => {
    const { captured } = applyMove(tokens, seat, i, roll);
    const p = tokens[seat][i];
    return captured.length * 100 + (p + roll === FINISH ? 60 : 0) + (p === -1 ? 40 : 0) + p;
  };
  return options.sort((a, b) => score(b) - score(a))[0];
}

/* ───── The whole game as a state machine, so the same rules run on one phone or between phones ───── */
export interface LudoSeat { seat: Seat; kind: "human" | "cpu"; /** member id of the phone that plays this seat; null = this device */ owner: string | null; name: string }
export interface LudoState {
  seats: LudoSeat[];
  tokens: Tokens;
  turn: Seat;
  phase: "roll" | "move" | "over";
  roll: number | null;
  msg: string;
  winner: Seat | null;
  /** counts every change so other phones can ignore old messages */
  rev: number;
}
export type LudoAction = { type: "rolled"; value: number } | { type: "move"; index: number };

export function newGame(seats: LudoSeat[]): LudoState {
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  const active = sorted.map(item => item.seat);
  return { seats: sorted, tokens: newTokens(active), turn: active[0], phase: "roll", roll: null, msg: `${sorted[0].name} starts. Roll the dice!`, winner: null, rev: 0 };
}
const nameOf = (state: LudoState, seat: Seat) => state.seats.find(item => item.seat === seat)?.name ?? SEAT_NAME[seat];

export function reduce(state: LudoState, action: LudoAction): LudoState {
  const active = state.seats.map(item => item.seat);
  if (state.phase === "over") return state;
  if (action.type === "rolled") {
    if (state.phase !== "roll") return state;
    const moves = legalMoves(state.tokens, state.turn, action.value);
    if (!moves.length) {
      const next = nextSeat(active, state.turn);
      return { ...state, turn: next, phase: "roll", roll: null, rev: state.rev + 1, msg: `${nameOf(state, state.turn)} rolled ${action.value} and cannot move. ${nameOf(state, next)}'s turn.` };
    }
    return { ...state, phase: "move", roll: action.value, rev: state.rev + 1, msg: `${nameOf(state, state.turn)} rolled ${action.value}. Pick a glowing piece.` };
  }
  if (state.phase !== "move" || state.roll === null || !legalMoves(state.tokens, state.turn, state.roll).includes(action.index)) return state;
  const { tokens, captured } = applyMove(state.tokens, state.turn, action.index, state.roll);
  const who = nameOf(state, state.turn);
  if (hasWon(tokens, state.turn)) return { ...state, tokens, phase: "over", winner: state.turn, roll: null, rev: state.rev + 1, msg: `${who} wins! All four pieces are home.` };
  const again = state.roll === 6;
  const turn = again ? state.turn : nextSeat(active, state.turn);
  const hit = captured.length ? ` ${who} sent ${captured.map(c => nameOf(state, c.seat)).join(" and ")} back to base!` : "";
  return { ...state, tokens, turn, phase: "roll", roll: null, rev: state.rev + 1, msg: `${again ? `${who} rolled a six and goes again.` : `${nameOf(state, turn)}'s turn.`}${hit}` };
}
