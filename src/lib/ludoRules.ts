// Ludo rules kept separate from the screen so they can be tested.
// Each token has progress p: -1 = in base, 0..51 = on the shared 52-square track, 52..56 = home column, 57 = home (finished).
export const FINISH = 57;
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export type Side = 0 | 1; // 0 = you, 1 = computer
export type Tokens = [number[], number[]];
export const START: Record<Side, number> = { 0: 0, 1: 26 };
export const newTokens = (): Tokens => [[-1, -1, -1, -1], [-1, -1, -1, -1]];
export const square = (side: Side, p: number) => (START[side] + p) % 52;
export function legalMoves(tokens: Tokens, side: Side, roll: number): number[] {
  const out: number[] = [];
  tokens[side].forEach((p, i) => {
    if (p === -1) { if (roll === 6) out.push(i); }
    else if (p + roll <= FINISH) out.push(i);
  });
  return out;
}
/** Moves a token. Returns the new tokens and whether an opponent token was captured. */
export function applyMove(tokens: Tokens, side: Side, index: number, roll: number): { tokens: Tokens; captured: boolean } {
  const next: Tokens = [[...tokens[0]], [...tokens[1]]];
  const p = next[side][index];
  const to = p === -1 ? 0 : p + roll;
  next[side][index] = to;
  let captured = false;
  if (to <= 51) {
    const sq = square(side, to);
    if (!SAFE.has(sq)) {
      const other: Side = side === 0 ? 1 : 0;
      next[other].forEach((q, i) => { if (q >= 0 && q <= 51 && square(other, q) === sq) { next[other][i] = -1; captured = true; } });
    }
  }
  return { tokens: next, captured };
}
export const hasWon = (tokens: Tokens, side: Side) => tokens[side].every(p => p === FINISH);
/** Simple computer choice: capture > finish > leave base > move the furthest token. */
export function computerChoice(tokens: Tokens, roll: number): number | null {
  const options = legalMoves(tokens, 1, roll);
  if (!options.length) return null;
  const score = (i: number) => {
    const { captured } = applyMove(tokens, 1, i, roll);
    const p = tokens[1][i];
    return (captured ? 100 : 0) + (p + roll === FINISH ? 60 : 0) + (p === -1 ? 40 : 0) + p;
  };
  return options.sort((a, b) => score(b) - score(a))[0];
}
