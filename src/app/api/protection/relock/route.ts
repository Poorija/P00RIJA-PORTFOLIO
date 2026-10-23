// POST /api/protection/relock — withdraw THIS browser's unlock for a target.
//
// Called by the client when an idle-time or exit re-lock policy fires
// (or when the visitor wants to lock again). Deletes the signed unlock
// cookie so the re-lock is real: the next /api/content response strips
// the protected payloads again. No auth — it only ever restricts the
// caller's own session (logout semantics).

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { guardCookieName, isValidTarget } from "@/lib/site-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4 * 1024) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    const body = await request.json().catch(() => null);
    const targets: string[] = Array.isArray(body?.targets) && body.targets.every((t: unknown) => typeof t === "string")
      ? body.targets
      : typeof body?.target === "string" ? [body.target] : [];

    if (targets.length === 0 || targets.length > 50) {
      return NextResponse.json({ ok: false, error: "target or targets[] required" }, { status: 400 });
    }

    const store = await cookies();
    const cleared: string[] = [];
    for (const target of targets) {
      if (!isValidTarget(target)) continue;
      store.delete(guardCookieName(target));
      cleared.push(target);
    }

    return NextResponse.json(
      { ok: true, cleared },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
