import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ProjectArtwork } from "@/lib/content-types";
import type { BookPage } from "./page-model";
import { createBookPageTexture } from "./page-texture";
import { softRadialTexture } from "../spaceship/materials";

export interface BookViewState {
  spread: number;
  maxSpread: number;
  single: boolean;
  busy: boolean;
}

interface RealisticBookOptions {
  mount: HTMLDivElement;
  pages: BookPage[];
  project: ProjectArtwork;
  lang: "fa" | "en";
  coarse: boolean;
  reducedMotion: boolean;
  onStateChange: (state: BookViewState) => void;
}

interface Flip {
  dir: 1 | -1;
  from: number;
  progress: number;
}

export class RealisticBook {
  private options: RealisticBookOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  private root = new THREE.Group();
  private resizeObserver: ResizeObserver;
  private textures: THREE.CanvasTexture[];
  private blankTexture: THREE.CanvasTexture;
  private rightMaterial: THREE.MeshStandardMaterial;
  private leftMaterial: THREE.MeshStandardMaterial;
  private frontMaterial: THREE.MeshStandardMaterial;
  private backMaterial: THREE.MeshStandardMaterial;
  private leftMesh: THREE.Mesh;
  private flipGroup = new THREE.Group();
  private flipProgress = { value: 0 };
  private spread = 0;
  private single = false;
  private flip: Flip | null = null;
  private drag: { dir: 1 | -1; half: number; lastProgress: number; lastTime: number; velocity: number; moved: boolean } | null = null;
  private animation: { from: number; to: number; start: number; duration: number } | null = null;
  private raf = 0;
  private disposed = false;
  private needsRender = true;
  private resources = new Set<{ dispose: () => void }>();
  private readonly width = 1.68;
  private readonly height = 2.31;

  constructor(options: RealisticBookOptions) {
    this.options = options;
    const { mount } = options;
    this.renderer = new THREE.WebGLRenderer({ antialias: !options.coarse, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.coarse ? 1.35 : 1.8));
    this.renderer.setSize(mount.clientWidth, mount.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !options.coarse;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    mount.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.setAttribute("aria-label", options.lang === "fa" ? `کتاب سه‌بعدی ${options.project.title}` : `${options.project.title} 3D book`);
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0xfff3dd, 0x172237, 2.2));
    const key = new THREE.DirectionalLight(0xfff1d6, 3.1);
    key.position.set(-3, 5, 6);
    key.castShadow = !options.coarse;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x79bfff, 1.5);
    rim.position.set(4, 1, 3);
    this.scene.add(rim);

    this.blankTexture = this.track(this.createBlankTexture());
    this.textures = options.pages.map((page, index) => this.track(createBookPageTexture(page, index, options.project, options.lang, !options.coarse, () => this.invalidate())));
    this.rightMaterial = this.pageMaterial(this.blankTexture);
    this.leftMaterial = this.pageMaterial(this.blankTexture);
    this.leftMaterial.side = THREE.BackSide;
    this.frontMaterial = this.pageMaterial(this.blankTexture, true);
    this.backMaterial = this.pageMaterial(this.blankTexture, true);
    this.backMaterial.side = THREE.BackSide;

    const rightGeometry = this.track(new THREE.PlaneGeometry(this.width, this.height, options.coarse ? 20 : 36, 3));
    rightGeometry.translate(this.width / 2, 0, 0);
    const leftGeometry = this.track(rightGeometry.clone());
    this.reverseUvs(leftGeometry);
    const backGeometry = this.track(rightGeometry.clone());
    this.reverseUvs(backGeometry);
    const rightMesh = new THREE.Mesh(rightGeometry, this.rightMaterial);
    rightMesh.position.z = 0.035;
    this.root.add(rightMesh);
    this.leftMesh = new THREE.Mesh(leftGeometry, this.leftMaterial);
    this.leftMesh.rotation.y = Math.PI;
    this.leftMesh.position.z = 0.035;
    this.root.add(this.leftMesh);

    const front = new THREE.Mesh(rightGeometry, this.frontMaterial);
    const back = new THREE.Mesh(backGeometry, this.backMaterial);
    back.position.z = -0.002;
    front.position.z = 0.002;
    this.flipGroup.add(front, back);
    this.flipGroup.position.z = 0.055;
    this.root.add(this.flipGroup);

    this.buildCoverAndPages();
    this.buildBackdrop();
    this.root.rotation.x = -0.075;
    this.root.rotation.y = 0.025;
    this.flipGroup.visible = false;
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.updatePages();
    this.emitState();
    this.raf = requestAnimationFrame((time) => this.animate(time));
  }

  private track<T extends { dispose: () => void }>(resource: T): T {
    this.resources.add(resource);
    return resource;
  }

  private createBlankTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#eee7d9";
    context.fillRect(0, 0, 8, 8);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private reverseUvs(geometry: THREE.BufferGeometry) {
    const uv = geometry.getAttribute("uv");
    for (let index = 0; index < uv.count; index++) uv.setX(index, 1 - uv.getX(index));
    uv.needsUpdate = true;
  }

  private pageMaterial(map: THREE.Texture, bending = false) {
    const material = this.track(new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.88, metalness: 0, side: THREE.FrontSide, envMapIntensity: 0.25 }));
    if (bending) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uFlipProgress = this.flipProgress;
        shader.vertexShader = `uniform float uFlipProgress;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
          #include <begin_vertex>
          float pageBend = sin(uv.x * 3.14159265) * sin(uFlipProgress * 3.14159265);
          transformed.z += pageBend * 0.32;
          transformed.y += pageBend * sin(uv.y * 3.14159265) * 0.055;
          transformed.x -= pageBend * uv.x * 0.045;
        `);
      };
      material.customProgramCacheKey = () => "realistic-book-bending-v1";
    }
    return material;
  }

  private buildCoverAndPages() {
    const leather = this.track(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.options.project.color || "#1c2c42").multiplyScalar(0.34), roughness: 0.48, metalness: 0.08, clearcoat: 0.32, clearcoatRoughness: 0.55 }));
    const edge = this.track(new THREE.MeshStandardMaterial({ color: 0xc8beaa, roughness: 0.95 }));
    const paper = this.track(new THREE.MeshStandardMaterial({ color: 0xe9e0cf, roughness: 0.92 }));
    const metal = this.track(new THREE.MeshStandardMaterial({ color: 0xb89b62, metalness: 0.85, roughness: 0.28 }));
    const rounded = this.track(new RoundedBoxGeometry(1, 1, 1, 3, 0.06));
    const box = this.track(new THREE.BoxGeometry(1, 1, 1));
    for (const side of [-1, 1] as const) {
      const cover = new THREE.Mesh(rounded, leather);
      cover.scale.set(this.width + 0.11, this.height + 0.13, 0.095);
      cover.position.set(side * (this.width / 2 + 0.025), 0, -0.115);
      cover.rotation.y = side * -0.025;
      cover.castShadow = true;
      this.root.add(cover);
      for (let layer = 0; layer < 16; layer++) {
        const sheet = new THREE.Mesh(box, layer % 4 === 0 ? edge : paper);
        sheet.scale.set(this.width - 0.025 - layer * 0.0008, this.height - 0.045 - layer * 0.0005, 0.008);
        sheet.position.set(side * (this.width / 2 + 0.008), 0, -0.06 + layer * 0.0055);
        this.root.add(sheet);
      }
      const trim = new THREE.Mesh(box, metal);
      trim.scale.set(0.025, this.height - 0.12, 0.025);
      trim.position.set(side * (this.width + 0.015), 0, -0.05);
      this.root.add(trim);
    }
    const spine = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.07, 0.07, this.height + 0.1, 24)), leather);
    spine.position.z = -0.09;
    this.root.add(spine);
    const ribbon = new THREE.Mesh(box, metal);
    ribbon.scale.set(0.035, 0.42, 0.012);
    ribbon.position.set(0.06, -this.height / 2 + 0.12, 0.065);
    ribbon.rotation.z = -0.04;
    this.root.add(ribbon);
  }

  private buildBackdrop() {
    const tableMaterial = this.track(new THREE.MeshStandardMaterial({ color: 0x080e17, roughness: 0.52, metalness: 0.55 }));
    const table = new THREE.Mesh(this.track(new RoundedBoxGeometry(1, 1, 1, 3, 0.08)), tableMaterial);
    table.scale.set(this.width * 2 + 0.38, this.height + 0.38, 0.12);
    table.position.z = -0.25;
    table.receiveShadow = true;
    this.root.add(table);
    const shadowTexture = this.track(softRadialTexture());
    const shadow = new THREE.Mesh(this.track(new THREE.PlaneGeometry(this.width * 2.8, this.height * 1.6)), this.track(new THREE.MeshBasicMaterial({ map: shadowTexture, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false })));
    shadow.position.z = -0.17;
    this.root.add(shadow);
  }

  private maxSpread() {
    return this.single ? this.options.pages.length - 1 : Math.max(0, Math.ceil(this.options.pages.length / 2) - 1);
  }

  private texture(index: number) {
    return index >= 0 && index < this.textures.length ? this.textures[index] : this.blankTexture;
  }

  private setMaterialIndex(material: THREE.MeshStandardMaterial, index: number) {
    material.map = this.texture(index);
    material.needsUpdate = true;
  }

  private updatePages() {
    const spread = this.spread;
    const flip = this.flip;
    this.leftMesh.visible = !this.single;
    this.root.position.x = this.single ? -this.width / 2 : 0;
    if (!flip) {
      this.flipGroup.visible = false;
      const rtl = this.options.lang === "fa" && !this.single;
      this.setMaterialIndex(this.leftMaterial, this.single ? -1 : spread * 2 + (rtl ? 1 : 0));
      this.setMaterialIndex(this.rightMaterial, this.single ? spread : spread * 2 + (rtl ? 0 : 1));
      return;
    }
    this.flipGroup.visible = true;
    const fa = this.options.lang === "fa";
    if (this.single) {
      if (flip.dir === 1) {
        this.setMaterialIndex(this.rightMaterial, flip.from + 1);
        this.setMaterialIndex(this.frontMaterial, flip.from);
        this.setMaterialIndex(this.backMaterial, flip.from + 1);
      } else {
        this.setMaterialIndex(this.rightMaterial, flip.from);
        this.setMaterialIndex(this.frontMaterial, flip.from - 1);
        this.setMaterialIndex(this.backMaterial, flip.from);
      }
      return;
    }
    if (!fa) {
      if (flip.dir === 1) {
        this.setMaterialIndex(this.leftMaterial, flip.from * 2);
        this.setMaterialIndex(this.rightMaterial, flip.from * 2 + 3);
        this.setMaterialIndex(this.frontMaterial, flip.from * 2 + 1);
        this.setMaterialIndex(this.backMaterial, flip.from * 2 + 2);
      } else {
        this.setMaterialIndex(this.leftMaterial, (flip.from - 1) * 2);
        this.setMaterialIndex(this.rightMaterial, flip.from * 2 + 1);
        this.setMaterialIndex(this.frontMaterial, flip.from * 2 - 1);
        this.setMaterialIndex(this.backMaterial, flip.from * 2);
      }
    } else if (flip.dir === 1) {
      this.setMaterialIndex(this.leftMaterial, flip.from * 2 + 2);
      this.setMaterialIndex(this.rightMaterial, flip.from * 2 + 3);
      this.setMaterialIndex(this.frontMaterial, flip.from * 2 + 1);
      this.setMaterialIndex(this.backMaterial, flip.from * 2 + 2);
    } else {
      this.setMaterialIndex(this.leftMaterial, (flip.from - 1) * 2 + 1);
      this.setMaterialIndex(this.rightMaterial, flip.from * 2);
      this.setMaterialIndex(this.frontMaterial, flip.from * 2);
      this.setMaterialIndex(this.backMaterial, flip.from * 2 + 1);
    }
  }

  private updateFlip() {
    if (!this.flip) return;
    const fa = this.options.lang === "fa";
    const progress = this.flip.progress;
    const angle = this.flip.dir === 1
      ? fa ? -Math.PI * (1 - progress) : -Math.PI * progress
      : fa ? -Math.PI * progress : -Math.PI * (1 - progress);
    this.flipGroup.rotation.y = angle;
    this.flipProgress.value = progress;
    this.invalidate();
  }

  private emitState() {
    this.options.onStateChange({ spread: this.spread, maxSpread: this.maxSpread(), single: this.single, busy: Boolean(this.flip) });
  }

  private beginAnimation(target: number) {
    if (!this.flip) return;
    if (this.options.reducedMotion) {
      this.flip.progress = target;
      this.finishFlip(target === 1);
      return;
    }
    const distance = Math.abs(target - this.flip.progress);
    this.animation = { from: this.flip.progress, to: target, start: performance.now(), duration: 380 + distance * 520 };
  }

  private finishFlip(completed: boolean) {
    if (!this.flip) return;
    if (completed) this.spread = Math.max(0, Math.min(this.maxSpread(), this.flip.from + this.flip.dir));
    this.flip = null;
    this.animation = null;
    this.flipProgress.value = 0;
    this.updatePages();
    this.emitState();
    this.invalidate();
  }

  autoFlip(dir: 1 | -1) {
    if (this.flip || (dir === 1 && this.spread >= this.maxSpread()) || (dir === -1 && this.spread <= 0)) return;
    this.flip = { dir, from: this.spread, progress: 0 };
    this.updatePages();
    this.updateFlip();
    this.emitState();
    this.beginAnimation(1);
  }

  beginDrag(dir: 1 | -1, half: number) {
    if (this.flip || (dir === 1 && this.spread >= this.maxSpread()) || (dir === -1 && this.spread <= 0)) return false;
    this.flip = { dir, from: this.spread, progress: 0 };
    this.drag = { dir, half, lastProgress: 0, lastTime: performance.now(), velocity: 0, moved: false };
    this.updatePages();
    this.updateFlip();
    this.emitState();
    return true;
  }

  dragMove(deltaX: number) {
    if (!this.drag || !this.flip) return;
    const fa = this.options.lang === "fa";
    const nextSign = fa ? 1 : -1;
    const directionSign = this.drag.dir === 1 ? nextSign : -nextSign;
    const progress = THREE.MathUtils.clamp(deltaX * directionSign / this.drag.half, 0, 1);
    const now = performance.now();
    const deltaTime = Math.max(8, now - this.drag.lastTime);
    this.drag.velocity = (progress - this.drag.lastProgress) / deltaTime * 1000;
    this.drag.lastProgress = progress;
    this.drag.lastTime = now;
    if (Math.abs(deltaX) > 4) this.drag.moved = true;
    this.flip.progress = progress;
    this.updateFlip();
  }

  endDrag() {
    if (!this.drag || !this.flip) return;
    const drag = this.drag;
    this.drag = null;
    const target = !drag.moved || drag.velocity > 0.65 || (Math.abs(drag.velocity) < 0.2 && this.flip.progress > 0.46) ? 1 : 0;
    this.beginAnimation(target);
  }

  cancelDrag() {
    this.drag = null;
    this.beginAnimation(0);
  }

  currentPages() {
    if (this.single) return [this.options.pages[this.spread]].filter(Boolean);
    return [this.options.pages[this.spread * 2], this.options.pages[this.spread * 2 + 1]].filter(Boolean);
  }

  private resize() {
    const mount = this.options.mount;
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    const wasSingle = this.single;
    this.single = width < 660 || width / height < 0.92;
    if (wasSingle !== this.single) {
      const currentPage = wasSingle ? this.spread : this.spread * 2 + (this.options.lang === "fa" ? 0 : 1);
      this.flip = null;
      this.drag = null;
      this.animation = null;
      this.spread = THREE.MathUtils.clamp(this.single ? currentPage : Math.floor(currentPage / 2), 0, this.maxSpread());
      this.updatePages();
    }
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    const visibleWidth = (this.single ? this.width : this.width * 2) * 1.14;
    const visibleHeight = this.height * 1.17;
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distanceForHeight = visibleHeight / (2 * tangent);
    const distanceForWidth = visibleWidth / (2 * tangent * this.camera.aspect);
    this.camera.position.set(0, 0.05, Math.max(distanceForHeight, distanceForWidth));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.emitState();
    this.invalidate();
  }

  private invalidate() {
    this.needsRender = true;
  }

  private animate(time: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame((nextTime) => this.animate(nextTime));
    if (document.hidden) return;
    if (this.animation && this.flip) {
      const linear = Math.min(1, (time - this.animation.start) / this.animation.duration);
      const eased = linear < 0.5 ? 4 * linear ** 3 : 1 - Math.pow(-2 * linear + 2, 3) / 2;
      this.flip.progress = THREE.MathUtils.lerp(this.animation.from, this.animation.to, eased);
      this.updateFlip();
      if (linear >= 1) this.finishFlip(this.animation.to === 1);
    }
    if (this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    for (const resource of this.resources) resource.dispose();
    this.resources.clear();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.options.mount) this.options.mount.removeChild(this.renderer.domElement);
  }
}
