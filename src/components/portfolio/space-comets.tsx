"use client";

/* ==================================================================
 * SpaceComets — occasional shooting-star streaks crossing the sky.
 *
 * Every minInterval..maxInterval seconds (CMS-configurable via
 * meteors.ambient) a pass of 1..N glowing streaks flies along
 * a random diagonal. Pure transform animations on compositor layers —
 * negligible cost, respects the "off" animation mode.
 * ================================================================== */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useContent } from "@/lib/content-store";
import type { CometConfig } from "@/lib/content-types";
import { MeteorTrail } from "./meteor-trail";

interface Streak {
  id: number;
  startX: number; // vw
  startY: number; // vh
  dx: number; // vw
  dy: number; // vh
  length: number; // px
  thickness: number; // px
  delay: number;
  dur: number;
  angle: number;
}

const DEFAULT_COMETS: CometConfig = {
  enabled: true,
  minIntervalSec: 8,
  maxIntervalSec: 22,
  streaksPerPass: 2,
  color: "auto",
  durationMs: 2600,
  direction: "alternating",
  style: "realistic",
  angleMin: 10,
  angleMax: 22,
  lengthMin: 150,
  lengthMax: 260,
  thickness: 1.15,
  glow: 0.72,
  headSize: 3.4,
  spawnTop: 5,
  spawnBottom: 55,
};

export function SpaceComets() {
  const comets = useContent((s) => s.content.meteors?.ambient ?? s.content.design?.background?.comets) ?? DEFAULT_COMETS;
  const animMode = useContent((s) => s.content.builder?.performance?.animationMode) ?? "normal";
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const idRef = useRef(0);
  const passRef = useRef(0);

  const cfg = { ...DEFAULT_COMETS, ...comets };
  const enabled = cfg.enabled !== false && animMode !== "off";

  useEffect(() => {
    if (!enabled) {
      const raf = requestAnimationFrame(() => setStreaks([]));
      return () => cancelAnimationFrame(raf);
    }
    let spawnTimer: ReturnType<typeof setTimeout>;
    const cleanupTimers = new Set<ReturnType<typeof setTimeout>>();

    const spawnPass = () => {
      const count = Math.min(12, Math.max(1, Math.round(Number(cfg.streaksPerPass) || 1)));
      const dur = Math.min(8000, Math.max(800, Number(cfg.durationMs) || 2600)) / 1000;
      const direction = cfg.direction ?? "alternating";
      const toRight = direction === "left-to-right"
        ? true
        : direction === "right-to-left"
          ? false
          : direction === "alternating"
            ? passRef.current++ % 2 === 0
            : Math.random() > 0.5;
      const angleMin = Math.max(3, Math.min(60, Number(cfg.angleMin) || 10));
      const angleMax = Math.max(angleMin, Math.min(70, Number(cfg.angleMax) || 22));
      const spawnTop = Math.max(0, Math.min(90, Number(cfg.spawnTop) || 5));
      const spawnBottom = Math.max(spawnTop + 1, Math.min(100, Number(cfg.spawnBottom) || 55));
      const batch: Streak[] = Array.from({ length: count }, (_, i) => {
        const dx = (toRight ? 1 : -1) * (55 + Math.random() * 28);
        const angle = angleMin + Math.random() * (angleMax - angleMin);
        const viewportRatio = window.innerWidth / Math.max(1, window.innerHeight);
        const dy = Math.abs(dx) * viewportRatio * Math.tan((angle * Math.PI) / 180);
        return {
          id: idRef.current++,
          startX: toRight ? -22 - Math.random() * 26 : 72 + Math.random() * 42,
          startY: spawnTop + Math.random() * (spawnBottom - spawnTop),
          dx,
          dy,
          angle: (Math.atan2(dy * window.innerHeight, dx * window.innerWidth) * 180) / Math.PI,
          length: Math.max(50, Number(cfg.lengthMin) || 150) + Math.random() * Math.max(0, (Number(cfg.lengthMax) || 260) - (Number(cfg.lengthMin) || 150)),
          thickness: Math.max(0.4, Number(cfg.thickness) || 1.15) * (0.82 + Math.random() * 0.36),
          delay: i * (0.25 + Math.random() * 0.5),
          dur: dur * (0.75 + Math.random() * 0.5),
        };
      });
      setStreaks((prev) => [...prev.slice(-6), ...batch]);
      const cleanupTimer = setTimeout(() => {
        const ids = new Set(batch.map((b) => b.id));
        setStreaks((prev) => prev.filter((s) => !ids.has(s.id)));
        cleanupTimers.delete(cleanupTimer);
      }, (dur + 2) * 1000);
      cleanupTimers.add(cleanupTimer);

      const min = Math.min(120, Math.max(3, Number(cfg.minIntervalSec) || 8));
      const max = Math.min(180, Math.max(min, Number(cfg.maxIntervalSec) || 22));
      spawnTimer = setTimeout(spawnPass, (min + Math.random() * (max - min)) * 1000);
    };

    spawnTimer = setTimeout(spawnPass, (2 + Math.random() * 4) * 1000);
    return () => {
      clearTimeout(spawnTimer);
      cleanupTimers.forEach(clearTimeout);
    };
  }, [enabled, cfg.minIntervalSec, cfg.maxIntervalSec, cfg.streaksPerPass, cfg.durationMs, cfg.direction, cfg.angleMin, cfg.angleMax, cfg.lengthMin, cfg.lengthMax, cfg.thickness, cfg.spawnTop, cfg.spawnBottom]);

  const color = cfg.color && cfg.color !== "auto" ? cfg.color : "#ffffff";

  return (
    <div className="space-comets-layer pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {streaks.map((s) => {
          return (
            <motion.div
              key={s.id}
              className="absolute gpu"
              initial={{ x: 0, y: 0, opacity: 0, scaleX: 0.3 }}
              animate={{
                x: `${s.dx}vw`,
                y: `${s.dy}vh`,
                opacity: [0, 0, 1, 1, 0],
                scaleX: [0.3, 0.3, 1, 1, 0.5],
              }}
              exit={{ opacity: 0 }}
              style={{ left: `${s.startX}%`, top: `${s.startY}%`, width: s.length, height: Math.max(18, s.thickness * 12), rotate: s.angle }}
              transition={{
                duration: s.dur,
                delay: s.delay,
                x: { duration: s.dur, delay: s.delay, ease: [0.35, 0.05, 0.5, 1] },
                y: { duration: s.dur, delay: s.delay, ease: [0.35, 0.05, 0.5, 1] },
                opacity: { duration: s.dur, delay: s.delay, times: [0, 0.15, 0.35, 0.8, 1] },
              }}
            >
              <MeteorTrail
                color={color}
                length={s.length}
                thickness={s.thickness}
                glow={Number(cfg.glow) || 0.72}
                headSize={Number(cfg.headSize) || 3.4}
                style={cfg.style}
                headStyle="comet"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
