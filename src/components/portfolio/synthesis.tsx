"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles, Shield, Brain, ArrowLeft } from "lucide-react";
import { Reveal } from "./section-utils";
import { useContent } from "@/lib/content-store";

/* =========================================================================
   Convergence diagram geometry — pure module-scope helpers.
   3 source nodes on the left (gfx / sec / ai) flow into 1 destination
   node on the right ("یک خالق"). Each line is a wavy path sampled at
   SYN_POINTS points. The waves are phase-offset by 120° between lines so
   they visibly weave / cross each other in the middle of the diagram.
   ========================================================================= */

const SYN_POINTS = 80;
const SYN_SX = 60;
const SYN_EX = 540;
const SYN_EY = 110;
const SYN_SY = [40, 110, 180] as const;
// Base wave amplitude per line — much bigger so lines sweep far across each other.
const SYN_BASE_AMP = [34, 48, 34] as const;
// Primary wave frequency — higher = more crossings.
const SYN_FREQ = 4.5;
// Secondary (faster) wave frequency — adds intricate ripples.
const SYN_FREQ2 = 9.0;
// Secondary wave amplitude (fraction of primary).
const SYN_AMP2 = 0.45;
// Tertiary micro-ripple for extra nested detail.
const SYN_FREQ3 = 16.0;
const SYN_AMP3 = 0.18;
// 120° phase offset per line — guarantees the three lines interleave.
const SYN_BASE_PHASE = [0, 2.0943951023931953, 4.1887902047863905] as const;
// Each line drifts at a slightly different speed so the weave keeps evolving.
const SYN_SPEED = [0.7, 0.88, 1.06] as const;

interface SynPoint {
  x: number;
  y: number;
}

/**
 * Compute a single point on line `i` at parametric position `u` ∈ [0,1].
 * Combines THREE sine waves (primary + secondary ripple + micro-ripple)
 * → deeply intertwined, twisting, nested paths that cross many times.
 * `mx`/`my` modulate amplitude + phase live.
 */
function synCompute(
  i: number,
  u: number,
  mx: number,
  my: number,
  t: number,
): SynPoint {
  const sy = SYN_SY[i];
  const amp = SYN_BASE_AMP[i] + (my - 0.5) * 40;
  const phaseShift = (mx - 0.5) * Math.PI * 1.6;
  const timePhase = t * SYN_SPEED[i];
  const x = SYN_SX + (SYN_EX - SYN_SX) * u;
  const yBase = sy + (SYN_EY - sy) * u;
  const taper = Math.sin(Math.PI * u);
  // Primary wave — big sweep
  const yWave1 =
    amp * taper * Math.sin(2 * Math.PI * SYN_FREQ * u + SYN_BASE_PHASE[i] + phaseShift + timePhase);
  // Secondary faster ripple — adds nested complexity
  const yWave2 =
    amp * SYN_AMP2 * taper * Math.sin(2 * Math.PI * SYN_FREQ2 * u + SYN_BASE_PHASE[i] * 1.7 + phaseShift * 0.6 + timePhase * 1.4);
  // Tertiary micro-ripple — fine detail
  const yWave3 =
    amp * SYN_AMP3 * taper * Math.sin(2 * Math.PI * SYN_FREQ3 * u + SYN_BASE_PHASE[i] * 2.3 + timePhase * 1.8);
  return { x, y: yBase + yWave1 + yWave2 + yWave3 };
}

/** Build an SVG path string for line `i`. */
function synPath(i: number, mx: number, my: number, t: number): string {
  let d = "";
  for (let k = 0; k < SYN_POINTS; k++) {
    const u = k / (SYN_POINTS - 1);
    const { x, y } = synCompute(i, u, mx, my, t);
    d += k === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

// 2 flowing particles per line, staggered, with per-particle loop duration.
const SYN_PARTICLES = [
  { line: 0, offset: 0.0, dur: 3.2 },
  { line: 0, offset: 0.5, dur: 3.2 },
  { line: 1, offset: 0.0, dur: 3.7 },
  { line: 1, offset: 0.5, dur: 3.7 },
  { line: 2, offset: 0.0, dur: 2.9 },
  { line: 2, offset: 0.5, dur: 2.9 },
] as const;

// Particle color per line — uses the same section var as the stroke gradient.
const SYN_PARTICLE_FILL = ["var(--gfx-1)", "var(--sec-1)", "var(--ai-1)"] as const;

export function Synthesis() {
  const syn = useContent((s) => s.content.synthesis);
  const lang = useContent((s) => s.lang);

  const labels =
    lang === "fa"
      ? { gfx: "گرافیک", sec: "امنیت", ai: "هوش مصنوعی", dst: "یک خالق", badge: "سه جهان، یک ذهن" }
      : { gfx: "Graphics", sec: "Security", ai: "AI", dst: "One Creator", badge: "Three worlds, one mind" };

  // --- Refs for imperative rAF updates (no per-frame React re-renders). ---
  // Each ref is declared individually (not via `.map`) so the
  // `react-hooks/refs` lint rule stays happy — refs are then aggregated into
  // arrays *inside the effect*, where ref access is allowed.
  const containerRef = useRef<HTMLDivElement>(null);
  const pathGfxRef = useRef<SVGPathElement>(null);
  const pathSecRef = useRef<SVGPathElement>(null);
  const pathAiRef = useRef<SVGPathElement>(null);
  const p0Ref = useRef<SVGCircleElement>(null);
  const p1Ref = useRef<SVGCircleElement>(null);
  const p2Ref = useRef<SVGCircleElement>(null);
  const p3Ref = useRef<SVGCircleElement>(null);
  const p4Ref = useRef<SVGCircleElement>(null);
  const p5Ref = useRef<SVGCircleElement>(null);

  // Mouse tracking — target (from events) and current (lerped toward target).
  const mouseTarget = useRef({ mx: 0.5, my: 0.5 });
  const mouseCurrent = useRef({ mx: 0.5, my: 0.5 });
  const isTouch = useRef(false);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Touch-device detection — fall back to gentle auto-driven mouse.
    if (typeof window !== "undefined") {
      const coarse =
        window.matchMedia?.("(pointer: coarse)")?.matches ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0;
      isTouch.current = !!coarse;
    }

    const container = containerRef.current;
    // Aggregate individual refs into arrays here (effect scope) so the rAF
    // loop can iterate cleanly.
    const pathRefs = [pathGfxRef, pathSecRef, pathAiRef];
    const particleRefs = [p0Ref, p1Ref, p2Ref, p3Ref, p4Ref, p5Ref];
    const start = performance.now();

    const onMove = (e: MouseEvent) => {
      const el = container;
      if (!el) return;
      const r = el.getBoundingClientRect();
      mouseTarget.current = {
        mx: (e.clientX - r.left) / r.width,
        my: (e.clientY - r.top) / r.height,
      };
    };
    const onLeave = () => {
      mouseTarget.current = { mx: 0.5, my: 0.5 };
    };

    if (container && !isTouch.current) {
      container.addEventListener("mousemove", onMove);
      container.addEventListener("mouseleave", onLeave);
    }

    const loop = () => {
      const now = performance.now();
      const t = (now - start) / 1000;

      // Touch / no-mouse fallback: slowly orbit a virtual cursor around the
      // center so the weave keeps breathing organically.
      if (isTouch.current) {
        mouseTarget.current = {
          mx: 0.5 + 0.4 * Math.sin(t * 0.27),
          my: 0.5 + 0.4 * Math.cos(t * 0.31),
        };
      }

      // Lerp current toward target — smooth, lagged follow.
      const cur = mouseCurrent.current;
      const tgt = mouseTarget.current;
      cur.mx += (tgt.mx - cur.mx) * 0.12;
      cur.my += (tgt.my - cur.my) * 0.12;

      // Update the three intertwined paths.
      for (let i = 0; i < 3; i++) {
        const el = pathRefs[i].current;
        if (el) el.setAttribute("d", synPath(i, cur.mx, cur.my, t));
      }

      // Update flowing particles along the live paths.
      for (let p = 0; p < SYN_PARTICLES.length; p++) {
        const el = particleRefs[p].current;
        if (!el) continue;
        const cfg = SYN_PARTICLES[p];
        const u = (((t / cfg.dur) + cfg.offset) % 1 + 1) % 1;
        const { x, y } = synCompute(cfg.line, u, cur.mx, cur.my, t);
        el.setAttribute("cx", x.toFixed(2));
        el.setAttribute("cy", y.toFixed(2));
      }

      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);

    return () => {
      if (container) {
        container.removeEventListener("mousemove", onMove);
        container.removeEventListener("mouseleave", onLeave);
      }
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, []);

  // Stable initial path strings for SSR / first paint — match what the rAF
  // loop will produce at t=0 with a centered mouse, so there's no flash.
  const initialGfx = synPath(0, 0.5, 0.5, 0);
  const initialSec = synPath(1, 0.5, 0.5, 0);
  const initialAi = synPath(2, 0.5, 0.5, 0);
  // Stable initial particle positions (sampled at each particle's staggered
  // offset, t=0, centered mouse) — so SSR matches the first rAF frame.
  const initP0 = synCompute(SYN_PARTICLES[0].line, SYN_PARTICLES[0].offset, 0.5, 0.5, 0);
  const initP1 = synCompute(SYN_PARTICLES[1].line, SYN_PARTICLES[1].offset, 0.5, 0.5, 0);
  const initP2 = synCompute(SYN_PARTICLES[2].line, SYN_PARTICLES[2].offset, 0.5, 0.5, 0);
  const initP3 = synCompute(SYN_PARTICLES[3].line, SYN_PARTICLES[3].offset, 0.5, 0.5, 0);
  const initP4 = synCompute(SYN_PARTICLES[4].line, SYN_PARTICLES[4].offset, 0.5, 0.5, 0);
  const initP5 = synCompute(SYN_PARTICLES[5].line, SYN_PARTICLES[5].offset, 0.5, 0.5, 0);

  return (
    <section
      id="synthesis"
      data-cursor-zone="default"
      className="relative overflow-hidden px-5 py-24 md:py-32"
    >
      <div className="pointer-events-none absolute inset-0">
        {/* Wide ambient halo — 80vw (10% breathing room per side), center
            aligned, elongated downward so the glow carries into the junction
            with the next section. The gradient itself fades to transparent
            (no hard ellipse edge, no blur filter needed). */}
        <div
          className="absolute left-1/2 top-[52%] h-[135%] w-[80vw] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 44%, color-mix(in oklch, var(--gfx-1) 34%, transparent), color-mix(in oklch, var(--sec-1) 30%, transparent) 40%, color-mix(in oklch, var(--ai-1) 26%, transparent) 62%, transparent 82%)",
            opacity: "var(--aurora-opacity)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <div data-cms-node="heading">
        <Reveal>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-1.5 font-mono text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" style={{ color: "var(--gfx-1)" }} />
            <span style={{ color: "var(--sec-1)" }}>/</span>
            <Shield className="h-3 w-3" style={{ color: "var(--sec-1)" }} />
            <span style={{ color: "var(--ai-1)" }}>/</span>
            <Brain className="h-3 w-3" style={{ color: "var(--ai-1)" }} />
            <span className="mr-2">{labels.badge}</span>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <h2 className="text-balance text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {syn.title}
            <span className="text-gradient-gfx">{syn.highlight1}</span>{lang === "fa" ? "، " : ", "}
            <span className="text-gradient-sec">{syn.highlight2}</span>{lang === "fa" ? " و " : " & "}
            <span className="text-gradient-ai">{syn.highlight3}</span>
            <br />
            <span className="text-gradient-tri">{syn.titleLine2}</span>
          </h2>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            {syn.subtitle}
          </p>
        </Reveal>
        </div>

        {/* convergence diagram — three intertwined, mouse-reactive lines */}
        <Reveal delay={0.3}>
          <div
            ref={containerRef}
            data-cms-node="convergence-visual"
            data-cms-object
            data-synthesis-lines="active"
            className="relative mx-auto mt-12 h-48 min-w-0 w-full max-w-2xl sm:mt-16 sm:h-56"
          >
            <svg
              viewBox="0 0 600 220"
              className="absolute inset-0 block h-full w-full overflow-visible"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="g-gfx" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--gfx-1)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--gfx-1)" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="g-sec" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--sec-1)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--sec-1)" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="g-ai" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--ai-1)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--ai-1)" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              {/* Three intertwined lines (gfx / sec / ai → یک خالق). */}
              <motion.path
                ref={pathGfxRef}
                d={initialGfx}
                stroke="url(#g-gfx)"
                strokeWidth={2.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={false}
                style={{ opacity: 0.94 }}
              />
              <motion.path
                ref={pathSecRef}
                d={initialSec}
                stroke="url(#g-sec)"
                strokeWidth={2.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={false}
                style={{ opacity: 0.94 }}
              />
              <motion.path
                ref={pathAiRef}
                d={initialAi}
                stroke="url(#g-ai)"
                strokeWidth={2.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={false}
                style={{ opacity: 0.94 }}
              />

              {/* Flowing particles along the live paths (2 per line). */}
              <circle
                ref={p0Ref}
                cx={initP0.x}
                cy={initP0.y}
                r={3}
                fill={SYN_PARTICLE_FILL[SYN_PARTICLES[0].line]}
                style={{ filter: "drop-shadow(0 0 3px currentColor)" }}
              />
              <circle
                ref={p1Ref}
                cx={initP1.x}
                cy={initP1.y}
                r={3}
                fill={SYN_PARTICLE_FILL[SYN_PARTICLES[1].line]}
                style={{ filter: "drop-shadow(0 0 3px currentColor)" }}
              />
              <circle
                ref={p2Ref}
                cx={initP2.x}
                cy={initP2.y}
                r={3}
                fill={SYN_PARTICLE_FILL[SYN_PARTICLES[2].line]}
                style={{ filter: "drop-shadow(0 0 3px currentColor)" }}
              />
              <circle
                ref={p3Ref}
                cx={initP3.x}
                cy={initP3.y}
                r={3}
                fill={SYN_PARTICLE_FILL[SYN_PARTICLES[3].line]}
                style={{ filter: "drop-shadow(0 0 3px currentColor)" }}
              />
              <circle
                ref={p4Ref}
                cx={initP4.x}
                cy={initP4.y}
                r={3}
                fill={SYN_PARTICLE_FILL[SYN_PARTICLES[4].line]}
                style={{ filter: "drop-shadow(0 0 3px currentColor)" }}
              />
              <circle
                ref={p5Ref}
                cx={initP5.x}
                cy={initP5.y}
                r={3}
                fill={SYN_PARTICLE_FILL[SYN_PARTICLES[5].line]}
                style={{ filter: "drop-shadow(0 0 3px currentColor)" }}
              />

              {/* Source nodes */}
              <circle cx={SYN_SX} cy={SYN_SY[0]} r={8} fill="var(--gfx-1)" />
              <circle cx={SYN_SX} cy={SYN_SY[1]} r={8} fill="var(--sec-1)" />
              <circle cx={SYN_SX} cy={SYN_SY[2]} r={8} fill="var(--ai-1)" />

              {/* Destination node with pulsing ring */}
              <motion.circle
                cx={SYN_EX}
                cy={SYN_EY}
                r={14}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={1}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                animate={{ scale: [1, 1.9], opacity: [0.8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <circle cx={SYN_EX} cy={SYN_EY} r={10} fill="url(#g-gfx)" />
            </svg>

            {/* Bilingual labels */}
            <div className="absolute -left-2 top-0 hidden -translate-x-full items-center gap-2 text-xs sm:flex">
              <span className="text-gradient-gfx font-semibold">{labels.gfx}</span>
            </div>
            <div className="absolute -left-2 top-1/2 hidden -translate-x-full -translate-y-1/2 items-center gap-2 text-xs sm:flex">
              <span className="text-gradient-sec font-semibold">{labels.sec}</span>
            </div>
            <div className="absolute -left-2 bottom-0 hidden -translate-x-full items-center gap-2 text-xs sm:flex">
              <span className="text-gradient-ai font-semibold">{labels.ai}</span>
            </div>
            <div className="absolute -right-2 top-1/2 hidden translate-x-full -translate-y-1/2 items-center gap-2 text-xs sm:flex">
              <span className="text-gradient-tri font-bold">{labels.dst}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:hidden">
            <span className="text-gradient-gfx font-semibold">{labels.gfx}</span>
            <span className="text-gradient-sec font-semibold">{labels.sec}</span>
            <span className="text-gradient-ai font-semibold">{labels.ai}</span>
            <span className="text-gradient-tri font-bold">{labels.dst}</span>
          </div>
        </Reveal>

        <Reveal delay={0.4}>
          <a
            href="#contact"
            data-cursor-hover
            className="btn-solid-neutral group mt-12 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:scale-105"
          >
            {syn.cta}
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
