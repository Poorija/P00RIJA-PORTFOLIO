"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitalLoader } from "./orbital-loader";

export function Media3DPreview({ url, filename, className = "h-44 w-full" }: { url: string; filename?: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = host.current;
    if (!container || !url) return;
    setError(false);
    setReady(false);
    let disposed = false;
    let frame = 0;
    let object: THREE.Object3D | undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
    camera.position.set(0, 0.4, 3.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x15121d, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(3, 4, 5); scene.add(key);

    const normalize = (loaded: THREE.Object3D) => {
      object = loaded;
      const box = new THREE.Box3().setFromObject(loaded);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z, 0.001);
      loaded.position.sub(center);
      loaded.scale.multiplyScalar(1.8 / longest);
      scene.add(loaded);
      if (!disposed) setReady(true);
    };
    const fail = () => { if (!disposed) setError(true); };
    let routedFilename = "";
    try { routedFilename = new URL(url, window.location.href).searchParams.get("filename") || ""; } catch { /* use URL as-is */ }
    const extension = (filename || routedFilename || url).split("?")[0].split(".").pop()?.toLowerCase();
    void (async () => {
      try {
        if (extension === "obj") {
          const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
          new OBJLoader().load(url, normalize, undefined, fail);
        } else if (extension === "fbx") {
          const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
          new FBXLoader().load(url, normalize, undefined, fail);
        } else {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          new GLTFLoader().load(url, (gltf) => normalize(gltf.scene), undefined, fail);
        }
      } catch { fail(); }
    })();

    const resize = () => {
      const width = Math.max(1, container.clientWidth); const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    const draw = () => { if (disposed) return; if (object) object.rotation.y += 0.004; renderer.render(scene, camera); frame = requestAnimationFrame(draw); };
    draw();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      scene.traverse((node) => { const mesh = node as THREE.Mesh; mesh.geometry?.dispose?.(); const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []; materials.forEach((material) => material.dispose()); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [filename, url]);

  return <div ref={host} className={`relative overflow-hidden rounded-lg bg-gradient-to-br from-[var(--ai-1)]/10 to-[var(--sec-1)]/10 ${className}`}>
    {!ready && !error && <OrbitalLoader label="Loading 3D preview…" className="bg-transparent" />}
    {error && <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">3D preview unavailable</div>}
  </div>;
}
