"use client";

/* ==================================================================
 * CustomSectionView — renders a user-created (custom-*) section from
 * CMS data: badge, title, subtitle, body, key/value items, CTA, and
 * an OPTIONAL fullscreen project gallery (same VirtualGallery the
 * builtin sections use). Each section's gallery carries its own
 * Access Guard lock (`gallery:custom-*`) if the owner sets one.
 * Accent color can come from the section's linked planet.
 * ================================================================== */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Frame } from "lucide-react";
import { VirtualGallery } from "./virtual-gallery";
import { useGalleryGate } from "./section-guard";
import { useContent } from "@/lib/content-store";
import type { BuilderSectionConfig, CustomSectionData, PortfolioGalleryConfig } from "@/lib/content-types";

const fade = (c: string, pct = 50) => `color-mix(in oklch, ${c} ${100 - pct}%, transparent)`;

function normalize(data: unknown): CustomSectionData {
  const d = (data ?? {}) as Partial<CustomSectionData>;
  return {
    title: typeof d.title === "string" ? d.title : "",
    subtitle: typeof d.subtitle === "string" ? d.subtitle : "",
    body: typeof d.body === "string" ? d.body : "",
    items: Array.isArray(d.items)
      ? d.items.map((it, i) => ({
          key: typeof it?.key === "string" ? it.key : `— ${i + 1}`,
          value: typeof it?.value === "string" ? it.value : "",
        }))
      : [],
    ctaLabel: typeof d.ctaLabel === "string" ? d.ctaLabel : "",
    ctaUrl: typeof d.ctaUrl === "string" ? d.ctaUrl : "",
    badge: typeof d.badge === "string" ? d.badge : "",
    gallery:
      d.gallery && typeof d.gallery === "object" && Array.isArray((d.gallery as PortfolioGalleryConfig).projects)
        ? d.gallery
        : null,
  };
}

export function CustomSectionView({
  data,
  section,
  accent,
  lang,
}: {
  data: unknown;
  section: BuilderSectionConfig;
  accent?: string;
  lang: "fa" | "en";
}) {
  const view = normalize(data);
  const color = accent || section.accent || "var(--ai-1)";
  const [galleryOpen, setGalleryOpen] = useState(false);
  const guardSections = useContent((s) => s.guardSections);
  const galleryGate = useGalleryGate(section.id, section.label || section.id);
  // A lock armed for this gallery keeps the entry button alive even while
  // the gallery payload itself is withheld server-side.
  const galleryLockActive = Boolean(
    guardSections[`gallery:${section.id}`]?.enabled && guardSections[`gallery:${section.id}`]?.hasPassword
  );
  const showGallery = Boolean(view.gallery && (view.gallery.projects?.length || view.gallery.title)) || galleryLockActive;

  return (
    <section
      id={section.anchor || section.id}
      className="relative z-10 px-5"
      data-builder-section={section.id}
    >
      <div className="mx-auto max-w-5xl py-16">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-card/45 p-6 backdrop-blur-xl md:p-10"
        >
          {/* ambient glow */}
          <div
            className="pointer-events-none absolute -top-24 end-[-6rem] h-64 w-64 rounded-full"
            style={{ background: `radial-gradient(circle, ${fade(color, 78)}, transparent 70%)`, filter: "blur(30px)" }}
          />

          {view.badge && (
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em]"
              style={{ borderColor: fade(color, 65), color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
              {view.badge}
            </span>
          )}

          <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">
            {view.title || section.label}
          </h2>
          {view.subtitle && (
            <p className="mt-2 text-base font-medium" style={{ color }}>{view.subtitle}</p>
          )}
          {view.body && (
            <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-base">
              {view.body}
            </p>
          )}

          {view.items.length > 0 && (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {view.items.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i }}
                  className="group rounded-2xl border border-border bg-background/40 p-4 transition-colors"
                  style={{ ["--acc" as string]: color }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform group-hover:scale-150"
                      style={{ background: color }}
                    />
                    <p className="text-sm font-bold text-foreground">{item.key}</p>
                  </div>
                  {item.value && (
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{item.value}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {showGallery && (
            <button
              onClick={() => galleryGate.gate(() => setGalleryOpen(true))}
              data-cursor-hover
              data-cms-node="gallery-button"
              className="group mt-8 inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition-all hover:gap-3"
              style={{ borderColor: fade(color, 40), color, background: fade(color, 94) }}
            >
              <Frame className="h-4 w-4 transition-transform group-hover:rotate-3" style={{ color }} />
              {view.gallery?.enterLabel?.trim() || (lang === "fa" ? "ورود به گالری سه‌بعدی" : "Enter the virtual gallery")}
            </button>
          )}

          {view.ctaLabel && view.ctaUrl && (
            <a
              href={view.ctaUrl}
              target={view.ctaUrl.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              data-cursor-hover
              className="ms-0 mt-8 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition-all hover:gap-3"
              style={{ borderColor: fade(color, 45), color, background: fade(color, 94) }}
            >
              {view.ctaLabel}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {galleryOpen && view.gallery && (
          <VirtualGallery
            layout={view.gallery.layout}
            projects={view.gallery.projects}
            title={view.gallery.title}
            subtitle={view.gallery.subtitle}
            onClose={() => { setGalleryOpen(false); galleryGate.onPopupClose(); }}
          />
        )}
      </AnimatePresence>
      {galleryGate.node}
    </section>
  );
}
