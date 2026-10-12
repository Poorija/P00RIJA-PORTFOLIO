"use client";

/* ==================================================================
 * ProfileModal — opened by clicking the central sun ("this sun is me").
 * Shows the CMS-managed `profile` section: avatar, bio, skills with
 * animated bars, facts, socials, languages — plus a résumé download
 * button (file served from /api/uploads/<id>).
 * ================================================================== */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, MapPin, Download, Globe, Github, Linkedin, Sparkles, BadgeCheck, Orbit, Check } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useSuspendLenis } from "@/components/portfolio/smooth-scroll";
import type { ProfileConfig, ProfileSocial } from "@/lib/content-types";

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  github: Github,
  linkedin: Linkedin,
  mail: Mail,
  globe: Globe,
};

const fade = (c: string, pct = 50) => `color-mix(in oklch, ${c} ${100 - pct}%, transparent)`;

export function ProfileModal() {
  const profile = useContent((s) => s.content.profile);
  const lang = useContent((s) => s.lang);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      if (profile?.enabled === false) return;
      setOpen(true);
    };
    window.addEventListener("open-profile", handler);
    return () => window.removeEventListener("open-profile", handler);
  }, [profile?.enabled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Freeze the page (Lenis + body) so wheel input never scrolls the background.
  useSuspendLenis(open);

  return (
    <AnimatePresence>
      {open && profile && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-background/85 backdrop-blur-md" onClick={() => setOpen(false)} />

          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 210, damping: 24 }}
            className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card/80 shadow-2xl backdrop-blur-2xl sm:max-h-[92vh] sm:rounded-3xl"
          >
            {/* close */}
            <button
              onClick={() => setOpen(false)}
              data-cursor-hover
              aria-label="close"
              className="absolute end-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {/* sun-glow header — NO overflow-hidden so text flows naturally */}
            <div className="relative border-b border-border px-5 pb-4 pt-10 text-center sm:px-6 sm:pb-6 sm:pt-8">
              <div
                className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-60"
                style={{ background: "radial-gradient(ellipse at center, oklch(0.85 0.16 60 / 0.35), transparent 70%)" }}
              />
              <div className="relative mx-auto grid place-items-center">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="h-16 w-16 rounded-full border-2 object-cover sm:h-24 sm:w-24"
                    style={{ borderColor: "var(--gfx-1)", boxShadow: "0 0 40px var(--gfx-glow)" }}
                  />
                ) : (
                  <SunAvatar name={profile.name} />
                )}
                <h2 className="mt-3 text-xl font-black leading-tight text-foreground sm:mt-4 sm:text-2xl md:text-3xl">{profile.name}</h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed sm:text-sm" style={{ color: "var(--sec-1)" }}>{profile.role}</p>
                <p className="mt-2 max-w-md text-xs italic leading-relaxed text-muted-foreground sm:text-sm">“{profile.tagline}”</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  {profile.availability && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-3 py-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                      {profile.availability}
                    </span>
                  )}
                  {profile.location && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/50 px-3 py-1">
                      <MapPin className="h-3 w-3" /> {profile.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6" data-lenis-prevent>
              {/* stats */}
              {profile.stats.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {profile.stats.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                      className="rounded-2xl border border-border bg-background/40 p-3 text-center"
                    >
                      <div className="text-xl font-black text-foreground">{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* bio */}
              {profile.bio && (
                <div className="mt-6">
                  <SectionTitle icon={<Sparkles className="h-3.5 w-3.5" />} lang={lang} fa="درباره من" en="About me" />
                  <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                    {profile.bio.split("\n").filter(Boolean).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </div>
              )}

              {profile.projectDescription && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="relative mt-6 overflow-hidden rounded-3xl border border-border bg-background/45 p-5"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-50"
                    style={{ background: "radial-gradient(circle at 10% 0%, var(--gfx-glow), transparent 42%), radial-gradient(circle at 90% 100%, var(--ai-glow), transparent 46%)" }}
                  />
                  <div className="relative">
                    <SectionTitle icon={<Orbit className="h-3.5 w-3.5" />} lang={lang} fa="درباره برنامه" en="About the application" />
                    <h3 className="mt-3 text-lg font-black text-foreground">{profile.projectTitle}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{profile.projectDescription}</p>
                    {profile.projectFeatures?.length > 0 && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        {profile.projectFeatures.map((feature, index) => (
                          <motion.div
                            key={`${feature}-${index}`}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.24 + index * 0.06 }}
                            className="flex items-start gap-2 rounded-2xl border border-border bg-card/55 p-3 text-xs leading-5 text-foreground"
                          >
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--sec-1)" }} />
                            {feature}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* skills */}
              {profile.skills.length > 0 && (
                <div className="mt-6">
                  <SectionTitle icon={<BadgeCheck className="h-3.5 w-3.5" />} lang={lang} fa="مهارت‌ها" en="Skills" />
                  <div className="mt-3 space-y-2.5">
                    {profile.skills.map((skill, i) => (
                      <div key={skill.id}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{skill.label}</span>
                          <span className="font-mono text-muted-foreground">{skill.level}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(to right, ${fade(skill.color, 30)}, ${skill.color})` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(Math.max(skill.level, 0), 100)}%` }}
                            transition={{ delay: 0.15 + i * 0.07, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* facts + languages */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {profile.facts.length > 0 && (
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {lang === "fa" ? "در یک نگاه" : "At a glance"}
                    </p>
                    <dl className="space-y-2">
                      {profile.facts.map((f) => (
                        <div key={f.id} className="flex items-center justify-between gap-3 text-xs">
                          <dt className="text-muted-foreground">{f.key}</dt>
                          <dd className="font-bold text-foreground">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                {profile.languages.length > 0 && (
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {lang === "fa" ? "زبان‌ها" : "Languages"}
                    </p>
                    <div className="space-y-2">
                      {profile.languages.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-foreground">{l.name}</span>
                          <span className="text-muted-foreground">{l.level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* socials */}
              {profile.socials.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {profile.socials.map((s) => (
                    <SocialButton key={s.id} social={s} />
                  ))}
                </div>
              )}
            </div>

            {/* resume footer */}
            <div className="border-t border-border bg-background/50 px-6 py-4">
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="text-center sm:text-start">
                  <p className="text-sm font-bold text-foreground">{profile.resumeLabel}</p>
                  <p className="text-[11px] text-muted-foreground">{profile.resumeHint}</p>
                </div>
                {profile.resumeUrl ? (
                  <motion.a
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    href={`${profile.resumeUrl}${profile.resumeUrl.startsWith("/api/uploads/") ? "?download=1" : ""}`}
                    data-cursor-hover
                    onClick={() => window.dispatchEvent(new CustomEvent("achieve", { detail: "resume-downloader" }))}
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.95 0.15 60), oklch(0.8 0.19 40))",
                      color: "oklch(0.2 0.05 40)",
                      boxShadow: "0 6px 30px -6px oklch(0.8 0.19 40 / 0.5)",
                    }}
                  >
                    <Download className="h-4 w-4" />
                    {profile.resumeLabel}
                  </motion.a>
                ) : (
                  <span className="rounded-full border border-dashed border-border px-6 py-3 text-xs text-muted-foreground">
                    {lang === "fa" ? "رزومه هنوز آپلود نشده — از CMS آپلود کنید" : "Résumé not uploaded yet — upload from CMS"}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionTitle({ icon, lang, fa, en }: { icon: React.ReactNode; lang: "fa" | "en"; fa: string; en: string }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
      <span style={{ color: "var(--sec-1)" }}>{icon}</span>
      {lang === "fa" ? fa : en}
    </p>
  );
}

function SocialButton({ social }: { social: ProfileSocial }) {
  const Icon = SOCIAL_ICONS[social.icon] ?? Globe;
  return (
    <a
      href={social.url}
      target={social.url.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      data-cursor-hover
      className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {social.label}
    </a>
  );
}

/** Default avatar — a mini glowing sun with the first letter. */
function SunAvatar({ name }: { name: string }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 4, repeat: Infinity }}
      className="relative grid h-24 w-24 place-items-center rounded-full"
      style={{
        background: "radial-gradient(circle at 35% 35%, oklch(0.98 0.08 85), oklch(0.88 0.16 55) 45%, oklch(0.7 0.2 35))",
        boxShadow: "0 0 50px oklch(0.85 0.16 55 / 0.6), 0 0 100px oklch(0.8 0.15 40 / 0.35)",
      }}
    >
      <span className="text-3xl font-black text-white/90 drop-shadow">{(name || "?").trim().charAt(0)}</span>
    </motion.div>
  );
}

/** Type re-export guard so ProfileConfig stays referenced for future forms. */
export type { ProfileConfig };
