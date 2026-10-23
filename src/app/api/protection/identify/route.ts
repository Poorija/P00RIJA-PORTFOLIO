// POST /api/protection/identify — bind this browser to a visitor id.
//
// The client sends its device fingerprint; the server combines it with
// the UA family (NOT the IP — a VPN must not mint a fresh identity),
// resolves/creates the visitor record and sets the signed httpOnly
// p00_vid cookie (1 year). The proxy and the unlock endpoint enforce
// blocks against this id, so clearing cookies or switching VPN exits
// re-derives the SAME id on the next visit and the block re-arms.

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { resolveVisitor, createVidToken, VID_COOKIE } from "@/lib/visitor-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8 * 1024) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    const body = await request.json().catch(() => ({}));
    const fpHash = typeof body?.fp?.hash === "string" ? body.fp.hash.slice(0, 128) : "";
    const platform = typeof body?.fp?.platform === "string" ? body.fp.platform.slice(0, 64) : "";
    const timezone = typeof body?.fp?.timezone === "string" ? body.fp.timezone.slice(0, 64) : "";
    if (!/^[a-f0-9]{64}$/.test(fpHash) && fpHash !== "") {
      return NextResponse.json({ ok: false, error: "Invalid fingerprint" }, { status: 400 });
    }

    const requestHeaders = await headers();
    const xff = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = xff || requestHeaders.get("x-real-ip")?.trim() || "local";
    const ua = requestHeaders.get("user-agent") ?? "";

    const record = await resolveVisitor({ ip, ua, fpHash, platform, timezone });

    const store = await cookies();
    const requestHeaders2 = await headers();
    const forwardedProto = requestHeaders2.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const secure = forwardedProto === "https" || requestHeaders2.get("x-forwarded-ssl") === "on";
    store.set(VID_COOKIE, createVidToken(record.vid), {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 365 * 86_400,
    });

    return NextResponse.json(
      { ok: true, blocked: record.blocked },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
