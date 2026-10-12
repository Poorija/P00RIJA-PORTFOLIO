"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useContent } from "@/lib/content-store";

export const MOTION_STORAGE_KEY = "p00rija-visitor-motion";
export const MOTION_EVENT = "portfolio-motion-change";

export function MotionToggle() {
  const lang = useContent((s) => s.lang);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(MOTION_STORAGE_KEY);
    const frame = requestAnimationFrame(() => setPaused(stored ? stored === "paused" : window.matchMedia("(prefers-reduced-motion: reduce)").matches));
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    window.localStorage.setItem(MOTION_STORAGE_KEY, next ? "paused" : "running");
    window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: next }));
  };

  const label = paused
    ? (lang === "fa" ? "فعال کردن حرکت‌ها" : "Resume motion")
    : (lang === "fa" ? "توقف حرکت‌ها" : "Pause motion");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={paused}
      className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground/80 transition-colors hover:text-foreground"
      style={{ background: "var(--surface-1)", borderColor: "var(--hairline)" }}
      data-cursor-hover
    >
      {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
    </button>
  );
}
