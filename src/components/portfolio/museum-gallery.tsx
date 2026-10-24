"use client";

/* ============================================================
 * MuseumGallery — a REAL first-person 3D museum (Three.js WebGL).
 *
 * One hub room with a wing (corridor) per portfolio section that has
 * a gallery — graphics, security, AI and every custom section. The
 * visitor literally WALKS: WASD / on-screen joystick, mouse-look via
 * pointer lock (desktop) or drag-look (touch), subtle head-bob,
 * wall collision, artworks as textured planes in lit frames with
 * placards, spot cones over each piece, wing title end-walls.
 *
 * Interactions
 *   • look at an artwork in range → HUD caption + [catalogue] button
 *   • click / tap artwork (or Enter) → walks to it, faces it, opens
 *     the page-flip CATALOGUE (unlocked) or the Access-Guard PIN
 *     dialog (locked project / locked wing)
 *   • Tab → face the next artwork across the whole museum
 *   • live MINIMAP: floor plan with all wings, artwork zones,
 *     visitor dot + heading
 *
 * Performance profile (matches the site's 3D rules): DPR ≤1.25 with
 * no AA on coarse-pointer devices, DPR ≤1.5 + AA on desktop, unlit
 * artwork materials (paintings look lit), fake light cones (no
 * dynamic lights), single scene, everything disposed on unmount.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BookOpen, Lock, MousePointer2, Radar } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { projectTarget } from "@/lib/guard-targets";
import type { ProjectArtwork } from "@/lib/content-types";
import { cn } from "@/lib/utils";

/* ---------------- wing layout (pure — shared with the minimap) --- */

interface WingDef {
  id: string;
  label: string;
  color: string;
  locked: boolean;
  projects: ProjectArtwork[];
}

interface WingLayout {
  def: WingDef;
  angle: number;         // radians; corridor extends outward at this angle
  dir: { x: number; z: number };
  length: number;        // corridor depth (world units)
  width: number;
  artworks: {
    index: number;
    side: -1 | 1;
    dist: number;        // distance from hub center along the corridor
    y: number;
  }[];
}

const HUB_R = 6.2;
const WING_W = 5.6;
const EYE = 1.65;
const STEP = 5.2; // distance between artworks along a wall

function layoutWings(wings: WingDef[]): WingLayout[] {
  const n = Math.max(1, wings.length);
  return wings.map((def, i) => {
    // First wing points "forward" (−z in three.js = into the screen);
    // the rest spread around the hub so no two corridors overlap.
    const angle = -Math.PI / 2 + (i * (2 * Math.PI)) / Math.max(n, 3) * (n > 1 ? 1 : 0);
    const dir = { x: Math.cos(angle), z: Math.sin(angle) };
    const count = Math.max(1, def.projects.length);
    const length = 8 + count * (STEP / 2) + 4;
    const artworks = def.projects.map((_, index) => ({
      index,
      side: (index % 2 === 0 ? -1 : 1) as -1 | 1,
      dist: HUB_R + 3.4 + Math.floor(index / 2) * STEP,
      y: 1.62 + ((index * 47) % 3 - 1) * 0.12,
    }));
    return { def, angle, dir, length, width: WING_W, artworks };
  });
}

/* ---------------- helpers ---------------- */

function makeTextTexture(lines: { text: string; size: number; bold?: boolean; color?: string }[], w: number, h: number, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#14121c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, 6);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = h / 2 - (lines.length - 1) * 26;
  for (const line of lines) {
    ctx.font = `${line.bold ? "bold " : ""}${line.size}px Vazirmatn, Tahoma, sans-serif`;
    ctx.fillStyle = line.color ?? "#f2eFE6";
    ctx.fillText(line.text, w / 2, y);
    y += line.size + 18;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function placeholderTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "#221f30");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------------- component ---------------- */

export function MuseumGallery({
  lang,
  onOpenCatalog,
  onRequestUnlock,
}: {
  lang: "fa" | "en";
  onOpenCatalog: (project: ProjectArtwork, wingLabel: string) => void;
  onRequestUnlock: (target: string, label: string) => void;
}) {
  const fa = lang === "fa";
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapPlayerRef = useRef<SVGGElement>(null);
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState<{ kind: "project" | "lockedProj" | "lockedWing"; title: string; sub: string; wingLabel: string } | null>(null);
  const [locked, setLocked] = useState(false); // pointer-lock state (desktop)

  /* ---- wings from the store (live: add/remove sections reflects) ---- */
  const contentEn = useContent((s) => s.contentEn);
  const contentFa = useContent((s) => s.contentFa);
  const customs = useContent((s) => s.customs);
  const guardSections = useContent((s) => s.guardSections);
  const guardUnlocked = useContent((s) => s.guardUnlocked);
  const activeLang = useContent((s) => s.lang);

  const wings = useMemo<WingDef[]>(() => {
    const out: WingDef[] = [];
    const src = activeLang === "fa" ? contentFa : contentEn;
    const accentOf: Record<string, string> = { graphics: "#c084fc", security: "#34d399", ai: "#38bdf8" };
    const labels: Record<string, { fa: string; en: string }> = {
      graphics: { fa: "بال گرافیک", en: "Graphics Wing" },
      security: { fa: "بال امنیت", en: "Security Wing" },
      ai: { fa: "بال هوش مصنوعی", en: "AI Wing" },
    };
    const galleryLocked = (id: string) => {
      const l = guardSections[`gallery:${id}`];
      return Boolean(l?.enabled && l.hasPassword && !guardUnlocked.includes(`gallery:${id}`));
    };
    for (const id of ["graphics", "security", "ai"] as const) {
      const g = (src as unknown as Record<string, { gallery?: { projects?: ProjectArtwork[] } }>)[id]?.gallery;
      if (!g || !Array.isArray(g.projects) || g.projects.length === 0) continue;
      out.push({ id, label: fa ? labels[id].fa : labels[id].en, color: accentOf[id], locked: galleryLocked(id), projects: g.projects });
    }
    for (const [id, data] of Object.entries(customs ?? {})) {
      const g = (data as { fa?: { gallery?: { projects?: ProjectArtwork[] } }; en?: { gallery?: { projects?: ProjectArtwork[] } } })[activeLang]?.gallery;
      if (!g || !Array.isArray(g.projects) || g.projects.length === 0) continue;
      out.push({ id, label: id.replace(/^custom-/, ""), color: "#f59e0b", locked: galleryLocked(id), projects: g.projects });
    }
    return out;
  }, [contentEn, contentFa, customs, guardSections, guardUnlocked, activeLang, fa]);

  const wingsSignature = useMemo(
    () => wings.map((w) => `${w.id}:${w.locked}:${w.projects.map((p) => `${p.title || ""}${p.locked ? "!" : ""}`).join(",")}`).join("|"),
    [wings]
  );
  const layouts = useMemo(() => layoutWings(wings), [wingsSignature]);

  /* interact callback identity for the imperative loop (kept fresh in an
   * effect — writing refs during render is forbidden) */
  const interactRef = useRef({ onOpenCatalog, onRequestUnlock, wings: [] as WingDef[] });
  useEffect(() => {
    interactRef.current = { onOpenCatalog, onRequestUnlock, wings };
  }, [onOpenCatalog, onRequestUnlock, wings]);

  /* ---------------- three.js lifecycle ---------------- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || wings.length === 0) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    const renderer = new THREE.WebGLRenderer({ antialias: !coarse, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.25 : 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b0913");
    scene.fog = new THREE.Fog("#0b0913", 14, 42);

    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.1, 120);

    scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    scene.add(new THREE.HemisphereLight(0xdcd6ff, 0x241f33, 0.55));

    /* ---- materials & geometry pools (for dispose) ---- */
    const disposables: Array<THREE.Texture | THREE.Material | THREE.BufferGeometry> = [];
    const track = <T extends THREE.Texture | THREE.Material | THREE.BufferGeometry>(x: T): T => { disposables.push(x); return x; };

    const floorTex = track(placeholderTexture("#2a2536"));
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(40, 40);
    const floorMat = track(new THREE.MeshLambertMaterial({ map: floorTex }));
    const wallMat = track(new THREE.MeshLambertMaterial({ color: 0x201c2e }));
    const ceilMat = track(new THREE.MeshLambertMaterial({ color: 0x17141f }));
    const frameMat = track(new THREE.MeshLambertMaterial({ color: 0x0d0b12 }));
    const glowMat = track(new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));

    const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
    const planeGeo = track(new THREE.PlaneGeometry(1, 1));

    const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, rotY = 0) => {
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      scene.add(m);
      return m;
    };

    /* ---- walkable areas for collision ---- */
    type Area = { kind: "circle"; r: number } | { kind: "rect"; cx: number; cz: number; hw: number; hl: number; angle: number; cos: number; sin: number };
  const areas: Area[] = [{ kind: "circle", r: HUB_R - 0.45 }];

    /* ---- hub ---- */
    const hubFloor = new THREE.Mesh(new THREE.CircleGeometry(HUB_R, 48), floorMat);
    hubFloor.rotation.x = -Math.PI / 2;
    scene.add(hubFloor);
    addBox(HUB_R * 2, 0.1, HUB_R * 2, 0, 3.4, 0, ceilMat); // ceiling slab
    // hub ring wall segments between wings
    const wingAngles = layouts.map((l) => l.angle);

    /* ---- artwork registry ---- */
    interface ArtworkEntry {
      wing: WingDef; layout: WingLayout; project: ProjectArtwork;
      pos: THREE.Vector3; forward: THREE.Vector3; // faces into the corridor
      spot: THREE.Vector3; // standing spot for focus mode
    }
    const artworks: ArtworkEntry[] = [];

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    for (const layout of layouts) {
      const { def, dir, length } = layout;
      const perp = { x: -dir.z, z: dir.x };

      // corridor floor + ceiling
      const corridorFloor = new THREE.Mesh(planeGeo, floorMat);
      corridorFloor.rotation.x = -Math.PI / 2;
      corridorFloor.rotation.z = -layout.angle;
      corridorFloor.scale.set(WING_W, length, 1);
      corridorFloor.position.set(dir.x * (HUB_R + length / 2 - 2), 0, dir.z * (HUB_R + length / 2 - 2));
      corridorFloor.rotation.order = "YXZ";
      corridorFloor.rotation.set(-Math.PI / 2, -layout.angle, 0);
      scene.add(corridorFloor);

      const corridorCeil = corridorFloor.clone();
      corridorCeil.position.y = 3.4;
      corridorCeil.rotation.x = Math.PI / 2;
      scene.add(corridorCeil);

      // walls
      for (const side of [-1, 1] as const) {
        const wall = new THREE.Mesh(planeGeo, wallMat);
        wall.scale.set(length, 3.4, 1);
        wall.position.set(
          dir.x * (HUB_R + length / 2 - 2) + perp.x * side * (WING_W / 2),
          1.7,
          dir.z * (HUB_R + length / 2 - 2) + perp.z * side * (WING_W / 2)
        );
        wall.rotation.y = -layout.angle + (side === -1 ? Math.PI / 2 : -Math.PI / 2);
        scene.add(wall);
      }
      // end wall with the wing title
      const titleTex = track(makeTextTexture(
        [{ text: def.label, size: 44, bold: true }, { text: fa ? `${def.projects.length} اثر` : `${def.projects.length} works`, size: 24, color: "#b9b2d0" }],
        1024, 512, def.color
      ));
      const endWall = new THREE.Mesh(planeGeo, track(new THREE.MeshBasicMaterial({ map: titleTex })));
      endWall.scale.set(WING_W, 2.8, 1);
      endWall.position.set(dir.x * (HUB_R + length - 2), 1.7, dir.z * (HUB_R + length - 2));
      endWall.rotation.y = -layout.angle + Math.PI;
      scene.add(endWall);

      // walkable rect (corridor)
      const cx = dir.x * (HUB_R + length / 2 - 2), cz = dir.z * (HUB_R + length / 2 - 2);
      areas.push({ kind: "rect", cx, cz, hw: WING_W / 2 - 0.45, hl: length / 2 - 0.4, angle: layout.angle, cos: Math.cos(layout.angle), sin: Math.sin(layout.angle) });

      // artworks
      for (const spot of layout.artworks) {
        const project = def.projects[spot.index];
        if (!project) continue;
        const side = spot.side;
        const worldPos = new THREE.Vector3(
          dir.x * spot.dist + perp.x * side * (WING_W / 2 - 0.18),
          spot.y,
          dir.z * spot.dist + perp.z * side * (WING_W / 2 - 0.18)
        );
        // frame plane faces INTO the corridor
        const lookAt = new THREE.Vector3(worldPos.x - perp.x * side, worldPos.y, worldPos.z - perp.z * side);

        const group = new THREE.Group();
        group.position.copy(worldPos);
        group.lookAt(lookAt);
        scene.add(group);

        const w = 2.1, h = 1.55;
        // dark frame
        const frame = new THREE.Mesh(planeGeo, frameMat);
        frame.scale.set(w + 0.18, h + 0.18, 1);
        frame.position.z = -0.012;
        group.add(frame);

        const artMat = track(new THREE.MeshBasicMaterial({ map: track(placeholderTexture(project.color || def.color)) }));
        const art = new THREE.Mesh(planeGeo, artMat);
        art.scale.set(w, h, 1);
        group.add(art);

        if (project.locked) {
          const lockTex = track(makeTextTexture([{ text: project.title || (fa ? "اثر محافظت‌شده" : "Protected"), size: 40, bold: true }, { text: fa ? "قفل با رمز" : "password-protected", size: 24, color: "#e8c46a" }], 512, 384, def.color));
          art.material = track(new THREE.MeshBasicMaterial({ map: lockTex }));
        } else {
          const src = project.videos?.[0]?.poster || project.images?.find((i) => /^(https?:|\/|data:)/.test(i));
          if (src) {
            loader.load(src, (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              disposables.push(tex);
              (art.material as THREE.MeshBasicMaterial).map = tex;
              (art.material as THREE.MeshBasicMaterial).needsUpdate = true;
            }, undefined, () => { /* keep placeholder */ });
          }
        }

        // light cone over the piece (fake, additive)
        const cone = new THREE.Mesh(planeGeo, glowMat);
        cone.scale.set(w + 1.1, 2.6, 1);
        cone.position.set(0, 1.55, 0.12);
        group.add(cone);

        // placard
        const placardTex = track(makeTextTexture([{ text: project.title || "—", size: 34, bold: true }, { text: [project.category, project.year].filter(Boolean).join(" · ") || " ", size: 22, color: "#b9b2d0" }], 512, 220, def.color));
        const placard = new THREE.Mesh(planeGeo, track(new THREE.MeshBasicMaterial({ map: placardTex })));
        placard.scale.set(0.85, 0.36, 1);
        placard.position.set(side === -1 ? w / 2 - 0.1 : -w / 2 + 0.1, -h / 2 - 0.42, 0.03);
        group.add(placard);

        const forward = new THREE.Vector3().subVectors(lookAt, worldPos).setY(0).normalize();
        // stand INSIDE the corridor, looking back at the piece (the wall
        // plane is 0.18 off the structural wall; 1.35m in front of it is
        // comfortably inside the walkable rect).
        const stand = new THREE.Vector3(
          worldPos.x + forward.x * 1.35,
          EYE,
          worldPos.z + forward.z * 1.35
        );
        artworks.push({ wing: def, layout, project, pos: worldPos, forward, spot: stand });
      }
    }

    // hub ring walls: fill the circle EXCEPT wing openings (cheap: full low ring)
    const ring = new THREE.Mesh(
      track(new THREE.CylinderGeometry(HUB_R, HUB_R, 3.4, 64, 1, true)),
      track(new THREE.MeshLambertMaterial({ color: 0x241f33, side: THREE.BackSide }))
    );
    ring.position.y = 1.7;
    scene.add(ring);
    // reopen wing entrances by placing bright portal frames over the ring
    for (const layout of layouts) {
      const portal = new THREE.Mesh(planeGeo, track(new THREE.MeshBasicMaterial({ color: new THREE.Color(def_color(layout)), transparent: true, opacity: 0.9 })));
      function def_color(l: WingLayout) { return l.def.color; }
      portal.scale.set(WING_W - 0.2, 3.0, 1);
      portal.position.set(layout.dir.x * (HUB_R - 0.05), 1.6, layout.dir.z * (HUB_R - 0.05));
      portal.rotation.y = -layout.angle + Math.PI;
      scene.add(portal);
      // portal label
      const label = new THREE.Mesh(planeGeo, track(new THREE.MeshBasicMaterial({ map: track(makeTextTexture([{ text: layout.def.label, size: 40, bold: true }], 512, 160, layout.def.color)), transparent: true })));
      label.scale.set(2.6, 0.8, 1);
      label.position.set(layout.dir.x * (HUB_R - 0.5), 2.9, layout.dir.z * (HUB_R - 0.5));
      label.rotation.y = -layout.angle + Math.PI;
      scene.add(label);
    }

    /* ---------------- player state & controls ---------------- */

    const player = {
      pos: new THREE.Vector3(0, EYE, 0.5),
      yaw: layouts.length ? -layouts[0].angle - Math.PI / 2 : 0,
      pitch: 0,
      bob: 0,
    };
    const keys = new Set<string>();
    const joy = { x: 0, y: 0 };
    const look = { id: -1 as number, x: 0, y: 0 };
    const autoGoto = { active: false, pos: new THREE.Vector3(), yaw: 0, then: null as null | (() => void) };

    const inArea = (x: number, z: number): boolean => {
      for (const a of areas) {
        if (a.kind === "circle") {
          if (x * x + z * z <= (a.r) * (a.r)) return true;
        } else {
          const dx = x - a.cx, dz = z - a.cz;
          const lx = dx * a.cos + dz * a.sin;
          const lz = -dx * a.sin + dz * a.cos;
          if (Math.abs(lx) <= a.hw && Math.abs(lz) <= a.hl) return true;
        }
      }
      return false;
    };

    const movePlayer = (dx: number, dz: number) => {
      if (!inArea(player.pos.x, player.pos.z)) {
        // outside every area (edge case): allow free movement so the
        // visitor can never get permanently stuck.
        player.pos.x += dx;
        player.pos.z += dz;
        return;
      }
      if (inArea(player.pos.x + dx, player.pos.z)) player.pos.x += dx;
      if (inArea(player.pos.x, player.pos.z + dz)) player.pos.z += dz;
    };

    /* keyboard */
    const onKeyDown = (e: KeyboardEvent) => {
      // Only a real overlay ABOVE the museum (catalogue book / PIN dialog)
      // pauses movement — NOT the gallery popup itself, which is also a
      // role="dialog" wrapper around the whole museum.
      if (document.querySelector("[data-guard-dialog], [data-gallery-catalog]")) { keys.clear(); return; }
      const k = e.key.toLowerCase();
      keys.add(k);
      if (k === "tab") {
        e.preventDefault();
        cycleFocus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        interact();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    /* pointer lock (desktop) */
    const canvas = renderer.domElement;
    const requestLock = () => { if (!coarse) void canvas.requestPointerLock?.(); };
    const onLockChange = () => setLocked(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onLockChange);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      player.yaw -= e.movementX * 0.0026;
      player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - e.movementY * 0.0022));
    };
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", () => {
      if (document.pointerLockElement !== canvas) { requestLock(); return; }
      interact();
    });

    /* touch look + tap (on the canvas; the joystick stops propagation) */
    let tapInfo = { x: 0, y: 0, t: 0, moved: false };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
      tapInfo = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== look.id) return;
      const dx = e.clientX - look.x, dy = e.clientY - look.y;
      look.x = e.clientX; look.y = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 6) tapInfo.moved = true;
      player.yaw -= dx * 0.0052;
      player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - dy * 0.0042));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== look.id) return;
      look.id = -1;
      if (!tapInfo.moved && Date.now() - tapInfo.t < 350) interact(); // tap
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    /* joystick bridge — set from React below */
    (window as unknown as { __museumJoy?: { x: number; y: number } }).__museumJoy = joy;

    /* focus / interact */
    let focusedIdx = -1;
    function pickArtwork(): number {
      const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      let best = -1, bestScore = 0.86;
      artworks.forEach((a, i) => {
        const to = new THREE.Vector3().subVectors(a.pos, player.pos).setY(0);
        const dist = to.length();
        if (dist > 4.4) return;
        to.normalize();
        const dot = to.dot(fwd);
        if (dot > bestScore) { bestScore = dot; best = i; }
      });
      return best;
    }
    function cycleFocus() {
      if (artworks.length === 0) return;
      const next = (focusedIdx + 1) % artworks.length;
      const a = artworks[next];
      autoGoto.active = true;
      autoGoto.pos.copy(a.spot);
      autoGoto.yaw = Math.atan2((a.pos.x - a.spot.x), (a.pos.z - a.spot.z)) + Math.PI;
      autoGoto.then = null;
    }
    function interact() {
      const idx = pickArtwork();
      if (idx < 0) return;
      const a = artworks[idx];
      const { onOpenCatalog: openCatalog, onRequestUnlock: requestUnlock } = interactRef.current;
      const def = a.wing;
      if (def.locked) {
        requestUnlock(`gallery:${def.id}`, def.label);
        return;
      }
      if (a.project.locked) {
        requestUnlock(projectTarget(def.id, a.project.title ?? ""), a.project.title ?? "");
        return;
      }
      // walk to it, face it, then open the catalogue
      autoGoto.active = true;
      autoGoto.pos.copy(a.spot);
      autoGoto.yaw = Math.atan2((a.pos.x - a.spot.x), (a.pos.z - a.spot.z)) + Math.PI;
      autoGoto.then = () => openCatalog(a.project, def.label);
    }
    (window as unknown as { __museumInteract?: () => void }).__museumInteract = interact;
    (window as unknown as { __museumDebug?: () => unknown }).__museumDebug = () => ({
      pos: [player.pos.x, player.pos.z], yaw: player.yaw,
      keys: [...keys], auto: autoGoto.active,
      areas: areas.length, arts: artworks.length,
    });

    /* ---------------- loop ---------------- */

    const clock = new THREE.Clock();
    let raf = 0;
    let hudTick = 0;
    const tmpForward = new THREE.Vector3();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());

      // auto-goto (focus / interact): ease position + yaw
      if (autoGoto.active) {
        player.pos.x += (autoGoto.pos.x - player.pos.x) * Math.min(1, dt * 4.5);
        player.pos.z += (autoGoto.pos.z - player.pos.z) * Math.min(1, dt * 4.5);
        let dy = autoGoto.yaw - player.yaw;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        player.yaw += dy * Math.min(1, dt * 5);
        if (Math.abs(dy) < 0.03 && Math.hypot(autoGoto.pos.x - player.pos.x, autoGoto.pos.z - player.pos.z) < 0.08) {
          autoGoto.active = false;
          autoGoto.then?.();
          autoGoto.then = null;
        }
      } else {
        // manual walk: keys + joystick
        const run = keys.has("shift") ? 1.75 : 1;
        const speed = 3.4 * run;
        tmpForward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
        const right = { x: -tmpForward.z, z: tmpForward.x };
        let mx = 0, mz = 0;
        if (keys.has("w") || keys.has("arrowup")) { mx += tmpForward.x; mz += tmpForward.z; }
        if (keys.has("s") || keys.has("arrowdown")) { mx -= tmpForward.x; mz -= tmpForward.z; }
        if (keys.has("a")) { mx -= right.x; mz -= right.z; }
        if (keys.has("d")) { mx += right.x; mz += right.z; }
        if (keys.has("arrowleft")) { player.yaw += 1.9 * dt; }
        if (keys.has("arrowright")) { player.yaw -= 1.9 * dt; }
        mx += -tmpForward.x * -joy.y + right.x * joy.x;
        mz += -tmpForward.z * -joy.y + right.z * joy.x;
        const len = Math.hypot(mx, mz);
        if (len > 0.001) {
          const step = (speed * dt) / Math.max(1, len);
          movePlayer(mx * step, mz * step);
          player.bob += dt * (run > 1 ? 13 : 9);
        } else {
          player.bob += dt * 1.4;
        }
      }

      camera.position.set(player.pos.x, EYE + Math.sin(player.bob) * 0.028, player.pos.z);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(player.yaw);
      camera.rotateX(player.pitch);

      // HUD focus (throttled)
      hudTick += dt;
      if (hudTick > 0.12) {
        hudTick = 0;
        const idx = pickArtwork();
        if (idx !== focusedIdx) {
          focusedIdx = idx;
          if (idx < 0) setFocused(null);
          else {
            const a = artworks[idx];
            setFocused(
              a.wing.locked
                ? { kind: "lockedWing", title: a.wing.label, sub: fa ? "این بال با رمز قفل است — برای ورود رمز را وارد کنید" : "this wing is password-protected", wingLabel: a.wing.label }
                : a.project.locked
                  ? { kind: "lockedProj", title: a.project.title, sub: fa ? "این اثر محافظت‌شده است" : "this artwork is protected", wingLabel: a.wing.label }
                  : { kind: "project", title: a.project.title, sub: [a.project.category, a.project.year].filter(Boolean).join(" · "), wingLabel: a.wing.label }
            );
          }
        }
        // minimap marker (direct DOM — no react re-render)
        const g = minimapPlayerRef.current;
        if (g) {
          const mm = minimapProjection(player.pos.x, player.pos.z, player.yaw);
          g.setAttribute("transform", `translate(${mm.x.toFixed(1)} ${mm.y.toFixed(1)}) rotate(${mm.a.toFixed(1)})`);
        }
      }

      renderer.render(scene, camera);
    };

    /* minimap geometry: world (x,z) → svg coords */
    const mapW = 150, mapH = 150, mapScale = 150 / ((layouts.reduce((m, l) => Math.max(m, l.length + HUB_R), HUB_R + 6)) * 2);
    function minimapProjection(x: number, z: number, yaw: number) {
      const cx = mapW / 2 - x * mapScale;
      const cy = mapH / 2 + z * mapScale;
      const a = (-yaw * 180) / Math.PI;
      return { x: cx, y: cy, a };
    }
    void minimapProjection;

    setReady(true);
    animate();

    /* ---- resize ---- */
    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---- cleanup ---- */
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", requestLock as EventListener);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      delete (window as unknown as { __museumJoy?: unknown }).__museumJoy;
      delete (window as unknown as { __museumInteract?: unknown }).__museumInteract;
      delete (window as unknown as { __museumDebug?: unknown }).__museumDebug;
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry && mesh.geometry !== boxGeo && mesh.geometry !== planeGeo) mesh.geometry.dispose();
      });
      for (const d of disposables) d.dispose();
      boxGeo.dispose(); planeGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
    // Rebuild only when the wing composition changes (titles/locks), not on
    // every store tick — interactRef keeps the callbacks fresh.
  }, [wingsSignature]);

  /* ---------------- joystick (touch) ---------------- */
  const joystickRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const base = joystickRef.current;
    const joy = (window as unknown as { __museumJoy?: { x: number; y: number } }).__museumJoy;
    if (!base || !joy) return;
    const knob = base.querySelector<HTMLDivElement>("[data-knob]")!;
    let id = -1, cx = 0, cy = 0;
    const R = 44;
    const set = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy);
      const k = len > R ? R / len : 1;
      const x = dx * k, y = dy * k;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      joy.x = x / R;
      joy.y = y / R;
    };
    const down = (e: PointerEvent) => {
      e.stopPropagation();
      id = e.pointerId;
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      base.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      e.stopPropagation();
      set(e.clientX - cx, e.clientY - cy);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      set(0, 0);
    };
    base.addEventListener("pointerdown", down);
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", up);
    base.addEventListener("pointercancel", up);
    return () => {
      base.removeEventListener("pointerdown", down);
      base.removeEventListener("pointermove", move);
      base.removeEventListener("pointerup", up);
      base.removeEventListener("pointercancel", up);
      joy.x = 0; joy.y = 0;
    };
  }, [ready]);

  /* ---------------- minimap static plan ---------------- */
  const minimap = useMemo(() => {
    const size = 150, scale = size / ((layouts.reduce((m, l) => Math.max(m, l.length + HUB_R), HUB_R + 6)) * 2);
    const px = (x: number) => size / 2 - x * scale;
    const pz = (z: number) => size / 2 + z * scale;
    return { size, px, pz, layouts, scale };
  }, [layouts]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b0913]">
      <div ref={mountRef} className="absolute inset-0" />

      {/* top caption */}
      {focused && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
          <div className={cn("flex max-w-md items-center gap-2 rounded-full border px-4 py-1.5 text-xs backdrop-blur",
            focused.kind === "project" ? "border-white/15 bg-black/55 text-white" : "border-amber-400/40 bg-amber-950/60 text-amber-200")}>
            {focused.kind !== "project" && <Lock className="size-3.5 shrink-0" />}
            <span className="truncate font-bold">{focused.title}</span>
            {focused.sub && <span className="truncate opacity-70">· {focused.sub}</span>}
          </div>
        </div>
      )}

      {/* interact button */}
      {focused && (
        <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            onClick={() => (window as unknown as { __museumInteract?: () => void }).__museumInteract?.()}
            className={cn("inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold backdrop-blur transition",
              focused.kind === "project"
                ? "border-white/25 bg-black/60 text-white hover:bg-black/80"
                : "border-amber-400/50 bg-amber-950/70 text-amber-200 hover:bg-amber-900/70")}
          >
            {focused.kind === "project" ? <BookOpen className="size-4" /> : <Lock className="size-4" />}
            {focused.kind === "project"
              ? (fa ? "کاتالوگ اثر" : "open catalogue")
              : (fa ? "ورود با رمز" : "enter password")}
            <span className="font-mono text-[9px] opacity-60">Enter</span>
          </button>
        </div>
      )}

      {/* minimap */}
      <div className="absolute bottom-4 start-4 z-20 rounded-xl border border-white/15 bg-black/60 p-2 backdrop-blur" aria-label={fa ? "نقشه موزه" : "museum map"}>
        <svg width={minimap.size} height={minimap.size} viewBox={`0 0 ${minimap.size} ${minimap.size}`}>
          <circle cx={minimap.size / 2} cy={minimap.size / 2} r={HUB_R * minimap.scale} fill="oklch(0.18 0.02 295 / .85)" stroke="oklch(0.55 0.03 295 / .6)" strokeWidth="1" />
          {minimap.layouts.map((l) => {
            const x1 = minimap.px(l.dir.x * HUB_R), z1 = minimap.pz(l.dir.z * HUB_R);
            const x2 = minimap.px(l.dir.x * (HUB_R + l.length - 2)), z2 = minimap.pz(l.dir.z * (HUB_R + l.length - 2));
            const len = Math.hypot(x2 - x1, z2 - z1);
            const angle = (Math.atan2(z2 - z1, x2 - x1) * 180) / Math.PI;
            return (
              <g key={l.def.id} transform={`translate(${x1} ${z1}) rotate(${angle})`}>
                <rect x="0" y={-(l.width / 2) * minimap.scale} width={len} height={l.width * minimap.scale} rx="2"
                  fill="oklch(0.16 0.02 295 / .8)" stroke={l.def.locked ? "oklch(0.7 0.15 85 / .8)" : "oklch(0.55 0.03 295 / .5)"} strokeWidth="1" strokeDasharray={l.def.locked ? "3 2" : undefined} />
                {l.def.projects.map((p, i) => {
                  const along = (3.4 + Math.floor(i / 2) * STEP) - HUB_R;
                  const side = i % 2 === 0 ? -1 : 1;
                  return <rect key={i} x={along * minimap.scale - 2} y={side * (l.width / 2) * minimap.scale - (side < 0 ? 4 : 0)} width="4" height="4" fill={p.locked ? "#e8c46a" : l.def.color} opacity="0.9" rx="1" />;
                })}
              </g>
            );
          })}
          {/* player marker (transform updated live from the render loop) */}
          <g ref={minimapPlayerRef}>
            <path d="M0 0 L-5 -8 A9 9 0 0 1 5 -8 Z" fill="var(--gfx-1)" opacity="0.6" />
            <circle r="3.2" fill="white" />
          </g>
        </svg>
        <p className="mt-1 flex items-center justify-center gap-1 font-mono text-[7px] uppercase tracking-widest text-white/45">
          <Radar className="size-2.5" />
          {fa ? `${toFa(wings.reduce((n, w) => n + w.projects.length, 0))} اثر در ${toFa(wings.length)} بال` : `${wings.reduce((n, w) => n + w.projects.length, 0)} works · ${wings.length} wings`}
        </p>
      </div>

      {/* controls hint (desktop, before pointer lock) */}
      {!locked && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <p className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white/60 backdrop-blur">
            <MousePointer2 className="size-3" />
            {fa
              ? "کلیک = قفل موس و راه رفتن · WASD = حرکت · Tab = روبروی اثر · Enter = کاتالوگ"
              : "click = lock & walk · WASD · Tab face artwork · Enter catalogue"}
          </p>
        </div>
      )}

      {/* virtual joystick (touch devices) */}
      <div
        ref={joystickRef}
        className="absolute bottom-6 end-6 z-30 grid size-28 touch-none place-items-center rounded-full border border-white/20 bg-white/[.06] backdrop-blur sm:size-32"
        aria-label={fa ? "دسته حرکت" : "movement joystick"}
      >
        <div data-knob className="size-12 rounded-full border border-white/30 bg-white/25 transition-transform" />
      </div>
    </div>
  );
}

function toFa(n: number): string {
  const d = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (x) => d[+x]);
}
