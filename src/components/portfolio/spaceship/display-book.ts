import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ResourcePool, SpaceshipMaterials } from "./materials";

export function createDisplayBook(pool: ResourcePool, materials: SpaceshipMaterials) {
  const root = new THREE.Group();
  const book = new THREE.Group();
  book.position.y = 1.72;
  root.add(book);
  const cyan = new THREE.Color(0x67e8f9);
  const rounded = pool.track(new RoundedBoxGeometry(1, 1, 1, 2, 0.06));
  const box = pool.track(new THREE.BoxGeometry(1, 1, 1));
  const hologramMaterial = pool.track(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: cyan }, uOpacity: { value: 0.34 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
      void main(){
        float scan = .72 + .28 * sin(vUv.y * 170.0 - uTime * 4.0);
        float edge = pow(1.0 - min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y))*2.0, 3.0);
        float pulse = .9 + .1 * sin(uTime * 2.2);
        gl_FragColor=vec4(uColor*(.65+edge*.85)*scan*pulse,uOpacity*(.65+edge*.35));
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const glass = pool.track(new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const edgeMaterial = pool.track(new THREE.LineBasicMaterial({ color: 0x9df3ff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }));
  const dataMaterial = pool.track(new THREE.MeshBasicMaterial({ color: 0xb8f6ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pageGeometry = pool.track(new THREE.PlaneGeometry(0.66, 0.82, 1, 1));

  for (const side of [-1, 1] as const) {
    const half = new THREE.Group();
    half.position.x = side * 0.35;
    half.rotation.z = side * -0.08;
    book.add(half);
    const cover = new THREE.Mesh(rounded, glass);
    cover.scale.set(0.73, 0.055, 0.92);
    half.add(cover);
    const edges = new THREE.LineSegments(pool.track(new THREE.EdgesGeometry(rounded)), edgeMaterial);
    edges.scale.copy(cover.scale);
    half.add(edges);
    for (let layer = 0; layer < 8; layer++) {
      const sheet = new THREE.Mesh(box, glass);
      sheet.scale.set(0.675, 0.006, 0.85);
      sheet.position.y = 0.04 + layer * 0.012;
      half.add(sheet);
    }
    const page = new THREE.Mesh(pageGeometry, hologramMaterial);
    page.rotation.x = -Math.PI / 2;
    page.position.y = 0.145;
    half.add(page);
    for (let line = 0; line < 9; line++) {
      const width = line % 3 === 0 ? 0.38 : 0.48 - (line % 2) * 0.08;
      const data = new THREE.Mesh(box, dataMaterial);
      data.scale.set(width, 0.004, 0.012);
      data.position.set(side * -0.04, 0.153, -0.29 + line * 0.07);
      half.add(data);
    }
  }
  const spine = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 12)), dataMaterial);
  spine.rotation.x = Math.PI / 2;
  spine.position.y = 0.06;
  book.add(spine);
  const turningLeaf = new THREE.Group();
  turningLeaf.position.y = 0.18;
  book.add(turningLeaf);
  const leaf = new THREE.Mesh(pageGeometry, hologramMaterial);
  leaf.rotation.x = -Math.PI / 2;
  leaf.position.x = 0.34;
  turningLeaf.add(leaf);

  const pedestal = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.85, 1.08, 0.82, 12)), materials.hullDark);
  pedestal.position.y = 0.41;
  pedestal.castShadow = true;
  root.add(pedestal);
  const pedestalTop = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(1.02, 0.92, 0.12, 32)), materials.trim);
  pedestalTop.position.y = 0.86;
  root.add(pedestalTop);
  for (const [radius, material] of [[1.2, materials.cyanLight], [1.5, materials.copper]] as const) {
    const ring = new THREE.Mesh(pool.track(new THREE.TorusGeometry(radius, 0.018, 8, 64)), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.025;
    root.add(ring);
  }
  const emitter = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.3, 0.36, 0.07, 32)), materials.cyanLight);
  emitter.position.y = 0.95;
  root.add(emitter);
  const projection = new THREE.Mesh(pool.track(new THREE.ConeGeometry(0.82, 1.65, 40, 1, true)), pool.track(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  projection.position.y = 1.6;
  projection.rotation.x = Math.PI;
  root.add(projection);

  const orbitGroup = new THREE.Group();
  orbitGroup.position.y = 1.8;
  root.add(orbitGroup);
  const rings: THREE.Mesh[] = [];
  for (let index = 0; index < 3; index++) {
    const ring = new THREE.Mesh(pool.track(new THREE.TorusGeometry(0.88 + index * 0.12, 0.006, 6, 80)), dataMaterial);
    ring.rotation.set(Math.PI / 2 - 0.28 + index * 0.3, index * 0.45, 0);
    orbitGroup.add(ring);
    rings.push(ring);
  }
  const particleCount = 48;
  const positions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index++) {
    const angle = index / particleCount * Math.PI * 2;
    positions.set([Math.cos(angle) * (0.6 + Math.random() * 0.55), (Math.random() - 0.5) * 1.1, Math.sin(angle) * (0.6 + Math.random() * 0.55)], index * 3);
  }
  const particleGeometry = pool.track(new THREE.BufferGeometry());
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(particleGeometry, pool.track(new THREE.PointsMaterial({ color: 0x9df3ff, size: 0.025, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })));
  orbitGroup.add(particles);

  return {
    root,
    entryPosition: new THREE.Vector3(0, 1.72, 0),
    update(time: number, dt: number, reducedMotion: boolean) {
      const amount = reducedMotion ? 0 : 1;
      hologramMaterial.uniforms.uTime.value = time;
      book.position.y = 1.72 + Math.sin(time * 0.85) * 0.05 * amount;
      book.rotation.y = -0.22 + Math.sin(time * 0.25) * 0.2 * amount;
      book.rotation.z = Math.sin(time * 0.45) * 0.018 * amount;
      orbitGroup.rotation.y += dt * 0.16 * amount;
      particles.rotation.y -= dt * 0.22 * amount;
      rings.forEach((ring, index) => { ring.rotation.z += dt * (0.16 + index * 0.08) * (index % 2 ? -1 : 1) * amount; });
      const phase = (time % 8) / 1.9;
      turningLeaf.visible = phase < 1 && !reducedMotion;
      if (turningLeaf.visible) {
        const eased = 0.5 - Math.cos(Math.min(1, phase) * Math.PI) * 0.5;
        turningLeaf.rotation.z = -eased * Math.PI;
      } else turningLeaf.rotation.z = 0;
      projection.scale.setScalar(0.98 + Math.sin(time * 1.3) * 0.02 * amount);
    },
  };
}
