"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import * as THREE from "three";
import { useContent } from "@/lib/content-store";
import type { PlanetConfig, PlanetViewConfig, SceneObject3DConfig } from "@/lib/content-types";
import { clampFrameRate, makeFrameGate } from "@/lib/anim";
import { liveAudio } from "@/lib/audio-energy";
import { Ambient3DObject } from "@/components/portfolio/ambient-3d-object";

/* ============================================================
   PlanetaryHero — full-screen 3D solar system
   ------------------------------------------------------------
   Reads `hero.planets: PlanetConfig[]` from the content store.
   Each planet has its own texture (swirly, cratered, gas-bands,
   ringed, nebula), size, orbit, and moons.

   Moons orbit in a TILTED 3D plane (rotateX(60deg) + rotateZ)
   so they pass behind and in front of the planet, not just in a
   flat 2D circle.

   WebGL/Three.js scene with real sphere meshes, orbit pivots, and
   moon systems. Mouse parallax tilts the whole system.
   ============================================================ */

// Map planet.id → cursor-zone key. gfx/sec/ai use their themed
// cursor color; any custom id falls back to "default".
function cursorZoneFor(id: string): string {
  if (id === "gfx" || id === "sec" || id === "ai") return id;
  return "default";
}

// Color helpers — color-mix for lighten / darken / transparentize.
// pct is the amount of the mixer (white / black / transparent).
const lighten = (c: string, pct = 30) => `color-mix(in oklch, ${c} ${100 - pct}%, white)`;
const darken = (c: string, pct = 30) => `color-mix(in oklch, ${c} ${100 - pct}%, black)`;
const fade = (c: string, pct = 50) => `color-mix(in oklch, ${c} ${100 - pct}%, transparent)`;

export const DEFAULT_PLANET_VIEW: PlanetViewConfig = {
  cameraX: 0,
  cameraY: 15,
  cameraZ: 38,
  targetY: -1.8,
  systemTiltX: -14,
  systemTiltZ: 3,
  orbitScale: 0.48,
  planetScale: 0.22,
  moonScale: 0.16,
  labelScale: 1,
};

function normalizePlanetView(view: Partial<PlanetViewConfig> | null | undefined): PlanetViewConfig {
  return { ...DEFAULT_PLANET_VIEW, ...(view ?? {}) };
}

function moonOrbitTilt(planet: PlanetConfig) {
  return {
    x: Number.isFinite(Number(planet.moonOrbitTiltX)) ? Number(planet.moonOrbitTiltX) : 64,
    y: Number.isFinite(Number(planet.moonOrbitTiltY)) ? Number(planet.moonOrbitTiltY) : 0,
    z: Number.isFinite(Number(planet.moonOrbitTiltZ)) ? Number(planet.moonOrbitTiltZ) : 0,
    offset: Number.isFinite(Number(planet.moonOrbitOffset)) ? Number(planet.moonOrbitOffset) : 0,
  };
}

export function PlanetaryHero() {
  const planets = useContent((s) => s.content.hero.planets);
  const hero = useContent((s) => s.content.hero);
  const builderSections = useContent((s) => s.content.builder?.sections ?? []);
  const maxCanvasDpr = useContent((s) => s.content.builder?.cache?.maxCanvasDpr);
  const objects = useContent((s) => s.content.design?.objects ?? []);
  const planetView = useMemo(() => normalizePlanetView(hero.planetView), [hero.planetView]);
  const lang = useContent((s) => s.lang);
  const [divingId, setDivingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [starHover, setStarHover] = useState(false);

  // Planets whose target section was disabled in the CMS (Builder → sections)
  // disappear from the sky along with the section itself.
  const visiblePlanets = useMemo(
    () =>
      planets.filter((p) => {
        const section = builderSections.find((s) => s.id === p.sectionId);
        return section ? section.enabled !== false : true;
      }),
    [planets, builderSections]
  );

  const diveTo = (planet: PlanetConfig) => {
    if (divingId) return;
    setDivingId(planet.id);
    window.dispatchEvent(new CustomEvent("planet-visited", { detail: planet.id }));
    // After the dive-in animation completes, scroll to the section.
    setTimeout(() => {
      document.getElementById(planet.sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => setDivingId(null), 800);
    }, 2200);
  };

  const openProfile = () => {
    if (hero.star?.enabled === false) return;
    window.dispatchEvent(new CustomEvent("sun-pressed"));
    window.dispatchEvent(new CustomEvent("open-profile"));
  };

  const scrollDown = () => {
    const first = visiblePlanets[0];
    const target = first ? first.sectionId : "graphics";
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const divingPlanet = visiblePlanets.find((p) => p.id === divingId) ?? null;
  const hoveredPlanet = visiblePlanets.find((p) => p.id === hoveredId) ?? null;
  const heroObject = findSceneObject(objects, "hero-primary");
  const planetaryObject = findSceneObject(objects, "planetary-center");

  return (
    <section
      id="home"
      data-cursor-zone="default"
      className="hero-viewport relative flex min-h-[100svh] w-full max-w-full flex-col items-center justify-center overflow-visible px-4 pb-28 pt-20 sm:min-h-[640px] sm:px-5 sm:pb-20"
    >
      {/* === 3D Solar System (full screen) === */}
      <ThreePlanetaryScene
        planets={visiblePlanets}
        view={planetView}
        starEnabled={hero.star?.enabled !== false}
        starColor={hero.star?.color || "#ffb35c"}
        maxDpr={Number(maxCanvasDpr) > 0 ? Number(maxCanvasDpr) : 2}
        divingId={divingId}
        onHover={setHoveredId}
        onSelect={diveTo}
        onStarHover={setStarHover}
        onSelectStar={openProfile}
      />

      {planetaryObject && (
        <Ambient3DObject
          variant="orbit"
          config={planetaryObject}
          defaultPlacement={{ side: "center", top: 30, size: 320 }}
          className="z-10"
        />
      )}

      {heroObject && (
        <Ambient3DObject
          variant="crystal"
          config={heroObject}
          defaultPlacement={{ side: "end", top: 18, offset: 6, size: 320 }}
          className="hidden lg:block"
        />
      )}

      {/* === Dive-in cinematic overlay === */}
      <AnimatePresence>
        {divingPlanet && <DiveOverlay planet={divingPlanet} />}
      </AnimatePresence>

      {/* === Text overlay (bottom) === */}
      <div data-cms-node="hero-copy" className="hero-copy absolute inset-x-0 z-20 flex flex-col items-center px-5 text-center">
        <motion.div
          data-cms-node="hero-badge"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {hero.badge}
        </motion.div>

        <motion.h1
          data-cms-node="hero-title"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="text-balance text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl"
          style={{ textShadow: "0 4px 30px oklch(0 0 0 / 0.5)" }}
        >
          {hero.titleLine1}{" "}
          <span className="text-gradient-tri">{hero.titleHighlight}</span>{" "}
          {hero.titleLine2}
        </motion.h1>

        <motion.p
          data-cms-node="hero-description"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base"
        >
          {hero.description}
        </motion.p>

        {/* Stats */}
        <motion.div
          data-cms-node="hero-stats"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-5 flex max-w-full flex-wrap items-center justify-center gap-4 sm:gap-6"
        >
          {hero.stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-bold text-foreground">{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Hover hint for planet */}
      <AnimatePresence>
        {hoveredPlanet && !divingId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs text-foreground backdrop-blur-md">
              {lang === "fa" ? "کلیک کنید تا وارد شوید" : "Click to enter"} →{" "}
              <span style={{ color: hoveredPlanet.color }} className="font-semibold">
                {hoveredPlanet.label}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover hint for the central sun — it's ME */}
      <AnimatePresence>
        {starHover && !hoveredPlanet && !divingId && hero.star?.enabled !== false && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="pointer-events-none absolute left-1/2 top-[62%] z-20 -translate-x-1/2 text-center"
          >
            <div
              className="rounded-full border px-5 py-2 backdrop-blur-md"
              style={{
                borderColor: `color-mix(in oklch, ${hero.star?.color || "#ffb35c"} 45%, transparent)`,
                background: "color-mix(in oklch, var(--background) 65%, transparent)",
                boxShadow: `0 0 30px -6px ${hero.star?.color || "#ffb35c"}`,
              }}
            >
              <span className="text-xs font-bold" style={{ color: hero.star?.color || "#ffb35c" }}>
                ☀︎ {hero.star?.label || (lang === "fa" ? "این خورشید من است" : "This sun is me")}
              </span>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {hero.star?.hint || (lang === "fa" ? "کلیک کن تا من را ببینی" : "Click to meet me")}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll hint */}
      <motion.button
        data-cms-node="scroll-hint"
        type="button"
        onClick={scrollDown}
        data-cursor-hover
        initial={{ opacity: 0 }}
        animate={{ opacity: divingId ? 0 : 1 }}
        transition={{ delay: 1.2 }}
        className="hero-scroll-hint absolute left-1/2 z-20 -translate-x-1/2 cursor-pointer outline-none"
        aria-label={lang === "fa" ? "پیمایش به پایین" : "Scroll down"}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-1 text-muted-foreground"
        >
          <span className="font-mono text-[9px] tracking-[0.3em]">{lang === "fa" ? "پایین" : "SCROLL"}</span>
          <ArrowDown className="h-3.5 w-3.5" />
        </motion.div>
      </motion.button>
    </section>
  );
}

function findSceneObject(objects: SceneObject3DConfig[], slot: SceneObject3DConfig["slot"]) {
  return objects.find((object) => object.enabled !== false && object.slot === slot);
}

export function PlanetScenePreview({
  planets,
  view,
}: {
  planets: PlanetConfig[];
  view?: Partial<PlanetViewConfig> | null;
}) {
  const normalizedView = useMemo(() => normalizePlanetView(view), [view]);
  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-border bg-[oklch(0.07 0.02_280)]">
      <ThreePlanetaryScene
        planets={planets}
        view={normalizedView}
        starEnabled={false}
        starColor="#ffb35c"
        preview
        divingId={null}
        onHover={() => {}}
        onSelect={() => {}}
        onStarHover={() => {}}
        onSelectStar={() => {}}
      />
    </div>
  );
}

/* ============================================================
   ThreePlanetaryScene — real WebGL spheres with central orbits.
   ============================================================ */
function ThreePlanetaryScene({
  planets,
  view,
  starEnabled,
  starColor,
  maxDpr = 2,
  divingId,
  onHover,
  onSelect,
  onStarHover,
  onSelectStar,
  preview = false,
}: {
  planets: PlanetConfig[];
  view: PlanetViewConfig;
  starEnabled: boolean;
  starColor: string;
  /** Cap for devicePixelRatio — lower = faster on weak GPUs (from builder.cache.maxCanvasDpr). */
  maxDpr?: number;
  divingId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (planet: PlanetConfig) => void;
  onStarHover: (hover: boolean) => void;
  onSelectStar: () => void;
  preview?: boolean;
}) {
  const lang = useContent((s) => s.lang);
  const mountRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef<string | null>(null);
  const planetsRef = useRef(planets);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const onStarHoverRef = useRef(onStarHover);
  const onSelectStarRef = useRef(onSelectStar);
  const divingIdRef = useRef(divingId);
  const viewRef = useRef(view);
  // audio envelope + frame clock (assigned inside the scene effect)
  const envRef = useRef({ bass: 0, mid: 0, treble: 0, level: 0, beat: 0, flux: 0, brightness: 0 });
  const frameClockRef = useRef({ last: 0 });
  // CMS frame-rate cap (builder.performance.frameRate) — live-updating
  const frameRate = useContent((s) => s.content.builder?.performance?.frameRate);
  const fpsRef = useRef(frameRate);
  useEffect(() => {
    fpsRef.current = frameRate;
  }, [frameRate]);
  // audio-reactive settings (music.visualizer.reactive3d) — live-updating
  const reactive = useContent((s) => s.content.music?.visualizer);
  const reactiveRef = useRef(reactive);
  useEffect(() => {
    reactiveRef.current = reactive;
  }, [reactive]);

  useEffect(() => {
    planetsRef.current = planets;
  }, [planets]);

  useEffect(() => {
    onHoverRef.current = onHover;
    onSelectRef.current = onSelect;
    onStarHoverRef.current = onStarHover;
    onSelectStarRef.current = onSelectStar;
    divingIdRef.current = divingId;
    viewRef.current = view;
  }, [onHover, onSelect, onStarHover, onSelectStar, divingId, view]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || planets.length === 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
    const deviceMemory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4);
    const lowPower = (navigator.hardwareConcurrency || 4) <= 2 || deviceMemory <= 2;
    const isMobileGPU = window.innerWidth < 768 || /Android|iPhone|iPad/i.test(navigator.userAgent);
    const renderer = new THREE.WebGLRenderer({
      antialias: !lowPower && !isMobileGPU, // disable AA on mobile for performance
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    // Cap DPR so hi-dpi screens don't render 4× pixels for no visible gain —
    // keeps the GPU (and laptop fans) cool. Configurable from the CMS.
    // Mobile gets an extra hard cap of 1.0 for battery + performance.
    const mobileCap = isMobileGPU ? 1.25 : 1.5;
    const effectiveDpr = lowPower ? Math.min(maxDpr, 1.0) : Math.min(maxDpr, mobileCap);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Math.max(effectiveDpr, 1)));
    renderer.domElement.setAttribute(
      "aria-label",
      lang === "fa" ? "پیمایش سه‌بعدی سیاره‌ای پورتفولیو" : "3D planetary portfolio navigation"
    );
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.classList.add("gpu-optimized");
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    root.rotation.x = THREE.MathUtils.degToRad(view.systemTiltX);
    root.rotation.z = THREE.MathUtils.degToRad(view.systemTiltZ);
    scene.add(root);

    const ambient = new THREE.AmbientLight(0x9bb7ff, 1.25);
    scene.add(ambient);

    const starColorThree = new THREE.Color(starColor || "#ffb35c");
    const starLight = new THREE.PointLight(starColorThree, 85, 90, 1.25);
    starLight.position.set(0, 0, 0);
    scene.add(starLight);

    const fillLight = new THREE.DirectionalLight(0x8ac7ff, 1.4);
    fillLight.position.set(-18, 20, 22);
    scene.add(fillLight);

    const star = createStar(starColor || "#ffb35c");
    root.add(star);

    const starHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture(
          `rgba(255, 190, 94, 0.95)`,
          `rgba(255, 95, 35, 0)`
        ),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    starHalo.scale.set(10, 10, 1);
    root.add(starHalo);

    const starField = createThreeStarfield();
    scene.add(starField);

    const clickable: THREE.Object3D[] = [];
    // The sun is clickable too — it opens the profile modal ("this is me").
    if (starEnabled) {
      star.userData.starId = "star";
      clickable.push(star);
    }
    const records = planets.map((planet) => {
      const color = new THREE.Color(planet.color);
      const orbitRadius = Number(planet.orbitRadius || 0) * view.orbitScale;
      const planetRadius = Number(planet.size || 1) * view.planetScale;
      const moonRadius = Math.max(Number(planet.moonSize || 1) * view.moonScale, 0.16);
      const moonOrbitRadius = Number(planet.moonOrbitRadius || 0) * view.orbitScale;
      const moonTilt = moonOrbitTilt(planet);

      const orbit = createOrbitLine(orbitRadius, color, 0.22);
      root.add(orbit);

      const pivot = new THREE.Group();
      pivot.rotation.y = THREE.MathUtils.degToRad(planet.orbitOffset);
      root.add(pivot);

      const planetGroup = new THREE.Group();
      planetGroup.position.x = orbitRadius;
      planetGroup.userData.planetId = planet.id;
      pivot.add(planetGroup);

      const texture = createPlanetTexture(planet);
      const planetMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.72,
        metalness: 0.02,
        emissive: color.clone(),
        emissiveIntensity: 0.08,
      });
      const sphereWidth = lowPower ? 24 : 40;
      const sphereHeight = lowPower ? 16 : 28;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(planetRadius, sphereWidth, sphereHeight), planetMaterial);
      mesh.userData.planetId = planet.id;
      planetGroup.add(mesh);
      clickable.push(mesh);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(planetRadius * 1.08, sphereWidth, sphereHeight),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.18,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.BackSide,
        })
      );
      planetGroup.add(atmosphere);

      if (planet.texture === "ringed" || planet.id === "gfx") {
        const ring = createPlanetRing(planetRadius, color);
        ring.rotation.x = THREE.MathUtils.degToRad(72);
        ring.rotation.z = THREE.MathUtils.degToRad(-12);
        planetGroup.add(ring);
      }

      const label = createTextSprite(planet.label, planet.color, 34, "700", 1);
      label.position.set(0, planetRadius + 1.45, 0);
      label.scale.set(5.6 * view.labelScale, 1.35 * view.labelScale, 1);
      planetGroup.add(label);

      const moonOrbit = createOrbitLine(moonOrbitRadius, color, 0.18);
      moonOrbit.rotation.set(
        THREE.MathUtils.degToRad(moonTilt.x),
        THREE.MathUtils.degToRad(moonTilt.y),
        THREE.MathUtils.degToRad(moonTilt.z)
      );
      planetGroup.add(moonOrbit);

      const moons = planet.moons.map((moon, index) => {
        const moonPlane = new THREE.Group();
        moonPlane.rotation.set(
          THREE.MathUtils.degToRad(moonTilt.x),
          THREE.MathUtils.degToRad(moonTilt.y),
          THREE.MathUtils.degToRad(moonTilt.z)
        );
        planetGroup.add(moonPlane);

        const moonPivot = new THREE.Group();
        moonPivot.rotation.y =
          THREE.MathUtils.degToRad(moonTilt.offset) +
          (index / Math.max(planet.moons.length, 1)) * Math.PI * 2;
        moonPlane.add(moonPivot);

        const moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(moonRadius, lowPower ? 12 : 20, lowPower ? 8 : 14),
          new THREE.MeshStandardMaterial({
            color: color.clone().lerp(new THREE.Color(0xffffff), 0.35),
            roughness: 0.86,
            metalness: 0,
            emissive: color.clone(),
            emissiveIntensity: 0.04,
          })
        );
        moonMesh.position.x = moonOrbitRadius;
        moonPivot.add(moonMesh);

        const moonLabel = createTextSprite(moon, planet.color, 22, "500", 0.72);
        moonLabel.position.set(moonOrbitRadius, moonRadius + 0.55, 0);
        moonLabel.scale.set(3.4 * view.labelScale, 0.8 * view.labelScale, 1);
        moonPivot.add(moonLabel);

        return { plane: moonPlane, pivot: moonPivot, mesh: moonMesh };
      });

      return {
        config: planet,
        pivot,
        planetGroup,
        mesh,
        atmosphere,
        moons,
        orbit,
        texture,
        baseScale: 1,
        // per-planet dance state: private phase + damped spring (y/x)
        dancePhase: (planets.indexOf(planet) * 1.71) % (Math.PI * 2),
        spring: { y: 0, vy: 0, x: 0, vx: 0 },
        baseX: orbitRadius,
        orbitAngle: THREE.MathUtils.degToRad(planet.orbitOffset),
      };
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(99, 99);
    const parallax = { x: 0, y: 0 };
    const parallaxCurrent = { x: 0, y: 0 };
    // smoothed audio envelope + beat transient + frame clock (spring physics)
    const envRefLocal = { bass: 0, mid: 0, treble: 0, level: 0, beat: 0, flux: 0, brightness: 0 };
    envRef.current = envRefLocal;
    const frameClock = { last: performance.now() };
    frameClockRef.current = frameClock;

    // Pause the render loop while the hero is scrolled out of view — the
    // GPU keeps its frames for the sections the visitor is actually looking at.
    let inView = true;
    const viewObserver = new IntersectionObserver(
      (entries) => { inView = entries[0]?.isIntersecting ?? true; },
      { rootMargin: "120px" }
    );
    viewObserver.observe(mount);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const currentView = viewRef.current;
      // Portrait screens have a very narrow horizontal FOV. Pull camera back
      // based on aspect ratio so planets remain framed instead of clipping.
      const portraitBoost = width < 900
        ? Math.max(1.12, Math.min(1.78, 0.78 / Math.max(camera.aspect, 0.35)))
        : 1;
      camera.position.set(
        currentView.cameraX,
        currentView.cameraY * Math.min(portraitBoost, 1.22),
        currentView.cameraZ * portraitBoost
      );
      camera.lookAt(0, currentView.targetY, 0);
      camera.updateProjectionMatrix();
    };

    const setPointerFromEvent = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      parallax.x = pointer.x;
      parallax.y = pointer.y;
    };

    const onPointerMove = (event: PointerEvent) => {
      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable, false)[0]?.object;
      const isStar = !!hit?.userData?.starId;
      const id = !isStar && typeof hit?.userData.planetId === "string" ? hit.userData.planetId : null;
      const nextHover = isStar ? "__star__" : id;
      if (hoveredRef.current !== nextHover) {
        hoveredRef.current = nextHover;
        onHoverRef.current(id);
        onStarHoverRef.current(isStar);
      }
      renderer.domElement.style.cursor = !preview && (id || isStar) ? "pointer" : "grab";
    };

    const onPointerLeave = () => {
      pointer.set(99, 99);
      hoveredRef.current = null;
      onHoverRef.current(null);
      onStarHoverRef.current(false);
      renderer.domElement.style.cursor = "grab";
    };

    const onPointerDown = (event: PointerEvent) => {
      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable, false)[0]?.object;
      if (!preview && !divingIdRef.current && hit?.userData?.starId) {
        onSelectStarRef.current();
        return;
      }
      const id = typeof hit?.userData.planetId === "string" ? hit.userData.planetId : null;
      const planet = planetsRef.current.find((p) => p.id === id);
      if (!preview && planet && !divingIdRef.current) onSelectRef.current(planet);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    renderer.domElement.addEventListener("pointermove", onPointerMove, { passive: true });
    renderer.domElement.addEventListener("pointerleave", onPointerLeave, { passive: true });
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    let frame = 0;
    let lastTelemetry = 0;
    const startTime = performance.now();
    const gate = makeFrameGate(() => fpsRef.current);
    // No artificial frame throttle — it causes jerky dt jumps. Instead, we
    // reduce render cost (geometry, DPR, effects) so the device can sustain
    // its natural refresh rate. The CMS fps gate still applies as a ceiling.
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!inView) return; // hero offscreen → skip all work this frame
      const nowMs = performance.now();
      if (!gate(nowMs)) return; // CMS frame-rate cap
      const now = nowMs;
      const elapsed = (now - startTime) / 1000;
      const dt = Math.min(0.05, Math.max(0.001, (now - frameClockRef.current.last) / 1000));
      frameClockRef.current.last = now;
      const visualBlend = 1 - Math.exp(-dt * 3.2);
      parallaxCurrent.x += (parallax.x - parallaxCurrent.x) * visualBlend;
      parallaxCurrent.y += (parallax.y - parallaxCurrent.y) * visualBlend;
      const currentView = viewRef.current;
      root.rotation.x = THREE.MathUtils.degToRad(currentView.systemTiltX) + (preview ? 0 : parallaxCurrent.y * 0.08);
      root.rotation.z = THREE.MathUtils.degToRad(currentView.systemTiltZ) - (preview ? 0 : parallaxCurrent.x * 0.05);

      // audio-reactive dance — spring physics, subtle and fluid:
      // each planet has its own damped spring; every beat transient gives
      // the spring a soft kick, so planets BOUNCE gently on the rhythm
      // instead of vibrating. Sway drifts slowly with the mid frequencies.
      const rv = reactiveRef.current;
      let smBass = 0;
      let smMid = 0;
      let smTreble = 0;
      let smLevel = 0;
      let smBeat = 0;
      let smFlux = 0;
      if (rv?.reactive3d !== false && liveAudio.active) {
        const sens = Math.max(0.2, Math.min(3, Number(rv?.sensitivity) || 1));
        const amp = Math.max(0, Math.min(3, Number(rv?.danceAmplitude ?? 1)));
        // Time-based envelope smoothing stays identical at 30, 60, or 144 FPS.
        const rawBass = liveAudio.bass * sens;
        const bassBlend = 1 - Math.exp(-dt * (rawBass > envRef.current.bass ? 13 : 4.5));
        const bandBlend = 1 - Math.exp(-dt * 7);
        envRef.current.bass += (rawBass - envRef.current.bass) * bassBlend;
        envRef.current.mid += (liveAudio.mid * sens - envRef.current.mid) * bandBlend;
        envRef.current.treble += (liveAudio.treble * sens - envRef.current.treble) * bandBlend;
        envRef.current.level += (liveAudio.level * sens - envRef.current.level) * bandBlend;
        const beatTarget = liveAudio.beat * sens;
        envRef.current.beat += (beatTarget - envRef.current.beat) *
          (1 - Math.exp(-dt * (beatTarget > envRef.current.beat ? 26 : 9)));
        envRef.current.flux += (liveAudio.flux * sens - envRef.current.flux) * (1 - Math.exp(-dt * 11));
        envRef.current.brightness += (liveAudio.brightness - envRef.current.brightness) * bandBlend;
        smBass = Math.min(envRef.current.bass * amp, 1.6);
        smMid = envRef.current.mid;
        smTreble = envRef.current.treble;
        smLevel = envRef.current.level * amp;
        smBeat = Math.min(envRef.current.beat, 1.5);
        smFlux = Math.min(envRef.current.flux, 1.5);
      } else {
        const release = Math.exp(-dt * 7);
        envRef.current.bass *= release;
        envRef.current.mid *= release;
        envRef.current.treble *= release;
        envRef.current.level *= release;
        envRef.current.beat *= release;
        envRef.current.flux *= release;
        envRef.current.brightness *= release;
      }

      star.rotation.y += 0.004 * (1 + smLevel * 0.5);
      const starHovered = hoveredRef.current === "__star__";
      star.scale.setScalar(starHovered ? 1.22 : 1 + Math.sin(elapsed * 2) * 0.03 + smBass * 0.06);
      starHalo.material.rotation = elapsed * 0.05;
      starHalo.scale.setScalar(10 + Math.sin(elapsed * 1.7) * 0.8 + (starHovered ? 2.2 : 0) + smLevel * 1.6);
      starField.rotation.y = elapsed * 0.01;

      records.forEach((record) => {
        const isHovered = hoveredRef.current === record.config.id;
        const isDiving = divingIdRef.current === record.config.id;
        const targetScale = isHovered || isDiving ? 1.18 : 1;
        record.baseScale += (targetScale - record.baseScale) * (1 - Math.exp(-dt * 5));

        // --- spectral spring dance: bass/beat=bounce, mids=sway,
        // treble=spin. No timer or random rhythm is involved. ---
        const sp = record.spring;
        const phaseMix = 0.75 + 0.25 * Math.sin(record.dancePhase);
        const ampScale = reactiveRef.current?.reactive3d !== false && liveAudio.active
          ? Math.max(0, Math.min(3, Number(reactiveRef.current?.danceAmplitude ?? 1)))
          : 0;
        // vertical: damped spring kicked by the beat
        const beatDrive = (smBeat * 1.15 + smFlux * 0.22) * phaseMix * ampScale;
        sp.vy += (-76 * sp.y - 16 * sp.vy + beatDrive * 86) * dt;
        sp.y += sp.vy * dt;
        sp.y = Math.max(-1, Math.min(1, sp.y));
        // Alternating direction keeps the system organic while movement
        // magnitude is still derived solely from the analysed spectrum.
        const direction = Math.sin(record.dancePhase) >= 0 ? 1 : -1;
        const swayTarget = direction * (smMid * 0.16 + smFlux * 0.28 + smBeat * 0.08) * ampScale;
        sp.x += (swayTarget - sp.x) * (1 - Math.exp(-dt * 3.5));

        record.planetGroup.position.y = sp.y * 0.78;
        record.planetGroup.position.x = record.baseX + sp.x * 0.58;
        // gentle scale pulse on the smoothed bass
        record.planetGroup.scale.setScalar(record.baseScale * (1 + smBass * 0.09));
        record.atmosphere.material.opacity = (isHovered || isDiving ? 0.32 : 0.18) + smBass * 0.07;

        // Integrate speed over time. Multiplying absolute elapsed time by live
        // energy caused phase jumps whenever energy changed (visible glitch).
        const period = Math.max(1, Number(record.config.orbitPeriod) || 40);
        record.orbitAngle += (dt / period) * Math.PI * 2 * (1 + smLevel * 0.16);
        record.pivot.rotation.y = record.orbitAngle;
        record.mesh.rotation.y += dt * (0.28 + smTreble * 0.52 + envRef.current.brightness * 0.18);
        record.mesh.rotation.x += (direction * smTreble * 0.07 - record.mesh.rotation.x) * (1 - Math.exp(-dt * 4));

        record.moons.forEach((moon, index) => {
          moon.pivot.rotation.y =
            THREE.MathUtils.degToRad(Number(record.config.moonOrbitOffset || 0)) +
            (index / Math.max(record.moons.length, 1)) * Math.PI * 2 +
            (elapsed / record.config.moonOrbitPeriod) * Math.PI * 2;
          moon.mesh.rotation.y = elapsed * 0.6 + index;
          const depth = Math.sin(moon.pivot.rotation.y);
          moon.mesh.scale.setScalar(1 + depth * 0.12);
        });
      });

      if (now - lastTelemetry > 250) {
        lastTelemetry = now;
        const motion = records.reduce((max, record) => Math.max(max, Math.abs(record.spring.y)), 0);
        renderer.domElement.dataset.planetDance = liveAudio.active && rv?.reactive3d !== false ? "active" : "idle";
        renderer.domElement.dataset.danceLevel = smBass.toFixed(3);
        renderer.domElement.dataset.danceBeat = smBeat.toFixed(3);
        renderer.domElement.dataset.danceFlux = smFlux.toFixed(3);
        renderer.domElement.dataset.danceMotion = motion.toFixed(3);
      }

      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      viewObserver.disconnect();
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      mount.removeChild(renderer.domElement);
      records.forEach((record) => {
        record.texture.dispose();
        record.mesh.geometry.dispose();
        (record.mesh.material as THREE.Material).dispose();
        record.atmosphere.geometry.dispose();
        (record.atmosphere.material as THREE.Material).dispose();
        record.orbit.geometry.dispose();
        (record.orbit.material as THREE.Material).dispose();
        record.moons.forEach((moon) => {
          moon.mesh.geometry.dispose();
          (moon.mesh.material as THREE.Material).dispose();
        });
      });
      renderer.dispose();
      // return the GL context to the browser pool (page-wide context cap)
      renderer.forceContextLoss();
    };
  }, [planets, preview, view, starEnabled, starColor, maxDpr, lang]);

  return <div ref={mountRef} className="hero-planetary-stage absolute inset-0 z-0" />;
}

function createStar(color: string) {
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 36, 24),
    new THREE.MeshBasicMaterial({
      map: createStarTexture(color),
      color: new THREE.Color(color),
    })
  );
  return core;
}

function createOrbitLine(radius: number, color: THREE.Color, opacity: number) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 192; i++) {
    const angle = (i / 192) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.LineLoop(geometry, material);
}

function createPlanetRing(radius: number, color: THREE.Color) {
  const geometry = new THREE.RingGeometry(radius * 1.28, radius * 1.85, 128);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geometry, material);
}

function createThreeStarfield() {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const rand = mulberry32(777);
  for (let i = 0; i < 420; i++) {
    const radius = 70 + rand() * 80;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(rand() * 2 - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.18,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function createPlanetTexture(planet: PlanetConfig) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const ctx = canvas.getContext("2d")!;
  const base = new THREE.Color(planet.color);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.42).getStyle();
  const mid = base.getStyle();
  const dark = base.clone().lerp(new THREE.Color(0x05030b), 0.65).getStyle();
  const rand = mulberry32(hashString(planet.id));

  const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grd.addColorStop(0, light);
  grd.addColorStop(0.45, mid);
  grd.addColorStop(1, dark);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (planet.texture === "gas-bands" || planet.texture === "ringed") {
    for (let y = -20; y < canvas.height + 40; y += 22) {
      ctx.fillStyle = rand() > 0.45 ? colorWithAlpha(light, 0.26) : colorWithAlpha(dark, 0.22);
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, y + rand() * 16, canvas.width * 0.72, 10 + rand() * 8, rand() * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = colorWithAlpha(base.clone().lerp(new THREE.Color(0xff7a4a), 0.5).getStyle(), 0.45);
    ctx.beginPath();
    ctx.ellipse(canvas.width * 0.68, canvas.height * 0.58, 60, 28, -0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (planet.texture === "cratered") {
    for (let i = 0; i < 48; i++) {
      const x = rand() * canvas.width;
      const y = rand() * canvas.height;
      const r = 7 + rand() * 23;
      ctx.fillStyle = colorWithAlpha(dark, 0.42);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colorWithAlpha(light, 0.16);
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = rand() > 0.5 ? colorWithAlpha(light, 0.22) : colorWithAlpha(dark, 0.18);
      ctx.beginPath();
      ctx.ellipse(rand() * canvas.width, rand() * canvas.height, 90 + rand() * 150, 16 + rand() * 45, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const shade = ctx.createRadialGradient(canvas.width * 0.28, canvas.height * 0.3, 10, canvas.width * 0.55, canvas.height * 0.55, canvas.width * 0.72);
  shade.addColorStop(0, "rgba(255,255,255,0.2)");
  shade.addColorStop(0.45, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

function createStarTexture(color: string) {
  const c = new THREE.Color(color);
  const light = `#${c.clone().lerp(new THREE.Color(0xffffff), 0.55).getHexString()}`;
  const mid = `#${c.getHexString()}`;
  const dark = `#${c.clone().lerp(new THREE.Color(0xf46a32), 0.55).getHexString()}`;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grd.addColorStop(0, "#fff7d3");
  grd.addColorStop(0.42, light);
  grd.addColorStop(0.7, mid);
  grd.addColorStop(1, dark);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.ellipse(Math.random() * canvas.width, Math.random() * canvas.height, 35, 8, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlowTexture(inner: string, outer: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.25, inner.replace("0.95", "0.45"));
  grd.addColorStop(1, outer);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTextSprite(text: string, color: string, fontSize: number, weight: string, opacity: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.direction = /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${fontSize}px Vazirmatn, system-ui, sans-serif`;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = colorWithAlpha(color, opacity);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  return new THREE.Sprite(material);
}

function colorWithAlpha(color: string, alpha: number) {
  if (color.startsWith("rgb")) return color.replace(")", `, ${alpha})`).replace("rgb(", "rgba(");
  const c = new THREE.Color(color);
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`;
}

/* ============================================================
   Central Star — glowing core with pulsing corona
   ============================================================ */
function CentralStar() {
  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Outer corona */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "12vmin",
          height: "12vmin",
          background: "radial-gradient(circle, oklch(0.95 0.15 60 / 0.4), transparent 70%)",
          filter: "blur(20px)",
        }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Mid corona */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "7vmin",
          height: "7vmin",
          background: "radial-gradient(circle, oklch(0.92 0.18 50 / 0.6), transparent 70%)",
          filter: "blur(10px)",
        }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Core */}
      <div
        className="relative rounded-full"
        style={{
          width: "3.5vmin",
          height: "3.5vmin",
          background: "radial-gradient(circle at 35% 35%, white, oklch(0.92 0.2 50) 40%, oklch(0.75 0.22 30) 100%)",
          boxShadow: "0 0 40px oklch(0.9 0.2 50), 0 0 80px oklch(0.8 0.2 40 / 0.6)",
        }}
      />
      {/* Light rays */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: "20vmin", height: "20vmin" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="absolute inset-0 rounded-full opacity-30"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, oklch(0.9 0.15 50 / 0.3) 10deg, transparent 20deg, transparent 90deg, oklch(0.9 0.15 50 / 0.2) 100deg, transparent 110deg, transparent 180deg, oklch(0.9 0.15 50 / 0.25) 190deg, transparent 200deg, transparent 270deg, oklch(0.9 0.15 50 / 0.2) 280deg, transparent 290deg)",
            filter: "blur(8px)",
          }}
        />
      </motion.div>
    </div>
  );
}

/* ============================================================
   PlanetSystem — a planet orbiting the star, with its own moons.
   ------------------------------------------------------------
   Nesting:
   1. orbit-ring       visible tilted circle showing the orbit
   2. orbit-rotator    spins around the star (period = orbitPeriod)
   3. planet-anchor    positions planet at orbitRadius in tilted plane
   4. planet-clickable button (the planet) — click to dive
   5. moon-rotator     TILTED plane (rotateX(60deg)) + spin (rotateZ)
                       → moons orbit in true 3D, going behind/front
   6. moons            individual moon dots with labels
   ============================================================ */
function PlanetSystem({
  planet,
  hovered,
  diving,
  anyDiving,
  onHover,
  onClick,
}: {
  planet: PlanetConfig;
  hovered: boolean;
  diving: boolean;
  anyDiving: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const tilt = 58;
  const half = planet.size / 2;
  const moonTilt = 60; // tilt of the moon orbit plane (3D)

  return (
    <>
      {/* Orbit ring — tilted circle showing the path (static) */}
      <div
        className="absolute left-1/2 top-1/2 rounded-full border"
        style={{
          width: `${planet.orbitRadius * 2}vmin`,
          height: `${planet.orbitRadius * 2}vmin`,
          marginLeft: `-${planet.orbitRadius}vmin`,
          marginTop: `-${planet.orbitRadius}vmin`,
          borderColor: fade(planet.color, 82),
          transform: `rotateX(${tilt}deg)`,
          transformStyle: "preserve-3d",
        }}
      />

      {/* Planet orbit — the orbit plane is tilted with rotateX(tilt),
          then a child spins with rotateZ WITHIN that tilted plane,
          and the planet is placed at orbitRadius via translateX.
          This gives a true 3D elliptical orbit (not a flat 2D circle). */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transformStyle: "preserve-3d", width: 0, height: 0, transform: `rotateX(${tilt}deg)` }}
      >
        <motion.div
          style={{ transformStyle: "preserve-3d", width: 0, height: 0 }}
          animate={{ rotateZ: 360 }}
          transition={{ duration: planet.orbitPeriod, repeat: Infinity, ease: "linear", delay: -(planet.orbitOffset / 360) * planet.orbitPeriod }}
        >
          <div
            style={{
              transformStyle: "preserve-3d",
              transform: `translateX(${planet.orbitRadius}vmin) rotateX(${-tilt}deg)`,
            }}
          >
          {/* Planet (clickable) */}
          <motion.button
            type="button"
            onClick={onClick}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            data-cursor-zone={cursorZoneFor(planet.id)}
            data-cursor-hover
            aria-label={`${planet.label} — ${planet.hint}`}
            animate={{
              scale: hovered ? 1.25 : 1,
              opacity: anyDiving && !diving ? 0.25 : 1,
            }}
            transition={{ duration: 0.4 }}
            className="relative grid place-items-center rounded-full outline-none"
            style={{
              width: `${planet.size}vmin`,
              height: `${planet.size}vmin`,
              cursor: "pointer",
              marginLeft: `-${half}vmin`,
              marginTop: `-${half}vmin`,
            }}
          >
            <Planet planet={planet} hovered={hovered} diving={diving} />
          </motion.button>

          {/* Moon system — true 3D orbiting via rAF + translate3d.
              Each moon's 3D position is computed directly:
              x = R·cos(θ), y = R·sin(θ)·cos(tilt), z = R·sin(θ)·sin(tilt)
              The z component makes moons go BEHIND and IN FRONT of the planet. */}
          <MoonSystem
            moons={planet.moons}
            color={planet.color}
            moonSize={planet.moonSize}
            orbitRadius={planet.moonOrbitRadius}
            period={planet.moonOrbitPeriod}
            tilt={moonTilt}
          />

          {/* Planet label (visible on hover) */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute whitespace-nowrap text-center"
                style={{ pointerEvents: "none", left: 0, top: `${planet.size / 2 + 1}vmin`, transform: "translateX(-50%)" }}
              >
                <div
                  className="font-mono text-xs font-bold tracking-widest"
                  style={{ color: planet.color }}
                >
                  {planet.label}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{planet.hint}</div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
}

/* ============================================================
   Planet — a 3D textured sphere with atmosphere glow.
   Texture styles (from planet.texture):
     swirly     → gas-giant swirls (animated rotation)
     cratered   → rocky moon/Mars-like scattered craters
     gas-bands  → Jupiter-like horizontal bands + great spot
     ringed     → gas-bands + permanent visible ring (Saturn)
     nebula     → fuzzy multi-layer glow, no sharp surface
   ============================================================ */
function Planet({ planet, hovered, diving }: { planet: PlanetConfig; hovered: boolean; diving: boolean }) {
  const color = planet.color;
  const texture = planet.texture;

  // Seeded crater positions for "cratered" texture.
  // Deterministic by planet.id → SSR-safe (no hydration mismatch).
  const craters = useMemo(() => {
    if (texture !== "cratered") return [] as { x: number; y: number; r: number }[];
    const seed = hashString(planet.id);
    const rand = mulberry32(seed);
    return Array.from({ length: 16 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      r: 2 + rand() * 5,
    }));
  }, [texture, planet.id]);

  const surface = getSurfaceGradient(texture, color, craters);

  return (
    <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
      {/* Atmosphere glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${fade(color, 50)}, transparent 65%)`,
          filter: "blur(8px)",
          transform: "scale(1.3)",
        }}
        animate={{ opacity: hovered || diving ? 0.9 : 0.5, scale: hovered || diving ? 1.4 : 1.3 }}
        transition={{ duration: 0.4 }}
      />

      {/* Planet body — base gradient + texture */}
      <div
        className="relative h-full w-full overflow-hidden rounded-full"
        style={{
          background: surface.base,
          boxShadow: `inset -8px -8px 20px oklch(0 0 0 / 0.5), inset 4px 4px 12px oklch(1 0 0 / 0.15), 0 0 30px ${fade(color, 40)}`,
        }}
      >
        {/* Texture overlay per type */}

        {texture === "swirly" && (
          <motion.div
            className="absolute inset-0 rounded-full opacity-70 mix-blend-screen"
            style={{ background: surface.overlay }}
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          />
        )}

        {texture === "gas-bands" && (
          <>
            <div
              className="absolute inset-0 rounded-full opacity-80"
              style={{ background: surface.overlay }}
            />
            {/* Great red spot — large oval feature */}
            <div
              className="absolute rounded-full"
              style={{
                width: "32%",
                height: "18%",
                left: "55%",
                top: "58%",
                background: `radial-gradient(ellipse, ${darken(color, 55)}, ${darken(color, 35)} 60%, transparent)`,
                transform: "translate(-50%, -50%)",
                filter: "blur(0.5px)",
              }}
            />
          </>
        )}

        {texture === "ringed" && (
          <>
            <div
              className="absolute inset-0 rounded-full opacity-80"
              style={{ background: surface.overlay }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: "28%",
                height: "16%",
                left: "55%",
                top: "58%",
                background: `radial-gradient(ellipse, ${darken(color, 55)}, ${darken(color, 35)} 60%, transparent)`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </>
        )}

        {texture === "cratered" && (
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: surface.overlay }}
          />
        )}

        {texture === "nebula" && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: surface.overlay, filter: "blur(4px)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Light highlight (from star direction) */}
        <div
          className="absolute left-1/4 top-1/4 h-1/2 w-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(1 0 0 / 0.25), transparent 70%)",
            filter: "blur(4px)",
          }}
        />
      </div>

      {/* Permanent ring for "ringed" planets (Saturn-like, always visible) */}
      {texture === "ringed" && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2"
          style={{
            width: "190%",
            height: "190%",
            borderColor: fade(color, 50),
            transform: "translate(-50%, -50%) rotateX(75deg)",
            transformStyle: "preserve-3d",
            boxShadow: `0 0 10px ${fade(color, 60)}`,
          }}
        />
      )}

      {/* Hover ring (for non-ringed planets — ringed already has permanent ring) */}
      <AnimatePresence>
        {(hovered || diving) && texture !== "ringed" && (
          <motion.div
            initial={{ opacity: 0, rotateX: 80, scale: 0.8 }}
            animate={{ opacity: 1, rotateX: 75, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              width: "180%",
              height: "180%",
              borderColor: fade(color, 50),
              transformStyle: "preserve-3d",
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   getSurfaceGradient — returns base + overlay CSS per texture
   ============================================================ */
function getSurfaceGradient(
  texture: string,
  color: string,
  craters: { x: number; y: number; r: number }[]
): { base: string; overlay: string } {
  switch (texture) {
    case "swirly":
      // Gas-giant with flowing swirls — overlay rotates for animation.
      return {
        base: `radial-gradient(circle at 35% 35%, ${lighten(color, 30)}, ${color} 50%, ${darken(color, 40)})`,
        overlay: [
          `radial-gradient(ellipse 60% 25% at 25% 35%, ${lighten(color, 50)}, transparent 60%)`,
          `radial-gradient(ellipse 50% 20% at 70% 25%, ${lighten(color, 30)}, transparent 60%)`,
          `radial-gradient(ellipse 45% 25% at 60% 70%, ${darken(color, 30)}, transparent 60%)`,
          `radial-gradient(ellipse 55% 30% at 30% 75%, ${lighten(color, 20)}, transparent 60%)`,
          `conic-gradient(from 0deg at 50% 50%, ${fade(color, 20)}, ${lighten(color, 40)}, ${fade(color, 20)}, ${darken(color, 30)}, ${fade(color, 20)})`,
        ].join(", "),
      };

    case "cratered":
      // Rocky surface with scattered dark craters.
      return {
        base: `radial-gradient(circle at 35% 35%, ${lighten(color, 30)}, ${color} 50%, ${darken(color, 40)})`,
        overlay: craters
          .map(
            (c) =>
              `radial-gradient(circle at ${c.x}% ${c.y}%, oklch(0 0 0 / 0.55) 0%, oklch(0 0 0 / 0.25) ${c.r * 0.6}%, transparent ${c.r}%)`
          )
          .join(", "),
      };

    case "gas-bands":
    case "ringed":
      // Jupiter-like horizontal banding (repeating-linear-gradient at 0deg
      // produces horizontal bands because gradient axis is perpendicular).
      return {
        base: `radial-gradient(circle at 35% 35%, ${lighten(color, 25)}, ${color} 50%, ${darken(color, 40)})`,
        overlay: `repeating-linear-gradient(0deg,
          ${darken(color, 40)} 0%,
          ${color} 4%,
          ${lighten(color, 25)} 8%,
          ${color} 12%,
          ${darken(color, 30)} 16%,
          ${color} 20%,
          ${darken(color, 45)} 24%,
          ${color} 28%,
          ${lighten(color, 15)} 32%,
          ${color} 36%,
          ${darken(color, 35)} 40%)`,
      };

    case "nebula":
      // Fuzzy multi-layer glow, no sharp surface.
      return {
        base: `radial-gradient(circle at 50% 50%, ${lighten(color, 20)}, ${color} 40%, ${darken(color, 50)})`,
        overlay: [
          `radial-gradient(circle at 30% 40%, ${lighten(color, 50)} 0%, transparent 40%)`,
          `radial-gradient(circle at 70% 30%, ${lighten(color, 30)} 0%, transparent 50%)`,
          `radial-gradient(circle at 60% 70%, ${darken(color, 30)} 0%, transparent 60%)`,
          `radial-gradient(circle at 30% 75%, ${lighten(color, 40)} 0%, transparent 50%)`,
        ].join(", "),
      };

    default:
      return {
        base: `radial-gradient(circle at 35% 35%, ${lighten(color, 30)}, ${color} 50%, ${darken(color, 40)})`,
        overlay: "transparent",
      };
  }
}

/* ============================================================
   MoonSystem — true 3D moon orbiting via rAF + translate3d.
   Computes each moon's 3D position directly:
     x = R·cos(θ)
     y = R·sin(θ)·cos(tilt)   (foreshortened by tilt)
     z = R·sin(θ)·sin(tilt)   (depth — moons go behind/front)
   ============================================================ */
function MoonSystem({
  moons,
  color,
  moonSize,
  orbitRadius,
  period,
  tilt,
}: {
  moons: string[];
  color: string;
  moonSize: number;
  orbitRadius: number;
  period: number;
  tilt: number;
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const tiltRad = (tilt * Math.PI) / 180;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const elapsed = (performance.now() - start) / 1000;
      const baseAngle = -(elapsed / period) * Math.PI * 2;
      moons.forEach((_, i) => {
        const el = refs.current[i];
        if (!el) return;
        const angle = baseAngle + (i / moons.length) * Math.PI * 2;
        const r = orbitRadius;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle) * Math.cos(tiltRad);
        const z = r * Math.sin(angle) * Math.sin(tiltRad);
        el.style.transform = `translate3d(${x.toFixed(2)}vmin, ${y.toFixed(2)}vmin, ${z.toFixed(2)}vmin)`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [moons, orbitRadius, period, tiltRad]);

  return (
    <>
      {moons.map((moon, i) => (
        <div
          key={moon + i}
          ref={(el) => { refs.current[i] = el; }}
          className="absolute left-0 top-0"
          style={{ transformStyle: "preserve-3d", willChange: "transform" }}
        >
          <Moon label={moon} color={color} size={moonSize} index={i} />
        </div>
      ))}
    </>
  );
}

/* ============================================================
   Moon — a small sphere (positioned by MoonSystem via translate3d)
   ============================================================ */
function Moon({
  label,
  color,
  size,
  index,
}: {
  label: string;
  color: string;
  size: number;
  index: number;
}) {
  return (
    <div
      className="relative"
      style={{
        transformStyle: "preserve-3d",
        marginLeft: `-${size / 2}vmin`,
        marginTop: `-${size / 2}vmin`,
      }}
    >
      <motion.div
        className="relative grid place-items-center rounded-full"
        style={{
          width: `${size}vmin`,
          height: `${size}vmin`,
          background: `radial-gradient(circle at 30% 30%, ${lighten(color, 50)}, ${color} 60%, ${darken(color, 40)})`,
          boxShadow: `0 0 12px ${fade(color, 40)}, inset -2px -2px 4px oklch(0 0 0 / 0.4)`,
        }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
      >
        {/* Moon label */}
        <span
          className="absolute top-full mt-0.5 whitespace-nowrap font-mono text-[7px] tracking-wider opacity-70"
          style={{ color }}
        >
          {label}
        </span>
      </motion.div>
    </div>
  );
}

/* ============================================================
   Starfield — twinkling background stars
   Uses a seeded PRNG so SSR and client render identically
   (avoids hydration mismatch from Math.random()).
   ============================================================ */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a string to a 32-bit unsigned int (FNV-1a). Used to seed
// the crater PRNG from planet.id — deterministic across SSR/client.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Generate stars once at module load (seeded PRNG → SSR/client identical).
const STARS = (() => {
  const rand = mulberry32(42);
  return Array.from({ length: 80 }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    size: rand() * 1.5 + 0.5,
    delay: rand() * 3,
    duration: rand() * 3 + 2,
  }));
})();

function Starfield() {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
      {STARS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
          }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ============================================================
   DiveOverlay — cinematic "fly into the planet" transition.
   Uses planet.color for the expanding circle + warp streaks.
   ============================================================ */
function DiveOverlay({ planet }: { planet: PlanetConfig }) {
  const color = planet.color;
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ background: "oklch(0.02 0.01 280)" }}
    >
      {/* Expanding planet circle — simulates flying into it */}
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${lighten(color, 50)}, ${color} 40%, ${darken(color, 40)})`,
          boxShadow: `0 0 100px ${fade(color, 40)}`,
        }}
        initial={{ width: "10vmin", height: "10vmin", x: "-50%", y: "-50%" }}
        animate={{ width: "300vmax", height: "300vmax", x: "-50%", y: "-50%" }}
        transition={{ duration: 2, ease: [0.65, 0, 0.35, 1] }}
      >
        {/* Surface texture that rotates as we "dive" */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-40"
          style={{
            background:
              "repeating-linear-gradient(15deg, transparent 0px, transparent 8px, oklch(1 0 0 / 0.08) 8px, oklch(1 0 0 / 0.08) 12px)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: "linear" }}
        />
      </motion.div>

      {/* Light streaks (warp-speed effect) */}
      <div className="absolute inset-0">
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          return (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 origin-left"
              style={{
                width: "60vmax",
                height: "1px",
                background: `linear-gradient(to right, transparent, ${lighten(color, 40)})`,
                transform: `rotate(${angle}rad)`,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
            />
          );
        })}
      </div>

      {/* Destination label */}
      <motion.div
        className="relative z-10 text-center"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 1.2] }}
        transition={{ duration: 2, times: [0, 0.3, 0.7, 1], ease: "easeOut" }}
      >
        <div
          className="font-mono text-xs uppercase tracking-[0.4em]"
          style={{ color }}
        >
          entering
        </div>
        <div className="mt-2 text-4xl font-black text-white sm:text-6xl" style={{ textShadow: `0 0 30px ${fade(color, 40)}` }}>
          {planet.label}
        </div>
        <div className="mt-2 text-sm text-white/60">{planet.hint}</div>
      </motion.div>
    </motion.div>
  );
}
