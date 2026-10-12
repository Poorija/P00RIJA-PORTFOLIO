#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { PrismaClient } from "@prisma/client";

const backupPath = process.argv[2];
if (!backupPath) throw new Error("Usage: node scripts/restore-backup.mjs <backup.p00backup.gz>");

const compressed = await readFile(backupPath);
if (!compressed.length || compressed.length > 48 * 1024 * 1024) throw new Error("Invalid backup size");
const envelope = JSON.parse(gunzipSync(compressed, { maxOutputLength: 192 * 1024 * 1024 }).toString("utf8"));
const payloadJson = JSON.stringify(envelope.payload);
const checksum = createHash("sha256").update(payloadJson).digest("hex");
if (checksum !== envelope.sha256) throw new Error("Backup checksum mismatch");
if (envelope.payload?.format !== "p00rija-portfolio-backup" || envelope.payload?.version !== 1) {
  throw new Error("Unsupported backup format or version");
}

const tables = envelope.payload.tables;
for (const key of ["users", "posts", "content", "authSettings", "uploads"]) {
  if (!Array.isArray(tables?.[key])) throw new Error(`Missing backup table: ${key}`);
}
const withDates = (rows) => rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) }));
const db = new PrismaClient();

try {
  await db.$transaction(async (tx) => {
    await tx.post.deleteMany();
    await tx.user.deleteMany();
    await tx.content.deleteMany();
    await tx.upload.deleteMany();
    await tx.authSettings.deleteMany();
    if (tables.users.length) await tx.user.createMany({ data: withDates(tables.users) });
    if (tables.posts.length) await tx.post.createMany({ data: withDates(tables.posts) });
    if (tables.content.length) await tx.content.createMany({ data: withDates(tables.content) });
    if (tables.authSettings.length) await tx.authSettings.createMany({ data: withDates(tables.authSettings) });
    if (tables.uploads.length) await tx.upload.createMany({ data: withDates(tables.uploads) });
  });
  process.stdout.write(`Restore complete. Backup created: ${envelope.payload.createdAt}\n`);
} finally {
  await db.$disconnect();
}
