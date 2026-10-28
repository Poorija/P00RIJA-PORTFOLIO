"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play, Shuffle, Sparkles } from "lucide-react";

type Star = { x: number; y: number; phase: number; char: string };
type Camper = { angle: number; jacket: string; phase: number };
type Spark = { phase: number; drift: number; char: string };
type Burst = { x: number; y: number; born: number };

const CONTROL = "flex items-center gap-1 rounded border border-[#75ff9c]/20 px-2 py-1 text-[9px] hover:bg-[#75ff9c]/10";
const TREE = ["   ^", "  /^\\", " /___\\", "/_____\\", "   |"];
const TENT = ["    /\\", "   /  \\", "  /    \\", " /      \\", "/________\\"];

export function CampfireExperiment() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const timeRef = useRef(0);
  const shotRef = useRef(-20);
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    pausedRef.current = paused;
    speedRef.current = speed;
  }, [paused, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let raf = 0;
    let cols = 0;
    let rows = 0;
    let cellW = 7;
    let cellH = 12;
    let previous = performance.now();
    const stars: Star[] = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random() * 0.52, phase: Math.random() * Math.PI * 2, char: Math.random() > 0.8 ? "+" : "." }));
    const campers: Camper[] = ["#d56868", "#5c9ed6", "#d6a65c", "#8b6fd0", "#5ab48b", "#cf7ca8"].map((jacket, index) => ({ angle: Math.PI * 0.08 + index * Math.PI * 0.84 / 5, jacket, phase: index * 0.9 }));
    const sparks: Spark[] = Array.from({ length: 34 }, () => ({ phase: Math.random(), drift: Math.random() * 2 - 1, char: Math.random() > 0.7 ? "*" : "." }));
    const fireflies = Array.from({ length: 20 }, () => ({ x: Math.random(), y: 0.45 + Math.random() * 0.35, phase: Math.random() * Math.PI * 2 }));
    const bursts: Burst[] = [];
    const trees = Array.from({ length: 34 }, (_, index) => ({ x: index / 33 + (Math.random() - 0.5) * 0.04, layer: index % 3, phase: Math.random() * 3 }));

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const fontSize = Math.max(8, Math.min(13, rect.width / 120));
      cellW = fontSize * 0.62;
      cellH = fontSize * 1.1;
      cols = Math.max(72, Math.floor(rect.width / cellW));
      rows = Math.max(30, Math.floor(rect.height / cellH));
      canvas.width = Math.round(cols * cellW);
      canvas.height = Math.round(rows * cellH);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      context.font = `${fontSize}px "JetBrains Mono", monospace`;
      context.textBaseline = "top";
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const ignite = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      bursts.push({ x: (event.clientX - rect.left) / rect.width * cols, y: (event.clientY - rect.top) / rect.height * rows, born: timeRef.current });
      if (bursts.length > 8) bursts.shift();
    };
    canvas.addEventListener("click", ignite);

    const put = (text: string, x: number, y: number, color: string) => {
      const row = Math.floor(y);
      if (row < 0 || row >= rows) return;
      for (let index = 0; index < text.length; index++) {
        const column = Math.floor(x) + index;
        if (column < 0 || column >= cols || text[index] === " ") continue;
        context.fillStyle = color;
        context.fillText(text[index], column * cellW, row * cellH);
      }
    };
    const putTree = (x: number, y: number, color: string) => TREE.forEach((line, index) => put(line, x, y + index, color));
    const putCamper = (x: number, y: number, jacket: string, phase: number) => {
      const sway = Math.sin(timeRef.current * 1.2 + phase) > 0.5 ? 1 : 0;
      put(" o", x, y - 4 + sway, "#d69b76");
      put("/|\\", x - 1, y - 3 + sway, jacket);
      put(" |", x, y - 2 + sway, jacket);
      put("/ \\", x - 1, y - 1 + sway, "#27313c");
      put("_/  \\_", x - 2, y, "#1a222c");
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const fps = reducedMotion ? 6 : 12;
      if (now - previous < 1000 / fps) return;
      const dt = Math.min(0.2, (now - previous) / 1000) * speedRef.current * (reducedMotion ? 0.4 : 1);
      previous = now;
      if (!pausedRef.current) timeRef.current += dt;
      const time = timeRef.current;
      context.fillStyle = "#020817";
      context.fillRect(0, 0, canvas.width, canvas.height);

      for (const star of stars) {
        const pulse = Math.sin(time * 1.8 + star.phase);
        put(pulse > 0.72 && star.char === "+" ? "*" : star.char, star.x * cols, star.y * rows, pulse > 0.2 ? "#d9ecff" : "#50647f");
      }
      const shotCycle = (time - shotRef.current) % 11;
      if (shotCycle > 0 && shotCycle < 1.6) {
        const progress = shotCycle / 1.6;
        const x = cols * (0.08 + progress * 0.76);
        const y = rows * (0.08 + progress * 0.18);
        put("*", x, y, "#ffffff");
        put("------", x - 6, y - 1, "#8ad8ef");
        put("--", x - 8, y - 2, "#36586e");
      }

      for (const tree of trees) {
        const baseY = rows * (0.47 + tree.layer * 0.07);
        const color = tree.layer === 0 ? "#0a2027" : tree.layer === 1 ? "#0d2d29" : "#11402e";
        putTree(tree.x * cols, baseY + Math.sin(time * 0.2 + tree.phase), color);
      }
      for (let x = 0; x < cols; x += 3) put(x % 2 ? "." : "'", x, rows * 0.72 + Math.sin(x * 1.7) * 1.4, "#193d2b");
      put("................................................................", cols / 2 - 32, rows * 0.82, "#25452c");
      TENT.forEach((line, index) => put(line, cols * 0.79, rows * 0.59 + index, index === 4 ? "#725039" : "#4c3c3c"));

      for (const fly of fireflies) {
        const visible = Math.sin(time * 2 + fly.phase) > 0.1;
        if (visible) put("*", fly.x * cols + Math.sin(time + fly.phase) * 2, fly.y * rows + Math.cos(time * 0.7 + fly.phase), "#b8ed6b");
      }

      const fireX = Math.floor(cols / 2);
      const fireY = Math.floor(rows * 0.73);
      const spread = Math.min(24, Math.floor(cols * 0.23));
      for (const camper of campers) {
        const x = fireX + Math.cos(camper.angle) * spread;
        const y = fireY + Math.sin(camper.angle) * 4 + 2;
        putCamper(Math.round(x), Math.round(y), camper.jacket, camper.phase);
      }

      for (let ring = 8; ring > 2; ring--) {
        const char = ring % 2 ? "." : ":";
        for (let x = fireX - ring * 2; x <= fireX + ring * 2; x += 3) put(char, x, fireY + ring / 2, ring > 5 ? "#503627" : "#754128");
      }
      put("\\____/", fireX - 4, fireY + 2, "#6a3a21");
      put("/____\\", fireX - 4, fireY + 3, "#4c2a1c");
      const flameRows = 9;
      for (let y = 0; y < flameRows; y++) {
        const level = flameRows - y;
        const sway = Math.round(Math.sin(time * 5 + y * 0.8) * (y % 3));
        const width = Math.max(1, Math.floor(level * 0.68 + Math.sin(time * 4 + y) * 1.2));
        for (let x = -width; x <= width; x++) {
          if (Math.random() > 0.93 && y < 5) continue;
          const char = y > 6 ? "^" : y > 3 ? "*" : y > 1 ? "(" : ")";
          const color = y > 6 ? "#f36b2c" : y > 3 ? "#ffad32" : "#fff2a1";
          put(char, fireX + x + sway, fireY + 1 - y, color);
        }
      }
      for (const spark of sparks) {
        const progress = (time * 0.25 + spark.phase) % 1;
        put(spark.char, fireX + spark.drift * progress * 12 + Math.sin(time * 3 + spark.phase) * 2, fireY - progress * 16, progress > 0.65 ? "#8b4b2a" : "#ffc75c");
      }
      for (let index = bursts.length - 1; index >= 0; index--) {
        const burst = bursts[index];
        const progress = (time - burst.born) / 1.2;
        if (progress > 1) { bursts.splice(index, 1); continue; }
        for (let particle = 0; particle < 12; particle++) {
          const angle = particle / 12 * Math.PI * 2;
          put(particle % 3 ? "." : "*", burst.x + Math.cos(angle) * progress * 8, burst.y + Math.sin(angle) * progress * 5, "#ffd875");
        }
      }
      put("CAMP // NIGHT SIGNAL", 2, 1, "#315b49");
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("click", ignite);
    };
  }, [reducedMotion, seed]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} className="min-h-0 flex-1"><canvas ref={canvasRef} className="h-full w-full cursor-pointer" aria-label="Animated ASCII forest campsite with six campers, fire, tent, stars, and shooting stars" /></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#75ff9c]/10 p-2">
        <button type="button" onClick={() => setPaused((value) => !value)} className={CONTROL}>{paused ? <Play className="size-3" /> : <Pause className="size-3" />}{paused ? "PLAY" : "PAUSE"}</button>
        <button type="button" onClick={() => { shotRef.current = timeRef.current; }} className={CONTROL}><Sparkles className="size-3" />SHOOTING STAR</button>
        <button type="button" onClick={() => setSeed((value) => value + 1)} className={CONTROL}><Shuffle className="size-3" />NEW FOREST</button>
        <span className="text-[8px] text-[#75ff9c]/35">CLICK FOR SPARKS</span>
        <label className="ml-auto flex items-center gap-2 text-[9px] text-[#75ff9c]/55">FIRE<input type="range" min="0.3" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-24 accent-orange-400" />{speed.toFixed(1)}×</label>
      </div>
    </div>
  );
}
