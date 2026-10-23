/* Pure Access-Guard target helpers — shared by the server (strip logic,
 * protection API) and client bundles (gallery cards, CMS panel). No
 * node-only imports: this file must stay bundle-safe.
 *
 * Per-PROJECT locks inside a gallery use the target form:
 *   proj:<sectionId>:<slug-of-project-title>
 * e.g. proj:graphics:brand-identity — one lock per project, in every
 * gallery (builtin graphics/security/ai or any custom section). */

export const PROJECT_TARGET_PREFIX = "proj:";

/** Stable slug of a project title (whitespace/:/?/# → dashes). Persian
 *  titles keep their unicode letters — both languages produce the SAME
 *  target only per-language; the server syncs locked indices across fa/en
 *  so one arm locks the project in both languages. */
export function projectSlug(title: string): string {
  const s = String(title ?? "")
    .trim()
    .replace(/[\s:/?#]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return s || "untitled";
}

/** Lock target for one gallery project. */
export function projectTarget(sectionId: string, title: string): string {
  return `${PROJECT_TARGET_PREFIX}${sectionId}:${projectSlug(title)}`;
}

/** Parse a proj: target → { sectionId, slug } | null. */
export function parseProjectTarget(target: string): { sectionId: string; slug: string } | null {
  if (!target.startsWith(PROJECT_TARGET_PREFIX)) return null;
  const rest = target.slice(PROJECT_TARGET_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0) return null;
  const sectionId = rest.slice(0, sep);
  const slug = rest.slice(sep + 1);
  if (!sectionId || !slug) return null;
  return { sectionId, slug };
}
