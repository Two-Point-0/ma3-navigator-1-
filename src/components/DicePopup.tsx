import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function Face({ value, size, color }: { value: number; size: number; color: string }) {
  const pip = size / 6.2;
  return <div style={{ width: size, height: size, borderRadius: size * 0.2, background: "linear-gradient(145deg,#fff,#e5e7eb)", position: "relative", boxShadow: `0 10px 30px rgba(0,0,0,.55), 0 0 0 3px ${color}` }}>
    {PIPS[value].map(([x, y], i) => <span key={i} style={{ position: "absolute", width: pip, height: pip, borderRadius: "50%", background: "#111827", left: size * 0.17 + x * size * 0.27 - 0 , top: size * 0.17 + y * size * 0.27 }} />)}
  </div>;
}

interface Props {
  /** Show the dice. They disappear by themselves after the result has been shown. */
  open: boolean;
  /** 1 or 2 dice. */
  count?: 1 | 2;
  /** Who is rolling, e.g. "Your turn" or "Computer". */
  label?: string;
  color?: string;
  /** true = it rolls by itself (computer or another player). false = the player taps the dice. */
  auto?: boolean;
  onRolled: (values: number[]) => void;
}

/** A real dice that pops up in the middle of the game only when a roll is needed. Tap to roll, see the result, it goes away. */
export default function DicePopup({ open, count = 1, label, color = "#f5b301", auto = false, onRolled }: Props) {
  const [phase, setPhase] = useState<"idle" | "rolling" | "result">("idle");
  const [faces, setFaces] = useState<number[]>(() => Array(count).fill(1));
  const timers = useRef<number[]>([]);
  const done = useRef(onRolled);
  done.current = onRolled;

  const clear = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => { if (!open) { clear(); setPhase("idle"); } return clear; }, [open]);

  const roll = () => {
    if (phase !== "idle") return;
    setPhase("rolling");
    try { navigator.vibrate?.(25); } catch { /* not supported */ }
    const finalValues = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
    let ticks = 0;
    const tick = () => {
      ticks++;
      if (ticks < 9) { setFaces(Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6))); timers.current.push(window.setTimeout(tick, 75)); return; }
      setFaces(finalValues); setPhase("result");
      timers.current.push(window.setTimeout(() => { done.current(finalValues); setPhase("idle"); }, 750)); // ready for the next roll even if the dice stay open (a pass, or a six)
    };
    tick();
  };

  // computer / remote players: roll by themselves after a short pause
  useEffect(() => {
    if (!open || !auto || phase !== "idle") return;
    const t = window.setTimeout(roll, 650);
    return () => window.clearTimeout(t);
  }, [open, auto, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const size = count === 2 ? 78 : 96;
  return <AnimatePresence>
    {open && <motion.div key="dice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: .8 }} transition={{ duration: .22 }}
      style={{ position: "absolute", inset: 0, zIndex: 40, display: "grid", placeItems: "center", background: "rgba(2,6,23,.55)", backdropFilter: "blur(3px)", pointerEvents: auto ? "none" : "auto" }}
      onClick={auto ? undefined : roll}>
      <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
        <div style={{ display: "flex", gap: 16 }}>
          {faces.slice(0, count).map((value, i) => (
            <motion.div key={i}
              animate={phase === "rolling" ? { rotate: [0, 140, 290, 360], y: [0, -36, 0, -14, 0], scale: [1, 1.1, 1] } : phase === "result" ? { rotate: 0, y: 0, scale: [1.18, 1] } : { y: [0, -7, 0], rotate: 0 }}
              transition={phase === "rolling" ? { duration: .6, repeat: Infinity } : phase === "result" ? { duration: .3 } : { duration: 1.4, repeat: Infinity }}>
              <Face value={value} size={size} color={color} />
            </motion.div>
          ))}
        </div>
        <motion.b animate={{ opacity: phase === "idle" && !auto ? [0.55, 1, 0.55] : 1 }} transition={{ duration: 1.3, repeat: Infinity }}
          style={{ fontSize: ".8rem", color: "#fff", textShadow: "0 2px 8px #000" }}>
          {phase === "result" ? (count === 2 ? `${faces[0]} + ${faces[1]} = ${faces[0] + faces[1]}` : `${faces[0]}`) : phase === "rolling" ? "Rolling…" : auto ? `${label ?? "Rolling"}…` : `${label ? `${label} · ` : ""}Tap the dice`}
        </motion.b>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
