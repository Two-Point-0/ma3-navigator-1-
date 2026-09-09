import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Bus, ShoppingCart, Gamepad2 } from "lucide-react";

const SLIDES = [
  {
    theme: "#dc2626",
    icon: Bus,
    emoji: "🚌",
    keyword: "MOVE",
    title: "Navigate Nairobi like a local",
    bullets: [
      "Search any of 136 real matatu routes by number or name",
      "Plan your journey — see ETA, fares, and any transfers needed",
      "Lock in at your stage so the driver's tout knows you're there",
      "Track NCR commuter rail with live next-departure countdowns",
    ],
  },
  {
    theme: "#d97706",
    icon: ShoppingCart,
    emoji: "🛒",
    keyword: "MARKET",
    title: "Shop smart, stretch your money",
    bullets: [
      "Compare prices across Quickmart, Naivas, and Carrefour instantly",
      "Build a basket and see which store saves you the most",
      "Stay within your budget — get a warning before you overspend",
      "Explore the city's best nyama choma, thrift markets, and food spots on the map",
    ],
  },
  {
    theme: "#16a34a",
    icon: Gamepad2,
    emoji: "🎮",
    keyword: "MIRTH",
    title: "Play, vote, and check the odds",
    bullets: [
      "Challenge a friend to Chess, Ludo, Trivia or Mchongwano",
      "Vote daily for the community's game of the day",
      "Check indicative odds on major fixtures like Barca vs Real Madrid",
      "Tap through to a real betting site to place an actual bet",
    ],
  },
];

const STORAGE_KEY = "ma3_onboarding_done";

interface OnboardingProps {
  onDone: () => void;
}

export default function Onboarding({ onDone }: OnboardingProps) {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);

  const go = (next: number) => {
    setDir(next > slide ? 1 : -1);
    setSlide(next);
  };

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onDone();
  };

  const current = SLIDES[slide];
  const Icon = current.icon;
  const isLast = slide === SLIDES.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "var(--ink)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Skip */}
      <button
        onClick={finish}
        style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font)", fontSize: ".72rem", cursor: "pointer", zIndex: 10 }}
      >
        Skip
      </button>

      {/* Slide content */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={slide}
          custom={dir}
          initial={{ opacity: 0, x: dir * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -dir * 60 }}
          transition={{ duration: 0.32, ease: [0.32, 0, 0.67, 0] }}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 2rem 0" }}
        >
          {/* Big icon circle */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 260 }}
            style={{
              width: 110, height: 110, borderRadius: 32,
              background: `${current.theme}18`,
              border: `2px solid ${current.theme}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "3.2rem", marginBottom: 28,
              boxShadow: `0 0 60px ${current.theme}25`,
            }}
          >
            {current.emoji}
          </motion.div>

          {/* Keyword badge */}
          <div style={{
            padding: "4px 14px", borderRadius: 99,
            background: `${current.theme}18`, border: `1px solid ${current.theme}40`,
            color: current.theme, fontFamily: "var(--font-display)",
            fontSize: ".65rem", fontWeight: 900, letterSpacing: ".2em",
            marginBottom: 12,
          }}>
            {current.keyword}
          </div>

          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 900,
            textAlign: "center", lineHeight: 1.25, marginBottom: 24,
            letterSpacing: "-.01em",
          }}>
            {current.title}
          </h2>

          {/* Bullets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 360 }}>
            {current.bullets.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                  background: `${current.theme}18`, border: `1px solid ${current.theme}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 1,
                }}>
                  <Icon size={11} style={{ color: current.theme }} />
                </div>
                <p style={{ fontSize: ".76rem", color: "var(--muted2)", lineHeight: 1.5, flex: 1 }}>{b}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom controls */}
      <div style={{ padding: "1.5rem 2rem 2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {/* Dots */}
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              style={{
                width: i === slide ? 22 : 7,
                height: 7, borderRadius: 99,
                background: i === slide ? current.theme : "var(--border2)",
                border: "none", cursor: "pointer",
                transition: "all .3s ease",
              }}
            />
          ))}
        </div>

        {/* Next / Get Started */}
        <button
          onClick={isLast ? finish : () => go(slide + 1)}
          style={{
            width: "100%", maxWidth: 360,
            padding: "14px 20px",
            borderRadius: 14,
            background: current.theme,
            border: "none",
            color: slide === 1 ? "#000" : "#fff",
            fontFamily: "var(--font)",
            fontWeight: 800, fontSize: ".9rem",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {isLast ? "Let's Ride 🚌" : "Next"}
          {!isLast && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
}

export function useOnboarding() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setShow(true);
  }, []);
  return { show, finish: () => setShow(false) };
}
