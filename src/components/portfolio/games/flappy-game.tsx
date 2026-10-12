"use client";

/* Flappy Orb — one-tap gravity dodger through neon gates. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Orbit } from "lucide-react";
import { GameFrame, PlayButton, StatPill, useBestScore, useLang, arcadePaused } from "./shared";

const W = 300;
const H = 260;
const GATE_W = 42;
const GAP = 88;
const R = 7;

type Gate = { x: number; top: number; passed: boolean };

export function FlappyGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("flappy");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({ orbY: H / 2, vy: 0, gates: [] as Gate[], t: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    st.current.gates.forEach((g) => {
      const grad = ctx.createLinearGradient(g.x, 0, g.x + GATE_W, 0);
      grad.addColorStop(0, "oklch(0.7 0.18 300)");
      grad.addColorStop(1, "oklch(0.65 0.18 200)");
      ctx.fillStyle = grad;
      ctx.fillRect(g.x, 0, GATE_W, g.top);
      ctx.fillRect(g.x, g.top + GAP, GATE_W, H - g.top - GAP);
    });

    ctx.fillStyle = "oklch(0.85 0.17 85)";
    ctx.shadowColor = "oklch(0.85 0.17 85)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(70, st.current.orbY, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  const flap = useCallback(() => {
    if (!running) {
      st.current = { orbY: H / 2, vy: -3.4, gates: [], t: 0 };
      setScore(0);
      setOver(false);
      setRunning(true);
      return;
    }
    st.current.vy = -3.4;
  }, [running]);

  useEffect(() => {
    if (!running) {
      draw();
      return;
    }
    let raf = 0;
    const tick = () => {

      if (arcadePaused()) { raf = requestAnimationFrame(tick); return; }
      const s = st.current;
      s.vy += 0.22;
      s.orbY += s.vy;
      s.t += 1;

      if (s.t % 90 === 0) {
        const top = 30 + Math.random() * (H - GAP - 60);
        s.gates.push({ x: W + GATE_W, top, passed: false });
      }
      s.gates.forEach((g) => (g.x -= 2.2));
      s.gates = s.gates.filter((g) => g.x + GATE_W > -4);

      for (const g of s.gates) {
        const inX = 70 + R > g.x && 70 - R < g.x + GATE_W;
        if (inX && (s.orbY - R < g.top || s.orbY + R > g.top + GAP)) {
          setRunning(false);
          setOver(true);
          submitBest(score);
          return;
        }
        if (!g.passed && g.x + GATE_W < 70 - R) {
          g.passed = true;
          setScore((v) => {
            const ns = v + 1;
            submitBest(ns);
            return ns;
          });
        }
      }

      if (s.orbY > H - R || s.orbY < R) {
        setRunning(false);
        setOver(true);
        submitBest(score);
        return;
      }

      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, draw, score, submitBest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  return (
    <GameFrame
      accent="var(--chart-2, #a3e635)"
      icon={<Orbit className="h-4 w-4" />}
      title={lang === "fa" ? "گوی پرنده" : "Flappy Orb"}
      subtitle={lang === "fa" ? "کلیک/لمس/Space برای پرش از دروازه‌ها" : "Click / tap / Space to flap through gates"}
      best={best}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "دروازه" : "Gates"} value={score} accent="var(--chart-2, #a3e635)" />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--chart-2, #a3e635)" onClick={flap}>
              {over ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div
        className="flex justify-center"
        dir="ltr"
        onPointerDown={(e) => {
          e.preventDefault();
          flap();
        }}
        style={{ touchAction: "none", cursor: "pointer" }}
      >
        <canvas ref={canvasRef} style={{ width: "min(100%, 300px)", aspectRatio: `${W}/${H}` }} className="rounded-xl" />
      </div>
      {over && (
        <p className="mt-2 text-center font-mono text-xs text-destructive">
          {lang === "fa" ? `> برخورد! دروازه‌ها: ${score}` : `> crash! gates: ${score}`}
        </p>
      )}
    </GameFrame>
  );
}
