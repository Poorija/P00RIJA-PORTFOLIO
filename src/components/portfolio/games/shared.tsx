"use client";

/* ============================================================
 * Shared building blocks for every Game Center game.
 * Keeps each game file small and gives the whole arcade one
 * consistent visual language: gradients, glow, glass panels.
 * ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { useContent } from "@/lib/content-store";

export type Lang = "fa" | "en";

/** localStorage-backed best score. mode "high" keeps the max, "low" the min. */
export function useBestScore(key: string, mode: "high" | "low" = "high") {
  const storageKey = `p00rija-arcade-${key}`;
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) requestAnimationFrame(() => setBest(Number(raw)));
    } catch {
      // storage unavailable (privacy mode) — best just stays hidden
    }
  }, [storageKey]);

  const submit = useCallback(
    (value: number) => {
      setBest((prev) => {
        const better =
          prev === null || (mode === "high" ? value > prev : value < prev);
        if (!better) return prev;
        try {
          localStorage.setItem(storageKey, String(value));
        } catch {
          // ignore
        }
        return value;
      });
    },
    [mode, storageKey]
  );

  return [best, submit] as const;
}

/** Fires a site-wide achievement (wired into easter-eggs.tsx). */
export function fireAchievement(detail: string) {
  try {
    window.dispatchEvent(new CustomEvent("achieve", { detail }));
  } catch {
    // ignore
  }
}

/** Neon confetti burst — pure DOM, no deps. */
export function celebrate(x = innerWidth / 2, y = innerHeight / 2) {
  const colors = ["#34d399", "#38bdf8", "#a78bfa", "#f472b6", "#fbbf24"];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement("span");
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 6;
    const size = 4 + Math.random() * 5;
    p.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:${Math.random() > 0.5 ? "50%" : "2px"};background:${colors[i % colors.length]};pointer-events:none;z-index:99999;box-shadow:0 0 10px ${colors[i % colors.length]};`;
    document.body.appendChild(p);
    let px = 0, py = 0, vx = Math.cos(a) * v, vy = Math.sin(a) * v - 3, life = 0;
    const tick = () => {
      life++;
      vy += 0.18;
      px += vx; py += vy;
      p.style.transform = `translate(${px}px, ${py}px) rotate(${life * 9}deg)`;
      p.style.opacity = String(Math.max(0, 1 - life / 55));
      if (life < 55) requestAnimationFrame(tick);
      else p.remove();
    };
    requestAnimationFrame(tick);
  }
}

/** Arcade-wide pause flag (set by GameCenterOverlay on Esc). */
export function arcadePaused(): boolean {
  return (window as unknown as { __arcadePaused?: boolean }).__arcadePaused === true;
}

/**
 * Standard game frame: gradient header bar, best-score chip, reset button.
 * accent must be a CSS color string (usually a site CSS variable).
 */
export function GameFrame({
  accent,
  icon,
  title,
  subtitle,
  best,
  bestLabel,
  onReset,
  children,
  footer,
}: {
  accent: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  best?: number | null;
  bestLabel?: string;
  onReset?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useContent((s) => s.t);
  // swipe start point (touch) — see the swipe-to-arrows handler below
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Games are directional (left/right arrows move left/right on the canvas);
  // force LTR so an RTL document never mirrors controls or key semantics.
  return (
    <div className="flex flex-col gap-4" dir="ltr">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && (
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{
                color: accent,
                background: `color-mix(in oklch, ${accent} 12%, transparent)`,
                border: `1px solid color-mix(in oklch, ${accent} 35%, transparent)`,
              }}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3
              className="truncate text-sm font-black sm:text-base"
              style={{ color: accent }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {best !== null && best !== undefined && (
            <span
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-[11px]"
              style={{
                color: accent,
                background: `color-mix(in oklch, ${accent} 10%, transparent)`,
                border: `1px solid color-mix(in oklch, ${accent} 30%, transparent)`,
              }}
            >
              <Trophy className="h-3 w-3" />
              {bestLabel ?? t("best")}: {best}
            </span>
          )}
          {onReset && (
            <button
              onClick={onReset}
              data-cursor-hover
              aria-label={t("newGame")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* game surface: swipe gestures (touch) bubble up here and become arrow
          keys — tap/aim games keep working because children get events first */}
      <div
        className="game-surface relative overflow-hidden rounded-2xl border border-border p-3 sm:p-4"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") touchStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = touchStart.current;
          touchStart.current = null;
          if (!s || e.pointerType !== "touch") return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return; // a tap — let the game handle it
          const key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : dy > 0 ? "ArrowDown" : "ArrowUp";
          fireKey(key, "keydown");
          setTimeout(() => fireKey(key, "keyup"), 60);
        }}
      >
        {children}
      </div>
      <TouchGamepad accent={accent} />
      {footer}
    </div>
  );
}

/* ============================================================
 * Touch controls — ONE generic layer for every game.
 *
 * Swipes on the game surface (handlers above) dispatch the matching
 * Arrow keydown — instantly gives grid/canvas games (2048, Snake, …)
 * native touch support next to mouse + keyboard.
 *
 * TouchGamepad: a compact D-pad + A/B pad, shown only on touch devices,
 * dispatching real KeyboardEvents (arrows, Space/x) so every keyboard-
 * driven game (platformers, shooters, breakout…) is playable on phones
 * without per-game code.
 * ============================================================ */

function fireKey(key: string, type: "keydown" | "keyup") {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
}

export function TouchGamepad({ accent }: { accent: string }) {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(typeof window !== "undefined" && (("ontouchstart" in window) || navigator.maxTouchPoints > 0));
  }, []);
  if (!touch) return null;
  const hold = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      fireKey(key, "keydown");
    },
    onPointerUp: () => fireKey(key, "keyup"),
    onPointerLeave: () => fireKey(key, "keyup"),
    onPointerCancel: () => fireKey(key, "keyup"),
  });
  const pad = "grid select-none place-items-center rounded-xl border text-lg font-black active:scale-95";
  const style = {
    borderColor: `color-mix(in oklch, ${accent} 40%, transparent)`,
    background: `color-mix(in oklch, ${accent} 10%, transparent)`,
    color: accent,
  } as const;
  return (
    <div className="flex items-center justify-between gap-4 select-none lg:hidden" aria-hidden={false}>
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5" style={{ width: 132, height: 132 }}>
        <span />
        <button className={pad} style={style} {...hold("ArrowUp")}>▲</button>
        <span />
        <button className={pad} style={style} {...hold("ArrowLeft")}>◀</button>
        <span />
        <button className={pad} style={style} {...hold("ArrowRight")}>▶</button>
        <span />
        <button className={pad} style={style} {...hold("ArrowDown")}>▼</button>
        <span />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className={`${pad} h-14 w-14 rounded-full`} style={style} {...hold(" ")}>A</button>
        <button className={`${pad} h-14 w-14 rounded-full`} style={style} {...hold("x")}>B</button>
      </div>
    </div>
  );
}

/** Solid accent button — primary action of a game. */
export function PlayButton({
  accent,
  onClick,
  children,
  disabled,
  className = "",
}: {
  accent: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-cursor-hover
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${className}`}
      style={{
        background: `linear-gradient(135deg, ${accent}, color-mix(in oklch, ${accent} 60%, #7c3aed))`,
        boxShadow: `0 8px 24px -8px color-mix(in oklch, ${accent} 70%, transparent)`,
      }}
    >
      {children}
    </button>
  );
}

/** Small stat pill (score / lives / timer …). */
export function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <span className="flex flex-col items-center rounded-lg border border-border bg-surface-1 px-3 py-1.5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className="font-mono text-sm font-bold"
        style={{ color: accent || "var(--foreground)" }}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * requestAnimationFrame loop with delta time, auto cleanup and an
 * always-fresh callback ref. Games use this for their canvas/state loops.
 * Returns { start, stop, canvasRef } — canvasRef is optional to attach.
 */
export function useGameLoop(
  update: (dtMs: number) => void,
  active: boolean
) {
  const cbRef = useRef(update);
  cbRef.current = update;
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - lastRef.current); // clamp to avoid jumps after tab-switch
      lastRef.current = now;
      cbRef.current(dt);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
}

/**
 * Window keyboard handler that is safe for the arcade: skips while the
 * user types in inputs/terminals and (optionally) swallows scrolling keys
 * while a game needs them.
 */
export function useGameKeys(
  handler: (e: KeyboardEvent) => void,
  active: boolean,
  preventDefaultKeys: string[] = []
) {
  const cbRef = useRef(handler);
  cbRef.current = handler;
  useEffect(() => {
    if (!active) return;
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
      if (preventDefaultKeys.includes(e.key)) e.preventDefault();
      cbRef.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, preventDefaultKeys.join(",")]);
}

/** Bilingual helper — most games take lang via useContent themselves. */
export function useLang(): Lang {
  return useContent((s) => s.lang);
}

/** Fixed-size canvas that renders DPR-sharp and gives back ctx + size. */
export function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  width: number,
  height: number
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawRef.current(ctx, width, height);
  });

  return canvasRef;
}
