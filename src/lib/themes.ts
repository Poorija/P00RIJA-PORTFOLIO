// Theme registry — the single source of truth for the 7 site themes.
// Each id maps to a `[data-theme="<id>"]` variable block in globals.css.
// `dark` decides sonner/overlay styling and color-scheme hints.

export const THEME_IDS = [
  "dark",
  "light",
  "mint-dark",
  "mint-light",
  "royal-dark",
  "royal-light",
  "sunset",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeMeta {
  id: ThemeId;
  fa: string;
  en: string;
  emoji: string;
  dark: boolean;
  /** three swatch colors for the picker UI */
  swatch: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: "dark",
    fa: "فضای تیره",
    en: "Deep Space",
    emoji: "🌌",
    dark: true,
    swatch: ["oklch(0.13 0.018 280)", "oklch(0.72 0.27 350)", "oklch(0.7 0.18 300)"],
  },
  {
    id: "light",
    fa: "روشن",
    en: "Daylight",
    emoji: "☀️",
    dark: false,
    swatch: ["oklch(0.985 0.006 280)", "oklch(0.55 0.26 350)", "oklch(0.5 0.22 300)"],
  },
  {
    id: "mint-dark",
    fa: "نعنایی تیره",
    en: "Mint Nebula",
    emoji: "🌿",
    dark: true,
    swatch: ["oklch(0.13 0.03 178)", "oklch(0.78 0.16 165)", "oklch(0.8 0.15 345)"],
  },
  {
    id: "mint-light",
    fa: "نعنایی روشن",
    en: "Fresh Mint",
    emoji: "🍃",
    dark: false,
    swatch: ["oklch(0.978 0.012 168)", "oklch(0.55 0.14 168)", "oklch(0.58 0.23 345)"],
  },
  {
    id: "royal-dark",
    fa: "بنفش رویال تیره",
    en: "Royal Court",
    emoji: "👑",
    dark: true,
    swatch: ["oklch(0.15 0.05 293)", "oklch(0.72 0.19 293)", "oklch(0.8 0.15 52)"],
  },
  {
    id: "royal-light",
    fa: "بنفش رویال روشن",
    en: "Lavender Court",
    emoji: "💜",
    dark: false,
    swatch: ["oklch(0.975 0.016 300)", "oklch(0.52 0.22 293)", "oklch(0.56 0.24 322)"],
  },
  {
    id: "sunset",
    fa: "غروب",
    en: "Sunset",
    emoji: "🌅",
    dark: true,
    swatch: ["oklch(0.16 0.038 32)", "oklch(0.76 0.17 48)", "oklch(0.72 0.17 305)"],
  },
];

export function isDarkTheme(theme: string | undefined): boolean {
  return THEMES.find((t) => t.id === theme)?.dark ?? true;
}

export function themeMeta(theme: string | undefined): ThemeMeta {
  return THEMES.find((t) => t.id === theme) ?? THEMES[0];
}

/** Cycle to the next theme (used by the "T" hotkey roulette easter egg). */
export function nextTheme(current: string | undefined): ThemeId {
  const index = THEME_IDS.indexOf((current ?? "dark") as ThemeId);
  const safeIndex = index < 0 ? 0 : index;
  return THEME_IDS[(safeIndex + 1) % THEME_IDS.length];
}
