import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";

export type Tier = "any" | "budget" | "standard" | "premium";
type Option = { label: string; lines?: string[]; qty?: number; tier?: Tier };
type Question = { id: string; title: string; hint?: string; multi?: boolean; options: Option[] };

/** 16 quick questions. Every answer only adds lines to the list; nothing is stored unless the shopper saves it. */
const QUESTIONS: Question[] = [
  { id: "people", title: "How many people do you shop for?", options: [{ label: "Just me", qty: 1 }, { label: "2 people", qty: 1 }, { label: "3 to 4 people", qty: 2 }, { label: "5 or more", qty: 3 }] },
  { id: "period", title: "How long should this shopping last?", options: [{ label: "1 week", qty: 1 }, { label: "2 weeks", qty: 2 }, { label: "A month", qty: 3 }] },
  { id: "drink", title: "What do you drink in the morning?", multi: true, options: [{ label: "Tea leaves", lines: ["tea leaves", "sugar 1kg"] }, { label: "Tea bags", lines: ["tea bags", "sugar 1kg"] }, { label: "Coffee", lines: ["instant coffee", "sugar 1kg"] }, { label: "Drinking chocolate", lines: ["drinking chocolate"] }, { label: "Porridge", lines: ["porridge flour"] }] },
  { id: "bread", title: "Bread?", options: [{ label: "White", lines: ["bread white"] }, { label: "Brown", lines: ["bread brown"] }, { label: "Both", lines: ["bread white", "bread brown"] }, { label: "None", lines: [] }] },
  { id: "milk", title: "Milk and dairy?", multi: true, options: [{ label: "Fresh milk", lines: ["fresh milk"] }, { label: "Long-life milk", lines: ["long-life milk"] }, { label: "Yoghurt", lines: ["yoghurt"] }, { label: "Cheese", lines: ["cheese slices"] }, { label: "Butter or margarine", lines: ["margarine"] }] },
  { id: "carbs", title: "What is your main food?", hint: "Pick all you cook often.", multi: true, options: [{ label: "Maize flour (ugali)", lines: ["maize flour 2kg"] }, { label: "Rice", lines: ["rice pishori 2kg"] }, { label: "Wheat flour (chapati)", lines: ["wheat flour 2kg"] }, { label: "Spaghetti or macaroni", lines: ["spaghetti"] }, { label: "Potatoes", lines: ["potatoes"] }] },
  { id: "protein", title: "Which proteins do you buy?", multi: true, options: [{ label: "Beef", lines: ["beef"] }, { label: "Chicken", lines: ["chicken whole"] }, { label: "Fish (tilapia)", lines: ["tilapia"] }, { label: "Eggs", lines: ["eggs"] }, { label: "Beans or ndengu", lines: ["beans 1kg", "green grams"] }, { label: "Sausages or smokies", lines: ["sausages"] }] },
  { id: "fruit", title: "Which fruit do you like?", multi: true, options: [{ label: "Bananas", lines: ["bananas"] }, { label: "Mangoes", lines: ["mangoes"] }, { label: "Oranges", lines: ["oranges"] }, { label: "Watermelon", lines: ["watermelon"] }, { label: "Avocado", lines: ["avocado"] }] },
  { id: "veg", title: "Which vegetables?", multi: true, options: [{ label: "Sukuma wiki", lines: ["sukuma wiki"] }, { label: "Spinach", lines: ["spinach"] }, { label: "Cabbage", lines: ["cabbage"] }, { label: "Carrots", lines: ["carrots"] }, { label: "Tomatoes", lines: ["tomatoes"] }, { label: "Onions", lines: ["onions"] }] },
  { id: "cooking", title: "What do you cook with?", multi: true, options: [{ label: "Cooking oil", lines: ["cooking oil 1L"] }, { label: "Cooking fat", lines: ["cooking fat"] }, { label: "Stock cubes", lines: ["stock cubes"] }, { label: "Curry powder", lines: ["curry powder"] }, { label: "Tomato paste", lines: ["tomato paste"] }, { label: "Salt", lines: ["salt"] }] },
  { id: "fuel", title: "How do you cook?", options: [{ label: "Gas", lines: ["cooking gas refill"] }, { label: "Charcoal", lines: ["charcoal", "matchbox"] }, { label: "Electric or other", lines: [] }] },
  { id: "snacks", title: "Snacks and drinks?", multi: true, options: [{ label: "Biscuits", lines: ["biscuits"] }, { label: "Crisps", lines: ["crisps"] }, { label: "Chocolate", lines: ["chocolate bar"] }, { label: "Sweets", lines: ["sweets"] }, { label: "Soda", lines: ["soda"] }, { label: "Juice", lines: ["juice"] }, { label: "Bottled water", lines: ["bottled water"] }, { label: "Groundnuts", lines: ["groundnuts"] }] },
  { id: "clean", title: "Cleaning at home?", multi: true, options: [{ label: "Washing powder", lines: ["washing powder"] }, { label: "Bar soap", lines: ["bar soap"] }, { label: "Dish soap", lines: ["dish soap"] }, { label: "Bleach", lines: ["bleach"] }, { label: "Toilet paper", lines: ["toilet paper"] }, { label: "Tissues", lines: ["tissue paper"] }] },
  { id: "care", title: "Personal care?", multi: true, options: [{ label: "Toothpaste", lines: ["toothpaste"] }, { label: "Body lotion", lines: ["body lotion"] }, { label: "Shower gel", lines: ["shower gel"] }, { label: "Deodorant", lines: ["deodorant"] }, { label: "Shampoo", lines: ["shampoo"] }, { label: "Petroleum jelly", lines: ["petroleum jelly"] }, { label: "Sanitary pads", lines: ["sanitary pads"] }] },
  { id: "baby", title: "Is there a baby at home?", options: [{ label: "Yes", lines: ["diapers", "baby milk formula", "baby wipes"] }, { label: "No", lines: [] }] },
  { id: "tier", title: "Which brands do you prefer?", hint: "This works for food, soap and cosmetics.", options: [{ label: "Cheapest (budget)", tier: "budget" }, { label: "Popular (standard)", tier: "standard" }, { label: "Top brands (premium)", tier: "premium" }, { label: "No preference", tier: "any" }] },
];
const STAPLE = /^(maize flour|rice|wheat flour|sugar|cooking oil|fresh milk|long-life milk|eggs|bread)/;

export default function BasketBuilder({ onDone }: { onDone: (text: string, tier: Tier) => void }) {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const question = QUESTIONS[step];
  const picked = question ? answers[question.id] ?? [] : [];

  const toggle = (index: number) => setAnswers(current => {
    const old = current[question.id] ?? [];
    const next = question.multi ? (old.includes(index) ? old.filter(i => i !== index) : [...old, index]) : [index];
    return { ...current, [question.id]: next };
  });
  const build = useMemo(() => () => {
    const read = (id: string) => (answers[id] ?? []).map(i => QUESTIONS.find(q => q.id === id)!.options[i]);
    const people = read("people")[0]?.qty ?? 1, period = read("period")[0]?.qty ?? 1;
    const factor = Math.min(6, Math.max(1, Math.ceil(people * period / 1.5)));
    const lines: string[] = [];
    QUESTIONS.forEach(q => read(q.id).forEach(option => option.lines?.forEach(line => lines.push(line))));
    const unique = [...new Set(lines)].map(line => STAPLE.test(line) && factor > 1 ? `${factor} ${line}` : line);
    const tier = read("tier")[0]?.tier ?? "any";
    return { text: unique.join("\n"), tier };
  }, [answers]);

  if (step < 0) return <div style={{ display: "grid", gap: 10 }}>
    <div className="card" style={{ padding: 14 }}>
      <b style={{ display: "flex", gap: 7, alignItems: "center", fontSize: ".8rem" }}><Sparkles size={15} style={{ color: "var(--ready)" }} /> Build a basket for me</b>
      <p style={{ fontSize: ".66rem", lineHeight: 1.55, color: "var(--muted2)", margin: "8px 0 0" }}>Answer {QUESTIONS.length} quick taps, about 2 minutes. Tea or coffee, sausages or smokies, cheap brands or top brands. We build a list that fits you, then show which supermarket sells the whole list cheapest. Skip any question you like.</p>
    </div>
    <button className="btn btn-ready" style={{ justifyContent: "center", padding: 11 }} onClick={() => setStep(0)}>Start <ArrowRight size={14} /></button>
  </div>;

  const last = step === QUESTIONS.length - 1;
  const finish = () => { const { text, tier } = build(); onDone(text, tier); };
  return <div>
    <div style={{ height: 5, borderRadius: 99, background: "var(--glass2)", overflow: "hidden", marginBottom: 10 }}><motion.div animate={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} style={{ height: "100%", background: "var(--ready)" }} /></div>
    <small style={{ color: "var(--muted2)" }}>Question {step + 1} of {QUESTIONS.length}</small>
    <b style={{ display: "block", fontSize: ".82rem", margin: "4px 0 2px" }}>{question.title}</b>
    {(question.hint || question.multi) && <small style={{ color: "var(--muted2)" }}>{question.hint ?? "Pick all that apply."}</small>}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "10px 0 12px" }}>{question.options.map((option, index) => {
      const on = picked.includes(index);
      return <button key={option.label} className={`btn ${on ? "btn-ready" : "btn-ghost"}`} style={{ padding: "8px 12px", fontSize: ".66rem" }} onClick={() => toggle(index)}>{on && <Check size={12} />} {option.label}</button>;
    })}</div>
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={13} /> Back</button>
      <span style={{ flex: 1 }}>{!picked.length && <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => last ? finish() : setStep(step + 1)}>Skip</button>}</span>
      <button className="btn btn-ready" onClick={() => last ? finish() : setStep(step + 1)}>{last ? "Build my basket" : "Next"} <ArrowRight size={13} /></button>
    </div>
  </div>;
}
