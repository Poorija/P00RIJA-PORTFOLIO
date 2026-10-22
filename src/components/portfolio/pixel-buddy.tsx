"use client";

/* ============================================================
 * PixelBuddy — a desktop-pet style pixel companion.
 *
 * Enabled from CMS → «همدم پیکسلی (AI)». The buddy WANDERS along the
 * bottom edge of the screen (entertains), has multiple face moods
 * (idle / happy / thinking / talking / sleeping — blinks too), is
 * DRAGGABLE anywhere, and on click opens a compact chat. Replies come
 * from POST /api/ai/chat, which feeds the model with the owner's real
 * profile/skills/projects — so it answers questions ABOUT the owner.
 * ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useContent } from "@/lib/content-store";
import { useSuspendLenis } from "./smooth-scroll";
import { buddyChat } from "@/lib/buddy-chat-action";

type Mood = "idle" | "happy" | "thinking" | "talking" | "sleeping";
type Bubble = { role: "buddy" | "user"; text: string };

/* ── Pet looks: detailed 12×12 multi-color sprites (8-bit style).
   Grid chars: "." empty · "1" body · "2" shade/secondary · "6" accent detail.
   Moods are drawn ON TOP (eyes/mouth/blush) — see MOODS below. */
const G: Record<string, string[]> = {
  blob: [
    "....1111....","..11111111..",".1111111111.",".1111111111.",
    "111111111111","111111111111","111111111111","111111111111",
    ".1111111111.",".1122222211.","..12222221..","...222222...",
  ],
  cat: [
    ".11......11.",".111....111.",".1111..1111.",".1111111111.",
    "112211112211","111111111111","111666666111",".1166666611.",
    ".1111111111.",".1122112211.","..11111111..","...111111...",
  ],
  ghost: [
    "....1111....","..11111111..",".1111111111.",".1111111111.",
    "111111111111","112111112111","112111112111","111111111111",
    "111111111111","111111111111",".11.11.11.1.",".1..1..1..1.",
  ],
  invader: [
    "..1......1..","...1....1...","..11111111..",".1111111111.",
    "11.211112.11","111111111111","1.211111112.","1.1......1.1",
    "..2......2..","...2....2...","..2......2..",".2........2.",
  ],
  slime: [
    "....1111....","...111111...","..11221111..",".1112211111.",
    ".1111111111.","111111111111","111111111111","111111111111",
    "111111111111",".1111111111.",".1111111111.","..11111111..",
  ],
  robot: [
    "......2.....",".....222....","..11111111..",".1111111111.",
    "166666666661","166666666661",".1111111111.",".1611111161.",
    ".1111111111.","..11111111..","...22..22...","...2....2...",
  ],
  star: [
    ".....11.....","....1111....","....1111....","111111111111",
    "111111111111",".1111111111.","..11111111..","..1122211...",
    ".112....211.",".11......11.","11........11","1..........1",
  ],
  dragon: [
    "...11..11...","..11111111..",".1111111111.","111211121111",
    "111111111111","112111111211","111111111111",".1166666111.",
    ".1111111111.","111111111111","1.11111111.1","1..111111..1",
  ],
  panda: [
    ".22......22.",".222....222.",".2222222222.","222222222222",
    "221111111122","211111111112","211111111112","221111111122",
    "222666666222",".2266666622.",".2222222222.","..22222222..",
  ],
  mushroom: [
    "...111111...","..11222111..",".1122112211.","111221122111",
    "111111111111","111111111111",".6666666666.",".6666666666.",
    ".6666666666.","..66666666..","...666666...","...666666...",
  ],
};
const parse = (rows: string[]) => rows.map((r) => Array.from(r).map((c) => (c === "." ? 0 : Number(c) || 1)));
const CHARACTERS: Record<string, number[][]> = Object.fromEntries(Object.entries(G).map(([k, v]) => [k, parse(v)]));

/* Per-character palettes — body / shade / detail. The CMS accent only tints
   the glow & chat UI; sprites keep their own colors (no more all-purple). */
const PALETTES: Record<string, { 1: string; 2?: string; 6?: string }> = {
  blob:     { 1: "#a78bfa", 2: "#7c3aed" },
  cat:      { 1: "#f59e0b", 2: "#b45309", 6: "#fef3c7" },
  ghost:    { 1: "#e2e8f0", 2: "#94a3b8" },
  invader:  { 1: "#4ade80", 2: "#16a34a" },
  slime:    { 1: "#2dd4bf", 2: "#99f6e4" },
  robot:    { 1: "#94a3b8", 2: "#334155", 6: "#22d3ee" },
  star:     { 1: "#fbbf24", 2: "#f59e0b" },
  dragon:   { 1: "#f87171", 2: "#dc2626", 6: "#fde68a" },
  panda:    { 1: "#f8fafc", 2: "#1e293b", 6: "#f8fafc" },
  mushroom: { 1: "#ef4444", 2: "#b91c1c", 6: "#fef9c3" },
};

/* Mood overlays: [row, col] cell coords drawn ON the 12×12 sprite. */
const MOODS: Record<Mood, { eyes: [number, number][]; mouth: [number, number][]; blush: [number, number][] }> = {
  idle:     { eyes: [[4,3],[4,8]], mouth: [[7,5],[7,6]], blush: [[8,2],[8,9]] },
  happy:    { eyes: [[3,3],[4,3],[3,8],[4,8]], mouth: [[7,4],[7,5],[7,6],[7,7]], blush: [[8,2],[8,9]] },
  thinking: { eyes: [[4,3],[3,8]], mouth: [[6,7],[7,6]], blush: [] },
  talking:  { eyes: [[4,3],[4,8]], mouth: [[6,5],[6,6],[7,4],[7,5],[7,6],[7,7]], blush: [[8,2],[8,9]] },
  sleeping: { eyes: [[4,2],[4,3],[4,8],[4,9]], mouth: [[7,6]], blush: [] },
};

function Face({ mood, accent, blink, character = "blob" }: { mood: Mood; accent: string; blink: boolean; character?: string }) {
  const shape = CHARACTERS[character] || CHARACTERS.blob;
  const palette = PALETTES[character] || PALETTES.blob;
  const overlay = MOODS[mood];
  const cellType = (y: number, x: number) => {
    if (overlay.eyes.some(([r, c]) => r === y && c === x)) return 2;
    if (overlay.mouth.some(([r, c]) => r === y && c === x)) return 3;
    if (overlay.blush.some(([r, c]) => r === y && c === x)) return 4;
    return shape[y][x] ?? 0;
  };
  return (
    <svg viewBox="0 0 12 12" className="block size-full" shapeRendering="crispEdges" aria-hidden>
      {shape.map((row, y) =>
        row.map((_, x) => {
          const cell = cellType(y, x);
          if (!cell) return null;
          const eyeClosed = blink && cell === 2;
          const fill =
            cell === 1 ? palette[1] :
            cell === 2 ? (palette[2] || palette[1]) :
            cell === 4 ? "oklch(0.75 0.12 20 / 0.55)" :
            cell === 5 || cell === 6 ? (palette[6] || "#fff") :
            "#0b0b12";
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={eyeClosed ? y + 0.4 : y}
              width={1}
              height={eyeClosed ? 0.25 : 1}
              fill={eyeClosed ? "#0b0b12" : fill}
            />
          );
        })
      )}
    </svg>
  );
}

export function PixelBuddy() {
  const cfg = useContent((s) => s.content.assistant);
  const lang = useContent((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [walking, setWalking] = useState(true);
  const walkDir = useRef(1);
  // Mirror of walkDir for render (reading refs during render is unsafe).
  const [flipDir, setFlipDir] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useSuspendLenis(open);
  const fa = lang === "fa";
  const accent = cfg?.accent || "#8b5cf6";
  const end = cfg?.position !== "start";

  // idle wander along the bottom edge (pet behavior) until first drag
  useEffect(() => {
    if (!walking || pos) return;
    const t = setInterval(() => {
      setPos((p) => {
        const x = p?.x ?? (end ? window.innerWidth - 110 : 30);
        const y = p?.y ?? window.innerHeight - 110;
        const nx = x + walkDir.current * (8 + Math.random() * 14);
        if (nx < 16 || nx > window.innerWidth - 96) {
          walkDir.current *= -1;
          setFlipDir(walkDir.current < 0);
        }
        return { x: Math.min(window.innerWidth - 96, Math.max(16, nx)), y };
      });
    }, 700);
    return () => clearInterval(t);
  }, [walking, pos, end]);

  // moods + blinking
  useEffect(() => {
    const blinkT = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 2600 + Math.random() * 2200);
    const moodT = setInterval(() => {
      setMood((m) => (m === "talking" || m === "thinking" ? m : Math.random() < 0.2 ? "happy" : Math.random() < 0.12 ? "sleeping" : "idle"));
    }, 5200);
    return () => { clearInterval(blinkT); clearInterval(moodT); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollTo({ top: 1e6 }); }, [bubble, busy]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBubble((b) => [...b, { role: "user", text }]);
    setMood("thinking");
    setBusy(true);
    try {
      const json = await buddyChat({
        message: text,
        history: bubble.slice(-6).map((m) => ({ role: m.role, content: m.text })),
        lang,
      });
      if (json.ok) {
        setBubble((b) => [...b, { role: "buddy", text: json.reply || "…" }]);
        setMood("happy");
        setTimeout(() => setMood("idle"), 1600);
      } else {
        const isBusy = (json.error || "").includes("high demand") || (json.error || "").includes("503") || (json.error || "").includes("unavailable");
        setBubble((b) => [...b, {
          role: "buddy",
          text: isBusy
            ? (fa ? "مغزم فعلاً شلوغه! 😵 یک لحظه صبر کن و دوباره بپرس 🙏" : "My brain is busy right now! 😵 Try again in a moment 🙏")
            : (fa ? `مشکل: ${json.error || "نامشخص"} — دوباره امتحان کن` : `Issue: ${json.error || "unknown"} — try again`),
        }]);
        setMood("sleeping");
        setTimeout(() => setMood("idle"), 2400);
      }
    } catch {
      setBubble((b) => [...b, { role: "buddy", text: fa ? "ارتباط قطع شد…" : "Connection lost…" }]);
      setMood("sleeping");
    } finally {
      setBusy(false);
    }
  }, [input, busy, bubble, lang, fa]);

  // Visitor's chosen look (persisted per-browser) — overrides the CMS default
  // when the owner allows visitor choice. Declared before the enabled-guard
  // below so the hook order stays identical whether or not cfg exists.
  const [choice, setChoice] = useState<string | null>(null);
  const [wardrobe, setWardrobe] = useState(false);
  useEffect(() => {
    try { setChoice(localStorage.getItem("p00rija-pet-char")); } catch { /* ignore */ }
  }, []);

  if (cfg?.enabled === false || !cfg) return null;
  const isCustom = cfg.position === "custom";
  const customX = Number(cfg.customX ?? 90);
  const customY = Number(cfg.customY ?? 85);
  const x = pos?.x ?? (isCustom
    ? (typeof window !== "undefined" ? (customX / 100) * (window.innerWidth - 80) : 800)
    : end ? (typeof window !== "undefined" ? window.innerWidth - 110 : 1200) : 30);
  const y = pos?.y ?? (isCustom
    ? (typeof window !== "undefined" ? (customY / 100) * (window.innerHeight - 80) : 500)
    : typeof window !== "undefined" ? window.innerHeight - 110 : 700);
  const flipped = flipDir;

  const canChoose = cfg?.visitorChoice !== false;
  const character = (canChoose && choice) || cfg?.character || "blob";

  return (
    <>
      {/* the pet */}
      <motion.div
        drag
        dragMomentum={false}
        onDragStart={() => { setWalking(false); setMood("happy"); }}
        onDragEnd={(_, info) => { setPos({ x: Math.max(8, Math.min(window.innerWidth - 88, x + info.offset.x)), y: Math.max(8, Math.min(window.innerHeight - 88, y + info.offset.y)) }); setMood("idle"); }}
        onClick={() => { setOpen((v) => !v); setMood("talking"); }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.95 }}
        className="fixed z-[83] size-[72px] cursor-grab active:cursor-grabbing touch-none"
        style={{ left: x, top: y, filter: `drop-shadow(0 0 14px ${accent}66)` }}
        role="button"
        aria-label={fa ? "همدم پیکسلی — گفتگو درباره‌ی من" : "Pixel buddy — chat about me"}
        title={fa ? "بکش هرجا می‌خواهی؛ کلیک = گفتگو" : "Drag me anywhere; click = chat"}
      >
        <motion.div
          animate={{ y: walking ? [0, -5, 0] : [0, -2, 0] }}
          transition={{ duration: walking ? 0.9 : 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="relative size-full rounded-2xl border p-2"
          style={{
            borderColor: `${accent}55`,
            background: `linear-gradient(160deg, color-mix(in oklch, ${accent} 22%, transparent), transparent 70%), oklch(0.14 0.02 280 / 0.9)`,
            transform: flipped ? "scaleX(-1)" : undefined,
            backdropFilter: "blur(6px)",
          }}
        >
          <Face mood={mood} accent={accent} blink={blink} character={character} />
        </motion.div>
        {/* speech teaser */}
        <AnimatePresence>
          {!open && bubble.length === 0 && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -top-9 start-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card/95 px-2.5 py-1 text-[10px] font-medium text-foreground shadow-lg"
            >
              {fa ? "سلام! 👋" : "Hi! 👋"}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="fixed z-[84] flex h-[420px] w-[min(92vw,340px)] flex-col overflow-hidden rounded-3xl border border-border bg-card/95 shadow-2xl backdrop-blur-2xl"
            style={{ [end ? "right" : "left"]: 16, bottom: 104, insetInlineEnd: end ? 16 : undefined, insetInlineStart: end ? undefined : 16 } as React.CSSProperties}
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl border p-1" style={{ borderColor: `${accent}55`, background: `color-mix(in oklch, ${accent} 15%, transparent)` }}>
                <Face mood={busy ? "thinking" : "talking"} accent={accent} blink={false} character={character} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{fa ? "همدم پیکسلی" : "Pixel Buddy"}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {busy ? (fa ? "در حال فکر کردن…" : "thinking…") : fa ? "همه‌چیز درباره‌ی سازنده را می‌داند" : "knows everything about the owner"}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="ms-auto grid size-7 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground" aria-label={fa ? "بستن" : "Close"}>✕</button>
              {canChoose && (
                <button onClick={() => setWardrobe((v) => !v)} className="grid size-7 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground" title={fa ? "تغییر ظاهر پت" : "Change pet look"} aria-label={fa ? "تغییر ظاهر پت" : "Change pet look"}>✿</button>
              )}
            </div>
            {wardrobe && (
              <div className="border-b border-border bg-surface-1/60 p-3" data-lenis-prevent>
                <p className="mb-2 text-[10px] font-semibold text-muted-foreground">{fa ? "ظاهر همدمت را انتخاب کن:" : "Pick your buddy's look:"}</p>
                <div className="grid grid-cols-5 gap-2">
                  {Object.keys(CHARACTERS).map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        setChoice(id);
                        setWardrobe(false);
                        setMood("happy");
                        setTimeout(() => setMood("idle"), 1400);
                        try { localStorage.setItem("p00rija-pet-char", id); } catch { /* ignore */ }
                      }}
                      title={id}
                      className={`grid aspect-square place-items-center rounded-xl border p-1.5 transition ${character === id ? "border-[var(--ai-1)] shadow-[0_0_12px_-2px_var(--ai-1)]" : "border-border hover:border-muted-foreground/50"}`}
                    >
                      <Face mood={character === id ? "happy" : "idle"} accent={accent} blink={false} character={id} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" data-lenis-prevent>
              <div className="max-w-[85%] rounded-2xl rounded-ss-md border border-border bg-surface-1 px-3 py-2 text-xs leading-5 text-foreground">
                {cfg.greeting}
              </div>
              {bubble.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-5 ${m.role === "user" ? "ms-auto rounded-se-md text-white" : "rounded-ss-md border border-border bg-surface-1 text-foreground"}`}
                  style={m.role === "user" ? { background: accent } : undefined}
                >
                  {m.text}
                </div>
              ))}
              {busy && (
                <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-ss-md border border-border bg-surface-1 px-3 py-2.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="size-1.5 rounded-full" style={{ background: accent }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border p-2.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
                placeholder={fa ? "چیزی درباره‌ی سازنده بپرس…" : "Ask about the owner…"}
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface-1 px-3 py-2 text-[16px] sm:text-xs outline-none focus:border-foreground/40"
              />
              <button
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                className="grid size-9 shrink-0 place-items-center rounded-xl text-white disabled:opacity-50"
                style={{ background: accent }}
                aria-label={fa ? "ارسال" : "Send"}
              >
                ➤
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
