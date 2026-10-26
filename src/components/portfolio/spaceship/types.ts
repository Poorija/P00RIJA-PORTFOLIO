import type * as THREE from "three";
import type { ProjectArtwork } from "@/lib/content-types";

export interface WingDef {
  id: string;
  label: string;
  color: string;
  locked: boolean;
  projects: ProjectArtwork[];
}

export interface WingLayout {
  def: WingDef;
  angle: number;
  dir: { x: number; z: number };
  length: number;
  width: number;
  artworks: { index: number; side: -1 | 1; dist: number; y: number }[];
}

export interface ArtworkEntry {
  wing: WingDef;
  layout: WingLayout;
  project: ProjectArtwork;
  pos: THREE.Vector3;
  forward: THREE.Vector3;
  spot: THREE.Vector3;
}

export interface FocusInfo {
  kind: "project" | "lockedProj" | "lockedWing";
  title: string;
  sub: string;
  wingLabel: string;
}

export const HUB_R = 6.2;
export const WING_W = 5.6;
export const EYE = 1.68;
export const STEP = 5.2;
export const ART_W = 2.05;
export const ART_H = 1.43;
export const VIEW_DIST = 2.65;

export function layoutWings(wings: WingDef[]): WingLayout[] {
  const n = Math.max(1, wings.length);
  return wings.map((def, i) => {
    const angle = -Math.PI / 2 + (i * (2 * Math.PI)) / Math.max(n, 3) * (n > 1 ? 1 : 0);
    const dir = { x: Math.cos(angle), z: Math.sin(angle) };
    const count = Math.max(1, def.projects.length);
    const length = 8 + count * (STEP / 2) + 4;
    const artworks = def.projects.map((_, index) => ({
      index,
      side: (index % 2 === 0 ? -1 : 1) as -1 | 1,
      dist: HUB_R + 3.4 + Math.floor(index / 2) * STEP,
      y: 1.68 + ((index * 47) % 3 - 1) * 0.08,
    }));
    return { def, angle, dir, length, width: WING_W, artworks };
  });
}
