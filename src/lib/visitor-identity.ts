import { promises as fs } from "fs";
import path from "path";
import { createHmac, timingSafeEqual } from "crypto";
import { geoFor } from "@/lib/analytics";

/* ============================================================
 * Visitor identity — the strict "keep them blocked" engine.
 *
 * Browsers cannot expose a MAC address or a real hardware ID; the
 * practical strong signals available are combined here into ONE
 * stable visitor id:
 *   • a client-side DEVICE FINGERPRINT (canvas + WebGL renderer +
 *     screen + timezone + languages + CPU cores + device memory +
 *     platform + touch points + audio sample rate → SHA-256) —
 *     survives VPN and incognito;
 *   • the normalized browser/OS family from the User-Agent (minor
 *     version churn tolerated);
 *   • the IP is recorded and shown (history), but deliberately NOT
 *     part of the id — a VPN must not mint a fresh identity.
 *
 * vid = HMAC-SHA256(AUTH_SECRET|p00-vid, fpHash + uaFamily).
 * The vid travels in a signed httpOnly cookie (p00_vid, 1 year) so
 * the proxy can enforce blocks before any page logic runs; with
 * cookies cleared, the next /api/protection/identify re-derives the
 * same vid from the fingerprint and the block re-arms.
 *
 * Storage follows the defense-store pattern: db/visitors.json,
 * mtime-cached, atomic writes, capped collections.
 * ============================================================ */

export interface VisitorRecord {
  vid: string;
  fpHash: string;
  platform: string;
  timezone: string;
  uaFamily: string;
  ua: string;
  geo: string;
  firstSeen: number;
  lastSeen: number;
  ips: string[];
  blocked: boolean;
  blockedAt: number;
  blockedReason: string;
  /** wrong-password counters per lock target */
  failures: Record<string, { count: number; lastAt: number }>;
  /** locks this visitor burned out (attempt-limit) */
  lockouts: string[];
  note: string;
}

export interface AuditEvent {
  at: number;
  vid: string;
  target: string;
  outcome: "ok" | "wrong" | "disabled" | "blocked";
  ip: string;
}

interface VisitorState {
  version: 1;
  visitors: Record<string, VisitorRecord>;
  audit: AuditEvent[];
}

/** Public/admin projection — never exposes the raw fingerprint. */
export interface PublicVisitor {
  vid: string;
  vidShort: string;
  platform: string;
  timezone: string;
  uaFamily: string;
  geo: string;
  firstSeen: number;
  lastSeen: number;
  ips: string[];
  blocked: boolean;
  blockedAt: number;
  blockedReason: string;
  failuresTotal: number;
  failingTargets: string[];
  lockouts: string[];
  note: string;
}

const STATE_FILE =
  process.env.P00RIJA_VISITORS_FILE ||
  path.join(process.cwd(), "db", "visitors.json");

const MAX_VISITORS = 800;
const MAX_AUDIT = 300;

let cache: VisitorState | null = null;
let cacheMtimeMs = 0;
let lastLoadAt = 0;

function emptyState(): VisitorState {
  return { version: 1, visitors: {}, audit: [] };
}

async function loadState(force = false): Promise<VisitorState> {
  const now = Date.now();
  if (!force && cache && now - lastLoadAt < 3_000) return cache;
  lastLoadAt = now;
  try {
    const stat = await fs.stat(STATE_FILE);
    if (!force && cache && stat.mtimeMs === cacheMtimeMs) return cache;
    const parsed = JSON.parse(await fs.readFile(STATE_FILE, "utf8")) as Partial<VisitorState>;
    cache = {
      version: 1,
      visitors: parsed.visitors && typeof parsed.visitors === "object" ? parsed.visitors : {},
      audit: Array.isArray(parsed.audit) ? parsed.audit.slice(-MAX_AUDIT) : [],
    };
    cacheMtimeMs = stat.mtimeMs;
  } catch {
    cache = emptyState();
    cacheMtimeMs = 0;
  }
  return cache;
}

async function persist(state: VisitorState): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    const tmp = STATE_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(state));
    await fs.rename(tmp, STATE_FILE);
    cache = state;
    cacheMtimeMs = Date.now();
  } catch {
    // identity storage must never take the site down
  }
}

/* ---------------- vid derivation & cookie ---------------- */

function vidSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret + "|p00-vid";
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured in production");
  }
  return "dev-fallback-vid-secret-change-me";
}

/** Browser+OS family with tolerated version churn. */
export function uaFamily(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari"
    : "Other";
  const os = /Windows NT 10/.test(ua) ? "Win10/11"
    : /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "OtherOS";
  return `${browser}/${os}`;
}

export function deriveVid(fpHash: string, ua: string): string {
  return createHmac("sha256", vidSecret()).update(`${fpHash}::${uaFamily(ua)}`).digest("hex").slice(0, 32);
}

export const VID_COOKIE = "p00_vid";

function signVid(payload: string): string {
  return createHmac("sha256", vidSecret()).update(payload).digest("base64url");
}

export function createVidToken(vid: string): string {
  const payload = Buffer.from(vid, "utf8").toString("base64url");
  return `${payload}.${signVid(payload)}`;
}

export function verifyVidToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = signVid(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const vid = Buffer.from(payload, "base64url").toString("utf8");
  return /^[a-f0-9]{32}$/.test(vid) ? vid : null;
}

/* ---------------- records ---------------- */

function pushCapped(list: string[], item: string, cap = 10) {
  const idx = list.lastIndexOf(item);
  if (idx >= 0) list.splice(idx, 1);
  list.push(item);
  if (list.length > cap) list.splice(0, list.length - cap);
}

export interface IdentityInput {
  ip: string;
  ua: string;
  fpHash?: string;
  platform?: string;
  timezone?: string;
}

/** Resolve (or create) the visitor record for this request. */
export async function resolveVisitor(input: IdentityInput): Promise<VisitorRecord> {
  const state = await loadState(true);
  const fpHash = (input.fpHash || "").trim() || "no-fp";
  const vid = deriveVid(fpHash, input.ua);
  const now = Date.now();
  const geo = geoFor(input.ip);
  const geoText = [geo.city, geo.country].filter(Boolean).join(", ");

  let record = state.visitors[vid];
  if (!record) {
    record = {
      vid,
      fpHash,
      platform: input.platform ?? "",
      timezone: input.timezone ?? "",
      uaFamily: uaFamily(input.ua),
      ua: input.ua.slice(0, 300),
      geo: geoText,
      firstSeen: now,
      lastSeen: now,
      ips: [],
      blocked: false,
      blockedAt: 0,
      blockedReason: "",
      failures: {},
      lockouts: [],
      note: "",
    };
    state.visitors[vid] = record;
    // cap the store (drop oldest-seen non-blocked first)
    const entries = Object.values(state.visitors);
    if (entries.length > MAX_VISITORS) {
      entries
        .filter((v) => !v.blocked)
        .sort((a, b) => a.lastSeen - b.lastSeen)
        .slice(0, entries.length - MAX_VISITORS)
        .forEach((v) => delete state.visitors[v.vid]);
    }
  }
  record.lastSeen = now;
  if (input.platform && !record.platform) record.platform = input.platform;
  if (input.timezone && !record.timezone) record.timezone = input.timezone;
  record.ua = input.ua.slice(0, 300);
  if (geoText) record.geo = geoText;
  if (input.ip) pushCapped(record.ips, input.ip);
  await persist(state);
  return record;
}

export async function getVisitor(vid: string): Promise<VisitorRecord | null> {
  const state = await loadState();
  return state.visitors[vid] ?? null;
}

export async function isBlockedVid(vid: string): Promise<boolean> {
  const state = await loadState();
  return Boolean(state.visitors[vid]?.blocked);
}

/** Record an unlock attempt outcome (also feeds the audit feed). */
export async function recordUnlockAttempt(
  vid: string,
  target: string,
  outcome: AuditEvent["outcome"],
  ip: string
): Promise<void> {
  const state = await loadState(true);
  const record = state.visitors[vid];
  if (record) {
    if (outcome === "wrong" || outcome === "disabled") {
      const f = (record.failures[target] ??= { count: 0, lastAt: 0 });
      f.count += 1;
      f.lastAt = Date.now();
    } else if (outcome === "ok") {
      delete record.failures[target];
    }
    if (outcome === "disabled" && !record.lockouts.includes(target)) {
      record.lockouts.push(target);
      // STRICT MODE: burning a lock's attempt budget auto-blocks the abuser
      // (the owner can lift it from the Visitors panel).
      if (!record.blocked) {
        record.blocked = true;
        record.blockedAt = Date.now();
        record.blockedReason = `lockout:${target}`;
      }
    }
  }
  state.audit.push({ at: Date.now(), vid, target, outcome, ip: ip.slice(0, 64) });
  if (state.audit.length > MAX_AUDIT) state.audit = state.audit.slice(-MAX_AUDIT);
  await persist(state);
}

export async function blockVisitor(vid: string, reason: string): Promise<boolean> {
  const state = await loadState(true);
  const record = state.visitors[vid];
  if (!record) return false;
  record.blocked = true;
  record.blockedAt = Date.now();
  record.blockedReason = reason || "manual";
  await persist(state);
  return true;
}

export async function unblockVisitor(vid: string): Promise<boolean> {
  const state = await loadState(true);
  const record = state.visitors[vid];
  if (!record) return false;
  record.blocked = false;
  record.blockedAt = 0;
  record.blockedReason = "";
  record.failures = {};
  await persist(state);
  return true;
}

function toPublic(v: VisitorRecord): PublicVisitor {
  const failures = Object.entries(v.failures);
  return {
    vid: v.vid,
    vidShort: v.vid.slice(0, 8),
    platform: v.platform,
    timezone: v.timezone,
    uaFamily: v.uaFamily,
    geo: v.geo,
    firstSeen: v.firstSeen,
    lastSeen: v.lastSeen,
    ips: v.ips.slice(-4),
    blocked: v.blocked,
    blockedAt: v.blockedAt,
    blockedReason: v.blockedReason,
    failuresTotal: failures.reduce((sum, [, f]) => sum + f.count, 0),
    failingTargets: failures.filter(([, f]) => f.count > 0).map(([t]) => t).slice(0, 6),
    lockouts: v.lockouts,
    note: v.note,
  };
}

export async function listVisitors(): Promise<PublicVisitor[]> {
  const state = await loadState();
  return Object.values(state.visitors)
    .sort((a, b) => (Number(b.blocked) - Number(a.blocked)) || (b.lastSeen - a.lastSeen))
    .slice(0, 200)
    .map(toPublic);
}

export async function auditFeed(limit = 100): Promise<AuditEvent[]> {
  const state = await loadState();
  return state.audit.slice(-limit).reverse();
}
