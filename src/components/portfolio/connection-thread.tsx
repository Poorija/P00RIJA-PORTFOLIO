"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useContent } from "@/lib/content-store";

/* ============================================================
 * ConnectionThread — fully dynamic left vertical navigation rail.
 *
 * Reads the CMS builder section order and builds the rail from
 * whatever sections exist — built-ins, custom sections, any order.
 * The DOM element for each section uses `anchor || id` (same logic
 * as PortfolioSectionStack), so the rail always matches the page.
 *
 * When at the very top (hero section), no node is selected.
 * ============================================================ */

interface RailNode {
  /** The actual DOM element id to observe/scroll to. */
  domId: string;
  /** Display label. */
  label: string;
  color: string;
  glow: string;
}

const SECTION_STYLES: Record<string, { nameFa: string; nameEn: string; color: string; glow: string }> = {
  graphics:  { nameFa: "گرافیک",       nameEn: "Graphics",   color: "var(--gfx-1)", glow: "var(--gfx-glow)" },
  ai:        { nameFa: "هوش مصنوعی",  nameEn: "AI",         color: "var(--ai-1)",  glow: "var(--ai-glow)" },
  security:  { nameFa: "امنیت",        nameEn: "Security",   color: "var(--sec-1)", glow: "var(--sec-glow)" },
  timeline:  { nameFa: "مسیر حرفه‌ای", nameEn: "Journey",    color: "var(--sec-1)", glow: "var(--sec-glow)" },
  synthesis: { nameFa: "ترکیب",        nameEn: "Synthesis",  color: "var(--ai-1)",  glow: "var(--ai-glow)" },
  footer:    { nameFa: "تماس",         nameEn: "Contact",    color: "var(--gfx-1)", glow: "var(--gfx-glow)" },
};

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function ConnectionThread() {
  const lang = useContent((s) => s.lang);
  const builder = useContent((s) => s.content.builder);
  const [active, setActive] = useState<string>("");
  const rafRef = useRef(0);

  // Build the rail from builder sections — fully dynamic
  const nodes = useMemo<RailNode[]>(() => {
    const configured = (builder?.sections ?? [])
      .filter((s) => s.enabled !== false && s.id !== "hero" && s.id !== "footer")
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    const result: RailNode[] = configured.map((s) => {
      const meta = SECTION_STYLES[s.id];
      const domId = s.anchor || s.id;
      return {
        domId,
        label: meta
          ? (lang === "fa" ? meta.nameFa : meta.nameEn)
          : (s.label || s.id),
        color: meta?.color ?? "var(--ai-1)",
        glow: meta?.glow ?? "var(--ai-glow)",
      };
    });

    // Add Contact (footer) at the end
    const footerSection = (builder?.sections ?? []).find((s) => s.id === "footer" && s.enabled !== false);
    if (footerSection) {
      result.push({
        domId: footerSection.anchor || "contact",
        label: lang === "fa" ? "تماس" : "Contact",
        color: "var(--gfx-1)",
        glow: "var(--gfx-glow)",
      });
    }

    return result.slice(0, 8);
  }, [builder?.sections, lang]);

  // Track which section is in view — with proper top/bottom edge handling
  useEffect(() => {
    if (!nodes.length) return;

    const sections = nodes
      .map((n) => document.getElementById(n.domId))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;

    const check = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const viewH = window.innerHeight;
        const docH = document.documentElement.scrollHeight;

        // At/near the very top → no selection
        if (scrollY < viewH * 0.3) {
          setActive("");
          return;
        }

        // At the very bottom → select the last section
        if (scrollY + viewH >= docH - 60) {
          setActive(nodes[nodes.length - 1]?.domId ?? "");
          return;
        }

        // Find the section that occupies the middle of the viewport
        let found = "";
        const midPoint = scrollY + viewH * 0.45;
        for (let i = sections.length - 1; i >= 0; i--) {
          const rect = sections[i].getBoundingClientRect();
          if (rect.top <= viewH * 0.55 && rect.bottom >= viewH * 0.35) {
            found = nodes[i]?.domId ?? "";
            break;
          }
        }
        setActive(found);
      });
    };

    // Listen to both native scroll and Lenis
    window.addEventListener("scroll", check, { passive: true });
    // Initial check
    check();

    return () => {
      window.removeEventListener("scroll", check);
      cancelAnimationFrame(rafRef.current);
    };
  }, [nodes]);

  const railHeight = Math.min(420, Math.max(180, nodes.length * 62));

  const badge = (pos: number) => {
    const latin = String(pos).padStart(2, "0");
    return lang === "fa" ? latin.replace(/\d/g, (d) => FA_DIGITS[Number(d)]) : latin;
  };

  return (
    <div
      className="pointer-events-none fixed start-5 top-1/2 z-[70] hidden -translate-y-1/2 lg:block"
      aria-hidden
    >
      <div className="relative flex flex-col items-center justify-between" style={{ height: railHeight, width: 60 }}>
        {/* vertical track */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-[var(--gfx-1)]/30 via-[var(--ai-1)]/30 to-[var(--sec-1)]/30" />

        {/* flowing particles */}
        <svg
          className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 overflow-visible"
          viewBox={`0 0 2 ${railHeight}`}
          preserveAspectRatio="none"
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.circle
              key={i}
              r="2"
              fill="white"
              initial={{ cy: -10, opacity: 0 }}
              animate={{ cy: railHeight + 10, opacity: [0, 0.5, 0.5, 0] }}
              transition={{ duration: 4, delay: i * 1, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </svg>

        {/* nodes */}
        {nodes.map((n, i) => {
          const isActive = active === n.domId;
          return (
            <button
              key={n.domId}
              onClick={() => {
                document
                  .getElementById(n.domId)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="pointer-events-auto group relative flex h-10 w-10 items-center justify-center"
              aria-label={n.label}
            >
              {isActive && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ border: `1px solid ${n.color}` }}
                  animate={{ scale: [1, 1.8], opacity: [0.8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <span
                className="relative grid h-9 w-9 place-items-center rounded-full border transition-all duration-500"
                style={{
                  borderColor: isActive ? n.color : "rgba(255,255,255,0.15)",
                  background: isActive
                    ? `radial-gradient(circle, ${n.color}33, transparent 70%)`
                    : "oklch(0.13 0.018 280)",
                  boxShadow: isActive ? `0 0 24px ${n.glow}` : "none",
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full transition-all duration-500"
                  style={{
                    background: n.color,
                    boxShadow: isActive ? `0 0 12px ${n.color}` : "none",
                    transform: isActive ? "scale(1.2)" : "scale(0.7)",
                  }}
                />
              </span>
              <span
                className="absolute start-full ms-3 whitespace-nowrap font-mono text-[10px] tracking-widest transition-opacity duration-300"
                style={{
                  color: isActive ? n.color : "rgba(255,255,255,0.3)",
                  opacity: isActive ? 1 : 0.4,
                }}
              >
                {badge(i + 1)} · {n.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
