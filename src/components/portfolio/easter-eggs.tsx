"use client";

/* ==================================================================
 * EasterEggManager — 13 hidden delights + a few engagement overlays.
 *
 *  1. Konami code (↑↑↓↓←→←→BA)  → rocket launch across the sky
 *  2. Type "42"                  → the answer, obviously
 *  3. Logo × 5 clicks            → CRT glitch takeover
 *  4. Idle 45s                   → hyperspace screensaver
 *  5. Shake the mouse            → meteor shower
 *  6. Visit gfx→sec→ai then sun  → rainbow comet flyby
 *  7. Press G                    → secret game hub
 *  8. Press T                    → theme roulette
 *  9. Sun × 3 quick clicks       → solar flare
 * 10. Footer version × 2 clicks  → Star-Wars credits crawl
 * 11. Scroll to the very bottom  → the edge of the universe
 * 12. Press ?                    → secrets hint card
 * 13. Terminal secret commands   → resume / rocket / 42 (in terminal)
 *
 * Achievements unlock through window CustomEvent("achieve", {detail:id}).
 * ================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useContent } from "@/lib/content-store";
import { nextTheme } from "@/lib/themes";
import { openGameCenter } from "./game-center";
import { useSuspendLenis } from "./smooth-scroll";
import { MeteorTrail } from "./meteor-trail";
import type { MeteorShowerConfig } from "@/lib/content-types";

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

const achieve = (id: string) =>
  window.dispatchEvent(new CustomEvent("achieve", { detail: id }));

/** Mirror of the CMS defaults when the unified meteor section is missing. */
const defaultMeteor = {
  enabled: true,
  emoji: "",
  density: 14,
  durationMs: 2600,
  cooldownMs: 8000,
  triggerSpeed: 2.6,
  direction: "end" as const,
  style: "realistic" as const,
  headStyle: "comet" as const,
  color: "#dcecff",
  angleMin: 12,
  angleMax: 28,
  lengthMin: 120,
  lengthMax: 240,
  thickness: 1.1,
  glow: 0.78,
  headSize: 3.2,
  spread: 55,
} satisfies MeteorShowerConfig;

export function EasterEggManager() {
  const lang = useContent((s) => s.lang);
  const screensaverSeconds = useContent((s) => s.content.builder?.performance?.screensaverSeconds);
  const meteor = useContent((s) => s.content.meteors?.shower ?? s.content.builder?.meteor);
  const { theme, setTheme } = useTheme();

  // latest meteor settings for the pointermove listener (ref → no re-subscribe)
  const meteorRef = useRef(meteor);
  useEffect(() => {
    meteorRef.current = meteor;
  }, [meteor]);

  const [fx, setFx] = useState<null | "rocket" | "glitch" | "meteor" | "flare" | "comet">(null);
  const [screensaver, setScreensaver] = useState(false);
  const [credits, setCredits] = useState(false);
  const [hints, setHints] = useState(false);

  const konamiIndex = useRef(0);
  const typedBuffer = useRef("");
  const logoClicks = useRef<number[]>([]);
  const sunClicks = useRef<number[]>([]);
  const versionClicks = useRef<number[]>([]);
  const planetSequence = useRef<string[]>([]);
  const shakeSpeed = useRef<number[]>([]);
  const lastPointer = useRef({ x: 0, y: 0, t: 0 });
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomReached = useRef(false);
  const fxTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFa = lang === "fa";

  const fire = useCallback((kind: typeof fx, ms = 4000, achievement?: string) => {
    setFx(kind);
    if (fxTimeout.current) clearTimeout(fxTimeout.current);
    fxTimeout.current = setTimeout(() => setFx(null), ms);
    if (achievement) achieve(achievement);
  }, []);

  /* ---------- keyboard driven eggs ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // exit overlays first
      if (e.key === "Escape") {
        setScreensaver(false);
        setCredits(false);
        setHints(false);
        return;
      }

      // 8. theme roulette
      if (e.key.toLowerCase() === "t") {
        const next = nextTheme(theme);
        setTheme(next);
        toast(isFa ? `🎡 تم چرخید: ${next}` : `🎡 Theme rolled: ${next}`, { duration: 1200 });
        achieve("theme-roulette");
        return;
      }

      // 7. game hub
      if (e.key.toLowerCase() === "g") {
        openGameCenter();
        achieve("game-hub");
        return;
      }

      // 12. hints
      if (e.key === "?") {
        setHints(true);
        achieve("hint-card");
        return;
      }

      // 1. konami
      const expected = KONAMI[konamiIndex.current];
      if (e.key === expected || e.key.toLowerCase() === expected) {
        konamiIndex.current += 1;
        if (konamiIndex.current === KONAMI.length) {
          konamiIndex.current = 0;
          fire("rocket", 4500, "konami");
          toast(isFa ? "🚀 موشک پرتاب شد!" : "🚀 Rocket launched!", { duration: 1800 });
        }
      } else {
        konamiIndex.current = e.key === KONAMI[0] ? 1 : 0;
      }

      // 2. "42"
      if (e.key.length === 1) {
        typedBuffer.current = (typedBuffer.current + e.key.toLowerCase()).slice(-6);
        if (typedBuffer.current.endsWith("42")) {
          typedBuffer.current = "";
          toast(isFa ? "4️⃣2️⃣ پاسخ نهایی زندگی، جهان و همه‌چیز" : "4️⃣2️⃣ The answer to life, the universe, everything", { duration: 2600 });
          achieve("answer-42");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theme, setTheme, isFa, fire]);

  /* ---------- idle screensaver (delay set from the CMS) ---------- */
  const screensaverMs = Math.max(0, Number(screensaverSeconds ?? 45)) * 1000;
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (screensaverMs <= 0) return; // 0 = disabled in the CMS
    idleTimer.current = setTimeout(() => {
      setScreensaver(true);
      achieve("screensaver");
    }, screensaverMs);
  }, [screensaverMs]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"];
    const wake = () => {
      if (screensaver) setScreensaver(false);
      resetIdle();
    };
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, wake));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [screensaver, resetIdle]);

  /* ---------- mouse shake → meteors (all knobs from the CMS) ---------- */
  useEffect(() => {
    let lastTrigger = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      const dt = now - lastPointer.current.t || 16;
      const speed = Math.hypot(dx, dy) / dt; // px per ms
      lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
      shakeSpeed.current.push(speed);
      if (shakeSpeed.current.length > 24) shakeSpeed.current.shift();
      const cfg = meteorRef.current ?? defaultMeteor;
      const triggerSpeed = Number.isFinite(Number(cfg?.triggerSpeed)) && Number(cfg.triggerSpeed) > 0 ? Number(cfg.triggerSpeed) : 2.6;
      const cooldownMs = Math.max(500, Number(cfg?.cooldownMs) || 8000);
      if (shakeSpeed.current.length === 24) {
        const avg = shakeSpeed.current.reduce((a, b) => a + b, 0) / shakeSpeed.current.length;
        if (avg > triggerSpeed && Date.now() - lastTrigger >= cooldownMs) {
          lastTrigger = Date.now();
          shakeSpeed.current = [];
          if (cfg?.enabled !== false) fire("meteor", Math.max(600, Number(cfg?.durationMs) || 3000), "meteor-shower");
        }
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [fire]);

  /* ---------- logo clicks ---------- */
  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      logoClicks.current = [...logoClicks.current.filter((t) => now - t < 2500), now];
      if (logoClicks.current.length >= 5) {
        logoClicks.current = [];
        fire("glitch", 3500, "crt-glitch");
        toast(isFa ? "📺 سیگنال اختلال دارد…" : "📺 Signal interference…", { duration: 1600 });
      }
    };
    window.addEventListener("logo-pressed", handler);
    return () => window.removeEventListener("logo-pressed", handler);
  }, [fire, isFa]);

  /* ---------- sun clicks + planet sequence ---------- */
  useEffect(() => {
    const sun = () => {
      const now = Date.now();
      sunClicks.current = [...sunClicks.current.filter((t) => now - t < 1500), now];
      if (sunClicks.current.length >= 3) {
        sunClicks.current = [];
        fire("flare", 3200, "solar-flare");
      }
      // sequence part: sun completes gfx→sec→ai→sun
      const seq = planetSequence.current;
      if (seq.length === 3 && seq[0] === "gfx" && seq[1] === "sec" && seq[2] === "ai") {
        planetSequence.current = [];
        fire("comet", 4200, "planet-sequence");
        toast(isFa ? "🌈 دنباله‌دار رنگین‌کمانی گذشت!" : "🌈 A rainbow comet flew by!", { duration: 2000 });
      } else {
        planetSequence.current = [];
      }
    };
    const planet = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      const seq = planetSequence.current;
      if (
        (seq.length === 0 && id === "gfx") ||
        (seq.length === 1 && id === "sec" && seq[0] === "gfx") ||
        (seq.length === 2 && id === "ai" && seq[1] === "sec")
      ) {
        planetSequence.current = [...seq, id];
      } else {
        planetSequence.current = id === "gfx" ? ["gfx"] : [];
      }
    };
    window.addEventListener("sun-pressed", sun);
    window.addEventListener("planet-visited", planet as EventListener);
    return () => {
      window.removeEventListener("sun-pressed", sun);
      window.removeEventListener("planet-visited", planet as EventListener);
    };
  }, [fire, isFa]);

  /* ---------- footer version double-click → credits ---------- */
  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      versionClicks.current = [...versionClicks.current.filter((t) => now - t < 1200), now];
      if (versionClicks.current.length >= 2) {
        versionClicks.current = [];
        setCredits(true);
        achieve("credits");
      }
    };
    window.addEventListener("footer-version-pressed", handler);
    return () => window.removeEventListener("footer-version-pressed", handler);
  }, []);

  /* ---------- bottom of page → edge of universe ---------- */
  useEffect(() => {
    const onScroll = () => {
      if (bottomReached.current) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY >= max - 4) {
        bottomReached.current = true;
        toast(isFa ? "🌌 به لبه‌ی جهان رسیدی — دیگر جایی برای رفتن نیست" : "🌌 You reached the edge of the universe — nowhere left to go", { duration: 3000 });
        achieve("edge-universe");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isFa]);

  return (
    <>
      {/* FX overlays */}
      <AnimatePresence>{fx === "rocket" && <RocketFx />}</AnimatePresence>
      <AnimatePresence>{fx === "glitch" && <GlitchFx />}</AnimatePresence>
      <AnimatePresence>
        {fx === "meteor" && <MeteorFx config={meteor ?? defaultMeteor} />}
      </AnimatePresence>
      <AnimatePresence>{fx === "flare" && <FlareFx />}</AnimatePresence>
      <AnimatePresence>{fx === "comet" && <CometFx />}</AnimatePresence>

      {/* Hyperspace screensaver */}
      <AnimatePresence>{screensaver && <ScreensaverFx onExit={() => setScreensaver(false)} lang={lang} />}</AnimatePresence>

      {/* Star-Wars style credits */}
      <AnimatePresence>{credits && <CreditsCrawl lang={lang} onDone={() => setCredits(false)} />}</AnimatePresence>

      {/* Secrets hint card */}
      <AnimatePresence>
        {hints && (
          <HintCard lang={lang} onClose={() => setHints(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

/* ================= FX implementations ================= */

function RocketFx() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[150]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute text-5xl"
        initial={{ x: "-15vw", y: "85vh", rotate: 45 }}
        animate={{ x: "115vw", y: "-15vh", rotate: 38 }}
        transition={{ duration: 3.2, ease: [0.3, 0.6, 0.4, 1] }}
      >
        🚀
      </motion.div>
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 3.2 }}
        style={{ background: "linear-gradient(to top, oklch(0.8 0.19 40 / 0.35), transparent)" }}
      />
    </motion.div>
  );
}

function GlitchFx() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[150] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 crt-scanlines" />
      <motion.div
        className="absolute inset-0 mix-blend-screen"
        animate={{
          x: [0, -8, 6, -3, 0],
          background: [
            "linear-gradient(transparent 0%, oklch(0.7 0.25 350 / 0.06) 100%)",
            "linear-gradient(transparent 0%, oklch(0.7 0.2 250 / 0.12) 100%)",
            "linear-gradient(transparent 0%, oklch(0.7 0.25 350 / 0.06) 100%)",
          ],
        }}
        transition={{ duration: 0.35, repeat: 8 }}
      />
    </motion.div>
  );
}

function MeteorFx({
  config,
}: {
  config: Partial<MeteorShowerConfig>;
}) {
  const cfg = { ...defaultMeteor, ...config };
  const count = Math.min(60, Math.max(3, Math.round(Number(cfg.density) || 14)));
  const duration = Math.min(8000, Math.max(600, Number(cfg.durationMs) || 2600)) / 1000;
  const direction = cfg.direction || "end";
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  const emoji = (cfg.emoji || "").trim().slice(0, 4);
  const angleMin = Math.max(3, Math.min(60, Number(cfg.angleMin) || 12));
  const angleMax = Math.max(angleMin, Math.min(70, Number(cfg.angleMax) || 28));
  const spread = Math.max(10, Math.min(90, Number(cfg.spread) || 55));

  const streaks = Array.from({ length: count }, (_, i) => {
    // horizontal travel per direction (logical start/end flip in RTL).
    // Real shooting stars glide at a SHALLOW angle — never straight down.
    const horizontal =
      direction === "down" ? (i % 2 === 0 ? 1 : -1) :
      direction === "start" ? (rtl ? 1 : -1) :
      direction === "end" ? (rtl ? -1 : 1) :
      (Math.random() < 0.5 ? -1 : 1);
    const dxVw = horizontal * (65 + Math.random() * 30);
    const angle = angleMin + Math.random() * (angleMax - angleMin);
    const viewportRatio = typeof window === "undefined" ? 1.6 : window.innerWidth / Math.max(1, window.innerHeight);
    const dyVh = Math.abs(dxVw) * viewportRatio * Math.tan((angle * Math.PI) / 180);
    const lengthMin = Math.max(50, Number(cfg.lengthMin) || 120);
    const lengthMax = Math.max(lengthMin, Number(cfg.lengthMax) || 240);
    return {
      startX: horizontal > 0 ? -25 - Math.random() * 30 : 75 + Math.random() * 40,
      startY: 3 + Math.random() * spread,
      dxVw,
      dyVh,
      angle: (Math.atan2(dyVh, dxVw * viewportRatio) * 180) / Math.PI,
      length: lengthMin + Math.random() * (lengthMax - lengthMin),
      delay: Math.random() * (duration * 0.55),
      dur: duration * (0.7 + Math.random() * 0.55),
      thickness: Math.max(0.4, Number(cfg.thickness) || 1.1) * (0.82 + Math.random() * 0.36),
    };
  });

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[150] overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {streaks.map((m, i) => {
        return (
          <motion.div
            key={i}
            className="absolute gpu"
            style={{ left: `${m.startX}%`, top: `${m.startY}%`, width: m.length, height: Math.max(18, m.thickness * 12), rotate: m.angle }}
            initial={{ x: 0, y: 0, opacity: 0, scaleX: 0.3 }}
            animate={{
              x: `${m.dxVw}vw`,
              y: `${m.dyVh}vh`,
              // visible glide with soft fade-in and burn-out at the end
              opacity: [0, 0, 1, 1, 0],
              scaleX: [0.3, 0.3, 1, 1, 0.5],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: m.dur,
              delay: m.delay,
              x: { duration: m.dur, delay: m.delay, ease: [0.35, 0.05, 0.5, 1] }, // gentle accelerate → glide
              y: { duration: m.dur, delay: m.delay, ease: [0.35, 0.05, 0.5, 1] },
              opacity: { duration: m.dur, delay: m.delay, times: [0, 0.15, 0.35, 0.8, 1] },
            }}
          >
            <MeteorTrail
              color={cfg.color || "#dcecff"}
              length={m.length}
              thickness={m.thickness}
              glow={Number(cfg.glow) || 0.78}
              headSize={Number(cfg.headSize) || 3.2}
              style={cfg.style}
              headStyle={cfg.headStyle}
              emoji={emoji}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function FlareFx() {
  return (
    <motion.div
      className="pointer-events-none fixed left-1/2 top-1/2 z-[150] -translate-x-1/2 -translate-y-1/2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {[0, 60, 120].map((rot) => (
        <motion.div
          key={rot}
          className="absolute left-0 top-0 origin-center"
          style={{ rotate: rot }}
          initial={{ scale: 0.2 }}
          animate={{ scale: 6, opacity: [0.8, 0] }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        >
          <div
            className="h-[30vh] w-[30vh] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, oklch(1 0.12 70 / 0.7), oklch(0.85 0.2 45 / 0.35) 40%, transparent 70%)" }}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

function CometFx() {
  const colors = ["#e84a9b", "#f5a623", "#3ee08a", "#4a8aff", "#8b5cf6", "#16d6c3"];
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-[150] overflow-hidden" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="absolute top-[22%] text-4xl"
        initial={{ x: "-12vw" }}
        animate={{ x: "112vw", y: [0, 40, -30, 20, 0], rotate: [0, 10, -8, 4, 0] }}
        transition={{ duration: 3.4, ease: "easeInOut" }}
      >
        ☄️
      </motion.div>
      {colors.map((c, i) => (
        <motion.span
          key={c}
          className="absolute top-[23%] h-1.5 w-1.5 rounded-full"
          style={{ background: c, boxShadow: `0 0 12px ${c}` }}
          initial={{ x: "-12vw", left: `${-2 - i * 1.4}vw` }}
          animate={{ x: "112vw", top: [`${22 + Math.sin(i) * 4}%`, `${23 + Math.cos(i) * 3}%`] }}
          transition={{ duration: 3.4, delay: 0.06 * i, ease: "easeInOut" }}
        />
      ))}
    </motion.div>
  );
}

function ScreensaverFx({ onExit, lang }: { onExit: () => void; lang: "fa" | "en" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const stars = Array.from({ length: 260 }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
    }));
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const loop = () => {
      const { width: w, height: h } = canvas;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        s.z -= 0.006;
        if (s.z <= 0.02) {
          s.x = Math.random() * 2 - 1;
          s.y = Math.random() * 2 - 1;
          s.z = 1;
        }
        const px = (s.x / s.z) * (w / 2) + w / 2;
        const py = (s.y / s.z) * (h / 2) + h / 2;
        const size = Math.max(0.4, (1 - s.z) * 2.6);
        ctx.fillStyle = `rgba(255,255,255,${0.9 - s.z * 0.7})`;
        ctx.fillRect(px, py, size, size);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[160] cursor-pointer bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onExit}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <motion.p
        className="absolute inset-x-0 bottom-14 text-center font-mono text-xs tracking-[0.4em] text-white/50"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2.6, repeat: Infinity }}
      >
        {lang === "fa" ? "حالت خواب عمیق — برای بازگشت کلیک کن" : "DEEP SLEEP — CLICK TO RETURN"}
      </motion.p>
    </motion.div>
  );
}

function CreditsCrawl({ lang, onDone }: { lang: "fa" | "en"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 15000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      className="fixed inset-0 z-[160] cursor-pointer overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      style={{ perspective: "380px" }}
    >
      <motion.div
        className="absolute inset-x-0 top-full origin-top text-center text-amber-300"
        style={{ transform: "rotateX(58deg)" }}
        animate={{ y: "-260%" }}
        transition={{ duration: 14, ease: "linear" }}
      >
        <h2 className="my-6 text-4xl font-black">{lang === "fa" ? "اعتبارها" : "CREDITS"}</h2>
        {(lang === "fa"
          ? [
              "یک خالق، سه جهان، یک داستان",
              "طراحی و ساخت — با عشق به فضای بی‌نهایت",
              "Three.js · Framer Motion · Next.js",
              "به قدرت کنجکاوی",
              "و به تو — که اینجا تا انتها ماندی ✨",
              "⭐",
            ]
          : [
              "One creator, three worlds, one story",
              "Designed & built — with love for the infinite",
              "Three.js · Framer Motion · Next.js",
              "To the power of curiosity",
              "And to you — who scrolled all the way down ✨",
              "⭐",
            ]
        ).map((line, i) => (
          <p key={i} className="my-4 text-lg font-bold">
            {line}
          </p>
        ))}
      </motion.div>
    </motion.div>
  );
}

function HintCard({ lang, onClose }: { lang: "fa" | "en"; onClose: () => void }) {
  // Freeze the page while the secrets card is open.
  useSuspendLenis(true);
  const hints =
    lang === "fa"
      ? [
          "⌨️ Konami: ↑ ↑ ↓ ↓ ← → ← → B A",
          "4️⃣ عدد ۴۲ را تایپ کن…",
          "🖱️ نشانگر را تکان تکان بده",
          "😴 ۴۵ ثانیه بی‌تحرک بمان",
          "☀️ روی خورشید ۳ بار سریع کلیک کن",
          "🪐 به ترتیب gfx → sec → ai سفر کن و به خورشید برگرد",
          "🔤 کلید T = چرخش تم، کلید G = مرکز بازی",
          "Ⓜ️ روی لوگو ۵ بار کلیک کن",
          "📄 دوبار روی شماره نسخه فوتر کلیک کن",
          "🛰️ در ترمینال دستورهای resume، rocket و 42 را امتحان کن",
        ]
      : [
          "⌨️ Konami: ↑ ↑ ↓ ↓ ← → ← → B A",
          "4️⃣ Type the number 42…",
          "🖱️ Shake your mouse wildly",
          "😴 Stay still for 45 seconds",
          "☀️ Triple-click the sun, fast",
          "🪐 Travel gfx → sec → ai, then return to the sun",
          "🔤 T = theme roulette, G = game hub",
          "Ⓜ️ Click the logo 5 times",
          "📄 Double-click the footer version",
          "🛰️ In the terminal try: resume, rocket, 42",
        ];
  return (
    <motion.div
      className="fixed inset-0 z-[155] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card/90 p-6 backdrop-blur-xl"
        data-lenis-prevent
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--sec-1)" }}>
          {lang === "fa" ? "فایل محرمانه" : "CLASSIFIED FILE"}
        </p>
        <h3 className="mb-4 text-xl font-black text-foreground">
          {lang === "fa" ? "🔓 رازهای پنهان سایت" : "🔓 Site secrets"}
        </h3>
        <ul className="space-y-2.5">
          {hints.map((h) => (
            <li key={h} className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground">
              {h}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          {lang === "fa" ? "برای بستن کلیک کن یا Esc" : "Click anywhere or Esc to close"}
        </p>
      </motion.div>
    </motion.div>
  );
}
