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
    scene.fog = new THREE.Fog("#0b0913", 30, 90);

    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.1, 120);

    scene.add(new THREE.AmbientLight(0xffffff, 1.25));
    scene.add(new THREE.HemisphereLight(0xe8e2ff, 0x2c2640, 0.75));

    /* ---- materials & geometry pools (for dispose) ---- */
    const disposables: Array<THREE.Texture | THREE.Material | THREE.BufferGeometry> = [];
    const track = <T extends THREE.Texture | THREE.Material | THREE.BufferGeometry>(x: T): T => { disposables.push(x); return x; };

    const floorTex = track(placeholderTexture("#3a3350"));
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(40, 40);
    const floorMat = track(new THREE.MeshLambertMaterial({ map: floorTex }));
    // DoubleSide on room surfaces + artworks: nothing ever "disappears"
    // when viewed from behind (robust against any camera/position edge case).
    const wallMat = track(new THREE.MeshLambertMaterial({ color: 0x5c547e, side: THREE.DoubleSide }));
    const ceilMat = track(new THREE.MeshLambertMaterial({ color: 0x2b2540, side: THREE.DoubleSide }));
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

    /* ---- walkable collision: corridor strips + hub circle ----
     * Semantics matter here. A union of shrunken areas (old approach) leaves
     * thin "outside everywhere" seams; any seam meant the recovery lerp yanked
     * the visitor out of the corridor. Instead walkable() is defined by the
     * WALLS: you may stand anywhere inside a corridor strip or inside the hub
     * circle, except behind a corridor's wall planes (the old see-through
     * leak). Walking hub↔corridor is then seamless by construction. */
    type Collider = { dir: { x: number; z: number }; perp: { x: number; z: number }; alongMin: number; alongMax: number; halfW: number; wallStart: number; wallPlane: number };
    const colliders: Collider[] = [];
    const HUB_WALK = HUB_R - 0.42; // ring wall at HUB_R, keep a body radius
    // per-frame animation hooks (portals swirl, hologram spins, book bobs)
    const animated: ((t: number, dt: number) => void)[] = [];

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
      pos: new THREE.Vector3(0, 1.5, 0),
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

      // walls — CRITICAL orientation fix: each wall plane must FACE the
      // corridor interior. The old formula (-angle ± π/2) pointed both walls
      // ALONG the corridor, so from inside you saw a black void (backfaces
      // are culled) and artworks appeared to float in nothing.
      // Inward normal for side: -side * perp = (side*sin a, -side*cos a)
      // → rotation.y = atan2(side*sin a, -side*cos a).
      for (const side of [-1, 1] as const) {
        const wall = new THREE.Mesh(planeGeo, wallMat);
        wall.scale.set(length, 3.4, 1);
        wall.position.set(
          dir.x * (HUB_R + length / 2 - 2) + perp.x * side * (WING_W / 2),
          1.7,
          dir.z * (HUB_R + length / 2 - 2) + perp.z * side * (WING_W / 2)
        );
        wall.rotation.y = Math.atan2(side * Math.sin(layout.angle), -side * Math.cos(layout.angle));
        scene.add(wall);
      }
      // end wall with the wing title
      const titleTex = track(makeTextTexture(
        [{ text: def.label, size: 44, bold: true }, { text: fa ? `${def.projects.length} اثر` : `${def.projects.length} works`, size: 24, color: "#b9b2d0" }],
        1024, 512, def.color
      ));
      const endWall = new THREE.Mesh(planeGeo, track(new THREE.MeshBasicMaterial({ map: titleTex, side: THREE.DoubleSide })));
      endWall.scale.set(WING_W, 2.8, 1);
      endWall.position.set(dir.x * (HUB_R + length - 2), 1.7, dir.z * (HUB_R + length - 2));
      // face back toward the hub: normal = -dir
      endWall.rotation.y = Math.atan2(-dir.x, -dir.z);
      scene.add(endWall);

      // corridor collider. Axis coordinates: along = distance from the hub
      // center along `dir`, across = sideways distance from the axis.
      //   alongMin 3.6  — walkable before the walls visually start (HUB_R−2),
      //                    so the gate throat is one continuous floor.
      //   halfW         — wall at ±WING_W/2 minus a 0.42 body radius.
      //   wallPlane     — where the visible wall plane sits; hub points
      //                    beyond it (and past wallStart) are behind the wall.
      colliders.push({
        dir, perp,
        alongMin: HUB_R - 2.6,
        alongMax: HUB_R + length - 2.4,
        halfW: WING_W / 2 - 0.42,
        wallStart: HUB_R - 2,
        wallPlane: WING_W / 2,
      });

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

        const artMat = track(new THREE.MeshBasicMaterial({ map: track(placeholderTexture(project.color || def.color)), side: THREE.DoubleSide }));
        const art = new THREE.Mesh(planeGeo, artMat);
        art.scale.set(w, h, 1);
        group.add(art);

        if (project.locked) {
          const lockTex = track(makeTextTexture([{ text: project.title || (fa ? "اثر محافظت‌شده" : "Protected"), size: 40, bold: true }, { text: fa ? "قفل با رمز" : "password-protected", size: 24, color: "#e8c46a" }], 512, 384, def.color));
          art.material = track(new THREE.MeshBasicMaterial({ map: lockTex, side: THREE.DoubleSide }));
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

    // hub ring walls: ARC SEGMENTS with REAL gate openings. A full cylinder
    // here (old cheap version) put an opaque wall across every gate opening —
    // from the hub each corridor read as a black wall and the portals were
    // hidden behind it (BackSide culled from the corridor side, which made
    // the bug one-sided and confusing).
    const ringMat = track(new THREE.MeshLambertMaterial({ color: 0x241f33, side: THREE.DoubleSide }));
    const gateHalfAngle = (WING_W / 2 + 0.7) / HUB_R; // gate opening half-angle at ring radius
    {
      // cylinder-θ convention: x = R·sinθ, z = R·cosθ → θ_wing = π/2 − angle
      const thetas = layouts.map((l) => Math.PI / 2 - l.angle).sort((a, b) => a - b);
      for (let i = 0; i < thetas.length; i++) {
        const t1 = thetas[i], t2 = thetas[(i + 1) % thetas.length];
        let gap = t2 - t1;
        if (gap <= 0) gap += Math.PI * 2;
        const start = t1 + gateHalfAngle;
        const len = gap - 2 * gateHalfAngle;
        if (len <= 0.03) continue; // wings too close — no wall segment fits
        const seg = new THREE.Mesh(
          track(new THREE.CylinderGeometry(HUB_R, HUB_R, 5.6, Math.max(8, Math.ceil(64 * (len / (Math.PI * 2)))), 1, true, start, len)),
          ringMat
        );
        seg.position.y = 2.8;
        scene.add(seg);
      }
    }
    // GATES: every wing entrance gets a proper doorway — two pillars, a
    // lintel in the wing color, a BIG readable sign above (bilingual style:
    // wing name large), and a soft light pool at the threshold.
    const pillarMat = track(new THREE.MeshLambertMaterial({ color: 0x332b4d }));
    for (const layout of layouts) {
      const perp = { x: -layout.dir.z, z: layout.dir.x };
      const color = new THREE.Color(layout.def.color);
      const lintelMat = track(new THREE.MeshBasicMaterial({ color })); // self-lit: readable from anywhere in the hub
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
      // lintel + floor bar span ACROSS the gate (along `perp`): rotation.y = φ
      // maps the box's +x axis to (cos φ, −sin φ), so align it with perp
      // (−sin a, cos a) via φ = atan2(−cos a, −sin a). (-angle pointed them
      // ALONG the corridor — the stray diagonal beam bug.)
      const acrossRot = Math.atan2(-Math.cos(layout.angle), -Math.sin(layout.angle));
      const lintel = new THREE.Mesh(boxGeo, lintelMat);
      lintel.scale.set(WING_W + 0.2, 0.34, 0.34);
      lintel.position.set(px, 3.45, pz);
      lintel.rotation.y = acrossRot;
      scene.add(lintel);
      // BIG sign above the gate (name + direction hint)
      const signTex = track(makeTextTexture(
        [
          { text: layout.def.label, size: 58, bold: true },
          { text: fa ? "یک راهروی کامل از پروژه‌های همین بخش" : "a full corridor of this section's works", size: 22, color: "#cfc7e8" },
        ],
        1024, 360, layout.def.color
      ));
      const sign = new THREE.Mesh(planeGeo, track(new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide })));
      sign.scale.set(4.4, 1.55, 1);
      sign.position.set(layout.dir.x * (HUB_R - 0.9), 4.35, layout.dir.z * (HUB_R - 0.9));
      sign.rotation.y = Math.atan2(-layout.dir.x, -layout.dir.z);
      scene.add(sign);
      // threshold glow + a bright floor BAR across the gate opening so the
      // entrance reads as a doorway from anywhere in the hub
      const th = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(softRadialTexture()), color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })));
      th.scale.set(6.5, 2.6, 1);
      th.position.set(layout.dir.x * (HUB_R - 0.8), 0.4, layout.dir.z * (HUB_R - 0.8));
      scene.add(th);
      const bar = new THREE.Mesh(boxGeo, track(new THREE.MeshBasicMaterial({ color })));
      bar.scale.set(WING_W - 0.1, 0.05, 0.34);
      bar.position.set(layout.dir.x * (HUB_R - 0.02), 0.03, layout.dir.z * (HUB_R - 0.02));
      bar.rotation.y = acrossRot;
      scene.add(bar);

      /* ---- GLOWING ENERGY PORTAL filling the gate opening ----
       * From the hub a corridor reads as a black rectangle (walls/floor are
       * grazing-angle, the far end is fogged). A swirling FBM-noise portal
       * plane fills the opening with animated wing-colored energy instead —
       * the classic sci-fi recipe: polar swirl + layered fbm + rim glow
       * (cf. tekblueprint.org vignette-portal / vortex ShaderMaterial demos). */
      const portalVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
      const portalFrag = `
        uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
        void main(){
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          float ang = atan(p.y, p.x);
          float swirl = ang + uTime * 0.45 + (1.0 - r) * 2.6;
          float n  = fbm(vec2(cos(swirl), sin(swirl)) * 2.2 + vec2(0.0, r * 5.0 - uTime * 0.9));
          float n2 = fbm(vec2(cos(swirl * 1.7 + 1.3), sin(swirl * 1.7)) * 3.1 - vec2(0.0, r * 7.0 + uTime * 0.6));
          float energy = n * 0.75 + n2 * 0.55;
          float rim  = smoothstep(0.5, 1.0, r);
          float core = smoothstep(1.0, 0.3, r);
          float pulse = 0.9 + 0.1 * sin(uTime * 2.1);
          float alpha = clamp(energy * (0.8 + rim * 0.85) * (0.3 + core * 0.7) + rim * 0.42, 0.0, 0.82) * pulse;
          vec3 col = uColor * (0.6 + energy * 1.0) + vec3(1.0) * rim * 0.2;
          gl_FragColor = vec4(col * alpha, alpha);
        }`;
      const portalMat = track(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: Math.random() * 20 }, uColor: { value: new THREE.Color(layout.def.color) } },
        vertexShader: portalVert,
        fragmentShader: portalFrag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }));
      const portal = new THREE.Mesh(planeGeo, portalMat);
      portal.scale.set(WING_W - 0.45, 3.15, 1);
      portal.position.set(layout.dir.x * (HUB_R + 0.18), 1.62, layout.dir.z * (HUB_R + 0.18));
      portal.rotation.y = Math.atan2(-layout.dir.x, -layout.dir.z); // face the hub (DoubleSide: visible from inside too)
      scene.add(portal);
      // portal frame light: colored spill onto the hub floor + corridor mouth
      const portalLight = new THREE.PointLight(color, 16, 10, 1.8);
      portalLight.position.set(layout.dir.x * (HUB_R + 1.4), 2.0, layout.dir.z * (HUB_R + 1.4));
      scene.add(portalLight);
      // three glow orbs orbiting the opening (visible motion around the frame)
      const orbMat = track(new THREE.SpriteMaterial({ map: track(softRadialTexture()), color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      const orbPhase = Math.random() * Math.PI * 2;
      const orbs: THREE.Sprite[] = [];
      for (let k = 0; k < 3; k++) {
        const orb = new THREE.Sprite(orbMat);
        orb.scale.set(0.5, 0.5, 1);
        scene.add(orb);
        orbs.push(orb);
      }
      const portalCenter = portal.position.clone();
      const orbRX = (WING_W - 0.45) / 2 + 0.28, orbRY = 3.15 / 2 + 0.24;
      const perpV = new THREE.Vector3(perp.x, 0, perp.z);
      animated.push((t) => {
        portalMat.uniforms.uTime.value = t;
        for (let k = 0; k < orbs.length; k++) {
          const a = t * 0.55 + orbPhase + (k * Math.PI * 2) / orbs.length;
          orbs[k].position.set(
            portalCenter.x + perpV.x * Math.cos(a) * orbRX,
            1.62 + Math.sin(a) * orbRY,
            portalCenter.z + perpV.z * Math.cos(a) * orbRX,
          );
        }
      });
    }

    /* ---------------- the intersection HOLO-PEDESTAL with the RÉSUMÉ BOOK */
    // Sci-fi reading station at the hub center: a dark glass pedestal with
    // glowing rings, the open résumé book LEVITATING above it (gentle bob),
    // and a cyan light hologram rising over the book — volumetric cone,
    // wireframe globe, counter-rotating orbit rings, floating sparks.
    // Enter/tap still opens the owner's profile book.
    const deskGroup = new THREE.Group();
    scene.add(deskGroup);
    {
      const HOLO = 0x67e8f9; // hologram cyan
      // ---- pedestal ----
      const pedMat = track(new THREE.MeshLambertMaterial({ color: 0x211c33 }));
      const pedestal = new THREE.Mesh(boxGeo, pedMat);
      pedestal.scale.set(1.5, 0.86, 1.1);
      pedestal.position.y = 0.43;
      deskGroup.add(pedestal);
      const chamfer = new THREE.Mesh(boxGeo, track(new THREE.MeshLambertMaterial({ color: 0x2c2544 })));
      chamfer.scale.set(1.62, 0.1, 1.2);
      chamfer.position.y = 0.9;
      deskGroup.add(chamfer);
      // glowing rim rings (cyan + gold) on the chamfer and the floor
      const ringFlat = track(new THREE.RingGeometry(0.42, 0.5, 48));
      const rimMat = track(new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const rim = new THREE.Mesh(ringFlat, rimMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.96;
      rim.scale.set(1.55, 1.15, 1);
      deskGroup.add(rim);
      const goldRingMat = track(new THREE.MeshBasicMaterial({ color: 0xc9a24b, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const floorRing1 = new THREE.Mesh(ringFlat, goldRingMat);
      floorRing1.rotation.x = -Math.PI / 2;
      floorRing1.position.y = 0.02;
      floorRing1.scale.set(2.5, 2.5, 1);
      deskGroup.add(floorRing1);
      const floorRing2 = new THREE.Mesh(ringFlat, track(new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      floorRing2.rotation.x = -Math.PI / 2;
      floorRing2.position.y = 0.025;
      floorRing2.scale.set(3.3, 3.3, 1);
      deskGroup.add(floorRing2);
      // hologram emitter puck on the pedestal
      const emitter = new THREE.Mesh(boxGeo, track(new THREE.MeshBasicMaterial({ color: HOLO })));
      emitter.scale.set(0.34, 0.05, 0.24);
      emitter.position.set(0, 0.985, 0);
      deskGroup.add(emitter);

      // ---- the levitating open book ----
      const book = new THREE.Group();
      book.position.set(0, 1.5, 0);
      book.rotation.y = -0.35;
      deskGroup.add(book);
      const coverMat = track(new THREE.MeshLambertMaterial({ color: 0x1e2a3a })); // midnight blue leather
      const trimMat = track(new THREE.MeshBasicMaterial({ color: HOLO }));        // glowing cyan trim
      const pageMat = track(new THREE.MeshLambertMaterial({ color: 0xf6efdc }));
      const edgeMat = track(new THREE.MeshLambertMaterial({ color: 0xd8cfb2 }));
      const goldMat = track(new THREE.MeshLambertMaterial({ color: 0xc9a24b }));
      const makeHalf = (side: -1 | 1) => {
        const half = new THREE.Group();
        const cover = new THREE.Mesh(boxGeo, coverMat);
        cover.scale.set(0.48, 0.035, 0.64);
        cover.rotation.z = side * 0.16;
        half.add(cover);
        // glowing trim along the cover's outer edge
        const trim = new THREE.Mesh(boxGeo, trimMat);
        trim.scale.set(0.03, 0.04, 0.645);
        trim.position.set(side * 0.24, 0, 0);
        trim.rotation.z = side * 0.16;
        half.add(trim);
        for (let i = 0; i < 3; i++) {
          const slab = new THREE.Mesh(boxGeo, i === 0 ? pageMat : edgeMat);
          slab.scale.set(0.455 - i * 0.006, 0.016, 0.615 - i * 0.008);
          slab.position.y = 0.026 + i * 0.0165;
          slab.rotation.z = side * (0.16 + i * 0.012);
          half.add(slab);
        }
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
      const spine = new THREE.Mesh(boxGeo, coverMat);
      spine.scale.set(0.06, 0.05, 0.65);
      spine.position.y = 0.015;
      book.add(spine);
      const ribbon = new THREE.Mesh(boxGeo, goldMat);
      ribbon.scale.set(0.05, 0.012, 0.5);
      ribbon.position.set(0.12, 0.1, -0.12);
      ribbon.rotation.y = 0.3;
      book.add(ribbon);
      // glow under the pages + hovering light
      const bookGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(softRadialTexture()), color: 0xfff2cd, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false })));
      bookGlow.scale.set(1.6, 1.1, 1);
      bookGlow.position.set(0, -0.18, 0);
      book.add(bookGlow);

      // ---- the hologram above the book ----
      const holoMats: THREE.MeshBasicMaterial[] = [];
      const holoMat = (opacity: number) => {
        const m = track(new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, wireframe: false }));
        holoMats.push(m);
        return m;
      };
      // volumetric light cone rising from the emitter (two nested cones)
      const coneGeo = track(new THREE.ConeGeometry(0.62, 2.0, 40, 1, true));
      const coneOuter = new THREE.Mesh(coneGeo, holoMat(0.09));
      coneOuter.position.set(0, 2.15, 0);
      deskGroup.add(coneOuter);
      const coneInner = new THREE.Mesh(track(new THREE.ConeGeometry(0.34, 2.0, 32, 1, true)), holoMat(0.15));
      coneInner.position.set(0, 2.15, 0);
      deskGroup.add(coneInner);
      // wireframe globe (the hologram core) + bright inner core
      const globe = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.36, 1)), (() => {
        const m = track(new THREE.MeshBasicMaterial({ color: 0x8df5ff, wireframe: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
        holoMats.push(m);
        return m;
      })());
      globe.position.set(0, 2.85, 0);
      deskGroup.add(globe);
      const coreMat = holoMat(0.9);
      const core = new THREE.Mesh(track(new THREE.SphereGeometry(0.1, 16, 12)), coreMat);
      core.position.copy(globe.position);
      deskGroup.add(core);
      // counter-rotating orbit rings
      const torusGeo = track(new THREE.TorusGeometry(0.5, 0.009, 8, 56));
      const orbitA = new THREE.Mesh(torusGeo, holoMat(0.75));
      orbitA.position.copy(globe.position);
      orbitA.rotation.x = Math.PI / 2 - 0.45;
      deskGroup.add(orbitA);
      const orbitB = new THREE.Mesh(torusGeo, holoMat(0.55));
      orbitB.position.copy(globe.position);
      orbitB.rotation.x = Math.PI / 2 + 0.5;
      orbitB.rotation.y = 0.6;
      deskGroup.add(orbitB);
      // soft hologram aura sprite
      const holoAura = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(softRadialTexture()), color: HOLO, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
      holoAura.scale.set(1.7, 1.7, 1);
      holoAura.position.copy(globe.position);
      deskGroup.add(holoAura);
      // hologram light spill
      const holoLight = new THREE.PointLight(HOLO, 10, 7, 1.8);
      holoLight.position.set(0, 2.6, 0);
      deskGroup.add(holoLight);

      // stash base opacities for the flicker loop (holoMats filled above)
      const holoBase = holoMats.map((m) => m.opacity);

      // ---- per-frame animation: bob, slow display spin, flicker ----
      animated.push((t, dt) => {
        book.position.y = 1.5 + Math.sin(t * 1.1) * 0.055;
        book.rotation.y = t * 0.28; // levitating display: never stuck edge-on
        book.rotation.z = Math.sin(t * 0.7) * 0.015;
        globe.rotation.y += dt * 0.7;
        globe.rotation.x = Math.sin(t * 0.5) * 0.2;
        orbitA.rotation.z += dt * 0.9;
        orbitB.rotation.z -= dt * 0.65;
        orbitB.rotation.y = 0.6 + Math.sin(t * 0.3) * 0.25;
        core.scale.setScalar(0.8 + 0.25 * Math.sin(t * 3.2));
        // hologram scan flicker: subtle high-frequency shimmer + slow breathing
        const flick = 0.9 + 0.1 * Math.sin(t * 21.0) * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 1.4);
        for (let i = 0; i < holoMats.length; i++) holoMats[i].opacity = Math.min(1, holoBase[i] * flick);
        rimMat.opacity = 0.75 + 0.25 * Math.sin(t * 2.2);
      });
    }

    // Warm point lights down each corridor so the walkways read as lit
    // rooms from the hub (MeshLambert is per-vertex — cheap for 1 core).
    for (const layout of layouts) {
      const steps = Math.max(2, Math.ceil(layout.length / 7));
      for (let i = 1; i <= steps; i++) {
        const pl = new THREE.PointLight(0xffe2b8, 30, 11, 1.8);
        pl.position.set(layout.dir.x * (HUB_R + 2 + (i - 0.5) * (layout.length / steps)), 2.9, layout.dir.z * (HUB_R + 2 + (i - 0.5) * (layout.length / steps)));
        scene.add(pl);
      }
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
    const autoGoto = { active: false, pos: new THREE.Vector3(), yaw: 0, then: null as null | (() => void), deadline: 0 };

    const walkable = (x: number, z: number): boolean => {
      // hologram pedestal footprint at the hub center (stop before it)
      if (Math.abs(x) < 0.9 && Math.abs(z) < 0.68) return false;
      // Inside a corridor strip?
      for (const c of colliders) {
        const along = x * c.dir.x + z * c.dir.z;
        if (along < c.alongMin || along > c.alongMax) continue;
        const across = x * c.perp.x + z * c.perp.z;
        if (Math.abs(across) <= c.halfW) return true;
      }
      // Hub circle — but never behind a corridor wall plane.
      for (const c of colliders) {
        if (x * c.dir.x + z * c.dir.z > c.wallStart) {
          const across = x * c.perp.x + z * c.perp.z;
          if (Math.abs(across) > c.wallPlane) return false;
        }
      }
      return x * x + z * z <= HUB_WALK * HUB_WALK;
    };

    const movePlayer = (dx: number, dz: number) => {
      if (!walkable(player.pos.x, player.pos.z)) {
        // Last-resort recovery only — with wall-based walkable() a legal
        // move can never leave the building, so this stays silent.
        player.pos.x += (0 - player.pos.x) * 0.05;
        player.pos.z += (0 - player.pos.z) * 0.05;
        return;
      }
      if (walkable(player.pos.x + dx, player.pos.z)) player.pos.x += dx;
      if (walkable(player.pos.x, player.pos.z + dz)) player.pos.z += dz;
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
    // When the catalogue book or a PIN dialog opens, RELEASE the mouse so
    // the visitor can flip pages / type. Re-lock by clicking the canvas.
    const overlayWatcher = window.setInterval(() => {
      if (document.querySelector("[data-gallery-catalog], [data-guard-dialog]")) {
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
        keys.clear();
      }
    }, 250);

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
      autoGoto.deadline = Date.now() + 2600;
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
        autoGoto.deadline = Date.now() + 2600;
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
      autoGoto.deadline = Date.now() + 2600;
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
      walkable: walkable(player.pos.x, player.pos.z),
      colliders: colliders.length, arts: artworks.length,
      portals: scene.children.filter((o) => (o as THREE.Mesh).material && (o as THREE.Mesh).material instanceof THREE.ShaderMaterial).length,
      drawCalls: renderer.info.render.calls,
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

      // auto-goto (focus / interact): glide position + yaw, but CLAMPED to
      // the walkable areas — the glide slides along walls instead of
      // phasing through them (a straight lerp crossed whole corridors).
      if (autoGoto.active) {
        const k = Math.min(1, dt * 4.5);
        const nx = player.pos.x + (autoGoto.pos.x - player.pos.x) * k;
        const nz = player.pos.z + (autoGoto.pos.z - player.pos.z) * k;
        if (walkable(nx, player.pos.z)) player.pos.x = nx;
        if (walkable(player.pos.x, nz)) player.pos.z = nz;
        let dy = autoGoto.yaw - player.yaw;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        player.yaw += dy * Math.min(1, dt * 5);
        player.bob += dt * 7.5; // walking bob while gliding to a piece
        // If walls make the direct path unreachable, don't slide forever:
        // after the deadline, run the callback wherever the player stands.
        if (Date.now() > autoGoto.deadline) {
          autoGoto.active = false;
          autoGoto.then?.();
          autoGoto.then = null;
        } else if (Math.abs(dy) < 0.03 && Math.hypot(autoGoto.pos.x - player.pos.x, autoGoto.pos.z - player.pos.z) < 0.08) {
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

      // portals swirl, hologram spins, book bobs (registered closures)
      for (const fn of animated) fn(clock.elapsedTime, dt);

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
      window.clearInterval(overlayWatcher);
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
