"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Github,
  HandHeart,
  Heart,
  Mail,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DeveloperConfig, Lang } from "@/lib/content-types";
import { cn } from "@/lib/utils";
import { useContent } from "@/lib/content-store";
import { useSuspendLenis } from "@/components/portfolio/smooth-scroll";

export const DEVELOPER_EMAIL = "mohammadmahdi.farhadianfard@gmail.com";
export const DEVELOPER_GITHUB = "https://github.com/Poorija";
export const DONATION_WALLET = "UQCEgGxRZ5A101w6RBNLwHhnva5EdK3kyDsFQcxni35DlCJf";

export function DeveloperCard({ lang, className, data }: { lang: Lang; className?: string; data?: DeveloperConfig }) {
  const [copied, setCopied] = useState(false);
  const isFa = lang === "fa";
  const stored = useContent((s) => s.content.developer);
  const developer = data ?? stored;
  const wallet = developer?.wallet || DONATION_WALLET;
  const donationLink = `ton://transfer/${wallet}?text=${encodeURIComponent("Donation to P00RIJA Portfolio")}`;

  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      toast.success(isFa ? "آدرس کیف پول کپی شد" : "Wallet address copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(isFa ? "کپی خودکار ممکن نشد" : "Could not copy automatically");
    }
  };

  return (
    <section className={cn("relative overflow-hidden rounded-3xl border border-border bg-card/55 p-5 shadow-xl backdrop-blur-xl sm:p-7", className)}>
      <div className="pointer-events-none absolute -end-20 -top-24 size-56 rounded-full bg-[var(--ai-1)]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -start-20 size-60 rounded-full bg-[var(--gfx-1)]/15 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-background/70 shadow-[0_0_30px_var(--ai-glow)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt={developer?.name || "Developer"} className="size-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-foreground">
                  {developer?.name}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                  <BadgeCheck className="size-3" /> {isFa ? "سازنده" : "CREATOR"}
                </span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {developer?.description}
              </p>
            </div>
          </div>
          <a href={developer?.licenseUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-border bg-background/65 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-[var(--sec-1)]">
            {developer?.license} <ExternalLink className="size-3.5" />
          </a>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <a href={`mailto:${developer?.email || DEVELOPER_EMAIL}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background/45 p-3 transition-colors hover:border-[var(--gfx-1)]">
            <Mail className="size-5 shrink-0 text-[var(--gfx-1)]" />
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Email</span>
              <span className="block truncate text-xs font-semibold text-foreground sm:text-sm">{developer?.email}</span>
            </span>
          </a>
          <a href={developer?.github || DEVELOPER_GITHUB} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background/45 p-3 transition-colors hover:border-[var(--ai-1)]">
            <Github className="size-5 shrink-0 text-[var(--ai-1)]" />
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">GitHub</span>
              <span className="block truncate text-sm font-semibold text-foreground">{developer?.github?.replace(/^https?:\/\//, "")}</span>
            </span>
            <ExternalLink className="ms-auto size-3.5 shrink-0 text-muted-foreground" />
          </a>
        </div>

        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <HandHeart className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{developer?.donationTitle}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {developer?.donationDescription}
                </p>
                <code className="mt-2 block break-all text-[10px] leading-4 text-muted-foreground">{wallet}</code>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={copyWallet}>
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                {isFa ? "کپی آدرس" : "Copy address"}
              </Button>
              <Button asChild size="sm" className="bg-amber-500 text-black hover:bg-amber-400">
                <a href={donationLink}>
                  <Heart className="size-4" /> {isFa ? "Donate با TON" : "Donate with TON"}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DeveloperDialog({ open, onClose, lang }: { open: boolean; onClose: () => void; lang: Lang }) {
  // Freeze the page (Lenis + body) so wheel input stays inside the dialog.
  useSuspendLenis(open);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/75 p-3 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="developer-dialog-title"
            className="relative my-auto w-full max-w-5xl"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          >
            <h2 id="developer-dialog-title" className="sr-only">
              {lang === "fa" ? "درباره سازنده" : "About the Developer"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="absolute end-3 top-3 z-20 grid size-9 place-items-center rounded-full border border-border bg-background/80 text-foreground shadow-lg backdrop-blur transition-colors hover:border-[var(--ai-1)]"
              aria-label={lang === "fa" ? "بستن" : "Close"}
            >
              <X className="size-4" />
            </button>
            <DeveloperCard lang={lang} className="mt-0 max-h-[calc(100vh-2rem)] overflow-y-auto pt-16 sm:max-h-none sm:pt-7" />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
