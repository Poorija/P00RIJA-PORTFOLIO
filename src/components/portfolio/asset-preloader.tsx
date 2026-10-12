"use client";

/* ============================================================
 * AssetPreloader — background warming for a fast, fluid scroll.
 *
 * When enabled in the CMS (builder.cache.preloadAssets, default ON)
 * and the visitor's connection is fast, after the page settles it:
 *   1. warms the heavy lazy chunks (CMS panel, music player) so the
 *      first open is instant;
 *   2. prefetches below-fold lazy images so scrolling never shows
 *      pop-in.
 * Skipped on slow connections / data-saver / background tabs.
 * ============================================================ */

import { useEffect } from "react";
import { useContent } from "@/lib/content-store";

type C = Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };

function connectionOk(): boolean {
  const c = (navigator as C).connection;
  if (!c) return true; // unknown — assume fine
  if (c.saveData) return false;
  const t = c.effectiveType || "4g";
  return t === "4g" || t === "3g";
}

export function AssetPreloader() {
  const enabled = useContent((s) => s.content.builder?.cache?.preloadAssets) ?? true;

  useEffect(() => {
    if (!enabled) return;
    if (document.visibilityState !== "visible") return;
    if (!connectionOk()) return;

    let cancelled = false;
    const idle = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(cb);
      else setTimeout(cb, 1800);
    };

    // 1) warm heavy lazy chunks
    const warmChunks = () => {
      if (cancelled) return;
      void import("@/components/portfolio/cms-panel").catch(() => undefined);
      void import("@/components/portfolio/music-player").catch(() => undefined);
    };

    // 2) prefetch lazy images currently in the DOM (below the fold)
    const warmImages = () => {
      if (cancelled) return;
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]'))
        .map((img) => img.currentSrc || img.src)
        .filter((src) => src && /^https?:|^data:|^\/(?!\/)/.test(src))
        .slice(0, 24);
      imgs.forEach((src) => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "image";
        link.href = src;
        document.head.appendChild(link);
      });
    };

    const onLoad = () => {
      if (cancelled) return;
      idle(() => {
        warmChunks();
        setTimeout(() => idle(warmImages), 1200);
      });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
    };
  }, [enabled]);

  return null;
}
