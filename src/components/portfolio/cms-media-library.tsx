"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, File, FileUp, FolderCog, Image as ImageIcon, Loader2, Pencil, Play, RefreshCw, Scissors, SlidersHorizontal, Tags, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_LIBRARY_ICONS, isFaIcon } from "@/lib/icon-library";
import { Media3DPreview } from "./media-3d-preview";
import type { Lang } from "@/lib/content-types";

type Asset = { id: string; filename: string; title: string; altText: string; category: string; tags: string[]; mime: string; size: number; url: string; createdAt: string };
type AssetDraft = Pick<Asset, "filename" | "title" | "altText" | "category" | "tags">;
type MediaTransform = { width: number; height: number; cropLeft: number; cropTop: number; cropWidth: number; cropHeight: number; rotate: number; grayscale: boolean; blur: number; brightness: number; saturation: number; format: string; quality: number; start: number; duration: number };

function LottiePreview({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let animation: { destroy(): void } | undefined;
    let cancelled = false;
    void Promise.all([import("lottie-web"), fetch(url).then((res) => res.json())]).then(([module, data]) => {
      if (cancelled || !host.current) return;
      animation = module.default.loadAnimation({ container: host.current, renderer: "svg", loop: true, autoplay: true, animationData: data });
    }).catch(() => undefined);
    return () => { cancelled = true; animation?.destroy(); };
  }, [url]);
  return <div ref={host} className="h-32 w-full" />;
}

function AssetPreview({ asset }: { asset: Asset }) {
  if (asset.mime.startsWith("image/")) return <img src={asset.url} alt={asset.filename} loading="lazy" className="h-36 w-full rounded-lg bg-black/20 object-contain" />;
  if (asset.mime.startsWith("video/")) return <video src={asset.url} controls preload="metadata" className="h-36 w-full rounded-lg bg-black object-contain" />;
  if (asset.mime.startsWith("audio/")) return <div className="flex h-36 items-center"><audio src={asset.url} controls preload="metadata" className="w-full" /></div>;
  if (asset.mime === "application/json" || asset.filename.toLowerCase().endsWith(".json")) return <LottiePreview url={asset.url} />;
  if (asset.mime.startsWith("font/")) return <div className="flex h-36 items-center justify-center text-4xl">Aa آب</div>;
  if (asset.mime.startsWith("model/") || /\.(glb|gltf|obj|fbx)$/i.test(asset.filename)) return <Media3DPreview url={asset.url} filename={asset.filename} className="h-36 w-full"/>;
  return <div className="flex h-36 items-center justify-center"><File className="size-12 text-muted-foreground" /></div>;
}

export function CmsMediaLibrary({ lang }: { lang: Lang }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"media" | "icons" | "fonts" | "categories">("media");
  const [category, setCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("Uncategorized");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AssetDraft | null>(null);
  const [transforming, setTransforming] = useState<Asset | null>(null);
  const [transform, setTransform] = useState({ width: 0, height: 0, cropLeft: 0, cropTop: 0, cropWidth: 0, cropHeight: 0, rotate: 0, grayscale: false, blur: 0, brightness: 1, saturation: 1, format: "webp", quality: 92, start: 0, duration: 10 });
  const input = useRef<HTMLInputElement>(null);
  const iconInput = useRef<HTMLInputElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const load = async () => {
    setBusy(true);
    try { const res = await fetch("/api/uploads", { cache: "no-store" }); const json = await res.json(); if (!res.ok) throw new Error(json.error); setAssets(json.uploads ?? []); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Load failed"); }
    finally { setBusy(false); }
  };
  useEffect(() => { const id = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(id); }, []);
  const upload = async (files: FileList, categoryOverride?: string) => {
    setBusy(true);
    try {
      for (const file of Array.from(files)) { const body = new FormData(); body.append("file", file); body.append("category", categoryOverride || uploadCategory); const res = await fetch("/api/uploads", { method: "POST", body }); const json = await res.json(); if (!res.ok) throw new Error(json.error); }
      await load(); toast.success(lang === "fa" ? "رسانه‌ها اضافه شدند" : "Media added");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); } finally { setBusy(false); if (input.current) input.current.value = ""; if (iconInput.current) iconInput.current.value = ""; if (fontInput.current) fontInput.current.value = ""; }
  };
  const convert = async (asset: Asset) => {
    setBusy(true); const res = await fetch(`/api/uploads/${asset.id}/webp`, { method: "POST" }); const json = await res.json(); setBusy(false);
    if (!res.ok) return toast.error(json.error || "Conversion failed");
    await load(); toast.success(lang === "fa" ? `نسخه Lossless WebP جایگزین شد (${Math.round((json.savedBytes || 0) / 1024)}KB کمتر)` : `Lossless WebP replaced the original (${Math.round((json.savedBytes || 0) / 1024)}KB saved)`);
  };
  const remove = async (asset: Asset) => {
    if (!window.confirm(lang === "fa" ? `«${asset.title || asset.filename}» حذف شود؟` : `Delete “${asset.title || asset.filename}”?`)) return;
    const res = await fetch(`/api/uploads/${asset.id}`, { method: "DELETE" }); const json = await res.json(); if (!res.ok) return toast.error(json.error); await load();
  };
  const beginEdit = (asset: Asset) => { setEditing(asset.id); setEditDraft({ filename: asset.filename, title: asset.title || "", altText: asset.altText || "", category: asset.category || "Uncategorized", tags: asset.tags || [] }); };
  const saveEdit = async (asset: Asset) => {
    if (!editDraft) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/uploads/${asset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editDraft) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error);
      setEditing(null); setEditDraft(null); await load(); toast.success(lang === "fa" ? "مشخصات رسانه ذخیره شد" : "Media details saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Update failed"); } finally { setBusy(false); }
  };
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); toast.success(lang === "fa" ? "کپی شد" : "Copied"); };
  const applyTransform = async () => {
    if (!transforming || !window.confirm(lang === "fa" ? "نسخه ویرایش‌شده جایگزین فایل فعلی شود؟ همه ارجاع‌های CMS خودکار به‌روزرسانی می‌شوند." : "Replace the current file with the edited version? All CMS references update automatically.")) return;
    setBusy(true); try { const res = await fetch(`/api/uploads/${transforming.id}/edit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(transform) }); const json = await res.json(); if (!res.ok) throw new Error(json.error); setTransforming(null); await load(); toast.success(lang === "fa" ? "ویرایش اعمال شد" : "Edit applied"); } catch (error) { toast.error(error instanceof Error ? error.message : "Edit failed"); } finally { setBusy(false); }
  };
  const renameCategory = async (from: string) => {
    const to = window.prompt(lang === "fa" ? "نام جدید یا نام دسته مقصد برای ادغام" : "New name or target category to merge into", from)?.trim(); if (!to || to === from) return;
    const res = await fetch("/api/uploads/categories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to }) }); const json = await res.json(); if (!res.ok) return toast.error(json.error); await load(); toast.success(lang === "fa" ? "دسته تغییر نام/ادغام شد" : "Category renamed/merged");
  };
  const deleteCategory = async (name: string) => {
    if (!window.confirm(lang === "fa" ? `دسته «${name}» حذف و فایل‌ها به Uncategorized منتقل شوند؟` : `Delete “${name}” and move its files to Uncategorized?`)) return;
    const res = await fetch("/api/uploads/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: name }) }); const json = await res.json(); if (!res.ok) return toast.error(json.error); setCategory("all"); await load();
  };
  const categories = Array.from(new Set(assets.map((asset) => asset.category || "Uncategorized"))).sort();
  const shown = assets.filter((asset) => (category === "all" || asset.category === category) && `${asset.filename} ${asset.title} ${asset.altText} ${asset.category} ${asset.tags.join(" ")} ${asset.mime}`.toLowerCase().includes(query.toLowerCase()));
  const icons = ALL_LIBRARY_ICONS.filter((icon) => icon.key.toLowerCase().includes(query.toLowerCase())).slice(0, 240);
  const customIcons = assets.filter((asset) => (asset.mime === "image/svg+xml" || asset.category === "Custom Icons") && `${asset.filename} ${asset.title}`.toLowerCase().includes(query.toLowerCase()));
  const fonts = assets.filter((asset) => (asset.mime.startsWith("font/") || /\.(woff2?|ttf|otf)$/i.test(asset.filename)) && `${asset.filename} ${asset.title}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="space-y-4">
    <div className="rounded-2xl border bg-gradient-to-r from-[var(--gfx-1)]/10 via-[var(--ai-1)]/10 to-[var(--sec-1)]/10 p-4">
      <div className="flex flex-wrap items-center gap-2"><div className="me-auto"><h3 className="font-bold">{lang === "fa" ? "کتابخانه جهانی رسانه" : "Universal Media Library"}</h3><p className="text-xs text-muted-foreground">{lang === "fa" ? "تصویر، ویدیو، صوت، سند، فونت، آیکون، Lottie و مدل سه‌بعدی؛ هر مورد در تمام CMS قابل استفاده است." : "Images, video, audio, documents, fonts, icons, Lottie and 3D models; every item works across the CMS."}</p></div><Button variant={tab === "media" ? "default" : "outline"} onClick={() => setTab("media")}><ImageIcon className="size-4" />Media</Button><Button variant={tab === "icons" ? "default" : "outline"} onClick={() => setTab("icons")}><i className="fa-solid fa-icons" />{lang === "fa" ? "آیکون‌ها" : "Icons"}</Button><Button variant={tab === "fonts" ? "default" : "outline"} onClick={() => setTab("fonts")}><Type className="size-4" />{lang === "fa" ? "فونت‌ها" : "Fonts"}</Button><Button variant={tab === "categories" ? "default" : "outline"} onClick={() => setTab("categories")}><FolderCog className="size-4"/>{lang === "fa" ? "دسته‌ها" : "Categories"}</Button></div>
      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px_auto_auto]">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={lang === "fa" ? "جستجو در نام، دسته و تگ..." : "Search name, category or tag..."} />
        {tab === "media" && <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm"><option value="all">{lang === "fa" ? "همه دسته‌ها" : "All categories"}</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>}
        <Button variant="outline" size="icon" onClick={() => void load()}><RefreshCw className={busy ? "size-4 animate-spin" : "size-4"}/></Button>
        {tab === "media" && <><input ref={input} type="file" multiple className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} /><Button disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin"/> : <FileUp className="size-4"/>}{lang === "fa" ? "آپلود" : "Upload"}</Button></>}
        {tab === "icons" && <><input ref={iconInput} type="file" accept="image/svg+xml,image/png,image/webp,image/jpeg" multiple className="hidden" onChange={(e) => e.target.files && void upload(e.target.files, "Custom Icons")} /><Button disabled={busy} onClick={() => iconInput.current?.click()}><FileUp className="size-4"/>{lang === "fa" ? "آپلود آیکون سفارشی" : "Upload custom icon"}</Button></>}
        {tab === "fonts" && <><input ref={fontInput} type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" multiple className="hidden" onChange={(e) => e.target.files && void upload(e.target.files, "Custom Fonts")} /><Button disabled={busy} onClick={() => fontInput.current?.click()}><FileUp className="size-4"/>{lang === "fa" ? "آپلود فونت" : "Upload font"}</Button></>}
      </div>
      {tab === "media" && <div className="mt-2 flex items-center gap-2"><Tags className="size-4 text-muted-foreground"/><Input value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} placeholder={lang === "fa" ? "دسته آپلود جدید" : "New upload category"} className="max-w-xs"/><span className="text-[10px] text-muted-foreground">{lang === "fa" ? "برای ساخت دسته جدید، نام دلخواه بنویسید." : "Type any name to create a category."}</span></div>}
    </div>
    {transforming && <MediaEditor asset={transforming} lang={lang} value={transform} onChange={setTransform} busy={busy} onClose={() => setTransforming(null)} onApply={() => void applyTransform()}/>} 
    {tab === "icons" ? <div className="space-y-4">{customIcons.length > 0 && <section><h4 className="mb-2 text-sm font-semibold">{lang === "fa" ? "آیکون‌های سفارشی" : "Custom icons"}</h4><div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-10">{customIcons.map((asset) => <button key={asset.id} onClick={() => void copy(`media:${asset.url}`)} title={asset.title || asset.filename} className="rounded-xl border p-3 text-center hover:border-[var(--ai-1)]"><img src={asset.url} alt="" className="mx-auto size-7 object-contain"/><span className="mt-2 block truncate text-[9px] text-muted-foreground">{asset.title || asset.filename}</span></button>)}</div></section>}<section><h4 className="mb-2 text-sm font-semibold">Font Awesome</h4><div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-10">{icons.map((icon) => <button key={icon.key} onClick={() => void copy(icon.key)} title={icon.label} className="rounded-xl border p-3 text-center hover:border-[var(--ai-1)]"><i className={isFaIcon(icon.key) ? `fa-solid ${icon.fa || icon.key}` : "fa-solid fa-icons"}/><span className="mt-2 block truncate text-[9px] text-muted-foreground">{icon.key}</span></button>)}</div></section></div> : tab === "fonts" ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fonts.map((asset) => { const family = `cms-font-${asset.id.replace(/[^a-zA-Z0-9_-]/g, "")}`; return <article key={asset.id} className="rounded-2xl border bg-background/50 p-4"><style>{`@font-face{font-family:'${family}';src:url('${asset.url}');font-display:swap}`}</style><p className="text-xs text-muted-foreground">{asset.title || asset.filename}</p><p className="my-4 text-center text-2xl" style={{ fontFamily: family }}>Aa — هنر و هوش</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void copy(asset.url)}><Copy className="size-3"/>{lang === "fa" ? "کپی URL" : "Copy URL"}</Button><Button size="sm" variant="ghost" className="ms-auto text-destructive" onClick={() => void remove(asset)}><Trash2 className="size-4"/></Button></div></article>; })}{!fonts.length && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{lang === "fa" ? "هنوز فونتی آپلود نشده است." : "No custom fonts uploaded yet."}</p>}</div> : tab === "categories" ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{categories.map((name) => <div key={name} className="flex items-center gap-2 rounded-xl border p-3"><FolderCog className="size-4"/><span className="min-w-0 flex-1 truncate text-sm">{name}</span><span className="text-[10px] text-muted-foreground">{assets.filter((asset) => asset.category === name).length}</span><Button size="icon" variant="ghost" onClick={() => void renameCategory(name)}><Pencil className="size-4"/></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteCategory(name)}><Trash2 className="size-4"/></Button></div>)}</div> :
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((asset) => <article key={asset.id} className="rounded-2xl border bg-background/50 p-3"><AssetPreview asset={asset}/>{editing === asset.id && editDraft ? <div className="mt-3 space-y-2 rounded-xl border bg-background/80 p-3"><Input value={editDraft.filename} onChange={(e) => setEditDraft({ ...editDraft, filename: e.target.value })} placeholder={lang === "fa" ? "نام فایل" : "Filename"}/><Input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} placeholder={lang === "fa" ? "عنوان نمایشی" : "Display title"}/><Input value={editDraft.altText} onChange={(e) => setEditDraft({ ...editDraft, altText: e.target.value })} placeholder={lang === "fa" ? "متن جایگزین / توضیح" : "Alt text / description"}/><Input value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} placeholder={lang === "fa" ? "دسته" : "Category"}/><Input value={editDraft.tags.join(", ")} onChange={(e) => setEditDraft({ ...editDraft, tags: e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} placeholder={lang === "fa" ? "تگ‌ها با کاما" : "Comma-separated tags"}/><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => { setEditing(null); setEditDraft(null); }}><X className="size-4"/>{lang === "fa" ? "لغو" : "Cancel"}</Button><Button size="sm" onClick={() => void saveEdit(asset)}><Check className="size-4"/>{lang === "fa" ? "ذخیره" : "Save"}</Button></div></div> : <><div className="mt-3 flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{asset.title || asset.filename}</p><p className="truncate text-[10px] text-muted-foreground">{asset.filename} · {asset.mime} · {(asset.size / 1024).toFixed(1)} KB</p><div className="mt-1 flex flex-wrap gap-1"><span className="rounded-full border px-2 py-0.5 text-[9px]">{asset.category || "Uncategorized"}</span>{asset.tags.slice(0,4).map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[9px]">#{tag}</span>)}</div></div><Button size="icon" variant="ghost" onClick={() => beginEdit(asset)}><Pencil className="size-4"/></Button><Button size="icon" variant="ghost" onClick={() => void copy(asset.url)}><Copy className="size-4"/></Button><Button size="icon" variant="ghost" onClick={() => window.open(asset.url, "_blank")}><Play className="size-4"/></Button></div><div className="mt-2 flex gap-2">{(asset.mime.startsWith("image/") || asset.mime.startsWith("video/") || asset.mime.startsWith("audio/")) && asset.mime !== "image/svg+xml" && <Button size="sm" variant="outline" onClick={() => setTransforming(asset)}>{asset.mime.startsWith("image/") ? <SlidersHorizontal className="size-3"/> : <Scissors className="size-3"/>}{lang === "fa" ? "ویرایش" : "Edit"}</Button>}{asset.mime.startsWith("image/") && asset.mime !== "image/webp" && asset.mime !== "image/svg+xml" && <Button size="sm" variant="outline" onClick={() => void convert(asset)}>Lossless WebP</Button>}<Button size="sm" variant="ghost" className="ms-auto text-destructive" onClick={() => void remove(asset)}><Trash2 className="size-4"/></Button></div></>}</article>)}</div>}
  </div>;
}

function MediaEditor({ asset, lang, value, onChange, busy, onClose, onApply }: { asset: Asset; lang: Lang; value: MediaTransform; onChange: (next: MediaTransform) => void; busy: boolean; onClose: () => void; onApply: () => void }) {
  const numeric = (key: keyof MediaTransform, label: string, step = 1) => <label className="space-y-1 text-[10px] text-muted-foreground"><span>{label}</span><Input type="number" step={step} value={String(value[key])} onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })} className="h-8 text-xs"/></label>;
  const image = asset.mime.startsWith("image/");
  return <div className="rounded-2xl border border-[var(--ai-1)]/30 bg-background/80 p-4"><div className="flex items-center gap-2"><h4 className="me-auto font-bold">{lang === "fa" ? "ویرایش غیرمخرب رسانه" : "Non-destructive media editor"} · {asset.filename}</h4><Button size="icon" variant="ghost" onClick={onClose}><X className="size-4"/></Button></div><div className="mt-3 grid gap-4 lg:grid-cols-[280px_1fr]"><AssetPreview asset={asset}/><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{image ? <>{numeric("width", "Width (0=auto)")}{numeric("height", "Height (0=auto)")}{numeric("cropLeft", "Crop left")}{numeric("cropTop", "Crop top")}{numeric("cropWidth", "Crop width (0=auto)")}{numeric("cropHeight", "Crop height (0=auto)")}{numeric("rotate", "Rotate")}{numeric("blur", "Blur", .1)}{numeric("brightness", "Brightness", .05)}{numeric("saturation", "Saturation", .05)}<label className="space-y-1 text-[10px] text-muted-foreground"><span>Format</span><select value={String(value.format)} onChange={(event) => onChange({ ...value, format: event.target.value })} className="h-8 w-full rounded border bg-background px-2"><option>webp</option><option>jpeg</option><option>png</option></select></label>{numeric("quality", "Quality")}<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(value.grayscale)} onChange={(event) => onChange({ ...value, grayscale: event.target.checked })}/>Grayscale</label></> : <>{numeric("start", lang === "fa" ? "شروع (ثانیه)" : "Start seconds", .1)}{numeric("duration", lang === "fa" ? "مدت (ثانیه)" : "Duration seconds", .1)}</>}</div></div><div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{lang === "fa" ? "لغو" : "Cancel"}</Button><Button disabled={busy} onClick={onApply}>{busy && <Loader2 className="size-4 animate-spin"/>}{lang === "fa" ? "اعمال و جایگزینی" : "Apply and replace"}</Button></div></div>;
}
