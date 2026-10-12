"use client";

/* Crypto Word — hangman-style word guess with security/tech vocabulary. */

import { useCallback, useState } from "react";
import { CaseSensitive } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const WORDS = {
  en: ["FIREWALL", "CIPHER", "KERNEL", "PACKET", "SERVER", "ZERO DAY", "PHISHING", "SANDBOX", "BACKUP", "LATENCY", "ROUTER", "MACHINE LEARNING"],
  fa: ["دیوار آتش", "رمزنگاری", "هسته سیستم", "بسته داده", "سرور", "آسیب روز صفر", "فیشینگ", "جعبه شنی", "پشتیبان‌گیری", "تأخیر شبکه", "مسیریاب", "یادگیری ماشین"],
};

const FA_LETTERS = "آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی".split("");
const EN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_WRONG = 6;

export function WordGuessGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("word", "low");
  const [word, setWord] = useState(() => WORDS[lang][Math.floor(Math.random() * WORDS[lang].length)]);
  const [wrong, setWrong] = useState(0);
  const [guessed, setGuessed] = useState<string[]>([]);
  const [won, setWon] = useState(false);

  const letters = lang === "fa" ? FA_LETTERS : EN_LETTERS;
  // For fa, matching is character-wise; spaces always visible.
  const normalizedWord = lang === "fa" ? word.replace(/\u200c/g, "") : word;
  const revealed = normalizedWord
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      if (lang === "fa" && word[i] === "\u200c") return "\u200c";
      return guessed.includes(ch) ? ch : "_";
    })
    .join("");

  const lost = wrong >= MAX_WRONG;
  const solved = !revealed.includes("_");

  const guess = useCallback(
    (ch: string) => {
      if (lost || solved || guessed.includes(ch)) return;
      setGuessed((g) => [...g, ch]);
      if (!normalizedWord.includes(ch)) setWrong((w) => w + 1);
    },
    [guessed, normalizedWord, lost, solved]
  );

  const reset = useCallback(() => {
    setWord(WORDS[lang][Math.floor(Math.random() * WORDS[lang].length)]);
    setWrong(0);
    setGuessed([]);
    setWon(false);
  }, [lang]);

  if (solved && !won) {
    setWon(true);
    submitBest(wrong);
    fireAchievement("word-cryptographer");
  }

  return (
    <GameFrame
      accent="var(--sec-1)"
      icon={<CaseSensitive className="h-4 w-4" />}
      title={lang === "fa" ? "حدس کلمه رمزی" : "Crypto Word"}
      subtitle={lang === "fa" ? `${MAX_WRONG} فرصت داری — کلمه‌ی حوزه امنیت/فناوری را حدس بزن` : `${MAX_WRONG} wrong guesses allowed — security/tech vocabulary`}
      best={best}
      bestLabel={lang === "fa" ? "کمترین خطا" : "Fewest misses"}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "فرصت" : "Lives"} value={"♥".repeat(MAX_WRONG - wrong) || "—"} accent="var(--destructive)" />
          </div>
          {(solved || lost) && (
            <PlayButton accent="var(--sec-1)" onClick={reset}>
              {lang === "fa" ? "کلمه جدید" : "New word"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div
        dir={lang === "fa" ? "rtl" : "ltr"}
        className="rounded-xl border border-border bg-surface-1 px-4 py-5 text-center font-mono text-xl font-black tracking-[0.35em]"
        style={{ color: solved ? "var(--sec-1)" : "var(--foreground)" }}
      >
        {lost ? normalizedWord : revealed}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1" dir="ltr">
        {letters.map((ch) => {
          const used = guessed.includes(ch);
          const hit = used && normalizedWord.includes(ch);
          return (
            <button
              key={ch}
              onClick={() => guess(ch)}
              disabled={used || solved || lost}
              data-cursor-hover
              className="h-8 min-w-8 rounded-md border px-1.5 font-mono text-xs transition disabled:opacity-40"
              style={{
                borderColor: used ? (hit ? "var(--sec-1)" : "var(--destructive)") : "var(--border)",
                color: used ? (hit ? "var(--sec-1)" : "var(--destructive)") : "var(--foreground)",
                background: "var(--surface-1)",
              }}
            >
              {ch}
            </button>
          );
        })}
      </div>
      {(solved || lost) && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: solved ? "var(--sec-1)" : "var(--destructive)" }}>
          {solved
            ? (lang === "fa" ? "> رمزگشایی کامل! 🏆" : "> decrypted! 🏆")
            : (lang === "fa" ? "> فرصت‌ها تمام شد" : "> out of guesses")}
        </p>
      )}
    </GameFrame>
  );
}
