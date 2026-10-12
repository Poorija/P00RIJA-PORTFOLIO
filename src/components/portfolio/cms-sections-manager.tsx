"use client";

/* ==================================================================
 * SectionsManager — visual layout manager for page sections.
 *
 * - Toggle any section on/off (hidden from page + nav + its planet)
 * - Reorder with ↑ ↓ and swap any two sections with ⇄
 * - Duplicate built-ins or customs into new custom sections
 * - Delete custom sections
 * - Link/unlink a planet in the hero solar system per section
 * - Create unlimited new custom sections
 *
 * All structural changes are persisted instantly to BOTH languages
 * (fa + en) so the layout never diverges between translations.
 * ================================================================== */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Copy,
  Trash2,
  Plus,
  Orbit,
  Loader2,
  GripVertical,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContent } from "@/lib/content-store";
import type { BuilderSectionConfig, Lang, PlanetConfig, SectionKey } from "@/lib/content-types";
import { cn } from "@/lib/utils";

export interface CustomSectionMeta {
  key: string;
  label: string;
  iconKey: string;
}

const PLANET_COLORS = ["#e84a9b", "#3ee08a", "#4a8aff", "#f5a623", "#8b5cf6", "#16d6c3", "#ff6b6b"];
const PLANET_TEXTURES = ["swirly", "cratered", "gas-bands", "ringed", "nebula"];

/** Built-in page sections in their default order. */
const DEFAULT_BUILTIN_ORDER = ["hero", "graphics", "security", "ai", "timeline", "synthesis"];

const BUILTIN_LABELS: Record<string, { fa: string; en: string }> = {
  hero: { fa: "بخش معرفی", en: "Hero" },
  graphics: { fa: "گرافیک", en: "Graphics" },
  security: { fa: "امنیت", en: "Security" },
  ai: { fa: "هوش مصنوعی", en: "Artificial Intelligence" },
  timeline: { fa: "خط زمانی", en: "Timeline" },
  synthesis: { fa: "ترکیب", en: "Synthesis" },
  footer: { fa: "پاورقی و تماس", en: "Footer & Contact" },
};

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Sensible auto-planet for a section (used when linking a planet). */
export function makePlanetForSection(sectionId: string, label: string): PlanetConfig {
  const seed = hashString(sectionId);
  return {
    id: `p-${sectionId}`,
    label,
    hint: "",
    sectionId,
    color: PLANET_COLORS[seed % PLANET_COLORS.length],
    texture: PLANET_TEXTURES[seed % PLANET_TEXTURES.length],
    size: 7.5,
    orbitRadius: 15 + (seed % 4) * 4.5,
    orbitPeriod: 36 + (seed % 5) * 4,
    orbitOffset: (seed % 12) * 30,
    moonSize: 1.8,
    moonOrbitRadius: 6.5,
    moonOrbitPeriod: 10,
    moonOrbitOffset: 0,
    moonOrbitTiltX: 62,
    moonOrbitTiltY: 0,
    moonOrbitTiltZ: 10,
    moons: [],
  };
}

function normalizeOrder(sections: BuilderSectionConfig[]): BuilderSectionConfig[] {
  // Array position is source of truth while reordering. Sorting here used the
  // stale `order` values and silently undid every arrow/swap operation.
  return sections.map((s, i) => ({ ...s, order: i + 1 }));
}

export function SectionsManager({
  customSections,
  onDuplicate,
  onDeleteCustom,
  onCreateCustom,
  persistBuilderSections,
  persistPlanets,
}: {
  customSections: CustomSectionMeta[];
  onDuplicate: (sourceKey: string) => Promise<void>;
  onDeleteCustom: (key: string) => Promise<void>;
  onCreateCustom: (
    label: string,
    iconKey: string,
    withPlanet: boolean,
    insertAfter: string | "end"
  ) => Promise<void>;
  /** Instantly save builder.sections for fa + en. */
  persistBuilderSections: (sections: BuilderSectionConfig[]) => Promise<boolean>;
  /** Instantly save hero.planets for fa + en. */
  persistPlanets: (planetsFa: PlanetConfig[], planetsEn: PlanetConfig[]) => Promise<boolean>;
}) {
  const builderFa = useContent((s) => s.contentFa.builder);
  const builderEn = useContent((s) => s.contentEn.builder);
  const planetsFa = useContent((s) => s.contentFa.hero.planets);
  const planetsEn = useContent((s) => s.contentEn.hero.planets);
  const lang = useContent((s) => s.lang);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newWithPlanet, setNewWithPlanet] = useState(true);
  const [newInsertAfter, setNewInsertAfter] = useState<string | "end">("end");

  // Sections list — en is the structural source of truth; fall back to fa.
  // Built-ins missing from the stored config (e.g. a brand-new section type)
  // are appended virtually so they can be managed too.
  const sections = useMemo(() => {
    const raw = (builderEn?.sections?.length
      ? builderEn.sections
      : builderFa?.sections ?? []) as BuilderSectionConfig[];
    const ids = new Set(raw.map((s) => s.id));
    const missing: BuilderSectionConfig[] = DEFAULT_BUILTIN_ORDER.filter((id) => !ids.has(id)).map((id, i) => ({
      id,
      label: BUILTIN_LABELS[id]?.en ?? id,
      enabled: true,
      order: raw.length + i + 1,
      anchor: id === "hero" ? "" : id,
      layout: "wide" as const,
      paddingTop: 120,
      paddingBottom: 120,
      maxWidth: 1280,
      background: "transparent",
      accent: "var(--foreground)",
      textColor: "var(--foreground)",
      radius: 0,
      blur: 0,
      opacity: 1,
      link: "",
      hoverEffect: "none" as const,
      customClass: "",
    }));
    return [...raw, ...missing]
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((s, i) => ({ ...s, order: i + 1 }));
  }, [builderEn, builderFa]);

  const labelFor = (s: BuilderSectionConfig): string => {
    if (s.id.startsWith("custom-")) {
      return customSections.find((c) => c.key === s.id)?.label ?? s.label ?? s.id;
    }
    return BUILTIN_LABELS[s.id]?.[lang] ?? (s.label || s.id);
  };

  const hasPlanet = (s: BuilderSectionConfig) =>
    planetsFa.some((p) => p.sectionId === s.id) || planetsEn.some((p) => p.sectionId === s.id);

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
    } catch {
      toast.error(lang === "fa" ? "خطا در ذخیره" : "Save failed");
    } finally {
      setBusyId(null);
    }
  };

  /* ---------- operations (all persist instantly, both langs) ---------- */

  const setSections = (next: BuilderSectionConfig[]) => run("list", () => persistBuilderSections(normalizeOrder(next)));

  const toggleEnabled = (s: BuilderSectionConfig) =>
    setSections(sections.map((x) => (x.id === s.id ? { ...x, enabled: x.enabled === false } : x)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
  };

  const swap = (fromId: string, toId: string) => {
    const i = sections.findIndex((x) => x.id === fromId);
    const j = sections.findIndex((x) => x.id === toId);
    if (i < 0 || j < 0 || i === j) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
    toast.success(lang === "fa" ? "دو بخش جابه‌جا شدند" : "Sections swapped");
  };

  const reorder = (fromId: string, toId: string) => {
    const from = sections.findIndex((x) => x.id === fromId);
    const to = sections.findIndex((x) => x.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSections(next);
    toast.success(lang === "fa" ? "ترتیب بخش‌ها ذخیره شد" : "Section order saved");
  };

  const patchSection = (id: string, patch: Partial<BuilderSectionConfig>) =>
    setSections(sections.map((section) => (section.id === id ? { ...section, ...patch } : section)));

  const togglePlanet = (s: BuilderSectionConfig) =>
    run(s.id, async () => {
      const exists = hasPlanet(s);
      if (exists) {
        const ok = await persistPlanets(
          planetsFa.filter((p) => p.sectionId !== s.id),
          planetsEn.filter((p) => p.sectionId !== s.id)
        );
        if (ok) toast.success(lang === "fa" ? "سیاره حذف شد" : "Planet removed");
      } else {
        const planet = makePlanetForSection(s.id, labelFor(s));
        const ok = await persistPlanets([...planetsFa, { ...planet, label: labelFor(s) }], [...planetsEn, planet]);
        if (ok) toast.success(lang === "fa" ? "سیاره اضافه شد 🪐" : "Planet added 🪐");
      }
    });

  const duplicate = (s: BuilderSectionConfig) => run(s.id, () => onDuplicate(s.id));

  const remove = (s: BuilderSectionConfig) => {
    if (!s.id.startsWith("custom-")) return;
    run(s.id, async () => {
      await onDeleteCustom(s.id);
      await persistBuilderSections(sections.filter((x) => x.id !== s.id));
      // remove linked planet too
      if (hasPlanet(s)) {
        await persistPlanets(
          planetsFa.filter((p) => p.sectionId !== s.id),
          planetsEn.filter((p) => p.sectionId !== s.id)
        );
      }
    });
  };

  const create = () => {
    const label = newLabel.trim() || (lang === "fa" ? "بخش جدید" : "New section");
    run("create", async () => {
      await onCreateCustom(label, "star", newWithPlanet, newInsertAfter);
      setNewLabel("");
    });
  };

  return (
    <div className="space-y-4">
      {/* hint */}
      <p className="rounded-lg border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
        {lang === "fa"
          ? "هر بخش را کامل غیرفعال کنید (از صفحه، منو و آسمان حذف می‌شود)، با ↑↓ یا ⇄ جابه‌جا کنید، داپلیکیت بگیرید، یا با 🪐 یک سیاره در صفحه اول برایش بسازید. تغییرات همان لحظه در هر دو زبان ذخیره می‌شوند."
          : "Fully disable any section (removed from page, nav and sky), reorder with ↑↓ or ⇄, duplicate it, or give it a 🪐 planet in the hero. Changes save instantly to both languages."}
      </p>

      {/* create new */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-background/30 p-3">
        <Plus className="h-4 w-4 text-primary" />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder={lang === "fa" ? "نام بخش جدید… (بدون محدودیت)" : "New section name… (unlimited)"}
          className="h-9 w-48 flex-1 bg-background/60"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={newWithPlanet} onChange={(e) => setNewWithPlanet(e.target.checked)} />
          🪐 {lang === "fa" ? "با سیاره" : "with planet"}
        </label>
        <select
          value={newInsertAfter}
          onChange={(e) => setNewInsertAfter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background/60 px-2 text-xs text-foreground"
          title={lang === "fa" ? "محل قرارگیری" : "Position"}
        >
          <option value="end">{lang === "fa" ? "📍 انتهای صفحه" : "📍 End of page"}</option>
          {sections.map((s, i) => (
            <option key={s.id} value={s.id}>
              {lang === "fa" ? `بعد از ${i + 1} · ${labelFor(s)}` : `After ${i + 1} · ${labelFor(s)}`}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={create} disabled={busyId === "create"}>
          {busyId === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {lang === "fa" ? "بساز" : "Create"}
        </Button>
      </div>

      {/* rows */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {sections.map((s, i) => {
            const isCustom = s.id.startsWith("custom-");
            const disabled = s.enabled === false;
            const linked = hasPlanet(s);
            const busy = busyId === s.id;
            const swapTarget = swapFrom && swapFrom !== s.id;
            return (
              <motion.div
                layout
                key={s.id}
                draggable={busyId === null}
                onDragStartCapture={(event) => {
                  const transfer = event.dataTransfer;
                  setDragFrom(s.id);
                  transfer.effectAllowed = "move";
                  transfer.setData("text/plain", s.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOver(s.id);
                }}
                onDragLeave={() => setDragOver((current) => current === s.id ? null : current)}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = event.dataTransfer.getData("text/plain") || dragFrom;
                  if (from) reorder(from, s.id);
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragEndCapture={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-xl border bg-background/50 p-2.5 transition-colors",
                  disabled ? "border-border/50 opacity-60" : "border-border",
                  swapFrom === s.id && "ring-2 ring-primary",
                  dragFrom === s.id && "opacity-40",
                  dragOver === s.id && dragFrom !== s.id && "border-primary bg-primary/5"
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/70 active:cursor-grabbing" />
                <span className="w-6 shrink-0 font-mono text-[10px] text-muted-foreground">{new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US", { minimumIntegerDigits: 2, useGrouping: false }).format(i + 1)}</span>

                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.accent || "var(--foreground)", opacity: disabled ? 0.3 : 1 }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {labelFor(s)}
                  <span className="ms-2 font-mono text-[10px] text-muted-foreground/70">{s.id}</span>
                </span>

                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}

                <div className="flex flex-wrap items-center gap-1">
                  {/* planet link */}
                  <IconBtn
                    title={lang === "fa" ? "فاصله و ظاهر بخش" : "Section spacing and appearance"}
                    onClick={() => setEditingId((current) => current === s.id ? null : s.id)}
                    active={editingId === s.id}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </IconBtn>

                  <IconBtn
                    title={linked ? (lang === "fa" ? "حذف سیاره" : "Remove planet") : lang === "fa" ? "افزودن سیاره" : "Add planet"}
                    onClick={() => togglePlanet(s)}
                    active={linked}
                  >
                    <Orbit className="h-3.5 w-3.5" />
                  </IconBtn>

                  {/* enable/disable */}
                  <IconBtn
                    title={disabled ? (lang === "fa" ? "فعال کردن" : "Enable") : lang === "fa" ? "غیرفعال کردن کامل" : "Fully disable"}
                    onClick={() => toggleEnabled(s)}
                    active={!disabled}
                  >
                    {disabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </IconBtn>

                  {/* swap */}
                  <IconBtn
                    title={lang === "fa" ? "جابه‌جایی با بخش دیگر" : "Swap with another section"}
                    onClick={() => {
                      if (swapFrom) {
                        swap(swapFrom, s.id);
                        setSwapFrom(null);
                      } else {
                        setSwapFrom(s.id);
                        toast(lang === "fa" ? "حالا بخش دوم را انتخاب کن" : "Now pick the second section");
                      }
                    }}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </IconBtn>

                  {/* up / down */}
                  <IconBtn title={lang === "fa" ? "بالا" : "Move up"} onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn
                    title={lang === "fa" ? "پایین" : "Move down"}
                    onClick={() => move(i, 1)}
                    disabled={i === sections.length - 1}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconBtn>

                  {/* duplicate */}
                  <IconBtn title={lang === "fa" ? "داپلیکیت" : "Duplicate"} onClick={() => duplicate(s)}>
                    <Copy className="h-3.5 w-3.5" />
                  </IconBtn>

                  {/* delete (custom only) */}
                  {isCustom && (
                    <IconBtn title={lang === "fa" ? "حذف" : "Delete"} danger onClick={() => remove(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  )}
                </div>

                {editingId === s.id && (
                  <div className="mt-2 w-full border-t border-border/70 pt-3">
                    <SpacingPreview
                      lang={lang}
                      before={s.gapBefore ?? 0}
                      top={s.paddingTop}
                      bottom={s.paddingBottom}
                      after={s.gapAfter ?? 28}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <CompactNumber
                      label={lang === "fa" ? "فاصله با بخش قبلی" : "Gap from previous"}
                      value={s.gapBefore ?? 0}
                      onCommit={(value) => patchSection(s.id, { gapBefore: value })}
                    />
                    <CompactNumber
                      label={lang === "fa" ? "فضای داخلی بالا" : "Inner top padding"}
                      value={s.paddingTop}
                      onCommit={(value) => patchSection(s.id, { paddingTop: value })}
                    />
                    <CompactNumber
                      label={lang === "fa" ? "فضای داخلی پایین" : "Inner bottom padding"}
                      value={s.paddingBottom}
                      onCommit={(value) => patchSection(s.id, { paddingBottom: value })}
                    />
                    <CompactNumber
                      label={lang === "fa" ? "فاصله تا بخش بعد" : "Gap after"}
                      value={s.gapAfter ?? 28}
                      onCommit={(value) => patchSection(s.id, { gapAfter: value })}
                    />
                    </div>
                    <div className="mt-2 max-w-xs"><CompactNumber
                      label={lang === "fa" ? "حداکثر عرض" : "Max width"}
                      value={s.maxWidth}
                      min={320}
                      max={2200}
                      onCommit={(value) => patchSection(s.id, { maxWidth: value })}
                    /></div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {swapFrom && (
        <button
          onClick={() => setSwapFrom(null)}
          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {lang === "fa" ? "لغو جابه‌جایی" : "Cancel swap"}
        </button>
      )}
    </div>
  );
}

function SpacingPreview({ lang, before, top, bottom, after }: { lang: Lang; before: number; top: number; bottom: number; after: number }) {
  const h = (value: number) => `${Math.max(5, Math.min(38, value / 5))}px`;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/60 p-3" aria-label={lang === "fa" ? "پیش‌نمایش فاصله‌ها" : "Spacing preview"}>
      <p className="mb-2 text-[10px] font-medium text-muted-foreground">{lang === "fa" ? "پیش‌نمایش زندهٔ فاصلهٔ بخش" : "Live section-spacing preview"}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-x-3 text-[9px]">
        <div className="rounded bg-muted/35" style={{ height: h(before) }} /><span className="self-center font-mono text-muted-foreground">{before}px</span>
        <div className="rounded-t border-x border-t border-primary/35 bg-primary/10" style={{ height: h(top) }} /><span className="self-center font-mono text-muted-foreground">{top}px</span>
        <div className="grid h-12 place-items-center border-x border-primary/35 bg-primary/5 text-[10px] font-semibold text-primary">{lang === "fa" ? "محتوا" : "CONTENT"}</div><span />
        <div className="rounded-b border-x border-b border-primary/35 bg-primary/10" style={{ height: h(bottom) }} /><span className="self-center font-mono text-muted-foreground">{bottom}px</span>
        <div className="rounded bg-muted/35" style={{ height: h(after) }} /><span className="self-center font-mono text-muted-foreground">{after}px</span>
      </div>
    </div>
  );
}

function CompactNumber({
  label,
  value,
  onCommit,
  min = 0,
  max = 480,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="text-[10px] text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      <Input
        type="range"
        min={min}
        max={max}
        defaultValue={value}
        className="h-8 cursor-ew-resize bg-transparent px-0"
        onChange={(event) => onCommit(Math.max(min, Math.min(max, Number(event.target.value) || 0)))}
        onBlur={(event) => {
          const next = Math.max(min, Math.min(max, Number(event.target.value) || 0));
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lg border border-transparent text-muted-foreground transition-colors",
        !disabled && "hover:bg-surface-2 hover:text-foreground",
        active && "border-primary/40 text-primary",
        danger && !disabled && "hover:text-destructive",
        disabled && "opacity-30"
      )}
    >
      {children}
    </button>
  );
}

/** helper re-exported for panel use */
export type { Lang, SectionKey };
