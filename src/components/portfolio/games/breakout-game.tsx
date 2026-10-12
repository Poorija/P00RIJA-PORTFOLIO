"use client";

/* Brick Blaster — neon breakout. Mouse / touch / arrows to move the paddle. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Blocks } from "lucide-react";
import { GameFrame, PlayButton, StatPill, useBestScore, useLang, arcadePaused } from "./shared";

const W = 320;
const H = 260;
const PADDLE_W = 56;
const PADDLE_H = 8;
const BALL_R = 4;
const COLS = 7;
const ROWS = 5;
const BRICK_W = W / COLS;
const BRICK_H = 14;

type Brick = { x: number; y: number; alive: boolean; hue: number };

function makeBricks(): Brick[] {
  const out: Brick[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      out.push({ x: c * BRICK_W + 2, y: 24 + r * (BRICK_H + 4), alive: true, hue: 190 + r * 26 });
  return out;
}

export function BreakoutGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("breakout");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState<null | "won" | "lost">(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    bricks: makeBricks(),
    paddleX: (W - PADDLE_W) / 2,
    ball: { x: W / 2, y: H - 40, vx: 2.2, vy: -2.8 },
    keys: { left: false, right: false },
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

    const s = st.current;
    s.bricks.forEach((b) => {
      if (!b.alive) return;
      ctx.fillStyle = `oklch(0.75 0.16 ${b.hue})`;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, BRICK_W - 4, BRICK_H, 3);
      ctx.fill();
    });

    ctx.fillStyle = "var(--sec-1)";
    ctx.fillStyle = "oklch(0.75 0.15 165)";
    ctx.beginPath();
    ctx.roundRect(s.paddleX, H - PADDLE_H - 6, PADDLE_W, PADDLE_H, 4);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.shadowColor = "oklch(0.85 0.15 200)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  const resetBall = useCallback(() => {
    const s = st.current;
    s.ball = { x: W / 2, y: H - 40, vx: (Math.random() > 0.5 ? 1 : -1) * 2.2, vy: -2.8 };
    s.paddleX = (W - PADDLE_W) / 2;
  }, []);

  const start = useCallback(() => {
    st.current.bricks = makeBricks();
    resetBall();
    setScore(0);
    setLives(3);
    setOver(null);
    setRunning(true);
  }, [resetBall]);

  useEffect(() => {
    if (!running) {
      draw();
      return;
    }
    let raf = 0;
    const tick = () => {

      if (arcadePaused()) { raf = requestAnimationFrame(tick); return; }
      const s = st.current;
      if (s.keys.left) s.paddleX -= 5;
      if (s.keys.right) s.paddleX += 5;
      s.paddleX = Math.max(0, Math.min(W - PADDLE_W, s.paddleX));

      const b = s.ball;
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < BALL_R || b.x > W - BALL_R) b.vx *= -1;
      if (b.y < BALL_R) b.vy *= -1;

      // paddle
      const paddleY = H - PADDLE_H - 6;
      if (b.y + BALL_R >= paddleY && b.y < paddleY + PADDLE_H && b.x >= s.paddleX && b.x <= s.paddleX + PADDLE_W && b.vy > 0) {
        const hit = (b.x - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
        b.vx = hit * 3.4;
        b.vy = -Math.max(2.4, Math.abs(b.vy));
      }

      // bricks
      for (const brick of s.bricks) {
        if (!brick.alive) continue;
        if (b.x > brick.x && b.x < brick.x + BRICK_W - 4 && b.y > brick.y && b.y < brick.y + BRICK_H) {
          brick.alive = false;
          b.vy *= -1;
          setScore((v) => {
            const ns = v + 10;
            submitBest(ns);
            return ns;
          });
          break;
        }
      }

      if (s.bricks.every((br) => !br.alive)) {
        setRunning(false);
        setOver("won");
        try { window.dispatchEvent(new CustomEvent("achieve", { detail: "brick-blaster" })); } catch {}
        return;
      }

      if (b.y > H + BALL_R) {
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) {
            setRunning(false);
            setOver("lost");
          } else {
            resetBall();
          }
          return nl;
        });
      }

      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, draw, resetBall, submitBest]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); st.current.keys.left = true; }
      if (e.key === "ArrowRight") { e.preventDefault(); st.current.keys.right = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") st.current.keys.left = false;
      if (e.key === "ArrowRight") st.current.keys.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const pointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    st.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, rel - PADDLE_W / 2));
  };

  return (
    <GameFrame
      accent="var(--gfx-1)"
      icon={<Blocks className="h-4 w-4" />}
      title={lang === "fa" ? "آجرشکن نئونی" : "Neon Brick Blaster"}
      subtitle={lang === "fa" ? "موس/لمس یا فلش‌ها — همه آجرها را پاک کن" : "Mouse/touch or arrows — clear every brick"}
      best={best}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "امتیاز" : "Score"} value={score} accent="var(--gfx-1)" />
            <StatPill label={lang === "fa" ? "جان" : "Lives"} value={"❤".repeat(Math.max(0, lives)) || "—"} accent="var(--destructive)" />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--gfx-1)" onClick={start}>
              {over ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="flex justify-center" dir="ltr">
        <canvas
          ref={canvasRef}
          style={{ width: "min(100%, 320px)", aspectRatio: `${W}/${H}`, touchAction: "none" }}
          className="rounded-xl"
          onPointerMove={pointerMove}
        />
      </div>
      {over && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: over === "won" ? "var(--sec-1)" : "var(--destructive)" }}>
          {over === "won"
            ? (lang === "fa" ? "> همه آجرها نابود شد! 🏆" : "> all bricks cleared! 🏆")
            : (lang === "fa" ? "> جان‌ها تمام شد" : "> out of lives")}
        </p>
      )}
    </GameFrame>
  );
}
