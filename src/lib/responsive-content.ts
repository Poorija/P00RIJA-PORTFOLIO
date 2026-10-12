import type { BuilderConfig, BuilderDevice, SiteContent } from "@/lib/content-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeSnapshot<T>(base: T, override: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(override) ? override : base) as T;
  if (!isRecord(base)) return (override ?? base) as T;
  if (!isRecord(override)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in base ? mergeSnapshot(base[key], value) : value;
  }
  return out as T;
}

export function deviceForWidth(width: number, builder: BuilderConfig): BuilderDevice {
  const mobile = Number(builder.responsive?.mobileBreakpoint || 640);
  const tablet = Number(builder.responsive?.tabletBreakpoint || 1024);
  return width <= mobile ? "mobile" : width <= tablet ? "tablet" : "desktop";
}

export function deviceContentOverride(
  builder: BuilderConfig,
  device: BuilderDevice,
  sectionId: string,
): unknown {
  return builder.deviceContentOverrides?.[device]?.[sectionId];
}

/** Resolve the public content for the current viewport without mutating raw CMS data. */
export function resolveResponsiveContent(base: SiteContent, width: number): SiteContent {
  const baseBuilder = base.builder;
  const device = deviceForWidth(width, baseBuilder);
  const overrides = baseBuilder.deviceContentOverrides?.[device];
  if (!overrides || !Object.keys(overrides).length) return base;

  const resolved = { ...base } as SiteContent;
  for (const [sectionId, snapshot] of Object.entries(overrides)) {
    // The signed developer identity is deliberately never device-overridable.
    if (sectionId === "developer" || !(sectionId in base)) continue;
    if (sectionId === "builder") continue;
    const key = sectionId as keyof SiteContent;
    (resolved as unknown as Record<string, unknown>)[key] = mergeSnapshot(
      (base as unknown as Record<string, unknown>)[key],
      snapshot,
    );
  }

  const builderSnapshot = overrides.builder;
  if (isRecord(builderSnapshot)) {
    resolved.builder = {
      ...mergeSnapshot(baseBuilder, builderSnapshot),
      // Never allow a nested snapshot to hide or recursively duplicate the map.
      deviceContentOverrides: baseBuilder.deviceContentOverrides,
    };
  }
  return resolved;
}
