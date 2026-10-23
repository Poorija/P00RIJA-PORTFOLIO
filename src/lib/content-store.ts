"use client";

import { create } from "zustand";
import type { SiteContent, SectionKey, Lang } from "@/lib/content-types";
import { defaultContentFa, defaultContentEn } from "@/lib/default-content";
import { getT, type TranslationKey } from "@/lib/i18n";
import { resolveResponsiveContent } from "@/lib/responsive-content";
import { renumberWorldIndexes } from "@/lib/section-order";

const CONTENT_CACHE_KEY = "p00rija-content-cache-v1";
let contentRequestId = 0;

/* ---------- Access Guard (site/section password protection) ---------- */

export type GuardLockKind = "pin4" | "pin6" | "text";
export type GuardLockMode = "permanent" | "attempts";

export interface GuardLockInfo {
  target: string;
  enabled: boolean;
  kind: GuardLockKind;
  mode: GuardLockMode;
  maxAttempts: number;
  failedAttempts: number;
  disabled: boolean;
  hasPassword: boolean;
  hasTempPassword: boolean;
  tempExpiresAt: number;
  unlockDays: number;
  idleMinutes: number;
  relockOnExit: boolean;
  updatedAt: number;
}

interface ContentState {
  contentFa: SiteContent;
  contentEn: SiteContent;
  lang: Lang;
  content: SiteContent; // active language's content (derived)
  viewportWidth: number;
  customs: Record<string, { fa: unknown; en: unknown }>; // custom-* section data
  loading: boolean;
  loaded: boolean;
  cmsOpen: boolean;
  authed: boolean;
  authChecked: boolean;
  guardSite: GuardLockInfo | null;
  guardSections: Record<string, GuardLockInfo>;
  guardUnlocked: string[];
  /** per-target epoch ms of the last unlock (idle re-lock baseline) */
  guardUnlockedAt: Record<string, number>;
  guardLoaded: boolean;
  // actions
  fetchContent: (force?: boolean) => Promise<void>;
  /** Clear the browser cache and re-fetch — used after instant CMS writes. */
  refreshContent: () => Promise<void>;
  fetchGuard: () => Promise<void>;
  /** Fetch guard + content and apply both in ONE store update (single render). */
  applyGuardAndContentRefresh: () => Promise<boolean>;
  relockGuards: (targets: string[]) => Promise<void>;
  unlockGuard: (target: string, password: string) => Promise<{
    status: "ok" | "wrong" | "disabled" | "rate" | "blocked" | "error";
    remaining?: number;
  }>;
  setLang: (lang: Lang) => void;
  setViewportWidth: (width: number) => void;
  updateSection: (section: SectionKey, data: unknown) => Promise<boolean>;
  setCmsOpen: (open: boolean) => void;
  checkAuth: () => Promise<void>;
  login: (password: string, code?: string) => Promise<{
    status: "ok" | "2fa" | "error";
    locked?: boolean;
    retryAfterSecs?: number;
    attemptsLeft?: number;
  }>;
  logout: () => Promise<void>;
  t: (key: TranslationKey) => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMergeDefaults<T>(defaults: T, incoming: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(incoming) ? incoming : defaults) as T;
  }

  if (isRecord(defaults)) {
    const source = isRecord(incoming) ? incoming : {};
    const out: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(defaults), ...Object.keys(source)]);

    keys.forEach((key) => {
      if (key in defaults) {
        out[key] = deepMergeDefaults(defaults[key], source[key]);
      } else {
        out[key] = source[key];
      }
    });

    return out as T;
  }

  return (incoming ?? defaults) as T;
}

const BUILTIN_RADIO_URLS: Record<string, string> = {
  "soma-space": "/api/radio/spacestation",
  "soma-groove": "/api/radio/groovesalad",
  "soma-drone": "/api/radio/dronezone",
  "soma-lush": "/api/radio/lush",
};

// Post-normalization applied to EVERY content snapshot entering the store:
//  1. builtin radio URLs are forced to the app proxy
//  2. world index badges (01/02/03) are renumbered from the CMS section
//     order — a drag-and-drop reorder in the CMS renumbers the site instantly.
function normalizeContent(content: SiteContent, lang: Lang): SiteContent {
  return renumberWorldIndexes(normalizeBuiltinRadio(content), lang);
}

function normalizeBuiltinRadio(content: SiteContent): SiteContent {
  const stations = content.music?.radio?.stations;
  if (!Array.isArray(stations)) return content;
  const normalized = stations.map((station) => {
    const proxy = BUILTIN_RADIO_URLS[station.id];
    return proxy ? { ...station, url: proxy } : station;
  });
  return {
    ...content,
    music: { ...content.music, radio: { ...content.music.radio, stations: normalized } },
  };
}

const LEGACY_FA_TEXT: Readonly<Record<string, string>> = {
  "hello@portfolio.dev": "p00rija@tutamail.com",
  "mailto:hello@portfolio.dev": "mailto:p00rija@tutamail.com",
  "mohammadmahdi.farhadianfard@gmail.com": "p00rija@tutamail.com",
  "mailto:mohammadmahdi.farhadianfard@gmail.com": "mailto:p00rija@tutamail.com",
  "https://github.com": "https://github.com/Poorija",
  پوریا: "محمدمهدی فرهادیان‌فرد (پوریا)",
  GRAPHICS: "گرافیک",
  "NETWORK · LINUX · SECURITY": "شبکه · لینوکس · امنیت",
  "ARTIFICIAL INTELLIGENCE": "هوش مصنوعی",
  TIMELINE: "مسیر زمانی",
  "Brand Identity": "هویت بصری برند",
  "Logo · Identity": "لوگو · هویت بصری",
  "Poster Design": "طراحی پوستر",
  "Print · Type": "چاپ · تایپوگرافی",
  "UI / Motion": "رابط کاربری · حرکت",
  "UI · Motion": "رابط کاربری · حرکت",
  Illustration: "تصویرسازی",
  "Digital Art": "هنر دیجیتال",
  "Type Design": "طراحی تایپ",
  "3D Art": "هنر سه‌بعدی",
  "Security · iptables": "امنیت · iptables",
  "Pentest · Audit": "تست نفوذ · ممیزی",
  "Monitoring · Zabbix": "پایش · Zabbix",
  uptime: "پایداری",
  "vulns found": "آسیب‌پذیری کشف‌شده",
  alerting: "هشداردهی",
  "Network Security": "امنیت شبکه",
  "Penetration Testing": "تست نفوذ",
  "Server Admin": "مدیریت سرور",
  Cryptography: "رمزنگاری",
  "Computer Vision": "بینایی ماشین",
  Medical: "پزشکی",
  Forecasting: "پیش‌بینی",
  "Time-series": "سری زمانی",
  "Art Director": "مدیر هنری",
  Designer: "طراح",
  "UI/UX Designer": "طراح رابط و تجربه کاربری",
  "Type Designer": "طراح تایپ",
  "3D Artist": "هنرمند سه‌بعدی",
  Poster: "پوستر",
  Branding: "برندسازی",
  Typography: "تایپوگرافی",
  "Design System": "سیستم طراحی",
  Pentest: "تست نفوذ",
  Hardening: "سخت‌سازی",
  Network: "شبکه",
  "Design × Security × AI": "طراحی × امنیت × هوش مصنوعی",
  "این فرم با honeypot و محدودیت ارسال از spam محافظت می‌شود.":
    "این فرم با فیلد تله و محدودیت نرخ ارسال در برابر هرزنامه محافظت می‌شود.",
};

const CURRENT_IDENTITY_TEXT: Readonly<Record<string, string>> = {
  "hello@portfolio.dev": "p00rija@tutamail.com",
  "mailto:hello@portfolio.dev": "mailto:p00rija@tutamail.com",
  "mohammadmahdi.farhadianfard@gmail.com": "p00rija@tutamail.com",
  "mailto:mohammadmahdi.farhadianfard@gmail.com": "mailto:p00rija@tutamail.com",
  "https://github.com": "https://github.com/Poorija",
  Pooria: "Mohammad Mahdi Farhadian Fard (Poorija)",
};

function normalizeCurrentIdentity<T>(value: T): T {
  if (typeof value === "string") return (CURRENT_IDENTITY_TEXT[value] ?? value) as T;
  if (Array.isArray(value)) return value.map(normalizeCurrentIdentity) as T;
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeCurrentIdentity(item)])
  ) as T;
}

function normalizeLegacyPersian<T>(value: T): T {
  if (typeof value === "string") return (LEGACY_FA_TEXT[value] ?? value) as T;
  if (Array.isArray(value)) return value.map(normalizeLegacyPersian) as T;
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeLegacyPersian(item)])
  ) as T;
}

function mergeSiteContent(defaults: SiteContent, incoming: unknown): SiteContent {
  const mergedRaw = normalizeCurrentIdentity(deepMergeDefaults(defaults, incoming));
  const merged = defaults === defaultContentFa ? normalizeLegacyPersian(mergedRaw) : mergedRaw;
  const source = isRecord(incoming) ? incoming : {};
  if (!isRecord(source.meteors)) {
    return {
      ...merged,
      meteors: {
        ambient: merged.design?.background?.comets ?? defaults.meteors.ambient,
        shower: merged.builder?.meteor ?? defaults.meteors.shower,
      },
    };
  }
  return merged;
}

function readContentCache(forceFresh: boolean) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CONTENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      storedAt?: number;
      ttl?: number;
      content?: { fa?: unknown; en?: unknown; custom?: Record<string, { fa: unknown; en: unknown }> };
    };
    const ttl = Number(parsed.ttl || 45000);
    // When forceFresh is true we only return entries still inside their TTL.
    // Otherwise (stale-while-revalidate path) we return any cached content
    // so the UI can render instantly and revalidate in the background.
    if (forceFresh && (!parsed.storedAt || Date.now() - parsed.storedAt > ttl)) return null;
    if (!parsed.content?.fa || !parsed.content?.en) return null;
    return parsed.content;
  } catch {
    return null;
  }
}

function writeContentCache(content: {
  fa: SiteContent;
  en: SiteContent;
  custom?: Record<string, { fa: unknown; en: unknown }>;
}) {
  if (typeof window === "undefined") return;
  try {
    const ttl =
      Number(content.en?.builder?.cache?.contentTtlSeconds || content.fa?.builder?.cache?.contentTtlSeconds || 45) * 1000;
    sessionStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify({ storedAt: Date.now(), ttl, content }));
  } catch {
    // ignore cache quota/privacy failures
  }
}

function clearContentCache() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CONTENT_CACHE_KEY);
  } catch {
    // ignore
  }
}

export const useContent = create<ContentState>((set, get) => ({
  contentFa: defaultContentFa,
  contentEn: defaultContentEn,
  lang: "en",
  content: defaultContentEn,
  viewportWidth: 1440,
  customs: {},
  loading: false,
  loaded: false,
  cmsOpen: false,
  authed: false,
  authChecked: false,
  guardSite: null,
  guardSections: {},
  guardUnlocked: [],
  guardUnlockedAt: {},
  guardLoaded: false,

  fetchContent: async (force = false) => {
    if (get().loading && !force) return;
    const requestId = ++contentRequestId;
    // cache.enabled controls whether the browser sessionStorage cache is used.
    const cacheEnabled = get().contentEn?.builder?.cache?.enabled !== false;
    // First: show whatever we have instantly (stale-while-revalidate), even if
    // past its TTL — it is only stale content, never wrong-shape content.
    const stale = cacheEnabled ? readContentCache(false) : null;
    if (stale) {
      const fa = normalizeContent(mergeSiteContent(defaultContentFa, stale.fa), "fa");
      const en = normalizeContent(mergeSiteContent(defaultContentEn, stale.en), "en");
      const lang = get().lang;
      const raw = lang === "fa" ? fa : en;
      set({ contentFa: fa, contentEn: en, content: resolveResponsiveContent(raw, get().viewportWidth), customs: stale.custom ?? {}, loaded: true });
    }
    // Fresh cache still paints instantly, then revalidates in background.
    // This keeps CMS edits from another tab/device from remaining stale for a full TTL.
    const fresh = cacheEnabled ? readContentCache(true) : null;
    if (fresh) {
      const fa = normalizeContent(mergeSiteContent(defaultContentFa, fresh.fa), "fa");
      const en = normalizeContent(mergeSiteContent(defaultContentEn, fresh.en), "en");
      const lang = get().lang;
      const raw = lang === "fa" ? fa : en;
      set({ contentFa: fa, contentEn: en, content: resolveResponsiveContent(raw, get().viewportWidth), customs: fresh.custom ?? {}, loaded: true });
    }
    if (!stale && !fresh) set({ loading: true });
    try {
      // no-store: the app itself must always revalidate — the HTTP cache
      // (max-age=120 for anonymous visitors/CDN) must never serve the app
      // content that is older than the last CMS save.
      const res = await fetch("/api/content", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (requestId !== contentRequestId) return;
      if (json.ok && json.content) {
        const fa = normalizeContent(mergeSiteContent(defaultContentFa, json.content.fa), "fa");
        const en = normalizeContent(mergeSiteContent(defaultContentEn, json.content.en), "en");
        const lang = get().lang;
        const customs = (json.content.custom ?? {}) as Record<string, { fa: unknown; en: unknown }>;
        const raw = lang === "fa" ? fa : en;
        set({
          contentFa: fa,
          contentEn: en,
          content: resolveResponsiveContent(raw, get().viewportWidth),
          customs,
          loaded: true,
          loading: false,
        });
        if (cacheEnabled) writeContentCache({ fa, en, custom: customs });
      } else {
        set({ loaded: true, loading: false });
      }
    } catch {
      if (requestId === contentRequestId) set({ loaded: true, loading: false });
    }
  },

  setLang: (lang) => {
    const raw = lang === "fa" ? get().contentFa : get().contentEn;
    set({ lang, content: resolveResponsiveContent(raw, get().viewportWidth) });
    // reflect on <html>
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
      try {
        window.localStorage.setItem("p00rija-language", lang);
      } catch {
        // Storage can be unavailable in privacy mode; language still changes in memory.
      }
    }
  },

  setViewportWidth: (width) => {
    const normalized = Math.max(1, Math.round(width || 1440));
    const state = get();
    const raw = state.lang === "fa" ? state.contentFa : state.contentEn;
    set({ viewportWidth: normalized, content: resolveResponsiveContent(raw, normalized) });
  },

  refreshContent: async () => {
    clearContentCache();
    await get().fetchContent(true);
  },

  fetchGuard: async () => {
    try {
      const res = await fetch("/api/protection", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        const unlocked: string[] = Array.isArray(json.unlocked) ? json.unlocked : [];
        // Keep per-target unlock timestamps (for the idle re-lock watcher);
        // targets first seen as unlocked now get "page load" as their baseline.
        const prevAt = get().guardUnlockedAt;
        const unlockedAt: Record<string, number> = {};
        for (const t of unlocked) unlockedAt[t] = prevAt[t] ?? Date.now();
        set({
          guardSite: json.site ?? null,
          guardSections: json.sections ?? {},
          guardUnlocked: unlocked,
          guardUnlockedAt: unlockedAt,
          guardLoaded: true,
        });
      } else {
        set({ guardLoaded: true });
      }
    } catch {
      set({ guardLoaded: true });
    }
  },

  /* One network round-trip each, then ONE store update. Applies the fresh
   * guard state and the fresh (re-fetched) content together so the whole
   * page re-renders a single time — the previous flow (stale-cache paint in
   * fetchContent, then the fresh payload) caused a visible double-render
   * stutter on every unlock. Returns true when the state was applied. */
  applyGuardAndContentRefresh: async () => {
    const [gRes, cRes] = await Promise.all([
      fetch("/api/protection", { cache: "no-store" }),
      fetch("/api/content", { cache: "no-store" }),
    ]);
    const g = await gRes.json().catch(() => null);
    const c = await cRes.json().catch(() => null);
    if (!c?.ok || !c.content) throw new Error("content refresh failed");
    const fa = normalizeContent(mergeSiteContent(defaultContentFa, c.content.fa), "fa");
    const en = normalizeContent(mergeSiteContent(defaultContentEn, c.content.en), "en");
    const customs = (c.content.custom ?? {}) as Record<string, { fa: unknown; en: unknown }>;
    const lang = get().lang;
    const raw = lang === "fa" ? fa : en;
    clearContentCache();
    writeContentCache({ fa, en, custom: customs });
    const unlocked: string[] = g?.ok && Array.isArray(g.unlocked) ? g.unlocked : get().guardUnlocked;
    const prevAt = get().guardUnlockedAt;
    const unlockedAt: Record<string, number> = {};
    for (const t of unlocked) unlockedAt[t] = prevAt[t] ?? Date.now();
    set({
      contentFa: fa,
      contentEn: en,
      content: resolveResponsiveContent(raw, get().viewportWidth),
      customs,
      guardSite: g?.ok ? (g.site ?? null) : get().guardSite,
      guardSections: g?.ok ? (g.sections ?? {}) : get().guardSections,
      guardUnlocked: unlocked,
      guardUnlockedAt: unlockedAt,
      guardLoaded: true,
    });
    return true;
  },

  unlockGuard: async (target, password) => {
    try {
      const res = await fetch("/api/protection/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, password }),
      });
      if (res.ok) {
        // Single-swap refresh: guard state + un-stripped content land in ONE
        // store update (no intermediate stale-cache render → no jank).
        const unlockedAt = { ...get().guardUnlockedAt, [target]: Date.now() };
        set({ guardUnlockedAt: unlockedAt });
        try {
          await get().applyGuardAndContentRefresh();
        } catch {
          await Promise.all([get().fetchGuard(), get().fetchContent(true)]);
        }
        return { status: "ok" as const };
      }
      if (res.status === 423) return { status: "disabled" as const };
      if (res.status === 403) return { status: "blocked" as const };
      if (res.status === 429) return { status: "rate" as const };
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        await get().fetchGuard();
        return { status: "wrong" as const, remaining: json?.remaining };
      }
      return { status: "error" as const };
    } catch {
      return { status: "error" as const };
    }
  },

  /* Withdraw the unlock for one or more targets (idle/exit re-lock): the
   * server deletes the signed cookie, then guard+content refresh in a
   * single swap so the section blurs and its data is stripped client-side
   * again without a double render. */
  relockGuards: async (targets) => {
    try {
      await fetch("/api/protection/relock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      try {
        await get().applyGuardAndContentRefresh();
      } catch {
        await Promise.all([get().fetchGuard(), get().fetchContent(true)]);
      }
    } catch {
      // network hiccup — local state still refreshes guard on next boot
    }
  },

  updateSection: async (section, data) => {
    const lang = get().lang;
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, lang, data }),
      });
      if (res.status === 401) {
        set({ authed: false });
        return false;
      }
      if (!res.ok) return false;
      const json = await res.json();
      if (json.ok) {
        clearContentCache();
        const state = get();
        const newFa = lang === "fa" ? { ...state.contentFa, [section]: data } as SiteContent : state.contentFa;
        const newEn = lang === "en" ? { ...state.contentEn, [section]: data } as SiteContent : state.contentEn;
        const raw = lang === "fa" ? newFa : newEn;
        set({
          contentFa: newFa,
          contentEn: newEn,
          content: resolveResponsiveContent(raw, state.viewportWidth),
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  setCmsOpen: (open) => set({ cmsOpen: open }),

  checkAuth: async () => {
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      const json = await res.json();
      set({ authed: !!json.authenticated, authChecked: true });
    } catch {
      set({ authChecked: true });
    }
  },

  login: async (password, code) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code }),
      });
      const json = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (json.ok) {
        set({ authed: true });
        return { status: "ok" as const };
      }
      if (json.requiresTwoFactor) return { status: "2fa" as const };
      return {
        status: "error" as const,
        locked: Boolean(json.locked),
        retryAfterSecs: typeof json.retryAfterSecs === "number" ? json.retryAfterSecs : undefined,
        attemptsLeft: typeof json.attemptsLeft === "number" ? json.attemptsLeft : undefined,
      };
    } catch {
      return { status: "error" as const };
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    set({ authed: false, cmsOpen: false });
  },

  t: (key) => getT(get().lang)(key),
}));
