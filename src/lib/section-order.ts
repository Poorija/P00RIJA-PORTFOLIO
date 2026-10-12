/* ============================================================
 * Section order — ONE source of truth.
 *
 * The CMS sections manager (builder.sections[].order) already drives the
 * page stack. This module derives everything else from the SAME order so a
 * drag-and-drop reorder in the CMS automatically renumbers badges (01/02/03),
 * reorders the left journey rail, and re-sorts the CMS sidebar — no stored
 * "index" fields to keep in sync, ever.
 * ============================================================ */

import type { Lang, SiteContent } from "@/lib/content-types";

/** The three numbered "worlds" that carry a big index badge. */
export const WORLD_SECTIONS = ["graphics", "security", "ai"] as const;
export type WorldId = (typeof WORLD_SECTIONS)[number];

/** Fallback when the CMS has no explicit section order yet. */
export const DEFAULT_WORLD_ORDER: WorldId[] = ["graphics", "ai", "security"];

/** Effective world order from the CMS builder (missing entries appended). */
export function worldOrder(content: SiteContent | undefined | null): WorldId[] {
  const configured = content?.builder?.sections;
  const ordered = (configured ?? [])
    .filter((s) => (WORLD_SECTIONS as readonly string[]).includes(s.id) && s.enabled !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((s) => s.id as WorldId);
  const missing = DEFAULT_WORLD_ORDER.filter((id) => !ordered.includes(id));
  return [...ordered, ...missing];
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** "02" for en, "۰۲" for fa — the badge format the sections render. */
export function badgeFor(position: number, lang: Lang): string {
  const latin = String(position).padStart(2, "0");
  return lang === "fa" ? latin.replace(/\d/g, (d) => FA_DIGITS[Number(d)]) : latin;
}

/**
 * Rewrite each world section's `index` badge to match its position in the
 * CMS order (returns a new object; no-op when already consistent).
 */
export function renumberWorldIndexes(content: SiteContent, lang: Lang): SiteContent {
  const order = worldOrder(content);
  let changed = false;
  const next: Record<string, unknown> = { ...content };
  order.forEach((id, i) => {
    const badge = badgeFor(i + 1, lang);
    const section = next[id] as { index?: string } | undefined;
    if (section && section.index !== badge) {
      next[id] = { ...section, index: badge };
      changed = true;
    }
  });
  return (changed ? next : content) as SiteContent;
}
