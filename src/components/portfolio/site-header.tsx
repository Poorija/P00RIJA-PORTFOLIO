"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Settings2, LogOut, Gamepad2, Compass } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { MotionToggle } from "./motion-toggle";
import { openGameCenter } from "./game-center";

const NAV = [
  { id: "graphics", labelKey: "navGraphics", color: "var(--gfx-1)" },
  { id: "security", labelKey: "navSecurity", color: "var(--sec-1)" },
  { id: "ai", labelKey: "navAI", color: "var(--ai-1)" },
] as const;

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");
  const site = useContent((s) => s.content.site);
  const builder = useContent((s) => s.content.builder);
  const explorer = useContent((s) => s.content.explorer);
  const setCmsOpen = useContent((s) => s.setCmsOpen);
  const authed = useContent((s) => s.authed);
  const logout = useContent((s) => s.logout);
  const lang = useContent((s) => s.lang);
  const t = useContent((s) => s.t);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = useMemo(() => {
    const fallback = NAV.map((n, index) => ({
      id: n.id,
      label: site[n.labelKey],
      href: `#${n.id}`,
      enabled: true,
      external: false,
      order: index + 1,
      color: n.color,
      hoverLabel: String(site[n.labelKey] || n.id).toUpperCase(),
    }));
    const withJourney = [
      ...fallback.slice(0, 3),
      {
        id: "timeline",
        label: site.navAI !== undefined && lang === "fa" ? "مسیر" : "Journey",
        href: "#timeline",
        enabled: true,
        external: false,
        order: 4,
        color: "var(--sec-1)",
        hoverLabel: "JOURNEY",
      },
      ...fallback.slice(3),
    ];
    const configured = builder?.navigation?.length ? builder.navigation : withJourney;
    // Hide nav items whose target section was disabled in the CMS layout.
    const disabled = new Set(
      (builder?.sections ?? []).filter((s) => s.enabled === false).map((s) => s.id)
    );
    return configured
      .filter((item) => item.enabled !== false)
      .filter((item) => {
        const target = (item.href || "").replace(/^#/, "");
        return !target || disabled.has(target) === false;
      })
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }, [builder?.navigation, builder?.sections, site, lang]);

  useEffect(() => {
    const sectionIds = navItems
      .map((n) => (n.href || "").replace(/^#/, ""))
      .filter((id) => id && !id.startsWith("http"));
    const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [navItems]);

  const go = (id: string) => {
    // On mobile the expanded dropdown changes document height. Scrolling before
    // its exit animation finishes makes the browser land at the old offset (or
    // appear to do nothing). Collapse first, then resolve the live target.
    const wasOpen = open;
    setOpen(false);
    window.setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      const headerHeight = document.querySelector<HTMLElement>(".cms-runtime-header")?.offsetHeight ?? 64;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      window.history.replaceState(null, "", `#${encodeURIComponent(id)}`);
    }, wasOpen ? 240 : 0);
  };

  const handleCms = () => {
    if (authed) {
      setCmsOpen(true);
    } else {
      window.dispatchEvent(new CustomEvent("open-login"));
    }
  };

  if (builder?.header?.enabled === false) return null;

  const header = builder?.header;
  const logoShape = header?.logoShape || "rounded";
  const logoClass =
    logoShape === "circle" ? "rounded-full" :
    logoShape === "square" ? "rounded-none" :
    logoShape === "diamond" ? "rotate-45 rounded-lg" :
    logoShape === "none" ? "rounded-none" :
    "rounded-xl";
  const showLanguage = header?.showLanguageToggle !== false;
  const showTheme = header?.showThemeToggle !== false;
  const showCms = header?.showCmsButton !== false;

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`cms-runtime-header ${header?.sticky === false ? "absolute" : "fixed"} left-0 right-0 top-0 z-[80] transition-all duration-500 ${
        scrolled
          ? "border-b border-border bg-background/70 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        {/* Logo / mark */}
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            window.dispatchEvent(new CustomEvent("logo-pressed"));
          }}
          className="group flex items-center gap-3"
          data-cursor-hover
        >
          <span className="relative grid h-9 w-9 place-items-center">
            <span className={`absolute inset-0 ${logoClass} opacity-90 blur-[1px]`} style={{ background: header?.logoGradient || "linear-gradient(135deg, var(--gfx-1), var(--sec-1), var(--ai-1))" }} />
            <span className={`absolute inset-[2px] ${logoShape === "circle" ? "rounded-full" : "rounded-[10px]"} bg-background`} />
            {header?.logoImage ? (
              <img
                src={header.logoImage}
                alt={header.logoAlt || site.brand || "Logo"}
                className={cn("relative h-7 w-7 object-contain", logoShape === "diamond" && "-rotate-45")}
              />
            ) : (
              <span className={cn("relative font-mono text-sm font-bold text-foreground", logoShape === "diamond" && "-rotate-45")}>{header?.logoText || "M"}</span>
            )}
          </span>
          <span className="hidden text-sm font-medium tracking-wide text-foreground/80 sm:block">
            {site.brand}
            <span className="text-foreground/30">/</span>
            <span className="text-gradient-tri font-semibold">{site.brandYear}</span>
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((n) => {
            const id = (n.href || "").replace(/^#/, "");
            const isActive = active === id;
            const label = n.label;
            const isExternal = n.external || /^https?:\/\//.test(n.href || "");
            const handleClick = () => {
              if (isExternal) {
                window.open(n.href, "_blank", "noopener,noreferrer");
                return;
              }
              go(id);
            };
            return (
              <button
                key={n.id}
                onClick={handleClick}
                data-cursor-hover
                className="group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
                data-builder-hover={n.hoverLabel}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: n.color || "var(--foreground)",
                    boxShadow: isActive ? `0 0 12px ${n.color}` : "none",
                    transform: isActive ? "scale(1.4)" : "scale(1)",
                  }}
                />
                <span
                  className={`transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {label}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-full"
                    style={{ background: "var(--surface-1)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
          <div className="mr-1 flex items-center gap-1.5">
            {showLanguage && <LanguageToggle />}
            {showTheme && <ThemeToggle />}
            <MotionToggle />
            {explorer.enabled ? <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-explorer-passport"))}
              data-cursor-hover
              aria-label={explorer.headerLabel}
              title={explorer.headerLabel}
              className="grid h-9 w-9 place-items-center rounded-full border text-foreground transition-colors hover:bg-surface-2"
              style={{ background: "var(--surface-1)", borderColor: "color-mix(in oklch, var(--ai-1) 40%, transparent)" }}
            >
              <Compass className="h-4 w-4" style={{ color: "var(--ai-1)" }} />
            </button> : null}
            {/* Game Center — arcade console overlay */}
            <button
              onClick={() => openGameCenter()}
              data-cursor-hover
              aria-label={lang === "fa" ? "مرکز بازی" : "Game Center"}
              title={lang === "fa" ? "مرکز بازی" : "Game Center"}
              className="group relative grid h-9 w-9 place-items-center rounded-full border text-foreground transition-colors hover:text-foreground"
              style={{ background: "var(--surface-1)", borderColor: "color-mix(in oklch, var(--gfx-1) 40%, transparent)" }}
            >
              <Gamepad2 className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" style={{ color: "var(--gfx-1)" }} />
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
                style={{ background: "var(--gfx-1)", boxShadow: "0 0 8px var(--gfx-1)" }}
              />
            </button>
            {showCms && authed ? (
              <>
                <button
                  onClick={() => setCmsOpen(true)}
                  data-cursor-hover
                  aria-label={t("cms")}
                  title={t("cms")}
                  className="relative grid h-9 w-9 place-items-center rounded-full border text-foreground transition-colors hover:text-foreground"
                  style={{ background: "var(--surface-1)", borderColor: "color-mix(in oklch, var(--ai-1) 40%, transparent)" }}
                >
                  <Settings2 className="h-4 w-4" style={{ color: "var(--ai-1)" }} />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ background: "var(--ai-1)" }} />
                </button>
                <button
                  onClick={logout}
                  data-cursor-hover
                  aria-label={t("logout")}
                  title={t("logout")}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
                  style={{ background: "var(--surface-1)" }}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : showCms ? (
              <button
                onClick={handleCms}
                data-cursor-hover
                aria-label={t("cms")}
                title={t("cms")}
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground/80 transition-colors hover:text-foreground"
                style={{ background: "var(--surface-1)", borderColor: "var(--hairline)" }}
              >
                <Settings2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </nav>

        {/* Mobile toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          {showLanguage && <LanguageToggle />}
          {showTheme && <ThemeToggle />}
          <MotionToggle />
          {explorer.enabled ? <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-explorer-passport"))}
            data-cursor-hover
            aria-label={explorer.headerLabel}
            className="grid h-10 w-10 place-items-center rounded-xl border text-foreground"
            style={{ borderColor: "color-mix(in oklch, var(--ai-1) 40%, transparent)" }}
          >
            <Compass className="h-4 w-4" style={{ color: "var(--ai-1)" }} />
          </button> : null}
          <button
            onClick={() => openGameCenter()}
            data-cursor-hover
            aria-label={lang === "fa" ? "مرکز بازی" : "Game Center"}
            className="grid h-10 w-10 place-items-center rounded-xl border text-foreground"
            style={{ borderColor: "color-mix(in oklch, var(--gfx-1) 40%, transparent)" }}
          >
            <Gamepad2 className="h-4 w-4" style={{ color: "var(--gfx-1)" }} />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border border-border text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("menu")}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {navItems.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.external || /^https?:\/\//.test(n.href || "")) {
                      window.open(n.href, "_blank", "noopener,noreferrer");
                    } else {
                      go((n.href || "").replace(/^#/, ""));
                    }
                  }}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-right text-foreground/80 hover:bg-surface-1"
                  style={{ background: "var(--surface-1)" }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: n.color }} />
                  <span className="flex-1">{n.label}</span>
                </button>
              ))}
              <button
                onClick={() => { setOpen(false); openGameCenter(); }}
                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-foreground/80"
                style={{ borderColor: "color-mix(in oklch, var(--gfx-1) 40%, transparent)" }}
              >
                <Gamepad2 className="h-4 w-4" style={{ color: "var(--gfx-1)" }} />
                {lang === "fa" ? "مرکز بازی" : "Game Center"}
              </button>
              {showCms && <button
                onClick={() => { setOpen(false); handleCms(); }}
                className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-foreground/80"
              >
                <Settings2 className="h-4 w-4" />
                {t("cms")}
              </button>}
              {authed && (
                <button onClick={logout} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-foreground/80">
                  <LogOut className="h-4 w-4" />
                  {t("logout")}
                </button>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
