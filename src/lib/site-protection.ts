import { promises as fs } from "fs";
import path from "path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { normalizeDigits } from "@/lib/persian-digits";
import { projectTarget } from "@/lib/guard-targets";

/* ============================================================
 * Site & section password protection ("Access Guard").
 *
 * Lets the owner password-protect the WHOLE site or individual
 * home-page sections (hero, graphics, security, ai, timeline,
 * synthesis, footer, custom-*). Visitors see the section blurred
 * behind a lock screen; the real CMS content is withheld
 * SERVER-SIDE (locked sections never leave /api/content without
 * a valid unlock cookie), so the blur is cosmetics and the
 * withholding is the actual protection.
 *
 * Storage follows the defense-store pattern: a small JSON file
 * next to the SQLite database (persists in the /app/db Docker
 * volume) with an mtime-checked in-process cache and atomic
 * tmp+rename writes. No Prisma — safe to import from proxy.ts.
 *
 * Security properties:
 *  • Passwords are stored as salted scrypt hashes, verified with
 *    timingSafeEqual — plaintext never touches disk.
 *  • Unlock cookies are HMAC-SHA256 signed tokens bound to the
 *    target id with an expiry (AUTH_SECRET, same key family as
 *    the CMS session but a distinct signature domain).
 *  • `mode: "attempts"` locks the target globally after
 *    maxAttempts wrong passwords (bank-card semantics) until an
 *    admin resets it; `mode: "permanent"` allows unlimited tries
 *    (rate-limited per IP).
 *  • Unlock attempts are additionally rate-limited per IP.
 * ============================================================ */

/** Target id for the whole-site lock. */
export const TARGET_SITE = "__site__";

export type LockKind = "pin4" | "pin6" | "text";
export type LockMode = "permanent" | "attempts";

export interface LockConfig {
  enabled: boolean;
  kind: LockKind;
  mode: LockMode;
  /** used when mode === "attempts" (clamped 1..10) */
  maxAttempts: number;
  /** consecutive wrong passwords so far (global counter) */
  failedAttempts: number;
  /** epoch ms when the wrong-password budget burned out */
  disabledAt: number | null;
  /** scrypt hash; empty string = no password set yet */
  hash: string;
  /** OPTIONAL temporary password (scrypt hash) — unlocks too, but only… */
  tempHash: string;
  /** …until this epoch ms. 0 = no temporary password armed. */
  tempExpiresAt: number;
  /** how many days an unlock cookie lasts (0 = browser session) */
  unlockDays: number;
  /** CLIENT re-lock policy: after this many idle minutes the visitor's
   *  unlock is withdrawn again (0 = never re-lock on idle). The cookie is
   *  actively deleted via /api/protection/relock so the re-lock is real. */
  idleMinutes: number;
  /** CLIENT re-lock policy: withdraw the unlock as soon as the visitor
   *  scrolls the section out of view (or closes a gallery popup). */
  relockOnExit: boolean;
  updatedAt: number;
}

interface ProtectionState {
  version: 1;
  site: LockConfig;
  sections: Record<string, LockConfig>;
}

/** Public/admin view of a lock — never includes the hash. */
export interface PublicLockInfo {
  target: string;
  enabled: boolean;
  kind: LockKind;
  mode: LockMode;
  maxAttempts: number;
  failedAttempts: number;
  disabled: boolean;
  hasPassword: boolean;
  hasTempPassword: boolean;
  tempExpiresAt: number;
  unlockDays: number;
  idleMinutes: number;
  relockOnExit: boolean;
  updatedAt: number;
}

export function emptyLock(): LockConfig {
  return {
    enabled: false,
    kind: "pin4",
    mode: "permanent",
    maxAttempts: 5,
    failedAttempts: 0,
    disabledAt: null,
    hash: "",
    tempHash: "",
    tempExpiresAt: 0,
    unlockDays: 7,
    idleMinutes: 0,
    relockOnExit: false,
    updatedAt: 0,
  };
}

/* ---------------- state file ---------------- */

const STATE_FILE =
  process.env.P00RIJA_PROTECTION_FILE ||
  path.join(process.cwd(), "db", "site-protection.json");

let cache: ProtectionState | null = null;
let cacheMtimeMs = 0;
let lastLoadAt = 0;

function sanitizeState(parsed: Partial<ProtectionState> | null): ProtectionState {
  const site = { ...emptyLock(), ...(parsed?.site ?? {}) };
  if (site.hash !== undefined && typeof site.hash !== "string") site.hash = "";
  const sections: Record<string, LockConfig> = {};
  for (const [key, raw] of Object.entries(parsed?.sections ?? {})) {
    if (!isValidTarget(key)) continue;
    sections[key] = { ...emptyLock(), ...(raw as LockConfig), hash: typeof (raw as LockConfig)?.hash === "string" ? (raw as LockConfig).hash : "" };
  }
  return { version: 1, site, sections };
}

async function loadState(force = false): Promise<ProtectionState> {
  const now = Date.now();
  if (!force && cache && now - lastLoadAt < 5_000) return cache;
  lastLoadAt = now;
  try {
    const stat = await fs.stat(STATE_FILE);
    if (!force && cache && stat.mtimeMs === cacheMtimeMs) return cache;
    const raw = await fs.readFile(STATE_FILE, "utf8");
    cache = sanitizeState(JSON.parse(raw) as Partial<ProtectionState>);
    cacheMtimeMs = stat.mtimeMs;
  } catch {
    cache = { version: 1, site: emptyLock(), sections: {} };
    cacheMtimeMs = 0;
  }
  return cache;
}

async function persist(state: ProtectionState): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  const tmp = STATE_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(state));
  await fs.rename(tmp, STATE_FILE);
  cache = state;
  cacheMtimeMs = Date.now();
}

export async function readProtection(): Promise<ProtectionState> {
  return loadState();
}

/* ---------------- target validation ---------------- */

const SITE_KEYS_LOCKABLE = new Set([
  "hero", "graphics", "security", "ai", "timeline", "synthesis", "footer",
]);

/** Gallery lock target: `gallery:<ownerSectionId>` — one lock per gallery
 *  usage, wherever that gallery lives (a builtin section or custom-*). */
export function galleryTargetOf(sectionId: string): string {
  return `gallery:${sectionId}`;
}

export function isValidTarget(target: string): boolean {
  return target === TARGET_SITE
    || SITE_KEYS_LOCKABLE.has(target)
    || /^custom-[a-zA-Z0-9-]{1,96}$/.test(target)
    || /^gallery:[a-zA-Z0-9-]{1,96}$/.test(target)
    || /^proj:[a-zA-Z0-9-]{1,96}:\S{1,96}$/.test(target);
}

/* ---------------- per-project gallery stripping ---------------- */

/** Server-side stub for a password-locked gallery project: keeps only the
 *  display identity (title + category); every payload field is emptied and
 *  `locked: true` tells the client to render the lock card. */
export function stubLockedProject(p: Record<string, unknown>): Record<string, unknown> {
  return {
    title: typeof p.title === "string" ? p.title : "",
    category: typeof p.category === "string" ? p.category : "",
    meta: "",
    year: "",
    client: "",
    role: "",
    description: "",
    color: "",
    specs: [],
    images: [],
    link: "",
    locked: true,
  };
}

/** Stub every armed proj:<sectionId>:<slug> lock inside one section's
 *  bilingual {fa, en} data. Locked indices are matched per language and
 *  SYNCED across both (locking the fa-titled project also stubs the en
 *  card at the same index). Returns new objects when anything changed —
 *  inputs are never mutated (cache safety). */
export function stripProjectsFromSection(
  sectionId: string,
  faSection: unknown,
  enSection: unknown,
  armed: Set<string>
): { fa: unknown; en: unknown; changed: boolean } {
  type GalleryLike = { gallery?: { projects?: unknown[] } } | null;
  const galleryOf = (s: unknown): GalleryLike => {
    if (!s || typeof s !== "object" || Array.isArray(s)) return null;
    const g = (s as { gallery?: unknown }).gallery;
    if (!g || typeof g !== "object" || !Array.isArray((g as { projects?: unknown[] }).projects)) return null;
    return s as GalleryLike;
  };
  const faSec = galleryOf(faSection);
  const enSec = galleryOf(enSection);
  if (!faSec && !enSec) return { fa: faSection, en: enSection, changed: false };

  const idx = new Set<number>();
  const collect = (sec: GalleryLike) => {
    sec?.gallery?.projects?.forEach((p, i) => {
      const title = String((p as { title?: unknown })?.title ?? "");
      if (armed.has(projectTarget(sectionId, title))) idx.add(i);
    });
  };
  collect(faSec);
  collect(enSec);
  if (idx.size === 0) return { fa: faSection, en: enSection, changed: false };

  let faOut = faSection;
  let enOut = enSection;
  if (faSec?.gallery) {
    faOut = {
      ...(faSection as Record<string, unknown>),
      gallery: { ...faSec.gallery, projects: faSec.gallery.projects!.map((p, i) => (idx.has(i) ? stubLockedProject((p ?? {}) as Record<string, unknown>) : p)) },
    };
  }
  if (enSec?.gallery) {
    enOut = {
      ...(enSection as Record<string, unknown>),
      gallery: { ...enSec.gallery, projects: enSec.gallery.projects!.map((p, i) => (idx.has(i) ? stubLockedProject((p ?? {}) as Record<string, unknown>) : p)) },
    };
  }
  return { fa: faOut, en: enOut, changed: true };
}

function lockFor(state: ProtectionState, target: string): LockConfig | null {
  if (target === TARGET_SITE) return state.site;
  return state.sections[target] ?? null;
}

/** A lock is active (enforced) only when enabled AND a password exists. */
export function lockIsActive(lock: LockConfig | null | undefined): boolean {
  return Boolean(lock && lock.enabled && lock.hash);
}

/* ---------------- public snapshot ---------------- */

function toPublicInfo(target: string, lock: LockConfig): PublicLockInfo {
  const tempAlive = Boolean(lock.tempHash) && lock.tempExpiresAt > Date.now();
  return {
    target,
    enabled: lock.enabled,
    kind: lock.kind,
    mode: lock.mode,
    maxAttempts: lock.maxAttempts,
    failedAttempts: lock.failedAttempts,
    disabled: lock.disabledAt !== null && lock.disabledAt > 0,
    hasPassword: Boolean(lock.hash),
    hasTempPassword: tempAlive,
    tempExpiresAt: lock.tempExpiresAt,
    unlockDays: lock.unlockDays,
    idleMinutes: lock.idleMinutes ?? 0,
    relockOnExit: Boolean(lock.relockOnExit),
    updatedAt: lock.updatedAt,
  };
}

export interface ProtectionSnapshot {
  site: PublicLockInfo | null;
  sections: Record<string, PublicLockInfo>;
}

export async function getProtectionSnapshot(): Promise<ProtectionSnapshot> {
  const state = await loadState();
  const sections: Record<string, PublicLockInfo> = {};
  for (const [target, lock] of Object.entries(state.sections)) {
    sections[target] = toPublicInfo(target, lock);
  }
  return {
    site: lockIsActive(state.site) ? toPublicInfo(TARGET_SITE, state.site) : null,
    sections,
  };
}

/* ---------------- password hashing (scrypt) ---------------- */

const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 32 };

export function hashGuardPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const key = scryptSync(password, salt, SCRYPT.keyLen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }).toString("base64url");
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${key}`;
}

function verifyGuardPassword(password: string, encoded: string): boolean {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]); const r = Number(parts[2]); const p = Number(parts[3]);
  const salt = parts[4]; const expected = parts[5];
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expected) return false;
  try {
    const actual = scryptSync(password, salt, SCRYPT.keyLen, { N, r, p }).toString("base64url");
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Server-side policy for a candidate password of a given kind.
 *  PIN kinds normalize Persian/Arabic digits first («۷۳۰۴» == "7304"). */
export function validateGuardPassword(kind: LockKind, password: string): string | null {
  if (kind === "pin4") return /^\d{4}$/.test(normalizeDigits(password)) ? null : "PIN must be exactly 4 digits";
  if (kind === "pin6") return /^\d{6}$/.test(normalizeDigits(password)) ? null : "PIN must be exactly 6 digits";
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    return "Text password must be 6-128 characters";
  }
  return null;
}

/* ---------------- unlock tokens (HMAC cookies) ---------------- */

function guardSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret + "|p00-guard";
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured in production");
  }
  return "dev-fallback-guard-secret-change-me";
}

function b64u(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

export function guardCookieName(target: string): string {
  return `p00_guard_${target.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function sign(payload: string): string {
  return createHmac("sha256", guardSecret()).update(payload).digest("base64url");
}

export function createUnlockToken(target: string, days: number): string {
  const maxAgeSec = days > 0 ? days * 86_400 : 12 * 3_600; // session fallback: 12h token cap
  const exp = Date.now() + maxAgeSec * 1000;
  const payload = `${b64u(target)}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyUnlockToken(target: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [encodedTarget, expRaw, sig] = parts;
  const payload = `${encodedTarget}.${expRaw}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  let decodedTarget: string;
  try {
    decodedTarget = Buffer.from(encodedTarget, "base64url").toString("utf8");
  } catch {
    return false;
  }
  if (decodedTarget !== target) return false;
  const exp = Number(expRaw);
  return Number.isFinite(exp) && Date.now() < exp;
}

/* ---------------- unlock attempt accounting ---------------- */

/** Per-IP sliding window for unlock attempts (strict, separate from defense). */
const unlockHits = new Map<string, number[]>();
const UNLOCK_PER_MINUTE = 8;

export function isUnlockRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (unlockHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  times.push(now);
  unlockHits.set(ip, times);
  if (unlockHits.size > 5000) {
    for (const [key, list] of unlockHits) {
      if (list.every((t) => now - t >= 60_000)) unlockHits.delete(key);
    }
  }
  return times.length > UNLOCK_PER_MINUTE;
}

export type UnlockOutcome =
  | { status: "ok"; unlockDays: number }
  | { status: "wrong"; remaining: number }
  | { status: "disabled" }
  | { status: "no-lock" };

/** Verify a password against a target, recording the attempt.
 *  Accepts the MAIN password or — while it is still valid — the
 *  temporary password. Wrong-password accounting covers both. */
export async function verifyUnlockAttempt(target: string, password: string): Promise<UnlockOutcome> {
  const state = await loadState(true);
  const lock = lockFor(state, target);
  if (!lockIsActive(lock) || !lock) return { status: "no-lock" };

  if (lock.disabledAt && lock.disabledAt > 0) return { status: "disabled" };

  // PIN kinds normalize Persian/Arabic digits before comparison.
  const attempt = lock.kind === "text" ? password : normalizeDigits(password);
  const tempAlive = Boolean(lock.tempHash) && lock.tempExpiresAt > Date.now();
  const okMain = verifyGuardPassword(attempt, lock.hash);
  const okTemp = tempAlive && verifyGuardPassword(attempt, lock.tempHash);

  if (okMain || okTemp) {
    // Success clears the wrong-password budget.
    if (lock.failedAttempts !== 0 || lock.disabledAt !== null) {
      lock.failedAttempts = 0;
      lock.disabledAt = null;
      lock.updatedAt = Date.now();
      await persist(state);
    }
    return { status: "ok", unlockDays: lock.unlockDays };
  }

  lock.failedAttempts += 1;
  if (lock.mode === "attempts" && lock.failedAttempts >= Math.max(1, Math.min(10, lock.maxAttempts))) {
    lock.disabledAt = Date.now();
    lock.updatedAt = lock.disabledAt;
    await persist(state);
    return { status: "disabled" };
  }
  lock.updatedAt = Date.now();
  await persist(state);
  const remaining = lock.mode === "attempts"
    ? Math.max(0, Math.max(1, Math.min(10, lock.maxAttempts)) - lock.failedAttempts)
    : -1; // permanent mode: no hard budget
  return { status: "wrong", remaining };
}

/* ---------------- admin operations ---------------- */

export interface SetLockInput {
  target: string;
  enabled?: boolean;
  kind?: LockKind;
  mode?: LockMode;
  maxAttempts?: number;
  unlockDays?: number;
  password?: string;
  /** optional temporary password (same kind); validated when non-empty */
  tempPassword?: string;
  /** epoch ms until which the temporary password works */
  tempExpiresAt?: number;
  /** client re-lock: idle minutes before the unlock is withdrawn (0-240) */
  idleMinutes?: number;
  /** client re-lock: withdraw as soon as the visitor leaves the section */
  relockOnExit?: boolean;
}

export type SetLockResult =
  | { ok: true; info: PublicLockInfo }
  | { ok: false; error: string };

export async function setLock(input: SetLockInput): Promise<SetLockResult> {
  const target = input.target;
  if (!isValidTarget(target)) return { ok: false, error: "Invalid target" };

  const state = await loadState(true);
  const isSite = target === TARGET_SITE;
  const lock: LockConfig = isSite
    ? state.site
    : (state.sections[target] ??= emptyLock());

  if (input.kind !== undefined) {
    if (!["pin4", "pin6", "text"].includes(input.kind)) return { ok: false, error: "Invalid kind" };
    lock.kind = input.kind;
  }
  if (input.mode !== undefined) {
    if (input.mode !== "permanent" && input.mode !== "attempts") return { ok: false, error: "Invalid mode" };
    lock.mode = input.mode;
  }
  if (input.maxAttempts !== undefined) {
    const n = Math.round(Number(input.maxAttempts));
    if (!Number.isFinite(n)) return { ok: false, error: "Invalid maxAttempts" };
    lock.maxAttempts = Math.max(1, Math.min(10, n));
  }
  if (input.unlockDays !== undefined) {
    const d = Math.round(Number(input.unlockDays));
    if (!Number.isFinite(d)) return { ok: false, error: "Invalid unlockDays" };
    lock.unlockDays = Math.max(0, Math.min(90, d));
  }
  if (input.idleMinutes !== undefined) {
    const m = Math.round(Number(input.idleMinutes));
    if (!Number.isFinite(m)) return { ok: false, error: "Invalid idleMinutes" };
    lock.idleMinutes = Math.max(0, Math.min(240, m));
  }
  if (input.relockOnExit !== undefined) {
    lock.relockOnExit = Boolean(input.relockOnExit);
  }
  if (typeof input.password === "string" && input.password.length > 0) {
    const candidate = lock.kind === "text" ? input.password : normalizeDigits(input.password);
    const policyError = validateGuardPassword(lock.kind, candidate);
    if (policyError) return { ok: false, error: policyError };
    lock.hash = hashGuardPassword(candidate);
    // A fresh password re-arms the wrong-password budget.
    lock.failedAttempts = 0;
    lock.disabledAt = null;
  }
  if (input.tempPassword !== undefined) {
    if (input.tempPassword === "") {
      // Explicit empty string clears the temporary password.
      lock.tempHash = "";
      lock.tempExpiresAt = 0;
    } else {
      const tempCandidate = lock.kind === "text" ? input.tempPassword : normalizeDigits(input.tempPassword);
      const policyError = validateGuardPassword(lock.kind, tempCandidate);
      if (policyError) return { ok: false, error: `Temporary password: ${policyError}` };
      const expires = Number(input.tempExpiresAt);
      if (!Number.isFinite(expires) || expires <= Date.now()) {
        return { ok: false, error: "Temporary password expiry must be in the future" };
      }
      lock.tempHash = hashGuardPassword(tempCandidate);
      lock.tempExpiresAt = Math.min(expires, Date.now() + 366 * 86_400_000);
    }
  }
  if (input.enabled !== undefined) {
    if (input.enabled && !lock.hash) {
      return { ok: false, error: "Set a password before enabling this lock" };
    }
    lock.enabled = input.enabled;
  }
  if (lock.enabled && !lock.hash) {
    return { ok: false, error: "Set a password before enabling this lock" };
  }
  lock.updatedAt = Date.now();
  if (!isSite && target !== TARGET_SITE) {
    state.sections[target] = lock;
  }
  await persist(state);
  return { ok: true, info: toPublicInfo(target, lock) };
}

/** Clear only the temporary password of a lock. */
export async function clearTempPassword(target: string): Promise<PublicLockInfo | null> {
  if (!isValidTarget(target)) return null;
  const state = await loadState(true);
  const lock = lockFor(state, target);
  if (!lock) return null;
  lock.tempHash = "";
  lock.tempExpiresAt = 0;
  lock.updatedAt = Date.now();
  await persist(state);
  return toPublicInfo(target, lock);
}

export async function clearLock(target: string): Promise<boolean> {
  if (!isValidTarget(target)) return false;
  const state = await loadState(true);
  if (target === TARGET_SITE) {
    state.site = emptyLock();
  } else {
    delete state.sections[target];
  }
  await persist(state);
  return true;
}

/** Re-arm a target disabled by too many wrong passwords. */
export async function resetAttempts(target: string): Promise<PublicLockInfo | null> {
  if (!isValidTarget(target)) return null;
  const state = await loadState(true);
  const lock = lockFor(state, target);
  if (!lock) return null;
  lock.failedAttempts = 0;
  lock.disabledAt = null;
  lock.updatedAt = Date.now();
  await persist(state);
  return toPublicInfo(target, lock);
}

/** Which of the ACTIVE section targets does this cookie map unlock? */
export function unlockedTargetsFromCookies(
  sections: Record<string, LockConfig>,
  getCookie: (name: string) => string | undefined
): Set<string> {
  const out = new Set<string>();
  for (const target of Object.keys(sections)) {
    if (!lockIsActive(sections[target])) continue;
    if (verifyUnlockToken(target, getCookie(guardCookieName(target)))) out.add(target);
  }
  return out;
}

export function stateFileForTests(): string {
  return STATE_FILE;
}
