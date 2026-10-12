import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [users, posts, content, authSettings, uploads] = await db.$transaction([
    db.user.findMany(),
    db.post.findMany(),
    db.content.findMany(),
    db.authSettings.findMany(),
    db.upload.findMany(),
  ]);

  const payload = {
    format: "p00rija-portfolio-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    tables: { users, posts, content, authSettings, uploads },
  };
  const payloadJson = JSON.stringify(payload);
  const envelope = {
    sha256: createHash("sha256").update(payloadJson).digest("hex"),
    payload,
  };
  const archive = gzipSync(Buffer.from(JSON.stringify(envelope)), { level: 9 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  return new NextResponse(archive, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="p00rija-portfolio-${stamp}.p00backup.gz"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
