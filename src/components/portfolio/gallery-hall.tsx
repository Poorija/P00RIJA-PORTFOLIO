"use client";

/* ============================================================
 * GalleryHall v2 — a REAL walkable 3D art gallery (CSS-3D, no
 * WebGL: safe for the 1-core audience and mobile GPUs).
 *
 * The corridor is organised in STATIONS — each station is a pair of
 * artworks facing each other from the two walls (ceil(n/2) stations,
 * dynamic; the HUD dots follow stations, not projects). Every artwork
 * gets its OWN presentation: unique height offset + frame size,
 * personal ceiling spotlight, a pool of light on the floor, a wall
 * placard, and a wall-wash halo.
 *
 * Visitor controls:
 *   • drag                → free look (yaw ±46°); touch-drag vertical walks
 *   • wheel / W,S / ↑,↓   → free walk
 *   • ←,→ / dots          → glide to the previous/next STATION
 *   • Tab                 → turn and face the next artwork in place
 *   • Enter / click frame → face it, then its CATALOG book opens
 * A live MINIMAP (bottom corner) shows the floor plan: every artwork
 * in its own zone, the visitor's position and facing direction.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, ChevronLeft, ChevronRight, Lock, MoveHorizontal, Play,
} from "lucide-react";
import type { ProjectArtwork } from "@/lib/content-types";
import { cn } from "@/lib/utils";

const STEP = 360;          // depth distance between stations
const VIEW_DIST = 150;     // viewer stands this far from a station's artworks
const HALF_W = 330;        // corridor half-width
const WALL_H = 330;        // frame center height

/** deterministic per-artwork presentation variance */
function placement(i: number) {
  const lift = ((i * 47) % 3 - 1) * 26;       // −26..26 px vertical variety
  const sizeDelta = ((i * 31) % 3 - 1) * 14;  // frame size variety
  const tilt = ((i * 17) % 3 - 1) * 1.2;      // ever-so-slight hang tilt
  return { lift, sizeDelta, tilt };
}

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
  const [walk, setWalk] = useState(STEP - VIEW_DIST);
  const [yaw, setYaw] = useState(0);
  const [focused, setFocused] = useState<number>(-1);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ x: 0, y: 0, active: false, startYaw: 0, startWalk: 0 });

  const stationCount = Math.max(1, Math.ceil(projects.length / 2));
  const stationOf = useCallback((i: number) => Math.floor(i / 2), []);
  const walkAt = useCallback((s: number) => (s + 1) * STEP - VIEW_DIST, []);
  const maxWalk = walkAt(stationCount - 1);
  const clampWalk = useCallback((w: number) => Math.max(0, Math.min(maxWalk, w)), [maxWalk]);

  const nearestStation = useMemo(() => {
    let best = 0, bestD = Infinity;
    for (let s = 0; s < stationCount; s++) {
      const d = Math.abs(walk - walkAt(s));
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }, [walk, stationCount, walkAt]);

  const goToStation = useCallback((s: number) => {
    const clamped = Math.max(0, Math.min(stationCount - 1, s));
    setWalk(walkAt(clamped));
    setYaw(0);
    setFocused(clamped * 2);
  }, [stationCount, walkAt]);

  /** walk to the artwork's station and turn to face it */
  const focusArtwork = useCallback((i: number, openCatalog: boolean) => {
    setFocused(i);
    const side = i % 2 === 0 ? -1 : 1;             // left / right wall
    const station = Math.floor(i / 2);
    setWalk(walkAt(station));
    setYaw(side * (fa ? -58 : 58));
    if (openCatalog) {
      window.setTimeout(() => onOpen(i), 620);     // let the camera settle first
    }
  }, [fa, onOpen, walkAt]);

  // keyboard: walk / stations / Tab focus / Enter catalog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "w") setWalk((w) => clampWalk(w + 90));
      else if (k === "arrowdown" || k === "s") setWalk((w) => clampWalk(w - 90));
      else if (e.key === "ArrowRight") { e.preventDefault(); goToStation(nearestStation + (fa ? -1 : 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goToStation(nearestStation + (fa ? 1 : -1)); }
      else if (e.key === "Tab") {
        e.preventDefault();
        const next = (focused + 1) % Math.max(1, projects.length);
        focusArtwork(next, false);
      } else if (e.key === "Enter" && focused >= 0 && projects[focused]) {
        e.preventDefault();
        focusArtwork(focused, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, nearestStation, goToStation, focusArtwork, projects.length, clampWalk, fa]);

  const onWheel = (e: React.WheelEvent) => setWalk((w) => clampWalk(w + (e.deltaY > 0 ? 110 : -110)));
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, active: true, startYaw: yaw, startWalk: walk };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setYaw(Math.max(-46, Math.min(46, drag.current.startYaw - dx * 0.1)));
    if (e.pointerType === "touch") setWalk(clampWalk(drag.current.startWalk + dy * 1.5));
  };
  const onPointerUp = () => { drag.current.active = false; setDragging(false); };

  const mediaOf = (p: ProjectArtwork) => {
    const video = p.videos?.[0];
    const img = video?.poster || p.images?.[0];
    const isImg = !!img && /^(https?:|\/|data:)/.test(img);
    return {
      bg: isImg ? `url(${img}) center/cover` : `linear-gradient(140deg, ${p.color || "#169cff"}, oklch(0.22 0.04 280))`,
      isVideo: Boolean(video),
    };
  };

  const caption = focused >= 0 && projects[focused] ? projects[focused] : projects[nearestStation * 2];

  /* ---------- minimap (top-down floor plan) ---------- */
  const MAP_W = 86, MAP_H = 128, PAD = 10;
  const depthMax = stationCount * STEP + 200;
  const zToMap = (zDepth: number) => PAD + (zDepth / depthMax) * (MAP_H - PAD * 2);
  const visitorMapY = zToMap(walk + STEP);

  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ perspective: "1150px", background: "radial-gradient(95% 75% at 50% -5%, oklch(0.16 0.02 280), oklch(0.045 0.012 280))", cursor: dragging ? "grabbing" : "grab" }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* ambience: haze */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10" style={{ background: "linear-gradient(to top, oklch(0.05 0.015 280 / .55), transparent 30%, transparent 75%, oklch(0.08 0.02 280 / .5))" }} />

      {/* 3D world */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: `translateZ(${walk}px) rotateY(${fa ? -yaw : yaw}deg)`,
          transition: dragging ? "none" : "transform 0.7s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* marble floor with light pools */}
        <div
          className="absolute left-1/2"
          style={{
            width: HALF_W * 2, height: depthMax + 900,
            transform: `translate(-50%, 0) rotateX(90deg) translateZ(${-WALL_H}px) translateY(${-depthMax - 250}px)`,
            background:
              `repeating-linear-gradient(90deg, oklch(0.13 0.015 280) 0 118px, oklch(0.15 0.018 285) 118px 236px),` +
              `linear-gradient(180deg, oklch(0.2 0.03 290 / .8), oklch(0.1 0.015 280))`,
          }}
        >
          {projects.map((p, i) => {
            const s = stationOf(i);
            const side = i % 2 === 0 ? -1 : 1;
            return (
              <div
                key={i}
                aria-hidden
                className="absolute rounded-[50%]"
                style={{
                  left: `calc(50% + ${side * (HALF_W / 2 - 30)}px)`,
                  top: depthMax - (s + 1) * STEP + 60,
                  width: 190, height: 90, transform: "translate(-50%, -50%)",
                  background: `radial-gradient(closest-side, ${p.color || "var(--gfx-1)"}38, transparent 75%)`,
                  filter: "blur(3px)",
                }}
              />
            );
          })}
        </div>

        {/* ceiling light strips */}
        <div aria-hidden className="absolute left-1/2" style={{
          width: HALF_W * 2 - 160, height: depthMax,
          transform: `translate(-50%,0) rotateX(-90deg) translateZ(${WALL_H + 120}px) translateY(${-depthMax}px)`,
          background: `repeating-linear-gradient(180deg, oklch(0.85 0.05 95 / .9) 0 26px, transparent 26px ${STEP}px)`,
          filter: "blur(1px)",
        }} />

        {/* end wall (featured glow) */}
        <div className="absolute left-1/2" style={{
          transform: `translate(-50%, -50%) translateZ(${-stationCount * STEP - 620}px) translateY(${WALL_H}px)`,
          width: HALF_W * 2, height: 640,
          background: `radial-gradient(55% 45% at 50% 45%, color-mix(in oklch, var(--gfx-1) 30%, transparent), oklch(0.07 0.015 280) 78%)`,
          boxShadow: "0 0 140px -18px color-mix(in oklch, var(--gfx-1) 45%, transparent)",
        }} />

        {/* artworks on the walls */}
        {projects.map((p, i) => {
          const side = i % 2 === 0 ? -1 : 1;
          const station = stationOf(i);
          const z = -(station + 1) * STEP;
          const { lift, sizeDelta, tilt } = placement(i);
          const { bg, isVideo } = mediaOf(p);
          const isFocused = i === focused;
          const w = 226 + sizeDelta, h = 296 + sizeDelta;
          return (
            <div key={`${i}-${p.locked ? "locked" : "open"}`} className="absolute left-1/2 top-1/2"
              style={{
                transformStyle: "preserve-3d",
                transform: `translate(-50%, -50%) translateX(${side * (HALF_W - 6)}px) translateZ(${z}px) rotateY(${side * -90}deg) rotateZ(${tilt}deg)`,
              }}>
              {/* wall-wash halo */}
              <div aria-hidden className="pointer-events-none absolute rounded-full" style={{
                left: "50%", top: "42%", width: 430, height: 560, transform: "translate(-50%,-50%)",
                background: `radial-gradient(closest-side, ${p.color || "var(--gfx-1)"}${isFocused ? "3a" : "20"}, transparent 72%)`,
                transition: "opacity .5s", opacity: isFocused ? 1 : 0.55,
              }} />
              {/* ceiling spotlight cone */}
              <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-300px] h-[300px] w-[260px] -translate-x-1/2" style={{
                background: `linear-gradient(to bottom, oklch(0.95 0.04 95 / .5), transparent)`,
                clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)",
                filter: "blur(2px)", opacity: isFocused ? 0.95 : 0.5, transition: "opacity .4s",
              }} />
              {/* the frame */}
              <button type="button" data-cursor-hover
                onClick={() => (p.locked ? onOpen(i) : focusArtwork(i, true))}
                className={cn("group relative block overflow-hidden rounded-md border-[12px] shadow-2xl transition-[box-shadow,transform] duration-500",
                  p.locked ? "border-stone-700/80" : "border-stone-900/90")}
                style={{
                  width: w, height: h, transform: `translateY(${lift}px) ${isFocused ? "translateZ(14px)" : ""}`,
                  boxShadow: isFocused
                    ? `0 0 90px -10px ${p.color || "var(--gfx-1)"}, 0 34px 44px -18px black`
                    : "0 26px 40px -18px black",
                }}>
                {p.locked ? (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background/60">
                    <Lock className="size-8 text-[var(--sec-1)]" />
                    <span className="px-4 text-xs font-bold text-foreground">{p.title}</span>
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
              {/* museum placard */}
              <div className="absolute flex items-center gap-1.5 rounded-sm border border-stone-500/40 bg-stone-800/85 px-2 py-1 backdrop-blur-sm"
                style={{ transform: `translateY(40px) translateY(${lift}px)`, bottom: 0, [side === -1 ? "right" : "left"]: "4px" } as React.CSSProperties}>
                <p className="max-w-[170px] truncate text-[10px] font-bold text-stone-100">{p.title}</p>
                <p className="font-mono text-[8px] text-stone-300/80">{[p.category, p.year].filter(Boolean).join("·")}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── HUD: caption ── */}
      {caption && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
          <p className="max-w-md truncate rounded-full border border-white/15 bg-black/55 px-4 py-1.5 text-xs text-white/90 backdrop-blur">
            {fa ? "روبه‌روی شما: " : "Facing: "}
            <span className="font-bold">{caption.title}</span>
            <span className="ms-2 opacity-60">{[caption.category, caption.year].filter(Boolean).join(" · ")}</span>
          </p>
        </div>
      )}

      {/* ── minimap ── */}
      <div className="absolute bottom-4 start-4 z-20 rounded-xl border border-white/15 bg-black/55 p-2 backdrop-blur" aria-label={fa ? "نقشه گالری" : "gallery map"}>
        <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
          <rect x={PAD - 4} y={PAD - 4} width={MAP_W - (PAD - 4) * 2} height={MAP_H - (PAD - 4) * 2} rx="6"
            fill="oklch(0.16 0.02 280 / .8)" stroke="oklch(0.5 0.03 280 / .6)" strokeWidth="1" />
          {projects.map((p, i) => {
            const side = i % 2 === 0 ? -1 : 1;
            const y = zToMap((stationOf(i) + 1) * STEP);
            const x = MAP_W / 2 + side * ((MAP_W - PAD * 2) / 2 - 3);
            return (
              <g key={i}>
                <rect x={x - 3} y={y - 3} width="6" height="6" rx="1"
                  fill={i === focused ? (p.color || "var(--gfx-1)") : "oklch(0.75 0.05 285 / .85)"}
                  opacity={i === focused ? 1 : 0.65} />
                <text x={MAP_W / 2 + side * 10} y={y + 2.5} fontSize="6" fill="oklch(0.85 0.02 285 / .8)" textAnchor="middle" fontFamily="monospace">
                  {i + 1}
                </text>
              </g>
            );
          })}
          <line x1={MAP_W / 2} y1={PAD} x2={MAP_W / 2} y2={MAP_H - PAD} stroke="oklch(0.6 0.03 285 / .35)" strokeWidth="1" strokeDasharray="2 3" />
          <g transform={`translate(${MAP_W / 2} ${visitorMapY}) rotate(${(-yaw * 0.9).toFixed(1)})`}>
            <path d="M0 0 L-5 -9 A10 10 0 0 1 5 -9 Z" fill="var(--gfx-1)" opacity="0.55" />
            <circle r="3" fill="white" />
          </g>
        </svg>
        <p className="mt-1 text-center font-mono text-[7px] uppercase tracking-widest text-white/45">
          {fa ? `${toFa(projects.length)} اثر · ${toFa(stationCount)} ایستگاه` : `${projects.length} works · ${stationCount} stops`}
        </p>
      </div>

      {/* ── bottom controls ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4">
        {focused >= 0 && projects[focused] && !projects[focused].locked && (
          <button type="button"
            onClick={() => focusArtwork(focused, true)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/60 px-4 py-1.5 text-xs font-bold text-white backdrop-blur transition hover:bg-black/80">
            <BookOpen className="size-3.5" style={{ color: projects[focused].color || "var(--gfx-1)" }} />
            {fa ? "بازکردن کاتالوگ اثر" : "open catalogue"}
            <span className="font-mono text-[9px] opacity-60">Enter</span>
          </button>
        )}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* RTL-aware: in fa the "next stop" arrow points LEFT */}
          <button type="button"
            onClick={() => goToStation(nearestStation + (fa ? -1 : 1))}
            disabled={fa ? nearestStation >= stationCount - 1 : nearestStation <= 0}
            className="grid size-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-30"
            aria-label={fa ? "ایستگاه بعدی" : "previous stop"}>
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-2 backdrop-blur">
            {Array.from({ length: stationCount }).map((_, s) => (
              <button key={s} type="button" onClick={() => goToStation(s)} aria-label={`station ${s + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{ width: s === nearestStation ? 24 : 7, background: s === nearestStation ? "var(--gfx-1)" : "rgba(255,255,255,.35)" }} />
            ))}
          </div>
          <button type="button"
            onClick={() => goToStation(nearestStation + (fa ? 1 : -1))}
            disabled={fa ? nearestStation <= 0 : nearestStation >= stationCount - 1}
            className="grid size-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-30"
            aria-label={fa ? "ایستگاه قبلی" : "next stop"}>
            <ChevronRight className="size-5" />
          </button>
        </div>
        <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-white/45">
          <MoveHorizontal className="size-3" />
          {fa ? "درگ = نگاه · اسکرول/W,S = قدم · Tab = روبروی اثر · Enter = کاتالوگ" : "drag = look · scroll/W,S = walk · Tab = face artwork · Enter = catalogue"}
        </p>
      </div>
    </div>
  );
}

function toFa(n: number): string {
  const d = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (x) => d[+x]);
}
