// PWA icon generator — takes ONE source image (an uploaded file data URL or
// an existing Media-Library upload id) and produces every size the PWA
// ecosystem needs with sharp:
//   512×512 (manifest any) · 192×192 (manifest) · 180×180 (iOS apple-touch)
//   512×512 maskable (source centered at ~75% on the theme background)
// The generated PNGs are stored as Upload rows (category "PWA") and written
// straight into the global `pwa` content section (both languages).

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateContent } from "@/lib/content-cache";

const SIZES = [
  { key: "icon512", size: 512, filename: "pwa-icon-512.png" },
  { key: "icon192", size: 192, filename: "pwa-icon-192.png" },
  { key: "appleTouchIcon", size: 180, filename: "pwa-apple-touch-icon.png" },
] as const;

async function readPwaRow(lang: "fa" | "en"): Promise<Record<string, unknown>> {
  const row = await db.content.findUnique({ where: { section: "pwa" } });
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.data) as { fa?: Record<string, unknown>; en?: Record<string, unknown> };
    return (lang === "fa" ? parsed.fa : parsed.en) ?? {};
  } catch {
    return {};
  }
}

async function writePwaRow(lang: "fa" | "en", data: Record<string, unknown>): Promise<void> {
  const row = await db.content.findUnique({ where: { section: "pwa" } });
  let container: { fa?: Record<string, unknown>; en?: Record<string, unknown> } = {};
  if (row) {
    try {
      container = JSON.parse(row.data) as typeof container;
    } catch {
      container = {};
    }
  }
  container[lang] = data;
  await db.content.upsert({
    where: { section: "pwa" },
    update: { data: JSON.stringify(container) },
    create: { section: "pwa", data: JSON.stringify(container) },
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as { uploadId?: unknown; dataUrl?: unknown };
    let source: Buffer | null = null;

    if (typeof body.uploadId === "string" && body.uploadId) {
      const upload = await db.upload.findUnique({ where: { id: body.uploadId }, select: { data: true, mime: true } });
      if (!upload) return NextResponse.json({ ok: false, error: "Library asset not found." }, { status: 404 });
      source = Buffer.from(upload.data, "base64");
    } else if (typeof body.dataUrl === "string" && body.dataUrl.startsWith("data:image/")) {
      const base64 = body.dataUrl.slice(body.dataUrl.indexOf(",") + 1);
      if (base64.length > 12_000_000) {
        return NextResponse.json({ ok: false, error: "Image too large (max ~9MB)." }, { status: 413 });
      }
      source = Buffer.from(base64, "base64");
    } else {
      return NextResponse.json({ ok: false, error: "Provide an image dataUrl or a library uploadId." }, { status: 400 });
    }

    // Maskable background: the configured PWA background color (fallback dark).
    const current = await readPwaRow("en");
    const bgColor = typeof current.backgroundColor === "string" && /^#[0-9a-fA-F]{6}$/.test(current.backgroundColor)
      ? current.backgroundColor
      : "#0a0a12";

    const results: Record<string, string> = {};
    try {
      for (const spec of SIZES) {
        const png = await sharp(source, { failOn: "none" })
          .resize(spec.size, spec.size, { fit: "cover", position: "center" })
          .png()
          .toBuffer();
        const upload = await db.upload.create({
          data: {
            filename: spec.filename,
            title: `PWA ${spec.size}×${spec.size}`,
            altText: "PWA icon",
            category: "PWA",
            tags: JSON.stringify(["pwa", "icon", "auto-generated"]),
            mime: "image/png",
            size: png.byteLength,
            data: png.toString("base64"),
          },
          select: { id: true },
        });
        results[spec.key] = `/api/uploads/${upload.id}`;
      }
      // Maskable: source at 75% centered on the theme background (safe area).
      const inner = await sharp(source, { failOn: "none" })
        .resize(384, 384, { fit: "cover", position: "center" })
        .png()
        .toBuffer();
      const maskable = await sharp({
        create: { width: 512, height: 512, channels: 4, background: bgColor },
      })
        .composite([{ input: inner, left: 64, top: 64 }])
        .png()
        .toBuffer();
      const upload = await db.upload.create({
        data: {
          filename: "pwa-icon-maskable-512.png",
          title: "PWA maskable 512×512",
          altText: "PWA maskable icon",
          category: "PWA",
          tags: JSON.stringify(["pwa", "icon", "maskable", "auto-generated"]),
          mime: "image/png",
          size: maskable.byteLength,
          data: maskable.toString("base64"),
        },
        select: { id: true },
      });
      results.iconMaskable512 = `/api/uploads/${upload.id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "image processing failed";
      return NextResponse.json(
        { ok: false, error: `Could not process the image (is it a valid PNG/JPG/WebP/SVG?). ${message}` },
        { status: 400 }
      );
    }

    // Persist into the global pwa section (both languages stay in sync).
    for (const lang of ["fa", "en"] as const) {
      const data = await readPwaRow(lang);
      data.icon512 = results.icon512;
      data.icon192 = results.icon192;
      data.iconMaskable512 = results.iconMaskable512;
      data.appleTouchIcon = results.appleTouchIcon;
      await writePwaRow(lang, data);
    }
    invalidateContent();

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
