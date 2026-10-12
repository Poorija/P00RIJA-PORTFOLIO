"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Box, RectangleHorizontal as ButtonIcon, FileJson, FormInput, Image as ImageIcon, Import, Link2, Monitor, MousePointer2, Music, Redo2, RotateCw, Save, Smartphone, Tablet, Trash2, Type, Undo2, Video } from "lucide-react";
import type { BuilderConfig, BuilderDevice, Lang, VisualElementConfig, VisualElementKind, VisualElementPlacement } from "@/lib/content-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CmsMediaPicker } from "./cms-media-picker";
import { VisualElementView } from "./visual-element-view";
import type { CmsViewportMode } from "./cms-responsive-studio";

const DEVICES: { id: BuilderDevice; icon: typeof Monitor }[] = [{ id: "desktop", icon: Monitor }, { id: "tablet", icon: Tablet }, { id: "mobile", icon: Smartphone }];
const PALETTE: { kind: VisualElementKind; icon: typeof Type }[] = [
  { kind: "text", icon: Type }, { kind: "button", icon: ButtonIcon }, { kind: "image", icon: ImageIcon }, { kind: "video", icon: Video }, { kind: "audio", icon: Music }, { kind: "lottie", icon: FileJson }, { kind: "form", icon: FormInput }, { kind: "icon", icon: MousePointer2 }, { kind: "model3d", icon: Box }, { kind: "native", icon: Link2 },
];
const basePlacement = (): VisualElementPlacement => ({ x: 10, y: 12, width: 28, height: 14, rotation: 0, zIndex: 10, visible: true });
const copyElements = (items: VisualElementConfig[]) => JSON.parse(JSON.stringify(items)) as VisualElementConfig[];

function makeElement(kind: VisualElementKind, sectionId: string): VisualElementConfig {
  const desktop = basePlacement();
  return { id: `element-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: `New ${kind}`, sectionId, kind, text: kind === "button" ? "Open link" : kind === "text" ? "Editable text" : "", mediaUrl: "", href: "", formId: "", icon: "fa-solid fa-star", color: "var(--foreground)", background: "rgba(10,12,22,.65)", borderColor: "var(--border)", borderRadius: 12, fontSize: kind === "text" ? 24 : 14, className: "", selector: kind === "native" ? "[data-cms-node]" : "", placements: { desktop, tablet: { ...desktop, width: 36 }, mobile: { ...desktop, x: 5, width: 90, height: 18 } } };
}

export function CmsVisualBuilder({ builder, lang, onChange, viewportMode }: { builder: BuilderConfig; lang: Lang; onChange: (next: BuilderConfig) => void; viewportMode?: CmsViewportMode }) {
  const [localDevice, setLocalDevice] = useState<BuilderDevice>("desktop");
  const device: BuilderDevice = viewportMode && viewportMode !== "auto" ? viewportMode : localDevice;
  const [sectionId, setSectionId] = useState(builder.sections.find((section) => section.enabled)?.id || "hero");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const past = useRef<VisualElementConfig[][]>([]); const future = useRef<VisualElementConfig[][]>([]);
  const elements = builder.visualElements ?? [];
  const visible = useMemo(() => elements.filter((element) => element.sectionId === sectionId), [elements, sectionId]);
  const selected = elements.find((element) => element.id === selectedId) ?? null;

  const commit = (next: VisualElementConfig[], remember = true) => {
    if (remember) { past.current.push(copyElements(elements)); past.current = past.current.slice(-50); future.current = []; setHistoryState({ undo: past.current.length, redo: 0 }); }
    onChange({ ...builder, visualElements: next });
  };
  const update = (id: string, patch: Partial<VisualElementConfig>, remember = true) => commit(elements.map((element) => element.id === id ? { ...element, ...patch } : element), remember);
  const patchPlacement = (id: string, patch: Partial<VisualElementPlacement>, remember = true) => {
    const item = elements.find((element) => element.id === id); if (!item) return;
    const current = item.placements[device] ?? item.placements.desktop ?? basePlacement();
    if (viewportMode === "auto") {
      const automatic = { ...current, ...patch };
      update(id, { placements: { desktop: automatic, tablet: { ...automatic }, mobile: { ...automatic } } }, remember);
      return;
    }
    update(id, { placements: { ...item.placements, [device]: { ...current, ...patch } } }, remember);
  };
  const undo = () => { const snapshot = past.current.pop(); if (!snapshot) return; future.current.push(copyElements(elements)); setHistoryState({ undo: past.current.length, redo: future.current.length }); onChange({ ...builder, visualElements: snapshot }); };
  const redo = () => { const snapshot = future.current.pop(); if (!snapshot) return; past.current.push(copyElements(elements)); setHistoryState({ undo: past.current.length, redo: future.current.length }); onChange({ ...builder, visualElements: snapshot }); };
  const saveVersion = () => {
    const name = window.prompt(lang === "fa" ? "نام نسخه" : "Version name", new Date().toLocaleString())?.trim(); if (!name) return;
    const snapshot = JSON.stringify({ visualElements: elements, responsive: builder.responsive, sections: builder.sections });
    onChange({ ...builder, versions: [...(builder.versions ?? []), { id: `version-${Date.now()}`, name, createdAt: new Date().toISOString(), snapshot }].slice(-30) });
  };

  const importNativeElements = () => {
    const shell = document.querySelector(`[data-builder-section="${CSS.escape(sectionId)}"]`);
    if (!shell) return;
    const existing = new Set(elements.filter((item) => item.kind === "native").map((item) => item.selector));
    const discovered = Array.from(shell.querySelectorAll<HTMLElement>("[data-cms-node]"))
      .map((node) => node.dataset.cmsNode?.trim())
      .filter((name): name is string => Boolean(name))
      .filter((name) => !existing.has(`[data-cms-node="${name}"]`));
    const imported = discovered.map((name, index) => ({
      ...makeElement("native", sectionId),
      id: `native-${sectionId}-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now()}-${index}`,
      name,
      selector: `[data-cms-node="${name.replace(/["\\]/g, "")}"]`,
      background: "transparent",
      borderColor: "transparent",
    }));
    if (!imported.length) return;
    commit([...elements, ...imported]);
    setSelectedId(imported[0].id);
  };

  const gesture = (event: ReactPointerEvent<HTMLElement>, item: VisualElementConfig, mode: "move" | "resize" | "rotate") => {
    event.preventDefault(); event.stopPropagation(); setSelectedId(item.id);
    const canvas = event.currentTarget.closest("[data-visual-canvas]") as HTMLElement | null; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const startX = event.clientX; const startY = event.clientY; const initial = { ...(item.placements[device] ?? item.placements.desktop ?? basePlacement()) };
    past.current.push(copyElements(elements)); past.current = past.current.slice(-50); future.current = []; setHistoryState({ undo: past.current.length, redo: 0 });
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - startX) / rect.width * 100; const dy = (pointer.clientY - startY) / rect.height * 100;
      if (mode === "move") patchPlacement(item.id, { x: Math.max(0, Math.min(100 - initial.width, initial.x + dx)), y: Math.max(0, Math.min(100 - initial.height, initial.y + dy)) }, false);
      if (mode === "resize") patchPlacement(item.id, { width: Math.max(4, Math.min(100 - initial.x, initial.width + dx)), height: Math.max(4, Math.min(100 - initial.y, initial.height + dy)) }, false);
      if (mode === "rotate") patchPlacement(item.id, { rotation: Math.round(initial.rotation + dx * 3.6) }, false);
    };
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };

  return <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--gfx-1)]/30 bg-background/60">
    <header className="flex flex-wrap items-center gap-2 border-b p-3">
      <div className="me-auto"><h3 className="font-bold">{lang === "fa" ? "بوم بصری آزاد" : "Free visual canvas"}</h3><p className="text-[10px] text-muted-foreground">{lang === "fa" ? "درگ، تغییر اندازه، چرخش و چیدمان مستقل هر دستگاه" : "Drag, resize, rotate and place independently per device"}</p></div>
      <select value={sectionId} onChange={(event) => { setSectionId(event.target.value); setSelectedId(null); }} className="h-9 rounded-md border bg-background px-2 text-xs">{builder.sections.map((section) => <option key={section.id} value={section.id}>{section.label || section.id}</option>)}</select>
      <Button type="button" size="sm" variant="outline" onClick={importNativeElements} title={lang === "fa" ? "المان‌های واقعی این سکشن را وارد کن" : "Import marked live elements"}><Import className="size-4"/>{lang === "fa" ? "المان‌های صفحه" : "Page elements"}</Button>
      {viewportMode === undefined && <div className="flex rounded-lg border p-1">{DEVICES.map(({ id, icon: Icon }) => <Button key={id} type="button" size="icon" variant={device === id ? "default" : "ghost"} onClick={() => setLocalDevice(id)}><Icon className="size-4"/></Button>)}</div>}
      {viewportMode === "auto" && <span className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{lang === "fa" ? "خودکار · همه دستگاه‌ها" : "Automatic · all devices"}</span>}
      <Button type="button" size="icon" variant="outline" disabled={!historyState.undo} onClick={undo}><Undo2 className="size-4"/></Button><Button type="button" size="icon" variant="outline" disabled={!historyState.redo} onClick={redo}><Redo2 className="size-4"/></Button><Button type="button" size="sm" variant="outline" onClick={saveVersion}><Save className="size-4"/>{lang === "fa" ? "نسخه" : "Version"}</Button>
    </header>
    <div className="grid xl:grid-cols-[210px_1fr_300px]">
      <aside className="border-e p-3"><p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">{lang === "fa" ? "المان‌ها" : "Elements"}</p><div className="grid grid-cols-2 gap-2">{PALETTE.map(({ kind, icon: Icon }) => <button key={kind} type="button" onClick={() => { const item = makeElement(kind, sectionId); commit([...elements, item]); setSelectedId(item.id); }} className="rounded-lg border p-2 text-center text-[10px] hover:border-[var(--gfx-1)]"><Icon className="mx-auto mb-1 size-4"/>{kind}</button>)}</div>
        <div className="mt-4 space-y-1">{visible.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs ${selectedId === item.id ? "bg-[var(--gfx-1)]/15" : "hover:bg-muted/40"}`}><span className="truncate">{item.name}</span></button>)}</div>
      </aside>
      <div className="overflow-auto bg-[#070810] p-4"><div data-visual-canvas className="relative mx-auto aspect-video min-w-[360px] overflow-hidden rounded-xl border border-white/15 bg-[radial-gradient(circle_at_30%_20%,rgba(232,74,155,.18),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(0,160,255,.18),transparent_40%)]" style={{ width: `min(100%, ${builder.responsive?.devices[device]?.canvasWidth || 1200}px)` }} onPointerDown={() => setSelectedId(null)}>{visible.map((item) => { const p = item.placements[device] ?? item.placements.desktop; if (!p?.visible) return null; return <div key={item.id} className={`absolute ${selectedId === item.id ? "outline outline-2 outline-[var(--gfx-1)]" : "outline outline-1 outline-transparent hover:outline-white/30"}`} style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.width}%`, height: `${p.height}%`, zIndex: p.zIndex, transform: `rotate(${p.rotation}deg)` }} onPointerDown={(event) => gesture(event, item, "move")}><VisualElementView element={item} device={device} preview/>{selectedId === item.id && <><button type="button" aria-label="Resize" className="absolute -bottom-2 -end-2 size-4 cursor-nwse-resize rounded-full border-2 border-white bg-[var(--gfx-1)]" onPointerDown={(event) => gesture(event, item, "resize")}/><button type="button" aria-label="Rotate" className="absolute -top-7 start-1/2 grid size-5 -translate-x-1/2 cursor-crosshair place-items-center rounded-full bg-white text-black" onPointerDown={(event) => gesture(event, item, "rotate")}><RotateCw className="size-3"/></button></>}</div>; })}</div></div>
      <aside className="border-s p-3">{selected ? <ElementInspector item={selected} device={device} lang={lang} onPatch={(patch) => update(selected.id, patch)} onPlacement={(patch) => patchPlacement(selected.id, patch)} onDelete={() => { commit(elements.filter((element) => element.id !== selected.id)); setSelectedId(null); }}/> : <p className="py-10 text-center text-xs text-muted-foreground">{lang === "fa" ? "یک المان را انتخاب کنید" : "Select an element"}</p>}
        {!!builder.versions?.length && <div className="mt-5 border-t pt-3"><p className="mb-2 text-xs font-bold">{lang === "fa" ? "تاریخچه نسخه‌ها" : "Version history"}</p>{builder.versions.slice().reverse().map((version) => <button key={version.id} type="button" onClick={() => { try { const parsed = JSON.parse(version.snapshot); if (Array.isArray(parsed)) commit(parsed); else onChange({ ...builder, visualElements: parsed.visualElements ?? [], responsive: parsed.responsive ?? builder.responsive, sections: parsed.sections ?? builder.sections }); } catch { /* invalid legacy snapshot */ } }} className="mb-1 block w-full truncate rounded border px-2 py-1 text-start text-[10px] hover:bg-muted/40">{version.name}</button>)}</div>}
      </aside>
    </div>
  </section>;
}

function ElementInspector({ item, device, lang, onPatch, onPlacement, onDelete }: { item: VisualElementConfig; device: BuilderDevice; lang: Lang; onPatch: (patch: Partial<VisualElementConfig>) => void; onPlacement: (patch: Partial<VisualElementPlacement>) => void; onDelete: () => void }) {
  const p = item.placements[device] ?? item.placements.desktop; const mediaType = item.kind === "image" ? "image" : item.kind === "video" ? "video" : item.kind === "audio" ? "audio" : item.kind === "model3d" ? "model" : item.kind === "lottie" ? "lottie" : "all";
  const field = (label: string, value: string | number, change: (value: string) => void, type = "text") => <label className="block space-y-1 text-[10px] text-muted-foreground"><span>{label}</span><Input type={type} value={value} onChange={(event) => change(event.target.value)} className="h-8 text-xs"/></label>;
  return <div className="space-y-2"><div className="flex items-center gap-2"><Input value={item.name} onChange={(event) => onPatch({ name: event.target.value })} className="h-8"/><Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="size-4"/></Button></div>
    {(item.kind === "text" || item.kind === "button" || item.kind === "form") && field(lang === "fa" ? "متن" : "Text", item.text, (text) => onPatch({ text }))}
    {item.kind === "button" && field("URL", item.href, (href) => onPatch({ href }))}
    {item.kind === "form" && field("Form ID", item.formId, (formId) => onPatch({ formId }))}
    {item.kind === "icon" && field("Font Awesome class", item.icon, (icon) => onPatch({ icon }))}
    {item.kind === "native" && <><p className="rounded border border-[var(--ai-1)]/30 bg-[var(--ai-1)]/10 p-2 text-[10px] text-muted-foreground">{lang === "fa" ? "چیدمان روی المان واقعی صفحه اعمال می‌شود؛ حذف این لینک، چیدمان اصلی را برمی‌گرداند." : "Placement is applied to the real page element. Delete this link to restore its original layout."}</p>{field(lang === "fa" ? "سلکتور CSS" : "CSS selector", item.selector ?? "", (selector) => onPatch({ selector }))}</>}
    {["image", "video", "audio", "lottie", "model3d"].includes(item.kind) && <div className="space-y-1">{field("Media URL", item.mediaUrl, (mediaUrl) => onPatch({ mediaUrl }))}<CmsMediaPicker value={item.mediaUrl} onChange={(mediaUrl) => onPatch({ mediaUrl })} lang={lang} accept={mediaType}/></div>}
    <div className="grid grid-cols-2 gap-2">{field("X %", p.x, (value) => onPlacement({ x: Number(value) }), "number")}{field("Y %", p.y, (value) => onPlacement({ y: Number(value) }), "number")}{field("Width %", p.width, (value) => onPlacement({ width: Number(value) }), "number")}{field("Height %", p.height, (value) => onPlacement({ height: Number(value) }), "number")}{field("Rotation", p.rotation, (value) => onPlacement({ rotation: Number(value) }), "number")}{field("Layer", p.zIndex, (value) => onPlacement({ zIndex: Number(value) }), "number")}{field("Font px", item.fontSize, (value) => onPatch({ fontSize: Number(value) }), "number")}{field("Radius", item.borderRadius, (value) => onPatch({ borderRadius: Number(value) }), "number")}</div>
    {field("Color", item.color, (color) => onPatch({ color }))}{field("Background", item.background, (background) => onPatch({ background }))}{field("Border", item.borderColor, (borderColor) => onPatch({ borderColor }))}{field("Custom class", item.className, (className) => onPatch({ className }))}
    <label className="flex items-center gap-2 rounded border p-2 text-xs"><input type="checkbox" checked={p.visible} onChange={(event) => onPlacement({ visible: event.target.checked })}/>{lang === "fa" ? "نمایش در این دستگاه" : "Visible on this device"}</label>
  </div>;
}
