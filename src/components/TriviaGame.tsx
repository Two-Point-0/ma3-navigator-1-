import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Trophy } from "lucide-react";
import { KENYA_TRIVIA } from "@/data/kenyaTrivia";
import { supabase } from "@/lib/supabase";

/** Open Trivia Database categories (free, no key needed). */
const WORLD_CATEGORIES: [number, string][] = [[0, "Any"], [9, "General"], [17, "Science"], [18, "Computers"], [19, "Maths"], [21, "Sports"], [22, "Geography"], [23, "History"], [24, "Politics"], [25, "Art"], [27, "Animals"], [28, "Vehicles"], [12, "Music"], [11, "Film"], [14, "TV"], [15, "Video games"], [20, "Mythology"], [10, "Books"], [26, "Celebrities"], [31, "Anime"]];
const shuffle = <T,>(list: T[]) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

type TriviaQuestion = { question: string; correct: string; answers: string[] };

/** Lazy-loaded; only requests question data after a player opens Trivia. */
export default function TriviaGame({ onFinish, onStart }: { onFinish?: (score: number, total: number) => void; onStart?: () => void }) {
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const finished = useRef(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [round, setRound] = useState(0);
  const [topic, setTopic] = useState<"kenya" | "world">("kenya");
  const [kenyaCat, setKenyaCat] = useState("Kenya mix");
  const [kenyaCats, setKenyaCats] = useState<string[]>(["Kenya mix"]);
  const [worldCat, setWorldCat] = useState(0);
  const [difficulty, setDifficulty] = useState("");

  // Kenya categories live in Supabase (table trivia_questions), so new ones can be added without updating the app.
  useEffect(() => {
    if (!supabase) return;
    void supabase.from("trivia_questions").select("category").eq("active", true).limit(2000).then(({ data }) => {
      const names = Array.from(new Set((data ?? []).map(row => String(row.category)))).sort();
      if (names.length) setKenyaCats(["Kenya mix", ...names]);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (topic === "kenya") {
      setLoading(true); setMessage(""); setQuestions([]); setIndex(0); setScore(0); setAnswer(null);
      void (async () => {
        let rows: { question: string; correct: string; wrong: string[] }[] = [];
        if (supabase) {
          let query = supabase.from("trivia_questions").select("question,correct,wrong").eq("active", true).limit(400);
          if (kenyaCat !== "Kenya mix") query = query.eq("category", kenyaCat);
          if (difficulty) query = query.eq("difficulty", difficulty);
          const { data } = await query;
          rows = (data ?? []) as typeof rows;
        }
        if (rows.length < 5) rows = KENYA_TRIVIA; // offline or empty table: use the small built-in bank
        if (cancelled) return;
        setQuestions(shuffle(rows).slice(0, 5).map(row => ({ question: row.question, correct: row.correct, answers: shuffle([...row.wrong, row.correct]) })));
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }
    const lastFetch = Number(localStorage.getItem("ma3_trivia_last_fetch") || 0);
    const waitMs = Math.max(0, 5000 - (Date.now() - lastFetch));
    setLoading(true); setMessage(""); setQuestions([]); setIndex(0); setScore(0); setAnswer(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          localStorage.setItem("ma3_trivia_last_fetch", String(Date.now()));
          const response = await fetch(`https://opentdb.com/api.php?amount=5&type=multiple&encode=url3986${worldCat ? `&category=${worldCat}` : ""}${difficulty ? `&difficulty=${difficulty}` : ""}`);
          if (!response.ok) throw new Error("Trivia questions are temporarily unavailable.");
          const payload = await response.json() as { response_code: number; results: { question: string; correct_answer: string; incorrect_answers: string[] }[] };
          if (payload.response_code !== 0 || !payload.results?.length) throw new Error("No trivia questions were returned. Try again shortly.");
          const decode = (text: string) => { try { return decodeURIComponent(text); } catch { return text; } };
          const loaded = payload.results.map(row => {
            const correct = decode(row.correct_answer);
            const answers = [...row.incorrect_answers.map(decode), correct];
            for (let i = answers.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [answers[i], answers[j]] = [answers[j], answers[i]]; }
            return { question: decode(row.question), correct, answers };
          });
          if (!cancelled) setQuestions(loaded);
        } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load this trivia round."); }
        finally { if (!cancelled) setLoading(false); }
      })();
    }, waitMs);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [round, topic, kenyaCat, worldCat, difficulty]);

  useEffect(() => { finished.current = false; if (questions.length > 0) onStart?.(); }, [questions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (questions.length > 0 && index >= questions.length && !finished.current) { finished.current = true; onFinish?.(score, questions.length); } }, [index, questions.length, score]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = questions[index];
  return <>
    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}><button className={`pill ${topic === "kenya" ? "on" : ""}`} onClick={() => setTopic("kenya")}>Kenya</button><button className={`pill ${topic === "world" ? "on" : ""}`} onClick={() => setTopic("world")}>World</button></div>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 4 }}>
      {topic === "kenya" ? kenyaCats.map(name => <button key={name} className={`pill ${kenyaCat === name ? "on" : ""}`} style={{ flexShrink: 0 }} onClick={() => setKenyaCat(name)}>{name}</button>)
        : WORLD_CATEGORIES.map(([id, name]) => <button key={id} className={`pill ${worldCat === id ? "on" : ""}`} style={{ flexShrink: 0 }} onClick={() => setWorldCat(id)}>{name}</button>)}
    </div>
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>{[["", "Any level"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]].map(([id, name]) => <button key={id} className={`pill ${difficulty === id ? "on" : ""}`} onClick={() => setDifficulty(id)}>{name}</button>)}</div>
    {loading && <p style={{ padding: 14, textAlign: "center", color: "var(--muted2)", fontSize: ".66rem" }}><LoaderCircle size={14} /> Loading a five-question round…</p>}
    {message && <div className="ios-glass" style={{ padding: 11, fontSize: ".65rem", color: "var(--muted2)" }}>{message}<button className="btn btn-ghost" style={{ display: "flex", marginTop: 8 }} onClick={() => setRound(value => value + 1)}>Try again</button></div>}
    {current && <div className="ios-glass" style={{ padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9, color: "var(--muted2)", fontSize: ".59rem" }}><span>Question {index + 1} of {questions.length}</span><span>Score {score}</span></div><b style={{ fontSize: ".78rem", lineHeight: 1.5 }}>{current.question}</b><div style={{ display: "grid", gap: 6, marginTop: 10 }}>{current.answers.map(option => <button key={option} className="card" disabled={!!answer} onClick={() => { setAnswer(option); if (option === current.correct) setScore(value => value + 1); }} style={{ padding: 9, color: option === current.correct && answer ? "var(--go)" : option === answer ? "var(--stop)" : "var(--white)", textAlign: "left", cursor: answer ? "default" : "pointer" }}>{option}</button>)}</div>{answer && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}><small style={{ color: answer === current.correct ? "var(--go)" : "var(--stop)" }}>{answer === current.correct ? "Correct" : `Answer: ${current.correct}`}</small><button className="btn btn-ready" style={{ padding: "7px 10px" }} onClick={() => { setIndex(value => value + 1); setAnswer(null); }}>Next question</button></div>}</div>}
    {!loading && !message && questions.length > 0 && !current && <div className="ios-glass" style={{ padding: 14, textAlign: "center" }}><Trophy size={24} style={{ color: "var(--ready)", margin: "0 auto 6px" }} /><b style={{ display: "block" }}>Round complete · {score}/{questions.length}</b><button className="btn btn-ready" style={{ marginTop: 10 }} onClick={() => setRound(value => value + 1)}>Play again</button></div>}
    <small style={{ display: "block", color: "var(--muted2)", fontSize: ".53rem", lineHeight: 1.4, marginTop: 9 }}>Questions: Open Trivia Database (CC BY-SA 4.0).</small>
  </>;
}
