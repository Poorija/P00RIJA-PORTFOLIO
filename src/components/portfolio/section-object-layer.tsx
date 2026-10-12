"use client";

import { useContent } from "@/lib/content-store";
import type { SceneObject3DConfig } from "@/lib/content-types";
import { Ambient3DObject } from "@/components/portfolio/ambient-3d-object";

function variantFor(kind: SceneObject3DConfig["kind"]): "crystal" | "neural" | "orbit" {
  if (kind === "neural") return "neural";
  if (kind === "orbit") return "orbit";
  return "crystal";
}

/** CMS-positioned objects shared by every built-in and custom section. */
export function SectionObjectLayer({ sectionId }: { sectionId: string }) {
  const objects = useContent((state) => state.content.design?.objects ?? []);
  const visible = objects.filter(
    (object) => object.enabled !== false && object.slot === "section" && object.sectionId === sectionId
  );

  if (!visible.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] origin-center overflow-hidden [transform:scale(var(--cms-device-object-scale,1))]" aria-hidden="true">
      {visible.map((object) => (
        <Ambient3DObject
          key={object.id}
          variant={variantFor(object.kind)}
          config={object}
          className="block"
          defaultPlacement={{ side: "center", top: 50, offset: 0, size: 288 }}
        />
      ))}
    </div>
  );
}
