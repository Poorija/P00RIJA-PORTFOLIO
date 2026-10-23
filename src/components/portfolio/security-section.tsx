"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  ShieldCheck,
  Server,
  Lock,
  Network,
  GitBranch,
  ArrowUpLeft,
  ArrowLeft,
  Frame,
} from "lucide-react";
import { SectionHeading, TiltCard, Reveal, Chip } from "./section-utils";
import { InteractiveTerminal } from "./interactive-terminal";
import type { GalleryLayout } from "@/lib/content-types";
import { useContent } from "@/lib/content-store";
import { Ambient3DObject } from "./ambient-3d-object";
import { VirtualGallery } from "./virtual-gallery";
import { useGalleryGate } from "./section-guard";

const SKILL_ICONS = [Terminal, Network, ShieldCheck, Server, Lock, GitBranch];

export function SecuritySection() {
  const s = useContent((st) => st.content.security);
  const lang = useContent((st) => st.lang);
  const orbitObject = useContent((st) => st.content.design?.objects?.find((object) => object.slot === "security-ambient"));
  const [galleryOpen, setGalleryOpen] = useState(false);
  const securityGallery = useGalleryGate("security", "Security");

  return (
    <section
      id="security"
      data-cursor-zone="sec"
      className="relative overflow-hidden px-5 py-24 md:py-32"
    >
      {/* identity background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/4 top-0 h-[36rem] w-[36rem] rounded-full blur-[140px] animate-aurora"
          style={{
            background: "radial-gradient(circle, var(--sec-1), transparent 60%)",
            opacity: "var(--aurora-opacity)",
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 h-[30rem] w-[30rem] rounded-full blur-[120px] animate-aurora"
          style={{
            background: "radial-gradient(circle, var(--sec-2), transparent 60%)",
            opacity: "var(--aurora-opacity)",
            animationDelay: "-10s",
          }}
        />
        <div
          className="grid-bg absolute inset-0 opacity-50"
          style={{ maskImage: "radial-gradient(ellipse at 30% 70%, black, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        {orbitObject?.enabled !== false && (
          <Ambient3DObject variant="orbit" config={orbitObject} className="hidden lg:block" defaultPlacement={{ side: "end", top: 9, offset: -6, size: 236 }} />
        )}
        <div data-cms-node="heading"><SectionHeading index={s.index} kickerEn={s.kicker} accent="var(--sec-1)" title={s.title} highlight={s.highlight} subtitle={s.subtitle} /></div>

        <Reveal delay={0.08}>
          <button data-cms-node="gallery-button" onClick={() => securityGallery.gate(() => setGalleryOpen(true))} className="mb-8 flex items-center gap-2 rounded-2xl border border-[var(--sec-1)]/35 bg-[var(--sec-1)]/5 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-[var(--sec-1)]/10">
            <Frame className="h-4 w-4 text-[var(--sec-1)]" />
            {s.gallery?.enterLabel}
          </button>
        </Reveal>

        <div data-cms-node="portfolio-grid" className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: projects + skills */}
          <div data-cms-node="projects-and-skills" className="order-2 lg:order-1">
            <div className="grid gap-5">
              {s.projects.map((p, i) => (
                <Reveal key={p.title + i} delay={i * 0.1} className="h-full">
                  <TiltCard
                    max={6}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card/75 p-5 backdrop-blur-sm"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background:
                          "linear-gradient(to bottom, transparent 0%, color-mix(in oklch, var(--sec-1) 8%, transparent) 50%, transparent 100%)",
                      }}
                    />
                    <div className="relative flex items-center gap-5">
                      <div
                        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border font-mono"
                        style={{
                          borderColor: "color-mix(in oklch, var(--sec-1) 40%, transparent)",
                          background: "color-mix(in oklch, var(--sec-1) 8%, transparent)",
                        }}
                      >
                        <span className="text-lg font-bold" style={{ color: "var(--sec-1)" }}>
                          {p.metric}
                        </span>
                        <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                          {p.metricLabel}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div
                          className="mb-1 font-mono text-[10px] uppercase tracking-widest"
                          style={{ color: "color-mix(in oklch, var(--sec-1) 80%, transparent)" }}
                        >
                          {p.cat}
                        </div>
                        <h3 className="mb-1.5 text-lg font-bold text-foreground">{p.title}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                      </div>
                      <ArrowUpLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:text-[var(--sec-1)]" />
                    </div>
                  </TiltCard>
                </Reveal>
              ))}

              {/* Section-colored CTA */}
              <Reveal delay={0.3}>
                <a
                  href="#contact"
                  data-cursor-hover
                  className="btn-solid-sec group flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold transition-transform hover:scale-[1.01]"
                >
                  {s.cta.label}
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </a>
              </Reveal>
            </div>

            {/* Skills */}
            <Reveal delay={0.2} className="mt-6">
              <div className="rounded-2xl border border-border bg-surface-1 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Server className="h-4 w-4" style={{ color: "var(--sec-1)" }} />
                  {lang === "fa" ? "حوزه‌های تخصصی" : "Core expertise"}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {s.skills.map((sk, i) => {
                    const Icon = SKILL_ICONS[i % SKILL_ICONS.length];
                    return (
                      <div
                        key={sk.label + i}
                        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-3 py-2.5"
                      >
                        <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--sec-1)" }} />
                        <span className="text-xs text-foreground/80">{sk.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right: live terminal + network graph */}
          <div data-cms-node="terminal-and-network" data-cms-object className="order-1 lg:order-2">
            <Reveal>
              <InteractiveTerminal />
            </Reveal>
            <Reveal delay={0.15}>
              <NetworkGraph />
            </Reveal>
            <Reveal delay={0.25} className="mt-4">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-1 p-4">
                <span className="me-2 text-xs text-muted-foreground">{lang === "fa" ? "گواهینامه‌ها:" : "Certifications:"}</span>
                {s.certs.map((c) => (
                  <Chip key={c} color="var(--sec-1)">
                    {c}
                  </Chip>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      <AnimatePresence>{securityGallery.node}
        {galleryOpen && s.gallery && <VirtualGallery layout={( s.gallery as { layout?: GalleryLayout }).layout} projects={s.gallery.projects} title={s.gallery.title} subtitle={s.gallery.subtitle} onClose={() => { setGalleryOpen(false); securityGallery.onPopupClose(); }} />}</AnimatePresence>
    </section>
  );
}

/* === Animated network graph === */
function NetworkGraph() {
  const lang = useContent((s) => s.lang);
  const nodes = [
    { x: 50, y: 50, r: 6, label: "core", main: true },
    { x: 20, y: 25, r: 4, label: "web-01" },
    { x: 80, y: 25, r: 4, label: "db-01" },
    { x: 15, y: 70, r: 4, label: "api-01" },
    { x: 85, y: 70, r: 4, label: "cache" },
    { x: 50, y: 12, r: 3, label: "lb" },
    { x: 50, y: 88, r: 3, label: "log" },
  ];
  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
    [1, 5], [2, 5], [3, 6], [4, 6],
  ];

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <Network className="h-3 w-3" style={{ color: "var(--sec-1)" }} />
          {lang === "fa" ? "توپولوژی_شبکه.زنده" : "network_topology.live"}
        </div>
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--sec-1)" }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--sec-1)" }} />
          {lang === "fa" ? "برخط" : "online"}
        </span>
      </div>
      <svg viewBox="0 0 100 100" className="h-48 w-full">
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="color-mix(in oklch, var(--sec-1) 30%, transparent)"
            strokeWidth="0.3"
          />
        ))}
        {edges.map(([a, b], i) => (
          <motion.circle
            key={`p-${i}`}
            r="0.8"
            fill="var(--sec-1)"
            initial={{ cx: nodes[a].x, cy: nodes[a].y, opacity: 0 }}
            animate={{ cx: [nodes[a].x, nodes[b].x], cy: [nodes[a].y, nodes[b].y], opacity: [0, 1, 0] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, repeatDelay: 1 }}
          />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.main ? "var(--sec-1)" : "color-mix(in oklch, var(--sec-1) 50%, transparent)"}
              stroke="var(--sec-1)"
              strokeWidth="0.3"
              opacity={n.main ? 1 : 0.8}
            />
            {n.main && (
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill="none"
                stroke="var(--sec-1)"
                strokeWidth="0.3"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                animate={{ scale: [1, 3.2], opacity: [0.8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <text
              x={n.x}
              y={n.y - n.r - 1.5}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: "2.2px" }}
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
