"use client";

/* ==================================================================
 * CMS forms for the two new built-in sections:
 *   - ProfileForm  — "about me" + résumé upload (POST /api/uploads)
 *   - TimelineForm — entries editor + visual style picker (12 styles)
 * ================================================================== */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContent } from "@/lib/content-store";
import { defaultContentFa, defaultContentEn } from "@/lib/default-content";
import type { TimelineStyle } from "@/lib/content-types";
import { cn } from "@/lib/utils";

/* ---------------- shared tiny field (kept local & simple) ---------------- */

const MINI_LABELS: Record<string, { fa: string; en: string }> = {
  index: { fa: "شماره", en: "Index" }, kicker: { fa: "پیش‌عنوان", en: "Kicker" }, Email: { fa: "ایمیل", en: "Email" },
  date: { fa: "تاریخ", en: "Date" }, "icon (emoji)": { fa: "آیکون (ایموجی)", en: "Icon (emoji)" }, color: { fa: "رنگ", en: "Color" },
  description: { fa: "توضیحات", en: "Description" }, "resumeUrl (external override)": { fa: "نشانی بیرونی رزومه", en: "Résumé URL (external override)" },
  URL: { fa: "نشانی فایل", en: "File URL" }, "Stream URL": { fa: "نشانی پخش زنده", en: "Stream URL" },
};

function miniLabel(label: string, lang: "fa" | "en") {
  return MINI_LABELS[label]?.[lang] ?? label;
}

function MiniField({
  label,
  value,
  onChange,
  dir,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl";
  type?: string;
}) {
  const lang = useContent((s) => s.lang);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{miniLabel(label, lang)}</span>
      <Input
        type={type}
        dir={dir}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 bg-background/60 text-sm"
      />
    </label>
  );
}

function MiniArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const lang = useContent((s) => s.lang);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{miniLabel(label, lang)}</span>
      <textarea
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}

/* =========================================================
   PROFILE FORM
   ========================================================= */

export function ProfileForm({ draft, setDraft }: { draft: any; setDraft: (v: any) => void }) {
  const lang = useContent((s) => s.lang);
  const defaults = lang === "fa" ? defaultContentFa.profile : defaultContentEn.profile;
  const v = { ...defaults, ...(draft ?? {}) };
  const set = (k: string, val: unknown) => setDraft({ ...v, [k]: val });
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const uploadResume = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.ok) {
        set("resumeUrl", json.url);
        toast.success(lang === "fa" ? `«${json.filename}» آپلود شد` : `Uploaded “${json.filename}”`);
      } else {
        toast.error(json.error || "Upload failed");
      }
    } catch {
      toast.error(lang === "fa" ? "خطا در آپلود" : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Upload failed");
      set("avatar", json.url);
      toast.success(lang === "fa" ? "تصویر پروفایل آپلود شد؛ حالا ذخیره کنید" : "Profile image uploaded; save to publish");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const setListItem = (key: "socials" | "skills" | "facts" | "stats" | "languages", index: number, field: string, value: unknown) => {
    const list = [...(v[key] ?? [])];
    list[index] = { ...list[index], [field]: value };
    set(key, list);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MiniField label={lang === "fa" ? "نام (name)" : "Name"} value={v.name} onChange={(x) => set("name", x)} />
        <MiniField label={lang === "fa" ? "نقش (role)" : "Role"} value={v.role} onChange={(x) => set("role", x)} />
        <div className="sm:col-span-2">
          <MiniField label={lang === "fa" ? "شعار (tagline)" : "Tagline"} value={v.tagline} onChange={(x) => set("tagline", x)} />
        </div>
        <div className="sm:col-span-2">
          <MiniArea
            label={lang === "fa" ? "بیوگرافی (bio) — هر خط یک پاراگراف" : "Bio — one paragraph per line"}
            value={v.bio}
            onChange={(x) => set("bio", x)}
            rows={6}
          />
        </div>
        <div className="sm:col-span-2 rounded-xl border border-border bg-background/35 p-4">
          <p className="mb-3 text-sm font-bold text-foreground">
            {lang === "fa" ? "درباره این برنامه" : "About this application"}
          </p>
          <div className="space-y-3">
            <MiniField label={lang === "fa" ? "عنوان معرفی برنامه" : "Application title"} value={v.projectTitle} onChange={(x) => set("projectTitle", x)} />
            <MiniArea label={lang === "fa" ? "توضیحات برنامه" : "Application description"} value={v.projectDescription} onChange={(x) => set("projectDescription", x)} rows={4} />
            <MiniArea
              label={lang === "fa" ? "ویژگی‌ها — هر خط یک مورد" : "Highlights — one item per line"}
              value={(v.projectFeatures ?? []).join("\n")}
              onChange={(x) => set("projectFeatures", x.split("\n").map((item) => item.trim()).filter(Boolean))}
              rows={4}
            />
          </div>
        </div>
        <div className="sm:col-span-2 rounded-xl border border-dashed border-border bg-background/40 p-4">
          <p className="mb-3 text-sm font-bold text-foreground">{lang === "fa" ? "تصویر شخصی یا لوگو" : "Photo or logo"}</p>
          <div className="flex flex-wrap items-center gap-3">
            {v.avatar ? <img src={v.avatar} alt="" className="h-20 w-20 rounded-full border border-border object-cover" /> : null}
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadAvatar(file);
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={avatarUploading} onClick={() => avatarFileRef.current?.click()}>
              {avatarUploading ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <FileUp className="me-1 h-3.5 w-3.5" />}
              {lang === "fa" ? "آپلود تصویر" : "Upload image"}
            </Button>
            {v.avatar ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => set("avatar", "")}>
                {lang === "fa" ? "بازگشت به خورشید" : "Use sun avatar"}
              </Button>
            ) : null}
          </div>
          <div className="mt-3">
            <MiniField label={lang === "fa" ? "یا URL تصویر" : "Or image URL"} value={v.avatar} onChange={(x) => set("avatar", x)} dir="ltr" />
          </div>
        </div>
        <MiniField label={lang === "fa" ? "موقعیت (location)" : "Location"} value={v.location} onChange={(x) => set("location", x)} />
        <MiniField label="Email" value={v.email} onChange={(x) => set("email", x)} dir="ltr" />
        <MiniField label={lang === "fa" ? "تلفن (phone)" : "Phone"} value={v.phone} onChange={(x) => set("phone", x)} dir="ltr" />
        <MiniField label={lang === "fa" ? "وضعیت همکاری (availability)" : "Availability"} value={v.availability} onChange={(x) => set("availability", x)} />
      </div>

      {/* résumé upload */}
      <div className="rounded-xl border border-dashed border-border bg-background/40 p-4">
        <p className="mb-3 text-sm font-bold text-foreground">
          {lang === "fa" ? "📄 رزومه (PDF)" : "📄 Résumé (PDF)"}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadResume(f);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <FileUp className="me-1 h-3.5 w-3.5" />}
            {lang === "fa" ? "آپلود فایل رزومه" : "Upload résumé file"}
          </Button>
          {v.resumeUrl ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500">
                <Check className="h-3 w-3" /> {lang === "fa" ? "آپلود شده" : "Uploaded"}
              </span>
              <a href={v.resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                {lang === "fa" ? "مشاهده" : "View"}
              </a>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {lang === "fa" ? "فایلی آپلود نشده — دکمه دانلود مخفی می‌ماند" : "No file yet — download button stays hidden"}
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MiniField label={lang === "fa" ? "برچسب دکمه دانلود (resumeLabel)" : "Download button label"} value={v.resumeLabel} onChange={(x) => set("resumeLabel", x)} />
          <MiniField label={lang === "fa" ? "توضیح کوچک (resumeHint)" : "Small hint"} value={v.resumeHint} onChange={(x) => set("resumeHint", x)} />
        </div>
        <div className="mt-2">
          <MiniField label="resumeUrl (external override)" value={v.resumeUrl} onChange={(x) => set("resumeUrl", x)} dir="ltr" />
        </div>
      </div>

      {/* stats */}
      <ListEditor
        title={lang === "fa" ? "آمارها (stats)" : "Stats"}
        items={v.stats ?? []}
        fields={[{ key: "value", label: "Value" }, { key: "label", label: "Label" }]}
        makeEmpty={() => ({ id: "st-" + Date.now(), value: "", label: "" })}
        onChange={(x) => set("stats", x)}
      />

      {/* skills */}
      <ListEditor
        title={lang === "fa" ? "مهارت‌ها (skills) — level از ۰ تا ۱۰۰" : "Skills — level 0-100"}
        items={v.skills ?? []}
        fields={[
          { key: "label", label: lang === "fa" ? "عنوان" : "Label" },
          { key: "level", label: "Level", type: "number" },
          { key: "color", label: "Color", type: "color" },
        ]}
        makeEmpty={() => ({ id: "sk-" + Date.now(), label: "", level: 70, color: "#4a8aff" })}
        onChange={(x) => set("skills", x)}
        onItemChange={setListItem.bind(null, "skills")}
      />

      {/* facts */}
      <ListEditor
        title={lang === "fa" ? "یک نگاه (facts)" : "At a glance (facts)"}
        items={v.facts ?? []}
        fields={[{ key: "key", label: lang === "fa" ? "عنوان" : "Key" }, { key: "value", label: lang === "fa" ? "مقدار" : "Value" }]}
        makeEmpty={() => ({ id: "f-" + Date.now(), key: "", value: "" })}
        onChange={(x) => set("facts", x)}
        onItemChange={setListItem.bind(null, "facts")}
      />

      {/* socials */}
      <ListEditor
        title={lang === "fa" ? "شبکه‌های اجتماعی (socials)" : "Socials"}
        items={v.socials ?? []}
        fields={[
          { key: "label", label: "Label" },
          { key: "url", label: "URL" },
          { key: "icon", label: "Icon: github/linkedin/mail/globe" },
        ]}
        makeEmpty={() => ({ id: "so-" + Date.now(), label: "", url: "https://", icon: "globe" })}
        onChange={(x) => set("socials", x)}
        onItemChange={setListItem.bind(null, "socials")}
      />

      {/* languages */}
      <ListEditor
        title={lang === "fa" ? "زبان‌ها (languages)" : "Languages"}
        items={v.languages ?? []}
        fields={[{ key: "name", label: "Name" }, { key: "level", label: "Level" }]}
        makeEmpty={() => ({ id: "l-" + Date.now(), name: "", level: "" })}
        onChange={(x) => set("languages", x)}
        onItemChange={setListItem.bind(null, "languages")}
      />

      <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
        <input type="checkbox" checked={v.enabled !== false} onChange={(e) => set("enabled", e.target.checked)} />
        {lang === "fa" ? "فعال — کلیک روی خورشید پروفایل را باز کند" : "Enabled — clicking the sun opens the profile"}
      </label>
    </div>
  );
}

/* =========================================================
   TIMELINE FORM
   ========================================================= */

const TIMELINE_STYLES: { id: TimelineStyle; fa: string; en: string; dim: string }[] = [
  { id: "orbit-path", fa: "مسیر مداری (عمودی)", en: "Orbit path (vertical)", dim: "2D" },
  { id: "alternating", fa: "کارت‌های زیگزاگ", en: "Alternating cards", dim: "2.5D" },
  { id: "horizontal-rail", fa: "ریل ماموریت (افقی)", en: "Mission rail (horizontal)", dim: "2.5D" },
  { id: "constellation", fa: "صورت فلکی", en: "Constellation", dim: "2D" },
  { id: "comet", fa: "دنباله‌دار", en: "Comet trail", dim: "2D" },
  { id: "mission-log", fa: "لاگ ماموریت", en: "Mission log", dim: "2D" },
  { id: "planet-hop", fa: "پرش سیاره‌ای", en: "Planet hop", dim: "3D" },
  { id: "spiral", fa: "کهکشان مارپیچ", en: "Spiral galaxy", dim: "3D" },
  { id: "radar-ring", fa: "رادار حلقوی", en: "Radar ring", dim: "2D" },
  { id: "warp-lane", fa: "خطوط وارپ", en: "Warp lanes", dim: "3D" },
  { id: "signal", fa: "سیگنال فضایی", en: "Deep-space signal", dim: "2D" },
  { id: "parallax-field", fa: "میدان پارالاکس", en: "Parallax field", dim: "2.5D" },
];

export function TimelineForm({ draft, setDraft }: { draft: any; setDraft: (v: any) => void }) {
  const lang = useContent((s) => s.lang);
  const defaults = lang === "fa" ? defaultContentFa.timeline : defaultContentEn.timeline;
  const v = { ...defaults, ...(draft ?? {}) };
  const set = (k: string, val: unknown) => setDraft({ ...v, [k]: val });

  const setEntry = (index: number, field: string, value: unknown) => {
    const entries = [...(v.entries ?? [])];
    entries[index] = { ...entries[index], [field]: value };
    set("entries", entries);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MiniField label="index" value={v.index} onChange={(x) => set("index", x)} />
        <MiniField label="kicker" value={v.kicker} onChange={(x) => set("kicker", x)} dir="ltr" />
        <MiniField label={lang === "fa" ? "عنوان (title)" : "Title"} value={v.title} onChange={(x) => set("title", x)} />
        <MiniField label={lang === "fa" ? "کلمه هایلایت (highlight)" : "Highlight"} value={v.highlight} onChange={(x) => set("highlight", x)} />
        <div className="sm:col-span-2">
          <MiniArea label={lang === "fa" ? "زیرعنوان (subtitle)" : "Subtitle"} value={v.subtitle} onChange={(x) => set("subtitle", x)} rows={3} />
        </div>
      </div>

      {/* style picker */}
      <div>
        <p className="mb-2 text-sm font-bold text-foreground">
          {lang === "fa" ? "🎨 استایل تایم‌لاین (۱۲ استایل فضایی)" : "🎨 Timeline style (12 space styles)"}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {TIMELINE_STYLES.map((s) => {
            const active = v.style === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => set("style", s.id)}
                className={cn(
                  "rounded-xl border p-3 text-start transition-all",
                  active ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:bg-surface-1"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{lang === "fa" ? s.fa : s.en}</span>
                  <span className="rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{s.dim}</span>
                </div>
                <StyleThumb id={s.id} active={active} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.showIcons} onChange={(e) => set("showIcons", e.target.checked)} />
          {lang === "fa" ? "نمایش آیکون‌ها" : "Show icons"}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.showFilter} onChange={(e) => set("showFilter", e.target.checked)} />
          {lang === "fa" ? "نمایش فیلتر نوع" : "Show kind filter"}
        </label>
      </div>

      {/* entries */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">
            {lang === "fa" ? "ایستگاه‌های مسیر (entries)" : "Journey entries"}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set("entries", [
                ...(v.entries ?? []),
                {
                  id: "tl-" + Date.now(),
                  date: "",
                  title: "",
                  org: "",
                  description: "",
                  tags: [],
                  icon: "🚀",
                  color: "#4a8aff",
                  kind: "job",
                },
              ])
            }
          >
            + {lang === "fa" ? "ایستگاه جدید" : "New entry"}
          </Button>
        </div>
        <div className="space-y-3">
          {(v.entries ?? []).map((entry: any, i: number) => (
            <div key={entry.id ?? i} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">#{i + 1} · {entry.id}</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (i === 0) return;
                    const entries = [...(v.entries ?? [])];
                    [entries[i - 1], entries[i]] = [entries[i], entries[i - 1]];
                    set("entries", entries);
                  }}>↑</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const entries = [...(v.entries ?? [])];
                    if (i === entries.length - 1) return;
                    [entries[i], entries[i + 1]] = [entries[i + 1], entries[i]];
                    set("entries", entries);
                  }}>↓</Button>
                  <Button size="sm" variant="ghost" onClick={() =>
                    set("entries", [...(v.entries ?? [])].map((e, j) => (j === i ? { ...e, id: "tl-" + Date.now() } : e)))
                  }>
                    <span title={lang === "fa" ? "داپلیکیت" : "Duplicate"}>⧉</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => set("entries", (v.entries ?? []).filter((_: any, j: number) => j !== i))}>
                    ✕
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MiniField label="date" value={entry.date ?? ""} onChange={(x) => setEntry(i, "date", x)} />
                <MiniField label={lang === "fa" ? "عنوان (title)" : "Title"} value={entry.title ?? ""} onChange={(x) => setEntry(i, "title", x)} />
                <MiniField label={lang === "fa" ? "مکان/سازمان (org)" : "Org"} value={entry.org ?? ""} onChange={(x) => setEntry(i, "org", x)} />
                <MiniField label="icon (emoji)" value={entry.icon ?? ""} onChange={(x) => setEntry(i, "icon", x)} />
                <MiniField label="color" type="color" value={entry.color ?? "#4a8aff"} onChange={(x) => setEntry(i, "color", x)} />
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">{lang === "fa" ? "نوع" : "Kind"}</span>
                  <select
                    value={entry.kind ?? "job"}
                    onChange={(e) => setEntry(i, "kind", e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background/60 px-2 text-sm"
                  >
                    <option value="job">{lang === "fa" ? "شغل" : "Job"}</option>
                    <option value="edu">{lang === "fa" ? "آموزش" : "Education"}</option>
                    <option value="project">{lang === "fa" ? "پروژه" : "Project"}</option>
                    <option value="award">{lang === "fa" ? "افتخار" : "Award"}</option>
                    <option value="milestone">{lang === "fa" ? "نقطه عطف" : "Milestone"}</option>
                  </select>
                </label>
                <div className="sm:col-span-2 lg:col-span-3">
                  <MiniArea label="description" value={entry.description ?? ""} onChange={(x) => setEntry(i, "description", x)} rows={2} />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <MiniField
                    label={lang === "fa" ? "تگ‌ها — با ویرگول جدا کنید" : "Tags — comma separated"}
                    value={(entry.tags ?? []).join(", ")}
                    onChange={(x) => setEntry(i, "tags", x.split(",").map((t) => t.trim()).filter(Boolean))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- mini list editor used by ProfileForm ---------------- */

function ListEditor({
  title,
  items,
  fields,
  makeEmpty,
  onChange,
  onItemChange,
}: {
  title: string;
  items: any[];
  fields: { key: string; label: string; type?: string }[];
  makeEmpty: () => any;
  onChange: (items: any[]) => void;
  onItemChange?: (index: number, field: string, value: unknown) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <Button size="sm" variant="outline" onClick={() => onChange([...(items ?? []), makeEmpty()])}>
          +
        </Button>
      </div>
      <div className="space-y-2">
        {(items ?? []).map((item, i) => (
          <div key={item.id ?? i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-background/40 p-2">
            {fields.map((f) => (
              <div key={f.key} className="min-w-32 flex-1">
                <MiniField
                  label={f.label}
                  type={f.type ?? "text"}
                  value={item[f.key] ?? ""}
                  onChange={(x) => {
                    if (onItemChange) {
                      onItemChange(i, f.key, f.type === "number" ? Number(x) || 0 : x);
                    } else {
                      const list = [...(items ?? [])];
                      list[i] = { ...list[i], [f.key]: f.type === "number" ? Number(x) || 0 : x };
                      onChange(list);
                    }
                  }}
                />
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => onChange((items ?? []).filter((_, j) => j !== i))}>
              ✕
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   MUSIC PLAYER FORM — tracks upload + Spotify + EQ + reactive
   ========================================================= */

export function MusicForm({ draft, setDraft }: { draft: any; setDraft: (v: any) => void }) {
  const lang = useContent((s) => s.lang);
  const defaults = lang === "fa" ? defaultContentFa.music : defaultContentEn.music;
  const v = { ...defaults, ...(draft ?? {}) };
  const set = (k: string, val: unknown) => setDraft({ ...v, [k]: val });
  const setVis = (k: string, val: unknown) => set("visualizer", { ...v.visualizer, [k]: val });
  const setEq = (k: string, val: unknown) => set("equalizer", { ...v.equalizer, [k]: val });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadTrack = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.ok) {
        const title = json.filename.replace(/\.[a-zA-Z0-9]+$/, "");
        set("tracks", [...(v.tracks ?? []), { id: "tr-" + Date.now(), title, artist: "", uploadUrl: json.url }]);
        toast.success(lang === "fa" ? `«${title}» اضافه شد` : `Added “${title}”`);
      } else {
        toast.error(json.error || "Upload failed");
      }
    } catch {
      toast.error(lang === "fa" ? "خطا در آپلود" : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setTrack = (index: number, field: string, value: string) => {
    const list = [...(v.tracks ?? [])];
    list[index] = { ...list[index], [field]: value };
    set("tracks", list);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
          <input type="checkbox" checked={v.enabled !== false} onChange={(e) => set("enabled", e.target.checked)} />
          {lang === "fa" ? "پلیر فعال باشد" : "Player enabled"}
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">{lang === "fa" ? "موقعیت (position): start/end" : "Position: start/end"}</span>
          <select
            value={v.position ?? "end"}
            onChange={(e) => set("position", e.target.value)}
            className="h-9 w-40 rounded-md border border-border bg-background/60 px-2 text-sm"
          >
            <option value="start">{lang === "fa" ? "گوشه پایین ابتدا" : "bottom-start"}</option>
            <option value="end">{lang === "fa" ? "گوشه پایین انتها" : "bottom-end"}</option>
          </select>
        </label>
        <MiniField label={lang === "fa" ? "صدای پیش‌فرض (0-100)" : "Default volume (0-100)"} value={v.defaultVolume ?? 70} onChange={(x) => set("defaultVolume", Number(x) || 0)} />
      </div>

      {/* tracks */}
      <div className="rounded-xl border border-dashed border-border bg-background/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">{lang === "fa" ? "🎵 آهنگ‌ها (MP3 آپلودی)" : "🎵 Uploaded tracks"}</p>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => {
                Array.from(e.target.files ?? []).forEach(uploadTrack);
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <FileUp className="me-1 h-3.5 w-3.5" />}
              {lang === "fa" ? "آپلود آهنگ" : "Upload music"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {(v.tracks ?? []).map((track: any, i: number) => (
            <div key={track.id ?? i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="min-w-32 flex-1">
                <MiniField label={lang === "fa" ? "عنوان" : "Title"} value={track.title ?? ""} onChange={(x) => setTrack(i, "title", x)} />
              </div>
              <div className="min-w-28 flex-1">
                <MiniField label={lang === "fa" ? "خواننده" : "Artist"} value={track.artist ?? ""} onChange={(x) => setTrack(i, "artist", x)} />
              </div>
              <div className="min-w-40 flex-[2]">
                <MiniField label="URL" value={track.uploadUrl ?? ""} onChange={(x) => setTrack(i, "uploadUrl", x)} dir="ltr" />
              </div>
              <Button size="sm" variant="ghost" onClick={() => set("tracks", (v.tracks ?? []).filter((_: any, j: number) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
          {!(v.tracks ?? []).length && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {lang === "fa" ? "هنوز آهنگی نیست — فایل MP3 آپلود کنید" : "No tracks yet — upload an MP3"}
            </p>
          )}
        </div>
      </div>

      {/* spotify */}
      <div className="rounded-xl border border-border bg-background/30 p-3">
        <p className="mb-2 text-sm font-bold text-foreground">🎧 Spotify</p>
        <MiniField
          label={lang === "fa" ? "لینک پلی‌لیست (مثل https://open.spotify.com/playlist/…)" : "Playlist URL (https://open.spotify.com/playlist/…)"}
          value={v.spotifyPlaylistUrl ?? ""}
          onChange={(x) => set("spotifyPlaylistUrl", x)}
          dir="ltr"
        />
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          {lang === "fa"
            ? "پخش کامل با Premium، وگرنه پیش‌نمایش ۳۰ ثانیه‌ای. مرورگر اجازه‌ی تحلیل مستقیم صدای Spotify را نمی‌دهد؛ بنابراین سیارات فقط با صدای واقعاً قابل‌تحلیل واکنش نشان می‌دهند و ریتم جعلی ساخته نمی‌شود."
            : "Full playback with Premium, otherwise 30s previews. Browsers do not expose Spotify audio for direct analysis, so planets react only to genuinely analyzable audio and no fake beat is generated."}
        </p>
      </div>

      {/* radio stations */}
      <div className="rounded-xl border border-border bg-background/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">🛰️ {lang === "fa" ? "رادیوی فضایی رایگان (استریم مستقیم)" : "Free space radio (direct streams)"}</p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={v.radio?.enabled !== false} onChange={(e) => set("radio", { ...(v.radio ?? { stations: [] }), enabled: e.target.checked })} />
            {lang === "fa" ? "فعال" : "Enabled"}
          </label>
        </div>
        <div className="space-y-2">
          {(v.radio?.stations ?? []).map((st: any, i: number) => (
            <div key={st.id ?? i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="min-w-36 flex-1">
                <MiniField label={lang === "fa" ? "نام ایستگاه" : "Station name"} value={st.name ?? ""} onChange={(x) => {
                  const list = [...(v.radio?.stations ?? [])];
                  list[i] = { ...list[i], name: x };
                  set("radio", { ...(v.radio ?? {}), stations: list });
                }} />
              </div>
              <div className="min-w-48 flex-[2]">
                <MiniField label="Stream URL" value={st.url ?? ""} dir="ltr" onChange={(x) => {
                  const list = [...(v.radio?.stations ?? [])];
                  list[i] = { ...list[i], url: x };
                  set("radio", { ...(v.radio ?? {}), stations: list });
                }} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => set("radio", { ...(v.radio ?? {}), stations: (v.radio?.stations ?? []).filter((_: any, j: number) => j !== i) })}>
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => set("radio", {
            ...(v.radio ?? { enabled: true }),
            stations: [...(v.radio?.stations ?? []), { id: "st-" + Date.now(), name: lang === "fa" ? "ایستگاه جدید" : "New station", url: "" }],
          })}
        >
          + {lang === "fa" ? "ایستگاه" : "Station"}
        </Button>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          {lang === "fa"
            ? "۴ ایستگاه فضایی رایگان SomaFM از قبل تنظیم شده (پخش کامل و بی‌پایان، بدون حساب). هر استریم MP3/AAC مستقیم دیگری هم کار می‌کند."
            : "Four free SomaFM space stations are preconfigured (endless full playback, no account). Any other direct MP3/AAC stream URL works too."}
        </p>
      </div>

      {/* visualizer + reactive */}
      <div className="rounded-xl border border-border bg-background/30 p-3">
        <p className="mb-2 text-sm font-bold text-foreground">{lang === "fa" ? "🌈 ویژوالایزر و رقص سیارات" : "🌈 Visualizer & reactive planets"}</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.visualizer?.enabled !== false} onChange={(e) => setVis("enabled", e.target.checked)} />
            {lang === "fa" ? "ویژوالایزر" : "Visualizer"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.visualizer?.reactive3d !== false} onChange={(e) => setVis("reactive3d", e.target.checked)} />
            {lang === "fa" ? "🪐 سیارات و آبجکت‌ها با ریتم برقصند" : "🪐 Planets & objects dance to the rhythm"}
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">{lang === "fa" ? "استایل: bars / orbit / wave" : "Style: bars / orbit / wave"}</span>
            <select
              value={v.visualizer?.style ?? "orbit"}
              onChange={(e) => setVis("style", e.target.value)}
              className="h-9 w-36 rounded-md border border-border bg-background/60 px-2 text-sm"
            >
              <option value="bars">{lang === "fa" ? "میله‌ای" : "Bars"}</option>
              <option value="orbit">{lang === "fa" ? "مداری سه‌بعدی" : "3D orbit"}</option>
              <option value="wave">{lang === "fa" ? "موج" : "Wave"}</option>
            </select>
          </label>
          <MiniField label={lang === "fa" ? "حساسیت (0.2-3)" : "Sensitivity (0.2-3)"} value={v.visualizer?.sensitivity ?? 1} onChange={(x) => setVis("sensitivity", Number(x) || 1)} />
          <MiniField label={lang === "fa" ? "دامنه‌ی حرکت رقص (0-3)" : "Dance amplitude (0-3)"} value={v.visualizer?.danceAmplitude ?? 1} onChange={(x) => setVis("danceAmplitude", Number(x) || 0)} />
        </div>
      </div>

      {/* equalizer */}
      <div className="rounded-xl border border-border bg-background/30 p-3">
        <p className="mb-2 text-sm font-bold text-foreground">🎚️ {lang === "fa" ? "اکولایزر ۱۰ باند" : "10-band equalizer"}</p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.equalizer?.enabled !== false} onChange={(e) => setEq("enabled", e.target.checked)} />
            {lang === "fa" ? "فعال" : "Enabled"}
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">{lang === "fa" ? "پیش‌تنظیم" : "Preset"}</span>
            <select
              value={v.equalizer?.preset ?? "flat"}
              onChange={(e) => setEq("preset", e.target.value)}
              className="h-9 w-32 rounded-md border border-border bg-background/60 px-2 text-sm"
            >
              {["flat", "bass", "vocal", "space", "custom"].map((p) => (
                <option key={p} value={p}>{lang === "fa" ? ({ flat: "تخت", bass: "بیس", vocal: "صدای خواننده", space: "فضایی", custom: "سفارشی" } as Record<string, string>)[p] : p}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {["60", "170", "310", "600", "1k", "3k", "6k", "12k", "14k", "16k"].map((label, i) => (
            <MiniField
              key={label}
              label={label}
              value={v.equalizer?.bands?.[i] ?? 0}
              onChange={(x) => {
                const bands = [...(v.equalizer?.bands ?? Array(10).fill(0))];
                bands[i] = Number(x) || 0;
                setEq("bands", bands);
              }}
            />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {lang === "fa" ? "هر باند -۱۲ تا +۱۲ دسی‌بل. preset غیر از custom مقادیر این فیلدها را بازنویسی می‌کند." : "Each band -12..+12 dB. Non-custom presets override these values."}
        </p>
      </div>
    </div>
  );
}

/* ---------------- style thumbnails ---------------- */

function StyleThumb({ id, active }: { id: TimelineStyle; active: boolean }) {
  const stroke = active ? "var(--primary)" : "var(--muted-foreground)";
  const common = { stroke, fill: "none", strokeWidth: 1.4, opacity: 0.85 };
  return (
    <svg viewBox="0 0 96 34" className="mt-2 h-9 w-full">
      {id === "orbit-path" && (
        <>
          <line x1="12" y1="4" x2="12" y2="30" {...common} />
          {[8, 17, 26].map((y) => (
            <circle key={y} cx="12" cy={y} r="2.6" fill={stroke} />
          ))}
        </>
      )}
      {id === "alternating" && (
        <>
          <line x1="48" y1="4" x2="48" y2="30" {...common} strokeDasharray="2 3" />
          {[8, 17, 26].map((y, i) => (
            <rect key={y} x={i % 2 ? 54 : 10} y={y - 3} width="32" height="7" rx="2" fill="none" stroke={stroke} />
          ))}
        </>
      )}
      {id === "horizontal-rail" && (
        <>
          <line x1="4" y1="17" x2="92" y2="17" {...common} />
          {[16, 38, 60, 82].map((x) => (
            <circle key={x} cx={x} cy="17" r="2.6" fill={stroke} />
          ))}
        </>
      )}
      {id === "constellation" && (
        <>
          <polyline points="10,26 30,10 52,24 70,8 86,22" {...common} />
          {[[10, 26], [30, 10], [52, 24], [70, 8], [86, 22]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2" fill={stroke} />
          ))}
        </>
      )}
      {id === "comet" && (
        <>
          <circle cx="82" cy="10" r="3" fill={stroke} />
          <path d="M82 10 Q 50 14, 30 20 T 8 28" {...common} strokeDasharray="1 3" />
        </>
      )}
      {id === "mission-log" && (
        <>
          {[8, 14, 20, 26].map((y) => (
            <g key={y}>
              <line x1="8" y1={y} x2="14" y2={y} {...common} />
              <line x1="17" y1={y} x2={y === 20 ? 60 : 84} y2={y} {...common} opacity={0.4} />
            </g>
          ))}
        </>
      )}
      {id === "planet-hop" &&
        [[14, 5], [38, 8], [62, 5], [86, 8]].map(([x, r], i) => (
          <circle key={i} cx={x} cy="20" r={r} fill="none" stroke={stroke} />
        ))}
      {id === "spiral" && (
        <path d="M48 17 m0 0 a3 3 0 1 1 6 0 a6 6 0 1 1 -12 0 a9 9 0 1 1 18 0 a13 13 0 1 1 -26 0" {...common} transform="translate(-8 0)" />
      )}
      {id === "radar-ring" && (
        <>
          <circle cx="48" cy="17" r="12" fill="none" stroke={stroke} opacity={0.4} />
          <circle cx="48" cy="17" r="6.5" fill="none" stroke={stroke} opacity={0.6} />
          <circle cx="48" cy="17" r="1.6" fill={stroke} />
          <line x1="48" y1="17" x2="59" y2="9" {...common} />
        </>
      )}
      {id === "warp-lane" &&
        [10, 30, 50, 70].map((x, i) => (
          <line key={i} x1={x} y1="30" x2="48" y2="4" {...common} opacity={0.5 + i * 0.1} />
        ))}
      {id === "signal" && (
        <>
          <line x1="4" y1="17" x2="92" y2="17" {...common} opacity={0.5} />
          <polyline points="20,17 26,10 32,24 38,17 56,17 62,8 68,26 74,17" {...common} />
        </>
      )}
      {id === "parallax-field" &&
        [[12, 8], [40, 16], [68, 9]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="22" height="13" rx="3" fill="none" stroke={stroke} opacity={0.5 + i * 0.2} />
        ))}
    </svg>
  );
}
