"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpLeft, Palette, PenTool, Layers, Brush, ArrowLeft, Frame } from "lucide-react";
import * as THREE from "three";
import { SectionHeading, TiltCard, Reveal, Chip } from "./section-utils";
import { useContent } from "@/lib/content-store";
import { makeFrameGate } from "@/lib/anim";
import { VirtualGallery } from "./virtual-gallery";
import { useGalleryGate } from "./section-guard";
import { Ambient3DObject } from "./ambient-3d-object";
import type { SceneObject3DConfig } from "@/lib/content-types";
import type { GalleryLayout } from "@/lib/content-types";

export function GraphicsSection() {
  const g = useContent((s) => s.content.graphics);
  const lang = useContent((s) => s.lang);
  const objects = useContent((s) => s.content.design?.objects ?? []);
  const mainObject = findSceneObject(objects, "graphics-main");
  const ambientObject = findSceneObject(objects, "graphics-ambient");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const graphicsGallery = useGalleryGate("graphics", "Graphics");

  return (
    <section
      id="graphics"
      data-cursor-zone="gfx"
      className="relative overflow-hidden px-5 py-24 md:py-32"
    >
      {/* identity background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-32 top-1/4 h-[40rem] w-[40rem] rounded-full blur-[140px] animate-aurora"
          style={{
            background: "radial-gradient(circle, var(--gfx-1), transparent 60%)",
            opacity: "var(--aurora-opacity)",
          }}
        />
        <div
          className="absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full blur-[120px] animate-aurora"
          style={{
            background: "radial-gradient(circle, var(--gfx-3), transparent 60%)",
            opacity: "var(--aurora-opacity)",
            animationDelay: "-8s",
          }}
        />
        <div
          className="grid-bg absolute inset-0 opacity-40"
          style={{ maskImage: "radial-gradient(ellipse at 70% 30%, black, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        {ambientObject?.enabled !== false && (
          <Ambient3DObject variant="crystal" config={ambientObject} className="hidden lg:block" defaultPlacement={{ side: "end", top: 9, offset: -6, size: 236 }} />
        )}
        <div data-cms-node="heading"><SectionHeading index={g.index} kickerEn={g.kicker} accent="var(--gfx-1)" title={g.title} highlight={g.highlight} subtitle={g.subtitle} /></div>

        {/* Enter 3D virtual gallery + full gallery buttons */}
        <Reveal delay={0.1}>
          <div data-cms-node="gallery-button" className="mb-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => graphicsGallery.gate(() => setGalleryOpen(true))}
              data-cursor-hover
              className="btn-outline-gfx group flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
            >
              <Frame
                className="h-4 w-4 transition-transform group-hover:rotate-3"
                style={{ color: "var(--gfx-1)" }}
              />
              {g.gallery.enterLabel}
            </button>
          </div>
        </Reveal>

        {/* Liquid morph object + projects grid (no rectangle cover) */}
        <div data-cms-node="portfolio-grid" className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <div data-cms-node="primary-object" data-cms-object className="flex items-center justify-center lg:sticky lg:top-20 py-8">
              <LiquidMorphObject config={mainObject} />
            </div>
          </Reveal>

          {/* Projects grid */}
          <div data-cms-node="projects" className="grid gap-5 sm:grid-cols-2">
            {g.projects.map((p, i) => (
              <Reveal key={p.title + i} delay={i * 0.1} className="h-full">
                <TiltCard
                  max={8}
                  className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card/75 p-5 backdrop-blur-sm"
                >
                  <div
                    className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `linear-gradient(135deg, var(--gfx-1), var(--gfx-3))`,
                      maskImage: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                      WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                      maskComposite: "exclude",
                      WebkitMaskComposite: "xor",
                      padding: "1px",
                    }}
                  />
                  <div className="relative">
                    <div className="mb-4 flex items-start justify-between">
                      <div
                        className="grid h-10 w-10 place-items-center rounded-xl"
                        style={{
                          background:
                            "linear-gradient(135deg, color-mix(in oklch, var(--gfx-1) 25%, transparent), color-mix(in oklch, var(--gfx-3) 25%, transparent))",
                          border: "1px solid color-mix(in oklch, var(--gfx-1) 40%, transparent)",
                        }}
                      >
                        <PenTool className="h-4 w-4" style={{ color: "var(--gfx-1)" }} />
                      </div>
                      <ArrowUpLeft className="h-4 w-4 -translate-x-1 translate-y-1 text-muted-foreground transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-[var(--gfx-1)]" />
                    </div>
                    <div
                      className="mb-1 font-mono text-[10px] uppercase tracking-widest"
                      style={{ color: "color-mix(in oklch, var(--gfx-1) 80%, transparent)" }}
                    >
                      {p.cat}
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-foreground">{p.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="rounded-full border border-border bg-surface-1 px-2.5 py-0.5 text-[10px] text-muted-foreground">
                        {p.tag}
                      </span>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}

            {/* Section-colored CTA — opens the full gallery */}
            <Reveal delay={0.3} className="sm:col-span-2">
              <button
                onClick={() => graphicsGallery.gate(() => setGalleryOpen(true))}
                data-cursor-hover
                className="btn-solid-gfx group flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold transition-transform hover:scale-[1.01]"
              >
                {g.cta.label}
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              </button>
            </Reveal>
          </div>
        </div>

        {/* Tools strip */}
        <Reveal delay={0.2} className="mt-14">
          <div data-cms-node="tools" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-1 p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Palette className="h-4 w-4" style={{ color: "var(--gfx-1)" }} />
              {lang === "fa" ? "ابزارها:" : "Tools:"}
            </div>
            {g.tools.map((t) => (
              <Chip key={t} color="var(--gfx-1)">
                {t}
              </Chip>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Project gallery full-screen overlay */}
      <AnimatePresence>
        {graphicsGallery.node}
        {galleryOpen && (
          <VirtualGallery
            layout={(g.gallery as { layout?: GalleryLayout }).layout}
            projects={g.gallery.projects}
            title={g.gallery.title}
            subtitle={g.gallery.subtitle}
            onClose={() => { setGalleryOpen(false); graphicsGallery.onPopupClose(); }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ============================================================
   LiquidMorphObject — amorphous glass + moving magma lights.
   ============================================================ */
const GLASS_COLORS = ["#e84a9b", "#ff9f3b", "#16d6c3", "#4a8aff", "#b14ae8", "#3ee08a"];

function findSceneObject(objects: SceneObject3DConfig[], slot: SceneObject3DConfig["slot"]) {
  return objects.find((object) => object.slot === slot);
}

function LiquidMorphObject({ config }: { config?: Partial<SceneObject3DConfig> | null }) {
  const lang = useContent((s) => s.lang);
  const containerRef = useRef<HTMLDivElement>(null);
  const [morphIndex, setMorphIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  // WebGL contexts are capped per page — only build this heavy scene when
  // its container is near the viewport, and tear it down (freeing the GL
  // context) when it is scrolled far away.
  // CMS frame-rate cap — throttles the per-frame vertex morphing loop.
  const frameRate = useContent((s) => s.content.builder?.performance?.frameRate);
  const fpsRef = useRef(frameRate);
  const inViewRef = useRef(false);
  useEffect(() => {
    fpsRef.current = frameRate;
  }, [frameRate]);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) return;
    const io = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
    }, { rootMargin: "600px 0px" });
    io.observe(mount);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 12);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const key = new THREE.PointLight(0xffffff, 18, 40);
    key.position.set(-4, 5, 8);
    scene.add(key);
    const fill = new THREE.PointLight(0x7de8ff, 18, 38);
    fill.position.set(5, -2, 6);
    scene.add(fill);

    const colors = [
      config?.colorA || GLASS_COLORS[0],
      config?.colorB || GLASS_COLORS[1],
      config?.colorC || GLASS_COLORS[2],
      ...GLASS_COLORS.slice(3),
    ];
    const accent = new THREE.Color(colors[morphIndex % colors.length]);
    const hot = new THREE.Color(colors[(morphIndex + 1) % colors.length]);
    const cool = new THREE.Color(colors[(morphIndex + 3) % colors.length]);

    // Detail 5 (≈ 20·5² = 500 faces) is visually identical to 8 here but
    // cuts the per-frame JS vertex-morph loop and normal recomputes by ~60%.
    const blobGeometry = new THREE.IcosahedronGeometry(2.45, 5);
    const position = blobGeometry.attributes.position as THREE.BufferAttribute;
    const basePositions = Float32Array.from(position.array as ArrayLike<number>);
    const material = new THREE.MeshPhysicalMaterial({
      color: accent.clone().lerp(new THREE.Color(0xffffff), 0.36),
      roughness: 0.06,
      metalness: 0,
      transmission: 0.58,
      thickness: 2.6,
      ior: 1.38,
      transparent: true,
      opacity: Number.isFinite(Number(config?.opacity)) ? Number(config?.opacity) : 0.48,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.1,
      emissive: accent,
      emissiveIntensity: 0.05,
      side: THREE.DoubleSide,
    });
    const core = new THREE.Mesh(blobGeometry, material);
    root.add(core);
    root.position.set(Number(config?.x || 0), Number(config?.y || 0), Number(config?.z || 0));
    root.scale.setScalar(Math.max(0.1, Number(config?.scale || 1)));

    const rim = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.52, 3),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    root.add(rim);

    const magmaGroup = new THREE.Group();
    root.add(magmaGroup);
    const magmaGeometry = new THREE.SphereGeometry(0.92, 48, 32);
    const magma = Array.from({ length: 7 }, (_, i) => {
      const c = new THREE.Color(colors[(morphIndex + i) % colors.length]);
      const mesh = new THREE.Mesh(
        magmaGeometry,
        new THREE.MeshBasicMaterial({
          color: c,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      mesh.userData.phase = i * 0.83 + morphIndex * 0.41;
      magmaGroup.add(mesh);
      return mesh;
    });

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGraphicsGlowTexture(accent, hot, cool),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    glow.scale.set(6.4, 6.4, 1);
    scene.add(glow);

    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions: number[] = [];
    for (let i = 0; i < 180; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.2 + Math.random() * 2;
      particlePositions.push(Math.cos(a) * r, (Math.random() - 0.5) * 3, Math.sin(a) * r);
    }
    particlesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({
        color: accent,
        size: 0.038,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
      })
    );
    root.add(particles);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    let raf = 0;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

    const onMove = (e: MouseEvent) => {
      const r = mount.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    if (!isTouch) mount.addEventListener("mousemove", onMove, { passive: true });

    let t = morphIndex * 1.73;
    let normalFrame = 0;
    const seed = morphIndex * 0.77 + 1.6;
    const speed = Math.max(0.05, Number(config?.speed || 1));
    const morphIntensity = Math.max(0, Number(config?.morphIntensity ?? 1));
    const magmaIntensity = Math.max(0, Number(config?.magmaIntensity ?? 1));
    // CMS frame-rate cap: skip whole frames when throttled; dt keeps the
    // visual speed identical at any frame rate (0.012/frame @60 ≈ 0.72/s).
    const gate = makeFrameGate(() => fpsRef.current);
    let lastWork = performance.now();
    const loop = () => {
      const now = performance.now();
      // Off-screen → skip all work but keep the loop alive; the scene is
      // built ONCE and reused (a teardown/rebuild per scroll pass costs
      // hundreds of ms and is what made scrolling stutter).
      if (!inViewRef.current || !gate(now)) {
        raf = requestAnimationFrame(loop);
        return;
      }
      {
        const dt = Math.min((now - lastWork) / 1000, 0.1);
        lastWork = now;
        t += dt * 0.72 * speed;
        if (isTouch) {
          target.x = Math.sin(t) * 0.6;
          target.y = Math.cos(t * 0.7) * 0.5;
        }
        current.x += (target.x - current.x) * 0.07;
        current.y += (target.y - current.y) * 0.07;

        for (let i = 0; i < position.count; i++) {
          const ix = i * 3;
          const x = basePositions[ix];
          const y = basePositions[ix + 1];
          const z = basePositions[ix + 2];
          const wave =
            Math.sin(x * 2.3 + t * 2.2 + seed) * 0.13 +
            Math.cos(y * 2.7 - t * 1.6 + seed * 1.7) * 0.11 +
            Math.sin((x + z) * 1.8 + t * 1.15) * 0.08;
          const pull = 1 + wave * morphIntensity + Math.sin(t * 0.9 + z * 2.1 + morphIndex) * 0.035 * morphIntensity;
          position.setXYZ(i, x * pull, y * pull, z * pull);
        }
        position.needsUpdate = true;
        normalFrame++;
        if (normalFrame % 4 === 0) blobGeometry.computeVertexNormals();

        root.rotation.y = t * 0.34 + current.x * 0.52;
        root.rotation.x = Math.sin(t * 0.58) * 0.16 - current.y * 0.34;
        root.rotation.z = Math.sin(t * 0.31) * 0.11;
        core.scale.setScalar(1 + Math.sin(t * 1.15) * 0.025);
        rim.rotation.y = -t * 0.18;
        rim.rotation.x = t * 0.11;

        magma.forEach((mesh, i) => {
          const phase = Number(mesh.userData.phase || 0);
          mesh.position.set(
            Math.sin(t * (0.7 + i * 0.04) + phase) * 0.95,
            Math.cos(t * (0.62 + i * 0.03) + phase * 1.4) * 0.82,
            Math.sin(t * (0.55 + i * 0.05) + phase * 1.8) * 0.9
          );
          const s = (0.7 + Math.sin(t * 1.6 + phase) * 0.22) * Math.max(0.2, magmaIntensity);
          mesh.scale.set(s * 1.25, s * 0.9, s);
        });

        key.color.copy(hot).lerp(cool, (Math.sin(t * 0.8) + 1) / 2);
        fill.color.copy(cool).lerp(accent, (Math.cos(t * 0.7) + 1) / 2);
        glow.material.opacity = 0.62 + Math.sin(t * 1.4) * 0.12;
        glow.material.rotation = t * 0.08;
        particles.rotation.y = -t * 0.18;
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      if (!isTouch) mount.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      ro.disconnect();
      mount.removeChild(renderer.domElement);
      blobGeometry.dispose();
      material.dispose();
      rim.geometry.dispose();
      (rim.material as THREE.Material).dispose();
      magmaGeometry.dispose();
      magma.forEach((mesh) => (mesh.material as THREE.Material).dispose());
      glow.material.map?.dispose();
      glow.material.dispose();
      particlesGeometry.dispose();
      (particles.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  // NOTE: `inView` is intentionally NOT a dependency — the scene is built
  // once and the render loop self-gates via inViewRef. Rebuilding the whole
  // WebGL scene (renderer + textures + geometry) on every scroll pass was
  // the main source of scroll stutter on this section.
  }, [config, morphIndex]);

  const onClick = () => {
    setMorphIndex((o) => (o + 1) % GLASS_COLORS.length);
    const link = config?.link?.trim();
    if (!link) return;

    window.setTimeout(() => {
      if (link.startsWith("#")) {
        document.querySelector(link)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.open(link, "_blank", "noopener,noreferrer");
    }, 220);
  };

  return (
    <div
      ref={containerRef}
      data-cursor-hover
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative grid aspect-square w-[min(520px,88vw)] max-w-full cursor-pointer place-items-center"
      style={{ perspective: "1200px" }}
      role="button"
      aria-label={lang === "fa" ? "شیء گرافیکی سه‌بعدی؛ برای تغییر رنگ کلیک کنید" : "3D graphics object — click to shift colors"}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full opacity-50 blur-3xl transition-opacity duration-500"
        style={{
          background: "radial-gradient(circle, var(--gfx-glow), transparent 70%)",
          opacity: hovered ? 0.95 : 0.55,
        }}
      />

      {/* hint label */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0.5 }}
        className="pointer-events-none absolute -bottom-4 font-mono text-[10px] tracking-[0.25em] text-muted-foreground"
      >
        {lang === "fa" ? "کلیک · دگرگونی" : "CLICK · MORPH"}
      </motion.div>
    </div>
  );
}

function createGraphicsGlowTexture(a: THREE.Color, b: THREE.Color, c: THREE.Color) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 512, 512);
  const base = ctx.createRadialGradient(256, 256, 0, 256, 256, 250);
  base.addColorStop(0, `rgba(${Math.round(a.r * 255)}, ${Math.round(a.g * 255)}, ${Math.round(a.b * 255)}, 0.85)`);
  base.addColorStop(0.45, `rgba(${Math.round(b.r * 255)}, ${Math.round(b.g * 255)}, ${Math.round(b.b * 255)}, 0.42)`);
  base.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  const blobs = [
    [170, 210, 95, b],
    [320, 180, 120, c],
    [285, 335, 110, a],
  ] as const;
  blobs.forEach(([x, y, r, color]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0.8)`);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
