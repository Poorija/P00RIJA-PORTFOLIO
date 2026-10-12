"use client";

/* Asteroid Dodge — pilot through an asteroid belt. Arrows / drag to steer. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Rocket } from "lucide-react";
import { GameFrame, PlayButton, StatPill, useBestScore, useLang, arcadePaused } from "./shared";

const W = 300;
const H = 280;
const SHIP_R = 8;

type Rock = { x: number; y: number; r: number; vy: number; spin: number; a: number };

export function AsteroidGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("asteroid");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    shipX: W / 2,
    targetX: W / 2,
    rocks: [] as Rock[],
    t: 0,
    score: 0,
    left: false,
    right: false,
  });

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

    // starfield
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 24; i++) {
      const y = (st.current.t * 1.4 + i * 47) % H;
      ctx.fillRect((i * 97) % W, y, 1.4, 1.4);
    }

    st.current.rocks.forEach((r) => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.a);
      ctx.strokeStyle = "oklch(0.72 0.05 60)";
      ctx.fillStyle = "oklch(0.4 0.04 60 / 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * Math.PI * 2;
        const rr = r.r * (0.75 + ((k * 37) % 10) / 24);
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // ship (glowing triangle)
    const sx = st.current.shipX;
    const sy = H - 26;
    ctx.fillStyle = "oklch(0.85 0.16 200)";
    ctx.shadowColor = "oklch(0.85 0.16 200)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(sx, sy - SHIP_R);
    ctx.lineTo(sx + SHIP_R * 0.8, sy + SHIP_R);
    ctx.lineTo(sx - SHIP_R * 0.8, sy + SHIP_R);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  const start = useCallback(() => {
    st.current = { shipX: W / 2, targetX: W / 2, rocks: [], t: 0, score: 0, left: false, right: false };
    setScore(0);
    setOver(false);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) {
      draw();
      return;
    }
    let raf = 0;
    const tick = () => {

      if (arcadePaused()) { raf = requestAnimationFrame(tick); return; }
      const s = st.current;
      s.t += 1;

      // steering: keys move target, pointer sets target directly
      if (s.left) s.targetX -= 4.4;
      if (s.right) s.targetX += 4.4;
      s.targetX = Math.max(SHIP_R, Math.min(W - SHIP_R, s.targetX));
      s.shipX += (s.targetX - s.shipX) * 0.22; // smooth easing

      const spawnEvery = Math.max(16, 42 - Math.floor(s.score / 6));
      if (s.t % spawnEvery === 0) {
        s.rocks.push({
          x: 12 + Math.random() * (W - 24),
          y: -12,
          r: 6 + Math.random() * 9,
          vy: 1.6 + Math.random() * 1.6 + s.score * 0.015,
          spin: (Math.random() - 0.5) * 0.1,
          a: Math.random() * Math.PI,
        });
      }
      s.rocks.forEach((r) => {
        r.y += r.vy;
        r.a += r.spin;
      });
      s.rocks = s.rocks.filter((r) => r.y < H + 16);

      // score = distance ticks
      if (s.t % 6 === 0) {
        s.score += 1;
        if (s.t % 30 === 0) {
          setScore(s.score);
          submitBest(s.score);
        }
      }

      // collision
      const sy = H - 26;
      for (const r of s.rocks) {
        const dx = r.x - s.shipX;
        const dy = r.y - sy;
        if (Math.sqrt(dx * dx + dy * dy) < r.r + SHIP_R * 0.72) {
          setRunning(false);
          setOver(true);
          submitBest(s.score);
          return;
        }
      }

      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, draw, submitBest]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); st.current.left = true; }
      if (e.key === "ArrowRight") { e.preventDefault(); st.current.right = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") st.current.left = false;
      if (e.key === "ArrowRight") st.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const pointer = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    st.current.targetX = ((e.clientX - rect.left) / rect.width) * W;
  };

  return (
    <GameFrame
      accent="var(--chart-4, #38bdf8)"
      icon={<Rocket className="h-4 w-4" />}
      title={lang === "fa" ? "فرار از سیارک‌ها" : "Asteroid Dodge"}
      subtitle={lang === "fa" ? "فلش‌ها یا کشیدن انگشت — از کمربند سیارکی بگذر" : "Arrows or drag — survive the belt"}
      best={best}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "مسافت" : "Distance"} value={score} accent="var(--chart-4, #38bdf8)" />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--chart-4, #38bdf8)" onClick={start}>
              {over ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="flex justify-center" dir="ltr">
        <canvas
          ref={canvasRef}
          style={{ width: "min(100%, 300px)", aspectRatio: `${W}/${H}`, touchAction: "none" }}
          className="rounded-xl"
          onPointerMove={(e) => {
            if (running) pointer(e);
          }}
        />
      </div>
      {over && (
        <p className="mt-2 text-center font-mono text-xs text-destructive">
          {lang === "fa" ? `> برخورد! مسافت: ${score}` : `> impact! distance: ${score}`}
        </p>
      )}
    </GameFrame>
  );
}
