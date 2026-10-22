"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, MapPin, UserRound, Share2, Copy, Contact2, Check } from "lucide-react";
import { GithubIcon, LinkedinIcon, TwitterIcon } from "./brand-icons";
import { Reveal } from "./section-utils";
import { useContent } from "@/lib/content-store";
import { DynamicContactForm } from "./dynamic-contact-form";
import { DeveloperDialog } from "./developer-card";
import { APP_VERSION, APP_BUILD_DATE } from "@/lib/app-version";

export function SiteFooter() {
  const f = useContent((s) => s.content.footer);
  const forms = useContent((s) => s.content.forms);
  const blankCanvas = useContent((s) => s.content.builder?.blankCanvas);
  const lang = useContent((s) => s.lang);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const footerForm = forms.forms.find((form) => (form.sectionIds ?? ["footer"]).includes("footer"));
  const copy = lang === "fa"
    ? {
        suffix: "بسازیم",
      }
    : {
        suffix: "",
      };

  if (blankCanvas) return null;

  return (
    <>
    <footer
      id="contact"
      data-cursor-zone="default"
      className="section-gradient-boundary relative mt-auto overflow-hidden"
    >
      {/* transparent so the liquid aurora background flows through */}

      <div className="relative z-10 mx-auto max-w-7xl px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          {/* Left: invitation */}
          <div>
            <Reveal>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-1.5 font-mono text-xs text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                {f.badge}
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-balance text-4xl font-black leading-tight sm:text-5xl">
                {f.title}
                <br />
                <span className="text-gradient-tri">{f.highlight}</span>{copy.suffix ? ` ${copy.suffix}` : ""}
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-md text-muted-foreground">{f.description}</p>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="mt-8 flex flex-wrap gap-3">
                <SocialBtn href={`mailto:${f.email}`} icon={<Mail className="h-4 w-4" />} label={lang === "fa" ? "ایمیل" : "Email"} color="var(--gfx-1)" />
                <SocialBtn href={f.github} icon={<GithubIcon className="h-4 w-4" />} label={lang === "fa" ? "گیت‌هاب" : "GitHub"} color="var(--sec-1)" />
                <SocialBtn href={f.linkedin} icon={<LinkedinIcon className="h-4 w-4" />} label={lang === "fa" ? "لینکدین" : "LinkedIn"} color="var(--ai-1)" />
                <SocialBtn href={f.twitter} icon={<TwitterIcon className="h-4 w-4" />} label={lang === "fa" ? "توییتر" : "Twitter"} color="var(--gfx-3)" />
                <ShareBtn email={f.email} />
                <CopyEmailBtn email={f.email} />
                <VCardBtn
                  email={f.email}
                  github={f.github}
                  location={lang === "fa" ? "Tehran, Iran" : "Tehran, Iran"}
                />
              </div>
            </Reveal>

            <Reveal delay={0.4}>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {f.location}
              </div>
            </Reveal>
          </div>

          {/* Right: form */}
          {footerForm && <Reveal delay={0.2}>
            <DynamicContactForm config={forms} lang={lang} formId={footerForm.id} />
          </Reveal>}
        </div>

        {/* bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[var(--gfx-1)] via-[var(--sec-1)] to-[var(--ai-1)] text-[10px] font-bold text-white">
              M
            </span>
            {f.copyright}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => setDeveloperOpen(true)}
              className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-[var(--ai-1)]"
              data-cursor-hover
            >
              <UserRound className="size-3.5" />
              {lang === "fa" ? "درباره سازنده" : "About the Developer"}
            </button>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            <span
              className="cursor-pointer select-none font-mono transition-opacity hover:opacity-60"
              data-easter="footer-version"
              onClick={() => window.dispatchEvent(new CustomEvent("footer-version-pressed"))}
              title="v"
            >
              v{APP_VERSION} · {APP_BUILD_DATE}
            </span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            <span>
              {lang === "fa" && f.builtWith === "Designed & built with care"
                ? "با دقت طراحی و ساخته شده"
                : f.builtWith}
            </span>
          </div>
        </div>
      </div>
    </footer>
    <DeveloperDialog open={developerOpen} onClose={() => setDeveloperOpen(false)} lang={lang} />
    </>
  );
}

function SocialBtn({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-cursor-hover
      className="group flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs text-muted-foreground transition-all hover:text-foreground"
      style={{ borderColor: `color-mix(in oklch, ${color} 30%, transparent)` }}
    >
      <span style={{ color }}>{icon}</span>
      {label}
    </a>
  );
}


/* ---------- practical footer actions: share / copy email / vCard ---------- */

function ShareBtn({ email }: { email: string }) {
  const lang = useContent((s) => s.lang);
  const share = async () => {
    const url = window.location.origin;
    const data = { title: document.title, text: "P00RIJA — Graphics · Security · AI", url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        toast.success(lang === "fa" ? "لینک کپی شد" : "Link copied");
      }
    } catch {
      // user cancelled the share sheet
    }
  };
  return (
    <ActionBtn icon={<Share2 className="h-4 w-4" />} label={lang === "fa" ? "اشتراک" : "Share"} color="var(--chart-4, #38bdf8)" onClick={share} />
  );
}

function CopyEmailBtn({ email }: { email: string }) {
  const lang = useContent((s) => s.lang);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success(lang === "fa" ? "ایمیل کپی شد" : "Email copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked
    }
  };
  return (
    <ActionBtn icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} label={lang === "fa" ? "کپی ایمیل" : "Copy email"} color="var(--sec-1)" onClick={copy} />
  );
}

function VCardBtn({ email, github, location }: { email: string; github: string; location: string }) {
  const lang = useContent((s) => s.lang);
  const download = () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:P00RIJA — Graphics · Security · AI",
      "ORG:P00RIJA",
      `EMAIL:${email}`,
      `URL:${github}`,
      `ADR;TYPE=WORK:;;${location};;;;`,
      "END:VCARD",
    ].join("\n");
    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "p00rija-contact.vcf";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(lang === "fa" ? "کارت تماس دانلود شد" : "Contact card downloaded");
  };
  return (
    <ActionBtn icon={<Contact2 className="h-4 w-4" />} label={lang === "fa" ? "کارت تماس" : "vCard"} color="var(--ai-1)" onClick={download} />
  );
}

function ActionBtn({
  icon, label, color, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-cursor-hover
      className="group flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-xs text-muted-foreground transition-all hover:text-foreground"
      style={{ borderColor: `color-mix(in oklch, ${color} 30%, transparent)` }}
    >
      <span style={{ color }}>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
