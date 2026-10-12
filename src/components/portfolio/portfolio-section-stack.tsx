"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useContent } from "@/lib/content-store";
import { PlanetaryHero } from "@/components/portfolio/planetary-hero";
import { GraphicsSection } from "@/components/portfolio/graphics-section";
import { SecuritySection } from "@/components/portfolio/security-section";
import { AISection } from "@/components/portfolio/ai-section";
import { Synthesis } from "@/components/portfolio/synthesis";
import { TimelineSection } from "@/components/portfolio/timeline-section";
import { CustomSectionView } from "@/components/portfolio/custom-section-view";
import { SectionObjectLayer } from "@/components/portfolio/section-object-layer";
import { SectionFormLayer } from "@/components/portfolio/section-form-layer";
import { SectionResumeLayer } from "@/components/portfolio/section-resume-layer";
import { SectionVisualLayer } from "@/components/portfolio/section-visual-layer";
import { cn } from "@/lib/utils";
import { deviceContentOverride, deviceForWidth } from "@/lib/responsive-content";

const BUILTIN_RENDERERS: Record<string, () => ReactNode> = {
  hero: () => <PlanetaryHero />,
  graphics: () => <GraphicsSection />,
  security: () => <SecuritySection />,
  ai: () => <AISection />,
  timeline: () => <TimelineSection />,
  synthesis: () => <Synthesis />,
};

// Owner swapped the AI and Security worlds (2026-10): AI comes third now.
const DEFAULT_ORDER = ["hero", "graphics", "ai", "security", "timeline", "synthesis"];

/* `footer` is rendered separately by <SiteFooter /> (page.tsx) — its
   builder.sections entry only carries the #contact anchor, so the stack
   must not draw a placeholder card for it. */
const SKIP_IDS = new Set(["footer"]);

const FALLBACK_SECTION = {
  enabled: true,
  order: 0,
  anchor: "",
  layout: "wide" as const,
  paddingTop: 0,
  paddingBottom: 0,
  maxWidth: 1280,
  background: "transparent",
  accent: "var(--foreground)",
  textColor: "var(--foreground)",
  radius: 0,
  blur: 0,
  opacity: 1,
  link: "",
  hoverEffect: "none" as const,
  customClass: "",
};

export function PortfolioSectionStack() {
  const builder = useContent((s) => s.content.builder);
  const customs = useContent((s) => s.customs);
  const planets = useContent((s) => s.content.hero.planets);
  const lang = useContent((s) => s.lang);
  const [viewport, setViewport] = useState(1440);
  const device = deviceForWidth(viewport, builder);

  useEffect(() => {
    const update = () => setViewport(window.innerWidth);
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  const sections = useMemo(() => {
    const configured = builder?.sections?.length ? builder.sections : [];
    const configuredIds = new Set(configured.map((section) => section.id));
    const missingBuiltins = builder?.blankCanvas ? [] : DEFAULT_ORDER
      .filter((id) => !configuredIds.has(id))
      .map((id, index) => ({
        id,
        label: id,
        ...FALLBACK_SECTION,
        order: index + 1,
        anchor: id === "hero" ? "" : id,
      }));

    const responsive = builder?.responsive;
    const deviceConfig = responsive?.devices?.[device];
    const overrideEnabled = deviceConfig?.overrideEnabled ?? Boolean(deviceConfig?.sections?.length);
    const overrides = responsive?.enabled && overrideEnabled ? deviceConfig?.sections ?? [] : [];
    const overrideById = new Map(overrides.map((item) => [item.id, item]));
    return [...configured, ...missingBuiltins]
      .map((section) => {
        const override = overrideById.get(section.id);
        return override ? { ...section, enabled: override.enabled, order: override.order } : section;
      })
      .filter((section) => section.enabled !== false)
      .filter((section) => !SKIP_IDS.has(section.id))
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }, [builder, device]);

  return (
    <>
      {sections.map((section) => {
        const renderBuiltin = BUILTIN_RENDERERS[section.id];
        if (renderBuiltin) {
          return (
            <div
              key={section.id}
              // NOTE: do NOT add content-visibility:auto here — the
              // contain-intrinsic-size placeholder mismatches the real
              // section heights and makes the browser jump the scroll
              // position back up while scrolling (verified bug).
              className={cn("builder-section-shell section-gradient-boundary gpu relative overflow-hidden", section.customClass)}
              data-builder-section={section.id}
              data-builder-hover={section.hoverEffect}
            >
              {renderBuiltin()}
              <SectionObjectLayer sectionId={section.id} />
              <SectionFormLayer sectionId={section.id} />
              <SectionResumeLayer sectionId={section.id} />
              <SectionVisualLayer sectionId={section.id} />
            </div>
          );
        }

        // User-created custom section (custom-*) — renders its CMS data.
        const customData = customs[section.id];
        if (customData) {
          const planet = planets.find((p) => p.sectionId === section.id);
          const baseCustom = lang === "fa" ? customData.fa : customData.en;
          const customOverride = deviceContentOverride(builder, device, section.id);
          return (
            <div key={section.id} className="relative overflow-hidden">
              <CustomSectionView
                data={customOverride ?? baseCustom}
                section={section}
                accent={planet?.color}
                lang={lang}
              />
              <SectionObjectLayer sectionId={section.id} />
              <SectionFormLayer sectionId={section.id} />
              <SectionResumeLayer sectionId={section.id} />
              <SectionVisualLayer sectionId={section.id} />
            </div>
          );
        }

        return (
          <section
            key={section.id}
            id={section.anchor || section.id}
            className={cn("relative z-10 px-5", section.customClass)}
            data-builder-section={section.id}
              data-builder-hover={section.hoverEffect}
            >
              <SectionObjectLayer sectionId={section.id} />
              <SectionFormLayer sectionId={section.id} />
              <SectionResumeLayer sectionId={section.id} />
              <SectionVisualLayer sectionId={section.id} />
            <div className="mx-auto py-16" style={{ maxWidth: section.maxWidth || 1280 }}>
              <div className="border border-border/70 bg-background/45 p-6 backdrop-blur-xl cms-radius-card">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: section.accent || "var(--foreground)" }} />
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {lang === "fa" ? "سکشن سفارشی" : "Custom section"}
                  </p>
                </div>
                <h2 className="mt-4 text-3xl font-black text-foreground md:text-5xl">{section.label}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                  {lang === "fa"
                    ? "این سکشن هنوز محتوایی ندارد. از CMS داده آن را کامل کنید یا آن را غیرفعال کنید."
                    : "This section has no content yet. Fill its data from the CMS or disable it."}
                </p>
                {section.link && (
                  <a className="mt-5 inline-flex rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-1" href={section.link}>
                    {lang === "fa" ? "باز کردن لینک" : "Open link"}
                  </a>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
