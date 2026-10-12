"use client";

/* Stack Tower — time the drop, stack the blocks as high as you can. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { GameFrame, PlayButton, StatPill, useBestScore, useLang, arcadePaused } from "./shared";

const W = 320;
const H = 260;
const BLOCK_H = 18;
const BASE_W = 90;
const SPEED0 = 2.4;

export function StackTowerGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("stack");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [floors, setFloors] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    blocks: [] as { x: number; w: number }[],
    x: 0,
    dir: 1,
    speed: SPEED0,
    placed: false,
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

    const st = stateRef.current;
    st.blocks.forEach((b, i) => {
      const y = H - (i + 1) * BLOCK_H - 4;
      const hue = 160 + i * 8;
      ctx.fillStyle = `oklch(0.72 0.17 ${hue})`;
      ctx.beginPath();
      ctx.roundRect(b.x, y, b.w, BLOCK_H - 2, 4);
      ctx.fill();
    });

    if (running) {
      const last = st.blocks[st.blocks.length - 1];
      const w = last?.w ?? BASE_W;
      const baseX = last?.x ?? (W - BASE_W) / 2;
      ctx.fillStyle = "oklch(0.85 0.16 200)";
      ctx.shadowColor = "oklch(0.85 0.16 200)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(st.x, H - (st.blocks.length + 1) * BLOCK_H - 4, w, BLOCK_H - 2, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      void baseX;
    }
  }, [running]);

  const reset = useCallback(() => {
    stateRef.current = {
      blocks: [{ x: (W - BASE_W) / 2, w: BASE_W }],
      x: 10,
      dir: 1,
      speed: SPEED0,
      placed: false,
    };
    setFloors(0);
    setOver(false);
    setRunning(true);
  }, []);

  const drop = useCallback(() => {
    if (!running) {
      reset();
      return;
    }
    const st = stateRef.current;
    const last = st.blocks[st.blocks.length - 1];
    const tolerance = 6;
    const overlapLeft = Math.max(st.x, last.x);
    const overlapRight = Math.min(st.x + last.w, last.x + last.w);
    const overlap = overlapRight - overlapLeft;
    if (overlap <= tolerance) {
      setRunning(false);
      setOver(true);
      submitBest(st.blocks.length - 1);
      return;
    }
    const perfect = Math.abs(st.x - last.x) < tolerance;
    const newW = perfect ? last.w : overlap;
    const newX = perfect ? last.x : overlapLeft;
    st.blocks.push({ x: newX, w: newW });
    st.speed = Math.min(7, SPEED0 + st.blocks.length * 0.18);
    st.x = st.dir > 0 ? 0 : W - newW;
    st.dir *= -1;
    setFloors(st.blocks.length - 1);
    if (st.blocks.length >= 2 && st.blocks.length % 12 === 0) {
      try { window.dispatchEvent(new CustomEvent("achieve", { detail: "tower-architect" })); } catch {}
    }
  }, [running, reset, submitBest]);

  useEffect(() => {
    if (!running) {
      draw();
      return;
    }
    let raf = 0;
    const tick = () => {

      if (arcadePaused()) { raf = requestAnimationFrame(tick); return; }
      const st = stateRef.current;
      const current = st.blocks[st.blocks.length - 1];
      const w = current.w;
      st.x += st.dir * st.speed;
      if (st.x <= 0) { st.x = 0; st.dir = 1; }
      if (st.x >= W - w) { st.x = W - w; st.dir = -1; }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, draw]);

  useEffect(() => {
    draw();
  }, [draw, over]);

  return (
    <GameFrame
      accent="var(--chart-2, #a3e635)"
      icon={<Layers className="h-4 w-4" />}
      title={lang === "fa" ? "برج‌ساز نئون" : "Neon Stack Tower"}
      subtitle={lang === "fa" ? "بلوک را دقیقاً روی قبلی بینداز — فضای خطا کم است!" : "Drop each block precisely — the tower keeps shrinking!"}
      best={best}
      bestLabel={lang === "fa" ? "بالاترین طبقه" : "Highest floor"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "طبقه" : "Floors"} value={floors} accent="var(--chart-2, #a3e635)" />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--chart-2, #a3e635)" onClick={reset}>
              {over ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div
        className="flex justify-center"
        dir="ltr"
        onClick={drop}
        style={{ cursor: "pointer", touchAction: "manipulation" }}
        role="button"
        aria-label={lang === "fa" ? "رها کردن بلوک" : "Drop block"}
      >
        <canvas ref={canvasRef} style={{ width: "min(100%, 320px)", aspectRatio: `${W}/${H}` }} className="rounded-xl" />
      </div>
      {over && (
        <p className="mt-2 text-center font-mono text-xs text-destructive">
          {lang === "fa" ? `> برج فرو ریخت! طبقات: ${floors}` : `> tower collapsed! floors: ${floors}`}
        </p>
      )}
    </GameFrame>
  );
}
