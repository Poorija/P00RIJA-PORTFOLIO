"use client";

/* ============================================================
 * GalleryCatalog v3 — the artwork catalogue BOOK, Apple-Books
 * style: near full-screen, and the page physically follows your
 * finger/mouse in BOTH directions (next AND previous), with real
 * book physics:
 *
 *   • leaf = one physical page: front = recto, back = verso
 *   • NEXT: leaf starts on the right (rot 0) and rotates to the
 *     left (rot 180); reveals the next spread beneath
 *   • PREV: leaf starts on the left (rot 180) and rotates back to
 *     the right (rot 0)
 *   • drag drives `progress` 0..1 continuously; release past the
 *     middle settles with easing, early release slides back
 *   • tap on either half / arrow keys / buttons flip fully
 *   • single-page mode on phones (same engine, width 100%)
 *
 * Static halves during a flip show the ARRIVING pages (like a real
 * book: the page revealed under the lifting leaf).
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
  text?: string;
  part?: string;
};

function buildPages(p: ProjectArtwork): Page[] {
  const pages: Page[] = [];
  const hero = p.featured || p.videos?.[0]?.poster || p.images?.find((i) => /^(https?:|\/|data:)/.test(i)) || "";
  pages.push({ kind: "cover", image: hero });
  const desc = (p.description || p.meta || "").trim();
  const CHUNK = 620;
  const chunks: string[] = [];
  for (let i = 0; i < desc.length && chunks.length < 4; i += CHUNK) chunks.push(desc.slice(i, i + CHUNK));
  if (chunks.length === 0) chunks.push("");
  chunks.forEach((_, i) => pages.push({ kind: "overview", text: chunks[i], part: chunks.length > 1 ? `${i + 1}/${chunks.length}` : "" }));
  if ((p.process?.length ?? 0) > 0) pages.push({ kind: "process" });
  if ((p.specs?.length ?? 0) > 0) pages.push({ kind: "specs" });
  for (const img of (p.images ?? []).filter((i) => /^(https?:|\/|data:)/.test(i)).slice(0, 12)) {
    pages.push({ kind: "image", image: img });
  }
  if ((p.videos?.length ?? 0) > 0) pages.push({ kind: "videos" });
  if ([...(p.links ?? []), ...(p.link ? [{ label: "", url: p.link, kind: "live" as const }] : [])].some((l) => l.url)) {
    pages.push({ kind: "links" });
  }
  return pages;
}

function toFa(n: number): string {
  const d = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (x) => d[+x]);
}

interface Flip {
  dir: 1 | -1;
  from: number;
  progress: number; // 0 = leaf on its origin side, 1 = fully landed
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
  const [spread, setSpread] = useState(0);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [smooth, setSmooth] = useState(false);
  const [single, setSingle] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x0: number; dir: 1 | -1; from: number; half: number; moved: boolean } | null>(null);
  const animRef = useRef<number | null>(null);
  const flipRef = useRef<Flip | null>(null);
  useEffect(() => { flipRef.current = flip; }, [flip]);
  const settleTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
  }, []);

  const maxSpread = single ? pages.length - 1 : Math.max(0, Math.ceil(pages.length / 2) - 1);
  const canNext = spread < maxSpread && !flip;
  const canPrev = spread > 0 && !flip;
  const accent = project.color || "var(--gfx-1)";

  /* ---------------- commit ---------------- */

  const commit = useCallback((f: Flip, completed: boolean) => {
    setSmooth(true);
    setFlip({ ...f, progress: completed ? 1 : 0 });
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (completed) setSpread(f.from + f.dir);
      setFlip(null);
      setSmooth(false);
    }, 520);
  }, []);

  /** animated full flip (buttons / keyboard / tap) */
  const animateFlip = useCallback((f: Flip) => {
    const t0 = performance.now();
    const D = 600;
    const start = f.progress;
    const target = f.dir === 1 ? 1 : 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setFlip({ ...f, progress: start + (target - start) * eased });
      if (k < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        commit(f, true);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, [commit]);

  const autoFlip = useCallback((dir: 1 | -1) => {
    if (flipRef.current) return;
    if (dir === 1 && spread >= maxSpread) return;
    if (dir === -1 && spread <= 0) return;
    setSmooth(false);
    animateFlip({ dir, from: spread, progress: dir === 1 ? 0 : 1 });
  }, [spread, maxSpread, animateFlip]);

  /* ---------------- pointer drag (both directions) ---------------- */

  const onPointerDown = (e: React.PointerEvent) => {
    if (flipRef.current) return;
    const rect = bookRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const half = x < rect.width / 2;
    // LTR: right half = next, left half = prev. RTL mirrored.
    const dir: 1 | -1 = fa ? (half ? 1 : -1) : (half ? -1 : 1);
    if (dir === 1 && spread >= maxSpread) return;
    if (dir === -1 && spread <= 0) return;
    dragRef.current = { x0: e.clientX, dir, from: spread, half: rect.width / 2, moved: false };
    setSmooth(false);
    // mount the leaf at its resting pose for this direction
    setFlip({ dir, from: spread, progress: dir === 1 ? 0 : 1 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const l = flipRef.current;
    if (!d || !l || l.from !== d.from) return;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 4) d.moved = true;
    // forward-drag sign in screen space: LTR next = leftward (−), RTL next = rightward (+)
    const sign = (d.dir === 1) === !fa ? -1 : 1;
    const progress = Math.max(0, Math.min(1, (dx * sign) / d.half + (d.dir === 1 ? 0 : 1)));
    setFlip({ ...l, progress });
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    const l = flipRef.current;
    if (!d || !l) return;
    if (!d.moved) {
      // tap → full animated flip in the tapped direction
      animateFlip({ dir: d.dir, from: d.from, progress: d.dir === 1 ? 0 : 1 });
      return;
    }
    const completed = d.dir === 1 ? l.progress > 0.45 : l.progress < 0.55;
    commit(l, completed);
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter") autoFlip(1);
      else if (e.key === "ArrowLeft") autoFlip(fa ? 1 : -1);
      else if (e.key === "ArrowRight") autoFlip(fa ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoFlip, onClose, fa]);

  /* ---------------- page renderers ---------------- */

  const paperBase = "relative flex h-full w-full flex-col overflow-hidden bg-[#f4f0e6] text-stone-900";
  const serif = "font-serif";

  const renderPage = (page: Page | undefined, pageIndex: number, clickable = true) => {
    if (!page) {
      return (
        <div className={cn(paperBase, "items-center justify-center bg-[#efe9dc]")}>
          <p className={cn(serif, "text-xs italic text-stone-400")}>✦</p>
        </div>
      );
    }
    const number = (
      <span className="absolute bottom-2 z-10 w-full text-center font-mono text-[10px] text-stone-400">
        {fa ? toFa(pageIndex + 1) : pageIndex + 1}
      </span>
    );
    switch (page.kind) {
      case "cover":
        return (
          <div className={cn(paperBase, "justify-end")}>
            {page.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.image} alt={project.title} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${accent}, oklch(0.3 0.06 290))` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            <div className="relative p-6 text-white md:p-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] opacity-80 md:text-xs">
                {fa ? "کاتالوگ اثر" : "artwork catalogue"}
              </p>
              <h2 className={cn(serif, "mt-2 text-2xl font-black leading-tight md:text-4xl")}>{project.title}</h2>
              <p className="mt-2 font-mono text-xs opacity-80 md:text-sm">{[project.category, project.year].filter(Boolean).join(" · ")}</p>
            </div>
            {number}
          </div>
        );
      case "overview":
        return (
          <div className={cn(paperBase, "p-5 md:p-8")}>
            <h3 className={cn(serif, "text-base font-black md:text-xl")}>{fa ? "درباره اثر" : "About the work"}</h3>
            <p className="mt-3 text-justify text-xs leading-6 text-stone-700 md:text-sm md:leading-7">{page.text ?? project.description ?? project.meta}</p>
            {page.part && <p className="mt-1 font-mono text-[9px] text-stone-400">{page.part}</p>}
            <div className="mt-4 space-y-2 text-[11px] text-stone-600 md:text-xs">
              {project.client && <p className="flex items-center gap-2"><Briefcase className="size-3.5" />{project.client}</p>}
              {project.role && <p className="flex items-center gap-2"><User className="size-3.5" />{project.role}</p>}
              {project.location && <p className="flex items-center gap-2"><MapPin className="size-3.5" />{project.location}</p>}
              {project.dates && <p className="flex items-center gap-2"><Calendar className="size-3.5" />{project.dates}</p>}
              {project.status && <p className="flex items-center gap-2"><Tag className="size-3.5" />{project.status}</p>}
            </div>
            {(project.tags?.length ?? 0) > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {project.tags!.filter(Boolean).map((t, i) => (
                  <span key={i} className="rounded-full bg-stone-200 px-2.5 py-0.5 text-[10px] text-stone-600">#{t}</span>
                ))}
              </div>
            )}
            {number}
          </div>
        );
      case "process":
        return (
          <div className={cn(paperBase, "p-5 md:p-8")}>
            <h3 className={cn(serif, "text-base font-black md:text-xl")}>{fa ? "روند پروژه" : "Process"}</h3>
            <ol className="relative mt-4 space-y-3 border-s border-stone-300 ps-4 md:space-y-4">
              {project.process!.filter((m) => m?.title).map((m, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[22px] top-1.5 size-2.5 rounded-full" style={{ background: accent }} />
                  <p className="text-xs font-bold md:text-sm">{m.title}
                    {m.date && <span className="ms-2 font-mono text-[10px] font-normal text-stone-400">{m.date}</span>}
                  </p>
                  {m.description && <p className="mt-1 text-[11px] leading-5 text-stone-600 md:text-xs">{m.description}</p>}
                </li>
              ))}
            </ol>
            {number}
          </div>
        );
      case "specs":
        return (
          <div className={cn(paperBase, "p-5 md:p-8")}>
            <h3 className={cn(serif, "text-base font-black md:text-xl")}>{fa ? "مشخصات" : "Specifications"}</h3>
            <div className="mt-4 space-y-2">
              {project.specs!.map((sp, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-stone-300 pb-1.5">
                  <span className="text-[11px] text-stone-500 md:text-xs">{sp.key}</span>
                  <span className="text-[11px] font-semibold md:text-xs">{sp.value}</span>
                </div>
              ))}
            </div>
            {number}
          </div>
        );
      case "image":
        return clickable ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (page.image) setLightbox(page.image); }}
            className={cn(paperBase, "block bg-stone-100")}
            aria-label={fa ? "باز کردن تصویر" : "open image"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.image} alt={project.title} className="absolute inset-0 h-full w-full object-contain p-3 md:p-6" />
            <span className="absolute bottom-2 end-3 rounded-full bg-black/45 px-2.5 py-1 font-mono text-[9px] text-white/80">⤢</span>
            {number}
          </button>
        ) : (
          <div className={cn(paperBase, "bg-stone-100")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.image} alt={project.title} className="absolute inset-0 h-full w-full object-contain p-3 md:p-6" />
            {number}
          </div>
        );
      case "videos":
        return (
          <div className={cn(paperBase, "p-5 md:p-8")}>
            <h3 className={cn(serif, "text-base font-black md:text-xl")}>{fa ? "ویدیوها" : "Videos"}</h3>
            <div className="mt-4 space-y-4">
              {project.videos!.filter((v) => v?.url).map((v, i) => (
                <figure key={i}>
                  <video controls preload="metadata" poster={v.poster || undefined} src={v.url} className="max-h-[50vh] w-full rounded-lg bg-black object-contain" />
                  {v.label && <figcaption className="mt-1 flex items-center gap-1.5 text-[11px] text-stone-500"><Play className="size-3" />{v.label}</figcaption>}
                </figure>
              ))}
            </div>
            {number}
          </div>
        );
      case "links":
        return (
          <div className={cn(paperBase, "p-5 md:p-8")}>
            <h3 className={cn(serif, "text-base font-black md:text-xl")}>{fa ? "مشاهده بیشتر" : "Explore more"}</h3>
            <div className="mt-4 space-y-3">
              {(project.links ?? []).filter((l) => l?.url).map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-stone-300 px-4 py-3 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 md:text-sm">
                  <ExternalLink className="size-4" style={{ color: accent }} />{l.label || l.url}
                </a>
              ))}
            </div>
            <p className={cn(serif, "absolute bottom-8 w-full text-center text-xs italic text-stone-400")}>
              {fa ? "پایان کاتالوگ" : "— fin —"}
            </p>
            {number}
          </div>
        );
    }
  };

  /* ---------------- spread composition ---------------- */

  // At rest: spread S shows pages [2S, 2S+1]. During a flip the static
  // halves show the ARRIVING pages (what the real book reveals under the
  // lifting leaf) and the leaf carries the moving pair:
  //   NEXT: leaf front = 2S+1 (recto), back = 2S+2 (verso)
  //   PREV: leaf front = 2S−1 (recto), back = 2S   (verso)
  let leftIdx: number, rightIdx: number, leafFrontIdx = -1, leafBackIdx = -1;
  if (flip) {
    if (flip.dir === 1) {
      leftIdx = flip.from * 2;          // current left (gets covered by the leaf)
      rightIdx = flip.from * 2 + 3;     // revealed under the lifting leaf
      leafFrontIdx = flip.from * 2 + 1;
      leafBackIdx = flip.from * 2 + 2;
    } else {
      leftIdx = (flip.from - 1) * 2;    // revealed under the lifting leaf
      rightIdx = flip.from * 2 + 1;     // current right (gets covered)
      leafFrontIdx = flip.from * 2 - 1;
      leafBackIdx = flip.from * 2;
    }
  } else {
    leftIdx = spread * 2;
    rightIdx = spread * 2 + 1;
  }

  const safe = (i: number) => (i >= 0 && i < pages.length ? pages[i] : undefined);

  // rotation: NEXT progress 0→180 (right→left), PREV progress 1→0 mapped as
  // (1−progress)·180 → 180→0 … unified: rot = progress·180 for next,
  // (1−progress)·180 for prev. LTR renders rotateY(−rot), RTL +rot.
  const rot = flip ? (flip.dir === 1 ? flip.progress : 1 - flip.progress) * 180 : 0;
  const leafStyle: React.CSSProperties = flip
    ? {
        [fa ? "right" : "left"]: single ? 0 : "50%",
        width: single ? "100%" : "50%",
        transformOrigin: fa ? "right center" : "left center",
        transform: `rotateY(${fa ? rot : -rot}deg)`,
        transition: smooth ? "transform 520ms cubic-bezier(0.3,0.1,0.2,1)" : "none",
      }
    : {};

  const pageCounter = single
    ? `${fa ? toFa(spread + 1) : spread + 1} / ${fa ? toFa(pages.length) : pages.length}`
    : `${fa ? toFa(leftIdx + 1) : leftIdx + 1}–${fa ? toFa(Math.min(pages.length, rightIdx + 1)) : Math.min(pages.length, rightIdx + 1)} / ${fa ? toFa(pages.length) : pages.length}`;

  return (
    <motion.div
      data-gallery-catalog
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 md:p-[10%]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label={fa ? `کاتالوگ ${project.title}` : `${project.title} catalogue`}
    >
      <div className="absolute inset-0 bg-black/85" onClick={onClose} aria-hidden />

      <motion.div
        initial={{ scale: 0.94, rotateX: 10, y: 24, opacity: 0 }}
        animate={{ scale: 1, rotateX: 0, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 14, opacity: 0 }}
        transition={{ type: "spring", stiffness: 230, damping: 27 }}
        className="relative flex h-full w-full flex-col"
        style={{ perspective: 1800 }}
      >
        <div
          ref={bookRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="relative flex h-full w-full touch-none select-none overflow-hidden rounded-2xl shadow-[0_50px_120px_-25px_rgba(0,0,0,0.9)]"
          style={{ background: "#efe9dc", transformStyle: "preserve-3d", cursor: "grab" }}
        >
          {single ? (
            <>
              <div className="relative h-full w-full" style={{ boxShadow: "inset 0 0 60px -30px rgba(0,0,0,.35)" }}>
                {renderPage(
                  flip ? safe(flip.dir === 1 ? flip.from + 1 : flip.from - 1) : safe(spread),
                  flip ? (flip.dir === 1 ? flip.from + 1 : flip.from - 1) : spread,
                  false
                )}
              </div>
              {flip && (
                <div aria-hidden className="absolute inset-y-0 z-20" style={leafStyle}>
                  <div className="absolute inset-0 backface-hidden" style={{ boxShadow: "0 0 40px -10px rgba(0,0,0,.5)" }}>
                    {renderPage(safe(flip.dir === 1 ? flip.from : flip.from - 1), flip.dir === 1 ? flip.from : flip.from - 1, false)}
                  </div>
                  <div className="absolute inset-0 backface-hidden" style={{ transform: "rotateY(180deg)" }}>
                    {renderPage(safe(flip.dir === 1 ? flip.from + 1 : flip.from), flip.dir === 1 ? flip.from + 1 : flip.from, false)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="relative h-full w-1/2" style={{ boxShadow: "inset -22px 0 30px -24px rgba(0,0,0,.4)" }}>
                {renderPage(safe(leftIdx), leftIdx, !flip)}
              </div>
              <div className="relative h-full w-1/2" style={{ boxShadow: "inset 22px 0 30px -24px rgba(0,0,0,.4)" }}>
                {renderPage(safe(rightIdx), rightIdx, !flip)}
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-12 -translate-x-1/2"
                style={{ background: "linear-gradient(to right, transparent, rgba(0,0,0,.26) 45%, rgba(0,0,0,.26) 55%, transparent)" }} />
              {flip && (
                <div aria-hidden className="absolute inset-y-0 z-20 w-1/2" style={leafStyle}>
                  <div className="absolute inset-0 backface-hidden" style={{ boxShadow: "-16px 0 30px -14px rgba(0,0,0,.5)" }}>
                    {renderPage(safe(leafFrontIdx), leafFrontIdx, false)}
                  </div>
                  <div className="absolute inset-0 backface-hidden" style={{ transform: "rotateY(180deg)" }}>
                    {renderPage(safe(leafBackIdx), leafBackIdx, false)}
                  </div>
                </div>
              )}
            </>
          )}
          <style>{`.backface-hidden > * { backface-visibility: hidden; } .backface-hidden { transform-style: preserve-3d; }`}</style>
        </div>

        <button type="button" onClick={onClose}
          className="absolute -top-2 end-2 grid size-10 place-items-center rounded-full border border-border bg-background text-foreground shadow-lg"
          aria-label={fa ? "بستن" : "Close"}>
          <X className="size-4" />
        </button>
        <div className="mt-3 flex shrink-0 items-center justify-center gap-3">
          <button type="button" onClick={() => autoFlip(-1)} disabled={!canPrev}
            className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
            aria-label={fa ? "صفحه بعد" : "previous page"}>
            {fa ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>
          <span className="rounded-full bg-black/55 px-4 py-1.5 font-mono text-xs text-white/85 backdrop-blur">{pageCounter}</span>
          <button type="button" onClick={() => autoFlip(1)} disabled={!canNext}
            className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
            aria-label={fa ? "صفحه قبل" : "next page"}>
            {fa ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
          </button>
        </div>
        <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
          {fa ? "ورق را بکشید (هر دو جهت) · Esc بستن" : "drag the page either way · esc close"}
        </p>
      </motion.div>

      {/* fullscreen image viewer */}
      {lightbox && (
        <div className="fixed inset-0 z-[160] grid cursor-zoom-out place-items-center bg-black/95 p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt={project.title} className="max-h-full max-w-full object-contain" />
          <p className="absolute bottom-5 font-mono text-[10px] uppercase tracking-widest text-white/50">
            {fa ? "برای بستن کلیک کنید" : "click to close"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
