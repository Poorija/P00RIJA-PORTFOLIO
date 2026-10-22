"use client";

/* Neon Tic-Tac-Toe — you vs. a minimax AI that is hard to beat. */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

type Cell = "X" | "O" | null;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(b: Cell[]): { who: Cell; line: number[] } | null {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line };
  }
  return null;
}

function minimax(board: Cell[], player: "X" | "O"): { score: number; move: number } {
  const win = winnerOf(board);
  if (win?.who === "O") return { score: 10, move: -1 };
  if (win?.who === "X") return { score: -10, move: -1 };
  const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (empty.length === 0) return { score: 0, move: -1 };

  let bestScore = player === "O" ? -Infinity : Infinity;
  let bestMove = empty[0];
  for (const i of empty) {
    const next = [...board];
    next[i] = player;
    const { score } = minimax(next, player === "O" ? "X" : "O");
    const adjusted = score > 0 ? score - 0.1 : score < 0 ? score + 0.1 : 0; // prefer fast wins
    if (player === "O" ? adjusted > bestScore : adjusted < bestScore) {
      bestScore = adjusted;
      bestMove = i;
    }
  }
  return { score: bestScore, move: bestMove };
}

export function TicTacToeGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("ttt-wins");
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [record, setRecord] = useState({ w: 0, d: 0, l: 0 });

  const result = winnerOf(board);
  const full = board.every(Boolean);
  const over = !!result || full;

  useEffect(() => {
    if (!over) return;
    if (result?.who === "X") {
      setRecord((r) => ({ ...r, w: r.w + 1 }));
      submitBest(record.w + 1);
      fireAchievement("ttt-champion");
    } else if (!result) setRecord((r) => ({ ...r, d: r.d + 1 }));
    else setRecord((r) => ({ ...r, l: r.l + 1 }));
     
  }, [over]);

  // AI move
  useEffect(() => {
    if (turn !== "O" || over) return;
    const timer = setTimeout(() => {
      const { move } = minimax(board, "O");
      if (move >= 0) {
        setBoard((b) => {
          const n = [...b];
          n[move] = "O";
          return n;
        });
        setTurn("X");
      }
    }, 420);
    return () => clearTimeout(timer);
  }, [turn, board, over]);

  const play = (i: number) => {
    if (over || turn !== "X" || board[i]) return;
    const n = [...board];
    n[i] = "X";
    setBoard(n);
    setTurn("O");
  };

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setTurn("X");
  }, []);

  const status = () => {
    if (result?.who === "X") return lang === "fa" ? "🏆 بردی!" : "🏆 You win!";
    if (result?.who === "O") return lang === "fa" ? "🤖 هوش مصنوعی برد" : "🤖 AI wins";
    if (full) return lang === "fa" ? "🤝 مساوی" : "🤝 Draw";
    return turn === "X"
      ? lang === "fa" ? "نوبت شما (✕)" : "Your turn (✕)"
      : lang === "fa" ? "هوش مصنوعی فکر می‌کند…" : "AI is thinking…";
  };

  return (
    <GameFrame
      accent="var(--gfx-1)"
      icon={<Grid3x3 className="h-4 w-4" />}
      title={lang === "fa" ? "دوز نئونی" : "Neon Tic-Tac-Toe"}
      subtitle={lang === "fa" ? "با minimax مقابله کن — اگر می‌توانی!" : "Battle a minimax AI — if you dare!"}
      best={best}
      bestLabel={lang === "fa" ? "بردها" : "Wins"}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "برد" : "W"} value={record.w} accent="var(--gfx-1)" />
            <StatPill label={lang === "fa" ? "مساوی" : "D"} value={record.d} />
            <StatPill label={lang === "fa" ? "باخت" : "L"} value={record.l} accent="var(--destructive)" />
          </div>
          {over && (
            <PlayButton accent="var(--gfx-1)" onClick={reset}>
              {lang === "fa" ? "دور جدید" : "New round"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-2">
        {board.map((cell, i) => {
          const highlight = result?.line.includes(i);
          return (
            <motion.button
              key={i}
              whileHover={!cell && !over ? { scale: 1.05 } : undefined}
              whileTap={!cell && !over ? { scale: 0.95 } : undefined}
              onClick={() => play(i)}
              data-cursor-hover
              disabled={!!cell || over || turn === "O"}
              className="grid aspect-square place-items-center rounded-xl border font-mono text-3xl font-black transition-colors"
              style={{
                borderColor: highlight
                  ? "var(--gfx-1)"
                  : "color-mix(in oklch, var(--gfx-1) 22%, transparent)",
                background: highlight
                  ? "color-mix(in oklch, var(--gfx-1) 14%, transparent)"
                  : "var(--surface-1)",
                color: cell === "X" ? "var(--gfx-1)" : "var(--ai-1)",
                boxShadow: highlight ? "0 0 20px -6px var(--gfx-1)" : "none",
              }}
            >
              {cell}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-3 text-center font-mono text-xs text-muted-foreground">{status()}</p>
    </GameFrame>
  );
}
