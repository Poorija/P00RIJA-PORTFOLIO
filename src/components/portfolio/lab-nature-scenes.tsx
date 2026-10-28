"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play, Shuffle, Sparkles } from "lucide-react";

type Fish = { x: number; y: number; speed: number; size: number; color: string; direction: number; phase: number };
type Bubble = { x: number; y: number; radius: number; speed: number; drift: number };
type SkyStar = { x: number; y: number; radius: number; phase: number };
type Camper = { angle: number; color: string; phase: number };

const CONTROL = "flex items-center gap-1 rounded border border-[#75ff9c]/20 px-2 py-1 text-[9px] hover:bg-[#75ff9c]/10";

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
    let width = 1;
    let height = 1;
    let raf = 0;
    let previous = performance.now();
    let time = 0;
    const colors = ["#ffcf5c", "#ff7b8a", "#73e0ff", "#a5ff8a", "#d6a5ff"];
    const fish: Fish[] = Array.from({ length: 14 }, (_, index) => ({
      x: Math.random(), y: 0.16 + Math.random() * 0.62, speed: 0.025 + Math.random() * 0.055,
      size: 0.65 + Math.random() * 0.85, color: colors[index % colors.length], direction: index % 2 ? 1 : -1, phase: Math.random() * Math.PI * 2,
    }));
    const bubbles: Bubble[] = Array.from({ length: 38 }, () => ({ x: Math.random(), y: Math.random(), radius: 1 + Math.random() * 3, speed: 0.025 + Math.random() * 0.06, drift: Math.random() * 2 - 1 }));
    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const addBubbles = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      for (let index = 0; index < 9; index++) bubbles.push({ x: x + (Math.random() - 0.5) * 0.035, y, radius: 1 + Math.random() * 3.5, speed: 0.05 + Math.random() * 0.08, drift: Math.random() * 2 - 1 });
      if (bubbles.length > 90) bubbles.splice(0, bubbles.length - 90);
    };
    canvas.addEventListener("click", addBubbles);

    const drawFish = (item: Fish) => {
      const x = item.x * width;
      const y = item.y * height + Math.sin(time * 2 + item.phase) * 4;
      const size = Math.min(width, height) * 0.035 * item.size;
      context.save();
      context.translate(x, y);
      context.scale(item.direction, 1);
      context.fillStyle = item.color;
      context.beginPath();
      context.ellipse(0, 0, size * 1.35, size * 0.72, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(-size * 1.1, 0);
      context.lineTo(-size * 2, -size * 0.75);
      context.lineTo(-size * 2, size * 0.75);
      context.closePath();
      context.fill();
      context.fillStyle = "#efffff";
      context.beginPath();
      context.arc(size * 0.7, -size * 0.2, size * 0.16, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#06151d";
      context.beginPath();
      context.arc(size * 0.75, -size * 0.2, size * 0.075, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const fps = reducedMotion ? 12 : 30;
      if (now - previous < 1000 / fps) return;
      const dt = Math.min(0.08, (now - previous) / 1000) * speedRef.current * (reducedMotion ? 0.35 : 1);
      previous = now;
      if (!pausedRef.current) time += dt;
      const water = context.createLinearGradient(0, 0, 0, height);
      water.addColorStop(0, "#062c42");
      water.addColorStop(0.55, "#031d32");
      water.addColorStop(1, "#020d1c");
      context.fillStyle = water;
      context.fillRect(0, 0, width, height);
      context.fillStyle = "rgba(95,220,255,.035)";
      for (let ray = 0; ray < 6; ray++) {
        const x = width * (ray / 6) + Math.sin(time * 0.15 + ray) * 25;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + width * 0.12, height);
        context.lineTo(x + width * 0.2, height);
        context.closePath();
        context.fill();
      }
      for (let index = 0; index < 14; index++) {
        const x = (index + 0.5) / 14 * width;
        context.strokeStyle = index % 2 ? "#0c694e" : "#10825b";
        context.lineWidth = 3 + index % 3;
        context.beginPath();
        context.moveTo(x, height);
        context.quadraticCurveTo(x + Math.sin(time + index) * 22, height * 0.86, x + Math.sin(time * 0.7 + index) * 16, height * (0.68 + (index % 4) * 0.035));
        context.stroke();
      }
      for (const item of fish) {
        if (!pausedRef.current) {
          item.x += item.speed * item.direction * dt;
          if (item.direction > 0 && item.x > 1.12) item.x = -0.12;
          if (item.direction < 0 && item.x < -0.12) item.x = 1.12;
        }
        drawFish(item);
      }
      context.strokeStyle = "rgba(190,245,255,.6)";
      for (const bubble of bubbles) {
        if (!pausedRef.current) {
          bubble.y -= bubble.speed * dt;
          bubble.x += Math.sin(time * 2 + bubble.drift) * 0.002 * dt;
          if (bubble.y < -0.03) { bubble.y = 1.03; bubble.x = Math.random(); }
        }
        context.lineWidth = 1;
        context.beginPath();
        context.arc(bubble.x * width, bubble.y * height, bubble.radius, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = "#092b28";
      context.fillRect(0, height * 0.96, width, height * 0.04);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("click", addBubbles);
    };
  }, [reducedMotion, seed]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} className="min-h-0 flex-1"><canvas ref={canvasRef} className="h-full w-full cursor-pointer" aria-label="Interactive ASCII aquarium with fish and bubbles" /></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#75ff9c]/10 p-2">
        <button type="button" onClick={() => setPaused((value) => !value)} className={CONTROL}>{paused ? <Play className="size-3" /> : <Pause className="size-3" />}{paused ? "PLAY" : "PAUSE"}</button>
        <button type="button" onClick={() => setSeed((value) => value + 1)} className={CONTROL}><Shuffle className="size-3" />NEW TANK</button>
        <span className="text-[8px] text-[#75ff9c]/40">CLICK WATER FOR BUBBLES</span>
        <label className="ml-auto flex items-center gap-2 text-[9px] text-[#75ff9c]/55">FLOW<input type="range" min="0.3" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-24 accent-cyan-400" />{speed.toFixed(1)}×</label>
      </div>
    </div>
  );
}

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
    let width = 1;
    let height = 1;
    let raf = 0;
    let previous = performance.now();
    const stars: SkyStar[] = Array.from({ length: 145 }, () => ({ x: Math.random(), y: Math.random() * 0.58, radius: 0.35 + Math.random() * 1.35, phase: Math.random() * Math.PI * 2 }));
    const trees = Array.from({ length: 42 }, (_, index) => ({ x: index / 41 + (Math.random() - 0.5) * 0.035, size: 0.55 + Math.random() * 0.8, depth: index % 3 }));
    const campers: Camper[] = ["#d56868", "#5c9ed6", "#d6a65c", "#8b6fd0", "#5ab48b", "#cf7ca8"].map((color, index) => ({ angle: Math.PI * 0.08 + index * Math.PI * 0.84 / 5, color, phase: index * 0.9 }));
    const sparks = Array.from({ length: 32 }, () => ({ phase: Math.random(), drift: Math.random() * 2 - 1, size: 0.5 + Math.random() * 1.5 }));
    const fireflies = Array.from({ length: 20 }, () => ({ x: Math.random(), y: 0.48 + Math.random() * 0.38, phase: Math.random() * Math.PI * 2 }));
    const bursts: { x: number; y: number; born: number }[] = [];
    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const sparkBurst = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      bursts.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, born: timeRef.current });
      if (bursts.length > 8) bursts.shift();
    };
    canvas.addEventListener("click", sparkBurst);

    const drawTree = (x: number, y: number, size: number, color: string) => {
      context.fillStyle = color;
      for (let tier = 0; tier < 3; tier++) {
        context.beginPath();
        context.moveTo(x, y - size * (1 - tier * 0.22));
        context.lineTo(x - size * (0.34 + tier * 0.08), y - size * (0.42 - tier * 0.2));
        context.lineTo(x + size * (0.34 + tier * 0.08), y - size * (0.42 - tier * 0.2));
        context.closePath();
        context.fill();
      }
      context.fillRect(x - size * 0.035, y - size * 0.15, size * 0.07, size * 0.2);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const fps = reducedMotion ? 12 : 30;
      if (now - previous < 1000 / fps) return;
      const dt = Math.min(0.08, (now - previous) / 1000) * speedRef.current * (reducedMotion ? 0.35 : 1);
      previous = now;
      if (!pausedRef.current) timeRef.current += dt;
      const time = timeRef.current;
      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#020718");
      sky.addColorStop(0.62, "#091b2b");
      sky.addColorStop(1, "#102b25");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);
      for (const star of stars) {
        const alpha = 0.25 + (Math.sin(time * 1.7 + star.phase) + 1) * 0.34;
        context.fillStyle = `rgba(220,240,255,${alpha})`;
        context.beginPath();
        context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
        context.fill();
      }
      const shotCycle = (time - shotRef.current) % 11;
      if (shotCycle > 0 && shotCycle < 1.5) {
        const progress = shotCycle / 1.5;
        const x = width * (0.12 + progress * 0.72);
        const y = height * (0.08 + progress * 0.25);
        const trail = context.createLinearGradient(x - 130, y - 45, x, y);
        trail.addColorStop(0, "rgba(140,220,255,0)");
        trail.addColorStop(1, "rgba(240,250,255,.9)");
        context.strokeStyle = trail;
        context.lineWidth = 1.8;
        context.beginPath();
        context.moveTo(x - 130, y - 45);
        context.lineTo(x, y);
        context.stroke();
      }
      for (const tree of trees) {
        const baseY = height * (0.64 + tree.depth * 0.055);
        drawTree(tree.x * width, baseY, height * 0.16 * tree.size, tree.depth === 0 ? "#071a20" : tree.depth === 1 ? "#09251f" : "#0b3024");
      }
      context.fillStyle = "#122f24";
      context.beginPath();
      context.ellipse(width / 2, height * 0.79, width * 0.44, height * 0.2, 0, 0, Math.PI * 2);
      context.fill();
      for (const fly of fireflies) {
        const alpha = Math.max(0, Math.sin(time * 2 + fly.phase)) * 0.8;
        context.fillStyle = `rgba(190,255,105,${alpha})`;
        context.beginPath();
        context.arc(fly.x * width + Math.sin(time + fly.phase) * 8, fly.y * height + Math.cos(time * 0.7 + fly.phase) * 6, 1.2, 0, Math.PI * 2);
        context.fill();
      }
      const fireX = width / 2;
      const fireY = height * 0.73;
      const spread = Math.min(170, width * 0.24);
      for (const camper of campers) {
        const x = fireX + Math.cos(camper.angle) * spread;
        const y = fireY + Math.sin(camper.angle) * height * 0.095 + 12;
        const sway = Math.sin(time * 1.2 + camper.phase) * 1.5;
        context.strokeStyle = "#182028";
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(x - 7, y + 12);
        context.lineTo(x - 14, y + 22);
        context.moveTo(x + 7, y + 12);
        context.lineTo(x + 14, y + 22);
        context.stroke();
        context.fillStyle = camper.color;
        context.beginPath();
        context.ellipse(x, y + sway, 13, 18, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#b98768";
        context.beginPath();
        context.arc(x, y - 22 + sway, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#151a24";
        context.beginPath();
        context.arc(x, y - 25 + sway, 8, Math.PI, Math.PI * 2);
        context.fill();
        context.strokeStyle = camper.color;
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(x - 10, y - 4 + sway);
        context.lineTo(x - 19, y + 5 + sway);
        context.moveTo(x + 10, y - 4 + sway);
        context.lineTo(x + 19, y + 5 + sway);
        context.stroke();
      }
      const glow = context.createRadialGradient(fireX, fireY, 0, fireX, fireY, Math.min(width, height) * 0.35);
      glow.addColorStop(0, "rgba(255,145,45,.34)");
      glow.addColorStop(0.45, "rgba(255,100,25,.09)");
      glow.addColorStop(1, "rgba(255,80,20,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "#5a301d";
      context.lineWidth = 10;
      context.beginPath();
      context.moveTo(fireX - 32, fireY + 14);
      context.lineTo(fireX + 32, fireY + 25);
      context.moveTo(fireX + 32, fireY + 14);
      context.lineTo(fireX - 32, fireY + 25);
      context.stroke();
      const flameScale = Math.min(width, height) / 330 * (0.8 + speedRef.current * 0.25);
      for (let index = 0; index < 12; index++) {
        const phase = time * (4.2 + index * 0.09) + index * 1.7;
        const x = fireX + Math.sin(phase * 0.7) * (8 + index % 4 * 5);
        const flameHeight = (28 + (Math.sin(phase) + 1) * 20 + index % 3 * 8) * flameScale;
        const flameWidth = (10 + index % 4 * 3) * flameScale;
        context.fillStyle = index % 3 === 0 ? "#fff2a1" : index % 2 ? "#ffad32" : "#f05a24";
        context.beginPath();
        context.moveTo(x - flameWidth, fireY + 16);
        context.quadraticCurveTo(x - flameWidth * 1.3, fireY - flameHeight * 0.25, x + Math.sin(phase) * flameWidth, fireY - flameHeight);
        context.quadraticCurveTo(x + flameWidth * 1.3, fireY - flameHeight * 0.25, x + flameWidth, fireY + 16);
        context.closePath();
        context.fill();
      }
      for (const spark of sparks) {
        const progress = (time * 0.28 + spark.phase) % 1;
        context.fillStyle = `rgba(255,190,75,${1 - progress})`;
        context.beginPath();
        context.arc(fireX + spark.drift * progress * 48 + Math.sin(time * 3 + spark.phase) * 7, fireY - progress * height * 0.32, spark.size, 0, Math.PI * 2);
        context.fill();
      }
      for (let index = bursts.length - 1; index >= 0; index--) {
        const burst = bursts[index];
        const progress = (time - burst.born) / 1.2;
        if (progress > 1) { bursts.splice(index, 1); continue; }
        for (let particle = 0; particle < 12; particle++) {
          const angle = particle / 12 * Math.PI * 2;
          context.fillStyle = `rgba(255,220,120,${1 - progress})`;
          context.beginPath();
          context.arc(burst.x + Math.cos(angle) * progress * 42, burst.y + Math.sin(angle) * progress * 42, 1.6, 0, Math.PI * 2);
          context.fill();
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("click", sparkBurst);
    };
  }, [reducedMotion, seed]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={hostRef} className="min-h-0 flex-1"><canvas ref={canvasRef} className="h-full w-full cursor-pointer" aria-label="Animated forest campsite with people, fire, stars, and shooting stars" /></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#75ff9c]/10 p-2">
        <button type="button" onClick={() => setPaused((value) => !value)} className={CONTROL}>{paused ? <Play className="size-3" /> : <Pause className="size-3" />}{paused ? "PLAY" : "PAUSE"}</button>
        <button type="button" onClick={() => { shotRef.current = timeRef.current; }} className={CONTROL}><Sparkles className="size-3" />SHOOTING STAR</button>
        <button type="button" onClick={() => setSeed((value) => value + 1)} className={CONTROL}><Shuffle className="size-3" />NEW FOREST</button>
        <label className="ml-auto flex items-center gap-2 text-[9px] text-[#75ff9c]/55">FIRE<input type="range" min="0.3" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-24 accent-orange-400" />{speed.toFixed(1)}×</label>
      </div>
    </div>
  );
}
