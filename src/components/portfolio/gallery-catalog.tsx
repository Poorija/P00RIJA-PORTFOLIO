"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, Images, Play, X } from "lucide-react";
import type { ProjectArtwork } from "@/lib/content-types";
import { cn } from "@/lib/utils";
import { buildBookPages } from "./book/page-model";
import { RealisticBook, type BookViewState } from "./book/realistic-book";
import { OrbitalLoader } from "./orbital-loader";
import { useDialogFocus } from "./use-dialog-focus";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (value: number) => String(value).replace(/\d/g, (digit) => FA_DIGITS[+digit]);

export function GalleryCatalog({ project, lang, onClose }: { project: ProjectArtwork; lang: "fa" | "en"; onClose: () => void }) {
  const fa = lang === "fa";
  const pages = useMemo(() => buildBookPages(project), [project]);
  const mountRef = useRef<HTMLDivElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const bookRef = useRef<RealisticBook | null>(null);
  const dragRef = useRef<{ id: number; x: number } | null>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const [view, setView] = useState<BookViewState>({ spread: 0, maxSpread: Math.max(0, Math.ceil(pages.length / 2) - 1), single: false, busy: false });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [mediaPanel, setMediaPanel] = useState<"images" | "videos" | "links" | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setReady(false);
    setError(false);
    try {
      const book = new RealisticBook({
        mount,
        pages,
        project,
        lang,
        coarse: window.matchMedia("(pointer: coarse)").matches,
        reducedMotion,
        onStateChange: setView,
      });
      bookRef.current = book;
      setReady(true);
      return () => {
        book.dispose();
        bookRef.current = null;
      };
    } catch {
      setError(true);
    }
  }, [pages, project, lang, reducedMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (lightbox) setLightbox(null);
        else if (mediaPanel) setMediaPanel(null);
        else onClose();
        return;
      }
      const target = event.target;
      const interactive = target instanceof Element && Boolean(target.closest("button, a, input, textarea, select, [contenteditable='true'], [role='button']"));
      if (!lightbox && !mediaPanel && !interactive) {
        if (event.key === "Enter") bookRef.current?.autoFlip(1);
        else if (event.key === "ArrowLeft") bookRef.current?.autoFlip(fa ? 1 : -1);
        else if (event.key === "ArrowRight") bookRef.current?.autoFlip(fa ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fa, lightbox, mediaPanel, onClose]);

  type BookPointerEvent = React.PointerEvent<HTMLDivElement> | PointerEvent;
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const mount = mountRef.current;
    const rect = mount?.getBoundingClientRect();
    if (!mount || !rect) return;
    const leftHalf = event.clientX - rect.left < rect.width / 2;
    const dir: 1 | -1 = fa ? (leftHalf ? 1 : -1) : (leftHalf ? -1 : 1);
    if (!bookRef.current?.beginDrag(dir, rect.width / 2)) return;
    event.preventDefault();
    dragRef.current = { id: event.pointerId, x: event.clientX };
    try {
      mount.setPointerCapture(event.pointerId);
    } catch {
    }
  };
  const onPointerMove = (event: BookPointerEvent) => {
    if (dragRef.current?.id !== event.pointerId) return;
    bookRef.current?.dragMove(event.clientX - dragRef.current.x);
  };
  const onPointerUp = (event: BookPointerEvent) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    bookRef.current?.endDrag();
  };
  const onPointerCancel = (event: BookPointerEvent) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    bookRef.current?.cancelDrag();
  };

  useEffect(() => {
    const cancel = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      bookRef.current?.cancelDrag();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", cancel);
    };
  }, []);

  const links = [...(project.links ?? []), ...(project.link ? [{ label: fa ? "مشاهده پروژه" : "View project", url: project.link, kind: "live" as const }] : [])].filter((link) => link.url);
  const images = (project.images ?? []).filter((image) => /^(https?:|\/|data:)/.test(image));
  const videos = (project.videos ?? []).filter((video) => video.url);
  const leftPage = view.spread * 2 + 1;
  const rightPage = Math.min(pages.length, view.spread * 2 + 2);
  const counter = view.single
    ? `${fa ? toFa(view.spread + 1) : view.spread + 1} / ${fa ? toFa(pages.length) : pages.length}`
    : `${fa ? toFa(leftPage) : leftPage}–${fa ? toFa(rightPage) : rightPage} / ${fa ? toFa(pages.length) : pages.length}`;

  return (
    <motion.div
      ref={dialogRef}
      data-gallery-catalog
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 md:p-[2vh_2vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.28 }}
      role="dialog"
      aria-modal="true"
      aria-label={fa ? `کتاب ${project.title}` : `${project.title} book`}
    >
      <div className="absolute inset-0 bg-[#01040a]/90 backdrop-blur-xl" onClick={onClose} aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(45,90,125,.16),transparent_55%)]" />
      <motion.div
        initial={{ scale: 0.96, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.97, y: 12, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        className="relative flex h-full w-full max-w-[1700px] flex-col"
      >
        <div className="relative z-20 mb-2 flex shrink-0 items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-3">
            <BookOpen className="size-4 shrink-0 text-cyan-200/70" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{project.title}</p>
              <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-cyan-100/40">{fa ? "کتاب دیجیتال آرشیو" : "Digital archive book"}</p>
            </div>
          </div>
          <button type="button" autoFocus onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white shadow-lg transition hover:bg-white/10" aria-label={fa ? "بستن" : "Close"}><X className="size-4" /></button>
        </div>

        <div
          ref={mountRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerUp}
          className="relative min-h-0 flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
          role="document"
          aria-label={fa ? "صفحه را بکشید تا ورق بخورد" : "Drag a page to turn it"}
        />
        {!ready && !error && <OrbitalLoader lang={lang} label={fa ? "آماده‌سازی صفحات کتاب سه‌بعدی…" : "Preparing the three-dimensional book…"} className="pointer-events-none z-10 bg-transparent" />}
        {error && (
          <div className="absolute inset-0 z-10 grid place-items-center p-6">
            <div className="max-h-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#f1ebdf] p-8 text-stone-800 shadow-2xl">
              <h2 className="text-2xl font-black">{project.title}</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-7">{project.description || project.meta}</p>
              <p className="mt-4 text-xs text-stone-500">{fa ? "نسخهٔ سه‌بعدی در این مرورگر در دسترس نیست." : "The 3D edition is unavailable in this browser."}</p>
            </div>
          </div>
        )}

        <div className="relative z-20 mt-2 flex shrink-0 flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-xl">
            <button type="button" onClick={() => bookRef.current?.autoFlip(-1)} disabled={view.busy || view.spread <= 0} className="grid size-9 place-items-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-25" aria-label={fa ? "صفحه قبل" : "Previous page"}>{fa ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}</button>
            <span className="min-w-20 text-center font-mono text-[10px] text-white/70">{counter}</span>
            <button type="button" onClick={() => bookRef.current?.autoFlip(1)} disabled={view.busy || view.spread >= view.maxSpread} className="grid size-9 place-items-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-25" aria-label={fa ? "صفحه بعد" : "Next page"}>{fa ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}</button>
          </div>
          {images.length > 0 && <button type="button" onClick={() => setMediaPanel(mediaPanel === "images" ? null : "images")} className={cn("flex h-11 items-center gap-2 rounded-full border px-3 text-[11px] text-white/75 backdrop-blur-xl", mediaPanel === "images" ? "border-cyan-200/35 bg-cyan-200/10" : "border-white/10 bg-black/40")} aria-label={fa ? "تصاویر پروژه" : "Project images"}><Images className="size-4" /><span className="hidden sm:inline">{fa ? "تصاویر" : "Images"}</span></button>}
          {videos.length > 0 && <button type="button" onClick={() => setMediaPanel(mediaPanel === "videos" ? null : "videos")} className={cn("flex h-11 items-center gap-2 rounded-full border px-3 text-[11px] text-white/75 backdrop-blur-xl", mediaPanel === "videos" ? "border-cyan-200/35 bg-cyan-200/10" : "border-white/10 bg-black/40")} aria-label={fa ? "ویدیوهای پروژه" : "Project videos"}><Play className="size-4" /><span className="hidden sm:inline">{fa ? "ویدیو" : "Videos"}</span></button>}
          {links.length > 0 && <button type="button" onClick={() => setMediaPanel(mediaPanel === "links" ? null : "links")} className={cn("flex h-11 items-center gap-2 rounded-full border px-3 text-[11px] text-white/75 backdrop-blur-xl", mediaPanel === "links" ? "border-cyan-200/35 bg-cyan-200/10" : "border-white/10 bg-black/40")} aria-label={fa ? "لینک‌های پروژه" : "Project links"}><ExternalLink className="size-4" /><span className="hidden sm:inline">{fa ? "لینک‌ها" : "Links"}</span></button>}
        </div>
        <p className="relative z-20 mt-1 text-center font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">{fa ? "کشیدن برگ · کلیدهای جهت‌دار · ESC بستن" : "Drag pages · Arrow keys · Esc to close"}</p>

        <AnimatePresence>
          {mediaPanel && (
            <motion.aside
              initial={{ opacity: 0, x: fa ? -30 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: fa ? -30 : 30 }}
              className="absolute bottom-16 end-0 top-14 z-30 w-[min(90vw,390px)] overflow-y-auto rounded-2xl border border-cyan-100/15 bg-[#07111c]/95 p-4 shadow-2xl backdrop-blur-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{mediaPanel === "images" ? (fa ? "تصاویر پروژه" : "Project images") : mediaPanel === "videos" ? (fa ? "ویدیوهای پروژه" : "Project videos") : (fa ? "لینک‌های پروژه" : "Project links")}</h3>
                <button type="button" onClick={() => setMediaPanel(null)} className="grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10" aria-label={fa ? "بستن پنل" : "Close panel"}><X className="size-4" /></button>
              </div>
              {mediaPanel === "images" && <div className="grid grid-cols-2 gap-2">{images.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setLightbox(image)} className="overflow-hidden rounded-lg border border-white/10 bg-black/30 transition hover:border-cyan-200/40"><img src={image} alt={`${project.title} ${index + 1}`} className="aspect-[4/3] h-full w-full object-cover" /></button>)}</div>}
              {mediaPanel === "videos" && <div className="space-y-4">{videos.map((video, index) => <figure key={`${video.url}-${index}`}><video controls preload="metadata" poster={video.poster || undefined} src={video.url} className="w-full rounded-lg bg-black" />{video.label && <figcaption className="mt-2 text-xs text-white/55">{video.label}</figcaption>}</figure>)}</div>}
              {mediaPanel === "links" && <div className="space-y-2">{links.map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80 transition hover:border-cyan-200/30 hover:bg-cyan-200/5"><ExternalLink className="size-4 shrink-0 text-cyan-300" /><span className="break-all">{link.label || link.url}</span></a>)}</div>}
            </motion.aside>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[160] grid cursor-zoom-out place-items-center bg-black/95 p-4" onClick={() => setLightbox(null)}>
            <img src={lightbox} alt={project.title} className="max-h-full max-w-full object-contain" />
            <button type="button" className="absolute end-4 top-4 grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white" aria-label={fa ? "بستن تصویر" : "Close image"}><X className="size-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
