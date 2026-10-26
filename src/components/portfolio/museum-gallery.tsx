"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { BookOpen, Compass, Lock, MousePointer2, Radar, Rocket, ShieldAlert } from "lucide-react";
import { useContent } from "@/lib/content-store";
import type { ProjectArtwork } from "@/lib/content-types";
import { cn } from "@/lib/utils";
import { createSpaceshipExperience, type SpaceshipExperience } from "./spaceship/engine";
import { HUB_R, layoutWings, type FocusInfo, type WingDef } from "./spaceship/types";
import { OrbitalLoader } from "./orbital-loader";

export function MuseumGallery({
  lang,
  spawnWingId,
  paused = false,
  onOpenCatalog,
  onOpenResumeBook,
  onRequestUnlock,
}: {
  lang: "fa" | "en";
  spawnWingId?: string;
  paused?: boolean;
  onOpenCatalog: (project: ProjectArtwork, wingLabel: string) => void;
  onOpenResumeBook?: () => void;
  onRequestUnlock: (target: string, label: string) => void;
}) {
  const fa = lang === "fa";
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapPlayerRef = useRef<SVGGElement>(null);
  const experienceRef = useRef<SpaceshipExperience | null>(null);
  const [inputGeneration, setInputGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState(true);
  const [fade, setFade] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [focused, setFocused] = useState<FocusInfo | null>(null);
  const [locked, setLocked] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [error, setError] = useState(false);
  const systemReducedMotion = useReducedMotion();

  const contentEn = useContent((state) => state.contentEn);
  const contentFa = useContent((state) => state.contentFa);
  const customs = useContent((state) => state.customs);
  const guardSections = useContent((state) => state.guardSections);
  const guardUnlocked = useContent((state) => state.guardUnlocked);
  const activeLang = useContent((state) => state.lang);
  const frameRate = useContent((state) => state.content.builder?.performance?.frameRate) ?? 60;
  const animationMode = useContent((state) => state.content.builder?.performance?.animationMode) ?? "normal";
  const reducedMotion = Boolean(systemReducedMotion) || animationMode === "off" || animationMode === "reduced";

  const wings = useMemo<WingDef[]>(() => {
    const output: WingDef[] = [];
    const source = activeLang === "fa" ? contentFa : contentEn;
    const accentOf: Record<string, string> = { graphics: "#a78bfa", security: "#34d399", ai: "#38bdf8" };
    const labels: Record<string, { fa: string; en: string }> = {
      graphics: { fa: "راهرو گرافیک", en: "Graphics Deck" },
      security: { fa: "راهرو امنیت", en: "Security Deck" },
      ai: { fa: "راهرو هوش مصنوعی", en: "AI Deck" },
    };
    const galleryLocked = (id: string) => {
      const lock = guardSections[`gallery:${id}`];
      return Boolean(lock?.enabled && lock.hasPassword && !guardUnlocked.includes(`gallery:${id}`));
    };
    for (const id of ["graphics", "security", "ai"] as const) {
      const gallery = (source as unknown as Record<string, { gallery?: { projects?: ProjectArtwork[] } }>)[id]?.gallery;
      if (!gallery || !Array.isArray(gallery.projects) || gallery.projects.length === 0) continue;
      output.push({ id, label: fa ? labels[id].fa : labels[id].en, color: accentOf[id], locked: galleryLocked(id), projects: gallery.projects });
    }
    for (const [id, data] of Object.entries(customs ?? {})) {
      const gallery = (data as { fa?: { gallery?: { projects?: ProjectArtwork[] } }; en?: { gallery?: { projects?: ProjectArtwork[] } } })[activeLang]?.gallery;
      if (!gallery || !Array.isArray(gallery.projects) || gallery.projects.length === 0) continue;
      output.push({ id, label: id.replace(/^custom-/, ""), color: "#f59e0b", locked: galleryLocked(id), projects: gallery.projects });
    }
    return output;
  }, [contentEn, contentFa, customs, guardSections, guardUnlocked, activeLang, fa]);
  const layouts = useMemo(() => layoutWings(wings), [wings]);
  const handlersRef = useRef({ onOpenCatalog, onRequestUnlock, onOpenResumeBook });
  useEffect(() => {
    handlersRef.current = { onOpenCatalog, onRequestUnlock, onOpenResumeBook };
  }, [onOpenCatalog, onRequestUnlock, onOpenResumeBook]);

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || layouts.length === 0) return;
    setError(false);
    setReady(false);
    const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4);
    const lowPower = (navigator.hardwareConcurrency || 4) <= 2 || memory <= 2;
    try {
      const experience = createSpaceshipExperience({
        mount,
        layouts,
        lang,
        spawnWingId,
        coarse,
        lowPower,
        reducedMotion,
        frameRate,
        onReady: () => setReady(true),
        onFocus: setFocused,
        onPointerLock: setLocked,
        onPlayerMove: (x, z, yaw, jump) => {
          const marker = minimapPlayerRef.current;
          if (!marker) return;
          const size = 150;
          const scale = size / (layouts.reduce((max, layout) => Math.max(max, layout.length + HUB_R), HUB_R + 6) * 2);
          marker.setAttribute("transform", `translate(${(size / 2 - x * scale).toFixed(1)} ${(size / 2 + z * scale).toFixed(1)}) rotate(${(-yaw * 180 / Math.PI).toFixed(1)})`);
          marker.setAttribute("aria-label", `Visitor x ${x.toFixed(2)} z ${z.toFixed(2)} jump ${jump.toFixed(2)}`);
        },
        onOpenCatalog: (project, wingLabel) => handlersRef.current.onOpenCatalog(project, wingLabel),
        onOpenResumeBook: () => handlersRef.current.onOpenResumeBook?.(),
        onRequestUnlock: (target, label) => handlersRef.current.onRequestUnlock(target, label),
      });
      experienceRef.current = experience;
      setInputGeneration((generation) => generation + 1);
      const debugWindow = window as unknown as { __museumDebug?: () => unknown; __museumInteract?: () => void; __museumTeleport?: (id: string) => boolean; __museumJoy?: { x: number; y: number } };
      debugWindow.__museumDebug = experience.debug;
      debugWindow.__museumInteract = experience.interact;
      debugWindow.__museumTeleport = experience.teleport;
      debugWindow.__museumJoy = experience.joystick;
      return () => {
        experience.dispose();
        experienceRef.current = null;
        delete debugWindow.__museumDebug;
        delete debugWindow.__museumInteract;
        delete debugWindow.__museumTeleport;
        delete debugWindow.__museumJoy;
      };
    } catch {
      setError(true);
      setReady(false);
    }
  }, [layouts, lang, spawnWingId, coarse, reducedMotion, frameRate]);

  useEffect(() => {
    experienceRef.current?.setPaused(paused || intro || error);
  }, [paused, intro, error, ready]);

  const switchWing = useCallback((wing: WingDef) => {
    if (wing.locked) {
      onRequestUnlock(`gallery:${wing.id}`, wing.label);
      return;
    }
    setFade(true);
    window.setTimeout(() => {
      experienceRef.current?.teleport(wing.id);
      setFade(false);
      setToast(fa ? `ورود به ${wing.label}` : `Entering ${wing.label}`);
      window.setTimeout(() => setToast(null), 2200);
    }, reducedMotion ? 0 : 320);
  }, [fa, onRequestUnlock, reducedMotion]);

  const joystickRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const base = joystickRef.current;
    const joystick = experienceRef.current?.joystick;
    if (!base || !joystick || !coarse || !ready) return;
    const knob = base.querySelector<HTMLDivElement>("[data-knob]")!;
    let pointerId = -1;
    let centerX = 0;
    let centerY = 0;
    const radius = 42;
    const set = (dx: number, dy: number) => {
      const length = Math.hypot(dx, dy);
      const ratio = length > radius ? radius / length : 1;
      const x = dx * ratio;
      const y = dy * ratio;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      joystick.x = x / radius;
      joystick.y = y / radius;
    };
    const down = (event: PointerEvent) => {
      event.stopPropagation();
      pointerId = event.pointerId;
      const rect = base.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      base.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      event.stopPropagation();
      set(event.clientX - centerX, event.clientY - centerY);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = -1;
      set(0, 0);
    };
    base.addEventListener("pointerdown", down);
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", up);
    base.addEventListener("pointercancel", up);
    return () => {
      base.removeEventListener("pointerdown", down);
      base.removeEventListener("pointermove", move);
      base.removeEventListener("pointerup", up);
      base.removeEventListener("pointercancel", up);
      joystick.x = joystick.y = 0;
    };
  }, [coarse, ready, inputGeneration, intro]);

  const minimap = useMemo(() => {
    const size = 150;
    const scale = size / (layouts.reduce((max, layout) => Math.max(max, layout.length + HUB_R), HUB_R + 6) * 2);
    return { size, scale, px: (x: number) => size / 2 - x * scale, pz: (z: number) => size / 2 + z * scale };
  }, [layouts]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#01030a] text-white">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(0,4,12,.34)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-black/45 to-transparent" />

      {!ready && !error && <OrbitalLoader lang={lang} label={fa ? "آماده‌سازی ایستگاه فضایی و راهروها…" : "Preparing the station and exhibition decks…"} className="bg-[#020711]" />}

      {error && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-[#050b14]/95 p-6 backdrop-blur-xl">
          <div className="mx-auto max-w-3xl py-10">
            <ShieldAlert className="size-8 text-amber-300" />
            <h2 className="mt-4 text-2xl font-black">{fa ? "نمایش سه‌بعدی در دسترس نیست" : "3D view is unavailable"}</h2>
            <p className="mt-2 text-sm leading-7 text-white/60">{fa ? "WebGL مرورگر فعال نیست؛ همچنان می‌توانید کتاب پروژه‌ها را باز کنید." : "WebGL is unavailable. You can still open the project books."}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {wings.flatMap((wing) => wing.projects.map((project) => (
                <button key={`${wing.id}-${project.title}`} type="button" onClick={() => onOpenCatalog(project, wing.label)} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-start transition hover:border-cyan-300/40 hover:bg-cyan-300/5">
                  <span className="text-xs text-cyan-200/60">{wing.label}</span>
                  <span className="mt-1 block font-bold">{project.title}</span>
                </button>
              )))}
            </div>
          </div>
        </div>
      )}

      {focused && !intro && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
          <div className={cn("flex max-w-lg items-center gap-2 rounded-md border px-4 py-2 text-xs shadow-2xl backdrop-blur-xl", focused.kind === "project" ? "border-cyan-200/20 bg-[#07121d]/75 text-cyan-50" : "border-amber-400/40 bg-amber-950/70 text-amber-200")}>
            {focused.kind !== "project" && <Lock className="size-3.5 shrink-0" />}
            <span className="truncate font-bold">{focused.title}</span>
            {focused.sub && <span className="truncate opacity-60">· {focused.sub}</span>}
          </div>
        </div>
      )}

      {focused && !intro && (
        <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
          <button type="button" onClick={() => experienceRef.current?.interact()} className={cn("inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-bold shadow-xl backdrop-blur-xl transition", focused.kind === "project" ? "border-cyan-200/30 bg-[#07131f]/80 text-cyan-50 hover:bg-[#0c2233]/90" : "border-amber-400/50 bg-amber-950/80 text-amber-200")}>
            {focused.kind === "project" ? <BookOpen className="size-4" /> : <Lock className="size-4" />}
            {focused.kind === "project" ? (focused.wingLabel === (fa ? "درباره من" : "About me") ? (fa ? "باز کردن کتاب من" : "Open my book") : (fa ? "باز کردن کتاب پروژه" : "Open project book")) : (fa ? "ورود با رمز" : "Enter password")}
            <span className="font-mono text-[9px] opacity-50">ENTER</span>
          </button>
        </div>
      )}

      {!intro && !error && (
        <div className="absolute bottom-4 start-4 z-20 rounded-lg border border-cyan-100/15 bg-[#03101a]/70 p-2 shadow-2xl backdrop-blur-xl" aria-label={fa ? "نقشه فضاپیما" : "spacecraft map"}>
          <svg width={minimap.size} height={minimap.size} viewBox={`0 0 ${minimap.size} ${minimap.size}`}>
            <circle cx={75} cy={75} r={HUB_R * minimap.scale} fill="rgba(6,24,38,.85)" stroke="rgba(103,232,249,.35)" strokeWidth="1" />
            {layouts.map((layout) => {
              const x1 = minimap.px(layout.dir.x * HUB_R);
              const z1 = minimap.pz(layout.dir.z * HUB_R);
              const x2 = minimap.px(layout.dir.x * (HUB_R + layout.length - 2));
              const z2 = minimap.pz(layout.dir.z * (HUB_R + layout.length - 2));
              const length = Math.hypot(x2 - x1, z2 - z1);
              const angle = Math.atan2(z2 - z1, x2 - x1) * 180 / Math.PI;
              return (
                <g key={layout.def.id} transform={`translate(${x1} ${z1}) rotate(${angle})`}>
                  <rect x="0" y={-(layout.width / 2) * minimap.scale} width={length} height={layout.width * minimap.scale} rx="1" fill="rgba(5,22,35,.85)" stroke={layout.def.locked ? "#e8c46a" : "rgba(103,232,249,.28)"} strokeWidth="1" strokeDasharray={layout.def.locked ? "3 2" : undefined} />
                  {layout.def.projects.map((project, index) => <rect key={index} x={(3.4 + Math.floor(index / 2) * 5.2 - HUB_R) * minimap.scale - 1.5} y={(index % 2 ? 1 : -1) * (layout.width / 2) * minimap.scale - 1.5} width="3" height="3" fill={project.locked ? "#e8c46a" : layout.def.color} />)}
                </g>
              );
            })}
            <g ref={minimapPlayerRef} role="img" aria-label="Visitor position"><path d="M0 0 L-5 -8 A9 9 0 0 1 5 -8 Z" fill="#67e8f9" opacity=".55" /><circle r="3" fill="white" /></g>
          </svg>
          <p className="mt-1 flex items-center justify-center gap-1 font-mono text-[7px] uppercase tracking-widest text-cyan-100/45"><Radar className="size-2.5" />{fa ? `${toFa(wings.reduce((sum, wing) => sum + wing.projects.length, 0))} پروژه · ${toFa(wings.length)} راهرو` : `${wings.reduce((sum, wing) => sum + wing.projects.length, 0)} projects · ${wings.length} decks`}</p>
        </div>
      )}

      {!locked && !intro && !coarse && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <p className="flex items-center gap-2 rounded-md border border-white/5 bg-black/50 px-4 py-1.5 font-mono text-[9px] uppercase tracking-widest text-cyan-50/50 backdrop-blur"><MousePointer2 className="size-3" />{fa ? "کلیک = نگاه · WASD = حرکت · SPACE = پرش · SHIFT = سرعت" : "Click = look · WASD = walk · Space = jump · Shift = run"}</p>
        </div>
      )}

      {wings.length > 1 && !intro && (
        <div className="absolute end-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
          {wings.map((wing) => (
            <button key={wing.id} type="button" onClick={() => switchWing(wing)} className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] font-bold backdrop-blur-xl transition", wing.id === spawnWingId ? "border-cyan-200/35 bg-cyan-200/10 text-cyan-50" : "border-white/10 bg-[#020b14]/60 text-white/60 hover:bg-[#0a1c29]/80")}>
              <span className="size-1.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: wing.locked ? "#e8c46a" : wing.color }} />
              <span className="max-w-24 truncate">{wing.label}</span>
            </button>
          ))}
        </div>
      )}

      {toast && <div className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-md border border-cyan-200/20 bg-[#06131e]/90 px-5 py-2 text-sm font-bold text-cyan-50 shadow-xl backdrop-blur-xl">{toast}</div>}
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-40 bg-black transition-opacity duration-300", fade ? "opacity-100" : "opacity-0")} />

      {intro && (
        <div data-museum-intro className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-[#01050c]/85 p-5 backdrop-blur-xl">
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-100/15 bg-[#07111c]/95 p-7 shadow-[0_30px_100px_rgba(0,0,0,.65)] md:p-9">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
            <div className="flex items-center gap-3 text-cyan-300"><Rocket className="size-5" /><p className="font-mono text-[10px] uppercase tracking-[0.35em]">P00RIJA / ORBITAL ARCHIVE</p></div>
            <h2 className="mt-5 text-2xl font-black text-white md:text-3xl">{fa ? "به آرشیو مداری خوش آمدید" : "Welcome aboard the orbital archive"}</h2>
            <p className="mt-3 text-xs leading-6 text-slate-300/70 md:text-sm md:leading-7">{fa ? "در راهروهای فضاپیما قدم بزنید، از پنجره‌ها به فضا نگاه کنید و کتاب سه‌بعدی هر پروژه را ورق بزنید." : "Walk the spacecraft corridors, look into deep space, and open each project's three-dimensional book."}</p>
            <div className="mt-6 grid gap-3 border-y border-white/8 py-5 text-[11px] text-slate-300/75 sm:grid-cols-2">
              <p><MousePointer2 className="mb-2 size-4 text-cyan-300" />{coarse ? (fa ? "کشیدن صفحه برای چرخش نگاه" : "Drag to look around") : (fa ? "WASD و موس برای حرکت و نگاه" : "WASD and mouse to move and look")}</p>
              <p><BookOpen className="mb-2 size-4 text-cyan-300" />{fa ? "ENTER یا لمس برای باز کردن کتاب" : "Enter or tap to open a book"}</p>
              <p><Compass className="mb-2 size-4 text-cyan-300" />{fa ? "راهنمای کنار صفحه برای تعویض راهرو" : "Deck guide to switch corridors"}</p>
              <p><Radar className="mb-2 size-4 text-cyan-300" />{fa ? "نقشهٔ زنده برای مکان‌یابی" : "Live map for navigation"}</p>
            </div>
            <button type="button" onClick={() => setIntro(false)} className="mt-6 w-full rounded-lg border border-cyan-200/30 bg-cyan-300/10 px-8 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/20">{fa ? "ورود به فضاپیما" : "Board the spacecraft"}</button>
          </div>
        </div>
      )}

      {coarse && ready && !intro && (
        <div ref={joystickRef} className="absolute bottom-6 end-6 z-30 grid size-28 touch-none place-items-center rounded-full border border-cyan-100/20 bg-[#07141e]/40 shadow-[inset_0_0_30px_rgba(56,189,248,.08)] backdrop-blur-md" aria-label={fa ? "دسته حرکت" : "movement joystick"}>
          <div data-knob className="size-11 rounded-full border border-cyan-100/30 bg-cyan-100/15 shadow-[0_0_18px_rgba(56,189,248,.18)]" />
        </div>
      )}
    </div>
  );
}

function toFa(value: number) {
  const digits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(value).replace(/\d/g, (digit) => digits[+digit]);
}
