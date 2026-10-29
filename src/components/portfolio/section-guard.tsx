"use client";

/* ============================================================
 * SectionGuard — the visitor-facing side of the Access Guard.
 *
 * GuardShell wraps a home-page section (or the footer). While the
 * target is locked it renders the section's template content behind
 * a heavy blur with an accessible lock overlay on top; the real CMS
 * content is already withheld server-side, so the blur is only the
 * visual teaser. The unlock dialog matches the site's space theme
 * (gradient border card, mono labels, glowing lock badge) and
 * supports 4/6-digit PINs (input-otp) and text passwords.
 *
 * Attempt semantics come from the server:
 *   mode "permanent"  → unlimited tries (rate-limited per IP)
 *   mode "attempts"   → N wrong tries DISABLE the target globally
 * ============================================================ */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Lock, ShieldAlert, ShieldCheck, X } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useContent, type GuardLockInfo } from "@/lib/content-store";
import { normalizeDigits } from "@/lib/persian-digits";
import { riskyPaintEnv } from "@/lib/pointer-env";
import { cn } from "@/lib/utils";

function isLockedFor(lock: GuardLockInfo | undefined, unlocked: string[], loaded: boolean): boolean {
  if (!loaded || !lock) return false;
  return Boolean(lock.enabled && lock.hasPassword !== false && !unlocked.includes(lock.target));
}

/* ---------------- unlock dialog (shared by sections + galleries) ---------------- */

export function GuardUnlockDialog({
  lock,
  label,
  onClose,
  onUnlocked,
}: {
  lock: GuardLockInfo;
  label: string;
  onClose: () => void;
  /** Fires when the password was accepted (before close). */
  onUnlocked?: () => void;
}) {
  const lang = useContent((s) => s.lang);
  const unlockGuard = useContent((s) => s.unlockGuard);
  const [pin, setPin] = useState("");
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [justDisabled, setJustDisabled] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const isPin = lock.kind === "pin4" || lock.kind === "pin6";
  const pinLength = lock.kind === "pin6" ? 6 : 4;
  const fa = lang === "fa";

  useEffect(() => {
    inputRef.current?.focus?.();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const remainingAfterFail = (remaining: number | undefined): number | null => {
    if (lock.mode !== "attempts") return null;
    if (typeof remaining === "number" && remaining >= 0) return remaining;
    return Math.max(0, lock.maxAttempts - lock.failedAttempts);
  };

  const submit = async (password: string) => {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    const result = await unlockGuard(lock.target, password);
    setBusy(false);
    if (result.status === "ok") {
      onUnlocked?.();
      onClose();
      return;
    }
    setShakeKey((k) => k + 1);
    if (result.status === "disabled") {
      setJustDisabled(true);
      setError(fa ? "قفل پس از تلاش‌های ناموفق غیرفعال شد." : "This lock was disabled after too many wrong attempts.");
      return;
    }
    if (result.status === "rate") {
      setError(fa ? "تلاش‌های شما زیاد بود — یک دقیقه صبر کنید." : "Too many attempts — wait a minute.");
      return;
    }
    if (result.status === "blocked") {
      setJustDisabled(false);
      setError(fa
        ? "دسترسی شما توسط مدیر سایت قطع شده است."
        : "Your access has been revoked by the site owner.");
      return;
    }
    const left = remainingAfterFail(result.remaining);
    setError(
      left === null
        ? fa ? "رمز اشتباه است." : "Wrong password."
        : fa
          ? `رمز اشتباه است — ${left} تلاش باقی مانده.`
          : `Wrong password — ${left} attempt${left === 1 ? "" : "s"} left.`
    );
    setPin("");
    setText("");
  };

  // iOS WebKit (incl. iPadOS, which reports a desktop UA) and touch-primary
  // devices composite backdrop-filter overlays over filtered content
  // unreliably — the whole fixed layer can silently paint as nothing. There
  // the backdrop stays SOLID; the glass look is kept for fine-pointer
  // desktops only.
  const glassBackdrop = !riskyPaintEnv();

  // Portal to <body>: section shells animate with transform/opacity, and a
  // transformed ancestor becomes the containing block for fixed-position
  // descendants on WebKit — the dialog can end up positioned (and clipped)
  // inside its section instead of the viewport. Body-level rendering also
  // keeps the z-[140] order honest against the other body-level portals.
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      data-guard-dialog
      // Mobile: top-aligned with breathing room so the on-screen keyboard
      // never covers the PIN input (the dialog stays above the keyplane).
      className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto p-4 pt-[10vh] sm:items-center sm:pt-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label={fa ? "بازکردن بخش قفل‌شده" : "Unlock protected section"}
    >
      {/* Solid backdrop on risky-paint environments; blurred glass from sm up
          on fine-pointer desktops. */}
      <div
        className={cn("absolute inset-0 bg-background/95", glassBackdrop && "sm:bg-background/85 sm:backdrop-blur-md")}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-[var(--surface-1)] shadow-2xl"
      >
        {/* gradient hairline */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--sec-1), var(--ai-1), transparent)" }}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 z-10 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
          aria-label={fa ? "بستن" : "Close"}
        >
          <X className="size-4" />
        </button>

        <div className="px-6 pb-6 pt-9 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full border border-[var(--sec-1)]/40 bg-[var(--sec-1)]/10">
            {justDisabled ? (
              <ShieldAlert className="size-6 text-amber-400" />
            ) : (
              <Lock className="size-6 text-[var(--sec-1)]" />
            )}
          </div>
          <h3 className="text-lg font-black text-foreground">
            {fa ? "این بخش قفل است" : "This section is locked"}
          </h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {label}
            <span className="mx-1 opacity-50">·</span>
            <span className="font-mono uppercase tracking-wider">
              {lock.kind === "pin4" ? (fa ? "رمز ۴ رقمی" : "4-digit PIN")
                : lock.kind === "pin6" ? (fa ? "رمز ۶ رقمی" : "6-digit PIN")
                : fa ? "رمز متنی" : "password"}
            </span>
          </p>

          {lock.disabled || justDisabled ? (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/[.07] px-4 py-3 text-xs leading-6 text-amber-300">
              {fa
                ? "این قفل به دلیل تلاش‌های ناموفق زیاد غیرفعال شده است. برای فعال‌سازی مجدد با مدیر سایت تماس بگیرید."
                : "This lock was disabled after too many wrong attempts. Contact the site owner to re-enable it."}
            </div>
          ) : (
            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(isPin ? pin : text);
              }}
            >
              <motion.div
                key={shakeKey}
                animate={shakeKey ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
                transition={{ duration: 0.4 }}
                className="flex justify-center"
                ref={inputRef}
                tabIndex={-1}
              >
                {isPin ? (
                  <InputOTP
                    maxLength={pinLength}
                    value={pin}
                    onChange={(v) => {
                      // Persian keyboards emit ۰-۹ — normalize to ASCII so
                      // the PIN matches what the server stored.
                      const norm = normalizeDigits(v);
                      setPin(norm);
                      setError(null);
                      if (norm.length === pinLength) void submit(norm);
                    }}
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  >
                    <InputOTPGroup>
                      {Array.from({ length: pinLength }).map((_, i) => (
                        <Fragment key={i}>
                          {i !== 0 && pinLength === 6 && i === 3 ? <InputOTPSeparator /> : null}
                          <InputOTPSlot index={i} className="size-11 border-border bg-background text-base font-bold text-foreground" />
                        </Fragment>
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                ) : (
                  <div className="relative w-full">
                    <input
                      type={showText ? "text" : "password"}
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        setError(null);
                      }}
                      autoFocus
                      autoComplete="current-password"
                      dir="ltr"
                      placeholder={fa ? "رمز عبور" : "password"}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 pe-11 text-center text-base text-foreground outline-none transition-colors focus:border-[var(--sec-1)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowText((v) => !v)}
                      className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                      aria-label={showText ? (fa ? "پنهان" : "Hide") : fa ? "نمایش" : "Show"}
                    >
                      {showText ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                )}
              </motion.div>

              <div className="min-h-5 pt-2 text-[11px] leading-5 text-red-400" aria-live="polite">
                {error ?? ""}
              </div>

              <button
                type="submit"
                disabled={busy || (isPin ? pin.length !== pinLength : !text)}
                className={cn(
                  "mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
                  "border border-[var(--sec-1)]/40 bg-[var(--sec-1)]/15 text-foreground hover:bg-[var(--sec-1)]/25",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {busy ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
                ) : (
                  <ShieldCheck className="size-4 text-[var(--sec-1)]" />
                )}
                {fa ? "باز کردن بخش" : "Unlock section"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

/* ---------------- shell ---------------- */

/* Section accent for the mobile locked teaser (keeps the skeleton in the
 * section's own color world; falls back to the primary accent). */
const SECTION_ACCENTS: Record<string, string> = {
  hero: "var(--gfx-1)",
  graphics: "var(--gfx-1)",
  security: "var(--sec-1)",
  ai: "var(--ai-1)",
  timeline: "var(--gfx-3, var(--gfx-1))",
  synthesis: "var(--ai-3, var(--ai-1))",
  footer: "var(--sec-1)",
};

export function SectionGuardShell({
  target,
  label,
  children,
}: {
  target: string;
  label?: string;
  children: React.ReactNode;
}) {
  const lang = useContent((s) => s.lang);
  const lock = useContent((s) => s.guardSections[target]);
  const unlocked = useContent((s) => s.guardUnlocked);
  const guardLoaded = useContent((s) => s.guardLoaded);
  const viewportWidth = useContent((s) => s.viewportWidth);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Paint-risk env is stable for the session; captured once (the dialog only
  // ever opens after user interaction, so this never affects SSR hydration).
  const [riskyPaint] = useState(riskyPaintEnv);
  const fa = lang === "fa";

  // Hooks must run regardless of lock state; compute the lock after.
  const locked = isLockedFor(lock, unlocked, guardLoaded);
  // MOBILE: blurring the real section (full-bleed filter over live WebGL
  // loops) exhausted iOS GPU memory and Safari killed the tab (blank page
  // the moment a locked section entered the viewport). Locked sections on
  // small screens therefore render a lightweight SKELETON teaser instead —
  // the real children (and their 3D canvases) are not mounted at all until
  // the visitor unlocks. Desktop keeps the original blur preview.
  const isMobile = viewportWidth > 0 && viewportWidth < 768;

  const displayLabel = useMemo(
    () => label || lock?.target || target,
    [label, lock?.target, target]
  );

  // Always render the wrapper (even unlocked) so the exit-relock
  // IntersectionObserver in GuardActivityWatcher has a stable element with
  // data-guard-target to watch for every section/footer.
  if (!locked) {
    return <div data-guard-target={target}>{children}</div>;
  }

  const disabled = Boolean(lock?.disabled);
  const remaining = lock?.mode === "attempts"
    ? Math.max(0, lock.maxAttempts - lock.failedAttempts)
    : null;

  const accent = SECTION_ACCENTS[target] ?? "var(--primary)";

  const lockOverlay = (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/35 p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="grid size-12 place-items-center rounded-full border border-border bg-background/80 shadow-lg backdrop-blur">
          <Lock className="size-5 text-[var(--sec-1)]" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          {fa ? "بخش محافظت‌شده" : "protected section"}
        </p>
        <h3 className="text-base font-black text-foreground md:text-lg">{displayLabel}</h3>
        {disabled ? (
          <p className="text-xs leading-6 text-amber-300">
            {fa
              ? "این قفل پس از تلاش‌های ناموفق غیرفعال شده است."
              : "This lock is disabled after too many wrong attempts."}
          </p>
        ) : (
          <>
            <p className="text-xs leading-6 text-muted-foreground">
              {fa
                ? "برای مشاهده این بخش، رمز عبور را وارد کنید."
                : "Enter the password to reveal this section."}
            </p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={cn(
                "mt-1 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition-all",
                "border-[var(--sec-1)]/40 bg-background/80 text-foreground backdrop-blur",
                "hover:border-[var(--sec-1)] hover:bg-[var(--sec-1)]/15"
              )}
            >
              <Lock className="size-4 text-[var(--sec-1)]" />
              {fa ? "ورود با رمز" : "Enter password"}
            </button>
            {remaining !== null && lock && lock.failedAttempts > 0 && (
              <p className="font-mono text-[10px] text-muted-foreground/80">
                {fa
                  ? `${remaining} تلاش باقی مانده`
                  : `${remaining} attempt${remaining === 1 ? "" : "s"} remaining`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── mobile: skeleton teaser (NO real children mounted → no WebGL, no
  //    blur filter). Everything is IN FLOW — no absolutely-positioned
  //    overlay, no backdrop-filter: both are unreliable to paint on iOS
  //    WebKit inside scroll containers (overlay rendered half-cut away
  //    from its section and vanished when scrolled into view) ──────────
  if (isMobile) {
    return (
      <div
        data-guard-target={target}
        className="flex min-h-[440px] flex-col items-center justify-center gap-3 px-6 py-14 text-center"
        style={{
          background:
            `radial-gradient(120% 90% at 20% 0%, color-mix(in oklch, ${accent} 16%, transparent), transparent 60%),` +
            `radial-gradient(100% 80% at 90% 100%, color-mix(in oklch, ${accent} 10%, transparent), transparent 55%)`,
        }}
      >
        <div className="grid size-12 place-items-center rounded-full border border-border bg-background shadow-lg">
          <Lock className="size-5 text-[var(--sec-1)]" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          {fa ? "بخش محافظت‌شده" : "protected section"}
        </p>
        <h3 className="text-base font-black text-foreground">{displayLabel}</h3>
        {disabled ? (
          <p className="max-w-xs text-xs leading-6 text-amber-300">
            {fa
              ? "این قفل پس از تلاش‌های ناموفق غیرفعال شده است."
              : "This lock is disabled after too many wrong attempts."}
          </p>
        ) : (
          <>
            <p className="max-w-xs text-xs leading-6 text-muted-foreground">
              {fa
                ? "برای مشاهده این بخش، رمز عبور را وارد کنید."
                : "Enter the password to reveal this section."}
            </p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={cn(
                "mt-1 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition-all",
                "border-[var(--sec-1)]/40 bg-background text-foreground",
                "hover:border-[var(--sec-1)] hover:bg-[var(--sec-1)]/15"
              )}
            >
              <Lock className="size-4 text-[var(--sec-1)]" />
              {fa ? "ورود با رمز" : "Enter password"}
            </button>
            {remaining !== null && lock && lock.failedAttempts > 0 && (
              <p className="font-mono text-[10px] text-muted-foreground/80">
                {fa
                  ? `${remaining} تلاش باقی مانده`
                  : `${remaining} attempt${remaining === 1 ? "" : "s"} remaining`}
              </p>
            )}
          </>
        )}
        <AnimatePresence>
          {dialogOpen && lock && (
            <GuardUnlockDialog lock={lock} label={displayLabel} onClose={() => setDialogOpen(false)} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative" data-guard-target={target}>
      {riskyPaint && dialogOpen ? (
        // iPadOS/iOS WebKit: a live WebGL canvas behind an 18px blur while a
        // fixed overlay opens is the exact compositing stack that made phones
        // kill the tab (v3.3.3) — while the dialog is open, unmount the real
        // children and show a calm static placeholder instead.
        <div
          inert
          aria-hidden
          className="min-h-[420px]"
          style={{
            background:
              `radial-gradient(120% 90% at 20% 0%, color-mix(in oklch, ${accent} 14%, transparent), transparent 60%),` +
              `radial-gradient(100% 80% at 90% 100%, color-mix(in oklch, ${accent} 10%, transparent), transparent 55%)`,
          }}
        />
      ) : (
        <div
          inert
          aria-hidden
          className="pointer-events-none select-none [&_*]:!pointer-events-none"
          style={{ filter: "blur(18px) saturate(1.15)", opacity: 0.75 }}
        >
          {children}
        </div>
      )}
      {lockOverlay}
      <AnimatePresence>
        {dialogOpen && lock && (
          <GuardUnlockDialog lock={lock} label={displayLabel} onClose={() => setDialogOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- gallery gate ----------------
 * Galleries are popups opened on demand, so instead of a blur shell the
 * gate intercepts the OPEN action: while the `gallery:<sectionId>` lock
 * is active, clicking a gallery button shows the unlock dialog first;
 * after a successful unlock (which refetches the content with the
 * previously-stripped gallery data) the popup opens as usual.
 * Every section that has a gallery (graphics/security/ai/custom-*)
 * gets its OWN independent lock. */

export function useGalleryGate(sectionId: string, label: string) {
  const lang = useContent((s) => s.lang);
  const lock = useContent((s) => s.guardSections[`gallery:${sectionId}`]);
  const unlocked = useContent((s) => s.guardUnlocked);
  const guardLoaded = useContent((s) => s.guardLoaded);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingOpen = useRef<(() => void) | null>(null);

  const locked = isLockedFor(lock, unlocked, guardLoaded);

  /** Wrap a gallery-open action: passes through when unlocked. */
  const gate = (open: () => void) => {
    if (!locked) {
      open();
      return;
    }
    pendingOpen.current = open;
    setDialogOpen(true);
  };

  const fa = lang === "fa";
  const displayLabel = `${fa ? "گالری" : "Gallery"} — ${label}`;

  /** Exit re-lock: call from the gallery popup's onClose — when the
   *  "relock on exit" policy is armed, closing the popup withdraws the
   *  unlock (cookie deleted + data re-stripped client-side). */
  const onPopupClose = () => {
    const store = useContent.getState();
    if (lock?.relockOnExit && store.guardUnlocked.includes(lock.target)) {
      void store.relockGuards([lock.target]);
    }
  };

  const node = (
    <AnimatePresence>
      {dialogOpen && lock && (
        <GuardUnlockDialog
          lock={lock}
          label={displayLabel}
          onClose={() => setDialogOpen(false)}
          onUnlocked={() => {
            const open = pendingOpen.current;
            pendingOpen.current = null;
            if (open) setTimeout(open, 120);
          }}
        />
      )}
    </AnimatePresence>
  );

  return { gate, node, lock, locked, onPopupClose };
}
