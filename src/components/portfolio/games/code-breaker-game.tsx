"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trophy, Terminal, Delete } from "lucide-react";
import { useContent } from "@/lib/content-store";

const CODE_LEN = 4;
const MAX_DIGIT = 6;
const MAX_GUESSES = 8;
const BEST_KEY = "cb-best-tries";

type Feedback = ("hit" | "near" | "miss")[];
type HistoryItem = { guess: number[]; fb: Feedback };

function genCode(): number[] {
  const arr: number[] = [];
  for (let i = 0; i < CODE_LEN; i++) arr.push(Math.floor(Math.random() * MAX_DIGIT) + 1);
  return arr;
}

function evalGuess(guess: number[], secret: number[]): Feedback {
  const fb: Feedback = Array(CODE_LEN).fill("miss") as Feedback;
  const used = Array(CODE_LEN).fill(false);
  // hits first
  for (let i = 0; i < CODE_LEN; i++) {
    if (guess[i] === secret[i]) {
      fb[i] = "hit";
      used[i] = true;
    }
  }
  // then near (right digit, wrong place)
  for (let i = 0; i < CODE_LEN; i++) {
    if (fb[i] === "hit") continue;
    for (let j = 0; j < CODE_LEN; j++) {
      if (!used[j] && guess[i] === secret[j]) {
        fb[i] = "near";
        used[j] = true;
        break;
      }
    }
  }
  return fb;
}

const HIT_COLOR = "oklch(0.72 0.19 145)";
const NEAR_COLOR = "oklch(0.78 0.17 75)";
const MISS_COLOR = "oklch(0.5 0.01 280 / 0.45)";

export function CodeBreakerGame() {
  const s = useContent((st) => st.content.security);
  const t = useContent((st) => st.t);
  const lang = useContent((st) => st.lang);

  // Deterministic placeholder secret — regenerated on mount to avoid SSR mismatch.
  const [secret, setSecret] = useState<number[]>([1, 2, 3, 4]);
  const [current, setCurrent] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setSecret(genCode()));
    try {
      const v = localStorage.getItem(BEST_KEY);
      if (v) requestAnimationFrame(() => setBest(Number(v)));
    } catch {
      // ignore
    }
  }, []);

  const newGame = useCallback(() => {
    setSecret(genCode());
    setCurrent([]);
    setHistory([]);
    setStatus("playing");
  }, []);

  const pushDigit = useCallback(
    (d: number) => {
      if (status !== "playing") return;
      setCurrent((c) => (c.length >= CODE_LEN ? c : [...c, d]));
    },
    [status]
  );

  const popDigit = useCallback(() => {
    if (status !== "playing") return;
    setCurrent((c) => c.slice(0, -1));
  }, [status]);

  const submit = useCallback(() => {
    if (status !== "playing" || current.length !== CODE_LEN) return;
    const fb = evalGuess(current, secret);
    const item: HistoryItem = { guess: current, fb };
    const newHistory = [...history, item];
    setHistory(newHistory);
    setCurrent([]);

    if (fb.every((f) => f === "hit")) {
      setStatus("won");
      try { window.dispatchEvent(new CustomEvent("achieve", { detail: "code-master" })); } catch {}
      const tries = newHistory.length;
      setBest((prevBest) => {
        if (prevBest === null || tries < prevBest) {
          try {
            localStorage.setItem(BEST_KEY, String(tries));
          } catch {
            // ignore
          }
          return tries;
        }
        return prevBest;
      });
    } else if (newHistory.length >= MAX_GUESSES) {
      setStatus("lost");
    }
  }, [status, current, secret, history]);

  // Keyboard: 1-6 push, Backspace pop, Enter submit (skipped when typing in inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key >= "1" && e.key <= "6") {
        pushDigit(Number(e.key));
      } else if (e.key === "Backspace") {
        popDigit();
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pushDigit, popDigit, submit]);

  const attemptsLeft = MAX_GUESSES - history.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sec-1)" }} />
          <div className="min-w-0">
            <h3 className="text-base font-bold" style={{ color: "var(--sec-1)" }}>
              {s.game.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{s.game.subtitle}</p>
          </div>
        </div>
        <button
          onClick={newGame}
          data-cursor-hover
          className="btn-outline-sec inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
          aria-label={t("newGame")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("newGame")}</span>
        </button>
      </div>

      {/* Terminal-style history */}
      <div
        className="relative overflow-hidden rounded-xl border border-border p-3 font-mono text-xs backdrop-blur"
        style={{ background: "oklch(0.1 0.02 165 / 0.92)" }}
      >
        {/* scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.35) 3px, transparent 4px)",
          }}
        />
        <div
          className="relative flex items-center justify-between text-[10px] uppercase tracking-widest"
          style={{ color: "var(--sec-1)" }}
        >
          <span>{lang === "fa" ? "رمزگشا" : "code_breaker.sh"}</span>
          <span>
            {lang === "fa" ? "تلاش" : "attempts"}: {attemptsLeft}/{MAX_GUESSES}
          </span>
        </div>
        <div
          className="relative mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1 no-scrollbar"
          dir="ltr"
        >
          {history.length === 0 && (
            <div className="text-muted-foreground/60">{lang === "fa" ? "// نخستین حدس را پایین وارد کنید" : "// enter your first guess below"}</div>
          )}
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground/60">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex gap-1">
                {h.guess.map((d, j) => (
                  <span
                    key={j}
                    className="grid h-6 w-6 place-items-center rounded border font-mono"
                    style={{
                      borderColor: "color-mix(in oklch, var(--sec-1) 40%, transparent)",
                      color: "var(--sec-1)",
                      background: "color-mix(in oklch, var(--sec-1) 8%, transparent)",
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="flex gap-1" aria-label={lang === "fa" ? "بازخورد" : "Feedback"}>
                {h.fb.map((f, j) => (
                  <span
                    key={j}
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background:
                        f === "hit" ? HIT_COLOR : f === "near" ? NEAR_COLOR : MISS_COLOR,
                    }}
                  >
                    <span className="sr-only">
                      {lang === "fa"
                        ? f === "hit" ? "عدد و جایگاه درست" : f === "near" ? "عدد درست و جایگاه نادرست" : "در رمز نیست"
                        : f === "hit" ? "correct position" : f === "near" ? "wrong position" : "not in code"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current guess row */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {lang === "fa" ? "حدس:" : "$ guess:"}
        </span>
        <div className="flex gap-1.5">
          {Array.from({ length: CODE_LEN }, (_, i) => (
            <div
              key={i}
              className="grid h-9 w-9 place-items-center rounded-md border font-mono text-sm"
              style={{
                borderColor:
                  current[i] !== undefined ? "var(--sec-1)" : "var(--border)",
                color:
                  current[i] !== undefined ? "var(--sec-1)" : "var(--muted-foreground)",
                background:
                  current[i] !== undefined
                    ? "color-mix(in oklch, var(--sec-1) 10%, transparent)"
                    : "var(--surface-1)",
              }}
            >
              {current[i] ?? "_"}
            </div>
          ))}
        </div>
      </div>

      {/* Keypad */}
      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: MAX_DIGIT }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            onClick={() => pushDigit(d)}
            disabled={status !== "playing"}
            data-cursor-hover
            className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-1 font-mono text-sm text-foreground transition hover:border-[var(--sec-1)] hover:text-[var(--sec-1)] disabled:opacity-40"
            aria-label={lang === "fa" ? `رقم ${d}` : `Digit ${d}`}
          >
            {d}
          </button>
        ))}
        <button
          onClick={popDigit}
          disabled={status !== "playing" || current.length === 0}
          data-cursor-hover
          className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-1 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          aria-label={lang === "fa" ? "حذف آخرین رقم" : "Delete last digit"}
        >
          <Delete className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={submit}
          disabled={status !== "playing" || current.length !== CODE_LEN}
          data-cursor-hover
          className="btn-solid-sec inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-semibold transition disabled:opacity-40"
        >
          {t("play")}
        </button>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="font-mono">
          {status === "playing" && (
            <span className="text-muted-foreground">
              {lang === "fa" ? "راهنما: " : "hint: "}
              <span style={{ color: HIT_COLOR }}>●</span> {lang === "fa" ? "درست" : "hit"} ·{" "}
              <span style={{ color: NEAR_COLOR }}>●</span> {lang === "fa" ? "جابه‌جا" : "near"} ·{" "}
              <span style={{ color: MISS_COLOR }}>●</span> {lang === "fa" ? "ناموجود" : "miss"}
            </span>
          )}
          {status === "won" && (
            <span style={{ color: "var(--sec-1)" }}>
              {lang === "fa"
                ? `> دسترسی تأیید شد · رمز در ${history.length} تلاش شکسته شد`
                : `> ACCESS GRANTED · cracked in ${history.length} ${history.length === 1 ? "try" : "tries"}`}
            </span>
          )}
          {status === "lost" && (
            <span className="text-destructive">
              {lang === "fa" ? "> دسترسی رد شد · رمز این بود: " : "> ACCESS DENIED · code was: "}
              <span className="font-bold">{secret.join("")}</span>
            </span>
          )}
        </div>
        {best !== null && (
          <div className="flex items-center gap-1.5 font-mono">
            <Trophy className="h-3 w-3" style={{ color: "var(--sec-1)" }} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("best")}:
            </span>
            <span className="text-foreground">
              {best}
              <span className="ml-0.5 text-muted-foreground">/ {MAX_GUESSES}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
