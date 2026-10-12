// CMS analytics — recent sessions table (paginated) + data controls.
// GET    /api/analytics/sessions?limit=&offset=&bots=1   (auth)
// DELETE /api/analytics/sessions                          (auth) — wipe analytics

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 60));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const includeBots = url.searchParams.get("bots") === "1";

    const [sessions, total] = await Promise.all([
      db.visitSession.findMany({
        where: includeBots ? {} : { isBot: false },
        orderBy: { lastSeenAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.visitSession.count({ where: includeBots ? {} : { isBot: false } }),
    ]);

    return NextResponse.json({ ok: true, total, sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const deleted = await db.visitSession.deleteMany({});
    return NextResponse.json({ ok: true, deleted: deleted.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
