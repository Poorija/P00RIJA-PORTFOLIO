// CMS content API — root route (bilingual + auth-guarded writes).
// GET  /api/content            → { fa: SiteContent, en: SiteContent } (merged built-ins)
// GET  /api/content?all=1      → { sections: [{ section, data }] } — ALL DB rows (built-in + custom), as-is
// POST /api/content            → upsert one section/lang: { section, lang, data, meta? } (auth required)
// DELETE /api/content          → factory-reset CMS content rows (auth required)
//   - section must be a built-in SectionKey OR start with "custom-"
//   - lang+data updates one language; meta (object) merges into the row's _meta

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { defaultContentFa, defaultContentEn } from "@/lib/default-content";
import { blankContentFa, blankContentEn } from "@/lib/blank-content";
import {
  SECTION_KEYS,
  type SectionKey,
  type Lang,
  type SiteContent,
} from "@/lib/content-types";
import { isAuthenticated } from "@/lib/auth";
import { getContent, invalidateContent } from "@/lib/content-cache";
import { isDeveloperOwnerUnlocked, lockDeveloperOwner } from "@/lib/developer-owner";
import { pinDeveloperData } from "@/lib/vendor-identity";
import { readProtection, unlockedTargetsFromCookies } from "@/lib/site-protection";

function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === "string" && (SECTION_KEYS as string[]).includes(value);
}
function isCustomSectionKey(value: unknown): value is string {
  return typeof value === "string" && /^custom-[a-zA-Z0-9-]{1,96}$/.test(value);
}
/** Built-in section OR custom-* key. */
function isAcceptableSectionKey(value: unknown): value is string {
  return isSectionKey(value) || isCustomSectionKey(value);
}
function isLang(value: unknown): value is Lang {
  return value === "fa" || value === "en";
}

const DEFAULTS: Record<Lang, SiteContent> = process.env.P00RIJA_DISTRIBUTION_MODE === "null"
  ? { fa: blankContentFa, en: blankContentEn }
  : { fa: defaultContentFa, en: defaultContentEn };

// Default bilingual container for a section key (built-in defaults or empty for custom).
function defaultContainerFor(section: string): { fa: unknown; en: unknown; _meta?: Record<string, unknown> } {
  if (isSectionKey(section)) {
    return { fa: DEFAULTS.fa[section], en: DEFAULTS.en[section] };
  }
  return { fa: {}, en: {} };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const wantAll = url.searchParams.get("all") === "1";

    // `?all=1` is the CMS admin view: bypass cache (admin needs fresh rows incl. custom-* + _meta).
    if (wantAll) {
      if (!(await isAuthenticated())) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
      const rows = await db.content.findMany({ select: { section: true, data: true } });
      const sections = rows.map((r) => {
        let parsed: Record<string, unknown> = {};
        try {
          const p = JSON.parse(r.data);
          if (p && typeof p === "object" && !Array.isArray(p)) {
            parsed = p as Record<string, unknown>;
          }
        } catch {
          // keep {}
        }
        return { section: r.section, data: parsed };
      });
      return NextResponse.json({ ok: true, sections });
    }

    // Public read — served from the in-memory cache when fresh.
    // Cache-Control lets browsers/CDNs reuse the response too. Writes
    // invalidate the server cache immediately and the CMS clears the
    // browser-side caches on save, so a longer max-age is safe.
    let content = await getContent();

    // Access Guard: locked sections never leave the server without a valid
    // unlock cookie (or a CMS session). Stripped keys let the client fall
    // back to the bundled template defaults — the blurred preview — while
    // the real CMS content stays private. The strip runs on a SHALLOW COPY:
    // getContent() hands out its shared cached object, and deleting keys on
    // it would poison the cache for every subsequent request this TTL.
    const protection = await readProtection();
    const activeLocks = Object.entries(protection.sections)
      .filter(([, lock]) => lock.enabled && lock.hash)
      .map(([target]) => target);
    let responsePrivate = false;
    if (activeLocks.length > 0) {
      const authed = await isAuthenticated();
      if (!authed) {
        const cookieStore = await cookies();
        const unlocked = unlockedTargetsFromCookies(
          protection.sections,
          (name) => cookieStore.get(name)?.value
        );
        const fa = { ...(content.fa as unknown as Record<string, unknown>) };
        const en = { ...(content.en as unknown as Record<string, unknown>) };
        const custom = { ...(content.custom as Record<string, unknown>) };
        for (const target of activeLocks) {
          if (unlocked.has(target)) continue;
          if (target in custom) delete custom[target];
          if (target in fa) delete fa[target];
          if (target in en) delete en[target];
        }
        content = {
          fa: fa as unknown as typeof content.fa,
          en: en as unknown as typeof content.en,
          custom: custom as typeof content.custom,
        };
        responsePrivate = true;
      } else {
        // The admin variant differs from the anonymous one — never shareable.
        responsePrivate = true;
      }
    }

    const cache = content.en.builder?.cache ?? content.fa.builder?.cache;
    const maxAge = cache?.enabled === false
      ? 0
      : Math.max(0, Math.min(3_600, Number(cache?.contentTtlSeconds) || 120));
    const stale = cache?.enabled === false
      ? 0
      : Math.max(0, Math.min(604_800, Number(cache?.staleWhileRevalidateSeconds) || 600));
    return NextResponse.json(
      { ok: true, content },
      {
        headers: {
          // With active locks the payload depends on the requester's cookies —
          // shared caches must not store the stripped (or admin) variants.
          "Cache-Control": responsePrivate
            ? "private, max-age=30"
            : cache?.enabled === false
              ? "no-store"
              : `public, max-age=${maxAge}, stale-while-revalidate=${stale}`,
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth guard — only authenticated admins can write.
    const authed = await isAuthenticated();
    if (!authed) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    const body = await request.json();
    const { section, lang, data, meta } = body ?? {};

    if (!isAcceptableSectionKey(section)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid section. Must be one of: ${SECTION_KEYS.join(", ")}, or start with "custom-".`,
        },
        { status: 400 }
      );
    }
    if (section === "developer" && !(await isDeveloperOwnerUnlocked())) {
      return NextResponse.json({ ok: false, error: "Developer owner key required" }, { status: 403 });
    }

    // Validate lang+data pairing (if lang is provided).
    if (lang !== undefined) {
      if (!isLang(lang)) {
        return NextResponse.json(
          { ok: false, error: "Invalid lang. Must be 'fa' or 'en'." },
          { status: 400 }
        );
      }
      if (data === undefined || data === null) {
        return NextResponse.json(
          { ok: false, error: "Missing 'data' field when 'lang' is provided." },
          { status: 400 }
        );
      }
    }

    // Validate optional meta.
    if (meta !== undefined) {
      if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
        return NextResponse.json(
          { ok: false, error: "Invalid 'meta'. Must be a plain object." },
          { status: 400 }
        );
      }
    }

    if (lang === undefined && meta === undefined) {
      return NextResponse.json(
        { ok: false, error: "Nothing to update — provide 'lang'+'data' and/or 'meta'." },
        { status: 400 }
      );
    }

    // Read existing row (or build default container), update the requested pieces, persist.
    const existing = await db.content.findUnique({ where: { section } });
    let current: Record<string, unknown>;
    if (existing) {
      try {
        const parsed = JSON.parse(existing.data);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed as Record<string, unknown>;
        } else {
          current = defaultContainerFor(section);
        }
      } catch {
        current = defaultContainerFor(section);
      }
    } else {
      current = defaultContainerFor(section);
    }

    if (lang !== undefined) {
      current[lang] = section === "developer" ? pinDeveloperData(data, lang) : data;
    }
    if (meta !== undefined) {
      const prevMeta = (current._meta && typeof current._meta === "object" && !Array.isArray(current._meta)
        ? current._meta
        : {}) as Record<string, unknown>;
      current._meta = { ...prevMeta, ...meta };
    }

    const json = JSON.stringify(current);

    await db.content.upsert({
      where: { section },
      update: { data: json },
      create: { section, data: json },
    });

    invalidateContent();

    if (section === "developer") await lockDeveloperOwner();

    return NextResponse.json({ ok: true, section, lang: lang ?? null, metaUpdated: meta !== undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const authed = await isAuthenticated();
    if (!authed) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Preserve the signed/owner-only developer card exactly as it is. Factory
    // reset removes every other content row and every upload.
    const developerRow = await db.content.findUnique({ where: { section: "developer" }, select: { data: true } });

    await db.$transaction(async (tx) => {
      await tx.post.deleteMany({});
      await tx.user.deleteMany({});
      await tx.content.deleteMany({});
      await tx.upload.deleteMany({});
      await tx.authSettings.deleteMany({});
      await tx.content.createMany({
        data: SECTION_KEYS.map((section) => ({
          section,
          data: section === "developer" && developerRow?.data
            ? developerRow.data
            : JSON.stringify({ fa: blankContentFa[section], en: blankContentEn[section] }),
        })),
      });
    });

    invalidateContent();

    return NextResponse.json({
      ok: true,
      reset: "blank-canvas",
      uploadsDeleted: true,
      authenticationReset: true,
      usersDeleted: true,
      postsDeleted: true,
      clientStorageKeys: [
        "p00rija-404-leaderboard",
        "p00rija-404-coins",
        "p00rija-404-upgrades",
        "p00rija-content-cache-v1",
        "cb-best-tries",
        "cm-best-score",
        "nm-best-round",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
