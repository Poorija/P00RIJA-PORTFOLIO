"use client";

import { useMemo, useState } from "react";
import { Box, Check, Plus } from "lucide-react";
import type { Lang, SceneObject3DConfig } from "@/lib/content-types";
import { PROCEDURAL_OBJECT_LIBRARY, createProceduralConfig, type ProceduralObjectKind } from "@/lib/procedural-objects";
import { Ambient3DObject } from "./ambient-3d-object";
import { Button } from "@/components/ui/button";

export function ProceduralObjectLibrary({ lang, onInsert }: { lang: Lang; onInsert: (object: SceneObject3DConfig) => void }) {
  const fa = lang === "fa";
  const [selected, setSelected] = useState<ProceduralObjectKind>("ribbon");
  const [inserted, setInserted] = useState(false);
  const config = useMemo(() => ({ ...createProceduralConfig(selected), domX: 50, domTop: 0, domSize: 250 }), [selected]);
  const item = PROCEDURAL_OBJECT_LIBRARY.find((entry) => entry.kind === selected)!;

  return (
    <div className="mb-4 rounded-xl border border-[var(--ai-1)]/20 bg-background/45 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Box className="size-4 text-[var(--ai-1)]" />
        <div>
          <h4 className="text-sm font-bold">{fa ? "کتابخانه آبجکت‌های آماده" : "Procedural object library"}</h4>
          <p className="text-[11px] text-muted-foreground">{fa ? "مدل‌های سبک و ساخته‌شده در مرورگر؛ یک پیش‌نمایش فعال برای مصرف کم منابع." : "Lightweight browser-built models with one live preview."}</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROCEDURAL_OBJECT_LIBRARY.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              onClick={() => { setSelected(entry.kind); setInserted(false); }}
              className={`min-h-24 rounded-xl border p-3 text-start transition ${selected === entry.kind ? "border-[var(--ai-1)]/55 bg-[var(--ai-1)]/10" : "border-border bg-background/50 hover:border-foreground/25"}`}
              aria-pressed={selected === entry.kind}
            >
              <span className="mb-3 flex gap-1.5" aria-hidden>{entry.colors.map((color) => <span key={color} className="size-3 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />)}</span>
              <span className="block text-xs font-bold">{entry.label[lang]}</span>
              <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{entry.description[lang]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(65,110,170,.14),transparent_68%)]">
          <div className="relative h-56 shrink-0" aria-label={item.label[lang]}>
            <Ambient3DObject key={selected} config={config} variant="crystal" />
          </div>
          <Button className="m-3 mt-0" onClick={() => { onInsert(createProceduralConfig(selected)); setInserted(true); }}>
            {inserted ? <Check className="size-4" /> : <Plus className="size-4" />}
            {inserted ? (fa ? "اضافه شد؛ دوباره افزودن" : "Added; insert again") : (fa ? "جایگذاری در گرافیک" : "Insert into graphics")}
          </Button>
        </div>
      </div>
    </div>
  );
}
