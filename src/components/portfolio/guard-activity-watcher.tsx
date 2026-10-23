"use client";

/* ============================================================
 * GuardActivityWatcher — client-side re-lock policies.
 *
 * Two independent policies, both configured per lock in the CMS:
 *
 *  1. IDLE RE-LOCK (idleMinutes > 0): a global activity clock
 *     (pointer/keyboard/scroll/touch) is watched; when the visitor
 *     has been idle for the lock's configured minutes, the unlock
 *     cookie for that target is DELETED server-side (/api/protection/
 *     relock) and the content re-fetched — the section really locks
 *     again (blur + stripped data), not just visually.
 *
 *  2. EXIT RE-LOCK (relockOnExit): an IntersectionObserver watches
 *     every [data-guard-target] element; once a target has ENTERED
 *     view at least once (so far-below sections don't insta-lock on
 *     page load), leaving the viewport for a moment withdraws the
 *     unlock the same way. Gallery locks use the popup's close
 *     handler instead (useGalleryGate.onPopupClose).
 *
 * Everything reads the store imperatively inside timers/observers —
 * no reactive re-subscriptions, so the watcher costs nothing until a
 * policy actually fires.
 * ============================================================ */

import { useEffect } from "react";
import { useContent } from "@/lib/content-store";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
/** How often the idle clock is checked. */
const IDLE_CHECK_MS = 10_000;
/** An exited section must stay out of view this long before re-locking
 *  (prevents flicker while rubber-band scrolling past a boundary). */
const EXIT_GRACE_MS = 700;

export function GuardActivityWatcher() {
  useEffect(() => {
    let lastActivity = Date.now();

    const bump = () => { lastActivity = Date.now(); };
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, bump, { passive: true });
    }

    // ── 1. idle re-lock clock ──────────────────────────────────────────
    const idleTimer = window.setInterval(() => {
      const s = useContent.getState();
      if (s.guardUnlocked.length === 0) return;
      const now = Date.now();
      const idleMs = now - lastActivity;
      const due = s.guardUnlocked.filter((target) => {
        const lock = s.guardSections[target];
        if (!lock || !lock.idleMinutes) return false;
        const threshold = lock.idleMinutes * 60_000;
        const sinceUnlock = now - (s.guardUnlockedAt[target] ?? now);
        return idleMs >= threshold && sinceUnlock >= threshold;
      });
      if (due.length > 0) void s.relockGuards(due);
    }, IDLE_CHECK_MS);

    // ── 2. exit re-lock observer ───────────────────────────────────────
    const seen = new Set<Element>();
    const exitTimers = new Map<Element, number>();

    const io = new IntersectionObserver((entries) => {
      const s = useContent.getState();
      for (const entry of entries) {
        const el = entry.target;
        const target = el.getAttribute("data-guard-target");
        if (!target) continue;

        if (entry.isIntersecting) {
          seen.add(el);
          const t = exitTimers.get(el);
          if (t) { window.clearTimeout(t); exitTimers.delete(el); }
          continue;
        }

        // Left the viewport — only relock if it was actually seen first
        // (never punish a section that simply sits below the fold) and
        // the policy is armed.
        if (!seen.has(el)) continue;
        const lock = s.guardSections[target];
        if (!lock?.relockOnExit) continue;
        if (!s.guardUnlocked.includes(target)) continue;

        const existing = exitTimers.get(el);
        if (existing) window.clearTimeout(existing);
        exitTimers.set(el, window.setTimeout(() => {
          exitTimers.delete(el);
          const store = useContent.getState();
          if (store.guardUnlocked.includes(target)) {
            void store.relockGuards([target]);
          }
        }, EXIT_GRACE_MS));
      }
    }, { threshold: 0 });

    const observeAll = () => {
      document.querySelectorAll<HTMLElement>("[data-guard-target]").forEach((el) => {
        io.observe(el);
      });
    };
    // Sections mount progressively (dynamic imports, CMS edits) — a light
    // re-scan covers newly attached shells without any store coupling.
    observeAll();
    const rescanTimer = window.setInterval(observeAll, 5_000);

    return () => {
      window.clearInterval(idleTimer);
      window.clearInterval(rescanTimer);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, bump);
      }
      for (const t of exitTimers.values()) window.clearTimeout(t);
      io.disconnect();
    };
  }, []);

  return null;
}
