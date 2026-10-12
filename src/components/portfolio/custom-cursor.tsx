"use client";

import { useEffect, useRef, useState } from "react";
import { useContent } from "@/lib/content-store";

type Section = "gfx" | "sec" | "ai" | "timeline" | "default";

const COLORS: Record<Section, { ring: string; dot: string; label: string }> = {
  default: {
    ring: "rgba(255,255,255,0.5)",
    dot: "rgba(255,255,255,0.95)",
    label: "",
  },
  timeline: {
    ring: "oklch(0.78 0.2 155 / 0.7)",
    dot: "oklch(0.78 0.2 155)",
    label: "JOURNEY",
  },
  gfx: {
    ring: "oklch(0.72 0.27 350 / 0.7)",
    dot: "oklch(0.72 0.27 350)",
    label: "GRAPHICS",
  },
  sec: {
    ring: "oklch(0.78 0.2 155 / 0.7)",
    dot: "oklch(0.78 0.2 155)",
    label: "SECURITY",
  },
  ai: {
    ring: "oklch(0.7 0.22 250 / 0.7)",
    dot: "oklch(0.7 0.22 250)",
    label: "AI",
  },
};

export function CustomCursor() {
  const cursor = useContent((s) => s.content.design?.cursor);
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<HTMLDivElement[]>([]);
  const [section, setSection] = useState<Section>("default");
  const [hovering, setHovering] = useState(false);
  const trailLength = clampInt(Number(cursor?.trailLength ?? 7), 0, 18);
  const smoothing = clamp(Number(cursor?.smoothing ?? 0.18), 0.03, 0.6);
  const labelOffsetX = Number(cursor?.labelOffsetX ?? 22);
  const labelOffsetY = Number(cursor?.labelOffsetY ?? 22);

  useEffect(() => {
    // Disable on touch / small screens
    if (window.matchMedia("(hover: none)").matches) return;

    let raf = 0;
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { x: mouse.x, y: mouse.y };
    const trails = Array.from({ length: trailLength }, () => ({ x: mouse.x, y: mouse.y }));

    let lastX = mouse.x, lastY = mouse.y;
    let zoneRaf = 0;
    const recomputeZone = () => {
      zoneRaf = 0;
      const target = document.elementFromPoint(lastX, lastY);
      const el = target instanceof Element ? target : null;
      const zone = el?.closest<HTMLElement>("[data-cursor-zone]");
      const next: Section = (zone?.dataset.cursorZone as Section) || "default";
      setSection((prev) => (prev !== next ? next : prev));
      setHovering(
        !!el?.closest("a, button, [role='button'], input, textarea, [data-cursor-hover]")
      );
    };
    const onScroll = () => {
      if (zoneRaf) return;
      zoneRaf = requestAnimationFrame(recomputeZone);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      lastX = e.clientX; lastY = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
      const target = e.target instanceof Element ? (e.target as HTMLElement) : null;
      const zone = target?.closest<HTMLElement>("[data-cursor-zone]");
      const next: Section = (zone?.dataset.cursorZone as Section) || "default";
      setSection((prev) => (prev !== next ? next : prev));
      setHovering(
        !!target?.closest("a, button, [role='button'], input, textarea, [data-cursor-hover]")
      );
    };

    const loop = () => {
      ring.x += (mouse.x - ring.x) * smoothing;
      ring.y += (mouse.y - ring.y) * smoothing;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
      }
      if (labelRef.current) {
        labelRef.current.style.transform = `translate3d(${ring.x + labelOffsetX}px, ${ring.y + labelOffsetY}px, 0)`;
      }
      let leader = mouse;
      trails.forEach((trail, i) => {
        const pace = Math.max(0.04, smoothing * (0.78 - i * 0.025));
        trail.x += (leader.x - trail.x) * pace;
        trail.y += (leader.y - trail.y) * pace;
        const el = trailRefs.current[i];
        if (el) el.style.transform = `translate3d(${trail.x}px, ${trail.y}px, 0)`;
        leader = trail;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (zoneRaf) cancelAnimationFrame(zoneRaf);
      cancelAnimationFrame(raf);
    };
  }, [labelOffsetX, labelOffsetY, smoothing, trailLength]);

  if (cursor?.enabled === false) return null;

  const fallback = COLORS[section];
  const zoneColor = cursor?.colors?.[section] || fallback.dot;
  const c = {
    dot: zoneColor,
    ring: colorWithAlpha(zoneColor, 0.7),
    label: cursor?.labels?.[section] ?? fallback.label,
  };
  const ringSize = Number(cursor?.ringSize || 32);
  const ringHoverSize = Number(cursor?.ringHoverSize || cursor?.ringSize || 56);
  const dotSize = Number(cursor?.dotSize || 8);
  const ringOpacity = clamp(Number(cursor?.ringOpacity ?? 0.7), 0, 1);
  const dotOpacity = clamp(Number(cursor?.dotOpacity ?? 0.95), 0, 1);
  const labelOpacity = clamp(Number(cursor?.labelOpacity ?? 1), 0, 1);
  const ringBorderWidth = Math.max(0, Number(cursor?.ringBorderWidth ?? 1));
  const trailSize = Math.max(2, Number(cursor?.trailSize ?? 18));
  const trailOpacity = clamp(Number(cursor?.trailOpacity ?? 0.28), 0, 1);
  const trailColor = cursor?.trailColor && cursor.trailColor !== "auto" ? cursor.trailColor : c.dot;
  const blendMode = (cursor?.blendMode || "normal") as React.CSSProperties["mixBlendMode"];

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] hidden md:block" aria-hidden style={{ mixBlendMode: blendMode }}>
      {cursor?.trailEnabled !== false &&
        Array.from({ length: trailLength }).map((_, i) => {
          const size = Math.max(2, trailSize - i * 1.4);
          const opacity = Math.max(0, trailOpacity * (1 - i / Math.max(1, trailLength)));
          return (
            <div
              key={i}
              ref={(node) => {
                if (node) trailRefs.current[i] = node;
              }}
              className="fixed left-0 top-0 rounded-full blur-sm"
              style={{
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                background: colorWithAlpha(trailColor, opacity),
                opacity,
              }}
            />
          );
        })}
      {/* Outer ring */}
      <div
        ref={ringRef}
        className="fixed left-0 top-0 rounded-full border transition-[width,height,opacity] duration-300"
        style={{
          borderColor: colorWithAlpha(c.dot, ringOpacity),
          borderWidth: ringBorderWidth,
          width: `${hovering ? ringHoverSize : ringSize}px`,
          height: `${hovering ? ringHoverSize : ringSize}px`,
          marginLeft: `${-(hovering ? ringHoverSize : ringSize) / 2}px`,
          marginTop: `${-(hovering ? ringHoverSize : ringSize) / 2}px`,
          boxShadow: `0 0 24px ${colorWithAlpha(c.dot, ringOpacity)}`,
        }}
      />
      {/* Inner dot */}
      <div
        ref={dotRef}
        className="fixed left-0 top-0 rounded-full transition-transform"
        style={{
          background: colorWithAlpha(c.dot, dotOpacity),
          width: dotSize,
          height: dotSize,
          marginLeft: -dotSize / 2,
          marginTop: -dotSize / 2,
          transform: "translate3d(0,0,0)",
        }}
      />
      {/* Label */}
      {c.label && (
        <div
          ref={labelRef}
          className="fixed left-0 top-0 select-none rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.2em]"
          style={{
            color: c.dot,
            background: "rgba(8,8,14,0.7)",
            border: `1px solid ${c.ring}`,
            backdropFilter: "blur(8px)",
            opacity: labelOpacity,
          }}
        >
          {c.label}
        </div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max));
}

function colorWithAlpha(color: string, alpha: number) {
  if (color.startsWith("oklch(")) return color.replace(")", ` / ${alpha})`);
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
