"use client";

/* ============================================================
 * GameCenterOverlay — the arcade console.
 *
 * A full-screen "gaming console" shell: ambient gradient glow,
 * CRT scanlines, cartridge-style game cards with 3D tilt, and a
 * big "screen" area where the selected game renders. Opened from
 * the header button, the G key easter egg, or the terminal.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Gamepad2, Rocket, Trophy } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useSuspendLenis } from "./smooth-scroll";
import { CATEGORIES, GAMES, type GameCategory, type GameEntry } from "./games/registry";
import { arcadePaused } from "./games/shared";

const OPEN_EVENT = "open-game-center";

declare global {
  interface Window {
    __arcadePaused?: boolean;
  }
}
const LAST_KEY = "p00rija-arcade-last";

/** Global opener — header button, terminal `games`, easter eggs… */
export function openGameCenter(gameId?: string) {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: gameId }));
  } catch {
    // ignore
  }
}

export function GameCenterOverlay() {
  const lang = useContent((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const active = useMemo(() => GAMES.find((g) => g.id === activeId) ?? null, [activeId]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<string | undefined>).detail;
      setActiveId(detail ?? null);
      setCategory("all");
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // G key (only when nothing is focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if ((e.key === "g" || e.key === "G") && !open) {
        setOpen(true);
        setActiveId(null);
      }
      // Cmd/Ctrl+K — quick arcade launcher (vs-code style shortcut)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setActiveId(null);
      }
      if (e.key === "Escape" && open) {
        if (activeId) {
          if (!window.__arcadePaused) {
            window.__arcadePaused = true; // 1st Esc → pause the game
            setPaused(true);
          } else {
            window.__arcadePaused = false; // 2nd Esc → leave the game
            setPaused(false);
            setActiveId(null);
          }
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeId]);

  // Freeze the page (Lenis + body) while the console is open — wheel input
  // inside the arcade must only scroll the arcade, never the page behind it.
  useSuspendLenis(open);

  const visible = useMemo(
    () => (category === "all" ? GAMES : GAMES.filter((g) => g.category === category)),
    [category]
  );

  const exitGame = useCallback(() => {
    window.__arcadePaused = false;
    setPaused(false);
    setActiveId(null);
  }, []);

  const play = useCallback((game: GameEntry) => {
    window.__arcadePaused = false;
    setPaused(false);
    setActiveId(game.id);
    try {
      localStorage.setItem(LAST_KEY, game.id);
    } catch {
      // ignore
    }
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={lang === "fa" ? "مرکز بازی" : "Game Center"}
        >
          {/* ambient backdrop */}
          <div className="absolute inset-0 bg-background/90 backdrop-blur-xl" onClick={() => (activeId ? setActiveId(null) : setOpen(false))} />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full blur-[140px] opacity-30 animate-aurora" style={{ background: "radial-gradient(circle, var(--gfx-1), transparent 65%)" }} />
            <div className="absolute -bottom-32 right-1/4 h-96 w-96 rounded-full blur-[140px] opacity-30 animate-aurora" style={{ background: "radial-gradient(circle, var(--ai-1), transparent 65%)", animationDelay: "-12s" }} />
            <div className="absolute top-1/3 right-1/3 h-72 w-72 rounded-full blur-[120px] opacity-20 animate-aurora" style={{ background: "radial-gradient(circle, var(--sec-1), transparent 65%)", animationDelay: "-6s" }} />
          </div>

          {/* console shell */}
          <motion.div
            initial={{ scale: 0.94, y: 26, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 14, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-border bg-card/80 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* console top bar */}
            <div className="relative flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400/80 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                <span className="h-3 w-3 rounded-full bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" style={{ color: "var(--ai-1)" }} />
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {lang === "fa" ? "مرکز بازی" : "P00RIJA ARCADE"}
                </p>
              </div>
              <span className="ms-auto hidden items-center gap-1.5 rounded-full border border-border px-3 py-1 font-mono text-[10px] text-muted-foreground sm:flex">
                <Rocket className="h-3 w-3" style={{ color: "var(--sec-1)" }} />
                {GAMES.length} {lang === "fa" ? "بازی" : "games"}
              </span>
              <button
                onClick={() => setOpen(false)}
                data-cursor-hover
                aria-label={lang === "fa" ? "بستن" : "Close"}
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
              >
                ✕
              </button>
              {/* scanline sheen */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(to right, transparent, color-mix(in oklch, var(--ai-1) 60%, transparent), transparent)" }} />
            </div>

            <div ref={scrollRef} className="game-center-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" data-lenis-prevent>
              <AnimatePresence mode="wait">
                {active ? (
                  <motion.div
                    key="game"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="mx-auto w-full max-w-2xl"
                  >
                    <button
                      onClick={exitGame}
                      data-cursor-hover
                      className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      {lang === "fa" ? "همه بازی‌ها" : "All games"}
                    </button>

                    {/* the "console screen" */}
                    <div
                      dir="ltr"
                      className="game-crt relative rounded-2xl border p-4 sm:p-6"
                      style={{
                        borderColor: `color-mix(in oklch, ${active.accent} 30%, transparent)`,
                        background: `linear-gradient(160deg, color-mix(in oklch, ${active.accent} 7%, transparent), transparent 55%), color-mix(in oklch, ${active.accent2} 4%, var(--card))`,
                        boxShadow: `0 0 60px -20px color-mix(in oklch, ${active.accent} 60%, transparent)`,
                      }}
                    >
                      <div className="game-crt-lines pointer-events-none absolute inset-0 rounded-2xl" />
                      <active.Component />
                      {paused && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-background/80 backdrop-blur-sm"
                        >
                          <div className="flex flex-col items-center gap-4">
                            <p className="font-mono text-2xl font-black tracking-[0.4em]" style={{ color: active.accent }}>
                              ⏸ {lang === "fa" ? "توقف" : "PAUSED"}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { window.__arcadePaused = false; setPaused(false); }}
                                data-cursor-hover
                                className="rounded-xl px-5 py-2.5 text-xs font-bold text-white"
                                style={{ background: `linear-gradient(135deg, ${active.accent}, ${active.accent2})` }}
                              >
                                {lang === "fa" ? "ادامه (Esc)" : "Resume (Esc)"}
                              </button>
                              <button
                                onClick={exitGame}
                                data-cursor-hover
                                className="rounded-xl border border-border px-5 py-2.5 text-xs font-bold text-muted-foreground transition hover:text-foreground"
                              >
                                {lang === "fa" ? "خروج از بازی" : "Exit game"}
                              </button>
                            </div>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {lang === "fa" ? "Esc اول: توقف · Esc دوم: خروج" : "1st Esc: pause · 2nd Esc: exit"}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <h2 className="text-center text-2xl font-black text-foreground sm:text-3xl">
                      {lang === "fa" ? (
                        <>🎮 کهکشان <span className="text-gradient-tri">بازی‌ها</span></>
                      ) : (
                        <>🎮 The <span className="text-gradient-tri">Galaxy</span> Arcade</>
                      )}
                    </h2>
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                      {lang === "fa" ? "یک کارت را انتخاب کن — رکوردها روی همین دستگاه ذخیره می‌شوند" : "Pick a cartridge — best scores stay on this device"}
                    </p>

                    {/* category chips */}
                    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                      {CATEGORIES.map((c) => {
                        const selected = category === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setCategory(c.id)}
                            data-cursor-hover
                            className="rounded-full border px-3.5 py-1.5 font-mono text-[11px] transition-all duration-200"
                            style={{
                              borderColor: selected ? "var(--ai-1)" : "var(--border)",
                              color: selected ? "var(--ai-1)" : "var(--muted-foreground)",
                              background: selected ? "color-mix(in oklch, var(--ai-1) 10%, transparent)" : "transparent",
                              boxShadow: selected ? "0 0 16px -6px var(--ai-1)" : "none",
                            }}
                          >
                            {lang === "fa" ? c.fa : c.en}
                          </button>
                        );
                      })}
                    </div>

                    {/* cartridge grid */}
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {visible.map((g, i) => (
                        <motion.button
                          key={g.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(0.3, i * 0.025), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          whileHover={{ y: -5, rotateX: 4, rotateY: -4 }}
                          onClick={() => play(g)}
                          data-cursor-hover
                          className="arcade-card group relative overflow-hidden rounded-2xl border p-4 text-start"
                          style={{
                            borderColor: "var(--border)",
                            background: `linear-gradient(150deg, color-mix(in oklch, ${g.accent} 10%, transparent), transparent 60%), var(--surface-1)`,
                            transformStyle: "preserve-3d",
                          }}
                        >
                          <div
                            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            style={{ background: `radial-gradient(220px circle at 50% 0%, color-mix(in oklch, ${g.accent} 16%, transparent), transparent 70%)` }}
                          />
                          <span
                            className="relative grid h-10 w-10 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                            style={{
                              color: g.accent,
                              background: `color-mix(in oklch, ${g.accent} 12%, transparent)`,
                              border: `1px solid color-mix(in oklch, ${g.accent} 35%, transparent)`,
                              boxShadow: `0 0 18px -6px color-mix(in oklch, ${g.accent} 70%, transparent)`,
                            }}
                          >
                            <g.icon className="h-5 w-5" />
                          </span>
                          <p className="relative mt-3 truncate text-sm font-black text-foreground">{lang === "fa" ? g.fa : g.en}</p>
                          <p className="relative mt-0.5 line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground">
                            {lang === "fa" ? g.faDesc : g.enDesc}
                          </p>
                          <span
                            className="relative mt-2.5 block h-0.5 w-7 rounded-full transition-all duration-300 group-hover:w-full"
                            style={{ background: `linear-gradient(to right, ${g.accent}, ${g.accent2})` }}
                          />
                        </motion.button>
                      ))}
                    </div>

                    <p className="mt-6 flex items-center justify-center gap-2 text-center font-mono text-[10px] text-muted-foreground">
                      <Trophy className="h-3 w-3" style={{ color: "var(--chart-2)" }} />
                      {lang === "fa" ? "کلید G برای باز کردن · Esc برای بستن" : "Press G to open · Esc to close"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
