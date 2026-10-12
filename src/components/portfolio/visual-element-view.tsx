"use client";

import { useEffect, useRef } from "react";
import { Link2 } from "lucide-react";
import type { BuilderDevice, VisualElementConfig } from "@/lib/content-types";
import { Media3DPreview } from "./media-3d-preview";

function LottieElement({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let destroyed = false;
    let animation: { destroy(): void } | undefined;
    if (!url) return;
    void Promise.all([import("lottie-web"), fetch(url).then((response) => response.json())]).then(([module, data]) => {
      if (destroyed || !host.current) return;
      animation = module.default.loadAnimation({ container: host.current, animationData: data, renderer: "svg", loop: true, autoplay: true });
    }).catch(() => undefined);
    return () => { destroyed = true; animation?.destroy(); };
  }, [url]);
  return <div ref={host} className="h-full w-full"/>;
}

export function VisualElementView({ element, device, preview = false }: { element: VisualElementConfig; device: BuilderDevice; preview?: boolean }) {
  const placement = element.placements[device] ?? element.placements.desktop;
  const common = "h-full w-full overflow-hidden";
  if (element.kind === "native") return <div className="grid h-full w-full place-items-center rounded-lg border border-dashed border-[var(--ai-1)]/60 bg-[var(--ai-1)]/10 p-2 text-center text-[10px] text-[var(--ai-1)]"><span><Link2 className="mx-auto mb-1 size-4"/>{element.name}<br/><code>{element.selector}</code></span></div>;
  if (element.kind === "image") return element.mediaUrl ? <img src={element.mediaUrl} alt={element.name} className={`${common} object-contain`}/> : <div className={`${common} grid place-items-center bg-muted/20 text-xs`}>Image</div>;
  if (element.kind === "video") return <video src={element.mediaUrl} controls={!preview} muted={preview} autoPlay={preview} loop={preview} className={`${common} object-contain`}/>;
  if (element.kind === "audio") return <div className={`${common} grid place-items-center`}><audio src={element.mediaUrl} controls className="w-full"/></div>;
  if (element.kind === "lottie") return <LottieElement url={element.mediaUrl}/>;
  if (element.kind === "model3d") return <Media3DPreview url={element.mediaUrl} className="h-full w-full"/>;
  if (element.kind === "icon") return <div className={`${common} grid place-items-center`} style={{ color: element.color, fontSize: `${element.fontSize}px` }}><i className={element.icon || "fa-solid fa-star"}/></div>;
  if (element.kind === "form") return <div className={`${common} grid place-items-center border border-dashed text-center text-xs text-muted-foreground`}>{element.text || `Form: ${element.formId}`}</div>;
  const style = { color: element.color, background: element.background, borderColor: element.borderColor, borderRadius: element.borderRadius, fontSize: Math.max(8, element.fontSize * (device === "mobile" ? .85 : device === "tablet" ? .93 : 1)) };
  if (element.kind === "button") return <a href={element.href || undefined} className={`${common} flex items-center justify-center border px-3 text-center font-semibold`} style={style}>{element.text || element.name}</a>;
  return <div className={`${common} flex items-center border px-2`} style={style}>{element.text || element.name}<span className="sr-only">{placement.rotation}</span></div>;
}
