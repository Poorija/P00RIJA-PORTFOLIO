import { defaultContentEn, defaultContentFa } from "@/lib/default-content";
import type { Lang, SiteContent } from "@/lib/content-types";

/**
 * Factory Reset intentionally creates an empty portfolio, not a restored demo.
 * Structural/runtime settings survive so the CMS remains usable and the owner
 * can build again from a clean canvas.
 */
export function makeBlankContent(lang: Lang): SiteContent {
  const source = lang === "fa" ? defaultContentFa : defaultContentEn;
  const blank = structuredClone(source);

  blank.site = emptyContent(blank.site);

  // Empty every public content section while retaining its valid schema.
  blank.hero = emptyContent(blank.hero);
  blank.graphics = emptyContent(blank.graphics);
  blank.security = emptyContent(blank.security);
  blank.ai = emptyContent(blank.ai);
  blank.synthesis = emptyContent(blank.synthesis);
  blank.timeline = emptyContent(blank.timeline);
  blank.profile = emptyContent(blank.profile);
  blank.footer = emptyContent(blank.footer);

  blank.music = {
    ...blank.music,
    enabled: false,
    tracks: [],
    radio: { ...blank.music.radio, enabled: false, stations: [] },
  };
  blank.forms = { ...blank.forms, forms: [] };
  blank.design = {
    ...blank.design,
    objects: [],
    background: {
      ...blank.design.background,
      blobs: [],
      comets: { ...blank.design.background.comets, enabled: false },
    },
  };
  blank.meteors = {
    ...blank.meteors,
    ambient: { ...blank.meteors.ambient, enabled: false },
    shower: { ...blank.meteors.shower, enabled: false },
  };
  blank.builder = {
    ...blank.builder,
    blankCanvas: true,
    navigation: [],
    sections: [],
    components: [],
    animations: [],
    meteor: { ...blank.builder.meteor, enabled: false },
    // A null canvas must not leak even an empty branded header.
    header: { ...blank.builder.header, enabled: false },
  };
  // `developer` is deliberately not touched. It is immutable without the
  // owner's cryptographic unlock and is the sole identity retained by reset.
  return blank;
}

function emptyContent<T>(value: T): T {
  if (typeof value === "string") return "" as T;
  if (Array.isArray(value)) return [] as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, emptyContent(child)])
    ) as T;
  }
  return value;
}

export const blankContentFa = makeBlankContent("fa");
export const blankContentEn = makeBlankContent("en");
