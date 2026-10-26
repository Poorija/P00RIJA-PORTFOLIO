import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildSpaceshipArchitecture } from "./architecture";
import { createSpaceEnvironment } from "./environment";
import { createSpaceshipMaterials, ResourcePool } from "./materials";
import { createSpaceTraffic } from "./station-details";
import { createGalacticObjects } from "./sci-fi-models";
import { EYE, HUB_R, VIEW_DIST, WING_W, type ArtworkEntry, type FocusInfo, type WingLayout } from "./types";
import { projectTarget } from "@/lib/guard-targets";

interface ExperienceOptions {
  mount: HTMLDivElement;
  layouts: WingLayout[];
  lang: "fa" | "en";
  spawnWingId?: string;
  coarse: boolean;
  lowPower: boolean;
  reducedMotion: boolean;
  frameRate: number;
  onReady: () => void;
  onFocus: (focus: FocusInfo | null) => void;
  onPointerLock: (locked: boolean) => void;
  onPlayerMove: (x: number, z: number, yaw: number, jump: number) => void;
  onOpenCatalog: (project: ArtworkEntry["project"], wingLabel: string) => void;
  onOpenResumeBook?: () => void;
  onRequestUnlock: (target: string, label: string) => void;
}

export interface SpaceshipExperience {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
  teleport: (wingId: string) => boolean;
  interact: () => void;
  debug: () => unknown;
  joystick: { x: number; y: number };
}

function shortestAngle(value: number) {
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function createSpaceshipExperience(options: ExperienceOptions): SpaceshipExperience {
  const { mount, layouts, lang, coarse, lowPower, reducedMotion } = options;
  const fa = lang === "fa";
  const renderer = new THREE.WebGLRenderer({ antialias: !coarse && !lowPower, powerPreference: "high-performance", alpha: false });
  const maxDpr = lowPower ? 1 : coarse ? 1.25 : 1.65;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = !coarse && !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.display = "block";
  canvas.setAttribute("aria-label", fa ? "فضاپیمای نمایشگاه سه‌بعدی" : "3D exhibition spaceship");
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030a);
  const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / mount.clientHeight, 0.06, 240);
  const pool = new ResourcePool();
  const materials = createSpaceshipMaterials(pool);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(room, 0.04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.72;
  room.dispose();
  pmrem.dispose();

  const hemisphere = new THREE.HemisphereLight(0x8db9e8, 0x10141d, 1.25);
  scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xb9d8ff, 2.4);
  key.position.set(12, 24, 8);
  key.castShadow = renderer.shadowMap.enabled;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -16;
  key.shadow.camera.right = key.shadow.camera.top = 16;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 55;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const hubWarm = new THREE.PointLight(0xffd8a0, lowPower ? 18 : 28, 19, 1.8);
  hubWarm.position.set(0, 4.3, 0);
  scene.add(hubWarm);
  const hubFill = new THREE.PointLight(0x4fbdff, lowPower ? 9 : 15, 15, 1.7);
  hubFill.position.set(0, 2.2, 0);
  scene.add(hubFill);

  const updateSpace = createSpaceEnvironment(scene, pool, lowPower);
  const updateTraffic = createSpaceTraffic(scene, pool, materials, lowPower);
  const updateGalaxy = createGalacticObjects(scene, pool, materials, lowPower);
  const { artworks, animated, obstacles } = buildSpaceshipArchitecture({ scene, layouts, pool, materials, lang, lowPower, reducedMotion });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), lowPower ? 0.1 : 0.22, 0.42, 1.05);
  composer.addPass(bloom);
  const output = new OutputPass();
  composer.addPass(output);

  type Collider = { dir: { x: number; z: number }; perp: { x: number; z: number }; alongMin: number; alongMax: number; halfW: number; wallStart: number; wallPlane: number };
  const colliders: Collider[] = layouts.map((layout) => ({
    dir: layout.dir,
    perp: { x: -layout.dir.z, z: layout.dir.x },
    alongMin: HUB_R - 2.6,
    alongMax: HUB_R + layout.length - 2.4,
    halfW: WING_W / 2 - 0.42,
    wallStart: HUB_R - 2,
    wallPlane: WING_W / 2,
  }));
  const spawnAt = (layout: WingLayout) => {
    const x = layout.dir.x * (HUB_R + 2.2);
    const z = layout.dir.z * (HUB_R + 2.2);
    return { pos: new THREE.Vector3(x, EYE, z), yaw: Math.atan2(-layout.dir.x, -layout.dir.z) };
  };
  const spawnWing = layouts.find((layout) => layout.def.id === options.spawnWingId) ?? layouts[0];
  const spawn = spawnAt(spawnWing);
  const player = { pos: spawn.pos.clone(), yaw: spawn.yaw, targetYaw: spawn.yaw, pitch: 0, targetPitch: 0, bob: 0, roll: 0 };
  let jumpHeight = 0;
  let jumpVelocity = 0;
  const velocity = new THREE.Vector2();
  const keys = new Set<string>();
  const joystick = { x: 0, y: 0 };
  const look = { id: -1, x: 0, y: 0 };
  const autoGoto = { active: false, pos: new THREE.Vector3(), yaw: 0, then: null as null | (() => void), elapsed: 0, duration: 1.8, start: new THREE.Vector3(), startYaw: 0 };
  let focusedIdx = -1;
  let paused = false;
  let disposed = false;
  let contextLost = false;
  let raf = 0;
  let hudElapsed = 0;
  let renderElapsed = 0;
  let lastTime = performance.now();
  let elapsedTime = 0;

  const walkable = (x: number, z: number) => {
    if (Math.abs(x) < 1.12 && Math.abs(z) < 1.12) return false;
    for (const obstacle of obstacles) {
      if ((x - obstacle.x) ** 2 + (z - obstacle.z) ** 2 < (obstacle.radius + 0.34) ** 2) return false;
    }
    for (const collider of colliders) {
      const along = x * collider.dir.x + z * collider.dir.z;
      if (along < collider.alongMin || along > collider.alongMax) continue;
      const across = x * collider.perp.x + z * collider.perp.z;
      if (Math.abs(across) <= collider.halfW) return true;
    }
    for (const collider of colliders) {
      if (x * collider.dir.x + z * collider.dir.z > collider.wallStart) {
        const across = x * collider.perp.x + z * collider.perp.z;
        if (Math.abs(across) > collider.wallPlane) return false;
      }
    }
    return x * x + z * z <= (HUB_R - 0.42) ** 2;
  };
  const movePlayer = (dx: number, dz: number) => {
    if (!walkable(player.pos.x, player.pos.z)) {
      player.pos.x *= 0.96;
      player.pos.z *= 0.96;
      return;
    }
    if (walkable(player.pos.x + dx, player.pos.z)) player.pos.x += dx;
    else velocity.x = 0;
    if (walkable(player.pos.x, player.pos.z + dz)) player.pos.z += dz;
    else velocity.y = 0;
  };

  const pickArtwork = () => {
    const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    let best = -1;
    let bestScore = 0.78;
    artworks.forEach((artwork, index) => {
      const to = new THREE.Vector3().subVectors(artwork.pos, player.pos).setY(0);
      const distance = to.length();
      const maxDistance = artwork.wing.id === "__desk__" ? VIEW_DIST + 3.4 : VIEW_DIST + 2.7;
      if (distance > maxDistance) return;
      to.normalize();
      const dot = to.dot(forward);
      if (dot > bestScore) {
        bestScore = dot;
        best = index;
      }
    });
    return best;
  };

  const glideTo = (artwork: ArtworkEntry, then: (() => void) | null) => {
    autoGoto.pos.copy(artwork.spot);
    autoGoto.yaw = Math.atan2(artwork.pos.x - artwork.spot.x, artwork.pos.z - artwork.spot.z) + Math.PI;
    autoGoto.then = then;
    if (reducedMotion) {
      player.pos.copy(autoGoto.pos);
      player.yaw = player.targetYaw = autoGoto.yaw;
      autoGoto.then?.();
      autoGoto.then = null;
      return;
    }
    autoGoto.start.copy(player.pos);
    autoGoto.startYaw = player.yaw;
    autoGoto.elapsed = 0;
    autoGoto.duration = Math.min(2.4, Math.max(0.75, player.pos.distanceTo(autoGoto.pos) / 2.4));
    autoGoto.active = true;
  };
  const cycleFocus = () => {
    if (!artworks.length) return;
    const next = (focusedIdx + 1) % artworks.length;
    glideTo(artworks[next], null);
  };
  const interact = () => {
    if (paused) return;
    const index = pickArtwork();
    if (index < 0) return;
    const artwork = artworks[index];
    if (artwork.wing.id === "__desk__") {
      glideTo(artwork, () => options.onOpenResumeBook?.());
      return;
    }
    if (artwork.wing.locked) {
      options.onRequestUnlock(`gallery:${artwork.wing.id}`, artwork.wing.label);
      return;
    }
    if (artwork.project.locked) {
      options.onRequestUnlock(projectTarget(artwork.wing.id, artwork.project.title ?? ""), artwork.project.title ?? "");
      return;
    }
    glideTo(artwork, () => options.onOpenCatalog(artwork.project, artwork.wing.label));
  };
  const teleport = (wingId: string) => {
    const layout = layouts.find((item) => item.def.id === wingId);
    if (!layout) return false;
    const target = spawnAt(layout);
    player.pos.copy(target.pos);
    player.yaw = player.targetYaw = target.yaw;
    player.pitch = player.targetPitch = 0;
    jumpHeight = jumpVelocity = 0;
    velocity.set(0, 0);
    autoGoto.active = false;
    return true;
  };

  const overlayOpen = () => Boolean(document.querySelector("[data-guard-dialog], [data-gallery-catalog], [data-museum-intro]"));
  const onKeyDown = (event: KeyboardEvent) => {
    if (overlayOpen() || paused) {
      keys.clear();
      return;
    }
    const target = event.target;
    const interactive = target instanceof Element && Boolean(target.closest("button, a, input, textarea, select, [contenteditable='true'], [role='button']"));
    if (interactive || event.ctrlKey || event.metaKey || event.altKey) return;
    const keyName = event.code || event.key.toLowerCase();
    if (keyName === "Tab") {
      event.preventDefault();
      cycleFocus();
      return;
    }
    keys.add(keyName);
    if (keyName === "Enter") {
      event.preventDefault();
      interact();
    } else if (keyName === "Space" || event.key === " ") {
      event.preventDefault();
      if (jumpHeight <= 0.001) jumpVelocity = 4.6;
    }
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code || event.key.toLowerCase());
  const onLockChange = () => options.onPointerLock(document.pointerLockElement === canvas);
  const onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== canvas || paused) return;
    player.targetYaw -= event.movementX * 0.0023;
    player.targetPitch = THREE.MathUtils.clamp(player.targetPitch - event.movementY * 0.002, -1.05, 1.05);
  };
  const onCanvasClick = () => {
    if (paused || overlayOpen()) return;
    if (!coarse && document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock?.();
      return;
    }
    interact();
  };
  let tapInfo = { x: 0, y: 0, time: 0, moved: false };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    look.id = event.pointerId;
    look.x = event.clientX;
    look.y = event.clientY;
    tapInfo = { x: event.clientX, y: event.clientY, time: performance.now(), moved: false };
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== look.id || paused) return;
    const dx = event.clientX - look.x;
    const dy = event.clientY - look.y;
    look.x = event.clientX;
    look.y = event.clientY;
    if (Math.abs(event.clientX - tapInfo.x) + Math.abs(event.clientY - tapInfo.y) > 7) tapInfo.moved = true;
    player.targetYaw -= dx * 0.0048;
    player.targetPitch = THREE.MathUtils.clamp(player.targetPitch - dy * 0.0038, -1.05, 1.05);
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== look.id) return;
    look.id = -1;
    if (!tapInfo.moved && performance.now() - tapInfo.time < 350 && !paused) interact();
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== look.id) return;
    look.id = -1;
    tapInfo.moved = true;
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
  };
  const onContextRestored = () => {
    contextLost = false;
    resize();
  };
  const onVisibility = () => {
    lastTime = performance.now();
    keys.clear();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  document.addEventListener("pointerlockchange", onLockChange);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  const resize = () => {
    if (!mount.clientWidth || !mount.clientHeight) return;
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    composer.setSize(mount.clientWidth, mount.clientHeight);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);

  const updateFocus = () => {
    const index = pickArtwork();
    if (index !== focusedIdx) {
      focusedIdx = index;
      if (index < 0) options.onFocus(null);
      else {
        const artwork = artworks[index];
        options.onFocus(artwork.wing.id === "__desk__"
          ? { kind: "project", title: fa ? "کتاب درباره من — رزومه و مشخصات" : "My book — profile & résumé", sub: fa ? "ایستگاه مرکزی" : "central reading station", wingLabel: artwork.wing.label }
          : artwork.wing.locked
            ? { kind: "lockedWing", title: artwork.wing.label, sub: fa ? "این راهرو با رمز قفل است" : "this corridor is password-protected", wingLabel: artwork.wing.label }
            : artwork.project.locked
              ? { kind: "lockedProj", title: artwork.project.title, sub: fa ? "این پروژه محافظت‌شده است" : "this project is protected", wingLabel: artwork.wing.label }
              : { kind: "project", title: artwork.project.title, sub: [artwork.project.category, artwork.project.year].filter(Boolean).join(" · "), wingLabel: artwork.wing.label });
      }
    }
    options.onPlayerMove(player.pos.x, player.pos.z, player.yaw, jumpHeight);
  };

  const animate = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(animate);
    const rawDelta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (contextLost || document.hidden) return;
    if (paused || overlayOpen()) {
      velocity.set(0, 0);
      keys.clear();
      return;
    }
    const frameInterval = options.frameRate > 0 ? 1 / Math.max(24, options.frameRate) : 0;
    renderElapsed += rawDelta;
    if (frameInterval > 0 && renderElapsed < frameInterval) return;
    const dt = Math.min(0.05, renderElapsed);
    renderElapsed = 0;
    elapsedTime += dt;

    if (autoGoto.active) {
      autoGoto.elapsed += dt;
      const linear = Math.min(1, autoGoto.elapsed / autoGoto.duration);
      const eased = linear < 0.5 ? 4 * linear ** 3 : 1 - Math.pow(-2 * linear + 2, 3) / 2;
      const targetX = THREE.MathUtils.lerp(autoGoto.start.x, autoGoto.pos.x, eased);
      const targetZ = THREE.MathUtils.lerp(autoGoto.start.z, autoGoto.pos.z, eased);
      movePlayer(targetX - player.pos.x, targetZ - player.pos.z);
      player.targetYaw = autoGoto.startYaw + shortestAngle(autoGoto.yaw - autoGoto.startYaw) * eased;
      if (linear >= 1) {
        autoGoto.active = false;
        autoGoto.then?.();
        autoGoto.then = null;
      }
    } else {
      const forward = new THREE.Vector2(-Math.sin(player.yaw), -Math.cos(player.yaw));
      const right = new THREE.Vector2(-forward.y, forward.x);
      let moveForward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - joystick.y;
      let moveSide = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0) + joystick.x;
      const magnitude = Math.hypot(moveForward, moveSide);
      if (magnitude > 1) {
        moveForward /= magnitude;
        moveSide /= magnitude;
      }
      const run = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 1.65 : 1;
      const speed = 3.25 * run;
      const desiredX = (forward.x * moveForward + right.x * moveSide) * speed;
      const desiredZ = (forward.y * moveForward + right.y * moveSide) * speed;
      const response = 1 - Math.exp(-dt * (magnitude > 0.01 ? 10 : 7));
      velocity.x += (desiredX - velocity.x) * response;
      velocity.y += (desiredZ - velocity.y) * response;
      movePlayer(velocity.x * dt, velocity.y * dt);
      if (keys.has("ArrowLeft")) player.targetYaw += 1.75 * dt;
      if (keys.has("ArrowRight")) player.targetYaw -= 1.75 * dt;
    }

    const lookResponse = reducedMotion ? 1 : 1 - Math.exp(-dt * 18);
    player.yaw += shortestAngle(player.targetYaw - player.yaw) * lookResponse;
    player.pitch += (player.targetPitch - player.pitch) * lookResponse;
    const actualSpeed = velocity.length();
    player.bob += dt * (actualSpeed > 0.12 ? 7.2 + actualSpeed * 0.7 : 0.8);
    const bobAmount = reducedMotion ? 0 : Math.min(0.032, actualSpeed * 0.009);
    const targetRoll = reducedMotion ? 0 : THREE.MathUtils.clamp(-velocity.x * 0.0018, -0.009, 0.009);
    player.roll += (targetRoll - player.roll) * (1 - Math.exp(-dt * 7));
    if (jumpHeight > 0 || jumpVelocity > 0) {
      jumpVelocity -= 11.5 * dt;
      jumpHeight += jumpVelocity * dt;
      if (jumpHeight <= 0) {
        jumpHeight = 0;
        jumpVelocity = 0;
      }
    }
    camera.position.set(player.pos.x, EYE + jumpHeight + Math.sin(player.bob) * bobAmount + Math.sin(elapsedTime * 0.55) * (reducedMotion ? 0 : 0.003), player.pos.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(player.yaw);
    camera.rotateX(player.pitch);
    camera.rotateZ(player.roll + Math.cos(player.bob * 0.5) * bobAmount * 0.08);

    updateSpace(elapsedTime, reducedMotion ? 0 : dt);
    updateTraffic(elapsedTime, reducedMotion ? 0 : dt);
    updateGalaxy(elapsedTime, reducedMotion ? 0 : dt);
    for (const update of animated) update(elapsedTime, reducedMotion ? 0 : dt, player.pos);
    hudElapsed += dt;
    if (hudElapsed > 0.1) {
      hudElapsed = 0;
      updateFocus();
    }
    composer.render();
  };

  options.onReady();
  raf = requestAnimationFrame(animate);

  return {
    joystick,
    interact,
    teleport,
    setPaused(value) {
      paused = value;
      if (value) {
        keys.clear();
        velocity.set(0, 0);
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      }
      lastTime = performance.now();
    },
    debug: () => ({
      pos: [player.pos.x, player.pos.z], yaw: player.yaw, keys: [...keys], auto: autoGoto.active,
      walkable: walkable(player.pos.x, player.pos.z), colliders: colliders.length, arts: artworks.length,
      drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    }),
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("click", onCanvasClick);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      environmentTarget.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
      pool.dispose();
      renderer.dispose();
      if (canvas.parentElement === mount) mount.removeChild(canvas);
    },
  };
}
