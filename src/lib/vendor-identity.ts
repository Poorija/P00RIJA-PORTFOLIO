/* ============================================================
 * Vendor identity — single, frozen source of truth.
 *
 * These are the seller's identity fields. They are pinned at
 * THREE layers so no runtime path can change them:
 *   1. Write paths — both content API routes sanitize any
 *      "developer" section through pinDeveloperData() before
 *      persisting, so even an unlocked developer-owner session
 *      (or a forged DB write) cannot store different values.
 *   2. Read paths — GET /api/content/developer returns pinned
 *      data, and the public /api/content payload is normalized.
 *   3. Render — DeveloperCard merges pinDeveloperConfig() over
 *      whatever the CMS store holds, so stale/tampered rows in
 *      a browser cache still render the official identity.
 *
 * Cosmetic text (role, description, donation copy) stays
 * CMS-editable behind the developer-owner key; identity does not.
 * Changing identity requires shipping a new build of the app.
 * ============================================================ */

export interface VendorIdentity {
  readonly nameFa: string;
  readonly nameEn: string;
  readonly email: string;
  readonly github: string;
  readonly wallet: string;
  readonly license: string;
  readonly licenseUrl: string;
}

export const VENDOR_IDENTITY: VendorIdentity = Object.freeze({
  nameFa: "محمدمهدی فرهادیان‌فرد (پوریا)",
  nameEn: "Mohammadmahdi Farhadianfard (Poorija)",
  email: "p00rija@tutamail.com",
  github: "https://github.com/Poorija",
  wallet: "UQCEgGxRZ5A101w6RBNLwHhnva5EdK3kyDsFQcxni35DlCJf",
  license: "GPL-3.0",
  licenseUrl: "https://www.gnu.org/licenses/gpl-3.0.html",
});

/** The one identity value that must never diverge between builds. */
export const VENDOR_EMAIL = VENDOR_IDENTITY.email;
export const VENDOR_WALLET = VENDOR_IDENTITY.wallet;

type Lang = "fa" | "en";

export function vendorName(lang: Lang): string {
  return lang === "fa" ? VENDOR_IDENTITY.nameFa : VENDOR_IDENTITY.nameEn;
}

/**
 * Force the official identity fields onto a developer-section payload.
 * `input` may be anything (untrusted CMS data); the result keeps the
 * cosmetic fields but always carries the official identity.
 */
export function pinDeveloperData<T>(input: T, lang: Lang): T {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const source = (input ?? {}) as Record<string, unknown>;
  return {
    ...source,
    name: vendorName(lang),
    email: VENDOR_IDENTITY.email,
    github: VENDOR_IDENTITY.github,
    wallet: VENDOR_IDENTITY.wallet,
    license: VENDOR_IDENTITY.license,
    licenseUrl: VENDOR_IDENTITY.licenseUrl,
  } as T;
}

/**
 * Apply the pin across a bilingual section container ({ fa, en, _meta }).
 * Missing languages are left untouched (defaults fill them at render).
 */
export function pinDeveloperContainer(container: unknown): unknown {
  if (!container || typeof container !== "object" || Array.isArray(container)) return container;
  const source = container as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  if (next.fa && typeof next.fa === "object" && !Array.isArray(next.fa)) {
    next.fa = pinDeveloperData(next.fa, "fa");
  }
  if (next.en && typeof next.en === "object" && !Array.isArray(next.en)) {
    next.en = pinDeveloperData(next.en, "en");
  }
  return next;
}

/* Legacy/placeholder identity strings that must never reach a visitor,
 * wherever they were stored (old DB rows, backups, CMS drafts). Applied
 * server-side to every content read in addition to the client-side maps. */
const LEGACY_IDENTITY_STRINGS: Readonly<Record<string, string>> = Object.freeze({
  "hello@portfolio.dev": VENDOR_IDENTITY.email,
  [`mailto:hello@portfolio.dev`]: `mailto:${VENDOR_IDENTITY.email}`,
  "mohammadmahdi.farhadianfard@gmail.com": VENDOR_IDENTITY.email,
  [`mailto:mohammadmahdi.farhadianfard@gmail.com`]: `mailto:${VENDOR_IDENTITY.email}`,
});

/** Deep string sweep — replaces legacy identity strings anywhere in a tree. */
export function sweepIdentityStrings<T>(value: T): T {
  if (typeof value === "string") return (LEGACY_IDENTITY_STRINGS[value] ?? value) as T;
  if (Array.isArray(value)) return value.map(sweepIdentityStrings) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sweepIdentityStrings(item)])
  ) as T;
}
