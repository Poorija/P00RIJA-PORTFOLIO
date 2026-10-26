import * as THREE from "three";
import type { SceneObject3DConfig } from "./content-types";

export type ProceduralObjectKind = "ribbon" | "prism" | "pen-nib" | "palette" | "lattice" | "capsule";

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
  }
  return group;
}
