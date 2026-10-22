// Server-side in-memory cache for CMS content.
//
// The site's content (hero, graphics, security, ai, footer, builder config, …)
// lives in a handful of SQLite rows and only changes when an admin edits it via
// the CMS — which is rare. Yet every page load was hitting the database and
// re-parsing/merging JSON. This module keeps the merged result in memory so a
// cache hit never touches the DB.
//
// The cache lives on `globalThis` (same pattern as the Prisma client in db.ts)
// so it survives module re-evaluation during HMR in dev and is shared across
// requests within a single Node.js process. For the single-instance Docker
// deployment this gives a ~99% reduction in DB load with zero external deps.
//
// Invalidated explicitly by the write paths (POST/PUT/DELETE) whenever an admin
// saves a change, so edits appear at most one TTL window late.

import { db } from "@/lib/db";
import { defaultContentFa, defaultContentEn } from "@/lib/default-content";
import { blankContentFa, blankContentEn } from "@/lib/blank-content";
import {
  SECTION_KEYS,
  type SectionKey,
  type Lang,
  type SiteContent,
} from "@/lib/content-types";
import { pinDeveloperData, sweepIdentityStrings } from "@/lib/vendor-identity";

/** How long a cached entry is considered fresh. Content is public and only
 *  changes through the CMS — every write path calls invalidateContent(), so
 *  a longer TTL costs nothing and most requests never touch the DB. */
const DEFAULT_TTL_MS = 300_000;

/** Full public content payload: built-in sections (merged with defaults)
 *  plus every `custom-*` section as-is for the page renderer. */
export type PublicContent = {
  fa: SiteContent;
  en: SiteContent;
  custom: Record<string, { fa: unknown; en: unknown }>;
};

type FullEntry = { value: PublicContent; storedAt: number };
type SectionEntry = { value: { fa: unknown; en: unknown }; storedAt: number };

type ContentCacheStore = {
  full: FullEntry | null;
  sections: Map<string, SectionEntry>;
  ttlMs: number;
};

const globalForCache = globalThis as unknown as { __contentCache?: ContentCacheStore };

const store: ContentCacheStore =
  globalForCache.__contentCache ??
  {
    full: null,
    sections: new Map(),
    ttlMs: DEFAULT_TTL_MS,
  };

if (!globalForCache.__contentCache) {
  globalForCache.__contentCache = store;
}

const IS_NULL_DISTRIBUTION = process.env.P00RIJA_DISTRIBUTION_MODE === "null";
const DEFAULTS: Record<Lang, SiteContent> = IS_NULL_DISTRIBUTION
  ? { fa: blankContentFa, en: blankContentEn }
  : { fa: defaultContentFa, en: defaultContentEn };

function defaultContainerFor(section: SectionKey): { fa: unknown; en: unknown } {
  return { fa: DEFAULTS.fa[section], en: DEFAULTS.en[section] };
}

function isCustomKey(section: string): boolean {
  return section.startsWith("custom-") && section.length > 7;
}

/** Merge DB rows into a bilingual content object (built-in keys only),
 *  collecting `custom-*` rows into a separate map. */
function mergeContent(rows: { section: string; data: string }[]): PublicContent {
  const out = {
    fa: { ...DEFAULTS.fa } as Record<SectionKey, unknown>,
    en: { ...DEFAULTS.en } as Record<SectionKey, unknown>,
  };
  const custom: Record<string, { fa: unknown; en: unknown }> = {};
  for (const row of rows) {
    let parsed: { fa?: unknown; en?: unknown } = {};
    try {
      const p = JSON.parse(row.data);
      if (p && typeof p === "object" && !Array.isArray(p)) parsed = p;
    } catch {
      continue;
    }
    if (isCustomKey(row.section)) {
      custom[row.section] = sweepIdentityStrings({
        fa: parsed.fa && typeof parsed.fa === "object" ? parsed.fa : {},
        en: parsed.en && typeof parsed.en === "object" ? parsed.en : {},
      });
      continue;
    }
    const section = row.section as SectionKey;
    if (!(SECTION_KEYS as string[]).includes(section)) continue;
    if (parsed.fa && typeof parsed.fa === "object") out.fa[section] = parsed.fa;
    if (parsed.en && typeof parsed.en === "object") out.en[section] = parsed.en;
  }
  // Identity sweep: legacy/placeholder vendor strings (old default rows,
  // stale DB data) never reach a visitor, and the developer section is
  // pinned to the official vendor identity at the source.
  for (const key of Object.keys(out.fa) as SectionKey[]) {
    out.fa[key] = sweepIdentityStrings(out.fa[key]);
  }
  for (const key of Object.keys(out.en) as SectionKey[]) {
    out.en[key] = sweepIdentityStrings(out.en[key]);
  }
  out.fa.developer = pinDeveloperData(out.fa.developer, "fa");
  out.en.developer = pinDeveloperData(out.en.developer, "en");
  return { fa: out.fa as unknown as SiteContent, en: out.en as unknown as SiteContent, custom };
}

/** Read the merged bilingual content object, from cache when fresh. */
export async function getContent(): Promise<PublicContent> {
  const now = Date.now();
  if (store.full && now - store.full.storedAt < store.ttlMs) {
    return store.full.value;
  }

  const rows = await db.content.findMany({ select: { section: true, data: true } });
  const value = mergeContent(rows);
  store.full = { value, storedAt: Date.now() };
  return value;
}

/** Read one section's bilingual data, from cache when fresh. */
export async function getContentSection(section: SectionKey): Promise<{ fa: unknown; en: unknown }> {
  const now = Date.now();
  const hit = store.sections.get(section);
  if (hit && now - hit.storedAt < store.ttlMs) {
    return hit.value;
  }

  const row = await db.content.findUnique({ where: { section } });
  let value: { fa: unknown; en: unknown };
  if (row) {
    try {
      const parsed = JSON.parse(row.data);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        value = parsed as { fa: unknown; en: unknown };
      } else {
        value = defaultContainerFor(section);
      }
    } catch {
      value = defaultContainerFor(section);
    }
  } else {
    value = defaultContainerFor(section);
  }

  store.sections.set(section, {
    value: section === "developer"
      ? { fa: pinDeveloperData(value.fa, "fa"), en: pinDeveloperData(value.en, "en") }
      : { fa: sweepIdentityStrings(value.fa), en: sweepIdentityStrings(value.en) },
    storedAt: Date.now(),
  });
  return store.sections.get(section)!.value;
}

/** Drop all cached content. Called after any admin write so the next read
 *  rebuilds from the database. Cheap (clears maps) and safe to call often. */
export function invalidateContent(): void {
  store.full = null;
  store.sections.clear();
}
