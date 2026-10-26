"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function OrbitalLoader({
  lang = "fa",
  label,
  progress,
  fullScreen = false,
  className,
}: {
  lang?: "fa" | "en";
  label?: string;
  progress?: number;
  fullScreen?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const orbitsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const nodes = Array.from(orbitsRef.current?.querySelectorAll<HTMLElement>("[data-orbit]") ?? []);
    const animations = nodes.map((node, index) => node.animate(
      [{ transform: `rotate(${index * 120}deg)` }, { transform: `rotate(${index * 120 + 360}deg)` }],
      { duration: [2100, 3200, 4600][index] * (reducedMotion ? 5 : 1), iterations: Infinity, easing: "linear" },
    ));
    return () => animations.forEach((animation) => animation.cancel());
  }, [reducedMotion]);
  const value = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : undefined;
  const text = label ?? (lang === "fa" ? "در حال آماده‌سازی ایستگاه فضایی…" : "Preparing the orbital station…");
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-7 overflow-hidden bg-[var(--background)] p-6 text-center",
        fullScreen ? "fixed inset-0 z-[300]" : "absolute inset-0 z-40",
        className,
      )}
      role="status"
      aria-label={text}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(ellipse_70%_45%_at_50%_38%,oklch(0.45_0.16_300/.22),transparent_70%),radial-gradient(ellipse_45%_35%_at_70%_70%,oklch(0.5_0.14_165/.12),transparent_70%)]" />
      <div ref={orbitsRef} className="relative grid size-32 place-items-center" aria-hidden>
        {[
          { inset: "0%", size: 10, color: "#e84a9b" },
          { inset: "14%", size: 8, color: "#3ee08a" },
          { inset: "28%", size: 8, color: "#4a8aff" },
        ].map((orbit, index) => (
          <div key={index} className="absolute gpu" style={{ inset: orbit.inset }}>
            <div className="absolute inset-0 rounded-full border border-foreground/10" />
            <div data-orbit className="absolute inset-0 gpu" style={{ willChange: "transform" }}>
              <span
                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ width: orbit.size, height: orbit.size, background: `radial-gradient(circle at 32% 30%, white, ${orbit.color})`, boxShadow: `0 0 12px ${orbit.color}` }}
              />
            </div>
          </div>
        ))}
        <motion.div
          className="size-7 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff3d6,oklch(0.85_0.17_55)_55%,oklch(0.65_0.2_35))] shadow-[0_0_34px_oklch(0.85_0.17_55/.75),0_0_70px_oklch(0.8_0.16_40/.4)]"
          animate={reducedMotion ? undefined : { scale: [1, 1.12, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="relative flex w-64 max-w-full flex-col items-center gap-3">
        <p className="text-balance font-mono text-[10px] uppercase leading-5 tracking-[0.28em] text-muted-foreground">{text}</p>
        <progress className="orbital-progress h-1 w-full" max={100} value={value} aria-label={text} />
        {value !== undefined && <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{Math.round(value)}%</span>}
      </div>
      <style>{`
        .orbital-progress {
          appearance: none;
          border: 0 solid;
          overflow: clip;
          border-radius: 999px;
          background: var(--surface-2);
          container-type: inline-size;
          --orbital-progress-fill: linear-gradient(90deg, var(--gfx-1), var(--sec-1), var(--ai-1));
          --orbital-indeterminate-animation: orbital-progress-indeterminate 1.6s infinite linear;
        }
        .orbital-progress::-webkit-progress-bar { background: transparent; }
        .orbital-progress::-webkit-progress-value {
          background: var(--orbital-progress-fill);
          border-radius: 999px;
          transition: inline-size .3s;
          animation: var(--orbital-progress-animation, revert-rule);
        }
        .orbital-progress::-moz-progress-bar {
          background: var(--orbital-progress-fill);
          border-radius: 999px;
          transition: inline-size .3s;
          animation: var(--orbital-progress-animation, revert-rule);
        }
        .orbital-progress:indeterminate { --orbital-progress-animation: var(--orbital-indeterminate-animation); }
        .orbital-progress:dir(rtl) { --orbital-indeterminate-animation: orbital-progress-indeterminate 1.6s infinite linear reverse; }
        @keyframes orbital-progress-indeterminate {
          from, to { inline-size: 32%; margin-right: auto; }
          from { translate: -100%; }
          to { translate: 100cqi; }
        }
        @media (prefers-reduced-motion: reduce) {
          .orbital-progress:indeterminate { --orbital-indeterminate-animation: orbital-progress-indeterminate 8s infinite linear; }
        }
      `}</style>
    </div>
  );
}
