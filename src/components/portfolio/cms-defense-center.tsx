"use client";

/* ============================================================
 * CmsDefenseCenter — the site's security operations room.
 *
 * Live threat feed, ban management, bot/scanner policy, rate
 * limit tuning and a dry-run tester — all backed by the
 * file-backed defense store that src/proxy.ts enforces on
 * every request.
 * ============================================================ */

import { useCallback, useEffect, useState } from "react";
import {
  Ban, FlaskConical, ListX, RefreshCw, Shield, ShieldAlert, ShieldCheck, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DefenseSettings {
  mode: "off" | "log" | "balanced" | "strict";
  rateLimitPerMin: number;
  rateBanMinutes: number;
  blockBadBots: boolean;
  blockSensitivePaths: boolean;
  blocklist: string[];
  allowlist: string[];
}

interface ThreatEvent {
  id: number; at: number; ip: string; ua: string; method: string;
  path: string; rule: string; action: string; country: string;
}

interface DefenseData {
  settings: DefenseSettings;
  stats: {
    blockedToday: number; loggedToday: number; activeBans: number;
    totalEvents: number;
    byRule: { name: string; value: number }[];
    topAttackers: { ip: number; value: number }[] & unknown; // [{ip,value}]
  };
  bans: { ip: string; until: number }[];
  threats: ThreatEvent[];
}

const MODE_INFO: Record<DefenseSettings["mode"], { fa: string; en: string; faDesc: string; enDesc: string; color: string }> = {
  off:      { fa: "خاموش",     en: "Off",      faDesc: "هیچ بررسی انجام نمی‌شود",                 enDesc: "No checks at all",                    color: "#94a3b8" },
  log:      { fa: "فقط ثبت",   en: "Log only", faDesc: "تهدیدها فقط ثبت می‌شوند، هیچ‌کس بلاک نمی‌شود", enDesc: "Record threats, block nobody",        color: "#38bdf8" },
  balanced: { fa: "متعادل",    en: "Balanced", faDesc: "اسکنرها ثبت می‌شوند؛ مسیرهای حساس و ریت-لیمیت بلاک", enDesc: "Log scanners; block sensitive paths + rate abusers", color: "#34d399" },
  strict:   { fa: "سخت‌گیر",   en: "Strict",   faDesc: "همه‌ی تهدیدها بلاک مستقیم می‌شوند",        enDesc: "Hard-block every detected threat",    color: "#f472b6" },
};

function fmtTime(ms: number, fa: boolean): string {
  return new Date(ms).toLocaleTimeString(fa ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function CmsDefenseCenter({ lang }: { lang: "fa" | "en" }) {
  const fa = lang === "fa";
  const [data, setData] = useState<DefenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newBlockIp, setNewBlockIp] = useState("");
  const [newAllowIp, setNewAllowIp] = useState("");
  const [testUa, setTestUa] = useState("sqlmap/1.8.2#stable");
  const [testPath, setTestPath] = useState("/.env");
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/defense", { cache: "no-store" });
      if (res.status === 401) return;
      const json = await res.json();
      if (json.ok) setData(json as DefenseData);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
  }, [load]);

  const patchSettings = async (patch: Partial<DefenseSettings>) => {
    const res = await fetch("/api/defense", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (json.ok) {
      toast.success(fa ? "تنظیمات ذخیره شد" : "Settings saved");
      void load();
    } else {
      toast.error(fa ? "خطا در ذخیره" : "Save failed");
    }
  };

  const op = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/defense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const runTest = async () => {
    const json = await op({ op: "test", ua: testUa, path: testPath });
    if (json.ok) {
      const v = json.verdict as { allow: boolean; action: string; rule: string; goodBot: boolean };
      setTestResult(
        `${v.action.toUpperCase()}${v.rule ? ` · rule: ${v.rule}` : ""}${v.goodBot ? " · search-engine bot (allowed by design)" : ""}`
      );
    }
  };

  const s = data?.settings;
  const stats = data?.stats;

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-foreground sm:text-base">
            {fa ? "🛡 مرکز سد دفاعی" : "🛡 Defense Center"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {fa
              ? "دیوار ضد ربات و اسکنر — روی هر درخواست اعمال می‌شود (proxy)، بدون وابستگی به هیچ سرویس بیرونی"
              : "Anti-bot & anti-scanner wall — enforced on every request by the built-in proxy"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {fa ? "به‌روزرسانی" : "Refresh"}
        </Button>
      </div>

      {/* mode selector */}
      <div className="rounded-2xl border border-border bg-surface-1 p-4">
        <p className="mb-3 text-xs font-bold text-foreground">{fa ? "حالت دفاعی" : "Defense mode"}</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {(Object.keys(MODE_INFO) as DefenseSettings["mode"][]).map((mode) => {
            const info = MODE_INFO[mode];
            const selected = s?.mode === mode;
            return (
              <button
                key={mode}
                onClick={() => void patchSettings({ mode })}
                data-cursor-hover
                className={cn(
                  "rounded-xl border p-3 text-start transition-all",
                  selected ? "border-transparent" : "border-border hover:border-foreground/20"
                )}
                style={{
                  background: selected ? `color-mix(in oklch, ${info.color} 12%, transparent)` : "transparent",
                  boxShadow: selected ? `inset 0 0 0 1.5px ${info.color}` : undefined,
                }}
              >
                <p className="text-xs font-black" style={{ color: selected ? info.color : "var(--foreground)" }}>
                  {fa ? info.fa : info.en}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{fa ? info.faDesc : info.enDesc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: <ShieldAlert className="size-4 text-rose-400" />, label: fa ? "بلاک ۲۴س" : "Blocked 24h", value: stats?.blockedToday ?? 0 },
          { icon: <Shield className="size-4 text-sky-400" />, label: fa ? "ثبت‌شده ۲۴س" : "Logged 24h", value: stats?.loggedToday ?? 0 },
          { icon: <Ban className="size-4 text-amber-400" />, label: fa ? "بن فعال" : "Active bans", value: stats?.activeBans ?? 0 },
          { icon: <ShieldCheck className="size-4 text-emerald-400" />, label: fa ? "کل رخدادها" : "Total events", value: stats?.totalEvents ?? 0 },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-3">
            {c.icon}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className="font-mono text-lg font-black text-foreground">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* policy toggles + limits */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4">
          <p className="text-xs font-bold text-foreground">{fa ? "سیاست‌ها" : "Policies"}</p>
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs text-foreground/85">
              {fa ? "بلاک ربات‌ها و اسکنرهای مهاجم" : "Block attack tools & scraper bots"}
              <span className="block text-[10px] text-muted-foreground">
                {fa ? "sqlmap، nikto، curl، headless، اسپایدرهای SEO… (گوگل/بینگ مجاز)" : "sqlmap, nikto, curl, headless, SEO harvesters… (Google/Bing stay allowed)"}
              </span>
            </span>
            <Switch
              checked={s?.blockBadBots ?? true}
              onCheckedChange={(v) => void patchSettings({ blockBadBots: v })}
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs text-foreground/85">
              {fa ? "بلاک مسیرهای حساس" : "Block sensitive path probes"}
              <span className="block text-[10px] text-muted-foreground" dir="ltr">.env · .git · wp-admin · phpmyadmin · xmlrpc…</span>
            </span>
            <Switch
              checked={s?.blockSensitivePaths ?? true}
              onCheckedChange={(v) => void patchSettings({ blockSensitivePaths: v })}
            />
          </label>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4">
          <p className="text-xs font-bold text-foreground">{fa ? "محدودیت نرخ درخواست" : "Rate limiting"}</p>
          <label className="flex items-center justify-between gap-3 text-xs">
            <span className="text-foreground/85">{fa ? "حداکثر درخواست در دقیقه از هر IP" : "Max requests / minute / IP"}</span>
            <Input
              type="number"
              defaultValue={s?.rateLimitPerMin ?? 120}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v && v !== s?.rateLimitPerMin) void patchSettings({ rateLimitPerMin: v });
              }}
              className="w-24 text-center"
              min={10}
              max={6000}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs">
            <span className="text-foreground/85">{fa ? "مدت بن خودکار (دقیقه)" : "Auto-ban duration (minutes)"}</span>
            <Input
              type="number"
              defaultValue={s?.rateBanMinutes ?? 10}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v && v !== s?.rateBanMinutes) void patchSettings({ rateBanMinutes: v });
              }}
              className="w-24 text-center"
              min={1}
              max={1440}
            />
          </label>
        </div>
      </div>

      {/* lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        {([
          { key: "blocklist" as const, title: fa ? "لیست سیاه (IP)" : "Blocklist (IP)", value: newBlockIp, setter: setNewBlockIp, items: s?.blocklist ?? [], color: "#fb7185" },
          { key: "allowlist" as const, title: fa ? "لیست سفید (IP)" : "Allowlist (IP)", value: newAllowIp, setter: setNewAllowIp, items: s?.allowlist ?? [], color: "#34d399" },
        ]).map((list) => (
          <div key={list.key} className="rounded-2xl border border-border bg-surface-1 p-4">
            <p className="mb-2 text-xs font-bold text-foreground">{list.title}</p>
            <div className="flex gap-2">
              <Input
                value={list.value}
                onChange={(e) => list.setter(e.target.value)}
                placeholder="203.0.113.7"
                dir="ltr"
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={async () => {
                  const ip = list.value.trim();
                  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && !/^[a-f0-9:]+:+[a-f0-9]+$/i.test(ip)) {
                    toast.error(fa ? "IP نامعتبر است" : "Invalid IP");
                    return;
                  }
                  const next = Array.from(new Set([...list.items, ip]));
                  await patchSettings({ [list.key]: next } as Partial<DefenseSettings>);
                  list.setter("");
                }}
              >
                {fa ? "افزودن" : "Add"}
              </Button>
            </div>
            <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {list.items.map((ip) => (
                <button
                  key={ip}
                  onClick={() =>
                    void patchSettings({ [list.key]: list.items.filter((x) => x !== ip) } as Partial<DefenseSettings>)
                  }
                  className="flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px]"
                  style={{ borderColor: `color-mix(in oklch, ${list.color} 40%, transparent)`, color: list.color }}
                  title={fa ? "حذف" : "remove"}
                >
                  {ip} ✕
                </button>
              ))}
              {!list.items.length && <p className="text-[11px] text-muted-foreground">—</p>}
            </div>
          </div>
        ))}
      </div>

      {/* tester */}
      <div className="rounded-2xl border border-border bg-surface-1 p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground">
          <FlaskConical className="size-3.5 text-violet-400" />
          {fa ? "تست‌کننده قوانین (بدون اثر واقعی)" : "Rule tester (dry-run)"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Input value={testUa} onChange={(e) => setTestUa(e.target.value)} dir="ltr" className="min-w-52 flex-1 font-mono text-xs" placeholder="User-Agent" />
          <Input value={testPath} onChange={(e) => setTestPath(e.target.value)} dir="ltr" className="w-40 font-mono text-xs" placeholder="/.env" />
          <Button size="sm" variant="outline" onClick={() => void runTest()}>{fa ? "اجرا" : "Run"}</Button>
        </div>
        {testResult && (
          <p className="mt-2 rounded-lg bg-background/60 px-3 py-2 font-mono text-[11px] text-foreground/85" dir="ltr">
            {testResult}
          </p>
        )}
      </div>

      {/* bans */}
      <div className="rounded-2xl border border-border bg-surface-1 p-4">
        <p className="mb-3 text-xs font-bold text-foreground">{fa ? "بن‌های فعال" : "Active bans"}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="p-1.5 text-start">IP</th>
                <th className="p-1.5 text-start">{fa ? "تا" : "Until"}</th>
                <th className="p-1.5 text-start">{fa ? "عملیات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(data?.bans ?? []).map((b) => (
                <tr key={b.ip} className="border-t border-border/60">
                  <td className="p-1.5">{b.ip}</td>
                  <td className="p-1.5">{fmtTime(b.until, fa)}</td>
                  <td className="p-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await op({ op: "unban", ip: b.ip });
                        toast.success(fa ? "رفع بن شد" : "Unbanned");
                        void load();
                      }}
                    >
                      {fa ? "رفع بن" : "Unban"}
                    </Button>
                  </td>
                </tr>
              ))}
              {!(data?.bans ?? []).length && (
                <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* threat feed */}
      <div className="rounded-2xl border border-border bg-surface-1 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-foreground">
            {fa ? "جریان زنده تهدیدها" : "Live threat feed"}
            {stats?.topAttackers?.length ? (
              <span className="ms-2 font-normal text-muted-foreground">
                {fa ? "· مهاجمان برتر: " : "· top: "}
                <span className="font-mono">{stats.topAttackers.slice(0, 3).map((a) => `${a.ip}×${a.value}`).join("  ")}</span>
              </span>
            ) : null}
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await op({ op: "clear-threats" });
              void load();
            }}
          >
            <Trash2 className="size-3.5" />
            {fa ? "پاک‌سازی لاگ" : "Clear log"}
          </Button>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="sticky top-0 bg-surface-1">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="p-1.5 text-start">{fa ? "ساعت" : "Time"}</th>
                <th className="p-1.5 text-start">{fa ? "اقدام" : "Action"}</th>
                <th className="p-1.5 text-start">{fa ? "قانون" : "Rule"}</th>
                <th className="p-1.5 text-start">IP</th>
                <th className="p-1.5 text-start">{fa ? "مسیر" : "Path"}</th>
                <th className="p-1.5 text-start">User-Agent</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(data?.threats ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border/60">
                  <td className="whitespace-nowrap p-1.5">{fmtTime(t.at, fa)}</td>
                  <td className="p-1.5">
                    <span style={{ color: t.action === "blocked" ? "#fb7185" : t.action === "allowed-goodbot" ? "#34d399" : "#38bdf8" }}>
                      {t.action}
                    </span>
                  </td>
                  <td className="p-1.5">{t.rule || "—"}</td>
                  <td className="p-1.5">{t.ip || "—"}</td>
                  <td className="p-1.5" dir="ltr">{t.method} {t.path}</td>
                  <td className="max-w-52 truncate p-1.5 text-muted-foreground" dir="ltr" title={t.ua}>{t.ua || "—"}</td>
                </tr>
              ))}
              {!(data?.threats ?? []).length && (
                <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">
                  {fa ? "تهدیدی ثبت نشده — آرامش قیمت است 🌙" : "No threats recorded — quiet night 🌙"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 text-[11px] leading-5 text-muted-foreground">
        <ListX className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
        <p>
          {fa
            ? "حالت «فقط ثبت» برای مشاهده‌ی رفتار بدون بلاک مناسب است؛ حالت «متعادل» پیشنهاد می‌شود (پیش‌فرض). خزنده‌های موتور جست‌وجو (گوگل/بینگ/داک‌داک) در همه‌ی حالت‌ها مجاز می‌مانند تا سئو آسیب نبیند."
            : "Use “Log only” to observe without blocking; “Balanced” (default) is recommended. Search-engine crawlers (Google/Bing/DuckDuck) always pass so SEO is never hurt."}
        </p>
      </div>
    </div>
  );
}
