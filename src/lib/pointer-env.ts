/* ============================================================
 * Paint-risk environment detection (client-only helpers).
 *
 * iPadOS Safari reports a desktop UA but runs the iOS WebKit engine,
 * where backdrop-filter layers and fixed overlays painted over live
 * filtered content (e.g. a blurred WebGL section) composite
 * unreliably — the layer silently renders nothing (see the v3.3.3
 * iOS tab-kill and v3.3.4 backdrop fixes for the phone-sized case;
 * iPads fell between the two: desktop layout, iOS paint bugs).
 *
 * When these helpers say "risky", callers use solid dialog backdrops
 * and stop filtering live content behind open overlays.
 * ============================================================ */

export function iosWebkit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const plat = (navigator as { platform?: string }).platform || "";
  // Modern iPadOS: Mac platform string + touch points, no "iPad" in UA.
  return /iP(hone|ad|od)/.test(ua) || (plat === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function coarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** True when the current environment paints overlays unreliably (iOS WebKit or any touch-primary device). */
export function riskyPaintEnv(): boolean {
  return coarsePointer() || iosWebkit();
}
