import * as THREE from "three";
import type { ResourcePool, SpaceshipMaterials } from "./materials";

export function createAlienCrew(scene: THREE.Scene, pool: ResourcePool, materials: SpaceshipMaterials, lowPower: boolean, count: number) {
  const root = new THREE.Group();
  scene.add(root);
  const bodyGeometry = pool.track(new THREE.SphereGeometry(0.32, lowPower ? 12 : 20, lowPower ? 8 : 14));
  const headGeometry = pool.track(new THREE.SphereGeometry(0.27, lowPower ? 12 : 20, lowPower ? 8 : 14));
  const limbGeometry = pool.track(new THREE.CylinderGeometry(0.055, 0.07, 0.48, 8));
  const eyeGeometry = pool.track(new THREE.SphereGeometry(0.045, 8, 6));
  const antennaGeometry = pool.track(new THREE.CylinderGeometry(0.018, 0.025, 0.32, 6));
  const aliens: { root: THREE.Group; arms: THREE.Group[]; legs: THREE.Group[]; radius: number; speed: number; offset: number; hover: boolean }[] = [];

  for (let index = 0; index < Math.min(count, lowPower ? 2 : 10); index += 1) {
    const alien = new THREE.Group();
    const skin = pool.track(new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.32 + index * 0.11, 0.58, 0.52), roughness: 0.7, metalness: 0.04 }));
    const body = new THREE.Mesh(bodyGeometry, skin);
    body.scale.set(0.85, 1.25, 0.72);
    body.position.y = 0.92;
    alien.add(body);
    const head = new THREE.Mesh(headGeometry, skin);
    head.scale.set(1.12, 0.9, 0.95);
    head.position.y = 1.45;
    alien.add(head);
    for (const side of [-1, 1] as const) {
      const eye = new THREE.Mesh(eyeGeometry, index % 2 ? materials.warmLight : materials.black);
      eye.position.set(side * 0.1, 1.48, 0.235);
      alien.add(eye);
      const antenna = new THREE.Mesh(antennaGeometry, skin);
      antenna.position.set(side * 0.12, 1.76, 0);
      antenna.rotation.z = side * -0.25;
      alien.add(antenna);
      const tip = new THREE.Mesh(eyeGeometry, materials.cyanLight);
      tip.scale.setScalar(0.7);
      tip.position.set(side * 0.16, 1.92, 0);
      alien.add(tip);
    }
    const arms: THREE.Group[] = [];
    const legs: THREE.Group[] = [];
    for (const side of [-1, 1] as const) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.3, 1.12, 0);
      const armMesh = new THREE.Mesh(limbGeometry, skin);
      armMesh.position.y = -0.22;
      arm.add(armMesh);
      alien.add(arm);
      arms.push(arm);
      const leg = new THREE.Group();
      leg.position.set(side * 0.14, 0.58, 0);
      const legMesh = new THREE.Mesh(limbGeometry, skin);
      legMesh.position.y = -0.24;
      leg.add(legMesh);
      alien.add(leg);
      legs.push(leg);
    }
    const badge = new THREE.Mesh(eyeGeometry, index % 2 ? materials.cyanLight : materials.warmLight);
    badge.scale.setScalar(0.8);
    badge.position.set(0, 1.02, 0.26);
    alien.add(badge);
    const offset = index * 2.17;
    const radius = 2.65 + (index % 3) * 0.48;
    alien.position.set(Math.cos(offset) * radius, 0, Math.sin(offset) * radius);
    root.add(alien);
    aliens.push({ root: alien, arms, legs, radius, speed: 0.12 + index * 0.018, offset, hover: index % 3 === 2 });
  }

  return (time: number, dt: number) => {
    aliens.forEach((alien, index) => {
      const phase = time * alien.speed + alien.offset;
      alien.root.position.x = Math.cos(phase) * alien.radius;
      alien.root.position.z = Math.sin(phase) * alien.radius;
      alien.root.position.y = alien.hover ? 0.32 + Math.sin(time * 1.4 + index) * 0.12 : Math.abs(Math.sin(time * 3.2 + index)) * 0.025;
      alien.root.rotation.y = -phase + Math.PI / 2;
      const stride = alien.hover ? 0 : Math.sin(time * 3.2 + index) * 0.55;
      alien.arms[0].rotation.x = stride;
      alien.arms[1].rotation.x = -stride;
      alien.legs[0].rotation.x = -stride;
      alien.legs[1].rotation.x = stride;
      alien.root.rotation.z = alien.hover ? Math.sin(time * 0.8 + index) * 0.06 : 0;
    });
    void dt;
  };
}
