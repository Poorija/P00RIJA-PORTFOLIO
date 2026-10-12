"use client";

/* ============================================================
 * VisitorTracker — privacy-conscious first-party analytics.
 *
 * Legal gating (GDPR/CCPA):
 *  - Nothing is sent until the visitor makes a cookie-consent choice
 *    that enables "analytics" (cookie-consent.tsx).
 *  - Do Not Track is honored even when consent is granted.
 *  - No cookies; identity is an ephemeral per-tab UUID that dies
 *    with the tab.
 * ============================================================ */

import { useEffect } from "react";
import { readConsent } from "./cookie-consent";

const SID_KEY = "p00rija-visit-sid";
const PING_MS = 30_000;

function allowed(): boolean {
  try {
    if (navigator.doNotTrack === "1" || (window as unknown as { doNotTrack?: string }).doNotTrack === "1") return false;
    return readConsent()?.analytics === true;
  } catch {
    return false;
  }
}

// Browser-side public IP: fetched through the visitor's own network path
// (VPN/proxy included) so local/test visits geolocate to where the person
// actually is. Cached per session; only sent with analytics consent.
let cachedClientIp: string | null = null;
function publicIp(): Promise<string> {
  if (cachedClientIp !== null) return Promise.resolve(cachedClientIp);
  return fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) })
    .then((r) => r.json())
    .then((j: { ip?: string }) => {
      cachedClientIp = typeof j.ip === "string" ? j.ip : "";
      return cachedClientIp;
    })
    .catch(() => {
      cachedClientIp = "";
      return "";
    });
}

function send(ev: "start" | "ping" | "end", sid: string) {
  if (!allowed()) return;
  try {
    const payload = JSON.stringify({
      sid,
      ev,
      ref: document.referrer || "",
      screen: `${screen.width}x${screen.height}`,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      lang: navigator.language || "",
      path: location.pathname,
      cip: cachedClientIp || undefined,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // analytics must never break the page
  }
}

export function VisitorTracker() {
  useEffect(() => {
    let sid = "";
    try {
      const existing = sessionStorage.getItem(SID_KEY);
      sid = existing ?? crypto.randomUUID();
      if (!existing) sessionStorage.setItem(SID_KEY, sid);
    } catch {
      sid = crypto.randomUUID();
    }

    let started = false;
    const begin = async () => {
      if (started || !allowed()) return;
      started = true;
      await publicIp();
      send("start", sid);
      interval = setInterval(() => {
        if (document.visibilityState === "visible") send("ping", sid);
      }, PING_MS);
    };

    let interval: ReturnType<typeof setInterval> | undefined;

    // If consent was already granted, start right away; otherwise wait for
    // the consent-changed event (banner decision or later change).
    begin();
    const onConsent = () => {
      if (allowed()) begin();
      else {
        started = false;
        if (interval) clearInterval(interval);
      }
    };
    window.addEventListener("consent-changed", onConsent);

    const onHide = () => {
      if (document.visibilityState === "hidden") send("ping", sid);
    };
    const onPageHide = () => send("end", sid);
    // After the admin wipes analytics from the CMS, immediately re-register
    // this visit (the server recreates the row on ping) so "Live now" never
    // sits at zero while the visitor is on the page.
    const onWiped = () => {
      if (document.visibilityState === "visible") send("ping", sid);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("analytics-wiped", onWiped);

    return () => {
      window.removeEventListener("consent-changed", onConsent);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("analytics-wiped", onWiped);
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}
