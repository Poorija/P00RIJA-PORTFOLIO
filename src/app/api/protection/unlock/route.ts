// POST /api/protection/unlock — verify a section/site password.
//
// Responses:
//   200 { ok: true }                       correct password (unlock cookie set)
//   400 { ok: false, error }               malformed body / unknown target
//   401 { ok: false, remaining }           wrong password (remaining = -1 in permanent mode)
//   423 { ok: false, disabled: true }      target disabled by too many wrong attempts
//   429 { ok: false }                      per-IP rate limit
//
// An authenticated CMS session unlocks without a password — the owner must
// always be able to preview and manage their own site.

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { isAuthenticated } from "@/lib/auth";
import {
  TARGET_SITE,
  createUnlockToken,
  guardCookieName,
  isUnlockRateLimited,
  readProtection,
  verifyUnlockAttempt,
} from "@/lib/site-protection";
import { VID_COOKIE, isBlockedVid, recordUnlockAttempt, verifyVidToken } from "@/lib/visitor-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8 * 1024) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    const body = await request.json().catch(() => null);
    const target = typeof body?.target === "string" ? body.target : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!target || typeof body?.password !== "string") {
      return NextResponse.json({ ok: false, error: "target and password required" }, { status: 400 });
    }

    const state = await readProtection();
    const lock = target === TARGET_SITE ? state.site : state.sections[target];
    if (!lock || !lock.enabled || !lock.hash) {
      return NextResponse.json({ ok: false, error: "No lock configured for this target" }, { status: 400 });
    }

    // Owner convenience: a valid CMS session always unlocks.
    const admin = await isAuthenticated();

    // Visitor identity (strict mode): a BLOCKED visitor is denied even with
    // the correct password, and every attempt outcome lands in the audit
    // feed shown in the CMS Visitors panel.
    const cookieStore = await cookies();
    const vid = verifyVidToken(cookieStore.get(VID_COOKIE)?.value) ?? "";
    const ip = clientIp(request);
    if (!admin && vid && (await isBlockedVid(vid))) {
      await recordUnlockAttempt(vid, target, "blocked", ip);
      return NextResponse.json(
        { ok: false, blocked: true, error: "Your access has been revoked by the site owner." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!admin && isUnlockRateLimited(clientIp(request))) {
      if (vid) await recordUnlockAttempt(vid, target, "wrong", ip);
      return NextResponse.json(
        { ok: false, error: "Too many attempts — try again in a minute." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    let outcome = admin
      ? { status: "ok" as const, unlockDays: lock.unlockDays }
      : await verifyUnlockAttempt(target, password);

    if (vid && !admin) {
      await recordUnlockAttempt(vid, target, outcome.status === "ok" ? "ok" : outcome.status === "no-lock" ? "wrong" : outcome.status, ip);
    }

    if (outcome.status === "no-lock") {
      return NextResponse.json({ ok: false, error: "No lock configured for this target" }, { status: 400 });
    }
    if (outcome.status === "disabled") {
      return NextResponse.json(
        { ok: false, disabled: true, error: "This lock is disabled after too many wrong attempts." },
        { status: 423, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (outcome.status === "wrong") {
      return NextResponse.json(
        { ok: false, remaining: outcome.remaining },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Success — set the signed, httpOnly unlock cookie.
    const token = createUnlockToken(target, outcome.unlockDays);
    const store = await cookies();
    const requestHeaders = await headers();
    const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const secure = forwardedProto === "https" || requestHeaders.get("x-forwarded-ssl") === "on";
    const maxAge = outcome.unlockDays > 0 ? outcome.unlockDays * 86_400 : undefined;
    store.set(guardCookieName(target), token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      ...(maxAge !== undefined ? { maxAge } : {}),
    });

    return NextResponse.json(
      { ok: true, target },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
