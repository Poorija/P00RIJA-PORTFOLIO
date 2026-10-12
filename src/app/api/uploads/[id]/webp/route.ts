import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateContent } from "@/lib/content-cache";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const source = await db.upload.findUnique({ where: { id } });
    if (!source || !source.mime.startsWith("image/") || source.mime === "image/svg+xml") {
      return NextResponse.json({ ok: false, error: "Only raster images can be converted." }, { status: 415 });
    }
    const result = await sharp(Buffer.from(source.data, "base64"))
      .rotate()
      .webp({ lossless: true, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    const filename = source.filename.replace(/\.[^.]+$/, "") + ".webp";
    const replacement = await db.$transaction(async (tx) => {
      const upload = await tx.upload.create({ data: { filename, title: source.title, altText: source.altText, category: source.category, tags: source.tags, mime: "image/webp", size: result.data.byteLength, data: result.data.toString("base64") } });
      const oldUrl = `/api/uploads/${id}`;
      const newUrl = `/api/uploads/${upload.id}`;
      const rows = await tx.content.findMany();
      for (const row of rows) {
        if (row.data.includes(oldUrl)) await tx.content.update({ where: { id: row.id }, data: { data: row.data.split(oldUrl).join(newUrl) } });
      }
      await tx.upload.delete({ where: { id } });
      return { ...upload, data: undefined, url: newUrl };
    });
    invalidateContent();
    return NextResponse.json({ ok: true, upload: replacement, savedBytes: Math.max(0, source.size - result.data.byteLength) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Conversion failed" }, { status: 500 });
  }
}
