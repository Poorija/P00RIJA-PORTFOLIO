"use client";

import { useEffect, useState } from "react";
import { useContent } from "@/lib/content-store";
import type { BuilderDevice } from "@/lib/content-types";
import { DynamicContactForm } from "./dynamic-contact-form";
import { VisualElementView } from "./visual-element-view";

export function SectionVisualLayer({ sectionId }: { sectionId: string }) {
  const builder = useContent((state) => state.content.builder);
  const forms = useContent((state) => state.content.forms);
  const lang = useContent((state) => state.lang);
  const [device, setDevice] = useState<BuilderDevice>("desktop");
  useEffect(() => {
    const update = () => setDevice(window.innerWidth <= Number(builder.responsive?.mobileBreakpoint || 640) ? "mobile" : window.innerWidth <= Number(builder.responsive?.tabletBreakpoint || 1024) ? "tablet" : "desktop");
    update(); window.addEventListener("resize", update, { passive: true }); return () => window.removeEventListener("resize", update);
  }, [builder.responsive?.mobileBreakpoint, builder.responsive?.tabletBreakpoint]);
  const elements = (builder.visualElements ?? []).filter((element) => element.kind !== "native" && element.sectionId === sectionId && (element.placements[device] ?? element.placements.desktop)?.visible !== false);
  if (!elements.length) return null;
  return <div className="pointer-events-none absolute inset-0 z-[18] overflow-hidden" data-visual-layer={sectionId}>{elements.map((element) => {
    const p = element.placements[device] ?? element.placements.desktop;
    return <div key={element.id} className={`absolute ${element.kind === "button" || element.kind === "form" || element.kind === "audio" || element.kind === "video" ? "pointer-events-auto" : "pointer-events-none"} ${element.className || ""}`} style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.width}%`, height: `${p.height}%`, zIndex: p.zIndex, transform: `rotate(${p.rotation}deg)` }}>
      {element.kind === "form" && element.formId ? <DynamicContactForm config={forms} lang={lang} formId={element.formId}/> : <VisualElementView element={element} device={device}/>} 
    </div>;
  })}</div>;
}
