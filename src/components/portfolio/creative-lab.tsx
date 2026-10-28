"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw, Shuffle, X } from "lucide-react";

export type LabExperiment = "starfield" | "plasma" | "fractal" | "life" | "particles" | "harmonograph" | "fire" | "maze" | "synth" | "typing";

const EXPERIMENTS: { id: LabExperiment; label: string; hint: string }[] = [
  { id: "starfield", label: "STARFIELD", hint: "Move the pointer to steer the warp field" },
  { id: "plasma", label: "PLASMA", hint: "A procedural aurora computed pixel by pixel" },
  { id: "fractal", label: "FRACTAL", hint: "Click anywhere to dive into the Mandelbrot set" },
  { id: "life", label: "LIFE", hint: "Click cells to edit Conway's cellular automaton" },
  { id: "particles", label: "PARTICLES", hint: "Attract with the pointer; hold to repel" },
  { id: "harmonograph", label: "HARMONOGRAPH", hint: "Lissajous frequencies drawing a living signature" },
  { id: "fire", label: "ASCII FIRE", hint: "A cellular heat simulation rendered as characters" },
  { id: "maze", label: "MAZE", hint: "Reach the cyan exit with WASD, arrows, or touch" },
  { id: "synth", label: "SYNTH", hint: "Build an eight-step loop; audio starts only on Play" },
  { id: "typing", label: "TYPING", hint: "Measure words per minute and typing accuracy" },
];

export function CreativeLab({ initialExperiment, onClose }: { initialExperiment: LabExperiment; onClose: () => void }) {
  const [active, setActive] = useState<LabExperiment>(initialExperiment);
  const experiment = EXPERIMENTS.find((item) => item.id === active) ?? EXPERIMENTS[0];
  return (
    <div data-creative-lab className="absolute inset-0 z-40 flex min-h-0 flex-col bg-[#010504] p-3 font-mono text-[#75ff9c]" dir="ltr" onClick={(event) => event.stopPropagation()}>
      <div className="mb-2 flex shrink-0 items-center gap-2 border-b border-[#75ff9c]/15 pb-2 text-[10px]">
        <span>CREATIVE://LOCAL_LAB</span>
        <span className="hidden text-[#75ff9c]/35 sm:inline">10 EXPERIMENTS · ZERO SERVER LOAD</span>
        <button type="button" onClick={onClose} className="ml-auto grid size-8 place-items-center rounded border border-[#75ff9c]/20 hover:bg-[#75ff9c]/10" aria-label="Close creative lab"><X className="size-4" /></button>
      </div>
      <div className="mb-2 flex shrink-0 gap-1 overflow-x-auto pb-1" data-lenis-prevent>
        {EXPERIMENTS.map((item, index) => (
          <button key={item.id} type="button" onClick={() => setActive(item.id)} className={`shrink-0 rounded border px-2 py-1.5 text-[8px] transition ${active === item.id ? "border-[#75ff9c]/60 bg-[#75ff9c]/15 text-[#b9ffca]" : "border-[#75ff9c]/15 text-[#75ff9c]/50 hover:bg-[#75ff9c]/5"}`} aria-pressed={active === item.id}>
            {String(index + 1).padStart(2, "0")} · {item.label}
          </button>
        ))}
      </div>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3 text-[9px] text-[#75ff9c]/45">
        <span>{experiment.hint}</span><span className="hidden sm:inline">LOCAL ONLY</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#75ff9c]/15 bg-black/60">
        {(active === "starfield" || active === "plasma" || active === "life" || active === "particles" || active === "harmonograph" || active === "fire") && <AnimatedExperiment key={active} mode={active} />}
        {active === "fractal" && <FractalExperiment />}
        {active === "maze" && <MazeExperiment />}
        {active === "synth" && <SynthExperiment />}
        {active === "typing" && <TypingExperiment />}
      </div>
    </div>
  );
}

type AnimatedMode = "starfield" | "plasma" | "life" | "particles" | "harmonograph" | "fire";
type PointerState = { x: number; y: number; active: boolean; repel: boolean };
type Star = { x: number; y: number; z: number };
type Particle = { x: number; y: number; vx: number; vy: number; hue: number };

const makeLife = (cols: number, rows: number) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.random() > 0.82 ? 1 : 0));
const lifeStep = (grid: number[][]) => grid.map((row, y) => row.map((cell, x) => {
  let neighbors = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx || dy) neighbors += grid[(y + dy + grid.length) % grid.length][(x + dx + row.length) % row.length];
  }
  return neighbors === 3 || (cell && neighbors === 2) ? 1 : 0;
}));

function AnimatedExperiment({ mode }: { mode: AnimatedMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, repel: false });
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const stepRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seed, setSeed] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    pausedRef.current = paused;
    speedRef.current = speed;
    stepRef.current = step;
  }, [paused, speed, step]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let width = 1;
    let height = 1;
    let raf = 0;
    let previous = performance.now();
    let time = 0;
    let grid: number[][] = [];
    let heat = new Float32Array(0);
    let lastStep = stepRef.current;
    let plasmaCanvas = document.createElement("canvas");
    let plasmaContext = plasmaCanvas.getContext("2d");
    const stars: Star[] = Array.from({ length: 220 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 0.9 + 0.1 }));
    const particles: Particle[] = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12, hue: Math.random() * 160 + 100 }));
    const trails: ({ x: number; y: number } | null)[] = [null, null, null];

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (mode === "life") grid = makeLife(Math.max(12, Math.ceil(width / 11)), Math.max(10, Math.ceil(height / 11)));
      if (mode === "fire") heat = new Float32Array(90 * 42);
      if (mode === "plasma") {
        plasmaCanvas.width = Math.max(80, Math.min(260, Math.round(width / 4)));
        plasmaCanvas.height = Math.max(60, Math.min(160, Math.round(height / 4)));
        plasmaContext = plasmaCanvas.getContext("2d");
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const editCell = (event: MouseEvent) => {
      if (mode !== "life" || !grid.length) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / rect.width * grid[0].length);
      const y = Math.floor((event.clientY - rect.top) / rect.height * grid.length);
      if (grid[y] && x >= 0 && x < grid[0].length) grid[y][x] = grid[y][x] ? 0 : 1;
    };
    canvas.addEventListener("click", editCell);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const baseFps = mode === "life" ? 9 : mode === "fire" ? 18 : mode === "plasma" ? 24 : 45;
      const fps = reducedMotion ? Math.min(8, baseFps) : baseFps;
      if (now - previous < 1000 / fps) return;
      const dt = Math.min(0.08, (now - previous) / 1000) * speedRef.current * (reducedMotion ? 0.35 : 1);
      previous = now;
      if (!pausedRef.current) time += dt;
      if (mode === "harmonograph") {
        context.fillStyle = "rgba(1,5,4,.08)";
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
        context.fillStyle = "#010504";
        context.fillRect(0, 0, width, height);
      }
      const pointer = pointerRef.current;

      if (mode === "starfield") {
        const centerX = width * (pointer.active ? 0.5 + (pointer.x - 0.5) * 0.16 : 0.5);
        const centerY = height * (pointer.active ? 0.5 + (pointer.y - 0.5) * 0.16 : 0.5);
        for (const star of stars) {
          const oldZ = star.z;
          if (!pausedRef.current) star.z -= dt * 0.34;
          if (star.z < 0.025) {
            star.x = Math.random() * 2 - 1;
            star.y = Math.random() * 2 - 1;
            star.z = 1;
            continue;
          }
          const x = centerX + star.x / star.z * width * 0.42;
          const y = centerY + star.y / star.z * height * 0.42;
          const oldX = centerX + star.x / oldZ * width * 0.42;
          const oldY = centerY + star.y / oldZ * height * 0.42;
          const alpha = Math.min(1, (1 - star.z) * 1.8 + 0.15);
          context.strokeStyle = `rgba(117,255,156,${alpha})`;
          context.lineWidth = Math.max(0.5, (1 - star.z) * 2.4);
          context.beginPath();
          context.moveTo(oldX, oldY);
          context.lineTo(x, y);
          context.stroke();
        }
      } else if (mode === "plasma" && plasmaContext) {
        const w = plasmaCanvas.width;
        const h = plasmaCanvas.height;
        const pixels = plasmaContext.createImageData(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const value = Math.sin(x * 0.075 + time) + Math.sin(y * 0.09 - time * 0.8) + Math.sin((x + y) * 0.035 + time * 0.55) + Math.sin(Math.hypot(x - w / 2, y - h / 2) * 0.12 - time);
          const index = (y * w + x) * 4;
          pixels.data[index] = 20 + (Math.sin(value * 1.7) + 1) * 45;
          pixels.data[index + 1] = 65 + (Math.sin(value + 2) + 1) * 85;
          pixels.data[index + 2] = 90 + (Math.cos(value * 1.3) + 1) * 80;
          pixels.data[index + 3] = 255;
        }
        plasmaContext.putImageData(pixels, 0, 0);
        context.imageSmoothingEnabled = true;
        context.drawImage(plasmaCanvas, 0, 0, width, height);
      } else if (mode === "life" && grid.length) {
        if (!pausedRef.current || lastStep !== stepRef.current) grid = lifeStep(grid);
        lastStep = stepRef.current;
        const rows = grid.length;
        const cols = grid[0].length;
        const cellW = width / cols;
        const cellH = height / rows;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y][x]) {
          context.fillStyle = (x + y) % 5 ? "#48d987" : "#8cf5ff";
          context.fillRect(x * cellW + 0.6, y * cellH + 0.6, Math.max(1, cellW - 1.2), Math.max(1, cellH - 1.2));
        }
      } else if (mode === "particles") {
        for (const particle of particles) {
          if (!pausedRef.current) {
            if (pointer.active) {
              const dx = pointer.x * width - particle.x * width;
              const dy = pointer.y * height - particle.y * height;
              const force = (pointer.repel ? -1 : 1) * 0.035 / Math.max(0.015, dx * dx + dy * dy);
              particle.vx += dx * force * dt;
              particle.vy += dy * force * dt;
            }
            particle.vx *= 0.992;
            particle.vy *= 0.992;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            if (particle.x < 0 || particle.x > 1) particle.vx *= -1;
            if (particle.y < 0 || particle.y > 1) particle.vy *= -1;
            particle.x = Math.max(0, Math.min(1, particle.x));
            particle.y = Math.max(0, Math.min(1, particle.y));
          }
          context.fillStyle = `hsl(${particle.hue} 90% 68%)`;
          context.beginPath();
          context.arc(particle.x * width, particle.y * height, 1.8, 0, Math.PI * 2);
          context.fill();
        }
      } else if (mode === "harmonograph") {
        context.fillStyle = "rgba(1,5,4,.09)";
        context.fillRect(0, 0, width, height);
        for (let curve = 0; curve < 3; curve++) {
          const x = width / 2 + Math.sin(time * (1.7 + curve * 0.13) + curve) * width * 0.38 * Math.cos(time * 0.11 + curve);
          const y = height / 2 + Math.sin(time * (2.3 + curve * 0.17) + curve * 1.7) * height * 0.38;
          const previousPoint = trails[curve];
          if (previousPoint) {
            context.strokeStyle = `hsla(${135 + curve * 55 + time * 8},90%,68%,.8)`;
            context.lineWidth = 1.4;
            context.beginPath();
            context.moveTo(previousPoint.x, previousPoint.y);
            context.lineTo(x, y);
            context.stroke();
          }
          trails[curve] = { x, y };
        }
      } else if (mode === "fire") {
        const cols = 90;
        const rows = 42;
        if (!pausedRef.current) {
          for (let x = 0; x < cols; x++) heat[(rows - 1) * cols + x] = Math.random() * Math.min(1, speedRef.current);
          for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols; x++) {
            const below = heat[(y + 1) * cols + x];
            const belowLeft = heat[(y + 1) * cols + ((x - 1 + cols) % cols)];
            const belowRight = heat[(y + 1) * cols + ((x + 1) % cols)];
            const twoBelow = heat[Math.min(rows - 1, y + 2) * cols + x];
            heat[y * cols + x] = Math.max(0, (below + belowLeft + belowRight + twoBelow) / 4 - Math.random() * 0.055);
          }
        }
        const chars = " .:-=+*#%@";
        const cellW = width / cols;
        const cellH = height / rows;
        context.font = `${Math.max(5, cellH * 1.05)}px monospace`;
        context.textBaseline = "top";
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const value = heat[y * cols + x];
          if (value < 0.06) continue;
          context.fillStyle = value > 0.72 ? "#fff3ad" : value > 0.42 ? "#ff9b42" : "#e54938";
          context.fillText(chars[Math.min(chars.length - 1, Math.floor(value * chars.length))], x * cellW, y * cellH);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("click", editCell);
    };
  }, [mode, reducedMotion, seed]);

  const updatePointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, active: true, repel: event.buttons > 0 };
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} className="min-h-0 flex-1">
        <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" onPointerMove={updatePointer} onPointerDown={updatePointer} onPointerUp={updatePointer} onPointerLeave={() => { pointerRef.current.active = false; }} aria-label={`${mode} interactive canvas`} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#75ff9c]/10 p-2 text-[9px]">
        <button type="button" onClick={() => setPaused((value) => !value)} className="flex items-center gap-1 rounded border border-[#75ff9c]/20 px-2 py-1 hover:bg-[#75ff9c]/10">{paused ? <Play className="size-3" /> : <Pause className="size-3" />}{paused ? "PLAY" : "PAUSE"}</button>
        {mode === "life" && <button type="button" onClick={() => setStep((value) => value + 1)} className="rounded border border-[#75ff9c]/20 px-2 py-1 hover:bg-[#75ff9c]/10">STEP</button>}
        <button type="button" onClick={() => { setSeed((value) => value + 1); setPaused(false); }} className="flex items-center gap-1 rounded border border-[#75ff9c]/20 px-2 py-1 hover:bg-[#75ff9c]/10"><Shuffle className="size-3" />RESEED</button>
        <label className="ml-auto flex items-center gap-2 text-[#75ff9c]/55">{mode === "fire" ? "INTENSITY" : "FLOW"}<input type="range" min="0.3" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-24 accent-emerald-400" /><span className="w-7">{speed.toFixed(1)}×</span></label>
      </div>
    </div>
  );
}

function FractalExperiment() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: -0.65, y: 0, scale: 2.7 });
  const [iterations, setIterations] = useState(90);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const draw = () => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const width = Math.min(720, Math.max(240, Math.round(rect.width)));
      const height = Math.max(160, Math.round(width * rect.height / rect.width));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      const image = context.createImageData(width, height);
      for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
        const cx = view.x + (px / width - 0.5) * view.scale * width / height;
        const cy = view.y + (py / height - 0.5) * view.scale;
        let x = 0;
        let y = 0;
        let iteration = 0;
        while (x * x + y * y <= 4 && iteration < iterations) {
          const nextX = x * x - y * y + cx;
          y = 2 * x * y + cy;
          x = nextX;
          iteration++;
        }
        const index = (py * width + px) * 4;
        if (iteration === iterations) {
          image.data[index + 3] = 255;
        } else {
          const ratio = iteration / iterations;
          image.data[index] = 25 + ratio * 80;
          image.data[index + 1] = 45 + Math.sin(ratio * Math.PI) * 210;
          image.data[index + 2] = 100 + ratio * 155;
          image.data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [view, iterations]);

  const zoom = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const aspect = rect.width / rect.height;
    setView((current) => ({
      x: current.x + (px - 0.5) * current.scale * aspect,
      y: current.y + (py - 0.5) * current.scale,
      scale: current.scale / 2,
    }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} className="min-h-0 flex-1"><canvas ref={canvasRef} className="h-full w-full cursor-zoom-in" onClick={zoom} aria-label="Interactive Mandelbrot fractal" /></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#75ff9c]/10 p-2 text-[9px]">
        <button type="button" onClick={() => setView({ x: -0.65, y: 0, scale: 2.7 })} className="flex items-center gap-1 rounded border border-[#75ff9c]/20 px-2 py-1 hover:bg-[#75ff9c]/10"><RotateCcw className="size-3" />RESET</button>
        <button type="button" onClick={() => setView((current) => ({ ...current, scale: Math.min(8, current.scale * 2) }))} className="rounded border border-[#75ff9c]/20 px-2 py-1 hover:bg-[#75ff9c]/10">ZOOM OUT</button>
        <span className="text-[#75ff9c]/40">ZOOM {(2.7 / view.scale).toFixed(1)}×</span>
        <label className="ml-auto flex items-center gap-2 text-[#75ff9c]/55">DETAIL<input type="range" min="40" max="180" step="10" value={iterations} onChange={(event) => setIterations(Number(event.target.value))} className="w-24 accent-emerald-400" />{iterations}</label>
      </div>
    </div>
  );
}

type MazeData = { grid: number[][]; cols: number; rows: number };
const generateMaze = (cols = 31, rows = 21): MazeData => {
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 1));
  const stack = [{ x: 1, y: 1 }];
  grid[1][1] = 0;
  while (stack.length) {
    const current = stack[stack.length - 1];
    const directions = [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => Math.random() - 0.5);
    const next = directions.map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy, dx, dy })).find(({ x, y }) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1 && grid[y][x] === 1);
    if (!next) {
      stack.pop();
      continue;
    }
    grid[current.y + next.dy / 2][current.x + next.dx / 2] = 0;
    grid[next.y][next.x] = 0;
    stack.push({ x: next.x, y: next.y });
  }
  return { grid, cols, rows };
};

function MazeExperiment() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [maze, setMaze] = useState<MazeData>(() => generateMaze());
  const [player, setPlayer] = useState({ x: 1, y: 1 });
  const playerRef = useRef(player);
  const [moves, setMoves] = useState(0);
  const won = player.x === maze.cols - 2 && player.y === maze.rows - 2;

  const move = useCallback((dx: number, dy: number) => {
    const current = playerRef.current;
    const x = current.x + dx;
    const y = current.y + dy;
    if (won || !maze.grid[y] || maze.grid[y][x] !== 0) return;
    const next = { x, y };
    playerRef.current = next;
    setPlayer(next);
    setMoves((value) => value + 1);
  }, [maze, won]);

  useEffect(() => {
    const keys: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
    const listener = (event: KeyboardEvent) => {
      const direction = keys[event.key];
      if (!direction) return;
      event.preventDefault();
      move(...direction);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [move]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const draw = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = "#010504";
      context.fillRect(0, 0, rect.width, rect.height);
      const cell = Math.min(rect.width / maze.cols, rect.height / maze.rows);
      const offsetX = (rect.width - cell * maze.cols) / 2;
      const offsetY = (rect.height - cell * maze.rows) / 2;
      for (let y = 0; y < maze.rows; y++) for (let x = 0; x < maze.cols; x++) if (maze.grid[y][x]) {
        context.fillStyle = "#17382a";
        context.fillRect(offsetX + x * cell, offsetY + y * cell, cell + 0.4, cell + 0.4);
      }
      context.fillStyle = "#67e8f9";
      context.fillRect(offsetX + (maze.cols - 2) * cell + cell * 0.2, offsetY + (maze.rows - 2) * cell + cell * 0.2, cell * 0.6, cell * 0.6);
      context.fillStyle = won ? "#fef08a" : "#75ff9c";
      context.beginPath();
      context.arc(offsetX + (player.x + 0.5) * cell, offsetY + (player.y + 0.5) * cell, cell * 0.34, 0, Math.PI * 2);
      context.fill();
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [maze, player, won]);

  const restart = () => {
    playerRef.current = { x: 1, y: 1 };
    setMaze(generateMaze());
    setPlayer({ x: 1, y: 1 });
    setMoves(0);
  };
  const control = "grid size-9 place-items-center rounded border border-[#75ff9c]/25 hover:bg-[#75ff9c]/10";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="h-full w-full" aria-label="Playable generated maze" />
        {won && <div className="absolute inset-x-0 top-3 mx-auto w-fit rounded border border-yellow-300/40 bg-black/85 px-4 py-2 text-xs text-yellow-200">EXIT REACHED · {moves} MOVES</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-[#75ff9c]/10 p-2">
        <button type="button" onClick={restart} className="flex items-center gap-1 rounded border border-[#75ff9c]/20 px-2 py-1 text-[9px] hover:bg-[#75ff9c]/10"><Shuffle className="size-3" />NEW MAZE</button>
        <span className="text-[9px] text-[#75ff9c]/45">MOVES {moves}</span>
        <div className="ml-auto grid grid-cols-3 gap-1">
          <span /><button type="button" className={control} onClick={() => move(0, -1)} aria-label="Move up"><ArrowUp className="size-4" /></button><span />
          <button type="button" className={control} onClick={() => move(-1, 0)} aria-label="Move left"><ArrowLeft className="size-4" /></button>
          <button type="button" className={control} onClick={() => move(0, 1)} aria-label="Move down"><ArrowDown className="size-4" /></button>
          <button type="button" className={control} onClick={() => move(1, 0)} aria-label="Move right"><ArrowRight className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

const SYNTH_NOTES = [130.81, 196, 261.63, 523.25];
const INITIAL_PATTERN = [
  [true, false, true, false, true, false, true, false],
  [false, false, true, false, false, false, true, false],
  [true, false, false, true, false, true, false, false],
  [false, true, false, false, false, true, false, true],
];

function SynthExperiment() {
  const audioRef = useRef<AudioContext | null>(null);
  const patternRef = useRef(INITIAL_PATTERN);
  const [pattern, setPattern] = useState(INITIAL_PATTERN);
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    if (!playing) return;
    const trigger = (row: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = row === 0 ? "sine" : row === 3 ? "square" : "triangle";
      oscillator.frequency.value = SYNTH_NOTES[row];
      const now = audio.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(row === 0 ? 0.2 : 0.075, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (row === 0 ? 0.24 : 0.13));
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.26);
    };
    const timer = window.setInterval(() => setStep((current) => {
      const next = (current + 1) % 8;
      patternRef.current.forEach((row, index) => { if (row[next]) trigger(index); });
      return next;
    }), 30000 / tempo);
    return () => window.clearInterval(timer);
  }, [playing, tempo]);

  useEffect(() => () => {
    if (audioRef.current) void audioRef.current.close();
  }, []);

  const togglePlayback = async () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (!audioRef.current) audioRef.current = new AudioContext();
    await audioRef.current.resume();
    setStep(-1);
    setPlaying(true);
  };
  const randomize = () => setPattern(Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => Math.random() > 0.68)));

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-5 overflow-y-auto p-4" data-lenis-prevent>
      <div className="grid grid-cols-8 gap-2" aria-label="Eight step synthesizer sequencer">
        {pattern.map((row, rowIndex) => row.map((enabled, column) => (
          <button key={`${rowIndex}-${column}`} type="button" aria-label={`${enabled ? "Disable" : "Enable"} note ${rowIndex + 1} step ${column + 1}`} aria-pressed={enabled} onClick={() => setPattern((current) => current.map((line, y) => y === rowIndex ? line.map((value, x) => x === column ? !value : value) : line))} className={`size-8 rounded border transition sm:size-11 ${step === column ? "ring-2 ring-cyan-300" : ""} ${enabled ? "border-emerald-300/60 bg-emerald-400/35 shadow-[0_0_16px_rgba(52,211,153,.18)]" : "border-[#75ff9c]/15 bg-[#75ff9c]/5"}`} style={{ marginTop: rowIndex * 2 }} />
        )))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-[9px]">
        <button type="button" onClick={() => void togglePlayback()} className="flex items-center gap-1 rounded border border-[#75ff9c]/25 px-3 py-2 hover:bg-[#75ff9c]/10">{playing ? <Pause className="size-3" /> : <Play className="size-3" />}{playing ? "STOP" : "PLAY"}</button>
        <button type="button" onClick={randomize} className="flex items-center gap-1 rounded border border-[#75ff9c]/25 px-3 py-2 hover:bg-[#75ff9c]/10"><Shuffle className="size-3" />RANDOM</button>
        <button type="button" onClick={() => { setPattern(Array.from({ length: 4 }, () => Array(8).fill(false))); setPlaying(false); }} className="rounded border border-[#75ff9c]/25 px-3 py-2 hover:bg-[#75ff9c]/10">CLEAR</button>
        <label className="flex items-center gap-2 text-[#75ff9c]/55">TEMPO<input type="range" min="70" max="180" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} className="w-28 accent-emerald-400" />{tempo} BPM</label>
      </div>
    </div>
  );
}

const TYPING_PHRASES = [
  "Three worlds orbit one signature: graphics, security, and artificial intelligence.",
  "Resilient infrastructure begins with a small port, a clean log, and a curious mind.",
  "A creative terminal can turn pixels, particles, and ideas into a playable universe.",
  "The best systems feel like magic while every detail remains carefully engineered.",
  "Build something beautiful, keep it secure, and leave one golden egg behind.",
];

function TypingExperiment() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const phrase = TYPING_PHRASES[phraseIndex];

  useEffect(() => {
    if (!startedAt || finishedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [startedAt, finishedAt]);

  const correct = [...input].filter((character, index) => character === phrase[index]).length;
  const elapsed = Math.max(0.001, ((finishedAt ?? now) - (startedAt ?? now)) / 60000);
  const wpm = startedAt ? Math.round(correct / 5 / elapsed) : 0;
  const accuracy = input.length ? Math.round(correct / input.length * 100) : 100;
  const restart = () => {
    setPhraseIndex((current) => (current + 1 + Math.floor(Math.random() * (TYPING_PHRASES.length - 1))) % TYPING_PHRASES.length);
    setInput("");
    setStartedAt(null);
    setFinishedAt(null);
    setNow(Date.now());
  };

  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-5 overflow-y-auto p-5" data-lenis-prevent>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-[#75ff9c]/15 p-3"><div className="text-2xl text-[#b9ffca]">{wpm}</div><div className="text-[8px] text-[#75ff9c]/40">WPM</div></div>
        <div className="rounded border border-[#75ff9c]/15 p-3"><div className="text-2xl text-[#b9ffca]">{accuracy}%</div><div className="text-[8px] text-[#75ff9c]/40">ACCURACY</div></div>
        <div className="rounded border border-[#75ff9c]/15 p-3"><div className="text-2xl text-[#b9ffca]">{input.length}/{phrase.length}</div><div className="text-[8px] text-[#75ff9c]/40">CHARACTERS</div></div>
      </div>
      <p className="text-sm leading-7 tracking-wide">
        {[...phrase].map((character, index) => <span key={index} className={index >= input.length ? "text-[#75ff9c]/40" : input[index] === character ? "text-emerald-300" : "bg-red-400/20 text-red-300"}>{character}</span>)}
      </p>
      <textarea value={input} disabled={Boolean(finishedAt)} onChange={(event) => {
        const value = event.target.value.slice(0, phrase.length);
        if (!startedAt && value) setStartedAt(Date.now());
        setNow(Date.now());
        setInput(value);
        if (value.length === phrase.length) setFinishedAt(Date.now());
      }} className="min-h-20 resize-none rounded border border-[#75ff9c]/25 bg-black/70 p-3 text-sm text-[#b9ffca] outline-none focus:border-[#75ff9c]/60" placeholder="Start typing here…" aria-label="Typing test input" />
      <div className="flex items-center justify-between gap-3 text-[9px] text-[#75ff9c]/45">
        <span>{finishedAt ? `COMPLETE · ${wpm} WPM · ${accuracy}% ACCURACY` : startedAt ? "TEST IN PROGRESS" : "TIMER STARTS WITH YOUR FIRST KEY"}</span>
        <button type="button" onClick={restart} className="flex items-center gap-1 rounded border border-[#75ff9c]/25 px-3 py-2 text-[#75ff9c] hover:bg-[#75ff9c]/10"><RotateCcw className="size-3" />NEW TEXT</button>
      </div>
    </div>
  );
}
