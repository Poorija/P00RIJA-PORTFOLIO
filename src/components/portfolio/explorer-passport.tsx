"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Compass, Download, MapPin, Rocket, Share2, Sparkles, Trophy, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useContent } from "@/lib/content-store";
import { resolveExplorerChapters } from "@/lib/experience";
import type { ExplorerConfig } from "@/lib/content-types";

const STORAGE_KEY = "p00rija-explorer-journey-v1";
const ICONS: Record<string, LucideIcon> = { rocket: Rocket, sparkles: Sparkles, compass: Compass, map: MapPin, timeline: ArrowLeft, trophy: Trophy };

type SavedJourney = { visited: string[]; seconds: number };

function readJourney(): SavedJourney {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as { visited?: unknown; seconds?: unknown };
    return {
      visited: Array.isArray(parsed.visited) ? parsed.visited.filter((id): id is string => typeof id === "string") : [],
      seconds: typeof parsed.seconds === "number" && Number.isFinite(parsed.seconds) ? Math.max(0, Math.floor(parsed.seconds)) : 0,
    };
  } catch {
    return { visited: [], seconds: 0 };
  }
}

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

async function createPassport({ config, lang, visited, total, seconds, achievements }: { config: ExplorerConfig; lang: "fa" | "en"; visited: number; total: number; seconds: number; achievements: number }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const background = context.createLinearGradient(0, 0, 1200, 630);
  background.addColorStop(0, "#090616");
  background.addColorStop(0.5, "#071522");
  background.addColorStop(1, "#071a14");
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 630);
  for (let index = 0; index < 90; index += 1) {
    const x = (index * 137 + 53) % 1200;
    const y = (index * 83 + 31) % 630;
    context.fillStyle = index % 7 === 0 ? "#67e8f9" : "rgba(255,255,255,.38)";
    context.beginPath();
    context.arc(x, y, index % 9 === 0 ? 2 : 1, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = "rgba(103,232,249,.3)";
  context.lineWidth = 2;
  context.strokeRect(42, 42, 1116, 546);
  context.fillStyle = "#67e8f9";
  context.font = "600 22px ui-monospace, monospace";
  context.textAlign = "left";
  context.fillText("P00RIJA / EXPLORER PASSPORT", 88, 112);
  const fa = lang === "fa";
  context.direction = fa ? "rtl" : "ltr";
  context.textAlign = fa ? "right" : "left";
  const textX = fa ? 1112 : 88;
  context.fillStyle = "#f8fafc";
  context.font = `800 52px ${fa ? "Tahoma, Arial" : "system-ui"}, sans-serif`;
  context.fillText(config.passportHeading, textX, 220, 1024);
  context.fillStyle = "#a5b4fc";
  context.font = `400 27px ${fa ? "Tahoma, Arial" : "system-ui"}, sans-serif`;
  context.fillText(config.passportDescription, textX, 278, 1024);
  const stats = [[config.progressLabel, `${visited}/${total}`], [config.timeLabel, formatTime(seconds)], [fa ? "دستاورد" : "ACHIEVEMENTS", String(achievements)]];
  stats.forEach(([label, value], index) => {
    const x = 88 + index * 350;
    context.textAlign = "left";
    context.direction = "ltr";
    context.fillStyle = "rgba(255,255,255,.55)";
    context.font = "500 18px ui-monospace, monospace";
    context.fillText(label, x, 390);
    context.fillStyle = index === 0 ? "#e879f9" : index === 1 ? "#67e8f9" : "#fde047";
    context.font = "700 48px ui-monospace, monospace";
    context.fillText(value, x, 452);
  });
  context.direction = "ltr";
  context.textAlign = "left";
  context.fillStyle = "rgba(255,255,255,.6)";
  context.font = "400 20px ui-monospace, monospace";
  context.fillText(new Intl.DateTimeFormat(fa ? "fa-IR" : "en-CA").format(new Date()), 88, 538);
  context.textAlign = "right";
  context.fillText("FARHADIANFARD.CA", 1112, 538);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Passport export failed"))), "image/png");
  });
}

export function ExplorerPassport() {
  const lang = useContent((state) => state.lang);
  const contentLoaded = useContent((state) => state.loaded);
  const config = useContent((state) => state.content.explorer);
  const builder = useContent((state) => state.content.builder);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const fa = lang === "fa";
  const chapters = useMemo(() => resolveExplorerChapters(config, builder), [config, builder]);
  const complete = chapters.length > 0 && visited.length === chapters.length;

  useEffect(() => {
    const saved = readJourney();
    setVisited(saved.visited);
    setSeconds(saved.seconds);
    setCanShare(typeof navigator.share === "function");
    setReady(true);
  }, []);

  useEffect(() => {
    const valid = new Set(chapters.map((chapter) => chapter.id));
    setVisited((current) => current.filter((id) => valid.has(id)));
  }, [chapters]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-explorer-passport", onOpen);
    return () => window.removeEventListener("open-explorer-passport", onOpen);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ visited, seconds }));
    } catch {
      return;
    }
  }, [ready, seconds, visited]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setSeconds((value) => value + 5);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready || !contentLoaded) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const chapter = chapters.find((item) => item.target === entry.target.id);
        if (!chapter) return;
        setVisited((current) => (current.includes(chapter.id) ? current : [...current, chapter.id]));
      });
    }, { rootMargin: "-42% 0px -42% 0px", threshold: 0 });
    chapters.forEach(({ target }) => {
      const section = document.getElementById(target);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [chapters, contentLoaded, ready]);

  useEffect(() => {
    if (ready && complete) window.dispatchEvent(new CustomEvent("achieve", { detail: "world-cartographer" }));
  }, [complete, ready]);

  const achievementCount = useMemo(() => {
    if (!ready) return 0;
    try {
      return Object.keys(JSON.parse(localStorage.getItem("p00rija-achievements-v1") || "{}") as Record<string, number>).length;
    } catch {
      return 0;
    }
  }, [complete, ready]);

  const nextChapter = chapters.find((chapter) => !visited.includes(chapter.id)) ?? chapters[0];
  const progress = chapters.length ? Math.round((visited.length / chapters.length) * 100) : 0;
  const statCount = 1 + Number(config.showTimer) + Number(config.showRank);

  const goTo = useCallback((target: string) => {
    dialogRef.current?.close();
    window.setTimeout(() => {
      const element = document.getElementById(target);
      if (!element) return;
      const headerHeight = document.querySelector<HTMLElement>(".cms-runtime-header")?.offsetHeight ?? 64;
      const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      window.history.replaceState(null, "", `#${encodeURIComponent(target)}`);
    }, 80);
  }, []);

  const surprise = () => {
    const remaining = chapters.filter((chapter) => !visited.includes(chapter.id));
    const choices = remaining.length ? remaining : chapters;
    if (choices.length) goTo(choices[Math.floor(Math.random() * choices.length)].target);
  };

  const passportArgs = () => ({ config, lang, visited: visited.length, total: chapters.length, seconds, achievements: achievementCount });
  const download = async () => {
    setExporting(true);
    try {
      const blob = await createPassport(passportArgs());
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "p00rija-explorer-passport.png";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(config.downloadLabel);
    } catch {
      toast.error(fa ? "ساخت گذرنامه ممکن نشد" : "Could not create the passport");
    } finally {
      setExporting(false);
    }
  };

  const share = async () => {
    setExporting(true);
    try {
      const blob = await createPassport(passportArgs());
      const file = new File([blob], "p00rija-explorer-passport.png", { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) {
        await download();
        return;
      }
      await navigator.share({ files: [file], title: config.passportTitle, text: config.completeDescription });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(fa ? "اشتراک‌گذاری ممکن نشد" : "Sharing was not available");
    } finally {
      setExporting(false);
    }
  };

  if (!config.enabled) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="explorer-title"
      className="m-auto max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-[2rem] border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-background/85 backdrop:backdrop-blur-md [&::backdrop]:overscroll-contain"
      onClose={() => setOpen(false)}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pressedOutside.current = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      }}
      onPointerUp={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
        if (pressedOutside.current && outside) event.currentTarget.close();
        pressedOutside.current = false;
      }}
    >
      <div dir={fa ? "rtl" : "ltr"} className="relative overflow-hidden p-5 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 15% 0%, color-mix(in oklch, var(--ai-1) 22%, transparent), transparent 42%), radial-gradient(circle at 90% 90%, color-mix(in oklch, var(--gfx-1) 18%, transparent), transparent 40%)" }} />
        <div className="relative">
          <button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label={fa ? "بستن" : "Close"} className="absolute end-0 top-0 grid size-9 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground transition hover:text-foreground"><X className="size-4" /></button>
          <div className="pe-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{config.kicker} {String(chapters.length).padStart(2, "0")}</p>
            <h2 id="explorer-title" className="mt-2 text-2xl font-black sm:text-3xl">{config.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{config.subtitle}</p>
          </div>

          <div className="mt-6 grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${statCount}, minmax(0, 1fr))` }}>
            <div className="rounded-2xl border border-border bg-background/50 p-3"><p className="text-[10px] text-muted-foreground">{config.progressLabel}</p><p className="mt-1 font-mono text-lg font-bold">{visited.length}/{chapters.length}</p></div>
            {config.showTimer ? <div className="rounded-2xl border border-border bg-background/50 p-3"><p className="text-[10px] text-muted-foreground">{config.timeLabel}</p><p className="mt-1 font-mono text-lg font-bold" dir="ltr">{formatTime(seconds)}</p></div> : null}
            {config.showRank ? <div className="rounded-2xl border border-border bg-background/50 p-3"><p className="text-[10px] text-muted-foreground">{config.rankLabel}</p><p className="mt-1 truncate text-sm font-bold">{complete ? config.rankMaster : visited.length >= Math.ceil(chapters.length / 2) ? config.rankWalker : visited.length ? config.rankSeeker : config.rankNew}</p></div> : null}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`${progress}%`}><motion.div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-emerald-400" animate={{ width: `${progress}%` }} /></div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {chapters.map((chapter, index) => {
              const found = visited.includes(chapter.id);
              const Icon = ICONS[chapter.icon] ?? Sparkles;
              return (
                <button key={chapter.id} type="button" onClick={() => goTo(chapter.target)} className={`group flex items-center gap-3 rounded-2xl border p-3 text-start transition hover:-translate-y-0.5 hover:bg-background/80 ${found ? "border-border bg-background/60" : "border-dashed border-border/70 bg-background/25"}`} aria-label={`${chapter.title} — ${found ? (fa ? "کشف شده" : "discovered") : (fa ? "کشف نشده" : "not discovered")}`}>
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border" style={{ color: chapter.color, borderColor: `${chapter.color}55`, background: `${chapter.color}12` }}><Icon className="size-4" /><span className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-card font-mono text-[8px] text-muted-foreground">{index + 1}</span></span>
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-bold"><span className="truncate">{chapter.title}</span>{found ? <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden /> : null}</span><span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">{chapter.clue}</span></span>
                </button>
              );
            })}
          </div>

          {chapters.length ? (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => goTo(nextChapter.target)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background transition hover:opacity-90"><Compass className="size-4" />{complete ? config.tourAgainLabel : config.nextLabel}</button>
              {config.showSurprise ? <button type="button" onClick={surprise} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 text-sm font-bold transition hover:bg-background"><Sparkles className="size-4 text-fuchsia-400" />{config.surpriseLabel}</button> : null}
            </div>
          ) : null}

          {config.showPassport ? (
            <div className={`mt-4 rounded-2xl border p-4 ${complete ? "border-cyan-400/35 bg-cyan-400/5" : "border-dashed border-border bg-background/25"}`}>
              <div className="flex items-start gap-3"><Trophy className={`mt-0.5 size-5 shrink-0 ${complete ? "text-yellow-400" : "text-muted-foreground"}`} /><div><p className="text-sm font-bold">{config.passportTitle}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{complete ? config.completeDescription : config.lockedDescription.replace("{count}", String(chapters.length - visited.length))}</p></div></div>
              {complete ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={exporting} onClick={download} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"><Download className="size-4" />{config.downloadLabel}</button>{canShare ? <button type="button" disabled={exporting} onClick={share} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-bold transition hover:bg-background disabled:opacity-50"><Share2 className="size-4" />{config.shareLabel}</button> : null}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
