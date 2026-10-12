import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { isDeveloperOwnerUnlocked, lockDeveloperOwner, unlockDeveloperOwner, verifyDeveloperOwnerKey } from "@/lib/developer-owner";

const attempts = new Map<string, { count: number; reset: number }>();

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, unlocked: await isDeveloperOwnerUnlocked() });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false }, { status: 401 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.reset > now && entry.count >= 5) return NextResponse.json({ ok: false, error: "Too many attempts" }, { status: 429 });
  const key = String((await request.json().catch(() => ({})))?.key || "");
  if (!verifyDeveloperOwnerKey(key)) {
    attempts.set(ip, { count: entry && entry.reset > now ? entry.count + 1 : 1, reset: now + 15 * 60_000 });
    return NextResponse.json({ ok: false, error: "Invalid owner key" }, { status: 403 });
  }
  attempts.delete(ip);
  await unlockDeveloperOwner();
  return NextResponse.json({ ok: true, unlocked: true, expiresIn: 300 });
}

export async function DELETE() {
  await lockDeveloperOwner();
  return NextResponse.json({ ok: true, unlocked: false });
}
