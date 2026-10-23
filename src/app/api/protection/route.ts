// Access Guard API — site & section password protection.
// GET  /api/protection          → public lock snapshot + which targets this browser unlocked
// GET  /api/protection?admin=1  → full admin view (auth; incl. disabled/attempt state)
// POST /api/protection          → admin ops: { action: set|clear|reset, ... } (auth required)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthenticated } from "@/lib/auth";
import {
  TARGET_SITE,
  clearLock,
  clearTempPassword,
  getProtectionSnapshot,
  guardCookieName,
  readProtection,
  resetAttempts,
  setLock,
  unlockedTargetsFromCookies,
  verifyUnlockToken,
  type LockKind,
  type LockMode,
} from "@/lib/site-protection";
import { getContent } from "@/lib/content-cache";
import { auditFeed, blockVisitor, listVisitors, unblockVisitor } from "@/lib/visitor-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renderable targets the CMS offers: configured locks + builder sections.
 *  Sections that HAVE a gallery (builtin graphics/security/ai or custom
 *  sections with gallery data) also get a `gallery:<id>` lock target. */
async function knownTargets(): Promise<string[]> {
  const targets = new Set<string>([
    "hero", "graphics", "security", "ai", "timeline", "synthesis", "footer",
  ]);
  try {
    const content = await getContent();
    const builderIds = new Set<string>();
    for (const s of [...(content.en.builder?.sections ?? []), ...(content.fa.builder?.sections ?? [])]) {
      if (typeof s?.id === "string" && s.id) builderIds.add(s.id);
    }
    for (const id of builderIds) targets.add(id);
    // Gallery-capable builtins.
    for (const id of ["graphics", "security", "ai"] as const) {
      const hasGallery = Boolean(
        (content.en[id] as { gallery?: unknown } | undefined)?.gallery ||
        (content.fa[id] as { gallery?: unknown } | undefined)?.gallery
      );
      if (hasGallery) targets.add(`gallery:${id}`);
    }
    // Custom sections with a gallery configured.
    for (const [id, data] of Object.entries(content.custom ?? {})) {
      const hasGallery = Boolean(
        (data?.en as { gallery?: unknown } | undefined)?.gallery ||
        (data?.fa as { gallery?: unknown } | undefined)?.gallery
      );
      if (hasGallery) targets.add(`gallery:${id}`);
    }
  } catch {
    // content store hiccup — defaults above are enough
  }
  targets.delete("developer");
  return [...targets].sort();
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const wantAdmin = url.searchParams.get("admin") === "1";

    if (wantAdmin) {
      if (!(await isAuthenticated())) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
      const snapshot = await getProtectionSnapshot();
      const state = await readProtection();
      const adminSections: Record<string, unknown> = {};
      for (const [target, info] of Object.entries(snapshot.sections)) {
        adminSections[target] = info;
      }
      return NextResponse.json(
        {
          ok: true,
          admin: true,
          site: snapshot.site,
          sections: adminSections,
          // configured-but-inactive locks too (for the CMS editor)
          rawSectionTargets: Object.keys(state.sections),
          targets: await knownTargets(),
          visitors: await listVisitors(),
          audit: await auditFeed(80),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Public snapshot: lock metadata (never hashes) + unlock state.
    const store = await cookies();
    const state = await readProtection();
    const unlocked = [...unlockedTargetsFromCookies(state.sections, (name) => store.get(name)?.value)];
    if (state.site.enabled && state.site.hash) {
      if (verifyUnlockToken(TARGET_SITE, store.get(guardCookieName(TARGET_SITE))?.value)) {
        unlocked.push(TARGET_SITE);
      }
    }
    const snapshot = await getProtectionSnapshot();
    return NextResponse.json(
      { ok: true, site: snapshot.site, sections: snapshot.sections, unlocked },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 64 * 1024) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    const body = await request.json();
    const action = body?.action;

    if (action === "set") {
      const target = typeof body.target === "string" ? body.target : "";
      const result = await setLock({
        target,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        kind: (["pin4", "pin6", "text"] as LockKind[]).includes(body.kind) ? body.kind : undefined,
        mode: (["permanent", "attempts"] as LockMode[]).includes(body.mode) ? body.mode : undefined,
        maxAttempts: body.maxAttempts !== undefined ? Number(body.maxAttempts) : undefined,
        unlockDays: body.unlockDays !== undefined ? Number(body.unlockDays) : undefined,
        password: typeof body.password === "string" ? body.password : undefined,
        tempPassword: typeof body.tempPassword === "string" ? body.tempPassword : undefined,
        tempExpiresAt: body.tempExpiresAt !== undefined ? Number(body.tempExpiresAt) : undefined,
        idleMinutes: body.idleMinutes !== undefined ? Number(body.idleMinutes) : undefined,
        relockOnExit: typeof body.relockOnExit === "boolean" ? body.relockOnExit : undefined,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, lock: result.info });
    }

    if (action === "cleartemp") {
      const target = typeof body.target === "string" ? body.target : "";
      const info = await clearTempPassword(target);
      if (!info) return NextResponse.json({ ok: false, error: "Invalid target" }, { status: 400 });
      return NextResponse.json({ ok: true, lock: info });
    }

    if (action === "clear") {
      const target = typeof body.target === "string" ? body.target : "";
      const cleared = await clearLock(target);
      if (!cleared) return NextResponse.json({ ok: false, error: "Invalid target" }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "reset") {
      const target = typeof body.target === "string" ? body.target : "";
      const info = await resetAttempts(target);
      if (!info) return NextResponse.json({ ok: false, error: "Invalid target" }, { status: 400 });
      return NextResponse.json({ ok: true, lock: info });
    }

    if (action === "visitor-block") {
      const vid = typeof body.vid === "string" ? body.vid : "";
      const reason = typeof body.reason === "string" ? body.reason.slice(0, 120) : "manual";
      if (!/^[a-f0-9]{32}$/.test(vid)) return NextResponse.json({ ok: false, error: "Invalid vid" }, { status: 400 });
      const ok = await blockVisitor(vid, reason);
      if (!ok) return NextResponse.json({ ok: false, error: "Unknown visitor" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (action === "visitor-unblock") {
      const vid = typeof body.vid === "string" ? body.vid : "";
      if (!/^[a-f0-9]{32}$/.test(vid)) return NextResponse.json({ ok: false, error: "Invalid vid" }, { status: 400 });
      const ok = await unblockVisitor(vid);
      if (!ok) return NextResponse.json({ ok: false, error: "Unknown visitor" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
