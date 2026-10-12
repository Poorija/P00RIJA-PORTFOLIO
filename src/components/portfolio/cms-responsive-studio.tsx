"use client";
/* eslint-disable react-hooks/refs -- dnd-kit callback refs are intentional. */

import { useMemo } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Monitor, Smartphone, Sparkles, Tablet } from "lucide-react";
import type { BuilderConfig, BuilderDevice, BuilderDeviceSectionConfig, BuilderSectionConfig, Lang } from "@/lib/content-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CmsViewportMode = "auto" | BuilderDevice;

const VIEWPORTS: { id: CmsViewportMode; icon: typeof Monitor; fa: string; en: string }[] = [
  { id: "auto", icon: Sparkles, fa: "خودکار", en: "Automatic" },
  { id: "desktop", icon: Monitor, fa: "دسکتاپ", en: "Desktop" },
  { id: "tablet", icon: Tablet, fa: "تبلت", en: "Tablet" },
  { id: "mobile", icon: Smartphone, fa: "موبایل", en: "Mobile" },
];

const WIDTHS: Record<BuilderDevice, number> = { desktop: 1440, tablet: 768, mobile: 390 };

function baseToDevice(section: BuilderSectionConfig, index: number, builder: BuilderConfig): BuilderDeviceSectionConfig {
  return {
    id: section.id,
    enabled: section.enabled !== false,
    order: index + 1,
    paddingTop: Number(section.paddingTop || 0),
    paddingBottom: Number(section.paddingBottom || 0),
    gapBefore: Number(section.gapBefore || 0),
    gapAfter: Number(section.gapAfter ?? builder.global.sectionGap ?? 0),
    maxWidth: Number(section.maxWidth || builder.global.maxWidth || 1280),
    fontScale: Number(section.fontScale || 1),
    objectScale: Number(section.objectScale || 1),
  };
}

function orderedBase(builder: BuilderConfig) {
  return [...(builder.sections ?? [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function deviceItems(builder: BuilderConfig, device: BuilderDevice) {
  const base = orderedBase(builder).map((section, index) => baseToDevice(section, index, builder));
  const stored = builder.responsive?.devices?.[device]?.sections ?? [];
  const byId = new Map(stored.map((item) => [item.id, item]));
  const merged = base.map((item) => ({ ...item, ...byId.get(item.id) }));
  for (const item of stored) if (!merged.some((entry) => entry.id === item.id)) merged.push(item);
  return merged.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

export function CmsViewportToolbar({ mode, lang, onChange, compact = false }: { mode: CmsViewportMode; lang: Lang; onChange: (mode: CmsViewportMode) => void; compact?: boolean }) {
  return (
    <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-background/70 p-1 shadow-sm" role="tablist" aria-label={lang === "fa" ? "حالت نمایش واکنش‌گرا" : "Responsive viewport mode"}>
      {VIEWPORTS.map((entry) => {
        const Icon = entry.icon;
        const active = mode === entry.id;
        return (
          <button key={entry.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(entry.id)} title={lang === "fa" ? entry.fa : entry.en} className={cn("inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-[var(--surface-1)] hover:text-foreground")}> 
            <Icon className="size-3.5" />
            <span className={compact && entry.id !== "auto" ? "hidden 2xl:inline" : "inline"}>{lang === "fa" ? entry.fa : entry.en}</span>
          </button>
        );
      })}
    </div>
  );
}

function MiniNumber({ label, value, disabled, min = 0, step = 1, onChange }: { label: string; value: number; disabled?: boolean; min?: number; step?: number; onChange: (value: number) => void }) {
  return <label className="space-y-1 text-[10px] text-muted-foreground"><span>{label}</span><Input type="number" min={min} step={step} disabled={disabled} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))} className="h-8 text-xs" /></label>;
}

function SortableChip({ id, label, disabled }: { id: string; label: string; disabled: boolean }) {
  const sortable = useSortable({ id, disabled });
  return <div ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={cn("flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs", sortable.isDragging && "z-20 border-primary shadow-lg", disabled && "opacity-60")}><button type="button" disabled={disabled} className="touch-none cursor-grab p-0.5" {...sortable.attributes} {...sortable.listeners} aria-label={`Move ${label}`}><GripVertical className="size-3.5" /></button><span className="max-w-28 truncate">{label}</span></div>;
}

export function CmsSectionResponsiveControls({ builder, sectionId, mode, lang, onChange }: { builder: BuilderConfig; sectionId: string; mode: CmsViewportMode; lang: Lang; onChange: (next: BuilderConfig) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }));
  const responsive = builder.responsive ?? {
    enabled: true,
    tabletBreakpoint: 1024,
    mobileBreakpoint: 640,
    devices: {
      desktop: { canvasWidth: WIDTHS.desktop, overrideEnabled: false, sections: [] },
      tablet: { canvasWidth: WIDTHS.tablet, overrideEnabled: false, sections: [] },
      mobile: { canvasWidth: WIDTHS.mobile, overrideEnabled: false, sections: [] },
    },
  };
  const base = useMemo(() => orderedBase(builder), [builder]);
  const activeBase = base.find((item) => item.id === sectionId);
  const device = mode === "auto" ? null : mode;
  const config = device ? responsive.devices[device] : null;
  const hasLegacyOverride = Boolean(config?.sections?.length) && config?.overrideEnabled === undefined;
  const overrideEnabled = device ? (config?.overrideEnabled ?? hasLegacyOverride) : false;
  const manualItems = device ? deviceItems(builder, device) : [];
  const activeManual = manualItems.find((item) => item.id === sectionId);
  const canEdit = mode === "auto" || overrideEnabled;

  if (!activeBase) return null;

  const saveBase = (items: BuilderSectionConfig[]) => onChange({ ...builder, sections: items.map((item, index) => ({ ...item, order: index + 1 })) });
  const saveDevice = (items: BuilderDeviceSectionConfig[], enabled = overrideEnabled) => {
    if (!device) return;
    const normalized = items.map((item, index) => ({ ...item, order: index + 1 }));
    onChange({ ...builder, responsive: { ...responsive, enabled: true, devices: { ...responsive.devices, [device]: { ...(responsive.devices[device] ?? { canvasWidth: WIDTHS[device] }), canvasWidth: responsive.devices[device]?.canvasWidth || WIDTHS[device], overrideEnabled: enabled, sections: normalized } } } });
  };
  const setOverride = (enabled: boolean) => {
    if (!device) return;
    saveDevice(manualItems.length ? manualItems : base.map((item, index) => baseToDevice(item, index, builder)), enabled);
  };
  const patchCurrent = (patch: Partial<BuilderDeviceSectionConfig>) => {
    if (mode === "auto") {
      saveBase(base.map((item) => item.id === sectionId ? { ...item, ...patch } : item));
      return;
    }
    saveDevice(manualItems.map((item) => item.id === sectionId ? { ...item, ...patch } : item), true);
  };
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !canEdit) return;
    const items: Array<BuilderSectionConfig | BuilderDeviceSectionConfig> = mode === "auto" ? base : manualItems;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    if (mode === "auto") saveBase(arrayMove(base, from, to));
    else saveDevice(arrayMove(manualItems, from, to), true);
  };
  const current = mode === "auto" ? baseToDevice(activeBase, Math.max(0, base.indexOf(activeBase)), builder) : activeManual ?? baseToDevice(activeBase, Math.max(0, base.indexOf(activeBase)), builder);
  const items = mode === "auto" ? base : manualItems;

  return <section className="mb-5 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[.08] via-background to-[var(--ai-1)]/[.06]">
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">{lang === "fa" ? "چیدمان واکنش‌گرای این بخش" : "Responsive layout for this section"}</h3><p className="text-[11px] text-muted-foreground">{mode === "auto" ? (lang === "fa" ? "مقادیر خودکار پایه در همه دستگاه‌ها اعمال می‌شوند." : "Automatic base values apply to every viewport.") : overrideEnabled ? (lang === "fa" ? "چیدمان اختصاصی این دستگاه فعال است." : "This device uses its own layout override.") : (lang === "fa" ? "چیدمان این دستگاه هنوز از حالت خودکار ارث می‌برد." : "This device layout currently inherits Automatic.")}</p></div>
      {device && <Button type="button" size="sm" variant={overrideEnabled ? "outline" : "default"} onClick={() => setOverride(!overrideEnabled)}>{overrideEnabled ? (lang === "fa" ? "بازگشت چیدمان به خودکار" : "Use Automatic layout") : (lang === "fa" ? "فعال‌کردن چیدمان اختصاصی" : "Enable layout override")}</Button>}
    </div>
    <div className="space-y-4 p-4">
      <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{lang === "fa" ? "ترتیب سکشن‌ها — با درگ جابه‌جا کنید" : "Section order — drag to reorder"}</p><DndContext sensors={sensors} onDragEnd={dragEnd}><SortableContext items={items.map((item) => item.id)} strategy={horizontalListSortingStrategy}><div className="flex gap-2 overflow-x-auto pb-1">{items.map((item) => <SortableChip key={item.id} id={item.id} label={("label" in item && String(item.label || "")) || item.id} disabled={!canEdit} />)}</div></SortableContext></DndContext></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <label className="flex min-h-14 items-center gap-2 rounded-lg border border-border bg-background/50 px-3 text-xs"><input type="checkbox" checked={current.enabled} disabled={!canEdit} onChange={() => patchCurrent({ enabled: !current.enabled })} />{current.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}{lang === "fa" ? "نمایش" : "Visible"}</label>
        <MiniNumber label={lang === "fa" ? "فاصله داخلی بالا" : "Padding top"} value={current.paddingTop} disabled={!canEdit} onChange={(value) => patchCurrent({ paddingTop: value })} />
        <MiniNumber label={lang === "fa" ? "فاصله داخلی پایین" : "Padding bottom"} value={current.paddingBottom} disabled={!canEdit} onChange={(value) => patchCurrent({ paddingBottom: value })} />
        <MiniNumber label={lang === "fa" ? "فاصله از قبلی" : "Gap before"} value={current.gapBefore} disabled={!canEdit} onChange={(value) => patchCurrent({ gapBefore: value })} />
        <MiniNumber label={lang === "fa" ? "فاصله تا بعدی" : "Gap after"} value={current.gapAfter} disabled={!canEdit} onChange={(value) => patchCurrent({ gapAfter: value })} />
        <MiniNumber label={lang === "fa" ? "حداکثر عرض" : "Max width"} value={current.maxWidth} min={280} step={10} disabled={!canEdit} onChange={(value) => patchCurrent({ maxWidth: value })} />
        <MiniNumber label={lang === "fa" ? "مقیاس متن" : "Text scale"} value={current.fontScale} min={0.25} step={0.05} disabled={!canEdit} onChange={(value) => patchCurrent({ fontScale: value })} />
        <MiniNumber label={lang === "fa" ? "مقیاس آبجکت" : "Object scale"} value={current.objectScale} min={0.25} step={0.05} disabled={!canEdit} onChange={(value) => patchCurrent({ objectScale: value })} />
      </div>
      <div className="flex h-10 overflow-hidden rounded-xl border border-border/70 bg-background/40" aria-label={lang === "fa" ? "پیش‌نمایش بصری فاصله" : "Visual spacing preview"}><span className="bg-[var(--gfx-1)]/20 transition-[width]" style={{ width: `${Math.min(30, current.gapBefore / 5)}%` }} /><span className="bg-[var(--ai-1)]/15 transition-[width]" style={{ width: `${Math.min(22, current.paddingTop / 6)}%` }} /><span className="flex-1 bg-gradient-to-r from-[var(--gfx-1)]/30 via-[var(--ai-1)]/30 to-[var(--sec-1)]/30" /><span className="bg-[var(--ai-1)]/15 transition-[width]" style={{ width: `${Math.min(22, current.paddingBottom / 6)}%` }} /><span className="bg-[var(--sec-1)]/20 transition-[width]" style={{ width: `${Math.min(30, current.gapAfter / 5)}%` }} /></div>
    </div>
  </section>;
}
