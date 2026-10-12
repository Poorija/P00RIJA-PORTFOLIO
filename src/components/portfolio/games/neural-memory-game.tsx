"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Play, Trophy } from "lucide-react";
import { useContent } from "@/lib/content-store";

const BEST_KEY = "nm-best-round";
const NODE_COUNT = 4;

type Phase = "idle" | "watch" | "turn" | "over";

// Section palette colors for the 4 neural nodes.
const NODE_VARS = [
  "var(--ai-1)",
  "var(--ai-2)",
  "var(--ai-3)",
  "color-mix(in oklch, var(--ai-1) 60%, var(--ai-3))",
];

export function NeuralMemoryGame() {
  const a = useContent((st) => st.content.ai);
  const t = useContent((st) => st.t);
  const lang = useContent((st) => st.lang);

  const [sequence, setSequence] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [userIdx, setUserIdx] = useState(0);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(BEST_KEY) || "0");
      if (!Number.isNaN(v)) {
        // defer setState to avoid set-state-in-effect lint warning
        requestAnimationFrame(() => setBest(v));
      }
    } catch {
      // ignore
    }
    return () => clearTimers();
  }, [clearTimers]);

  const playSequence = useCallback(
    (seq: number[]) => {
      clearTimers();
      setPhase("watch");
      setUserIdx(0);
      setActiveIdx(null);
      const speed = Math.max(420, 720 - seq.length * 28);
      const lightOn = Math.round(speed * 0.55);
      const start = 500;
      seq.forEach((node, i) => {
        const base = start + i * speed;
        timersRef.current.push(setTimeout(() => setActiveIdx(node), base));
        timersRef.current.push(setTimeout(() => setActiveIdx(null), base + lightOn));
      });
      timersRef.current.push(
        setTimeout(() => {
          setPhase("turn");
          setUserIdx(0);
        }, start + seq.length * speed)
      );
    },
    [clearTimers]
  );

  const startGame = useCallback(() => {
    clearTimers();
    const first = Math.floor(Math.random() * NODE_COUNT);
    const seq = [first];
    setSequence(seq);
    setRound(1);
    setActiveIdx(null);
    setPhase("idle");
    timersRef.current.push(setTimeout(() => playSequence(seq), 250));
  }, [clearTimers, playSequence]);

  const nextRound = useCallback(
    (seq: number[]) => {
      const next = [...seq, Math.floor(Math.random() * NODE_COUNT)];
      setSequence(next);
      setRound(next.length);
      setPhase("watch");
      timersRef.current.push(setTimeout(() => playSequence(next), 700));
    },
    [playSequence]
  );

  const clickNode = useCallback(
    (idx: number) => {
      if (phase !== "turn") return;
      // brief visual feedback
      setActiveIdx(idx);
      timersRef.current.push(setTimeout(() => setActiveIdx(null), 220));

      if (idx === sequence[userIdx]) {
        const nextUserIdx = userIdx + 1;
        if (nextUserIdx >= sequence.length) {
          // round complete → lock input + record best + advance
          setPhase("watch");
          try { window.dispatchEvent(new CustomEvent("achieve", { detail: "neural-mind" })); } catch {}
          setUserIdx(nextUserIdx);
          const completedRound = sequence.length;
          setBest((prev) => {
            if (completedRound > prev) {
              try {
                localStorage.setItem(BEST_KEY, String(completedRound));
              } catch {
                // ignore
              }
              return completedRound;
            }
            return prev;
          });
          timersRef.current.push(setTimeout(() => nextRound(sequence), 550));
        } else {
          setUserIdx(nextUserIdx);
        }
      } else {
        setPhase("over");
      }
    },
    [phase, sequence, userIdx, nextRound]
  );

  // Keyboard: 1-4 to click nodes during turn, Enter/Space to start when idle/over.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && (phase === "idle" || phase === "over")) {
        e.preventDefault();
        startGame();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= NODE_COUNT) {
        e.preventDefault();
        clickNode(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, startGame, clickNode]);

  const statusText = () => {
    switch (phase) {
      case "idle":
        return t("play");
      case "watch":
        return lang === "fa" ? "تماشا کن" : "WATCH";
      case "turn":
        return lang === "fa" ? "نوبت شما" : "YOUR TURN";
      case "over":
        return lang === "fa" ? "پایان بازی" : "GAME OVER";
    }
  };

  const statusColor = () => {
    switch (phase) {
      case "idle":
        return "var(--muted-foreground)";
      case "watch":
        return "var(--ai-2)";
      case "turn":
        return "var(--ai-1)";
      case "over":
        return "var(--destructive)";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header row — compact */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold" style={{ color: "var(--ai-1)" }}>
            {a.game.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{a.game.subtitle}</p>
        </div>
        <button
          onClick={startGame}
          data-cursor-hover
          className="btn-outline-ai inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
          aria-label={t("newGame")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("newGame")}</span>
        </button>
      </div>

      {/* Node row — horizontal, compact (4 nodes in one row instead of 2×2 grid) */}
      <div className="grid grid-cols-4 gap-2.5">
        {Array.from({ length: NODE_COUNT }, (_, i) => {
          const color = NODE_VARS[i];
          const isActive = activeIdx === i;
          return (
            <button
              key={i}
              onClick={() => clickNode(i)}
              disabled={phase !== "turn"}
              data-cursor-hover
              aria-label={lang === "fa" ? `گره عصبی ${i + 1}` : `Neural node ${i + 1}`}
              className="relative aspect-[4/3] rounded-xl border transition-all duration-150 disabled:cursor-not-allowed"
              style={{
                borderColor: isActive
                  ? color
                  : `color-mix(in oklch, ${color} 30%, transparent)`,
                background: isActive
                  ? `color-mix(in oklch, ${color} 55%, transparent)`
                  : `color-mix(in oklch, ${color} 8%, transparent)`,
                boxShadow: isActive ? `0 0 24px -4px ${color}` : "none",
                transform: isActive ? "scale(1.04)" : "scale(1)",
              }}
            >
              <span
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  background: `radial-gradient(circle at 50% 50%, color-mix(in oklch, ${color} ${isActive ? 70 : 16}%, transparent), transparent 70%)`,
                }}
              />
              <span
                className="relative font-mono text-[10px] uppercase tracking-widest"
                style={{ color: isActive ? "var(--on-accent)" : color }}
              >
                {lang === "fa" ? `گ${i + 1}` : `N${i + 1}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status + stats */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 font-mono text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: statusColor(),
              animation:
                phase === "watch" || phase === "turn"
                  ? "neural-pulse 1.5s ease-in-out infinite"
                  : "none",
            }}
          />
          <span
            className="font-bold uppercase tracking-wider"
            style={{ color: statusColor() }}
          >
            {statusText()}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col items-end">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {lang === "fa" ? "مرحله" : "Round"}
            </span>
            <span className="font-mono text-sm font-bold" style={{ color: "var(--ai-1)" }}>
              {round}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("best")}
            </span>
            <span className="flex items-center gap-1 font-mono text-sm font-bold text-foreground">
              <Trophy className="h-3 w-3" style={{ color: "var(--ai-1)" }} />
              {best}
            </span>
          </div>
        </div>
      </div>

      {(phase === "idle" || phase === "over") && (
        <button
          onClick={startGame}
          data-cursor-hover
          className="btn-solid-ai inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-transform hover:scale-[1.02]"
        >
          <Play className="h-3.5 w-3.5" />
          {phase === "over" ? t("reset") : t("play")}
        </button>
      )}
    </div>
  );
}
