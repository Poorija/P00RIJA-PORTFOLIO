"use client";

/* ============================================================
 * /gate — the whole-site password screen (Access Guard).
 *
 * Shown by src/proxy.ts when a site-wide password is active and
 * the visitor has neither a valid unlock cookie nor a CMS session.
 * Styled to match the site: dark space backdrop, gradient hairline
 * card, mono labels, glowing lock badge. Supports 4/6-digit PINs
 * (input-otp) and text passwords, mirrors the lockout semantics of
 * the section guard, and offers a discreet owner login path (CMS
 * session unlocks the site without knowing the site password).
 * ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { normalizeDigits } from "@/lib/persian-digits";

interface GateInfo {
  kind: "pin4" | "pin6" | "text";
  mode: "permanent" | "attempts";
  maxAttempts: number;
  failedAttempts: number;
  disabled: boolean;
}

export default function GatePage() {
  const router = useRouter();
  const [lang, setLang] = useState<"fa" | "en">("en");
  const [info, setInfo] = useState<GateInfo | null>(null);
  const [pin, setPin] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerCode, setOwnerCode] = useState("");
  const fa = lang === "fa";

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("p00rija-language");
      if (saved === "fa" || saved === "en") setLang(saved);
      else if ((navigator.language || "").toLowerCase().startsWith("fa")) setLang("fa");
    } catch {
      /* default en */
    }
  }, []);

  const loadInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/protection", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok && json.site) {
        setInfo({
          kind: json.site.kind,
          mode: json.site.mode,
          maxAttempts: json.site.maxAttempts,
          failedAttempts: json.site.failedAttempts,
          disabled: json.site.disabled,
        });
        setDisabled(Boolean(json.site.disabled));
        if (json.unlocked?.includes("__site__")) {
          router.replace("/");
        }
      }
    } catch {
      /* static fallback UI below */
    }
  }, [router]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  const isPin = info?.kind === "pin4" || info?.kind === "pin6";
  const pinLength = info?.kind === "pin6" ? 6 : 4;

  const submit = async (password: string) => {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/protection/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "__site__", password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      setShakeKey((k) => k + 1);
      setPin("");
      setText("");
      if (res.status === 423) {
        setDisabled(true);
        setError(fa ? "قفل پس از تلاش‌های ناموفق غیرفعال شد." : "Disabled after too many wrong attempts.");
        return;
      }
      if (res.status === 429) {
        setError(fa ? "تلاش‌ها زیاد بود — یک دقیقه صبر کنید." : "Too many attempts — wait a minute.");
        return;
      }
      const json = await res.json().catch(() => null);
      const left = info?.mode === "attempts" && typeof json?.remaining === "number" && json.remaining >= 0
        ? json.remaining
        : null;
      setError(
        left === null
          ? fa ? "رمز اشتباه است." : "Wrong password."
          : fa
            ? `رمز اشتباه است — ${left} تلاش باقی مانده.`
            : `Wrong password — ${left} attempt${left === 1 ? "" : "s"} left.`
      );
      void loadInfo();
    } catch {
      setError(fa ? "خطای شبکه." : "Network error.");
    } finally {
      setBusy(false);
    }
  };

  const ownerLogin = async () => {
    if (busy || !ownerPassword) return;
    setBusy(true);
    setError(null);
    try {
      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: ownerPassword, code: ownerCode || undefined }),
      });
      if (login.ok) {
        const res = await fetch("/api/protection/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "__site__", password: "-" }),
        });
        if (res.ok) {
          router.replace("/");
          router.refresh();
          return;
        }
      }
      setShakeKey((k) => k + 1);
      setError(fa ? "ورود مدیر ناموفق بود." : "Owner login failed.");
    } catch {
      setError(fa ? "خطای شبکه." : "Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4"
      dir={fa ? "rtl" : "ltr"}
    >
      {/* space backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 70% -10%, color-mix(in oklch, var(--ai-1) 14%, transparent), transparent 60%)," +
            "radial-gradient(900px 600px at 15% 110%, color-mix(in oklch, var(--sec-1) 12%, transparent), transparent 60%)," +
            "radial-gradient(1.5px 1.5px at 12% 22%, rgba(255,255,255,.5), transparent 100%)," +
            "radial-gradient(1px 1px at 32% 68%, rgba(255,255,255,.35), transparent 100%)," +
            "radial-gradient(1.5px 1.5px at 58% 14%, rgba(255,255,255,.4), transparent 100%)," +
            "radial-gradient(1px 1px at 78% 44%, rgba(255,255,255,.3), transparent 100%)," +
            "radial-gradient(1px 1px at 88% 82%, rgba(255,255,255,.4), transparent 100%)," +
            "radial-gradient(1.5px 1.5px at 44% 90%, rgba(255,255,255,.3), transparent 100%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="logo" className="size-14 rounded-2xl border border-border shadow-lg" />
          <h1 className="text-xl font-black tracking-tight text-foreground">
            {fa ? "این سایت با رمز محافظت می‌شود" : "This site is password-protected"}
          </h1>
          <p className="max-w-xs text-xs leading-6 text-muted-foreground">
            {fa
              ? "برای ورود، رمز عبور سایت را وارد کنید."
              : "Enter the site password to continue."}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-[var(--surface-1)] p-6 shadow-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, var(--sec-1), var(--ai-1), transparent)" }}
          />

          <div className="mb-5 flex justify-center">
            <div className="grid size-14 place-items-center rounded-full border border-[var(--sec-1)]/40 bg-[var(--sec-1)]/10">
              {disabled ? (
                <ShieldAlert className="size-6 text-amber-400" />
              ) : (
                <Lock className="size-6 text-[var(--sec-1)]" />
              )}
            </div>
          </div>

          {disabled ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/[.07] px-4 py-3 text-center text-xs leading-6 text-amber-300">
              {fa
                ? "قفل سایت پس از تلاش‌های ناموفق زیاد غیرفعال شده است. مدیر می‌تواند از راه دیگر وارد شود."
                : "The site lock was disabled after too many wrong attempts. The owner can still sign in below."}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(isPin ? pin : text);
              }}
              className="flex flex-col items-center"
            >
              <div
                key={shakeKey}
                className="flex justify-center"
                style={shakeKey ? { animation: "guard-shake .4s" } : undefined}
              >
                {isPin ? (
                  <InputOTP
                    maxLength={pinLength}
                    value={pin}
                    onChange={(v) => {
                      // Persian keyboards emit ۰-۹ — normalize to ASCII.
                      const norm = normalizeDigits(v);
                      setPin(norm);
                      setError(null);
                      if (norm.length === pinLength) void submit(norm);
                    }}
                    autoFocus
                    inputMode="numeric"
                  >
                    <InputOTPGroup>
                      {Array.from({ length: pinLength }).map((_, i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="size-12 border-border bg-background text-lg font-bold text-foreground"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                ) : (
                  <input
                    type="password"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setError(null);
                    }}
                    autoFocus
                    autoComplete="current-password"
                    dir="ltr"
                    placeholder={fa ? "رمز عبور" : "password"}
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 text-center text-base text-foreground outline-none transition-colors focus:border-[var(--sec-1)]"
                  />
                )}
              </div>

              <div className="min-h-5 pt-2 text-center text-[11px] leading-5 text-red-400" aria-live="polite">
                {error ?? ""}
              </div>

              <button
                type="submit"
                disabled={busy || (isPin ? pin.length !== pinLength : !text)}
                className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--sec-1)]/40 bg-[var(--sec-1)]/15 text-sm font-bold text-foreground transition-all hover:bg-[var(--sec-1)]/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
                ) : (
                  <ShieldCheck className="size-4 text-[var(--sec-1)]" />
                )}
                {fa ? "ورود به سایت" : "Enter the site"}
              </button>
            </form>
          )}
        </div>

        {/* Owner path: CMS credentials unlock the site without the site password. */}
        <div className="mt-5">
          {!ownerOpen ? (
            <button
              type="button"
              onClick={() => setOwnerOpen(true)}
              className="mx-auto block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            >
              {fa ? "ورود مدیر" : "owner login"}
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ownerLogin();
              }}
              className="mx-auto flex max-w-xs flex-col gap-2 rounded-xl border border-border bg-[var(--surface-1)] p-4"
            >
              <p className="text-center text-[11px] text-muted-foreground">
                {fa ? "ورود با حساب CMS — بدون نیاز به رمز سایت" : "Sign in with the CMS account — no site password needed"}
              </p>
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder={fa ? "رمز مدیر" : "admin password"}
                dir="ltr"
                autoFocus
                className="h-10 rounded-lg border border-border bg-background px-3 text-center text-sm text-foreground outline-none focus:border-[var(--ai-1)]"
              />
              <input
                type="text"
                value={ownerCode}
                onChange={(e) => setOwnerCode(e.target.value)}
                placeholder={fa ? "کد ۲FA (اختیاری)" : "2FA code (optional)"}
                dir="ltr"
                inputMode="numeric"
                className="h-10 rounded-lg border border-border bg-background px-3 text-center text-sm text-foreground outline-none focus:border-[var(--ai-1)]"
              />
              <button
                type="submit"
                disabled={busy || !ownerPassword}
                className="h-10 rounded-lg border border-[var(--ai-1)]/40 bg-[var(--ai-1)]/15 text-sm font-bold text-foreground transition-colors hover:bg-[var(--ai-1)]/25 disabled:opacity-50"
              >
                {fa ? "ورود و باز کردن سایت" : "Sign in & unlock"}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`@keyframes guard-shake{0%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}100%{transform:translateX(0)}}`}</style>
    </main>
  );
}
