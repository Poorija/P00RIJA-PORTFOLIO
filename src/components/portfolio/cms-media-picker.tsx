"use client";

import { useMemo, useState } from "react";
import { Check, Library, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Lang } from "@/lib/content-types";

type PickerAsset = { id: string; filename: string; title: string; mime: string; category: string; url: string };

export function CmsMediaPicker({ value, onChange, lang, accept, compact = false }: {
  value: string;
  onChange: (url: string) => void;
  lang: Lang;
  accept?: "image" | "video" | "audio" | "font" | "model" | "lottie" | "all";
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next || assets.length || loading) return;
    setLoading(true);
    void fetch("/api/uploads", { cache: "no-store" })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => { if (response.ok) setAssets(json.uploads ?? []); })
      .finally(() => setLoading(false));
  };

  const shown = useMemo(() => assets.filter((asset) => {
    const filename = asset.filename.toLowerCase();
    const matchesType = !accept || accept === "all"
      || (accept === "image" && asset.mime.startsWith("image/"))
      || (accept === "video" && asset.mime.startsWith("video/"))
      || (accept === "audio" && asset.mime.startsWith("audio/"))
      || (accept === "font" && (asset.mime.startsWith("font/") || /\.(woff2?|ttf|otf)$/i.test(filename)))
      || (accept === "model" && (asset.mime.startsWith("model/") || /\.(glb|gltf|obj|fbx)$/i.test(filename)))
      || (accept === "lottie" && /\.json$/i.test(filename));
    return matchesType && `${asset.filename} ${asset.title} ${asset.category}`.toLowerCase().includes(query.toLowerCase());
  }), [accept, assets, query]);

  return <>
    <Button
      type="button"
      size={compact ? "icon" : "sm"}
      variant="outline"
      onClick={() => handleOpenChange(true)}
      title={lang === "fa" ? "انتخاب از کتابخانه" : "Choose from library"}
    >
      <Library className="size-4" />
      {compact ? null : (lang === "fa" ? "کتابخانه" : "Library")}
    </Button>

    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[220] bg-black/70 backdrop-blur-sm"
        className="z-[221] flex max-h-[min(86dvh,820px)] w-[min(920px,calc(100vw-1rem))] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-[0_32px_100px_rgba(0,0,0,.65)]"
        dir={lang === "fa" ? "rtl" : "ltr"}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-4 text-start sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--ai-1)]/30 bg-[var(--ai-1)]/10 text-[var(--ai-1)]">
              <Library className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>{lang === "fa" ? "انتخاب از کتابخانه رسانه" : "Choose from Media Library"}</DialogTitle>
              <DialogDescription className="mt-1">
                {lang === "fa"
                  ? `${shown.length.toLocaleString("fa-IR")} رسانه سازگار برای این فیلد`
                  : `${shown.length.toLocaleString("en-US")} compatible media item${shown.length === 1 ? "" : "s"}`}
              </DialogDescription>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0"
              onClick={() => handleOpenChange(false)}
              aria-label={lang === "fa" ? "بستن" : "Close"}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 ps-10"
              placeholder={lang === "fa" ? "جستجو در نام، عنوان یا دسته‌بندی..." : "Search name, title, or category..."}
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {loading ? (
              <div className="col-span-full grid min-h-64 place-items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  {lang === "fa" ? "در حال دریافت رسانه‌ها..." : "Loading media..."}
                </div>
              </div>
            ) : shown.map((asset) => {
              const selectedUrl = accept === "model" ? `${asset.url}?filename=${encodeURIComponent(asset.filename)}` : asset.url;
              const selected = value === asset.url || value === selectedUrl;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => { onChange(selectedUrl); handleOpenChange(false); }}
                  className={`group relative min-w-0 overflow-hidden rounded-xl border bg-card/50 p-2 text-start transition duration-200 hover:-translate-y-0.5 hover:border-[var(--ai-1)] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ai-1)] ${selected ? "border-emerald-500/80 ring-1 ring-emerald-500/50" : "border-border/70"}`}
                >
                  <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-muted/30">
                    {asset.mime.startsWith("image/") ? (
                      <img src={asset.url} alt={asset.title || asset.filename} loading="lazy" className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.03]" />
                    ) : (
                      <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                        {asset.mime.split("/")[0]}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-xs font-medium" title={asset.title || asset.filename}>{asset.title || asset.filename}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{asset.category || asset.mime}</p>
                  {selected && (
                    <span className="absolute end-3 top-3 grid size-6 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
            {!loading && !shown.length && (
              <div className="col-span-full grid min-h-64 place-items-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 text-center">
                <div>
                  <Search className="mx-auto mb-3 size-7 text-muted-foreground/60" />
                  <p className="text-sm font-medium">{lang === "fa" ? "رسانه سازگار پیدا نشد" : "No compatible media found"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{lang === "fa" ? "عبارت جستجو را تغییر دهید یا از کتابخانه رسانه فایل جدیدی اضافه کنید." : "Try another search or add a new file in the Media Library."}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
