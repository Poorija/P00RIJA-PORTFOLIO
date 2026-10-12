"use client";

/* ============================================================
 * CmsAnalyticsCenter — visitor intelligence dashboard.
 *
 * Who is on the site right now, where from, with what browser /
 * device, how long they stayed, and how those numbers trend —
 * all first-party data from the /api/track pipeline, charted
 * with Recharts. No third-party analytics scripts ever load.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AppWindow, Bot, Clock, Download, Eye, Flame, Globe2, MousePointerClick,
  RefreshCw, Trash, Users,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { WorldMap } from "./cms-world-map";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Summary {
  server: { ip: string; country: string; region: string; city: string; lat: number; lon: number } | null;
  totals: {
    human: number; bots: number; today: number; week: number; month: number;
    live: number; avgMinutes: number;
  };
  timeseries: { date: string; visits: number; avgMinutes: number }[];
  durationBuckets: { name: string; value: number }[];
  browsers: { name: string; value: number }[];
  osList: { name: string; value: number }[];
  devices: { name: string; value: number }[];
  countries: { name: string; value: number }[];
  referrers: { name: string; value: number }[];
  live: {
    sessionKey: string;
    startedAt: string; lastSeenAt: string; durationMs: number; ip: string;
    browser: string; os: string; device: string; country: string; city: string;
    path: string; isBot: boolean; language: string;
  }[];
}

interface SessionRow {
  id: string; sessionKey: string; startedAt: string; lastSeenAt: string;
  durationMs: number; ip: string; browser: string; os: string; device: string;
  screen: string; language: string; timezone: string; referrer: string; path: string;
  country: string; region: string; city: string; isBot: boolean; botReason: string; pings: number;
}

const CHART_COLORS = ["#34d399", "#38bdf8", "#a78bfa", "#f472b6", "#fbbf24", "#fb7185", "#4ade80", "#818cf8"];

const FLAGS: Record<string, string> = {
  iran: "🇮🇷", germany: "🇩🇪", "united states": "🇺🇸", france: "🇫🇷",
  netherlands: "🇳🇱", "united kingdom": "🇬🇧", turkey: "🇹🇷", canada: "🇨🇦",
  russia: "🇷🇺", china: "🇨🇳", japan: "🇯🇵", india: "🇮🇳", italy: "🇮🇹",
  spain: "🇪🇸", sweden: "🇸🇪", switzerland: "🇨🇭", austria: "🇦🇹",
  "united arab emirates": "🇦🇪", iraq: "🇮🇶", armenia: "🇦🇲", ukraine: "🇺🇦",
  poland: "🇵🇱", finland: "🇫🇮", norway: "🇳🇴", denmark: "🇩🇰", brazil: "🇧🇷",
  australia: "🇦🇺", "south korea": "🇰🇷", singapore: "🇸🇬", local: "🏠",
};

function flagFor(country: string): string {
  return FLAGS[country.toLowerCase()] ?? "🌐";
}

function fmtDuration(ms: number, fa: boolean): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return fa ? `${s} ثانیه` : `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return fa ? `${m} دقیقه` : `${m}m`;
  return fa ? `${Math.floor(m / 60)} ساعت` : `${Math.floor(m / 60)}h`;
}

function fmtTime(iso: string, fa: boolean): string {
  return new Date(iso).toLocaleTimeString(fa ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function CmsAnalyticsCenter({ lang }: { lang: "fa" | "en" }) {
  const fa = lang === "fa";
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBots, setShowBots] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, sesRes] = await Promise.all([
        fetch("/api/analytics/summary", { cache: "no-store" }),
        fetch(`/api/analytics/sessions?limit=60&bots=${showBots ? 1 : 0}`, { cache: "no-store" }),
      ]);
      if (sRes.status === 401 || sesRes.status === 401) return;
      const sJson = await sRes.json();
      const sesJson = await sesRes.json();
      if (sJson.ok) setSummary(sJson as Summary);
      if (sesJson.ok) setSessions(sesJson.sessions as SessionRow[]);
    } catch {
      // keep previous data on transient errors
    } finally {
      setLoading(false);
    }
  }, [showBots]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const wipe = async () => {
    if (!confirm(fa ? "همه‌ی آمار پاک شود؟ این کار برگشت‌پذیر نیست." : "Delete all analytics? This cannot be undone.")) return;
    const res = await fetch("/api/analytics/sessions", { method: "DELETE" });
    if (res.ok) {
      toast.success(fa ? "آمار پاک شد" : "Analytics cleared");
      // tell open tabs (including this one) to re-register their visit right away
      window.dispatchEvent(new Event("analytics-wiped"));
      void load();
    }
  };

  const t = summary?.totals;
  // Aggregate sessions by IP: visits, total time on site, last seen.
  const ipRows = useMemo(() => {
    const map = new Map<string, { ip: string; visits: number; totalMs: number; lastSeen: string; country: string; city: string }>();
    for (const s of sessions) {
      const key = s.ip || "unknown";
      const row = map.get(key) ?? { ip: s.ip, visits: 0, totalMs: 0, lastSeen: s.lastSeenAt, country: s.country, city: s.city };
      row.visits += 1;
      row.totalMs += s.durationMs || 0;
      if (new Date(s.lastSeenAt) > new Date(row.lastSeen)) row.lastSeen = s.lastSeenAt;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => b.totalMs - a.totalMs).slice(0, 60);
  }, [sessions]);
  const cards = t ? [
    { icon: <Users className="size-4" />, label: fa ? "کل بازدید کنندگان" : "Total visitors", value: t.human, color: "#34d399" },
    { icon: <Eye className="size-4" />, label: fa ? "۲۴ ساعت اخیر" : "Last 24h", value: t.today, color: "#38bdf8" },
    { icon: <Activity className="size-4" />, label: fa ? "۷ روز اخیر" : "Last 7d", value: t.week, color: "#a78bfa" },
    { icon: <Clock className="size-4" />, label: fa ? "میانگین حضور" : "Avg. session", value: `${t.avgMinutes} ${fa ? "دقیقه" : "min"}`, color: "#fbbf24" },
    { icon: <MousePointerClick className="size-4" />, label: fa ? "همین لحظه آنلاین" : "Live now", value: t.live, color: "#f472b6" },
    { icon: <Bot className="size-4" />, label: fa ? "ربات‌ها" : "Bots seen", value: t.bots, color: "#94a3b8" },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-foreground sm:text-base">
            {fa ? "📊 مرکز آمار بازدیدکنندگان" : "📊 Visitor Analytics"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {fa
              ? "داده‌های first-party: IP، لوکیشن، مرورگر، دستگاه و مدت جلسه — بدون هیچ سرویس بیرونی"
              : "First-party data: IP, location, browser, device and session time — zero third-party scripts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            {fa ? "به‌روزرسانی" : "Refresh"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void wipe()}>
            <Trash className="size-3.5" />
            {fa ? "پاک‌سازی" : "Wipe"}
          </Button>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-surface-1 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span style={{ color: c.color }}>{c.icon}</span>
              {c.label}
            </div>
            <p className="mt-1 font-mono text-xl font-black" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* neon world map with live arcs */}
      {/* 🗺 neon world map — one arc per real connection, at the top */}
      <WorldMap
        countries={summary?.countries ?? []}
        connections={[
          ...(summary?.live ?? []).map((l) => ({ country: l.country, city: l.city, ts: l.lastSeenAt })),
          ...sessions.filter((x) => x.country).map((x) => ({ country: x.country, city: x.city, ts: x.lastSeenAt })),
        ]}
        server={summary?.server ?? null}
        fa={fa}
      />
      {summary?.server?.country ? (
        <p className="-mt-3 text-center font-mono text-[10px] text-muted-foreground/70" dir="ltr">
          {fa ? "نود سرور از IP عمومی سرور مکان‌یابی شده" : "server node geolocated from the deployment's public IP"} · {summary.server.ip} → {summary.server.city || summary.server.country}
        </p>
      ) : null}

      {/* IP audience — who visited and how long they stayed */}
      <div className="rounded-2xl border border-border bg-surface-1 p-4">
        <p className="mb-3 text-xs font-bold text-foreground">
          {fa ? "🖥 بازدیدکنندگان بر اساس IP و زمان اقامت" : "🖥 Visitors by IP & time on site"}
        </p>
        <div className="max-h-72 overflow-y-auto" data-lenis-prevent>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="p-1.5 text-start font-medium">{fa ? "IP" : "IP"}</th>
                <th className="p-1.5 text-start font-medium">{fa ? "موقعیت" : "Location"}</th>
                <th className="p-1.5 text-start font-medium">{fa ? "بازدیدها" : "Visits"}</th>
                <th className="p-1.5 text-start font-medium">{fa ? "مجموع حضور" : "Total time"}</th>
                <th className="p-1.5 text-start font-medium">{fa ? "آخرین" : "Last seen"}</th>
              </tr>
            </thead>
            <tbody>
              {ipRows.map((r) => (
                <tr key={r.ip} className="border-t border-border/50">
                  <td className="p-1.5 font-mono" dir="ltr">{r.ip || "—"}</td>
                  <td className="p-1.5">{flagFor(r.country)} {[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="p-1.5 font-mono">{r.visits}</td>
                  <td className="p-1.5 font-mono" style={{ color: "var(--chart-4)" }}>{fmtDuration(r.totalMs, fa)}</td>
                  <td className="p-1.5 font-mono text-muted-foreground" dir="ltr">{fmtTime(r.lastSeen, fa)}</td>
                </tr>
              ))}
              {!ipRows.length && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{fa ? "هنوز IP ثبت نشده" : "No IPs recorded yet"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* timeseries + duration */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <p className="mb-3 text-xs font-bold text-foreground">
            {fa ? "روند بازدید ۳۰ روز (میانگین حضور با خط دوم)" : "30-day visits (avg. session on second axis)"}
          </p>
          <div style={{ width: "100%", height: 220 }} dir="ltr">
            <ResponsiveContainer>
              <AreaChart data={summary?.timeseries ?? []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(10,15,13,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, fontSize: 11 }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Area type="monotone" dataKey="visits" stroke="#34d399" strokeWidth={2} fill="url(#visitsFill)" name={fa ? "بازدید" : "visits"} />
                <Area type="monotone" dataKey="avgMinutes" stroke="#fbbf24" strokeWidth={1.4} fill="transparent" name={fa ? "میانگین (دقیقه)" : "avg min"} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <p className="mb-3 text-xs font-bold text-foreground">{fa ? "مدت حضور جلسات" : "Session durations"}</p>
          <div style={{ width: "100%", height: 220 }} dir="ltr">
            <ResponsiveContainer>
              <BarChart data={summary?.durationBuckets ?? []} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(10,15,13,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, fontSize: 11 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} name={fa ? "جلسه" : "sessions"}>
                  {(summary?.durationBuckets ?? []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* browsers / devices / countries / referrers */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DistributionCard
          title={fa ? "مرورگرها" : "Browsers"}
          data={summary?.browsers ?? []}
          fa={fa}
          render={(n) => n}
        />
        <DistributionCard
          title={fa ? "دستگاه‌ها" : "Devices"}
          data={summary?.devices ?? []}
          fa={fa}
          render={(n) => n === "desktop" ? (fa ? "دسکتاپ" : "Desktop") : n === "mobile" ? (fa ? "موبایل" : "Mobile") : n === "tablet" ? (fa ? "تبلت" : "Tablet") : (fa ? "ربات" : "Bot")}
        />
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <p className="mb-3 text-xs font-bold text-foreground">{fa ? "کشورها" : "Countries"}</p>
          <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto pe-1">
            {(summary?.countries ?? []).map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span>{flagFor(c.name)}</span>
                <span className="flex-1 truncate text-foreground/80">{c.name}</span>
                <span className="font-mono text-muted-foreground">{c.value}</span>
              </div>
            ))}
            {!(summary?.countries ?? []).length && <p className="text-xs text-muted-foreground">—</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <p className="mb-3 text-xs font-bold text-foreground">{fa ? "منبع‌های ورود" : "Referrers"}</p>
          <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto pe-1">
            {(summary?.referrers ?? []).map((r) => (
              <div key={r.name} className="flex items-center gap-2 text-xs">
                <Globe2 className="size-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground/80" dir="ltr">{r.name}</span>
                <span className="font-mono text-muted-foreground">{r.value}</span>
              </div>
            ))}
            {!(summary?.referrers ?? []).length && <p className="text-xs text-muted-foreground">—</p>}
          </div>
        </div>
      </div>

      {/* live sessions */}
      <div className="rounded-2xl border border-border bg-surface-1 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-bold text-foreground">
            {fa ? "آنلاین همین حالا" : "Online right now"} {t ? `(${t.live})` : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-start text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="p-1.5 text-start">{fa ? "IP" : "IP"}</th>
                <th className="p-1.5 text-start">{fa ? "محل" : "Location"}</th>
                <th className="p-1.5 text-start">{fa ? "مرورگر / سیستم" : "Browser / OS"}</th>
                <th className="p-1.5 text-start">{fa ? "دستگاه" : "Device"}</th>
                <th className="p-1.5 text-start">{fa ? "مدت" : "Duration"}</th>
                <th className="p-1.5 text-start">{fa ? "صفحه" : "Path"}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(summary?.live ?? []).map((s) => (
                <tr key={s.sessionKey ?? s.ip + s.startedAt} className="border-t border-border/60">
                  <td className="p-1.5">{s.ip || "—"}</td>
                  <td className="p-1.5">{s.country ? `${flagFor(s.country)} ${s.city || s.country}` : "—"}</td>
                  <td className="p-1.5">{s.browser} / {s.os}</td>
                  <td className="p-1.5">{s.device}</td>
                  <td className="p-1.5">{fmtDuration(s.durationMs, fa)}</td>
                  <td className="p-1.5" dir="ltr">{s.path}</td>
                </tr>
              ))}
              {!(summary?.live ?? []).length && (
                <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* recent sessions */}
      <div className="rounded-2xl border border-border bg-surface-1 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-foreground">
            {fa ? "آخرین نشست‌ها" : "Recent sessions"}
          </p>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={showBots} onChange={(e) => setShowBots(e.target.checked)} className="accent-emerald-500" />
            {fa ? "نمایش ربات‌ها" : "include bots"}
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="p-1.5 text-start">{fa ? "زمان" : "Time"}</th>
                <th className="p-1.5 text-start">{fa ? "IP" : "IP"}</th>
                <th className="p-1.5 text-start">{fa ? "محل" : "Location"}</th>
                <th className="p-1.5 text-start">{fa ? "مرورگر" : "Browser"}</th>
                <th className="p-1.5 text-start">{fa ? "سیستم" : "OS"}</th>
                <th className="p-1.5 text-start">{fa ? "دستگاه" : "Device"}</th>
                <th className="p-1.5 text-start">{fa ? "نمایشگر" : "Screen"}</th>
                <th className="p-1.5 text-start">{fa ? "زبان" : "Lang"}</th>
                <th className="p-1.5 text-start">{fa ? "مدت" : "Duration"}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-border/60">
                  <td className="p-1.5">{fmtTime(s.lastSeenAt, fa)}</td>
                  <td className="p-1.5">{s.ip || "—"}</td>
                  <td className="p-1.5">{s.country ? `${flagFor(s.country)} ${s.city || s.country}` : "—"}</td>
                  <td className="p-1.5">{s.browser}{s.isBot ? ` ⚠︎${s.botReason}` : ""}</td>
                  <td className="p-1.5">{s.os}</td>
                  <td className="p-1.5">{s.device}</td>
                  <td className="p-1.5">{s.screen || "—"}</td>
                  <td className="p-1.5">{s.language || "—"}</td>
                  <td className="p-1.5">{fmtDuration(s.durationMs, fa)}</td>
                </tr>
              ))}
              {!sessions.length && (
                <tr><td colSpan={9} className="p-3 text-center text-muted-foreground">
                  {fa ? "هنوز داده‌ای نیست — با اولین بازدید پر می‌شود" : "No data yet — fills with the first visit"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FullReport sessions={sessions} fa={fa} />

      {/* Integrations shortcut — where GA4 / Search Console / HubSpot live */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground">
            {fa ? "🔌 اتصال به Google Analytics / Search Console / HubSpot و…" : "🔌 Connect Google Analytics / Search Console / HubSpot & more"}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {fa
              ? "در Builder ← «اتصال سرویس‌های مانیتورینگ»: GA4، GTM، Hotjar، Plausible، Matomo، Cloudflare و HubSpot + توکن تایید Search Console. همه فقط پس از رضایت کوکی کاربر فعال می‌شوند."
              : "Located in Builder ← “Traffic-monitoring integrations”: GA4, GTM, Hotjar, Plausible, Matomo, Cloudflare, HubSpot + the Search Console verification token. All consent-gated."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.dispatchEvent(new CustomEvent("cms-goto", { detail: "builder" }))}
        >
          {fa ? "رفتن به تنظیمات اتصال‌ها" : "Open integration settings"}
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-[11px] leading-5 text-muted-foreground">
        <AppWindow className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
        <p>
          {fa
            ? "حریم خصوصی: بدون کوکی ردیابی؛ شناسه‌ی نشست با بسته‌شدن تب از بین می‌رود و درخواست کاربرانی که Do Not Track فعال کرده‌اند هرگز ثبت نمی‌شود. مالکیت داده کاملاً با خودتان است."
            : "Privacy: no tracking cookies; the session id dies with the tab, and visitors with Do Not Track enabled are never recorded. You own 100% of the data."}
        </p>
      </div>
    </div>
  );
}

function DistributionCard({
  title, data, fa, render,
}: {
  title: string;
  data: { name: string; value: number }[];
  fa: boolean;
  render: (name: string) => string;
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <p className="mb-3 text-xs font-bold text-foreground">{title}</p>
      {total > 0 ? (
        <div className="flex items-center gap-3">
          <div style={{ width: 92, height: 92 }} dir="ltr">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={24} outerRadius={44} paddingAngle={2} strokeWidth={0}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "rgba(10,15,13,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
            {data.slice(0, 5).map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="flex-1 truncate text-foreground/80">{render(d.name)}</span>
                <span className="font-mono text-muted-foreground">{Math.round((d.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">—</p>
      )}
    </div>
  );
}


/* ============================================================
 * FullReport — deep-dive analytics: hourly activity heatmap,
 * visits-by-hour bars, top pages and one-click CSV export.
 * ============================================================ */
function FullReport({ sessions, fa }: { sessions: SessionRow[]; fa: boolean }) {
  const [exporting, setExporting] = useState(false);

  const hourly = useMemo(() => {
    const now = Date.now();
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const labels: string[] = [];
    for (let d = 6; d >= 0; d--) {
      const day = new Date(now - d * 86400000);
      labels.push(day.toLocaleDateString(fa ? "fa-IR" : "en-GB", { weekday: "short" }));
    }
    sessions.forEach((x) => {
      const t = new Date(x.startedAt);
      const diffDays = Math.floor((now - t.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) grid[6 - diffDays][t.getHours()] += 1;
    });
    return { grid, labels };
  }, [sessions, fa]);

  const byHour = useMemo(() => {
    const arr = Array(24).fill(0);
    sessions.forEach((x) => (arr[new Date(x.startedAt).getHours()] += 1));
    return arr.map((v, h) => ({ hour: String(h).padStart(2, "0"), value: v }));
  }, [sessions]);

  const topPages = useMemo(() => {
    const m = new Map<string, number>();
    sessions.forEach((x) => m.set(x.path || "/", (m.get(x.path || "/") ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [sessions]);

  const exportCsv = () => {
    setExporting(true);
    try {
      const header = ["startedAt", "lastSeenAt", "durationMs", "ip", "country", "city", "browser", "os", "device", "screen", "language", "timezone", "referrer", "path", "isBot"];
      const rows = sessions.map((x) => [
        x.startedAt, x.lastSeenAt, x.durationMs, x.ip, x.country, x.city, x.browser, x.os,
        x.device, x.screen, x.language, x.timezone, x.referrer, x.path, x.isBot ? "bot" : "human",
      ]);
      const csv = [header, ...rows].map((r) => r.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "p00rija-analytics-" + new Date().toISOString().slice(0, 10) + ".csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setTimeout(() => setExporting(false), 500);
    }
  };

  const heatMax = Math.max(1, ...hourly.grid.flat());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Flame className="size-3.5 text-amber-400" />
          {fa ? "گزارش کامل — فعالیت ساعتی، صفحات پربازدید و خروجی CSV" : "Full report — hourly activity, top pages & CSV export"}
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting || !sessions.length}>
          <Download className="size-3.5" />
          {fa ? "خروجی CSV" : "Export CSV"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-1 p-4" dir="ltr">
          <p className="mb-3 text-xs font-bold text-foreground">{fa ? "نقشه‌ی حرارتی فعالیت (۷ روز × ۲۴ ساعت)" : "Activity heatmap (7 days × 24h)"}</p>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-[2px]">
              <tbody>
                {hourly.grid.map((row, d) => (
                  <tr key={d}>
                    <td className="pe-2 text-end font-mono text-[9px] text-muted-foreground">{hourly.labels[d]}</td>
                    {row.map((v, h) => (
                      <td key={h} className="p-0">
                        <div
                          className="h-3.5 w-3.5 rounded-[3px]"
                          title={hourly.labels[d] + " " + h + ":00 — " + v}
                          style={{
                            background: v === 0
                              ? "color-mix(in oklch, var(--surface-1) 70%, var(--border))"
                              : "color-mix(in oklch, var(--sec-1) " + Math.round(15 + (v / heatMax) * 85) + "%, transparent)",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface-1 p-4" dir="ltr">
            <p className="mb-3 text-xs font-bold text-foreground">{fa ? "بازدید بر اساس ساعت شبانه‌روز" : "Visits by hour of day"}</p>
            <div className="flex h-24 items-end gap-[3px]">
              {byHour.map((b) => {
                const max = Math.max(1, ...byHour.map((x) => x.value));
                return (
                  <div key={b.hour} className="group relative min-w-[3px] flex-1 rounded-t bg-[color-mix(in_oklch,var(--ai-1)_70%,transparent)]" style={{ height: (b.value / max) * 100 + "%", minHeight: 2 }}>
                    <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 font-mono text-[9px] text-foreground group-hover:block">{b.value}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground"><span>00</span><span>12</span><span>23</span></div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-1 p-4">
            <p className="mb-2 text-xs font-bold text-foreground">{fa ? "صفحات پربازدید" : "Top pages"}</p>
            {topPages.length ? topPages.map(([path, n]) => (
              <div key={path} className="flex items-center gap-2 py-0.5 font-mono text-[11px]">
                <span className="flex-1 truncate text-foreground/80" dir="ltr">{path}</span>
                <span className="text-muted-foreground">×{n}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">—</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
