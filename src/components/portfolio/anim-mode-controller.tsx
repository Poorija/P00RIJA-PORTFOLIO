"use client";

/* AnimModeController — applies the CMS animation mode site-wide:
 *  - sets [data-anim-mode] on <html> (CSS rules in globals.css pause/dim
 *    the decorative layers per mode),
 *  - wraps the tree in framer-motion's MotionConfig so "off" fully
 *    disables transform animations (biggest CPU/GPU saving) while other
 *    modes honor the visitor's OS reduced-motion preference. */

import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { useContent } from "@/lib/content-store";
import { MOTION_EVENT, MOTION_STORAGE_KEY } from "./motion-toggle";

export function AnimModeController({ children }: { children: ReactNode }) {
  const mode = useContent((s) => s.content.builder?.performance?.animationMode) ?? "normal";
  const [visitorPaused, setVisitorPaused] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(MOTION_STORAGE_KEY);
    const initial = stored ? stored === "paused" : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => setVisitorPaused(initial));
    const onChange = (event: Event) => setVisitorPaused(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(MOTION_EVENT, onChange);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(MOTION_EVENT, onChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.animMode = mode;
    document.documentElement.dataset.visitorMotion = visitorPaused ? "paused" : "running";
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowPower = (navigator.hardwareConcurrency || 4) <= 2 || (nav.deviceMemory || 4) <= 2;
    document.documentElement.dataset.lowPower = lowPower ? "true" : "false";
  }, [mode, visitorPaused]);

  return (
    <MotionConfig reducedMotion={mode === "off" || visitorPaused ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
