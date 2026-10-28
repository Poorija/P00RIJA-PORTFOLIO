"use client";

/*
 * Asciiquarium browser adaptation, modified 2026-10-28.
 * Original: Kirk Baucom, 2003. Art: Joan Stark and Claudio Matsuoka.
 * Copyright (C) 2003 Kirk Baucom. GPL-2.0-or-later.
 * Source: https://github.com/cmatsuoka/asciiquarium
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play, Shuffle } from "lucide-react";
import { BIG_FISH, CASTLE, FISH, MONSTER, SHARK, SHIP, WHALE, type Art } from "./asciiquarium-art";

type Entity = { kind: "fish" | "special" | "bubble" | "splat"; art: Art; x: number; y: number; z: number; speed: number; age: number; direction: number };
type Seaweed = { x: number; height: number; phase: number };

const COLORS: Record<string, string> = {
  c: "#36c9e8", C: "#8cecff", r: "#d64b55", R: "#ff8b92", y: "#d5a84d", Y: "#ffe28a",
  b: "#477dc6", B: "#8fb7ff", g: "#38a169", G: "#7ee2a0", m: "#b467c7", M: "#efa8ff", W: "#f4f7f2",
};
const BUBBLE: Art = { shape: ["o"], color: "C" };
const SPLAT: Art = { shape: ["***"], color: "R" };
const randomColor = () => {
  const keys = ["c", "C", "r", "R", "y", "Y", "b", "B", "g", "G", "m", "M"];
  return keys[Math.floor(Math.random() * keys.length)];
};
const colorMask = (mask?: string[]) => {
  const slots: Record<string, string> = {};
  for (let index = 1; index <= 9; index++) slots[String(index)] = randomColor();
  slots["4"] = "W";
  return mask?.map((row) => [...row].map((char) => slots[char] ?? char).join(""));
};

export function AquariumExperiment() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
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
    let entities: Entity[] = [];
    let special: Entity | null = null;
    let seaweed: Seaweed[] = [];
    let time = 0;
    let previous = performance.now();

    const spawnFish = () => {
      const pair = FISH[Math.floor(Math.random() * FISH.length)];
      const direction = Math.random() > 0.5 ? 1 : -1;
      const source = direction > 0 ? pair[0] : pair[1];
      const sprite = { ...source, mask: colorMask(source.mask) };
      const height = sprite.shape.length;
      entities.push({ kind: "fish", art: sprite, x: direction > 0 ? -sprite.shape[0].length : cols - 2, y: 9 + Math.random() * Math.max(1, rows - height - 11), z: 3 + Math.floor(Math.random() * 18), speed: direction * (0.25 + Math.random() * 2), age: 0, direction });
    };
    const spawnSpecial = () => {
      const type = Math.floor(Math.random() * 5);
      const direction = Math.random() > 0.5 ? 1 : -1;
      const source = type === 0 ? SHIP : type === 1 ? WHALE : type === 2 ? BIG_FISH : type === 3 ? SHARK : MONSTER;
      const sprite = source[direction > 0 ? 0 : 1];
      const surface = type < 2;
      special = { kind: "special", art: sprite, x: direction > 0 ? -sprite.shape[0].length - 2 : cols - 2, y: surface ? (type === 0 ? 0 : 2) : 9 + Math.random() * Math.max(1, rows - sprite.shape.length - 11), z: type === 3 ? 2 : surface ? 4 : 3, speed: direction * (type === 3 ? 2 : type === 2 ? 2.5 : 1), age: 0, direction };
    };
    const rebuild = () => {
      const rect = host.getBoundingClientRect();
      const fontSize = Math.max(7, Math.min(12, rect.width / 125));
      cellW = fontSize * 0.62;
      cellH = fontSize * 1.12;
      cols = Math.max(70, Math.floor(rect.width / cellW));
      rows = Math.max(28, Math.floor(rect.height / cellH));
      canvas.width = Math.round(cols * cellW);
      canvas.height = Math.round(rows * cellH);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      context.font = `${fontSize}px "JetBrains Mono", monospace`;
      context.textBaseline = "top";
      entities = [];
      special = null;
      const count = Math.min(55, Math.max(5, Math.floor(cols * (rows - 9) / 350)));
      for (let index = 0; index < count; index++) spawnFish();
      spawnSpecial();
      seaweed = Array.from({ length: Math.max(3, Math.floor(cols / 15)) }, () => ({ x: 1 + Math.random() * (cols - 3), height: 3 + Math.floor(Math.random() * 4), phase: Math.random() * 4 }));
    };
    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(host);
    const burst = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * cols;
      const y = (event.clientY - rect.top) / rect.height * rows;
      for (let index = 0; index < 7; index++) entities.push({ kind: "bubble", art: BUBBLE, x: x + (Math.random() - 0.5) * 5, y, z: 1, speed: 0, age: Math.random(), direction: 0 });
    };
    canvas.addEventListener("click", burst);

    const drawCell = (char: string, x: number, y: number, color: string) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows || char === " " || char === "?") return;
      context.fillStyle = COLORS[color] ?? color;
      context.fillText(char, Math.floor(x * cellW), Math.floor(y * cellH));
    };
    const drawEntity = (entity: Entity) => {
      for (let y = 0; y < entity.art.shape.length; y++) {
        const row = entity.art.shape[y];
        for (let x = 0; x < row.length; x++) {
          const char = row[x];
          const maskChar = entity.art.mask?.[y]?.[x];
          drawCell(char, Math.floor(entity.x) + x, Math.floor(entity.y) + y, maskChar && COLORS[maskChar] ? maskChar : entity.art.color);
        }
      }
      if (entity.kind === "special" && entity.art === WHALE[entity.direction > 0 ? 0 : 1] && entity.age % 6 > 3) {
        const spout = entity.age % 6 > 4.5 ? [".-:-.", "'  :  '"] : ["  :", "  :"];
        const align = entity.direction > 0 ? 11 : 1;
        spout.forEach((line, index) => [...line].forEach((char, x) => drawCell(char, Math.floor(entity.x) + align + x, Math.floor(entity.y) - 2 + index, "C")));
      }
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const fps = reducedMotion ? 5 : 10;
      if (now - previous < 1000 / fps) return;
      const dt = Math.min(0.2, (now - previous) / 1000) * speedRef.current * (reducedMotion ? 0.4 : 1);
      previous = now;
      if (!pausedRef.current) time += dt;
      context.fillStyle = "#020b16";
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawEntity({ kind: "special", art: CASTLE, x: cols - 33, y: rows - 13, z: 22, speed: 0, age: 0, direction: 1 });
      for (const plant of seaweed) for (let y = 0; y < plant.height; y++) {
        const sway = Math.round(Math.sin(time * 1.5 + plant.phase + y * 0.4));
        drawCell((y + Math.round(time * 0.5)) % 2 ? "(" : ")", plant.x + sway, rows - plant.height + y, "G");
      }
      const sorted = [...entities, ...(special ? [special] : [])].sort((a, b) => b.z - a.z);
      sorted.forEach(drawEntity);
      for (let line = 0; line < 4; line++) {
        const pattern = line === 0 ? "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~" : line === 1 ? "^^^^ ^^^  ^^^   ^^^    ^^^^      " : line === 2 ? "^^^^      ^^^^     ^^^    ^^     " : "^^      ^^^^      ^^^    ^^^^^^  ";
        for (let x = 0; x < cols; x++) drawCell(pattern[x % pattern.length], x, 5 + line, "c");
      }
      if (!pausedRef.current) {
        for (const entity of entities) {
          entity.age += dt;
          if (entity.kind === "bubble") {
            entity.y -= dt * 10;
            if (Math.random() > 0.92) entity.x += Math.random() > 0.5 ? 1 : -1;
          } else if (entity.kind === "splat") {
            entity.y -= dt * 2;
          } else {
            entity.x += entity.speed * dt * 10;
            if (Math.random() > 0.97) {
              const width = entity.art.shape[0].length;
              entities.push({ kind: "bubble", art: BUBBLE, x: entity.x + (entity.direction > 0 ? width : 0), y: entity.y + Math.floor(entity.art.shape.length / 2), z: entity.z - 1, speed: 0, age: 0, direction: 0 });
            }
          }
        }
        if (special) {
          special.age += dt;
          special.x += special.speed * dt * 10;
          const width = special.art.shape[0].length;
          if ((special.speed > 0 && special.x > cols + 3) || (special.speed < 0 && special.x < -width - 3)) spawnSpecial();
          if (special.art === SHARK[special.direction > 0 ? 0 : 1]) {
            for (const fish of entities) {
              if (fish.kind === "fish" && fish.art.shape.length <= 5 && Math.abs(fish.x - special.x) < 8 && Math.abs(fish.y - special.y) < 5) {
                fish.kind = "splat";
                fish.art = SPLAT;
                fish.age = 0;
              }
            }
          }
        }
        entities = entities.filter((entity) => {
          if (entity.kind === "bubble" && entity.y > 4) return true;
          if (entity.kind === "splat" && entity.age < 1.5) return true;
          if (entity.kind === "fish") {
            const width = entity.art.shape[0].length;
            if (entity.x > cols + 3 || entity.x < -width - 3) {
              spawnFish();
              return false;
            }
            return true;
          }
          return false;
        });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("click", burst);
    };
  }, [reducedMotion, seed]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} className="min-h-0 flex-1"><canvas ref={canvasRef} className="h-full w-full cursor-pointer" aria-label="Original ASCIIquarium with classic ASCII fish, whale, shark, ship, sea monster, castle, and bubbles" /></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#75ff9c]/10 p-2 text-[9px]">
        <button type="button" onClick={() => setPaused((value) => !value)} className="flex items-center gap-1 rounded border border-[#75ff9c]/20 px-2 py-1 hover:bg-[#75ff9c]/10">{paused ? <Play className="size-3" /> : <Pause className="size-3" />}{paused ? "PLAY" : "PAUSE"}</button>
        <button type="button" onClick={() => setSeed((value) => value + 1)} className="flex items-center gap-1 rounded border border-[#75ff9c]/20 px-2 py-1 hover:bg-[#75ff9c]/10"><Shuffle className="size-3" />REBUILD TANK</button>
        <a href="/assets/asciiquarium-LICENSE.txt" target="_blank" rel="noreferrer" className="text-[#75ff9c]/40 underline hover:text-[#75ff9c]">ORIGINAL ART · GPL-2.0+</a>
        <label className="ml-auto flex items-center gap-2 text-[#75ff9c]/55">FLOW<input type="range" min="0.3" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-24 accent-cyan-400" />{speed.toFixed(1)}×</label>
      </div>
    </div>
  );
}
