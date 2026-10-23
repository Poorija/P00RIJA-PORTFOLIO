"use client";

/* ============================================================
 * CmsVisitorsPanel — strict visitor management (Access Guard).
 *
 * Lists every identified visitor (device-fingerprint id), shows who is
 * BLOCKED and why, exposes manual block/unblock, and a live audit feed
 * of unlock attempts (ok / wrong / disabled / blocked). The identity
 * survives VPN and incognito: vid = HMAC(fingerprint + browser/OS
 * family); the IP is recorded for display only.
 * ============================================================ */

import { useCallback, useEffect, useState } from "react";
import {
  Ban, Clock, Fingerprint, Globe2, History, LockOpen, MonitorSmartphone,
  RefreshCw, ShieldAlert, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VisitorRow {
  vid: string;
  vidShort: string;
  platform: string;
  timezone: string;
  uaFamily: string;
  geo: string;
  firstSeen: number;
  lastSeen: number;
  ips: string[];
  blocked: boolean;
  blockedAt: number;
  blockedReason: string;
  failuresTotal: number;
  failingTargets: string[];
  lockouts: string[];
  note: string;
}

interface AuditRow {
  at: number;
  vid: string;
  target: string;
  outcome: "ok" | "wrong" | "disabled" | "blocked";
  ip: string;
}

interface Data {
  visitors: VisitorRow[];
  audit: AuditRow[];
}

const OUTCOME_STYLE: Record<AuditRow["outcome"], string> = {
  ok: "text-emerald-400",
  wrong: "text-amber-400",
  disabled: "text-red-400",
  blocked: "text-red-400",
};

function fmtTime(ms: number, fa: boolean): string {
  return new Date(ms).toLocaleString(fa ? "fa-IR" : "en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortTarget(t: string): string {
  return t.replace("gallery:", "🖼 ").replace("proj:", "◆ ").replace("__site__", "SITE");
}

export function CmsVisitorsPanel({ lang }: { lang: "fa" | "en" }) {
  const fa = lang === "fa";
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/protection?admin=1", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        setData({ visitors: json.visitors ?? [], audit: json.audit ?? [] });
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (action: "visitor-block" | "visitor-unblock", vid: string) => {
    setBusy(vid);
    try {
      const res = await fetch("/api/protection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, vid }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        toast.success(action === "visitor-block"
          ? (fa ? "بازدیدکننده مسدود شد" : "Visitor blocked")
          : (fa ? "مسدودی بازدیدکننده برداشته شد" : "Visitor unblocked"));
        await load();
      } else {
        toast.error(json?.error || "Request failed");
      }
    } catch {
      toast.error(fa ? "خطای شبکه" : "Network error");
    } finally {
      setBusy(null);
    }
  };

  const visitors = data?.visitors ?? [];
  const blockedCount = visitors.filter((v) => v.blocked).length;

  return (
    <div className="space-y-5">
      {/* intro */}
      <div className="rounded-xl border border-border bg-background/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg border border-[var(--sec-1)]/40 bg-[var(--sec-1)]/15">
            <Fingerprint className="size-5 text-[var(--sec-1)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-foreground">
              {fa ? "بازدیدکننده‌ها و مسدودی‌ها (شناسایی سختگیرانه)" : "Visitors & Blocks (strict identity)"}
            </h3>
            <p className="mt-0.5 text-xs leading-6 text-muted-foreground">
              {fa
                ? "هر بازدیدکننده با ترکیب اثر انگشت دستگاه (کانواس + گرافیک + صفحه + منطقه زمانی +…) و خانواده مرورگر/سیستم‌عامل شناسایی می‌شود — تغییر IP با VPN یا حالت ناشناس، هویت را عوض نمی‌کند. کسی که قفلی را با تلاش ناموفق بسوزاند خودکار مسدود می‌شود و حتی با رمز درست هم باز نمی‌کند تا شما اینجا آزادش کنید."
                : "Every visitor is identified by a device fingerprint (canvas + GPU + screen + timezone + …) combined with the browser/OS family — switching IPs over VPN or going incognito does not change the id. Burning a lock's attempt budget auto-blocks the abuser (even a correct password is then refused) until you release them here."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] text-muted-foreground">
              {fa ? `${visitors.length} نفر · ${blockedCount} مسدود` : `${visitors.length} seen · ${blockedCount} blocked`}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => void load()} aria-label={fa ? "بازخوانی" : "Refresh"}>
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* visitor table */}
      <section className="space-y-3">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <ShieldAlert className="size-3.5 text-[var(--sec-1)]" />
          {fa ? "فهرست بازدیدکننده‌ها" : "Visitor list"}
        </h4>
        {visitors.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {fa ? "هنوز بازدیدکننده‌ای شناسایی نشده است." : "No visitors identified yet."}
          </p>
        )}
        <div className="space-y-2">
          {visitors.map((v) => (
            <div
              key={v.vid}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-3 text-xs",
                v.blocked ? "border-red-500/40 bg-red-500/[.06]" : "border-border bg-background/40"
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                {v.blocked ? <Ban className="size-4 shrink-0 text-red-400" /> : <ShieldCheck className="size-4 shrink-0 text-emerald-400" />}
                <span className="font-mono font-bold text-foreground">{v.vidShort}</span>
              </div>
              <span className="flex items-center gap-1 text-muted-foreground"><MonitorSmartphone className="size-3.5" />{v.uaFamily}{v.platform ? ` · ${v.platform}` : ""}</span>
              <span className="flex items-center gap-1 text-muted-foreground"><Globe2 className="size-3.5" />{v.geo || "—"}{v.timezone ? ` · ${v.timezone}` : ""}</span>
              <span className="flex items-center gap-1 font-mono text-muted-foreground"><Clock className="size-3.5" />{fmtTime(v.lastSeen, fa)}</span>
              <span className="font-mono text-muted-foreground/80">{v.ips.length ? v.ips[v.ips.length - 1] : "—"}</span>
              {v.failuresTotal > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                  {fa ? `${v.failuresTotal} تلاش ناموفق` : `${v.failuresTotal} fails`}
                  {v.failingTargets.length > 0 ? ` · ${v.failingTargets.map(shortTarget).join(", ")}` : ""}
                </span>
              )}
              {v.lockouts.length > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[10px] text-red-300">
                  {fa ? "سوزاندن قفل: " : "burned: "}{v.lockouts.map(shortTarget).join(", ")}
                </span>
              )}
              <span className="ms-auto flex items-center gap-2">
                {v.blocked ? (
                  <Button
                    type="button" size="sm" variant="outline" disabled={busy === v.vid}
                    onClick={() => void act("visitor-unblock", v.vid)}
                  >
                    <LockOpen className="size-3.5" />
                    {fa ? "آزادسازی" : "Unblock"}
                  </Button>
                ) : (
                  <Button
                    type="button" size="sm" variant="ghost" disabled={busy === v.vid}
                    onClick={() => void act("visitor-block", v.vid)}
                  >
                    <Ban className="size-3.5" />
                    {fa ? "مسدودسازی" : "Block"}
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* audit feed */}
      <section className="space-y-3">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <History className="size-3.5 text-[var(--ai-1)]" />
          {fa ? "رویدادهای اخیر تلاش برای آنلاک" : "Recent unlock attempts"}
        </h4>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/40 p-3">
          {(data?.audit ?? []).length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {fa ? "رویدادی ثبت نشده است." : "No events yet."}
            </p>
          )}
          {(data?.audit ?? []).map((e, i) => (
            <div key={`${e.at}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
              <span>{fmtTime(e.at, fa)}</span>
              <span className="text-foreground">{e.vid.slice(0, 8)}</span>
              <span className={OUTCOME_STYLE[e.outcome]}>{e.outcome}</span>
              <span>{shortTarget(e.target)}</span>
              <span className="opacity-60">{e.ip}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
