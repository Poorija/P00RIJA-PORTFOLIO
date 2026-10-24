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
const STEP = 5.2;   // distance between artworks along a wall
const ART_W = 1.9;  // artwork plane width (museum scale)
const ART_H = 1.32; // artwork plane height
const VIEW_DIST = 2.65; // natural museum viewing distance from a piece

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

function softRadialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(255,244,214,1)");
  g.addColorStop(0.45, "rgba(255,236,190,0.45)");
  g.addColorStop(1, "rgba(255,236,190,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** typographic wall plate when a project has no image: big title + category */
function makeArtworkPlate(p: ProjectArtwork, fa: boolean, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 768; canvas.height = 540;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 768, 540);
  grad.addColorStop(0, "#191624");
  grad.addColorStop(1, "#221d33");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 540);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, 720, 492);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f1e8";
  const title = (p.title || "—");
  ctx.font = `bold ${title.length > 18 ? 52 : 68}px Vazirmatn, Tahoma, sans-serif`;
  ctx.fillText(title, 384, 268);
  ctx.fillStyle = accent;
  ctx.font = "36px Vazirmatn, Tahoma, sans-serif";
  ctx.fillText([p.category, p.year].filter(Boolean).join(" · ") || (fa ? "پروژه" : "project"), 384, 348);
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
  spawnWingId,
  onOpenCatalog,
  onOpenResumeBook,
  onRequestUnlock,
}: {
  lang: "fa" | "en";
  /** the section whose gallery button was clicked — the visitor ENTERS
   *  that wing and stays there until they choose another via the guide. */
  spawnWingId?: string;
  onOpenCatalog: (project: ProjectArtwork, wingLabel: string) => void;
  /** the desk book at the intersection — owner profile & résumé */
  onOpenResumeBook?: () => void;
  onRequestUnlock: (target: string, label: string) => void;
}) {
  const fa = lang === "fa";
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapPlayerRef = useRef<SVGGElement>(null);
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState(true);
  const [fade, setFade] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
  const interactRef = useRef({ onOpenCatalog, onRequestUnlock, onOpenResumeBook, wings: [] as WingDef[] });
  useEffect(() => {
    interactRef.current = { onOpenCatalog, onRequestUnlock, onOpenResumeBook, wings };
  }, [onOpenCatalog, onRequestUnlock, onOpenResumeBook, wings]);

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
    scene.fog = new THREE.Fog("#0b0913", 18, 55);

    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.1, 120);

    scene.add(new THREE.AmbientLight(0xffffff, 1.25));
    scene.add(new THREE.HemisphereLight(0xe8e2ff, 0x2c2640, 0.75));

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
    addBox(HUB_R * 2, 0.1, HUB_R * 2, 0, 5.4, 0, ceilMat); // ceiling slab (tall hub for gate signs)
    // hub ring wall segments between wings
    const wingAngles = layouts.map((l) => l.angle);

    /* ---- artwork registry ---- */
    interface ArtworkEntry {
      wing: WingDef; layout: WingLayout; project: ProjectArtwork;
      pos: THREE.Vector3; forward: THREE.Vector3; // faces into the corridor
      spot: THREE.Vector3; // standing spot for focus mode
    }
    const artworks: ArtworkEntry[] = [];
    // The desk book behaves like an artwork for focus/interact: standing at
    // the hub and looking at the desk highlights it; Enter opens the
    // profile/résumé catalogue.
    const deskEntry: ArtworkEntry = {
      wing: { id: "__desk__", label: fa ? "درباره من" : "About me", color: "#c9a24b", locked: false, projects: [] },
      layout: layouts[0],
      project: { title: fa ? "کتاب درباره من" : "My book", meta: "", category: "", color: "#c9a24b", year: "", client: "", role: "", description: "", specs: [], images: [], link: "" },
      pos: new THREE.Vector3(0, 1.1, 0),
      forward: new THREE.Vector3(0, 0, 1),
      spot: new THREE.Vector3(0, EYE, 1.9),
    };

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
      areas.push({ kind: "rect", cx, cz, hw: WING_W / 2 - 0.8, hl: length / 2 - 0.4, angle: layout.angle, cos: Math.cos(layout.angle), sin: Math.sin(layout.angle) });

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

        const w = ART_W, h = ART_H;
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
          // Featured image > video poster > first image; with none, the wall
          // shows a typographic plate (project title + category).
          const src = project.featured || project.videos?.[0]?.poster || project.images?.find((i) => /^(https?:|\/|data:)/.test(i));
          if (src) {
            loader.load(src, (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              disposables.push(tex);
              (art.material as THREE.MeshBasicMaterial).map = tex;
              (art.material as THREE.MeshBasicMaterial).needsUpdate = true;
            }, undefined, () => { /* keep plate */ });
          } else {
            const plate = track(makeArtworkPlate(project, fa, def.color));
            (art.material as THREE.MeshBasicMaterial).map = plate;
            (art.material as THREE.MeshBasicMaterial).needsUpdate = true;
          }
        }

        // SOFT picture light: radial-gradient halo above the frame +
        // a faint colored wash on the wall behind (no harsh rectangles).
        const glowTex = track(softRadialTexture());
        const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0cf, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
        halo.scale.set(3.4, 2.4, 1);
        halo.position.set(0, h / 2 + 0.7, 0.35);
        group.add(halo);
        const backWash = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(def.color), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })));
        backWash.scale.set(5.0, 4.0, 1);
        backWash.position.set(0, 0.1, -0.25);
        group.add(backWash);

        // placard
        const placardTex = track(makeTextTexture([{ text: project.title || "—", size: 34, bold: true }, { text: [project.category, project.year].filter(Boolean).join(" · ") || " ", size: 22, color: "#b9b2d0" }], 512, 220, def.color));
        const placard = new THREE.Mesh(planeGeo, track(new THREE.MeshBasicMaterial({ map: placardTex })));
        placard.scale.set(0.85, 0.36, 1);
        placard.position.set(side === -1 ? w / 2 - 0.1 : -w / 2 + 0.1, -h / 2 - 0.42, 0.03);
        group.add(placard);

        const forward = new THREE.Vector3().subVectors(lookAt, worldPos).setY(0).normalize();
        // natural viewing spot: VIEW_DIST off the wall, dead-center of
        // the piece, at eye height — the artwork frames the view nicely.
        const stand = new THREE.Vector3(
          worldPos.x + forward.x * VIEW_DIST,
          EYE,
          worldPos.z + forward.z * VIEW_DIST
        );
        artworks.push({ wing: def, layout, project, pos: worldPos, forward, spot: stand });
      }
    }

    artworks.push(deskEntry);

    // hub ring walls: fill the circle EXCEPT wing openings (cheap: full low ring)
    const ring = new THREE.Mesh(
      track(new THREE.CylinderGeometry(HUB_R, HUB_R, 5.6, 64, 1, true)),
      track(new THREE.MeshLambertMaterial({ color: 0x241f33, side: THREE.BackSide }))
    );
    ring.position.y = 2.8;
    scene.add(ring);
    // GATES: every wing entrance gets a proper doorway — two pillars, a
    // lintel in the wing color, a BIG readable sign above (bilingual style:
    // wing name large), and a soft light pool at the threshold.
    const pillarMat = track(new THREE.MeshLambertMaterial({ color: 0x332b4d }));
    for (const layout of layouts) {
      const perp = { x: -layout.dir.z, z: layout.dir.x };
      const color = new THREE.Color(layout.def.color);
      const lintelMat = track(new THREE.MeshLambertMaterial({ color }));
      const px = layout.dir.x * (HUB_R - 0.1);
      const pz = layout.dir.z * (HUB_R - 0.1);
      for (const side of [-1, 1] as const) {
        const pillar = new THREE.Mesh(boxGeo, pillarMat);
        pillar.scale.set(0.42, 3.6, 0.42);
        pillar.position.set(px + perp.x * side * (WING_W / 2 - 0.05), 1.8, pz + perp.z * side * (WING_W / 2 - 0.05));
        scene.add(pillar);
        // colored cap on each pillar
        const cap = new THREE.Mesh(boxGeo, lintelMat);
        cap.scale.set(0.5, 0.22, 0.5);
        cap.position.set(pillar.position.x, 3.62, pillar.position.z);
        scene.add(cap);
      }
      const lintel = new THREE.Mesh(boxGeo, lintelMat);
      lintel.scale.set(WING_W + 0.2, 0.34, 0.34);
      lintel.position.set(px, 3.45, pz);
      lintel.rotation.y = -layout.angle;
      scene.add(lintel);
      // BIG sign above the gate (name + direction hint)
      const signTex = track(makeTextTexture(
        [
          { text: layout.def.label, size: 58, bold: true },
          { text: fa ? "یک راهروی کامل از پروژه‌های همین بخش" : "a full corridor of this section's works", size: 22, color: "#cfc7e8" },
        ],
        1024, 360, layout.def.color
      ));
      const sign = new THREE.Mesh(planeGeo, track(new THREE.MeshBasicMaterial({ map: signTex, transparent: true })));
      sign.scale.set(4.4, 1.55, 1);
      sign.position.set(layout.dir.x * (HUB_R - 0.9), 4.35, layout.dir.z * (HUB_R - 0.9));
      sign.rotation.y = -layout.angle + Math.PI;
      scene.add(sign);
      // threshold glow
      const th = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(softRadialTexture()), color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
      th.scale.set(5.5, 2.2, 1);
      th.position.set(layout.dir.x * (HUB_R - 0.8), 0.35, layout.dir.z * (HUB_R - 0.8));
      scene.add(th);
    }

    /* ---------------- the intersection desk with the RÉSUMÉ BOOK ------ */
    // A reading desk at the hub center: wooden top + legs, a warm lamp,
    // and a DETAILED open book (angled covers, layered page blocks with
    // cream edge stripes, fanned inner pages, ribbon bookmark). Looking
    // at it and pressing Enter/tapping opens the owner's profile book.
    const deskGroup = new THREE.Group();
    scene.add(deskGroup);
    {
      const woodMat = track(new THREE.MeshLambertMaterial({ color: 0x4a3524 }));
      const woodDark = track(new THREE.MeshLambertMaterial({ color: 0x362718 }));
      const top = new THREE.Mesh(boxGeo, woodMat);
      top.scale.set(1.7, 0.09, 0.95);
      top.position.y = 0.98;
      deskGroup.add(top);
      for (const [lx, lz] of [[-0.72, -0.36], [0.72, -0.36], [-0.72, 0.36], [0.72, 0.36]] as const) {
        const leg = new THREE.Mesh(boxGeo, woodDark);
        leg.scale.set(0.09, 0.98, 0.09);
        leg.position.set(lx, 0.49, lz);
        deskGroup.add(leg);
      }
      // desk lamp glow
      const lampGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(softRadialTexture()), color: 0xffd9a0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
      lampGlow.scale.set(1.6, 1.6, 1);
      lampGlow.position.set(0.45, 1.35, -0.1);
      deskGroup.add(lampGlow);

      // ---- the open book ----
      const book = new THREE.Group();
      book.position.set(0, 1.06, 0.02);
      book.rotation.y = -0.35;
      deskGroup.add(book);
      const coverMat = track(new THREE.MeshLambertMaterial({ color: 0x5b2430 })); // deep leather red
      const pageMat = track(new THREE.MeshLambertMaterial({ color: 0xf3ecd8 }));
      const edgeMat = track(new THREE.MeshLambertMaterial({ color: 0xd8cfb2 }));
      const makeHalf = (side: -1 | 1) => {
        const half = new THREE.Group();
        // cover board (slightly larger, angled like a real open book)
        const cover = new THREE.Mesh(boxGeo, coverMat);
        cover.scale.set(0.48, 0.035, 0.64);
        cover.rotation.z = side * 0.16;
        half.add(cover);
        // page block with visible cream edges (3 stacked slabs, tiny offsets)
        for (let i = 0; i < 3; i++) {
          const slab = new THREE.Mesh(boxGeo, i === 0 ? pageMat : edgeMat);
          slab.scale.set(0.455 - i * 0.006, 0.016, 0.615 - i * 0.008);
          slab.position.y = 0.026 + i * 0.0165;
          slab.rotation.z = side * (0.16 + i * 0.012);
          half.add(slab);
        }
        // fanned top pages
        for (let i = 0; i < 3; i++) {
          const page = new THREE.Mesh(planeGeo, pageMat);
          page.scale.set(0.44 - i * 0.012, 0.6 - i * 0.02, 1);
          page.rotation.x = -Math.PI / 2 + side * 0.02;
          page.rotation.z = side * (0.05 + i * 0.018);
          page.position.set(side * i * 0.012, 0.082 + i * 0.004, 0);
          half.add(page);
        }
        half.position.x = side * 0.235;
        return half;
      };
      book.add(makeHalf(-1));
      book.add(makeHalf(1));
      // spine wedge in the middle
      const spine = new THREE.Mesh(boxGeo, coverMat);
      spine.scale.set(0.06, 0.05, 0.65);
      spine.position.y = 0.015;
      book.add(spine);
      // ribbon bookmark
      const ribbon = new THREE.Mesh(boxGeo, track(new THREE.MeshLambertMaterial({ color: 0xb9962f })));
      ribbon.scale.set(0.05, 0.012, 0.5);
      ribbon.position.set(0.12, 0.1, -0.12);
      ribbon.rotation.y = 0.3;
      book.add(ribbon);
      // soft light pool on the open pages
      const bookGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(softRadialTexture()), color: 0xfff2cd, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
      bookGlow.scale.set(1.5, 1.2, 1);
      bookGlow.position.set(0, 0.45, 0);
      book.add(bookGlow);
    }

    /* ---------------- ambience: light strips, baseboards, dust ------- */
    const stripMat = track(new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
    const boardMatByWing = new Map<string, THREE.MeshBasicMaterial>();
    for (const layout of layouts) {
      boardMatByWing.set(layout.def.id, track(new THREE.MeshBasicMaterial({ color: new THREE.Color(layout.def.color) })));
      // ceiling light strips every half-step along the corridor
      for (let d = HUB_R + 2; d < HUB_R + layout.length - 2; d += STEP / 2) {
        const strip = new THREE.Mesh(boxGeo, stripMat);
        strip.scale.set(1.6, 0.06, 0.22);
        strip.position.set(layout.dir.x * d, 3.32, layout.dir.z * d);
        strip.rotation.y = -layout.angle;
        scene.add(strip);
        // warm halo under each strip (soft, additive)
        const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(softRadialTexture()), color: 0xffdf9e, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })));
        halo.scale.set(3.4, 1.1, 1);
        halo.position.set(layout.dir.x * d, 3.1, layout.dir.z * d);
        scene.add(halo);
      }
      // colored baseboard (wayfinding line) along both walls
      const perp = { x: -layout.dir.z, z: layout.dir.x };
      const cx = layout.dir.x * (HUB_R + layout.length / 2 - 2);
      const cz = layout.dir.z * (HUB_R + layout.length / 2 - 2);
      const board = boardMatByWing.get(layout.def.id)!;
      for (const side of [-1, 1] as const) {
        const b = new THREE.Mesh(boxGeo, board);
        b.scale.set(layout.length - 1, 0.12, 0.05);
        b.position.set(cx + perp.x * side * (WING_W / 2 - 0.02), 0.1, cz + perp.z * side * (WING_W / 2 - 0.02));
        b.rotation.y = -layout.angle;
        scene.add(b);
      }
    }

    // floating dust motes in the light (soft round sprites, slow drift)
    const DUST = 130;
    const dustGeo = track(new THREE.BufferGeometry());
    const dustPos = new Float32Array(DUST * 3);
    const dustSeed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      const layout = layouts[i % layouts.length];
      const d = HUB_R + Math.random() * (layouts[0].length - 4);
      dustPos[i * 3] = layout.dir.x * d + (Math.random() - 0.5) * (WING_W - 1);
      dustPos[i * 3 + 1] = 0.4 + Math.random() * 2.6;
      dustPos[i * 3 + 2] = layout.dir.z * d + (Math.random() - 0.5) * (WING_W - 1);
      dustSeed[i] = Math.random() * Math.PI * 2;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = track(new THREE.PointsMaterial({
      map: track(softRadialTexture()), color: 0xffe8c4, size: 0.09, sizeAttenuation: true,
      transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    /* ---------------- player state & controls ---------------- */

    // Spawn INSIDE the visitor's own wing (the section whose gallery was
    // clicked), facing down its corridor — not the hub crossroads.
    const spawnWing = layouts.find((l) => l.def.id === spawnWingId) ?? layouts[0];
    const spawnAt = (l: WingLayout) => {
      const px = l.dir.x * (HUB_R + 2.2);
      const pz = l.dir.z * (HUB_R + 2.2);
      const yaw = Math.atan2(-l.dir.x, -l.dir.z);
      return { pos: new THREE.Vector3(px, EYE, pz), yaw };
    };
    const spawn = spawnAt(spawnWing);
    const player = {
      pos: spawn.pos.clone(),
      yaw: spawn.yaw,
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
      if (document.querySelector("[data-guard-dialog], [data-gallery-catalog], [data-museum-intro]")) { keys.clear(); return; }
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
      let best = -1, bestScore = 0.8;
      artworks.forEach((a, i) => {
        const to = new THREE.Vector3().subVectors(a.pos, player.pos).setY(0);
        const dist = to.length();
        const maxDist = a.wing.id === "__desk__" ? VIEW_DIST + 3.4 : VIEW_DIST + 2.6;
        if (dist > maxDist) return;
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
      const { onOpenCatalog: openCatalog, onRequestUnlock: requestUnlock, onOpenResumeBook: openResume } = interactRef.current;
      const def = a.wing;
      if (def.id === "__desk__") {
        // walk to the desk, face the open book, then open the profile book
        autoGoto.active = true;
        autoGoto.pos.copy(a.spot);
        autoGoto.yaw = Math.atan2((a.pos.x - a.spot.x), (a.pos.z - a.spot.z)) + Math.PI;
        autoGoto.then = () => openResume?.();
        return;
      }
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
    (window as unknown as { __museumTeleport?: (wingId: string) => boolean }).__museumTeleport = (wingId: string) => {
      const l = layouts.find((w) => w.def.id === wingId);
      if (!l) return false;
      const t = spawnAt(l);
      player.pos.copy(t.pos);
      player.yaw = t.yaw;
      player.pitch = 0;
      autoGoto.active = false;
      return true;
    };
    (window as unknown as { __museumDebug?: () => unknown }).__museumDebug = () => ({
      pos: [player.pos.x, player.pos.z], yaw: player.yaw,
      keys: [...keys], auto: autoGoto.active,
      areas: areas.length, arts: artworks.length,
    });

    /* ---------------- loop ---------------- */

    const clock = new THREE.Clock();
    let raf = 0;
    let contextLost = false;
    const onContextLost = (e: Event) => { e.preventDefault(); contextLost = true; };
    const onContextRestored = () => {
      contextLost = false;
      resize();
    };
    canvas.addEventListener("webglcontextlost", onContextLost as EventListener);
    canvas.addEventListener("webglcontextrestored", onContextRestored as EventListener);
    // returning from device deep-sleep: drop the accumulated delta so the
    // visitor doesn't teleport, and clear stuck keys.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clock.getDelta();
        keys.clear();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    let hudTick = 0;
    const tmpForward = new THREE.Vector3();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (contextLost) return; // wait for webglcontextrestored
      const dt = Math.min(0.05, clock.getDelta());

      // auto-goto (focus / interact): ease position + yaw
      if (autoGoto.active) {
        player.pos.x += (autoGoto.pos.x - player.pos.x) * Math.min(1, dt * 4.5);
        player.pos.z += (autoGoto.pos.z - player.pos.z) * Math.min(1, dt * 4.5);
        let dy = autoGoto.yaw - player.yaw;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        player.yaw += dy * Math.min(1, dt * 5);
        player.bob += dt * 7.5; // walking bob while gliding to a piece
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
              a.wing.id === "__desk__"
                ? { kind: "project" as const, title: fa ? "کتاب درباره من — رزومه و مشخصات" : "My book — profile & résumé", sub: fa ? "روی میز تقاطع" : "on the reading desk", wingLabel: a.wing.label }
                : a.wing.locked
                  ? { kind: "lockedWing" as const, title: a.wing.label, sub: fa ? "این بال با رمز قفل است — برای ورود رمز را وارد کنید" : "this wing is password-protected", wingLabel: a.wing.label }
                  : a.project.locked
                    ? { kind: "lockedProj" as const, title: a.project.title, sub: fa ? "این اثر محافظت‌شده است" : "this artwork is protected", wingLabel: a.wing.label }
                    : { kind: "project" as const, title: a.project.title, sub: [a.project.category, a.project.year].filter(Boolean).join(" · "), wingLabel: a.wing.label }
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

      // dust motes: slow rise + sway, wrap back down
      const dp = dustGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i++) {
        let y = dp.getY(i) + dt * 0.05;
        if (y > 3.2) y = 0.4;
        dp.setY(i, y);
        dp.setX(i, dp.getX(i) + Math.sin(clock.elapsedTime * 0.6 + dustSeed[i]) * dt * 0.02);
      }
      dp.needsUpdate = true;

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
      document.removeEventListener("visibilitychange", onVisible);
      canvas.removeEventListener("webglcontextlost", onContextLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onContextRestored as EventListener);
      canvas.removeEventListener("click", requestLock as EventListener);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      delete (window as unknown as { __museumJoy?: unknown }).__museumJoy;
      delete (window as unknown as { __museumInteract?: unknown }).__museumInteract;
      delete (window as unknown as { __museumDebug?: unknown }).__museumDebug;
      delete (window as unknown as { __museumTeleport?: unknown }).__museumTeleport;
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
  }, [wingsSignature, spawnWingId]);

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
              ? (focused.wingLabel === (fa ? "درباره من" : "About me")
                  ? (fa ? "باز کردن کتاب من" : "open my book")
                  : (fa ? "کاتالوگ اثر" : "open catalogue"))
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

      {/* wing guide — jump to another section's corridor */}
      {wings.length > 1 && (
        <div className="absolute end-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
          {wings.map((w) => {
            const active = w.id === spawnWingId;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  if (w.locked) { onRequestUnlock(`gallery:${w.id}`, w.label); return; }
                  setFade(true);
                  window.setTimeout(() => {
                    (window as unknown as { __museumTeleport?: (id: string) => boolean }).__museumTeleport?.(w.id);
                    setFade(false);
                    setToast(fa ? `ورود به ${w.label}` : `Entering ${w.label}`);
                    window.setTimeout(() => setToast(null), 2200);
                  }, 300);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold backdrop-blur transition",
                  active ? "border-white/40 bg-white/15 text-white" : "border-white/15 bg-black/45 text-white/70 hover:bg-black/65"
                )}
              >
                <span className="size-2 rounded-full" style={{ background: w.locked ? "#e8c46a" : w.color }} />
                <span className="max-w-20 truncate">{w.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* section-switch toast */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-full border border-white/20 bg-black/75 px-5 py-2 text-sm font-bold text-white backdrop-blur">
          {toast}
        </div>
      )}

      {/* teleport fade */}
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-40 bg-black transition-opacity duration-300", fade ? "opacity-100" : "opacity-0")} />

      {/* entrance guide */}
      {intro && (
        <div data-museum-intro className="absolute inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-md" onClick={() => setIntro(false)}>
          <div className="max-w-lg rounded-3xl border border-white/15 bg-[#141020]/95 p-8 text-center shadow-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/50">
              {fa ? "بازدید مجازی" : "virtual tour"}
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              {fa ? "به موزه سه‌بعدی خوش آمدید" : "Welcome to the 3D museum"}
            </h2>
            <p className="mt-3 text-xs leading-6 text-white/70">
              {fa
                ? "مثل یک گالری واقعی قدم بزنید؛ روبه‌روی هر اثر بایستید و کاتالوگش را ورق بزنید."
                : "Walk like a real gallery; stand in front of each piece and flip through its catalogue."}
            </p>
            <div className="mt-5 grid gap-2 text-start text-[11px] text-white/75">
              {(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) ? (
                <>
                  <p>🕹 {fa ? "دسته پایین صفحه = راه رفتن" : "Joystick (bottom) = walk"}</p>
                  <p>👆 {fa ? "کشیدن صفحه = چرخش نگاه" : "Drag = look around"}</p>
                  <p>👉 {fa ? "لمس اثر = نزدیک شدن و باز شدن کاتالوگ" : "Tap an artwork = walk in & open its catalogue"}</p>
                  <p>🧭 {fa ? "راهنمای کنار صفحه = پرش به بخش‌های دیگر" : "Side guide = jump between wings"}</p>
                </>
              ) : (
                <>
                  <p>🖱️ {fa ? "کلیک = قفل موس و نگاه · WASD = راه رفتن" : "Click = mouse-look lock · WASD = walk"}</p>
                  <p>⌨️ {fa ? "Tab = روبروی اثر بعدی · Enter = کاتالوگ" : "Tab = face next piece · Enter = catalogue"}</p>
                  <p>📖 {fa ? "در کاتالوگ، صفحه را با موس بکشید و ورق بزنید" : "In the catalogue, drag the page to flip it"}</p>
                  <p>🧭 {fa ? "راهنمای کنار صفحه = پرش به بخش‌های دیگر" : "Side guide = jump between wings"}</p>
                </>
              )}
            </div>
            <button type="button" className="mt-6 rounded-full bg-white px-8 py-3 text-sm font-black text-black transition hover:bg-white/85">
              {fa ? "شروع بازدید" : "Start the tour"}
            </button>
          </div>
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
