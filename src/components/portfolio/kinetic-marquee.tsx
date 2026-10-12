"use client";

import { useContent } from "@/lib/content-store";

/* KineticMarquee — a horizontal scrolling strip of words that bridges sections.
   The text reads forward in LTR (English) and the animation direction flips for RTL.
   Pure CSS animation, GPU-friendly. */
const WORDS_FA = [
  "خلاقیت",
  "دقت",
  "هوشمندی",
  "سه‌بعدی",
  "تعاملی",
  "گرافیک",
  "امنیت",
  "هوش مصنوعی",
  "یک خالق",
];
const WORDS_EN = [
  "creativity",
  "precision",
  "intelligence",
  "3D",
  "interactive",
  "graphics",
  "security",
  "AI",
  "one creator",
];

export function KineticMarquee() {
  const lang = useContent((s) => s.lang);
  const words = lang === "fa" ? WORDS_FA : WORDS_EN;
  const items = [...words, ...words]; // duplicate for seamless loop

  return (
    <div
      className="relative my-2 overflow-hidden border-y border-border py-5"
      style={{ background: "var(--surface-1)" }}
      aria-hidden
    >
      {/* edge fades */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
        style={{ background: "linear-gradient(to right, var(--background), transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
        style={{ background: "linear-gradient(to left, var(--background), transparent)" }}
      />
      <div
        className="flex w-max gap-8 whitespace-nowrap will-change-transform"
        style={{
          animation: `marquee-scroll ${lang === "fa" ? "40s" : "36s"} linear infinite`,
          direction: lang === "fa" ? "rtl" : "ltr",
        }}
      >
        {items.map((w, i) => (
          <span key={i} className="flex items-center gap-8">
            <span
              className="text-2xl font-black tracking-tight text-muted-foreground/40 sm:text-3xl"
            >
              {w}
            </span>
            <span
              className="text-2xl sm:text-3xl"
              style={{ color: "var(--gfx-1)" }}
            >
              ✦
            </span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
