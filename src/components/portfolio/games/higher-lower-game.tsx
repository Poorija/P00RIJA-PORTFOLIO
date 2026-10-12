"use client";

/* Higher or Lower — guess the next card. Streak scoring with glowing deck. */

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Layers3 } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

function drawCard(exclude?: number): number {
  let v = 1 + Math.floor(Math.random() * 13);
  while (v === exclude) v = 1 + Math.floor(Math.random() * 13);
  return v;
}

const SUITS = ["♠", "♥", "♦", "♣"];

export function HigherLowerGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("highlow");
  const [current, setCurrent] = useState(() => drawCard());
  const [next, setNext] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [over, setOver] = useState(false);
  const [reveal, setReveal] = useState(false);

  const suitFor = (v: number) => SUITS[v % 4];
  const isRed = (v: number) => suitFor(v) === "♥" || suitFor(v) === "♦";

  const guess = useCallback(
    (dir: "higher" | "lower") => {
      if (over || reveal) return;
      setReveal(true);
      const card = drawCard(current);
      setNext(card);
      const ok =
        (dir === "higher" && card > current) ||
        (dir === "lower" && card < current) ||
        card === current; // equal card = generous win
      if (ok) {
        const ns = streak + 1;
        setStreak(ns);
        submitBest(ns);
        if (ns >= 8) fireAchievement("card-oracle");
        setTimeout(() => {
          setCurrent(card);
          setNext(null);
          setReveal(false);
        }, 900);
      } else {
        setOver(true);
      }
    },
    [current, over, reveal, streak, submitBest]
  );

  const reset = useCallback(() => {
    setCurrent(drawCard());
    setNext(null);
    setStreak(0);
    setOver(false);
    setReveal(false);
  }, []);

  const CardFace = ({ value, dim }: { value: number; dim?: boolean }) => (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="grid h-32 w-24 place-items-center rounded-2xl border-2 bg-surface-1"
      style={{
        borderColor: dim ? "var(--border)" : "color-mix(in oklch, var(--gfx-1) 50%, transparent)",
        opacity: dim ? 0.55 : 1,
        boxShadow: dim ? "none" : "0 0 26px -8px var(--gfx-1)",
      }}
    >
      <span className="font-mono text-3xl font-black" style={{ color: isRed(value) ? "var(--destructive)" : "var(--foreground)" }}>
        {value}
      </span>
      <span className="text-xl" style={{ color: isRed(value) ? "var(--destructive)" : "var(--foreground)" }}>
        {suitFor(value)}
      </span>
    </motion.div>
  );

  return (
    <GameFrame
      accent="var(--gfx-1)"
      icon={<Layers3 className="h-4 w-4" />}
      title={lang === "fa" ? "بالاتر یا پایین‌تر" : "Higher or Lower"}
      subtitle={lang === "fa" ? "حدس بزن کارت بعدی بالاتر است یا پایین‌تر" : "Will the next card be higher or lower?"}
      best={best}
      bestLabel={lang === "fa" ? "بهترین زنجیره" : "Best streak"}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "زنجیره" : "Streak"} value={streak} accent="var(--gfx-1)" />
          </div>
          {over && (
            <PlayButton accent="var(--gfx-1)" onClick={reset}>
              {lang === "fa" ? "شروع دوباره" : "Restart"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="flex items-center justify-center gap-6 py-2" dir="ltr">
        <CardFace value={current} />
        {next !== null ? (
          <CardFace value={next} />
        ) : (
          <div
            className="grid h-32 w-24 place-items-center rounded-2xl border-2 border-dashed font-mono text-2xl text-muted-foreground"
            style={{ borderColor: "color-mix(in oklch, var(--gfx-1) 30%, transparent)" }}
          >
            ?
          </div>
        )}
      </div>
      {over ? (
        <p className="text-center font-mono text-xs text-destructive">
          {lang === "fa" ? `> باخت! زنجیره: ${streak}` : `> wrong! streak: ${streak}`}
        </p>
      ) : (
        <div className="mt-2 flex justify-center gap-3">
          <button
            onClick={() => guess("higher")}
            disabled={reveal}
            data-cursor-hover
            className="rounded-xl border border-border bg-surface-1 px-5 py-2 text-sm font-bold text-foreground transition hover:border-[var(--gfx-1)] hover:text-[var(--gfx-1)] disabled:opacity-40"
          >
            ▲ {lang === "fa" ? "بالاتر" : "Higher"}
          </button>
          <button
            onClick={() => guess("lower")}
            disabled={reveal}
            data-cursor-hover
            className="rounded-xl border border-border bg-surface-1 px-5 py-2 text-sm font-bold text-foreground transition hover:border-[var(--gfx-1)] hover:text-[var(--gfx-1)] disabled:opacity-40"
          >
            ▼ {lang === "fa" ? "پایین‌تر" : "Lower"}
          </button>
        </div>
      )}
    </GameFrame>
  );
}
