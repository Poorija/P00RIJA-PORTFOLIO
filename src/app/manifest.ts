import type { MetadataRoute } from "next";
import { getContentSection } from "@/lib/content-cache";
import type { PwaConfig } from "@/lib/content-types";

// The manifest is CMS-managed and can change at ANY time (icons, name,
// colors) — never allow Next to prerender it at build time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// The PWA manifest is CMS-managed (CMS → «PWA و نصب روی گوشی»).
// The stored row is global (identical for fa/en — the CMS form writes both);
// fields absent from the stored row fall back to the built-in defaults.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let stored: Partial<PwaConfig> = {};
  try {
    const container = await getContentSection("pwa");
    // PWA settings are global; a field may have been saved under one language
    // only (legacy rows) — merge per-field: English first, Persian fallback,
    // first non-empty value wins.
    const en = (container?.en ?? {}) as Record<string, unknown>;
    const fa = (container?.fa ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(en), ...Object.keys(fa)])) {
      const fromEn = en[key];
      const fromFa = fa[key];
      // First NON-EMPTY value wins (legacy rows saved icons under one lang only).
      const value = fromEn !== "" && fromEn != null ? fromEn : fromFa;
      if (value !== "" && value != null) merged[key] = value;
    }
    stored = merged as Partial<PwaConfig>;
  } catch {
    // Database hiccup → built-in defaults below.
  }
  const defaults: PwaConfig = {
    name: "P00RIJA Portfolio",
    shortName: "P00RIJA",
    description: "A creative multi-disciplinary portfolio — graphic design, Linux network security and AI.",
    lang: "en",
    dir: "ltr",
    startUrl: "/",
    display: "standalone",
    orientation: "any",
    themeColor: "#0a0a12",
    backgroundColor: "#0a0a12",
    iconSvg: "/logo.svg",
    icon192: "",
    icon512: "",
    iconMaskable512: "",
    appleTouchIcon: "",
    categories: "",
  };
  const cfg = { ...defaults, ...Object.fromEntries(Object.entries(stored).filter(([, v]) => v !== "" && v != null)) } as PwaConfig;

  const icons: MetadataRoute.Manifest["icons"] = [];
  if (cfg.iconSvg) {
    icons.push({
      src: cfg.iconSvg,
      sizes: "any",
      type: cfg.iconSvg.endsWith(".svg") ? "image/svg+xml" : "image/png",
      purpose: "any",
    });
  }
  if (cfg.icon192) icons.push({ src: cfg.icon192, sizes: "192x192", type: "image/png", purpose: "any" });
  if (cfg.icon512) icons.push({ src: cfg.icon512, sizes: "512x512", type: "image/png", purpose: "any" });
  if (cfg.iconMaskable512) icons.push({ src: cfg.iconMaskable512, sizes: "512x512", type: "image/png", purpose: "maskable" });

  const categories = cfg.categories
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  return {
    name: cfg.name,
    short_name: cfg.shortName,
    description: cfg.description,
    lang: cfg.lang,
    dir: cfg.dir,
    start_url: cfg.startUrl || "/",
    display: cfg.display,
    orientation: cfg.orientation,
    background_color: cfg.backgroundColor,
    theme_color: cfg.themeColor,
    categories: categories.length ? categories : undefined,
    icons,
  };
}
