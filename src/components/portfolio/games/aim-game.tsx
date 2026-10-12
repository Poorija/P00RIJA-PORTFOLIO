"use client";

/* Aim Trainer — pop 20 glowing targets as fast as possible. */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Crosshair } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const TARGETS = 20;
const AREA_H = 240;

export function AimGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("aim", "low");
  const [running, setRunning] = useState(false);
  const [hits, setHits] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const areaRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef(0);

  const spawn = useCallback(() => {
    setPos({ x: 12 + Math.random() * 76, y: 12 + Math.random() * 76 });
  }, []);

  const start = useCallback(() => {
    setHits(0);
    setElapsed(0);
    setRunning(true);
    startedAtRef.current = performance.now();
    spawn();
  }, [spawn]);

  useEffect(() => {
    if (!running || hits < TARGETS) return;
    setRunning(false);
    const ms = Math.round(performance.now() - startedAtRef.current);
    setElapsed(ms);
    submitBest(ms);
    if (ms < 12_000) fireAchievement("sharp-shooter");
  }, [hits, running, submitBest]);

  const hit = () => {
    if (!running) return;
    setHits((h) => h + 1);
    spawn();
  };

  return (
    <GameFrame
      accent="var(--gfx-1)"
      icon={<Crosshair className="h-4 w-4" />}
      title={lang === "fa" ? "تیربار هدف" : "Aim Trainer"}
      subtitle={lang === "fa" ? `${TARGETS} هدف درخشان را در کمترین زمان بزن` : `Pop ${TARGETS} glowing targets as fast as you can`}
      best={best}
      bestLabel={lang === "fa" ? "بهترین زمان" : "Best time"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "هدف" : "Hits"} value={`${hits}/${TARGETS}`} accent="var(--gfx-1)" />
            <StatPill label={lang === "fa" ? "زمان" : "Time"} value={elapsed ? `${(elapsed / 1000).toFixed(1)}s` : "—"} />
          </div>
          {(!running || hits >= TARGETS) && (
            <PlayButton accent="var(--gfx-1)" onClick={start}>
              {hits >= TARGETS ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div
        ref={areaRef}
        className="relative w-full overflow-hidden rounded-xl border border-border"
        style={{
          height: AREA_H,
          background:
            "radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--gfx-1) 8%, transparent), transparent 50%), radial-gradient(circle at 75% 70%, color-mix(in oklch, var(--ai-1) 8%, transparent), transparent 50%), var(--surface-1)",
        }}
      >
        {running ? (
          <motion.button
            key={hits}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            onClick={hit}
            className="absolute h-12 w-12 rounded-full"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              translate: "-50% -50%",
              background: "radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--gfx-1) 90%, white), var(--gfx-1) 60%, color-mix(in oklch, var(--gfx-1) 50%, transparent))",
              boxShadow: "0 0 30px -4px var(--gfx-1)",
              cursor: "crosshair",
            }}
            aria-label={lang === "fa" ? "هدف" : "target"}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            {hits >= TARGETS
              ? (lang === "fa" ? `> تمام شد در ${(elapsed / 1000).toFixed(1)} ثانیه! 🏆` : `> done in ${(elapsed / 1000).toFixed(1)}s! 🏆`)
              : (lang === "fa" ? "برای شروع دکمه «شروع» را بزن" : "press Start to begin")}
          </div>
        )}
      </div>
    </GameFrame>
  );
}
