import * as THREE from "three";
import type { ProjectArtwork } from "@/lib/content-types";

export class ResourcePool {
  private resources = new Set<{ dispose: () => void }>();
  private disposed = false;

  track<T extends { dispose: () => void }>(resource: T): T {
    if (this.disposed) resource.dispose();
    else this.resources.add(resource);
    return resource;
  }

  dispose() {
    this.disposed = true;
    for (const resource of this.resources) resource.dispose();
    this.resources.clear();
  }
}

function canvasTexture(canvas: HTMLCanvasElement, color = true) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function surfaceTextures(base: string, accent: string, seed: number) {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  const normalCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = roughCanvas.width = roughCanvas.height = normalCanvas.width = normalCanvas.height = size;
  const colorCtx = colorCanvas.getContext("2d")!;
  const roughCtx = roughCanvas.getContext("2d")!;
  const normalCtx = normalCanvas.getContext("2d")!;
  const random = seededRandom(seed);
  colorCtx.fillStyle = base;
  colorCtx.fillRect(0, 0, size, size);
  roughCtx.fillStyle = "#a8a8a8";
  roughCtx.fillRect(0, 0, size, size);
  normalCtx.fillStyle = "rgb(128,128,255)";
  normalCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2400; i++) {
    const y = random() * size;
    const alpha = 0.015 + random() * 0.045;
    colorCtx.strokeStyle = random() > 0.48 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    colorCtx.lineWidth = random() * 0.7 + 0.2;
    colorCtx.beginPath();
    colorCtx.moveTo(random() * 80, y);
    colorCtx.lineTo(size - random() * 80, y + random() * 0.8);
    colorCtx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = random() * size;
    const y = random() * size;
    const length = 8 + random() * 80;
    colorCtx.strokeStyle = `rgba(220,235,255,${0.025 + random() * 0.07})`;
    colorCtx.lineWidth = 0.35 + random() * 0.7;
    colorCtx.beginPath();
    colorCtx.moveTo(x, y);
    colorCtx.lineTo(x + length, y + (random() - 0.5) * 5);
    colorCtx.stroke();
    roughCtx.fillStyle = `rgba(40,40,40,${0.04 + random() * 0.12})`;
    roughCtx.fillRect(x, y, length, 1);
  }
  colorCtx.strokeStyle = accent;
  colorCtx.globalAlpha = 0.11;
  colorCtx.lineWidth = 2;
  colorCtx.strokeRect(5, 5, size - 10, size - 10);
  colorCtx.globalAlpha = 1;
  const map = canvasTexture(colorCanvas);
  const roughnessMap = canvasTexture(roughCanvas, false);
  const normalMap = canvasTexture(normalCanvas, false);
  for (const texture of [map, roughnessMap, normalMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
  }
  return { map, roughnessMap, normalMap };
}

export interface SpaceshipMaterials {
  hull: THREE.MeshStandardMaterial;
  hullDark: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  screenGlass: THREE.MeshPhysicalMaterial;
  warmLight: THREE.MeshStandardMaterial;
  cyanLight: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
}

export function createSpaceshipMaterials(pool: ResourcePool): SpaceshipMaterials {
  const hullMaps = surfaceTextures("#323c48", "#9bb4c9", 17);
  const darkMaps = surfaceTextures("#111923", "#37516a", 29);
  const floorMaps = surfaceTextures("#202a33", "#6b8296", 43);
  Object.values({ ...hullMaps, ...darkMaps, ...floorMaps }).forEach((texture) => pool.track(texture));
  floorMaps.map.repeat.set(4, 8);
  floorMaps.roughnessMap.repeat.set(4, 8);
  floorMaps.normalMap.repeat.set(4, 8);
  return {
    hull: pool.track(new THREE.MeshStandardMaterial({ ...hullMaps, color: 0xa8b4c0, metalness: 0.82, roughness: 0.34, normalScale: new THREE.Vector2(0.24, 0.24) })),
    hullDark: pool.track(new THREE.MeshStandardMaterial({ ...darkMaps, color: 0x65778a, metalness: 0.88, roughness: 0.42 })),
    trim: pool.track(new THREE.MeshStandardMaterial({ color: 0x8e9ba8, metalness: 0.96, roughness: 0.2 })),
    floor: pool.track(new THREE.MeshStandardMaterial({ ...floorMaps, color: 0x83919e, metalness: 0.78, roughness: 0.5 })),
    black: pool.track(new THREE.MeshStandardMaterial({ color: 0x080d13, metalness: 0.75, roughness: 0.3 })),
    glass: pool.track(new THREE.MeshPhysicalMaterial({ color: 0xc3e2f2, metalness: 0.04, roughness: 0.08, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.25 })),
    screenGlass: pool.track(new THREE.MeshPhysicalMaterial({ color: 0xc4e6f5, roughness: 0.06, transparent: true, opacity: 0.07, depthWrite: false, clearcoat: 1, envMapIntensity: 1.1 })),
    warmLight: pool.track(new THREE.MeshStandardMaterial({ color: 0xffe4b0, emissive: 0xffc66d, emissiveIntensity: 1.65, roughness: 0.3 })),
    cyanLight: pool.track(new THREE.MeshStandardMaterial({ color: 0x9beaff, emissive: 0x38bdf8, emissiveIntensity: 2.1, roughness: 0.25 })),
    copper: pool.track(new THREE.MeshStandardMaterial({ color: 0xb8874f, metalness: 0.9, roughness: 0.27 })),
  };
}

export function makeTextTexture(lines: { text: string; size: number; bold?: boolean; color?: string }[], w: number, h: number, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#07111c");
  gradient.addColorStop(1, "#111e2a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent;
  ctx.fillRect(24, 25, Math.min(180, w * 0.22), 4);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = h / 2 - (lines.length - 1) * 30;
  for (const line of lines) {
    ctx.font = `${line.bold ? "700 " : ""}${line.size}px Vazirmatn, Tahoma, sans-serif`;
    ctx.fillStyle = line.color ?? "#edf6ff";
    ctx.fillText(line.text, w / 2, y, w - 70);
    y += line.size + 22;
  }
  return canvasTexture(canvas);
}

export function softRadialTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTexture(canvas);
}

export function makeArtworkPlate(project: ProjectArtwork, fa: boolean, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 1024, 720);
  gradient.addColorStop(0, "#07121e");
  gradient.addColorStop(0.55, "#15293a");
  gradient.addColorStop(1, "#080d16");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 720);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.18;
  for (let x = 0; x < 1024; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke();
  }
  for (let y = 0; y < 720; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent;
  ctx.fillRect(60, 70, 140, 6);
  ctx.textAlign = "center";
  ctx.fillStyle = "#eff8ff";
  ctx.font = `700 ${project.title.length > 22 ? 58 : 76}px Vazirmatn, Tahoma, sans-serif`;
  ctx.fillText(project.title || "—", 512, 350, 900);
  ctx.fillStyle = accent;
  ctx.font = "34px Vazirmatn, Tahoma, sans-serif";
  ctx.fillText([project.category, project.year].filter(Boolean).join(" · ") || (fa ? "پروژه" : "project"), 512, 440, 880);
  return canvasTexture(canvas);
}

export function makePlanetTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const random = seededRandom(91);
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#6685a5");
  gradient.addColorStop(0.45, "#263d5b");
  gradient.addColorStop(1, "#101b32");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 170; i++) {
    const x = random() * 1024;
    const y = random() * 512;
    const rx = 15 + random() * 120;
    const ry = 3 + random() * 28;
    ctx.fillStyle = `rgba(${80 + random() * 80},${110 + random() * 70},${145 + random() * 70},${0.025 + random() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, random() * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = canvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}
