"use client";

/* Typing Sprint — 20 seconds, type as many security words as you can. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const POOL_FA = ["امنیت", "شبکه", "سرور", "فایروال", "رمز", "دیتا", "کد", "طراحی", "رنگ", "هوش", "ربات", "ابر", "لینوکس", "پورت", "کلید"];
const POOL_EN = ["firewall", "cipher", "kernel", "socket", "pixel", "orbit", "shield", "packet", "cloud", "router", "neural", "server", "system", "daemon"];

const DURATION = 20_000;

export function TypingGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("typing");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [current, setCurrent] = useState("");
  const [typed, setTyped] = useState("");
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const inputRef = useRef<HTMLInputElement>(null);

  const nextWord = useCallback(() => {
    const pool = lang === "fa" ? POOL_FA : POOL_EN;
    let w = pool[Math.floor(Math.random() * pool.length)];
    while (w === current) w = pool[Math.floor(Math.random() * pool.length)];
    setCurrent(w);
    setTyped("");
  }, [lang, current]);

  const start = useCallback(() => {
    setCount(0);
    setOver(false);
    setRunning(true);
    setTimeLeft(DURATION);
    const pool = lang === "fa" ? POOL_FA : POOL_EN;
    setCurrent(pool[Math.floor(Math.random() * pool.length)]);
    setTyped("");
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [lang]);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = DURATION - (Date.now() - startedAt);
      setTimeLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        setRunning(false);
        setOver(true);
        setCount((c) => {
          submitBest(c);
          if (c >= 12) fireAchievement("typing-sprint");
          return c;
        });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [running, submitBest]);

  const onChange = (value: string) => {
    if (!running) return;
    setTyped(value);
    if (value === current) {
      setCount((c) => c + 1);
      nextWord();
    }
  };

  const matchedLen = current.startsWith(typed) ? typed.length : 0;

  return (
    <GameFrame
      accent="var(--ai-1)"
      icon={<Keyboard className="h-4 w-4" />}
      title={lang === "fa" ? "تایپ برق‌آسا" : "Typing Sprint"}
      subtitle={lang === "fa" ? "۲۰ ثانیه — کلمه‌ها را درست و سریع تایپ کن" : "20 seconds — type the words fast and clean"}
      best={best}
      bestLabel={lang === "fa" ? "بهترین" : "Best"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "کلمه" : "Words"} value={count} accent="var(--ai-1)" />
            <StatPill label={lang === "fa" ? "زمان" : "Time"} value={`${Math.ceil(timeLeft / 1000)}s`} />
          </div>
          {(!running || over) && (
            <PlayButton accent="var(--ai-1)" onClick={start}>
              {over ? (lang === "fa" ? "شروع دوباره" : "Restart") : lang === "fa" ? "شروع" : "Start"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="select-none rounded-xl border border-border bg-surface-1 px-4 py-6 text-center text-2xl font-black" dir="auto">
        <span style={{ color: "var(--ai-1)" }}>{current.slice(0, matchedLen)}</span>
        <span className="text-foreground">{current.slice(matchedLen)}</span>
      </div>
      <input
        ref={inputRef}
        value={typed}
        onChange={(e) => onChange(e.target.value)}
        disabled={!running}
        dir="auto"
        autoComplete="off"
        spellCheck={false}
        aria-label={lang === "fa" ? "ورودی تایپ" : "typing input"}
        className="mt-3 w-full rounded-xl border border-border bg-transparent px-4 py-3 text-center text-lg outline-none transition focus:border-[var(--ai-1)]"
        placeholder={running ? (lang === "fa" ? "اینجا تایپ کن…" : "type here…") : ""}
      />
      {over && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: "var(--ai-1)" }}>
          {lang === "fa" ? `> ${count} کلمه در ۲۰ ثانیه!` : `> ${count} words in 20s!`}
        </p>
      )}
    </GameFrame>
  );
}
