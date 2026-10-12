"use client";

/* ==================================================================
 * PageLoader — first-paint loading screen.
 *
 * Covers the gap between the blank first HTML and the fully hydrated
 * portfolio (fonts + CMS content + WebGL). Shows:
 *   - a live progress bar with a real completion condition
 *     (content fetched + document loaded + fonts ready),
 *   - orbiting planets animation (pure CSS transforms → GPU),
 *   - rotating bilingual status lines.
 * Fades out and unmounts; locks page scroll while visible.
 * ================================================================== */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useContent } from "@/lib/content-store";

const MIN_DISPLAY_MS = 120;
const FADE_MS = 260;
// Fail-open: whatever happens (hung API, blocked dev websocket, slow network),
// the loader must never brick the page. After this window it dismisses itself
// and the site renders with whatever content is available.
const HARD_TIMEOUT_MS = 3_500;

const STATUS_FA = [
  "در حال روشن کردن ستاره‌ها…",
  "چیدن مدار سیارات…",
  "دریافت محتوا از ایستگاه زمینی…",
  "گرم کردن موتور وارپ…",
  "تقریباً آماده‌ی پرواز…",
];
const STATUS_EN = [
  "Igniting the stars…",
  "Laying out planetary orbits…",
  "Receiving content from ground control…",
  "Warming up the warp drive…",
  "Almost ready for launch…",
];

export function PageLoader() {
  const loaded = useContent((s) => s.loaded);
  const lang = useContent((s) => s.lang);
  const brand = useContent((s) => s.content.site.brand);

  const [progress, setProgress] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [gone, setGone] = useState(false);
  const [forceDone, setForceDone] = useState(false);
  const done = (loaded && minElapsed) || forceDone;
  const rafRef = useRef(0);

  // simulated progress that eases toward 92% and snaps to 100 when done
  useEffect(() => {
    if (done) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      setProgress((prev) => {
        const cap = 92;
        const target = cap * (1 - Math.exp(-t / 1.1));
        return Math.max(prev, target);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [done]);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_DISPLAY_MS);
    // fail-open hard timeout
    const hard = setTimeout(() => setForceDone(true), HARD_TIMEOUT_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(hard);
    };
  }, []);

  // unmount after the fade completes
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), FADE_MS + 80);
    return () => clearTimeout(t);
  }, [done]);

  // lock scroll while the loader is up
  useEffect(() => {
    if (gone) return;
    const prev = document.body.style.overflow;
    if (!done) document.body.style.overflow = "hidden";
    else document.body.style.overflow = prev;
    return () => { document.body.style.overflow = prev; };
  }, [done, gone]);

  const status = (lang === "fa" ? STATUS_FA : STATUS_EN)[
    Math.min(Math.floor(progress / 22), 4)
  ];
  // when all systems are ready the bar always shows a full 100%
  const pct = Math.round(Math.min(done ? 100 : progress, 100));

  if (gone) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-8 overflow-hidden"
          style={{ background: "var(--background)" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: FADE_MS / 1000, ease: "easeInOut" } }}
        >
          {/* faint aurora glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 70% 45% at 50% 38%, oklch(0.45 0.16 300 / 0.22), transparent 70%), radial-gradient(ellipse 45% 35% at 70% 70%, oklch(0.5 0.14 165 / 0.12), transparent 70%)",
            }}
          />

          {/* orbit system — three rings, one planet per ring */}
          <div className="relative grid place-items-center" style={{ width: 136, height: 136 }}>
            {[
              { inset: "0%", size: 11, dur: 2.1, color: "#e84a9b", dir: 0 },
              { inset: "14%", size: 8, dur: 3.2, color: "#3ee08a", dir: 140 },
              { inset: "28%", size: 8, dur: 4.6, color: "#4a8aff", dir: 260 },
            ].map((p, i) => (
              <div key={i} className="absolute gpu" style={{ inset: p.inset }}>
                <div
                  className="absolute inset-0 rounded-full border"
                  style={{ borderColor: "color-mix(in oklch, var(--foreground) 12%, transparent)" }}
                />
                <div className="absolute inset-0 gpu" style={{ animation: `pl-orbit ${p.dur}s linear infinite`, animationDelay: `${-p.dir / 360 * p.dur}s` }}>
                  <span
                    className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: p.size,
                      height: p.size,
                      background: `radial-gradient(circle at 32% 30%, color-mix(in oklch, ${p.color} 55%, white), ${p.color})`,
                      boxShadow: `0 0 12px ${p.color}`,
                    }}
                  />
                </div>
              </div>
            ))}
            {/* sun core */}
            <motion.div
              className="h-7 w-7 rounded-full"
              style={{
                background: "radial-gradient(circle at 35% 35%, #fff3d6, oklch(0.85 0.17 55) 55%, oklch(0.65 0.2 35))",
                boxShadow: "0 0 34px oklch(0.85 0.17 55 / 0.75), 0 0 70px oklch(0.8 0.16 40 / 0.4)",
              }}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <style>{`
              @keyframes pl-orbit { from { transform: rotate(0deg) translateZ(0); } to { transform: rotate(360deg) translateZ(0); } }
            `}</style>
          </div>

          {/* brand + progress */}
          <div className="relative flex w-64 flex-col items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.45em] text-muted-foreground">
              {brand || "PORTFOLIO"}
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(to right, var(--gfx-1), var(--sec-1), var(--ai-1))" }}
                animate={{ width: `${pct}%` }}
                transition={{ ease: "easeOut", duration: 0.25 }}
              />
            </div>
            <div className="flex w-full items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>{status}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
