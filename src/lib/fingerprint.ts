"use client";

/* ============================================================
 * First-party device fingerprint (no external library).
 *
 * Collects the stable, permission-free signals a browser offers and
 * hashes them into one id. Combined server-side with the UA family
 * this identifies a device across VPNs (IP is NOT part of the id)
 * and incognito sessions (no storage needed):
 *   canvas render hash · WebGL vendor+renderer · screen size + depth
 *   + devicePixelRatio · timezone · languages · CPU cores · device
 *   memory · platform · touch points · audio sample rate.
 * MAC address / real hardware serials are NOT readable from browsers
 * — this composite is the industry-standard equivalent.
 * ============================================================ */

export interface FingerprintResult {
  hash: string;
  platform: string;
  timezone: string;
}

function canvasSignal(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "alphabetic";
    ctx.font = "15px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(10, 8, 100, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("p00::fingerprint::مرحبا::你好::👋", 12, 24);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("p00::fingerprint::مرحبا::你好::👋", 13, 25);
    ctx.beginPath();
    ctx.arc(160, 20, 12, 0, Math.PI * 2);
    ctx.strokeStyle = "#9fe";
    ctx.stroke();
    return canvas.toDataURL().slice(-160);
  } catch {
    return "canvas-error";
  }
}

function webglSignal(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "no-webgl";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? String(gl.getParameter((dbg as { UNMASKED_VENDOR_WEBGL: number }).UNMASKED_VENDOR_WEBGL)) : "";
    const renderer = dbg ? String(gl.getParameter((dbg as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL)) : "";
    return `${vendor}~${renderer}`;
  } catch {
    return "webgl-error";
  }
}

function audioSignal(): string {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return "no-audio";
    const ctx = new Ctx();
    const sr = ctx.sampleRate;
    const maxCh = ctx.destination.maxChannelCount;
    void ctx.close?.();
    return `${sr}~${maxCh}`;
  } catch {
    return "audio-error";
  }
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Collect the fingerprint. Safe to call once per page load. */
export async function collectFingerprint(): Promise<FingerprintResult | null> {
  if (typeof window === "undefined" || !crypto?.subtle) return null;
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const components = [
      canvasSignal(),
      webglSignal(),
      audioSignal(),
      `${screen.width}x${screen.height}x${screen.colorDepth}@${window.devicePixelRatio}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      (navigator.languages || [navigator.language]).join(","),
      String(navigator.hardwareConcurrency ?? ""),
      String(nav.deviceMemory ?? ""),
      navigator.platform ?? "",
      String(navigator.maxTouchPoints ?? 0),
    ].join("|");
    const hash = await sha256Hex(components);
    return {
      hash,
      platform: navigator.platform ?? "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    };
  } catch {
    return null;
  }
}
