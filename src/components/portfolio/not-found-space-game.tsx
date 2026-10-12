"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Home, Pause, Play, RotateCcw, ShoppingBag, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContent } from "@/lib/content-store";
import { cn } from "@/lib/utils";

type Difficulty = "easy" | "normal" | "hard";
type Upgrade = "shield" | "magnet";

type Asteroid = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
};

type Coin = {
  x: number;
  y: number;
  r: number;
  vx: number;
  phase: number;
};

type Star = {
  x: number;
  y: number;
  z: number;
  speed: number;
};

type ScoreRow = {
  name: string;
  score: number;
  coins: number;
  difficulty: Difficulty;
  date: string;
};

const SCORE_KEY = "p00rija-404-leaderboard";
const COIN_KEY = "p00rija-404-coins";
const UPGRADE_KEY = "p00rija-404-upgrades";

const DIFFICULTY: Record<Difficulty, { label: string; count: number; speed: number; accel: number; score: number }> = {
  easy: { label: "Easy", count: 0.75, speed: 0.78, accel: 0.78, score: 0.8 },
  normal: { label: "Normal", count: 1, speed: 1, accel: 1, score: 1 },
  hard: { label: "Hard", count: 1.22, speed: 1.18, accel: 1.28, score: 1.35 },
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function readScores(limit: number): ScoreRow[] {
  const parsed = readJson<unknown[]>(SCORE_KEY, []);
  return parsed
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Partial<ScoreRow>;
      const difficulty: Difficulty = item.difficulty === "easy" || item.difficulty === "hard" ? item.difficulty : "normal";
      return {
        name: typeof item.name === "string" ? item.name : "VOID",
        score: Number(item.score) || 0,
        coins: Number(item.coins) || 0,
        difficulty,
        date: typeof item.date === "string" ? item.date : "",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function loadImage(src: string) {
  if (typeof window === "undefined" || !src) return null;
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  return image;
}

function drawImageContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, boxW: number, boxH: number) {
  const ratio = Math.min(boxW / image.naturalWidth, boxH / image.naturalHeight);
  const w = image.naturalWidth * ratio;
  const h = image.naturalHeight * ratio;
  ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
}

export function NotFoundSpaceGame() {
  const content = useContent((s) => s.content.error404);
  const lang = useContent((s) => s.lang);
  const fetchContent = useContent((s) => s.fetchContent);
  const loaded = useContent((s) => s.loaded);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const drawRef = useRef<(time: number) => void>(() => {});
  const keysRef = useRef<Record<string, boolean>>({});
  const pointerRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const playerRef = useRef({ x: 140, y: 220, invulnerable: 0 });
  const asteroidsRef = useRef<Asteroid[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const starsRef = useRef<Star[]>([]);
  const imagesRef = useRef<{ player: HTMLImageElement | null; comet: HTMLImageElement | null }>({ player: null, comet: null });
  const lastRef = useRef(0);
  const scoreRef = useRef(0);
  const scoreStateRef = useRef(0);
  const hudTickRef = useRef(0);
  const livesRef = useRef(content.game.lives);
  const runCoinsRef = useRef(0);
  const savedScoreRef = useRef(false);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const gameOverRef = useRef(false);
  const modalOpenRef = useRef(false);
  const upgradesRef = useRef<Record<Upgrade, boolean>>({ shield: false, magnet: false });

  const [revealed, setRevealed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [runSeed, setRunSeed] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(content.game.lives);
  const [runCoins, setRunCoins] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [upgrades, setUpgrades] = useState<Record<Upgrade, boolean>>({ shield: false, magnet: false });
  const [name, setName] = useState("");
  const [scores, setScores] = useState<ScoreRow[]>(() => readScores(8));

  const diff = DIFFICULTY[difficulty];
  const canvasHeight = Math.min(760, Math.max(420, Number(content.game.canvasHeight || 560)));

  useEffect(() => {
    playingRef.current = playing;
    pausedRef.current = paused;
    gameOverRef.current = gameOver;
    modalOpenRef.current = modalOpen;
  }, [gameOver, modalOpen, paused, playing]);

  useEffect(() => {
    upgradesRef.current = upgrades;
  }, [upgrades]);

  useEffect(() => {
    if (!loaded) void fetchContent();
  }, [fetchContent, loaded]);

  useEffect(() => {
    imagesRef.current = {
      player: loadImage(content.assets.playerAstronaut),
      comet: loadImage(content.assets.comet),
    };
  }, [content.assets.playerAstronaut, content.assets.comet]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setScores(readScores(content.game.leaderboardLimit));
      setTotalCoins(Number(localStorage.getItem(COIN_KEY) || "0") || 0);
      const savedUpgrades = readJson<Partial<Record<Upgrade, boolean>>>(UPGRADE_KEY, {});
      setUpgrades({ shield: !!savedUpgrades.shield, magnet: !!savedUpgrades.magnet });
    });
    return () => cancelAnimationFrame(id);
  }, [content.game.leaderboardLimit]);

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalOpen]);

  const spawnAsteroid = useCallback((w: number, h: number, offset = 0): Asteroid => {
    const r = rand(content.game.asteroidMinSize, content.game.asteroidMaxSize);
    const vx = -rand(content.game.speed * diff.speed, (content.game.speed + 1.35) * diff.speed);
    const vy = rand(-0.38, 0.38) * diff.speed;
    return {
      x: w + offset + rand(80, 360),
      y: rand(r * 0.9, h - r * 0.9),
      r,
      vx,
      vy,
      a: Math.atan2(vy, vx) - Math.PI,
    };
  }, [content.game, diff.speed]);

  const spawnCoin = useCallback((w: number, h: number, offset = 0): Coin => ({
    x: w + offset + rand(160, 520),
    y: rand(48, h - 48),
    r: rand(10, 16),
    vx: -rand(1.05, 1.9) * diff.speed,
    phase: rand(0, Math.PI * 2),
  }), [diff.speed]);

  const resetWorld = useCallback(() => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || 1100;
    const h = Math.max(420, canvas?.clientHeight || canvasHeight);
    const count = Math.max(3, Math.round(content.game.asteroidCount * diff.count));
    const coinCount = Math.max(1, Number(content.game.coinCount || 4));
    playerRef.current = {
      x: Math.max(130, w * 0.22),
      y: h * 0.5,
      invulnerable: upgradesRef.current.shield ? 210 : 90,
    };
    scoreRef.current = 0;
    scoreStateRef.current = 0;
    hudTickRef.current = 0;
    runCoinsRef.current = 0;
    livesRef.current = content.game.lives;
    savedScoreRef.current = false;
    setScore(0);
    setRunCoins(0);
    setLives(content.game.lives);
    setPaused(false);
    setGameOver(false);
    asteroidsRef.current = Array.from({ length: count }, (_, i) => spawnAsteroid(w, h, i * 260));
    coinsRef.current = Array.from({ length: coinCount }, (_, i) => spawnCoin(w, h, i * 360));
    starsRef.current = Array.from({ length: content.game.starCount }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      z: rand(0.2, 1),
      speed: rand(0.15, 1.6),
    }));
  }, [canvasHeight, content.game, diff.count, spawnAsteroid, spawnCoin]);

  const endGame = useCallback(() => {
    playingRef.current = false;
    pausedRef.current = false;
    gameOverRef.current = true;
    setPlaying(false);
    setPaused(false);
    setGameOver(true);
    try { window.dispatchEvent(new CustomEvent("achieve", { detail: "space-survivor" })); } catch {}
    setScore(Math.floor(scoreRef.current));
    setRunCoins(runCoinsRef.current);
  }, []);

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number) => {
    const img = imagesRef.current.player;
    const w = size * 3.1;
    const h = size * 2.45;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time / 550) * 0.06);
    ctx.shadowColor = content.colors.accent;
    ctx.shadowBlur = 20;
    if (img?.complete && img.naturalWidth) {
      drawImageContain(ctx, img, 0, 0, w, h);
    } else {
      ctx.fillStyle = content.colors.suit;
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, [content.colors.accent, content.colors.suit]);

  const drawComet = useCallback((ctx: CanvasRenderingContext2D, asteroid: Asteroid) => {
    const img = imagesRef.current.comet;
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    // The source image's head points left and the flame trails right; this keeps flames behind the flight path without spinning.
    ctx.rotate(asteroid.a);
    const w = asteroid.r * 2.5;
    const h = asteroid.r * 2.05;
    if (img?.complete && img.naturalWidth) {
      drawImageContain(ctx, img, 0, 0, w, h);
    } else {
      ctx.fillStyle = content.colors.asteroid;
      ctx.beginPath();
      ctx.arc(0, 0, asteroid.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, [content.colors.asteroid]);

  const drawCoin = (ctx: CanvasRenderingContext2D, coin: Coin, time: number) => {
    const pulse = 1 + Math.sin(time / 180 + coin.phase) * 0.12;
    const r = coin.r * pulse;
    const gradient = ctx.createRadialGradient(coin.x - r * 0.35, coin.y - r * 0.35, 1, coin.x, coin.y, r);
    gradient.addColorStop(0, "#fff5a8");
    gradient.addColorStop(0.42, "#ffd43b");
    gradient.addColorStop(1, "#f59f00");
    ctx.save();
    ctx.shadowColor = "#ffd43b";
    ctx.shadowBlur = 16;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,50,0,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(80,45,0,0.55)";
    ctx.font = `${Math.max(12, r)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", coin.x, coin.y + 1);
    ctx.restore();
  };

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(360, Math.floor(rect.width));
    const h = Math.max(420, Math.floor(rect.height || canvasHeight));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const dt = Math.min(2, (time - (lastRef.current || time)) / 16.67);
    lastRef.current = time;
    const active = playingRef.current && !gameOverRef.current && !pausedRef.current;
    const progress = Math.floor(scoreRef.current / 420);
    const speedMul = (1 + progress * content.game.acceleration * 18 * diff.accel);
    const player = playerRef.current;
    const size = Math.max(32, Number(content.game.playerSize || 48));

    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w * 0.38, h * 0.42, 20, w * 0.5, h * 0.45, w * 0.86);
    bg.addColorStop(0, "rgba(74,138,255,0.22)");
    bg.addColorStop(0.44, "rgba(8,12,28,0.98)");
    bg.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    starsRef.current = starsRef.current.map((star) => {
      let nextX = star.x - star.speed * star.z * dt * (active ? 1.8 : 0);
      let nextY = star.y;
      if (nextX < 0) {
        nextX = w;
        nextY = rand(0, h);
      }
      ctx.globalAlpha = 0.18 + star.z * 0.74;
      ctx.fillStyle = content.colors.star;
      ctx.fillRect(nextX, nextY, Math.max(1, star.z * 2.2), Math.max(1, star.z * 2.2));
      return { ...star, x: nextX, y: nextY };
    });
    ctx.globalAlpha = 1;

    if (active) {
      const move = (6.2 + (upgrades.magnet ? 0.35 : 0)) * dt;
      if (keysRef.current.ArrowUp || keysRef.current.KeyW) player.y -= move;
      if (keysRef.current.ArrowDown || keysRef.current.KeyS) player.y += move;
      if (keysRef.current.ArrowLeft || keysRef.current.KeyA) player.x -= move;
      if (keysRef.current.ArrowRight || keysRef.current.KeyD) player.x += move;
      if (pointerRef.current.active) {
        player.x += (pointerRef.current.x - player.x) * 0.1 * dt;
        player.y += (pointerRef.current.y - player.y) * 0.1 * dt;
      }
      player.x = clamp(player.x, size * 1.25, w - size * 1.25);
      player.y = clamp(player.y, size, h - size);
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      scoreRef.current += dt * diff.score;
      if (time - hudTickRef.current > 100) {
        const nextScore = Math.floor(scoreRef.current);
        if (nextScore !== scoreStateRef.current) {
          scoreStateRef.current = nextScore;
          setScore(nextScore);
        }
        hudTickRef.current = time;
      }

      asteroidsRef.current = asteroidsRef.current.map((asteroid) => {
        let next = {
          ...asteroid,
          x: asteroid.x + asteroid.vx * dt * speedMul,
          y: asteroid.y + asteroid.vy * dt,
          a: asteroid.a,
        };
        if (next.x < -next.r * 3) next = spawnAsteroid(w, h);
        if (next.y < next.r || next.y > h - next.r) {
          const vy = -next.vy;
          next = { ...next, vy, a: Math.atan2(vy, next.vx) - Math.PI };
        }
        const dx = next.x - player.x;
        const dy = next.y - player.y;
        const hit = Math.hypot(dx, dy) < next.r * 0.62 + size * 0.72;
        if (hit && player.invulnerable <= 0) {
          livesRef.current -= 1;
          setLives(livesRef.current);
          player.invulnerable = 95;
          next = spawnAsteroid(w, h, 180);
          if (livesRef.current <= 0) endGame();
        }
        return next;
      });

      coinsRef.current = coinsRef.current.map((coin) => {
        let next = { ...coin, x: coin.x + coin.vx * dt * speedMul * 0.85 };
        if (upgrades.magnet) {
          const dx = player.x - next.x;
          const dy = player.y - next.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          if (d < 190) next = { ...next, x: next.x + (dx / d) * 3.2 * dt, y: next.y + (dy / d) * 3.2 * dt };
        }
        if (next.x < -40) next = spawnCoin(w, h);
        const collected = Math.hypot(next.x - player.x, next.y - player.y) < size * 0.75 + next.r;
        if (collected) {
          const value = Number(content.game.coinValue || 5);
          runCoinsRef.current += value;
          setRunCoins(runCoinsRef.current);
          const total = (Number(localStorage.getItem(COIN_KEY) || "0") || 0) + value;
          localStorage.setItem(COIN_KEY, String(total));
          setTotalCoins(total);
          return spawnCoin(w, h, 240);
        }
        return next;
      });
    }

    for (const coin of coinsRef.current) drawCoin(ctx, coin, time);
    for (const asteroid of asteroidsRef.current) drawComet(ctx, asteroid);
    if (player.invulnerable <= 0 || Math.floor(time / 90) % 2 === 0) drawPlayer(ctx, player.x, player.y, size, time);
    if (pausedRef.current && !gameOverRef.current) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "800 32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", w / 2, h / 2);
      ctx.restore();
    }

    if (playingRef.current || gameOverRef.current || modalOpenRef.current) {
      rafRef.current = requestAnimationFrame((nextTime) => drawRef.current(nextTime));
    }
  }, [canvasHeight, content.colors.star, content.game, diff, drawComet, drawPlayer, endGame, spawnAsteroid, spawnCoin, upgrades.magnet]);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const start = useCallback(() => {
    if (!content.game.enabled) return;
    playingRef.current = true;
    pausedRef.current = false;
    gameOverRef.current = false;
    modalOpenRef.current = true;
    setModalOpen(true);
    setPlaying(true);
    setPaused(false);
    setGameOver(false);
    setRunSeed((value) => value + 1);
  }, [content.game.enabled]);

  useEffect(() => {
    if (!modalOpen || !playing) return;
    const id = requestAnimationFrame(() => {
      resetWorld();
      lastRef.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame((time) => drawRef.current(time));
    });
    return () => cancelAnimationFrame(id);
  }, [modalOpen, playing, resetWorld, runSeed]);

  const closeModal = () => {
    playingRef.current = false;
    pausedRef.current = false;
    modalOpenRef.current = false;
    setPlaying(false);
    setPaused(false);
    setModalOpen(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const togglePause = () => {
    if (!playingRef.current || gameOverRef.current) return;
    pausedRef.current = !pausedRef.current;
    pointerRef.current.active = false;
    keysRef.current = {};
    setPaused(pausedRef.current);
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const gameKey = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code);
      if (modalOpen && gameKey) event.preventDefault();
      if (modalOpen && event.code === "KeyP" && !event.repeat) {
        togglePause();
        return;
      }
      keysRef.current[event.code] = true;
      if ((event.code === "Space" || event.code === "Enter") && revealed && !playing && !gameOver) start();
    };
    const up = (event: KeyboardEvent) => {
      keysRef.current[event.code] = false;
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameOver, modalOpen, playing, revealed, start]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (modalOpenRef.current || playingRef.current) return;
      resetWorld();
      drawRef.current(performance.now());
    });
    return () => cancelAnimationFrame(id);
  }, [difficulty, resetWorld]);

  const saveScore = () => {
    if (savedScoreRef.current) return;
    savedScoreRef.current = true;
    const playerName = name.trim() || "VOID";
    const final = Math.floor(scoreRef.current);
    const row: ScoreRow = {
      name: playerName,
      score: final,
      coins: runCoinsRef.current,
      difficulty,
      date: new Date().toISOString(),
    };
    const next = [row, ...readScores(99)]
      .sort((a, b) => b.score - a.score)
      .slice(0, content.game.leaderboardLimit);
    writeJson(SCORE_KEY, next);
    setScores(next);
  };

  const buyUpgrade = (upgrade: Upgrade, cost: number) => {
    if (upgrades[upgrade] || totalCoins < cost) return;
    const nextCoins = totalCoins - cost;
    const nextUpgrades = { ...upgrades, [upgrade]: true };
    setTotalCoins(nextCoins);
    setUpgrades(nextUpgrades);
    localStorage.setItem(COIN_KEY, String(nextCoins));
    writeJson(UPGRADE_KEY, nextUpgrades);
  };

  const styleVars = useMemo(() => ({
    "--nf-suit": content.colors.suit,
    "--nf-visor": content.colors.visor,
    "--nf-tether": content.colors.tether,
    "--nf-accent": content.colors.accent,
    "--nf-danger": content.colors.danger,
  }) as React.CSSProperties, [content.colors]);

  const gameHud = (
    <div className="flex flex-wrap items-center gap-2 text-sm text-white/75">
      <span>{content.scoreLabel}: <b className="text-white">{score}</b></span>
      <span>{content.livesLabel}: <b className="text-white">{lives}</b></span>
      <span>{content.coinsLabel}: <b className="text-amber-300">{runCoins}</b></span>
      <span>{content.difficultyLabel}: <b className="text-[var(--nf-accent)]">{DIFFICULTY[difficulty].label}</b></span>
    </div>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white" style={styleVars}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,177,94,0.12),transparent_24%),radial-gradient(circle_at_25%_20%,rgba(232,74,155,0.18),transparent_32%),radial-gradient(circle_at_75%_42%,rgba(22,214,195,0.16),transparent_30%),linear-gradient(to_bottom,rgba(0,0,0,0.18),rgba(0,0,0,0.72))]" />
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:38px_38px]" />
      <section className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-5 py-24 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.24em] text-white/70 backdrop-blur">
            {content.badge}
          </span>
          <div>
            <h1 className="text-balance text-5xl font-black leading-tight md:text-7xl">
              {content.title}
              <span className="block text-[var(--nf-accent)]">{content.highlight}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/62 md:text-lg">{content.description}</p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">{content.difficultyLabel}</span>
              {(["easy", "normal", "hard"] as Difficulty[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDifficulty(key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                    difficulty === key ? "border-[var(--nf-accent)] bg-[var(--nf-accent)] text-black" : "border-white/15 bg-white/5 text-white/70 hover:text-white"
                  )}
                >
                  {DIFFICULTY[key].label}
                </button>
              ))}
            </div>
            <div className={cn("flex flex-wrap gap-3 transition-all duration-500", revealed ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0")}>
              <Button onClick={start} disabled={!content.game.enabled} className="rounded-full bg-white text-black hover:bg-white/90">
                <Play className="size-4" />
                {content.startLabel}
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link href="/">
                  <Home className="size-4" />
                  {content.backLabel}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="group relative mx-auto block aspect-square w-full max-w-[560px] overflow-hidden rounded-[48px] border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-cyan-500/10 backdrop-blur"
          aria-label={content.astronautLabel}
        >
          <span className="absolute left-[18%] top-[18%] h-32 w-32 rounded-full bg-[var(--nf-accent)]/20 blur-3xl" />
          <span className="absolute bottom-[12%] right-[12%] h-40 w-40 rounded-full bg-[var(--nf-danger)]/20 blur-3xl" />
          <span className="absolute left-6 top-6 z-10 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/60">
            {revealed ? content.astronautLabel : content.revealLabel}
          </span>
          <span className="astronaut-404 absolute inset-0 grid place-items-center p-8">
            <img
              src={content.assets.lostAstronaut}
              alt={content.astronautLabel}
              className="max-h-full max-w-full object-contain drop-shadow-[0_30px_80px_rgba(22,214,195,0.22)]"
              draggable={false}
            />
          </span>
        </button>

        <aside className="rounded-3xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Trophy className="size-4 text-[var(--nf-accent)]" />
              {content.leaderboardLabel}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm text-amber-200">
              {content.coinsLabel}: <b>{totalCoins}</b>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {scores.length ? scores.map((row, index) => (
              <div key={`${row.name}-${index}-${row.date}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="font-mono text-xs text-white/40">#{index + 1} · {lang === "fa" ? ({ easy: "آسان", normal: "عادی", hard: "سخت" } as const)[row.difficulty] : DIFFICULTY[row.difficulty].label}</div>
                <div className="mt-1 font-bold text-white">{row.name}</div>
                <div className="text-sm text-[var(--nf-accent)]">{row.score} · +{row.coins} {lang === "fa" ? "سکه" : "coins"}</div>
              </div>
            )) : (
              <p className="text-sm text-white/45">{lang === "fa" ? "هنوز امتیازی ثبت نشده است." : "No scores yet."}</p>
            )}
          </div>
        </aside>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[180] bg-black/82 p-3 backdrop-blur-xl md:p-6">
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#040714]/95 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
              {gameHud}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={togglePause} disabled={!playing || gameOver} className="rounded-full text-white hover:bg-white/10">
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button size="sm" variant="ghost" onClick={start} className="rounded-full text-white hover:bg-white/10">
                  <RotateCcw className="size-4" />
                  {content.restartLabel}
                </Button>
                <Button size="icon" variant="ghost" onClick={closeModal} className="rounded-full text-white hover:bg-white/10" aria-label="Close">
                  <X className="size-5" />
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1fr_300px]">
              <div className="relative min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-black">
                <canvas
                  ref={canvasRef}
                  className="block h-full w-full touch-none"
                  style={{ height: "100%" }}
                  onPointerDown={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    pointerRef.current = { active: true, x: event.clientX - rect.left, y: event.clientY - rect.top };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    pointerRef.current = { active: pointerRef.current.active, x: event.clientX - rect.left, y: event.clientY - rect.top };
                  }}
                  onPointerUp={() => {
                    pointerRef.current.active = false;
                  }}
                />
                {!playing && !gameOver && (
                  <div className="absolute inset-0 grid place-items-center bg-black/30">
                    <Button onClick={start} className="rounded-full bg-white px-6 text-black hover:bg-white/90">
                      <Play className="size-4" />
                      {content.startLabel}
                    </Button>
                  </div>
                )}
                {gameOver && (
                  <div className="absolute inset-0 grid place-items-center bg-black/65 p-4">
                    <div className="w-full max-w-lg rounded-3xl border border-[var(--nf-danger)]/35 bg-[#10050b]/90 p-5 text-center shadow-2xl">
                      <h2 className="text-2xl font-black text-white">{content.gameOverTitle}</h2>
                      <p className="mt-2 text-sm text-white/62">{content.gameOverDescription}</p>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <span className="text-xs uppercase tracking-[0.24em] text-white/40">{content.finalScoreLabel}</span>
                        <div className="mt-1 text-4xl font-black text-[var(--nf-accent)]">{score}</div>
                        <div className="text-sm text-amber-200">+{runCoins} {content.coinsLabel}</div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={content.playerNamePlaceholder} className="border-white/10 bg-black/40 text-white" />
                        <Button onClick={saveScore} className="rounded-full bg-white text-black hover:bg-white/90">{content.submitScoreLabel}</Button>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <Button onClick={start} variant="outline" className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10">
                          <RotateCcw className="size-4" />
                          {content.restartLabel}
                        </Button>
                        <Button asChild variant="outline" className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10">
                          <Link href="/">
                            <Home className="size-4" />
                            {content.backLabel}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <aside className="space-y-4 overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <ShoppingBag className="size-4 text-amber-300" />
                    {content.shopLabel}
                  </div>
                  <p className="mt-1 text-xs text-white/45">{content.coinsLabel}: {totalCoins}</p>
                </div>
                {([
                  ["shield", content.shieldLabel, content.game.shieldCost],
                  ["magnet", content.magnetLabel, content.game.magnetCost],
                ] as [Upgrade, string, number][]).map(([key, label, cost]) => (
                  <div key={key} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="font-bold text-white">{label}</div>
                    <div className="mt-1 text-xs text-white/45">{cost} {content.coinsLabel}</div>
                    <Button
                      size="sm"
                      disabled={upgrades[key] || totalCoins < cost || (playing && !paused && !gameOver)}
                      onClick={() => buyUpgrade(key, cost)}
                      className="mt-3 w-full rounded-full bg-white text-black hover:bg-white/90"
                    >
                      {playing && !paused && !gameOver && !upgrades[key] ? "Pause to buy" : upgrades[key] ? content.equippedLabel : content.buyLabel}
                    </Button>
                  </div>
                ))}
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="mb-2 flex items-center gap-2 font-bold text-white">
                    <Trophy className="size-4 text-[var(--nf-accent)]" />
                    {content.leaderboardLabel}
                  </div>
                  <div className="space-y-2">
                    {scores.slice(0, 5).map((row, index) => (
                      <div key={`${row.name}-${row.date}-${index}`} className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                        <div className="text-white">#{index + 1} {row.name}</div>
                        <div className="text-xs text-white/45">{row.score} · +{row.coins}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .astronaut-404 {
          animation: astronaut-float 5s ease-in-out infinite;
          transform-style: preserve-3d;
        }
        button:hover .astronaut-404 {
          animation-duration: 2.5s;
        }
        @keyframes astronaut-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotateZ(-5deg) rotateY(-10deg); }
          50% { transform: translate3d(0, -18px, 0) rotateZ(6deg) rotateY(14deg); }
        }
      `}</style>
    </main>
  );
}
