import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { SceneObject3DConfig } from "./content-types";

export type ProceduralObjectKind = "ribbon" | "prism" | "pen-nib" | "palette" | "lattice" | "capsule" | "atom" | "dna" | "mobius" | "gear" | "satellite" | "rocket" | "robot" | "gamepad" | "globe" | "cube" | "cluster" | "chain" | "flower" | "wave-sphere" | "cyber-eye";

export const PROCEDURAL_OBJECT_LIBRARY: Array<{
  kind: ProceduralObjectKind;
  label: { fa: string; en: string };
  description: { fa: string; en: string };
  colors: [string, string, string];
}> = [
  { kind: "ribbon", label: { fa: "روبان بی‌نهایت", en: "Infinity ribbon" }, description: { fa: "نوار فلزی سیال با مهره‌های نورانی", en: "Flowing metal ribbon with light beads" }, colors: ["#ec4899", "#22d3ee", "#fbbf24"] },
  { kind: "prism", label: { fa: "منشور کروما", en: "Chroma prism" }, description: { fa: "هندسه سه‌پر با لایه‌های شفاف رنگی", en: "Triangular geometry with chromatic layers" }, colors: ["#8b5cf6", "#06b6d4", "#f472b6"] },
  { kind: "pen-nib", label: { fa: "قلم طراحی", en: "Designer nib" }, description: { fa: "نوک قلم نمادین برای هویت گرافیکی", en: "A sculptural nib for graphic identity" }, colors: ["#f43f5e", "#f59e0b", "#38bdf8"] },
  { kind: "palette", label: { fa: "پالت مداری", en: "Orbital palette" }, description: { fa: "چرخه رنگ سه‌بعدی با هسته نورانی", en: "Three-dimensional color wheel with a luminous core" }, colors: ["#e84a9b", "#3ee08a", "#4a8aff"] },
  { kind: "lattice", label: { fa: "شبکه هولو", en: "Holo lattice" }, description: { fa: "شبکه سیم‌کشی با گره‌های نورانی", en: "Wireframe sculpture with illuminated nodes" }, colors: ["#22d3ee", "#a78bfa", "#34d399"] },
  { kind: "capsule", label: { fa: "کپسول انرژی", en: "Energy capsule" }, description: { fa: "هسته فلزی با حلقه‌های ناپایدار", en: "Metallic core wrapped in unstable rings" }, colors: ["#f97316", "#e879f9", "#60a5fa"] },
  { kind: "atom", label: { fa: "اتم کوانتومی", en: "Quantum atom" }, description: { fa: "هسته چندذره‌ای با مدارهای الکترونی", en: "Particle nucleus with electron orbits" }, colors: ["#60a5fa", "#f472b6", "#fbbf24"] },
  { kind: "dna", label: { fa: "مارپیچ DNA", en: "DNA helix" }, description: { fa: "دو رشته مارپیچ با پیوندهای رنگی", en: "Twin helices with colored base links" }, colors: ["#34d399", "#22d3ee", "#e879f9"] },
  { kind: "mobius", label: { fa: "نوار موبیوس", en: "Möbius strip" }, description: { fa: "سطح پیوسته با پیچش هندسی واقعی", en: "Continuous surface with a true geometric twist" }, colors: ["#e879f9", "#38bdf8", "#fbbf24"] },
  { kind: "gear", label: { fa: "چرخ‌دنده مکانیکی", en: "Mechanical gear" }, description: { fa: "دنده‌ها، spoke و محور فلزی", en: "Toothed metal wheel with spokes and hub" }, colors: ["#f59e0b", "#94a3b8", "#38bdf8"] },
  { kind: "satellite", label: { fa: "ماهواره مداری", en: "Orbital satellite" }, description: { fa: "پنل‌های خورشیدی و آنتن ارتباطی", en: "Solar arrays and a communications dish" }, colors: ["#fbbf24", "#3b82f6", "#cbd5e1"] },
  { kind: "rocket", label: { fa: "موشک اکسپلورر", en: "Explorer rocket" }, description: { fa: "بدنه فلزی، کابین و موتور نورانی", en: "Metallic fuselage, cockpit and glowing engines" }, colors: ["#f8fafc", "#f43f5e", "#38bdf8"] },
  { kind: "robot", label: { fa: "ربات همراه", en: "Companion robot" }, description: { fa: "ربات دوست‌داشتنی با چشم‌های نورانی", en: "Friendly articulated robot with luminous eyes" }, colors: ["#a78bfa", "#22d3ee", "#fbbf24"] },
  { kind: "gamepad", label: { fa: "گیم‌پد نئون", en: "Neon gamepad" }, description: { fa: "کنترلر سه‌بعدی با دکمه و آنالوگ", en: "Detailed controller with buttons and sticks" }, colors: ["#8b5cf6", "#22d3ee", "#f472b6"] },
  { kind: "globe", label: { fa: "کره هولوگرافیک", en: "Holographic globe" }, description: { fa: "کره شبکه‌ای با گره‌های داده", en: "Wireframe globe with luminous data nodes" }, colors: ["#22d3ee", "#34d399", "#fbbf24"] },
  { kind: "cube", label: { fa: "مکعب داده", en: "Data cube" }, description: { fa: "قاب نورانی با هسته معلق", en: "Luminous frame with a suspended core" }, colors: ["#60a5fa", "#e879f9", "#34d399"] },
  { kind: "cluster", label: { fa: "خوشه کریستال", en: "Crystal cluster" }, description: { fa: "بلورهای رنگی با رشد نامتقارن", en: "Colorful asymmetric crystal formations" }, colors: ["#a78bfa", "#f472b6", "#22d3ee"] },
  { kind: "chain", label: { fa: "زنجیره توروس", en: "Torus chain" }, description: { fa: "حلقه‌های درهم‌تنیده با هسته مرکزی", en: "Interlocked metal rings around a core" }, colors: ["#f59e0b", "#94a3b8", "#22d3ee"] },
  { kind: "flower", label: { fa: "گل مکانیکی", en: "Mechanical flower" }, description: { fa: "گلبرگ‌های سه‌بعدی با مرکز نورانی", en: "Sculpted petals around a luminous center" }, colors: ["#f472b6", "#fbbf24", "#a78bfa"] },
  { kind: "wave-sphere", label: { fa: "کره موج‌دار", en: "Wave sphere" }, description: { fa: "سطح ارگانیک با موج‌های هندسی", en: "Organic surface with geometric waves" }, colors: ["#06b6d4", "#8b5cf6", "#f472b6"] },
  { kind: "cyber-eye", label: { fa: "چشم سایبری", en: "Cyber eye" }, description: { fa: "عنبیه نورانی با حلقه‌های اسکن", en: "Luminous iris with scanning rings" }, colors: ["#22d3ee", "#8b5cf6", "#f43f5e"] },
];

export function createProceduralConfig(kind: ProceduralObjectKind): SceneObject3DConfig {
  const item = PROCEDURAL_OBJECT_LIBRARY.find((entry) => entry.kind === kind)!;
  return {
    id: `object-${kind}-${Date.now()}`,
    label: item.label.fa,
    enabled: true,
    slot: "section",
    sectionId: "graphics",
    kind,
    modelUrl: "",
    link: "",
    colorA: item.colors[0],
    colorB: item.colors[1],
    colorC: item.colors[2],
    opacity: 0.9,
    scale: 1,
    x: 0,
    y: 0,
    z: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    speed: 0.65,
    morphIntensity: 0.2,
    magmaIntensity: 0,
    hoverEffect: "glow",
    animation: "spin",
    domSide: "end",
    domTop: 20,
    domOffset: -2,
    domSize: 320,
  };
}

export function createProceduralObject(
  kind: SceneObject3DConfig["kind"],
  colors: [number, number, number],
  lowPower: boolean,
): THREE.Group | null {
  if (!PROCEDURAL_OBJECT_LIBRARY.some((entry) => entry.kind === kind)) return null;
  const [a, b, c] = colors;
  const group = new THREE.Group();
  const material = (color: number, options: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.25, ...options });
  const add = (geometry: THREE.BufferGeometry, surface: THREE.Material, position?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geometry, surface);
    if (position) mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  };
  const rod = (start: [number, number, number], end: [number, number, number], radius: number, surface: THREE.Material) => {
    const from = new THREE.Vector3(...start);
    const delta = new THREE.Vector3(...end).sub(from);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, delta.length(), lowPower ? 6 : 10), surface);
    mesh.position.copy(from).add(new THREE.Vector3(...end)).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };

  if (kind === "ribbon") {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2, 0, 0), new THREE.Vector3(-1, 1.25, 0.55),
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, -1.25, -0.55),
      new THREE.Vector3(2, 0, 0), new THREE.Vector3(1, 1.25, 0.55),
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1, -1.25, -0.55),
    ], true, "catmullrom", 0.55);
    add(new THREE.TubeGeometry(curve, lowPower ? 64 : 128, 0.14, lowPower ? 6 : 10, true), material(a));
    const count = lowPower ? 10 : 18;
    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 8, 6), material(b, { emissive: b, emissiveIntensity: 0.65 }), count);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < count; index++) {
      matrix.makeTranslation(...curve.getPointAt(index / count).toArray());
      beads.setMatrixAt(index, matrix);
    }
    group.add(beads);
  } else if (kind === "prism") {
    add(new THREE.CylinderGeometry(1.4, 1.4, 2.65, 3, 1), material(a));
    add(new THREE.CylinderGeometry(0.82, 0.82, 2.85, 3, 1), material(b, { wireframe: true, transparent: true, opacity: 0.7 }));
    add(new THREE.TorusGeometry(1.55, 0.045, 8, lowPower ? 32 : 64), material(c, { emissive: c, emissiveIntensity: 0.5 }), [0, -1.35, 0]).rotation.x = Math.PI / 2;
    for (let index = 0; index < 3; index++) {
      const angle = index * Math.PI * 2 / 3;
      add(new THREE.OctahedronGeometry(0.18, 0), material([a, b, c][index]), [Math.cos(angle) * 1.8, 0, Math.sin(angle) * 1.8]);
    }
  } else if (kind === "pen-nib") {
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.75);
    shape.lineTo(1.02, 0.45);
    shape.lineTo(0.72, -0.95);
    shape.lineTo(0, -1.6);
    shape.lineTo(-0.72, -0.95);
    shape.lineTo(-1.02, 0.45);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: lowPower ? 1 : 3, steps: 1 });
    geometry.center();
    add(geometry, material(a));
    add(new THREE.CircleGeometry(0.2, lowPower ? 16 : 32), material(0x07101c, { metalness: 0.1 }), [0, 0.42, 0.225]);
    add(new THREE.BoxGeometry(0.035, 0.86, 0.02), material(c, { emissive: c, emissiveIntensity: 0.4 }), [0, -0.16, 0.23]);
    add(new THREE.TorusGeometry(0.58, 0.075, 8, lowPower ? 24 : 48), material(b), [0, -1.17, 0]);
  } else if (kind === "palette") {
    const segments = lowPower ? 8 : 12;
    const first = new THREE.Color(a);
    const second = new THREE.Color(b);
    const third = new THREE.Color(c);
    for (let index = 0; index < segments; index++) {
      const color = index < segments / 2 ? first.clone().lerp(second, index / (segments / 2)) : second.clone().lerp(third, (index - segments / 2) / (segments / 2));
      const mesh = add(new THREE.CylinderGeometry(1.72, 1.72, 0.22, lowPower ? 16 : 32, 1, false, index * Math.PI * 2 / segments, Math.PI * 2 / segments * 0.94), material(color.getHex(), { roughness: 0.36 }));
      mesh.rotation.y = index * 0.035;
    }
    add(new THREE.SphereGeometry(0.56, lowPower ? 16 : 32, lowPower ? 12 : 20), material(0xffffff, { emissive: a, emissiveIntensity: 0.75, roughness: 0.18 }), [0, 0.35, 0]);
    add(new THREE.TorusGeometry(1.95, 0.025, 6, lowPower ? 40 : 80), material(c, { emissive: c, emissiveIntensity: 0.6 })).rotation.x = Math.PI / 2;
  } else if (kind === "lattice") {
    const geometry = new THREE.IcosahedronGeometry(1.8, lowPower ? 1 : 2);
    add(geometry.clone(), new THREE.MeshBasicMaterial({ color: a, wireframe: true, transparent: true, opacity: 0.58 }));
    add(new THREE.OctahedronGeometry(0.92, 1), material(b, { transparent: true, opacity: 0.36, emissive: b, emissiveIntensity: 0.22 }));
    const positions = geometry.getAttribute("position");
    const nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 7, 5), material(c, { emissive: c, emissiveIntensity: 0.85 }), positions.count);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < positions.count; index++) {
      matrix.makeTranslation(positions.getX(index), positions.getY(index), positions.getZ(index));
      nodes.setMatrixAt(index, matrix);
    }
    geometry.dispose();
    group.add(nodes);
  } else if (kind === "capsule") {
    add(new THREE.CapsuleGeometry(0.82, 1.55, lowPower ? 4 : 8, lowPower ? 12 : 24), material(a));
    for (let index = 0; index < 3; index++) {
      const ring = add(new THREE.TorusGeometry(1.18 + index * 0.23, 0.045, 8, lowPower ? 36 : 72), material([a, b, c][index], { emissive: [a, b, c][index], emissiveIntensity: 0.4 }));
      ring.rotation.set(Math.PI / 2 + index * 0.38, index * 0.55, index * 0.8);
    }
    add(new THREE.TorusKnotGeometry(1.38, 0.045, lowPower ? 64 : 120, 7, 2, 3), material(b, { emissive: b, emissiveIntensity: 0.45 }));
  } else if (kind === "atom") {
    const nucleus: [number, number, number][] = [[0, 0, 0], [0.3, 0.12, 0.1], [-0.3, -0.08, 0.12], [0.08, 0.34, -0.12], [-0.1, -0.32, -0.1], [0.12, -0.1, 0.32], [-0.14, 0.1, -0.32]];
    nucleus.forEach((position, index) => add(new THREE.SphereGeometry(0.32, lowPower ? 12 : 20, lowPower ? 8 : 14), material(index % 2 ? b : c, { roughness: 0.32 }), position));
    for (let index = 0; index < 3; index++) {
      const ring = add(new THREE.TorusGeometry(1.65, 0.025, 6, lowPower ? 48 : 96), material(a, { emissive: a, emissiveIntensity: 0.5 }));
      ring.rotation.set(index * Math.PI / 3, index * Math.PI / 3, index * Math.PI / 4);
      const angle = index * Math.PI * 2 / 3;
      add(new THREE.SphereGeometry(0.12, 10, 8), material(c, { emissive: c, emissiveIntensity: 1.2 }), [Math.cos(angle) * 1.65, Math.sin(angle) * 1.65, index * 0.3 - 0.3]);
    }
  } else if (kind === "dna") {
    const steps = lowPower ? 16 : 26;
    const beadGeometry = new THREE.SphereGeometry(0.105, 8, 6);
    const first = new THREE.InstancedMesh(beadGeometry, material(a), steps);
    const second = new THREE.InstancedMesh(beadGeometry, material(b), steps);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < steps; index++) {
      const angle = index / steps * Math.PI * 4;
      const y = -1.9 + index / (steps - 1) * 3.8;
      const p1 = new THREE.Vector3(Math.cos(angle) * 0.72, y, Math.sin(angle) * 0.72);
      const p2 = new THREE.Vector3(Math.cos(angle + Math.PI) * 0.72, y, Math.sin(angle + Math.PI) * 0.72);
      matrix.makeTranslation(...p1.toArray()); first.setMatrixAt(index, matrix);
      matrix.makeTranslation(...p2.toArray()); second.setMatrixAt(index, matrix);
      if (index % 2 === 0) rod(p1.toArray(), p2.toArray(), 0.025, material(c, { emissive: c, emissiveIntensity: 0.35 }));
    }
    group.add(first, second);
  } else if (kind === "mobius") {
    const uSegments = lowPower ? 48 : 96;
    const vSegments = lowPower ? 8 : 12;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= uSegments; i++) {
      const u = i / uSegments * Math.PI * 2;
      for (let j = 0; j <= vSegments; j++) {
        const v = (j / vSegments - 0.5) * 0.82;
        const radius = 1.45 + v * Math.cos(u / 2);
        positions.push(radius * Math.cos(u), radius * Math.sin(u), v * Math.sin(u / 2));
        if (i < uSegments && j < vSegments) {
          const p = i * (vSegments + 1) + j;
          indices.push(p, p + vSegments + 1, p + 1, p + 1, p + vSegments + 1, p + vSegments + 2);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    add(geometry, material(a, { side: THREE.DoubleSide, roughness: 0.2 }));
    add(new THREE.TorusGeometry(1.45, 0.025, 6, lowPower ? 48 : 96), material(c, { emissive: c, emissiveIntensity: 0.45 }));
  } else if (kind === "gear") {
    add(new THREE.CylinderGeometry(1.12, 1.12, 0.42, lowPower ? 24 : 48), material(a)).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.34, 0.34, 0.62, lowPower ? 16 : 32), material(c)).rotation.x = Math.PI / 2;
    const teeth = lowPower ? 12 : 18;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.36, 0.46), material(b), teeth);
    const dummy = new THREE.Object3D();
    for (let index = 0; index < teeth; index++) {
      const angle = index / teeth * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 1.34, Math.sin(angle) * 1.34, 0);
      dummy.rotation.z = angle - Math.PI / 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    group.add(mesh);
    for (let index = 0; index < 6; index++) {
      const spoke = add(new THREE.BoxGeometry(0.16, 1.7, 0.25), material(b));
      spoke.rotation.z = index * Math.PI / 3;
    }
  } else if (kind === "satellite") {
    add(new RoundedBoxGeometry(1.2, 1.1, 1, lowPower ? 2 : 4, 0.1), material(a));
    for (const side of [-1, 1] as const) {
      rod([side * 0.55, 0, 0], [side * 1.05, 0, 0], 0.06, material(c));
      add(new THREE.BoxGeometry(1.4, 0.08, 1.55), material(b, { metalness: 0.35, roughness: 0.38 }), [side * 1.65, 0, 0]);
      for (let row = 0; row < 2; row++) for (let column = 0; column < 3; column++) {
        add(new THREE.BoxGeometry(0.025, 0.095, 0.68), material(c), [side * (1.2 + column * 0.43), 0.01, (row - 0.5) * 0.74]);
      }
    }
    const dish = add(new THREE.SphereGeometry(0.5, lowPower ? 16 : 32, lowPower ? 8 : 16, 0, Math.PI * 2, 0, Math.PI / 2), material(c, { side: THREE.DoubleSide }), [0, 0.88, 0]);
    dish.rotation.x = -0.45;
    rod([0, 0.45, 0], [0, 0.85, 0], 0.06, material(b));
    add(new THREE.SphereGeometry(0.1, 10, 8), material(b, { emissive: b, emissiveIntensity: 0.8 }), [0, 1.25, 0.28]);
  } else if (kind === "rocket") {
    add(new THREE.CylinderGeometry(0.55, 0.65, 2.35, lowPower ? 20 : 36), material(a, { metalness: 0.7, roughness: 0.22 }));
    add(new THREE.ConeGeometry(0.56, 1.1, lowPower ? 20 : 36), material(b), [0, 1.7, 0]);
    add(new THREE.SphereGeometry(0.25, lowPower ? 14 : 24, lowPower ? 10 : 16), material(c, { emissive: c, emissiveIntensity: 0.4 }), [0, 0.62, 0.55]);
    for (let index = 0; index < 3; index++) {
      const angle = index * Math.PI * 2 / 3;
      const x = Math.cos(angle) * 0.74;
      const z = Math.sin(angle) * 0.74;
      const fin = add(new THREE.BoxGeometry(0.12, 0.85, 0.5), material(b), [x, -0.98, z]);
      fin.rotation.y = -angle;
      add(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 12), material(c), [x * 0.72, -1.35, z * 0.72]);
      const flame = add(new THREE.ConeGeometry(0.15, 0.65, 12), material(0xff8a3d, { emissive: 0xff5a1f, emissiveIntensity: 1.5, transparent: true, opacity: 0.8 }), [x * 0.72, -1.9, z * 0.72]);
      flame.rotation.z = Math.PI;
    }
    add(new THREE.TorusGeometry(0.58, 0.055, 8, lowPower ? 24 : 48), material(c), [0, -1.13, 0]).rotation.x = Math.PI / 2;
  } else if (kind === "robot") {
    add(new RoundedBoxGeometry(1.15, 1.3, 0.75, lowPower ? 2 : 4, 0.14), material(a), [0, -0.35, 0]);
    add(new RoundedBoxGeometry(1.3, 0.9, 0.85, lowPower ? 2 : 4, 0.2), material(0xe2e8f0, { metalness: 0.35 }), [0, 0.85, 0]);
    for (const side of [-1, 1] as const) {
      add(new THREE.SphereGeometry(0.13, 12, 8), material(b, { emissive: b, emissiveIntensity: 1.25 }), [side * 0.3, 0.91, 0.43]);
      rod([side * 0.68, 0.1, 0], [side * 1.02, -0.75, 0.12], 0.14, material(c));
      rod([side * 0.34, -1, 0], [side * 0.42, -1.7, 0.1], 0.17, material(a));
      add(new RoundedBoxGeometry(0.48, 0.22, 0.68, 2, 0.08), material(c), [side * 0.44, -1.78, 0.22]);
    }
    rod([0, 1.28, 0], [0, 1.65, 0], 0.035, material(c));
    add(new THREE.SphereGeometry(0.11, 10, 8), material(c, { emissive: c, emissiveIntensity: 1 }), [0, 1.72, 0]);
    add(new RoundedBoxGeometry(0.45, 0.36, 0.05, 2, 0.03), material(b, { emissive: b, emissiveIntensity: 0.55 }), [0, -0.3, 0.4]);
  } else if (kind === "gamepad") {
    add(new RoundedBoxGeometry(2.55, 1.15, 0.62, lowPower ? 2 : 5, 0.2), material(a, { roughness: 0.32 }));
    for (const side of [-1, 1] as const) {
      const handle = add(new RoundedBoxGeometry(0.75, 1.25, 0.56, lowPower ? 2 : 4, 0.16), material(a), [side * 0.88, -0.72, 0]);
      handle.rotation.z = side * -0.28;
      const stick = add(new THREE.CylinderGeometry(0.2, 0.24, 0.22, lowPower ? 12 : 24), material(c), [side * 0.48, -0.42, 0.4]);
      stick.rotation.x = Math.PI / 2;
    }
    add(new THREE.BoxGeometry(0.55, 0.16, 0.1), material(c), [-0.83, 0.2, 0.36]);
    add(new THREE.BoxGeometry(0.16, 0.55, 0.1), material(c), [-0.83, 0.2, 0.36]);
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI / 2;
      add(new THREE.SphereGeometry(0.13, 12, 8), material([a, b, c, 0xfbbf24][index], { emissive: [a, b, c, 0xfbbf24][index], emissiveIntensity: 0.35 }), [0.84 + Math.cos(angle) * 0.32, 0.2 + Math.sin(angle) * 0.32, 0.38]);
    }
  } else if (kind === "globe") {
    add(new THREE.SphereGeometry(1.5, lowPower ? 18 : 32, lowPower ? 12 : 24), new THREE.MeshBasicMaterial({ color: a, wireframe: true, transparent: true, opacity: 0.35 }));
    for (let index = 0; index < 4; index++) {
      const ring = add(new THREE.TorusGeometry(1.53, 0.015, 5, lowPower ? 40 : 80), material(b, { emissive: b, emissiveIntensity: 0.4 }));
      ring.rotation.y = index * Math.PI / 4;
    }
    const count = lowPower ? 16 : 32;
    const nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 7, 5), material(c, { emissive: c, emissiveIntensity: 1 }), count);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < count; index++) {
      const y = 1 - index / (count - 1) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = index * 2.39996;
      matrix.makeTranslation(Math.cos(angle) * radius * 1.52, y * 1.52, Math.sin(angle) * radius * 1.52);
      nodes.setMatrixAt(index, matrix);
    }
    group.add(nodes);
    add(new THREE.TorusGeometry(1.85, 0.025, 6, lowPower ? 40 : 80), material(c)).rotation.x = Math.PI / 2.4;
  } else if (kind === "cube") {
    const geometry = new THREE.BoxGeometry(2.4, 2.4, 2.4);
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: a, transparent: true, opacity: 0.8 })));
    geometry.dispose();
    add(new THREE.OctahedronGeometry(0.82, lowPower ? 0 : 1), material(b, { emissive: b, emissiveIntensity: 0.3, transparent: true, opacity: 0.72 }));
    for (const x of [-1.2, 1.2]) for (const y of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) {
      add(new THREE.SphereGeometry(0.1, 8, 6), material(c, { emissive: c, emissiveIntensity: 0.9 }), [x, y, z]);
    }
  } else if (kind === "cluster") {
    add(new THREE.CylinderGeometry(1.45, 1.6, 0.25, lowPower ? 16 : 32), material(0x1e293b), [0, -1.3, 0]);
    const positions: [number, number, number, number][] = [[0, 0, 0, 1.25], [-0.8, -0.3, 0.2, 0.82], [0.8, -0.35, 0.25, 0.95], [-0.25, -0.45, 0.75, 0.72], [0.3, -0.4, -0.72, 0.78], [-0.95, -0.5, -0.55, 0.55], [0.95, -0.55, -0.45, 0.6]];
    positions.forEach(([x, y, z, scale], index) => {
      const crystal = add(new THREE.OctahedronGeometry(scale, lowPower ? 0 : 1), material([a, b, c][index % 3], { roughness: 0.16, metalness: 0.28 }), [x, y + scale * 0.65 - 0.25, z]);
      crystal.scale.y = 1.65;
      crystal.rotation.y = index * 0.7;
    });
  } else if (kind === "chain") {
    for (let index = 0; index < 7; index++) {
      const ring = add(new THREE.TorusGeometry(0.62, 0.14, lowPower ? 8 : 12, lowPower ? 24 : 48), material(index % 2 ? b : a, { roughness: 0.2 }), [(index - 3) * 0.66, 0, 0]);
      ring.rotation.y = index % 2 ? Math.PI / 2 : 0;
      ring.rotation.x = index * 0.08;
    }
    add(new THREE.IcosahedronGeometry(0.48, lowPower ? 0 : 1), material(c, { emissive: c, emissiveIntensity: 0.5 }));
  } else if (kind === "flower") {
    const petals = lowPower ? 8 : 12;
    for (let index = 0; index < petals; index++) {
      const angle = index / petals * Math.PI * 2;
      const petal = add(new THREE.SphereGeometry(0.65, lowPower ? 12 : 20, lowPower ? 8 : 14), material(index % 2 ? a : c, { roughness: 0.35 }), [Math.cos(angle) * 1.08, Math.sin(angle) * 1.08, 0]);
      petal.scale.set(0.45, 1.05, 0.17);
      petal.rotation.z = angle - Math.PI / 2;
      petal.rotation.x = 0.45;
    }
    add(new THREE.SphereGeometry(0.55, lowPower ? 16 : 28, lowPower ? 12 : 20), material(b, { emissive: b, emissiveIntensity: 0.35 }), [0, 0, 0.25]);
    for (let index = 0; index < 9; index++) {
      const angle = index / 9 * Math.PI * 2;
      rod([0, 0, 0.45], [Math.cos(angle) * 0.4, Math.sin(angle) * 0.4, 0.78], 0.025, material(b));
    }
  } else if (kind === "wave-sphere") {
    const geometry = new THREE.SphereGeometry(1.55, lowPower ? 32 : 64, lowPower ? 20 : 40);
    const positions = geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const scale = 1 + Math.sin(x * 3.2 + y * 2.1) * Math.sin(z * 3.8) * 0.12;
      positions.setXYZ(index, x * scale, y * scale, z * scale);
    }
    geometry.computeVertexNormals();
    add(geometry, material(a, { roughness: 0.18, metalness: 0.32 }));
    add(new THREE.TorusGeometry(1.9, 0.025, 6, lowPower ? 40 : 80), material(c, { emissive: c, emissiveIntensity: 0.45 })).rotation.x = Math.PI / 2.6;
  } else if (kind === "cyber-eye") {
    const shell = add(new THREE.SphereGeometry(1.15, lowPower ? 24 : 40, lowPower ? 16 : 28), material(0xe2e8f0, { metalness: 0.18, roughness: 0.32 }));
    shell.scale.set(1.55, 0.82, 0.55);
    const iris = add(new THREE.SphereGeometry(0.57, lowPower ? 20 : 36, lowPower ? 14 : 24), material(a, { emissive: a, emissiveIntensity: 0.55 }), [0, 0, 0.58]);
    iris.scale.z = 0.22;
    const pupil = add(new THREE.SphereGeometry(0.23, lowPower ? 16 : 28, lowPower ? 10 : 18), material(0x020617, { roughness: 0.1 }), [0, 0, 0.73]);
    pupil.scale.z = 0.16;
    for (let index = 0; index < 3; index++) {
      const scan = add(new THREE.TorusGeometry(0.75 + index * 0.18, 0.018, 6, lowPower ? 32 : 64, Math.PI * 1.5), material(index === 2 ? c : b, { emissive: index === 2 ? c : b, emissiveIntensity: 0.6 }), [0, 0, 0.7]);
      scan.rotation.z = index * 1.2;
    }
    add(new THREE.SphereGeometry(0.08, 10, 8), material(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.2 }), [-0.17, 0.2, 0.8]);
  }
  return group;
}
