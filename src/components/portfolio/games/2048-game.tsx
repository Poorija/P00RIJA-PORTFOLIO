"use client";

/* 2048 Fusion — the classic sliding merge on a 4×4 gradient grid. */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Grid2x2 } from "lucide-react";
import { GameFrame, PlayButton, StatPill, useBestScore, useGameKeys, useLang } from "./shared";

type Board = number[][];
const N = 4;

const TILE_STYLE: Record<number, { bg: string; fg: string }> = {
  2:    { bg: "oklch(0.95 0.03 85)",  fg: "oklch(0.3 0.05 85)" },
  4:    { bg: "oklch(0.9 0.07 85)",   fg: "oklch(0.3 0.05 85)" },
  8:    { bg: "oklch(0.82 0.12 70)",  fg: "white" },
  16:   { bg: "oklch(0.78 0.14 55)",  fg: "white" },
  32:   { bg: "oklch(0.74 0.16 40)",  fg: "white" },
  64:   { bg: "oklch(0.7 0.18 25)",   fg: "white" },
  128:  { bg: "oklch(0.72 0.16 300)", fg: "white" },
  256:  { bg: "oklch(0.66 0.19 285)", fg: "white" },
  512:  { bg: "oklch(0.6 0.21 270)",  fg: "white" },
  1024: { bg: "oklch(0.55 0.22 255)", fg: "white" },
  2048: { bg: "oklch(0.5 0.23 145)",  fg: "white" },
};

function emptyBoard(): Board {
  return Array.from({ length: N }, () => Array<number>(N).fill(0));
}

function spawn(b: Board): Board {
  const empty: [number, number][] = [];
  b.forEach((row, r) => row.forEach((v, c) => v === 0 && empty.push([r, c])));
  if (!empty.length) return b;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const next = b.map((row) => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function init(): Board {
  return spawn(spawn(emptyBoard()));
}

function slideRow(row: number[]): { row: number[]; gained: number } {
  const vals = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      out.push(vals[i] * 2);
      gained += vals[i] * 2;
      i++;
    } else out.push(vals[i]);
  }
  while (out.length < N) out.push(0);
  return { row: out, gained };
}

/** Rotate the board 90° clockwise. */
function rotateCW(b: Board): Board {
  const out = emptyBoard();
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      out[r][c] = b[N - 1 - c][r];
  return out;
}

const ROTATIONS = { left: 0, up: 3, right: 2, down: 1 } as const;

function move(b: Board, dir: keyof typeof ROTATIONS): { board: Board; gained: number; moved: boolean } {
  const rotations = ROTATIONS[dir];
  let work = b.map((row) => [...row]);
  for (let i = 0; i < rotations; i++) work = rotateCW(work);

  let gained = 0;
  let slid: Board = work.map((row) => {
    const res = slideRow(row);
    gained += res.gained;
    return res.row;
  });
  for (let i = 0; i < (4 - rotations) % 4; i++) slid = rotateCW(slid);

  const moved = slid.some((row, r) => row.some((v, c) => v !== b[r][c]));
  return { board: slid, gained, moved };
}

function canMove(b: Board): boolean {
  return (["up", "down", "left", "right"] as const).some((d) => move(b, d).moved);
}

export function Game2048() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("2048");
  const [board, setBoard] = useState<Board>(init);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  const doMove = useCallback(
    (dir: keyof typeof ROTATIONS) => {
      setBoard((cur) => {
        const { board: next, gained, moved } = move(cur, dir);
        if (!moved) return cur;
        const withSpawn = spawn(next);
        if (gained > 0) {
          setScore((s) => {
            const ns = s + gained;
            submitBest(ns);
            return ns;
          });
        }
        if (!canMove(withSpawn)) setOver(true);
        return withSpawn;
      });
    },
    [submitBest]
  );

  useGameKeys(
    (e) => {
      const map: Record<string, keyof typeof ROTATIONS> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const dir = map[e.key];
      if (dir) doMove(dir);
    },
    true,
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
  );

  const reset = useCallback(() => {
    setBoard(init());
    setScore(0);
    setOver(false);
  }, []);

  const btn = (dir: keyof typeof ROTATIONS, label: string) => (
    <button
      onClick={() => doMove(dir)}
      data-cursor-hover
      className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-1 font-mono text-xs text-foreground transition hover:border-[var(--ai-1)] hover:text-[var(--ai-1)]"
      aria-label={label}
    >
      {{ up: "↑", down: "↓", left: "←", right: "→" }[dir]}
    </button>
  );

  return (
    <GameFrame
      accent="var(--ai-1)"
      icon={<Grid2x2 className="h-4 w-4" />}
      title="2048 Fusion"
      subtitle={lang === "fa" ? "کاشی‌های همسان را ادغام کن و به ۲۰۴۸ برس" : "Merge matching tiles, reach 2048"}
      best={best}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "امتیاز" : "Score"} value={score} accent="var(--ai-1)" />
          </div>
          <div className="flex flex-col items-center gap-1" dir="ltr">
            <div>{btn("up", "up")}</div>
            <div className="flex gap-1">{btn("left", "left")}{btn("down", "down")}{btn("right", "right")}</div>
          </div>
        </div>
      }
    >
      <div className="mx-auto grid max-w-[300px] grid-cols-4 gap-2 rounded-xl bg-surface-1 p-2">
        {board.flatMap((row, r) =>
          row.map((v, c) => {
            const style = TILE_STYLE[v];
            return (
              <motion.div
                key={`${r}-${c}`}
                layout
                transition={{ duration: 0.12 }}
                className="grid aspect-square place-items-center rounded-lg font-mono text-sm font-black sm:text-base"
                style={{
                  background: v === 0 ? "color-mix(in oklch, var(--surface-1) 80%, var(--border))" : style?.bg,
                  color: v === 0 ? "transparent" : style?.fg,
                  boxShadow: v >= 128 ? `0 0 16px -4px ${style?.bg}` : "none",
                }}
              >
                {v || ""}
              </motion.div>
            );
          })
        )}
      </div>
      {over && (
        <div className="mt-3 text-center">
          <p className="font-mono text-xs text-destructive">
            {lang === "fa" ? "> حرکتی باقی نماند!" : "> no moves left!"}
          </p>
          <div className="mt-2">
            <PlayButton accent="var(--ai-1)" onClick={reset}>
              {lang === "fa" ? "شروع دوباره" : "Restart"}
            </PlayButton>
          </div>
        </div>
      )}
    </GameFrame>
  );
}
