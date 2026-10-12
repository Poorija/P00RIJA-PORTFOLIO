"use client";

/* ============================================================
 * SmoothScroll — Lenis-based inertial scrolling.
 *
 * Wheel scrolling is eased (lerp) instead of stepped, which makes
 * every scroll-linked animation read as fluid instead of jumpy.
 * Disabled for prefers-reduced-motion and for the site's "off"
 * animation mode (accessibility + weakest devices).
 * ============================================================ */

import { useEffect } from "react";
import Lenis from "lenis";
import { useContent } from "@/lib/content-store";

declare global {
  interface Window {
    __lenis?: Lenis;
    __lenisSuspendCount?: number;
  }
}

/**
 * Suspend/resume smooth scrolling while a fullscreen overlay (CMS, login,
 * arcade…) is open. Reference-counted so nested overlays are safe. Also
 * freezes the page itself — overflow:hidden alone does NOT stop Lenis,
 * which drives the window scroll programmatically.
 */
export function suspendLenis(): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.__lenisSuspendCount = (window.__lenisSuspendCount ?? 0) + 1;
  if (window.__lenisSuspendCount === 1) {
    window.__lenis?.stop();
    document.documentElement.classList.add("lenis-stopped-by-overlay");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.classList.remove("lenis-stopped-by-overlay");
      document.body.style.overflow = prev;
      window.__lenis?.start();
    };
  }
  return () => {
    window.__lenisSuspendCount = Math.max(0, (window.__lenisSuspendCount ?? 1) - 1);
    if (window.__lenisSuspendCount === 0) {
      document.documentElement.classList.remove("lenis-stopped-by-overlay");
      window.__lenis?.start();
    }
  };
}

/** React hook for overlays: suspends Lenis + page scroll while `active`. */
export function useSuspendLenis(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return suspendLenis();
  }, [active]);
}

export function SmoothScroll() {
  const animationMode = useContent((s) => s.content.builder?.performance?.animationMode) ?? "normal";

  useEffect(() => {
    if (animationMode === "off") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return; // native touch scrolling

    const lenis = new Lenis({
      lerp: 0.08, // 0.08 = maximum butter-smooth (lower = floatier)
      wheelMultiplier: 0.9,
      smoothWheel: true,
      syncTouch: false, // keep native touch scrolling on mobile
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out for snappy but smooth feel
    });
    window.__lenis = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      delete window.__lenis;
    };
  }, [animationMode]);

  return null;
}
