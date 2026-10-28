"use client";

/* ==================================================================
 * AchievementsPanel — a small "collect them all" meta-game.
 *
 * A floating trophy button (bottom-left) opens a grid of badges.
 * Anything on the site can unlock one via:
 *   window.dispatchEvent(new CustomEvent("achieve", { detail: "<id>" }))
 * Unlocks persist in localStorage and pop a toast + confetti sparkle.
 * ================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Trophy, X } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useSuspendLenis } from "./smooth-scroll";

const STORAGE_KEY = "p00rija-achievements-v1";

export interface AchievementDef {
  id: string;
  emoji: string;
  fa: string;
  en: string;
  /** hidden name until unlocked (shows ???) */
  secret?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // exploration
  { id: "sun-visitor", emoji: "☀️", fa: "خورشید را ملاقات کردی", en: "Met the sun" },
  { id: "resume-downloader", emoji: "📄", fa: "دنبال‌کننده رزومه", en: "Résumé hunter" },
  { id: "timeline-explorer", emoji: "🛤️", fa: "مسافر زمان", en: "Time traveler" },
  { id: "edge-universe", emoji: "🌌", fa: "لبه‌ی جهان", en: "Edge of the universe" },
  // themes & language
  { id: "theme-roulette", emoji: "🎡", fa: "چرخ‌وفلک تم", en: "Theme roulette" },
  { id: "polyglot", emoji: "🗣️", fa: "دوزبانه", en: "Polyglot" },
  // games
  { id: "game-hub", emoji: "🎮", fa: "پیدا کردن آرکید مخفی", en: "Found the secret arcade", secret: true },
  { id: "code-master", emoji: "🔐", fa: "شکننده کد", en: "Code breaker" },
  { id: "color-alchemist", emoji: "🎨", fa: "کیمیاگر رنگ", en: "Color alchemist" },
  { id: "neural-mind", emoji: "🧠", fa: "ذهن عصبی", en: "Neural mind" },
  { id: "space-survivor", emoji: "🚀", fa: "بازمانده فضا", en: "Space survivor" },
  // easter eggs
  { id: "konami", emoji: "🕹️", fa: "استاد کونامی", en: "Konami master", secret: true },
  { id: "answer-42", emoji: "4️⃣", fa: "پاسخ نهایی", en: "The answer", secret: true },
  { id: "crt-glitch", emoji: "📺", fa: "اختلال سیگنال", en: "Signal glitch", secret: true },
  { id: "screensaver", emoji: "😴", fa: "خواب عمیق", en: "Deep sleep", secret: true },
  { id: "meteor-shower", emoji: "☄️", fa: "باران شهاب", en: "Meteor shower", secret: true },
  { id: "planet-sequence", emoji: "🌈", fa: "راز منظومه", en: "Solar secret", secret: true },
  { id: "solar-flare", emoji: "🔥", fa: "شمش خورشیدی", en: "Solar flare", secret: true },
  { id: "credits", emoji: "🎬", fa: "تماشای اعتبارها", en: "Watched the credits", secret: true },
  { id: "hint-card", emoji: "🗝️", fa: "کلید رازها", en: "Key of secrets", secret: true },
  { id: "terminal-secret", emoji: "🛰️", fa: "دستیار مخفی", en: "Hidden assistant", secret: true },
  { id: "terminal-ascii", emoji: "🔡", fa: "رمزگشای پیکسل", en: "Pixel decoder", secret: true },
  { id: "matrix-choice", emoji: "🕶️", fa: "ملاقات مورفئوس", en: "Met Morpheus", secret: true },
  { id: "matrix-blue", emoji: "🔵", fa: "بیدار شدن", en: "Woke up", secret: true },
  { id: "matrix-red", emoji: "🔴", fa: "عمق سوراخ خرگوش", en: "Down the rabbit hole", secret: true },
  { id: "golden-p00rija", emoji: "🏆", fa: "کلید سه جهان", en: "Key of three worlds", secret: true },
  { id: "creator-signature", emoji: "✨", fa: "امضای خالق", en: "Creator signature", secret: true },
  { id: "golden-hunter", emoji: "🥚", fa: "شکار تخم‌مرغ طلایی", en: "Golden egg hunter", secret: true },
];

type Unlocked = Record<string, number>;

function readUnlocked(): Unlocked {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Unlocked;
  } catch {
    return {};
  }
}

export function AchievementsPanel() {
  const lang = useContent((s) => s.lang);
  const [unlocked, setUnlocked] = useState<Unlocked>({});
  const unlockedRef = useRef<Unlocked>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Read persisted unlocks after mount (rAF) so SSR markup stays stable.
    const id = requestAnimationFrame(() => {
      const saved = readUnlocked();
      unlockedRef.current = saved;
      setUnlocked(saved);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const unlock = useCallback((id: string) => {
      if (unlockedRef.current[id]) return;
      const next = { ...unlockedRef.current, [id]: Date.now() };
      unlockedRef.current = next;
      setUnlocked(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) {
          const activeLang = useContent.getState().lang;
          toast(activeLang === "fa" ? `🏆 دستاورد: ${def.fa}` : `🏆 Achievement: ${def.en}`, {
            description: activeLang === "fa" ? "در گنجینه دستاوردها ثبت شد" : "Added to your trophy case",
            duration: 2800,
          });
        }
    }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail;
      if (typeof id === "string") unlock(id);
    };
    window.addEventListener("achieve", handler);
    return () => window.removeEventListener("achieve", handler);
  }, [unlock]);

  // public helpers wired from other components
  useEffect(() => {
    const openProfile = () => unlock("sun-visitor");
    window.addEventListener("open-profile", openProfile);
    return () => window.removeEventListener("open-profile", openProfile);
  }, [unlock]);

  const total = ACHIEVEMENTS.length;
  const count = Object.keys(unlocked).length;
  const pct = useMemo(() => Math.round((count / total) * 100), [count, total]);

  // Freeze the page (Lenis + body) while the vault is open.
  useSuspendLenis(open);

  return (
    <>
      {/* floating trophy button — bottom-left (mirrors BackToTop) */}
      <motion.button
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2, type: "spring" }}
        onClick={() => setOpen(true)}
        data-cursor-hover
        aria-label={lang === "fa" ? "دستاوردها" : "Achievements"}
        className="fixed bottom-6 end-6 z-[86] grid h-12 w-12 place-items-center rounded-full border border-border bg-card/70 backdrop-blur-md transition-colors hover:bg-card"
      >
        <Trophy className="h-5 w-5" style={{ color: count > 0 ? "var(--chart-4)" : "var(--muted-foreground)" }} />
        {count > 0 && (
          <span
            className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px] font-bold text-black"
            style={{ background: "var(--chart-4)" }}
          >
            {count}
          </span>
        )}
      </motion.button>

      {/* panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
            <motion.div
              initial={{ scale: 0.92, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="relative max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card/90 p-6 backdrop-blur-xl"
              data-lenis-prevent
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(false)}
                aria-label={lang === "fa" ? "بستن" : "Close"}
                className="absolute end-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--chart-4)" }}>
                {lang === "fa" ? "گنجینه کاوشگر" : "EXPLORER'S VAULT"}
              </p>
              <h3 className="mt-1 text-xl font-black text-foreground">
                {lang === "fa" ? "🏆 دستاوردها" : "🏆 Achievements"}
              </h3>

              {/* progress */}
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {count} / {total}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(to right, var(--gfx-1), var(--sec-1), var(--ai-1))" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* grid */}
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACHIEVEMENTS.map((a) => {
                  const has = !!unlocked[a.id];
                  return (
                    <motion.div
                      key={a.id}
                      whileHover={{ y: -3 }}
                      className={
                        "rounded-2xl border p-3 text-center " +
                        (has ? "border-border bg-background/60" : "border-dashed border-border/60 bg-transparent opacity-60")
                      }
                    >
                      <div className={"text-2xl " + (has ? "" : "grayscale")}>{has ? a.emoji : "❔"}</div>
                      <p className="mt-1.5 text-[11px] font-bold leading-tight text-foreground">
                        {has || !a.secret ? (lang === "fa" ? a.fa : a.en) : lang === "fa" ? "؟؟؟" : "???"}
                      </p>
                    </motion.div>
                  );
                })}
              </div>

              <p className="mt-5 text-center text-[10px] leading-relaxed text-muted-foreground">
                {lang === "fa"
                  ? "بخش‌ها را بگرد، بازی کن و رازها را پیدا کن — بعضی دستاوردها مخفی‌اند تا آخرین لحظه!"
                  : "Explore sections, play games and hunt secrets — some badges stay hidden until you find them!"}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
