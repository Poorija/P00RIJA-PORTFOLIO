"use client";

/* Mine Hunter — compact minesweeper (8×8, 10 mines), first click is safe. */

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Bomb } from "lucide-react";
import { GameFrame, PlayButton, StatPill, fireAchievement, useBestScore, useLang } from "./shared";

const N = 8;
const MINES = 10;
const NUM_COLORS = ["", "oklch(0.7 0.15 250)", "oklch(0.7 0.15 145)", "oklch(0.7 0.15 25)", "oklch(0.65 0.18 285)", "oklch(0.7 0.16 45)", "oklch(0.65 0.14 190)", "oklch(0.6 0.05 270)", "oklch(0.55 0.02 270)"];

type Cell = { mine: boolean; open: boolean; flag: boolean; count: number };

function blank(): Cell[] {
  return Array.from({ length: N * N }, () => ({ mine: false, open: false, flag: false, count: 0 }));
}

function neighbors(i: number): number[] {
  const r = Math.floor(i / N);
  const c = i % N;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
    }
  return out;
}

function plant(cells: Cell[], safe: number): Cell[] {
  const next = cells.map((c) => ({ ...c }));
  const forbidden = new Set([safe, ...neighbors(safe)]);
  let placed = 0;
  while (placed < MINES) {
    const idx = Math.floor(Math.random() * N * N);
    if (next[idx].mine || forbidden.has(idx)) continue;
    next[idx].mine = true;
    placed++;
  }
  next.forEach((cell, i) => {
    cell.count = neighbors(i).filter((j) => next[j].mine).length;
  });
  return next;
}

function floodOpen(cells: Cell[], start: number): void {
  const stack = [start];
  while (stack.length) {
    const i = stack.pop() as number;
    const cell = cells[i];
    if (cell.open || cell.flag) continue;
    cell.open = true;
    if (cell.count === 0 && !cell.mine) {
      neighbors(i).forEach((j) => {
        if (!cells[j].open) stack.push(j);
      });
    }
  }
}

export function MinesweeperGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("mines", "low");
  const [cells, setCells] = useState<Cell[]>(blank);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [seconds, setSeconds] = useState(0);

  const flags = cells.filter((c) => c.flag).length;
  const opened = cells.filter((c) => c.open).length;

  const reset = useCallback(() => {
    setCells(blank());
    setStarted(false);
    setStatus("playing");
    setSeconds(0);
  }, []);

  const tickTimer = useCallback(() => {
    setSeconds((s) => s + 1);
  }, []);

  const open = (i: number) => {
    if (status !== "playing" || cells[i].flag) return;
    let next = cells.map((c) => ({ ...c }));
    if (!started) {
      next = plant(next, i);
      setStarted(true);
      const timer = setInterval(tickTimer, 1000);
      (window as unknown as { __mineTimer?: ReturnType<typeof setInterval> }).__mineTimer = timer;
    }
    if (next[i].mine) {
      next.forEach((c) => {
        if (c.mine) c.open = true;
      });
      setCells(next);
      setStatus("lost");
      clearInterval((window as unknown as { __mineTimer?: ReturnType<typeof setInterval> }).__mineTimer);
      return;
    }
    floodOpen(next, i);
    setCells(next);
    const safeTotal = N * N - MINES;
    if (next.filter((c) => c.open).length === safeTotal) {
      setStatus("won");
      submitBest(seconds || 1);
      fireAchievement("mine-hunter");
      clearInterval((window as unknown as { __mineTimer?: ReturnType<typeof setInterval> }).__mineTimer);
    }
  };

  const flag = (i: number) => {
    if (status !== "playing" || cells[i].open) return;
    setCells((cur) => cur.map((c, j) => (j === i ? { ...c, flag: !c.flag } : c)));
  };

  return (
    <GameFrame
      accent="var(--sec-1)"
      icon={<Bomb className="h-4 w-4" />}
      title={lang === "fa" ? "مین‌یاب" : "Mine Hunter"}
      subtitle={lang === "fa" ? "۸×۸ با ۱۰ مین — کلیک: باز کردن، راست‌کلیک: پرچم" : "8×8, 10 mines — click: open, right-click: flag"}
      best={best}
      bestLabel={lang === "fa" ? "بهترین زمان" : "Best time"}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label="🚩" value={`${flags}/${MINES}`} accent="var(--sec-1)" />
            <StatPill label={lang === "fa" ? "زمان" : "Time"} value={`${seconds}s`} />
          </div>
          {status !== "playing" && (
            <PlayButton accent="var(--sec-1)" onClick={reset}>
              {lang === "fa" ? "دور جدید" : "New round"}
            </PlayButton>
          )}
        </div>
      }
    >
      <div className="mx-auto grid max-w-[320px] grid-cols-8 gap-1" onContextMenu={(e) => e.preventDefault()}>
        {cells.map((cell, i) => {
          const numColor = NUM_COLORS[cell.count] || "";
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.9 }}
              onClick={() => open(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                flag(i);
              }}
              data-cursor-hover
              className="grid aspect-square select-none place-items-center rounded-md border font-mono text-[11px] font-bold"
              style={{
                borderColor: cell.open ? "transparent" : "color-mix(in oklch, var(--sec-1) 25%, var(--border))",
                background: cell.open
                  ? cell.mine
                    ? "color-mix(in oklch, var(--destructive) 30%, transparent)"
                    : "var(--surface-1)"
                  : "color-mix(in oklch, var(--sec-1) 7%, var(--surface-1))",
                color: cell.open && !cell.mine ? numColor : cell.mine ? "var(--destructive)" : "var(--foreground)",
              }}
              aria-label={cell.open ? (cell.mine ? "mine" : String(cell.count)) : "hidden"}
            >
              {cell.open ? (cell.mine ? "💥" : cell.count || "") : cell.flag ? "🚩" : ""}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-2 text-center font-mono text-xs" style={{ color: status === "won" ? "var(--sec-1)" : status === "lost" ? "var(--destructive)" : "var(--muted-foreground)" }}>
        {status === "playing"
          ? `${opened}/${N * N - MINES}`
          : status === "won"
          ? (lang === "fa" ? "> همه مین‌ها شناسایی شد! 🏆" : "> field cleared! 🏆")
          : (lang === "fa" ? "> بوووم! بازی تمام شد" : "> boom! game over")}
      </p>
    </GameFrame>
  );
}
