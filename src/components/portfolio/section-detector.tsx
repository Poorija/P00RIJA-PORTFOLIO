"use client";

import { useEffect, useRef } from "react";
import { useContent } from "@/lib/content-store";

// Section → accent color mapping.
// When a section is active, sets --scroll-color on <html> so the scrollbar
// + progress bar pick it up. When between sections (no section centered),
// sets a gradient via two CSS vars (--scroll-color-from / --scroll-color-to)
// that transition smoothly.
const SECTION_COLORS: Record<string, string> = {
  home: "var(--gfx-1)",     // hero — neutral-ish, uses gfx
  graphics: "var(--gfx-1)",
  security: "var(--sec-1)",
  ai: "var(--ai-1)",
  contact: "var(--ai-3)",
};

// Order of sections top→bottom for gradient interpolation.
const SECTION_ORDER = ["home", "graphics", "security", "ai", "contact"];

export function SectionDetector() {
  const lang = useContent((s) => s.lang);
  const currentRef = useRef<string>("home");
  const prevRef = useRef<string>("home");

  useEffect(() => {
    const setColors = (active: string, prev: string | null) => {
      const root = document.documentElement;
      const color = SECTION_COLORS[active] || SECTION_COLORS.home;
      root.style.setProperty("--scroll-color", color);
      if (prev && prev !== active) {
        // between sections → gradient from prev to active
        const from = SECTION_COLORS[prev] || SECTION_COLORS.home;
        const to = color;
        root.style.setProperty("--scroll-color-from", from);
        root.style.setProperty("--scroll-color-to", to);
      } else {
        root.style.setProperty("--scroll-color-from", color);
        root.style.setProperty("--scroll-color-to", color);
      }
    };

    const sections = SECTION_ORDER.map((id) => document.getElementById(id)).filter(
      Boolean
    ) as HTMLElement[];

    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // find the entry closest to viewport center
        let best: { id: string; dist: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const r = e.boundingClientRect;
          const center = window.innerHeight / 2;
          const dist = Math.abs(r.top + r.height / 2 - center);
          if (!best || dist < best.dist) best = { id: e.target.id, dist };
        }
        if (best) {
          if (best.id !== currentRef.current) {
            prevRef.current = currentRef.current;
            currentRef.current = best.id;
            setColors(best.id, prevRef.current);
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((s) => io.observe(s));
    setColors("home", null);
    return () => io.disconnect();
  }, [lang]);

  return null;
}
