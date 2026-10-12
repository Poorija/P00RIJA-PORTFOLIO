"use client";

import { useEffect, useMemo, useState } from "react";
import { Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { BuilderConfig, Lang } from "@/lib/content-types";

type FontAsset = { id: string; filename: string; title?: string; mime: string; url: string };

const SYSTEM_FONTS = [
  { label: "Inter", value: "Inter" },
  { label: "Vazirmatn", value: "Vazirmatn" },
  { label: "Arial", value: "Arial" },
  { label: "Tahoma", value: "Tahoma" },
  { label: "Georgia", value: "Georgia" },
  { label: "System UI", value: "system-ui" },
];

export function CmsTypographyControls({ lang, global, onChange }: { lang: Lang; global: BuilderConfig["global"]; onChange: (key: "fontFamily" | "fontUrl", value: string) => void }) {
  const [fonts, setFonts] = useState<FontAsset[]>([]);
  useEffect(() => {
    let active = true;
    void fetch("/api/uploads", { cache: "no-store" }).then((res) => res.json()).then((json) => {
      if (!active) return;
      setFonts((json.uploads ?? []).filter((asset: FontAsset) => asset.mime.startsWith("font/") || /\.(woff2?|ttf|otf)$/i.test(asset.filename)));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const selected = useMemo(() => fonts.find((font) => font.url === global.fontUrl), [fonts, global.fontUrl]);
  const chooseUploaded = (url: string) => {
    const font = fonts.find((item) => item.url === url);
    onChange("fontUrl", url);
    if (font) onChange("fontFamily", (font.title || font.filename.replace(/\.[^.]+$/, "")).trim());
  };

  return <div className="rounded-xl border border-border bg-background/50 p-4">
    <div className="mb-3 flex items-center gap-2"><Type className="size-4 text-[var(--ai-1)]"/><div><h4 className="text-sm font-semibold">{lang === "fa" ? "فونت رابط فارسی" : "English interface font"}</h4><p className="text-[10px] text-muted-foreground">{lang === "fa" ? "این تنظیم فقط روی نسخه فارسی اعمال می‌شود. فونت شخصی را ابتدا در Media Library آپلود کنید." : "This setting applies only to the English interface. Upload custom fonts in Media Library first."}</p></div></div>
    <div className="grid gap-3 md:grid-cols-3">
      <label className="space-y-1 text-xs"><span>{lang === "fa" ? "فونت آماده" : "Preset font"}</span><select value={global.fontUrl ? "custom" : global.fontFamily} onChange={(e) => { if (e.target.value !== "custom") { onChange("fontFamily", e.target.value); onChange("fontUrl", ""); } }} className="h-10 w-full rounded-md border border-border bg-background px-3"><option value="custom" disabled>{lang === "fa" ? "فونت شخصی" : "Custom font"}</option>{SYSTEM_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label>
      <label className="space-y-1 text-xs"><span>{lang === "fa" ? "فونت‌های آپلودشده" : "Uploaded fonts"}</span><select value={global.fontUrl || ""} onChange={(e) => chooseUploaded(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3"><option value="">{lang === "fa" ? "بدون فونت شخصی" : "No custom font"}</option>{fonts.map((font) => <option key={font.id} value={font.url}>{font.title || font.filename}</option>)}</select></label>
      <label className="space-y-1 text-xs"><span>{lang === "fa" ? "نام خانواده فونت" : "Font family name"}</span><Input value={global.fontFamily} onChange={(e) => onChange("fontFamily", e.target.value)} placeholder={lang === "fa" ? "مثلاً Vazirmatn" : "e.g. Inter"}/></label>
    </div>
    {global.fontUrl && <p className="mt-3 truncate rounded-lg bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">{selected?.filename || global.fontUrl}</p>}
    <p className="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-lg" style={{ fontFamily: global.fontFamily || "inherit" }}>{lang === "fa" ? "پیش‌نمایش فونت فارسی — هنر، امنیت و هوش" : "English font preview — Design, security and intelligence"}</p>
  </div>;
}
