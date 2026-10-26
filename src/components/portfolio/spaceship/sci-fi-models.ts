import * as THREE from "three";
import type { ResourcePool, SpaceshipMaterials } from "./materials";
import type { WingLayout } from "./types";

export function createXWing(pool: ResourcePool, materials: SpaceshipMaterials) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.18, 0.3, 1.8, 12)), materials.hull);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(pool.track(new THREE.ConeGeometry(0.18, 0.65, 12)), materials.trim);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.18;
  group.add(nose);
  const cockpit = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.24, 16, 10)), materials.glass);
  cockpit.scale.set(1.25, 0.65, 0.8);
  cockpit.position.set(0.25, 0.25, 0);
  group.add(cockpit);
  for (const vertical of [-1, 1] as const) {
    for (const lateral of [-1, 1] as const) {
      const wing = new THREE.Mesh(pool.track(new THREE.BoxGeometry(1.15, 0.055, 0.34)), materials.hullDark);
      wing.position.set(-0.15, vertical * 0.22, lateral * 0.67);
      wing.rotation.x = lateral * vertical * 0.2;
      group.add(wing);
      const engine = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.09, 0.12, 0.62, 10)), materials.trim);
      engine.rotation.z = Math.PI / 2;
      engine.position.set(-0.62, vertical * 0.22, lateral * 0.54);
      group.add(engine);
      const glow = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.075, 8, 6)), materials.warmLight);
      glow.position.set(-0.96, vertical * 0.22, lateral * 0.54);
      group.add(glow);
      const cannon = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6)), materials.trim);
      cannon.rotation.z = Math.PI / 2;
      cannon.position.set(0.42, vertical * 0.22, lateral * 1.02);
      group.add(cannon);
    }
  }
  return group;
}

export function createTieFighter(pool: ResourcePool, materials: SpaceshipMaterials) {
  const group = new THREE.Group();
  const cockpit = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.38, 20, 14)), materials.hullDark);
  group.add(cockpit);
  const window = new THREE.Mesh(pool.track(new THREE.CircleGeometry(0.2, 8)), materials.glass);
  window.position.z = 0.34;
  group.add(window);
  for (const side of [-1, 1] as const) {
    const strut = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.055, 0.055, 0.65, 8)), materials.trim);
    strut.rotation.z = Math.PI / 2;
    strut.position.x = side * 0.52;
    group.add(strut);
    const panel = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.82, 0.82, 0.055, 6)), materials.hullDark);
    panel.rotation.z = Math.PI / 2;
    panel.position.x = side * 0.88;
    group.add(panel);
    const frame = new THREE.LineSegments(pool.track(new THREE.EdgesGeometry(panel.geometry)), pool.track(new THREE.LineBasicMaterial({ color: 0x8296a8 })));
    frame.rotation.copy(panel.rotation);
    frame.position.copy(panel.position);
    group.add(frame);
  }
  return group;
}

export function createGalacticObjects(scene: THREE.Scene, pool: ResourcePool, materials: SpaceshipMaterials, lowPower: boolean) {
  const root = new THREE.Group();
  scene.add(root);
  const blackHole = new THREE.Group();
  blackHole.position.set(-42, 24, -82);
  root.add(blackHole);
  const core = new THREE.Mesh(pool.track(new THREE.SphereGeometry(3.1, 32, 20)), pool.track(new THREE.MeshBasicMaterial({ color: 0x000000 })));
  blackHole.add(core);
  const diskMaterial = pool.track(new THREE.MeshBasicMaterial({ color: 0xff9e57, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const disk = new THREE.Mesh(pool.track(new THREE.TorusGeometry(5.1, 0.42, 16, 96)), diskMaterial);
  disk.rotation.x = 1.12;
  blackHole.add(disk);
  const photonRing = new THREE.Mesh(pool.track(new THREE.TorusGeometry(3.35, 0.07, 10, 96)), pool.track(new THREE.MeshBasicMaterial({ color: 0xffd7a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  photonRing.rotation.x = 0.15;
  blackHole.add(photonRing);

  const galaxy = new THREE.Group();
  galaxy.position.set(54, 28, -105);
  galaxy.rotation.set(0.65, 0.15, -0.3);
  root.add(galaxy);
  const count = lowPower ? 600 : 1800;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const arm = index % 4;
    const radius = Math.pow(Math.random(), 0.62) * 13;
    const angle = radius * 0.48 + arm * Math.PI / 2 + (Math.random() - 0.5) * 0.48;
    positions.set([Math.cos(angle) * radius, (Math.random() - 0.5) * (0.2 + radius * 0.025), Math.sin(angle) * radius], index * 3);
    const color = new THREE.Color().setHSL(0.58 + Math.random() * 0.18, 0.55, 0.55 + Math.random() * 0.4);
    colors.set([color.r, color.g, color.b], index * 3);
  }
  const geometry = pool.track(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(geometry, pool.track(new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false })));
  galaxy.add(stars);
  const galaxyCore = new THREE.Mesh(pool.track(new THREE.SphereGeometry(1.2, 16, 10)), pool.track(new THREE.MeshBasicMaterial({ color: 0xffd9bc, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
  galaxy.add(galaxyCore);

  const ringedPlanet = new THREE.Group();
  ringedPlanet.position.set(-22, -12, -54);
  root.add(ringedPlanet);
  ringedPlanet.add(new THREE.Mesh(pool.track(new THREE.SphereGeometry(3.2, 32, 20)), materials.hull));
  const planetRing = new THREE.Mesh(pool.track(new THREE.TorusGeometry(4.7, 0.16, 10, 80)), materials.copper);
  planetRing.rotation.x = 1.15;
  ringedPlanet.add(planetRing);
  const moon = new THREE.Mesh(pool.track(new THREE.SphereGeometry(1.5, 24, 16)), materials.hullDark);
  moon.position.set(24, -9, -62);
  root.add(moon);

  return (time: number, dt: number) => {
    disk.rotation.z += dt * 0.11;
    photonRing.rotation.z -= dt * 0.05;
    galaxy.rotation.y += dt * 0.003;
    galaxyCore.scale.setScalar(1 + Math.sin(time * 0.4) * 0.08);
    planetRing.rotation.z += dt * 0.015;
    moon.rotation.y += dt * 0.025;
  };
}

export function buildSciFiProps(scene: THREE.Scene, layouts: WingLayout[], pool: ResourcePool, materials: SpaceshipMaterials) {
  const obstacles: { x: number; z: number; radius: number }[] = [];
  const animated: THREE.Group[] = [];
  const angles = layouts.map((layout) => layout.angle).sort((a, b) => a - b);
  for (let index = 0; index < Math.min(3, layouts.length); index++) {
    const current = angles[index % angles.length];
    const next = angles[(index + 1) % angles.length];
    let gap = next - current;
    if (gap <= 0) gap += Math.PI * 2;
    const angle = current + gap * 0.68;
    const group = new THREE.Group();
    group.position.set(Math.cos(angle) * 3.05, 0, Math.sin(angle) * 3.05);
    scene.add(group);
    obstacles.push({ x: group.position.x, z: group.position.z, radius: 0.48 });
    const pedestal = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.42, 0.52, 0.62, 10)), materials.hullDark);
    pedestal.position.y = 0.31;
    group.add(pedestal);
    const rim = new THREE.Mesh(pool.track(new THREE.TorusGeometry(0.43, 0.018, 8, 32)), materials.cyanLight);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.64;
    group.add(rim);
    const artifact = new THREE.Group();
    artifact.position.y = 1.1;
    group.add(artifact);
    animated.push(artifact);
    if (index === 0) {
      const hilt = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.055, 0.065, 0.32, 12)), materials.trim);
      hilt.position.y = -0.2;
      artifact.add(hilt);
      const bladeMaterial = pool.track(new THREE.MeshStandardMaterial({ color: 0x9df3ff, emissive: 0x38bdf8, emissiveIntensity: 4, roughness: 0.2 }));
      const blade = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.025, 0.035, 1.25, 12)), bladeMaterial);
      blade.position.y = 0.55;
      artifact.add(blade);
    } else if (index === 1) {
      const helmet = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.34, 24, 16)), materials.hull);
      helmet.scale.set(0.9, 1.05, 0.95);
      artifact.add(helmet);
      const visor = new THREE.Mesh(pool.track(new THREE.BoxGeometry(0.48, 0.12, 0.08)), materials.black);
      visor.position.set(0, 0.04, 0.3);
      artifact.add(visor);
      for (const side of [-1, 1] as const) {
        const filter = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 10)), materials.trim);
        filter.rotation.x = Math.PI / 2;
        filter.position.set(side * 0.22, -0.18, 0.25);
        artifact.add(filter);
      }
    } else {
      const body = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.24, 18, 12)), materials.hull);
      artifact.add(body);
      const eye = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.07, 10, 8)), materials.warmLight);
      eye.position.z = 0.22;
      artifact.add(eye);
      for (const side of [-1, 1] as const) {
        const ring = new THREE.Mesh(pool.track(new THREE.TorusGeometry(0.2, 0.025, 8, 24)), materials.trim);
        ring.rotation.y = Math.PI / 2;
        ring.position.x = side * 0.34;
        artifact.add(ring);
      }
    }
  }
  return {
    obstacles,
    update(time: number, dt: number) {
      animated.forEach((artifact, index) => {
        artifact.position.y = 1.1 + Math.sin(time * 0.8 + index) * 0.055;
        artifact.rotation.y += dt * (0.18 + index * 0.05);
      });
    },
  };
}
