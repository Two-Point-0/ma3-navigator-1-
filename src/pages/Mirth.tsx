import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, Trophy, X, ExternalLink, ThumbsUp, Users,
  Gamepad2, Dices, Grid3x3, Brain, MessageSquareQuote,
  Crown, Calendar,
} from "lucide-react";
import { toast } from "sonner";

type MirthTab = "games" | "bet";

interface GameDef {
  id: string;
  name: string;
  Icon: React.ElementType;
  desc: string;
  players: string;
}

const GAMES: GameDef[] = [
  { id: "mchongwano", name: "Mchongwano",   Icon: MessageSquareQuote, desc: "Roast battle in Sheng — crowd judges, clean but merciless.", players: "2 players" },
  { id: "chess",      name: "Chess",        Icon: Crown,              desc: "Classic strategy — outwit your opponent.",                    players: "2 players" },
  { id: "ludo",       name: "Ludo",         Icon: Dices,              desc: "Race your tokens home — roll and move.",                      players: "2-4 players" },
  { id: "trivia",     name: "Trivia",       Icon: Brain,              desc: "General knowledge head-to-head, fastest correct answer wins.", players: "2 players" },
  { id: "monopoly",   name: "Monopoly",     Icon: Grid3x3,            desc: "Buy, build, bankrupt — Nairobi edition board.",               players: "2-4 players" },
];

// Daily community vote — repurposed from the old per-nganya voting mechanism
const DAILY_VOTE_OPTIONS = [
  { id: "v1", label: "Mchongwano", votes: 412 },
  { id: "v2", label: "Chess",      votes: 298 },
  { id: "v3", label: "Trivia",     votes: 351 },
  { id: "v4", label: "Ludo",       votes: 187 },
];

interface Fixture {
  id: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
}

// Real, well-known recurring fixtures — odds shown are illustrative/indicative, NOT live bookmaker feeds
const FIXTURES: Fixture[] = [
  { id: "f1", league: "La Liga",            home: "Barcelona",       away: "Real Madrid",      kickoff: "Sat 20:00", oddsHome: 2.10, oddsDraw: 3.40, oddsAway: 3.20 },
  { id: "f2", league: "Premier League",     home: "Man United",      away: "Liverpool",        kickoff: "Sun 17:30", oddsHome: 2.80, oddsDraw: 3.30, oddsAway: 2.45 },
  { id: "f3", league: "Premier League",     home: "Arsenal",         away: "Chelsea",          kickoff: "Sat 15:00", oddsHome: 2.05, oddsDraw: 3.50, oddsAway: 3.40 },
  { id: "f4", league: "Champions League",   home: "Bayern Munich",   away: "PSG",               kickoff: "Tue 21:00", oddsHome: 1.95, oddsDraw: 3.70, oddsAway: 3.60 },
  { id: "f5", league: "Serie A",            home: "AC Milan",        away: "Inter Milan",      kickoff: "Sun 19:45", oddsHome: 2.60, oddsDraw: 3.20, oddsAway: 2.70 },
];

const BETTING_SITES = [
  { name: "SportPesa", url: "https://www.ke.sportpesa.com" },
  { name: "Betika",    url: "https://www.betika.com" },
  { name: "Odibets",   url: "https://odibets.com" },
];

function VsContainer({
  left, right, leftLabel, rightLabel, leftSub, rightSub, accent = "var(--ready)",
}: {
  left: React.ReactNode; right: React.ReactNode;
  leftLabel: string; rightLabel: string;
  leftSub?: string; rightSub?: string;
  accent?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, position: "relative" }}>
      <div style={{ flex: 1, padding: 14, borderRadius: "14px 0 0 14px", background: "var(--glass)", border: "1px solid var(--border2)", borderRight: "none", textAlign: "center" }}>
        {left}
        <p style={{ fontSize: ".8rem", fontWeight: 800, marginTop: 8 }}>{leftLabel}</p>
        {leftSub && <p style={{ fontSize: ".6rem", color: "var(--muted2)", marginTop: 2 }}>{leftSub}</p>}
      </div>
      <div style={{ width: 42, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 2 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: ".68rem", color: "#000", boxShadow: `0 0 0 4px var(--ink3)` }}>
          VS
        </div>
      </div>
      <div style={{ flex: 1, padding: 14, borderRadius: "0 14px 14px 0", background: "var(--glass)", border: "1px solid var(--border2)", borderLeft: "none", textAlign: "center" }}>
        {right}
        <p style={{ fontSize: ".8rem", fontWeight: 800, marginTop: 8 }}>{rightLabel}</p>
        {rightSub && <p style={{ fontSize: ".6rem", color: "var(--muted2)", marginTop: 2 }}>{rightSub}</p>}
      </div>
    </div>
  );
}

export default function MirthPage() {
  const [tab, setTab] = useState<MirthTab>("games");
  const [selectedGame, setSelectedGame] = useState<GameDef | null>(null);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState(DAILY_VOTE_OPTIONS);
  const [stake] = useState(100);
  const [selFixture, setSelFixture] = useState<Fixture | null>(null);
  const [betSide, setBetSide] = useState<"home" | "draw" | "away" | null>(null);

  const castVote = (id: string) => {
    if (votedFor) return;
    setVotedFor(id);
    setVoteCounts(prev => prev.map(v => v.id === id ? { ...v, votes: v.votes + 1 } : v));
    toast("✅ Vote counted! Check back tomorrow for a new daily pick.");
  };

  const totalVotes = voteCounts.reduce((s, v) => s + v.votes, 0);

  const winAmount = (odds: number) => Math.round(stake * odds);

  return (
    <div className="page-wrap">
      <div className="inner">
        <div style={{ padding: "1rem 0 .8rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Gamepad2 size={17} style={{ color: "var(--ready)" }} />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 900 }}>Mirth</h2>
          </div>
          <p style={{ fontSize: ".6rem", color: "var(--muted2)" }}>Play head-to-head, vote daily, check the odds</p>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["games", "bet"] as MirthTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`mtab ${tab === t ? "on" : ""}`} style={{ flex: 1, justifyContent: "center", padding: "10px 0" }}>
              {t === "games" ? <Swords size={13} /> : <Trophy size={13} />}
              {t === "games" ? "Games" : "Bet"}
            </button>
          ))}
        </div>

        {/* ══════ GAMES TAB ══════ */}
        {tab === "games" && (
          <div>
            {/* Daily Vote */}
            <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: "rgba(217,119,6,.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Calendar size={13} style={{ color: "var(--ready)" }} />
                <p style={{ fontSize: ".74rem", fontWeight: 700 }}>Game of the Day — Vote</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {voteCounts.map(v => {
                  const pct = totalVotes > 0 ? Math.round((v.votes / totalVotes) * 100) : 0;
                  const isVoted = votedFor === v.id;
                  return (
                    <button key={v.id} onClick={() => castVote(v.id)} disabled={!!votedFor}
                      style={{ position: "relative", padding: "8px 12px", borderRadius: 9, background: "rgba(0,0,0,.3)", border: `1px solid ${isVoted ? "rgba(217,119,6,.5)" : "var(--border)"}`, cursor: votedFor ? "default" : "pointer", overflow: "hidden", textAlign: "left" }}>
                      {votedFor && (
                        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: isVoted ? "rgba(217,119,6,.18)" : "rgba(255,255,255,.04)", transition: "width .5s" }} />
                      )}
                      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: ".72rem", fontWeight: 600 }}>{v.label} {isVoted && "✓"}</span>
                        {votedFor && <span style={{ fontSize: ".66rem", fontFamily: "var(--font-mono)", color: "var(--ready)" }}>{pct}%</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {!votedFor && <p style={{ fontSize: ".58rem", color: "var(--muted)", marginTop: 8, textAlign: "center" }}>Tap a game to cast your vote</p>}
            </div>

            <p className="sec-label" style={{ marginBottom: 8 }}>Pick a Game</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GAMES.map(g => {
                const Icon = g.Icon;
                return (
                  <motion.button key={g.id} whileTap={{ scale: 0.98 }} onClick={() => setSelectedGame(g)}
                    className="card" style={{ padding: 13, display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%", cursor: "pointer" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(217,119,6,.1)", border: "1px solid rgba(217,119,6,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={20} style={{ color: "var(--ready)" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: ".82rem", fontWeight: 700 }}>{g.name}</p>
                      <p style={{ fontSize: ".62rem", color: "var(--muted2)", marginTop: 1 }}>{g.desc}</p>
                      <p style={{ fontSize: ".58rem", color: "var(--muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
                        <Users size={9} /> {g.players}
                      </p>
                    </div>
                    <Swords size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════ BET TAB ══════ */}
        {tab === "bet" && (
          <div>
            <div style={{ display: "flex", gap: 7, padding: "8px 11px", borderRadius: 10, background: "rgba(217,119,6,.06)", border: "1px solid rgba(217,119,6,.2)", marginBottom: 14 }}>
              <Trophy size={13} style={{ color: "var(--ready)", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: ".6rem", color: "var(--muted2)", lineHeight: 1.5 }}>
                Odds shown are indicative, not a live bookmaker feed. Tap a fixture to see a KES 100 stake preview, then continue to a real betting site to place an actual bet.
              </p>
            </div>

            <p className="sec-label" style={{ marginBottom: 8 }}>This Week's Fixtures</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {FIXTURES.map(f => (
                <motion.div key={f.id} whileTap={{ scale: 0.98 }} className="card" style={{ padding: 13, cursor: "pointer" }} onClick={() => { setSelFixture(f); setBetSide(null); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span className="chip" style={{ background: "rgba(217,119,6,.1)", color: "var(--ready)", border: "1px solid rgba(217,119,6,.25)" }}>{f.league}</span>
                    <span style={{ fontSize: ".6rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{f.kickoff}</span>
                  </div>
                  <VsContainer
                    left={<div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(220,38,38,.12)", border: "1px solid rgba(220,38,38,.3)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><Trophy size={16} style={{ color: "var(--stop)" }} /></div>}
                    right={<div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(22,163,74,.12)", border: "1px solid rgba(22,163,74,.3)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><Trophy size={16} style={{ color: "var(--go)" }} /></div>}
                    leftLabel={f.home} rightLabel={f.away}
                    leftSub={`Odds ${f.oddsHome.toFixed(2)}`} rightSub={`Odds ${f.oddsAway.toFixed(2)}`}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Game selected — VS matchup launcher */}
      <AnimatePresence>
        {selectedGame && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedGame(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1100, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1101, background: "var(--ink3)", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", padding: "1.2rem 1.2rem 2rem", maxWidth: 640, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <selectedGame.Icon size={18} style={{ color: "var(--ready)" }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 900 }}>{selectedGame.name}</span>
                </div>
                <button onClick={() => setSelectedGame(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <VsContainer
                left={<div style={{ fontSize: "2.2rem" }}>🧑</div>}
                right={<div style={{ fontSize: "2.2rem" }}>🧑‍🤝‍🧑</div>}
                leftLabel="You" rightLabel="Opponent" leftSub="Ready" rightSub="Waiting…"
              />

              <p style={{ fontSize: ".68rem", color: "var(--muted2)", textAlign: "center", margin: "14px 0" }}>{selectedGame.desc}</p>

              <button className="btn btn-primary" style={{ width: "100%", padding: 13, justifyContent: "center" }}
                onClick={() => { toast(`🎮 Matching you with an opponent for ${selectedGame.name}…`); setSelectedGame(null); }}>
                <Swords size={15} /> Find Match
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Fixture selected — odds + stake preview + outbound betting links */}
      <AnimatePresence>
        {selFixture && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelFixture(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1100, backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1101, background: "var(--ink3)", borderRadius: "22px 22px 0 0", border: "1px solid var(--border2)", padding: "1.2rem 1.2rem 2rem", maxHeight: "85vh", overflowY: "auto", maxWidth: 640, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span className="chip" style={{ background: "rgba(217,119,6,.1)", color: "var(--ready)", border: "1px solid rgba(217,119,6,.25)" }}>{selFixture.league}</span>
                <button onClick={() => setSelFixture(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <VsContainer
                left={<div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(220,38,38,.12)", border: "1px solid rgba(220,38,38,.3)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><Trophy size={20} style={{ color: "var(--stop)" }} /></div>}
                right={<div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(22,163,74,.12)", border: "1px solid rgba(22,163,74,.3)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><Trophy size={20} style={{ color: "var(--go)" }} /></div>}
                leftLabel={selFixture.home} rightLabel={selFixture.away}
                leftSub={selFixture.kickoff}
              />

              <p className="sec-label" style={{ margin: "16px 0 8px" }}>Indicative Odds — Pick a side</p>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {([
                  { side: "home" as const, label: selFixture.home, odds: selFixture.oddsHome },
                  { side: "draw" as const, label: "Draw",          odds: selFixture.oddsDraw },
                  { side: "away" as const, label: selFixture.away, odds: selFixture.oddsAway },
                ]).map(o => (
                  <button key={o.side} onClick={() => setBetSide(o.side)}
                    style={{ flex: 1, padding: "10px 6px", borderRadius: 11, border: `1.5px solid ${betSide === o.side ? "rgba(217,119,6,.5)" : "var(--border2)"}`, background: betSide === o.side ? "rgba(217,119,6,.12)" : "var(--glass)", cursor: "pointer", textAlign: "center" }}>
                    <p style={{ fontSize: ".62rem", color: betSide === o.side ? "var(--ready)" : "var(--muted2)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: ".9rem", fontWeight: 800, color: betSide === o.side ? "var(--ready)" : "var(--white)", marginTop: 3 }}>{o.odds.toFixed(2)}</p>
                  </button>
                ))}
              </div>

              {betSide && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="card" style={{ padding: 14, marginBottom: 14, background: "rgba(22,163,74,.06)", borderColor: "rgba(22,163,74,.25)", textAlign: "center" }}>
                  <p style={{ fontSize: ".62rem", color: "var(--muted2)", marginBottom: 4 }}>Stake KES {stake} on {betSide === "draw" ? "Draw" : betSide === "home" ? selFixture.home : selFixture.away}</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 900, color: "var(--go)" }}>
                    Win KES {winAmount(betSide === "home" ? selFixture.oddsHome : betSide === "draw" ? selFixture.oddsDraw : selFixture.oddsAway)}
                  </p>
                  <p style={{ fontSize: ".56rem", color: "var(--muted)", marginTop: 4 }}>Illustrative only — actual payout set by the betting company</p>
                </motion.div>
              )}

              <p className="sec-label" style={{ marginBottom: 8 }}>Place your bet on</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {BETTING_SITES.map(site => (
                  <a key={site.name} href={site.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 12, background: "var(--glass)", border: "1px solid var(--border2)", textDecoration: "none", color: "var(--white)" }}>
                    <span style={{ fontSize: ".8rem", fontWeight: 700 }}>{site.name}</span>
                    <ExternalLink size={14} style={{ color: "var(--ready)" }} />
                  </a>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
