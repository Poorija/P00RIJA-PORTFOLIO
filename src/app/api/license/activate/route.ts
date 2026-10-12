// Public (gated-site) license ACTIVATION endpoint. Reachable even while the
// site is locked — one of the only API surfaces that works without a valid
// license. Status lives at /api/license/status.

import { NextRequest, NextResponse } from "next/server";
import { activateLicense, licensingEnabled } from "@/lib/licensing";
import { extractIp } from "@/lib/analytics";

const attempts = new Map<string, { count: number; reset: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

export async function POST(request: NextRequest) {
  if (!licensingEnabled()) {
    return NextResponse.json({ ok: false, error: "Licensing is not enabled on this install." }, { status: 400 });
  }
  // Brute-force guard on activation attempts.
  const ip = extractIp(request.headers) || "local";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.reset > now && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ ok: false, error: "Too many attempts; try later." }, { status: 429 });
  }
  attempts.set(ip, { count: entry && entry.reset > now ? entry.count + 1 : 1, reset: now + WINDOW_MS });

  const raw = String((await request.json().catch(() => ({})))?.file || "");
  if (!raw || raw.length > 64_000) {
    return NextResponse.json({ ok: false, error: "License file content missing or too large." }, { status: 400 });
  }
  try {
    const payload = await activateLicense(raw);
    return NextResponse.json({ ok: true, licenseId: payload.licenseId, licensee: payload.licensee });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Activation failed." },
      { status: 400 }
    );
  }
}
