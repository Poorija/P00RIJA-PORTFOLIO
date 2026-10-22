"use client";

/* ============================================================
 * LicenseGatePage — the ONLY reachable page while the site is
 * commercially locked. States:
 *   • trial active → countdown + "Buy License" CTA
 *   • trial expired / unlicensed → activation or purchase
 *   • maintenance → status; auto-recovers
 * ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, ShieldCheck, Wrench, Upload, Loader2, RefreshCw, Mail, Clock } from "lucide-react";
import { VENDOR_EMAIL, VENDOR_WALLET } from "@/lib/vendor-identity";

interface GateInfo {
  phase: "unlicensed" | "maintenance" | "active" | "disabled";
  reason: string;
  licenseId?: string;
  licensee?: string;
  plan?: string;
  expiresAt?: string | null;
  usageCount?: number;
  usageLimit?: number | null;
}

interface TrialInfo {
  daysLeft: number;
  totalDays: number;
  expired: boolean;
}

// Official vendor identity — imported from the frozen vendor-identity module.

function buildLicenseEmail(): string {
  const subject = encodeURIComponent("P00RIJA Portfolio — License Purchase Request");
  const body = encodeURIComponent(`Hello P00RIJA,

I would like to purchase a license for P00RIJA Portfolio.

Please fill in the following details:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 LICENSE REQUEST FORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▸ Your Name / Company:
  __________________

▸ Email (for license delivery):
  __________________

▸ Plan (check one):
  ☐ Monthly    ☐ Quarterly    ☐ Semi-Annual
  ☐ Annual     ☐ Perpetual    ☐ Custom

▸ Number of installs/servers needed:
  __________________

▸ Domain(s) where the app will run:
  ____________________________________

▸ Special requirements (optional):
  ____________________________________

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Payment methods accepted:
   • TON (The Open Network) wallet:
     ${VENDOR_WALLET}

   • Cryptocurrency (specify in requirements)

Thank you!
`);
  return `mailto:${VENDOR_EMAIL}?subject=${subject}&body=${body}`;
}

export default function LicensePage() {
  const [info, setInfo] = useState<GateInfo | null>(null);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/license/status", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setInfo(json as GateInfo);
    } catch {
      // keep last state
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Fetch trial info (days remaining, expired)
  useEffect(() => {
    void fetch("/api/license/status")
      .then((r) => r.json())
      .then((j) => { if (j.trial) setTrial(j.trial as TrialInfo); })
      .catch(() => undefined);
  }, []);

  // While locked, poll — the moment the license becomes valid again the
  // next navigation leaves this page (the proxy allows the site through).
  useEffect(() => {
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  const activate = async () => {
    setError("");
    setOkMsg("");
    const file = fileRef.current?.files?.[0];
    let content = "";
    if (file) {
      content = await file.text();
    } else {
      const el = document.getElementById("lic-paste") as HTMLTextAreaElement | null;
      content = el?.value.trim() ?? "";
    }
    if (!content) {
      setError("فایل لایسنس را انتخاب کنید یا محتوای آن را بچسبانید.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: content }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setOkMsg("لایسنس فعال شد — در حال بازگشت به سایت…");
        setTimeout(() => window.location.replace("/"), 1200);
      } else {
        setError(json.error || "فعال‌سازی انجام نشد.");
      }
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  const maintenance = info?.phase === "maintenance";
  const trialActive = trial && !trial.expired && info?.phase === "active";
  const trialExpired = trial?.expired;

  return (
    <div className="grid min-h-dvh place-items-center bg-[oklch(0.09_0.02 260)] px-4 py-10 text-foreground" dir="rtl">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-5 grid h-20 w-20 place-items-center overflow-hidden rounded-3xl border border-white/10"
            style={{
              background: "radial-gradient(circle at 35% 30%, oklch(0.35 0.09 260 / 0.7), oklch(0.16 0.03 260))",
              boxShadow: "0 0 60px -12px oklch(0.55 0.15 265 / 0.5)",
            }}
          >
            { }
            <img src="/logo.png" alt="P00RIJA" className="size-full object-cover" />
          </div>
          {maintenance && <Wrench className="mx-auto mb-2 h-6 w-6 text-amber-300" />}
          {trialActive && <Clock className="mx-auto mb-2 h-6 w-6 text-emerald-300" />}
          <h1 className="text-2xl font-black tracking-tight">
            {maintenance ? "سایت در حالت نگهداری است" :
             trialActive ? `دوره‌ی آزمایشی — ${trial.daysLeft} روز باقی‌مانده` :
             trialExpired ? "دوره‌ی آزمایشی تمام شد" :
             "فعال‌سازی لایسنس"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {maintenance
              ? "لایسنس این نصب در حال حاضر معتبر نیست. به‌محض تأیید مجدد سرور لایسنس، سایت خودکار در دسترس قرار می‌گیرد."
              : trialActive
                ? "از نسخه‌ی آزمایشی ۵ روزه استفاده می‌کنید. برای ادامه‌ی استفاده پس از پایان این دوره، لایسنس خریداری کنید."
                : trialExpired
                  ? "دوره‌ی آزمایشی ۵ روزه شما به پایان رسیده است. برای ادامه، لایسنس خریداری و فایل آن را فعال کنید."
                  : "برای استفاده از برنامه، فایل لایسنس رمزنگاری‌شده را وارد کنید."}
          </p>
        </div>

        {/* ── TRIAL ACTIVE: countdown + buy CTA ── */}
        {trialActive && (
          <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-6 text-center backdrop-blur-xl">
            <div className="mx-auto mb-3 flex items-center justify-center gap-2 text-4xl font-black text-emerald-300">
              <Clock className="h-8 w-8" />
              {trial.daysLeft}
              <span className="text-sm font-normal text-white/50">/ {trial.totalDays} روز</span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-sky-400 transition-all"
                style={{ width: `${(trial.daysLeft / trial.totalDays) * 100}%` }}
              />
            </div>
            <a
              href={buildLicenseEmail()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <Mail className="h-4 w-4" />
              خرید لایسنس (ایمیل)
            </a>
          </div>
        )}

        {/* ── TRIAL EXPIRED / UNLICENSED: buy CTA + activation ── */}
        {(trialExpired || (!trialActive && !maintenance)) && (
          <div className="mb-6 rounded-3xl border border-sky-400/20 bg-sky-400/5 p-6 text-center backdrop-blur-xl">
            <p className="mb-3 text-sm leading-6 text-white/70">
              برای خرید لایسنس، روی دکمه بزنید — تمپلیت ایمیل آماده می‌شود، پر کنید و بفرستید:
            </p>
            <a
              href={buildLicenseEmail()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <Mail className="h-4 w-4" />
              درخواست خرید لایسنس
            </a>
            <p className="mt-3 text-[10px] text-white/40">
              پول‌سازی: TON · آدرس والت در ایمیل
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          {maintenance ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-amber-200">
                <p className="font-semibold">علت:</p>
                <p className="mt-1 text-amber-100/80">{info?.reason || "نامشخص"}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs text-white/60">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <dt className="text-white/40">شناسه لایسنس</dt>
                  <dd className="mt-1 font-mono text-white/85" dir="ltr">{info?.licenseId || "—"}</dd>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <dt className="text-white/40">دارنده</dt>
                  <dd className="mt-1 text-white/85" dir="ltr">{info?.licensee || "—"}</dd>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <dt className="text-white/40">پلن</dt>
                  <dd className="mt-1 text-white/85">{info?.plan || "—"}</dd>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <dt className="text-white/40">انقضا</dt>
                  <dd className="mt-1 font-mono text-white/85" dir="ltr">
                    {info?.expiresAt ? new Date(info.expiresAt).toLocaleDateString("fa-IR") : "بدون انقضا"}
                  </dd>
                </div>
              </dl>
              <button
                onClick={() => void load()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 text-xs font-medium text-white/70 transition-colors hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" /> بررسی مجدد وضعیت
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-black/20 p-4 text-sm text-white/70 transition-colors hover:border-sky-300/40">
                <Upload className="h-5 w-5 text-sky-300" />
                <span>انتخاب فایل لایسنس (.lic)</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".lic,application/json,text/plain"
                  className="hidden"
                  onChange={() => setError("")}
                />
              </label>
              <div>
                <p className="mb-1.5 text-xs text-white/40">یا محتوای فایل را اینجا بچسبانید:</p>
                <textarea
                  id="lic-paste"
                  dir="ltr"
                  rows={5}
                  spellCheck={false}
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-white/85 outline-none focus:border-sky-300/40"
                  placeholder='{ "v": 1, "alg": "AES-256-GCM+Ed25519", … }'
                />
              </div>
              {error && <p className="text-xs text-rose-400">{error}</p>}
              {okMsg && <p className="text-xs text-emerald-400">{okMsg}</p>}
              <button
                onClick={() => void activate()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                فعال‌سازی و شروع
              </button>
              <p className="text-center text-[10px] leading-5 text-white/35">
                فایل لایسنس با AES-256 رمزنگاری شده و امضای دیجیتال فروشنده را دارد؛ کلید عمومیِ امضا داخل همین برنامه
                تعبیه شده است. هر نصب یک UUID یکتا می‌گیرد و روی سرور لایسنس شمرده می‌شود.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-[10px] text-white/25" dir="ltr">
          P00RIJA Portfolio · Commercial License
        </p>
      </div>
    </div>
  );
}
