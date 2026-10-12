import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateContent } from "@/lib/content-cache";

const number = (value: unknown, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback));

async function replaceUpload(id: string, data: Buffer, filename: string, mime: string) {
  return db.$transaction(async (tx) => {
    const source = await tx.upload.findUniqueOrThrow({ where: { id } });
    const replacement = await tx.upload.create({ data: { filename, mime, size: data.byteLength, data: data.toString("base64"), title: source.title, altText: source.altText, category: source.category, tags: source.tags } });
    const oldUrl = `/api/uploads/${id}`; const newUrl = `/api/uploads/${replacement.id}`;
    const rows = await tx.content.findMany();
    for (const row of rows) if (row.data.includes(oldUrl)) await tx.content.update({ where: { id: row.id }, data: { data: row.data.split(oldUrl).join(newUrl) } });
    await tx.upload.delete({ where: { id } });
    return { id: replacement.id, url: newUrl, filename, mime, size: data.byteLength };
  });
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = ""; child.stderr.on("data", (chunk) => { error = (error + chunk.toString()).slice(-3000); });
    child.once("error", reject); child.once("close", (code) => code === 0 ? resolve() : reject(new Error(error || `ffmpeg exited with ${code}`)));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params; const body = await request.json() as Record<string, unknown>;
    const source = await db.upload.findUnique({ where: { id } }); if (!source) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const sourceBytes = Buffer.from(source.data, "base64");
    if (source.mime.startsWith("image/") && source.mime !== "image/svg+xml") {
      let pipeline = sharp(sourceBytes).rotate(); const metadata = await pipeline.metadata();
      const left = Math.floor(number(body.cropLeft, 0, 0, Math.max(0, (metadata.width || 1) - 1))); const top = Math.floor(number(body.cropTop, 0, 0, Math.max(0, (metadata.height || 1) - 1)));
      const cropWidth = Math.floor(number(body.cropWidth, (metadata.width || 1) - left, 1, (metadata.width || 1) - left)); const cropHeight = Math.floor(number(body.cropHeight, (metadata.height || 1) - top, 1, (metadata.height || 1) - top));
      if (left || top || cropWidth !== metadata.width || cropHeight !== metadata.height) pipeline = pipeline.extract({ left, top, width: cropWidth, height: cropHeight });
      const width = Math.floor(number(body.width, 0, 0, 12000)); const height = Math.floor(number(body.height, 0, 0, 12000)); if (width || height) pipeline = pipeline.resize(width || undefined, height || undefined, { fit: "inside", withoutEnlargement: false });
      pipeline = pipeline.rotate(number(body.rotate, 0, -360, 360)); if (body.grayscale === true) pipeline = pipeline.grayscale();
      const blur = number(body.blur, 0, 0, 100); if (blur > 0) pipeline = pipeline.blur(Math.max(.3, blur));
      pipeline = pipeline.modulate({ brightness: number(body.brightness, 1, .1, 3), saturation: number(body.saturation, 1, 0, 3) });
      const format = ["webp", "jpeg", "png"].includes(String(body.format)) ? String(body.format) : "webp"; const quality = Math.floor(number(body.quality, 92, 1, 100));
      if (format === "jpeg") pipeline = pipeline.jpeg({ quality, mozjpeg: true }); else if (format === "png") pipeline = pipeline.png({ quality }); else pipeline = pipeline.webp({ quality, smartSubsample: true });
      const output = await pipeline.toBuffer(); const extension = format === "jpeg" ? "jpg" : format; const mime = format === "jpeg" ? "image/jpeg" : `image/${format}`; const filename = source.filename.replace(/\.[^.]+$/, "") + `.${extension}`;
      const upload = await replaceUpload(id, output, filename, mime); invalidateContent(); return NextResponse.json({ ok: true, upload });
    }
    if (source.mime.startsWith("video/") || source.mime.startsWith("audio/")) {
      const start = number(body.start, 0, 0, 86400); const duration = number(body.duration, 10, .05, 86400); const extension = path.extname(source.filename) || (source.mime.startsWith("video/") ? ".mp4" : ".mp3"); const directory = await mkdtemp(path.join(tmpdir(), "p00rija-media-")); const input = path.join(directory, `input${extension}`); const output = path.join(directory, `output${extension}`);
      try { await writeFile(input, sourceBytes); await runFfmpeg(["-hide_banner", "-loglevel", "error", "-ss", String(start), "-i", input, "-t", String(duration), "-map_metadata", "-1", "-c", "copy", "-y", output]); const bytes = await readFile(output); const upload = await replaceUpload(id, bytes, source.filename, source.mime); invalidateContent(); return NextResponse.json({ ok: true, upload }); } finally { await rm(directory, { recursive: true, force: true }); }
    }
    return NextResponse.json({ ok: false, error: "This media type cannot be edited." }, { status: 415 });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Edit failed" }, { status: 500 }); }
}
