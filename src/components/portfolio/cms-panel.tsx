"use client";

/* ==================================================================
 * CmsPanel — bilingual (fa/en) full-screen content editor.
 *
 * - Auth-gated: renders nothing unless `authed && authChecked`.
 * - Language tab: switches `lang` between "fa" and "en"; the draft
 *   reloads from the active language's section.
 * - Covers EVERY field of every built-in section, including
 *   hero.planets, graphics.gallery, security.game and ai.game blocks.
 * - CUSTOM SECTIONS: create, duplicate (from built-in or custom),
 *   delete (custom only), rename, change icon. Persisted in DB as
 *   `custom-<ts>` rows. Generic shape { title, subtitle, body, items[] }
 *   with free-form key/value items for true point-by-point editing.
 * - RAW JSON EDITOR: toggle on any section to edit the raw JSON of the
 *   active language's data directly (power-user escape hatch).
 * - FIELD-LEVEL RESET: built-in sections show a small reset arrow next
 *   to any field whose value diverges from the default.
 * - Sidebar with search/filter, section navigation, active highlight,
 *   and built-in / custom groups with a "+ New section" button.
 * - Save / Reset (with inline confirm) / Logout / Duplicate / Delete
 *   actions. Status footer with section key, language, last-saved, auth.
 * - Theme-aware (semantic tokens only), RTL-aware, escape to close,
 *   body scroll lock, AnimatePresence transitions.
 * ================================================================== */

import { useEffect, useMemo, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Home,
  Palette,
  ShieldCheck,
  Brain,
  Download,
  Sparkles,
  Mail,
  X,
  Plus,
  Trash2,
  Frame,
  Save,
  Loader2,
  LogOut,
  Search,
  RotateCcw,
  RefreshCw,
  Upload,
  Copy,
  FileText,
  Star,
  Tag,
  Box,
  Heart,
  Settings,
  Braces,
  AlertCircle,
  Check,
  BadgeCheck,
  Pencil,
  MousePointer2,
  Workflow,
  FormInput,
  SlidersHorizontal,
  Gamepad2,
  ArrowUp,
  ArrowDown,
  History,
  User,
  Music,
  FileUp,
  DatabaseBackup,
  KeyRound,
  Lock,
  LockKeyhole,
  Library,
  BarChart3,
  ShieldAlert,
  Smartphone,
  Bot,
  Compass,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { ALL_LIBRARY_ICONS, customMediaIconUrl, isFaIcon } from "@/lib/icon-library";
import { useContent } from "@/lib/content-store";
import { worldOrder } from "@/lib/section-order";
import type { BuilderConfig, Error404Config, FormBuilderConfig, Lang, PlanetConfig, PlanetViewConfig, SceneObject3DConfig, SectionKey, SiteContent } from "@/lib/content-types";
import { defaultContentFa, defaultContentEn } from "@/lib/default-content";
import { cn } from "@/lib/utils";
import { DEFAULT_PLANET_VIEW, PlanetScenePreview } from "./planetary-hero";
import { SectionsManager, makePlanetForSection } from "./cms-sections-manager";
import { ProfileForm, TimelineForm, MusicForm } from "./cms-extra-forms";
import { DeveloperCard } from "./developer-card";
import { MigrationCenter } from "./migration-center";
import { CmsSectionResponsiveControls, CmsViewportToolbar, type CmsViewportMode } from "./cms-responsive-studio";
import { CmsTypographyControls } from "./cms-typography-controls";
import { CmsMediaLibrary } from "./cms-media-library";
import { CmsMediaPicker } from "./cms-media-picker";
import { CmsAnalyticsCenter } from "./cms-analytics-center";
import { suspendLenis } from "./smooth-scroll";
import { APP_VERSION } from "@/lib/app-version";
import { CmsDefenseCenter } from "./cms-defense-center";
import { CmsVisualBuilder } from "./cms-visual-builder";
import { CmsFormDesigner } from "./cms-form-designer";
import { Media3DPreview } from "./media-3d-preview";
import { ProceduralObjectLibrary } from "./procedural-object-library";
import { CmsSiteGuard } from "./cms-site-guard";

/* ------------------------------------------------------------------ *
 * Section metadata (sidebar items) — bilingual labels
 * ------------------------------------------------------------------ */

type SectionMeta = {
  key: SectionKey;
  labelFa: string;
  labelEn: string;
  icon: LucideIcon;
  color?: string;
  index: string;
  /** Sidebar grouping — keeps the menu organized as the section count grows. */
  group: "content" | "design" | "system";
};

/** Sidebar categories, top → bottom. */
const SECTION_GROUPS: { id: SectionMeta["group"]; fa: string; en: string }[] = [
  { id: "content", fa: "محتوا و صفحات", en: "Content & Pages" },
  { id: "design", fa: "تجربه و طراحی", en: "Design & Experience" },
  { id: "system", fa: "سیستم و ابزارها", en: "System & Tools" },
];

const BUILTIN_SECTIONS: SectionMeta[] = [
  { key: "site", labelFa: "سایت و ناوبری", labelEn: "Site & Navigation", icon: LayoutDashboard, index: "00", group: "content" },
  { key: "hero", labelFa: "بخش معرفی", labelEn: "Hero", icon: Home, index: "01", group: "content" },
  { key: "graphics", labelFa: "گرافیک", labelEn: "Graphics", icon: Palette, color: "var(--gfx-1)", index: "02", group: "content" },
  { key: "ai", labelFa: "هوش مصنوعی", labelEn: "Artificial Intelligence", icon: Brain, color: "var(--ai-1)", index: "03", group: "content" },
  { key: "security", labelFa: "امنیت", labelEn: "Security", icon: ShieldCheck, color: "var(--sec-1)", index: "04", group: "content" },
  { key: "synthesis", labelFa: "ترکیب", labelEn: "Synthesis", icon: Sparkles, index: "05", group: "content" },
  { key: "timeline", labelFa: "خط زمانی و رزومه", labelEn: "Timeline & Résumé", icon: History, color: "var(--sec-1)", index: "06", group: "content" },
  { key: "profile", labelFa: "درباره من و رزومه", labelEn: "About Me & Résumé", icon: User, index: "07", group: "content" },
  { key: "footer", labelFa: "پاورقی", labelEn: "Footer", icon: Mail, index: "09", group: "content" },
  { key: "music", labelFa: "موسیقی و پخش‌کننده", labelEn: "Music Player", icon: Music, color: "var(--ai-1)", index: "08", group: "design" },
  { key: "explorer", labelFa: "سفر کاوشگر", labelEn: "Explorer Journey", icon: Compass, color: "var(--ai-1)", index: "18", group: "design" },
  { key: "museum", labelFa: "فضاپیما و راهروها", labelEn: "Spaceship & Decks", icon: Rocket, color: "#67e8f9", index: "19", group: "design" },
  { key: "design", labelFa: "طراحی و کارخانه سه‌بعدی", labelEn: "Design & 3D Factory", icon: Box, index: "10", group: "design" },
  { key: "meteors", labelFa: "کنترل شهاب‌ها", labelEn: "Meteor Controls", icon: Sparkles, color: "#dcecff", index: "11", group: "design" },
  { key: "forms", labelFa: "فرم‌ساز و ایمیل", labelEn: "Forms & Email", icon: FormInput, index: "12", group: "design" },
  { key: "error404", labelFa: "صفحه ۴۰۴ و بازی", labelEn: "404 Page & Game", icon: Gamepad2, index: "14", group: "design" },
  { key: "pwa", labelFa: "PWA و نصب روی گوشی", labelEn: "PWA & Install", icon: Smartphone, index: "15", group: "design" },
  { key: "seo", labelFa: "سئو و متادیتا", labelEn: "SEO & Metadata", icon: Search, index: "16", group: "system" },
  { key: "assistant", labelFa: "همدم پیکسلی (AI)", labelEn: "Pixel Buddy (AI)", icon: Bot, index: "17", group: "system" },
  { key: "builder", labelFa: "کنترل کامل CMS", labelEn: "Full CMS Control", icon: SlidersHorizontal, color: "var(--ai-1)", index: "13", group: "system" },
];

/** Set of the 7 built-in section keys (for fast lookup). */
const BUILTIN_KEYS = new Set<string>(BUILTIN_SECTIONS.map((s) => s.key));
const DEVELOPER_SECTION_KEY = "developer-info";
const MIGRATION_SECTION_KEY = "migration";
const MEDIA_SECTION_KEY = "media-library";
const ANALYTICS_SECTION_KEY = "analytics";
const DEFENSE_SECTION_KEY = "defense";
const LICENSEMGMT_SECTION_KEY = "license-mgmt";
const GUARD_SECTION_KEY = "access-guard";

function DeveloperOwnerEditor({ lang, value, onSaved }: { lang: Lang; value: SiteContent["developer"]; onSaved: () => Promise<void> }) {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDraft(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const unlock = async () => {
    setBusy(true);
    const response = await fetch("/api/developer/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    setBusy(false);
    if (!response.ok) return toast.error(lang === "fa" ? "کلید مالک نامعتبر است" : "Invalid owner key");
    setKey(""); setUnlocked(true);
    toast.success(lang === "fa" ? "ویرایش برای ۵ دقیقه باز شد" : "Editing unlocked for 5 minutes");
  };
  const save = async () => {
    setBusy(true);
    const response = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "developer", lang, data: draft }) });
    setBusy(false); setUnlocked(false); setKey("");
    if (!response.ok) return toast.error(lang === "fa" ? "ذخیره انجام نشد؛ دوباره قفل را باز کنید" : "Save failed; unlock again");
    await onSaved();
    toast.success(lang === "fa" ? "ذخیره شد و بخش دوباره قفل شد" : "Saved and locked again");
  };
  const set = (field: keyof SiteContent["developer"], next: string) => setDraft((current) => ({ ...current, [field]: next }));
  return <div className="space-y-4">
    <div className="rounded-2xl border border-[var(--ai-1)]/30 bg-[var(--ai-1)]/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4 text-[var(--ai-1)]" />{lang === "fa" ? "ناحیه خصوصی مالک" : "Private owner area"}</div>
      {!unlocked ? <div className="space-y-2"><div className="flex flex-col gap-2 sm:flex-row"><Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder={lang === "fa" ? "کلید مالک ۲۵۶ بیتی (۶۴ رقم hex)" : "256-bit owner key (64 hex characters)"} className="font-mono" /><Button onClick={unlock} disabled={busy || key.length !== 64}><KeyRound className="size-4" />{lang === "fa" ? "باز کردن" : "Unlock"}</Button></div><p className="text-[10px] text-muted-foreground">{lang === "fa" ? "کلید با PBKDF2 بررسی و نشست کوتاه‌مدت با AES‑256‑GCM رمزگذاری می‌شود؛ خود کلید ذخیره نمی‌شود." : "The key is verified with PBKDF2 and the short-lived session is encrypted with AES-256-GCM; the key itself is never stored."}</p></div> : <p className="text-xs text-emerald-500">{lang === "fa" ? "باز است؛ پس از ذخیره خودکار قفل می‌شود." : "Unlocked; it will automatically re-lock after save."}</p>}
    </div>
    <DeveloperCard lang={lang} data={draft} />
    {unlocked && <div className="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
      <TextField label={lang === "fa" ? "نام" : "Name"} value={draft.name} onChange={(x) => set("name", x)} />
      <TextField label={lang === "fa" ? "سمت" : "Role"} value={draft.role} onChange={(x) => set("role", x)} />
      <div className="sm:col-span-2"><TextAreaField label={lang === "fa" ? "توضیحات" : "Description"} value={draft.description} onChange={(x) => set("description", x)} /></div>
      <TextField label="Email" value={draft.email} onChange={(x) => set("email", x)} dir="ltr" />
      <TextField label="GitHub" value={draft.github} onChange={(x) => set("github", x)} dir="ltr" />
      <TextField label={lang === "fa" ? "لایسنس" : "License"} value={draft.license} onChange={(x) => set("license", x)} />
      <TextField label={lang === "fa" ? "لینک لایسنس" : "License URL"} value={draft.licenseUrl} onChange={(x) => set("licenseUrl", x)} dir="ltr" />
      <div className="sm:col-span-2"><TextField label={lang === "fa" ? "آدرس والت" : "Wallet address"} value={draft.wallet} onChange={(x) => set("wallet", x)} dir="ltr" /></div>
      <TextField label={lang === "fa" ? "عنوان حمایت" : "Donation title"} value={draft.donationTitle} onChange={(x) => set("donationTitle", x)} />
      <TextField label={lang === "fa" ? "توضیح حمایت" : "Donation description"} value={draft.donationDescription} onChange={(x) => set("donationDescription", x)} />
      <div className="sm:col-span-2 flex justify-end"><Button onClick={save} disabled={busy}><Save className="size-4" />{lang === "fa" ? "ذخیره و قفل" : "Save & lock"}</Button></div>
    </div>}
  </div>;
}

/** Display label for a built-in section key (bilingual). */
function builtinLabel(key: string, lang: Lang): string {
  const section = BUILTIN_SECTIONS.find((s) => s.key === key);
  return section ? (lang === "fa" ? section.labelFa : section.labelEn) : key;
}

/* ============================================================
 * LicenseManager — CMS panel for viewing/activating the license.
 * Works even when the site is locked (proxy allows /api/license/*).
 * ============================================================ */
function LicenseManager({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const [info, setInfo] = useState<{ phase: string; reason: string; licenseId?: string; licensee?: string; plan?: string; expiresAt?: string | null; usageCount?: number; usageLimit?: number | null; trial?: { daysLeft: number; totalDays: number; expired: boolean } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileContent, setFileContent] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/license/status", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setInfo(j);
    } catch { /* keep */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const activate = async () => {
    if (!fileContent.trim()) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileContent.trim() }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setMsg(fa ? "✅ لایسنس فعال شد!" : "✅ License activated!");
        setFileContent("");
        await load();
      } else {
        setMsg(`❌ ${j.error || "Activation failed"}`);
      }
    } catch { setMsg("❌ Connection error"); }
    finally { setBusy(false); }
  };

  const testConnection = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/license/status", { cache: "no-store" });
      const j = await r.json();
      setMsg(fa
        ? `اتصال برقرار ✓ — وضعیت: ${j.phase || j.reason || "OK"}`
        : `Connection OK ✓ — phase: ${j.phase || j.reason || "OK"}`);
    } catch { setMsg(fa ? "❌ عدم ارتباط با سرویس لایسنس" : "❌ Cannot reach the licensing service"); }
    finally { setBusy(false); }
  };

  const phase = info?.phase;
  const trial = info?.trial;
  const phaseColor = phase === "active" ? "#34d399" : phase === "maintenance" ? "#fbbf24" : "#fb7185";
  const phaseText = phase === "active" ? (fa ? "فعال ✓" : "Active ✓") : phase === "maintenance" ? (fa ? "نگهداری ⚠" : "Maintenance ⚠") : phase === "disabled" ? (fa ? "غیرفعال" : "Disabled") : (fa ? "بدون لایسنس ✗" : "Unlicensed ✗");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <KeyRound className="size-5 text-[var(--ai-1)]" />
          {fa ? "مدیریت لایسنس" : "License Manager"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {fa ? "وضعیت لایسنس، فعال‌سازی و تست اتصال به سرور لایسنس" : "License status, activation and server connection test"}
        </p>
      </div>

      {/* status card */}
      <div className="rounded-2xl border border-border bg-surface-1 p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold">{fa ? "وضعیت فعلی" : "Current status"}</span>
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${phaseColor}22`, color: phaseColor, border: `1px solid ${phaseColor}44` }}>
            {phaseText}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="text-muted-foreground">{fa ? "شناسه لایسنس" : "License ID"}</p>
            <p className="mt-1 font-mono text-foreground" dir="ltr">{info?.licenseId || "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="text-muted-foreground">{fa ? "دارنده" : "Licensee"}</p>
            <p className="mt-1 text-foreground">{info?.licensee || "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="text-muted-foreground">{fa ? "پلن" : "Plan"}</p>
            <p className="mt-1 text-foreground">{info?.plan || (trial && !trial.expired ? `trial (${trial.daysLeft}d)` : "—")}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="text-muted-foreground">{fa ? "انقضا" : "Expires"}</p>
            <p className="mt-1 font-mono text-foreground" dir="ltr">{info?.expiresAt ? new Date(info.expiresAt).toLocaleDateString() : "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="text-muted-foreground">{fa ? "مصرف" : "Usage"}</p>
            <p className="mt-1 font-mono text-foreground">{info?.usageCount ?? 0} / {info?.usageLimit ?? "∞"}</p>
          </div>
        </div>
        {info?.reason && (
          <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-200">
            {info.reason}
          </div>
        )}
        {trial && !trial.expired && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{fa ? `دوره‌ی آزمایشی: ${trial.daysLeft}/${trial.totalDays} روز` : `Trial: ${trial.daysLeft}/${trial.totalDays} days`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${(trial.daysLeft / trial.totalDays) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button onClick={() => void testConnection()} disabled={busy} variant="outline" size="sm">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {fa ? "تست اتصال" : "Test connection"}
          </Button>
          <Button onClick={() => void load()} variant="ghost" size="sm">
            <RefreshCw className="size-4" />
            {fa ? "به‌روزرسانی" : "Refresh"}
          </Button>
        </div>

        {/* activation */}
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <p className="mb-2 text-xs font-bold">{fa ? "فعال‌سازی لایسنس جدید" : "Activate new license"}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".lic,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.currentTarget.value = "";
              if (f) void f.text().then(setFileContent);
            }}
          />
          <div className="flex gap-2">
            <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm">
              <Upload className="size-4" />
              {fa ? "انتخاب فایل .lic" : "Pick .lic file"}
            </Button>
            <Button onClick={() => void activate()} disabled={busy || !fileContent.trim()} size="sm">
              <ShieldCheck className="size-4" />
              {fa ? "فعال‌سازی" : "Activate"}
            </Button>
          </div>
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            dir="ltr"
            rows={3}
            spellCheck={false}
            placeholder='{ "v": 1, "alg": "AES-256-GCM+Ed25519", … }'
            className="mt-3 w-full rounded-xl border border-border bg-black/30 p-2 font-mono text-[10px] text-white/80 outline-none focus:border-[var(--ai-1)]/50"
          />
        </div>

        {msg && (
          <div className={`rounded-xl border p-3 text-xs ${msg.startsWith("✅") ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : msg.startsWith("❌") ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-border bg-surface-1 text-foreground"}`}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ObjectVisualStage — a large, realistic preview of the target section
 * (heading skeleton, text lines, buttons — RTL-aware) with the 3D object
 * rendered ON it via the same placement style the live site uses
 * (ambientPlacementStyle). Drag anywhere to reposition: no more typing
 * numbers, saving and checking. Live X/Y readout while dragging.
 */
function ObjectVisualStage({ item, onChange, lang }: { item: Partial<SceneObject3DConfig>; onChange?: (next: Partial<SceneObject3DConfig>) => void; lang: Lang }) {
  const colorA = item.colorA || "var(--gfx-1)";
  const colorB = item.colorB || "var(--sec-1)";
  const colorC = item.colorA ? item.colorC || "var(--ai-1)" : "var(--ai-1)";
  const scale = Math.max(0.4, Number(item.scale || 1));
  const kind = item.kind || "crystal";
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);

  const top = Math.min(100, Math.max(0, Number(item.domTop ?? 10)));
  const hasExactX = Number.isFinite(Number(item.domX));
  const side = item.domSide || "end";
  const horizontal = hasExactX
    ? Math.max(0, Math.min(100, Number(item.domX)))
    : side === "start" ? 15 : side === "end" ? 85 : 50;
  const shownX = live?.x ?? horizontal;
  const shownY = live?.y ?? top;
  const domSize = Math.max(48, Number(item.domSize ?? 236));
  const renderSize = Math.round(Math.min(240, Math.max(56, domSize * 0.5)));
  const sectionName = item.sectionId ? builtinLabel(item.sectionId, lang) : lang === "fa" ? "سکشن" : "section";

  const dragTo = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)));
    setLive({ x, y });
    onChange({ ...item, domX: x, domTop: y, domSide: "center" });
  };
  const capture = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Pointer capture is best-effort: synthetic/test events carry pointer ids
    // the browser does not know and setPointerCapture would throw.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore — pointermove listeners still fire while the button is down
    }
  };

  const objectVisual = (
    <div
      className={cn(
        "relative border border-white/25 bg-white/10 shadow-2xl backdrop-blur-xl",
        kind === "glass-blob" && "rounded-[42%_58%_48%_52%/54%_42%_58%_46%]",
        kind === "crystal" && "rotate-45 rounded-xl",
        kind === "orbit" && "rounded-full",
        kind === "neural" && "rounded-[35%]",
        kind === "model" && "rounded-2xl"
      )}
      style={{
        width: renderSize,
        height: renderSize,
        transform: `rotateX(${Number(item.rotateX || 0)}deg) rotateY(${Number(item.rotateY || 0)}deg) rotateZ(${Number(item.rotateZ || 0)}deg) scale(${scale})`,
        background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.75), transparent 18%), linear-gradient(135deg, ${colorA}, ${colorB} 52%, ${colorC})`,
        opacity: item.enabled === false ? 0.25 : Number(item.opacity || 0.7),
        boxShadow: `0 0 34px ${colorA}`,
      }}
    >
      <span className="absolute inset-2 rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(255,255,255,0.45),transparent_30%),radial-gradient(circle_at_75%_70%,rgba(255,180,80,0.55),transparent_34%)] blur-[1px]" />
    </div>
  );

  const fa = lang === "fa";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="rounded-full border border-border bg-surface-1 px-2.5 py-1 font-medium text-muted-foreground">
          {fa ? "پیش‌نمایش ویرژوال — آبجکت را با موس بکشید" : "Visual preview — drag the object"}
        </span>
        <span className="rounded-full border border-border bg-surface-1 px-2.5 py-1 text-muted-foreground">
          {fa ? "سکشن هدف" : "target section"}: <b className="text-foreground">{sectionName}</b>
          {item.label ? ` · ${item.label}` : ""}
        </span>
      </div>
      <div
        className="relative h-[380px] touch-none overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_80%_10%,color-mix(in_oklch,var(--ai-1)_14%,transparent),transparent_40%),radial-gradient(circle_at_10%_90%,color-mix(in_oklch,var(--gfx-1)_12%,transparent),transparent_45%),var(--background)] select-none"
        onPointerDown={(event) => {
          capture(event);
          dragTo(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId) || event.buttons === 1) dragTo(event);
        }}
        onPointerUp={() => setLive(null)}
        onPointerCancel={() => setLive(null)}
      >
        {/* section skeleton — mirrors the live section layout, RTL-aware */}
        <div className="absolute inset-0" dir={fa ? "rtl" : "ltr"}>
          {/* heading block */}
          <div className="absolute start-8 top-10 w-[46%] space-y-3">
            <div className="h-5 w-24 rounded-full border border-border/70 bg-surface-1" />
            <div className="h-9 w-full rounded-lg bg-muted-foreground/25" />
            <div className="h-9 w-[78%] rounded-lg" style={{ background: `color-mix(in oklch, ${colorA} 38%, transparent)` }} />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-muted-foreground/15" />
              <div className="h-3 w-[92%] rounded bg-muted-foreground/15" />
              <div className="h-3 w-[70%] rounded bg-muted-foreground/15" />
            </div>
            <div className="flex gap-2 pt-3">
              <div className="h-8 w-24 rounded-full" style={{ background: `color-mix(in oklch, ${colorB} 45%, transparent)` }} />
              <div className="h-8 w-20 rounded-full border border-border bg-background/60" />
            </div>
          </div>
          {/* faint grid to make motion readable */}
          <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "linear-gradient(color-mix(in oklch, var(--border) 60%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--border) 60%, transparent) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
          {/* the object, positioned EXACTLY like the live site */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
            style={{ left: `${shownX}%`, top: `${shownY}%` }}
          >
            {item.modelUrl ? <div className="grid size-24 place-items-center rounded-2xl border border-border bg-background/70"><Media3DPreview url={item.modelUrl} className="h-20 w-20" /></div> : objectVisual}
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-background/85 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              X {shownX}% · Y {shownY}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * PWA settings editor — GLOBAL settings (the web manifest is a single file),
 * so saving writes the identical data to both language rows. Covers the app
 * name, display icon/logo, colors, orientation and everything else the
 * installed-app experience uses (app/manifest.ts reads this section).
 */
function PwaSettingsEditor({ lang, value }: { lang: Lang; value: SiteContent["pwa"] }) {
  const [draft, setDraft] = useState<SiteContent["pwa"]>(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDraft(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const set = (field: keyof SiteContent["pwa"], next: string) => setDraft((c) => ({ ...c, [field]: next }));

  const save = async () => {
    setBusy(true);
    try {
      const responses = await Promise.all(
        (["fa", "en"] as const).map((l) =>
          fetch("/api/content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section: "pwa", lang: l, data: draft }),
          })
        )
      );
      if (responses.some((r) => !r.ok)) throw new Error("save failed");
      toast.success(lang === "fa" ? "PWA ذخیره شد — مانیفست به‌روز شد" : "PWA saved — manifest updated");
    } catch {
      toast.error(lang === "fa" ? "ذخیره انجام نشد" : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  // Render helper (NOT a nested component — creating components during
  // render remounts them on every keystroke).
  const renderColorField = (label: string, field: "themeColor" | "backgroundColor") => (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(draft[field]) ? draft[field] : "#0a0a12"}
          onChange={(e) => set(field, e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
          aria-label={label}
        />
        <Input value={draft[field]} onChange={(e) => set(field, e.target.value)} dir="ltr" className="font-mono text-xs" />
      </div>
    </div>
  );

  const fa = lang === "fa";

  // ── primary icon: upload OR library pick → server auto-generates every size
  const [iconBusy, setIconBusy] = useState(false);
  const iconFileRef = useRef<HTMLInputElement>(null);
  const generateIcons = async (payload: { dataUrl?: string; uploadId?: string }) => {
    setIconBusy(true);
    try {
      const res = await fetch("/api/pwa/icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "icon generation failed");
      setDraft((c) => ({
        ...c,
        icon192: json.icon192,
        icon512: json.icon512,
        iconMaskable512: json.iconMaskable512,
        appleTouchIcon: json.appleTouchIcon,
      }));
      toast.success(fa
        ? "همه‌ی اندازه‌ها (۱۹۲/۵۱۲/maskable/iOS) به‌صورت خودکار ساخته و ذخیره شد"
        : "All sizes (192/512/maskable/iOS) generated and saved automatically");
    } catch (error) {
      toast.error((error instanceof Error ? error.message : "") || (fa ? "تولید آیکون شکست خورد" : "Icon generation failed"));
    } finally {
      setIconBusy(false);
    }
  };
  const onIconFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(fa ? "فایل تصویری انتخاب کنید" : "Pick an image file");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await generateIcons({ dataUrl });
  };
  const onLibraryPick = async (url: string) => {
    if (!url) return;
    const match = url.match(/\/api\/uploads\/([^/?#]+)/);
    if (!match) {
      toast.error(fa ? "این آدرس از کتابخانه رسانه نیست؛ فایل را آپلود کنید" : "Not a library asset — upload the file instead");
      return;
    }
    await generateIcons({ uploadId: match[1] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Smartphone className="size-5 text-[var(--ai-1)]" />
          {fa ? "PWA و نصب روی گوشی" : "PWA & Install"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {fa
            ? "هر چیزی که کاربر موقع نصب برنامه روی گوشی/دسکتاپ می‌بیند: نام، آیکون و لوگو، رنگ‌ها، جهت و نحوه‌ی نمایش. تنظیمات سراسری است و برای هر دو زبان ذخیره می‌شود. آدرس آیکون‌ها را می‌توانید از کتابخانه رسانه کپی کنید (پیشنهاد: PNG مربع ۱۹۲ و ۵۱۲ پیکسل)."
            : "Everything a user sees when installing the app on their phone/desktop: name, icon and logo, colors, orientation and display mode. Global settings — saved for both languages. Icon URLs can be copied from the Media Library (PNG square 192 & 512 recommended)."}
        </p>
      </div>
      <Separator />

      <SubsectionBox title={fa ? "نام و هویت" : "Name & identity"} hint={fa ? "نام کامل و کوتاه روی صفحه‌ی اصلی" : "Full and short home-screen name"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={fa ? "نام کامل (name)" : "Full name (name)"} value={draft.name} onChange={(x) => set("name", x)} />
          <TextField label={fa ? "نام کوتاه (shortName)" : "Short name (shortName)"} value={draft.shortName} onChange={(x) => set("shortName", x)} />
          <div className="sm:col-span-2">
            <TextAreaField label={fa ? "توضیحات (description)" : "Description"} value={draft.description} onChange={(x) => set("description", x)} />
          </div>
          <TextField label={fa ? "زبان (lang — مثل fa یا en)" : "Language tag (lang)"} value={draft.lang} onChange={(x) => set("lang", x)} dir="ltr" />
          <div>
            <Label className="text-xs">{fa ? "جهت (dir)" : "Direction (dir)"}</Label>
            <select
              value={draft.dir}
              onChange={(e) => set("dir", e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="ltr">LTR</option>
              <option value="rtl">RTL</option>
            </select>
          </div>
        </div>
      </SubsectionBox>

      <SubsectionBox title={fa ? "نمایش و رفتار" : "Display & behavior"} hint={fa ? "نحوه‌ی باز شدن برنامه نصب‌شده" : "How the installed app opens"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={fa ? "آدرس شروع (startUrl)" : "Start URL (startUrl)"} value={draft.startUrl} onChange={(x) => set("startUrl", x)} dir="ltr" />
          <div>
            <Label className="text-xs">{fa ? "حالت نمایش (display)" : "Display mode"}</Label>
            <select
              value={draft.display}
              onChange={(e) => set("display", e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="standalone">standalone (اپ‌مانند)</option>
              <option value="fullscreen">fullscreen (تمام‌صفحه)</option>
              <option value="minimal-ui">minimal-ui</option>
              <option value="browser">browser (مرورگر)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">{fa ? "جهت‌گیری (orientation)" : "Orientation"}</Label>
            <select
              value={draft.orientation}
              onChange={(e) => set("orientation", e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="any">any (هر دو)</option>
              <option value="portrait">portrait (عمودی)</option>
              <option value="landscape">landscape (افقی)</option>
            </select>
          </div>
          <TextField label={fa ? "دسته‌ها (categories — با کاما)" : "Categories (comma separated)"} value={draft.categories} onChange={(x) => set("categories", x)} dir="ltr" placeholder="productivity, business" />
        </div>
      </SubsectionBox>

      <SubsectionBox title={fa ? "رنگ‌ها" : "Colors"} hint={fa ? "رنگ نوار سیستم و پس‌زمینه‌ی اسپلش" : "System bar color and splash background"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {renderColorField(fa ? "رنگ تم (themeColor)" : "Theme color", "themeColor")}
          {renderColorField(fa ? "رنگ پس‌زمینه (backgroundColor)" : "Background color", "backgroundColor")}
        </div>
      </SubsectionBox>

      <SubsectionBox title={fa ? "آیکون اصلی — یک بار انتخاب، همه‌ی اندازه‌ها خودکار" : "Primary icon — pick once, all sizes auto-generated"} hint={fa ? "آپلود مستقیم یا انتخاب از کتابخانه رسانه؛ خود برنامه ۱۹۲، ۵۱۲، maskable و آیکون iOS را می‌سازد" : "Upload directly or pick from the Media Library; the app generates 192, 512, maskable and the iOS icon"}>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          {/* live preview of the generated icons */}
          <div className="flex items-center gap-3 sm:flex-col">
            {[draft.icon512, draft.icon192, draft.appleTouchIcon].filter(Boolean).map((src, i) => (
               
              <img
                key={`${src}-${i}`}
                src={src}
                alt="PWA icon preview"
                className="rounded-xl border border-border bg-surface-1 object-cover shadow-lg"
                style={{ width: i === 0 ? 72 : 48, height: i === 0 ? 72 : 48 }}
              />
            ))}
            {!draft.icon512 && !draft.icon192 && (
              <div className="grid size-[72px] place-items-center rounded-xl border border-dashed border-border text-[10px] text-muted-foreground">
                {fa ? "بدون آیکون" : "no icon"}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={iconFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  void onIconFile(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
              <Button type="button" size="sm" onClick={() => iconFileRef.current?.click()} disabled={iconBusy}>
                {iconBusy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                {fa ? "آپلود آیکون" : "Upload icon"}
              </Button>
              <CmsMediaPicker value="" onChange={(url) => void onLibraryPick(url)} lang={lang} accept="image" compact />
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
              {fa
                ? "پیشنهاد: تصویر مربعی با کیفیت بالا (حداقل ۵۱۲ پیکسل، PNG). پس از انتخاب، چهار نسخه‌ی ۵۱۲، ۱۹۲، maskable (اندروید) و ۱۸۰ (iOS/اپل) ساخته و در کتابخانه با دسته‌ی PWA ذخیره می‌شود. iOS آیکون صفحه‌ی اصلی را از همین آیکون ۱۸۰ می‌گیرد."
                : "Recommended: a high-quality square image (≥512px, PNG). After picking, four variants — 512, 192, maskable (Android) and 180 (iOS/Apple) — are generated and stored in the library under the PWA category. iOS takes its home-screen icon from the 180px one."}
            </p>
          </div>
        </div>
        <details className="mt-4 rounded-xl border border-border bg-surface-1/60 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            {fa ? "فیلدهای پیشرفته (ویرایش دستی آدرس‌ها)" : "Advanced (manual URL editing)"}
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label={fa ? "آیکون SVG (هر اندازه — پیش‌فرض /logo.svg)" : "SVG icon (any size)"} value={draft.iconSvg} onChange={(x) => set("iconSvg", x)} dir="ltr" />
            <TextField label={fa ? "آیکون PNG ۱۹۲ (icon192)" : "PNG icon 192"} value={draft.icon192} onChange={(x) => set("icon192", x)} dir="ltr" placeholder="/api/uploads/…" />
            <TextField label={fa ? "آیکون PNG ۵۱۲ (icon512)" : "PNG icon 512"} value={draft.icon512} onChange={(x) => set("icon512", x)} dir="ltr" placeholder="/api/uploads/…" />
            <TextField label={fa ? "آیکون Maskable ۵۱۲ (اختیاری — اندروید)" : "Maskable icon 512 (optional — Android)"} value={draft.iconMaskable512} onChange={(x) => set("iconMaskable512", x)} dir="ltr" placeholder="/api/uploads/…" />
            <TextField label={fa ? "آیکون iOS (appleTouchIcon ~180)" : "iOS icon (appleTouchIcon ~180)"} value={draft.appleTouchIcon} onChange={(x) => set("appleTouchIcon", x)} dir="ltr" placeholder="/api/uploads/…" />
          </div>
        </details>
      </SubsectionBox>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {fa ? "ذخیره (هر دو زبان)" : "Save (both languages)"}
        </Button>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        {fa ? "شناسه بخش" : "Section ID"}: pwa
      </p>
    </div>
  );
}

const CMS_TERMS: ReadonlyArray<readonly [string, string]> = [
  ["سایت و ناوبری", "Site & Navigation"], ["بخش معرفی", "Hero"], ["گرافیک", "Graphics"],
  ["امنیت", "Security"], ["هوش مصنوعی", "Artificial Intelligence"], ["ترکیب", "Synthesis"],
  ["خط زمانی", "Timeline"], ["درباره من و رزومه", "About Me & Résumé"], ["موسیقی و پلیر", "Music Player"],
  ["فوتر", "Footer"], ["پاورقی", "Footer"], ["طراحی و کارخانه سه‌بعدی", "Design & 3D Factory"],
  ["فرم‌ساز و ایمیل", "Forms & Email"], ["کنترل کامل مدیریت محتوا", "Full CMS Control"],
  ["کنترل کامل CMS", "Full CMS Control"], ["صفحه ۴۰۴ و بازی فضانورد", "404 Page & Astronaut Game"],
  ["نام برند", "Brand name"], ["سال برند", "Brand year"], ["منوی گرافیک", "Graphics menu"],
  ["منوی امنیت", "Security menu"], ["منوی هوش مصنوعی", "AI menu"], ["منوی تماس", "Contact menu"],
  ["نشان وضعیت", "Status badge"], ["عنوان — خط ۱", "Title — line 1"], ["عنوان — خط ۲", "Title — line 2"],
  ["عنوان — شروع", "Title — opening"], ["کلمه‌ی هایلایت", "Highlighted word"], ["کلمه هایلایت", "Highlighted word"],
  ["هایلایت", "Highlight"], ["عنوان", "Title"], ["زیرعنوان", "Subtitle"], ["توضیحات کامل", "Full description"],
  ["توضیحات", "Description"], ["توضیح کوتاه", "Short description"], ["دکمه‌ی اصلی", "Primary button"],
  ["دکمه‌ی ثانویه", "Secondary button"], ["متن دکمه", "Button text"], ["لینک دکمه", "Button link"],
  ["برچسب", "Label"], ["مقدار", "Value"], ["شماره", "Index"], ["ککر", "Kicker"],
  ["پروژه‌های گالری", "Gallery projects"], ["گالری پروژه‌ها", "Project Gallery"], ["پروژه‌ها", "Projects"],
  ["ابزارها", "Tools"], ["مهارت‌ها", "Skills"], ["گواهینامه‌ها", "Certificates"], ["استک", "Stack"],
  ["دسته", "Category"], ["متریک", "Metric"], ["برچسب متریک", "Metric label"], ["تگ‌لاین کوتاه", "Short tagline"],
  ["تگ‌ها", "Tags"], ["تگ", "Tag"], ["رنگ اصلی", "Primary color"], ["رنگ پایه", "Base color"], ["رنگ", "Color"],
  ["سال", "Year"], ["کارفرما", "Client"], ["نقش", "Role"], ["لینک خارجی", "External link"], ["تصاویر", "Images"],
  ["مشخصات", "Specifications"], ["کلید", "Key"], ["بج کوچک", "Small badge"], ["بج", "Badge"],
  ["متن", "Body text"], ["موارد", "Items"], ["موقعیت", "Location"], ["ایمیل", "Email"], ["نسخه", "Version"],
  ["کپی‌رایت", "Copyright"], ["ساخته‌شده با", "Built with"], ["خورشید مرکزی = من", "Central Star = Me"],
  ["سیارات", "Planets"], ["نام سیاره", "Planet name"], ["شناسه", "Identifier"], ["بخش هدف", "Target section"],
  ["بافت", "Texture"], ["اندازه سیاره", "Planet size"], ["شعاع مدار", "Orbit radius"], ["دوره مداری", "Orbital period"],
  ["انحراف اولیه", "Initial offset"], ["اندازه قمر", "Moon size"], ["شعاع مدار قمر", "Moon orbit radius"],
  ["دوره مدار قمر", "Moon orbit period"], ["زاویه شروع قمر", "Moon starting angle"], ["قمرها", "Moons"],
  ["زاویه دید منظومه", "System point of view"], ["پیش‌نمایش تنظیمات سیارات", "Planet settings preview"],
  ["پس‌زمینه", "Background"], ["نورهای بکگراند", "Background lights"], ["نشانگر و هاور", "Cursor & Hover"],
  ["کارخانه ساخت آبجکت سه‌بعدی", "3D Object Factory"], ["آبجکت‌های سه‌بعدی", "3D objects"],
  ["تحویل پیام‌ها", "Message delivery"], ["ضد اسپم", "Anti-spam"], ["کتابخانه فرم‌ها", "Forms library"],
  ["طراحی فرم فعال", "Active form designer"], ["نودهای فرم", "Form steps"], ["فیلدها", "Fields"],
  ["مسیرهای شرطی گراف", "Conditional graph edges"], ["کنترل مادر", "Master controls"],
  ["توضیح داخلی CMS", "Internal CMS hint"], ["راهنمای کار با CMS", "CMS guide"], ["حالت فاصله", "Spacing mode"],
  ["سرعت، فریم و انیمیشن", "Performance & Animation"], ["مدیریت کش هوشمند", "Smart cache"],
  ["هدر و منو", "Header & Menu"], ["آیتم‌های منو", "Navigation items"], ["چیدمان بخش‌ها", "Section layout"],
  ["کامپوننت‌های قابل ساخت", "Reusable components"], ["کتابخانه انیمیشن", "Animation Library"],
  ["متن و اکشن‌ها", "Content & Actions"], ["تصاویر بازی", "Game assets"], ["رنگ‌های گرافیک", "Visual colors"],
  ["تنظیمات بازی", "Game tuning"], ["بازگردانی این فیلد به پیش‌فرض", "Reset this field to default"],
  ["موقعیت افقی دوربین", "Camera X"], ["موقعیت عمودی دوربین", "Camera Y"], ["عمق دوربین", "Camera Z"],
  ["ارتفاع هدف دوربین", "Target Y"], ["چرخش افقی", "Tilt X"], ["چرخش عمقی", "Tilt Z"],
  ["مقیاس مدار", "Orbit scale"], ["مقیاس سیاره", "Planet scale"], ["مقیاس قمر", "Moon scale"], ["مقیاس برچسب", "Label scale"],
  ["شفافیت", "Opacity"], ["محو شدگی", "Blur"], ["سرعت", "Speed"], ["مدت", "Duration"], ["تأخیر", "Delay"],
  ["فعال", "Enabled"], ["انتقال به بالا", "Move up"], ["انتقال به پایین", "Move down"], ["چپ", "Left"], ["اندازه", "Size"],
  ["واقع‌گرایانه", "Realistic"], ["شفقی", "Aurora"], ["مینیمال", "Minimal"], ["خودکار", "Automatic"], ["دستی", "Manual"],
  ["گیت‌هاب", "GitHub"], ["لینکدین", "LinkedIn"], ["توییتر", "Twitter"], ["بکگراند", "Background"],
  ["آمار", "Stats"], ["عنوان بازی", "Game title"], ["زیرعنوان بازی", "Game subtitle"],
  ["عنوان گالری", "Gallery title"], ["زیرعنوان گالری", "Gallery subtitle"], ["دکمه‌ی ورود", "Enter button"],
  ["رنگ خورشید", "Star color"], ["برچسب هاور", "Hover label"], ["توضیح هاور", "Hover hint"],
] as const;

const CMS_PHRASES: ReadonlyArray<readonly [string, string]> = [
  ["منوی هوش مصنوعی (navAI)", "AI menu (navAI)"],
  ["سیارات / Planets — سیستم سیاره‌ای صفحه اول", "Planets — home-page planetary system"],
  ["پروژه‌های گالری (gallery.projects) — تمپلیت پروژه", "Gallery projects (gallery.projects) — project template"],
  ["هایلایت ۱ (highlight1)", "Highlight 1 (highlight1)"],
  ["هایلایت ۲ (highlight2)", "Highlight 2 (highlight2)"],
  ["هایلایت ۳ (highlight3)", "Highlight 3 (highlight3)"],
  ["خط زمانی / Timeline — مسیر حرفه‌ای", "Timeline — professional journey"],
  ["📱 واتس‌اپ — شماره شما با کد کشور (مثل 989121234567)", "📱 WhatsApp — your number with country code (for example, 989121234567)"],
  ["✈️ تلگرام — نام کاربری شما بدون @ (مثل p00rija)", "✈️ Telegram — your username without @ (for example, p00rija)"],
  ["To (گیرنده ایمیل — mailto و SMTP)", "To (email recipient — mailto and SMTP)"],
  ["بج کوچک (badge) — اختیاری", "Small badge (badge) — optional"],
  ["موارد (items) — فیلدهای دلخواه / free-form key-value pairs", "Items — free-form key-value pairs"],
  ["شناسه (id) — gfx/sec/ai یا سفارشی", "Identifier (id) — gfx/sec/ai or custom"],
  ["دوره مداری (orbitPeriod) — ثانیه", "Orbital period (orbitPeriod) — seconds"],
  ["انحراف اولیه (orbitOffset) — درجه 0-360", "Initial offset (orbitOffset) — degrees 0-360"],
  ["دوره مدار قمر (moonOrbitPeriod) — ثانیه", "Moon orbit period (moonOrbitPeriod) — seconds"],
  ["زاویه شروع قمر (moonOrbitOffset) — درجه", "Moon starting angle (moonOrbitOffset) — degrees"],
  ["زاویه مسیر قمر X (moonOrbitTiltX) — درجه", "Moon orbit tilt X (moonOrbitTiltX) — degrees"],
  ["زاویه مسیر قمر Y (moonOrbitTiltY) — درجه", "Moon orbit tilt Y (moonOrbitTiltY) — degrees"],
  ["زاویه مسیر قمر Z (moonOrbitTiltZ) — درجه", "Moon orbit tilt Z (moonOrbitTiltZ) — degrees"],
  ["قمرها / توانایی‌ها (moons)", "Moons / capabilities (moons)"],
  ["تصاویر (images) — URL یا کد رنگ", "Images (images) — URL or color value"],
  ["موقعیت افقی (domSide): start/end/center — end یعنی روبه‌روی متن و در فارسی خودکار برعکس می‌شود", "Horizontal position (domSide): start/end/center — end faces the text and mirrors automatically in Persian"],
  ["فاصله از بالا (domTop) — درصد 0-100", "Top offset (domTop) — percent 0-100"],
  ["فاصله از لبه انتخابی (domOffset) — rem، منفی = بیرون‌زدگی", "Selected-edge offset (domOffset) — rem; negative values extend outward"],
  ["اندازه ظرف (domSize) — px", "Container size (domSize) — px"],
  ["برچسب و توضیح کوتاه سه آبجکت قدیمی hero.worlds", "Labels and short descriptions for the three legacy hero.worlds objects."],
  ["هر سیاره یک دنیای تخصصی است (hero.planets)", "Each planet represents a specialist world (hero.planets)."],
  ["با کلیک روی خورشید وسط صفحه اول، پروفایل و رزومه شما نمایش داده می‌شود (بخش Profile).", "Clicking the central sun opens your profile and résumé (Profile section)."],
  ["graphics.gallery — پروژه‌های کامل با تصاویر، مشخصات و توضیحات. هر پروژه در پاپ‌آپ بزرگ نمایش داده می‌شود.", "graphics.gallery — complete projects with images, specifications, and descriptions. Each project opens in a large popup."],
  ["موسیقی و پلیر / Music Player — آپلود، Spotify، اکولایزر و رقص سیارات", "Music Player — uploads, Spotify, equalizer, and reactive planets"],
  ["رنگ‌ها، سرعت حرکت نورها، blur، blend و grain بکگراند اصلی", "Main background colors, light-motion speed, blur, blend mode, and grain."],
  ["ظاهر cursor، labelهای zoneها، trail، smoothing، opacity و hover size", "Cursor appearance, zone labels, trail, smoothing, opacity, and hover size."],
  ["آبجکت‌ها را جابه‌جا کن، رنگ/افکت/انیمیشن بده، GLB/GLTF آپلود کن، یا با slotهای hero-primary و planetary-center جایگزین اول سایت و مرکز سیارات کن.", "Move objects, customize colors, effects, and animation, upload GLB/GLTF models, or replace the hero and planetary center through the hero-primary and planetary-center slots."],
  ["سه حالت بدون سرور (واتس‌اپ/تلگرام/ایمیل بازدیدکننده) + SMTP برای ارسال کلاسیک سمت سرور.", "Three serverless delivery modes (WhatsApp, Telegram, and the visitor's email client), plus SMTP for classic server-side delivery."],
  ["Honeypot، حداقل زمان ارسال و محدودیت تعداد پیام", "Honeypot, minimum submission time, and message rate limiting."],
  ["فرم فعال در فوتر نمایش داده می‌شود. فرم‌های دیگر را می‌شود آماده نگه داشت.", "The active form appears in the footer; other forms can remain saved as drafts."],
  ["Stepها نودهای فرم هستند، Edgeها مسیر شرطی بین نودها هستند. این گراف فقط برای ادمین در CMS است.", "Steps are form nodes and edges define conditional paths between them. This graph is visible only to CMS administrators."],
  ["این بخش نقش page builder دارد: رفتار کلی، فاصله‌ها، radius، hover، لینک‌ها و CSS سفارشی کل سایت.", "This section is the page builder for global behavior, spacing, radii, hover states, links, and site-wide custom CSS."],
  ["فریم‌ریت رندر سه‌بعدی، زمان اسکرین‌سیور و مد کلی انیمیشن سایت — برای دستگاه/هاست‌های ضعیف هم سبک کنید.", "Control 3D frame rate, screensaver timing, and site-wide animation intensity, including lightweight settings for low-power devices and hosts."],
  ["TTL محتوای CMS، کش assetها، DPR canvas و رفتار 3D را کنترل کن تا سایت سنگین نشود.", "Control CMS content TTL, asset caching, canvas DPR, and 3D behavior to keep the site responsive."],
  ["تمام تنظیمات هدر، لوگو، منوی موبایل و کنترل‌های هدر", "All header, logo, mobile menu, and header-control settings."],
  ["اضافه، حذف، جابه‌جایی، لینک خارجی، رنگ و hover label", "Add, remove, and reorder items; configure external links, colors, and hover labels."],
  ["فعال/غیرفعال کردن کامل، جابه‌جایی، سواپ، داپلیکیت، بخش جدید نامحدود و سیاره اختصاصی — همه با ذخیره لحظه‌ای در هر دو زبان", "Enable, disable, reorder, swap, or duplicate sections; add unlimited custom sections and dedicated planets with live bilingual persistence."],
  ["دکمه، کارت، badge، modal، menu و هر آبجکت سفارشی قابل تعریف", "Define buttons, cards, badges, modals, menus, and other reusable custom objects."],
  ["برای هر target دلخواه CSS selector بده؛ مثل #graphics، main > section یا [data-builder-component='cards']. حالت hover، load و always پشتیبانی می‌شود.", "Assign any CSS selector as a target, such as #graphics, main > section, or [data-builder-component='cards']. Hover, load, and always-on modes are supported."],
  ["متن‌ها، CTAها و پیام‌های بازی", "Page copy, calls to action, and game messages."],
  ["PNGهای فضانورد و شهاب‌سنگ؛ می‌توانید مسیر public یا URL بدهید.", "Astronaut and meteor PNG assets; use a public path or full URL."],
  ["رنگ لباس، شیشه، بند، شهاب‌سنگ و accent", "Suit, visor, tether, meteor, and accent colors."],
  ["سرعت، تعداد شهاب‌سنگ‌ها، اندازه‌ها، امتیاز و لیدربرد", "Speed, meteor count and sizes, scoring, and leaderboard settings."],
] as const;

const hasFa = (value: string) => /[\u0600-\u06ff]/.test(value);
const hasEn = (value: string) => /[A-Za-z]/.test(value);

function localizeCmsText(value: string, lang: Lang): string {
  if (!value) return value;
  const exactPhrase = CMS_PHRASES.find(([fa, en]) => value.trim() === (lang === "fa" ? en : fa));
  if (exactPhrase) return lang === "fa" ? exactPhrase[0] : exactPhrase[1];
  const parts = value.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  const hasFaOnlyPart = parts.some((part) => hasFa(part) && !hasEn(part));
  const hasEnOnlyPart = parts.some((part) => hasEn(part) && !hasFa(part));
  if (parts.length === 2 && hasFaOnlyPart && hasEnOnlyPart) {
    const match = parts.find((part) => lang === "fa" ? hasFa(part) && !hasEn(part) : hasEn(part) && !hasFa(part));
    if (match) value = match;
  }
  const ordered = [...CMS_TERMS].sort((a, b) => Math.max(b[0].length, b[1].length) - Math.max(a[0].length, a[1].length));
  for (const [fa, en] of ordered) {
    value = value.replaceAll(lang === "fa" ? en : fa, lang === "fa" ? fa : en);
  }
  // English editing mode must never leak Persian UI copy. Unknown legacy
  // fragments are removed rather than displayed in the wrong locale.
  if (lang === "en" && hasFa(value)) {
    value = value
      .replace(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u200c\u200f]+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1");
  }
  value = value.replace(/\s{2,}/g, " ").replace(/^\s*[\-—/:·]+|[\-—/:·]+\s*$/g, "").trim();
  return value || (lang === "fa" ? "تنظیمات" : "Settings");
}

/* ------------------------------------------------------------------ *
 * Custom-section metadata & helpers
 * ------------------------------------------------------------------ */

/** Icons the user can pick for a custom section. */
const CUSTOM_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "file", label: "File", icon: FileText },
  { key: "star", label: "Star", icon: Star },
  { key: "tag", label: "Tag", icon: Tag },
  { key: "box", label: "Box", icon: Box },
  { key: "heart", label: "Heart", icon: Heart },
  { key: "settings", label: "Settings", icon: Settings },
];

/** Renders a custom-section icon key: Font Awesome (fa-*) or lucide fallback. */
function CustomIconView({ iconKey, className }: { iconKey: string | undefined; className?: string }) {
  const mediaUrl = customMediaIconUrl(iconKey);
  if (mediaUrl) {
    return <img src={mediaUrl} alt="" className={cn("object-contain", className)} aria-hidden />;
  }
  if (isFaIcon(iconKey)) {
    return <i className={cn("fa-solid", iconKey, className)} aria-hidden />;
  }
  const Lucide = CUSTOM_ICONS.find((c) => c.key === iconKey)?.icon ?? FileText;
  return <Lucide className={className} />;
}

/** Searchable icon picker grid — ~130 icons (Font Awesome + lucide). */
function IconPickerGrid({
  activeKey,
  onPick,
  lang,
}: {
  activeKey?: string;
  onPick: (key: string) => void;
  lang: "fa" | "en";
}) {
  const [query, setQuery] = useState("");
  const [customIcons, setCustomIcons] = useState<Array<{ id: string; url: string; title: string; filename: string }>>([]);
  useEffect(() => {
    let active = true;
    void fetch("/api/uploads", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { uploads: [] })
      .then((json) => {
        if (!active) return;
        setCustomIcons((json.uploads ?? []).filter((asset: { mime: string; category?: string }) =>
          asset.mime === "image/svg+xml" || asset.category === "Custom Icons"
        ));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? ALL_LIBRARY_ICONS.filter((i) => i.label.toLowerCase().includes(q) || i.key.includes(q))
    : ALL_LIBRARY_ICONS;
  const filteredCustomIcons = customIcons.filter((icon) =>
    `${icon.title} ${icon.filename}`.toLowerCase().includes(q)
  );
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={lang === "fa" ? "جستجوی آیکون… (مثلاً rocket یا star)" : "Search icons… (e.g. rocket, star)"}
        className="h-8 bg-background/70 text-xs"
      />
      <div className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto rounded-lg border border-border bg-background/40 p-1.5 sm:grid-cols-8">
        {filteredCustomIcons.map((icon) => {
          const key = `media:${icon.url}`;
          const active = key === activeKey;
          return (
            <button
              key={icon.id}
              type="button"
              title={icon.title || icon.filename}
              aria-label={icon.title || icon.filename}
              aria-pressed={active}
              onClick={() => onPick(key)}
              className={cn("grid aspect-square place-items-center rounded-md border p-1 transition-colors", active ? "border-primary bg-primary/10" : "border-transparent hover:bg-surface-2")}
            >
              <img src={icon.url} alt="" className="size-5 object-contain" />
            </button>
          );
        })}
        {filtered.map((i) => {
          const active = i.key === activeKey;
          return (
            <button
              key={i.key}
              type="button"
              title={`${i.label} · ${i.group}`}
              aria-label={i.label}
              aria-pressed={active}
              onClick={() => onPick(i.key)}
              className={cn(
                "grid aspect-square place-items-center rounded-md border text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              )}
            >
              {isFaIcon(i.key) ? (
                <i className={cn("fa-solid", i.fa)} aria-hidden />
              ) : (
                (() => {
                  const Lucide = CUSTOM_ICONS.find((c) => c.key === i.key)?.icon ?? FileText;
                  return <Lucide className="size-4" />;
                })()
              )}
            </button>
          );
        })}
        {filtered.length === 0 && filteredCustomIcons.length === 0 && (
          <p className="col-span-full py-4 text-center text-xs text-muted-foreground">
            {lang === "fa" ? "آیکونی پیدا نشد" : "No icons found"}
          </p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {lang === "fa"
          ? `${ALL_LIBRARY_ICONS.length + customIcons.length} آیکون — سفارشی + Font Awesome + Lucide`
          : `${ALL_LIBRARY_ICONS.length + customIcons.length} icons — Custom + Font Awesome + Lucide`}
      </p>
    </div>
  );
}

function getCustomIcon(iconKey: string | undefined): LucideIcon {
  return CUSTOM_ICONS.find((c) => c.key === iconKey)?.icon ?? FileText;
}

/** Custom section key factory: `custom-<ts>-<rand>`. */
function newCustomKey(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
function isCustomKey(key: string): boolean {
  return key.startsWith("custom-") && key.length > 7;
}

/** Generic blank shape for a freshly-created custom section. */
function blankCustomData(): {
  title: string;
  subtitle: string;
  body: string;
  badge: string;
  ctaLabel: string;
  ctaUrl: string;
  items: Record<string, string>[];
} {
  return { title: "", subtitle: "", body: "", badge: "", ctaLabel: "", ctaUrl: "", items: [] };
}

/** A custom section as held in local CMS state. */
type CustomSection = {
  key: string;
  label: string;
  iconKey: string;
  data: { fa: Record<string, unknown>; en: Record<string, unknown> };
};

/** Fetch ALL DB rows (built-in + custom) including their _meta. */
async function fetchAllSections(): Promise<CustomSection[]> {
  const res = await fetch("/api/content?all=1", { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  if (!json.ok || !Array.isArray(json.sections)) return [];
  const out: CustomSection[] = [];
  for (const row of json.sections) {
    const section: unknown = row?.section;
    if (typeof section !== "string" || !isCustomKey(section)) continue;
    const data = (row?.data ?? {}) as Record<string, unknown>;
    const meta =
      data._meta && typeof data._meta === "object" && !Array.isArray(data._meta)
        ? (data._meta as Record<string, unknown>)
        : {};
    const label =
      typeof meta.label === "string" && meta.label.trim()
        ? meta.label
        : section;
    const iconKey = typeof meta.iconKey === "string" ? meta.iconKey : "file";
    const fa =
      data.fa && typeof data.fa === "object" && !Array.isArray(data.fa)
        ? (data.fa as Record<string, unknown>)
        : {};
    const en =
      data.en && typeof data.en === "object" && !Array.isArray(data.en)
        ? (data.en as Record<string, unknown>)
        : {};
    out.push({ key: section, label, iconKey, data: { fa, en } });
  }
  return out;
}

/** POST a custom section update (one language) — auth via cookie. */
async function postCustomLang(
  section: string,
  lang: Lang,
  data: unknown
): Promise<boolean> {
  try {
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, lang, data }),
    });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

/** POST a custom section's _meta (label/iconKey). */
async function postCustomMeta(
  section: string,
  meta: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, meta }),
    });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

/** DELETE a custom section row (auth via cookie; built-ins refused by API). */
async function deleteCustomSection(section: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/content/${encodeURIComponent(section)}`, {
      method: "DELETE",
    });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Reusable field primitives
 * ------------------------------------------------------------------ */

function FieldLabel({ children }: { children: ReactNode }) {
  const lang = useContent((s) => s.lang);
  return (
    <Label className="text-xs font-medium text-muted-foreground">{typeof children === "string" ? localizeCmsText(children, lang) : children}</Label>
  );
}

/** Per-field reset chip — renders a small "reset to default" button when the
 *  current value differs from the provided default. */
function FieldResetChip({
  defaultVal,
  current,
  onReset,
}: {
  defaultVal: unknown;
  current: unknown;
  onReset: () => void;
}) {
  const lang = useContent((s) => s.lang);
  const differs = JSON.stringify(defaultVal) !== JSON.stringify(current);
  if (!differs) return null;
  return (
    <button
      type="button"
      onClick={onReset}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-[var(--surface-1)] hover:text-foreground"
      title={lang === "fa" ? "بازگردانی این فیلد به پیش‌فرض" : "Reset this field to default"}
      aria-label={lang === "fa" ? "بازگردانی این فیلد به پیش‌فرض" : "Reset this field to default"}
    >
      <RotateCcw className="size-3" />
      <span className="hidden sm:inline">{lang === "fa" ? "بازنشانی" : "Reset"}</span>
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  dir,
  placeholder,
  defaultVal,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "rtl" | "ltr";
  placeholder?: string;
  defaultVal?: unknown;
  onReset?: () => void;
}) {
  const lang = useContent((state) => state.lang);
  const mediaLike = /(?:url|image|media|video|audio|font|model|lottie|تصویر|رسانه|ویدیو|صوت|فونت|مدل)/i.test(label);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {onReset && (
          <FieldResetChip defaultVal={defaultVal} current={value} onReset={onReset} />
        )}
      </div>
      <div className="flex gap-2"><Input
          dir={dir}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="border-border bg-[var(--surface-1)] text-foreground"
        />{mediaLike && <CmsMediaPicker value={value ?? ""} onChange={onChange} lang={lang} compact />}</div>
    </div>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const lang = useContent((s) => s.lang);
  return (
    <label className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-border bg-[var(--surface-1)] px-3 text-sm text-foreground"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{localizeCmsText(option.label, lang)}</option>)}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  defaultVal,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  defaultVal?: unknown;
  onReset?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {onReset && (
          <FieldResetChip defaultVal={defaultVal} current={value} onReset={onReset} />
        )}
      </div>
      <Textarea
        rows={rows}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-20 resize-y border-border bg-[var(--surface-1)] text-foreground"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
}: {
  label: string;
  value: number | string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Input
        dir="ltr"
        type="number"
        value={numeric}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (!Number.isFinite(raw)) return;
          const clamped = Math.min(max ?? raw, Math.max(min ?? raw, raw));
          onChange(clamped);
        }}
        className="border-border bg-[var(--surface-1)] text-foreground"
      />
    </div>
  );
}

function ImageUploadField({
  label,
  value,
  onChange,
  lang,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lang: Lang;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Upload failed");
      onChange(json.url);
      toast.success(lang === "fa" ? "تصویر آپلود شد؛ برای ثبت نهایی ذخیره کنید" : "Image uploaded; save to publish");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-4">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-background/40 p-3">
        {value ? <img src={value} alt="" className="h-14 w-14 rounded-lg border border-border object-contain" /> : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <FileUp className="me-1 h-4 w-4" />}
          {lang === "fa" ? "آپلود تصویر" : "Upload image"}
        </Button>
        <CmsMediaPicker value={value} onChange={onChange} lang={lang} accept="image" />
        {value ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            {lang === "fa" ? "حذف تصویر" : "Remove image"}
          </Button>
        ) : null}
        <Input dir="ltr" value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="https://… or /api/uploads/…" className="min-w-56 flex-1 bg-background/70" />
      </div>
    </div>
  );
}

/** Color picker + hex text input, used for gallery artwork colors. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-[var(--surface-1)] p-1"
          aria-label={label}
        />
        <Input
          dir="ltr"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="border-border bg-[var(--surface-1)] font-mono text-sm text-foreground"
        />
      </div>
    </div>
  );
}

function StringListField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const t = useContent((s) => s.t);
  const lang = useContent((s) => s.lang);
  const list = Array.isArray(values) ? values : [];
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-2">
        {list.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={i === 0}
                onClick={() => {
                  const next = [...list];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onChange(next);
                }}
                aria-label={lang === "fa" ? "انتقال به بالا" : "Move up"}
                className="size-6"
              >
                <ArrowUp className="size-3" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={i === list.length - 1}
                onClick={() => {
                  const next = [...list];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  onChange(next);
                }}
                aria-label={lang === "fa" ? "انتقال به پایین" : "Move down"}
                className="size-6"
              >
                <ArrowDown className="size-3" />
              </Button>
            </div>
            <Input
              dir="ltr"
              value={item ?? ""}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...list];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="border-border bg-[var(--surface-1)] text-foreground"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onChange(list.filter((_, idx) => idx !== i))}
              aria-label={t("close")}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-xs italic text-muted-foreground">— —</p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...list, ""])}
      >
        <Plus className="size-4" /> {t("add")}
      </Button>
    </div>
  );
}

type ObjectFieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "stringlist" | "color" | "objectlist" | "file" | "checkbox";
  objectFields?: ObjectFieldDef[];
};

/**
 * Copy a gallery project into the Timeline/Résumé section as a new
 * "project" entry — saves an entire round of manual re-typing.
 * Module-level (no hooks) so SectionForm's switch cases stay hook-safe.
 */
async function duplicateProjectToResume(project: any, lang: Lang): Promise<void> {
  if (!project) return;
  try {
    const store = useContent.getState();
    const fallbackTimeline = lang === "fa" ? defaultContentFa.timeline : defaultContentEn.timeline;
    const timeline = store.content.timeline ?? fallbackTimeline;
    const entries = Array.isArray(timeline.entries) ? [...timeline.entries] : [];
    const slug = String(project.title || "project").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 40);
    const entry = {
      id: `project-${slug}-${Math.random().toString(36).slice(2, 7)}`,
      date: String(project.year || ""),
      title: String(project.title || ""),
      org: String(project.client || ""),
      description: String(project.description || ""),
      tags: [project.category, project.meta].map((x) => String(x || "").trim()).filter(Boolean),
      icon: "🎨",
      color: String(project.color || "var(--gfx-1)"),
      kind: "project",
    };
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "timeline", lang, data: { ...timeline, entries: [...entries, entry] } }),
    });
    if (!res.ok) throw new Error("save failed");
    await store.refreshContent();
    toast.success(lang === "fa"
      ? `«${project.title || "پروژه"}» به خط زمانی/رزومه اضافه شد — از بخش «خط زمانی و رزومه» ویرایشش کنید`
      : `“${project.title || "Project"}” added to Timeline/Résumé — edit it from the Timeline section`);
  } catch {
    toast.error(lang === "fa" ? "کپی به رزومه انجام نشد" : "Copy to résumé failed");
  }
}

function ObjectListField({
  label,
  items,
  onChange,
  fields,
  makeEmpty,
  renderPreview,
  itemActions,
}: {
  label: string;
  items: any[];
  onChange: (v: any[]) => void;
  fields: ObjectFieldDef[];
  makeEmpty: () => any;
  renderPreview?: (item: any, index: number, update: (next: any) => void) => ReactNode;
  /** Optional per-item extra action buttons (e.g. "copy to résumé"). */
  itemActions?: (item: any, index: number) => ReactNode;
}) {
  const t = useContent((s) => s.t);
  const lang = useContent((s) => s.lang);
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-3">
        {list.map((item, i) => (
          <div
            key={i}
            className="space-y-3 rounded-lg border border-border bg-[var(--surface-1)] p-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
              <div className="flex items-center gap-1">
                {itemActions?.(item, i)}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...list];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    onChange(next);
                  }}
                  aria-label={lang === "fa" ? "انتقال به بالا" : "Move up"}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={i === list.length - 1}
                  onClick={() => {
                    const next = [...list];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    onChange(next);
                  }}
                  aria-label={lang === "fa" ? "انتقال به پایین" : "Move down"}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onChange(list.filter((_, idx) => idx !== i))}
                  aria-label={t("close")}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
            {renderPreview?.(item, i, (nextItem) => {
              const next = [...list];
              next[i] = nextItem;
              onChange(next);
            })}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => {
                const val = (item as any)[f.key];
                if (f.type === "stringlist") {
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <StringListField
                        label={f.label}
                        values={Array.isArray(val) ? val : []}
                        onChange={(v) => {
                          const next = [...list];
                          next[i] = { ...item, [f.key]: v };
                          onChange(next);
                        }}
                      />
                    </div>
                  );
                }
                if (f.type === "objectlist") {
                  const subFields = f.objectFields ?? [];
                  const subItems = Array.isArray(val) ? val : [];
                  return (
                    <div key={f.key} className="sm:col-span-2 space-y-2 rounded-lg border border-border bg-background/40 p-2">
                      <FieldLabel>{f.label}</FieldLabel>
                      <div className="space-y-2">
                        {subItems.map((sub: any, si: number) => (
                          <div key={si} className="flex items-start gap-2">
                            {subFields.map((sf) => (
                              <div key={sf.key} className="flex-1">
                                {sf.type === "textarea" ? (
                                  <TextAreaField
                                    label={sf.label}
                                    value={sub[sf.key] ?? ""}
                                    onChange={(v) => {
                                      const nextSub = [...subItems];
                                      nextSub[si] = { ...sub, [sf.key]: v };
                                      const next = [...list];
                                      next[i] = { ...item, [f.key]: nextSub };
                                      onChange(next);
                                    }}
                                  />
                                ) : (
                                  <TextField
                                    label={sf.label}
                                    value={sub[sf.key] ?? ""}
                                    onChange={(v) => {
                                      const nextSub = [...subItems];
                                      nextSub[si] = { ...sub, [sf.key]: v };
                                      const next = [...list];
                                      next[i] = { ...item, [f.key]: nextSub };
                                      onChange(next);
                                    }}
                                  />
                                )}
                              </div>
                            ))}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="mt-5 shrink-0"
                              onClick={() => {
                                const nextSub = subItems.filter((_: any, idx: number) => idx !== si);
                                const next = [...list];
                                next[i] = { ...item, [f.key]: nextSub };
                                onChange(next);
                              }}
                              aria-label={t("close")}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const emptySub: any = {};
                          subFields.forEach((sf) => (emptySub[sf.key] = ""));
                          const nextSub = [...subItems, emptySub];
                          const next = [...list];
                          next[i] = { ...item, [f.key]: nextSub };
                          onChange(next);
                        }}
                      >
                        <Plus className="me-1 size-3.5" /> {t("addItem")}
                      </Button>
                    </div>
                  );
                }
                if (f.type === "textarea") {
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <TextAreaField
                        label={f.label}
                        value={val ?? ""}
                        onChange={(v) => {
                          const next = [...list];
                          next[i] = { ...item, [f.key]: v };
                          onChange(next);
                        }}
                      />
                    </div>
                  );
                }
                if (f.type === "checkbox") {
                  return (
                    <label key={f.key} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={val !== false}
                        onChange={(event) => {
                          const next = [...list];
                          next[i] = { ...item, [f.key]: event.target.checked };
                          onChange(next);
                        }}
                      />
                      {localizeCmsText(f.label, lang)}
                    </label>
                  );
                }
                if (f.type === "color") {
                  return (
                    <ColorField
                      key={f.key}
                      label={f.label}
                      value={val ?? ""}
                      onChange={(v) => {
                        const next = [...list];
                        next[i] = { ...item, [f.key]: v };
                        onChange(next);
                      }}
                    />
                  );
                }
                if (f.type === "file") {
                  return (
                    <div key={f.key} className="sm:col-span-2 space-y-1.5">
                      <FieldLabel>{f.label}</FieldLabel>
                      <Input
                        type="file"
                        accept=".glb,.gltf,.obj,.fbx,model/gltf-binary,model/gltf+json"
                        className="border-border bg-[var(--surface-1)] text-foreground"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const next = [...list];
                            next[i] = { ...item, [f.key]: String(reader.result || "") };
                            onChange(next);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <TextField
                        label="URL / data URL"
                        value={val ?? ""}
                        onChange={(v) => {
                          const next = [...list];
                          next[i] = { ...item, [f.key]: v };
                          onChange(next);
                        }}
                        dir="ltr"
                      />
                      <CmsMediaPicker
                        value={val ?? ""}
                        onChange={(v) => {
                          const next = [...list];
                          next[i] = { ...item, [f.key]: v };
                          onChange(next);
                        }}
                        lang={lang}
                        accept="model"
                      />
                    </div>
                  );
                }
                return (
                  <TextField
                    key={f.key}
                    label={f.label}
                    value={val ?? ""}
                    onChange={(v) => {
                      const next = [...list];
                      next[i] = { ...item, [f.key]: v };
                      onChange(next);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-xs italic text-muted-foreground">— —</p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...list, makeEmpty()])}
      >
        <Plus className="size-4" /> {t("addItem")}
      </Button>
    </div>
  );
}

/** Visual grouping for nested sub-objects (worlds / gallery / game). */
function SubsectionBox({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const lang = useContent((s) => s.lang);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-[var(--surface-1)]/60 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{localizeCmsText(title, lang)}</h4>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{localizeCmsText(hint, lang)}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** Free-form key/value pair list — each item is a Record<string, string>.
 *  Used by custom sections to give true point-by-point customization. */
function KVObjectListField({
  label,
  items,
  onChange,
}: {
  label: string;
  items: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
}) {
  const t = useContent((s) => s.t);
  const lang = useContent((s) => s.lang);
  const list = Array.isArray(items) ? items : [];

  const setItem = (i: number, next: Record<string, string>) => {
    const arr = [...list];
    arr[i] = next;
    onChange(arr);
  };

  const makeUniqueKey = (item: Record<string, string>, base: string): string => {
    if (!(base in item)) return base;
    let n = 1;
    while (`${base}_${n}` in item) n += 1;
    return `${base}_${n}`;
  };

  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-3">
        {list.map((item, i) => {
          const entries = Object.entries(item || {});
          return (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border bg-[var(--surface-1)] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">
                  #{i + 1}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onChange(list.filter((_, idx) => idx !== i))}
                  aria-label={t("close")}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              {entries.length === 0 && (
                <p className="text-xs italic text-muted-foreground">
                  — {lang === "fa" ? "بدون فیلد" : "no fields"} —
                </p>
              )}
              <div className="space-y-2">
                {entries.map(([k, v], ei) => (
                  <div key={ei} className="flex items-center gap-2">
                    <Input
                      dir="ltr"
                      value={k}
                      placeholder="key"
                      onChange={(e) => {
                        const nextKey = e.target.value || makeUniqueKey(item, "field");
                        if (nextKey === k) return;
                        const next: Record<string, string> = {};
                        for (const [kk, vv] of Object.entries(item)) {
                          if (kk === k) next[nextKey] = vv;
                          else next[kk] = vv;
                        }
                        setItem(i, next);
                      }}
                      className="w-1/3 shrink-0 border-border bg-background font-mono text-xs text-foreground"
                    />
                    <Input
                      value={v ?? ""}
                      placeholder="value"
                      onChange={(e) => setItem(i, { ...item, [k]: e.target.value })}
                      className="border-border bg-background text-sm text-foreground"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const next = { ...item };
                        delete next[k];
                        setItem(i, next);
                      }}
                      aria-label={t("close")}
                    >
                      <X className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItem(i, { ...item, [makeUniqueKey(item, "field")]: "" })
                }
              >
                <Plus className="size-3.5" />
                {lang === "fa" ? "فیلد" : "Field"}
              </Button>
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="text-xs italic text-muted-foreground">— —</p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...list, {}])}
      >
        <Plus className="size-4" /> {t("addItem")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Raw JSON editor (power-user escape hatch for any section)
 * ------------------------------------------------------------------ */

function RawJsonEditor({
  value,
  onApply,
}: {
  value: unknown;
  onApply: (next: Record<string, unknown>) => void;
}) {
  const lang = useContent((s) => s.lang);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  // Re-sync the textarea whenever the external `value` reference changes
  // (canonical "reset local editable state when source changes" pattern).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        setText(JSON.stringify(value, null, 2));
      } catch {
        setText("");
      }
      setError(null);
    });
    return () => cancelAnimationFrame(id);
  }, [value]);

  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(lang === "fa" ? "باید یک آبجکت باشد" : "must be a JSON object");
      }
      onApply(parsed as Record<string, unknown>);
      setError(null);
      setApplied(true);
      window.setTimeout(() => setApplied(false), 1500);
      toast.success(lang === "fa" ? "JSON اعمال شد" : "JSON applied");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-[var(--surface-1)]/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Braces className="size-4 text-muted-foreground" />
          <FieldLabel>
            {lang === "fa" ? "JSON خام این زبان" : "Raw JSON (this language)"}
          </FieldLabel>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="inline-flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3.5" /> {error}
            </span>
          )}
          {applied && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
              <Check className="size-3.5" /> {lang === "fa" ? "اعمال شد" : "applied"}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={apply} type="button">
            <Check className="size-4" />
            {lang === "fa" ? "اعمال" : "Apply"}
          </Button>
        </div>
      </div>
      <Textarea
        dir="ltr"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={18}
        spellCheck={false}
        className="min-h-72 resize-y border-border bg-background font-mono text-xs text-foreground"
      />
      <p className="text-[11px] text-muted-foreground">
        {lang === "fa"
          ? "ویرایش مستقیم JSON این بخش — روی «اعمال» بزنید سپس «ذخیره تغییرات» کنید."
          : "Edit this section's raw JSON directly. Click Apply, then Save changes to persist."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * New custom section dialog (inline, not window.prompt)
 * ------------------------------------------------------------------ */

function NewSectionDialog({
  onCreate,
  onCancel,
  busy,
  sectionOptions,
}: {
  onCreate: (label: string, iconKey: string, withPlanet: boolean, insertAfter: string | "end") => void;
  onCancel: () => void;
  busy: boolean;
  /** current page sections — for choosing where the new one lands */
  sectionOptions: { id: string; label: string }[];
}) {
  const lang = useContent((s) => s.lang);
  const [label, setLabel] = useState("");
  const [iconKey, setIconKey] = useState("file");
  const [withPlanet, setWithPlanet] = useState(true);
  const [insertAfter, setInsertAfter] = useState<string | "end">("end");

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-3 rounded-lg border border-border bg-background p-3 shadow-lg"
    >
      <p className="text-xs font-semibold text-foreground">
        {lang === "fa" ? "بخش سفارشی جدید (بدون محدودیت)" : "New custom section (unlimited)"}
      </p>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={lang === "fa" ? "برچسب (مثلاً: نظرات مشتریان)" : "Label (e.g. Testimonials)"}
        className="border-border bg-[var(--surface-1)] text-foreground"
        autoFocus
        disabled={busy}
        onKeyDown={(e) => {
          if (e.key === "Enter" && label.trim()) onCreate(label.trim(), iconKey, withPlanet, insertAfter);
          if (e.key === "Escape") onCancel();
        }}
      />
      <IconPickerGrid activeKey={iconKey} onPick={setIconKey} lang={lang} />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={withPlanet} onChange={(e) => setWithPlanet(e.target.checked)} disabled={busy} />
        {lang === "fa"
          ? "🪐 یک سیاره در منظومه صفحه اول برای این بخش بساز"
          : "🪐 Add a planet in the hero solar system for this section"}
      </label>
      <label className="block text-xs text-muted-foreground">
        <span className="mb-1 block font-medium">
          {lang === "fa" ? "📍 محل قرارگیری در صفحه" : "📍 Position on the page"}
        </span>
        <select
          value={insertAfter}
          onChange={(e) => setInsertAfter(e.target.value)}
          disabled={busy}
          className="h-9 w-full rounded-md border border-border bg-[var(--surface-1)] px-2 text-sm text-foreground"
        >
          <option value="end">
            {lang === "fa" ? "انتهای صفحه" : "End of the page"}
          </option>
          {sectionOptions.map((opt, i) => (
            <option key={opt.id} value={opt.id}>
              {lang === "fa" ? `بعد از ${i + 1}ـ ${opt.label}` : `After #${i + 1} · ${opt.label}`}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[10px]">
          {lang === "fa"
            ? "شماره‌گذاری و ترتیب بقیه بخش‌ها خودکار به‌روز می‌شود."
            : "Ordering and numbering of the other sections updates automatically."}
        </span>
      </label>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          {lang === "fa" ? "انصراف" : "Cancel"}
        </Button>
        <Button
          size="sm"
          disabled={!label.trim() || busy}
          onClick={() => onCreate(label.trim(), iconKey, withPlanet, insertAfter)}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {lang === "fa" ? "ایجاد" : "Create"}
        </Button>
      </div>
    </motion.div>
  );
}

function SecuritySettingsDialog({
  onClose,
  onFactoryReset,
}: {
  onClose: () => void;
  onFactoryReset: () => Promise<void>;
}) {
  const lang = useContent((s) => s.lang);
  const logout = useContent((s) => s.logout);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [passwordManaged, setPasswordManaged] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/settings", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setTwoFactorEnabled(!!json.twoFactorEnabled);
        setPasswordManaged(!!json.passwordManagedInDatabase);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void refresh();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const changePassword = async () => {
    if (newPassword.length < 12) {
      toast.error(lang === "fa" ? "رمز جدید حداقل باید ۱۲ کاراکتر باشد" : "New password must be at least 12 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(lang === "fa" ? "تکرار رمز با رمز جدید یکی نیست" : "Password confirmation does not match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change-password", currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "failed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordManaged(true);
      toast.success(lang === "fa" ? "رمز عبور تغییر کرد" : "Password changed");
      await logout();
    } catch {
      toast.error(lang === "fa" ? "تغییر رمز انجام نشد" : "Password change failed");
    } finally {
      setSaving(false);
    }
  };

  const generateSecret = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-2fa" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error("failed");
      setSecret(json.secret);
      setOtp("");
    } finally {
      setSaving(false);
    }
  };

  const enable2fa = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable-2fa", secret, code: otp }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error("failed");
      setTwoFactorEnabled(true);
      setSecret("");
      setOtp("");
      toast.success(lang === "fa" ? "تأیید دو مرحله‌ای فعال شد" : "Two-factor authentication enabled");
    } catch {
      toast.error(lang === "fa" ? "کد تأیید معتبر نیست" : "Verification code is invalid");
    } finally {
      setSaving(false);
    }
  };

  const disable2fa = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable-2fa", code: otp }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error("failed");
      setTwoFactorEnabled(false);
      setOtp("");
      toast.success(lang === "fa" ? "تأیید دو مرحله‌ای غیرفعال شد" : "Two-factor authentication disabled");
    } catch {
      toast.error(lang === "fa" ? "کد تأیید معتبر نیست" : "Verification code is invalid");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[160] grid place-items-center bg-background/80 p-5 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 18, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {lang === "fa" ? "تنظیمات امنیتی مدیریت محتوا" : "CMS security settings"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {passwordManaged
                ? (lang === "fa" ? "رمز عبور با hash در دیتابیس مدیریت می‌شود." : "Password is managed as a database hash.")
                : (lang === "fa" ? "هنوز از رمز env استفاده می‌شود؛ یک رمز جدید تنظیم کنید." : "Still using env password; set a new password.")}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label={lang === "fa" ? "بستن" : "Close"}>
            <X className="size-5" />
          </Button>
        </div>

        {loading ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <SubsectionBox title={lang === "fa" ? "تغییر رمز عبور" : "Change password"}>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: lang === "fa" ? "رمز فعلی" : "Current password", value: currentPassword, setter: setCurrentPassword },
                  { label: lang === "fa" ? "رمز جدید" : "New password", value: newPassword, setter: setNewPassword },
                  { label: lang === "fa" ? "تکرار رمز جدید" : "Confirm new password", value: confirmPassword, setter: setConfirmPassword },
                ].map((field) => (
                  <div key={field.label} className="space-y-1.5">
                    <FieldLabel>{field.label}</FieldLabel>
                    <Input
                      type="password"
                      dir="ltr"
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      className="border-border bg-[var(--surface-1)] text-foreground"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={changePassword} disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {lang === "fa" ? "ذخیره رمز جدید" : "Save new password"}
              </Button>
            </SubsectionBox>

            <SubsectionBox
              title={lang === "fa" ? "تأیید دو مرحله‌ای" : "Two-factor authentication"}
              hint={lang === "fa" ? "Secret را در Authenticator وارد کنید، سپس کد ۶ رقمی را تایید کنید." : "Add the secret to an authenticator app, then verify the 6-digit code."}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={twoFactorEnabled ? "text-emerald-500" : "text-muted-foreground"}>
                  {twoFactorEnabled ? (lang === "fa" ? "فعال" : "Enabled") : (lang === "fa" ? "غیرفعال" : "Disabled")}
                </span>
                {!twoFactorEnabled && (
                  <Button size="sm" variant="outline" onClick={generateSecret} disabled={saving}>
                    {lang === "fa" ? "ساخت secret جدید" : "Generate new secret"}
                  </Button>
                )}
              </div>
              {secret && (
                <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
                  <p className="break-all rounded-md bg-[var(--surface-1)] p-2 font-mono text-xs text-foreground" dir="ltr">
                    {secret}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      dir="ltr"
                      inputMode="numeric"
                      className="border-border bg-[var(--surface-1)] tracking-[0.35em] text-foreground"
                    />
                    <Button onClick={enable2fa} disabled={saving || otp.length !== 6}>
                      {lang === "fa" ? "فعال‌سازی 2FA" : "Enable 2FA"}
                    </Button>
                  </div>
                </div>
              )}
              {twoFactorEnabled && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={lang === "fa" ? "کد فعلی برای غیرفعال‌سازی" : "Current code to disable"}
                    dir="ltr"
                    inputMode="numeric"
                    className="border-border bg-[var(--surface-1)] tracking-[0.35em] text-foreground"
                  />
                  <Button variant="destructive" onClick={disable2fa} disabled={saving || otp.length !== 6}>
                    {lang === "fa" ? "غیرفعال‌سازی" : "Disable"}
                  </Button>
                </div>
              )}
            </SubsectionBox>

            <SubsectionBox
              title={lang === "fa" ? "بازگردانی کامل برنامه" : "Factory reset"}
              hint={lang === "fa" ? "تمام محتوا، فایل‌های آپلودی، بخش‌های سفارشی و رکوردها پاک می‌شوند و یک بوم خالی می‌ماند. تنظیمات امنیتی ادمین حفظ می‌شود." : "Deletes all content, uploads, custom sections and records, leaving a blank canvas. Admin security settings are kept."}
            >
              {confirmFactoryReset ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await onFactoryReset();
                      setConfirmFactoryReset(false);
                    }}
                    disabled={saving}
                  >
                    <AlertCircle className="size-4" />
                    {lang === "fa" ? "تأیید پاک‌سازی کامل" : "Confirm factory reset"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmFactoryReset(false)} disabled={saving}>
                    {lang === "fa" ? "لغو" : "Cancel"}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setConfirmFactoryReset(true)} disabled={saving}>
                  <Trash2 className="size-4" />
                  {lang === "fa" ? "پاک‌سازی و ساخت بوم خالی" : "Clear and create blank canvas"}
                </Button>
              )}
            </SubsectionBox>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Section form shell
 * ------------------------------------------------------------------ */

function FormShell({
  section,
  title,
  children,
  customNote,
}: {
  section: string;
  title: string;
  children: ReactNode;
  customNote?: boolean;
}) {
  const lang = useContent((s) => s.lang);
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">{localizeCmsText(title, lang)}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {customNote
            ? (lang === "fa" ? "بخش سفارشی؛ فیلدها را نقطه‌به‌نقطه ویرایش کنید. این بخش در پایگاه داده ذخیره می‌شود." : "Custom section. Edit every field individually; this section is stored in the database.")
            : (lang === "fa" ? "همه فیلدهای این بخش قابل ویرایش‌اند؛ برای ثبت، «ذخیره تغییرات» را بزنید." : "Every field in this section is editable. Select Save changes to publish your edits.")}
        </p>
      </div>
      <Separator />
      {children}
      <Separator />
      <p className="font-mono text-[10px] text-muted-foreground">
        {lang === "fa" ? "شناسه بخش" : "Section ID"}: {section}
      </p>
    </div>
  );
}

function PlanetViewControls({
  value,
  onChange,
}: {
  value: Partial<PlanetViewConfig> | undefined;
  onChange: (v: PlanetViewConfig) => void;
}) {
  const view: PlanetViewConfig = { ...DEFAULT_PLANET_VIEW, ...(value ?? {}) };
  const set = (key: keyof PlanetViewConfig, next: number) => onChange({ ...view, [key]: next });

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      <NumberField label="Camera X" value={view.cameraX} min={-40} max={40} step={0.5} onChange={(v) => set("cameraX", v)} />
      <NumberField label="Camera Y" value={view.cameraY} min={-20} max={60} step={0.5} onChange={(v) => set("cameraY", v)} />
      <NumberField label="Camera Z" value={view.cameraZ} min={12} max={90} step={0.5} onChange={(v) => set("cameraZ", v)} />
      <NumberField label="Target Y" value={view.targetY} min={-20} max={20} step={0.25} onChange={(v) => set("targetY", v)} />
      <NumberField label="Tilt X" value={view.systemTiltX} min={-85} max={85} step={1} onChange={(v) => set("systemTiltX", v)} />
      <NumberField label="Tilt Z" value={view.systemTiltZ} min={-45} max={45} step={1} onChange={(v) => set("systemTiltZ", v)} />
      <NumberField label="Orbit scale" value={view.orbitScale} min={0.15} max={1.3} step={0.01} onChange={(v) => set("orbitScale", v)} />
      <NumberField label="Planet scale" value={view.planetScale} min={0.08} max={0.8} step={0.01} onChange={(v) => set("planetScale", v)} />
      <NumberField label="Moon scale" value={view.moonScale} min={0.06} max={0.5} step={0.01} onChange={(v) => set("moonScale", v)} />
      <NumberField label="Label scale" value={view.labelScale} min={0} max={2} step={0.05} onChange={(v) => set("labelScale", v)} />
    </div>
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeDefaults<T>(defaults: T, incoming: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(incoming) ? incoming : defaults) as T;
  }

  if (isObjectRecord(defaults)) {
    const source = isObjectRecord(incoming) ? incoming : {};
    const output: Record<string, unknown> = {};

    Object.keys(defaults).forEach((key) => {
      output[key] = mergeDefaults(defaults[key], source[key]);
    });

    Object.keys(source).forEach((key) => {
      if (!(key in output)) output[key] = source[key];
    });

    return output as T;
  }

  return (incoming ?? defaults) as T;
}

function BackgroundMiniPreview({ value }: { value: SiteContent["design"]["background"] }) {
  const blobs = value.blobs ?? [];
  return (
    <div className="relative h-36 overflow-hidden rounded-xl border border-border bg-background">
      <div className="absolute inset-0" style={{ background: value.baseColor || "var(--ink)" }} />
      {blobs.slice(0, 8).map((blob, index) => (
        <div
          key={index}
          className="absolute rounded-full"
          style={{
            top: blob.top,
            left: blob.left,
            width: `${Math.max(8, Number(blob.size || 32) / 2)}%`,
            aspectRatio: "1",
            background: `radial-gradient(circle, ${blob.color}, transparent 68%)`,
            filter: `blur(${Math.max(4, Number(value.blur || 70) / 5)}px)`,
            opacity: value.opacity,
            mixBlendMode: (value.blendMode || "screen") as React.CSSProperties["mixBlendMode"],
            transform: `translate(-50%, -50%) scale(${1 + index * 0.02})`,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, transparent 35%, rgba(0,0,0,${Math.min(0.9, Number(value.vignetteStrength || 0.7))}) 100%)`,
        }}
      />
      <div className="absolute bottom-2 left-2 rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[10px] font-mono text-white/70">
        speed {value.speed} · blur {value.blur}
      </div>
    </div>
  );
}

function CursorMiniPreview({ value }: { value: SiteContent["design"]["cursor"] }) {
  const color = value.colors?.gfx || "var(--gfx-1)";
  const ringSize = Math.max(16, Number(value.ringSize || 32));
  const hoverSize = Math.max(ringSize, Number(value.ringHoverSize || 56));
  const dotSize = Math.max(3, Number(value.dotSize || 8));
  return (
    <div className="relative h-36 overflow-hidden rounded-xl border border-border bg-background/70">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_35%,rgba(255,255,255,0.08),transparent_35%)]" />
      {value.trailEnabled && Array.from({ length: Math.min(10, Number(value.trailLength || 0)) }).map((_, index) => {
        const size = Math.max(4, Number(value.trailSize || 18) - index);
        return (
          <span
            key={index}
            className="absolute rounded-full blur-sm"
            style={{
              left: `${24 + index * 6}%`,
              top: `${68 - index * 4}%`,
              width: size,
              height: size,
              background: value.trailColor === "auto" ? color : value.trailColor,
              opacity: Math.max(0.02, Number(value.trailOpacity || 0.2) * (1 - index / 12)),
            }}
          />
        );
      })}
      <span
        className="absolute rounded-full border"
        style={{
          left: "55%",
          top: "44%",
          width: hoverSize,
          height: hoverSize,
          marginLeft: -hoverSize / 2,
          marginTop: -hoverSize / 2,
          borderColor: colorWithPreviewAlpha(color, Number(value.ringOpacity || 0.7)),
          borderWidth: Number(value.ringBorderWidth || 1),
          boxShadow: `0 0 24px ${colorWithPreviewAlpha(color, Number(value.ringOpacity || 0.7))}`,
        }}
      />
      <span
        className="absolute rounded-full"
        style={{
          left: "55%",
          top: "44%",
          width: dotSize,
          height: dotSize,
          marginLeft: -dotSize / 2,
          marginTop: -dotSize / 2,
          background: colorWithPreviewAlpha(color, Number(value.dotOpacity || 1)),
        }}
      />
      <span
        className="absolute rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[10px] font-bold tracking-[0.2em]"
        style={{ left: `calc(55% + ${value.labelOffsetX}px)`, top: `calc(44% + ${value.labelOffsetY}px)`, color }}
      >
        {value.labels?.gfx || "HOVER"}
      </span>
    </div>
  );
}

function PositionPad({ x, y, label, onChange }: { x: number; y: number; label: string; onChange: (x: number, y: number) => void }) {
  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(
      Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))),
      Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)))
    );
  };
  return (
    <div className="mb-4 space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className="relative h-44 touch-none overflow-hidden rounded-xl border border-dashed border-border bg-[radial-gradient(circle_at_25%_70%,color-mix(in_oklch,var(--ai-1)_25%,transparent),transparent_35%),var(--background)]"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          update(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event);
        }}
      >
        <div className="absolute inset-x-4 top-4 h-px bg-border/50" />
        <div className="absolute inset-y-4 left-1/2 w-px bg-border/30" />
        <div
          className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-[var(--ai-1)] bg-background/70 shadow-[0_0_30px_color-mix(in_oklch,var(--ai-1)_45%,transparent)]"
          style={{ left: `${Math.max(0, Math.min(100, x))}%`, top: `${Math.max(0, Math.min(100, y))}%` }}
        >
          <Brain className="size-5 text-[var(--ai-1)]" />
        </div>
        <span className="absolute bottom-2 end-3 font-mono text-[10px] text-muted-foreground">X {x}% · Y {y}%</span>
      </div>
    </div>
  );
}

function ObjectMiniPreview({ item, onChange }: { item: Partial<SceneObject3DConfig>; onChange?: (next: Partial<SceneObject3DConfig>) => void }) {
  const colorA = item.colorA || "var(--gfx-1)";
  const colorB = item.colorB || "var(--sec-1)";
  const colorC = item.colorA ? item.colorC || "var(--ai-1)" : "var(--ai-1)";
  const scale = Math.max(0.4, Number(item.scale || 1));
  const kind = item.kind || "crystal";
  const side = item.domSide || "end";
  const horizontal = Number.isFinite(Number(item.domX))
    ? Math.max(0, Math.min(100, Number(item.domX)))
    : side === "start" ? 15 : side === "end" ? 85 : 50;
  const top = Math.min(100, Math.max(0, Number(item.domTop ?? 10)));
  const updatePosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const domX = Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)));
    const domTop = Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)));
    onChange({ ...item, domX, domTop, domSide: "center" });
  };
  return (
    <div
      className="relative h-36 touch-none overflow-hidden rounded-xl border border-border bg-background/70"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updatePosition(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePosition(event);
      }}
      title="Drag to place the object anywhere in its section"
    >
      {/* placement mini-map: where the object sits inside its section.
          Mirrors ambientPlacementStyle() — logical side flips for fa/RTL. */}
      <div className="absolute inset-y-2 start-2 w-16 overflow-hidden rounded-lg border border-dashed border-border/70 bg-surface-1">
        <div className="absolute inset-x-1 top-1 h-1 rounded-full bg-muted-foreground/20" />
        <div className="absolute inset-x-1 top-[calc(100%*0.35+0.25rem)] h-1 rounded-full bg-muted-foreground/15" />
        <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-muted-foreground/15" />
        <div
          className="absolute h-4 w-4 rounded-full border"
          style={{
            top: `calc(${top}% - 0.5rem)`,
            left: `calc(${horizontal}% - 0.5rem)`,
            background: `radial-gradient(circle at 35% 30%, ${colorA}, transparent 75%)`,
            borderColor: colorA,
            boxShadow: `0 0 8px ${colorA}`,
          }}
        />
        <span className="absolute bottom-0.5 end-1 font-mono text-[8px] text-muted-foreground/70">
          {horizontal}%, {top}%
        </span>
      </div>
      <div className="absolute inset-y-0 start-20 end-0 grid place-items-center">
        {item.modelUrl ? <Media3DPreview url={item.modelUrl} className="h-full w-full" /> :
        <div
          className={cn(
            "relative h-20 w-20 border border-white/25 bg-white/10 shadow-2xl backdrop-blur-xl",
            kind === "glass-blob" && "rounded-[42%_58%_48%_52%/54%_42%_58%_46%]",
            kind === "crystal" && "rotate-45 rounded-xl",
            kind === "orbit" && "rounded-full",
            kind === "neural" && "rounded-[35%]",
            kind === "model" && "rounded-2xl"
          )}
          style={{
            transform: `translate3d(${Number(item.x || 0) * 3}px, ${-Number(item.y || 0) * 3}px, 0) rotateX(${Number(item.rotateX || 0)}deg) rotateY(${Number(item.rotateY || 0)}deg) rotateZ(${Number(item.rotateZ || 0)}deg) scale(${scale})`,
            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.75), transparent 18%), linear-gradient(135deg, ${colorA}, ${colorB} 52%, ${colorC})`,
            opacity: item.enabled === false ? 0.25 : Number(item.opacity || 0.7),
            boxShadow: `0 0 34px ${colorA}`,
          }}
        >
          <span className="absolute inset-2 rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(255,255,255,0.45),transparent_30%),radial-gradient(circle_at_75%_70%,rgba(255,180,80,0.55),transparent_34%)] blur-[1px]" />
        </div>}
      </div>
      <div className="absolute bottom-2 left-2 rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[10px] font-mono text-white/70">
        {kind} · {item.slot || "custom"}
      </div>
    </div>
  );
}

function FormGraphPreview({ form }: { form: FormBuilderConfig["forms"][number] }) {
  const steps = form.steps ?? [];
  const edges = form.edges ?? [];
  return (
    <div className="relative min-h-40 overflow-hidden rounded-xl border border-border bg-background/70 p-3">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_28%)]" />
      <div className="relative flex flex-wrap items-center gap-3">
        {steps.map((step, index) => (
          <div key={step.id} className="relative rounded-xl border border-border bg-[var(--surface-1)] px-3 py-2 text-xs">
            <div className="font-mono text-[10px] text-muted-foreground">{step.id}</div>
            <div className="max-w-28 truncate font-semibold text-foreground">{step.title || step.id}</div>
            {index < steps.length - 1 && <span className="absolute -right-3 top-1/2 h-px w-3 bg-border" />}
          </div>
        ))}
      </div>
      <div className="relative mt-3 space-y-1 text-[10px] text-muted-foreground">
        {edges.slice(0, 6).map((edge) => (
          <div key={edge.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1">
            <Workflow className="size-3" />
            <span className="font-mono">{edge.fromStepId}</span>
            <span>→</span>
            <span className="font-mono">{edge.toStepId}</span>
            <span className="truncate">if {edge.operator} {edge.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function colorWithPreviewAlpha(color: string, alpha: number) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex;
    return `rgba(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}, ${alpha})`;
  }
  if (color.startsWith("oklch(")) return color.replace(")", ` / ${alpha})`);
  return color;
}

/* ------------------------------------------------------------------ *
 * Per-section form dispatcher
 * ------------------------------------------------------------------ */

export interface SectionsManagerProps {
  customSections: CustomSection[];
  onDuplicate: (sourceKey: string) => Promise<void>;
  onDeleteCustom: (key: string) => Promise<void>;
  onCreateCustom: (label: string, iconKey: string, withPlanet: boolean, insertAfter: string | "end") => Promise<void>;
  persistBuilderSections: (sections: BuilderConfig["sections"]) => Promise<boolean>;
  persistPlanets: (planetsFa: PlanetConfig[], planetsEn: PlanetConfig[]) => Promise<boolean>;
}

function MeteorControlsForm({ draft, setDraft }: { draft: SiteContent["meteors"]; setDraft: (value: SiteContent["meteors"]) => void }) {
  const lang = useContent((s) => s.lang);
  const ambient = draft.ambient;
  const shower = draft.shower;
  const setAmbient = (key: keyof typeof ambient, value: unknown) => setDraft({ ...draft, ambient: { ...ambient, [key]: value } });
  const setShower = (key: keyof typeof shower, value: unknown) => setDraft({ ...draft, shower: { ...shower, [key]: value } });
  const styles = [
    { value: "realistic", label: lang === "fa" ? "واقع‌گرایانه" : "Realistic" },
    { value: "aurora", label: lang === "fa" ? "شفقی" : "Aurora" },
    { value: "minimal", label: lang === "fa" ? "مینیمال" : "Minimal" },
  ];
  return (
    <FormShell section="meteors" title={lang === "fa" ? "کنترل مستقل شهاب‌ها" : "Dedicated Meteor Controls"}>
      <SubsectionBox title={lang === "fa" ? "شهاب‌های تصادفی پس‌زمینه" : "Random Background Meteors"} hint={lang === "fa" ? "تعداد، زمان‌بندی، مسیر، فرم و محدوده ظهور شهاب‌های خودکار." : "Control timing, count, path, shape and spawn region for ambient meteors."}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={ambient.enabled !== false} onChange={(e) => setAmbient("enabled", e.target.checked)} />{lang === "fa" ? "فعال" : "Enabled"}</label>
          <NumberField label={lang === "fa" ? "کمترین فاصله زمانی (ثانیه)" : "Minimum interval (seconds)"} value={ambient.minIntervalSec} min={3} max={120} step={1} onChange={(x) => setAmbient("minIntervalSec", x)} />
          <NumberField label={lang === "fa" ? "بیشترین فاصله زمانی (ثانیه)" : "Maximum interval (seconds)"} value={ambient.maxIntervalSec} min={5} max={180} step={1} onChange={(x) => setAmbient("maxIntervalSec", x)} />
          <NumberField label={lang === "fa" ? "تعداد در هر عبور" : "Meteors per pass"} value={ambient.streaksPerPass} min={1} max={12} step={1} onChange={(x) => setAmbient("streaksPerPass", x)} />
          <TextField label={lang === "fa" ? "رنگ (auto یعنی سفید ستاره‌ای)" : "Color (auto uses star white)"} value={ambient.color} onChange={(x) => setAmbient("color", x)} dir="ltr" />
          <NumberField label={lang === "fa" ? "زمان پرواز (میلی‌ثانیه)" : "Flight duration (ms)"} value={ambient.durationMs} min={800} max={8000} step={100} onChange={(x) => setAmbient("durationMs", x)} />
          <ChoiceField label={lang === "fa" ? "سبک شهاب" : "Meteor style"} value={ambient.style} options={styles} onChange={(x) => setAmbient("style", x)} />
          <ChoiceField label={lang === "fa" ? "مسیر حرکت" : "Direction"} value={ambient.direction} options={[
            { value: "alternating", label: lang === "fa" ? "یکی‌درمیان" : "Alternating" }, { value: "random", label: lang === "fa" ? "تصادفی" : "Random" },
            { value: "left-to-right", label: lang === "fa" ? "چپ به راست" : "Left to right" }, { value: "right-to-left", label: lang === "fa" ? "راست به چپ" : "Right to left" },
          ]} onChange={(x) => setAmbient("direction", x)} />
          <NumberField label={lang === "fa" ? "کمترین زاویه" : "Minimum angle"} value={ambient.angleMin} min={3} max={60} step={1} onChange={(x) => setAmbient("angleMin", x)} />
          <NumberField label={lang === "fa" ? "بیشترین زاویه" : "Maximum angle"} value={ambient.angleMax} min={3} max={70} step={1} onChange={(x) => setAmbient("angleMax", x)} />
          <NumberField label={lang === "fa" ? "کمترین طول دنباله" : "Minimum trail length"} value={ambient.lengthMin} min={40} max={500} step={5} onChange={(x) => setAmbient("lengthMin", x)} />
          <NumberField label={lang === "fa" ? "بیشترین طول دنباله" : "Maximum trail length"} value={ambient.lengthMax} min={40} max={700} step={5} onChange={(x) => setAmbient("lengthMax", x)} />
          <NumberField label={lang === "fa" ? "ضخامت دنباله" : "Trail thickness"} value={ambient.thickness} min={0.4} max={4} step={0.05} onChange={(x) => setAmbient("thickness", x)} />
          <NumberField label={lang === "fa" ? "شدت درخشش" : "Glow intensity"} value={ambient.glow} min={0} max={1} step={0.05} onChange={(x) => setAmbient("glow", x)} />
          <NumberField label={lang === "fa" ? "اندازه هسته" : "Head size"} value={ambient.headSize} min={1} max={12} step={0.2} onChange={(x) => setAmbient("headSize", x)} />
          <NumberField label={lang === "fa" ? "ابتدای محدوده عمودی (درصد)" : "Spawn region top (%)"} value={ambient.spawnTop} min={0} max={90} step={1} onChange={(x) => setAmbient("spawnTop", x)} />
          <NumberField label={lang === "fa" ? "انتهای محدوده عمودی (درصد)" : "Spawn region bottom (%)"} value={ambient.spawnBottom} min={5} max={100} step={1} onChange={(x) => setAmbient("spawnBottom", x)} />
        </div>
      </SubsectionBox>
      <SubsectionBox title={lang === "fa" ? "بارش شهاب تعاملی" : "Interactive Meteor Shower"} hint={lang === "fa" ? "با تکان سریع نشانگر فعال می‌شود و تنظیمات مستقل دارد." : "Triggered by a quick pointer shake and configured independently."}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={shower.enabled !== false} onChange={(e) => setShower("enabled", e.target.checked)} />{lang === "fa" ? "فعال" : "Enabled"}</label>
          <TextField label={lang === "fa" ? "ایموجی سفارشی" : "Custom emoji"} value={shower.emoji} onChange={(x) => setShower("emoji", x)} />
          <ColorField label={lang === "fa" ? "رنگ شهاب" : "Meteor color"} value={shower.color} onChange={(x) => setShower("color", x)} />
          <ChoiceField label={lang === "fa" ? "سبک بارش" : "Shower style"} value={shower.style} options={styles} onChange={(x) => setShower("style", x)} />
          <ChoiceField label={lang === "fa" ? "مدل هسته" : "Meteor head"} value={shower.headStyle} options={[
            { value: "comet", label: lang === "fa" ? "هسته طبیعی" : "Natural comet" }, { value: "star", label: lang === "fa" ? "ستاره" : "Star" },
            { value: "diamond", label: lang === "fa" ? "الماسی" : "Diamond" }, { value: "none", label: lang === "fa" ? "بدون هسته" : "No head" }, { value: "emoji", label: lang === "fa" ? "ایموجی" : "Emoji" },
          ]} onChange={(x) => setShower("headStyle", x)} />
          <NumberField label={lang === "fa" ? "تعداد شهاب‌ها" : "Meteor count"} value={shower.density} min={4} max={60} step={1} onChange={(x) => setShower("density", x)} />
          <NumberField label={lang === "fa" ? "زمان نمایش (میلی‌ثانیه)" : "Display duration (ms)"} value={shower.durationMs} min={600} max={8000} step={100} onChange={(x) => setShower("durationMs", x)} />
          <NumberField label={lang === "fa" ? "فاصله بین اجراها" : "Cooldown (ms)"} value={shower.cooldownMs} min={1000} max={60000} step={500} onChange={(x) => setShower("cooldownMs", x)} />
          <NumberField label={lang === "fa" ? "حساسیت حرکت نشانگر" : "Pointer trigger sensitivity"} value={shower.triggerSpeed} min={0.3} max={8} step={0.1} onChange={(x) => setShower("triggerSpeed", x)} />
          <ChoiceField label={lang === "fa" ? "مسیر بارش" : "Shower direction"} value={shower.direction} options={[
            { value: "end", label: lang === "fa" ? "به انتهای صفحه" : "Toward page end" }, { value: "start", label: lang === "fa" ? "به ابتدای صفحه" : "Toward page start" },
            { value: "down", label: lang === "fa" ? "دوطرفه رو به پایین" : "Downward from both sides" }, { value: "random", label: lang === "fa" ? "کاملاً تصادفی" : "Fully random" },
          ]} onChange={(x) => setShower("direction", x)} />
          <NumberField label={lang === "fa" ? "کمترین زاویه" : "Minimum angle"} value={shower.angleMin} min={3} max={60} step={1} onChange={(x) => setShower("angleMin", x)} />
          <NumberField label={lang === "fa" ? "بیشترین زاویه" : "Maximum angle"} value={shower.angleMax} min={3} max={70} step={1} onChange={(x) => setShower("angleMax", x)} />
          <NumberField label={lang === "fa" ? "کمترین طول" : "Minimum length"} value={shower.lengthMin} min={40} max={500} step={5} onChange={(x) => setShower("lengthMin", x)} />
          <NumberField label={lang === "fa" ? "بیشترین طول" : "Maximum length"} value={shower.lengthMax} min={40} max={700} step={5} onChange={(x) => setShower("lengthMax", x)} />
          <NumberField label={lang === "fa" ? "ضخامت" : "Thickness"} value={shower.thickness} min={0.4} max={4} step={0.05} onChange={(x) => setShower("thickness", x)} />
          <NumberField label={lang === "fa" ? "درخشش" : "Glow"} value={shower.glow} min={0} max={1} step={0.05} onChange={(x) => setShower("glow", x)} />
          <NumberField label={lang === "fa" ? "اندازه هسته" : "Head size"} value={shower.headSize} min={1} max={12} step={0.2} onChange={(x) => setShower("headSize", x)} />
          <NumberField label={lang === "fa" ? "پراکندگی عمودی (درصد)" : "Vertical spread (%)"} value={shower.spread} min={10} max={90} step={1} onChange={(x) => setShower("spread", x)} />
        </div>
      </SubsectionBox>
    </FormShell>
  );
}

function PortfolioGalleryFields({ value, onChange, lang }: { value: SiteContent["graphics"]["gallery"]; onChange: (value: SiteContent["graphics"]["gallery"]) => void; lang: Lang }) {
  const setField = (key: keyof typeof value, next: unknown) => onChange({ ...value, [key]: next });
  return (
    <SubsectionBox title={lang === "fa" ? "رزومه و گالری کامل پروژه‌ها" : "Complete project résumé & gallery"} hint={lang === "fa" ? "برای هر پروژه تصاویر، مشخصات، نقش و چند لینک مستقل تعریف کنید." : "Define media, specifications, role and multiple destinations for every project."}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={lang === "fa" ? "عنوان گالری" : "Gallery title"} value={value.title} onChange={(x) => setField("title", x)} />
        <TextField label={lang === "fa" ? "متن دکمه ورود" : "Entry button"} value={value.enterLabel} onChange={(x) => setField("enterLabel", x)} />
        <div className="sm:col-span-2"><TextField label={lang === "fa" ? "زیرعنوان" : "Subtitle"} value={value.subtitle} onChange={(x) => setField("subtitle", x)} /></div>
      </div>
      <ObjectListField
        label={lang === "fa" ? "پروژه‌های رزومه" : "Résumé projects"}
        items={value.projects ?? []}
        onChange={(x) => setField("projects", x)}
        fields={[
          { key: "title", label: lang === "fa" ? "عنوان" : "Title", type: "text" },
          { key: "meta", label: "Meta", type: "text" },
          { key: "category", label: lang === "fa" ? "دسته" : "Category", type: "text" },
          { key: "color", label: lang === "fa" ? "رنگ" : "Color", type: "color" },
          { key: "year", label: lang === "fa" ? "سال" : "Year", type: "text" },
          { key: "client", label: lang === "fa" ? "کارفرما" : "Client", type: "text" },
          { key: "role", label: lang === "fa" ? "نقش" : "Role", type: "text" },
          { key: "description", label: lang === "fa" ? "توضیحات کامل" : "Full description", type: "textarea" },
          { key: "images", label: lang === "fa" ? "تصاویر یا رنگ‌ها" : "Images or colors", type: "stringlist" },
          { key: "specs", label: lang === "fa" ? "مشخصات" : "Specifications", type: "objectlist", objectFields: [{ key: "key", label: "Key", type: "text" }, { key: "value", label: "Value", type: "text" }] },
          { key: "links", label: lang === "fa" ? "لینک‌های پروژه" : "Project links", type: "objectlist", objectFields: [{ key: "label", label: "Label", type: "text" }, { key: "url", label: "URL", type: "text" }, { key: "kind", label: "live/source/github/docs/other", type: "text" }] },
          { key: "location", label: lang === "fa" ? "مکان (شهر/کشور یا Remote)" : "Location (city/country or Remote)", type: "text" },
          { key: "dates", label: lang === "fa" ? "بازه زمانی (مثلاً ۲۰۲۴ Q2 — Q4)" : "Period (e.g. 2024 Q2 — Q4)", type: "text" },
          { key: "status", label: lang === "fa" ? "وضعیت (completed/in-progress/…)" : "Status (completed/in-progress/…)", type: "text" },
          { key: "tags", label: lang === "fa" ? "برچسب‌ها" : "Tags", type: "stringlist" },
          { key: "process", label: lang === "fa" ? "روند پروژه (مرحله‌ها)" : "Project process (milestones)", type: "objectlist", objectFields: [{ key: "title", label: lang === "fa" ? "عنوان مرحله" : "Milestone", type: "text" }, { key: "date", label: lang === "fa" ? "تاریخ" : "Date", type: "text" }, { key: "description", label: lang === "fa" ? "توضیح" : "Description", type: "text" }] },
          { key: "videos", label: lang === "fa" ? "ویدیوها (mp4/webm + پوستر اختیاری)" : "Videos (mp4/webm + optional poster)", type: "objectlist", objectFields: [{ key: "url", label: "URL", type: "text" }, { key: "poster", label: lang === "fa" ? "پوستر" : "Poster", type: "text" }, { key: "label", label: lang === "fa" ? "عنوان" : "Label", type: "text" }] },
          { key: "featured", label: lang === "fa" ? "تصویر شاخص (URL — از تصاویر پروژه یا جداگانه)" : "Featured image (URL — from the project images or separate)", type: "text" },
        ]}
        makeEmpty={() => ({ title: "", meta: "", category: "", color: "#169cff", year: "", client: "", role: "", description: "", specs: [{ key: "", value: "" }], images: ["#169cff"], link: "", links: [{ label: "GitHub", url: "", kind: "github" }], location: "", dates: "", status: "completed", tags: [], process: [], videos: [] })}
      />
    </SubsectionBox>
  );
}

function SectionForm({
  section,
  draft,
  setDraft,
  sectionsManagerProps,
  viewportMode,
}: {
  section: SectionKey;
  draft: any;
  setDraft: (v: any) => void;
  sectionsManagerProps?: SectionsManagerProps;
  viewportMode?: CmsViewportMode;
}) {
  const lang = useContent((s) => s.lang);
  // `draft` can be null while a section's content row has not loaded yet —
  // treat it as an empty object so the form renders instead of crashing.
  const set = (k: string, v: any) => setDraft({ ...(draft ?? {}), [k]: v });

  switch (section) {
    /* ============ site ============ */
    case "site": {
      const v = (draft ?? {}) as SiteContent["site"];
      return (
        <FormShell section={section} title="سایت و ناوبری / Site & Nav">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label={lang === "fa" ? "نام برند بالای سایت" : "Header brand title"} value={v.brand} onChange={(x) => set("brand", x)} />
            <TextField label={lang === "fa" ? "پسوند برند بالای سایت" : "Header brand suffix"} value={v.brandYear} onChange={(x) => set("brandYear", x)} dir="ltr" />
            <TextField label={lang === "fa" ? "عنوان تب مرورگر" : "Browser tab title"} value={v.browserTitle} onChange={(x) => set("browserTitle", x)} />
            <ImageUploadField
              label={lang === "fa" ? "آیکون تب مرورگر (تصویر، آیکون یا SVG)" : "Browser tab icon (image, icon, or SVG)"}
              value={v.favicon}
              onChange={(x) => set("favicon", x)}
              lang={lang}
            />
            <TextField label="منوی گرافیک (navGraphics)" value={v.navGraphics} onChange={(x) => set("navGraphics", x)} />
            <TextField label="منوی امنیت (navSecurity)" value={v.navSecurity} onChange={(x) => set("navSecurity", x)} />
            <TextField label="منوی هوش مصنوعی (navAI)" value={v.navAI} onChange={(x) => set("navAI", x)} />
            <TextField label="منوی تماس (navContact)" value={v.navContact} onChange={(x) => set("navContact", x)} />
            <div className="sm:col-span-2">
              <TextField label="نشان وضعیت (statusBadge)" value={v.statusBadge} onChange={(x) => set("statusBadge", x)} />
            </div>
          </div>
        </FormShell>
      );
    }

    /* ============ hero ============ */
    case "hero": {
      const heroDefaults = lang === "fa" ? defaultContentFa.hero : defaultContentEn.hero;
      const v = mergeDefaults(heroDefaults, draft);
      const setHero = (k: keyof SiteContent["hero"], value: unknown) =>
        setDraft({ ...v, [k]: value });
      const setWorld = (
        world: keyof SiteContent["hero"]["worlds"],
        field: keyof SiteContent["hero"]["worlds"]["gfx"],
        value: string
      ) => {
        setHero("worlds", {
          ...v.worlds,
          [world]: { ...v.worlds[world], [field]: value },
        });
      };

      return (
        <FormShell section={section} title="بخش معرفی / Hero">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="بج (badge)" value={v.badge} onChange={(x) => setHero("badge", x)} />
            <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
              <TextField label="عنوان — خط ۱ (titleLine1)" value={v.titleLine1} onChange={(x) => setHero("titleLine1", x)} />
              <TextField label="کلمه‌ی هایلایت (titleHighlight)" value={v.titleHighlight} onChange={(x) => setHero("titleHighlight", x)} />
              <TextField label="عنوان — خط ۲ (titleLine2)" value={v.titleLine2} onChange={(x) => setHero("titleLine2", x)} />
            </div>
            <div className="sm:col-span-2">
              <TextAreaField label="توضیحات (description)" value={v.description} onChange={(x) => setHero("description", x)} />
            </div>
            <TextField label="دکمه‌ی اصلی (ctaPrimary)" value={v.ctaPrimary} onChange={(x) => setHero("ctaPrimary", x)} />
            <TextField label="دکمه‌ی ثانویه (ctaSecondary)" value={v.ctaSecondary} onChange={(x) => setHero("ctaSecondary", x)} />
          </div>

          <ObjectListField
            label="آمار (stats)"
            items={v.stats ?? []}
            onChange={(x) => setHero("stats", x)}
            fields={[
              { key: "value", label: "مقدار (value)", type: "text" },
              { key: "label", label: "برچسب (label)", type: "text" },
            ]}
            makeEmpty={() => ({ value: "", label: "" })}
          />

          <SubsectionBox
            title="کارت‌های جهان‌ها / Worlds"
            hint="برچسب و توضیح کوتاه سه آبجکت قدیمی hero.worlds"
          >
            <div className="grid gap-4 md:grid-cols-3">
              {(["gfx", "sec", "ai"] as const).map((world) => (
                <div key={world} className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
                  <FieldLabel>{world.toUpperCase()}</FieldLabel>
                  <TextField
                    label="برچسب (label)"
                    value={v.worlds[world].label}
                    onChange={(x) => setWorld(world, "label", x)}
                  />
                  <TextField
                    label="توضیح کوتاه (hint)"
                    value={v.worlds[world].hint}
                    onChange={(x) => setWorld(world, "hint", x)}
                  />
                </div>
              ))}
            </div>
          </SubsectionBox>

          <SubsectionBox
            title="سیارات / Planets — سیستم سیاره‌ای صفحه اول"
            hint="هر سیاره یک دنیای تخصصی است (hero.planets)"
          >
            <ObjectListField
              label="سیارات / Planets — سیستم سیاره‌ای صفحه اول"
              items={v.planets ?? []}
              onChange={(x) => setHero("planets", x)}
              fields={[
                { key: "id", label: "شناسه (id) — gfx/sec/ai یا سفارشی", type: "text" },
                { key: "label", label: "نام سیاره (label)", type: "text" },
                { key: "hint", label: "توضیح کوتاه (hint)", type: "text" },
                { key: "sectionId", label: "بخش هدف (sectionId) — graphics/security/ai/contact", type: "text" },
                { key: "color", label: "رنگ (color) — hex", type: "color" },
                { key: "texture", label: "بافت (texture) — gas-bands/cratered/swirly/ringed/nebula", type: "text" },
                { key: "size", label: "اندازه سیاره (size) — vmin", type: "text" },
                { key: "orbitRadius", label: "شعاع مدار (orbitRadius) — vmin", type: "text" },
                { key: "orbitPeriod", label: "دوره مداری (orbitPeriod) — ثانیه", type: "text" },
                { key: "orbitOffset", label: "انحراف اولیه (orbitOffset) — درجه 0-360", type: "text" },
                { key: "moonSize", label: "اندازه قمر (moonSize) — vmin", type: "text" },
                { key: "moonOrbitRadius", label: "شعاع مدار قمر (moonOrbitRadius) — vmin", type: "text" },
                { key: "moonOrbitPeriod", label: "دوره مدار قمر (moonOrbitPeriod) — ثانیه", type: "text" },
                { key: "moonOrbitOffset", label: "زاویه شروع قمر (moonOrbitOffset) — درجه", type: "text" },
                { key: "moonOrbitTiltX", label: "زاویه مسیر قمر X (moonOrbitTiltX) — درجه", type: "text" },
                { key: "moonOrbitTiltY", label: "زاویه مسیر قمر Y (moonOrbitTiltY) — درجه", type: "text" },
                { key: "moonOrbitTiltZ", label: "زاویه مسیر قمر Z (moonOrbitTiltZ) — درجه", type: "text" },
                { key: "moons", label: "قمرها / توانایی‌ها (moons)", type: "stringlist" },
              ]}
              makeEmpty={() => ({
                id: "planet-" + Date.now(),
                label: "",
                hint: "",
                sectionId: "graphics",
                color: "#8b5cf6",
                texture: "swirly",
                size: 8,
                orbitRadius: 25,
                orbitPeriod: 40,
                orbitOffset: 0,
                moonSize: 2,
                moonOrbitRadius: 7,
                moonOrbitPeriod: 10,
                moonOrbitOffset: 0,
                moonOrbitTiltX: 64,
                moonOrbitTiltY: 0,
                moonOrbitTiltZ: 0,
                moons: ["Skill 1", "Skill 2"],
              })}
            />
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
                <div>
                  <h5 className="text-sm font-semibold text-foreground">{lang === "fa" ? "زاویه دید منظومه" : "System point of view"}</h5>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lang === "fa" ? "دوربین، زاویه منظومه و مقیاس‌ها مستقیماً روی بخش معرفی و پیش‌نمایش اعمال می‌شوند." : "Camera, system angle and scales update the hero and preview directly."}
                  </p>
                </div>
                <PlanetViewControls
                  value={v.planetView}
                  onChange={(x) => setHero("planetView", x)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Live preview / پیش‌نمایش تنظیمات سیارات</FieldLabel>
                <PlanetScenePreview planets={v.planets ?? []} view={v.planetView} />
              </div>
            </div>
          </SubsectionBox>

          <SubsectionBox
            title="☀️ خورشید مرکزی = من / Central Star = Me"
            hint="با کلیک روی خورشید وسط صفحه اول، پروفایل و رزومه شما نمایش داده می‌شود (بخش Profile)."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={v.star?.enabled !== false}
                  onChange={(e) => setHero("star", { ...v.star, enabled: e.target.checked })}
                />
                {lang === "fa" ? "خورشید کلیک‌پذیر باشد" : "Star clickable"}
              </label>
              <ColorField label="رنگ خورشید (color)" value={v.star?.color ?? "#ffb35c"} onChange={(x) => setHero("star", { ...v.star, color: x })} />
              <TextField label="برچسب هاور (label)" value={v.star?.label ?? ""} onChange={(x) => setHero("star", { ...v.star, label: x })} />
              <TextField label="توضیح هاور (hint)" value={v.star?.hint ?? ""} onChange={(x) => setHero("star", { ...v.star, hint: x })} />
            </div>
          </SubsectionBox>
        </FormShell>
      );
    }

    /* ============ graphics ============ */
    case "graphics": {
      const v = draft as SiteContent["graphics"];
      const gallery = v.gallery ?? { title: "", subtitle: "", enterLabel: "", projects: [] };
      const setGallery = (field: keyof typeof gallery, val: any) =>
        set("gallery", { ...gallery, [field]: val });

      return (
        <FormShell section={section} title="گرافیک / Graphics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="شماره (index)" value={v.index} onChange={(x) => set("index", x)} dir="ltr" />
            <TextField label="ککر (kicker)" value={v.kicker} onChange={(x) => set("kicker", x)} dir="ltr" />
            <TextField label="عنوان (title)" value={v.title} onChange={(x) => set("title", x)} />
            <TextField label="کلمه‌ی هایلایت (highlight)" value={v.highlight} onChange={(x) => set("highlight", x)} />
            <div className="sm:col-span-2">
              <TextAreaField label="زیرعنوان (subtitle)" value={v.subtitle} onChange={(x) => set("subtitle", x)} />
            </div>
          </div>

          <ObjectListField
            label="پروژه‌ها (projects)"
            items={v.projects ?? []}
            onChange={(x) => set("projects", x)}
            fields={[
              { key: "title", label: "عنوان (title)", type: "text" },
              { key: "cat", label: "دسته (cat)", type: "text" },
              { key: "desc", label: "توضیحات (desc)", type: "textarea" },
              { key: "tag", label: "تگ (tag)", type: "text" },
            ]}
            makeEmpty={() => ({ title: "", cat: "", desc: "", tag: "" })}
          />

          <StringListField
            label="ابزارها (tools)"
            values={v.tools ?? []}
            onChange={(x) => set("tools", x)}
            placeholder="e.g. Figma"
          />

          <TextField
            label="متن دکمه (cta.label)"
            value={v.cta?.label ?? ""}
            onChange={(x) => set("cta", { label: x })}
          />

          <SubsectionBox
            title="گالری پروژه‌ها / Project Gallery"
            hint="graphics.gallery — پروژه‌های کامل با تصاویر، مشخصات و توضیحات. هر پروژه در پاپ‌آپ بزرگ نمایش داده می‌شود."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground/90">سبک نمایش گالری (gallery.layout)</span>
                <select
                  value={(gallery as { layout?: string }).layout ?? "cinematic"}
                  onChange={(e) => setGallery("layout", e.target.value)}
                  className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40"
                >
                  <option value="cinematic">{lang === "fa" ? "سینمایی (پیش‌فرض)" : "Cinematic (default)"}</option>
                  <option value="grid">{lang === "fa" ? "شبکه‌ای" : "Grid"}</option>
                  <option value="masonry">{lang === "fa" ? "آجرچین" : "Masonry"}</option>
                  <option value="spotlight">{lang === "fa" ? "اسپات‌لایت" : "Spotlight"}</option>
                  <option value="hall">{lang === "fa" ? "تالار سه‌بعدی (راهرو تعاملی)" : "3D Hall (interactive walkthrough)"}</option>
                </select>
              </label>
              <TextField label="عنوان گالری (gallery.title)" value={gallery.title ?? ""} onChange={(x) => setGallery("title", x)} />
              <TextField label="دکمه‌ی ورود (gallery.enterLabel)" value={gallery.enterLabel ?? ""} onChange={(x) => setGallery("enterLabel", x)} />
              <div className="sm:col-span-2">
                <TextField label="زیرعنوان گالری (gallery.subtitle)" value={gallery.subtitle ?? ""} onChange={(x) => setGallery("subtitle", x)} />
              </div>
            </div>

            <ObjectListField
              label="پروژه‌های گالری (gallery.projects) — تمپلیت پروژه"
              items={gallery.projects ?? []}
              onChange={(x) => setGallery("projects", x)}
              itemActions={(project) => (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  title={lang === "fa" ? "کپی به خط زمانی/رزومه" : "Copy to Timeline/Résumé"}
                  onClick={() => void duplicateProjectToResume(project, lang)}
                >
                  <History className="size-3.5" />
                </Button>
              )}
              fields={[
                { key: "title", label: "عنوان (title)", type: "text" },
                { key: "meta", label: "تگ‌لاین کوتاه (meta)", type: "text" },
                { key: "category", label: "دسته (category)", type: "text" },
                { key: "color", label: "رنگ اصلی (color)", type: "color" },
                { key: "year", label: "سال (year)", type: "text" },
                { key: "client", label: "کارفرما (client)", type: "text" },
                { key: "role", label: "نقش (role)", type: "text" },
                { key: "description", label: "توضیحات کامل (description)", type: "textarea" },
                { key: "link", label: "لینک خارجی (link)", type: "text" },
                { key: "links", label: "لینک‌های برنامه، سورس، GitHub و مستندات", type: "objectlist", objectFields: [
                  { key: "label", label: "عنوان لینک", type: "text" },
                  { key: "url", label: "URL", type: "text" },
                  { key: "kind", label: "نوع: live/source/github/docs/other", type: "text" },
                ]},
                { key: "images", label: "تصاویر (images) — URL یا کد رنگ", type: "stringlist" },
                { key: "specs", label: "مشخصات (specs) — key/value", type: "objectlist", objectFields: [
                  { key: "key", label: "کلید (key)", type: "text" },
                  { key: "value", label: "مقدار (value)", type: "text" },
                ]},
              ]}
              makeEmpty={() => ({
                title: "",
                meta: "",
                category: "",
                color: "#8b5cf6",
                year: "",
                client: "",
                role: "",
                description: "",
                link: "",
                links: [{ label: "GitHub", url: "", kind: "github" }],
                images: ["#8b5cf6"],
                specs: [{ key: "", value: "" }],
              })}
            />
          </SubsectionBox>
        </FormShell>
      );
    }

    /* ============ security ============ */
    case "security": {
      const v = draft as SiteContent["security"];
      const game = v.game ?? { title: "", subtitle: "" };
      const gallery = v.gallery ?? { title: "", subtitle: "", enterLabel: "", projects: [] };
      const setGame = (field: "title" | "subtitle", val: string) =>
        set("game", { ...game, [field]: val });

      return (
        <FormShell section={section} title="امنیت / Security">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="شماره (index)" value={v.index} onChange={(x) => set("index", x)} dir="ltr" />
            <TextField label="ککر (kicker)" value={v.kicker} onChange={(x) => set("kicker", x)} dir="ltr" />
            <TextField label="عنوان (title)" value={v.title} onChange={(x) => set("title", x)} />
            <TextField label="کلمه‌ی هایلایت (highlight)" value={v.highlight} onChange={(x) => set("highlight", x)} />
            <div className="sm:col-span-2">
              <TextAreaField label="زیرعنوان (subtitle)" value={v.subtitle} onChange={(x) => set("subtitle", x)} />
            </div>
          </div>

          <ObjectListField
            label="پروژه‌ها (projects)"
            items={v.projects ?? []}
            onChange={(x) => set("projects", x)}
            fields={[
              { key: "title", label: "عنوان (title)", type: "text" },
              { key: "cat", label: "دسته (cat)", type: "text" },
              { key: "desc", label: "توضیحات (desc)", type: "textarea" },
              { key: "metric", label: "متریک (metric)", type: "text" },
              { key: "metricLabel", label: "برچسب متریک (metricLabel)", type: "text" },
            ]}
            makeEmpty={() => ({ title: "", cat: "", desc: "", metric: "", metricLabel: "" })}
          />

          <ObjectListField
            label="مهارت‌ها (skills)"
            items={v.skills ?? []}
            onChange={(x) => set("skills", x)}
            fields={[{ key: "label", label: "برچسب (label)", type: "text" }]}
            makeEmpty={() => ({ label: "" })}
          />

          <StringListField
            label="گواهینامه‌ها (certs)"
            values={v.certs ?? []}
            onChange={(x) => set("certs", x)}
            placeholder="e.g. OSCP"
          />

          <TextField
            label="متن دکمه (cta.label)"
            value={v.cta?.label ?? ""}
            onChange={(x) => set("cta", { label: x })}
          />

          <SubsectionBox title="بازی امنیتی / Security Game" hint="security.game">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="عنوان بازی (game.title)" value={game.title ?? ""} onChange={(x) => setGame("title", x)} />
              <TextField label="زیرعنوان بازی (game.subtitle)" value={game.subtitle ?? ""} onChange={(x) => setGame("subtitle", x)} />
            </div>
          </SubsectionBox>
          <PortfolioGalleryFields value={gallery} onChange={(next) => set("gallery", next)} lang={lang} />
        </FormShell>
      );
    }

    /* ============ ai ============ */
    case "ai": {
      const v = draft as SiteContent["ai"];
      const game = v.game ?? { title: "", subtitle: "" };
      const gallery = v.gallery ?? { title: "", subtitle: "", enterLabel: "", projects: [] };
      const visual = v.visual ?? { enabled: true, label: "AI CORE", model: "NEURAL-7B", nodes: 18, speed: 1, scale: 1, x: 22, y: 66 };
      const setGame = (field: "title" | "subtitle", val: string) =>
        set("game", { ...game, [field]: val });

      return (
        <FormShell section={section} title="هوش مصنوعی / AI">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="شماره (index)" value={v.index} onChange={(x) => set("index", x)} dir="ltr" />
            <TextField label="ککر (kicker)" value={v.kicker} onChange={(x) => set("kicker", x)} dir="ltr" />
            <TextField label="عنوان (title)" value={v.title} onChange={(x) => set("title", x)} />
            <TextField label="کلمه‌ی هایلایت (highlight)" value={v.highlight} onChange={(x) => set("highlight", x)} />
            <div className="sm:col-span-2">
              <TextAreaField label="زیرعنوان (subtitle)" value={v.subtitle} onChange={(x) => set("subtitle", x)} />
            </div>
          </div>

          <ObjectListField
            label="پروژه‌ها (projects)"
            items={v.projects ?? []}
            onChange={(x) => set("projects", x)}
            fields={[
              { key: "title", label: "عنوان (title)", type: "text" },
              { key: "cat", label: "دسته (cat)", type: "text" },
              { key: "desc", label: "توضیحات (desc)", type: "textarea" },
              { key: "tags", label: "تگ‌ها (tags)", type: "stringlist" },
            ]}
            makeEmpty={() => ({ title: "", cat: "", desc: "", tags: [] })}
          />

          <StringListField
            label="استک (stack)"
            values={v.stack ?? []}
            onChange={(x) => set("stack", x)}
            placeholder="e.g. PyTorch"
          />

          <TextField
            label="متن دکمه (cta.label)"
            value={v.cta?.label ?? ""}
            onChange={(x) => set("cta", { label: x })}
          />

          <SubsectionBox title="بازی هوش مصنوعی / AI Game" hint="ai.game">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="عنوان بازی (game.title)" value={game.title ?? ""} onChange={(x) => setGame("title", x)} />
              <TextField label="زیرعنوان بازی (game.subtitle)" value={game.subtitle ?? ""} onChange={(x) => setGame("subtitle", x)} />
            </div>
          </SubsectionBox>
          <SubsectionBox title={lang === "fa" ? "آبجکت بصری هوش مصنوعی" : "AI visual object"} hint={lang === "fa" ? "موقعیت، مقیاس، مدل و حرکت آبجکت هولوگرافیک" : "Position, scale, model and motion of the holographic AI object"}>
            <PositionPad
              x={visual.x}
              y={visual.y}
              label={lang === "fa" ? "آبجکت را بکشید و در هر نقطه سکشن رها کنید" : "Drag the object anywhere inside the section"}
              onChange={(x, y) => set("visual", { ...visual, x, y })}
            />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <label className="flex items-center gap-2"><input type="checkbox" checked={visual.enabled} onChange={(e) => set("visual", { ...visual, enabled: e.target.checked })} />{lang === "fa" ? "فعال" : "Enabled"}</label>
              <TextField label={lang === "fa" ? "برچسب" : "Label"} value={visual.label} onChange={(x) => set("visual", { ...visual, label: x })} />
              <TextField label={lang === "fa" ? "نام مدل" : "Model name"} value={visual.model} onChange={(x) => set("visual", { ...visual, model: x })} />
              <NumberField label={lang === "fa" ? "تعداد گره" : "Nodes"} value={visual.nodes} min={8} max={32} step={1} onChange={(x) => set("visual", { ...visual, nodes: x })} />
              <NumberField label={lang === "fa" ? "سرعت" : "Speed"} value={visual.speed} min={0.25} max={3} step={0.05} onChange={(x) => set("visual", { ...visual, speed: x })} />
              <NumberField label={lang === "fa" ? "مقیاس" : "Scale"} value={visual.scale} min={0.55} max={1.6} step={0.05} onChange={(x) => set("visual", { ...visual, scale: x })} />
              <NumberField label="X %" value={visual.x} min={0} max={100} step={1} onChange={(x) => set("visual", { ...visual, x })} />
              <NumberField label="Y %" value={visual.y} min={0} max={100} step={1} onChange={(y) => set("visual", { ...visual, y })} />
            </div>
          </SubsectionBox>
          <PortfolioGalleryFields value={gallery} onChange={(next) => set("gallery", next)} lang={lang} />
        </FormShell>
      );
    }

    /* ============ synthesis ============ */
    case "synthesis": {
      const v = draft as SiteContent["synthesis"];
      return (
        <FormShell section={section} title="ترکیب / Synthesis">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="عنوان — شروع (title)" value={v.title} onChange={(x) => set("title", x)} />
            <TextField label="هایلایت ۱ (highlight1)" value={v.highlight1} onChange={(x) => set("highlight1", x)} />
            <TextField label="هایلایت ۲ (highlight2)" value={v.highlight2} onChange={(x) => set("highlight2", x)} />
            <TextField label="هایلایت ۳ (highlight3)" value={v.highlight3} onChange={(x) => set("highlight3", x)} />
            <TextField label="عنوان — خط ۲ (titleLine2)" value={v.titleLine2} onChange={(x) => set("titleLine2", x)} />
            <div className="sm:col-span-2">
              <TextAreaField label="زیرعنوان (subtitle)" value={v.subtitle} onChange={(x) => set("subtitle", x)} />
            </div>
            <div className="sm:col-span-2">
              <TextField label="متن دکمه (cta)" value={v.cta} onChange={(x) => set("cta", x)} />
            </div>
          </div>
        </FormShell>
      );
    }

    /* ============ timeline ============ */
    case "timeline": {
      return (
        <FormShell section={section} title="خط زمانی / Timeline — مسیر حرفه‌ای">
          <TimelineForm draft={draft} setDraft={setDraft} />
        </FormShell>
      );
    }

    /* ============ profile ============ */
    case "profile": {
      return (
        <FormShell section={section} title={lang === "fa" ? "درباره من و رزومه — با کلیک روی خورشید نمایش داده می‌شود" : "About Me & Résumé — opens by clicking the sun"}>
          <ProfileForm draft={draft} setDraft={setDraft} />
        </FormShell>
      );
    }

    /* ============ music ============ */
    case "music": {
      return (
        <FormShell section={section} title="موسیقی و پلیر / Music Player — آپلود، Spotify، اکولایزر و رقص سیارات">
          <MusicForm draft={draft} setDraft={setDraft} />
        </FormShell>
      );
    }

    /* ============ footer ============ */
    case "footer": {
      const v = draft as SiteContent["footer"];
      return (
        <FormShell section={section} title="فوتر / Footer">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="بج (badge)" value={v.badge} onChange={(x) => set("badge", x)} />
            <TextField label="عنوان (title)" value={v.title} onChange={(x) => set("title", x)} />
            <TextField label="هایلایت (highlight)" value={v.highlight} onChange={(x) => set("highlight", x)} />
            <div className="sm:col-span-2">
              <TextAreaField label="توضیحات (description)" value={v.description} onChange={(x) => set("description", x)} />
            </div>
            <TextField label="موقعیت (location)" value={v.location} onChange={(x) => set("location", x)} />
            <TextField label="ایمیل (email)" value={v.email} onChange={(x) => set("email", x)} dir="ltr" placeholder="you@example.com" />
            <TextField label="گیت‌هاب (github URL)" value={v.github} onChange={(x) => set("github", x)} dir="ltr" placeholder="https://github.com/..." />
            <TextField label="لینکدین (linkedin URL)" value={v.linkedin} onChange={(x) => set("linkedin", x)} dir="ltr" placeholder="https://linkedin.com/..." />
            <TextField label="توییتر (twitter URL)" value={v.twitter} onChange={(x) => set("twitter", x)} dir="ltr" placeholder="https://twitter.com/..." />
            <TextField label="کپی‌رایت (copyright)" value={v.copyright} onChange={(x) => set("copyright", x)} />
            <TextField label="نسخه (version)" value={v.version} onChange={(x) => set("version", x)} dir="ltr" />
            <TextField label="ساخته‌شده با (builtWith)" value={v.builtWith} onChange={(x) => set("builtWith", x)} />
          </div>
        </FormShell>
      );
    }

    /* ============ design ============ */
    case "design": {
      const designDefaults = lang === "fa" ? defaultContentFa.design : defaultContentEn.design;
      const v = mergeDefaults(designDefaults, draft);
      const background = v.background;
      const cursor = v.cursor;
      const setDesign = (key: keyof SiteContent["design"], value: unknown) => setDraft({ ...v, [key]: value });
      const setBackground = (key: keyof SiteContent["design"]["background"], value: unknown) =>
        setDesign("background", { ...background, [key]: value });
      const setCursor = (key: keyof SiteContent["design"]["cursor"], value: unknown) =>
        setDesign("cursor", { ...cursor, [key]: value });
      const setCursorLabel = (key: keyof SiteContent["design"]["cursor"]["labels"], value: string) =>
        setCursor("labels", { ...cursor.labels, [key]: value });
      const setCursorColor = (key: keyof SiteContent["design"]["cursor"]["colors"], value: string) =>
        setCursor("colors", { ...cursor.colors, [key]: value });

      return (
        <FormShell section={section} title="طراحی و کارخانه سه‌بعدی / Design & 3D Factory">
          <SubsectionBox
            title="Background / بکگراند"
            hint="رنگ‌ها، سرعت حرکت نورها، blur، blend و grain بکگراند اصلی"
          >
            <BackgroundMiniPreview value={background} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField label="رنگ پایه (baseColor)" value={background.baseColor} onChange={(x) => setBackground("baseColor", x)} dir="ltr" />
              <TextField label="Blend mode" value={background.blendMode} onChange={(x) => setBackground("blendMode", x)} dir="ltr" />
              <NumberField label="Opacity" value={background.opacity} min={0} max={1} step={0.05} onChange={(x) => setBackground("opacity", x)} />
              <NumberField label="Blur" value={background.blur} min={0} max={180} step={1} onChange={(x) => setBackground("blur", x)} />
              <NumberField label="Speed" value={background.speed} min={0.1} max={4} step={0.05} onChange={(x) => setBackground("speed", x)} />
              <NumberField label="Grain opacity" value={background.grainOpacity} min={0} max={0.3} step={0.01} onChange={(x) => setBackground("grainOpacity", x)} />
              <NumberField label="Vignette" value={background.vignetteStrength} min={0} max={1} step={0.05} onChange={(x) => setBackground("vignetteStrength", x)} />
            </div>
            <ObjectListField
              label="Background blobs / نورهای بکگراند"
              items={background.blobs ?? []}
              onChange={(x) => setBackground("blobs", x)}
              fields={[
                { key: "color", label: "Color", type: "color" },
                { key: "top", label: "Top", type: "text" },
                { key: "left", label: "Left", type: "text" },
                { key: "size", label: "Size vmin", type: "text" },
                { key: "duration", label: "Duration", type: "text" },
                { key: "delay", label: "Delay", type: "text" },
              ]}
              makeEmpty={() => ({ color: "var(--gfx-1)", top: "20%", left: "20%", size: 44, duration: 36, delay: 0 })}
            />

          </SubsectionBox>

          <SubsectionBox
            title="Cursor & Hover / نشانگر و هاور"
            hint="ظاهر cursor، labelهای zoneها، trail، smoothing، opacity و hover size"
          >
            <CursorMiniPreview value={cursor} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={cursor.enabled}
                  onChange={(e) => setCursor("enabled", e.target.checked)}
                />
                Cursor enabled
              </label>
              <NumberField label="Ring size" value={cursor.ringSize} min={8} max={120} step={1} onChange={(x) => setCursor("ringSize", x)} />
              <NumberField label="Hover ring size" value={cursor.ringHoverSize} min={12} max={160} step={1} onChange={(x) => setCursor("ringHoverSize", x)} />
              <NumberField label="Dot size" value={cursor.dotSize} min={2} max={32} step={1} onChange={(x) => setCursor("dotSize", x)} />
              <NumberField label="Smoothing" value={cursor.smoothing} min={0.03} max={0.6} step={0.01} onChange={(x) => setCursor("smoothing", x)} />
              <NumberField label="Ring opacity" value={cursor.ringOpacity} min={0} max={1} step={0.05} onChange={(x) => setCursor("ringOpacity", x)} />
              <NumberField label="Ring border" value={cursor.ringBorderWidth} min={0} max={8} step={0.5} onChange={(x) => setCursor("ringBorderWidth", x)} />
              <NumberField label="Dot opacity" value={cursor.dotOpacity} min={0} max={1} step={0.05} onChange={(x) => setCursor("dotOpacity", x)} />
              <NumberField label="Label X" value={cursor.labelOffsetX} min={-120} max={120} step={1} onChange={(x) => setCursor("labelOffsetX", x)} />
              <NumberField label="Label Y" value={cursor.labelOffsetY} min={-120} max={120} step={1} onChange={(x) => setCursor("labelOffsetY", x)} />
              <NumberField label="Label opacity" value={cursor.labelOpacity} min={0} max={1} step={0.05} onChange={(x) => setCursor("labelOpacity", x)} />
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={cursor.trailEnabled}
                  onChange={(e) => setCursor("trailEnabled", e.target.checked)}
                />
                Trail enabled
              </label>
              <NumberField label="Trail length" value={cursor.trailLength} min={0} max={18} step={1} onChange={(x) => setCursor("trailLength", x)} />
              <NumberField label="Trail size" value={cursor.trailSize} min={2} max={80} step={1} onChange={(x) => setCursor("trailSize", x)} />
              <NumberField label="Trail opacity" value={cursor.trailOpacity} min={0} max={1} step={0.05} onChange={(x) => setCursor("trailOpacity", x)} />
              <TextField label="Trail color / auto" value={cursor.trailColor} onChange={(x) => setCursor("trailColor", x)} dir="ltr" />
              <TextField label="Blend mode" value={cursor.blendMode} onChange={(x) => setCursor("blendMode", x)} dir="ltr" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {(["default", "gfx", "sec", "ai"] as const).map((zone) => (
                <div key={zone} className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
                  <FieldLabel>{zone}</FieldLabel>
                  <TextField label="Label" value={cursor.labels[zone]} onChange={(x) => setCursorLabel(zone, x)} />
                  <ColorField label="Color" value={cursor.colors[zone]} onChange={(x) => setCursorColor(zone, x)} />
                </div>
              ))}
            </div>
          </SubsectionBox>

          <SubsectionBox
            title="3D Object Factory / کارخانه ساخت آبجکت سه‌بعدی"
            hint="آبجکت‌ها را جابه‌جا کن، رنگ/افکت/انیمیشن بده، GLB/GLTF آپلود کن، یا با slotهای hero-primary و planetary-center جایگزین اول سایت و مرکز سیارات کن."
          >
            <ProceduralObjectLibrary lang={lang} onInsert={(object) => setDesign("objects", [...(v.objects ?? []), object])} />
            <ObjectListField
              label="3D objects"
              items={v.objects ?? []}
              onChange={(x) => setDesign("objects", x)}
              fields={[
                { key: "id", label: "ID", type: "text" },
                { key: "label", label: "Label", type: "text" },
                { key: "enabled", label: "Enabled", type: "checkbox" },
                { key: "slot", label: "Slot: section/hero-primary/planetary-center/graphics-main/graphics-ambient/security-ambient/ai-ambient/custom", type: "text" },
                { key: "sectionId", label: lang === "fa" ? "شناسه سکشن مقصد (مثلاً ai یا custom-...)" : "Target section ID (for example ai or custom-...)", type: "text" },
                { key: "kind", label: "Kind: glass-blob/crystal/orbit/neural/ribbon/prism/pen-nib/palette/lattice/capsule/atom/dna/mobius/gear/satellite/rocket/robot/gamepad/globe/cube/cluster/chain/flower/wave-sphere/cyber-eye/model", type: "text" },
                { key: "modelUrl", label: "Upload GLB/GLTF or model URL", type: "file" },
                { key: "link", label: "Link / section URL", type: "text" },
                { key: "colorA", label: "Color A", type: "color" },
                { key: "colorB", label: "Color B", type: "color" },
                { key: "colorC", label: "Color C", type: "color" },
                { key: "opacity", label: "Opacity", type: "text" },
                { key: "scale", label: "Scale", type: "text" },
                { key: "x", label: "X", type: "text" },
                { key: "y", label: "Y", type: "text" },
                { key: "z", label: "Z", type: "text" },
                { key: "rotateX", label: "Rotate X", type: "text" },
                { key: "rotateY", label: "Rotate Y", type: "text" },
                { key: "rotateZ", label: "Rotate Z", type: "text" },
                { key: "speed", label: "Speed", type: "text" },
                { key: "morphIntensity", label: "Morph intensity", type: "text" },
                { key: "magmaIntensity", label: "Magma intensity", type: "text" },
                { key: "hoverEffect", label: "Hover: none/scale/glow/tilt/morph", type: "text" },
                { key: "animation", label: "Animation: idle/spin/float/pulse/magma", type: "text" },
                { key: "domSide", label: "موقعیت افقی (domSide): start/end/center — end یعنی روبه‌روی متن و در فارسی خودکار برعکس می‌شود", type: "text" },
                { key: "domX", label: lang === "fa" ? "موقعیت افقی دقیق (domX) — درصد 0 تا 100" : "Exact horizontal position (domX) — 0 to 100%", type: "text" },
                { key: "domTop", label: "فاصله از بالا (domTop) — درصد 0-100", type: "text" },
                { key: "domOffset", label: "فاصله از لبه انتخابی (domOffset) — rem، منفی = بیرون‌زدگی", type: "text" },
                { key: "domSize", label: "اندازه ظرف (domSize) — px", type: "text" },
              ]}
              renderPreview={(item, _index, update) => <ObjectVisualStage item={item} onChange={update} lang={lang} />}
              makeEmpty={() => ({
                id: "object-" + Date.now(),
                label: "Custom object",
                enabled: true,
                slot: "section",
                sectionId: "ai",
                kind: "crystal",
                modelUrl: "",
                link: "",
                colorA: "#e84a9b",
                colorB: "#16d6c3",
                colorC: "#4a8aff",
                opacity: 0.7,
                scale: 1,
                x: 0,
                y: 0,
                z: 0,
                rotateX: 0,
                rotateY: 0,
                rotateZ: 0,
                speed: 1,
                morphIntensity: 1,
                magmaIntensity: 1,
                hoverEffect: "glow",
                animation: "float",
                domSide: "end",
                domX: 25,
                domTop: 66,
                domOffset: -2.5,
                domSize: 288,
              })}
            />
          </SubsectionBox>
          <SubsectionBox title={lang === "fa" ? "پیش‌نمایش و کتابخانه انیمیشن" : "Animation library & preview"} hint={lang === "fa" ? "انیمیشن‌های نرم برای load، hover، scroll و حالت پیوسته؛ selector مقصد را روی هر نقطه دلخواه بگذارید." : "Modern motion presets for load, hover, scroll and continuous motion; target any CSS selector."}>
            <ObjectListField
              label={lang === "fa" ? "انیمیشن‌ها" : "Animations"}
              items={v.animations ?? []}
              onChange={(items) => setDesign("animations", items)}
              fields={[
                { key: "id", label: "ID", type: "text" }, { key: "label", label: "Label", type: "text" }, { key: "enabled", label: "Enabled", type: "checkbox" },
                { key: "target", label: "Target CSS selector", type: "text" }, { key: "trigger", label: "load/hover/scroll/always", type: "text" },
                { key: "type", label: "fade/slide/float/pulse/spin/tilt/glow/zoom/blur-in/flip-3d/glide-3d/bob/custom", type: "text" },
                { key: "duration", label: "Duration ms", type: "text" }, { key: "delay", label: "Delay ms", type: "text" }, { key: "easing", label: "Easing", type: "text" }, { key: "intensity", label: "Intensity", type: "text" }, { key: "customCss", label: "Custom @keyframes", type: "textarea" },
              ]}
              renderPreview={(item) => <div className="grid h-36 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--gfx-1)]/15 via-[var(--ai-1)]/15 to-[var(--sec-1)]/15"><motion.div animate={{ y: [0, -10 * Number(item.intensity || 1), 0], rotate: [0, 2, -2, 0], scale: [1, 1.04, 1] }} transition={{ duration: Math.max(0.6, Number(item.duration || 1200) / 1000), repeat: Infinity, ease: "easeInOut" }} className="grid size-20 place-items-center rounded-2xl border bg-background/60 text-xs font-bold shadow-xl">{item.type}</motion.div></div>}
              makeEmpty={() => ({ id: `motion-${Date.now()}`, label: "New motion", enabled: true, target: "main > section", trigger: "load", type: "glide-3d", duration: 700, delay: 0, easing: "cubic-bezier(.16,1,.3,1)", intensity: 0.8, customCss: "" })}
            />
          </SubsectionBox>
        </FormShell>
      );
    }

    /* ============ unified meteor controls ============ */
    case "meteors": {
      const meteorDefaults = lang === "fa" ? defaultContentFa.meteors : defaultContentEn.meteors;
      return <MeteorControlsForm draft={mergeDefaults(meteorDefaults, draft)} setDraft={setDraft} />;
    }

    /* ============ forms ============ */
    case "forms": {
      const formsDefaults = lang === "fa" ? defaultContentFa.forms : defaultContentEn.forms;
      const v = mergeDefaults(formsDefaults, draft);
      const activeForm = v.forms.find((form) => form.id === v.activeFormId) ?? v.forms[0];
      const setFormsSection = (key: keyof FormBuilderConfig, value: unknown) => setDraft({ ...v, [key]: value });
      const setAntiSpam = (key: keyof FormBuilderConfig["antiSpam"], value: unknown) =>
        setFormsSection("antiSpam", { ...v.antiSpam, [key]: value });
      const setEmail = (key: keyof FormBuilderConfig["email"], value: unknown) =>
        setFormsSection("email", { ...v.email, [key]: value });
      const updateActiveForm = (next: FormBuilderConfig["forms"][number]) =>
        setFormsSection("forms", v.forms.map((form) => form.id === next.id ? next : form));

      return (
        <FormShell section={section} title="فرم‌ساز و ایمیل / Forms & Email">
          <SubsectionBox
            title="📨 Delivery / تحویل پیام‌ها — بدون نیاز به میل‌سرور"
            hint="سه حالت بدون سرور (واتس‌اپ/تلگرام/ایمیل بازدیدکننده) + SMTP برای ارسال کلاسیک سمت سرور."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.email.enabled} onChange={(e) => setEmail("enabled", e.target.checked)} />
                {lang === "fa" ? "SMTP فعال باشد (برای ارائه‌دهنده‌های SMTP)" : "SMTP enabled (for SMTP providers)"}
              </label>
              <TextField
                label="Provider: none / mailto / whatsapp-link / telegram-link / telegram-bot / whatsapp-cloud / smtp / gmail / microsoft / custom"
                value={v.email.provider}
                onChange={(x) => setEmail("provider", x)}
                dir="ltr"
              />
              <TextField
                label="📱 واتس‌اپ — شماره شما با کد کشور (مثل 989121234567)"
                value={v.email.whatsappPhone ?? ""}
                onChange={(x) => setEmail("whatsappPhone", x)}
                dir="ltr"
              />
              <TextField
                label="✈️ تلگرام — نام کاربری شما بدون @ (مثل p00rija)"
                value={v.email.telegramUsername ?? ""}
                onChange={(x) => setEmail("telegramUsername", x)}
                dir="ltr"
              />
              <TextField label="To (گیرنده ایمیل — mailto و SMTP)" value={v.email.to} onChange={(x) => setEmail("to", x)} dir="ltr" />
              <TextField label="Subject prefix" value={v.email.subjectPrefix} onChange={(x) => setEmail("subjectPrefix", x)} />
              <TextField label="SMTP host" value={v.email.host} onChange={(x) => setEmail("host", x)} dir="ltr" />
              <NumberField label="Port" value={v.email.port} min={1} max={65535} step={1} onChange={(x) => setEmail("port", x)} />
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.email.secure} onChange={(e) => setEmail("secure", e.target.checked)} />
                TLS/SSL secure
              </label>
              <TextField label="SMTP user" value={v.email.user} onChange={(x) => setEmail("user", x)} dir="ltr" />
              <TextField label="From" value={v.email.from} onChange={(x) => setEmail("from", x)} dir="ltr" />
              <TextField label="Reply-to field ID" value={v.email.replyToField} onChange={(x) => setEmail("replyToField", x)} dir="ltr" />
              <TextField label="Password env name" value={v.email.passwordEnv} onChange={(x) => setEmail("passwordEnv", x)} dir="ltr" />
              <TextField label="Telegram chat ID" value={v.email.telegramChatId ?? ""} onChange={(x) => setEmail("telegramChatId", x)} dir="ltr" />
              <TextField label="Telegram token ENV" value={v.email.telegramBotTokenEnv ?? "TELEGRAM_BOT_TOKEN"} onChange={(x) => setEmail("telegramBotTokenEnv", x)} dir="ltr" />
              <TextField label="WhatsApp phone-number ID" value={v.email.whatsappPhoneNumberId ?? ""} onChange={(x) => setEmail("whatsappPhoneNumberId", x)} dir="ltr" />
              <TextField label="WhatsApp recipient" value={v.email.whatsappRecipient ?? ""} onChange={(x) => setEmail("whatsappRecipient", x)} dir="ltr" />
              <TextField label="WhatsApp token ENV" value={v.email.whatsappTokenEnv ?? "WHATSAPP_ACCESS_TOKEN"} onChange={(x) => setEmail("whatsappTokenEnv", x)} dir="ltr" />
              <TextField label="WhatsApp Graph version" value={v.email.whatsappApiVersion ?? "v23.0"} onChange={(x) => setEmail("whatsappApiVersion", x)} dir="ltr" />
            </div>
            <div className="mt-3 space-y-2 rounded-xl border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <b>{lang === "fa" ? "بدون میل‌سرور (پیشنهادی برای شروع):" : "Without a mail server (recommended to start):"}</b>{" "}
                {lang === "fa"
                  ? "provider را روی whatsapp-link بگذارید و شماره واتس‌اپ خودتان را وارد کنید — با ارسال فرم، واتس‌اپِ خودِ بازدیدکننده با متن آماده به شما باز می‌شود (رایگان، بدون سرور و بدون توکن). telegram-link همین‌کار را با کپی خودکار پیام و باز کردن چت تلگرام شما می‌کند. mailto هم برنامه ایمیل بازدیدکننده را با متن آماده باز می‌کند."
                  : "Set provider to whatsapp-link and enter your number — on submit the VISITOR's WhatsApp opens with the composed message addressed to you (free, no server, no tokens). telegram-link copies the message and opens your Telegram chat. mailto opens the visitor's mail app pre-filled."}
              </p>
              <p>
                <b>{lang === "fa" ? "SMTP کلاسیک:" : "Classic SMTP:"}</b>{" "}
                {lang === "fa"
                  ? "برای Gmail معمولاً باید App Password بسازید و در .env با نام SMTP_PASS بگذارید. برای Microsoft 365 هم SMTP AUTH باید فعال باشد."
                  : "For Gmail, use an App Password in .env as SMTP_PASS. For Microsoft 365, SMTP AUTH must be enabled."}
              </p>
            </div>
          </SubsectionBox>

          <SubsectionBox title="Anti-spam / ضد اسپم" hint="Honeypot، حداقل زمان ارسال و محدودیت تعداد پیام">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField label="Honeypot field" value={v.antiSpam.honeypotField} onChange={(x) => setAntiSpam("honeypotField", x)} dir="ltr" />
              <NumberField label="Minimum submit ms" value={v.antiSpam.minimumSubmitMs} min={0} max={30000} step={100} onChange={(x) => setAntiSpam("minimumSubmitMs", x)} />
              <NumberField label="Max per hour" value={v.antiSpam.maxPerHour} min={1} max={200} step={1} onChange={(x) => setAntiSpam("maxPerHour", x)} />
              <TextField label="Blocked message" value={v.antiSpam.blockedMessage} onChange={(x) => setAntiSpam("blockedMessage", x)} />
            </div>
          </SubsectionBox>

          <SubsectionBox title="Forms library / کتابخانه فرم‌ها" hint="فرم فعال در فوتر نمایش داده می‌شود. فرم‌های دیگر را می‌شود آماده نگه داشت.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.enabled} onChange={(e) => setFormsSection("enabled", e.target.checked)} />
                Forms enabled
              </label>
              <TextField label="Active form ID" value={v.activeFormId} onChange={(x) => setFormsSection("activeFormId", x)} dir="ltr" />
            </div>
            <ObjectListField
              label="Forms"
              items={v.forms}
              onChange={(x) => setFormsSection("forms", x)}
              fields={[
                { key: "id", label: "ID", type: "text" },
                { key: "name", label: "Name", type: "text" },
                { key: "title", label: "Title", type: "text" },
                { key: "description", label: "Description", type: "textarea" },
                { key: "successMessage", label: "Success message", type: "text" },
                { key: "errorMessage", label: "Error message", type: "text" },
                { key: "layout", label: "Layout: single/multi", type: "text" },
                { key: "sectionIds", label: "Place in sections (IDs)", type: "stringlist" },
              ]}
              renderPreview={(item) => <FormGraphPreview form={item} />}
              makeEmpty={() => ({
                id: "form-" + Date.now(),
                name: "New form",
                title: "New form",
                description: "",
                successMessage: "Message sent.",
                errorMessage: "Message could not be sent.",
                layout: "multi",
                sectionIds: ["footer"],
                steps: [{ id: "start", title: "Start", description: "", nextLabel: "Next", backLabel: "Back", submitLabel: "Submit" }],
                fields: [],
                edges: [{ id: "edge-submit", fromStepId: "start", toStepId: "submit", fieldId: "", operator: "always", value: "" }],
              })}
            />
          </SubsectionBox>

          {activeForm && (
            <SubsectionBox
              title={lang === "fa" ? `طراحی فرم فعال: ${activeForm.name}` : `Active form designer: ${activeForm.name}`}
              hint="Stepها نودهای فرم هستند، Edgeها مسیر شرطی بین نودها هستند. این گراف فقط برای ادمین در CMS است."
            >
              <FormGraphPreview form={activeForm} />
              <CmsFormDesigner form={activeForm} lang={lang} onChange={updateActiveForm} />
              <ObjectListField
                label="Steps / نودهای فرم"
                items={activeForm.steps}
                onChange={(x) => updateActiveForm({ ...activeForm, steps: x })}
                fields={[
                  { key: "id", label: "Step ID", type: "text" },
                  { key: "title", label: "Title", type: "text" },
                  { key: "description", label: "Description", type: "textarea" },
                  { key: "nextLabel", label: "Next label", type: "text" },
                  { key: "backLabel", label: "Back label", type: "text" },
                  { key: "submitLabel", label: "Submit label", type: "text" },
                ]}
                makeEmpty={() => ({ id: "step-" + Date.now(), title: "Step", description: "", nextLabel: "Next", backLabel: "Back", submitLabel: "Submit" })}
              />
              <ObjectListField
                label="Fields / فیلدها"
                items={activeForm.fields}
                onChange={(x) => updateActiveForm({ ...activeForm, fields: x })}
                fields={[
                  { key: "id", label: "Field ID", type: "text" },
                  { key: "label", label: "Label", type: "text" },
                  { key: "type", label: "Type: text/email/textarea/select/checkbox/radio/number/tel/url", type: "text" },
                  { key: "placeholder", label: "Placeholder", type: "text" },
                  { key: "required", label: "Required", type: "checkbox" },
                  { key: "options", label: "Options", type: "stringlist" },
                  { key: "width", label: "Width: full/half", type: "text" },
                  { key: "stepId", label: "Step ID", type: "text" },
                  { key: "showWhenField", label: "Show when field ID", type: "text" },
                  { key: "showWhenOperator", label: "Show operator: equals/notEquals/contains/filled/empty", type: "text" },
                  { key: "showWhenValue", label: "Show value", type: "text" },
                ]}
                makeEmpty={() => ({
                  id: "field-" + Date.now(),
                  label: "Field",
                  type: "text",
                  placeholder: "",
                  required: false,
                  options: [],
                  width: "full",
                  stepId: activeForm.steps[0]?.id || "start",
                  showWhenField: "",
                  showWhenOperator: "filled",
                  showWhenValue: "",
                })}
              />
              <ObjectListField
                label="Edges / مسیرهای شرطی گراف"
                items={activeForm.edges}
                onChange={(x) => updateActiveForm({ ...activeForm, edges: x })}
                fields={[
                  { key: "id", label: "Edge ID", type: "text" },
                  { key: "fromStepId", label: "From step", type: "text" },
                  { key: "toStepId", label: "To step / submit", type: "text" },
                  { key: "fieldId", label: "Condition field ID", type: "text" },
                  { key: "operator", label: "Operator: always/equals/notEquals/contains/filled/empty", type: "text" },
                  { key: "value", label: "Value", type: "text" },
                ]}
                makeEmpty={() => ({
                  id: "edge-" + Date.now(),
                  fromStepId: activeForm.steps[0]?.id || "start",
                  toStepId: "submit",
                  fieldId: "",
                  operator: "always",
                  value: "",
                })}
              />
            </SubsectionBox>
          )}
        </FormShell>
      );
    }

    /* ============ explorer journey ============ */
    case "explorer": {
      const defaults = lang === "fa" ? defaultContentFa.explorer : defaultContentEn.explorer;
      const v = mergeDefaults(defaults, draft);
      const setExplorer = (key: keyof SiteContent["explorer"], value: unknown) => setDraft({ ...v, [key]: value });
      return (
        <FormShell section={section} title={lang === "fa" ? "سفر کاوشگر — محتوا و ایستگاه‌ها" : "Explorer Journey — content and stations"}>
          <SubsectionBox title={lang === "fa" ? "رفتار و متن اصلی" : "Behavior and primary copy"} hint={lang === "fa" ? "با همگام‌سازی فعال، هر سکشن فعال در Builder خودکار یک ایستگاه می‌سازد؛ فیلدهای هر ایستگاه override مستقل دارد." : "Auto-sync creates one station from every enabled Builder section; station fields remain independently editable."}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.enabled} onChange={(event) => setExplorer("enabled", event.target.checked)} />{lang === "fa" ? "نمایش Journey و دکمه هدر" : "Show journey and header button"}</label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.autoSync} onChange={(event) => setExplorer("autoSync", event.target.checked)} />{lang === "fa" ? "همگام‌سازی با سکشن‌های CMS" : "Sync with CMS sections"}</label>
              <TextField label={lang === "fa" ? "برچسب دکمه هدر" : "Header button label"} value={v.headerLabel} onChange={(x) => setExplorer("headerLabel", x)} />
              <TextField label="Kicker" value={v.kicker} onChange={(x) => setExplorer("kicker", x)} dir="ltr" />
              <TextField label={lang === "fa" ? "عنوان" : "Title"} value={v.title} onChange={(x) => setExplorer("title", x)} />
              <TextField label={lang === "fa" ? "زیرعنوان" : "Subtitle"} value={v.subtitle} onChange={(x) => setExplorer("subtitle", x)} />
              <TextField label={lang === "fa" ? "پیشرفت" : "Progress label"} value={v.progressLabel} onChange={(x) => setExplorer("progressLabel", x)} />
              <TextField label={lang === "fa" ? "زمان" : "Time label"} value={v.timeLabel} onChange={(x) => setExplorer("timeLabel", x)} />
              <TextField label={lang === "fa" ? "رتبه" : "Rank label"} value={v.rankLabel} onChange={(x) => setExplorer("rankLabel", x)} />
              <TextField label={lang === "fa" ? "مقصد بعدی" : "Next label"} value={v.nextLabel} onChange={(x) => setExplorer("nextLabel", x)} />
              <TextField label={lang === "fa" ? "غافلگیری" : "Surprise label"} value={v.surpriseLabel} onChange={(x) => setExplorer("surpriseLabel", x)} />
              <TextField label={lang === "fa" ? "گردش دوباره" : "Tour again label"} value={v.tourAgainLabel} onChange={(x) => setExplorer("tourAgainLabel", x)} />
            </div>
          </SubsectionBox>
          <SubsectionBox title={lang === "fa" ? "رتبه‌ها و کنترل نمایش" : "Ranks and visibility"}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField label={lang === "fa" ? "کاوشگر ارشد" : "Master rank"} value={v.rankMaster} onChange={(x) => setExplorer("rankMaster", x)} />
              <TextField label={lang === "fa" ? "جهان‌گرد" : "Walker rank"} value={v.rankWalker} onChange={(x) => setExplorer("rankWalker", x)} />
              <TextField label={lang === "fa" ? "ردیاب" : "Seeker rank"} value={v.rankSeeker} onChange={(x) => setExplorer("rankSeeker", x)} />
              <TextField label={lang === "fa" ? "تازه‌وارد" : "New rank"} value={v.rankNew} onChange={(x) => setExplorer("rankNew", x)} />
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.showTimer} onChange={(event) => setExplorer("showTimer", event.target.checked)} />{lang === "fa" ? "زمان فعال" : "Active timer"}</label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.showRank} onChange={(event) => setExplorer("showRank", event.target.checked)} />{lang === "fa" ? "رتبه" : "Rank"}</label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.showSurprise} onChange={(event) => setExplorer("showSurprise", event.target.checked)} />{lang === "fa" ? "غافلگیری تصادفی" : "Random surprise"}</label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.showPassport} onChange={(event) => setExplorer("showPassport", event.target.checked)} />{lang === "fa" ? "گذرنامه" : "Passport"}</label>
            </div>
          </SubsectionBox>
          <SubsectionBox title={lang === "fa" ? "گذرنامه و اشتراک‌گذاری" : "Passport and sharing"} hint={lang === "fa" ? "در متن قفل، {count} با تعداد ایستگاه‌های باقی‌مانده جایگزین می‌شود." : "In the locked message, {count} is replaced with the remaining station count."}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={lang === "fa" ? "عنوان کارت" : "Card title"} value={v.passportTitle} onChange={(x) => setExplorer("passportTitle", x)} />
              <TextField label={lang === "fa" ? "عنوان داخل PNG" : "PNG heading"} value={v.passportHeading} onChange={(x) => setExplorer("passportHeading", x)} />
              <TextAreaField label={lang === "fa" ? "توضیح داخل PNG" : "PNG description"} value={v.passportDescription} onChange={(x) => setExplorer("passportDescription", x)} />
              <TextAreaField label={lang === "fa" ? "متن تکمیل سفر" : "Completion message"} value={v.completeDescription} onChange={(x) => setExplorer("completeDescription", x)} />
              <TextField label={lang === "fa" ? "متن قفل" : "Locked message"} value={v.lockedDescription} onChange={(x) => setExplorer("lockedDescription", x)} />
              <TextField label={lang === "fa" ? "دانلود" : "Download label"} value={v.downloadLabel} onChange={(x) => setExplorer("downloadLabel", x)} />
              <TextField label={lang === "fa" ? "اشتراک" : "Share label"} value={v.shareLabel} onChange={(x) => setExplorer("shareLabel", x)} />
            </div>
          </SubsectionBox>
          <ObjectListField
            label={lang === "fa" ? "ایستگاه‌ها و overrideها" : "Stations and overrides"}
            items={v.chapters}
            onChange={(items) => setExplorer("chapters", items)}
            fields={[
              { key: "id", label: lang === "fa" ? "شناسه سکشن (hero/footer/custom-...)" : "Section ID (hero/footer/custom-...)", type: "text" },
              { key: "title", label: lang === "fa" ? "عنوان" : "Title", type: "text" },
              { key: "clue", label: lang === "fa" ? "راهنما" : "Clue", type: "textarea" },
              { key: "color", label: "Color", type: "color" },
              { key: "icon", label: "rocket/sparkles/compass/map/timeline/trophy", type: "text" },
              { key: "enabled", label: "Enabled", type: "checkbox" },
            ]}
            makeEmpty={() => ({ id: `custom-${Date.now()}`, title: "New station", clue: "", color: "#8b5cf6", icon: "sparkles", enabled: true })}
          />
        </FormShell>
      );
    }

    /* ============ spaceship museum ============ */
    case "museum": {
      const defaults = lang === "fa" ? defaultContentFa.museum : defaultContentEn.museum;
      const v = mergeDefaults(defaults, draft);
      const setMuseum = (key: keyof SiteContent["museum"], value: unknown) => setDraft({ ...v, [key]: value });
      return (
        <FormShell section={section} title={lang === "fa" ? "فضاپیما — ورودی، فضا، راهروها و کارایی" : "Spaceship — intro, space, decks and performance"}>
          <SubsectionBox title={lang === "fa" ? "ورودی و راهنمای بازدیدکننده" : "Intro and visitor guidance"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Kicker" value={v.introKicker} onChange={(x) => setMuseum("introKicker", x)} dir="ltr" />
              <TextField label={lang === "fa" ? "عنوان ورودی" : "Intro title"} value={v.introTitle} onChange={(x) => setMuseum("introTitle", x)} />
              <div className="sm:col-span-2"><TextAreaField label={lang === "fa" ? "توضیح ورودی" : "Intro description"} value={v.introDescription} onChange={(x) => setMuseum("introDescription", x)} /></div>
              <TextField label={lang === "fa" ? "دکمه ورود" : "Board button"} value={v.boardLabel} onChange={(x) => setMuseum("boardLabel", x)} />
              <TextAreaField label={lang === "fa" ? "پیشنهاد تبلت/کامپیوتر" : "Tablet/desktop recommendation"} value={v.deviceHint} onChange={(x) => setMuseum("deviceHint", x)} />
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.showDeviceHint} onChange={(event) => setMuseum("showDeviceHint", event.target.checked)} />{lang === "fa" ? "نمایش راهنما در موبایل" : "Show hint on touch devices"}</label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.showMinimap} onChange={(event) => setMuseum("showMinimap", event.target.checked)} />{lang === "fa" ? "نقشه" : "Minimap"}</label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.showDeckGuide} onChange={(event) => setMuseum("showDeckGuide", event.target.checked)} />{lang === "fa" ? "راهنمای راهروها" : "Deck guide"}</label>
            </div>
          </SubsectionBox>
          <SubsectionBox title={lang === "fa" ? "فضا و رندر سمت کاربر" : "Space and client-side rendering"} hint={lang === "fa" ? "همه اجرام procedural هستند و فایل سنگین دانلود نمی‌شود. حالت Auto سخت‌افزار ضعیف را تشخیص می‌دهد." : "All objects are procedural with no heavy downloads. Auto detects low-power hardware."}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ChoiceField label={lang === "fa" ? "کیفیت" : "Quality"} value={v.quality} options={[{ value: "auto", label: "Auto" }, { value: "high", label: "High" }, { value: "low", label: "Low" }]} onChange={(x) => setMuseum("quality", x)} />
              <NumberField label={lang === "fa" ? "ستاره‌ها" : "Stars"} value={v.starCount} min={100} max={5000} step={100} onChange={(x) => setMuseum("starCount", x)} />
              <NumberField label={lang === "fa" ? "ستارگان کهکشان" : "Galaxy stars"} value={v.galaxyCount} min={100} max={6000} step={100} onChange={(x) => setMuseum("galaxyCount", x)} />
              <NumberField label={lang === "fa" ? "شهاب‌سنگ‌ها" : "Asteroids"} value={v.asteroidCount} min={0} max={80} step={1} onChange={(x) => setMuseum("asteroidCount", x)} />
              <NumberField label={lang === "fa" ? "شهاب‌های عبوری" : "Meteors"} value={v.meteorCount} min={0} max={16} step={1} onChange={(x) => setMuseum("meteorCount", x)} />
              <NumberField label={lang === "fa" ? "شدت سحابی" : "Nebula intensity"} value={v.nebulaIntensity} min={0} max={2} step={0.05} onChange={(x) => setMuseum("nebulaIntensity", x)} />
              <NumberField label={lang === "fa" ? "موجودات" : "Crew count"} value={v.creatureCount} min={0} max={10} step={1} onChange={(x) => setMuseum("creatureCount", x)} />
              <NumberField label={lang === "fa" ? "breakpoint تک‌صفحه کتاب" : "Single-page book breakpoint"} value={v.bookBreakpoint} min={360} max={1100} step={10} onChange={(x) => setMuseum("bookBreakpoint", x)} />
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.autoSync} onChange={(event) => setMuseum("autoSync", event.target.checked)} />{lang === "fa" ? "راهرو خودکار از گالری‌ها" : "Auto decks from galleries"}</label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.trafficEnabled} onChange={(event) => setMuseum("trafficEnabled", event.target.checked)} />{lang === "fa" ? "ترافیک فضایی" : "Space traffic"}</label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm"><input type="checkbox" checked={v.creaturesEnabled} onChange={(event) => setMuseum("creaturesEnabled", event.target.checked)} />{lang === "fa" ? "موجودات سه‌بعدی" : "3D crew"}</label>
            </div>
          </SubsectionBox>
          <ObjectListField
            label={lang === "fa" ? "نام، رنگ و فعال‌بودن راهروها" : "Deck labels, colors and visibility"}
            items={v.decks}
            onChange={(items) => setMuseum("decks", items)}
            fields={[{ key: "id", label: "Section ID", type: "text" }, { key: "label", label: "Deck label", type: "text" }, { key: "color", label: "Color", type: "color" }, { key: "enabled", label: "Enabled", type: "checkbox" }]}
            makeEmpty={() => ({ id: `custom-${Date.now()}`, label: "New deck", color: "#38bdf8", enabled: true })}
          />
          <ObjectListField
            label={lang === "fa" ? "راهروهای مستقل و پروژه‌هایشان" : "Independent decks and their projects"}
            items={v.extraDecks}
            onChange={(items) => setMuseum("extraDecks", items)}
            fields={[
              { key: "id", label: "Deck ID", type: "text" },
              { key: "label", label: "Deck label", type: "text" },
              { key: "color", label: "Color", type: "color" },
              { key: "enabled", label: "Enabled", type: "checkbox" },
              { key: "projects", label: "Projects", type: "objectlist", objectFields: [
                { key: "title", label: "Title", type: "text" }, { key: "meta", label: "Meta", type: "text" }, { key: "category", label: "Category", type: "text" },
                { key: "color", label: "Color", type: "color" }, { key: "year", label: "Year", type: "text" }, { key: "client", label: "Client", type: "text" },
                { key: "role", label: "Role", type: "text" }, { key: "description", label: "Description", type: "textarea" },
                { key: "images", label: "Images", type: "stringlist" },
                { key: "specs", label: "Specs", type: "objectlist", objectFields: [{ key: "key", label: "Key", type: "text" }, { key: "value", label: "Value", type: "text" }] },
                { key: "links", label: "Links", type: "objectlist", objectFields: [{ key: "label", label: "Label", type: "text" }, { key: "url", label: "URL", type: "text" }, { key: "kind", label: "Kind", type: "text" }] },
                { key: "process", label: "Process", type: "objectlist", objectFields: [{ key: "title", label: "Title", type: "text" }, { key: "date", label: "Date", type: "text" }, { key: "description", label: "Description", type: "text" }] },
                { key: "videos", label: "Videos", type: "objectlist", objectFields: [{ key: "url", label: "URL", type: "text" }, { key: "poster", label: "Poster", type: "text" }, { key: "label", label: "Label", type: "text" }] },
                { key: "featured", label: "Featured image", type: "text" },
              ] },
            ]}
            makeEmpty={() => ({ id: `deck-${Date.now()}`, label: "New independent deck", color: "#f59e0b", enabled: true, projects: [] })}
          />
        </FormShell>
      );
    }

    /* ============ builder ============ */
    case "builder": {
      const builderDefaults = lang === "fa" ? defaultContentFa.builder : defaultContentEn.builder;
      const v = mergeDefaults(builderDefaults, draft);
      const setBuilder = (key: keyof BuilderConfig, value: unknown) => setDraft({ ...v, [key]: value });
      const setGlobal = (key: keyof BuilderConfig["global"], value: unknown) =>
        setBuilder("global", { ...v.global, [key]: value });
      const setCache = (key: keyof BuilderConfig["cache"], value: unknown) =>
        setBuilder("cache", { ...v.cache, [key]: value });
      const setPerformance = (key: keyof BuilderConfig["performance"], value: unknown) =>
        setBuilder("performance", {
          frameRate: v.performance?.frameRate ?? 0,
          screensaverSeconds: v.performance?.screensaverSeconds ?? 45,
          animationMode: v.performance?.animationMode ?? "normal",
          [key]: value,
        } as BuilderConfig["performance"]);
      const setAnalyticsCfg = (key: keyof NonNullable<BuilderConfig["analytics"]>, value: unknown) =>
        setBuilder("analytics", { ...(v.analytics ?? {}), [key]: value });
      const setHeader = (key: keyof BuilderConfig["header"], value: unknown) =>
        setBuilder("header", { ...v.header, [key]: value });

      return (
        <FormShell section={section} title="کنترل کامل CMS / Pixel Builder">
          <CmsVisualBuilder builder={v} lang={lang} viewportMode={viewportMode} onChange={(next) => setDraft(next)} />
          <SubsectionBox title={lang === "fa" ? "کتابخانه رزومه‌های مشترک" : "Shared résumé library"} hint={lang === "fa" ? "هر رزومه را هم‌زمان به چند سکشن متصل کنید و برای آن مدیا و چند لینک مستقل بگذارید." : "Assign each résumé to multiple sections, with reusable media and destination links."}>
            <ObjectListField
              label={lang === "fa" ? "رزومه‌ها" : "Résumés"}
              items={v.sharedResumes ?? []}
              onChange={(items) => setBuilder("sharedResumes", items)}
              fields={[
                { key: "id", label: "ID", type: "text" },
                { key: "name", label: lang === "fa" ? "نام داخلی" : "Internal name", type: "text" },
                { key: "enabled", label: "Enabled", type: "checkbox" },
                { key: "sectionIds", label: lang === "fa" ? "شناسه سکشن‌های مقصد" : "Target section IDs", type: "stringlist" },
                { key: "title", label: lang === "fa" ? "عنوان" : "Title", type: "text" },
                { key: "summary", label: lang === "fa" ? "خلاصه" : "Summary", type: "textarea" },
                { key: "media", label: lang === "fa" ? "URL رسانه‌ها" : "Media URLs", type: "stringlist" },
                { key: "links", label: lang === "fa" ? "لینک‌ها" : "Links", type: "objectlist", objectFields: [{ key: "label", label: "Label", type: "text" }, { key: "url", label: "URL", type: "text" }, { key: "kind", label: "live/source/github/docs/other", type: "text" }] },
              ]}
              makeEmpty={() => ({ id: `resume-${Date.now()}`, name: "New résumé", enabled: true, sectionIds: ["graphics"], title: "Project résumé", summary: "", media: [], links: [{ label: "GitHub", url: "", kind: "github" }] })}
            />
          </SubsectionBox>
          <SubsectionBox
            title="Master controls / کنترل مادر"
            hint="این بخش نقش page builder دارد: رفتار کلی، فاصله‌ها، radius، hover، لینک‌ها و CSS سفارشی کل سایت."
          >
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
              <input type="checkbox" checked={v.enabled} onChange={(e) => setBuilder("enabled", e.target.checked)} />
              Builder runtime enabled
            </label>
            <CmsTypographyControls lang={lang} global={v.global} onChange={(key, value) => setGlobal(key, value)} />
            <TextAreaField label="Admin hint / توضیح داخلی CMS" value={v.editModeHint} onChange={(x) => setBuilder("editModeHint", x)} />
            <TextAreaField label="Built-in guide / راهنمای کار با CMS" value={v.helpGuide} rows={8} onChange={(x) => setBuilder("helpGuide", x)} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField label="Max width" value={v.global.maxWidth} min={320} max={2200} step={10} onChange={(x) => setGlobal("maxWidth", x)} />
              <NumberField label="Section gap" value={v.global.sectionGap} min={0} max={240} step={4} onChange={(x) => setGlobal("sectionGap", x)} />
              <label className="space-y-1.5">
                <FieldLabel>Spacing mode / حالت فاصله</FieldLabel>
                <select
                  value={v.global.spacingMode}
                  onChange={(event) => setGlobal("spacingMode", event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-[var(--surface-1)] px-3 text-sm text-foreground"
                >
                  <option value="auto">{lang === "fa" ? "خودکار و واکنش‌گرا" : "Automatic and responsive"}</option>
                  <option value="manual">{lang === "fa" ? "دستی برای هر بخش" : "Manual per section"}</option>
                </select>
              </label>
              <NumberField label="Card radius" value={v.global.cardRadius} min={0} max={48} step={1} onChange={(x) => setGlobal("cardRadius", x)} />
              <NumberField label="Button radius" value={v.global.buttonRadius} min={0} max={999} step={1} onChange={(x) => setGlobal("buttonRadius", x)} />
              <NumberField label="Glass opacity" value={v.global.glassOpacity} min={0} max={1} step={0.01} onChange={(x) => setGlobal("glassOpacity", x)} />
              <NumberField label="Border opacity" value={v.global.borderOpacity} min={0} max={1} step={0.01} onChange={(x) => setGlobal("borderOpacity", x)} />
              <NumberField label="Shadow strength" value={v.global.shadowStrength} min={0} max={1} step={0.01} onChange={(x) => setGlobal("shadowStrength", x)} />
              <NumberField label="Animation speed" value={v.global.animationSpeed} min={0.1} max={4} step={0.05} onChange={(x) => setGlobal("animationSpeed", x)} />
              <NumberField label="Hover scale" value={v.global.hoverScale} min={0.9} max={1.25} step={0.01} onChange={(x) => setGlobal("hoverScale", x)} />
              <TextField label="Focus ring color" value={v.global.focusRingColor} onChange={(x) => setGlobal("focusRingColor", x)} dir="ltr" />
              <TextField label="Selection color" value={v.global.selectionColor} onChange={(x) => setGlobal("selectionColor", x)} dir="ltr" />
            </div>
            <TextAreaField label="Global custom CSS" value={v.global.customCss} rows={8} onChange={(x) => setGlobal("customCss", x)} />
          </SubsectionBox>

          <SubsectionBox
            title="⚡ Performance & Animation / سرعت، فریم و انیمیشن"
            hint="فریم‌ریت رندر سه‌بعدی، زمان اسکرین‌سیور و مد کلی انیمیشن سایت — برای دستگاه/هاست‌های ضعیف هم سبک کنید."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField
                label={lang === "fa" ? "نرخ فریم — صفر یعنی نامحدود" : "Frame rate (FPS) — zero is unlimited"}
                value={v.performance?.frameRate ?? 0}
                min={0}
                max={640}
                step={10}
                onChange={(x) => setPerformance("frameRate", x)}
              />
              <NumberField
                label={lang === "fa" ? "محافظ صفحه (ثانیه) — صفر یعنی خاموش" : "Screensaver (seconds) — zero disables it"}
                value={v.performance?.screensaverSeconds ?? 45}
                min={0}
                max={600}
                step={5}
                onChange={(x) => setPerformance("screensaverSeconds", x)}
              />
              <ChoiceField
                label={lang === "fa" ? "حالت حرکت" : "Animation mode"}
                value={v.performance?.animationMode ?? "normal"}
                options={[
                  { value: "off", label: lang === "fa" ? "خاموش" : "Off" },
                  { value: "reduced", label: lang === "fa" ? "کاهش‌یافته" : "Reduced" },
                  { value: "normal", label: lang === "fa" ? "عادی" : "Normal" },
                  { value: "cinematic", label: lang === "fa" ? "سینمایی" : "Cinematic" },
                ]}
                onChange={(x) => setPerformance("animationMode", x)}
              />
            </div>
            <div className="mt-3 grid gap-2 text-xs leading-relaxed text-muted-foreground md:grid-cols-2">
              <p>{lang === "fa" ? "🎞️ نرخ فریم سقف رندر صحنه‌های سه‌بعدی است: صفر هم‌نرخ نمایشگر، ۳۰ کم‌مصرف و ۶۰ متعادل است." : "🎞️ Frame rate caps 3D rendering: zero follows the display, 30 saves power, and 60 is balanced."}</p>
              <p>{lang === "fa" ? "🎬 حالت حرکت، شدت انیمیشن‌های تزئینی را از خاموش تا سینمایی کنترل می‌کند." : "🎬 Animation mode controls decorative motion intensity from off to cinematic."}</p>
            </div>
          </SubsectionBox>

          <SubsectionBox
            title="Smart cache / مدیریت کش هوشمند"
            hint="TTL محتوای CMS، کش assetها، DPR canvas و رفتار 3D را کنترل کن تا سایت سنگین نشود."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.cache.enabled} onChange={(e) => setCache("enabled", e.target.checked)} />
                Cache enabled
              </label>
              <NumberField label="Content TTL seconds" value={v.cache.contentTtlSeconds} min={0} max={3600} step={5} onChange={(x) => setCache("contentTtlSeconds", x)} />
              <NumberField label="Static max-age seconds" value={v.cache.staticMaxAgeSeconds} min={0} max={31536000} step={60} onChange={(x) => setCache("staticMaxAgeSeconds", x)} />
              <NumberField label="Stale while revalidate" value={v.cache.staleWhileRevalidateSeconds} min={0} max={604800} step={60} onChange={(x) => setCache("staleWhileRevalidateSeconds", x)} />
              <NumberField label="Max canvas DPR" value={v.cache.maxCanvasDpr} min={1} max={3} step={0.05} onChange={(x) => setCache("maxCanvasDpr", x)} />
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.cache.lazy3D} onChange={(e) => setCache("lazy3D", e.target.checked)} />
                Lazy 3D
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.cache.pauseOffscreen3D} onChange={(e) => setCache("pauseOffscreen3D", e.target.checked)} />
                Pause offscreen 3D
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm" title="Warm lazy images and heavy chunks in the background after load (fast connections only)">
                <input type="checkbox" checked={v.cache.preloadAssets ?? true} onChange={(e) => setCache("preloadAssets", e.target.checked)} />
                {lang === "fa" ? "پیش‌بارگذاری محتوا (Preload)" : "Preload assets in background"}
              </label>
            </div>
          </SubsectionBox>

          <SubsectionBox
            title="اتصال سرویس‌های مانیتورینگ / Traffic-monitoring integrations"
            hint="GA4 · GTM · Hotjar · Plausible · Matomo · Cloudflare — فقط پس از رضایت «آمار» بازدیدکننده بارگذاری می‌شوند (GDPR). خالی = غیرفعال."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField label="Google Analytics 4 (G-…)" value={(v.analytics ?? {}).ga4Id ?? ""} onChange={(x) => setAnalyticsCfg("ga4Id", x)} dir="ltr" placeholder="G-XXXXXXXXXX" />
              <TextField label="Google Tag Manager (GTM-…)" value={(v.analytics ?? {}).gtmId ?? ""} onChange={(x) => setAnalyticsCfg("gtmId", x)} dir="ltr" placeholder="GTM-XXXXXXX" />
              <TextField label="Hotjar site id" value={(v.analytics ?? {}).hotjarId ?? ""} onChange={(x) => setAnalyticsCfg("hotjarId", x)} dir="ltr" placeholder="1234567" />
              <TextField label="Plausible domain" value={(v.analytics ?? {}).plausibleDomain ?? ""} onChange={(x) => setAnalyticsCfg("plausibleDomain", x)} dir="ltr" placeholder="example.com" />
              <TextField label="Matomo URL" value={(v.analytics ?? {}).matomoUrl ?? ""} onChange={(x) => setAnalyticsCfg("matomoUrl", x)} dir="ltr" placeholder="https://matomo.example.com/" />
              <TextField label="Matomo site id" value={(v.analytics ?? {}).matomoSiteId ?? ""} onChange={(x) => setAnalyticsCfg("matomoSiteId", x)} dir="ltr" placeholder="1" />
              <TextField label="Cloudflare Web Analytics token" value={(v.analytics ?? {}).cloudflareToken ?? ""} onChange={(x) => setAnalyticsCfg("cloudflareToken", x)} dir="ltr" />
              <TextField label="HubSpot portal id" value={(v.analytics ?? {}).hubspotId ?? ""} onChange={(x) => setAnalyticsCfg("hubspotId", x)} dir="ltr" placeholder="12345678" />
              <TextField label="Google Search Console verification" value={(v.analytics ?? {}).gscVerification ?? ""} onChange={(x) => setAnalyticsCfg("gscVerification", x)} dir="ltr" placeholder="google-site-verification token" />
            </div>
          </SubsectionBox>

          <SubsectionBox title="Header & menu / هدر و منو" hint="تمام تنظیمات هدر، لوگو، منوی موبایل و کنترل‌های هدر">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.header.enabled} onChange={(e) => setHeader("enabled", e.target.checked)} />
                Header enabled
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.header.sticky} onChange={(e) => setHeader("sticky", e.target.checked)} />
                Sticky
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.header.showThemeToggle} onChange={(e) => setHeader("showThemeToggle", e.target.checked)} />
                Theme toggle
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.header.showLanguageToggle} onChange={(e) => setHeader("showLanguageToggle", e.target.checked)} />
                Language toggle
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.header.showCmsButton} onChange={(e) => setHeader("showCmsButton", e.target.checked)} />
                CMS button
              </label>
              <NumberField label="Header height" value={v.header.height} min={44} max={112} step={1} onChange={(x) => setHeader("height", x)} />
              <NumberField label="Header content gap" value={v.header.contentGap} min={0} max={160} step={2} onChange={(x) => setHeader("contentGap", x)} />
              <NumberField label="Blur" value={v.header.blur} min={0} max={60} step={1} onChange={(x) => setHeader("blur", x)} />
              <NumberField label="Opacity" value={v.header.opacity} min={0} max={1} step={0.01} onChange={(x) => setHeader("opacity", x)} />
              <TextField label="Background" value={v.header.background} onChange={(x) => setHeader("background", x)} dir="ltr" />
              <TextField label="Border color" value={v.header.borderColor} onChange={(x) => setHeader("borderColor", x)} dir="ltr" />
              <TextField label="Logo text" value={v.header.logoText} onChange={(x) => setHeader("logoText", x)} />
              <TextField label="Logo alt text" value={v.header.logoAlt} onChange={(x) => setHeader("logoAlt", x)} />
              <TextField label="Logo shape: rounded/circle/square/diamond/none" value={v.header.logoShape} onChange={(x) => setHeader("logoShape", x)} dir="ltr" />
              <TextField label="Logo gradient" value={v.header.logoGradient} onChange={(x) => setHeader("logoGradient", x)} dir="ltr" />
              <TextField label="Hover effect: none/pill/underline/glow/magnetic" value={v.header.hoverEffect} onChange={(x) => setHeader("hoverEffect", x)} dir="ltr" />
              <TextField label="Mobile menu: sheet/dropdown/full" value={v.header.mobileMenuStyle} onChange={(x) => setHeader("mobileMenuStyle", x)} dir="ltr" />
              <ImageUploadField
                label={lang === "fa" ? "تصویر لوگوی هدر" : "Header logo image"}
                value={v.header.logoImage}
                onChange={(x) => setHeader("logoImage", x)}
                lang={lang}
              />
            </div>
          </SubsectionBox>

          <SubsectionBox title="Navigation items / آیتم‌های منو" hint="اضافه، حذف، جابه‌جایی، لینک خارجی، رنگ و hover label">
            <ObjectListField
              label="Navigation"
              items={v.navigation}
              onChange={(x) => setBuilder("navigation", x)}
              fields={[
                { key: "id", label: "ID", type: "text" },
                { key: "label", label: "Label", type: "text" },
                { key: "href", label: "Href / link", type: "text" },
                { key: "enabled", label: "Enabled", type: "checkbox" },
                { key: "external", label: "External", type: "checkbox" },
                { key: "order", label: "Order", type: "text" },
                { key: "color", label: "Color", type: "color" },
                { key: "hoverLabel", label: "Cursor hover label", type: "text" },
              ]}
              makeEmpty={() => ({ id: "nav-" + Date.now(), label: "New item", href: "#", enabled: true, external: false, order: v.navigation.length + 1, color: "#ffffff", hoverLabel: "LINK" })}
            />
          </SubsectionBox>

          <SubsectionBox
            title="Sections / چیدمان بخش‌ها — مدیر بصری"
            hint="فعال/غیرفعال کردن کامل، جابه‌جایی، سواپ، داپلیکیت، بخش جدید نامحدود و سیاره اختصاصی — همه با ذخیره لحظه‌ای در هر دو زبان"
          >
            {sectionsManagerProps ? (
              <SectionsManager {...sectionsManagerProps} />
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </SubsectionBox>

          <SubsectionBox title="Reusable components / کامپوننت‌های قابل ساخت" hint="دکمه، کارت، badge، modal، menu و هر آبجکت سفارشی قابل تعریف">
            <ObjectListField
              label="Components"
              items={v.components}
              onChange={(x) => setBuilder("components", x)}
              fields={[
                { key: "id", label: "ID", type: "text" },
                { key: "label", label: "Label", type: "text" },
                { key: "type", label: "Type: header/menu/button/card/section/badge/modal/custom", type: "text" },
                { key: "enabled", label: "Enabled", type: "checkbox" },
                { key: "target", label: "Target", type: "text" },
                { key: "order", label: "Order", type: "text" },
                { key: "text", label: "Text", type: "text" },
                { key: "href", label: "Href", type: "text" },
                { key: "icon", label: "Icon", type: "text" },
                { key: "color", label: "Color", type: "text" },
                { key: "background", label: "Background", type: "text" },
                { key: "borderColor", label: "Border color", type: "text" },
                { key: "radius", label: "Radius", type: "text" },
                { key: "paddingX", label: "Padding X", type: "text" },
                { key: "paddingY", label: "Padding Y", type: "text" },
                { key: "fontSize", label: "Font size", type: "text" },
                { key: "opacity", label: "Opacity", type: "text" },
                { key: "hoverEffect", label: "Hover: none/lift/glow/scale/underline/blur/tilt", type: "text" },
                { key: "animation", label: "Animation: none/fade/slide/float/pulse/spin", type: "text" },
                { key: "customCss", label: "Custom CSS", type: "textarea" },
              ]}
              makeEmpty={() => ({ id: "component-" + Date.now(), label: "New component", type: "custom", enabled: true, target: "global", order: v.components.length + 1, text: "", href: "", icon: "", color: "var(--foreground)", background: "var(--surface-1)", borderColor: "var(--border)", radius: 8, paddingX: 16, paddingY: 10, fontSize: 14, opacity: 1, hoverEffect: "glow", animation: "fade", customCss: "" })}
            />
          </SubsectionBox>

          <SubsectionBox
            title="Animation Library / کتابخانه انیمیشن"
            hint="برای هر target دلخواه CSS selector بده؛ مثل #graphics، main > section یا [data-builder-component='cards']. حالت hover، load و always پشتیبانی می‌شود."
          >
            <ObjectListField
              label="Animation presets"
              items={v.animations}
              onChange={(x) => setBuilder("animations", x)}
              fields={[
                { key: "id", label: "ID", type: "text" },
                { key: "label", label: "Label", type: "text" },
                { key: "enabled", label: "Enabled", type: "checkbox" },
                { key: "target", label: "Target CSS selector", type: "text" },
                { key: "trigger", label: "Trigger: load/hover/scroll/always", type: "text" },
                { key: "type", label: "Type: fade/slide/float/pulse/spin/tilt/glow/zoom/blur-in/flip-3d/glide-3d/bob/custom", type: "text" },
                { key: "duration", label: "Duration ms", type: "text" },
                { key: "delay", label: "Delay ms", type: "text" },
                { key: "easing", label: "Easing", type: "text" },
                { key: "intensity", label: "Intensity", type: "text" },
                { key: "customCss", label: "Custom @keyframes CSS", type: "textarea" },
              ]}
              makeEmpty={() => ({ id: "anim-" + Date.now(), label: "New animation", enabled: true, target: "main > section", trigger: "load", type: "fade", duration: 700, delay: 0, easing: "ease", intensity: 1, customCss: "" })}
            />
          </SubsectionBox>
        </FormShell>
      );
    }

    /* ============ error404 ============ */
    case "error404": {
      const defaults404 = lang === "fa" ? defaultContentFa.error404 : defaultContentEn.error404;
      const v = mergeDefaults(defaults404, draft);
      const set404 = (key: keyof Error404Config, value: unknown) => setDraft({ ...v, [key]: value });
      const setAssets = (key: keyof Error404Config["assets"], value: string) =>
        set404("assets", { ...v.assets, [key]: value });
      const setColors = (key: keyof Error404Config["colors"], value: string) =>
        set404("colors", { ...v.colors, [key]: value });
      const setGame = (key: keyof Error404Config["game"], value: unknown) =>
        set404("game", { ...v.game, [key]: value });

      return (
        <FormShell section={section} title="صفحه ۴۰۴ و بازی فضانورد / 404 Astronaut Game">
          <SubsectionBox title="404 content / متن و اکشن‌ها" hint="متن‌ها، CTAها و پیام‌های بازی">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Badge" value={v.badge} onChange={(x) => set404("badge", x)} />
              <TextField label="Title" value={v.title} onChange={(x) => set404("title", x)} />
              <TextField label="Highlight" value={v.highlight} onChange={(x) => set404("highlight", x)} />
              <TextField label="Astronaut label" value={v.astronautLabel} onChange={(x) => set404("astronautLabel", x)} />
              <div className="sm:col-span-2">
                <TextAreaField label="Description" value={v.description} onChange={(x) => set404("description", x)} />
              </div>
              <TextField label="Reveal label" value={v.revealLabel} onChange={(x) => set404("revealLabel", x)} />
              <TextField label="Start label" value={v.startLabel} onChange={(x) => set404("startLabel", x)} />
              <TextField label="Back label" value={v.backLabel} onChange={(x) => set404("backLabel", x)} />
              <TextField label="Restart label" value={v.restartLabel} onChange={(x) => set404("restartLabel", x)} />
              <TextField label="Leaderboard label" value={v.leaderboardLabel} onChange={(x) => set404("leaderboardLabel", x)} />
              <TextField label="Score label" value={v.scoreLabel} onChange={(x) => set404("scoreLabel", x)} />
              <TextField label="Lives label" value={v.livesLabel} onChange={(x) => set404("livesLabel", x)} />
              <TextField label="Game over title" value={v.gameOverTitle} onChange={(x) => set404("gameOverTitle", x)} />
              <TextField label="Game over description" value={v.gameOverDescription} onChange={(x) => set404("gameOverDescription", x)} />
              <TextField label="Player name placeholder" value={v.playerNamePlaceholder} onChange={(x) => set404("playerNamePlaceholder", x)} />
              <TextField label="Submit score label" value={v.submitScoreLabel} onChange={(x) => set404("submitScoreLabel", x)} />
              <TextField label="Difficulty label" value={v.difficultyLabel} onChange={(x) => set404("difficultyLabel", x)} />
              <TextField label="Coins label" value={v.coinsLabel} onChange={(x) => set404("coinsLabel", x)} />
              <TextField label="Shop label" value={v.shopLabel} onChange={(x) => set404("shopLabel", x)} />
              <TextField label="Shield label" value={v.shieldLabel} onChange={(x) => set404("shieldLabel", x)} />
              <TextField label="Magnet label" value={v.magnetLabel} onChange={(x) => set404("magnetLabel", x)} />
              <TextField label="Buy label" value={v.buyLabel} onChange={(x) => set404("buyLabel", x)} />
              <TextField label="Equipped label" value={v.equippedLabel} onChange={(x) => set404("equippedLabel", x)} />
              <TextField label="Final score label" value={v.finalScoreLabel} onChange={(x) => set404("finalScoreLabel", x)} />
            </div>
          </SubsectionBox>

          <SubsectionBox title="Game assets / تصاویر بازی" hint="PNGهای فضانورد و شهاب‌سنگ؛ می‌توانید مسیر public یا URL بدهید.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField label="Lost astronaut image" value={v.assets.lostAstronaut} onChange={(x) => setAssets("lostAstronaut", x)} dir="ltr" />
              <TextField label="Player astronaut image" value={v.assets.playerAstronaut} onChange={(x) => setAssets("playerAstronaut", x)} dir="ltr" />
              <TextField label="Comet image" value={v.assets.comet} onChange={(x) => setAssets("comet", x)} dir="ltr" />
            </div>
          </SubsectionBox>

          <SubsectionBox title="Astronaut colors / رنگ‌های گرافیک" hint="رنگ لباس، شیشه، بند، شهاب‌سنگ و accent">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["suit", "visor", "tether", "asteroid", "star", "accent", "danger"] as const).map((key) => (
                <ColorField key={key} label={key} value={v.colors[key]} onChange={(x) => setColors(key, x)} />
              ))}
            </div>
          </SubsectionBox>

          <SubsectionBox title="Game tuning / تنظیمات بازی" hint="سرعت، تعداد شهاب‌سنگ‌ها، اندازه‌ها، امتیاز و لیدربرد">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                <input type="checkbox" checked={v.game.enabled} onChange={(e) => setGame("enabled", e.target.checked)} />
                Game enabled
              </label>
              <NumberField label="Canvas height" value={v.game.canvasHeight} min={320} max={900} step={10} onChange={(x) => setGame("canvasHeight", x)} />
              <NumberField label="Player size" value={v.game.playerSize} min={18} max={80} step={1} onChange={(x) => setGame("playerSize", x)} />
              <NumberField label="Asteroid count" value={v.game.asteroidCount} min={1} max={28} step={1} onChange={(x) => setGame("asteroidCount", x)} />
              <NumberField label="Asteroid min size" value={v.game.asteroidMinSize} min={8} max={120} step={1} onChange={(x) => setGame("asteroidMinSize", x)} />
              <NumberField label="Asteroid max size" value={v.game.asteroidMaxSize} min={12} max={180} step={1} onChange={(x) => setGame("asteroidMaxSize", x)} />
              <NumberField label="Speed" value={v.game.speed} min={0.5} max={12} step={0.1} onChange={(x) => setGame("speed", x)} />
              <NumberField label="Acceleration" value={v.game.acceleration} min={0} max={0.2} step={0.001} onChange={(x) => setGame("acceleration", x)} />
              <NumberField label="Stars" value={v.game.starCount} min={10} max={400} step={5} onChange={(x) => setGame("starCount", x)} />
              <NumberField label="Lives" value={v.game.lives} min={1} max={9} step={1} onChange={(x) => setGame("lives", x)} />
              <NumberField label="Leaderboard limit" value={v.game.leaderboardLimit} min={3} max={20} step={1} onChange={(x) => setGame("leaderboardLimit", x)} />
              <NumberField label="Coin count" value={v.game.coinCount} min={0} max={20} step={1} onChange={(x) => setGame("coinCount", x)} />
              <NumberField label="Coin value" value={v.game.coinValue} min={1} max={100} step={1} onChange={(x) => setGame("coinValue", x)} />
              <NumberField label="Shield cost" value={v.game.shieldCost} min={1} max={999} step={1} onChange={(x) => setGame("shieldCost", x)} />
              <NumberField label="Magnet cost" value={v.game.magnetCost} min={1} max={999} step={1} onChange={(x) => setGame("magnetCost", x)} />
            </div>
          </SubsectionBox>
        </FormShell>
      );
    }

    /* ============ pwa (global settings — self-saving editor) ============ */
    case "pwa": {
      const defaultsPwa = lang === "fa" ? defaultContentFa.pwa : defaultContentEn.pwa;
      const v = mergeDefaults(defaultsPwa, draft) as SiteContent["pwa"];
      return <PwaSettingsEditor key={lang} lang={lang} value={v} />;
    }

    /* ============ seo (global settings — writes the panel draft too) ============ */
    case "seo": {
      const defaultsSeo = lang === "fa" ? defaultContentFa.seo : defaultContentEn.seo;
      const v = mergeDefaults(defaultsSeo, draft) as SiteContent["seo"];
      return <SeoSettingsEditor key={lang} lang={lang} value={v} onChange={(next) => setDraft(next)} />;
    }

    /* ============ assistant (pixel buddy, global) ============ */
    case "assistant": {
      const defaultsAs = lang === "fa" ? defaultContentFa.assistant : defaultContentEn.assistant;
      const v = mergeDefaults(defaultsAs, draft) as SiteContent["assistant"];
      return <AssistantSettingsEditor key={lang} lang={lang} value={v} onChange={(next) => setDraft(next)} />;
    }

    default:
      return null;
  }
}

/** Save a GLOBAL section to both language rows at once (single-file truth). */
async function saveGlobalSection(section: "seo" | "assistant" | "pwa", draft: unknown): Promise<void> {
  const responses = await Promise.all(
    (["fa", "en"] as const).map((l) =>
      fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, lang: l, data: draft }),
      })
    )
  );
  if (responses.some((r) => !r.ok)) throw new Error("save failed");
  await useContent.getState().refreshContent();
}

function SeoSettingsEditor({ lang, value, onChange }: { lang: Lang; value: SiteContent["seo"]; onChange: (next: SiteContent["seo"]) => void }) {
  const busy = false;
  const set = (field: keyof SiteContent["seo"], next: string | boolean) => onChange({ ...value, [field]: next });
  const save = async () => {
    try {
      await saveGlobalSection("seo", value);
      toast.success(lang === "fa" ? "سئو ذخیره شد (هر دو زبان)" : "SEO saved (both languages)");
    } catch {
      toast.error(lang === "fa" ? "ذخیره انجام نشد" : "Save failed");
    }
  };
  const fa = lang === "fa";
  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Search className="size-5 text-[var(--sec-1)]" />
          {fa ? "سئو و متادیتا" : "SEO & Metadata"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {fa
            ? "کنترل نیتیو سئو: عنوان و توضیحات متا، کلمات کلیدی، تصویر شیرینگ (OG)، robots، کانونیکال و داده‌ی ساختاریافته (JSON-LD). تغییرات بلافاصله در HTML سایت اعمال می‌شود. برای تصویر OG آدرس را از کتابخانه رسانه کپی کنید (۱۲۰۰×۶۳۰ پیشنهاد)."
            : "Native SEO control: meta title/description, keywords, OG share image, robots, canonical host and JSON-LD structured data. Applies to the site HTML instantly. Copy the OG image URL from the Media Library (1200×630 recommended)."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextField label={fa ? "عنوان متا (metaTitle)" : "Meta title"} value={value.metaTitle} onChange={(x) => set("metaTitle", x)} /></div>
        <div className="sm:col-span-2"><TextAreaField label={fa ? "توضیحات متا (metaDescription)" : "Meta description"} value={value.metaDescription} onChange={(x) => set("metaDescription", x)} /></div>
        <div className="sm:col-span-2"><TextField label={fa ? "کلمات کلیدی (با کاما)" : "Keywords (comma separated)"} value={value.keywords} onChange={(x) => set("keywords", x)} dir="ltr" /></div>
        <div className="sm:col-span-2"><TextField label={fa ? "تصویر OG/توییتر (ogImage)" : "OG/Twitter image (ogImage)"} value={value.ogImage} onChange={(x) => set("ogImage", x)} dir="ltr" placeholder="/api/uploads/…" /></div>
        <TextField label={fa ? "نام نویسنده (authorName)" : "Author name"} value={value.authorName} onChange={(x) => set("authorName", x)} />
        <TextField label={fa ? "دامنه‌ی کانونیکال (canonicalHost)" : "Canonical host"} value={value.canonicalHost} onChange={(x) => set("canonicalHost", x)} dir="ltr" placeholder="https://example.com" />
        <TextField label={fa ? "robots (مثل index, follow)" : "robots (e.g. index, follow)"} value={value.robots} onChange={(x) => set("robots", x)} dir="ltr" />
        <div>
          <Label className="text-xs">{fa ? "کارت توییتر" : "Twitter card"}</Label>
          <select
            value={value.twitterCard}
            onChange={(e) => set("twitterCard", e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          >
            <option value="summary_large_image">summary_large_image</option>
            <option value="summary">summary</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.jsonldPerson} onChange={(e) => set("jsonldPerson", e.target.checked)} className="size-4" />
          {fa ? "داده‌ی ساختاریافته Person (JSON-LD)" : "Person JSON-LD structured data"}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.noindexDev} onChange={(e) => set("noindexDev", e.target.checked)} className="size-4" />
          {fa ? "noindex در محیط توسعه (NODE_ENV≠production)" : "noindex outside production"}
        </label>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {fa ? "ذخیره (هر دو زبان)" : "Save (both languages)"}
        </Button>
      </div>
    </div>
  );
}

function AssistantSettingsEditor({ lang, value, onChange }: { lang: Lang; value: SiteContent["assistant"]; onChange: (next: SiteContent["assistant"]) => void }) {
  const busy = false;
  const memoryFileRef = useRef<HTMLInputElement>(null);
  const set = (field: keyof SiteContent["assistant"], next: string | boolean) => onChange({ ...value, [field]: next });
  const save = async () => {
    try {
      await saveGlobalSection("assistant", value);
      toast.success(lang === "fa" ? "تنظیمات همدم ذخیره شد و در سایت اعمال شد" : "Buddy settings saved & live");
    } catch {
      toast.error(lang === "fa" ? "ذخیره انجام نشد" : "Save failed");
    }
  };
  const fa = lang === "fa";
  const providers: { id: string; fa: string; en: string; note: string }[] = [
    { id: "pollinations", fa: "رایگان بدون کلید (Pollinations)", en: "Free, no key (Pollinations)", note: "AI_API_KEY لازم نیست" },
    { id: "openai", fa: "OpenAI (ChatGPT)", en: "OpenAI (ChatGPT)", note: "gpt-4o-mini" },
    { id: "zai", fa: "Z.ai (GLM)", en: "Z.ai (GLM)", note: "glm-4-flash" },
    { id: "qwen", fa: "Qwen (علی‌بابا)", en: "Qwen (Alibaba)", note: "qwen-turbo" },
    { id: "groq", fa: "Groq (Llama)", en: "Groq (Llama)", note: "llama-3.1-8b-instant" },
    { id: "anthropic", fa: "Anthropic (Claude)", en: "Anthropic (Claude)", note: "claude-3-5-haiku" },
    { id: "google", fa: "Google (Gemini)", en: "Google (Gemini)", note: "gemini-1.5-flash" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Bot className="size-5 text-[var(--ai-1)]" />
          {fa ? "همدم پیکسلی (AI)" : "Pixel Buddy (AI)"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {fa
            ? "یک پت پیکسلی بامزه که در سایت پرسه می‌زند، بازدیدکننده را سرگرم می‌کند و با کلیک باز می‌شود و به سوالات درباره‌ی شما پاسخ می‌دهد. اطلاعات شخصیت شما (نام، مهارت‌ها، پروژه‌ها) به‌صورت خودکار از محتوای سایت به مدل داده می‌شود."
            : "A cute pixel pet that wanders the site, entertains visitors, and opens a chat answering questions about YOU. Your persona (name, skills, projects) is automatically fed to the model from site content."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4" />
          {fa ? "فعال (نمایش در سایت)" : "Enabled (visible on the site)"}
        </label>
        <div>
          <Label className="text-xs">{fa ? "سرویس هوش مصنوعی" : "AI provider"}</Label>
          <select
            value={value.provider}
            onChange={(e) => set("provider", e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{fa ? p.fa : p.en}</option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {fa ? "کلید API در فایل .env سرور با نام AI_API_KEY (مثل SMTP_PASS)؛ سرویس رایگان کلید نمی‌خواهد." : "API key goes in the server .env as AI_API_KEY (like SMTP_PASS); the free provider needs no key."}
          </p>
        </div>
        <TextField label={fa ? "مدل (model — خالی = پیش‌فرض سرویس)" : "Model (empty = provider default)"} value={value.model} onChange={(x) => set("model", x)} dir="ltr" />
        <div>
          <Label className="text-xs">{fa ? "جای دکمه" : "Button position"}</Label>
          <select value={value.position} onChange={(e) => set("position", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm">
            <option value="end">{fa ? "پایین چپ (LTR: راست)" : "Bottom end"}</option>
            <option value="start">{fa ? "پایین راست (LTR: چپ)" : "Bottom start"}</option>
            <option value="custom">{fa ? "دلخواه (تنظیم بصری)" : "Custom (visual picker)"}</option>
          </select>
        </div>

        {/* Visual position picker — click/drag to place the pet */}
        {value.position === "custom" && (
          <div className="sm:col-span-2 rounded-2xl border border-border bg-surface-1 p-4">
            <p className="mb-2 text-xs font-semibold">{fa ? "موقعیت پت را روی صفحه تنظیم کنید (کلیک یا درگ)" : "Place the pet on screen (click or drag)"}</p>
            <div
              className="relative h-48 w-full cursor-crosshair overflow-hidden rounded-xl border border-border bg-background"
              style={{ background: "linear-gradient(135deg, oklch(0.15 0.03 260), oklch(0.1 0.02 240))" }}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const px = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
                const py = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)));
                onChange({ ...value, customX: px, customY: py });
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const px = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
                const py = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)));
                onChange({ ...value, customX: px, customY: py });
              }}
            >
              {/* screen outline */}
              <div className="absolute inset-2 rounded-lg border border-white/10" />
              {/* corner labels */}
              <span className="absolute left-2 top-2 text-[8px] text-white/20">↖</span>
              <span className="absolute right-2 top-2 text-[8px] text-white/20">↗</span>
              <span className="absolute left-2 bottom-2 text-[8px] text-white/20">↙</span>
              <span className="absolute right-2 bottom-2 text-[8px] text-white/20">↘</span>
              {/* grid lines */}
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/5" />
              <div className="absolute left-0 top-1/2 h-px w-full bg-white/5" />
              {/* the pet dot */}
              <div
                className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border-2 transition-all"
                style={{
                  left: `${value.customX ?? 90}%`,
                  top: `${value.customY ?? 85}%`,
                  borderColor: value.accent || "#8b5cf6",
                  background: `${value.accent || "#8b5cf6"}33`,
                  boxShadow: `0 0 12px ${value.accent || "#8b5cf6"}66`,
                }}
              >
                <Bot className="size-4" style={{ color: value.accent || "#8b5cf6" }} />
              </div>
              {/* coordinates */}
              <span className="absolute bottom-1 right-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/60" dir="ltr">
                X: {value.customX ?? 90}% · Y: {value.customY ?? 85}%
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <TextField label="X %" value={String(value.customX ?? 90)} onChange={(v) => onChange({ ...value, customX: Math.max(0, Math.min(100, Number(v) || 0)) })} />
              <TextField label="Y %" value={String(value.customY ?? 85)} onChange={(v) => onChange({ ...value, customY: Math.max(0, Math.min(100, Number(v) || 0)) })} />
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs">{fa ? "شکل پت (کاراکتر)" : "Pet look (character)"}</Label>
          <select
            value={value.character || "blob"}
            onChange={(e) => set("character", e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          >
            <option value="blob">{fa ? "بلاب (بنفش)" : "Blob (violet)"}</option>
            <option value="cat">{fa ? "گربه (نارنجی)" : "Cat (orange)"}</option>
            <option value="ghost">{fa ? "روح (سفید)" : "Ghost (white)"}</option>
            <option value="invader">{fa ? "مهاجم فضایی (سبز)" : "Invader (green)"}</option>
            <option value="slime">{fa ? "اسلایم (فیروزه‌ای)" : "Slime (teal)"}</option>
            <option value="robot">{fa ? "ربات (فولادی)" : "Robot (steel)"}</option>
            <option value="star">{fa ? "ستاره (طلایی)" : "Star (gold)"}</option>
            <option value="dragon">{fa ? "اژدها (قرمز)" : "Dragon (red)"}</option>
            <option value="panda">{fa ? "پاندا (سفید/مشکی)" : "Panda (b/w)"}</option>
            <option value="mushroom">{fa ? "قارچ (قرمز)" : "Mushroom (red)"}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.visitorChoice !== false} onChange={(e) => set("visitorChoice", e.target.checked)} className="size-4" />
          {fa ? "بازدیدکننده‌ها بتوانند ظاهر پت را خودشان عوض کنند" : "Let visitors change the pet's look themselves"}
        </label>

        {/* ── Smart Fallback Chain ── */}
        <div className="sm:col-span-2 rounded-2xl border border-[var(--sec-1)]/30 bg-[var(--sec-1)]/5 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-[var(--sec-1)]" />
            {fa ? "زنجیره‌ی هوشمند سرویس‌ها (اولویت + fallback خودکار)" : "Smart provider chain (priority + auto-failover)"}
          </p>
          <p className="mb-3 text-[10px] leading-4 text-muted-foreground">
            {fa
              ? "اگر یک سرویس قطع شود یا سهمیه‌اش تمام شود، برنامه خودکار به سرویس بعدی می‌رود. بعد از ۵ دقیقه دوباره سرویس اول را امتحان می‌کند. ترتیب را با فلش‌ها تغییر دهید. Pollinations همیشه آخرین گزینه‌ی پشتیبان است (رایگان و بدون کلید)."
              : "If a provider fails (quota/timeout), the app automatically falls back to the next one. It retries the first provider after a 5-minute cooldown. Reorder with the arrows. Pollinations is always the last-resort backup (free, no key)."}
          </p>
          <div className="space-y-2">
            {(value.fallbackChain || "google,pollinations").split(",").map((id, idx, arr) => (
              <div key={id.trim()} className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2">
                <span className="font-mono text-[10px] text-muted-foreground">{idx + 1}.</span>
                <span className="flex-1 text-sm font-medium">{id.trim()}</span>
                <div className="flex gap-0.5">
                  <Button type="button" size="icon" variant="ghost" className="size-6" disabled={idx === 0}
                    onClick={() => { const c = [...arr]; [c[idx - 1], c[idx]] = [c[idx], c[idx - 1]]; set("fallbackChain", c.join(",")); }}>
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="size-6" disabled={idx === arr.length - 1}
                    onClick={() => { const c = [...arr]; [c[idx], c[idx + 1]] = [c[idx + 1], c[idx]]; set("fallbackChain", c.join(",")); }}>
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="size-6" disabled={arr.length <= 2}
                    onClick={() => set("fallbackChain", arr.filter((_, i) => i !== idx).join(","))}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  const c = (value.fallbackChain || "").split(",").map((s) => s.trim()).filter(Boolean);
                  if (!c.includes(e.target.value)) { c.push(e.target.value); set("fallbackChain", c.join(",")); }
                  e.target.value = "";
                }}
                className="rounded-lg border border-border bg-surface-1 px-2 py-1.5 text-xs"
              >
                <option value="">{fa ? "+ افزودن سرویس…" : "+ Add provider…"}</option>
                <option value="google">Google Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="zai">Z.ai</option>
                <option value="qwen">Qwen</option>
                <option value="groq">Groq</option>
                <option value="anthropic">Anthropic</option>
                <option value="pollinations">Pollinations (free)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2"><TextField label={fa ? "پیام خوش‌آمد (greeting)" : "Greeting"} value={value.greeting} onChange={(x) => set("greeting", x)} /></div>
        <div className="sm:col-span-2"><TextAreaField label={fa ? "شخصیت و قواعد (persona)" : "Persona & rules"} value={value.persona} onChange={(x) => set("persona", x)} /></div>
      </div>

      {/* ── Second brain: owner's markdown memory (upload / edit / download) ── */}
      <div className="rounded-2xl border border-[var(--ai-1)]/30 bg-[var(--ai-1)]/5 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="size-4 text-[var(--ai-1)]" />
            {fa ? "مغز دوم — حافظه‌ی مارک‌داون (اولویت بالا برای AI)" : "Second brain — markdown memory (high priority for the AI)"}
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={memoryFileRef}
              type="file"
              accept=".md,.markdown,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                void file.text().then((text) => {
                  set("memory", text.slice(0, 20000));
                  toast.success(fa ? `«${file.name}» بارگذاری شد — برای اعمال، Save بزنید` : `«${file.name}» loaded — press Save to apply`);
                });
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => memoryFileRef.current?.click()}>
              <FileUp className="size-3.5" />
              {fa ? "آپلود .md" : "Upload .md"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const blob = new Blob([value.memory || ""], { type: "text/markdown;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "p00rija-buddy-memory.md";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="size-3.5" />
              {fa ? "دانلود" : "Download"}
            </Button>
          </div>
        </div>
        <textarea
          value={value.memory ?? ""}
          onChange={(e) => set("memory", e.target.value.slice(0, 20000))}
          dir="auto"
          rows={10}
          spellCheck={false}
          placeholder={fa
            ? "# حافظه‌ی من\nهر چیزی که می‌خواهی همدم پیکسلی همیشه بداند و اولویت بالاتری از محتوای سایت دارد:\n- داستان‌ها و خاطره‌های شخصی\n- سبک ارتباطی و علایق\n- جزئیاتی که در سایت نیست (تجربه‌ها، اهداف، فلسفه‌ی کاری…)"
            : "# My memory\nAnything the pixel buddy should ALWAYS know — takes priority over site content:\n- Personal stories and background\n- Communication style and interests\n- Details not on the site (goals, work philosophy…)"}
          className="w-full rounded-xl border border-border bg-surface-1 p-3 font-mono text-[11px] leading-5 outline-none focus:border-[var(--ai-1)]/50"
        />
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
          {fa
            ? "این متن در هر پیام، قبل از محتوای سایت به مدل داده می‌شود و اولویت بالاتری دارد؛ محتوای زنده‌ی سایت (رزومه، مهارت‌ها، پروژه‌ها) همچنان در کنارش استفاده می‌شود. حداکثر ۲۰هزار کاراکتر."
            : "Fed to the model BEFORE site content on every message (higher priority); the live site content (résumé, skills, projects) is still used alongside it. Max 20k characters."}
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {fa ? "ذخیره (هر دو زبان)" : "Save (both languages)"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Custom section form (generic shape: title, subtitle, body, items[])
 * ------------------------------------------------------------------ */

function CustomSectionForm({
  section,
  draft,
  setDraft,
}: {
  section: CustomSection;
  draft: Record<string, unknown>;
  setDraft: (v: Record<string, unknown>) => void;
}) {
  const set = (k: string, v: unknown) => setDraft({ ...draft, [k]: v });
  const lang = useContent((s) => s.lang);
  const title = typeof draft.title === "string" ? draft.title : "";
  const subtitle = typeof draft.subtitle === "string" ? draft.subtitle : "";
  const body = typeof draft.body === "string" ? draft.body : "";
  const badge = typeof draft.badge === "string" ? draft.badge : "";
  const ctaLabel = typeof draft.ctaLabel === "string" ? draft.ctaLabel : "";
  const ctaUrl = typeof draft.ctaUrl === "string" ? draft.ctaUrl : "";
  const items = Array.isArray(draft.items)
    ? (draft.items as Record<string, string>[]).map((it) =>
        it && typeof it === "object" && !Array.isArray(it)
          ? (it as Record<string, string>)
          : {}
      )
    : [];
  const gallery =
    draft.gallery && typeof draft.gallery === "object" && !Array.isArray(draft.gallery)
      ? (draft.gallery as SiteContent["graphics"]["gallery"])
      : null;

  return (
    <FormShell section={section.key} title={section.label} customNote>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="عنوان (title)"
          value={title}
          onChange={(x) => set("title", x)}
        />
        <TextField
          label="زیرعنوان (subtitle)"
          value={subtitle}
          onChange={(x) => set("subtitle", x)}
        />
        <TextField
          label="بج کوچک (badge) — اختیاری"
          value={badge}
          onChange={(x) => set("badge", x)}
        />
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="متن دکمه (ctaLabel)"
            value={ctaLabel}
            onChange={(x) => set("ctaLabel", x)}
          />
          <TextField
            label="لینک دکمه (ctaUrl)"
            value={ctaUrl}
            onChange={(x) => set("ctaUrl", x)}
            dir="ltr"
          />
        </div>
        <div className="sm:col-span-2">
          <TextAreaField
            label="متن (body)"
            value={body}
            rows={5}
            onChange={(x) => set("body", x)}
          />
        </div>
      </div>

      <KVObjectListField
        label="موارد (items) — فیلدهای دلخواه / free-form key-value pairs"
        items={items}
        onChange={(x) => set("items", x)}
      />

      {/* Optional fullscreen gallery — same editor as the builtin sections.
          Enabled the moment a title or any project exists. */}
      {gallery ? (
        <>
          <PortfolioGalleryFields
            value={gallery}
            onChange={(next) => set("gallery", next)}
            lang={lang}
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => set("gallery", null)}>
            <Trash2 className="size-3.5" />
            {lang === "fa" ? "حذف گالری از این بخش" : "Remove gallery from this section"}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            set("gallery", {
              title: section.label,
              subtitle: "",
              enterLabel: lang === "fa" ? "ورود به گالری سه‌بعدی" : "Enter the virtual gallery",
              projects: [],
            })
          }
        >
          <Frame className="size-3.5" />
          {lang === "fa" ? "افزودن گالری به این بخش" : "Add a gallery to this section"}
        </Button>
      )}
    </FormShell>
  );
}

/* ------------------------------------------------------------------ *
 * Language pill switcher
 * ------------------------------------------------------------------ */

function LanguageSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const pills: { key: Lang; label: string }[] = [
    { key: "fa", label: lang === "fa" ? "فارسی" : "Persian" },
    { key: "en", label: lang === "fa" ? "انگلیسی" : "English" },
  ];
  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-border bg-[var(--surface-1)] p-0.5"
      role="tablist"
      aria-label={lang === "fa" ? "زبان ویرایش" : "Editing language"}
    >
      {pills.map((p) => {
        const active = p.key === lang;
        return (
          <button
            key={p.key}
            role="tab"
            aria-selected={active}
            onClick={() => setLang(p.key)}
            className={cn(
              "min-w-[2.25rem] rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Main CmsPanel
 * ------------------------------------------------------------------ */

export function CmsPanel() {
  const {
    cmsOpen,
    setCmsOpen,
    contentFa,
    contentEn,
    updateSection,
    fetchContent,
    refreshContent,
    authed,
    authChecked,
    lang,
    setLang,
    logout,
    t,
  } = useContent();
  // The CMS always edits raw/base language data. Public `content` is already
  // viewport-resolved and must never be used as an editor source.
  const content = lang === "fa" ? contentFa : contentEn;

  // activeSection is now a string (built-in SectionKey OR a `custom-…` key)
  const [activeSection, setActiveSection] = useState<string>("site");
  const [draft, setDraft] = useState<unknown>(content.hero);
  const [viewportMode, setViewportMode] = useState<CmsViewportMode>("auto");
  const [responsiveBuilder, setResponsiveBuilder] = useState<BuilderConfig>(content.builder);
  const [responsiveSaving, setResponsiveSaving] = useState(false);
  const responsiveSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  // Custom-section local state (managed by the panel itself, since the
  // content store only knows the 7 built-in sections).
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);

  // Inline dialogs / toggles
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [iconPickerKey, setIconPickerKey] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);

  /* True when activeSection is a built-in key. */
  const activeIsBuiltin = BUILTIN_KEYS.has(activeSection);
  const isDeveloperSection = activeSection === DEVELOPER_SECTION_KEY;
  const isMigrationSection = activeSection === MIGRATION_SECTION_KEY;
  const isMediaSection = activeSection === MEDIA_SECTION_KEY;
  const isAnalyticsSection = activeSection === ANALYTICS_SECTION_KEY;
  const isDefenseSection = activeSection === DEFENSE_SECTION_KEY;
  const isLicenseSection = activeSection === LICENSEMGMT_SECTION_KEY;
  const isGuardSection = activeSection === GUARD_SECTION_KEY;
  const isToolSection = isDeveloperSection || isMigrationSection || isMediaSection || isAnalyticsSection || isDefenseSection || isLicenseSection || isGuardSection;

  /* The active custom section object (or null when active is built-in). */
  const activeCustom = useMemo(
    () => (activeIsBuiltin || isToolSection ? null : customSections.find((s) => s.key === activeSection) ?? null),
    [activeIsBuiltin, isToolSection, activeSection, customSections]
  );

  /* The "saved" value for the active section+lang — used for dirty compare
     and for the raw JSON editor's external sync source. */
  const baseSavedValue = useMemo<unknown>(() => {
    if (activeIsBuiltin) return (content as unknown as Record<string, unknown>)[activeSection];
    if (!activeCustom) return null;
    return activeCustom.data[lang];
  }, [activeIsBuiltin, activeSection, activeCustom, content, lang]);

  const activeDevice = viewportMode === "auto" ? null : viewportMode;
  const hasDeviceContentOverride = Boolean(
    activeDevice
    && !isToolSection
    && activeSection !== DEVELOPER_SECTION_KEY
    && Object.prototype.hasOwnProperty.call(
      content.builder.deviceContentOverrides?.[activeDevice] ?? {},
      activeSection,
    )
  );
  const savedValue = useMemo<unknown>(() => {
    if (!activeDevice || isToolSection || activeSection === DEVELOPER_SECTION_KEY) return baseSavedValue;
    const override = content.builder.deviceContentOverrides?.[activeDevice]?.[activeSection];
    return override ?? baseSavedValue;
  }, [activeDevice, activeSection, baseSavedValue, content.builder.deviceContentOverrides, isToolSection]);

  /* Reload the draft from the active language's section whenever the
     active section, language, or live content changes. This is the
     canonical "reset local editable state when its source changes"
     pattern — the effect is intentional. */
  useEffect(() => {
    const id = requestAnimationFrame(() => setDraft(savedValue));
    return () => cancelAnimationFrame(id);
  }, [savedValue]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setResponsiveBuilder(content.builder));
    return () => cancelAnimationFrame(id);
  }, [content.builder]);

  useEffect(() => () => {
    if (responsiveSaveTimer.current) clearTimeout(responsiveSaveTimer.current);
  }, []);

  /* Fetch custom sections from the API every time the CMS opens
     (so newly-added custom sections from another tab show up). */
  useEffect(() => {
    if (!cmsOpen || !authed) return;
    let cancelled = false;
    (async () => {
      const customs = await fetchAllSections();
      if (!cancelled) {
        setCustomSections(customs);
        // If the currently-active section is a custom key that no longer
        // exists in the DB (e.g. deleted elsewhere), fall back to hero.
        if (isCustomKey(activeSection) && !customs.some((c) => c.key === activeSection)) {
          setActiveSection("hero");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cmsOpen, authed, activeSection]);

  /* Lock body scroll while the panel is open. */
  useEffect(() => {
    if (!cmsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cmsOpen]);

  /* Close on Escape — but if the new-section dialog or icon picker is open,
     Escape closes that first instead of the whole panel. */
  useEffect(() => {
    if (!cmsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showNewDialog) {
        setShowNewDialog(false);
        return;
      }
      if (iconPickerKey) {
        setIconPickerKey(null);
        return;
      }
      if (renamingKey) {
        setRenamingKey(null);
        return;
      }
      if (confirmDeleteKey) {
        setConfirmDeleteKey(null);
        return;
      }
      if (confirmFactoryReset) {
        setConfirmFactoryReset(false);
        return;
      }
      if (showRaw) {
        setShowRaw(false);
        return;
      }
      if (showSecuritySettings) {
        setShowSecuritySettings(false);
        return;
      }
      setCmsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmsOpen, setCmsOpen, showNewDialog, iconPickerKey, renamingKey, confirmDeleteKey, confirmFactoryReset, showRaw, showSecuritySettings]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedValue),
    [draft, savedValue]
  );

  /* Ordered page sections (structural source: en, custom labels merged) —
     used by the "new section" dialog to pick an insertion position. */
  const builderSectionsEn = contentEn.builder?.sections;
  const builderSectionsFa = contentFa.builder?.sections;
  const layoutSectionOptions = useMemo(() => {
    const base = builderSectionsEn?.length ? builderSectionsEn : builderSectionsFa ?? [];
    const ordered = [...base].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const ids = new Set(ordered.map((s) => s.id));
    const missingBuiltins = ["hero", "graphics", "security", "ai", "timeline", "synthesis"]
      .filter((id) => !ids.has(id))
      .map((id) => ({ id, label: id, enabled: true }));
    return [...ordered, ...missingBuiltins]
      .filter((s) => s.enabled !== false)
      .map((s) => ({
        id: s.id,
        label: s.id.startsWith("custom-")
          ? customSections.find((c) => c.key === s.id)?.label ?? s.label ?? s.id
          : s.label || s.id,
      }));
  }, [builderSectionsEn, builderSectionsFa, customSections]);

  const filteredBuiltins = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = BUILTIN_SECTIONS.filter(
      (s) => s.labelFa.toLowerCase().includes(q) || s.labelEn.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)
    );
    return list;
  }, [query]);

  // World sections (graphics/ai/security) follow the CMS section order, so
  // the sidebar mirrors the live page after any drag-and-drop reorder.
  const orderedBuiltins = useMemo(() => {
    const order = worldOrder(useContent.getState().content);
    const rank = (key: string) => {
      const i = order.indexOf(key as never);
      return i === -1 ? 99 : i;
    };
    const sorted = [...filteredBuiltins].sort((a, b) => {
      const ra = rank(a.key), rb = rank(b.key);
      return ra !== rb ? ra - rb : a.index.localeCompare(b.index);
    });
    // Build a position map: world sections get their dynamic position from
    // the CMS order; non-world sections keep their original index.
    const worldRank = new Map<string, string>();
    order.forEach((id, i) => worldRank.set(id, String(i + 1).padStart(2, "0")));
    return sorted.map((s) => ({
      ...s,
      // Override the display index for world sections with the live position
      displayIndex: worldRank.get(s.key) ?? s.index,
    }));
  }, [filteredBuiltins, contentEn, contentFa]);

  const filteredCustoms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customSections;
    return customSections.filter(
      (s) => s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)
    );
  }, [query, customSections]);
  const developerMatchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q || "درباره سازنده اطلاعات دولوپر developer creator about".includes(q);
  }, [query]);
  const migrationMatchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q || "مهاجرت بک‌آپ بازیابی انتقال سرور migration backup restore server ssl".includes(q);
  }, [query]);
  const mediaMatchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q || "رسانه مدیا عکس ویدیو صوت فایل سند آیکون فونت لاتی سه بعدی media image video audio file document icon font lottie 3d".includes(q);
  }, [query]);
  const analyticsMatchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q || "آمار بازدید بازدیدکننده تحلیل گراف گزارش analytics visitors stats traffic charts".includes(q);
  }, [query]);
  const defenseMatchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q || "دفاع امنیت سد فایروال ربات تهدید بن بلاک defense firewall bot threat ban block waf security".includes(q);
  }, [query]);
  const guardMatchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q || "قفل رمز پسورد گذاری بلور محافظت سایت بخش pin password lock protect guard privacy".includes(q);
  }, [query]);

  /* Lock background page scroll (incl. Lenis) while the CMS is open —
     scrolling inside the sidebar/form must never move the page behind. */
  useEffect(() => {
    if (!cmsOpen) return;
    const resume = suspendLenis();
    return resume;
  }, [cmsOpen]);

  /* Cross-tab navigation (e.g. the Analytics integrations shortcut jumps
     straight to the Builder integrations block). */
  useEffect(() => {
    const onGoto = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      if (!target) return;
      setActiveSection(target);
      setConfirmReset(false);
      setShowRaw(false);
    };
    window.addEventListener("cms-goto", onGoto);
    return () => window.removeEventListener("cms-goto", onGoto);
  }, []);

  /* Auth gate — render nothing unless authenticated (and checked).
     Called AFTER all hooks to respect the Rules of Hooks. */
  if (!authChecked || !authed) return null;

  /* ---------- Handlers ---------- */

  const handleSave = async () => {
    if (activeDevice && !isToolSection && activeSection !== DEVELOPER_SECTION_KEY) {
      setSaving(true);
      if (responsiveSaveTimer.current) {
        clearTimeout(responsiveSaveTimer.current);
        responsiveSaveTimer.current = null;
      }
      let snapshot = draft;
      if (activeSection === "builder" && draft && typeof draft === "object" && !Array.isArray(draft)) {
        const { deviceContentOverrides: _nested, ...safeBuilderSnapshot } = draft as BuilderConfig;
        void _nested;
        snapshot = safeBuilderSnapshot;
      }
      const deviceOverrides = content.builder.deviceContentOverrides ?? {};
      const nextBuilder: BuilderConfig = {
        ...content.builder,
        sections: responsiveBuilder.sections,
        responsive: responsiveBuilder.responsive,
        deviceContentOverrides: {
          ...deviceOverrides,
          [activeDevice]: {
            ...(deviceOverrides[activeDevice] ?? {}),
            [activeSection]: snapshot,
          },
        },
      };
      const ok = await postCustomLang("builder", lang, nextBuilder);
      setSaving(false);
      if (ok) {
        setResponsiveBuilder(nextBuilder);
        setLastSaved(Date.now());
        await refreshContent();
        toast.success(lang === "fa" ? `نسخه ${activeDevice} ذخیره شد` : `${activeDevice} override saved`);
      } else {
        toast.error(t("saveError"));
      }
      return;
    }
    if (activeIsBuiltin) {
      setSaving(true);
      const ok = await updateSection(activeSection as SectionKey, draft);
      setSaving(false);
      if (ok) {
        setLastSaved(Date.now());
        toast.success(t("saved"));
      } else {
        toast.error(t("saveError"));
      }
      return;
    }
    if (!activeCustom) return;
    setSaving(true);
    const ok = await postCustomLang(activeCustom.key, lang, draft);
    setSaving(false);
    if (ok) {
      setCustomSections((prev) =>
        prev.map((s) =>
          s.key === activeCustom.key ? { ...s, data: { ...s.data, [lang]: draft as Record<string, unknown> } } : s
        )
      );
      setLastSaved(Date.now());
      await refreshContent();
      toast.success(t("saved"));
    } else {
      toast.error(t("saveError"));
    }
  };

  const handleReset = () => {
    setDraft(savedValue);
    setConfirmReset(false);
  };

  const handleUseAutomaticContent = async () => {
    if (!activeDevice || !hasDeviceContentOverride) return;
    setSaving(true);
    const deviceOverrides = content.builder.deviceContentOverrides ?? {};
    const currentDevice = { ...(deviceOverrides[activeDevice] ?? {}) };
    delete currentDevice[activeSection];
    const nextBuilder: BuilderConfig = {
      ...content.builder,
      deviceContentOverrides: {
        ...deviceOverrides,
        [activeDevice]: currentDevice,
      },
    };
    const ok = await postCustomLang("builder", lang, nextBuilder);
    setSaving(false);
    if (ok) {
      setResponsiveBuilder(nextBuilder);
      setDraft(baseSavedValue);
      setLastSaved(Date.now());
      await refreshContent();
      toast.success(lang === "fa" ? "محتوای خودکار دوباره فعال شد" : "Automatic content restored");
    } else {
      toast.error(t("saveError"));
    }
  };

  /** Responsive layout is structural and shared by both languages. Changes
   *  are debounced and persisted from every CMS section, while localized
   *  section labels remain untouched in their own language rows. */
  const handleResponsiveBuilderChange = (next: BuilderConfig) => {
    setResponsiveBuilder(next);
    setResponsiveSaving(true);
    if (responsiveSaveTimer.current) clearTimeout(responsiveSaveTimer.current);
    responsiveSaveTimer.current = setTimeout(async () => {
      responsiveSaveTimer.current = null;
      const mergeLayout = (target: BuilderConfig) => {
        const labels = new Map((target.sections ?? []).map((section) => [section.id, section.label]));
        return {
          ...target,
          sections: (next.sections ?? []).map((section) => ({ ...section, label: labels.get(section.id) ?? section.label })),
          responsive: next.responsive,
        };
      };
      const [okFa, okEn] = await Promise.all([
        postCustomLang("builder", "fa", mergeLayout(contentFa.builder)),
        postCustomLang("builder", "en", mergeLayout(contentEn.builder)),
      ]);
      setResponsiveSaving(false);
      if (okFa && okEn) setLastSaved(Date.now());
      else toast.error(lang === "fa" ? "ذخیره تنظیمات واکنش‌گرا انجام نشد" : "Responsive settings could not be saved");
    }, 550);
  };

  /* ---------- Instant cross-language layout persistence ----------
     Used by the SectionsManager: builder.sections and hero.planets are
     structural (not per-language prose), so every layout change is
     written to BOTH fa and en rows immediately. */

  const persistBuilderSections = async (sections: BuilderConfig["sections"]): Promise<boolean> => {
    // Sort by current order and renumber 1..n so insertions/moves keep the
    // numbering (nav order, section indices) in sync automatically.
    const normalized = [...sections]
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((s, i) => ({ ...s, order: i + 1 }));
    const okFa = await postCustomLang("builder", "fa", { ...contentFa.builder, sections: normalized });
    const okEn = await postCustomLang("builder", "en", { ...contentEn.builder, sections: normalized });
    if (okFa || okEn) await refreshContent();
    return okFa && okEn;
  };

  const persistPlanets = async (planetsFa: PlanetConfig[], planetsEn: PlanetConfig[]): Promise<boolean> => {
    const okFa = await postCustomLang("hero", "fa", { ...contentFa.hero, planets: planetsFa });
    const okEn = await postCustomLang("hero", "en", { ...contentEn.hero, planets: planetsEn });
    if (okFa || okEn) await refreshContent();
    return okFa && okEn;
  };

  /** Insert a builder.sections entry (both langs) for a custom section.
   *  insertAfter = id of an existing section ("end" appends). Ordering and
   *  numbering of every other section re-normalizes automatically. */
  const addSectionEntry = async (key: string, label: string, insertAfter: string | "end" = "end") => {
    const base = [...(contentEn.builder?.sections?.length
      ? contentEn.builder.sections
      : contentFa.builder?.sections ?? [])] as BuilderConfig["sections"];
    const maxOrder = base.reduce((m, s) => Math.max(m, Number(s.order || 0)), 0);
    const entry = {
      id: key,
      label,
      enabled: true,
      order: maxOrder + 1,
      anchor: key,
      layout: "wide" as const,
      paddingTop: 100,
      paddingBottom: 100,
      maxWidth: 1280,
      background: "transparent",
      accent: "var(--ai-1)",
      textColor: "var(--foreground)",
      radius: 0,
      blur: 0,
      opacity: 1,
      link: "",
      hoverEffect: "lift" as const,
      customClass: "",
    };
    let next: BuilderConfig["sections"];
    if (insertAfter !== "end") {
      const idx = base.findIndex((s) => s.id === insertAfter);
      next = idx >= 0 ? [...base.slice(0, idx + 1), entry, ...base.slice(idx + 1)] : [...base, entry];
    } else {
      next = [...base, entry];
    }
    // Renumber by ARRAY position — the inserted entry must not keep the
    // maxOrder it was born with, or position-based sorting would send it
    // straight back to the end of the page.
    next = next.map((s, i) => ({ ...s, order: i + 1 }));
    await persistBuilderSections(next);
  };

  const clearClientProgress = (keys: string[]) => {
    if (typeof window === "undefined") return;
    const knownKeys = new Set([
      ...keys,
      "p00rija-404-leaderboard",
      "p00rija-404-coins",
      "p00rija-404-upgrades",
      "p00rija-content-cache-v1",
      "cb-best-tries",
      "cm-best-score",
      "nm-best-round",
    ]);
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("p00rija-") || knownKeys.has(key))
      .forEach((key) => window.localStorage.removeItem(key));
  };

  const handleFactoryReset = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/content", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "reset failed");
      clearClientProgress(Array.isArray(json.clientStorageKeys) ? json.clientStorageKeys : []);
      setCustomSections([]);
      setActiveSection("hero");
      setConfirmFactoryReset(false);
      setConfirmReset(false);
      setShowRaw(false);
      await refreshContent();
      setDraft(useContent.getState().content.hero);
      setLastSaved(Date.now());
      toast.success(lang === "fa" ? "بوم خالی ساخته شد؛ محتوا، فایل‌ها و رکوردها پاک شدند" : "Blank canvas created; content, uploads and records were deleted");
    } catch {
      toast.error(lang === "fa" ? "بازگردانی کامل انجام نشد" : "Factory reset failed");
    } finally {
      setBusy(false);
    }
  };

  /** Duplicate any section (built-in or custom) into a new custom section
   *  that clones BOTH fa and en data. The copy is appended to the page
   *  layout (builder.sections) and gets its own planet if the source had one. */
  const handleDuplicate = async (sourceKey: string) => {
    let faData: unknown;
    let enData: unknown;
    let sourceLabel: string;
    let sourceIconKey = "file";
    if (BUILTIN_KEYS.has(sourceKey)) {
      faData = (contentFa as unknown as Record<string, unknown>)[sourceKey];
      enData = (contentEn as unknown as Record<string, unknown>)[sourceKey];
      sourceLabel = builtinLabel(sourceKey, lang);
    } else {
      const src = customSections.find((s) => s.key === sourceKey);
      if (!src) return;
      faData = src.data.fa;
      enData = src.data.en;
      sourceLabel = src.label;
      sourceIconKey = src.iconKey;
    }

    const newKey = newCustomKey();
    const newLabel = lang === "fa" ? `کپیِ ${sourceLabel}` : `Copy of ${sourceLabel}`;
    setBusy(true);
    try {
      const [okFa, okEn, okMeta] = await Promise.all([
        postCustomLang(newKey, "fa", faData),
        postCustomLang(newKey, "en", enData),
        postCustomMeta(newKey, { label: newLabel, iconKey: sourceIconKey }),
      ]);
      if (!okFa || !okEn || !okMeta) throw new Error("duplicate failed");
      const newSection: CustomSection = {
        key: newKey,
        label: newLabel,
        iconKey: sourceIconKey,
        data: {
          fa: (faData as Record<string, unknown>) ?? {},
          en: (enData as Record<string, unknown>) ?? {},
        },
      };
      setCustomSections((prev) => [...prev, newSection]);
      setActiveSection(newKey);
      setConfirmReset(false);
      setShowRaw(false);

      // Append to the page layout so the copy actually renders on the site.
      await addSectionEntry(newKey, newLabel);

      // If the source section had a linked planet, clone it for the copy.
      const sourcePlanetFa = contentFa.hero?.planets?.find((p) => p.sectionId === sourceKey);
      if (sourcePlanetFa) {
        const cloned = { ...sourcePlanetFa, id: `p-${newKey}`, sectionId: newKey };
        const sourcePlanetEn = contentEn.hero?.planets?.find((p) => p.sectionId === sourceKey);
        await persistPlanets(
          [...(contentFa.hero.planets ?? []), cloned],
          [...(contentEn.hero.planets ?? []), { ...(sourcePlanetEn ?? sourcePlanetFa), id: `p-${newKey}`, sectionId: newKey }]
        );
      }

      await refreshContent();
      toast.success(lang === "fa" ? "بخش کپی شد و به صفحه اضافه شد" : "Section duplicated and added to the page");
    } catch {
      toast.error(t("saveError"));
    } finally {
      setBusy(false);
    }
  };

  /** Create a brand-new blank custom section at the chosen position, add it
   *  to the page layout and (optionally) give it a planet in the hero. */
  const handleCreateCustom = async (
    label: string,
    iconKey: string,
    withPlanet = false,
    insertAfter: string | "end" = "end"
  ) => {
    const newKey = newCustomKey();
    const blankFa = blankCustomData();
    const blankEn = blankCustomData();
    setBusy(true);
    try {
      const [okFa, okEn, okMeta] = await Promise.all([
        postCustomLang(newKey, "fa", blankFa),
        postCustomLang(newKey, "en", blankEn),
        postCustomMeta(newKey, { label, iconKey }),
      ]);
      if (!okFa || !okEn || !okMeta) throw new Error("create failed");
      const newSection: CustomSection = {
        key: newKey,
        label,
        iconKey,
        data: { fa: blankFa, en: blankEn },
      };
      setCustomSections((prev) => [...prev, newSection]);
      setActiveSection(newKey);
      setShowNewDialog(false);
      setConfirmReset(false);
      setShowRaw(false);

      // Insert into the page layout at the chosen position (both languages).
      await addSectionEntry(newKey, label, insertAfter);

      if (withPlanet) {
        const planet = makePlanetForSection(newKey, label);
        await persistPlanets(
          [...(contentFa.hero.planets ?? []), { ...planet, label }],
          [...(contentEn.hero.planets ?? []), planet]
        );
      }

      await refreshContent();
      toast.success(
        lang === "fa"
          ? withPlanet
            ? "بخش ساخته شد و سیاره‌اش به آسمان اضافه شد 🪐"
            : "بخش ساخته شد و به صفحه اضافه شد"
          : withPlanet
            ? "Section created with its own planet 🪐"
            : "Section created and added to the page"
      );
    } catch {
      toast.error(t("saveError"));
    } finally {
      setBusy(false);
    }
  };

  /** Delete a custom section (built-ins cannot be deleted) — also removes
   *  its layout entry and its linked planet. */
  const handleDeleteCustom = async (key: string) => {
    setBusy(true);
    try {
      const ok = await deleteCustomSection(key);
      if (!ok) throw new Error("delete failed");
      setCustomSections((prev) => prev.filter((s) => s.key !== key));
      if (activeSection === key) {
        setActiveSection("hero");
        setShowRaw(false);
      }
      setConfirmDeleteKey(null);

      // remove layout entry + linked planet (both langs)
      await persistBuilderSections(
        (contentEn.builder?.sections ?? contentFa.builder?.sections ?? []).filter((s) => s.id !== key)
      );
      if (contentFa.hero?.planets?.some((p) => p.sectionId === key)) {
        await persistPlanets(
          contentFa.hero.planets.filter((p) => p.sectionId !== key),
          contentEn.hero.planets.filter((p) => p.sectionId !== key)
        );
      }
      await refreshContent();
      toast.success(lang === "fa" ? "بخش حذف شد" : "Section deleted");
    } catch {
      toast.error(lang === "fa" ? "خطا در حذف" : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  /** Persist a custom section's new label to _meta. */
  const handleRenameCustom = async (key: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const ok = await postCustomMeta(key, { label: trimmed });
      if (!ok) throw new Error("rename failed");
      setCustomSections((prev) =>
        prev.map((s) => (s.key === key ? { ...s, label: trimmed } : s))
      );
      setRenamingKey(null);
      toast.success(lang === "fa" ? "برچسب به‌روزرسانی شد" : "Label updated");
    } catch {
      toast.error(t("saveError"));
    } finally {
      setBusy(false);
    }
  };

  /** Persist a custom section's iconKey to _meta (optimistic). */
  const handleChangeIcon = async (key: string, newIconKey: string) => {
    setCustomSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, iconKey: newIconKey } : s))
    );
    setIconPickerKey(null);
    await postCustomMeta(key, { iconKey: newIconKey });
  };

  /** Apply raw JSON edits — replaces the draft object. */
  const handleApplyRaw = (next: Record<string, unknown>) => {
    setDraft(next);
  };

  const editingHint = lang === "fa" ? "در حال ویرایش: فارسی" : "Editing: English";
  const lastSavedLabel = lastSaved
    ? new Date(lastSaved).toLocaleTimeString(lang === "fa" ? "fa-IR" : "en-US")
    : "—";

  /* The display title for the form action bar. */
  const activeTitle = isDeveloperSection
    ? (lang === "fa" ? "درباره سازنده" : "About the Developer")
    : isMigrationSection
      ? (lang === "fa" ? "مهاجرت و بک‌آپ" : "Migration & Backup")
    : isMediaSection
      ? (lang === "fa" ? "کتابخانه رسانه" : "Media Library")
    : isAnalyticsSection
      ? (lang === "fa" ? "مرکز آمار بازدیدکنندگان" : "Visitor Analytics")
    : isDefenseSection
      ? (lang === "fa" ? "مرکز سد دفاعی" : "Defense Center")
    : isLicenseSection
      ? (lang === "fa" ? "مدیریت لایسنس" : "License Manager")
    : isGuardSection
      ? (lang === "fa" ? "قفل رمز سایت و بخش‌ها" : "Access Guard")
    : activeIsBuiltin
      ? builtinLabel(activeSection, lang)
      : activeCustom?.label ?? activeSection;

  return (
    <AnimatePresence>
      {cmsOpen && (
        <motion.div
          key="cms-overlay"
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setCmsOpen(false)}
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("cmsTitle")}
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-[92vh] max-h-[92vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--surface-1)] px-4 py-3 sm:px-6">
              {/* Title block */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background">
                  <LayoutDashboard className="size-4 text-foreground" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-foreground">
                    {t("cmsTitle")}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("cmsSubtitle")}
                  </p>
                </div>
              </div>

              {/* Right cluster: language + editing hint + actions */}
              <div className="ms-auto flex flex-wrap items-center gap-2">
                <div className="hidden items-center gap-2 sm:flex">
                  <LanguageSwitcher lang={lang} setLang={setLang} />
                  <span className="text-xs text-muted-foreground">{editingHint}</span>
                </div>

                {/* Unsaved dot */}
                {dirty && (
                  <span
                    className="size-2 rounded-full bg-amber-500"
                    title={lang === "fa" ? "تغییرات ذخیره‌نشده" : "Unsaved changes"}
                    aria-label={lang === "fa" ? "تغییرات ذخیره‌نشده" : "Unsaved changes"}
                  />
                )}

                {/* Reset (with inline confirm) */}
                {confirmReset ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleReset}
                    >
                      {lang === "fa" ? "تأیید بازنشانی" : "Confirm reset"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmReset(false)}
                    >
                      {lang === "fa" ? "انصراف" : "Cancel"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmReset(true)}
                    disabled={!dirty}
                    title={lang === "fa" ? "بازنشانی به محتوای ذخیره‌شده" : "Reset to saved content"}
                  >
                    <RotateCcw className="size-4" />
                    <span className="hidden md:inline">
                      {lang === "fa" ? "بازنشانی" : "Reset"}
                    </span>
                  </Button>
                )}

                {confirmFactoryReset ? (
                  <div className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 p-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleFactoryReset}
                      disabled={busy}
                      title={lang === "fa" ? "همه محتوا و فایل‌ها پاک می‌شوند و بوم خالی می‌ماند" : "Deletes all content and uploads and leaves a blank canvas"}
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <AlertCircle className="size-4" />}
                      <span className="hidden xl:inline">
                        {lang === "fa" ? "پاک‌سازی کامل" : "Factory reset"}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmFactoryReset(false)}
                      disabled={busy}
                    >
                      {lang === "fa" ? "لغو" : "Cancel"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmFactoryReset(true)}
                    disabled={busy}
                    title={lang === "fa" ? "پاک‌سازی کل برنامه و ساخت بوم خالی" : "Clear the whole app and create a blank canvas"}
                  >
                    <Trash2 className="size-4" />
                    <span className="hidden xl:inline">
                      {lang === "fa" ? "بازگردانی کامل" : "Factory reset"}
                    </span>
                  </Button>
                )}

                {/* Save */}
                <Button onClick={handleSave} disabled={saving || busy || isToolSection} size="sm">
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  <span className="hidden sm:inline">
                    {activeDevice
                      ? (lang === "fa" ? `ذخیره برای ${activeDevice}` : `Save ${activeDevice}`)
                      : t("save")}
                  </span>
                </Button>

                <Button
                  onClick={() => setShowSecuritySettings(true)}
                  size="sm"
                  variant="outline"
                  title={lang === "fa" ? "تنظیمات امنیتی" : "Security settings"}
                >
                  <Settings className="size-4" />
                  <span className="hidden lg:inline">
                    {lang === "fa" ? "امنیت" : "Security"}
                  </span>
                </Button>

                {/* Logout */}
                <Button
                  onClick={() => logout()}
                  size="sm"
                  variant="outline"
                  title={t("logout")}
                >
                  <LogOut className="size-4" />
                  <span className="hidden lg:inline">{t("logout")}</span>
                </Button>

                {/* Close */}
                <Button
                  onClick={() => setCmsOpen(false)}
                  size="icon"
                  variant="ghost"
                  aria-label={t("close")}
                >
                  <X className="size-5" />
                </Button>
              </div>

              {/* Global viewport context — persistent across every CMS tab and kept at the far edge on desktop. */}
              <div className="order-3 flex w-full items-center justify-center gap-2 xl:order-none xl:w-auto xl:justify-end">
                <CmsViewportToolbar mode={viewportMode} lang={lang} onChange={setViewportMode} compact />
                {responsiveSaving && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="size-3 animate-spin" />{lang === "fa" ? "ذخیره…" : "Saving…"}</span>}
              </div>
            </div>

            {/* Mobile language row */}
            <div className="flex items-center justify-between gap-2 border-b border-border bg-[var(--surface-1)] px-4 py-2 sm:hidden">
              <LanguageSwitcher lang={lang} setLang={setLang} />
              <span className="text-xs text-muted-foreground">{editingHint}</span>
            </div>

            {/* Body: two-column on lg, stacked on mobile */}
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              {/* Sidebar */}
              <aside data-lenis-prevent className="flex max-h-[32vh] shrink-0 flex-col border-b border-border bg-[var(--surface-1)] safe-bottom lg:max-h-none lg:border-b-0 lg:border-e lg:w-72">
                {/* Search box + New section button */}
                <div className="space-y-2 border-b border-border p-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={lang === "fa" ? "جستجوی بخش…" : "Filter sections…"}
                      className="border-border bg-background py-2 ps-8 text-sm text-foreground"
                      aria-label={lang === "fa" ? "جستجو" : "Filter"}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowNewDialog(true)}
                    disabled={busy}
                  >
                    <Plus className="size-4" />
                    {lang === "fa" ? "بخش جدید" : "New section"}
                  </Button>
                  <AnimatePresence>
                    {showNewDialog && (
                      <NewSectionDialog
                        onCreate={handleCreateCustom}
                        onCancel={() => setShowNewDialog(false)}
                        busy={busy}
                        sectionOptions={layoutSectionOptions}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Section list (built-in + custom, grouped) */}
                <div data-lenis-prevent className="flex gap-1 overflow-x-auto p-2 pb-6 lg:flex-col lg:overflow-y-auto">
                  {/* Built-in groups (content / design / system) */}
                  {SECTION_GROUPS.map((g) => {
                    const groupItems = orderedBuiltins.filter((s) => s.group === g.id);
                    if (!groupItems.length) return null;
                    return (
                    <div key={g.id} className="flex gap-1 lg:flex-col">
                      <p className="hidden px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 lg:block">
                        {lang === "fa" ? g.fa : g.en}
                      </p>
                      {groupItems.map((s) => {
                      const Icon = s.icon;
                      const active = s.key === activeSection;
                      return (
                        <div key={s.key} className="relative flex shrink-0 items-center lg:w-full">
                          <button
                            onClick={() => {
                              setActiveSection(s.key);
                              setConfirmReset(false);
                              setShowRaw(false);
                              setConfirmDeleteKey(null);
                              setRenamingKey(null);
                              setIconPickerKey(null);
                            }}
                            className={cn(
                              "group flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all lg:w-full",
                              active
                                ? "bg-background text-foreground"
                                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                            )}
                            style={
                              active
                                ? {
                                    boxShadow: s.color
                                      ? `inset 3px 0 0 ${s.color}`
                                      : "inset 3px 0 0 var(--foreground)",
                                  }
                                : undefined
                            }
                          >
                            <Icon
                              className="size-4 shrink-0"
                              style={s.color ? { color: s.color } : undefined}
                            />
                            <span className="whitespace-nowrap font-medium">
                              {lang === "fa" ? s.labelFa : s.labelEn}
                            </span>
                            <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">
                              {s.displayIndex ?? s.index}
                            </span>
                          </button>
                          {/* Duplicate (small icon button, on hover) */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute end-1 top-1/2 -translate-y-1/2 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDuplicate(s.key);
                            }}
                            disabled={busy}
                            aria-label={lang === "fa" ? "کپی بخش" : "Duplicate section"}
                            title={lang === "fa" ? "کپی به بخش سفارشی" : "Duplicate as custom"}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      );
                      })}
                    </div>
                    );
                  })}

                  {/* Custom group */}
                  <div className="flex gap-1 border-t border-border ps-0 pt-2 lg:flex-col lg:border-t lg:ps-0">
                    <p className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 lg:block">
                      {lang === "fa" ? "بخش‌های سفارشی" : "Custom"}
                    </p>
                    {filteredCustoms.length === 0 && (
                      <p className="hidden px-2 py-2 text-xs italic text-muted-foreground lg:block">
                        {lang === "fa" ? "هیچ بخش سفارشی وجود ندارد" : "No custom sections yet"}
                      </p>
                    )}
                    {filteredCustoms.map((s) => {
                      const active = s.key === activeSection;
                      const isConfirming = confirmDeleteKey === s.key;
                      const isRenaming = renamingKey === s.key;
                      const isPickingIcon = iconPickerKey === s.key;
                      return (
                        <div
                          key={s.key}
                          className="relative flex w-full shrink-0 flex-col gap-1 lg:w-full"
                        >
                          <div className="flex shrink-0 items-center lg:w-full">
                            <button
                              onClick={() => {
                                setActiveSection(s.key);
                                setConfirmReset(false);
                                setShowRaw(false);
                                setConfirmDeleteKey(null);
                                setRenamingKey(null);
                                setIconPickerKey(null);
                              }}
                              className={cn(
                                "group flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all lg:w-full",
                                active
                                  ? "bg-background text-foreground"
                                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                              )}
                              style={
                                active
                                  ? { boxShadow: "inset 3px 0 0 var(--foreground)" }
                                  : undefined
                              }
                            >
                              <CustomIconView iconKey={s.iconKey} className="size-4 shrink-0" />
                              {isRenaming ? (
                                <Input
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="h-7 border-border bg-background px-2 py-0 text-xs text-foreground"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      void handleRenameCustom(s.key, renameValue);
                                    }
                                    if (e.key === "Escape") setRenamingKey(null);
                                  }}
                                />
                              ) : (
                                <span className="truncate whitespace-nowrap font-medium">
                                  {s.label}
                                </span>
                              )}
                              <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">
                                custom
                              </span>
                            </button>
                            {/* Per-item action buttons (hover-only on lg) */}
                            <div className="absolute end-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 lg:opacity-100">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDuplicate(s.key);
                                }}
                                disabled={busy}
                                aria-label={lang === "fa" ? "کپی" : "Duplicate"}
                                title={lang === "fa" ? "کپی" : "Duplicate"}
                              >
                                <Copy className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingKey(s.key);
                                  setRenameValue(s.label);
                                }}
                                disabled={busy}
                                aria-label={lang === "fa" ? "تغییر نام" : "Rename"}
                                title={lang === "fa" ? "تغییر نام" : "Rename"}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIconPickerKey(isPickingIcon ? null : s.key);
                                }}
                                disabled={busy}
                                aria-label={lang === "fa" ? "تغییر آیکون" : "Change icon"}
                                title={lang === "fa" ? "تغییر آیکون" : "Change icon"}
                              >
                                <Box className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteKey(isConfirming ? null : s.key);
                                }}
                                disabled={busy}
                                aria-label={lang === "fa" ? "حذف" : "Delete"}
                                title={lang === "fa" ? "حذف" : "Delete"}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {/* Inline rename confirm (mobile-friendly) */}
                          {isRenaming && (
                            <div className="flex items-center gap-1 px-3 pb-1 lg:hidden">
                              <Button
                                size="sm"
                                onClick={() => void handleRenameCustom(s.key, renameValue)}
                                disabled={busy || !renameValue.trim()}
                              >
                                <Check className="size-3.5" />
                                {lang === "fa" ? "ذخیره نام" : "Save name"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setRenamingKey(null)}>
                                {lang === "fa" ? "انصراف" : "Cancel"}
                              </Button>
                            </div>
                          )}

                          {/* Inline icon picker — searchable Font Awesome + lucide */}
                          {isPickingIcon && (
                            <div className="rounded-md border border-border bg-background p-2 lg:ms-3">
                              <IconPickerGrid
                                activeKey={s.iconKey}
                                onPick={(key) => void handleChangeIcon(s.key, key)}
                                lang={lang}
                              />
                            </div>
                          )}

                          {/* Inline delete confirm */}
                          {isConfirming && (
                            <div className="flex items-center gap-1 px-3 pb-1">
                              <span className="text-xs text-muted-foreground">
                                {lang === "fa" ? "حذف این بخش؟" : "Delete this section?"}
                              </span>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void handleDeleteCustom(s.key)}
                                disabled={busy}
                              >
                                {lang === "fa" ? "حذف" : "Delete"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmDeleteKey(null)}
                                disabled={busy}
                              >
                                {lang === "fa" ? "انصراف" : "Cancel"}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {(developerMatchesQuery || migrationMatchesQuery || mediaMatchesQuery || analyticsMatchesQuery || defenseMatchesQuery || guardMatchesQuery) && (
                    <div className="flex gap-1 border-t border-border pt-2 lg:flex-col">
                      <p className="hidden px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 lg:block">
                        {lang === "fa" ? "سیستم و ابزارها" : "System & Tools"}
                      </p>
                      {developerMatchesQuery && <button
                        onClick={() => {
                          setActiveSection(DEVELOPER_SECTION_KEY);
                          setConfirmReset(false);
                          setShowRaw(false);
                          setConfirmDeleteKey(null);
                          setRenamingKey(null);
                          setIconPickerKey(null);
                        }}
                        className={cn(
                          "flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                          isDeveloperSection
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        )}
                        style={isDeveloperSection ? { boxShadow: "inset 3px 0 0 var(--ai-1)" } : undefined}
                      >
                        <BadgeCheck className="size-4 shrink-0 text-[var(--ai-1)]" />
                        <span className="whitespace-nowrap font-medium">
                          {lang === "fa" ? "درباره سازنده" : "About the Developer"}
                        </span>
                        <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">INFO</span>
                      </button>}
                      {mediaMatchesQuery && <button
                        onClick={() => { setActiveSection(MEDIA_SECTION_KEY); setConfirmReset(false); setShowRaw(false); }}
                        className={cn("flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all", isMediaSection ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background/60 hover:text-foreground")}
                        style={isMediaSection ? { boxShadow: "inset 3px 0 0 var(--gfx-1)" } : undefined}
                      >
                        <Library className="size-4 shrink-0 text-[var(--gfx-1)]" />
                        <span className="whitespace-nowrap font-medium">{lang === "fa" ? "کتابخانه رسانه و آیکون" : "Media & Icon Library"}</span>
                        <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">LIB</span>
                      </button>}
                      {migrationMatchesQuery && <button
                        onClick={() => {
                          setActiveSection(MIGRATION_SECTION_KEY);
                          setConfirmReset(false);
                          setShowRaw(false);
                          setConfirmDeleteKey(null);
                          setRenamingKey(null);
                          setIconPickerKey(null);
                        }}
                        className={cn(
                          "flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                          isMigrationSection
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        )}
                        style={isMigrationSection ? { boxShadow: "inset 3px 0 0 var(--sec-1)" } : undefined}
                      >
                        <DatabaseBackup className="size-4 shrink-0 text-[var(--sec-1)]" />
                        <span className="whitespace-nowrap font-medium">
                          {lang === "fa" ? "مهاجرت و بک‌آپ" : "Migration & Backup"}
                        </span>
                        <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">TOOL</span>
                      </button>}
                      {analyticsMatchesQuery && <button
                        onClick={() => {
                          setActiveSection(ANALYTICS_SECTION_KEY);
                          setConfirmReset(false);
                          setShowRaw(false);
                          setConfirmDeleteKey(null);
                          setRenamingKey(null);
                          setIconPickerKey(null);
                        }}
                        className={cn(
                          "flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                          isAnalyticsSection
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        )}
                        style={isAnalyticsSection ? { boxShadow: "inset 3px 0 0 #34d399" } : undefined}
                      >
                        <BarChart3 className="size-4 shrink-0 text-[#34d399]" />
                        <span className="whitespace-nowrap font-medium">
                          {lang === "fa" ? "مرکز آمار بازدیدکنندگان" : "Visitor Analytics"}
                        </span>
                        <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">STATS</span>
                      </button>}
                      {defenseMatchesQuery && <button
                        onClick={() => {
                          setActiveSection(DEFENSE_SECTION_KEY);
                          setConfirmReset(false);
                          setShowRaw(false);
                          setConfirmDeleteKey(null);
                          setRenamingKey(null);
                          setIconPickerKey(null);
                        }}
                        className={cn(
                          "flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                          isDefenseSection
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        )}
                        style={isDefenseSection ? { boxShadow: "inset 3px 0 0 #fb7185" } : undefined}
                      >
                        <ShieldAlert className="size-4 shrink-0 text-[#fb7185]" />
                        <span className="whitespace-nowrap font-medium">
                          {lang === "fa" ? "مرکز سد دفاعی" : "Defense Center"}
                        </span>
                        <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">WAF</span>
                      </button>}

                      {/* License Manager */}
                      <button
                        onClick={() => {
                          setActiveSection(LICENSEMGMT_SECTION_KEY);
                          setConfirmReset(false);
                          setShowRaw(false);
                          setConfirmDeleteKey(null);
                          setRenamingKey(null);
                          setIconPickerKey(null);
                        }}
                        className={cn(
                          "flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                          isLicenseSection
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        )}
                        style={isLicenseSection ? { boxShadow: "inset 3px 0 0 var(--ai-1)" } : undefined}
                      >
                        <KeyRound className="size-4 shrink-0 text-[var(--ai-1)]" />
                        <span className="whitespace-nowrap font-medium">
                          {lang === "fa" ? "مدیریت لایسنس" : "License"}
                        </span>
                        <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">LIC</span>
                      </button>

                      {/* Access Guard */}
                      {guardMatchesQuery && <button
                        onClick={() => {
                          setActiveSection(GUARD_SECTION_KEY);
                          setConfirmReset(false);
                          setShowRaw(false);
                          setConfirmDeleteKey(null);
                          setRenamingKey(null);
                          setIconPickerKey(null);
                        }}
                        className={cn(
                          "flex w-full shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                          isGuardSection
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        )}
                        style={isGuardSection ? { boxShadow: "inset 3px 0 0 var(--sec-1)" } : undefined}
                      >
                        <Lock className="size-4 shrink-0 text-[var(--sec-1)]" />
                        <span className="whitespace-nowrap font-medium">
                          {lang === "fa" ? "قفل رمز سایت و بخش‌ها" : "Access Guard"}
                        </span>
                        <span className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 lg:inline">GUARD</span>
                      </button>}
                    </div>
                  )}

                  {(filteredBuiltins.length === 0 && filteredCustoms.length === 0 && !developerMatchesQuery && !migrationMatchesQuery && !mediaMatchesQuery && !analyticsMatchesQuery && !defenseMatchesQuery && !guardMatchesQuery && !isLicenseSection && !isGuardSection) && (
                    <p className="px-3 py-4 text-xs italic text-muted-foreground">
                      {lang === "fa" ? "موردی یافت نشد" : "No matches"}
                    </p>
                  )}
                </div>
              </aside>

              {/* Main scrollable form area — only the active section renders */}
              <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto p-4 pb-16 sm:p-6 lg:p-8">
                {/* Action bar (above the form) */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-base font-bold text-foreground">
                      {activeTitle}
                    </h2>
                    {activeCustom && (
                      <span className="rounded-full border border-border bg-[var(--surface-1)] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {activeCustom.key}
                      </span>
                    )}
                  </div>
                  {!isToolSection && <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDuplicate(activeSection)}
                      disabled={busy}
                      title={lang === "fa" ? "کپی این بخش به یک بخش سفارشی" : "Duplicate this section as custom"}
                    >
                      <Copy className="size-4" />
                      <span className="hidden sm:inline">
                        {lang === "fa" ? "کپی" : "Duplicate"}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant={showRaw ? "default" : "outline"}
                      onClick={() => setShowRaw((v) => !v)}
                      title={lang === "fa" ? "ویرایش JSON خام" : "Edit raw JSON"}
                      aria-pressed={showRaw}
                    >
                      <Braces className="size-4" />
                      <span className="hidden sm:inline">
                        {showRaw
                          ? (lang === "fa" ? "بستن JSON" : "Close JSON")
                          : (lang === "fa" ? "JSON خام" : "Raw JSON")}
                      </span>
                    </Button>
                  </div>}
                </div>

                {responsiveBuilder.sections?.some((section) => section.id === activeSection) && (
                  <CmsSectionResponsiveControls
                    builder={responsiveBuilder}
                    sectionId={activeSection}
                    mode={viewportMode}
                    lang={lang}
                    onChange={handleResponsiveBuilderChange}
                  />
                )}

                {activeDevice && !isToolSection && activeSection !== DEVELOPER_SECTION_KEY && (
                  <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/[.06] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {lang === "fa"
                          ? `ویرایش کامل محتوای ${activeDevice}`
                          : `Editing complete ${activeDevice} content`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {hasDeviceContentOverride
                          ? (lang === "fa"
                            ? "تمام فیلدهای زیر نسخه اختصاصی این دستگاه هستند."
                            : "Every field below belongs to this device-specific version.")
                          : (lang === "fa"
                            ? "فعلاً از Automatic ارث می‌برد؛ اولین ذخیره، نسخه مستقل این دستگاه را می‌سازد."
                            : "Currently inherited from Automatic; the first save creates an independent device version.")}
                      </p>
                    </div>
                    {hasDeviceContentOverride && (
                      <Button type="button" size="sm" variant="outline" onClick={handleUseAutomaticContent} disabled={saving}>
                        <RotateCcw className="size-3.5" />
                        {lang === "fa" ? "بازگشت محتوای Automatic" : "Use Automatic content"}
                      </Button>
                    )}
                  </div>
                )}

                {isDeveloperSection ? (
                      <DeveloperOwnerEditor lang={lang} value={content.developer} onSaved={refreshContent} />
                ) : isMigrationSection ? (
                      <MigrationCenter lang={lang} />
                ) : isMediaSection ? (
                      <CmsMediaLibrary lang={lang} />
                ) : isAnalyticsSection ? (
                      <CmsAnalyticsCenter lang={lang} />
                ) : isDefenseSection ? (
                      <CmsDefenseCenter lang={lang} />
                ) : isLicenseSection ? (
                      <LicenseManager lang={lang} />
                ) : isGuardSection ? (
                      <CmsSiteGuard lang={lang} />
                ) : showRaw ? (
                  <RawJsonEditor value={draft} onApply={handleApplyRaw} />
                ) : activeIsBuiltin ? (
                  <SectionForm
                    section={activeSection as SectionKey}
                    draft={draft}
                    setDraft={setDraft}
                    sectionsManagerProps={{
                      customSections,
                      onDuplicate: handleDuplicate,
                      onDeleteCustom: handleDeleteCustom,
                      onCreateCustom: handleCreateCustom,
                      persistBuilderSections,
                      persistPlanets,
                    }}
                    viewportMode={viewportMode}
                  />
                ) : activeCustom ? (
                  <CustomSectionForm
                    section={activeCustom}
                    draft={(draft as Record<string, unknown>) ?? {}}
                    setDraft={(v) => setDraft(v)}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {lang === "fa"
                      ? "این بخش دیگر وجود ندارد — یک بخش دیگر را انتخاب کنید."
                      : "This section no longer exists — pick another from the sidebar."}
                  </div>
                )}

              </div>
            </div>

            <AnimatePresence>
              {showSecuritySettings && (
                <SecuritySettingsDialog
                  onClose={() => setShowSecuritySettings(false)}
                  onFactoryReset={handleFactoryReset}
                />
              )}
            </AnimatePresence>

            {/* Status footer */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-[var(--surface-1)] px-4 py-2 text-[11px] text-muted-foreground sm:px-6">
              <span className="font-mono">
                {t("section")}: <span className="text-foreground">{activeSection}</span>
              </span>
              <span className="font-mono">
                {t("language")}: <span className="text-foreground">{lang}</span>
              </span>
              <span className="font-mono">
                {lang === "fa" ? "نوع" : "type"}:{" "}
                <span className="text-foreground">
                  {isDeveloperSection
                    ? (lang === "fa" ? "اطلاعات برنامه" : "application info")
                    : isMigrationSection || isGuardSection
                    ? (lang === "fa" ? "ابزار سیستم" : "system tool")
                    : activeIsBuiltin
                    ? (lang === "fa" ? "ساخته‌شده" : "built-in")
                    : (lang === "fa" ? "سفارشی" : "custom")}
                </span>
              </span>
              <span className="font-mono">
                {lang === "fa" ? "آخرین ذخیره" : "Last saved"}:{" "}
                <span className="text-foreground">{lastSavedLabel}</span>
              </span>
              <span className="font-mono">
                auth: <span className={authed ? "text-emerald-500" : "text-foreground"}>{authed ? "✓" : "—"}</span>
              </span>
              <span className="font-mono">
                v: <span className="text-foreground">{APP_VERSION}</span>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
