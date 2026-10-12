"use client";

/* ============================================================
 * CookieConsent — GDPR / CCPA compliant consent manager.
 *
 * - First visit ⇒ banner with granular choices (essential is always
 *   on; analytics is opt-in and VisitorTracker obeys it live).
 * - Choice is stored in localStorage and revocable any time via the
 *   🍪 button rendered next to the music player.
 * - Nothing (not even the session id) is written before a decision.
 * ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie, ShieldCheck } from "lucide-react";
import { useContent } from "@/lib/content-store";

const KEY = "p00rija-consent-v1";

export interface ConsentState {
  v: 1;
  analytics: boolean;
  ts: number;
}

export function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(state: ConsentState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("consent-changed", { detail: state }));
  } catch {
    // storage blocked — treat as no consent
  }
}

declare global {
  interface Window {
    __consentOpen?: () => void;
  }
}

export function CookieConsent() {
  const lang = useContent((s) => s.lang);
  const fa = lang === "fa";
  const [mounted, setMounted] = useState(false);
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(true);

  useEffect(() => {
    setMounted(true);
    setConsent(readConsent());
    window.__consentOpen = () => setCustomizing(true);
    return () => {
      delete window.__consentOpen;
    };
  }, []);

  const decide = useCallback((analytics: boolean) => {
    const next: ConsentState = { v: 1, analytics, ts: Date.now() };
    writeConsent(next);
    setConsent(next);
    setCustomizing(false);
  }, []);

  if (!mounted) return null;
  const showBanner = !consent && !customizing;

  const labels = fa
    ? {
        title: "حریم خصوصی شما",
        body: "ما از کوکی‌های ضروری برای کارکرد سایت استفاده می‌کنیم و به‌صورت کاملاً first-party آمار ناشناس بازدید (بدون کوکی ردیابی، بدون سرویس بیرونی) جمع‌آوری می‌کنیم. انتخاب شما هر لحظه قابل تغییر است و داده‌ای پیش از رضایت شما ثبت نمی‌شود. (GDPR / CCPA)",
        essential: "ضروری (همیشه فعال) — زبان، تم و امنیت",
        analytics: "آمار ناشناس بازدید — اختیاری",
        accept: "پذیرفتن همه",
        reject: "فقط ضروری",
        customize: "تنظیمات",
        save: "ذخیره انتخاب‌ها",
        settings: "تنظیمات کوکی",
        status: (on: boolean) => (on ? "فعال" : "غیرفعال"),
        reopen: "تنظیمات حریم خصوصی",
      }
    : {
        title: "Your privacy",
        body: "We use essential cookies to run the site and collect first-party, anonymous visit stats (no tracking cookies, no third-party services). Your choice can be changed at any time and nothing is recorded before you decide. (GDPR / CCPA)",
        essential: "Essential (always on) — language, theme & security",
        analytics: "Anonymous visit analytics — optional",
        accept: "Accept all",
        reject: "Essential only",
        customize: "Customize",
        save: "Save choices",
        settings: "Cookie settings",
        status: (on: boolean) => (on ? "on" : "off"),
        reopen: "Privacy settings",
      };

  return createPortal(
    <>
      {/* banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="fixed inset-x-3 bottom-3 z-[150] mx-auto max-w-3xl rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
            role="dialog"
            aria-label={labels.title}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-1">
                <Cookie className="h-5 w-5" style={{ color: "var(--chart-2, #fbbf24)" }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{labels.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{labels.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => decide(true)}
                    data-cursor-hover
                    className="rounded-xl px-4 py-2 text-xs font-bold text-white transition-transform hover:scale-[1.03]"
                    style={{ background: "linear-gradient(135deg, var(--sec-1), var(--ai-1))" }}
                  >
                    {labels.accept}
                  </button>
                  <button
                    onClick={() => decide(false)}
                    data-cursor-hover
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    {labels.reject}
                  </button>
                  <button
                    onClick={() => { setAnalyticsChoice(readConsent()?.analytics ?? true); setCustomizing(true); }}
                    data-cursor-hover
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
                  >
                    {labels.customize}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* customize modal */}
      <AnimatePresence>
        {customizing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[155] grid place-items-center bg-background/80 p-4 backdrop-blur-md"
            onClick={() => setCustomizing(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              role="dialog"
              aria-label={labels.settings}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <Cookie className="h-5 w-5" style={{ color: "var(--chart-2, #fbbf24)" }} />
                <h3 className="text-base font-bold text-foreground">{labels.settings}</h3>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 p-3.5 opacity-80">
                  <div>
                    <p className="text-xs font-bold text-foreground">{labels.essential}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {fa ? "برای کارکرد سایت لازم است — قابل خاموش کردن نیست" : "Required for the site to work — cannot be disabled"}
                    </p>
                  </div>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 p-3.5">
                  <div>
                    <p className="text-xs font-bold text-foreground">{labels.analytics}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                      {fa
                        ? "آمار first-party: مدت بازدید، مرورگر و کشور — بدون کوکی ردیابی و بدون اشتراک‌گذاری با هیچ‌کس"
                        : "First-party stats: visit duration, browser & country — no tracking cookies, shared with nobody"}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={analyticsChoice}
                    onChange={(e) => setAnalyticsChoice(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-emerald-500"
                  />
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => decide(analyticsChoice)}
                  data-cursor-hover
                  className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--sec-1), var(--ai-1))" }}
                >
                  {labels.save}
                </button>
                <button
                  onClick={() => setCustomizing(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  {fa ? "بستن" : "Close"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* reopen chip — sits right beside the trophy (Achievements) button:
          cookie first, trophy next to it. Uses logical props so the pair
          stays adjacent in both LTR and RTL layouts. */}
      {consent && (
        <button
          onClick={() => { setAnalyticsChoice(consent.analytics); setCustomizing(true); }}
          data-cursor-hover
          aria-label={labels.reopen}
          title={labels.reopen}
          className="fixed bottom-[30px] end-20 z-[86] grid h-9 w-9 place-items-center rounded-full border border-border bg-card/70 text-muted-foreground backdrop-blur-md transition hover:text-foreground"
        >
          <Cookie className="h-4 w-4" />
        </button>
      )}
    </>,
    document.body
  );
}
