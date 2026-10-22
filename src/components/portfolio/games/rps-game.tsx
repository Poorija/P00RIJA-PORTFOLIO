"use client";

/* Rock Paper Scissors — best of 5 with animated hands and a shifty AI. */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hand } from "lucide-react";
import { GameFrame, StatPill, useBestScore, useLang } from "./shared";

type Move = "rock" | "paper" | "scissors";
const MOVES: Move[] = ["rock", "paper", "scissors"];
const EMOJI: Record<Move, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
const BEATS: Record<Move, Move> = { rock: "scissors", paper: "rock", scissors: "paper" };
const WIN = 3;

export function RpsGame() {
  const lang = useLang();
  const [best, submitBest] = useBestScore("rps");
  const [score, setScore] = useState({ p: 0, ai: 0 });
  const [player, setPlayer] = useState<Move | null>(null);
  const [ai, setAi] = useState<Move | null>(null);
  const [result, setResult] = useState<null | "win" | "lose" | "draw">(null);
  const [history, setHistory] = useState<Move[]>([]);

  const names: Record<Move, string> = lang === "fa"
    ? { rock: "سنگ", paper: "کاغذ", scissors: "قیچی" }
    : { rock: "Rock", paper: "Paper", scissors: "Scissors" };

  const play = useCallback(
    (move: Move) => {
      if (score.p >= WIN || score.ai >= WIN) return;
      // AI lightly counters the player's most frequent recent move
      const freq: Record<Move, number> = { rock: 0, paper: 0, scissors: 0 };
      history.slice(-4).forEach((m) => (freq[m] += 1));
      const favorite = MOVES.reduce((a, b) => (freq[a] >= freq[b] ? a : b));
      const counter: Record<Move, Move> = { rock: "paper", paper: "scissors", scissors: "rock" };
      const aiMove = Math.random() < 0.65 ? Math.random() < 0.6 ? counter[favorite] : (MOVES[Math.floor(Math.random() * 3)]) : (MOVES[Math.floor(Math.random() * 3)]);

      setPlayer(move);
      setAi(aiMove);
      setHistory((h) => [...h, move]);

      if (move === aiMove) setResult("draw");
      else if (BEATS[move] === aiMove) {
        setResult("win");
        setScore((s) => {
          const p = s.p + 1;
          submitBest(p);
          if (p >= WIN) {
            try { window.dispatchEvent(new CustomEvent("achieve", { detail: "rps-grandmaster" })); } catch {}
          }
          return { ...s, p };
        });
      } else {
        setResult("lose");
        setScore((s) => ({ ...s, ai: s.ai + 1 }));
      }
    },
    [history, score.p, score.ai, submitBest]
  );

  const reset = useCallback(() => {
    setScore({ p: 0, ai: 0 });
    setPlayer(null);
    setAi(null);
    setResult(null);
    setHistory([]);
  }, []);

  useEffect(() => {
    if (score.p >= WIN || score.ai >= WIN) {
      const timer = setTimeout(reset, 2600);
      return () => clearTimeout(timer);
    }
     
  }, [score]);

  const matchOver = score.p >= WIN || score.ai >= WIN;

  return (
    <GameFrame
      accent="var(--chart-4, #38bdf8)"
      icon={<Hand className="h-4 w-4" />}
      title={lang === "fa" ? "سنگ کاغذ قیچی" : "Rock Paper Scissors"}
      subtitle={lang === "fa" ? `اولین ${WIN} امتیاز — هوش مصنوعی حرکت‌هایت را یاد می‌گیرد!` : `First to ${WIN} — the AI studies your patterns!`}
      best={best}
      bestLabel={lang === "fa" ? "بردها" : "Wins"}
      onReset={reset}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <StatPill label={lang === "fa" ? "شما" : "You"} value={score.p} accent="var(--chart-4, #38bdf8)" />
            <StatPill label="AI" value={score.ai} accent="var(--destructive)" />
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-center gap-6 py-2" dir="ltr">
        <motion.span
          key={`p-${player}-${score.p}-${score.ai}`}
          animate={player ? { scale: [1, 1.25, 1], rotate: [0, -8, 0] } : {}}
          className="text-5xl"
        >
          {player ? EMOJI[player] : "❔"}
        </motion.span>
        <span className="font-mono text-xs text-muted-foreground">VS</span>
        <motion.span
          key={`a-${ai}-${score.p}-${score.ai}`}
          animate={ai ? { scale: [1, 1.25, 1], rotate: [0, 8, 0] } : {}}
          className="text-5xl"
        >
          {ai ? EMOJI[ai] : "🤖"}
        </motion.span>
      </div>
      <p className="text-center font-mono text-xs" style={{ color: result === "win" ? "var(--sec-1)" : result === "lose" ? "var(--destructive)" : "var(--muted-foreground)" }}>
        {matchOver
          ? score.p > score.ai
            ? (lang === "fa" ? "> مسابقه را بردی! 🏆" : "> match won! 🏆")
            : (lang === "fa" ? "> هوش مصنوعی مسابقه را برد" : "> AI takes the match")
          : result === "win"
          ? (lang === "fa" ? `${names[player as Move]} برد ${names[ai as Move]} را!` : `${names[player as Move]} beats ${names[ai as Move]}!`)
          : result === "lose"
          ? (lang === "fa" ? `${names[ai as Move]} برد ${names[player as Move]} را` : `${names[ai as Move]} beats ${names[player as Move]}`)
          : result === "draw"
          ? (lang === "fa" ? "مساوی!" : "draw!")
          : (lang === "fa" ? "حرکتت را انتخاب کن" : "pick your move")}
      </p>
      <div className="mt-3 flex justify-center gap-2">
        {MOVES.map((m) => (
          <motion.button
            key={m}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => play(m)}
            disabled={matchOver}
            data-cursor-hover
            className="grid h-16 w-16 place-items-center rounded-2xl border text-3xl transition disabled:opacity-40"
            style={{
              borderColor: "color-mix(in oklch, var(--chart-4, #38bdf8) 30%, transparent)",
              background: "color-mix(in oklch, var(--chart-4, #38bdf8) 8%, var(--surface-1))",
            }}
            aria-label={names[m]}
          >
            {EMOJI[m]}
          </motion.button>
        ))}
      </div>
    </GameFrame>
  );
}
