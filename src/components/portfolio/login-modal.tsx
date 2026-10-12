"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useSuspendLenis } from "@/components/portfolio/smooth-scroll";
import { toast } from "sonner";

export function LoginModal() {
  const authed = useContent((s) => s.authed);
  const authChecked = useContent((s) => s.authChecked);
  const login = useContent((s) => s.login);
  const lang = useContent((s) => s.lang);
  const t = useContent((s) => s.t);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [lockSecs, setLockSecs] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  // Expose opener via a custom event so the header button can trigger it.
  useEffect(() => {
    const onOpen = () => {
      if (authed) return;
      setOpen(true);
    };
    window.addEventListener("open-login", onOpen);
    return () => window.removeEventListener("open-login", onOpen);
  }, [authed]);

  // Close if authed becomes true.
  useEffect(() => {
    if (authed) {
      const id = requestAnimationFrame(() => {
        setOpen(false);
        setPassword("");
        setCode("");
        setNeedsTwoFactor(false);
        setError("");
      });
      return () => cancelAnimationFrame(id);
    }
  }, [authed]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  // countdown while the login is locked out
  useEffect(() => {
    if (lockSecs <= 0) return;
    const timer = setInterval(() => setLockSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [lockSecs]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || (needsTwoFactor && !code) || lockSecs > 0) return;
    setLoading(true);
    setError("");
    const result = await login(password, needsTwoFactor ? code : undefined);
    setLoading(false);
    if (result.status === "ok") {
      toast.success(t("login"));
    } else if (result.status === "2fa") {
      setNeedsTwoFactor(true);
      setError("");
    } else if (result.locked) {
      setLockSecs(result.retryAfterSecs ?? 180);
      setAttemptsLeft(null);
      setError(
        lang === "fa"
          ? `ورود قفل شد — ${Math.ceil((result.retryAfterSecs ?? 180) / 60)} دقیقه دیگر تلاش کنید.`
          : `Login locked — try again in ${Math.ceil((result.retryAfterSecs ?? 180) / 60)} min.`
      );
    } else {
      setAttemptsLeft(typeof result.attemptsLeft === "number" ? result.attemptsLeft : null);
      setError(
        typeof result.attemptsLeft === "number" && result.attemptsLeft > 0
          ? lang === "fa"
            ? `${t("loginError")} (${result.attemptsLeft} تلاش باقی مانده)`
            : `${t("loginError")} (${result.attemptsLeft} attempts left)`
          : t("loginError")
      );
    }
  };

  // Freeze the page (Lenis + body) while the login overlay is open.
  // (Declared before any early return — Rules of Hooks.)
  useSuspendLenis(open && !authed);

  if (!authChecked) return null;

  return (
    <AnimatePresence>
      {open && !authed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] grid place-items-center bg-background/80 p-5 backdrop-blur-md"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card p-7 shadow-2xl"
          >
            {/* glow */}
            <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
              style={{ background: "var(--ai-1)" }} />

            <button
              type="button"
              onClick={close}
              className="absolute left-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Cancel button below the form for guaranteed accessibility */}


            <div className="relative mb-6 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface-1">
                <ShieldCheck className="h-6 w-6" style={{ color: "var(--ai-1)" }} />
              </div>
              <h2 className="text-xl font-bold text-foreground">{t("loginTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("loginSubtitle")}</p>
            </div>

            <form onSubmit={submit} className="relative space-y-3">
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  style={document.dir === "rtl" ? { right: "14px" } : { left: "14px" }} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  autoFocus
                  dir="ltr"
                  disabled={lockSecs > 0}
                  className="w-full rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-foreground/40 disabled:opacity-50"
                  style={{ paddingInlineStart: "40px", paddingInlineEnd: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                  style={{ right: "10px" }}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {needsTwoFactor && (
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    style={document.dir === "rtl" ? { right: "14px" } : { left: "14px" }} />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="2FA code"
                    dir="ltr"
                    className="w-full rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm tracking-[0.3em] text-foreground outline-none transition-colors focus:border-foreground/40"
                    style={{ paddingInlineStart: "40px", paddingInlineEnd: "16px" }}
                  />
                </div>
              )}
              {lockSecs > 0 && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center font-mono text-xs text-amber-500" dir="ltr">
                  🔒 {Math.floor(lockSecs / 60)}:{String(lockSecs % 60).padStart(2, "0")}
                </p>
              )}
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || lockSecs > 0}
                className="btn-solid-neutral flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {t("loginBtn")}
              </button>
              <button
                type="button"
                onClick={close}
                className="w-full rounded-xl border border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("close")}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
