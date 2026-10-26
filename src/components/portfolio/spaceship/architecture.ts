import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ART_H, ART_W, EYE, HUB_R, VIEW_DIST, WING_W, type ArtworkEntry, type WingLayout } from "./types";
import { createDisplayBook } from "./display-book";
import { makeArtworkPlate, makeTextTexture, softRadialTexture, type ResourcePool, type SpaceshipMaterials } from "./materials";
import { buildCommandConsoles } from "./station-details";
import { buildSciFiProps } from "./sci-fi-models";

interface ArchitectureOptions {
  scene: THREE.Scene;
  layouts: WingLayout[];
  pool: ResourcePool;
  materials: SpaceshipMaterials;
  lang: "fa" | "en";
  lowPower: boolean;
  reducedMotion: boolean;
}

export function buildSpaceshipArchitecture({ scene, layouts, pool, materials, lang, lowPower, reducedMotion }: ArchitectureOptions) {
  const fa = lang === "fa";
  const rounded = pool.track(new RoundedBoxGeometry(1, 1, 1, lowPower ? 1 : 2, 0.075));
  const box = pool.track(new THREE.BoxGeometry(1, 1, 1));
  const plane = pool.track(new THREE.PlaneGeometry(1, 1));
  const animated: ((time: number, dt: number, player: THREE.Vector3) => void)[] = [];
  const artworks: ArtworkEntry[] = [];

  const addBox = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, smooth = true) => {
    const mesh = new THREE.Mesh(smooth ? rounded : box, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const addPlane = (parent: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(plane, material);
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const floor = new THREE.Mesh(pool.track(new THREE.CircleGeometry(HUB_R, lowPower ? 48 : 96)), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const floorInset = new THREE.Mesh(pool.track(new THREE.RingGeometry(HUB_R - 0.48, HUB_R - 0.36, 96)), materials.cyanLight);
  floorInset.rotation.x = -Math.PI / 2;
  floorInset.position.y = 0.012;
  scene.add(floorInset);
  for (let radius = 2.2; radius < HUB_R - 0.8; radius += 1.25) {
    const seam = new THREE.Mesh(pool.track(new THREE.RingGeometry(radius, radius + 0.018, 96)), materials.trim);
    seam.rotation.x = -Math.PI / 2;
    seam.position.y = 0.008;
    scene.add(seam);
  }

  const ceiling = new THREE.Mesh(pool.track(new THREE.CircleGeometry(HUB_R - 0.12, 96)), materials.glass);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 5.45;
  scene.add(ceiling);
  const ceilingRim = new THREE.Mesh(pool.track(new THREE.TorusGeometry(HUB_R - 0.12, 0.15, 10, 96)), materials.trim);
  ceilingRim.rotation.x = Math.PI / 2;
  ceilingRim.position.y = 5.43;
  scene.add(ceilingRim);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const beam = addBox(scene, 0.11, 0.16, HUB_R * 2 - 0.35, 0, 5.39, 0, materials.hull);
    beam.rotation.y = angle;
    const strip = addBox(scene, 0.022, 0.025, HUB_R * 1.72, 0, 5.28, 0, i % 3 === 0 ? materials.warmLight : materials.cyanLight, false);
    strip.rotation.y = angle;
  }

  const gateHalfAngle = (WING_W / 2 + 0.65) / HUB_R;
  const thetas = layouts.map((layout) => Math.PI / 2 - layout.angle).sort((a, b) => a - b);
  for (let i = 0; i < thetas.length; i++) {
    const startAngle = thetas[i];
    let gap = thetas[(i + 1) % thetas.length] - startAngle;
    if (gap <= 0) gap += Math.PI * 2;
    const start = startAngle + gateHalfAngle;
    const length = gap - 2 * gateHalfAngle;
    if (length <= 0.03) continue;
    const segments = Math.max(8, Math.ceil(72 * length / (Math.PI * 2)));
    for (const [height, y, material] of [[1.2, 0.6, materials.hullDark], [1.15, 4.88, materials.hull], [2.65, 2.525, materials.glass]] as const) {
      const wall = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(HUB_R, HUB_R, height, segments, 1, true, start, length)), material);
      wall.position.y = y;
      scene.add(wall);
    }
    const frameCount = Math.max(1, Math.floor(length * 5));
    for (let j = 0; j <= frameCount; j++) {
      const theta = start + length * j / frameCount;
      const x = Math.sin(theta) * HUB_R;
      const z = Math.cos(theta) * HUB_R;
      addBox(scene, 0.13, 3.9, 0.16, x, 3.15, z, materials.trim);
    }
  }

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const wingLights: THREE.PointLight[] = [];

  for (const layout of layouts) {
    const { def, dir, length } = layout;
    const group = new THREE.Group();
    group.position.set(dir.x * (HUB_R - 2), 0, dir.z * (HUB_R - 2));
    group.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(group);
    const accent = new THREE.Color(def.color);
    const accentMaterial = pool.track(new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.35, metalness: 0.25, roughness: 0.28 }));

    const corridorFloor = addPlane(group, WING_W, length, 0, 0, length / 2, materials.floor);
    corridorFloor.rotation.x = -Math.PI / 2;
    corridorFloor.receiveShadow = true;
    for (let z = 0.7; z < length; z += 1.55) {
      const plate = addBox(group, WING_W - 0.45, 0.035, 1.47, 0, 0.018, z, materials.floor, false);
      plate.receiveShadow = true;
      addBox(group, WING_W - 1.2, 0.012, 0.022, 0, 0.044, z + 0.68, materials.trim, false);
    }
    for (const side of [-1, 1] as const) {
      addBox(group, 0.09, 0.055, length - 0.5, side * (WING_W / 2 - 0.38), 0.07, length / 2, accentMaterial, false);
      addBox(group, (WING_W * 0.25), 0.16, length, side * WING_W * 0.37, 3.5, length / 2, materials.hullDark);
      const ceilingGlass = addPlane(group, WING_W * 0.48, length - 0.3, 0, 3.54, length / 2, materials.glass);
      ceilingGlass.rotation.x = Math.PI / 2;
      const pipe = new THREE.Mesh(pool.track(new THREE.CylinderGeometry(0.065, 0.065, length - 0.5, 10)), side === 1 ? materials.copper : materials.trim);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(side * (WING_W / 2 - 0.24), 0.58, length / 2);
      group.add(pipe);
    }

    const ribStep = lowPower ? 4.6 : 3.2;
    const ribCount = Math.floor(length / ribStep) + 1;
    const columns = new THREE.InstancedMesh(rounded, materials.hull, ribCount * 2);
    const beams = new THREE.InstancedMesh(rounded, materials.hull, ribCount);
    const lights = new THREE.InstancedMesh(box, materials.warmLight, ribCount);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let i = 0; i < ribCount; i++) {
      const z = Math.min(length - 0.15, i * ribStep + 0.1);
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        position.set((sideIndex ? 1 : -1) * (WING_W / 2 - 0.04), 1.78, z);
        scale.set(0.22, 3.56, 0.25);
        matrix.compose(position, quaternion, scale);
        columns.setMatrixAt(i * 2 + sideIndex, matrix);
      }
      position.set(0, 3.48, z);
      scale.set(WING_W, 0.2, 0.25);
      matrix.compose(position, quaternion, scale);
      beams.setMatrixAt(i, matrix);
      position.set(0, 3.36, z + 0.2);
      scale.set(1.65, 0.045, 0.16);
      matrix.compose(position, quaternion, scale);
      lights.setMatrixAt(i, matrix);
    }
    columns.instanceMatrix.needsUpdate = beams.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true;
    group.add(columns, beams, lights);

    for (const side of [-1, 1] as const) {
      for (let z = 1.6; z < length - 0.4; z += 3.2) {
        const hasDisplay = layout.artworks.some((art) => art.side === side && Math.abs(art.dist - (HUB_R - 2) - z) < 2.2);
        const x = side * WING_W / 2;
        addBox(group, 0.15, 1.05, 3.1, x, 0.525, z, materials.hullDark);
        addBox(group, 0.15, 0.55, 3.1, x, 3.18, z, materials.hull);
        if (hasDisplay) {
          addBox(group, 0.13, 1.9, 3.1, x, 1.99, z, materials.hullDark);
        } else {
          const window = addPlane(group, 3.0, 1.85, x - side * 0.015, 1.98, z, materials.glass);
          window.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
          addBox(group, 0.12, 0.08, 3.05, x - side * 0.08, 1.05, z, materials.trim, false);
          addBox(group, 0.12, 0.08, 3.05, x - side * 0.08, 2.91, z, materials.trim, false);
        }
        if (!lowPower) {
          for (let vent = -1; vent <= 1; vent++) {
            addBox(group, 0.17, 0.28, 0.045, x - side * 0.1, 0.48 + vent * 0.14, z + 1.12, materials.black, false);
          }
        }
      }
    }

    const endWall = addBox(group, WING_W, 3.6, 0.22, 0, 1.8, length, materials.hullDark);
    endWall.receiveShadow = true;
    const titleTexture = pool.track(makeTextTexture([
      { text: def.label, size: 52, bold: true },
      { text: fa ? `${def.projects.length} پروژه · DECK ${def.id.toUpperCase()}` : `${def.projects.length} projects · DECK ${def.id.toUpperCase()}`, size: 22, color: "#9fb7c9" },
    ], 1024, 420, def.color));
    const endSign = addPlane(group, WING_W - 0.8, 2.1, 0, 1.95, length - 0.13, pool.track(new THREE.MeshBasicMaterial({ map: titleTexture })));
    endSign.rotation.y = Math.PI;

    const gate = new THREE.Group();
    gate.position.z = 0.15;
    group.add(gate);
    for (const side of [-1, 1] as const) {
      addBox(gate, 0.48, 3.95, 0.58, side * (WING_W / 2 - 0.02), 1.95, 0, materials.hull);
      addBox(gate, 0.07, 3.25, 0.61, side * (WING_W / 2 - 0.3), 1.8, -0.02, accentMaterial, false);
    }
    addBox(gate, WING_W + 0.15, 0.48, 0.58, 0, 3.75, 0, materials.hull);
    const gateTexture = pool.track(makeTextTexture([{ text: def.label, size: 54, bold: true }, { text: fa ? "ورود به راهرو نمایشگاه" : "EXHIBITION CORRIDOR", size: 20, color: "#9fb7c9" }], 1024, 300, def.color));
    const gateSign = addPlane(gate, 3.8, 1.1, 0, 4.25, -0.32, pool.track(new THREE.MeshBasicMaterial({ map: gateTexture })));
    gateSign.rotation.y = Math.PI;
    const doorLeft = addBox(gate, WING_W / 2 - 0.2, 3.3, 0.13, -WING_W / 4, 1.68, 0.36, materials.hullDark);
    const doorRight = addBox(gate, WING_W / 2 - 0.2, 3.3, 0.13, WING_W / 4, 1.68, 0.36, materials.hullDark);
    addBox(doorLeft, 0.035, 0.65, 1.1, 0.38, 0, 0, accentMaterial, false);
    addBox(doorRight, 0.035, 0.65, 1.1, -0.38, 0, 0, accentMaterial, false);
    let doorOpen = 0;
    animated.push((_time, dt, player) => {
      const gateWorld = gate.getWorldPosition(new THREE.Vector3());
      const target = gateWorld.distanceTo(player) < 6.5 ? 1 : 0;
      doorOpen = reducedMotion ? target : doorOpen + (target - doorOpen) * (1 - Math.exp(-dt * 4.5));
      doorLeft.position.x = -WING_W / 4 - doorOpen * (WING_W / 2 - 0.05);
      doorRight.position.x = WING_W / 4 + doorOpen * (WING_W / 2 - 0.05);
    });

    for (const spot of layout.artworks) {
      const project = def.projects[spot.index];
      if (!project) continue;
      const exhibit = new THREE.Group();
      exhibit.position.set(spot.side * (WING_W / 2 - 0.18), spot.y, spot.dist - (HUB_R - 2));
      exhibit.rotation.y = spot.side === -1 ? Math.PI / 2 : -Math.PI / 2;
      group.add(exhibit);
      addBox(exhibit, ART_W + 0.35, ART_H + 0.35, 0.18, 0, 0, -0.06, materials.black);
      addBox(exhibit, ART_W + 0.22, ART_H + 0.22, 0.1, 0, 0, 0.045, materials.trim);
      addBox(exhibit, ART_W + 0.09, ART_H + 0.09, 0.07, 0, 0, 0.11, accentMaterial);
      const placeholder = pool.track(makeArtworkPlate(project, fa, def.color));
      const artMaterial = pool.track(new THREE.MeshBasicMaterial({ map: placeholder, toneMapped: false }));
      const art = addPlane(exhibit, ART_W, ART_H, 0, 0, 0.16, artMaterial);
      const source = project.locked ? "" : project.featured || project.videos?.[0]?.poster || project.images?.find((image) => /^(https?:|\/|data:)/.test(image));
      if (source) {
        loader.load(source, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          pool.track(texture);
          artMaterial.map = texture;
          artMaterial.needsUpdate = true;
        }, undefined, () => undefined);
      }
      const glass = addPlane(exhibit, ART_W + 0.015, ART_H + 0.015, 0, 0, 0.175, materials.screenGlass);
      glass.renderOrder = 2;
      const plaqueTexture = pool.track(makeTextTexture([
        { text: project.title || "—", size: 38, bold: true },
        { text: [project.category, project.year].filter(Boolean).join(" · ") || " ", size: 22, color: "#a8bfd1" },
        { text: (project.meta || project.description || "").slice(0, 82), size: 17, color: "#829bad" },
      ], 1024, 300, def.color));
      addPlane(exhibit, 1.55, 0.46, 0, -ART_H / 2 - 0.24, 0.24, pool.track(new THREE.MeshBasicMaterial({ map: plaqueTexture })));
      addBox(exhibit, ART_W * 0.75, 0.045, 0.09, 0, ART_H / 2 + 0.28, 0.19, materials.warmLight, false);
      const worldPos = exhibit.getWorldPosition(new THREE.Vector3());
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(exhibit.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
      const stand = worldPos.clone().addScaledVector(forward, VIEW_DIST);
      stand.y = EYE;
      artworks.push({ wing: def, layout, project, pos: worldPos, forward, spot: stand });
    }

    const light = new THREE.PointLight(accent, lowPower ? 7 : 12, Math.min(18, length), 1.8);
    light.position.set(0, 2.9, Math.min(length * 0.55, 9));
    group.add(light);
    wingLights.push(light);
  }

  const displayBook = createDisplayBook(pool, materials);
  scene.add(displayBook.root);
  const deskWing = { id: "__desk__", label: fa ? "درباره من" : "About me", color: "#c9a24b", locked: false, projects: [] };
  artworks.push({
    wing: deskWing,
    layout: layouts[0],
    project: { title: fa ? "کتاب درباره من" : "My book", meta: "", category: "", color: "#c9a24b", year: "", client: "", role: "", description: "", specs: [], images: [], link: "" },
    pos: displayBook.entryPosition,
    forward: new THREE.Vector3(0, 0, 1),
    spot: new THREE.Vector3(0, EYE, 2.15),
  });
  animated.push((time, dt) => displayBook.update(time, reducedMotion ? 0 : dt, reducedMotion));

  const dustCount = lowPower ? 55 : 140;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const layout = layouts[i % layouts.length];
    const distance = HUB_R + Math.random() * Math.max(2, layout.length - 4);
    dustPositions.set([layout.dir.x * distance + (Math.random() - 0.5) * WING_W, 0.35 + Math.random() * 3, layout.dir.z * distance + (Math.random() - 0.5) * WING_W], i * 3);
  }
  const dustGeometry = pool.track(new THREE.BufferGeometry());
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, pool.track(new THREE.PointsMaterial({ map: pool.track(softRadialTexture()), color: 0xbfe8ff, size: 0.055, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending })));
  scene.add(dust);
  animated.push((time, dt) => {
    dust.rotation.y = Math.sin(time * 0.025) * 0.015;
    dust.position.y = Math.sin(time * 0.18) * 0.035;
    wingLights.forEach((light, index) => { light.intensity = (lowPower ? 7 : 12) * (0.97 + Math.sin(time * 0.7 + index) * 0.03); });
    void dt;
  });

  const consoles = buildCommandConsoles(scene, layouts, pool, materials, lang);
  animated.push((time) => consoles.update(time));
  const sciFiProps = buildSciFiProps(scene, layouts, pool, materials);
  animated.push((time, dt) => sciFiProps.update(time, dt));

  return { artworks, animated, obstacles: [...consoles.obstacles, ...sciFiProps.obstacles] };
}
