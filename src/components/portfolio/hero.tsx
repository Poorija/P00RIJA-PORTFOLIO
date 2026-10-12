"use client";

import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { useContent } from "@/lib/content-store";
import { MagneticButton } from "./magnetic-button";

/* ============================================================
   Hero — bilingual, three interactive 3D "world" cards on top,
   text content below, clickable SCROLL hint that smooth-scrolls.
   ============================================================ */

type WorldKey = "gfx" | "sec" | "ai";

const SECTION_TARGET: Record<WorldKey, string> = {
  gfx: "graphics",
  sec: "security",
  ai: "ai",
};

const SENSITIVITY: Record<WorldKey, number> = {
  gfx: 14,
  sec: 9,
  ai: 20,
};

export function Hero() {
  const hero = useContent((s) => s.content.hero);
  const lang = useContent((s) => s.lang);

  const tiltRefs = useRef<Record<WorldKey, HTMLDivElement | null>>({
    gfx: null,
    sec: null,
    ai: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    let raf = 0;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const onMove = (e: MouseEvent) => {
      target.x = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      target.y = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };
    const loop = () => {
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      (Object.keys(tiltRefs.current) as WorldKey[]).forEach((key) => {
        const el = tiltRefs.current[key];
        if (!el) return;
        const sens = SENSITIVITY[key];
        el.style.transform = `rotateX(${-current.y * sens}deg) rotateY(${current.x * sens}deg)`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const scrollTo = (id: string) => () =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const scrollDown = () =>
    document.getElementById("graphics")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section
      id="home"
      data-cursor-zone="default"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pt-24 pb-10"
    >
      {/* === Top: three interactive 3D world cards === */}
      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
          <WorldCard
            world="gfx"
            tiltRef={(el) => { tiltRefs.current.gfx = el; }}
            label={hero.worlds.gfx.label}
            hint={hero.worlds.gfx.hint}
            onClick={scrollTo(SECTION_TARGET.gfx)}
            delay={0.2}
          />
          <WorldCard
            world="sec"
            tiltRef={(el) => { tiltRefs.current.sec = el; }}
            label={hero.worlds.sec.label}
            hint={hero.worlds.sec.hint}
            onClick={scrollTo(SECTION_TARGET.sec)}
            delay={0.35}
          />
          <WorldCard
            world="ai"
            tiltRef={(el) => { tiltRefs.current.ai = el; }}
            label={hero.worlds.ai.label}
            hint={hero.worlds.ai.hint}
            onClick={scrollTo(SECTION_TARGET.ai)}
            delay={0.5}
          />
        </div>
      </div>

      {/* === Bottom: text content === */}
      <div className="relative z-10 mx-auto mt-14 w-full max-w-3xl text-center md:mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-muted-foreground backdrop-blur"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {hero.badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-balance text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
        >
          {hero.titleLine1}{" "}
          <span className="text-gradient-tri">{hero.titleHighlight}</span>{" "}
          {hero.titleLine2}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          {hero.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-7 flex flex-wrap items-center justify-center gap-3"
        >
          <MagneticButton strength={0.4}>
            <button
              onClick={scrollTo(SECTION_TARGET.gfx)}
              data-cursor-hover
              className="btn-solid-neutral group relative overflow-hidden rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
            >
              <span className="relative flex items-center gap-2">
                {hero.ctaPrimary}
                <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              </span>
            </button>
          </MagneticButton>
          <MagneticButton strength={0.25}>
            <a
              href="#contact"
              data-cursor-hover
              className="btn-outline-neutral block rounded-full px-6 py-3 text-sm font-medium transition-all"
            >
              {hero.ctaSecondary}
            </a>
          </MagneticButton>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-8 flex items-center justify-center gap-8"
        >
          {hero.stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Clickable SCROLL hint — smooth scroll on click */}
      <motion.button
        type="button"
        onClick={scrollDown}
        data-cursor-hover
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="group absolute bottom-6 left-1/2 -translate-x-1/2 cursor-pointer outline-none"
        aria-label={lang === "fa" ? "پیمایش به پایین" : "Scroll down"}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-2 text-muted-foreground transition-colors group-hover:text-foreground"
        >
          <span className="font-mono text-[10px] tracking-[0.3em]">{lang === "fa" ? "پایین" : "SCROLL"}</span>
          <ArrowDown className="h-4 w-4" />
        </motion.div>
      </motion.button>
    </section>
  );
}

/* ============================================================
   WorldCard — a card holding one interactive 3D world object,
   with hover label/hint and click-to-navigate.
   ============================================================ */
function WorldCard({
  world,
  tiltRef,
  label,
  hint,
  onClick,
  delay,
}: {
  world: WorldKey;
  tiltRef: (el: HTMLDivElement | null) => void;
  label: string;
  hint: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      data-cursor-zone={world}
      data-cursor-hover
      aria-label={`${label} — ${hint}`}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -8 }}
      className="group relative flex min-h-[340px] flex-col items-center justify-center rounded-3xl border p-8 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:p-10"
      style={{
        // Glassmorphism: translucent, blur, border, layered gradient + inner highlights
        background:
          "linear-gradient(135deg, color-mix(in oklch, var(--card) 55%, transparent), color-mix(in oklch, var(--surface-1) 35%, transparent))",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        borderColor: "color-mix(in oklch, var(--foreground) 10%, transparent)",
        boxShadow:
          "inset 0 1px 0 color-mix(in oklch, var(--foreground) 12%, transparent), inset 0 0 60px color-mix(in oklch, var(--" + world + "-1) 8%, transparent), 0 20px 50px -20px oklch(0 0 0 / 0.5)",
      }}
    >
      {/* hover glow border */}
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, var(--${world}-1), var(--${world}-3))`,
          maskImage: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1.5px",
        }}
      />
      {/* glow halo */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ background: `radial-gradient(circle, var(--${world}-glow), transparent 70%)` }}
      />

      {/* 3D object — bigger */}
      <div style={{ perspective: "1000px" }} className="relative grid h-40 place-items-center sm:h-44">
        <div
          ref={tiltRef}
          className="preserve-3d"
          style={{ transformStyle: "preserve-3d", transform: "rotateX(0deg) rotateY(0deg)", willChange: "transform" }}
        >
          <div className="preserve-3d transition-transform duration-300 ease-out group-hover:scale-[1.15]" style={{ transformStyle: "preserve-3d" }}>
            <div
              className="preserve-3d"
              style={{
                transformStyle: "preserve-3d",
                transform:
                  world === "gfx"
                    ? "rotateX(-18deg) rotateY(28deg)"
                    : world === "sec"
                    ? "rotateX(-22deg) rotateY(32deg)"
                    : "rotateX(-15deg) rotateY(0deg)",
              }}
            >
              {world === "gfx" && <GraphicsCrystal />}
              {world === "sec" && <SecurityCube />}
              {world === "ai" && <AIOrb />}
            </div>
          </div>
        </div>
      </div>

      {/* label + hint */}
      <div className="relative mt-8 flex flex-col items-center">
        <span className="font-mono text-sm font-semibold tracking-[0.25em] sm:text-base" style={{ color: `var(--${world}-1)` }}>
          {label}
        </span>
        <span className="mt-2 text-center text-xs text-muted-foreground sm:text-sm">{hint}</span>
      </div>
    </motion.button>
  );
}

/* === GRAPHICS world — holographic stacked gradient crystal === */
function GraphicsCrystal() {
  const layers = [
    { rotY: 0, rotX: 0, z: 28, c1: 1, c2: 2, opacity: 0.85 },
    { rotY: 35, rotX: 18, z: 14, c1: 2, c2: 3, opacity: 0.7 },
    { rotY: -35, rotX: -12, z: 0, c1: 3, c2: 1, opacity: 0.6 },
    { rotY: 70, rotX: 28, z: -14, c1: 2, c2: 1, opacity: 0.7 },
    { rotY: -70, rotX: -24, z: -28, c1: 1, c2: 3, opacity: 0.85 },
  ];
  return (
    <motion.div
      animate={{ rotateY: 360 }}
      transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      className="preserve-3d relative h-32 w-32 sm:h-36 sm:w-36"
      style={{ transformStyle: "preserve-3d" }}
    >
      {layers.map((layer, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-xl"
          style={{
            transform: `rotateY(${layer.rotY}deg) rotateX(${layer.rotX}deg) translateZ(${layer.z}px)`,
            background: `linear-gradient(135deg, var(--gfx-${layer.c1}), color-mix(in oklch, var(--gfx-${layer.c2}) 55%, transparent))`,
            opacity: layer.opacity,
            border: "1px solid color-mix(in oklch, var(--gfx-1) 45%, transparent)",
            boxShadow: "0 0 30px var(--gfx-glow), inset 0 0 18px color-mix(in oklch, var(--gfx-1) 30%, transparent)",
            backfaceVisibility: "visible",
          }}
        />
      ))}
      <div
        className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, var(--gfx-3), color-mix(in oklch, var(--gfx-1) 50%, transparent) 60%, transparent 75%)",
          filter: "blur(3px)",
        }}
      />
    </motion.div>
  );
}

/* === SECURITY world — wireframe cube with corner nodes === */
function SecurityCube() {
  const faces = [
    "translateZ(var(--half))",
    "rotateY(180deg) translateZ(var(--half))",
    "rotateY(90deg) translateZ(var(--half))",
    "rotateY(-90deg) translateZ(var(--half))",
    "rotateX(90deg) translateZ(var(--half))",
    "rotateX(-90deg) translateZ(var(--half))",
  ];
  const signs = [-1, 1];
  const corners = signs.flatMap((x) => signs.flatMap((y) => signs.map((z) => ({ x, y, z }))));
  return (
    <motion.div
      animate={{ rotateY: 360 }}
      transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      className="preserve-3d relative h-32 w-32 sm:h-36 sm:w-36 [--half:56px] sm:[--half:64px]"
      style={{ transformStyle: "preserve-3d" }}
    >
      {faces.map((transform, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-sm"
          style={{
            transform,
            border: "1px solid color-mix(in oklch, var(--sec-1) 65%, transparent)",
            background: "color-mix(in oklch, var(--sec-1) 5%, transparent)",
            boxShadow: "0 0 14px color-mix(in oklch, var(--sec-1) 30%, transparent), inset 0 0 14px color-mix(in oklch, var(--sec-1) 12%, transparent)",
            backfaceVisibility: "visible",
          }}
        />
      ))}
      {corners.map((c, i) => (
        <div
          key={`n${i}`}
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            transform: `translate3d(calc(${c.x} * var(--half)), calc(${c.y} * var(--half)), calc(${c.z} * var(--half)))`,
            background: "var(--sec-1)",
            boxShadow: "0 0 8px var(--sec-1), 0 0 16px var(--sec-glow)",
          }}
        />
      ))}
    </motion.div>
  );
}

/* === AI world — neural orb with orbital rings === */
function AIOrb() {
  const orbits = [
    { tilt: 72, size: 108, duration: "9s", reverse: false, color: 1, dot: "h-2.5 w-2.5" },
    { tilt: -52, size: 92, duration: "7s", reverse: true, color: 2, dot: "h-2 w-2" },
    { tilt: 18, size: 124, duration: "12s", reverse: false, color: 3, dot: "h-2 w-2" },
  ];
  return (
    <div className="preserve-3d relative h-32 w-32 sm:h-36 sm:w-36" style={{ transformStyle: "preserve-3d" }}>
      <div
        className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle at 30% 30%, var(--ai-2), var(--ai-3) 65%, var(--ai-1))",
          boxShadow: "0 0 36px var(--ai-glow), inset -5px -5px 12px color-mix(in oklch, var(--ai-3) 55%, transparent), inset 4px 4px 10px color-mix(in oklch, var(--ai-2) 60%, transparent)",
        }}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-11 w-11 rounded-full animate-pulse-glow"
          style={{
            background: "radial-gradient(circle, color-mix(in oklch, var(--ai-1) 65%, transparent), transparent 70%)",
            filter: "blur(2px)",
          }}
        />
      </div>
      {orbits.map((o, i) => (
        <div key={i} className="absolute inset-0" style={{ transform: `rotateX(${o.tilt}deg)`, transformStyle: "preserve-3d" }}>
          <div
            className={o.reverse ? "absolute inset-0 animate-spin-reverse-slow" : "absolute inset-0 animate-spin-slow"}
            style={{ animationDuration: o.duration, transformStyle: "preserve-3d" }}
          >
            <div
              className="absolute rounded-full border"
              style={{
                width: o.size, height: o.size, left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                borderColor: "color-mix(in oklch, var(--ai-1) 25%, transparent)",
              }}
            />
            <div
              className={`absolute left-1/2 top-1/2 ${o.dot} rounded-full`}
              style={{
                transform: `translate(-50%, -50%) translateY(-${o.size / 2}px)`,
                background: `var(--ai-${o.color})`,
                boxShadow: `0 0 10px var(--ai-${o.color}), 0 0 20px var(--ai-glow)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
