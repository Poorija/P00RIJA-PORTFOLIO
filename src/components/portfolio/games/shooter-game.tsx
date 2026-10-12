"use client";

/* Astro Blaster — neon space shooter. Arrows/mouse to strafe, Space or
 * auto-fire. Enemy formations descend wave after wave; 3 lives. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Radar } from "lucide-react";
import { GameFrame, PlayButton, StatPill, arcadePaused, celebrate, useBestScore, useLang } from "./shared";

const W = 320;
const H = 260;
const SHIP_Y = H - 26;

type Bullet = { x: number; y: number; vy: number };
type Enemy = { x: number; y: number; vx: number; hp: number; fire: number };
type EBullet = { x: number; y: number };

export function ShooterGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("shooter");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    shipX: W / 2, targetX: W / 2,
    bullets: [] as Bullet[], enemies: [] as Enemy[], ebullets: [] as EBullet[],
    cool: 0, left: false, right: false, fc: 0, shown: -1,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = st.current;

    // starfield
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 113) % W, (i * 61 + s.fc * 0.6) % H, 1.3, 1.3);

    // bullets
    ctx.fillStyle = "oklch(0.85 0.16 200)";
    ctx.shadowColor = "oklch(0.85 0.16 200)"; ctx.shadowBlur = 8;
    s.bullets.forEach((b) => ctx.fillRect(b.x - 1.5, b.y - 6, 3, 8));
    // enemy bullets
    ctx.shadowColor = "#f472b6"; ctx.fillStyle = "#f472b6";
    s.ebullets.forEach((b) => ctx.fillRect(b.x - 1.5, b.y, 3, 7));
    ctx.shadowBlur = 0;

    // enemies (neon diamonds)
    s.enemies.forEach((e) => {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(s.fc * 0.02);
      ctx.strokeStyle = e.hp > 1 ? "#fbbf24" : "#a78bfa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(8, 0); ctx.lineTo(0, 8); ctx.lineTo(-8, 0);
      ctx.closePath(); ctx.stroke();
      ctx.restore();
    });

    // ship
    ctx.fillStyle = "oklch(0.8 0.16 145)";
    ctx.shadowColor = "oklch(0.8 0.16 145)"; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(s.shipX, SHIP_Y - 12);
    ctx.lineTo(s.shipX + 10, SHIP_Y + 10);
    ctx.lineTo(s.shipX, SHIP_Y + 4);
    ctx.lineTo(s.shipX - 10, SHIP_Y + 10);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  const spawnWave = useCallback((n: number) => {
    const s = st.current;
    const rows = Math.min(3, 1 + Math.floor(n / 2));
    const cols = 6 + Math.min(4, n);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        s.enemies.push({
          x: 30 + c * ((W - 60) / (cols - 1 || 1)),
          y: 28 + r * 30,
          vx: (r % 2 ? 1 : -1) * (0.5 + n * 0.14),
          hp: n >= 3 && r === 0 ? 2 : 1,
          fire: 120 + Math.random() * 400,
        });
  }, []);

  const start = useCallback(() => {
    const s = st.current;
    Object.assign(s, { shipX: W / 2, targetX: W / 2, bullets: [], enemies: [], ebullets: [], cool: 0, fc: 0, shown: -1 });
    spawnWave(1);
    setScore(0); setWave(1); setLives(3); setOver(false); setRunning(true);
  }, [spawnWave]);

  useEffect(() => {
    if (!running) { draw(); return; }
    let raf = 0;
    const tick = () => {
      if (arcadePaused()) { raf = requestAnimationFrame(tick); return; }
      const s = st.current;
      s.fc++;
      if (s.left) s.targetX -= 4.4;
      if (s.right) s.targetX += 4.4;
      s.targetX = Math.max(14, Math.min(W - 14, s.targetX));
      s.shipX += (s.targetX - s.shipX) * 0.25;

      // auto-fire
      if (s.cool <= 0) { s.bullets.push({ x: s.shipX, y: SHIP_Y - 14, vy: -5.4 }); s.cool = 16; }
      s.cool--;
      s.bullets.forEach((b) => (b.y += b.vy));
      s.bullets = s.bullets.filter((b) => b.y > -10);
      s.ebullets.forEach((b) => (b.y += 2.4));
      s.ebullets = s.ebullets.filter((b) => b.y < H + 8);

      // enemies march & bounce
      let descend = false;
      s.enemies.forEach((e) => {
        e.x += e.vx;
        if (e.x < 14 || e.x > W - 14) descend = true;
      });
      if (descend) s.enemies.forEach((e) => { e.vx *= -1; e.y += 12; });
      s.enemies.forEach((e) => {
        e.fire -= 1;
        if (e.fire <= 0) { s.ebullets.push({ x: e.x, y: e.y + 10 }); e.fire = 160 + Math.random() * 420; }
      });

      // bullet hits
      for (const b of s.bullets) {
        for (const e of s.enemies) {
          if (Math.abs(b.x - e.x) < 9 && Math.abs(b.y - e.y) < 9) {
            b.y = -20; e.hp -= 1;
            if (e.hp <= 0) e.y = H + 999;
            break;
          }
        }
      }
      const kills = s.enemies.filter((e) => e.y > H + 500).length;
      if (kills) {
        s.enemies = s.enemies.filter((e) => e.y < H + 500);
        setScore((v) => {
          const nv = v + kills * 15;
          submitBest(nv);
          return nv;
        });
      }

      // ship collisions
      let hit = false;
      for (const b of s.ebullets) {
        if (Math.abs(b.x - s.shipX) < 9 && Math.abs(b.y - SHIP_Y) < 12) { hit = true; b.y = H + 99; }
      }
      for (const e of s.enemies) {
        if (Math.abs(e.x - s.shipX) < 14 && Math.abs(e.y - SHIP_Y) < 16) { hit = true; e.y = H + 999; }
      }
      if (hit) {
        s.enemies = s.enemies.filter((e) => e.y < H + 500);
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) {
            setRunning(false); setOver(true);
            celebrate(innerWidth / 2, innerHeight / 2 - 40);
          }
          return nl;
        });
        s.ebullets = [];
      }

      s.enemies = s.enemies.filter((e) => e.y < H + 500);
      if (running && s.enemies.length === 0) {
        setWave((w) => { const nw = w + 1; spawnWave(nw); return nw; });
      }

      // throttled score mirror for HUD when surviving (already event-driven)
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, draw, spawnWave, submitBest]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); st.current.left = true; }
      if (e.key === "ArrowRight") { e.preventDefault(); st.current.right = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") st.current.left = false;
      if (e.key === "ArrowRight") st.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const pointer = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    st.current.targetX = ((e.clientX - rect.left) / rect.width) * W;
  };

  return (
    <GameFrame
      accent="var(--ai-1)"
      icon={<Radar className="h-4 w-4" />}
      title={lang === "fa" ? "آسترو بلاستر" : "Astro Blaster"}
      subtitle={lang === "fa" ? "فلش‌ها یا موس — اتو-شلیک، موج‌به‌موج پیش برو" : "Arrows/mouse to strafe — auto-fire, survive the waves"}
      best={best}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "امتیاز" : "Score"} value={score} accent="var(--ai-1)" />
            <StatPill label={lang === "fa" ? "موج" : "Wave"} value={wave} />
            <StatPill label={lang === "fa" ? "جان" : "Lives"} value={"▲".repeat(Math.max(0, lives)) || "—"} accent="#f472b6" />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--ai-1)" onClick={start}>
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
          onPointerMove={pointer}
        />
      </div>
      {over && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: "var(--destructive)" }}>
          {lang === "fa" ? `> ناو نابود شد! امتیاز: ${score}` : `> ship destroyed! score: ${score}`}
        </p>
      )}
    </GameFrame>
  );
}
