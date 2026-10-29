import * as THREE from "three";
import type { ResourcePool, SpaceshipMaterials } from "./materials";

export function createSpaceDebris(scene: THREE.Scene, pool: ResourcePool, materials: SpaceshipMaterials, lowPower: boolean, asteroidCount: number, meteorCount: number) {
  const root = new THREE.Group();
  scene.add(root);
  const count = Math.min(asteroidCount, lowPower ? 24 : 80);
  const geometry = pool.track(new THREE.DodecahedronGeometry(0.65, 0));
  const material = pool.track(new THREE.MeshStandardMaterial({ color: 0x5e6672, roughness: 0.96, metalness: 0.08 }));
  const asteroids = new THREE.InstancedMesh(geometry, material, count);
  root.add(asteroids);
  const dummy = new THREE.Object3D();
  const debris = Array.from({ length: count }, (_, index) => ({
    x: -75 + Math.random() * 150,
    y: -28 + Math.random() * 65,
    z: -35 - Math.random() * 85,
    scale: 0.25 + Math.random() * 1.25,
    speed: 0.25 + Math.random() * 0.8,
    rotation: index * 0.71,
  }));

  const meteors = Array.from({ length: Math.min(meteorCount, lowPower ? 4 : 16) }, (_, index) => {
    const group = new THREE.Group();
    const head = new THREE.Mesh(pool.track(new THREE.SphereGeometry(0.13, 8, 6)), materials.warmLight);
    group.add(head);
    const trail = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.015, 0.16, 4.8, 8)), pool.track(new THREE.MeshBasicMaterial({ color: 0x8ddcff, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false })));
    trail.rotation.z = Math.PI / 2;
    trail.position.x = 2.35;
    group.add(trail);
    root.add(group);
    return { group, offset: index * 29.7, speed: 7 + index * 0.8 };
  });

  return (time: number, dt: number) => {
    debris.forEach((rock, index) => {
      const x = ((rock.x + time * rock.speed + 75) % 150) - 75;
      dummy.position.set(x, rock.y + Math.sin(time * 0.08 + index) * 1.2, rock.z);
      dummy.rotation.set(rock.rotation + time * 0.08, rock.rotation * 0.7 + time * 0.06, rock.rotation * 0.3);
      dummy.scale.setScalar(rock.scale);
      dummy.updateMatrix();
      asteroids.setMatrixAt(index, dummy.matrix);
    });
    asteroids.instanceMatrix.needsUpdate = true;
    meteors.forEach((meteor, index) => {
      const phase = ((time * meteor.speed + meteor.offset) % 170) / 170;
      meteor.group.position.set(82 - phase * 164, 28 - index * 4 - phase * 24, -42 - index * 9);
      meteor.group.rotation.z = -0.32;
      meteor.group.visible = phase > 0.04 && phase < 0.92;
    });
    void dt;
  };
}
