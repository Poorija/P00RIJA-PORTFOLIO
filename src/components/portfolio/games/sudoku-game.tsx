"use client";

/* Mini Sudoku — 4×4 latin-square puzzles with three difficulty seeds. */

import { useCallback, useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const N = 4;

/** Base valid board. */
const BASE = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];

type Puzzle = { given: boolean[][]; solution: number[][] };

function makePuzzle(holes: number): Puzzle {
  // random row-band swaps keep the latin square valid
  const grid = BASE.map((r) => [...r]);
  for (let band = 0; band < 2; band++) {
    if (Math.random() > 0.5) {
      const a = band * 2;
      [grid[a], grid[a + 1]] = [grid[a + 1], grid[a]];
    }
  }
  for (let band = 0; band < 2; band++) {
    if (Math.random() > 0.5) {
      // swap symbol pairs
      const s1 = band * 2 + 1;
      const s2 = band * 2 + 2;
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (grid[r][c] === s1) grid[r][c] = s2;
          else if (grid[r][c] === s2) grid[r][c] = s1;
        }
    }
  }
  const given: boolean[][] = grid.map((row) => row.map(() => true));
  let removed = 0;
  while (removed < holes) {
    const r = Math.floor(Math.random() * N);
    const c = Math.floor(Math.random() * N);
    if (given[r][c]) {
      given[r][c] = false;
      removed++;
    }
  }
  return { given, solution: grid };
}

function cellValid(board: number[][], r: number, c: number, v: number): boolean {
  for (let i = 0; i < N; i++) {
    if (i !== c && board[r][i] === v) return false;
    if (i !== r && board[i][c] === v) return false;
  }
  const br = Math.floor(r / 2) * 2;
  const bc = Math.floor(c / 2) * 2;
  for (let dr = 0; dr < 2; dr++)
    for (let dc = 0; dc < 2; dc++) {
      const rr = br + dr;
      const cc = bc + dc;
      if ((rr !== r || cc !== c) && board[rr][cc] === v) return false;
    }
  return true;
}

export function SudokuGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("sudoku", "low");
  const [puzzle, setPuzzle] = useState<Puzzle>(() => makePuzzle(8));
  const [board, setBoard] = useState<number[][]>(() => puzzleBoard(makePuzzle(8)));
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  function puzzleBoard(p: Puzzle): number[][] {
    return p.given.map((row, r) => row.map((g, c) => (g ? p.solution[r][c] : 0)));
  }

  const reset = useCallback((holes = 8) => {
    const p = makePuzzle(holes);
    setPuzzle(p);
    setBoard(puzzleBoard(p));
    setMistakes(0);
    setElapsed(0);
    setDone(false);
  }, []);

  useEffect(() => {
    reset(8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [done]);

  const setCell = (r: number, c: number, v: number) => {
    if (done || puzzle.given[r][c]) return;
    const next = board.map((row) => [...row]);
    next[r][c] = v;
    if (v !== 0 && !cellValid(next, r, c, v)) setMistakes((m) => m + 1);
    setBoard(next);
    const full = next.every((row) => row.every((cell) => cell !== 0));
    if (full) {
      const correct = next.every((row, rr) => row.every((cell, cc) => cell === puzzle.solution[rr][cc]));
      if (correct) {
        setDone(true);
        submitBest(elapsed);
        fireAchievement("sudoku-min");
      }
    }
  };

  return (
    <GameFrame
      accent="var(--ai-1)"
      icon={<Hash className="h-4 w-4" />}
      title={lang === "fa" ? "سودوکو مینی" : "Mini Sudoku"}
      subtitle={lang === "fa" ? "۴×۴ — هر رقم در سطر، ستون و خانه ۲×۲ یکتا باشد" : "4×4 — each digit unique in row, column and 2×2 box"}
      best={best}
      bestLabel={lang === "fa" ? "بهترین زمان" : "Best time"}
      onReset={() => reset(8)}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "زمان" : "Time"} value={`${elapsed}s`} accent="var(--ai-1)" />
            <StatPill label={lang === "fa" ? "خطا" : "Mistakes"} value={mistakes} accent="var(--destructive)" />
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => {
                  // apply to first empty cell — mobile-friendly fill
                  const empty = board.findIndex((row, r) => row.findIndex((cell, c) => cell === 0 && !puzzle.given[r][c]) >= 0);
                  if (empty >= 0) {
                    const r = empty;
                    const c = board[r].findIndex((cell, c2) => cell === 0 && !puzzle.given[r][c2]);
                    setCell(r, c, n);
                  }
                }}
                data-cursor-hover
                className="h-9 w-9 rounded-lg border border-border bg-surface-1 font-mono text-sm font-bold text-foreground transition hover:border-[var(--ai-1)] hover:text-[var(--ai-1)]"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="mx-auto grid max-w-[240px] grid-cols-4 gap-1">
        {board.map((row, r) =>
          row.map((v, c) => {
            const isGiven = puzzle.given[r][c];
            const boxEdgeR = r % 2 === 1 && r !== N - 1;
            const boxEdgeC = c % 2 === 1 && c !== N - 1;
            return (
              <button
                key={`${r}-${c}`}
                data-cursor-hover
                onClick={() => {
                  // cycle 0→1→2→3→4→0 on click (desktop + mobile friendly)
                  const nextVal = (v + 1) % 5;
                  setCell(r, c, nextVal);
                }}
                className="grid aspect-square select-none place-items-center rounded-md border font-mono text-sm font-bold transition-colors"
                style={{
                  borderColor: boxEdgeR || boxEdgeC ? "color-mix(in oklch, var(--ai-1) 45%, transparent)" : "var(--border)",
                  background: isGiven ? "color-mix(in oklch, var(--ai-1) 10%, var(--surface-1))" : "var(--surface-1)",
                  color: isGiven ? "var(--ai-1)" : "var(--foreground)",
                }}
                aria-label={lang === "fa" ? `خانه ${r + 1}،${c + 1}` : `cell ${r + 1},${c + 1}`}
              >
                {v || ""}
              </button>
            );
          })
        )}
      </div>
      {done && (
        <p className="mt-2 text-center font-mono text-xs" style={{ color: "var(--ai-1)" }}>
          {lang === "fa" ? `> حل شد در ${elapsed} ثانیه! 🏆` : `> solved in ${elapsed}s! 🏆`}
        </p>
      )}
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        {lang === "fa" ? "روی هر خانه بزن تا رقم‌ها ۱ تا ۴ چرخش کنند" : "Tap a cell to cycle digits 1–4"}
      </p>
    </GameFrame>
  );
}
