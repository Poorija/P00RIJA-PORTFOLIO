"use client";

/* ==================================================================
 * TimelineSection — the career/journey section.
 *
 * 12 space-themed layout styles, all CMS-switchable (timeline.style):
 *   2D:  orbit-path, alternating, mission-log, signal, parallax-field,
 *        constellation
 *   2.5D/3D (CSS transforms): horizontal-rail, comet, planet-hop,
 *        spiral, radar-ring, warp-lane
 *
 * All styles render the same TimelineEntry[] data, are bilingual,
 * scroll-animated (framer-motion whileInView) and responsive
 * (horizontal styles collapse to vertical stacks on mobile).
 * ================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useContent } from "@/lib/content-store";
import type { TimelineConfig, TimelineEntry, TimelineStyle } from "@/lib/content-types";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<TimelineEntry["kind"], { fa: string; en: string }> = {
  job: { fa: "شغل", en: "Job" },
  edu: { fa: "آموزش", en: "Learning" },
  project: { fa: "پروژه", en: "Project" },
  award: { fa: "افتخار", en: "Award" },
  milestone: { fa: "نقطه عطف", en: "Milestone" },
};

const fade = (c: string, pct = 50) => `color-mix(in oklch, ${c} ${100 - pct}%, transparent)`;

export function TimelineSection() {
  const timeline = useContent((s) => s.content.timeline);
  const lang = useContent((s) => s.lang);
  const [filter, setFilter] = useState<TimelineEntry["kind"] | "all">("all");

  const entries = useMemo(
    () => (filter === "all" ? timeline.entries : timeline.entries.filter((e) => e.kind === filter)),
    [timeline.entries, filter]
  );

  const kinds = useMemo(
    () => Array.from(new Set(timeline.entries.map((e) => e.kind))),
    [timeline.entries]
  );

  return (
    <section id="timeline" data-cursor-zone="timeline" className="relative z-10 max-w-full overflow-x-clip px-5 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <div data-cms-node="heading-and-filter" className="mb-14 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground backdrop-blur-md"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--sec-1)" }} />
            {timeline.kicker} · {timeline.index}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-black tracking-tight text-foreground md:text-5xl"
          >
            {timeline.title}
            <span className="text-gradient-sec">{timeline.highlight}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            onViewportEnter={() => {
              try { window.dispatchEvent(new CustomEvent("achieve", { detail: "timeline-explorer" })); } catch {}
            }}
            className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base"
          >
            {timeline.subtitle}
          </motion.p>

          {/* Kind filter */}
          {timeline.showFilter && kinds.length > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
              <FilterChip
                active={filter === "all"}
                color="var(--foreground)"
                onClick={() => setFilter("all")}
                label={lang === "fa" ? "همه" : "All"}
              />
              {kinds.map((k) => (
                <FilterChip
                  key={k}
                  active={filter === k}
                  color={timeline.entries.find((e) => e.kind === k)?.color || "var(--sec-1)"}
                  onClick={() => setFilter(k)}
                  label={lang === "fa" ? KIND_LABELS[k].fa : KIND_LABELS[k].en}
                />
              ))}
            </div>
          )}
        </div>

        {/* Style body */}
        <div data-cms-node="timeline-body"><TimelineBody style={timeline.style} entries={entries} showIcons={timeline.showIcons} lang={lang} /></div>
      </div>
    </section>
  );
}

function FilterChip({ active, color, onClick, label }: { active: boolean; color: string; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      data-cursor-hover
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-all",
        active ? "text-foreground" : "border-border text-muted-foreground hover:text-foreground"
      )}
      style={active ? { borderColor: color, background: fade(color, 88) } : undefined}
    >
      {label}
    </button>
  );
}

function TimelineBody({
  style,
  entries,
  showIcons,
  lang,
}: {
  style: TimelineStyle;
  entries: TimelineEntry[];
  showIcons: boolean;
  lang: "fa" | "en";
}) {
  switch (style) {
    case "alternating":
      return <AlternatingTimeline entries={entries} showIcons={showIcons} lang={lang} />;
    case "horizontal-rail":
      return <HorizontalRail entries={entries} showIcons={showIcons} lang={lang} />;
    case "constellation":
      return <ConstellationTimeline entries={entries} lang={lang} />;
    case "comet":
      return <CometTimeline entries={entries} showIcons={showIcons} lang={lang} />;
    case "mission-log":
      return <MissionLog entries={entries} lang={lang} />;
    case "planet-hop":
      return <PlanetHop entries={entries} lang={lang} />;
    case "spiral":
      return <SpiralGalaxy entries={entries} lang={lang} />;
    case "radar-ring":
      return <RadarRing entries={entries} lang={lang} />;
    case "warp-lane":
      return <WarpLane entries={entries} lang={lang} />;
    case "signal":
      return <SignalTimeline entries={entries} lang={lang} />;
    case "parallax-field":
      return <ParallaxField entries={entries} showIcons={showIcons} lang={lang} />;
    case "orbit-path":
    default:
      return <OrbitPathTimeline entries={entries} showIcons={showIcons} lang={lang} />;
  }
}

/* ---------------- shared bits ---------------- */

function NodeIcon({ entry, showIcons, size = "md" }: { entry: TimelineEntry; showIcons: boolean; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border backdrop-blur-sm",
        size === "lg" ? "h-14 w-14 text-2xl" : "h-10 w-10 text-base"
      )}
      style={{
        borderColor: fade(entry.color, 55),
        background: `radial-gradient(circle at 32% 30%, ${fade(entry.color, 20)}, ${fade(entry.color, 86)})`,
        boxShadow: `0 0 24px ${fade(entry.color, 65)}`,
      }}
    >
      {showIcons ? entry.icon : <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />}
    </span>
  );
}

function EntryCard({ entry, lang, compact = false }: { entry: TimelineEntry; lang: "fa" | "en"; compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl transition-colors",
        !compact && "hover:border-transparent"
      )}
      style={{ ["--tl" as string]: entry.color }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${entry.color}, transparent)` }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-bold tracking-wider" style={{ color: entry.color }}>
          {entry.date}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground" style={{ background: fade(entry.color, 90) }}>
          {lang === "fa" ? KIND_LABELS[entry.kind].fa : KIND_LABELS[entry.kind].en}
        </span>
      </div>
      <h3 className="mt-2 text-base font-bold text-foreground md:text-lg">{entry.title}</h3>
      <p className="text-xs font-medium text-muted-foreground">{entry.org}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.description}</p>
      {entry.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
              style={{ borderColor: fade(entry.color, 75), color: entry.color }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const rise = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

/* =========================================================
   1. orbit-path — vertical glowing orbit with planet nodes
   ========================================================= */
function OrbitPathTimeline({ entries, showIcons, lang }: { entries: TimelineEntry[]; showIcons: boolean; lang: "fa" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const lineScale = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });

  return (
    <div ref={ref} className="relative mx-auto max-w-3xl">
      {/* progress line — negative inline margin centers it on the anchor
          in BOTH directions (physical translate would break in RTL) */}
      <div className="absolute inset-y-0 start-7 w-px bg-border/70 md:start-1/2" />
      <motion.div
        className="absolute inset-y-0 start-7 -ms-[1.5px] w-[3px] origin-top rounded-full md:start-1/2"
        style={{
          scaleY: lineScale,
          background: "linear-gradient(to bottom, var(--gfx-1), var(--sec-1), var(--ai-1))",
          boxShadow: "0 0 14px var(--sec-glow)",
        }}
      />
      <div className="space-y-12">
        {entries.map((entry, i) => {
          const left = i % 2 === 0;
          return (
            <motion.div key={entry.id} {...rise} transition={{ delay: 0.05 * i }} className="relative md:grid md:grid-cols-2 md:gap-14">
              {/* node — the inner -ms-7 pulls half the node's width back
                  across the anchor so its CENTER sits exactly on the line,
                  direction-aware (works in fa/RTL and en/LTR alike) */}
              <div className="absolute start-7 top-1 z-10 md:start-1/2">
                <div className="-ms-7">
                  <div>
                    <NodeIcon entry={entry} showIcons={showIcons} size="lg" />
                  </div>
                </div>
              </div>
              {/* card */}
              <div className={cn("ms-16 min-w-0 md:ms-0", left ? "md:pe-4 md:text-end" : "md:col-start-2 md:ps-4")}>
                <div className={cn(left && "[&>div]:text-start")}>
                  <EntryCard entry={entry} lang={lang} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   2. alternating — zig-zag cards with a comet connector
   ========================================================= */
function AlternatingTimeline({ entries, showIcons, lang }: { entries: TimelineEntry[]; showIcons: boolean; lang: "fa" | "en" }) {
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="absolute bottom-7 start-5 top-7 w-px bg-border/70 md:hidden" />
      <div className="space-y-8">
        {entries.map((entry, i) => {
          const offset = i % 2 === 0 ? "md:ms-0 md:me-auto" : "md:ms-auto md:me-0";
          return (
            <motion.div
              key={entry.id}
              {...rise}
              transition={{ delay: 0.04 * i, type: "spring", stiffness: 70, damping: 16 }}
              className={cn("group relative w-full md:ms-0 md:w-[calc(50%-1.5rem)]", offset)}
            >
              {/* connector to spine */}
              <div
                className={cn(
                  "absolute top-7 hidden h-px w-6 md:block",
                  i % 2 === 0 ? "start-1/2" : "end-1/2"
                )}
                style={{ background: `linear-gradient(to right, ${fade(entry.color, 40)}, transparent)` }}
              />
              <div className="absolute start-0 top-3 flex flex-col items-center md:hidden">
                <NodeIcon entry={entry} showIcons={showIcons} />
              </div>
              <motion.div whileHover={{ rotateX: 2, rotateY: i % 2 ? -2 : 2, y: -3 }} style={{ transformPerspective: 800 }} className="ms-14 min-w-0 md:ms-0 md:max-w-none">
                <EntryCard entry={entry} lang={lang} />
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   3. horizontal-rail — mission-control horizontal scroll rail
   (vertical list on mobile)
   ========================================================= */
function HorizontalRail({ entries, showIcons, lang }: { entries: TimelineEntry[]; showIcons: boolean; lang: "fa" | "en" }) {
  const railRef = useRef<HTMLDivElement>(null);
  const onWheel = (e: React.WheelEvent) => {
    const el = railRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };
  return (
    <div>
      <div
        ref={railRef}
        onWheel={onWheel}
        className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-4 md:py-6 timeline-rail-3d"
      >
        {entries.map((entry, i) => (
          <motion.div
            key={entry.id}
            {...rise}
            transition={{ delay: 0.05 * i }}
            className="relative w-72 shrink-0 snap-center md:w-80"
          >
            {/* trajectory dashes */}
            <div className="mb-5 flex items-center gap-2">
              <NodeIcon entry={entry} showIcons={showIcons} />
              <div className="h-px flex-1" style={{ background: `repeating-linear-gradient(to right, ${entry.color} 0 6px, transparent 6px 12px)`, opacity: 0.55 }} />
              <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <motion.div whileHover={{ y: -6, rotateX: 3 }} style={{ transformPerspective: 900 }}>
              <EntryCard entry={entry} lang={lang} />
            </motion.div>
          </motion.div>
        ))}
      </div>
      <p className="mt-2 text-center font-mono text-[10px] tracking-[0.3em] text-muted-foreground md:hidden">
        {lang === "fa" ? "← بکشید" : "SWIPE →"}
      </p>
    </div>
  );
}

/* =========================================================
   4. constellation — SVG constellation with animated links
   ========================================================= */
function ConstellationTimeline({ entries, lang }: { entries: TimelineEntry[]; lang: "fa" | "en" }) {
  const [active, setActive] = useState<string | null>(null);
  const points = useMemo(() => {
    const w = 1000, h = Math.max(420, entries.length * 130);
    return entries.map((e, i) => ({
      entry: e,
      x: 90 + ((i * 191) % 700) + (i % 3) * 60,
      y: 70 + i * ((h - 140) / Math.max(entries.length - 1, 1)),
    }));
  }, [entries]);

  const activeEntry = entries.find((e) => e.id === active) ?? entries[0];

  return (
    <div className="relative">
      <svg viewBox="0 0 1000 700" className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
        {points.slice(0, -1).map((p, i) => (
          <motion.line
            key={i}
            x1={p.x}
            y1={p.y}
            x2={points[i + 1].x}
            y2={points[i + 1].y}
            stroke={p.entry.color}
            strokeOpacity={0.4}
            strokeDasharray="3 7"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: i * 0.15 }}
          />
        ))}
        {points.map((p, i) => (
          <g key={p.entry.id} onMouseEnter={() => setActive(p.entry.id)} className="cursor-pointer">
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={active === p.entry.id ? 14 : 9}
              fill={p.entry.color}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.15, type: "spring", stiffness: 200 }}
              style={{ filter: `drop-shadow(0 0 10px ${p.entry.color})` }}
            />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={20}
              fill="transparent"
              stroke={p.entry.color}
              strokeOpacity={0.35}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              animate={{ scale: [0.8, 1.2, 0.8], strokeOpacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.3 }}
            />
            <text
              x={p.x}
              y={p.y - 26}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize="13"
            >
              {p.entry.date}
            </text>
          </g>
        ))}
      </svg>
      <div className="mx-auto mt-4 max-w-2xl">
        {activeEntry && (
          <motion.div key={activeEntry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <EntryCard entry={activeEntry} lang={lang} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   5. comet — a comet head travels down as you scroll,
      its tail lights the passed entries
   ========================================================= */
function CometTimeline({ entries, showIcons, lang }: { entries: TimelineEntry[]; showIcons: boolean; lang: "fa" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 70%"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const glow = useTransform(scrollYProgress, (v) => 0.4 + Math.sin(v * Math.PI) * 0.6);

  return (
    <div ref={ref} className="relative mx-auto max-w-3xl">
      <div className="absolute inset-y-0 start-6 w-px bg-border/60 md:start-1/2" />
      {/* comet — centered on the line via negative inline margin (RTL-safe) */}
      <motion.div
        className="pointer-events-none absolute start-6 top-0 z-20 md:start-1/2"
        style={{ y, opacity: glow }}
      >
        <div className="relative -ms-[7px]">
          <div
            className="h-3.5 w-3.5 rounded-full"
            style={{ background: "white", boxShadow: "0 0 18px 6px var(--ai-1), 0 0 40px 14px var(--gfx-1)" }}
          />
          <div
            className="absolute top-1/2 h-2 w-24 -translate-y-1/2 rounded-full"
            style={{ background: "linear-gradient(to left, var(--ai-1), transparent)", transform: "translate(100%,-50%) rotate(180deg)" }}
          />
        </div>
      </motion.div>
      <div className="space-y-10">
        {entries.map((entry, i) => {
          const left = i % 2 === 0;
          return (
            <CometItem key={entry.id} entry={entry} index={i} progress={scrollYProgress} left={left} showIcons={showIcons} lang={lang} />
          );
        })}
      </div>
    </div>
  );
}

function CometItem({
  entry,
  index,
  progress,
  left,
  showIcons,
  lang,
}: {
  entry: TimelineEntry;
  index: number;
  progress: MotionValue<number>;
  left: boolean;
  showIcons: boolean;
  lang: "fa" | "en";
}) {
  const threshold = (index + 0.5) / 5;
  const lit = useTransform(progress, [Math.max(threshold - 0.12, 0), threshold], [0.25, 1]);
  return (
    <motion.div style={{ opacity: lit }} className="relative md:grid md:grid-cols-2 md:gap-14">
      <div className="absolute start-6 top-4 z-10 md:start-1/2">
        <div className="-ms-5">
          <NodeIcon entry={entry} showIcons={showIcons} />
        </div>
      </div>
      <div className={cn("ms-16 md:ms-0", left ? "md:pe-2" : "md:col-start-2 md:ps-2")}>
        <EntryCard entry={entry} lang={lang} />
      </div>
    </motion.div>
  );
}

/* =========================================================
   6. mission-log — monospace mission-control log
   ========================================================= */
function MissionLog({ entries, lang }: { entries: TimelineEntry[]; lang: "fa" | "en" }) {
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-4)" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--sec-1)" }} />
        <span className="ms-2 font-mono text-[10px] tracking-widest text-muted-foreground">
          MISSION-CONTROL · {lang === "fa" ? "گزارش سفر" : "JOURNEY LOG"}
        </span>
      </div>
      <div className="space-y-0 p-4 font-mono text-sm md:p-6">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.06 }}
            className="group relative border-s-2 py-3 ps-4"
            style={{ borderColor: fade(entry.color, 55) }}
          >
            <span className="me-2 select-none" style={{ color: entry.color }}>❯</span>
            <span className="text-muted-foreground">[{entry.date}]</span>{" "}
            <span className="font-bold text-foreground">{entry.title}</span>
            <span className="text-muted-foreground"> @ {entry.org}</span>
            <p className="ms-4 mt-1.5 text-xs leading-relaxed text-muted-foreground opacity-80">{entry.description}</p>
            <div className="ms-4 mt-1 flex flex-wrap gap-2">
              {entry.tags.map((t) => (
                <span key={t} className="text-[10px]" style={{ color: entry.color }}>#{t}</span>
              ))}
            </div>
            <span className="absolute -start-[7px] top-4 h-3 w-3 rounded-full border-2" style={{ borderColor: entry.color, background: "var(--card)" }} />
          </motion.div>
        ))}
        <div className="pt-2 text-muted-foreground">
          <span className="me-2" style={{ color: "var(--sec-1)" }}>❯</span>
          <span className="opacity-70">{lang === "fa" ? "در انتظار ماموریت بعدی" : "awaiting next mission"}</span>
          <span className="animate-blink">▊</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   7. planet-hop — CSS-3D planet spheres with trajectory arcs
   ========================================================= */
function PlanetHop({ entries, lang }: { entries: TimelineEntry[]; lang: "fa" | "en" }) {
  const [active, setActive] = useState(0);
  const activeEntry = entries[active] ?? entries[0];
  return (
    <div className="mx-auto max-w-5xl">
      {/* planet row */}
      <div className="no-scrollbar flex items-end justify-start gap-1 overflow-x-auto pb-2 md:justify-center">
        {entries.map((entry, i) => {
          const size = 44 + ((i * 13) % 26);
          const isActive = i === active;
          return (
            <div key={entry.id} className="flex shrink-0 items-end">
              <motion.button
                onClick={() => setActive(i)}
                data-cursor-hover
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="group relative grid place-items-center rounded-full outline-none"
                style={{ width: size, height: size }}
                aria-label={entry.title}
              >
                <span
                  className="absolute inset-0 rounded-full transition-transform"
                  style={{
                    background: `radial-gradient(circle at 32% 30%, ${fade(entry.color, 10)}, ${entry.color} 55%, ${fade(entry.color, 100)})`,
                    boxShadow: `0 0 ${isActive ? 26 : 14}px ${fade(entry.color, 55)}`,
                    transform: isActive ? "scale(1.12)" : undefined,
                  }}
                />
                <span className="relative text-[10px]">{entry.icon}</span>
                <span
                  className="absolute -bottom-5 whitespace-nowrap font-mono text-[9px] transition-opacity"
                  style={{ color: entry.color, opacity: isActive ? 1 : 0.5 }}
                >
                  {entry.date}
                </span>
              </motion.button>
              {i < entries.length - 1 && (
                <svg width="46" height="46" viewBox="0 0 46 46" className="mb-4 shrink-0">
                  <motion.path
                    d="M2 40 Q 23 2, 44 40"
                    fill="none"
                    stroke={entry.color}
                    strokeOpacity="0.4"
                    strokeDasharray="2 5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-16 flex justify-center md:mt-14">
        {activeEntry && (
          <motion.div
            key={activeEntry.id}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="w-full max-w-2xl"
          >
            <EntryCard entry={activeEntry} lang={lang} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   8. spiral — perspective galaxy spiral (3D CSS)
   ========================================================= */
function SpiralGalaxy({ entries, lang }: { entries: TimelineEntry[]; lang: "fa" | "en" }) {
  const [active, setActive] = useState(0);
  const activeEntry = entries[active] ?? entries[0];
  return (
    <div className="mx-auto max-w-5xl">
      <div
        className="relative mx-auto grid place-items-center rounded-full border border-border/60"
        style={{
          width: "min(84vw, 560px)",
          height: "min(84vw, 560px)",
          transform: "perspective(1100px) rotateX(56deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {[0.94, 0.72, 0.5, 0.28].map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: `${s * 100}%`,
              height: `${s * 100}%`,
              borderColor: i === active % 4 ? "var(--sec-1)" : "var(--border)",
              opacity: 0.7,
            }}
          />
        ))}
        <motion.div
          className="absolute h-[70%] w-[70%] rounded-full"
          style={{ background: "radial-gradient(circle, var(--sec-glow), transparent 65%)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />
        {entries.map((entry, i) => {
          const angle = (i / entries.length) * Math.PI * 2;
          const radius = 22 + (i % 3) * 11; // percent
          const x = 50 + Math.cos(angle) * radius;
          const y = 50 + Math.sin(angle) * radius;
          const isActive = i === active;
          return (
            <motion.button
              key={entry.id}
              onClick={() => setActive(i)}
              data-cursor-hover
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, type: "spring" }}
              className="absolute rounded-full outline-none"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%,-50%) rotateX(-56deg)",
                width: isActive ? 34 : 24,
                height: isActive ? 34 : 24,
                background: `radial-gradient(circle at 32% 30%, ${fade(entry.color, 15)}, ${entry.color})`,
                boxShadow: `0 0 ${isActive ? 26 : 12}px ${fade(entry.color, 50)}`,
              }}
              aria-label={entry.title}
            />
          );
        })}
      </div>
      <div className="mt-8 flex justify-center">
        {activeEntry && (
          <motion.div key={activeEntry.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
            <EntryCard entry={activeEntry} lang={lang} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   9. radar-ring — circular HUD ring with orbiting entries
   ========================================================= */
function RadarRing({ entries, lang }: { entries: TimelineEntry[]; lang: "fa" | "en" }) {
  const [active, setActive] = useState(0);
  const activeEntry = entries[active] ?? entries[0];
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-center gap-10 lg:flex-row lg:justify-center">
        <div className="relative h-72 w-72 shrink-0 md:h-80 md:w-80">
          {/* rotating sweep */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, var(--sec-glow), transparent 22%)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 rounded-full border border-border" />
          <div className="absolute inset-[18%] rounded-full border border-border/70" />
          <div className="absolute inset-[38%] rounded-full border border-border/70" />
          <div className="absolute inset-[48.5%] h-1.5 w-1.5 rounded-full" style={{ background: "var(--sec-1)", boxShadow: "0 0 12px var(--sec-1)" }} />
          {entries.map((entry, i) => {
            const angle = (i / entries.length) * 360 - 90;
            const isActive = i === active;
            return (
              <motion.button
                key={entry.id}
                onClick={() => setActive(i)}
                data-cursor-hover
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="absolute left-1/2 top-1/2 outline-none"
                style={{ transform: `rotate(${angle}deg) translateX(112px) rotate(${-angle}deg)`, transformOrigin: "0 0" }}
                aria-label={entry.title}
              >
                <span
                  className="block -translate-x-1/2 -translate-y-1/2 rounded-full transition-all"
                  style={{
                    width: isActive ? 18 : 11,
                    height: isActive ? 18 : 11,
                    background: entry.color,
                    boxShadow: `0 0 ${isActive ? 18 : 8}px ${entry.color}`,
                  }}
                />
              </motion.button>
            );
          })}
        </div>
        <div className="w-full max-w-md">
          {activeEntry && (
            <motion.div key={activeEntry.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} className="relative">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {lang === "fa" ? "هدف قفل شد" : "TARGET LOCKED"} · {active + 1}/{entries.length}
              </p>
              <EntryCard entry={activeEntry} lang={lang} />
              <div className="mt-4 flex flex-wrap gap-1.5">
                {entries.map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => setActive(i)}
                    data-cursor-hover
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === active ? 26 : 10,
                      background: i === active ? e.color : "var(--border)",
                    }}
                    aria-label={e.title}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   10. warp-lane — 3D perspective converging lanes
   ========================================================= */
function WarpLane({ entries, lang }: { entries: TimelineEntry[]; lang: "fa" | "en" }) {
  return (
    <div
      className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-card/30 px-5 py-10 md:px-10"
      style={{ perspective: "900px" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "repeating-linear-gradient(to right, var(--grid-line) 1px, transparent 1px), repeating-linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          transform: "rotateX(58deg) scale(1.6)",
          transformOrigin: "top center",
        }}
      />
      <div className="relative space-y-8">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, z: -80, rotateX: 12 }}
            whileInView={{ opacity: 1, z: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 60, damping: 14 }}
            className="flex items-stretch gap-4"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div
              className="grid w-24 shrink-0 place-items-center rounded-xl border font-mono text-[10px] font-bold md:w-32 md:text-xs"
              style={{
                borderColor: fade(entry.color, 60),
                color: entry.color,
                background: fade(entry.color, 92),
                boxShadow: `0 0 18px ${fade(entry.color, 80)}`,
              }}
            >
              <span className="text-center leading-tight">{entry.date}</span>
            </div>
            <div className="w-full">
              <EntryCard entry={entry} lang={lang} compact />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   11. signal — deep-space signal pulse with blips
   ========================================================= */
function SignalTimeline({ entries, lang }: { entries: TimelineEntry[]; lang: "fa" | "en" }) {
  return (
    <div className="relative mx-auto max-w-3xl">
      <svg className="absolute inset-x-0 top-8 -z-0 h-2 w-full" preserveAspectRatio="none" viewBox="0 0 100 2">
        <motion.line
          x1="0" y1="1" x2="100" y2="1"
          stroke="var(--ai-1)"
          strokeWidth="0.4"
          strokeOpacity="0.6"
          animate={{ strokeOpacity: [0.25, 0.7, 0.25] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        <motion.circle
          r="0.8"
          fill="var(--ai-1)"
          animate={{ cx: [0, 100] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
      </svg>
      <div className="relative space-y-6 pt-16">
        {entries.map((entry, i) => {
          const left = i % 2 === 0;
          return (
            <motion.div
              key={entry.id}
              {...rise}
              transition={{ delay: 0.04 * i }}
              className={cn("flex", left ? "justify-start" : "justify-end")}
            >
              <div className="relative w-[92%] md:w-[46%]">
                {/* blip connector */}
                <div
                  className={cn("absolute -top-10 h-10 w-px", left ? "start-4 md:start-8" : "end-4 md:end-8")}
                  style={{ background: `linear-gradient(to bottom, ${entry.color}, transparent)` }}
                />
                <motion.div
                  className="absolute -top-[46px] h-2 w-2 rounded-full"
                  style={{ background: entry.color, boxShadow: `0 0 10px ${entry.color}`, [left ? "start" : "end"]: left ? "14px" : "14px" }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                />
                <EntryCard entry={entry} lang={lang} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   12. parallax-field — cards drifting in star depth layers
   ========================================================= */
function ParallaxField({ entries, showIcons, lang }: { entries: TimelineEntry[]; showIcons: boolean; lang: "fa" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const layerA = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const layerB = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const layerC = useTransform(scrollYProgress, [0, 1], [120, -120]);
  const layers = [layerA, layerB, layerC];

  const columns = useMemo(() => {
    const cols: TimelineEntry[][] = [[], [], []];
    entries.forEach((e, i) => cols[i % 3].push(e));
    return cols;
  }, [entries]);

  return (
    <div ref={ref} className="relative mx-auto max-w-6xl">
      <div className="pointer-events-none absolute inset-0 -z-10">
        {Array.from({ length: 26 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-foreground"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 61) % 100}%`,
              width: 1 + (i % 3),
              height: 1 + (i % 3),
              opacity: 0.16,
            }}
            animate={{ opacity: [0.08, 0.3, 0.08] }}
            transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.12 }}
          />
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {columns.map((col, c) => (
          <motion.div key={c} style={{ y: layers[c] }} className={cn(c === 1 && "md:mt-12", c === 2 && "md:mt-24")}>
            <div className="space-y-5">
              {col.map((entry) => (
                <motion.div key={entry.id} {...rise} whileHover={{ scale: 1.02, y: -4 }} className="flex gap-3">
                  {showIcons && (
                    <div className="pt-1">
                      <NodeIcon entry={entry} showIcons={showIcons} />
                    </div>
                  )}
                  <EntryCard entry={entry} lang={lang} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
