import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateContent } from "@/lib/content-cache";

const clean = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 80) : "";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const groups = await db.upload.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { category: "asc" } });
  return NextResponse.json({ ok: true, categories: groups.map((group) => ({ name: group.category || "Uncategorized", count: group._count._all })) });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { from?: unknown; to?: unknown } | null;
  const from = clean(body?.from); const to = clean(body?.to);
  if (!from || !to) return NextResponse.json({ ok: false, error: "Both source and destination categories are required." }, { status: 400 });
  const result = await db.upload.updateMany({ where: { category: from }, data: { category: to } });
  invalidateContent();
  return NextResponse.json({ ok: true, moved: result.count, category: to });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { category?: unknown; moveTo?: unknown } | null;
  const category = clean(body?.category); const moveTo = clean(body?.moveTo) || "Uncategorized";
  if (!category) return NextResponse.json({ ok: false, error: "Category is required." }, { status: 400 });
  const result = await db.upload.updateMany({ where: { category }, data: { category: moveTo === category ? "Uncategorized" : moveTo } });
  invalidateContent();
  return NextResponse.json({ ok: true, moved: result.count });
}
