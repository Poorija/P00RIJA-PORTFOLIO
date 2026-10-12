"use client";

/* ============================================================
 * ExternalAnalytics — opt-in traffic-monitoring integrations.
 *
 * Ids are configured in the CMS (Builder → Integrations). Scripts
 * are injected ONLY when the visitor granted the "analytics"
 * cookie consent (cookie-consent.tsx) — GDPR/CCPA safe. Leave a
 * field empty to disable that provider.
 *
 * Supported: Google Analytics 4 · Google Tag Manager · Hotjar ·
 * Plausible · Matomo · Cloudflare Web Analytics.
 * ============================================================ */

import { useEffect } from "react";
import { useContent } from "@/lib/content-store";
import { readConsent } from "./cookie-consent";

type A = {
  ga4Id?: string;
  gtmId?: string;
  hotjarId?: string;
  plausibleDomain?: string;
  matomoUrl?: string;
  matomoSiteId?: string;
  cloudflareToken?: string;
  hubspotId?: string;
};

function injectGa4(id: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) { w.dataLayer!.push(args); };
  w.gtag("js", new Date());
  w.gtag("config", id, { anonymize_ip: true });
}

function injectGtm(id: string) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

function injectHotjar(id: string) {
  const w = window as unknown as { hj?: unknown[]; _hjSettings?: unknown };
  w.hj = w.hj || [];
  w.hj.push(["init", id]);
  w._hjSettings = { hjid: Number(id), hjsv: 6 };
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://static.hotjar.com/c/hotjar-${encodeURIComponent(id)}.js?sv=6`;
  document.head.appendChild(s);
}

function injectPlausible(domain: string) {
  const s = document.createElement("script");
  s.defer = true;
  s.dataset.domain = domain;
  s.src = "https://plausible.io/js/script.js";
  document.head.appendChild(s);
}

function injectMatomo(url: string, siteId: string) {
  const w = window as unknown as { _paq?: unknown[] };
  w._paq = w._paq || [];
  w._paq.push(["trackPageView"], ["enableLinkTracking"]);
  (() => {
    const u = url.endsWith("/") ? url : url + "/";
    w._paq.push(["setTrackerUrl", u + "matomo.php"], ["setSiteId", siteId]);
    const s = document.createElement("script");
    s.async = true;
    s.src = u + "matomo.js";
    document.head.appendChild(s);
  })();
}

function injectHubspot(id: string) {
  const s = document.createElement("script");
  s.id = "hs-script-loader";
  s.async = true;
  s.defer = true;
  s.src = `https://js.hs-scripts.com/${encodeURIComponent(id)}.js`;
  document.body.appendChild(s);
}

function injectCloudflare(token: string) {
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.dataset.cfBeacon = token;
  document.head.appendChild(s);
}

export function ExternalAnalytics() {
  const cfg = useContent((s) => s.content.builder?.analytics) as A | undefined;

  useEffect(() => {
    if (!cfg) return;
    if (!readConsent()?.analytics) {
      // wait for consent before ever injecting a third-party script
      const onConsent = () => {
        window.removeEventListener("consent-changed", onConsent);
        // re-run this effect by forcing state through a custom event cycle
        window.dispatchEvent(new Event("external-analytics-go"));
      };
      window.addEventListener("consent-changed", onConsent);
      return () => window.removeEventListener("consent-changed", onConsent);
    }

    const injected: HTMLScriptElement[] = [];
    if (cfg.ga4Id) injectGa4(cfg.ga4Id);
    if (cfg.gtmId) injectGtm(cfg.gtmId);
    if (cfg.hotjarId) injectHotjar(cfg.hotjarId);
    if (cfg.plausibleDomain) injectPlausible(cfg.plausibleDomain);
    if (cfg.matomoUrl && cfg.matomoSiteId) injectMatomo(cfg.matomoUrl, cfg.matomoSiteId);
    if (cfg.cloudflareToken) injectCloudflare(cfg.cloudflareToken);
    if (cfg.hubspotId) injectHubspot(cfg.hubspotId);
    void injected;

    return undefined;
  }, [cfg]);

  // second phase after consent change (scripts injected once consent exists)
  useEffect(() => {
    const handler = () => {
      if (!cfg || !readConsent()?.analytics) return;
      if (cfg.ga4Id) injectGa4(cfg.ga4Id);
      if (cfg.gtmId) injectGtm(cfg.gtmId);
      if (cfg.hotjarId) injectHotjar(cfg.hotjarId);
      if (cfg.plausibleDomain) injectPlausible(cfg.plausibleDomain);
      if (cfg.matomoUrl && cfg.matomoSiteId) injectMatomo(cfg.matomoUrl, cfg.matomoSiteId);
      if (cfg.cloudflareToken) injectCloudflare(cfg.cloudflareToken);
      if (cfg.hubspotId) injectHubspot(cfg.hubspotId);
    };
    window.addEventListener("external-analytics-go", handler);
    return () => window.removeEventListener("external-analytics-go", handler);
  }, [cfg]);

  return null;
}
