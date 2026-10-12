"use client";

import { useMemo } from "react";
import { useContent } from "@/lib/content-store";

function cssNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cssText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function cssSelector(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[{}]/g, "");
}

function scopedNativeSelector(sectionId: string, value: unknown) {
  const selector = cssSelector(value);
  if (!selector || selector.length > 240 || /[,{}@]/.test(selector)) return "";
  return `[data-builder-section="${cssAttribute(sectionId)}"] ${selector}`;
}

function cssAttribute(value: unknown) {
  return String(value ?? "").replace(/["\\\n\r]/g, "");
}

function animationBody(type: string, intensity: number) {
  const i = Number.isFinite(intensity) ? intensity : 1;
  switch (type) {
    case "slide":
      return `from { opacity: 0; transform: translate3d(0, ${24 * i}px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); }`;
    case "float":
      return `0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0, ${-14 * i}px, 0); }`;
    case "pulse":
      return `0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(${1 + 0.04 * i}); opacity: .82; }`;
    case "spin":
      return `to { transform: rotate(360deg); }`;
    case "tilt":
      return `0%,100% { transform: perspective(900px) rotateX(0deg) rotateY(0deg); } 50% { transform: perspective(900px) rotateX(${4 * i}deg) rotateY(${-5 * i}deg); }`;
    case "glow":
      return `0%,100% { filter: drop-shadow(0 0 0 transparent); } 50% { filter: drop-shadow(0 0 ${18 * i}px var(--section-accent, var(--gfx-1))); }`;
    case "zoom":
      return `from { opacity: 0; transform: scale(${Math.max(0, 1 - 0.18 * i)}); } to { opacity: 1; transform: scale(1); }`;
    case "blur-in":
      return `from { opacity: 0; filter: blur(${6 * i}px); transform: translate3d(0, ${10 * i}px, 0); } to { opacity: 1; filter: blur(0); transform: translate3d(0, 0, 0); }`;
    case "flip-3d":
      return `from { opacity: 0; transform: perspective(1000px) rotateY(${70 * i}deg); } to { opacity: 1; transform: perspective(1000px) rotateY(0deg); }`;
    case "glide-3d":
      return `from { opacity: 0; transform: perspective(1100px) translate3d(${60 * i}px, ${20 * i}px, ${-120 * i}px) rotateY(${18 * i}deg); } to { opacity: 1; transform: perspective(1100px) translate3d(0, 0, 0) rotateY(0deg); }`;
    case "bob":
      return `0%,100% { transform: translate3d(0, 0, 0) rotate(0deg); } 25% { transform: translate3d(${3 * i}px, ${-8 * i}px, 0) rotate(${1 * i}deg); } 75% { transform: translate3d(${-3 * i}px, ${-8 * i}px, 0) rotate(${-1 * i}deg); }`;
    case "fade":
    default:
      return `from { opacity: 0; transform: translate3d(0, ${10 * i}px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); }`;
  }
}

export function CmsRuntimeController() {
  const builder = useContent((s) => s.content.builder);
  const designAnimations = useContent((s) => s.content.design?.animations ?? []);

  const css = useMemo(() => {
    if (!builder?.enabled) return "";
    const g = builder.global;
    const h = builder.header;
    const sectionCss = (builder.sections ?? [])
      .map((section) => {
        const id = cssAttribute(section.id);
        if (!id) return "";
        const shell = `[data-builder-section="${id}"]`;
        const content = `${shell} > section, section${shell}`;
        const hidden = section.enabled === false ? "display:none !important;" : "";
        const autoSpacing = g.spacingMode !== "manual";
        const responsive = (value: unknown, fallback: number) =>
          autoSpacing
            ? `clamp(0px, ${Math.max(0, cssNumber(value, fallback)) / 12}vw, ${Math.max(0, cssNumber(value, fallback))}px)`
            : `${Math.max(0, cssNumber(value, fallback))}px`;
        const gapBefore = responsive(section.gapBefore, 0);
        const gapAfter = responsive(section.gapAfter, cssNumber(g.sectionGap, 28));
        return `
          ${shell} {
            margin-block-start: ${gapBefore};
            margin-block-end: ${gapAfter};
            --cms-device-font-scale: ${cssNumber(section.fontScale, 1)};
            --cms-device-object-scale: ${cssNumber(section.objectScale, 1)};
            ${hidden}
          }
          ${content} {
            --section-accent: ${cssText(section.accent, "var(--foreground)")};
            color: ${cssText(section.textColor, "var(--foreground)")};
            background: ${cssText(section.background, "transparent")};
            padding-top: ${cssNumber(section.paddingTop, 0)}px;
            padding-bottom: ${cssNumber(section.paddingBottom, 0)}px;
            border-radius: ${cssNumber(section.radius, 0)}px;
            opacity: ${cssNumber(section.opacity, 1)};
            backdrop-filter: blur(${cssNumber(section.blur, 0)}px);
            font-size: calc(1em * var(--cms-device-font-scale, 1));
          }
          ${shell} > section > .mx-auto,
          ${shell} > section > [class*="max-w-"],
          section${shell} > .mx-auto,
          section${shell} > [class*="max-w-"] {
            max-width: ${cssNumber(section.maxWidth, g.maxWidth)}px;
          }
          ${shell}[data-builder-hover="lift"]:hover,
          ${shell}.builder-hover-lift:hover {
            transform: translateY(-4px);
          }
        `;
      })
      .join("\n");

    const componentCss = (builder.components ?? [])
      .filter((component) => component.enabled !== false)
      .map((component) => `
        [data-builder-component="${component.id}"] {
          color: ${cssText(component.color, "var(--foreground)")};
          background: ${cssText(component.background, "var(--surface-1)")};
          border-color: ${cssText(component.borderColor, "var(--border)")};
          border-radius: ${cssNumber(component.radius, 8)}px;
          padding: ${cssNumber(component.paddingY, 10)}px ${cssNumber(component.paddingX, 16)}px;
          font-size: ${cssNumber(component.fontSize, 14)}px;
          opacity: ${cssNumber(component.opacity, 1)};
        }
      `)
      .join("\n");

    const animationCss = [...(builder.animations ?? []), ...designAnimations]
      .filter((preset) => preset.enabled !== false)
      .map((preset) => {
        const selector = cssSelector(preset.target);
        if (!selector) return "";
        const id = `cms-anim-${String(preset.id || "preset").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        const duration = cssNumber(preset.duration, 600) / cssNumber(g.animationSpeed, 1);
        const delay = cssNumber(preset.delay, 0);
        const easing = cssText(preset.easing, "ease");
        const keyframes = preset.type === "custom" && preset.customCss?.includes("@keyframes")
          ? preset.customCss
          : `@keyframes ${id} { ${animationBody(preset.type, cssNumber(preset.intensity, 1))} }`;
        const ruleTarget = preset.trigger === "hover" ? `${selector}:hover` : selector;
        const iteration = preset.trigger === "always" ? "infinite" : "both";
        return `
          ${keyframes}
          ${ruleTarget} {
            animation: ${id} ${duration}ms ${easing} ${delay}ms ${iteration};
          }
        `;
      })
      .join("\n");

    const responsiveCss = builder.responsive?.enabled
      ? (["desktop", "tablet", "mobile"] as const).map((device) => {
          const config = builder.responsive?.devices?.[device];
          // New layouts require an explicit override switch. Legacy saved
          // layouts (without the flag) remain active for backward compatibility.
          const overrideEnabled = config?.overrideEnabled ?? Boolean(config?.sections?.length);
          if (!overrideEnabled || !config?.sections?.length) return "";
          const rules = config.sections.map((section) => {
            const id = cssAttribute(section.id);
            if (!id) return "";
            const shell = `[data-builder-section="${id}"]`;
            return `${shell}{margin-block-start:${cssNumber(section.gapBefore, 0)}px;margin-block-end:${cssNumber(section.gapAfter, 0)}px;${section.enabled === false ? "display:none!important;" : ""}--cms-device-font-scale:${cssNumber(section.fontScale, 1)};--cms-device-object-scale:${cssNumber(section.objectScale, 1)};} ${shell}>section,section${shell}{padding-top:${cssNumber(section.paddingTop, 0)}px;padding-bottom:${cssNumber(section.paddingBottom, 0)}px;} ${shell}>section>.mx-auto,section${shell}>.mx-auto{max-width:${cssNumber(section.maxWidth, g.maxWidth)}px;}`;
          }).join("\n");
          if (device === "mobile") return `@media(max-width:${cssNumber(builder.responsive?.mobileBreakpoint, 640)}px){${rules}}`;
          if (device === "tablet") return `@media(min-width:${cssNumber(builder.responsive?.mobileBreakpoint, 640) + 0.02}px) and (max-width:${cssNumber(builder.responsive?.tabletBreakpoint, 1024)}px){${rules}}`;
          return `@media(min-width:${cssNumber(builder.responsive?.tabletBreakpoint, 1024) + 0.02}px){${rules}}`;
        }).join("\n")
      : "";

    const nativePlacementCss = (builder.visualElements ?? [])
      .filter((element) => element.kind === "native")
      .map((element) => {
        const selector = scopedNativeSelector(element.sectionId, element.selector);
        if (!selector) return "";
        const rules = (["desktop", "tablet", "mobile"] as const).map((device) => {
          const placement = element.placements?.[device] ?? element.placements?.desktop;
          if (!placement) return "";
          const declaration = placement.visible === false
            ? "display:none!important;"
            : `position:absolute!important;left:${cssNumber(placement.x, 0)}%!important;top:${cssNumber(placement.y, 0)}%!important;width:${cssNumber(placement.width, 25)}%!important;height:${cssNumber(placement.height, 15)}%!important;margin:0!important;z-index:${cssNumber(placement.zIndex, 10)}!important;transform:rotate(${cssNumber(placement.rotation, 0)}deg)!important;transform-origin:center!important;`;
          if (device === "mobile") return `@media(max-width:${cssNumber(builder.responsive?.mobileBreakpoint, 640)}px){${selector}{${declaration}}}`;
          if (device === "tablet") return `@media(min-width:${cssNumber(builder.responsive?.mobileBreakpoint, 640) + 0.02}px) and (max-width:${cssNumber(builder.responsive?.tabletBreakpoint, 1024)}px){${selector}{${declaration}}}`;
          return `@media(min-width:${cssNumber(builder.responsive?.tabletBreakpoint, 1024) + 0.02}px){${selector}{${declaration}}}`;
        });
        return rules.join("\n");
      })
      .join("\n");

    const fontFamily = cssText(g.fontFamily, "system-ui").replace(/[;{}]/g, "");
    const fontUrl = typeof g.fontUrl === "string" && /^(?:\/api\/uploads\/[a-zA-Z0-9_-]+|https?:\/\/[^\s'\")]+)$/.test(g.fontUrl.trim()) ? g.fontUrl.trim() : "";
    const fontFace = fontUrl ? `@font-face { font-family: "CMS Interface Font"; src: url("${fontUrl}"); font-display: swap; font-style: normal; font-weight: 100 900; }` : "";
    const appliedFont = fontUrl ? `"CMS Interface Font", "${fontFamily}"` : `"${fontFamily}"`;

    return `
      ${fontFace}
      :root {
        --cms-max-width: ${cssNumber(g.maxWidth, 1280)}px;
        --cms-section-gap: ${cssNumber(g.sectionGap, 96)}px;
        --cms-card-radius: ${cssNumber(g.cardRadius, 8)}px;
        --cms-button-radius: ${cssNumber(g.buttonRadius, 999)}px;
        --cms-glass-opacity: ${cssNumber(g.glassOpacity, 0.62)};
        --cms-border-opacity: ${cssNumber(g.borderOpacity, 0.14)};
        --cms-shadow-strength: ${cssNumber(g.shadowStrength, 0.42)};
        --cms-animation-speed: ${cssNumber(g.animationSpeed, 1)};
        --cms-hover-scale: ${cssNumber(g.hoverScale, 1.03)};
        --cms-focus-ring-color: ${cssText(g.focusRingColor, "var(--ai-1)")};
        --cms-selection-color: ${cssText(g.selectionColor, "var(--gfx-1)")};
        --cms-header-height: ${cssNumber(h.height, 64)}px;
        --cms-header-bg: ${cssText(h.background, "var(--background)")};
        --cms-header-border: ${cssText(h.borderColor, "var(--border)")};
        --cms-header-opacity: ${cssNumber(h.opacity, 0.7)};
        --cms-header-blur: ${cssNumber(h.blur, 22)}px;
        --cms-header-content-gap: ${cssNumber(h.contentGap, 20)}px;
        --cms-interface-font: ${appliedFont}, system-ui, sans-serif;
      }
      html, body, button, input, textarea, select { font-family: var(--cms-interface-font) !important; }
      ::selection {
        background: color-mix(in oklch, var(--cms-selection-color) 45%, transparent);
      }
      .cms-radius-card { border-radius: var(--cms-card-radius); }
      .cms-radius-button { border-radius: var(--cms-button-radius); }
      .cms-hover-scale:hover { transform: scale(var(--cms-hover-scale)); }
      [data-builder-hover="glow"]:hover { box-shadow: 0 24px 80px -42px var(--section-accent, var(--gfx-1)); }
      [data-builder-hover="tilt"]:hover { transform: perspective(1000px) rotateX(1.5deg) rotateY(-2deg); }
      [data-builder-hover="magnetic"]:hover { transform: translateY(-2px) scale(var(--cms-hover-scale)); }
      [data-builder-hover="invert"]:hover { filter: invert(1); }
      .cms-runtime-header {
        min-height: var(--cms-header-height);
        background: color-mix(in oklch, var(--cms-header-bg) calc(var(--cms-header-opacity) * 100%), transparent);
        border-color: var(--cms-header-border);
        backdrop-filter: blur(var(--cms-header-blur));
      }
      .cms-runtime-header > div {
        height: var(--cms-header-height);
        min-height: var(--cms-header-height);
      }
      .portfolio-main {
        padding-top: var(--cms-header-content-gap);
      }
      [data-cms-object] {
        scale: var(--cms-device-object-scale, 1);
        transform-origin: center;
      }
      ${sectionCss}
      ${componentCss}
      ${animationCss}
      ${responsiveCss}
      ${nativePlacementCss}
      ${g.customCss || ""}
    `;
  }, [builder, designAnimations]);

  if (!css) return null;
  return <style id="cms-runtime-controller" dangerouslySetInnerHTML={{ __html: css }} />;
}
