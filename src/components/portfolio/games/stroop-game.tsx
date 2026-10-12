"use client";

/* Stroop Rush — does the WORD match the INK color? Brain-melting rapid test. */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Palette } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const COLORS = [
  { key: "red", fa: "قرمز", en: "RED", css: "oklch(0.65 0.22 25)" },
  { key: "green", fa: "سبز", en: "GREEN", css: "oklch(0.7 0.19 145)" },
  { key: "blue", fa: "آبی", en: "BLUE", css: "oklch(0.65 0.18 250)" },
  { key: "yellow", fa: "زرد", en: "YELLOW", css: "oklch(0.82 0.16 90)" },
] as const;

type Item = { word: (typeof COLORS)[number]; ink: (typeof COLORS)[number] };

function nextItem(): Item {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)];
  let ink = COLORS[Math.floor(Math.random() * COLORS.length)];
  if (Math.random() < 0.5) ink = word; // 50% matching
  return { word, ink };
}

const ROUND_MS = 25_000;

export function StroopGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("stroop");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [item, setItem] = useState<Item>(() => nextItem());
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const startedAtRef = useRef(0);

  const start = useCallback(() => {
    setScore(0);
    setOver(false);
    setRunning(true);
    setTimeLeft(ROUND_MS);
    setItem(nextItem());
    startedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const left = ROUND_MS - (Date.now() - startedAtRef.current);
      setTimeLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        setRunning(false);
        setOver(true);
        setScore((s) => {
          submitBest(s);
          if (s >= 25) fireAchievement("stroop-master");
          return s;
        });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [running, submitBest]);

  const answer = (colorKey: string) => {
    if (!running) return;
    if (colorKey === item.ink.key) setScore((s) => s + 1);
    else setScore((s) => Math.max(0, s - 1));
    setItem(nextItem());
  };

  return (
    <GameFrame
      accent="var(--gfx-1)"
      icon={<Palette className="h-4 w-4" />}
      title={lang === "fa" ? "استروپ سریع" : "Stroop Rush"}
      subtitle={lang === "fa" ? "رنگِ «جوهر» کلمه را انتخاب کن، نه معنی‌اش را!" : "Pick the INK color of the word, not its meaning!"}
      best={best}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "امتیاز" : "Score"} value={score} accent="var(--gfx-1)" />
            <StatPill label={lang === "fa" ? "زمان" : "Time"} value={`${Math.ceil(timeLeft / 1000)}s`} />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--gfx-1)" onClick={start}>
              {over ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="grid min-h-28 place-items-center rounded-xl border border-border bg-surface-1">
        {running ? (
          <motion.span
            key={`${item.word.key}-${item.ink.key}-${score}`}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="text-4xl font-black tracking-wider"
            style={{ color: item.ink.css }}
          >
            {lang === "fa" ? item.word.fa : item.word.en}
          </motion.span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {over ? (lang === "fa" ? `> امتیاز نهایی: ${score}` : `> final score: ${score}`) : (lang === "fa" ? "آماده‌ای؟" : "ready?")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => answer(c.key)}
            disabled={!running}
            data-cursor-hover
            className="h-11 rounded-xl border font-mono text-[10px] font-bold uppercase tracking-wider text-white transition disabled:opacity-30"
            style={{ background: c.css, borderColor: "transparent" }}
          >
            {lang === "fa" ? c.fa : c.en}
          </button>
        ))}
      </div>
    </GameFrame>
  );
}
