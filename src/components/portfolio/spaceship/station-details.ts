import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ResourcePool, SpaceshipMaterials } from "./materials";
import type { WingLayout } from "./types";
import { createTieFighter, createXWing } from "./sci-fi-models";

function telemetryTexture(pool: ResourcePool, layouts: WingLayout[], lang: "fa" | "en", index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 420;
  const context = canvas.getContext("2d")!;
  const texture = pool.track(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  const fa = lang === "fa";
  const update = (time: number) => {
    context.fillStyle = "#020b13";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(70,190,230,.1)";
    context.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 48) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
    }
    for (let y = 0; y < canvas.height; y += 42) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
    }
    const accent = index % 2 ? "#74f7c5" : "#67e8f9";
    context.fillStyle = accent;
    context.font = "600 24px monospace";
    context.textAlign = "left";
    context.fillText(`STATION OPS / NODE 0${index + 1}`, 34, 48);
    context.fillStyle = "#7295a8";
    context.font = "18px Vazirmatn, Tahoma, sans-serif";
    const projectCount = layouts.reduce((sum, layout) => sum + layout.def.projects.length, 0);
    context.fillText(fa ? `${layouts.length} راهرو فعال · ${projectCount} پروژه در آرشیو` : `${layouts.length} active decks · ${projectCount} archived projects`, 34, 82);
    context.fillStyle = "#315064";
    context.fillRect(34, 108, 700, 1);
    context.strokeStyle = accent;
    context.lineWidth = 3;
    context.beginPath();
    for (let x = 34; x <= 734; x += 5) {
      const y = 220 + Math.sin(x * 0.032 + time * 1.6 + index) * 38 + Math.sin(x * 0.083 - time * 0.7) * 14;
      if (x === 34) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.fillStyle = "#496b7d";
    context.font = "16px monospace";
    context.fillText("TELEMETRY / LIVE", 34, 322);
    for (let light = 0; light < 8; light++) {
      context.fillStyle = light < 6 ? accent : "#315064";
      context.globalAlpha = 0.55 + Math.sin(time * 2 + light) * 0.2;
      context.fillRect(34 + light * 42, 350, 28, 7);
    }
    context.globalAlpha = 1;
    context.fillStyle = "#87a9ba";
    context.fillText("LINK STABLE", 555, 360);
    texture.needsUpdate = true;
  };
  update(0);
  return { texture, update };
}

export function buildCommandConsoles(scene: THREE.Scene, layouts: WingLayout[], pool: ResourcePool, materials: SpaceshipMaterials, lang: "fa" | "en") {
  const rounded = pool.track(new RoundedBoxGeometry(1, 1, 1, 2, 0.07));
  const box = pool.track(new THREE.BoxGeometry(1, 1, 1));
  const updates: ((time: number) => void)[] = [];
  const obstacles: { x: number; z: number; radius: number }[] = [];
  const consoleCount = Math.min(4, layouts.length);
  const wingAngles = layouts.map((layout) => layout.angle).sort((a, b) => a - b);
  for (let index = 0; index < consoleCount; index++) {
    const currentAngle = wingAngles[index % wingAngles.length];
    const nextAngle = wingAngles[(index + 1) % wingAngles.length];
    let gap = nextAngle - currentAngle;
    if (gap <= 0) gap += Math.PI * 2;
    const angle = currentAngle + gap / 2;
    const radius = 4.65;
    const group = new THREE.Group();
    group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    group.lookAt(0, 0.8, 0);
    scene.add(group);
    obstacles.push({ x: group.position.x, z: group.position.z, radius: 0.82 });
    const base = new THREE.Mesh(rounded, materials.hullDark);
    base.scale.set(1.25, 0.68, 0.74);
    base.position.y = 0.42;
    base.castShadow = true;
    group.add(base);
    const foot = new THREE.Mesh(rounded, materials.trim);
    foot.scale.set(1.34, 0.1, 0.82);
    foot.position.y = 0.08;
    group.add(foot);
    const consoleTop = new THREE.Group();
    consoleTop.position.set(0, 0.95, -0.08);
    consoleTop.rotation.x = -0.48;
    group.add(consoleTop);
    const frame = new THREE.Mesh(rounded, materials.black);
    frame.scale.set(1.24, 0.78, 0.09);
    consoleTop.add(frame);
    const telemetry = telemetryTexture(pool, layouts, lang, index);
    updates.push(telemetry.update);
    const screenMaterial = pool.track(new THREE.MeshBasicMaterial({ map: telemetry.texture, toneMapped: false }));
    const screen = new THREE.Mesh(pool.track(new THREE.PlaneGeometry(1.12, 0.64)), screenMaterial);
    screen.position.z = 0.052;
    consoleTop.add(screen);
    const status = new THREE.Mesh(box, index % 2 ? materials.cyanLight : materials.warmLight);
    status.scale.set(0.6, 0.025, 0.035);
    status.position.set(0, 0.78, 0.32);
    group.add(status);
    for (let button = 0; button < 5; button++) {
      const key = new THREE.Mesh(box, button === 4 ? materials.copper : materials.trim);
      key.scale.set(0.1, 0.035, 0.07);
      key.position.set(-0.36 + button * 0.18, 0.76, 0.2);
      group.add(key);
    }
  }
  let lastUpdate = -1;
  return {
    obstacles,
    update(time: number) {
      if (time - lastUpdate < 0.14) return;
      lastUpdate = time;
      updates.forEach((update) => update(time));
    },
  };
}

function createShuttle(pool: ResourcePool, materials: SpaceshipMaterials, scale: number) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  const body = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 12)), materials.hull);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(pool.track(new THREE.ConeGeometry(0.16, 0.45, 12)), materials.trim);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 0.85;
  group.add(nose);
  const cockpit = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.18, 12, 8)), materials.glass);
  cockpit.position.set(0.28, 0.16, 0);
  group.add(cockpit);
  for (const side of [-1, 1] as const) {
    const wing = new THREE.Mesh(pool.track(new THREE.BoxGeometry(0.65, 0.035, 0.5)), materials.hullDark);
    wing.position.set(-0.15, 0, side * 0.36);
    wing.rotation.y = side * 0.28;
    group.add(wing);
    const engine = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.07, 8, 6)), materials.cyanLight);
    engine.position.set(-0.72, 0, side * 0.18);
    group.add(engine);
  }
  return group;
}

export function createSpaceTraffic(scene: THREE.Scene, pool: ResourcePool, materials: SpaceshipMaterials, lowPower: boolean) {
  const traffic = new THREE.Group();
  scene.add(traffic);
  const shuttles = Array.from({ length: lowPower ? 1 : 3 }, (_, index) => {
    const shuttle = createShuttle(pool, materials, 0.75 + index * 0.2);
    traffic.add(shuttle);
    return shuttle;
  });
  const xWing = createXWing(pool, materials);
  xWing.scale.setScalar(1.35);
  traffic.add(xWing);
  const tieFighter = createTieFighter(pool, materials);
  tieFighter.scale.setScalar(1.15);
  traffic.add(tieFighter);
  const drone = new THREE.Group();
  const droneBody = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.28, 16, 10)), materials.hull);
  drone.add(droneBody);
  for (let arm = 0; arm < 4; arm++) {
    const angle = arm * Math.PI / 2;
    const strut = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8)), materials.trim);
    strut.rotation.z = Math.PI / 2;
    strut.rotation.y = angle;
    drone.add(strut);
    const light = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.055, 8, 6)), arm % 2 ? materials.warmLight : materials.cyanLight);
    light.position.set(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35);
    drone.add(light);
  }
  traffic.add(drone);

  const stationRing = new THREE.Mesh(pool.track(new THREE.TorusGeometry(7, 0.16, 10, 80)), materials.hull);
  stationRing.position.set(-38, 12, -72);
  stationRing.rotation.set(0.35, 0.4, 0.1);
  traffic.add(stationRing);
  const hub = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.6, 0.6, 5, 12)), materials.hullDark);
  hub.position.copy(stationRing.position);
  hub.rotation.z = Math.PI / 2;
  traffic.add(hub);

  return (time: number, dt: number) => {
    shuttles.forEach((shuttle, index) => {
      const phase = ((time * (0.55 + index * 0.12) + index * 31) % 105) / 105;
      shuttle.position.set(-58 + phase * 116, 8 + index * 5 + Math.sin(phase * Math.PI * 2) * 3, -38 - index * 18);
      shuttle.rotation.set(0.08 * Math.sin(time * 0.2 + index), -0.1 + index * 0.08, 0.04 * Math.sin(time * 0.3 + index));
    });
    const xPhase = (time * 2.4 % 150) / 150;
    xWing.position.set(58 - xPhase * 116, 15 + Math.sin(time * 0.18) * 4, -46 + Math.sin(time * 0.08) * 8);
    xWing.rotation.set(0.08, Math.PI, -0.08 + Math.sin(time * 0.25) * 0.04);
    const tiePhase = ((time * 3.1 + 70) % 150) / 150;
    tieFighter.position.set(-58 + tiePhase * 116, 4 + Math.sin(time * 0.22) * 3, -32 + Math.cos(time * 0.1) * 7);
    tieFighter.rotation.set(0.12, -0.2, 0.06);
    drone.position.set(13 + Math.sin(time * 0.12) * 4, 7 + Math.sin(time * 0.45) * 0.8, -26 + Math.cos(time * 0.12) * 3);
    drone.rotation.y += dt * 0.3;
    stationRing.rotation.z += dt * 0.006;
  };
}
