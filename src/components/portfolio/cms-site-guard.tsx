"use client";

/* ============================================================
 * CmsSiteGuard — Access Guard management panel.
 *
 * Lets the owner password-protect the whole site, individual
 * sections AND each gallery: 4/6-digit PINs or text passwords,
 * permanent mode or a limited wrong-attempt budget (which disables
 * the target until reset), an optional TEMPORARY password with
 * expiry (share with a client for a limited time), configurable
 * unlock-cookie lifetime. Pure client — all rules are enforced
 * server-side by src/lib/site-protection.ts.
 *
 * Section and gallery rows are derived LIVE from the builder + the
 * guard API, so newly added/removed sections appear automatically.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock, EyeOff, Images, KeyRound, Lock, LockOpen, RefreshCw, RotateCcw,
  Save, ShieldAlert, Timer, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/persian-digits";
import { projectTarget, PROJECT_TARGET_PREFIX } from "@/lib/guard-targets";
import { useContent, type GuardLockInfo } from "@/lib/content-store";

const TARGET_SITE = "__site__";

type Kind = "pin4" | "pin6" | "text";
type Mode = "permanent" | "attempts";

type LockRow = GuardLockInfo;

interface AdminData {
  site: LockRow | null;
  sections: Record<string, LockRow>;
  targets: string[];
}

const SECTION_LABELS: Record<string, { fa: string; en: string }> = {
  hero: { fa: "صفحه اصلی (Hero)", en: "Hero" },
  graphics: { fa: "گرافیک", en: "Graphics" },
  security: { fa: "امنیت", en: "Security" },
  ai: { fa: "هوش مصنوعی", en: "AI" },
  timeline: { fa: "خط زمانی", en: "Timeline" },
  synthesis: { fa: "ترکیب", en: "Synthesis" },
  footer: { fa: "پاورقی / تماس", en: "Footer / Contact" },
};

function targetLabel(target: string, lang: "fa" | "en"): string {
  const fa = lang === "fa";
  if (target === TARGET_SITE) return fa ? "کل سایت" : "Whole site";
  if (target.startsWith("gallery:")) {
    const owner = target.slice("gallery:".length);
    const known = SECTION_LABELS[owner];
    const ownerLabel = known ? (fa ? known.fa : known.en) : owner;
    return fa ? `گالری — ${ownerLabel}` : `Gallery — ${ownerLabel}`;
  }
  const known = SECTION_LABELS[target];
  if (known) return fa ? known.fa : known.en;
  if (target.startsWith("custom-")) {
    return fa ? `بخش سفارشی (${target})` : `Custom section (${target})`;
  }
  return target;
}

/* ---------------- one lock editor ---------------- */

function LockEditor({
  target,
  lock,
  lang,
  onChanged,
  labelOverride,
}: {
  target: string;
  lock: LockRow | null;
  lang: "fa" | "en";
  onChanged: () => void;
  labelOverride?: string;
}) {
  const fa = lang === "fa";
  const isSite = target === TARGET_SITE;
  const isProject = target.startsWith(PROJECT_TARGET_PREFIX);

  const [kind, setKind] = useState<Kind>(lock?.kind ?? "pin4");
  const [mode, setMode] = useState<Mode>(lock?.mode ?? "permanent");
  const [maxAttempts, setMaxAttempts] = useState(lock?.maxAttempts ?? 5);
  const [unlockDays, setUnlockDays] = useState(lock?.unlockDays ?? 7);
  const [enabled, setEnabled] = useState(lock?.enabled ?? false);
  const [idleMinutes, setIdleMinutes] = useState(lock?.idleMinutes ?? 0);
  const [relockOnExit, setRelockOnExit] = useState(lock?.relockOnExit ?? false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Temporary password state
  const [tempPassword, setTempPassword] = useState("");
  const [tempHours, setTempHours] = useState<number>(24);
  const [tempCustomMs, setTempCustomMs] = useState<number>(0);

  useEffect(() => {
    setKind(lock?.kind ?? "pin4");
    setMode(lock?.mode ?? "permanent");
    setMaxAttempts(lock?.maxAttempts ?? 5);
    setUnlockDays(lock?.unlockDays ?? 7);
    setEnabled(lock?.enabled ?? false);
    setIdleMinutes(lock?.idleMinutes ?? 0);
    setRelockOnExit(lock?.relockOnExit ?? false);
    setPassword("");
    setConfirm("");
    setConfirmRemove(false);
    setTempPassword("");
    setTempHours(24);
    setTempCustomMs(0);
  }, [lock]);

  const hasPassword = Boolean(lock?.hasPassword);
  const hasTemp = Boolean(lock?.hasTempPassword);
  const disabled = Boolean(lock?.disabled);

  const api = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/protection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        toast.success(okMsg);
        onChanged();
        return true;
      }
      toast.error(json?.error || "Request failed");
      return false;
    } catch {
      toast.error(fa ? "خطای شبکه" : "Network error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const validateCandidate = (value: string): string | null => {
    const norm = kind === "text" ? value : normalizeDigits(value);
    if (kind === "pin4" && !/^\d{4}$/.test(norm)) return fa ? "رمز باید دقیقاً ۴ رقم باشد" : "PIN must be exactly 4 digits";
    if (kind === "pin6" && !/^\d{6}$/.test(norm)) return fa ? "رمز باید دقیقاً ۶ رقم باشد" : "PIN must be exactly 6 digits";
    if (kind === "text" && norm.length < 6) return fa ? "رمز متنی حداقل ۶ کاراکتر باشد" : "Text password needs ≥ 6 characters";
    return null;
  };

  const tempExpiresAtMs = (): number | null => {
    if (!tempPassword) return null;
    return tempCustomMs > Date.now() ? tempCustomMs : Date.now() + tempHours * 3_600_000;
  };

  const save = async () => {
    if (password) {
      if (password !== confirm) {
        toast.error(fa ? "رمز و تکرار آن یکسان نیستند" : "Passwords do not match");
        return;
      }
      const formatError = validateCandidate(password);
      if (formatError) {
        toast.error(formatError);
        return;
      }
    }
    if (tempPassword) {
      const tempError = validateCandidate(tempPassword);
      if (tempError) {
        toast.error(tempError);
        return;
      }
      if ((tempExpiresAtMs() ?? 0) <= Date.now()) {
        toast.error(fa ? "زمان انقضای رمز موقت باید در آینده باشد" : "Temporary password expiry must be in the future");
        return;
      }
    }
    if (!hasPassword && !password && enabled) {
      toast.error(fa ? "برای فعال‌سازی، ابتدا رمز را وارد کنید" : "Set a password before enabling");
      return;
    }
    const ok = await api(
      {
        action: "set",
        target,
        enabled,
        kind,
        mode,
        maxAttempts,
        unlockDays,
        idleMinutes,
        relockOnExit,
        ...(password ? { password } : {}),
        ...(tempPassword ? { tempPassword, tempExpiresAt: tempExpiresAtMs() } : {}),
      },
      fa ? "تنظیمات قفل ذخیره شد" : "Lock settings saved"
    );
    if (ok) {
      setPassword("");
      setConfirm("");
      setTempPassword("");
    }
  };

  const inputClass =
    "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-[var(--sec-1)]";

  const tempLeft = hasTemp && lock?.tempExpiresAt ? Math.max(0, lock.tempExpiresAt - Date.now()) : 0;
  const fmtDuration = (ms: number) => {
    const h = Math.floor(ms / 3_600_000);
    if (h < 48) return fa ? `${h} ساعت` : `${h}h`;
    return fa ? `${Math.round(h / 24)} روز` : `${Math.round(h / 24)}d`;
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        enabled ? "border-[var(--sec-1)]/40 bg-[var(--sec-1)]/[.05]" : "border-border bg-background/40"
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg border",
          enabled ? "border-[var(--sec-1)]/40 bg-[var(--sec-1)]/15" : "border-border bg-background"
        )}>
          {disabled ? <ShieldAlert className="size-4 text-amber-400" />
            : enabled ? <Lock className="size-4 text-[var(--sec-1)]" />
            : <LockOpen className="size-4 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{labelOverride ?? targetLabel(target, lang)}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {isSite ? "gate: /gate" : `target: ${target}`}
            {hasPassword ? ` · ${fa ? "رمز ثبت‌شده" : "password set"}` : ""}
            {hasTemp ? ` · ${fa ? `رمز موقت (${fmtDuration(tempLeft)} مانده)` : `temp pw (${fmtDuration(tempLeft)} left)`}` : ""}
            {enabled ? ` · ${fa ? "فعال" : "active"}` : ""}
            {disabled ? ` · ${fa ? "غیرفعال‌شده (تلاش ناموفق)" : "disabled (attempts)"}` : ""}
          </p>
        </div>
        {disabled && (
          <Button
            type="button" size="sm" variant="outline" disabled={busy}
            onClick={() => api({ action: "reset", target }, fa ? "شمارنده تلاش‌ها صفر شد" : "Attempt counter reset")}
          >
            <RotateCcw className="size-3.5" />
            {fa ? "فعال‌سازی مجدد" : "Re-enable"}
          </Button>
        )}
        {hasTemp && !tempPassword && (
          <Button
            type="button" size="sm" variant="outline" disabled={busy}
            onClick={() => api({ action: "cleartemp", target }, fa ? "رمز موقت حذف شد" : "Temporary password removed")}
          >
            <Timer className="size-3.5" />
            {fa ? "حذف رمز موقت" : "Clear temp"}
          </Button>
        )}
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={busy || (!hasPassword && !enabled && !password)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span>{fa ? "نوع رمز" : "Password type"}</span>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
            {(["pin4", "pin6", "text"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                disabled={busy}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors",
                  kind === k ? "bg-[var(--sec-1)]/20 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "pin4" ? (fa ? "PIN ۴ رقمی" : "PIN 4")
                  : k === "pin6" ? (fa ? "PIN ۶ رقمی" : "PIN 6")
                  : fa ? "متنی" : "Text"}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span>{fa ? "سیاست تلاش" : "Attempt policy"}</span>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
            {(["permanent", "attempts"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={busy}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors",
                  mode === m ? "bg-[var(--sec-1)]/20 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "permanent"
                  ? fa ? "همیشه باز (بدون سقف)" : "Unlimited tries"
                  : fa ? `سقف ${maxAttempts} تلاش` : `Limit to ${maxAttempts}`}
              </button>
            ))}
          </div>
        </label>

        {mode === "attempts" && (
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span>{fa ? "حداکثر تلاش ناموفق (۱ تا ۱۰)" : "Max wrong attempts (1-10)"}</span>
            <Input
              type="number" min={1} max={10} value={maxAttempts}
              onChange={(e) => setMaxAttempts(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              disabled={busy} className={inputClass}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span>{fa ? "مدت اعتبار باز کردن (روز، ۰ = تا بستن مرورگر)" : "Unlock validity (days, 0 = browser session)"}</span>
          <Input
            type="number" min={0} max={90} value={unlockDays}
            onChange={(e) => setUnlockDays(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
            disabled={busy} className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span>{fa ? "قفل مجدد بعد از بیکاری (دقیقه، ۰ = خاموش)" : "Re-lock after idle (minutes, 0 = off)"}</span>
          <Input
            type="number" min={0} max={240} value={idleMinutes}
            onChange={(e) => setIdleMinutes(Math.max(0, Math.min(240, Number(e.target.value) || 0)))}
            disabled={busy} className={inputClass}
          />
          <span className="text-[10px] text-muted-foreground/70">
            {fa ? "اگر بازدیدکننده پس از وارد کردن رمز به همین اندازه بیکار بماند، بخش دوباره قفل می‌شود." : "If the visitor stays idle this long after unlocking, the section locks again."}
          </span>
        </label>

        {!isSite && !isProject && (
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <span>{fa ? "قفل مجدد هنگام خروج از بخش (یا بستن گالری)" : "Re-lock when the visitor leaves the section (or closes the gallery)"}</span>
            <Switch checked={relockOnExit} onCheckedChange={setRelockOnExit} disabled={busy} />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span>
            {hasPassword ? (fa ? "رمز جدید (خالی = بدون تغییر)" : "New password (blank = keep)")
              : fa ? "رمز" : "Password"}
          </span>
          <Input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={kind === "pin4" ? "••••" : kind === "pin6" ? "••••••" : fa ? "حداقل ۶ کاراکتر" : "min 6 characters"}
            disabled={busy || disabled} className={inputClass} dir="ltr"
            inputMode={kind === "text" ? undefined : "numeric"}
          />
          <span className="text-[10px] text-muted-foreground/70">
            {fa ? "ارقام فارسی/عربی خودکار به لاتین تبدیل می‌شوند (۷۳۰۴ = 7304)" : "Persian/Arabic digits are auto-converted (۷۳۰۴ = 7304)"}
          </span>
        </label>

        {password && (
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span>{fa ? "تکرار رمز" : "Confirm password"}</span>
            <Input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              disabled={busy || disabled} className={inputClass} dir="ltr"
            />
          </label>
        )}
      </div>

      {/* Temporary password */}
      <div className="mt-3 rounded-xl border border-[var(--ai-1)]/25 bg-[var(--ai-1)]/[.05] p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Timer className="size-3.5 text-[var(--ai-1)]" />
          {fa ? "رمز موقت (اختیاری)" : "Temporary password (optional)"}
          {hasTemp && <span className="rounded-full bg-[var(--ai-1)]/20 px-2 py-0.5 text-[10px] text-foreground">{fa ? `${fmtDuration(tempLeft)} مانده` : `${fmtDuration(tempLeft)} left`}</span>}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Input
            type="password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)}
            placeholder={fa ? "رمز موقت — هم‌نوع با رمز اصلی" : "temp password (same type)"}
            disabled={busy || disabled} className={inputClass} dir="ltr"
          />
          <div className="flex gap-1">
            {[1, 24, 168].map((h) => (
              <button
                key={h} type="button" disabled={busy || disabled}
                onClick={() => { setTempHours(h); setTempCustomMs(0); }}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors",
                  tempCustomMs === 0 && tempHours === h
                    ? "border-[var(--ai-1)]/50 bg-[var(--ai-1)]/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {h === 1 ? (fa ? "۱ ساعت" : "1h") : h === 24 ? (fa ? "۲۴ ساعت" : "24h") : (fa ? "۷ روز" : "7d")}
              </button>
            ))}
            <input
              type="datetime-local"
              disabled={busy || disabled || !tempPassword}
              onChange={(e) => {
                const t = new Date(e.target.value).getTime();
                if (Number.isFinite(t)) setTempCustomMs(t);
              }}
              className="h-9 w-36 rounded-lg border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:border-[var(--ai-1)]"
              aria-label={fa ? "زمان انقضای دلخواه" : "custom expiry"}
            />
          </div>
        </div>
        <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">
          {fa
            ? "بازدیدکننده با رمز اصلی یا رمز موقت می‌تواند باز کند؛ رمز موقت بعد از زمان مشخص به‌صورت خودکار بی‌اثر می‌شود و تلاش‌های ناموفق روی هر دو یک شمارنده دارند."
            : "Visitors may unlock with the main OR the temporary password; the temporary one stops working automatically at its expiry, and wrong tries count against the same budget."}
        </p>
      </div>

      {lock && lock.failedAttempts > 0 && (
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">
          {fa ? `تلاش‌های ناموفق ثبت‌شده: ${lock.failedAttempts}` : `recorded wrong attempts: ${lock.failedAttempts}`}
          {lock.updatedAt > 0 ? ` · ${new Date(lock.updatedAt).toLocaleString(fa ? "fa-IR" : "en-GB")}` : ""}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={save}>
          <Save className="size-3.5" />
          {fa ? "ذخیره قفل" : "Save lock"}
        </Button>
        {!confirmRemove ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy || !lock} onClick={() => setConfirmRemove(true)}>
            <Trash2 className="size-3.5" />
            {fa ? "حذف کامل قفل" : "Remove lock"}
          </Button>
        ) : (
          <>
            <Button
              type="button" size="sm" variant="destructive" disabled={busy}
              onClick={() => api({ action: "clear", target }, fa ? "قفل حذف شد" : "Lock removed")}
            >
              {fa ? "تأیید حذف" : "Confirm remove"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(false)}>
              {fa ? "انصراف" : "Cancel"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- panel ---------------- */

export function CmsSiteGuard({ lang }: { lang: "fa" | "en" }) {
  const fa = lang === "fa";
  const [data, setData] = useState<AdminData | null>(null);
  const builderSections = useContent((s) => s.content.builder.sections);
  const customs = useContent((s) => s.customs);
  const contentEn = useContent((s) => s.contentEn);
  const contentFaSel = useContent((s) => s.contentFa);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/protection?admin=1", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        setData({ site: json.site, sections: json.sections ?? {}, targets: json.targets ?? [] });
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Sections + galleries derived LIVE from the store (auto add/remove). */
  const { sectionTargets, galleryTargets, projectTargets } = useMemo(() => {
    const sections = new Set<string>([
      "hero", "graphics", "security", "ai", "timeline", "synthesis", "footer",
    ]);
    const galleries = new Set<string>();
    const addGalleryIfAny = (id: string, gallery: unknown) => {
      if (gallery && typeof gallery === "object") galleries.add(`gallery:${id}`);
    };
    // builtin galleries
    for (const id of ["graphics", "security", "ai"] as const) {
      addGalleryIfAny(id, (contentEn as unknown as Record<string, { gallery?: unknown }>)?.[id]?.gallery);
    }
    for (const s of builderSections ?? []) {
      if (s?.id && s.id !== "developer") sections.add(s.id);
    }
    for (const [key, value] of Object.entries(customs ?? {})) {
      sections.add(key);
      addGalleryIfAny(key, (value as { en?: { gallery?: unknown } })?.en?.gallery);
    }
    for (const key of Object.keys(data?.sections ?? {})) {
      if (key.startsWith("gallery:")) galleries.add(key);
      else if (key !== TARGET_SITE) sections.add(key);
    }
    for (const t of data?.targets ?? []) {
      if (t.startsWith("gallery:")) galleries.add(t);
      else sections.add(t);
    }
    sections.delete(TARGET_SITE);
    sections.delete("developer");

    /* Per-PROJECT lock rows: every project of every gallery (live — new/
       removed projects appear automatically), deduped by target. */
    const projects: { target: string; label: string }[] = [];
    const seenProj = new Set<string>();
    const addProjects = (ownerId: string, gallery: unknown) => {
      const list = (gallery as { projects?: { title?: string }[] } | null)?.projects;
      if (!Array.isArray(list)) return;
      for (const proj of list) {
        const title = typeof proj?.title === "string" && proj.title.trim() ? proj.title.trim() : null;
        if (!title) continue;
        const t = projectTarget(ownerId, title);
        if (seenProj.has(t)) continue;
        seenProj.add(t);
        projects.push({ target: t, label: `${title} · ${targetLabel(ownerId, lang)}` });
      }
    };
    for (const id of ["graphics", "security", "ai"] as const) {
      addProjects(id, (contentEn as unknown as Record<string, { gallery?: unknown }>)?.[id]?.gallery);
      addProjects(id, (contentFaSel as unknown as Record<string, { gallery?: unknown }>)?.[id]?.gallery);
    }
    for (const [cid, value] of Object.entries(customs ?? {})) {
      addProjects(cid, (value as { en?: { gallery?: unknown } })?.en?.gallery);
      addProjects(cid, (value as { fa?: { gallery?: unknown } })?.fa?.gallery);
    }
    // already-configured proj locks whose project is temporarily absent
    for (const t of Object.keys(data?.sections ?? {})) {
      if (t.startsWith(PROJECT_TARGET_PREFIX) && !seenProj.has(t)) {
        seenProj.add(t);
        projects.push({ target: t, label: t });
      }
    }
    projects.sort((a, b) => a.label.localeCompare(b.label));

    return {
      sectionTargets: [...sections].sort(),
      galleryTargets: [...galleries].sort(),
      projectTargets: projects,
    };
  }, [data, builderSections, customs, contentEn, contentFaSel, lang]);

  const activeCount = useMemo(() => {
    const entries = Object.values(data?.sections ?? {}).filter((l) => l.enabled && l.hasPassword).length;
    const site = data?.site?.enabled && data?.site?.hasPassword ? 1 : 0;
    return entries + site;
  }, [data]);

  return (
    <div className="space-y-5">
      {/* intro */}
      <div className="rounded-xl border border-border bg-background/40 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg border border-[var(--sec-1)]/40 bg-[var(--sec-1)]/15">
            <KeyRound className="size-5 text-[var(--sec-1)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-foreground">
              {fa ? "قفل رمز سایت، بخش‌ها و گالری‌ها (Access Guard)" : "Site, Section & Gallery Password Guard"}
            </h3>
            <p className="mt-0.5 text-xs leading-6 text-muted-foreground">
              {fa
                ? "کل سایت، هر بخش از صفحه اصلی یا هر گالری را با رمز محافظت کنید. بخش قفل‌شده بلور می‌شود و محتوای واقعی آن تا وارد کردن رمز از سرور ارسال نمی‌شود."
                : "Password-protect the whole site, any section, or each gallery. Locked sections render blurred and their real content is withheld server-side until unlocked."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] text-muted-foreground">
              {fa ? `${activeCount} قفل فعال` : `${activeCount} active`}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => void load()} aria-label={fa ? "بازخوانی" : "Refresh"}>
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-[11px] leading-6 text-muted-foreground sm:grid-cols-2">
          <p className="flex items-start gap-1.5">
            <Lock className="mt-1 size-3 shrink-0 text-[var(--sec-1)]" />
            {fa
              ? "رمز ۴/۶ رقمی یا متنی + رمز موقت با انقضای خودکار؛ حالت «سقف تلاش» بعد از چند رمز اشتباه، قفل را کامل غیرفعال می‌کند."
              : "4/6-digit PIN or text password + temporary password with auto-expiry; the attempt limit fully disables a lock after N wrong tries."}
          </p>
          <p className="flex items-start gap-1.5">
            <Clock className="mt-1 size-3 shrink-0 text-[var(--ai-1)]" />
            {fa
              ? "مدت باز ماندن (کوکی امضاشده httpOnly) قابل تنظیم است — از «تا بستن مرورگر» تا ۹۰ روز."
              : "Unlock validity (signed httpOnly cookie) is configurable — browser-session up to 90 days."}
          </p>
          <p className="flex items-start gap-1.5">
            <EyeOff className="mt-1 size-3 shrink-0 text-[var(--gfx-1)]" />
            {fa
              ? "محتوای قفل‌شده در پاسخ /api/content حذف می‌شود — دور زدن بلر از سمت مرورگر بی‌فایده است."
              : "Locked payloads are stripped from /api/content responses — the blur cannot be bypassed from the browser."}
          </p>
          <p className="flex items-start gap-1.5">
            <ShieldAlert className="mt-1 size-3 shrink-0 text-amber-400" />
            {fa
              ? "اگر رمز سایت را فراموش کردید: با حساب CMS (لینک «ورود مدیر» در /gate) وارد شوید یا فایل db/site-protection.json را روی سرور ویرایش کنید."
              : "Site password lost? Sign in with the CMS account (owner link on /gate) or edit db/site-protection.json on the server."}
          </p>
        </div>
      </div>

      {/* whole site */}
      <section className="space-y-3">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--sec-1)]" />
          {fa ? "قفل کل سایت" : "Whole-site lock"}
        </h4>
        <LockEditor target={TARGET_SITE} lock={data?.site ?? null} lang={lang} onChanged={load} />
      </section>

      {/* sections */}
      <section className="space-y-3">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--ai-1)]" />
          {fa ? "قفل تک‌تک بخش‌ها (افزودن/حذف بخش خودکار منعکس می‌شود)" : "Per-section locks (sections auto-appear)"}
        </h4>
        {sectionTargets.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {fa ? "بخشی یافت نشد." : "No sections found."}
          </p>
        )}
        <div className="grid gap-3 xl:grid-cols-2">
          {sectionTargets.map((target) => (
            <LockEditor
              key={target}
              target={target}
              lock={data?.sections[target] ?? null}
              lang={lang}
              onChanged={load}
            />
          ))}
        </div>
      </section>

      {/* galleries */}
      <section className="space-y-3">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Images className="size-3.5 text-[var(--gfx-1)]" />
          {fa ? "قفل گالری‌ها (هر گالری، رمز مستقل)" : "Gallery locks (one per gallery)"}
        </h4>
        <p className="text-[11px] leading-6 text-muted-foreground">
          {fa
            ? "هر بخشی که گالری دارد (گرافیک، امنیت، هوش مصنوعی، یا هر بخش سفارشی با دکمه «افزودن گالری») اینجا فهرست می‌شود — باز کردن گالری نیازمند رمز خودش است و محتوای گالری تا آنلاک از سرور ارسال نمی‌شود."
            : "Every section with a gallery (graphics, security, AI, or any custom section using “Add a gallery”) is listed here — opening that gallery requires its own password, and its data is withheld until unlocked."}
        </p>
        {galleryTargets.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {fa ? "گالری‌ای یافت نشد — از فرم ویرایش هر بخش، گالری اضافه کنید." : "No galleries yet — add one from any section's editor."}
          </p>
        )}
        <div className="grid gap-3 xl:grid-cols-2">
          {galleryTargets.map((target) => (
            <LockEditor
              key={target}
              target={target}
              lock={data?.sections[target] ?? null}
              lang={lang}
              onChanged={load}
            />
          ))}
        </div>
      </section>

      {/* individual gallery projects */}
      <section className="space-y-3">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gfx-3, var(--gfx-1))]" />
          {fa ? "قفل پروژه‌های تکی گالری (هر پروژه، رمز مستقل)" : "Per-project locks (one per gallery project)"}
        </h4>
        <p className="text-[11px] leading-6 text-muted-foreground">
          {fa
            ? "هر پروژه داخل هر گالری (گرافیک، امنیت، هوش مصنوعی یا بخش‌های سفارشی) را جداگانه قفل کنید — بقیه پروژه‌ها آزاد می‌مانند. پروژه قفل‌شده فقط عنوانش را نشان می‌دهد و محتوایش تا وارد کردن رمز از سرور ارسال نمی‌شود. فهرست به‌صورت زنده به‌روز می‌شود."
            : "Lock any single project inside any gallery (graphics, security, AI, or custom sections) — the rest stay open. A locked project shows only its title; its payload is withheld server-side until unlocked. The list updates live."}
        </p>
        {projectTargets.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {fa ? "پروژه‌ای در گالری‌ها یافت نشد." : "No gallery projects found."}
          </p>
        )}
        <div className="grid gap-3 xl:grid-cols-2">
          {projectTargets.map((row) => (
            <LockEditor
              key={row.target}
              target={row.target}
              lock={data?.sections[row.target] ?? null}
              lang={lang}
              onChanged={load}
              labelOverride={row.label}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
