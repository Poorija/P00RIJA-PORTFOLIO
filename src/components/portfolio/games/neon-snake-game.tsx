"use client";

/* Neon Snake — classic snake on a glowing grid. Arrows / WASD / swipe. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Worm } from "lucide-react";
import { GameFrame, PlayButton, StatPill, useBestScore, useGameKeys, useLang, arcadePaused } from "./shared";

const GRID = 15;
const CELL = 18;
const SIZE = GRID * CELL;
const TICK = 110;

type Pt = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
const DELTA: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function randomFood(body: Pt[]): Pt {
  while (true) {
    const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    if (!body.some((b) => b.x === p.x && b.y === p.y)) return p;
  }
}

export function NeonSnakeGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("snake");
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const bodyRef = useRef<Pt[]>([{ x: 7, y: 7 }]);
  const dirRef = useRef<Dir>("right");
  const nextDirRef = useRef<Dir>("right");
  const foodRef = useRef<Pt>({ x: 11, y: 7 });
  const accRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchRef = useRef<Pt | null>(null);

  const reset = useCallback(() => {
    bodyRef.current = [{ x: 7, y: 7 }];
    dirRef.current = "right";
    nextDirRef.current = "right";
    foodRef.current = randomFood(bodyRef.current);
    accRef.current = 0;
    setScore(0);
    setOver(false);
    setRunning(true);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== SIZE * dpr) {
      canvas.width = SIZE * dpr;
      canvas.height = SIZE * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = "rgba(16,185,129,0.10)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, SIZE);
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(SIZE, i * CELL);
      ctx.stroke();
    }

    const f = foodRef.current;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#f472b6";
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
    ctx.fill();

    const body = bodyRef.current;
    body.forEach((seg, i) => {
      const t = i / Math.max(1, body.length - 1);
      ctx.shadowColor = "rgba(16,185,129,0.8)";
      ctx.shadowBlur = i === 0 ? 12 : 6;
      ctx.fillStyle = i === 0 ? "#34d399" : `rgba(16,185,129,${0.85 - t * 0.55})`;
      const pad = i === 0 ? 1.5 : 2.5;
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 4);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }, []);

  useEffect(() => {
    draw();
  }, [draw, over, running]);

  const step = useCallback(
    (dt: number) => {
      accRef.current += dt;
      if (accRef.current < TICK) return;
      accRef.current -= TICK;

      dirRef.current = nextDirRef.current;
      const d = DELTA[dirRef.current];
      const head = bodyRef.current[0];
      const next: Pt = { x: head.x + d.x, y: head.y + d.y };

      if (
        next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID ||
        bodyRef.current.some((b) => b.x === next.x && b.y === next.y)
      ) {
        setRunning(false);
        setOver(true);
        return;
      }

      bodyRef.current = [next, ...bodyRef.current];
      if (next.x === foodRef.current.x && next.y === foodRef.current.y) {
        foodRef.current = randomFood(bodyRef.current);
        setScore((s) => {
          const ns = s + 1;
          submitBest(ns);
          return ns;
        });
      } else {
        bodyRef.current.pop();
      }
      draw();
    },
    [draw, submitBest]
  );

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {

      if (arcadePaused()) { raf = requestAnimationFrame(tick); return; }
      step(now - last);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, step]);

  useGameKeys(
    (e) => {
      const map: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const dir = map[e.key];
      if (!dir) {
        if ((e.key === "Enter" || e.key === " ") && !running) reset();
        return;
      }
      e.preventDefault();
      const cur = dirRef.current;
      const opposite =
        (cur === "up" && dir === "down") || (cur === "down" && dir === "up") ||
        (cur === "left" && dir === "right") || (cur === "right" && dir === "left");
      if (!opposite) nextDirRef.current = dir;
    },
    true,
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    let dir: Dir | null = null;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
    else dir = dy > 0 ? "down" : "up";
    const cur = dirRef.current;
    const opposite =
      (cur === "up" && dir === "down") || (cur === "down" && dir === "up") ||
      (cur === "left" && dir === "right") || (cur === "right" && dir === "left");
    if (!opposite) nextDirRef.current = dir;
    touchRef.current = null;
  };

  return (
    <GameFrame
      accent="var(--sec-1)"
      icon={<Worm className="h-4 w-4" />}
      title={lang === "fa" ? "مار نئونی" : "Neon Snake"}
      subtitle={lang === "fa" ? "جهت‌نما / WASD یا کشیدن انگشت" : "Arrows / WASD or swipe"}
      best={best}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "امتیاز" : "Score"} value={score} accent="var(--sec-1)" />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--sec-1)" onClick={reset}>
              {over ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "بازی کن" : "Play"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="flex justify-center" dir="ltr">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          style={{ width: "min(100%, 320px)", aspectRatio: "1", touchAction: "none" }}
          className="rounded-xl"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />
      </div>
      {over && (
        <p className="mt-2 text-center font-mono text-xs text-destructive">
          {lang === "fa" ? "> برخورد! بازی تمام شد" : "> crash! game over"}
        </p>
      )}
    </GameFrame>
  );
}
