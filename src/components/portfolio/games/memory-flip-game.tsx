"use client";

/* Quantum Pairs — memory flip game with glowing icon cards. */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shapes } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const ICONS = ["🚀", "🛡️", "🧠", "🎨", "🪐", "⚡", "🔒", "🌐"];

type Card = { id: number; icon: string; flipped: boolean; done: boolean };

function deal(): Card[] {
  const deck = [...ICONS, ...ICONS]
    .map((icon, i) => ({ icon, sort: Math.random(), id: i }))
    .sort((a, b) => a.sort - b.sort)
    .map((c, i) => ({ id: i, icon: c.icon, flipped: false, done: false }));
  return deck;
}

export function MemoryFlipGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("memory-flip", "low");
  const [cards, setCards] = useState<Card[]>(deal);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);

  const matched = cards.filter((c) => c.done).length;
  const won = matched === cards.length;

  useEffect(() => {
    if (won && moves > 0) {
      submitBest(moves);
      fireAchievement("quantum-memory");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const reset = useCallback(() => {
    setCards(deal());
    setSelected([]);
    setMoves(0);
    setBusy(false);
  }, []);

  const flip = (idx: number) => {
    if (busy) return;
    const card = cards[idx];
    if (card.flipped || card.done) return;
    const next = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(next);
    const sel = [...selected, idx];
    setSelected(sel);
    if (sel.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = sel;
      if (next[a].icon === next[b].icon) {
        setCards(next.map((c, i) => (i === a || i === b ? { ...c, done: true } : c)));
        setSelected([]);
      } else {
        setBusy(true);
        setTimeout(() => {
          setCards((cur) => cur.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
          setSelected([]);
          setBusy(false);
        }, 750);
      }
    }
  };

  return (
    <GameFrame
      accent="var(--ai-1)"
      icon={<Shapes className="h-4 w-4" />}
      title={lang === "fa" ? "جفت‌یابی کوانتومی" : "Quantum Pairs"}
      subtitle={lang === "fa" ? "جفت‌های همسان را با کمترین حرکت پیدا کن" : "Find all pairs in the fewest moves"}
      best={best}
      bestLabel={lang === "fa" ? "کمترین حرکت" : "Fewest moves"}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "حرکت" : "Moves"} value={moves} accent="var(--ai-1)" />
            <StatPill label={lang === "fa" ? "جفت" : "Pairs"} value={`${matched / 2}/${ICONS.length}`} accent="var(--ai-1)" />
          </div>
          {won && (
            <PlayButton accent="var(--ai-1)" onClick={reset}>
              {lang === "fa" ? "دور جدید" : "New round"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="mx-auto grid max-w-[340px] grid-cols-4 gap-2">
        {cards.map((card, i) => {
          const face = card.flipped || card.done;
          return (
            <motion.button
              key={card.id}
              onClick={() => flip(i)}
              data-cursor-hover
              animate={{ rotateY: face ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="relative aspect-square rounded-xl"
              style={{ perspective: 600 }}
              aria-label={face ? card.icon : lang === "fa" ? "کارت بسته" : "hidden card"}
            >
              {/* back */}
              <span
                className="absolute inset-0 grid place-items-center rounded-xl border transition-opacity duration-150"
                style={{
                  backfaceVisibility: "hidden",
                  borderColor: "color-mix(in oklch, var(--ai-1) 30%, transparent)",
                  background:
                    "linear-gradient(135deg, color-mix(in oklch, var(--ai-1) 14%, transparent), color-mix(in oklch, var(--ai-2) 10%, transparent))",
                  opacity: face ? 0 : 1,
                }}
              >
                <span className="font-mono text-[10px] tracking-widest text-[var(--ai-1)]">?</span>
              </span>
              {/* front */}
              <span
                className="absolute inset-0 grid place-items-center rounded-xl border text-2xl"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  borderColor:
                    card.done ? "color-mix(in oklch, var(--ai-1) 60%, transparent)" : "var(--border)",
                  background: card.done
                    ? "color-mix(in oklch, var(--ai-1) 16%, transparent)"
                    : "var(--surface-1)",
                  boxShadow: card.done ? "0 0 18px -6px var(--ai-1)" : "none",
                }}
              >
                {card.icon}
              </span>
            </motion.button>
          );
        })}
      </div>
      {won && (
        <p className="mt-3 text-center font-mono text-xs" style={{ color: "var(--ai-1)" }}>
          {lang === "fa" ? "> همه جفت‌ها پیدا شد! 🎉" : "> all pairs found! 🎉"}
        </p>
      )}
    </GameFrame>
  );
}
