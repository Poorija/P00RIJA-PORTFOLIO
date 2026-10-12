"use client";

/* Photon Reflex — reaction timer. Click when the panel turns green. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { GameFrame, StatPill, useBestScore, useLang } from "./shared";

type Phase = "idle" | "waiting" | "go" | "done" | "early";

export function ReactionGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("reaction", "low");
  const [last, setLast] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const begin = useCallback(() => {
    setPhase("waiting");
    const delay = 900 + Math.random() * 2600;
    timerRef.current = setTimeout(() => {
      startRef.current = performance.now();
      setPhase("go");
    }, delay);
  }, []);

  const hit = () => {
    if (phase === "idle" || phase === "done" || phase === "early") {
      begin();
      return;
    }
    if (phase === "waiting") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase("early");
      return;
    }
    if (phase === "go") {
      const ms = Math.round(performance.now() - startRef.current);
      setLast(ms);
      submitBest(ms);
      if (ms < 180) {
        try { window.dispatchEvent(new CustomEvent("achieve", { detail: "photon-reflex" })); } catch {}
      }
      setPhase("done");
    }
  };

  const panelStyle = () => {
    switch (phase) {
      case "waiting":
        return { background: "color-mix(in oklch, #f59e0b 22%, transparent)", borderColor: "#f59e0b" };
      case "go":
        return { background: "color-mix(in oklch, #22c55e 26%, transparent)", borderColor: "#22c55e", boxShadow: "0 0 40px -10px #22c55e" };
      case "early":
        return { background: "color-mix(in oklch, var(--destructive) 18%, transparent)", borderColor: "var(--destructive)" };
      default:
        return { background: "var(--surface-1)", borderColor: "var(--border)" };
    }
  };

  const label = () => {
    switch (phase) {
      case "idle": return lang === "fa" ? "برای شروع کلیک کن" : "Click to start";
      case "waiting": return lang === "fa" ? "صبر کن…" : "Wait for green…";
      case "go": return lang === "fa" ? "همین حالا کلیک کن!" : "CLICK NOW!";
      case "early": return lang === "fa" ? "زود بود! 😅 دوباره کلیک کن" : "Too early! 😅 click to retry";
      case "done": return lang === "fa" ? `${last} میلی‌ثانیه — برای شروع دوباره کلیک کن` : `${last} ms — click to go again`;
    }
  };

  return (
    <GameFrame
      accent="var(--chart-4, #38bdf8)"
      icon={<Zap className="h-4 w-4" />}
      title={lang === "fa" ? "واکنش فوتونی" : "Photon Reflex"}
      subtitle={lang === "fa" ? "وقتی سبز شد سریع کلیک کن" : "Click the instant the panel turns green"}
      best={best}
      bestLabel={lang === "fa" ? "بهترین زمان" : "Best time"}
      footer={
        <div className="flex gap-2">
          <StatPill label={lang === "fa" ? "آخرین" : "Last"} value={last !== null ? `${last}ms` : "—"} accent="var(--chart-4, #38bdf8)" />
          <StatPill label={lang === "fa" ? "بهترین" : "Best"} value={best !== null ? `${best}ms` : "—"} accent="#22c55e" />
        </div>
      }
    >
      <button
        onClick={hit}
        data-cursor-hover
        className="grid h-44 w-full select-none place-items-center rounded-xl border-2 transition-all duration-150"
        style={panelStyle()}
      >
        <span className="font-mono text-sm font-bold text-foreground">{label()}</span>
      </button>
    </GameFrame>
  );
}
