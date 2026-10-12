"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import type { SceneObject3DConfig } from "@/lib/content-types";
import { useContent } from "@/lib/content-store";
import { makeFrameGate } from "@/lib/anim";
import { liveAudio } from "@/lib/audio-energy";

type Variant = "crystal" | "neural" | "orbit";

const VARIANT_COLORS: Record<Variant, [number, number, number]> = {
  crystal: [0xe84a9b, 0xffb15e, 0x4a8aff],
  neural: [0x4a8aff, 0x16d6c3, 0xb14ae8],
  orbit: [0x3ee08a, 0x16d6c3, 0xffffff],
};

/** Section-default DOM placement for an ambient object.
 *  Values here are only fallbacks — CMS fields (domSide/domTop/domOffset/
 *  domSize) always win when set. Everything is logical/direction-aware,
 *  so "end" automatically flips to the correct physical side in RTL. */
export interface AmbientPlacement {
  side?: "start" | "end" | "center";
  top?: number;    // percent from the section top
  offset?: number; // rem from the chosen side (negative = bleed outward)
  size?: number;   // container px
}

const SIDES = ["start", "end", "center"] as const;

function resolvePlacement(
  config: Partial<SceneObject3DConfig> | null | undefined,
  placement?: AmbientPlacement
): Required<AmbientPlacement> {
  const side = SIDES.includes(config?.domSide as (typeof SIDES)[number])
    ? (config!.domSide as Required<AmbientPlacement>["side"])
    : placement?.side ?? "end";
  const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    side,
    top: num(config?.domTop ?? placement?.top, 8),
    offset: num(config?.domOffset ?? placement?.offset, -2.5),
    size: Math.max(48, num(config?.domSize ?? placement?.size, 288)),
  };
}

/** Builds the absolute-positioning style for the object container. */
export function ambientPlacementStyle(
  config: Partial<SceneObject3DConfig> | null | undefined,
  placement?: AmbientPlacement
): CSSProperties {
  const p = resolvePlacement(config, placement);
  const base: CSSProperties = {
    position: "absolute",
    top: `${p.top}%`,
    width: p.size,
    height: p.size,
  };
  if (Number.isFinite(Number(config?.domX))) {
    const x = Math.max(0, Math.min(100, Number(config?.domX)));
    return { ...base, left: `${x}%`, transform: "translateX(-50%)" };
  }
  if (p.side === "start") return { ...base, insetInlineStart: `${p.offset}rem` };
  if (p.side === "end") return { ...base, insetInlineEnd: `${p.offset}rem` };
  // center: direction-safe horizontal centering without transforms
  return { ...base, left: "50%", marginInlineStart: -p.size / 2 };
}

export function Ambient3DObject({
  variant = "crystal",
  className = "",
  config,
  defaultPlacement,
}: {
  variant?: Variant;
  className?: string;
  config?: Partial<SceneObject3DConfig> | null;
  defaultPlacement?: AmbientPlacement;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cache = useContent((s) => s.content.builder?.cache);
  const frameRate = useContent((s) => s.content.builder?.performance?.frameRate);
  const fpsRef = useRef(frameRate);
  useEffect(() => {
    fpsRef.current = frameRate;
  }, [frameRate]);
  // audio-reactive pulse (music.visualizer.reactive3d)
  const reactive = useContent((s) => s.content.music?.visualizer);
  const reactiveRef = useRef(reactive);
  useEffect(() => {
    reactiveRef.current = reactive;
  }, [reactive]);

  useEffect(() => {
    const mount = ref.current;
    if (!mount) return;

    // WebGL contexts are a scarce browser resource (hard cap ≈ 8-16 live
    // contexts per page). With several ambient objects mounted at once the
    // browser starts force-losing the oldest contexts ("Too many active
    // WebGL contexts" warnings, stuttering). So each ambient scene is:
    //   - created lazily — only when it scrolls within ~300px of the
    //     viewport, and
    //   - fully disposed (including the GL context) once it is scrolled
    //     300px+ away, freeing the slot for visible scenes.
    let cleanupScene: (() => void) | null = null;

    const disposeScene = () => {
      if (!cleanupScene) return;
      cleanupScene();
      cleanupScene = null;
    };

    const createScene = () => {
      if (cleanupScene) return;
      cleanupScene = buildScene(mount, {
        variant,
        config,
        maxDpr: Math.max(1, Number(cache?.maxCanvasDpr || 1.75)),
        pauseOffscreen: cache?.pauseOffscreen3D !== false,
        getFps: () => fpsRef.current,
        getReactive: () => reactiveRef.current,
      });
    };

    // Create EARLY (5000px = effectively "at page load") so shader compilation
    // happens during initial render, NOT during scroll. The 500ms+ long tasks
    // were caused by compiling WebGL shaders when sections entered the 600px
    // viewport band during scrolling.
    const lifecycle = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) createScene();
      },
      { rootMargin: "5000px 0px" }
    );
    lifecycle.observe(mount);

    // Hysteresis: dispose only when the object is VERY FAR away.
    // With 5000px create distance, dispose band is also widened so objects
    // are never thrashed during normal scroll.
    const disposeObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) disposeScene();
      },
      { rootMargin: "6000px 0px" }
    );
    disposeObserver.observe(mount);

    return () => {
      lifecycle.disconnect();
      disposeObserver.disconnect();
      disposeScene();
    };
  }, [cache?.maxCanvasDpr, cache?.pauseOffscreen3D, config, variant]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none blur-[0.2px] ${className}`}
      style={{
        ...(config?.enabled === false ? { opacity: 0 } : undefined),
        ...ambientPlacementStyle(config, defaultPlacement),
      }}
    />
  );
}

/* Builds the scene imperatively and returns a disposer that frees every
   resource INCLUDING the WebGL context. Kept outside the component so the
   effect body stays readable. */
function buildScene(
  mount: HTMLDivElement,
  {
    variant,
    config,
    maxDpr,
    pauseOffscreen,
    getFps,
    getReactive,
  }: {
    variant: Variant;
    config?: Partial<SceneObject3DConfig> | null;
    maxDpr: number;
    pauseOffscreen: boolean;
    getFps: () => number;
    getReactive: () => { reactive3d?: boolean; sensitivity?: number; danceAmplitude?: number } | undefined;
  }
): () => void {
    const [primaryFallback, secondaryFallback, tertiaryFallback] = VARIANT_COLORS[variant];
    const primary = parseColor(config?.colorA, primaryFallback);
    const secondary = parseColor(config?.colorB, secondaryFallback);
    const tertiary = parseColor(config?.colorC, tertiaryFallback);
    const speed = Math.max(0.05, Number(config?.speed || 1));
    const opacity = clamp(Number(config?.opacity ?? 0.7), 0, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const light = new THREE.PointLight(primary, 22, 36);
    light.position.set(-3, 4, 6);
    scene.add(light);
    const fill = new THREE.PointLight(secondary, 14, 30);
    fill.position.set(4, -2, 4);
    scene.add(fill);

    const objectKind = config?.kind && config.kind !== "model" ? config.kind : variant;
    const coreGeometry =
      objectKind === "neural"
        ? new THREE.TorusKnotGeometry(1.65, 0.28, 180, 18, 2, 5)
        : objectKind === "orbit"
          ? new THREE.OctahedronGeometry(1.8, 3)
          : new THREE.IcosahedronGeometry(1.85, 4);
    const core = new THREE.Mesh(
      coreGeometry,
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(primary).lerp(new THREE.Color(0xffffff), 0.26),
        roughness: 0.14,
        metalness: 0.04,
        transmission: 0.32,
        thickness: 1.6,
        transparent: true,
        opacity: Math.max(0.18, opacity * 0.6),
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        emissive: new THREE.Color(primary),
        emissiveIntensity: 0.05,
      })
    );
    root.add(core);
    root.position.set(Number(config?.x || 0), Number(config?.y || 0), Number(config?.z || 0));
    root.rotation.set(
      THREE.MathUtils.degToRad(Number(config?.rotateX || 0)),
      THREE.MathUtils.degToRad(Number(config?.rotateY || 0)),
      THREE.MathUtils.degToRad(Number(config?.rotateZ || 0))
    );
    root.scale.setScalar(Math.max(0.1, Number(config?.scale || 1)));

    const rings = [0, 1, 2].map((i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.45 + i * 0.38, 0.015, 8, 140),
        new THREE.MeshBasicMaterial({
          color: [primary, secondary, tertiary][i],
          transparent: true,
          opacity: opacity * 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.rotation.x = Math.PI / 2 + i * 0.4;
      ring.rotation.y = i * 0.55;
      root.add(ring);
      return ring;
    });

    const particleGeometry = new THREE.BufferGeometry();
    const points: number[] = [];
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.7 + Math.random() * 1.5;
      points.push(Math.cos(a) * r, (Math.random() - 0.5) * 2.7, Math.sin(a) * r);
    }
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: secondary,
        size: 0.035,
        transparent: true,
        opacity: opacity * 0.72,
        blending: THREE.AdditiveBlending,
      })
    );
    root.add(particles);

    let loadedScene: THREE.Object3D | null = null;
    if (config?.kind === "model" && config.modelUrl) {
      void import("three/examples/jsm/loaders/GLTFLoader.js")
        .then(({ GLTFLoader }) => {
          const loader = new GLTFLoader();
          loader.load(config.modelUrl || "", (gltf) => {
            loadedScene = gltf.scene;
            loadedScene.scale.setScalar(1.6);
            loadedScene.traverse((obj) => {
              const mesh = obj as THREE.Mesh;
              if (mesh.isMesh) {
                mesh.material = new THREE.MeshPhysicalMaterial({
                  color: new THREE.Color(primary),
                  roughness: 0.18,
                  metalness: 0.08,
                  transmission: 0.25,
                  transparent: true,
                  opacity: Math.max(0.25, opacity),
                  clearcoat: 1,
                });
              }
            });
            core.visible = false;
            root.add(loadedScene);
          });
        })
        .catch(() => {});
    }

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let raf = 0;
    let visible = true;
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = !pauseOffscreen || entry.isIntersecting;
    }, { rootMargin: "160px" });
    visibilityObserver.observe(mount);
    const start = performance.now();
    const gate = makeFrameGate(getFps);
    const baseRootScale = Math.max(0.1, Number(config?.scale || 1));
    const baseY = Number(config?.y || 0);
    let danceSmooth = 0;
    const animate = () => {
      if (!visible) {
        raf = requestAnimationFrame(animate);
        return;
      }
      if (!gate(performance.now())) {
        raf = requestAnimationFrame(animate);
        return;
      }
      const t = (performance.now() - start) / 1000;
      // audio-reactive dance: smoothed envelope → gentle scale pulse AND a
      // physical bob (up/down) so the object visibly moves, not just grows
      const rv = getReactive();
      let pulse = 0;
      if (rv?.reactive3d !== false && liveAudio.active) {
        const sens = Math.max(0.2, Math.min(3, Number(rv?.sensitivity) || 1));
        const amp = Math.max(0, Math.min(3, Number(rv?.danceAmplitude ?? 1)));
        pulse = (liveAudio.bass * 0.3 + liveAudio.mid * 0.2) * sens;
        const target = Math.min(pulse, 1.2);
        danceSmooth += (target - danceSmooth) * (target > danceSmooth ? 0.3 : 0.1);
        root.position.y = baseY + Math.sin(t * 2.6) * amp * (0.2 + danceSmooth * 0.55);
      } else {
        danceSmooth *= 0.9;
        root.position.y = baseY;
      }
      root.scale.setScalar(baseRootScale * (1 + danceSmooth * 0.35));
      root.rotation.y = THREE.MathUtils.degToRad(Number(config?.rotateY || 0)) + t * 0.28 * speed;
      root.rotation.x = THREE.MathUtils.degToRad(Number(config?.rotateX || 0)) + Math.sin(t * 0.55 * speed) * 0.22;
      root.rotation.z = THREE.MathUtils.degToRad(Number(config?.rotateZ || 0)) + Math.cos(t * 0.36 * speed) * 0.12;
      core.scale.setScalar(1 + Math.sin(t * 1.2) * 0.035);
      rings.forEach((ring, i) => {
        ring.rotation.z = t * (0.18 + i * 0.07) * speed;
        ring.rotation.y += (0.0018 + i * 0.0008) * speed;
      });
      if (loadedScene) loadedScene.rotation.y = -t * 0.18 * speed;
      particles.rotation.y = -t * 0.2 * speed;
      light.intensity = 18 + Math.sin(t * 1.5) * 5;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibilityObserver.disconnect();
      mount.removeChild(renderer.domElement);
      coreGeometry.dispose();
      (core.material as THREE.Material).dispose();
      rings.forEach((ring) => {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      });
      particleGeometry.dispose();
      (particles.material as THREE.Material).dispose();
      renderer.dispose();
      // actually return the GL context to the browser's pool — without
      // this the "too many contexts" cap still churns through losses
      renderer.forceContextLoss();
    };
}

function parseColor(value: string | undefined, fallback: number) {
  try {
    return new THREE.Color(value || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
