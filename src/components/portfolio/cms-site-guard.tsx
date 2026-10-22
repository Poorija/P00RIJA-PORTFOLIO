"use client";

/* ============================================================
 * CmsSiteGuard — Access Guard management panel.
 *
 * Lets the owner password-protect the whole site or individual
 * sections: 4/6-digit PINs or text passwords, permanent mode or a
 * limited wrong-attempt budget (which disables the target until
 * reset), configurable unlock-cookie lifetime. Pure client — all
 * rules are enforced server-side by src/lib/site-protection.ts.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock, EyeOff, KeyRound, Lock, LockOpen, RotateCcw, Save, ShieldAlert, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  if (target === TARGET_SITE) return lang === "fa" ? "کل سایت" : "Whole site";
  const known = SECTION_LABELS[target];
  if (known) return lang === "fa" ? known.fa : known.en;
  if (target.startsWith("custom-")) {
    return lang === "fa" ? `بخش سفارشی (${target})` : `Custom section (${target})`;
  }
  return target;
}

/* ---------------- one lock editor ---------------- */

function LockEditor({
  target,
  lock,
  lang,
  onChanged,
}: {
  target: string;
  lock: LockRow | null;
  lang: "fa" | "en";
  onChanged: () => void;
}) {
  const fa = lang === "fa";
  const isSite = target === TARGET_SITE;

  const [kind, setKind] = useState<Kind>(lock?.kind ?? "pin4");
  const [mode, setMode] = useState<Mode>(lock?.mode ?? "permanent");
  const [maxAttempts, setMaxAttempts] = useState(lock?.maxAttempts ?? 5);
  const [unlockDays, setUnlockDays] = useState(lock?.unlockDays ?? 7);
  const [enabled, setEnabled] = useState(lock?.enabled ?? false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setKind(lock?.kind ?? "pin4");
    setMode(lock?.mode ?? "permanent");
    setMaxAttempts(lock?.maxAttempts ?? 5);
    setUnlockDays(lock?.unlockDays ?? 7);
    setEnabled(lock?.enabled ?? false);
    setPassword("");
    setConfirm("");
    setConfirmRemove(false);
  }, [lock]);

  const hasPassword = Boolean(lock?.hasPassword);
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

  const save = async () => {
    if (password) {
      if (password !== confirm) {
        toast.error(fa ? "رمز و تکرار آن یکسان نیستند" : "Passwords do not match");
        return;
      }
      const formatError =
        kind === "pin4" ? (fa ? "رمز باید دقیقاً ۴ رقم باشد" : "PIN must be exactly 4 digits")
        : kind === "pin6" ? (fa ? "رمز باید دقیقاً ۶ رقم باشد" : "PIN must be exactly 6 digits")
        : password.length < 6 ? (fa ? "رمز متنی حداقل ۶ کاراکتر باشد" : "Text password needs ≥ 6 characters")
        : null;
      if (formatError) {
        toast.error(formatError);
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
        ...(password ? { password } : {}),
      },
      fa ? "تنظیمات قفل ذخیره شد" : "Lock settings saved"
    );
    if (ok) {
      setPassword("");
      setConfirm("");
    }
  };

  const inputClass =
    "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-[var(--sec-1)]";

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
          <p className="truncate text-sm font-bold text-foreground">{targetLabel(target, lang)}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {target === TARGET_SITE ? "gate: /gate" : `target: ${target}`}
            {hasPassword ? ` · ${fa ? "رمز ثبت‌شده" : "password set"}` : ""}
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

  /* Targets: API-known list ∪ builder/custom section ids ∪ already-configured locks. */
  const targets = useMemo(() => {
    const set = new Set<string>(data?.targets ?? []);
    for (const s of builderSections ?? []) {
      if (s?.id && s.id !== "developer") set.add(s.id);
    }
    for (const key of Object.keys(customs ?? {})) set.add(key);
    for (const key of Object.keys(data?.sections ?? {})) set.add(key);
    set.delete(TARGET_SITE);
    return [...set].sort();
  }, [data, builderSections, customs]);

  const activeCount = useMemo(() => {
    const sections = Object.values(data?.sections ?? {}).filter((l) => l.enabled && l.hasPassword).length;
    const site = data?.site?.enabled && data?.site?.hasPassword ? 1 : 0;
    return sections + site;
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
              {fa ? "قفل رمز سایت و بخش‌ها (Access Guard)" : "Site & Section Password Guard"}
            </h3>
            <p className="mt-0.5 text-xs leading-6 text-muted-foreground">
              {fa
                ? "کل سایت یا هر بخش از صفحه اصلی را با رمز محافظت کنید. بخش قفل‌شده برای بازدیدکننده بلور می‌شود و محتوای واقعی آن تا وارد کردن رمز، از سرور ارسال نمی‌شود."
                : "Password-protect the whole site or individual sections. Locked sections render blurred for visitors and their real content is withheld server-side until unlocked."}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border px-3 py-1 font-mono text-[10px] text-muted-foreground">
            {fa ? `${activeCount} قفل فعال` : `${activeCount} active`}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-[11px] leading-6 text-muted-foreground sm:grid-cols-2">
          <p className="flex items-start gap-1.5">
            <Lock className="mt-1 size-3 shrink-0 text-[var(--sec-1)]" />
            {fa
              ? "رمز ۴/۶ رقمی یا متنی؛ حالت «سقف تلاش» بعد از چند رمز اشتباه، قفل را کاملاً غیرفعال می‌کند (مثل کارت بانکی)."
              : "4/6-digit PIN or text password; the attempt limit fully disables a lock after N wrong tries (bank-card style)."}
          </p>
          <p className="flex items-start gap-1.5">
            <Clock className="mt-1 size-3 shrink-0 text-[var(--ai-1)]" />
            {fa
              ? "مدت باز ماندن (کوکی امضاشده httpOnly) قابل تنظیم است — از «تا بستن مرورگر» تا ۹۰ روز."
              : "Unlock validity (signed httpOnly cookie) is configurable — from browser-session up to 90 days."}
          </p>
          <p className="flex items-start gap-1.5">
            <EyeOff className="mt-1 size-3 shrink-0 text-[var(--gfx-1)]" />
            {fa
              ? "محتوای سکشن قفل‌شده در پاسخ /api/content حذف می‌شود — دور زدن بلر از سمت مرورگر بی‌فایده است."
              : "Locked sections are stripped from /api/content responses — the blur cannot be bypassed from the browser."}
          </p>
          <p className="flex items-start gap-1.5">
            <ShieldAlert className="mt-1 size-3 shrink-0 text-amber-400" />
            {fa
              ? "اگر رمز سایت را فراموش کردید: با حساب CMS (لینک «ورود مدیر» در صفحه /gate) وارد شوید یا فایل db/site-protection.json را روی سرور ویرایش کنید."
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
          {fa ? "قفل تک‌تک بخش‌ها" : "Per-section locks"}
        </h4>
        {targets.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {fa ? "بخشی یافت نشد." : "No sections found."}
          </p>
        )}
        <div className="grid gap-3 xl:grid-cols-2">
          {targets.map((target) => (
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
    </div>
  );
}
