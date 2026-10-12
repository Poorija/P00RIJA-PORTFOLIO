/* ==================================================================
 * Shared animation/permission utilities.
 *
 * makeFrameGate(fps) — throttles render loops to a CMS-chosen frame rate.
 *   rAF still ticks at the display rate, but heavy per-frame work (WebGL
 *   renders, vertex morphing) is skipped unless enough time has passed.
 *   fps <= 0 → unlimited (gate always passes). Values above the display
 *   refresh simply never trigger a skip.
 *
 * ANIMATION_MODES — the site-wide motion presets, mirrored in the CMS form
 *   and the [data-anim-mode] CSS rules in globals.css.
 * ================================================================== */

export type AnimationMode = "off" | "reduced" | "normal" | "cinematic";

export const ANIMATION_MODES: {
  id: AnimationMode;
  fa: string;
  en: string;
  faDesc: string;
  enDesc: string;
}[] = [
  {
    id: "off",
    fa: "خاموش",
    en: "Off",
    faDesc: "همه‌ی انیمیشن‌های تزئینی خاموش — سبک‌ترین حالت برای دستگاه‌های ضعیف",
    enDesc: "All decorative motion off — lightest mode for weak devices",
  },
  {
    id: "reduced",
    fa: "کاهش‌یافته",
    en: "Reduced",
    faDesc: "انیمیشن‌ها آرام‌تر و کم‌رنگ‌تر، پس‌زمینه‌ی متحرک کم‌نور",
    enDesc: "Calmer, dimmer motion; muted animated background",
  },
  {
    id: "normal",
    fa: "معمولی",
    en: "Normal",
    faDesc: "تجربه‌ی کامل سایت با تعادل سرعت و زیبایی",
    enDesc: "The full site experience, balanced",
  },
  {
    id: "cinematic",
    fa: "سینمایی",
    en: "Cinematic",
    faDesc: "پس‌زمینه‌ی پررنگ‌تر و گذارهای نرم‌تر و طولانی‌تر",
    enDesc: "Richer background, longer smoother transitions",
  },
];

/** Clamp helper shared by CMS + render loops. */
export function clampFrameRate(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0; // unlimited
  return Math.min(640, Math.max(30, Math.round(n)));
}

/**
 * Returns a gate(nowMs) that passes at most `getFps()` times per second.
 * Create ONE gate per animation loop; the fps getter is re-read every
 * frame, so CMS changes apply live without rebuilding the scene.
 */
export function makeFrameGate(getFps: () => number) {
  let last = -Infinity;
  let cachedFps: number | null = null;
  let minDelta = 0;
  return (now: number): boolean => {
    const fps = clampFrameRate(getFps());
    if (fps !== cachedFps) {
      cachedFps = fps;
      minDelta = fps > 0 ? 1000 / fps : 0;
      last = -Infinity;
    }
    if (minDelta <= 0) return true;
    if (now - last < minDelta) return false;
    last = now;
    return true;
  };
}
