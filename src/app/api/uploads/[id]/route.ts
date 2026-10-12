// Download/serve an uploaded file.
// GET /api/uploads/<id>            → inline preview (PDF in browser tab)
// GET /api/uploads/<id>?download=1 → forced download (résumé)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateContent } from "@/lib/content-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const upload = await db.upload.findUnique({ where: { id } });
    if (!upload) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
    const inlineSafe = upload.mime === "application/pdf" || upload.mime === "application/json" || upload.mime.startsWith("image/") || upload.mime.startsWith("video/") || upload.mime.startsWith("audio/") || upload.mime.startsWith("font/") || upload.mime.startsWith("model/");
    const buffer = Buffer.from(upload.data, "base64");
    const safeName = upload.filename.replace(/["\\\r\n]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": upload.mime || "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
          "Content-Disposition": wantsDownload || !inlineSafe
            ? `attachment; filename="${safeName}"`
            : `inline; filename="${safeName}"`,
          "X-Content-Type-Options": "nosniff",
          // Upload ids are immutable cuids — cache aggressively.
          "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const url = `/api/uploads/${id}`;
  const rows = await db.content.findMany();
  const usedBy = rows.filter((row) => row.data.includes(url)).map((row) => row.section);
  if (usedBy.length) return NextResponse.json({ ok: false, error: `Asset is used by: ${usedBy.join(", ")}`, usedBy }, { status: 409 });
  await db.upload.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  const clean = (key: string, max: number) => typeof body[key] === "string" ? String(body[key]).trim().slice(0, max) : undefined;
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean).slice(0, 30)
    : undefined;
  const data = {
    filename: clean("filename", 255),
    title: clean("title", 160),
    altText: clean("altText", 500),
    category: clean("category", 80),
    tags: tags ? JSON.stringify(tags) : undefined,
  };
  const upload = await db.upload.update({ where: { id }, data, select: { id: true, filename: true, title: true, altText: true, category: true, tags: true, mime: true, size: true, createdAt: true, updatedAt: true } }).catch(() => null);
  if (!upload) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  invalidateContent();
  return NextResponse.json({ ok: true, upload: { ...upload, tags: JSON.parse(upload.tags || "[]"), url: `/api/uploads/${upload.id}` } });
}
