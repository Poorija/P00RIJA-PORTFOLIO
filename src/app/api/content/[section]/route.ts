// Per-section content API (bilingual + auth-guarded writes).
// GET    /api/content/[section]            → returns { fa, en } for the section
// GET    /api/content/[section]?lang=fa    → returns one language
// PUT    /api/content/[section]            → upserts: { lang, data } (auth required)
// DELETE /api/content/[section]            → deletes the row (auth required; custom- only)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { defaultContentFa, defaultContentEn } from "@/lib/default-content";
import { blankContentFa, blankContentEn } from "@/lib/blank-content";
import {
  SECTION_KEYS,
  type SectionKey,
  type Lang,
} from "@/lib/content-types";
import { isAuthenticated } from "@/lib/auth";
import { getContentSection, invalidateContent } from "@/lib/content-cache";
import { isDeveloperOwnerUnlocked, lockDeveloperOwner } from "@/lib/developer-owner";
import { pinDeveloperData } from "@/lib/vendor-identity";
import { readProtection, unlockedTargetsFromCookies } from "@/lib/site-protection";

function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as string[]).includes(value);
}
function isCustomSectionKey(value: string): boolean {
  return /^custom-[a-zA-Z0-9-]{1,96}$/.test(value);
}
function isLang(value: unknown): value is Lang {
  return value === "fa" || value === "en";
}

const DEFAULTS = process.env.P00RIJA_DISTRIBUTION_MODE === "null"
  ? { fa: blankContentFa, en: blankContentEn }
  : { fa: defaultContentFa, en: defaultContentEn };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  try {
    const { section } = await params;
    if (!isSectionKey(section)) {
      return NextResponse.json({ ok: false, error: "Invalid section" }, { status: 400 });
    }
    if (section === "developer" && !(await isDeveloperOwnerUnlocked())) {
      return NextResponse.json({ ok: false, error: "Developer owner key required" }, { status: 403 });
    }
    const url = new URL(request.url);
    const langParam = url.searchParams.get("lang");

    // Access Guard: a locked section's DB data is withheld from anyone
    // without a valid unlock cookie (CMS admins excepted) — serve the
    // bundled defaults instead, exactly like the stripped /api/content.
    const protection = await readProtection();
    const lock = protection.sections[section];
    let data = await getContentSection(section);
    if (lock?.enabled && lock.hash && !(await isAuthenticated())) {
      const cookieStore = await cookies();
      const unlocked = unlockedTargetsFromCookies(
        protection.sections,
        (name) => cookieStore.get(name)?.value
      );
      if (!unlocked.has(section)) {
        data = { fa: DEFAULTS.fa[section], en: DEFAULTS.en[section] };
      }
    }

    if (isLang(langParam)) {
      return NextResponse.json({ ok: true, section, lang: langParam, data: data[langParam] });
    }
    return NextResponse.json({ ok: true, section, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  try {
    const authed = await isAuthenticated();
    if (!authed) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { section } = await params;
    if (!isSectionKey(section)) {
      return NextResponse.json({ ok: false, error: "Invalid section" }, { status: 400 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    const body = await request.json();
    const { lang, data } = body ?? {};
    if (!isLang(lang)) {
      return NextResponse.json({ ok: false, error: "Invalid lang" }, { status: 400 });
    }
    if (data === undefined || data === null) {
      return NextResponse.json({ ok: false, error: "Missing 'data'" }, { status: 400 });
    }

    // The developer section carries the vendor identity — it needs the
    // developer-owner key (same rule as POST /api/content) and every write
    // is re-pinned to the official identity values before persisting.
    if (section === "developer") {
      if (!(await isDeveloperOwnerUnlocked())) {
        return NextResponse.json({ ok: false, error: "Developer owner key required" }, { status: 403 });
      }
    }

    const existing = await db.content.findUnique({ where: { section } });
    let current: { fa: unknown; en: unknown };
    if (existing) {
      try {
        current = JSON.parse(existing.data);
      } catch {
        current = { fa: DEFAULTS.fa[section], en: DEFAULTS.en[section] };
      }
    } else {
      current = { fa: DEFAULTS.fa[section], en: DEFAULTS.en[section] };
    }
    current[lang] = section === "developer" ? pinDeveloperData(data, lang) : data;
    const json = JSON.stringify(current);

    await db.content.upsert({
      where: { section },
      update: { data: json },
      create: { section, data: json },
    });

    invalidateContent();

    if (section === "developer") await lockDeveloperOwner();

    return NextResponse.json({ ok: true, section, lang });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// DELETE /api/content/[section] — auth-guarded, custom- only.
// Built-in sections (site, hero, graphics, security, ai, synthesis, footer)
// can NEVER be deleted — the route refuses and returns 400.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  try {
    const authed = await isAuthenticated();
    if (!authed) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { section } = await params;
    if (!isCustomSectionKey(section)) {
      return NextResponse.json(
        { ok: false, error: "Built-in sections cannot be deleted." },
        { status: 400 }
      );
    }
    await db.content.deleteMany({ where: { section } });
    invalidateContent();
    return NextResponse.json({ ok: true, section });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
