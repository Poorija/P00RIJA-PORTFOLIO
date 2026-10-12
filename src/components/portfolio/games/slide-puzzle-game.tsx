"use client";

/* Slide Puzzle — classic 3×3 numeric slider. */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Puzzle } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const N = 3;

function solvedBoard(): number[] {
  return Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N));
}

function shuffle(board: number[]): number[] {
  const next = [...board];
  let blank = next.indexOf(0);
  for (let i = 0; i < 120; i++) {
    const r = Math.floor(blank / N);
    const c = blank % N;
    const moves: number[] = [];
    if (r > 0) moves.push(blank - N);
    if (r < N - 1) moves.push(blank + N);
    if (c > 0) moves.push(blank - 1);
    if (c < N - 1) moves.push(blank + 1);
    const pick = moves[Math.floor(Math.random() * moves.length)];
    [next[blank], next[pick]] = [next[pick], next[blank]];
    blank = pick;
  }
  return next;
}

export function SlidePuzzleGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("slide", "low");
  const [board, setBoard] = useState<number[]>(() => shuffle(solvedBoard()));
  const [moves, setMoves] = useState(0);
  const solved = board.every((v, i) => v === (i + 1) % (N * N));

  const reset = useCallback(() => {
    setBoard(shuffle(solvedBoard()));
    setMoves(0);
  }, []);

  useEffect(() => {
    if (solved && moves > 0) {
      submitBest(moves);
      fireAchievement("slide-solver");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const slide = (i: number) => {
    if (solved) return;
    const blank = board.indexOf(0);
    const br = Math.floor(blank / N);
    const bc = blank % N;
    const r = Math.floor(i / N);
    const c = i % N;
    if (Math.abs(br - r) + Math.abs(bc - c) !== 1) return;
    const next = [...board];
    [next[blank], next[i]] = [next[i], next[blank]];
    setBoard(next);
    setMoves((m) => m + 1);
  };

  return (
    <GameFrame
      accent="var(--chart-2, #a3e635)"
      icon={<Puzzle className="h-4 w-4" />}
      title={lang === "fa" ? "پازل کشویی" : "Slide Puzzle"}
      subtitle={lang === "fa" ? "کاشی‌ها را بلغزان تا ۱ تا ۸ مرتب شوند" : "Slide tiles until 1–8 are in order"}
      best={best}
      bestLabel={lang === "fa" ? "کمترین حرکت" : "Fewest moves"}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "حرکت" : "Moves"} value={moves} accent="var(--chart-2, #a3e635)" />
          </div>
          {solved && moves > 0 && (
            <PlayButton accent="var(--chart-2, #a3e635)" onClick={reset}>
              {lang === "fa" ? "پازل جدید" : "New puzzle"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="mx-auto grid max-w-[240px] grid-cols-3 gap-1.5">
        {board.map((v, i) => (
          <motion.button
            key={i}
            layout
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onClick={() => slide(i)}
            data-cursor-hover
            disabled={v === 0}
            className="grid aspect-square place-items-center rounded-lg border font-mono text-lg font-black"
            style={{
              borderColor: v === 0 ? "transparent" : "color-mix(in oklch, var(--chart-2, #a3e635) 35%, transparent)",
              background:
                v === 0
                  ? "transparent"
                  : "linear-gradient(135deg, color-mix(in oklch, var(--chart-2, #a3e635) 16%, transparent), transparent)",
              color: "var(--foreground)",
            }}
          >
            {v || ""}
          </motion.button>
        ))}
      </div>
      {solved && moves > 0 && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: "var(--chart-2, #a3e635)" }}>
          {lang === "fa" ? `> حل شد در ${moves} حرکت! 🏆` : `> solved in ${moves} moves! 🏆`}
        </p>
      )}
    </GameFrame>
  );
}
