"use client";

/* Lights Out — 5×5 toggle puzzle: flipping a cell flips its neighbors. */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const N = 5;

function randomBoard(moves: number): boolean[] {
  // generate by applying random presses to a solved board — always solvable
  const board = Array(N * N).fill(false);
  const flip = (i: number) => {
    const r = Math.floor(i / N);
    const c = i % N;
    board[i] = !board[i];
    if (r > 0) board[i - N] = !board[i - N];
    if (r < N - 1) board[i + N] = !board[i + N];
    if (c > 0) board[i - 1] = !board[i - 1];
    if (c < N - 1) board[i + 1] = !board[i + 1];
  };
  for (let k = 0; k < moves; k++) flip(Math.floor(Math.random() * N * N));
  if (board.every((v) => !v)) return randomBoard(moves);
  return board;
}

export function LightsOutGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("lights", "low");
  const [board, setBoard] = useState<boolean[]>(() => randomBoard(6));
  const [moves, setMoves] = useState(0);
  const solved = board.every((v) => !v);

  const reset = useCallback(() => {
    setBoard(randomBoard(6));
    setMoves(0);
  }, []);

  useEffect(() => {
    if (solved && moves > 0) {
      submitBest(moves);
      fireAchievement("lights-out");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const press = (i: number) => {
    if (solved) return;
    const next = [...board];
    const r = Math.floor(i / N);
    const c = i % N;
    const flip = (j: number) => (next[j] = !next[j]);
    flip(i);
    if (r > 0) flip(i - N);
    if (r < N - 1) flip(i + N);
    if (c > 0) flip(i - 1);
    if (c < N - 1) flip(i + 1);
    setBoard(next);
    setMoves((m) => m + 1);
  };

  return (
    <GameFrame
      accent="var(--chart-2, #facc15)"
      icon={<Lightbulb className="h-4 w-4" />}
      title={lang === "fa" ? "چراغ‌خاموش" : "Lights Out"}
      subtitle={lang === "fa" ? "همه‌ی چراغ‌ها را خاموش کن — هر لمس همسایه‌ها را هم می‌زند" : "Turn every light off — each press flips neighbors too"}
      best={best}
      bestLabel={lang === "fa" ? "کمترین لمس" : "Fewest presses"}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "لمس" : "Presses"} value={moves} accent="var(--chart-2, #facc15)" />
            <StatPill label={lang === "fa" ? "روشن" : "On"} value={board.filter(Boolean).length} />
          </div>
          {solved && moves > 0 && (
            <PlayButton accent="var(--chart-2, #facc15)" onClick={reset}>
              {lang === "fa" ? "چیدمان جدید" : "New layout"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="mx-auto grid max-w-[280px] grid-cols-5 gap-1.5">
        {board.map((on, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.88 }}
            onClick={() => press(i)}
            data-cursor-hover
            className="aspect-square rounded-lg border transition-colors duration-150"
            style={{
              borderColor: on ? "transparent" : "color-mix(in oklch, var(--chart-2, #facc15) 30%, transparent)",
              background: on
                ? "radial-gradient(circle at 40% 35%, oklch(0.9 0.16 95), oklch(0.75 0.16 80))"
                : "var(--surface-1)",
              boxShadow: on ? "0 0 16px -3px oklch(0.8 0.16 85)" : "none",
            }}
            aria-label={on ? (lang === "fa" ? "چراغ روشن" : "light on") : (lang === "fa" ? "چراغ خاموش" : "light off")}
          />
        ))}
      </div>
      {solved && moves > 0 && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: "var(--chart-2, #facc15)" }}>
          {lang === "fa" ? `> تاریکی کامل در ${moves} لمس! 🏆` : `> total darkness in ${moves} presses! 🏆`}
        </p>
      )}
    </GameFrame>
  );
}
