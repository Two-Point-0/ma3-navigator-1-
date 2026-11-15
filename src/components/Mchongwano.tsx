import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Flag, Mic2, Send, Swords, Trophy, Video, Hand, ThumbsUp, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";
import { ROAST } from "@/data/legalText";

type Match = { id: string; title: string; status: "open" | "scheduled" | "live" | "finished" | "cancelled"; a_id: string; b_id: string | null; a_name: string; b_name: string | null; cur_round: number; rounds_total: number; turn_no: number; phase: string; seconds_left: number; a_round_wins: number; b_round_wins: number; a_total_votes: number; b_total_votes: number; winner_id: string | null; end_reason: string | null; video_room: string; a_ready: boolean; b_ready: boolean };
type Line = { id: number; round_no: number; author_id: string; body: string };
type State = { match: Match; lines: Line[]; votes_a: number; votes_b: number; my_vote: string | null; me: string };
type Lobby = { open: { id: string; title: string; a_id: string; a_name: string }[]; live: { id: string; title: string; a_name: string; b_name: string; cur_round: number; rounds_total: number }[]; mine_waiting: { id: string; title: string; a_name: string; b_name: string; a_ready: boolean; b_ready: boolean; a_id: string; b_id: string }[]; tournaments: { id: string; title: string; starts_at: string | null; status: string; max_players: number; current_round: number; entries: number; registered: boolean; eliminated: boolean; winner: string | null }[]; me: string };

async function call<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
// Video is optional and runs on a free public Jitsi room by default. To use your own video host later, set VITE_VIDEO_HOST in Vercel.
const VIDEO_HOST = (import.meta.env.VITE_VIDEO_HOST as string | undefined) || "meet.jit.si";
const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.max(0, Math.floor(seconds % 60))).padStart(2, "0")}`;

/** Entry point: sign-in check, then the 18+ rules, then the lobby, then the live arena. */
export default function Mchongwano() {
  const { user } = useAuthContext();
  const signedIn = Boolean(user && !user.is_anonymous);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  useEffect(() => { if (!supabase || !signedIn) return; void call<boolean>("has_roast_consent").then(setConsent).catch(() => setConsent(false)); }, [signedIn]);
  if (!supabase) return <p style={{ color: "var(--muted2)", fontSize: ".7rem" }}>Connect Supabase to use live battles.</p>;
  if (!signedIn) return <div className="card" style={{ padding: 14, textAlign: "center" }}><Mic2 size={26} style={{ color: "var(--stop)" }} /><p style={{ fontSize: ".74rem", margin: "8px 0" }}>Sign in with your phone or Google to watch, vote or fight. This stops one person voting a hundred times.</p><Link href="/login"><span className="btn btn-ready" style={{ display: "inline-flex" }}>Sign in</span></Link></div>;
  if (consent === null) return <p style={{ color: "var(--muted2)", fontSize: ".7rem" }}>Checking…</p>;
  if (!consent) return <Terms onDone={() => setConsent(true)} />;
  return matchId ? <Arena id={matchId} onLeave={() => setMatchId(null)} /> : <LobbyView onOpen={setMatchId} />;
}

function Terms({ onDone }: { onDone: () => void }) {
  const [adult, setAdult] = useState(false); const [agree, setAgree] = useState(false); const [name, setName] = useState(""); const [busy, setBusy] = useState(false);
  const accept = async () => { setBusy(true); try { await call("accept_roast_terms", { p_name: name, p_adult: adult }); onDone(); } catch (error) { toast.error((error as Error).message); } setBusy(false); };
  return <div>
    <div className="ios-glass" style={{ padding: 10, marginBottom: 10, fontSize: ".62rem", color: "var(--ready)", lineHeight: 1.5 }}>Roasts are harsh on purpose. Read the rules once before you watch or fight. Draft text, not yet checked by a lawyer.</div>
    {ROAST.map(section => <div key={section.title} style={{ marginBottom: 9 }}><b style={{ fontSize: ".72rem" }}>{section.title}</b>{section.body.map((line, i) => <p key={i} style={{ fontSize: ".64rem", lineHeight: 1.55, color: "var(--muted2)", margin: "3px 0 0" }}>{line}</p>)}</div>)}
    <label style={{ display: "block", marginTop: 10 }}>Your stage name (shown to everyone)<input className="finput" maxLength={24} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Kamau wa Roast" /></label>
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "10px 0 6px", fontSize: ".66rem", lineHeight: 1.45 }}><input type="checkbox" checked={adult} onChange={event => setAdult(event.target.checked)} />I am 18 years or older.</label>
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "0 0 10px", fontSize: ".66rem", lineHeight: 1.45 }}><input type="checkbox" checked={agree} onChange={event => setAgree(event.target.checked)} />I have read the roast rules. I understand roasts can be harsh about looks and body, I take part by choice, and I can press Enough at any time.</label>
    <button className="btn btn-ready" style={{ width: "100%", justifyContent: "center" }} disabled={!adult || !agree || name.trim().length < 2 || busy} onClick={() => void accept()}>I agree · Enter Mchongwano</button>
  </div>;
}

function LobbyView({ onOpen }: { onOpen: (id: string) => void }) {
  const [lobby, setLobby] = useState<Lobby | null>(null); const [title, setTitle] = useState(""); const [admin, setAdmin] = useState(false);
  const [tTitle, setTTitle] = useState(""); const [tWhen, setTWhen] = useState(""); const [tMax, setTMax] = useState("16"); const [showRules, setShowRules] = useState(false);
  const load = useCallback(async () => { try { setLobby(await call<Lobby>("roast_lobby")); } catch (error) { toast.error((error as Error).message); } }, []);
  useEffect(() => { void load(); void call<boolean>("roast_is_admin").then(setAdmin).catch(() => setAdmin(false)); const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer); }, [load]);
  const act = async (fn: () => Promise<unknown>, done?: string) => { try { await fn(); if (done) toast.success(done); await load(); } catch (error) { toast.error((error as Error).message); } };
  if (!lobby) return <p style={{ color: "var(--muted2)", fontSize: ".7rem" }}>Loading the arena…</p>;
  return <div style={{ display: "grid", gap: 12 }}>
    <div className="card" style={{ padding: 11 }}>
      <b style={{ fontSize: ".74rem" }}><Swords size={13} style={{ verticalAlign: -2 }} /> Start a battle</b>
      <p style={{ fontSize: ".6rem", color: "var(--muted2)", margin: "4px 0 8px", lineHeight: 1.45 }}>Post a challenge. The first person to accept is your opponent. 3 rounds, 60 seconds each turn, and the crowd votes.</p>
      <div style={{ display: "flex", gap: 6 }}><input className="finput" maxLength={60} placeholder="Battle title (optional)" value={title} onChange={event => setTitle(event.target.value)} /><button className="btn btn-ready" onClick={() => void act(async () => { const id = await call<string>("roast_create_challenge", { p_title: title }); onOpen(id); })}>Challenge</button></div>
    </div>
    {!!lobby.mine_waiting.length && <div><p className="sec-label">Your scheduled battles</p>{lobby.mine_waiting.map(match => { const mine = lobby.me === match.a_id ? match.a_ready : match.b_ready; return <div key={match.id} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ flex: 1, fontSize: ".68rem" }}><b>{match.a_name}</b> vs <b>{match.b_name}</b><small style={{ display: "block", color: "var(--muted2)" }}>{match.title}</small></span><button className="btn btn-go" disabled={mine} onClick={() => void act(async () => { await call("roast_join_match", { p_match: match.id }); onOpen(match.id); })}>{mine ? "Waiting…" : "I'm ready"}</button><button className="btn btn-ghost" onClick={() => onOpen(match.id)}>Open</button></div>; })}</div>}
    <div><p className="sec-label">Live now ({lobby.live.length})</p>{!lobby.live.length && <small style={{ color: "var(--muted2)" }}>No battle is live right now. Start one above.</small>}{lobby.live.map(match => <button key={match.id} className="card" onClick={() => onOpen(match.id)} style={{ width: "100%", padding: 10, display: "flex", alignItems: "center", gap: 8, marginBottom: 6, color: "var(--white)", textAlign: "left", cursor: "pointer", borderColor: "var(--stop)" }}><span style={{ color: "var(--stop)", fontWeight: 800, fontSize: ".56rem" }}>● LIVE</span><span style={{ flex: 1, fontSize: ".68rem" }}><b>{match.a_name}</b> vs <b>{match.b_name}</b><small style={{ display: "block", color: "var(--muted2)" }}>{match.title} · round {match.cur_round}/{match.rounds_total}</small></span><Eye size={14} /> Watch</button>)}</div>
    <div><p className="sec-label">Waiting for an opponent ({lobby.open.length})</p>{lobby.open.map(match => <div key={match.id} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ flex: 1, fontSize: ".68rem" }}><b>{match.a_name}</b> is looking for a fight<small style={{ display: "block", color: "var(--muted2)" }}>{match.title}</small></span>{match.a_id === lobby.me ? <button className="btn btn-ghost" onClick={() => onOpen(match.id)}>Open</button> : <button className="btn btn-ready" onClick={() => void act(async () => { await call("roast_join_match", { p_match: match.id }); onOpen(match.id); })}><Hand size={12} /> Accept</button>}</div>)}</div>
    <div><p className="sec-label">Tournaments</p>{!lobby.tournaments.length && <small style={{ color: "var(--muted2)" }}>No tournament is open yet.</small>}{lobby.tournaments.map(t => <div key={t.id} className="card" style={{ padding: 10, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Trophy size={15} style={{ color: "var(--ready)" }} /><span style={{ flex: 1, fontSize: ".7rem" }}><b>{t.title}</b><small style={{ display: "block", color: "var(--muted2)" }}>{t.status === "open" ? "Registration open" : t.status === "running" ? `Round ${t.current_round}` : "Finished"} · {t.entries}/{t.max_players} fighters{t.starts_at ? ` · ${new Date(t.starts_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}` : ""}</small></span>
        {t.status === "open" && (t.registered ? <button className="btn btn-ghost" onClick={() => void act(() => call("roast_unregister", { p_tournament: t.id }), "You left the tournament")}>Leave</button> : <button className="btn btn-ready" onClick={() => void act(() => call("roast_register", { p_tournament: t.id }), "You are registered!")}>Register</button>)}
        {t.status === "running" && t.registered && <small style={{ color: t.eliminated ? "var(--stop)" : "var(--go)", fontWeight: 700 }}>{t.eliminated ? "Out" : "Still in"}</small>}</div>
      {t.winner && <small style={{ color: "var(--go)" }}>Champion: {t.winner}</small>}
      {admin && t.status !== "finished" && <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => void act(async () => { const n = await call<number>("roast_admin_next_round", { p_tournament: t.id }); toast.success(`${n} battle(s) scheduled. Fighters press I'm ready.`); })}>Admin: pair the next round</button>}
    </div>)}</div>
    {admin && <div className="card" style={{ padding: 10 }}><b style={{ fontSize: ".7rem" }}>Admin: create a tournament</b>
      <input className="finput" style={{ margin: "6px 0" }} placeholder="Title" value={tTitle} onChange={event => setTTitle(event.target.value)} />
      <div style={{ display: "flex", gap: 6 }}><input className="finput" type="datetime-local" value={tWhen} onChange={event => setTWhen(event.target.value)} /><input className="finput" style={{ width: 70 }} type="number" min={2} max={64} value={tMax} onChange={event => setTMax(event.target.value)} /></div>
      <button className="btn btn-ready" style={{ marginTop: 6 }} disabled={tTitle.trim().length < 3} onClick={() => void act(async () => { await call("roast_admin_create_tournament", { p_title: tTitle, p_starts: tWhen ? new Date(tWhen).toISOString() : null, p_max: Number(tMax) || 16 }); setTTitle(""); }, "Tournament created")}><Plus size={12} /> Create</button></div>}
    <button className="btn btn-ghost" onClick={() => setShowRules(value => !value)}>{showRules ? "Hide" : "Read"} the roast rules</button>
    {showRules && ROAST.map(section => <div key={section.title}><b style={{ fontSize: ".68rem" }}>{section.title}</b>{section.body.map((line, i) => <p key={i} style={{ fontSize: ".62rem", lineHeight: 1.5, color: "var(--muted2)", margin: "2px 0 6px" }}>{line}</p>)}</div>)}
  </div>;
}

function Arena({ id, onLeave }: { id: string; onLeave: () => void }) {
  const [state, setState] = useState<State | null>(null); const [error, setError] = useState(""); const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now()); const fetchedAt = useRef(Date.now()); const [viewers, setViewers] = useState(1); const [video, setVideo] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => { try { const next = await call<State>("roast_state", { p_match: id }); fetchedAt.current = Date.now(); setState(next); setError(""); } catch (caught) { setError((caught as Error).message); } }, [id]);
  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 3000); const clock = window.setInterval(() => setNow(Date.now()), 250);
    const channel = supabase!.channel(`roast-${id}`, { config: { presence: { key: Math.random().toString(36).slice(2) } } });
    channel.on("presence", { event: "sync" }, () => setViewers(Object.keys(channel.presenceState()).length))
      .on("postgres_changes", { event: "*", schema: "public", table: "roast_lines", filter: `match_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "roast_matches", filter: `id=eq.${id}` }, () => void load())
      .subscribe(status => { if (status === "SUBSCRIBED") void channel.track({ at: Date.now() }); });
    return () => { window.clearInterval(poll); window.clearInterval(clock); void supabase!.removeChannel(channel); };
  }, [id, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [state?.lines.length]);
  if (!state) return <div><button className="btn btn-ghost" onClick={onLeave}><ArrowLeft size={12} /> Back</button><p style={{ color: error ? "var(--stop)" : "var(--muted2)", fontSize: ".7rem", marginTop: 10 }}>{error || "Entering the arena…"}</p></div>;
  const m = state.match; const me = state.me; const fighter = me === m.a_id || me === m.b_id;
  const speakerId = m.phase === "a_turn" ? m.a_id : m.phase === "b_turn" ? m.b_id : null;
  const speakerName = speakerId === m.a_id ? m.a_name : m.b_name;
  const left = Math.max(0, m.seconds_left - (now - fetchedAt.current) / 1000);
  const myTurn = m.status === "live" && m.turn_no <= 2 && speakerId === me;
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await load(); } catch (caught) { toast.error((caught as Error).message); } };
  const send = () => { const body = text.trim(); if (!body) return; setText(""); void act(() => call("roast_post_line", { p_match: id, p_body: body })); };
  const total = state.votes_a + state.votes_b; const pctA = total ? Math.round(state.votes_a / total * 100) : 50;
  const winnerName = m.winner_id === m.a_id ? m.a_name : m.winner_id === m.b_id ? m.b_name : null;
  const rounds = Array.from(new Set(state.lines.map(line => line.round_no)));
  const status = m.status === "open" ? "Waiting for an opponent…" : m.status === "scheduled" ? "Waiting for both fighters to press Ready" : m.status === "cancelled" ? "This battle was cancelled" : m.status === "finished" ? (winnerName ? `${winnerName} wins!` : "It's a draw!") : m.turn_no === 3 ? "Final call! Cast your vote" : `${speakerName} is roasting`;
  const videoUrl = `https://${VIDEO_HOST}/Ma3Roast${m.video_room}#config.prejoinPageEnabled=false&config.startWithAudioMuted=${!fighter}&config.startWithVideoMuted=${!fighter}&config.disableDeepLinking=true&userInfo.displayName=${encodeURIComponent(fighter ? (me === m.a_id ? m.a_name : m.b_name ?? "Fighter") : "Viewer")}`;
  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><button className="btn btn-ghost" onClick={onLeave}><ArrowLeft size={12} /> Lobby</button><span style={{ flex: 1 }} /><small style={{ color: "var(--muted2)" }}><Eye size={11} style={{ verticalAlign: -1 }} /> {viewers} watching</small></div>
    <div className="card" style={{ padding: 10, textAlign: "center", borderColor: m.status === "live" ? "var(--stop)" : undefined }}>
      <small style={{ color: "var(--muted2)" }}>{m.title}{m.status === "live" ? ` · Round ${m.cur_round} of ${m.rounds_total}` : ""}</small>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6, margin: "6px 0" }}>
        <b style={{ color: "#4ade80", fontSize: ".82rem" }}>{m.a_name}</b><b style={{ fontSize: "1.1rem" }}>{m.a_round_wins >= 99 ? "W" : m.a_round_wins} : {m.b_round_wins >= 99 ? "W" : m.b_round_wins}</b><b style={{ color: "#f87171", fontSize: ".82rem" }}>{m.b_name ?? "?"}</b>
      </div>
      <b style={{ fontSize: ".74rem", color: m.status === "finished" ? "var(--ready)" : undefined }}>{m.status === "finished" && <Trophy size={13} style={{ verticalAlign: -2 }} />} {status}</b>
      {m.status === "live" && <div style={{ fontSize: "1.3rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>{mmss(left)}</div>}
      {m.status === "finished" && m.end_reason === "conceded" && <small style={{ display: "block", color: "var(--muted2)" }}>A fighter pressed Enough.</small>}
    </div>
    {m.status === "scheduled" && fighter && <button className="btn btn-go" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => void act(() => call("roast_join_match", { p_match: id }))}>I'm ready</button>}
    {m.status === "open" && me === m.a_id && <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => void act(async () => { await call("roast_stop", { p_match: id }); onLeave(); })}>Cancel my challenge</button>}

    {(m.status === "live" || m.status === "finished") && <>
      <div style={{ margin: "10px 0 6px", display: "flex", gap: 6 }}><button className={`btn ${video ? "btn-go" : "btn-ghost"}`} style={{ fontSize: ".6rem", padding: "6px 9px" }} onClick={() => setVideo(value => !value)}><Video size={12} /> {video ? "Hide video" : fighter ? "Go on camera (beta)" : "Watch video (beta)"}</button>
        {fighter && m.status === "live" && <button className="btn btn-ghost" style={{ fontSize: ".6rem", padding: "6px 9px", color: "var(--stop)", borderColor: "var(--stop)" }} onClick={() => { if (window.confirm("Press Enough? The battle ends and your opponent wins.")) void act(() => call("roast_stop", { p_match: id })); }}>Enough · stop</button>}
        <span style={{ flex: 1 }} /><button className="btn btn-ghost" style={{ fontSize: ".6rem", padding: "6px 9px" }} onClick={() => { const reason = window.prompt("What is wrong? (threats, hate, private info…)"); if (reason) void act(async () => { await call("roast_report", { p_match: id, p_reason: reason }); toast.success("Thanks, we will look at it."); }); }}><Flag size={11} /> Report</button></div>
      {video && <div style={{ aspectRatio: "16/10", borderRadius: 12, overflow: "hidden", marginBottom: 8, background: "#000" }}><iframe title="Live video" src={videoUrl} allow="camera; microphone; fullscreen; display-capture; autoplay" style={{ width: "100%", height: "100%", border: 0 }} /></div>}

      <div style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto", padding: "4px 2px" }}>
        {!state.lines.length && <small style={{ color: "var(--muted2)", textAlign: "center", padding: 10 }}>The first roast will appear here.</small>}
        {rounds.map(round => <div key={round}><small style={{ display: "block", textAlign: "center", color: "var(--muted2)", margin: "4px 0" }}>— Round {round} —</small>{state.lines.filter(line => line.round_no === round).map(line => { const isA = line.author_id === m.a_id; return <div key={line.id} style={{ display: "flex", justifyContent: isA ? "flex-start" : "flex-end", marginBottom: 4 }}><div style={{ maxWidth: "82%", padding: "7px 10px", borderRadius: 12, fontSize: ".7rem", lineHeight: 1.45, background: isA ? "rgba(34,197,94,.16)" : "rgba(239,68,68,.16)", border: `1px solid ${isA ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)"}` }}><b style={{ display: "block", fontSize: ".54rem", color: isA ? "#4ade80" : "#f87171" }}>{isA ? m.a_name : m.b_name}</b>{line.body}</div></div>; })}</div>)}
        <div ref={endRef} />
      </div>

      {myTurn && <div style={{ marginTop: 8 }}><textarea className="finput" rows={2} maxLength={280} placeholder="Your roast… (no threats, keep it a joke)" value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}><button className="btn btn-ready" style={{ flex: 1, justifyContent: "center" }} onClick={send} disabled={!text.trim()}><Send size={12} /> Send roast</button><button className="btn btn-ghost" onClick={() => void act(() => call("roast_end_turn", { p_match: id }))}>End my turn</button></div></div>}
      {fighter && m.status === "live" && !myTurn && <p style={{ fontSize: ".62rem", color: "var(--muted2)", textAlign: "center", margin: "8px 0 0" }}>{m.turn_no === 3 ? "The crowd is voting…" : "Listen to your opponent. Your turn is coming."}</p>}

      <div className="card" style={{ padding: 10, marginTop: 10 }}>
        <b style={{ fontSize: ".7rem" }}><ThumbsUp size={12} style={{ verticalAlign: -2 }} /> The crowd decides{m.status === "live" ? ` · round ${m.cur_round}` : ""}</b>
        <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", margin: "8px 0 4px", background: "rgba(255,255,255,.08)" }}><div style={{ width: `${pctA}%`, background: "#22c55e", transition: "width .4s" }} /><div style={{ flex: 1, background: "#ef4444" }} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".6rem", color: "var(--muted2)" }}><span>{m.a_name}: {state.votes_a}</span><span>{state.votes_b} :{m.b_name}</span></div>
        {!fighter && m.status === "live" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          {[{ who: m.a_id, name: m.a_name, colour: "btn-go" }, { who: m.b_id!, name: m.b_name ?? "", colour: "btn-ready" }].map(option => <button key={option.who} className={`btn ${state.my_vote === option.who ? option.colour : "btn-ghost"}`} style={{ justifyContent: "center" }} onClick={() => void act(() => call("roast_vote", { p_match: id, p_for: option.who }))}>{state.my_vote === option.who ? "✓ " : ""}Vote {option.name}</button>)}</div>}
        {!fighter && m.status === "live" && <small style={{ display: "block", color: "var(--muted2)", marginTop: 6, fontSize: ".55rem" }}>Vote any time while you watch. You can change your vote until the round ends. Each round is counted separately.</small>}
        {m.status === "finished" && <small style={{ display: "block", color: "var(--muted2)", marginTop: 6 }}>Final crowd votes: {m.a_name} {m.a_total_votes} · {m.b_name} {m.b_total_votes}</small>}
      </div>
    </>}
    {error && <p role="alert" style={{ color: "var(--stop)", fontSize: ".62rem" }}>{error}</p>}
  </div>;
}
