"use client";

import { useEffect } from "react";
import { useContent } from "@/lib/content-store";
import { APP_VERSION, APP_BUILD_DATE } from "@/lib/app-version";

export function ContentBoot({ children }: { children: React.ReactNode }) {
  const fetchContent = useContent((s) => s.fetchContent);
  const checkAuth = useContent((s) => s.checkAuth);
  const fetchGuard = useContent((s) => s.fetchGuard);
  const lang = useContent((s) => s.lang);
  const setLang = useContent((s) => s.setLang);
  const setViewportWidth = useContent((s) => s.setViewportWidth);
  const browserTitle = useContent((s) => s.content.site.browserTitle);
  const favicon = useContent((s) => s.content.site.favicon);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("p00rija-language");
      if (saved === "fa" || saved === "en") {
        setLang(saved);
        return;
      }
      // First visit: match the visitor's browser language (Persian → fa).
      if ((navigator.language || "").toLowerCase().startsWith("fa")) setLang("fa");
    } catch {
      // Keep the default language when storage is unavailable.
    }
  }, [setLang]);

  // Terminal command `lang fa|en` (and any other component) can switch the
  // language through this global event.
  useEffect(() => {
    const onSetLang = (e: Event) => {
      const detail = (e as CustomEvent<"fa" | "en">).detail;
      if (detail === "fa" || detail === "en") setLang(detail);
    };
    window.addEventListener("set-lang", onSetLang);
    return () => window.removeEventListener("set-lang", onSetLang);
  }, [setLang]);

  useEffect(() => {
    fetchContent();
    checkAuth();
    fetchGuard();
    // Strict visitor identity: bind this browser to a device-fingerprint
    // id (VPN/incognito resistant) so Access Guard blocks follow the
    // device. Fire-and-forget; failures never affect page load.
    void (async () => {
      try {
        const { collectFingerprint } = await import("@/lib/fingerprint");
        const fp = await collectFingerprint();
        if (fp) {
          await fetch("/api/protection/identify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fp }),
          }).catch(() => null);
        }
      } catch {
        /* fingerprinting is best-effort */
      }
    })();
  }, [fetchContent, checkAuth, fetchGuard]);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [setViewportWidth]);

  // Prevent auto-scroll on page load (e.g. from #contact hash in URL).
  // Force scroll to top on mount.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, []);

  // keep <html> lang/dir in sync
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    }
  }, [lang]);

  // Build verification: tab title carries the version and the console logs a
  // build banner, so a stale cached build is instantly recognizable.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `${document.title.split(" ·")[0]} · v${APP_VERSION}`;
    console.info(`%cP00RIJA build v${APP_VERSION} (${APP_BUILD_DATE})`, "color:#34d399;font-weight:bold");
  }, []);

  // CMS-managed browser identity. Keeping this client-side makes title/icon
  // changes visible immediately and avoids a new application build.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (browserTitle?.trim()) document.title = `${browserTitle.trim()} · v${APP_VERSION}`;

    const source = favicon?.trim() || "/logo.svg";
    // Next metadata and old CMS revisions could leave several competing
    // rel=icon nodes. Browsers are free to pick any one, so keep exactly one.
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"],link[rel="shortcut icon"]')
      .forEach((node) => node.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.dataset.cmsFavicon = "true";
    const ext = source.split("?")[0].split(".").pop()?.toLowerCase();
    icon.type = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/x-icon";
    const version = Array.from(source).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
    icon.href = `${source}${source.includes("?") ? "&" : "?"}cmsv=${version}`;
    document.head.appendChild(icon);
  }, [browserTitle, favicon]);

  // Smooth anchor navigation WITHOUT the global CSS scroll-behavior.
  // (A global `scroll-behavior: smooth` makes rapid wheel events overlap
  // native scroll animations and jump the page back up — see globals.css.)
  // Routes through the Lenis instance when smooth scrolling is active.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      const hash = anchor?.getAttribute("href");
      if (!anchor || !hash || hash === "#") return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      const lenis = (window as unknown as { __lenis?: { scrollTo: (t: HTMLElement, o?: object) => void } }).__lenis;
      if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.2 });
      else target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <>{children}</>;
}
