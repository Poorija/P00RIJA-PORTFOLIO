"use client";

/* Neon Runner — a tiny Mario-style platformer. Auto-run, jump (Space/tap),
 * double-jump, grab coins, clear the gaps. Distance + coins = score. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Footprints } from "lucide-react";
import { GameFrame, PlayButton, StatPill, arcadePaused, celebrate, useBestScore, useLang } from "./shared";

const W = 340;
const H = 240;
const GROUND = H - 34;
const GRAV = 0.5;
const JUMP = -8.6;
const SPEED = 2.6;

type Plat = { x: number; y: number; w: number };
type Coin = { x: number; y: number; taken: boolean };

export function RunnerGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("runner");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    x: 60, y: GROUND - 18, vy: 0, jumps: 0, frame: 0, shownCoins: -1,
    dist: 0, coinCount: 0, dead: false,
    plats: [] as Plat[], coinList: [] as Coin[],
    nextPlatAt: 200, nextCoinAt: 240, jumpQueued: false,
  });

  const gen = useCallback((s: typeof st.current) => {
    // keep ~6 platforms and ~5 coins ahead of the camera
    while (s.nextPlatAt < s.dist + W + 200) {
      const w = 60 + Math.random() * 90;
      const y = GROUND - 20 - Math.floor(Math.random() * 3) * 34;
      s.plats.push({ x: s.nextPlatAt, y, w });
      s.nextPlatAt += w + 46 + Math.random() * 70;
    }
    while (s.nextCoinAt < s.dist + W + 160) {
      const host = s.plats.find((p) => s.nextCoinAt >= p.x && s.nextCoinAt <= p.x + p.w);
      s.coinList.push({ x: s.nextCoinAt, y: (host ? host.y : GROUND) - 30, taken: false });
      s.nextCoinAt += 70 + Math.random() * 130;
    }
    s.plats = s.plats.filter((p) => p.x + p.w > s.dist - 40);
    s.coinList = s.coinList.filter((c) => c.x > s.dist - 40 && !c.taken);
  }, []);

  // coins only push an update when the count actually changes
  const setCoinsThrottled = useCallback((n: number) => {
    if (st.current.shownCoins !== n) {
      st.current.shownCoins = n;
      setCoins(n);
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const s = st.current;
    const cam = s.dist;

    // ground band
    ctx.fillStyle = "oklch(0.32 0.05 165 / 0.9)";
    ctx.fillRect(0, GROUND + 18, W, H - GROUND - 18);
    ctx.strokeStyle = "oklch(0.72 0.17 165)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND + 18); ctx.lineTo(W, GROUND + 18); ctx.stroke();

    // platforms
    s.plats.forEach((p) => {
      const px = p.x - cam;
      if (px > W || px + p.w < 0) return;
      ctx.fillStyle = "oklch(0.72 0.16 165)";
      ctx.beginPath(); ctx.roundRect(px, p.y, p.w, 8, 3); ctx.fill();
    });

    // coins
    s.coinList.forEach((c) => {
      const cx = c.x - cam;
      if (cx < -8 || cx > W + 8) return;
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(cx, c.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // player
    ctx.fillStyle = "oklch(0.85 0.16 200)";
    ctx.shadowColor = "oklch(0.85 0.16 200)"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.roundRect(s.x - 8, s.y - 18, 16, 18, 4); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0b120f";
    ctx.fillRect(s.x - 4, s.y - 13, 3, 3); ctx.fillRect(s.x + 2, s.y - 13, 3, 3);
  }, []);

  const start = useCallback(() => {
    st.current = {
      x: 60, y: GROUND - 18, vy: 0, jumps: 0, frame: 0, shownCoins: -1, dist: 0, coinCount: 0, dead: false,
      plats: [{ x: 0, y: GROUND - 20, w: 240 }], coinList: [],
      nextPlatAt: 300, nextCoinAt: 240, jumpQueued: false,
    };
    setScore(0); setCoins(0); setOver(false); setRunning(true);
  }, []);

  const jump = useCallback(() => {
    const s = st.current;
    if (!running) { start(); return; }
    if (s.jumps < 2) { s.vy = JUMP; s.jumps++; }
  }, [running, start]);

  useEffect(() => {
    if (!running) { draw(); return; }
    let raf = 0;
    const tick = () => {
      if (arcadePaused()) { raf = requestAnimationFrame(tick); return; }
      const s = st.current;
      s.dist += SPEED;

      // physics
      s.vy += GRAV;
      s.y += s.vy;
      let grounded = false;
      const feet = s.y;
      const onGround = Math.abs(feet - GROUND) < 1 && s.vy >= 0;
      if (onGround) { s.y = GROUND; s.vy = 0; s.jumps = 0; grounded = true; }
      s.plats.forEach((p) => {
        const px = p.x - s.dist;
        if (s.x > px && s.x < px + p.w && s.vy >= 0 && feet <= p.y + 6 && feet >= p.y - 8) {
          s.y = p.y; s.vy = 0; s.jumps = 0; grounded = true;
        }
      });
      if (!grounded && s.y > H + 24) s.dead = true;

      // coins
      s.coinList.forEach((c) => {
        if (!c.taken && Math.abs(c.x - s.dist - s.x) < 10 && Math.abs(c.y - (s.y - 9)) < 16) {
          c.taken = true; s.coinCount++;
        }
      });

      gen(s);
      const total = Math.floor(s.dist / 10) + s.coinCount * 10;
      // throttle React updates — setState every frame would thrash rendering
      s.frame = (s.frame + 1) % 8;
      if (s.frame === 0) setScore(total);
      setCoinsThrottled(s.coinCount);

      if (s.dead) {
        setRunning(false); setOver(true);
        submitBest(total);
        celebrate(innerWidth / 2, innerHeight / 2 - 40);
        return;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, draw, gen, submitBest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); jump(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump]);

  return (
    <GameFrame
      accent="var(--chart-2, #a3e635)"
      icon={<Footprints className="h-4 w-4" />}
      title={lang === "fa" ? "دونده نئونی" : "Neon Runner"}
      subtitle={lang === "fa" ? "Space/کلیک برای پرش — دوبار = پرش دوتایی! سکه جمع کن" : "Space/click to jump — twice for double jump! Grab coins"}
      best={best}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "امتیاز" : "Score"} value={score} accent="var(--chart-2, #a3e635)" />
            <StatPill label="🪙" value={coins} accent="#fbbf24" />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--chart-2, #a3e635)" onClick={start}>
              {over ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div
        className="flex justify-center"
        dir="ltr"
        onPointerDown={(e) => { e.preventDefault(); jump(); }}
        style={{ touchAction: "none", cursor: "pointer" }}
      >
        <canvas ref={canvasRef} style={{ width: "min(100%, 340px)", aspectRatio: `${W}/${H}` }} className="rounded-xl" />
      </div>
      {over && (
        <p className="mt-2 text-center font-mono text-xs text-destructive">
          {lang === "fa" ? `> سقوط! امتیاز: ${score}` : `> wiped out! score: ${score}`}
        </p>
      )}
    </GameFrame>
  );
}
