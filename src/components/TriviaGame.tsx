import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Trophy } from "lucide-react";
import { KENYA_TRIVIA } from "@/data/kenyaTrivia";

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

  useEffect(() => {
    let cancelled = false;
    if (topic === "kenya") {
      const picked = [...KENYA_TRIVIA].sort(() => Math.random() - 0.5).slice(0, 5).map(row => ({ question: row.question, correct: row.correct, answers: [...row.wrong, row.correct].sort(() => Math.random() - 0.5) }));
      setLoading(false); setMessage(""); setQuestions(picked); setIndex(0); setScore(0); setAnswer(null);
      return;
    }
    const lastFetch = Number(localStorage.getItem("ma3_trivia_last_fetch") || 0);
    const waitMs = Math.max(0, 5000 - (Date.now() - lastFetch));
    setLoading(true); setMessage(""); setQuestions([]); setIndex(0); setScore(0); setAnswer(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          localStorage.setItem("ma3_trivia_last_fetch", String(Date.now()));
          const response = await fetch("https://opentdb.com/api.php?amount=5&type=multiple&encode=url3986");
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
  }, [round, topic]);

  useEffect(() => { finished.current = false; if (questions.length > 0) onStart?.(); }, [questions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (questions.length > 0 && index >= questions.length && !finished.current) { finished.current = true; onFinish?.(score, questions.length); } }, [index, questions.length, score]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = questions[index];
  return <>
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><button className={`pill ${topic === "kenya" ? "on" : ""}`} onClick={() => setTopic("kenya")}>Kenya</button><button className={`pill ${topic === "world" ? "on" : ""}`} onClick={() => setTopic("world")}>World</button></div>
    {loading && <p style={{ padding: 14, textAlign: "center", color: "var(--muted2)", fontSize: ".66rem" }}><LoaderCircle size={14} /> Loading a five-question round…</p>}
    {message && <div className="ios-glass" style={{ padding: 11, fontSize: ".65rem", color: "var(--muted2)" }}>{message}<button className="btn btn-ghost" style={{ display: "flex", marginTop: 8 }} onClick={() => setRound(value => value + 1)}>Try again</button></div>}
    {current && <div className="ios-glass" style={{ padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9, color: "var(--muted2)", fontSize: ".59rem" }}><span>Question {index + 1} of {questions.length}</span><span>Score {score}</span></div><b style={{ fontSize: ".78rem", lineHeight: 1.5 }}>{current.question}</b><div style={{ display: "grid", gap: 6, marginTop: 10 }}>{current.answers.map(option => <button key={option} className="card" disabled={!!answer} onClick={() => { setAnswer(option); if (option === current.correct) setScore(value => value + 1); }} style={{ padding: 9, color: option === current.correct && answer ? "var(--go)" : option === answer ? "var(--stop)" : "var(--white)", textAlign: "left", cursor: answer ? "default" : "pointer" }}>{option}</button>)}</div>{answer && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}><small style={{ color: answer === current.correct ? "var(--go)" : "var(--stop)" }}>{answer === current.correct ? "Correct" : `Answer: ${current.correct}`}</small><button className="btn btn-ready" style={{ padding: "7px 10px" }} onClick={() => { setIndex(value => value + 1); setAnswer(null); }}>Next question</button></div>}</div>}
    {!loading && !message && questions.length > 0 && !current && <div className="ios-glass" style={{ padding: 14, textAlign: "center" }}><Trophy size={24} style={{ color: "var(--ready)", margin: "0 auto 6px" }} /><b style={{ display: "block" }}>Round complete · {score}/{questions.length}</b><button className="btn btn-ready" style={{ marginTop: 10 }} onClick={() => setRound(value => value + 1)}>Play again</button></div>}
    <small style={{ display: "block", color: "var(--muted2)", fontSize: ".53rem", lineHeight: 1.4, marginTop: 9 }}>Questions from Open Trivia Database; used under CC BY-SA 4.0. One request is made when you open Trivia, not during initial app load.</small>
  </>;
}
