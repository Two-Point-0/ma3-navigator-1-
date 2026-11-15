import { useCallback, useEffect, useState } from "react";
import { Crown, Medal, ShieldCheck, Swords } from "lucide-react";
import { MA3_GTFS } from "@/data/ma3_gtfs";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";

export const KING_ROUTE_KEY = "ma3_king_route";
const KING_MODE_KEY = "ma3_king_mode";
const MEDAL_COLOR: Record<string, string> = { gold: "#f5b301", silver: "#b8c0cc", bronze: "#cd7f32" };
const GAME_NAME: Record<string, string> = { trivia: "Trivia", chess: "Chess", ludo: "Ludo", draughts: "Draughts", memory: "Matatu Match", g2048: "Join 2048", snake: "Matatu Snake", whack: "Whack-a-Matatu" };
type Mode = "normal" | "challenge" | "defend";
type Row = { player: string; total_points: number; games_led: number; medal: string | null; is_you: boolean };
type Crown = { game_id: string; holder: string; is_you: boolean; shield_left_seconds: number; you_can_rematch: boolean };

// A game must be started on the server before its score is accepted (this is the anti-cheat check).
const sessions: Record<string, string> = {};
export async function beginKingGame(game: string) {
  delete sessions[game];
  if (!supabase || !localStorage.getItem(KING_ROUTE_KEY)) return;
  const { data } = await supabase.rpc("start_game_session", { p_game: game });
  if (typeof data === "string") sessions[game] = data;
}

/** Sends a finished game's score. Always returns a message to show the player. */
export async function submitKingScore(game: string, points: number): Promise<{ ok: boolean; message: string }> {
  const route = localStorage.getItem(KING_ROUTE_KEY);
  if (!route || !supabase) return { ok: false, message: "Pick your route in Route King to put this score on the board." };
  const session = sessions[game];
  if (!session) return { ok: false, message: "Sign in and pick a route before you play, so the score can count." };
  delete sessions[game];
  const mode = (localStorage.getItem(KING_MODE_KEY) as Mode) || "normal";
  const { data, error } = await supabase.rpc("submit_route_game_score", { p_route: route, p_game: game, p_points: Math.max(0, Math.min(100, Math.round(points))), p_session: session, p_mode: mode });
  return error ? { ok: false, message: error.message } : { ok: true, message: String(data) };
}

export default function RouteKing({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [route, setRoute] = useState(() => localStorage.getItem(KING_ROUTE_KEY) ?? "");
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(KING_MODE_KEY) as Mode) || "normal");
  const [rows, setRows] = useState<Row[]>([]);
  const [crowns, setCrowns] = useState<Crown[]>([]);
  const load = useCallback(async () => {
    if (!supabase || !signedIn || !route) { setRows([]); setCrowns([]); return; }
    const [board, crownList] = await Promise.all([supabase.rpc("route_king_board", { p_route: route }), supabase.rpc("route_crowns_view", { p_route: route })]);
    setRows((board.data as Row[]) ?? []); setCrowns((crownList.data as Crown[]) ?? []);
  }, [route, signedIn]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const pickMode = (next: Mode) => { setMode(next); localStorage.setItem(KING_MODE_KEY, next); };
  const youHoldACrown = crowns.some(crown => crown.is_you);
  const rematch = crowns.find(crown => crown.you_can_rematch);

  return <div className="ios-glass" style={{ padding: 11, marginBottom: 12 }}>
    <b style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".76rem" }}><Crown size={15} style={{ color: "#f5b301" }} />Route King</b>
    <p style={{ color: "var(--muted2)", fontSize: ".6rem", lineHeight: 1.5, margin: "5px 0 8px" }}>Pick your route, then play. Lead a game on your route to hold its crown. Bronze medal for 1 crown, silver for 2, gold for 3 or more. The board covers 5 days and weekend points count double. A new king is shielded for 15 minutes so they can enjoy the crown. Points have no cash value.</p>
    <select className="finput" value={route} onChange={event => { setRoute(event.target.value); localStorage.setItem(KING_ROUTE_KEY, event.target.value); }}>
      <option value="">Choose your route</option>
      {MA3_GTFS.routes.map(item => <option key={item.id} value={item.id}>{item.sn}</option>)}
    </select>
    {route && signedIn && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
      <button className={`btn ${mode === "normal" ? "btn-ready" : "btn-ghost"}`} style={{ padding: "5px 9px", fontSize: ".58rem" }} onClick={() => pickMode("normal")}>Just play</button>
      <button className={`btn ${mode === "challenge" ? "btn-ready" : "btn-ghost"}`} style={{ padding: "5px 9px", fontSize: ".58rem" }} onClick={() => pickMode("challenge")}><Swords size={11} /> Challenge the king</button>
      {youHoldACrown && <button className={`btn ${mode === "defend" ? "btn-ready" : "btn-ghost"}`} style={{ padding: "5px 9px", fontSize: ".58rem" }} onClick={() => pickMode("defend")}><ShieldCheck size={11} /> Defend my crown</button>}
    </div>}
    {mode === "challenge" && route && <small style={{ display: "block", color: "var(--muted2)", marginTop: 5, lineHeight: 1.4 }}>Your next game is a challenge: beat the king's best single game and you take the crown at once, even during their shield, plus 25 bonus points.</small>}
    {mode === "defend" && route && <small style={{ display: "block", color: "var(--muted2)", marginTop: 5, lineHeight: 1.4 }}>Defend: score 60 or more and you earn 10 bonus points for showing up for your crown.</small>}
    {rematch && <small style={{ display: "block", color: "var(--ready)", marginTop: 5 }}>You lost the {GAME_NAME[rematch.game_id]} crown. You have a rematch open for 24 hours. A win earns a comeback bonus.</small>}
    {!isSupabaseConfigured || !signedIn ? <small style={{ display: "block", marginTop: 7, color: "var(--muted2)" }}>Sign in with Google or phone to join the board.</small>
      : route && rows.length === 0 ? <small style={{ display: "block", marginTop: 7, color: "var(--muted2)" }}>Nobody has played this route this week. Play a game to become its first king.</small>
      : <>
        {crowns.length > 0 && <div style={{ display: "grid", gap: 4, marginTop: 8 }}>{crowns.map(crown => <div key={crown.game_id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".62rem", color: "var(--muted2)" }}><span><Crown size={11} style={{ color: "#f5b301", verticalAlign: "-1px" }} /> {GAME_NAME[crown.game_id]}: <b style={{ color: "var(--white)" }}>{crown.is_you ? "You" : crown.holder}</b></span><span>{crown.shield_left_seconds > 0 ? `shield ${Math.ceil(crown.shield_left_seconds / 60)} min` : "open to challenge"}</span></div>)}</div>}
        <div style={{ display: "grid", gap: 5, marginTop: 8 }}>{rows.slice(0, 6).map((row, index) => <div key={row.player} className="card" style={{ padding: "7px 9px", display: "flex", alignItems: "center", gap: 8, fontSize: ".68rem", borderColor: row.is_you ? "var(--ready)" : undefined }}>
          <b style={{ width: 18 }}>{index + 1}</b>
          <span style={{ flex: 1 }}>{row.is_you ? "You" : row.player}</span>
          {row.medal && <Medal size={14} style={{ color: MEDAL_COLOR[row.medal] }} aria-label={row.medal} />}
          <b>{Math.round(Number(row.total_points))}</b>
        </div>)}</div>
      </>}
  </div>;
}
