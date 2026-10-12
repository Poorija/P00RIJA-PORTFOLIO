import { NextRequest, NextResponse } from "next/server";
import {
  getAuthSettings,
  verifyAdminPassword,
  verifyTotp,
  createSessionToken,
  setAuthCookie,
} from "@/lib/auth";
import { addThreat } from "@/lib/defense";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
// Brute-force lock: 3 consecutive wrong passwords ⇒ 3 minute lockout.
const LOCK_THRESHOLD = 3;
const LOCK_MS = 3 * 60 * 1000;
const locks = new Map<string, number>(); // ip → locked-until epoch ms

function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}

export async function POST(request: NextRequest) {
  try {
    const key = clientKey(request);

    const lockedUntil = locks.get(key) ?? 0;
    if (lockedUntil > Date.now()) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
      return NextResponse.json(
        {
          ok: false,
          locked: true,
          retryAfterSecs: secs,
          error: `Too many failed attempts — locked for ${Math.ceil(secs / 60)} min.`,
        },
        { status: 423, headers: { "Retry-After": String(secs) } }
      );
    }
    if (isRateLimited(key)) {
      return NextResponse.json(
        { ok: false, error: "Too many login attempts. Try again later." },
        { status: 429 }
      );
    }

    const { password, code } = await request.json();
    if (typeof password !== "string" || !password) {
      return NextResponse.json(
        { ok: false, error: "رمز عبور الزامی است" },
        { status: 400 }
      );
    }
    if (!(await verifyAdminPassword(password))) {
      recordFailure(key);
      const current = attempts.get(key);
      const wrong = current?.count ?? 1;
      if (wrong >= LOCK_THRESHOLD) {
        locks.set(key, Date.now() + LOCK_MS);
        void addThreat({
          ip: key,
          ua: request.headers.get("user-agent") ?? "",
          method: "POST",
          path: "/api/auth/login",
          rule: `cms-login-lockout (${wrong} wrong passwords)`,
          action: "blocked",
          country: "",
        }).catch(() => undefined);
        return NextResponse.json(
          {
            ok: false,
            locked: true,
            retryAfterSecs: Math.ceil(LOCK_MS / 1000),
            error: "رمز عبور ۳ بار نادرست بود — ورود ۳ دقیقه قفل شد.",
          },
          { status: 423, headers: { "Retry-After": String(LOCK_MS / 1000) } }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          attemptsLeft: Math.max(0, LOCK_THRESHOLD - wrong),
          error: "رمز عبور نادرست است",
        },
        { status: 401 }
      );
    }
    locks.delete(key);

    const settings = await getAuthSettings();
    if (settings.twoFactorEnabled && settings.twoFactorSecret) {
      if (typeof code !== "string" || !verifyTotp(code, settings.twoFactorSecret)) {
        if (code) recordFailure(key);
        return NextResponse.json(
          { ok: false, requiresTwoFactor: true, error: "کد دومرحله‌ای الزامی است" },
          { status: code ? 401 : 200 }
        );
      }
    }

    attempts.delete(key);
    const token = createSessionToken();
    await setAuthCookie(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
