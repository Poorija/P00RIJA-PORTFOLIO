"use client";

/* Photon Whack — neon whack-a-mole. 30 seconds, hit the glowing nodes. */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { GameFrame, PlayButton, StatPill, useBestScore, useLang } from "./shared";

const ROUND_MS = 30_000;
const HOLES = 9;

export function WhackGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("whack");
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const popLoop = useCallback(() => {
    const show = () => {
      setActive(Math.floor(Math.random() * HOLES));
      const life = 650 + Math.random() * 500;
      timersRef.current.push(
        setTimeout(() => {
          setActive((cur) => {
            if (cur !== null) setMisses((m) => m + 1);
            return null;
          });
          timersRef.current.push(setTimeout(show, 180 + Math.random() * 320));
        }, life)
      );
    };
    show();
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setScore(0);
    setMisses(0);
    setTimeLeft(ROUND_MS);
    setRunning(true);
    popLoop();
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const left = ROUND_MS - (Date.now() - startedAt);
      setTimeLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(interval);
        clearTimers();
        setActive(null);
        setRunning(false);
      }
    }, 100);
  }, [clearTimers, popLoop]);

  const hit = (i: number) => {
    if (!running || active !== i) return;
    setActive(null);
    setScore((s) => {
      const ns = s + 1;
      submitBest(ns);
      return ns;
    });
  };

  return (
    <GameFrame
      accent="var(--sec-1)"
      icon={<Target className="h-4 w-4" />}
      title={lang === "fa" ? "موش‌کوب فوتونی" : "Photon Whack"}
      subtitle={lang === "fa" ? "۳۰ ثانیه — گره‌های درخشان را بزن" : "30 seconds — smash the glowing nodes"}
      best={best}
      onReset={running ? undefined : start}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <StatPill label={lang === "fa" ? "امتیاز" : "Score"} value={score} accent="var(--sec-1)" />
            <StatPill label={lang === "fa" ? "خطا" : "Miss"} value={misses} accent="var(--destructive)" />
            <StatPill label={lang === "fa" ? "زمان" : "Time"} value={`${Math.ceil(timeLeft / 1000)}s`} />
          </div>
          {!running && (
            <PlayButton accent="var(--sec-1)" onClick={start}>
              {lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="mx-auto grid max-w-[300px] grid-cols-3 gap-2.5">
        {Array.from({ length: HOLES }, (_, i) => {
          const isActive = active === i;
          return (
            <button
              key={i}
              onClick={() => hit(i)}
              data-cursor-hover
              className="relative aspect-square rounded-2xl border transition-colors duration-100"
              style={{
                borderColor: isActive ? "var(--sec-1)" : "var(--border)",
                background: isActive
                  ? "color-mix(in oklch, var(--sec-1) 22%, transparent)"
                  : "var(--surface-1)",
              }}
            >
              {isActive && (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-2 rounded-xl"
                  style={{
                    background: "radial-gradient(circle at 50% 40%, var(--sec-1), color-mix(in oklch, var(--sec-1) 40%, transparent))",
                    boxShadow: "0 0 26px -4px var(--sec-1)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
      {!running && timeLeft === 0 && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: "var(--sec-1)" }}>
          {lang === "fa" ? `> پایان! امتیاز: ${score}` : `> time! score: ${score}`}
        </p>
      )}
    </GameFrame>
  );
}
