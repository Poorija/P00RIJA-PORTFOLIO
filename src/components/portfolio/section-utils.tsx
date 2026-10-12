"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

/* === Section heading with bilingual treatment === */
export function SectionHeading({
  index,
  kickerEn,
  title,
  highlight,
  subtitle,
  accent,
}: {
  index: string;
  kickerEn: string;
  title: string;
  highlight: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div className="mb-12 md:mb-16">
      <div className="mb-4 flex items-center gap-4">
        <span className="font-mono text-xs tracking-[0.3em]" style={{ color: accent }}>
          {index} / {kickerEn}
        </span>
        <span
          className="h-px flex-1 max-w-[120px]"
          style={{ background: `linear-gradient(to left, ${accent}, transparent)` }}
        />
      </div>
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="text-balance text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl"
      >
        {title}
        <span style={{ color: accent }}>{highlight}</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg"
      >
        {subtitle}
      </motion.p>
    </div>
  );
}

/* === Tilt card with mouse-tracking 3D effect === */
export function TiltCard({
  children,
  className = "",
  max = 12,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * max * 2;
    const ry = (px - 0.5) * max * 2;
    setTransform(`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`);
    setGlowPos({ x: px * 100, y: py * 100 });
  };

  const reset = () => {
    setTransform("perspective(900px) rotateX(0deg) rotateY(0deg)");
    setGlowPos({ x: 50, y: 50 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      data-cursor-hover
      className={`tilt-card relative ${className}`}
      style={{ transform }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 [.tilt-card:hover_&]:opacity-100"
        style={{
          background: `radial-gradient(400px circle at ${glowPos.x}% ${glowPos.y}%, color-mix(in oklch, var(--foreground) 8%, transparent), transparent 50%)`,
        }}
      />
      {children}
    </div>
  );
}

/* === Reveal wrapper === */
export function Reveal({
  children,
  delay = 0,
  y = 30,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* === Skill chip === */
export function Chip({
  children,
  color,
}: {
  children: ReactNode;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      style={{
        borderColor: `color-mix(in oklch, ${color} 35%, transparent)`,
        background: `color-mix(in oklch, ${color} 10%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
