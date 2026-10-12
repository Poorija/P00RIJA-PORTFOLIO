// Session-based auth for the CMS.
// Uses HMAC-signed cookies, hashed passwords, optional TOTP 2FA, and
// keeps plaintext passwords out of the database.

import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const AUTH_COOKIE = "cms_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured in production");
  }
  return "dev-fallback-secret-change-me";
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

const HASH_PREFIX = "pbkdf2_sha256";
const HASH_ITERATIONS = 210_000;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString("base64url")): string {
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, 32, "sha256").toString("base64url");
  return `${HASH_PREFIX}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function verifyPasswordHash(password: string, encoded: string): boolean {
  const [prefix, iterRaw, salt, expected] = encoded.split("$");
  const iterations = Number(iterRaw);
  if (prefix !== HASH_PREFIX || !Number.isFinite(iterations) || !salt || !expected) return false;
  const actual = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return safeEqual(actual, expected);
}

export async function getAuthSettings() {
  return db.authSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

function b64encode(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64url");
}
function b64decode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf-8");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL;
  const payload = b64encode(JSON.stringify({ exp: expires, sid: randomBytes(16).toString("base64url") }));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const { exp } = JSON.parse(b64decode(payload));
    if (typeof exp !== "number") return false;
    return Date.now() < exp;
  } catch {
    return false;
  }
}

export function verifyPassword(password: string): boolean {
  return safeEqual(password, getAdminPassword());
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const settings = await getAuthSettings();
  // The container/environment password is an intentional recovery credential.
  // A stale DB hash must never permanently lock the owner out after migration.
  if (settings.passwordHash) return verifyPasswordHash(password, settings.passwordHash) || verifyPassword(password);
  return verifyPassword(password);
}

export async function updateAdminPassword(newPassword: string): Promise<void> {
  await db.authSettings.upsert({
    where: { id: "singleton" },
    update: { passwordHash: hashPassword(newPassword) },
    create: { id: "singleton", passwordHash: hashPassword(newPassword) },
  });
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += BASE32[parseInt(chunk, 2)];
  }
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const idx = BASE32.indexOf(char);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret: string, timeStep: number): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(timeStep));
  const digest = createHmac("sha1", key).update(msg).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(code: string, secret: string | null | undefined): boolean {
  if (!secret) return false;
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const step = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((window) => safeEqual(totpCode(secret, step + window), clean));
}

export async function isTwoFactorEnabled(): Promise<boolean> {
  const settings = await getAuthSettings();
  return settings.twoFactorEnabled && !!settings.twoFactorSecret;
}

export async function setTwoFactor(secret: string | null, enabled: boolean): Promise<void> {
  await db.authSettings.upsert({
    where: { id: "singleton" },
    update: { twoFactorSecret: secret, twoFactorEnabled: enabled },
    create: { id: "singleton", twoFactorSecret: secret, twoFactorEnabled: enabled },
  });
}

// Server-side helpers using next/headers cookies (for Route Handlers / Server Components)
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  const requestHeaders = await headers();
  // Respect the real client protocol. A production build can legitimately be
  // served over local HTTP for self-test; forcing Secure from NODE_ENV alone
  // made successful CMS logins appear to fail because browsers dropped the cookie.
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwardedProto === "https" || requestHeaders.get("x-forwarded-ssl") === "on";
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL / 1000,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}

// For middleware / request-level checks
export function isAuthenticatedRequest(req: NextRequest): boolean {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  return verifySessionToken(token);
}
