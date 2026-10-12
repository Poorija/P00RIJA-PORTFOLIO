// Upload API — auth-guarded binary uploads (résumé PDF, avatar, …).
// POST /api/uploads  (multipart/form-data, field "file") → { ok, id, url, filename }
// Files are stored base64 in SQLite (Upload model) so they survive rebuilds
// and Docker volume remounts without extra infrastructure.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateContent } from "@/lib/content-cache";

const MAX_BYTES = Math.max(8, Number(process.env.UPLOAD_MAX_MB || 64)) * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
  "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
  "application/json", "text/plain", "text/csv",
  "font/woff", "font/woff2", "font/ttf", "font/otf", "application/font-woff", "application/x-font-ttf", "application/x-font-otf", "application/vnd.ms-fontobject",
  "model/gltf-binary", "model/gltf+json", "application/octet-stream",
]);

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const uploads = await db.upload.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, filename: true, title: true, altText: true, category: true, tags: true, mime: true, size: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ ok: true, uploads: uploads.map((file) => ({ ...file, tags: safeTags(file.tags), url: `/api/uploads/${file.id}` })) });
}

function safeTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch { return []; }
}

function cleanMeta(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const MIME_BY_EXTENSION: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

function resolveUploadMime(file: File): string | undefined {
  if (ALLOWED_MIME.has(file.type)) return file.type;
  const extension = file.name.toLowerCase().split(".").pop() || "";
  return MIME_BY_EXTENSION[extension];
}

export async function POST(request: NextRequest) {
  try {
    const authed = await isAuthenticated();
    if (!authed) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BYTES + 1024 * 1024) {
      return NextResponse.json({ ok: false, error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB).` }, { status: 413 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing 'file' field." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB).` },
        { status: 413 }
      );
    }
    const mime = resolveUploadMime(file);
    if (!mime) {
      return NextResponse.json(
        { ok: false, error: "Unsupported file type." },
        { status: 415 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (mime === "image/svg+xml") {
      const svg = bytes.toString("utf8");
      const looksLikeSvg = /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg);
      const unsafeSvg = /<\s*(?:script|foreignObject|iframe|object|embed)\b|\bon\w+\s*=|(?:href|xlink:href)\s*=\s*["']\s*(?:javascript:|data:text\/html)/i.test(svg);
      if (!looksLikeSvg || unsafeSvg) {
        return NextResponse.json(
          { ok: false, error: "Unsafe or invalid SVG file." },
          { status: 415 }
        );
      }
    }
    if (mime === "application/json") {
      try {
        const json = JSON.parse(bytes.toString("utf8"));
        if (!json || typeof json !== "object") throw new Error("invalid");
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON/Lottie file." }, { status: 415 });
      }
    }
    const upload = await db.upload.create({
      data: {
        filename: file.name || "resume",
        title: cleanMeta(form.get("title"), 160),
        altText: cleanMeta(form.get("altText"), 500),
        category: cleanMeta(form.get("category"), 80) || "Uncategorized",
        tags: JSON.stringify(cleanMeta(form.get("tags"), 500).split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30)),
        mime,
        size: bytes.byteLength,
        data: bytes.toString("base64"),
      },
      select: { id: true, filename: true, title: true, altText: true, category: true, tags: true, size: true, mime: true },
    });

    invalidateContent();

    return NextResponse.json({
      ok: true,
      id: upload.id,
      filename: upload.filename,
      size: upload.size,
      mime: upload.mime,
      title: upload.title,
      altText: upload.altText,
      category: upload.category,
      tags: safeTags(upload.tags),
      url: `/api/uploads/${upload.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
