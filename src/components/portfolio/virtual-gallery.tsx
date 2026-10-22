"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  User,
  Briefcase,
  Tag,
} from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useSuspendLenis } from "./smooth-scroll";
import type { GalleryLayout, ProjectArtwork } from "@/lib/content-types";

interface Props {
  projects: ProjectArtwork[];
  title: string;
  subtitle: string;
  layout?: GalleryLayout;
  onClose: () => void;
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function toFaDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => FA_DIGITS[+d] ?? d);
}

const FA_ROLES: Record<string, string> = {
  "Art Director": "مدیر هنری",
  Designer: "طراح",
  "UI/UX Designer": "طراح رابط و تجربه کاربری",
  Illustrator: "تصویرساز",
  "Type Designer": "طراح تایپ",
  "3D Artist": "هنرمند سه‌بعدی",
};

function localizedRole(role: string, lang: "fa" | "en") {
  return lang === "fa" ? FA_ROLES[role] ?? role : role;
}

export function VirtualGallery({ projects, title, subtitle, layout = "cinematic", onClose }: Props) {
  const t = useContent((s) => s.t);
  const lang = useContent((s) => s.lang);
  const [active, setActive] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const portalTarget = typeof document === "undefined" ? null : document.body;

  // Rendering overlays through body keeps fixed positioning independent from
  // animated/transformed portfolio sections and their overflow clipping.
  // Lenis stays suspended while the gallery is open so the page never moves.
  useSuspendLenis(true);

  // Escape closes popup first, then the gallery. Arrow keys navigate slides.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (active !== null) setActive(null);
        else onClose();
      } else if (active === null) {
        if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % projects.length);
        else if (e.key === "ArrowLeft") setCurrent((c) => (c - 1 + projects.length) % projects.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose, projects.length]);

  if (!portalTarget) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[110] flex h-dvh w-screen flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ background: "oklch(0.06 0.015 280)" }}
    >
      {/* ambient aurora blobs (theme-matched to site) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-20 top-1/4 h-96 w-96 rounded-full opacity-30 blur-[120px]"
          style={{ background: "var(--gfx-1)" }}
        />
        <div
          className="absolute -right-20 bottom-1/4 h-96 w-96 rounded-full opacity-25 blur-[120px]"
          style={{ background: "var(--ai-1)" }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-border bg-background/60 px-4 backdrop-blur-xl md:h-[80px] md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="h-2.5 w-2.5 shrink-0 animate-pulse-glow rounded-full"
            style={{ background: "var(--gfx-1)" }}
          />
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-foreground md:text-lg">
              {title}
            </h3>
            <p className="truncate text-xs text-muted-foreground md:text-sm">
              {subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t("exitGallery")}
          className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-2 text-xs font-medium text-foreground backdrop-blur-md transition-colors hover:bg-background md:px-4 md:text-sm"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">{t("exitGallery")}</span>
        </button>
      </div>

      {/* 3D horizontal scroll — each project is a full-width/full-height slide */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden p-3 sm:p-4 md:p-6">
        {/* Floating X close button — always visible */}
        <button
          onClick={onClose}
          aria-label={t("exitGallery")}
          className="absolute left-4 top-4 z-30 grid h-12 w-12 place-items-center rounded-full border border-border bg-background/70 text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-background md:left-6 md:top-6"
        >
          <X className="h-5 w-5" />
        </button>

        {/* perspective wrapper for 3D depth */}
        <div
          className="relative mx-auto h-full w-full max-w-[1500px] overflow-hidden rounded-2xl border border-white/10 bg-black/10 shadow-2xl shadow-black/35 md:rounded-[28px]"
          style={{ perspective: "1400px", perspectiveOrigin: "50% 50%" }}
        >
          {layout !== "cinematic" && (
            <AltGalleryBody layout={layout} projects={projects} lang={lang} onOpen={(i) => setActive(i)} />
          )}
          {/* horizontal track */}
          <div
            className={`absolute inset-0 flex items-center transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${layout !== "cinematic" ? "hidden" : ""}`}
            style={{
              transform: `translateX(${lang === "fa" ? current * 100 : -current * 100}%)`,
              transformStyle: "preserve-3d",
            }}
          >
            {projects.map((p, i) => (
              <div
                key={p.title + i}
                className="relative h-full w-full shrink-0"
                style={{ transformStyle: "preserve-3d" }}
              >
                <ProjectSlide
                  project={p}
                  index={i}
                  current={current}
                  lang={lang}
                  onClick={() => setActive(i)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Edge fades */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 md:w-24"
          style={{ background: "linear-gradient(to right, oklch(0.06 0.015 280), transparent)" }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 md:w-24"
          style={{ background: "linear-gradient(to left, oklch(0.06 0.015 280), transparent)" }}
        />

        {/* Progress dots */}
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 md:bottom-8">
          {projects.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`slide ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === current ? 32 : 8,
                background: i === current ? "var(--gfx-1)" : "color-mix(in oklch, var(--gfx-1) 30%, transparent)",
              }}
            />
          ))}
        </div>

        {/* Nav arrows */}
        <button
          onClick={() => setCurrent((c) => (c - 1 + projects.length) % projects.length)}
          aria-label={lang === "fa" ? "قبلی" : "previous"}
          className="absolute left-5 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur-md transition-colors hover:bg-background md:left-8 md:h-12 md:w-12"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={() => setCurrent((c) => (c + 1) % projects.length)}
          aria-label={lang === "fa" ? "بعدی" : "next"}
          className="absolute right-5 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur-md transition-colors hover:bg-background md:right-8 md:h-12 md:w-12"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Big project popup */}
      <AnimatePresence>
        {active !== null && projects[active] && (
          <ProjectPopup
            project={projects[active]}
            lang={lang}
            onClose={() => setActive(null)}
            onPrev={() => setActive((a) => (a === null ? a : (a - 1 + projects.length) % projects.length))}
            onNext={() => setActive((a) => (a === null ? a : (a + 1) % projects.length))}
          />
        )}
      </AnimatePresence>
    </motion.div>,
    portalTarget,
  );
}

/* ============================================================
   ProjectSlide — a full-viewport 3D slide for horizontal scroll.
   Big visual on one side, project info on the other. The slide
   tilts in 3D based on its distance from the current index.
   ============================================================ */
function ProjectSlide({
  project,
  index,
  current,
  lang,
  onClick,
}: {
  project: ProjectArtwork;
  index: number;
  current: number;
  lang: "fa" | "en";
  onClick: () => void;
}) {
  const firstImage = project.images?.[0] ?? project.color;
  const isUrl = firstImage.startsWith("http") || firstImage.startsWith("/");
  const previewBg = isUrl
    ? `url(${firstImage}) center/cover`
    : `linear-gradient(135deg, ${firstImage}, color-mix(in oklch, ${project.color} 40%, black))`;

  // distance from current slide → controls 3D tilt + opacity (depth effect)
  const distance = Math.abs(index - current);
  const isActive = distance === 0;

  return (
    <div
      className="grid h-full min-h-0 w-full grid-cols-1 grid-rows-[minmax(0,1fr)_auto] items-center gap-3 px-12 py-12 sm:px-16 md:gap-5 lg:grid-cols-2 lg:grid-rows-1 lg:gap-10 lg:px-20 lg:py-10"
      style={{
        // 3D depth: active slide flat, others rotated away
        transform: `translateZ(${isActive ? 0 : -200}px) rotateY(${(index - current) * (lang === "fa" ? -25 : 25)}deg)`,
        opacity: distance > 2 ? 0 : 1 - distance * 0.15,
        transformStyle: "preserve-3d",
        transition: "transform 0.7s cubic-bezier(0.22,1,0.36,1), opacity 0.7s ease",
      }}
    >
      {/* Left: big visual */}
      <div className="relative h-full min-h-0 w-full max-w-[520px] justify-self-center overflow-hidden rounded-2xl border-2 shadow-2xl shadow-black/40 lg:max-h-[680px] lg:rounded-3xl"
        style={{ transform: "translateZ(70px) rotateX(2deg)", transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute inset-0 transition-transform duration-700"
          style={{ background: previewBg, transform: isActive ? "scale(1)" : "scale(0.92)" }}
        />
        {/* color wash */}
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ background: project.color }}
        />
        {/* category badge */}
        <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
          {project.category}
        </div>
        {/* year badge */}
        <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 font-mono text-xs text-white backdrop-blur-md">
          {project.year}
        </div>
        {/* index number */}
        <div className="absolute bottom-4 left-4 font-mono text-5xl font-black text-white/30 sm:text-6xl">
          {lang === "fa" ? toFaDigits(String(index + 1).padStart(2, "0")) : String(index + 1).padStart(2, "0")}
        </div>
        {/* glow border when active */}
        {isActive && (
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ boxShadow: `inset 0 0 60px ${project.color}40, 0 0 80px -10px ${project.color}` }}
          />
        )}
      </div>

      {/* Right: project info */}
      <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-white/10 bg-background/30 p-4 backdrop-blur-md md:p-6 lg:rounded-3xl lg:p-7"
        style={{ transform: "translateZ(35px)" }}
      >
        <div className="mb-4 flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: project.color, boxShadow: `0 0 12px ${project.color}` }}
          />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {project.category}
          </span>
        </div>

        <h3 className="text-balance text-2xl font-black leading-tight text-foreground sm:text-3xl lg:text-5xl xl:text-6xl">
          {project.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground md:text-base lg:mt-3 lg:text-lg">{project.meta}</p>

        <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-foreground/70 sm:block lg:mt-5">
          {project.description.length > 160
            ? project.description.slice(0, 160) + "…"
            : project.description}
        </p>

        {/* meta row */}
        <div className="mt-3 hidden flex-wrap gap-4 text-sm md:flex lg:mt-5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            {project.client}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            {localizedRole(project.role, lang)}
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={onClick}
          data-cursor-hover
          className="mt-4 inline-flex items-center gap-2 self-start rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-105 lg:mt-7 lg:px-6 lg:py-3"
          style={{ background: `linear-gradient(135deg, ${project.color}, color-mix(in oklch, ${project.color} 60%, black))` }}
        >
          {lang === "fa" ? "مشاهده جزئیات کامل" : "View full details"}
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ProjectPopup — large popup with image gallery + specs + desc
   ============================================================ */
function ProjectPopup({
  project,
  lang,
  onClose,
  onPrev,
  onNext,
}: {
  project: ProjectArtwork;
  lang: "fa" | "en";
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = project.images?.length ? project.images : [project.color];
  const current = images[imgIdx % images.length];
  const isUrl = current.startsWith("http") || current.startsWith("/");

  // reset image index when project changes
  useEffect(() => {
    const id = requestAnimationFrame(() => setImgIdx(0));
    return () => cancelAnimationFrame(id);
  }, [project.title]);

  // keyboard nav for image gallery
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setImgIdx((i) => (i - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") setImgIdx((i) => (i + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length]);

  return (
    <motion.div
      className="fixed inset-0 z-[120] grid h-dvh w-screen place-items-center overflow-hidden p-4 sm:p-6 lg:p-[10vh_10vw]"
      role="dialog"
      aria-modal="true"
      aria-label={project.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ background: "oklch(0.04 0.01 280 / 0.85)", backdropFilter: "blur(10px)" }}
    >
      <motion.div
        className="relative grid h-full max-h-[860px] w-full max-w-[1600px] min-h-0 grid-rows-[minmax(220px,42%)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:grid-rows-1 lg:rounded-3xl"
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          borderColor: `color-mix(in oklch, ${project.color} 35%, var(--border))`,
          boxShadow: `0 30px 100px -20px ${project.color}`,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label={t_closeLabel(lang)}
          className="absolute left-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-md transition-colors hover:bg-background"
        >
          <X className="h-5 w-5" />
        </button>

        {/* === Left: image gallery === */}
        <div className="relative min-h-0 bg-[oklch(0.1_0.02_280)]">
          {/* main image — fills full height on desktop, fixed aspect on mobile */}
          <div className="relative h-full min-h-0 w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={imgIdx}
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0"
                style={
                  isUrl
                    ? { backgroundImage: `url(${current})`, backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }
                    : { background: `linear-gradient(135deg, ${current}, color-mix(in oklch, ${project.color} 40%, black))` }
                }
              />
            </AnimatePresence>
            {/* color wash */}
            <div
              className="absolute inset-0 opacity-20 mix-blend-overlay"
              style={{ background: project.color }}
            />
          </div>

          {/* image nav arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                aria-label="previous image"
                className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                aria-label="next image"
                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              {/* counter */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/40 px-3 py-1 font-mono text-[11px] text-white backdrop-blur-md">
                {lang === "fa" ? toFaDigits(imgIdx + 1) : imgIdx + 1} / {lang === "fa" ? toFaDigits(images.length) : images.length}
              </div>
            </>
          )}

          {/* thumbnails */}
          {images.length > 1 && (
            <div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 gap-2">
              {images.map((img, i) => {
                const tIsUrl = img.startsWith("http") || img.startsWith("/");
                return (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className="h-12 w-16 overflow-hidden rounded-md border-2 transition-all"
                    style={{
                      borderColor: i === imgIdx ? project.color : "rgba(255,255,255,0.2)",
                      opacity: i === imgIdx ? 1 : 0.6,
                      background: tIsUrl
                        ? `url(${img}) center/cover`
                        : `linear-gradient(135deg, ${img}, color-mix(in oklch, ${project.color} 40%, black))`,
                    }}
                    aria-label={`image ${i + 1}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* === Right: project info === */}
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 pt-6 md:p-7 lg:p-8">
          {/* category + year */}
          <div className="mb-3 flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
              style={{ background: project.color }}
            >
              {project.category}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{project.year}</span>
          </div>

          {/* title */}
          <h3 className="text-2xl font-black text-foreground md:text-3xl">{project.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{project.meta}</p>

          {/* meta row: client / role */}
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MetaRow icon={<Briefcase className="h-3.5 w-3.5" />} label={lang === "fa" ? "کارفرما" : "Client"} value={project.client} />
            <MetaRow icon={<User className="h-3.5 w-3.5" />} label={lang === "fa" ? "نقش" : "Role"} value={localizedRole(project.role, lang)} />
          </div>

          {/* description */}
          <div className="mt-6">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {lang === "fa" ? "توضیحات پروژه" : "Project description"}
            </h4>
            <p className="text-sm leading-relaxed text-foreground/85">{project.description}</p>
          </div>

          {/* specs */}
          {project.specs?.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {lang === "fa" ? "مشخصات" : "Specifications"}
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {project.specs.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-1 px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground">{s.key}</span>
                    <span className="text-xs font-medium text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* project destinations: live app, source, GitHub, docs, etc. */}
          {(project.links?.length || project.link) && (
            <div className="mt-6 flex flex-wrap gap-2">
              {(project.links?.length ? project.links : [{ label: lang === "fa" ? "مشاهده پروژه زنده" : "View live project", url: project.link, kind: "live" as const }]).filter((item) => item.url).map((item, index) => (
                <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-1" style={{ borderColor: `color-mix(in oklch, ${project.color} 40%, transparent)` }}>
                  <ExternalLink className="h-4 w-4" style={{ color: project.color }} />
                  {item.label || item.kind}
                </a>
              ))}
            </div>
          )}

          {/* project nav (prev/next project) */}
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
            <button
              onClick={onPrev}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
              {lang === "fa" ? "پروژه قبلی" : "Previous"}
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {lang === "fa" ? "پروژه بعدی" : "Next"}
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function t_closeLabel(lang: "fa" | "en") {
  return lang === "fa" ? "بستن" : "Close";
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-1 px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}


/* ============================================================
 * Alternative gallery layouts (grid / masonry / spotlight) —
 * selectable per-section from the CMS (gallery.layout).
 * ============================================================ */

function CoverArt({ p, i }: { p: ProjectArtwork; i: number }) {
  const img = p.images?.[0];
  const isImg = !!img && /^https?:|^\/|^data:/.test(img);
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10"
      style={{
        background: isImg ? "#0b0b12" : `linear-gradient(135deg, ${p.color}, oklch(0.2 0.03 280))`,
      }}
    >
      {isImg ? (
         
        <img src={img} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-mono text-4xl font-black text-white/25">
          {String(i + 1).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}

function AltGalleryBody({
  layout,
  projects,
  lang,
  onOpen,
}: {
  layout: Exclude<GalleryLayout, "cinematic">;
  projects: ProjectArtwork[];
  lang: "fa" | "en";
  onOpen: (i: number) => void;
}) {
  if (layout === "spotlight") {
    return (
      <SpotlightBody projects={projects} lang={lang} onOpen={onOpen} />
    );
  }
  const masonry = layout === "masonry";
  return (
    <div
      className={
        masonry
          ? "h-full overflow-y-auto p-4 [column-fill:_balance] sm:columns-2 lg:columns-3 sm:gap-4 sm:p-6"
          : "grid h-full grid-cols-2 gap-3 overflow-y-auto p-4 sm:gap-4 sm:p-6 lg:grid-cols-3"
      }
    >
      {projects.map((p, i) => (
        <button
          key={p.title + i}
          onClick={() => onOpen(i)}
          data-cursor-hover
          className={
            masonry
              ? "mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-start backdrop-blur-sm transition-transform hover:scale-[1.02]"
              : "group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-start backdrop-blur-sm transition-transform hover:scale-[1.02]"
          }
        >
          <CoverArt p={p} i={i} />
          <div className="p-3.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">{p.category}</p>
            <p className="mt-1 truncate text-sm font-bold text-white">{p.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-white/50">{p.meta}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function SpotlightBody({
  projects,
  lang,
  onOpen,
}: {
  projects: ProjectArtwork[];
  lang: "fa" | "en";
  onOpen: (i: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const p = projects[Math.min(idx, projects.length - 1)];
  if (!p) return null;
  const img = p.images?.[0];
  const isImg = !!img && /^https?:|^\/|^data:/.test(img);
  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10">
        <div
          className="absolute inset-0"
          style={{ background: isImg ? "#0b0b12" : `linear-gradient(140deg, ${p.color}, oklch(0.16 0.03 280))` }}
        >
          {isImg && (
             
            <img src={img} alt={p.title} className="h-full w-full object-contain" />
          )}
        </div>
        <div className="absolute bottom-0 start-0 end-0 bg-gradient-to-t from-black/80 to-transparent p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">{p.category} · {p.year}</p>
          <p className="mt-1 text-2xl font-black text-white">{p.title}</p>
          <p className="mt-1 text-sm text-white/60">{p.meta}</p>
          <button
            onClick={() => onOpen(idx)}
            data-cursor-hover
            className="mt-3 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            {lang === "fa" ? "مشاهده‌ی جزئیات" : "View details"}
          </button>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
        {projects.map((pr, i) => (
          <button
            key={pr.title + i}
            onClick={() => setIdx(i)}
            aria-label={`item ${i + 1}`}
            className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border transition-all"
            style={{
              borderColor: i === idx ? "white" : "rgba(255,255,255,0.15)",
              opacity: i === idx ? 1 : 0.55,
            }}
          >
            <CoverArt p={pr} i={i} />
          </button>
        ))}
      </div>
    </div>
  );
}
