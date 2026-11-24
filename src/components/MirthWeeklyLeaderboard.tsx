import { useEffect, useState } from "react";
import { Medal, Trophy } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type LeaderRow = { game_id: string; player: string; best_score: number; games_played: number };
const GAMES = [
  { id: "overall", label: "Overall" }, { id: "tycoon", label: "Tycoon" }, { id: "chess", label: "Chess" },
  { id: "ludo", label: "Ludo" }, { id: "trivia", label: "Trivia" }, { id: "memory", label: "Matatu Match" },
  { id: "pool", label: "Pool" }, { id: "snake", label: "Matatu Snake" }, { id: "whack", label: "Whack-a-Matatu" },
];
const MEDALS = ["#facc15", "#cbd5e1", "#d97706"];

export default function MirthWeeklyLeaderboard() {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [game, setGame] = useState("overall");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !signedIn) { setRows([]); return; }
    let cancelled = false;
    setLoading(true); setProblem("");
    void supabase.rpc("mirth_weekly_leaderboard", { p_game: game }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setRows([]); setProblem(error.message); }
      else setRows((data ?? []).map((row: LeaderRow) => ({ ...row, best_score: Number(row.best_score), games_played: Number(row.games_played) })));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [game, signedIn]);
  return <section className="ios-glass" style={{ padding: 11, marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Trophy size={14} style={{ color: "var(--ready)" }} /><b style={{ fontSize: ".75rem", flex: 1 }}>Weekly leaderboard</b><small style={{ color: "var(--muted2)", fontSize: ".52rem" }}>last 7 days</small></div>
    <div role="tablist" aria-label="Choose leaderboard" style={{ display: "flex", gap: 5, overflowX: "auto", padding: "8px 0 5px" }}>{GAMES.map(item => <button key={item.id} role="tab" aria-selected={game === item.id} className={`pill ${game === item.id ? "on" : ""}`} onClick={() => setGame(item.id)} style={{ flexShrink: 0, fontSize: ".55rem" }}>{item.label}</button>)}</div>
    {!isSupabaseConfigured || !signedIn ? <p style={{ color: "var(--muted2)", fontSize: ".59rem", lineHeight: 1.45, margin: "6px 0 0" }}>Sign in with Google or phone to read the weekly games board.</p>
      : loading ? <p style={{ color: "var(--muted2)", fontSize: ".59rem", margin: "6px 0 0" }}>Loading weekly scores…</p>
      : problem ? <p style={{ color: "var(--muted2)", fontSize: ".57rem", lineHeight: 1.4, margin: "6px 0 0" }}>Leaderboard setup is pending. Apply the new Mirth Supabase migration first.</p>
      : rows.length === 0 ? <p style={{ color: "var(--muted2)", fontSize: ".59rem", margin: "6px 0 0" }}>No scored games in this seven-day window yet.</p>
      : <div style={{ display: "grid", gap: 5, marginTop: 6 }}>{rows.slice(0, 10).map((row, index) => <div key={`${row.game_id}-${row.player}`} className="card" style={{ padding: "7px 9px", display: "flex", alignItems: "center", gap: 8 }}><b style={{ width: 20, color: index < 3 ? MEDALS[index] : "var(--muted2)" }}>{index + 1}</b>{index < 3 ? <Medal size={13} style={{ color: MEDALS[index] }} /> : null}<span style={{ flex: 1, minWidth: 0, fontSize: ".62rem", overflow: "hidden", textOverflow: "ellipsis" }}>{row.player}</span><small style={{ color: "var(--muted2)", fontSize: ".5rem" }}>{game === "overall" ? row.games_played + " games" : "best"}</small><b style={{ color: "var(--ready)", fontSize: ".67rem" }}>{row.best_score}</b></div>)}</div>}
    <p style={{ color: "var(--muted2)", fontSize: ".52rem", lineHeight: 1.4, margin: "7px 0 0" }}>Scores are non-cash. Overall totals add best scores across games and use pseudonymous or chosen player handles.</p>
  </section>;
}
