"use client";

/* Orbit Pong — first to 5 against a reactive AI paddle. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Table2 } from "lucide-react";
import { GameFrame, PlayButton, StatPill, useBestScore, useLang, arcadePaused } from "./shared";

const W = 320;
const H = 240;
const PAD_H = 44;
const PAD_W = 6;
const WIN = 5;

export function PongGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("pong");
  const [running, setRunning] = useState(false);
  const [scores, setScores] = useState({ p: 0, ai: 0 });
  const [winner, setWinner] = useState<null | "p" | "ai">(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    playerY: (H - PAD_H) / 2,
    aiY: (H - PAD_H) / 2,
    ball: { x: W / 2, y: H / 2, vx: 2.6, vy: 1.6 },
    up: false,
    down: false,
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

    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    const s = st.current;
    ctx.fillStyle = "oklch(0.75 0.15 165)";
    ctx.beginPath();
    ctx.roundRect(10, s.playerY, PAD_W, PAD_H, 3);
    ctx.fill();
    ctx.fillStyle = "oklch(0.7 0.19 20)";
    ctx.beginPath();
    ctx.roundRect(W - 10 - PAD_W, s.aiY, PAD_W, PAD_H, 3);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.shadowColor = "oklch(0.85 0.15 200)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(s.ball.x, s.ball.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  const serve = useCallback((toRight: boolean) => {
    st.current.ball = { x: W / 2, y: H / 2, vx: toRight ? 2.6 : -2.6, vy: (Math.random() - 0.5) * 3 };
  }, []);

  const start = useCallback(() => {
    setScores({ p: 0, ai: 0 });
    setWinner(null);
    serve(Math.random() > 0.5);
    setRunning(true);
  }, [serve]);

  useEffect(() => {
    if (!running) {
      draw();
      return;
    }
    let raf = 0;
    const tick = () => {

      if (arcadePaused()) { raf = requestAnimationFrame(tick); return; }
      const s = st.current;
      if (s.up) s.playerY -= 4.6;
      if (s.down) s.playerY += 4.6;
      s.playerY = Math.max(0, Math.min(H - PAD_H, s.playerY));

      // AI follows with capped speed
      const target = s.ball.y - PAD_H / 2;
      s.aiY += Math.max(-3.4, Math.min(3.4, target - s.aiY));
      s.aiY = Math.max(0, Math.min(H - PAD_H, s.aiY));

      const b = s.ball;
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < 4 || b.y > H - 4) b.vy *= -1;

      if (b.x < 16 + PAD_W && b.y > s.playerY && b.y < s.playerY + PAD_H && b.vx < 0) {
        b.vx = Math.abs(b.vx) * 1.04;
        b.vy += ((b.y - (s.playerY + PAD_H / 2)) / PAD_H) * 2.4;
      }
      if (b.x > W - 16 - PAD_W - 4 && b.y > s.aiY && b.y < s.aiY + PAD_H && b.vx > 0) {
        b.vx = -Math.abs(b.vx) * 1.04;
        b.vy += ((b.y - (s.aiY + PAD_H / 2)) / PAD_H) * 2.4;
      }

      if (b.x < -6) {
        setScores((v) => {
          const ai = v.ai + 1;
          if (ai >= WIN) {
            setRunning(false);
            setWinner("ai");
          } else serve(true);
          return { ...v, ai };
        });
      } else if (b.x > W + 6) {
        setScores((v) => {
          const p = v.p + 1;
          submitBest(p);
          if (p >= WIN) {
            setRunning(false);
            setWinner("p");
            try { window.dispatchEvent(new CustomEvent("achieve", { detail: "pong-master" })); } catch {}
          } else serve(false);
          return { ...v, p };
        });
      }

      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, draw, serve, submitBest]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowUp") { e.preventDefault(); st.current.up = true; }
      if (e.key === "ArrowDown") { e.preventDefault(); st.current.down = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") st.current.up = false;
      if (e.key === "ArrowDown") st.current.down = false;
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
    const rel = ((e.clientY - rect.top) / rect.height) * H;
    st.current.playerY = Math.max(0, Math.min(H - PAD_H, rel - PAD_H / 2));
  };

  return (
    <GameFrame
      accent="var(--chart-4, #38bdf8)"
      icon={<Table2 className="h-4 w-4" />}
      title={lang === "fa" ? "پینگ‌پنگ مداری" : "Orbit Pong"}
      subtitle={lang === "fa" ? "فلش‌ها یا لمس — ۵ امتیاز برنده است" : "Arrows or touch — first to 5 wins"}
      best={best}
      bestLabel={lang === "fa" ? "بهترین امتیاز" : "Best score"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "شما" : "You"} value={scores.p} accent="var(--chart-4, #38bdf8)" />
            <StatPill label="AI" value={scores.ai} accent="var(--destructive)" />
          </div>
          {(!running || winner) && (
            <PlayButton accent="var(--chart-4, #38bdf8)" onClick={start}>
              {winner ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
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
      {winner && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: winner === "p" ? "var(--sec-1)" : "var(--destructive)" }}>
          {winner === "p" ? (lang === "fa" ? "> تو بردی! 🏆" : "> you win! 🏆") : (lang === "fa" ? "> هوش مصنوعی برد" : "> AI wins")}
        </p>
      )}
    </GameFrame>
  );
}
