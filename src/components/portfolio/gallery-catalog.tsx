"use client";

/* ============================================================
 * GalleryCatalog — the artwork catalogue BOOK.
 *
 * Clicking an artwork in the 3D hall opens this book: a two-page
 * spread with a real page-flip animation (a leaf rotates 180° around
 * the spine with a moving shade), keyboard + corner + button
 * navigation, RTL-aware. One artwork = one catalogue:
 *   cover · overview (description + facts) · process timeline ·
 *   specifications · one full page per image · videos · links.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase, Calendar, ChevronLeft, ChevronRight, ExternalLink, MapPin,
  Play, Tag, User, X,
} from "lucide-react";
import type { ProjectArtwork } from "@/lib/content-types";
import { cn } from "@/lib/utils";

type Page = {
  kind: "cover" | "overview" | "process" | "specs" | "image" | "videos" | "links";
  image?: string;
  video?: ProjectArtwork["videos"] extends (infer V)[] | undefined ? V : never;
};

function buildPages(p: ProjectArtwork): Page[] {
  const pages: Page[] = [];
  const hero = p.videos?.[0]?.poster || p.images?.find((i) => /^(https?:|\/|data:)/.test(i)) || "";
  pages.push({ kind: "cover", image: hero });
  pages.push({ kind: "overview" });
  if ((p.process?.length ?? 0) > 0) pages.push({ kind: "process" });
  if ((p.specs?.length ?? 0) > 0) pages.push({ kind: "specs" });
  for (const img of (p.images ?? []).filter((i) => /^(https?:|\/|data:)/.test(i)).slice(0, 6)) {
    pages.push({ kind: "image", image: img });
  }
  if ((p.videos?.length ?? 0) > 0) pages.push({ kind: "videos" });
  if ([...(p.links ?? []), ...(p.link ? [{ label: "", url: p.link, kind: "live" as const }] : [])].some((l) => l.url)) {
    pages.push({ kind: "links" });
  }
  return pages;
}

export function GalleryCatalog({
  project,
  lang,
  onClose,
}: {
  project: ProjectArtwork;
  lang: "fa" | "en";
  onClose: () => void;
}) {
  const fa = lang === "fa";
  const pages = useMemo(() => buildPages(project), [project]);
  const [spread, setSpread] = useState(0); // left page index of the spread
  const [flip, setFlip] = useState<{ dir: 1 | -1; from: number } | null>(null);
  const flipTimer = useRef<number | null>(null);
  const maxSpread = Math.max(0, Math.ceil(pages.length / 2) - 1);
  const accent = project.color || "var(--gfx-1)";

  const go = useCallback((dir: 1 | -1) => {
    if (flip) return;
    setSpread((s) => {
      const next = s + dir;
      if (next < 0 || next > maxSpread) return s;
      setFlip({ dir, from: s });
      if (flipTimer.current) window.clearTimeout(flipTimer.current);
      flipTimer.current = window.setTimeout(() => setFlip(null), 760);
      return next;
    });
  }, [flip, maxSpread]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter") go(1);
      else if (e.key === "ArrowLeft") go(fa ? 1 : -1);
      else if (e.key === "ArrowRight") go(fa ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, fa]);

  useEffect(() => () => { if (flipTimer.current) window.clearTimeout(flipTimer.current); }, []);

  /* ---------- page content renderers ---------- */

  const paperBase = "relative flex h-full w-full flex-col overflow-hidden bg-[#f4f0e6] text-stone-900";
  const serif = "font-serif";

  const renderPage = (page: Page | undefined, side: "l" | "r", pageIndex: number) => {
    if (!page) {
      return (
        <div className={cn(paperBase, "items-center justify-center")}>
          <p className={cn(serif, "text-xs italic text-stone-400")}>{fa ? "﹡" : "✦"}</p>
        </div>
      );
    }
    const number = (
      <span className="absolute bottom-2 w-full text-center font-mono text-[9px] text-stone-400">
        {fa ? toFa(pageIndex + 1) : pageIndex + 1}
      </span>
    );
    switch (page.kind) {
      case "cover":
        return (
          <div className={cn(paperBase, "justify-end")}>
            {page.image ? (
              <img src={page.image} alt={project.title} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${accent}, oklch(0.25 0.05 280))` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <div className="relative p-5 text-white">
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] opacity-80">
                {fa ? "کاتالوگ اثر" : "artwork catalogue"}
              </p>
              <h2 className={cn(serif, "mt-1 text-xl font-black leading-tight")}>{project.title}</h2>
              <p className="mt-1 font-mono text-[10px] opacity-80">{[project.category, project.year].filter(Boolean).join(" · ")}</p>
            </div>
            {number}
          </div>
        );
      case "overview":
        return (
          <div className={cn(paperBase, "p-4")}>
            <h3 className={cn(serif, "text-sm font-black")}>{fa ? "درباره اثر" : "About the work"}</h3>
            <p className="mt-2 text-justify text-[11px] leading-5 text-stone-700">{project.description || project.meta}</p>
            <div className="mt-3 space-y-1.5 text-[10px] text-stone-600">
              {project.client && <p className="flex items-center gap-1.5"><Briefcase className="size-3" />{project.client}</p>}
              {project.role && <p className="flex items-center gap-1.5"><User className="size-3" />{project.role}</p>}
              {project.location && <p className="flex items-center gap-1.5"><MapPin className="size-3" />{project.location}</p>}
              {project.dates && <p className="flex items-center gap-1.5"><Calendar className="size-3" />{project.dates}</p>}
              {project.status && <p className="flex items-center gap-1.5"><Tag className="size-3" />{project.status}</p>}
            </div>
            {(project.tags?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {project.tags!.filter(Boolean).map((t, i) => (
                  <span key={i} className="rounded-full bg-stone-200 px-2 py-0.5 text-[9px] text-stone-600">#{t}</span>
                ))}
              </div>
            )}
            {number}
          </div>
        );
      case "process":
        return (
          <div className={cn(paperBase, "p-4")}>
            <h3 className={cn(serif, "text-sm font-black")}>{fa ? "روند پروژه" : "Process"}</h3>
            <ol className="relative mt-3 space-y-2.5 border-s border-stone-300 ps-3">
              {project.process!.filter((m) => m?.title).map((m, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[17px] top-1 size-2 rounded-full" style={{ background: accent }} />
                  <p className="text-[10px] font-bold">{m.title}
                    {m.date && <span className="ms-1.5 font-mono text-[8px] font-normal text-stone-400">{m.date}</span>}
                  </p>
                  {m.description && <p className="mt-0.5 text-[9px] leading-4 text-stone-600">{m.description}</p>}
                </li>
              ))}
            </ol>
            {number}
          </div>
        );
      case "specs":
        return (
          <div className={cn(paperBase, "p-4")}>
            <h3 className={cn(serif, "text-sm font-black")}>{fa ? "مشخصات" : "Specifications"}</h3>
            <div className="mt-3 space-y-1">
              {project.specs!.map((s, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 border-b border-dashed border-stone-300 pb-1">
                  <span className="text-[10px] text-stone-500">{s.key}</span>
                  <span className="text-[10px] font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
            {number}
          </div>
        );
      case "image":
        return (
          <div className={cn(paperBase, "bg-stone-100")}>
            <img src={page.image} alt={project.title} className="absolute inset-0 h-full w-full object-contain p-2" />
            {number}
          </div>
        );
      case "videos":
        return (
          <div className={cn(paperBase, "p-3")}>
            <h3 className={cn(serif, "text-sm font-black")}>{fa ? "ویدیوها" : "Videos"}</h3>
            <div className="mt-2 space-y-2">
              {project.videos!.filter((v) => v?.url).map((v, i) => (
                <figure key={i}>
                  <video controls preload="metadata" poster={v.poster || undefined} src={v.url} className="max-h-44 w-full rounded bg-black object-contain" />
                  {v.label && <figcaption className="mt-0.5 flex items-center gap-1 text-[9px] text-stone-500"><Play className="size-2.5" />{v.label}</figcaption>}
                </figure>
              ))}
            </div>
            {number}
          </div>
        );
      case "links":
        return (
          <div className={cn(paperBase, "p-4")}>
            <h3 className={cn(serif, "text-sm font-black")}>{fa ? "مشاهده بیشتر" : "Explore more"}</h3>
            <div className="mt-3 space-y-2">
              {(project.links ?? []).filter((l) => l?.url).map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-[10px] font-semibold text-stone-700 transition-colors hover:bg-stone-100">
                  <ExternalLink className="size-3" style={{ color: accent }} />{l.label || l.url}
                </a>
              ))}
            </div>
            <p className={cn(serif, "absolute bottom-6 w-full text-center text-[10px] italic text-stone-400")}>
              {fa ? "پایان کاتالوگ" : "— fin —"}
            </p>
            {number}
          </div>
        );
    }
  };

  /* ---------- flip book mechanics ---------- */

  const leftIdx = spread * 2;
  const rightIdx = leftIdx + 1;
  // The flipping leaf: front = the page leaving, back = the page arriving.
  const flipFrontIdx = flip ? (flip.dir === 1 ? flip.from * 2 + 1 : flip.from * 2 + 2) : 0;
  const flipBackIdx = flip ? (flip.dir === 1 ? flip.from * 2 + 2 : flip.from * 2 + 1) : 0;
  const flipping = flip !== null;
  // In RTL the book opens from the right: mirror origins/rotations.
  const dirSign = fa ? 1 : -1; // rotation sign for "next"

  return (
    <motion.div
      data-gallery-catalog
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label={fa ? `کاتالوگ ${project.title}` : `${project.title} catalogue`}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <motion.div
        initial={{ scale: 0.9, rotateX: 12, y: 30, opacity: 0 }}
        animate={{ scale: 1, rotateX: 0, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="relative"
        style={{ perspective: 1600 }}
      >
        {/* the book */}
        <div
          className="relative flex h-[62vh] max-h-[560px] w-[min(92vw,760px)] overflow-hidden rounded-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]"
          style={{ background: "#efe9dc", transformStyle: "preserve-3d" }}
        >
          {/* left page */}
          <div className="relative h-full w-1/2" style={{ boxShadow: "inset -18px 0 24px -20px rgba(0,0,0,.35)" }}>
            {renderPage(pages[leftIdx], "l", leftIdx)}
          </div>
          {/* right page */}
          <div className="relative h-full w-1/2" style={{ boxShadow: "inset 18px 0 24px -20px rgba(0,0,0,.35)" }}>
            {renderPage(pages[rightIdx], "r", rightIdx)}
          </div>

          {/* spine */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-10 -translate-x-1/2"
            style={{ background: "linear-gradient(to right, transparent, rgba(0,0,0,.22) 45%, rgba(0,0,0,.22) 55%, transparent)" }} />

          {/* flipping leaf */}
          {flipping && (
            <div
              aria-hidden
              className="absolute inset-y-0 z-20 w-1/2"
              style={{
                [fa ? "right" : "left"]: "50%",
                transformOrigin: fa ? "right center" : "left center",
                transformStyle: "preserve-3d",
                animation: `catalog-flip-${fa ? "rtl" : "ltr"}-${flip!.dir === 1 ? "next" : "prev"} 720ms cubic-bezier(0.35,0.15,0.25,1) forwards`,
              }}
            >
              {/* front face (visible at start) */}
              <div className="absolute inset-0 backface-hidden" style={{ boxShadow: flip!.dir === 1 ? "-14px 0 24px -12px rgba(0,0,0,.45)" : "14px 0 24px -12px rgba(0,0,0,.45)" }}>
                {renderPage(pages[flipFrontIdx], "r", flipFrontIdx)}
              </div>
              {/* back face (visible at end) */}
              <div className="absolute inset-0 backface-hidden" style={{ transform: "rotateY(180deg)" }}>
                {renderPage(pages[flipBackIdx], "l", flipBackIdx)}
              </div>
            </div>
          )}

          <style>{`
            .backface-hidden { backface-visibility: hidden; }
            @keyframes catalog-flip-ltr-next { from { transform: rotateY(0) } to { transform: rotateY(-180deg) } }
            @keyframes catalog-flip-ltr-prev { from { transform: rotateY(180deg) } to { transform: rotateY(360deg) } }
            @keyframes catalog-flip-rtl-next { from { transform: rotateY(0) } to { transform: rotateY(180deg) } }
            @keyframes catalog-flip-rtl-prev { from { transform: rotateY(-180deg) } to { transform: rotateY(-360deg) } }
          `}</style>
        </div>

        {/* controls */}
        <button type="button" onClick={onClose}
          className="absolute -top-3 end-0 grid size-9 place-items-center rounded-full border border-border bg-background text-foreground shadow-lg"
          aria-label={fa ? "بستن" : "Close"}>
          <X className="size-4" />
        </button>
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(-1)} disabled={spread === 0 || flipping}
            className="grid size-10 place-items-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
            aria-label={fa ? "صفحه بعد" : "previous page"}>
            {fa ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>
          <span className="rounded-full bg-black/50 px-4 py-1.5 font-mono text-[11px] text-white/85 backdrop-blur">
            {fa ? toFa(spread * 2 + 1) : spread * 2 + 1}–{fa ? toFa(Math.min(pages.length, spread * 2 + 2)) : Math.min(pages.length, spread * 2 + 2)} / {fa ? toFa(pages.length) : pages.length}
          </span>
          <button type="button" onClick={() => go(1)} disabled={spread >= maxSpread || flipping}
            className="grid size-10 place-items-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
            aria-label={fa ? "صفحه قبل" : "next page"}>
            {fa ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
          </button>
        </div>
        <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-white/40">
          {fa ? "کلید ← → ورق می‌زند · Esc می‌بندد" : "← → flip · esc close"}
        </p>
      </motion.div>
    </motion.div>
  );
}

function toFa(n: number): string {
  const d = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (x) => d[+x]);
}
