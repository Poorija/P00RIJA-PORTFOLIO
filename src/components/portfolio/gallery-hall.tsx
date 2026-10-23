"use client";

/* ============================================================
 * GalleryHall — a walkable 3D exhibition corridor (pure CSS-3D,
 * no WebGL: safe on the 1-core server audience and mobile GPUs).
 *
 * The visitor stands inside a virtual art hall: framed artworks hang
 * on the left/right walls along a corridor with a reflective floor,
 * ceiling spotlights and a glowing end wall. Controls:
 *   • drag (mouse/touch)  → look around (yaw, clamped)
 *   • wheel / W,S / ↑,↓   → walk deeper or back
 *   • ←,→ / next-prev      → glide to the previous/next artwork
 *   • click a frame        → open the full project popup
 * Frames support images, video posters (▶ badge) and lock cards.
 * ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, MoveHorizontal, Play } from "lucide-react";
import type { ProjectArtwork } from "@/lib/content-types";
import { cn } from "@/lib/utils";

const STEP = 340;        // z-distance between artworks
const HALF_W = 330;      // corridor half width (px)
const WALL_H = 400;      // frame center height

export function GalleryHall({
  projects,
  lang,
  onOpen,
}: {
  projects: ProjectArtwork[];
  lang: "fa" | "en";
  onOpen: (i: number) => void;
}) {
  const fa = lang === "fa";
  const [walk, setWalk] = useState(0);      // 0..(n-1)*STEP
  const [yaw, setYaw] = useState(0);        // look direction, ±28
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; mode: "look" | "walk" | null; startYaw: number; startWalk: number }>({ x: 0, y: 0, mode: null, startYaw: 0, startWalk: 0 });
  const maxWalk = Math.max(0, (projects.length - 1) * STEP);

  const clampWalk = (w: number) => Math.max(0, Math.min(maxWalk, w));

  const goTo = useCallback((i: number) => {
    setWalk(clampWalk(i * STEP));
  }, [maxWalk]);

  // current nearest artwork index (for the caption plate)
  const currentIdx = Math.round(walk / STEP);
  const current = projects[currentIdx];

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") setWalk((w) => clampWalk(w + 90));
      else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") setWalk((w) => clampWalk(w - 90));
      else if (e.key === "ArrowRight") goTo(Math.min(projects.length - 1, currentIdx + 1));
      else if (e.key === "ArrowLeft") goTo(Math.max(0, currentIdx - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentIdx, goTo, projects.length]);

  // wheel walks
  const onWheel = (e: React.WheelEvent) => {
    setWalk((w) => clampWalk(w + (e.deltaY > 0 ? 110 : -110)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    drag.current = { x: e.clientX, y: e.clientY, mode: "look", startYaw: yaw, startWalk: walk };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.mode) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    // horizontal drag = look; vertical drag (touch) = walk
    setYaw(Math.max(-30, Math.min(30, drag.current.startYaw - dx * 0.08)));
    if (e.pointerType === "touch") setWalk(clampWalk(drag.current.startWalk + dy * 1.4));
  };
  const onPointerUp = () => { drag.current.mode = null; setDragging(false); };

  const frameVisual = (p: ProjectArtwork): { bg: string; isVideo: boolean } => {
    const video = p.videos?.[0];
    const img = p.images?.[0];
    const poster = video?.poster || (img && /^(https?:|\/|data:)/.test(img) ? img : "");
    if (poster) return { bg: `url(${poster}) center/cover`, isVideo: Boolean(video) };
    return { bg: `linear-gradient(135deg, ${p.color || "#169cff"}, oklch(0.22 0.04 280))`, isVideo: Boolean(video) };
  };

  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ perspective: "1100px", background: "radial-gradient(90% 70% at 50% 0%, oklch(0.14 0.02 280), oklch(0.05 0.01 280))", cursor: dragging ? "grabbing" : "grab" }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* 3D scene */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: `translateZ(${walk}px) rotateY(${fa ? -yaw : yaw}deg)`,
          transition: dragging ? "none" : "transform 0.55s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* reflective floor */}
        <div
          className="absolute left-1/2 top-[62%] h-[900px] w-[2400px]"
          style={{
            transform: `translate(-50%,0) rotateX(90deg) translateZ(${-maxWalk / 2}px)`,
            background:
              "linear-gradient(90deg, transparent 0%, oklch(0.12 0.02 280 / 0.9) 18%, oklch(0.17 0.03 295 / 0.95) 50%, oklch(0.12 0.02 280 / 0.9) 82%, transparent 100%)",
          }}
        />
        {/* end wall */}
        <div
          className="absolute left-1/2"
          style={{
            transform: `translate(-50%, -50%) translateZ(${-maxWalk - 600}px) translateY(${WALL_H}px)`,
            width: HALF_W * 2,
            height: 620,
            background: "radial-gradient(60% 50% at 50% 45%, color-mix(in oklch, var(--gfx-1) 26%, transparent), oklch(0.08 0.015 280) 75%)",
            boxShadow: "0 0 120px -20px color-mix(in oklch, var(--gfx-1) 40%, transparent)",
          }}
        />

        {projects.map((p, i) => {
          const side = i % 2 === 0 ? -1 : 1; // left / right wall
          const z = -(i + 1) * STEP;
          const { bg, isVideo } = frameVisual(p);
          const isCurrent = i === currentIdx;
          return (
            <div
              key={`${i}-${p.locked ? "locked" : "open"}`}
              className="absolute left-1/2 top-1/2"
              style={{
                transformStyle: "preserve-3d",
                transform: `translate(-50%, -50%) translateX(${side * (HALF_W - 8)}px) translateZ(${z}px) rotateY(${side * -90}deg)`,
              }}
            >
              {/* ceiling spotlight cone */}
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[-170px] h-[190px] w-[240px] -translate-x-1/2"
                style={{ background: `linear-gradient(to bottom, transparent, ${p.color || "var(--gfx-1)"}55)`, filter: "blur(6px)", opacity: isCurrent ? 0.9 : 0.35, transition: "opacity 0.4s" }}
              />
              {/* frame */}
              <button
                type="button"
                onClick={() => onOpen(i)}
                data-cursor-hover
                className={cn(
                  "group relative block h-[300px] w-[230px] overflow-hidden rounded-lg border-[10px] shadow-2xl transition-transform sm:h-[330px] sm:w-[250px]",
                  p.locked ? "border-stone-700/80" : "border-stone-900/90"
                )}
                style={{ boxShadow: isCurrent ? `0 0 70px -12px ${p.color || "var(--gfx-1)"}, 0 30px 40px -18px black` : "0 24px 40px -20px black" }}
              >
                {p.locked ? (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background/60 text-center">
                    <Lock className="size-8 text-[var(--sec-1)]" />
                    <span className="px-4 text-xs font-bold text-foreground">{p.title}</span>
                    <span className="text-[10px] text-muted-foreground">{fa ? "قفل است" : "locked"}</span>
                  </span>
                ) : (
                  <>
                    <span className="absolute inset-0" style={{ background: bg }} />
                    {isVideo && (
                      <span className="absolute inset-0 grid place-items-center bg-black/25">
                        <span className="grid size-12 place-items-center rounded-full border border-white/40 bg-black/50 backdrop-blur">
                          <Play className="size-5 translate-x-0.5 text-white" fill="white" />
                        </span>
                      </span>
                    )}
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                  </>
                )}
              </button>
              {/* brass caption plate */}
              <div className="mx-auto mt-3 w-fit rounded-md border border-stone-600/50 bg-stone-800/80 px-3 py-1.5 text-center backdrop-blur-sm">
                <p className="max-w-[210px] truncate text-[11px] font-bold text-stone-100">{p.title}</p>
                <p className="font-mono text-[9px] tracking-wider text-stone-300/80">{[p.category, p.year].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* HUD: current caption + controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4">
        {current && (
          <p className="pointer-events-auto max-w-md truncate rounded-full border border-white/15 bg-black/50 px-4 py-1.5 text-xs text-white/90 backdrop-blur">
            {fa ? "اثر فعلی: " : "Now viewing: "}
            <span className="font-bold">{current.title}</span>
          </p>
        )}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(Math.max(0, currentIdx - 1))}
            className="grid size-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
            aria-label={fa ? "اثر قبلی" : "previous artwork"}
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-2 backdrop-blur">
            {projects.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`artwork ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === currentIdx ? 22 : 7, background: i === currentIdx ? "var(--gfx-1)" : "rgba(255,255,255,.35)" }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(Math.min(projects.length - 1, currentIdx + 1))}
            className="grid size-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
            aria-label={fa ? "اثر بعدی" : "next artwork"}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-white/45">
          <MoveHorizontal className="size-3" />
          {fa ? "درگ = نگاه · اسکرول/W,S = حرکت · کلیک = جزئیات" : "drag = look · scroll/W,S = walk · click = details"}
        </p>
      </div>
    </div>
  );
}
