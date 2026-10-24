"use client";

/* ============================================================
 * GalleryCatalog v2 — the artwork catalogue BOOK, Apple-Books
 * style: nearly full-screen pages (20% padding), and the page
 * physically follows your finger/mouse — drag a page across the
 * spine to flip it; release past the middle and it settles with
 * the same easing, release early and it slides back. Taps on the
 * page halves flip forward/back; keyboard still works; RTL
 * mirrors everything. On small screens the book shows ONE page
 * per spread (like Books on iPhone) with the same drag physics.
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
  /** overview chunk text (long descriptions paginate) */
  text?: string;
  part?: string;
};

function buildPages(p: ProjectArtwork): Page[] {
  const pages: Page[] = [];
  const hero = p.featured || p.videos?.[0]?.poster || p.images?.find((i) => /^(https?:|\/|data:)/.test(i)) || "";
  pages.push({ kind: "cover", image: hero });
  // long descriptions flow across as many overview pages as needed
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
  const [spread, setSpread] = useState(0); // left-page index (spread) OR page index (single)
  const [leaf, setLeaf] = useState<{ dir: 1 | -1; from: number; angle: number } | null>(null);
  const [smooth, setSmooth] = useState(false);
  const [single, setSingle] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x0: number; dir: 1 | -1; from: number; w: number; moved: boolean } | null>(null);
  const settleTimer = useRef<number | null>(null);

  const maxSpread = Math.max(0, single ? pages.length - 1 : Math.ceil(pages.length / 2) - 1);
  const canNext = spread < maxSpread;
  const canPrev = spread > 0;
  const accent = project.color || "var(--gfx-1)";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setSingle(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

  /* ---------------- flipping ---------------- */

  type Leaf = { dir: 1 | -1; from: number; angle: number };

  const settle = useCallback((l: Leaf, completed: boolean) => {
    setSmooth(true);
    // NEXT (dir=1): 0→180, completing commits from+1.
    // PREV (dir=-1): 180→0, completing commits from-1.
    setLeaf({ ...l, angle: completed ? (l.dir === 1 ? 180 : 0) : (l.dir === 1 ? 0 : 180) });
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (completed) setSpread(l.from + l.dir);
      setLeaf(null);
      setSmooth(false);
    }, 560);
  }, []);

  const autoFlip = useCallback((dir: 1 | -1) => {
    if (leaf) return;
    if (dir === 1 && !canNext) return;
    if (dir === -1 && !canPrev) return;
    const next: Leaf = { dir, from: spread, angle: dir === 1 ? 0 : 180 };
    setLeaf(next);
    // two frames so the leaf mounts at its start angle before easing
    requestAnimationFrame(() => requestAnimationFrame(() => settle(next, true)));
  }, [leaf, canNext, canPrev, spread, settle]);

  /* drag a page (pointer) */
  const onPointerDown = (e: React.PointerEvent) => {
    if (leaf) return;
    const rect = bookRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const half = x < rect.width / 2;
    // physical half → direction (RTL mirrored): in fa the "next" page sits on the LEFT
    const dir: 1 | -1 = fa ? (half ? 1 : -1) : (half ? -1 : 1);
    if (dir === 1 && !canNext) return;
    if (dir === -1 && !canPrev) return;
    dragRef.current = { x0: e.clientX, dir, from: spread, w: rect.width, moved: false };
    setSmooth(false);
    setLeaf({ dir, from: spread, angle: dir === 1 ? 0 : 180 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 4) d.moved = true;
    // forward drag: LTR → leftward (negative dx); RTL → rightward (positive dx)
    const raw = (fa ? dx : -dx) / d.w; // 0..1 for a full-width forward flip
    const angle = Math.max(0, Math.min(180, raw * 180 * 1.35));
    if (leaf) setLeaf({ ...leaf, angle: d.dir === 1 ? angle : 180 - angle });
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!leaf) return;
    if (!d.moved) {
      // tap → auto flip in the tapped direction
      autoFlip(d.dir);
      return;
    }
    // dir=1 completes past 82°; dir=-1 completes below 98° (its target is 0)
    settle(leaf, leaf.dir === 1 ? leaf.angle > 82 : leaf.angle < 98);
  };

  /* keyboard */
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

  /* ---------------- page rendering ---------------- */

  const paperBase = "relative flex h-full w-full flex-col overflow-hidden bg-[#f4f0e6] text-stone-900";
  const serif = "font-serif";

  const renderPage = (page: Page | undefined, pageIndex: number) => {
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
              {project.specs!.map((s, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-stone-300 pb-1.5">
                  <span className="text-[11px] text-stone-500 md:text-xs">{s.key}</span>
                  <span className="text-[11px] font-semibold md:text-xs">{s.value}</span>
                </div>
              ))}
            </div>
            {number}
          </div>
        );
      case "image":
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (page.image) setLightbox(page.image); }}
            className={cn(paperBase, "block bg-stone-100")}
            aria-label={fa ? "باز کردن تصویر" : "open image"}
          >
            <img src={page.image} alt={project.title} className="absolute inset-0 h-full w-full object-contain p-3 md:p-6" />
            <span className="absolute bottom-2 end-3 rounded-full bg-black/45 px-2.5 py-1 font-mono text-[9px] text-white/80">⤢</span>
            {number}
          </button>
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

  /* ---------------- book spread ---------------- */

  const leftIdx = spread * 2;
  const rightIdx = leftIdx + 1;
  const singleIdx = spread;
  const singleNextIdx = spread + 1;

  // leaf faces (during a flip)
  const flipFront = leaf
    ? leaf.dir === 1
      ? (single ? singleIdx : leaf.from * 2 + 1)
      : (single ? singleIdx - 1 : leaf.from * 2 + 2)
    : -1;
  const flipBack = leaf
    ? leaf.dir === 1
      ? (single ? singleNextIdx : leaf.from * 2 + 2)
      : (single ? singleIdx : leaf.from * 2 + 1)
    : -1;

  // rotation sign: LTR pages turn −Y; RTL mirrored +Y. Angle 0→180 forward.
  const rotSign = fa ? 1 : -1;
  const leafStyle: React.CSSProperties = leaf
    ? {
        [fa ? "right" : "left"]: single ? 0 : "50%",
        width: single ? "100%" : "50%",
        transformOrigin: single ? (fa ? "right center" : "left center") : (fa ? "right center" : "left center"),
        transform: `rotateY(${rotSign * leaf.dir * leaf.angle}deg)`,
        transition: smooth ? "transform 560ms cubic-bezier(0.3,0.1,0.2,1)" : "none",
      }
    : {};

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

        {/* fullscreen image viewer (click image page to open, click to close) */}
        {lightbox && (
          <div
            className="fixed inset-0 z-[60] grid cursor-zoom-out place-items-center bg-black/95 p-4"
            onClick={() => setLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt={project.title} className="max-h-full max-w-full object-contain" />
            <p className="absolute bottom-5 font-mono text-[10px] uppercase tracking-widest text-white/50">
              {fa ? "برای بستن کلیک کنید" : "click to close"}
            </p>
          </div>
        )}


      <motion.div
        initial={{ scale: 0.94, rotateX: 10, y: 24, opacity: 0 }}
        animate={{ scale: 1, rotateX: 0, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 14, opacity: 0 }}
        transition={{ type: "spring", stiffness: 230, damping: 27 }}
        className="relative flex h-full w-full flex-col"
        style={{ perspective: 1800 }}
      >
        {/* the book — near full-screen, ~20% padding handled by the outer p + max sizes */}
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
                {renderPage(pages[singleIdx], singleIdx)}
              </div>
              {leaf && (
                <div aria-hidden className="absolute inset-y-0 z-20 backface-hidden" style={leafStyle}>
                  <div className="absolute inset-0 backface-hidden" style={{ boxShadow: "0 0 40px -10px rgba(0,0,0,.5)" }}>
                    {renderPage(pages[flipFront], flipFront)}
                  </div>
                  <div className="absolute inset-0 backface-hidden" style={{ transform: `rotateY(180deg)` }}>
                    {renderPage(pages[flipBack], flipBack)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="relative h-full w-1/2" style={{ boxShadow: "inset -22px 0 30px -24px rgba(0,0,0,.4)" }}>
                {renderPage(pages[leftIdx], leftIdx)}
              </div>
              <div className="relative h-full w-1/2" style={{ boxShadow: "inset 22px 0 30px -24px rgba(0,0,0,.4)" }}>
                {renderPage(pages[rightIdx], rightIdx)}
              </div>
              {/* spine */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-12 -translate-x-1/2"
                style={{ background: "linear-gradient(to right, transparent, rgba(0,0,0,.26) 45%, rgba(0,0,0,.26) 55%, transparent)" }} />
              {leaf && (
                <div aria-hidden className="absolute inset-y-0 z-20 w-1/2 backface-hidden" style={leafStyle}>
                  <div className="absolute inset-0 backface-hidden" style={{ boxShadow: (leaf.dir === 1) === !fa ? "-16px 0 30px -14px rgba(0,0,0,.5)" : "16px 0 30px -14px rgba(0,0,0,.5)" }}>
                    {renderPage(pages[flipFront], flipFront)}
                  </div>
                  <div className="absolute inset-0 backface-hidden" style={{ transform: "rotateY(180deg)" }}>
                    {renderPage(pages[flipBack], flipBack)}
                  </div>
                </div>
              )}
            </>
          )}
          <style>{`.backface-hidden > * { backface-visibility: hidden; } .backface-hidden { transform-style: preserve-3d; }`}</style>
        </div>


        {/* controls */}
        <button type="button" onClick={onClose}
          className="absolute -top-2 end-2 grid size-10 place-items-center rounded-full border border-border bg-background text-foreground shadow-lg"
          aria-label={fa ? "بستن" : "Close"}>
          <X className="size-4" />
        </button>
        <div className="mt-3 flex shrink-0 items-center justify-center gap-3">
          <button type="button" onClick={() => autoFlip(-1)} disabled={!canPrev || !!leaf}
            className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
            aria-label={fa ? "صفحه بعد" : "previous page"}>
            {fa ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>
          <span className="rounded-full bg-black/55 px-4 py-1.5 font-mono text-xs text-white/85 backdrop-blur">
            {single
              ? `${fa ? toFa(singleIdx + 1) : singleIdx + 1} / ${fa ? toFa(pages.length) : pages.length}`
              : `${fa ? toFa(leftIdx + 1) : leftIdx + 1}–${fa ? toFa(Math.min(pages.length, rightIdx + 1)) : Math.min(pages.length, rightIdx + 1)} / ${fa ? toFa(pages.length) : pages.length}`}
          </span>
          <button type="button" onClick={() => autoFlip(1)} disabled={!canNext || !!leaf}
            className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
            aria-label={fa ? "صفحه قبل" : "next page"}>
            {fa ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
          </button>
        </div>
        <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
          {fa ? "ورق را بکشید یا روی نیمه صفحه کلیک کنید · Esc بستن" : "drag the page or tap a half · esc close"}
        </p>
      </motion.div>
    </motion.div>
  );
}
