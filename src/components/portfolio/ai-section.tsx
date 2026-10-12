"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Cpu, Bot, Eye, ArrowUpLeft, Workflow, ArrowLeft, Frame } from "lucide-react";
import { SectionHeading, TiltCard, Reveal, Chip } from "./section-utils";
import type { GalleryLayout } from "@/lib/content-types";
import { useContent } from "@/lib/content-store";
import { Ambient3DObject } from "./ambient-3d-object";
import { VirtualGallery } from "./virtual-gallery";
import type { SiteContent } from "@/lib/content-types";

const PROJECT_ICONS = [Bot, Eye, Workflow];

export function AISection() {
  const a = useContent((s) => s.content.ai);
  const lang = useContent((s) => s.lang);
  const neuralObject = useContent((s) => s.content.design?.objects?.find((object) => object.slot === "ai-ambient"));
  const [galleryOpen, setGalleryOpen] = useState(false);

  return (
    <section
      id="ai"
      data-cursor-zone="ai"
      className="relative overflow-hidden px-5 py-24 md:py-32"
    >
      {/* identity background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute right-0 top-1/4 h-[40rem] w-[40rem] rounded-full blur-[140px] animate-aurora"
          style={{
            background: "radial-gradient(circle, var(--ai-1), transparent 60%)",
            opacity: "var(--aurora-opacity)",
          }}
        />
        <div
          className="absolute -left-20 bottom-1/4 h-[32rem] w-[32rem] rounded-full blur-[120px] animate-aurora"
          style={{
            background: "radial-gradient(circle, var(--ai-3), transparent 60%)",
            opacity: "var(--aurora-opacity)",
            animationDelay: "-9s",
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px] animate-aurora"
          style={{
            background: "radial-gradient(circle, var(--ai-2), transparent 60%)",
            opacity: "var(--aurora-opacity)",
            animationDelay: "-5s",
          }}
        />
      </div>

      {a.visual?.enabled !== false && <AICoreVisual config={a.visual} />}

      <div className="relative z-10 mx-auto max-w-7xl">
        {neuralObject?.enabled !== false && (
          <Ambient3DObject variant="neural" config={neuralObject} className="hidden lg:block" defaultPlacement={{ side: "end", top: 9, offset: -6, size: 236 }} />
        )}
        <div data-cms-node="heading">
          <SectionHeading index={a.index} kickerEn={a.kicker} accent="var(--ai-1)" title={a.title} highlight={a.highlight} subtitle={a.subtitle} />
        </div>

        <Reveal delay={0.08}>
          <button data-cms-node="gallery-button" onClick={() => setGalleryOpen(true)} className="mb-8 flex items-center gap-2 rounded-2xl border border-[var(--ai-1)]/35 bg-[var(--ai-1)]/5 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-[var(--ai-1)]/10">
            <Frame className="h-4 w-4 text-[var(--ai-1)]" />
            {a.gallery?.enterLabel}
          </button>
        </Reveal>

        <div data-cms-node="portfolio-grid" className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Left: neural network viz */}
          <Reveal>
            <div data-cms-node="neural-network" data-cms-object className="sticky top-24 overflow-hidden rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <Brain className="h-3 w-3" style={{ color: "var(--ai-1)" }} />
                  neural_net.forward()
                </div>
                <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ai-2)" }}>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--ai-2)" }} />
                  {lang === "fa" ? "آموزش · دوره ۴۲" : "training · epoch 42"}
                </span>
              </div>
              <NeuralNetwork />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                <div className="rounded-lg border border-border bg-surface-1 py-2">
                  <div className="text-sm font-bold" style={{ color: "var(--ai-1)" }}>0.94</div>
                  <div className="text-muted-foreground">{lang === "fa" ? "دقت" : "accuracy"}</div>
                </div>
                <div className="rounded-lg border border-border bg-surface-1 py-2">
                  <div className="text-sm font-bold" style={{ color: "var(--ai-2)" }}>0.08</div>
                  <div className="text-muted-foreground">{lang === "fa" ? "خطا" : "loss"}</div>
                </div>
                <div className="rounded-lg border border-border bg-surface-1 py-2">
                  <div className="text-sm font-bold" style={{ color: "var(--ai-3)" }}>128</div>
                  <div className="text-muted-foreground">{lang === "fa" ? "دسته" : "batch"}</div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right: projects */}
          <div data-cms-node="projects" className="grid gap-5">
            {a.projects.map((p, i) => {
              const Icon = PROJECT_ICONS[i % PROJECT_ICONS.length];
              return (
                <Reveal key={p.title + i} delay={i * 0.1} className="h-full">
                  <TiltCard
                    max={7}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
                  >
                    <div
                      className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        background: "linear-gradient(135deg, var(--ai-1), var(--ai-3))",
                        maskImage: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                        maskComposite: "exclude",
                        WebkitMaskComposite: "xor",
                        padding: "1px",
                      }}
                    />
                    <div className="relative flex gap-5">
                      <div
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border"
                        style={{
                          borderColor: "color-mix(in oklch, var(--ai-1) 40%, transparent)",
                          background: "color-mix(in oklch, var(--ai-1) 12%, transparent)",
                        }}
                      >
                        <Icon className="h-6 w-6" style={{ color: "var(--ai-1)" }} />
                      </div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <div
                            className="font-mono text-[10px] uppercase tracking-widest"
                            style={{ color: "color-mix(in oklch, var(--ai-1) 80%, transparent)" }}
                          >
                            {p.cat}
                          </div>
                          <ArrowUpLeft className="h-4 w-4 text-muted-foreground transition-all group-hover:text-[var(--ai-1)]" />
                        </div>
                        <h3 className="mb-2 text-lg font-bold text-foreground">{p.title}</h3>
                        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                        <div className="flex flex-wrap gap-2">
                          {p.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-border bg-surface-1 px-2.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                </Reveal>
              );
            })}

            {/* Section-colored CTA */}
            <Reveal delay={0.25}>
              <a
                data-cms-node="contact-cta"
                href="#contact"
                data-cursor-hover
                className="btn-solid-ai group flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold transition-transform hover:scale-[1.01]"
              >
                {a.cta.label}
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              </a>
            </Reveal>

            {/* stack */}
            <Reveal delay={0.3} className="mt-2">
              <div data-cms-node="technology-stack" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-1 p-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cpu className="h-4 w-4" style={{ color: "var(--ai-1)" }} />
                  {lang === "fa" ? "فناوری‌ها:" : "Technology stack:"}
                </div>
                {a.stack.map((st) => (
                  <Chip key={st} color="var(--ai-1)">
                    {st}
                  </Chip>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      <AnimatePresence>{galleryOpen && a.gallery && <VirtualGallery layout={( a.gallery as { layout?: GalleryLayout }).layout} projects={a.gallery.projects} title={a.gallery.title} subtitle={a.gallery.subtitle} onClose={() => setGalleryOpen(false)} />}</AnimatePresence>
    </section>
  );
}

function AICoreVisual({ config }: { config: SiteContent["ai"]["visual"] }) {
  const count = Math.max(8, Math.min(32, Number(config.nodes) || 18));
  return (
    <div
      data-cms-node="ai-core-visual"
      data-cms-object
      className="pointer-events-none absolute z-0 hidden h-72 w-72 -translate-x-1/2 -translate-y-1/2 md:block"
      style={{ insetInlineStart: `${Math.max(0, Math.min(100, config.x))}%`, top: `${Math.max(0, Math.min(100, config.y))}%`, scale: Math.max(.55, Math.min(1.6, config.scale)) }}
      aria-hidden="true"
    >
      <motion.div
        className="relative grid h-full w-full place-items-center"
        animate={{ y: [0, -10, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 7 / Math.max(.25, config.speed), repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-5 rounded-full border border-[var(--ai-1)]/25 shadow-[0_0_80px_color-mix(in_oklch,var(--ai-1)_25%,transparent)]" />
        <div className="absolute inset-16 animate-[spin_18s_linear_infinite] rounded-[42%] border border-[var(--ai-2)]/40" />
        <div className="absolute grid size-24 place-items-center rounded-3xl border border-[var(--ai-1)]/50 bg-background/55 text-center font-mono text-[9px] text-[var(--ai-1)] backdrop-blur-xl">
          <Brain className="mb-1 size-8" /><span>{config.label}</span><span className="opacity-60">{config.model}</span>
        </div>
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2;
          const radius = 104 + (i % 3) * 16;
          // Round to 4 decimals: framer-motion truncates transforms server-side
          // but writes full precision during hydration — identical inputs keep
          // the SSR and client style strings byte-equal (no hydration warning).
          const x = Math.round(Math.cos(angle) * radius * 1e4) / 1e4;
          const y = Math.round(Math.sin(angle) * radius * 1e4) / 1e4;
          return <motion.span key={i} className="absolute size-2 rounded-full bg-[var(--ai-2)] shadow-[0_0_12px_var(--ai-2)]" style={{ x, y }} animate={{ opacity: [.25, 1, .25], scale: [.7, 1.4, .7] }} transition={{ duration: 2.2, delay: i * .08, repeat: Infinity }} />;
        })}
      </motion.div>
    </div>
  );
}

/* === Neural network animation === */
function NeuralNetwork() {
  const layers = [
    { count: 4, x: 12 },
    { count: 6, x: 38 },
    { count: 5, x: 64 },
    { count: 3, x: 88 },
  ];

  const nodes = layers.flatMap((layer, li) =>
    Array.from({ length: layer.count }, (_, ni) => ({
      id: `${li}-${ni}`,
      x: layer.x,
      y: 12 + (ni * 76) / (layer.count - 1 || 1),
      layer: li,
    }))
  );

  const edges: { a: typeof nodes[0]; b: typeof nodes[0] }[] = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const cur = nodes.filter((n) => n.layer === li);
    const nxt = nodes.filter((n) => n.layer === li + 1);
    cur.forEach((aa) => nxt.forEach((b) => edges.push({ a: aa, b })));
  }

  return (
    <svg viewBox="0 0 100 100" className="h-72 w-full" preserveAspectRatio="none">
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.a.x}
          y1={e.a.y}
          x2={e.b.x}
          y2={e.b.y}
          stroke="color-mix(in oklch, var(--ai-1) 25%, transparent)"
          strokeWidth="0.25"
        />
      ))}
      {edges.map((e, i) => (
        <motion.circle
          key={`s-${i}`}
          r="0.6"
          fill="var(--ai-2)"
          initial={{ cx: e.a.x, cy: e.a.y, opacity: 0 }}
          animate={{ cx: [e.a.x, e.b.x], cy: [e.a.y, e.b.y], opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.4, delay: (i % 12) * 0.12, repeat: Infinity, repeatDelay: ((i * 7) % 11) * 0.17 }}
        />
      ))}
      {nodes.map((n, nodeIndex) => (
        <g key={n.id}>
          <motion.circle
            cx={n.x}
            cy={n.y}
            r="2.4"
            fill="var(--card)"
            stroke={n.layer === 0 ? "var(--ai-1)" : n.layer === layers.length - 1 ? "var(--ai-3)" : "var(--ai-2)"}
            strokeWidth="0.5"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, delay: (nodeIndex % 9) * 0.19, repeat: Infinity }}
          />
          <motion.circle
            cx={n.x}
            cy={n.y}
            r="2.4"
            fill="none"
            stroke="var(--ai-1)"
            strokeWidth="0.3"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            animate={{ scale: [1, 2.1], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, delay: ((nodeIndex * 5) % 11) * 0.16, repeat: Infinity, ease: "easeOut" }}
          />
        </g>
      ))}
    </svg>
  );
}
