import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { invalidateContent } from "@/lib/content-cache";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ARCHIVE_BYTES = 48 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 192 * 1024 * 1024;

type BackupPayload = {
  format: "p00rija-portfolio-backup";
  version: 1;
  createdAt: string;
  tables: {
    users: Array<{ id: string; email: string; name: string | null; createdAt: string; updatedAt: string }>;
    posts: Array<{ id: string; title: string; content: string | null; published: boolean; authorId: string; createdAt: string; updatedAt: string }>;
    content: Array<{ id: string; section: string; data: string; createdAt: string; updatedAt: string }>;
    authSettings: Array<{ id: string; passwordHash: string | null; twoFactorEnabled: boolean; twoFactorSecret: string | null; createdAt: string; updatedAt: string }>;
    uploads: Array<{ id: string; filename: string; mime: string; size: number; data: string; createdAt: string; updatedAt: string }>;
  };
};

function date(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid backup date");
  return parsed;
}

function parseArchive(compressed: Buffer): BackupPayload {
  const json = gunzipSync(compressed, { maxOutputLength: MAX_UNPACKED_BYTES }).toString("utf8");
  const envelope = JSON.parse(json) as { sha256?: unknown; payload?: unknown };
  if (typeof envelope.sha256 !== "string" || !envelope.payload || typeof envelope.payload !== "object") {
    throw new Error("Invalid backup envelope");
  }
  const payloadJson = JSON.stringify(envelope.payload);
  const actual = createHash("sha256").update(payloadJson).digest("hex");
  if (actual !== envelope.sha256) throw new Error("Backup checksum mismatch");
  const payload = envelope.payload as BackupPayload;
  if (payload.format !== "p00rija-portfolio-backup" || payload.version !== 1 || !payload.tables) {
    throw new Error("Unsupported backup format or version");
  }
  for (const key of ["users", "posts", "content", "authSettings", "uploads"] as const) {
    if (!Array.isArray(payload.tables[key])) throw new Error(`Missing backup table: ${key}`);
  }
  return payload;
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Cross-origin restore rejected" }, { status: 403 });
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_ARCHIVE_BYTES) {
    return NextResponse.json({ ok: false, error: "Backup is too large" }, { status: 413 });
  }

  try {
    const compressed = Buffer.from(await request.arrayBuffer());
    if (!compressed.length || compressed.length > MAX_ARCHIVE_BYTES) throw new Error("Invalid backup size");
    const backup = parseArchive(compressed);
    const { users, posts, content, authSettings, uploads } = backup.tables;

    await db.$transaction(async (tx) => {
      await tx.post.deleteMany();
      await tx.user.deleteMany();
      await tx.content.deleteMany();
      await tx.upload.deleteMany();
      await tx.authSettings.deleteMany();

      if (users.length) await tx.user.createMany({ data: users.map((row) => ({ ...row, createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) })) });
      if (posts.length) await tx.post.createMany({ data: posts.map((row) => ({ ...row, createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) })) });
      if (content.length) await tx.content.createMany({ data: content.map((row) => ({ ...row, createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) })) });
      if (authSettings.length) await tx.authSettings.createMany({ data: authSettings.map((row) => ({ ...row, createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) })) });
      if (uploads.length) await tx.upload.createMany({ data: uploads.map((row) => ({ ...row, createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) })) });
    });

    invalidateContent();
    return NextResponse.json({ ok: true, restoredAt: new Date().toISOString(), sourceCreatedAt: backup.createdAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
