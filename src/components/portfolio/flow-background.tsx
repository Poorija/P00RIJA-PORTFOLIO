"use client";

import { useContent } from "@/lib/content-store";

// Liquid aurora background.
// Dark base + 6 large radial-gradient blobs with heavy blur + screen blend.
// Overlapping blobs merge into smooth liquid color transitions.
// Keyframes injected via a <style> tag to guarantee they reach the DOM
// (Tailwind v4 can drop top-level @keyframes in globals.css).

const BLOBS = [
  { color: "var(--gfx-1)", top: "8%", left: "12%", size: 48, anim: "liquid-1", dur: 32, delay: 0 },
  { color: "var(--gfx-3)", top: "62%", left: "70%", size: 42, anim: "liquid-2", dur: 38, delay: -6 },
  { color: "var(--sec-1)", top: "30%", left: "78%", size: 50, anim: "liquid-3", dur: 34, delay: -12 },
  { color: "var(--sec-2)", top: "75%", left: "18%", size: 44, anim: "liquid-4", dur: 40, delay: -3 },
  { color: "var(--ai-1)",  top: "45%", left: "45%", size: 52, anim: "liquid-5", dur: 36, delay: -18 },
  { color: "var(--ai-3)",  top: "15%", left: "55%", size: 40, anim: "liquid-6", dur: 42, delay: -9 },
] as const;

const KEYFRAMES = `
@keyframes liquid-1 {
  0%   { transform: translate(0%, 0%); }
  20%  { transform: translate(18vw, -12vh); }
  40%  { transform: translate(34vw, 8vh); }
  60%  { transform: translate(12vw, 24vh); }
  80%  { transform: translate(-14vw, 6vh); }
  100% { transform: translate(0%, 0%); }
}
@keyframes liquid-2 {
  0%   { transform: translate(0%, 0%); }
  25%  { transform: translate(-22vw, 14vh); }
  50%  { transform: translate(-8vw, 30vh); }
  75%  { transform: translate(16vw, 12vh); }
  100% { transform: translate(0%, 0%); }
}
@keyframes liquid-3 {
  0%   { transform: translate(0%, 0%); }
  30%  { transform: translate(20vw, 20vh); }
  60%  { transform: translate(-18vw, -8vh); }
  100% { transform: translate(0%, 0%); }
}
@keyframes liquid-4 {
  0%   { transform: translate(0%, 0%); }
  22%  { transform: translate(-26vw, -18vh); }
  48%  { transform: translate(10vw, -28vh); }
  74%  { transform: translate(22vw, -6vh); }
  100% { transform: translate(0%, 0%); }
}
@keyframes liquid-5 {
  0%   { transform: translate(0%, 0%); }
  33%  { transform: translate(16vw, -22vh); }
  66%  { transform: translate(-20vw, 10vh); }
  100% { transform: translate(0%, 0%); }
}
@keyframes liquid-6 {
  0%   { transform: translate(0%, 0%); }
  28%  { transform: translate(-14vw, 18vh); }
  56%  { transform: translate(24vw, 22vh); }
  82%  { transform: translate(8vw, -14vh); }
  100% { transform: translate(0%, 0%); }
}
`;

export function FlowBackground() {
  const design = useContent((s) => s.content.design);
  const animationMode = useContent((s) => s.content.builder?.performance?.animationMode) ?? "normal";
  const bg = design?.background;
  const blobs = bg?.blobs?.length ? bg.blobs : BLOBS;
  const speed = Math.max(0.1, Number(bg?.speed || 1));
  const blur = Number.isFinite(Number(bg?.blur)) ? Number(bg?.blur) : 70;
  // CMS animation mode scales the aurora intensity (and fully hides it in
  // "off" — the 6 blurred layers are the single heaviest always-on effect).
  const modeFactor =
    animationMode === "off" ? 0 : animationMode === "reduced" ? 0.4 : animationMode === "cinematic" ? 1.3 : 1;
  const opacity = (Number.isFinite(Number(bg?.opacity)) ? Number(bg?.opacity) : 1) * modeFactor;
  const grainOpacity = Number.isFinite(Number(bg?.grainOpacity)) ? Number(bg?.grainOpacity) : 0.05;
  const vignetteStrength = Number.isFinite(Number(bg?.vignetteStrength)) ? Number(bg?.vignetteStrength) : 0.75;

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden will-animate"
      aria-hidden
    >
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Dark base layer (theme-aware via --ink) */}
      <div className="absolute inset-0" style={{ background: bg?.baseColor || "var(--ink)" }} />

      {/* Liquid aurora blobs — hidden entirely in "off" mode.
          The wrapper is ISOLATED on purpose: blobs then blend only with each
          other inside this group, not with the page content scrolling above.
          Unisolated mix-blend-mode re-composited against the moving page on
          every scroll frame and was the biggest source of scroll freezes. */}
      <div className="absolute inset-0 isolate">
        {opacity > 0.01 && blobs.map((b, i) => {
          const anim = `liquid-${(i % 6) + 1}`;
          const dur = Math.max(4, Number("dur" in b ? b.dur : b.duration) / speed);
          return (
          <div
            key={i}
            className="aurora-blob"
            style={{
              position: "absolute",
              top: b.top,
              left: b.left,
              width: `${b.size}vmin`,
              height: `${b.size}vmin`,
              borderRadius: "50%",
              background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, color-mix(in oklch, ${b.color} 40%, transparent) 45%, transparent 70%)`,
              filter: `blur(${blur}px)`,
              mixBlendMode: (bg?.blendMode as React.CSSProperties["mixBlendMode"]) || "screen",
              opacity,
              willChange: "transform",
              animation: `${anim} ${dur}s ease-in-out ${b.delay}s infinite`,
            }}
          />
          );
        })}
      </div>

      {/* Subtle vignette to deepen edges and focus center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(ellipse at center, transparent 40%, color-mix(in oklch, var(--ink) ${Math.round(vignetteStrength * 100)}%, transparent) 100%)`,
        }}
      />

      {/* Fine grain texture for premium film feel */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          opacity: grainOpacity,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
