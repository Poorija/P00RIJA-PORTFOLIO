import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { gateRequest } from "@/lib/defense";
import { readGateState } from "@/lib/licensing";
import { isAuthenticatedRequest } from "@/lib/auth";
import {
  TARGET_SITE,
  guardCookieName,
  readProtection,
  verifyUnlockToken,
} from "@/lib/site-protection";
import { VID_COOKIE, isBlockedVid, verifyVidToken } from "@/lib/visitor-identity";

/* ============================================================
 * P00RIJA defense proxy (Next.js 16 — proxy replaces middleware).
 * Runs before every dynamic request:
 *   1. LICENSE GATE — when licensing is enabled (vendor keys present)
 *      and no valid license is activated (or the licensing service
 *      reports it revoked/expired, or the grace window burned out),
 *      everything is locked: page requests redirect to /license and
 *      APIs get 503 until the license becomes valid again.
 *   2. DEFENSE GATE — classifies the visitor with the file-backed
 *      defense store and hard-blocks scanners, banned IPs and
 *      rate-limit offenders with a minimal 403.
 *
 * Static internals are excluded via `config.matcher` so the gates
 * cost nothing on assets.
 * ============================================================ */

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "";
}

function blockResponse(): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>403 — Blocked</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#0a0f0d;color:#9fe8c8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center}
main{padding:2rem}h1{font-size:1.6rem;letter-spacing:.2em;margin:0 0 .5rem}p{opacity:.6;font-size:.8rem}</style></head>
<body><main><h1>403 / ACCESS DENIED</h1><p>Your request was blocked by this site's defense system.<br/>If you believe this is a mistake, try again later.</p></main></body></html>`,
    {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

function licenseGateResponse(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "License required — site is locked." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  const url = new URL("/license", req.url);
  return NextResponse.redirect(url, { status: 307, headers: { "Cache-Control": "no-store" } });
}

export async function proxy(req: NextRequest) {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const path = req.nextUrl.pathname;

  // 1) License gate (cached — at most one DB read per 10s).
  try {
    const gate = await readGateState();
    if (gate.phase === "unlicensed" || gate.phase === "maintenance") {
      const allowed =
        path === "/license" ||
        path.startsWith("/api/license") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/_next") ||
        path === "/favicon.ico" ||
        path === "/logo.svg" ||
        path === "/logo.png";
      if (!allowed) return licenseGateResponse(req);
    }
  } catch {
    // A licensing hiccup must never take the site down on its own.
  }

  // 2) Site password gate (Access Guard) — when a whole-site password is
  //    set, everything except the /gate page (and the auth/protection APIs
  //    plus statics) is closed until the visitor unlocks. CMS admins and
  //    holders of a valid site unlock cookie always pass.
  try {
    const protection = await readProtection();
    if (protection.site.enabled && protection.site.hash) {
      const unlocked = verifyUnlockToken(
        TARGET_SITE,
        req.cookies.get(guardCookieName(TARGET_SITE))?.value
      );
      if (!unlocked && !isAuthenticatedRequest(req)) {
        const allowed =
          path === "/gate" ||
          path.startsWith("/api/protection") ||
          path.startsWith("/api/auth") ||
          path.startsWith("/_next") ||
          path === "/favicon.ico" ||
          path === "/logo.svg" ||
          path === "/logo.png" ||
          path.startsWith("/images/") ||
          path.startsWith("/assets/");
        if (!allowed) {
          if (path.startsWith("/api/")) {
            return NextResponse.json(
              { ok: false, error: "Site is password-protected." },
              { status: 503, headers: { "Cache-Control": "no-store" } }
            );
          }
          return NextResponse.redirect(new URL("/gate", req.url), {
            status: 307,
            headers: { "Cache-Control": "no-store" },
          });
        }
      }
    }
  } catch {
    // The guard must never take the site down on its own.
  }

  // 2.5) Blocked-visitor gate — a revoked visitor (wrong-password abuser,
  //      manually blocked from the CMS) is kept out of the whole site: the
  //      signed p00_vid cookie re-derives from the device fingerprint after
  //      cookie clearing / VPN switching, so the block re-arms on the next
  //      identify call. CMS admins are never affected.
  try {
    const vid = verifyVidToken(req.cookies.get(VID_COOKIE)?.value);
    if (vid && !isAuthenticatedRequest(req) && (await isBlockedVid(vid))) {
      return blockResponse();
    }
  } catch {
    // identity storage hiccup must never take the site down
  }

  // 3) Defense gate.
  try {
    const verdict = await gateRequest({ ip, ua, method: req.method, path });
    if (!verdict.allow) return blockResponse();
  } catch {
    // The moat must never take the site down with it.
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // everything except Next.js internals, dev HMR websocket and static assets
    "/((?!_next/static|_next/image|_next/hmr|_next/webpack-hmr|favicon.ico|logo.svg|logo.png|images/|assets/).*)",
  ],
};
