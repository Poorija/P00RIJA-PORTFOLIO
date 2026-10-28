// ============================================================
// Commercial licensing core.
//
// License file (.lic) — created by scripts/license-cli.mjs:
//   {
//     "v": 1,
//     "alg": "AES-256-GCM+Ed25519",
//     "iv":  "<base64url>",       AES-GCM nonce
//     "ct":  "<base64url>",       AES-256-GCM ciphertext of the signed payload
//     "tag": "<base64url>",       AES-GCM auth tag
//     "sig": "<base64url>"        Ed25519 signature over the payload JSON
//   }
//
// The payload (decrypted) carries EVERYTHING the install needs to reach the
// licensing endpoint — host, port, heartbeat cadence — plus the commercial terms:
//   { licenseId, licensee, plan, issuedAt, expiresAt, deviceLimit,
//     usageLimit, features[], server:{url, port, heartbeatMinutes}, notes }
//
// Trust model:
//   • AES-256-GCM keeps the terms confidential (key baked into the sold image).
//   • The Ed25519 signature is the real anti-forgery anchor: the image only
//     embeds the PUBLIC key, so a leaked AES key still cannot mint licenses.
//
// Each install generates a persistent UUID (deviceId) on first activation;
// multi-server licenses count DISTINCT deviceIds against deviceLimit, and
// every heartbeat reports usage so the owner can manage everything manually
// from the vendor side.
//
// Enforcement is enabled ONLY when LICENSE_AES_KEY + LICENSE_SIGN_PUBKEY are
// set — dev environments and the free public image simply run unlocked.
// ============================================================

import { createDecipheriv } from "crypto";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { startHeartbeatLoop } from "@/lib/license-heartbeat";

export interface LicenseEndpointConfig {
  url: string; // e.g. "http://licenses.example.com"
  port: number; // e.g. 7800
  heartbeatMinutes?: number;
}

export interface LicensePayload {
  licenseId: string;
  licensee: string;
  plan: "monthly" | "quarterly" | "semiannual" | "annual" | "custom" | "perpetual";
  issuedAt: string;
  expiresAt: string | null;
  deviceLimit: number;
  usageLimit: number | null; // null = unlimited
  features: string[];
  server: LicenseEndpointConfig;
  notes?: string;
}

export type LicensePhase = "disabled" | "unlicensed" | "active" | "maintenance";

export interface LicenseGateState {
  phase: LicensePhase;
  reason: string; // human-readable, shown on the lock screen
  licenseId?: string;
  licensee?: string;
  plan?: string;
  expiresAt?: string | null;
  usageCount?: number;
  usageLimit?: number | null;
}

// Hard caps on the tunables: an operator may make these STRICTER via env,
// never looser. Without the caps, LICENSE_TRIAL_DAYS=99999 (or a giant
// grace budget) would turn the trial into a permanent unlock.
const GRACE_CHECKS = Math.min(Math.max(1, Math.floor(Number(process.env.LICENSE_GRACE_CHECKS ?? 2) || 2)), 24);
const MAX_TRIAL_DAYS = 5;
const trialEnvRaw = Number(process.env.LICENSE_TRIAL_DAYS);
const TRIAL_DAYS = Number.isFinite(trialEnvRaw) ? Math.min(Math.max(0, Math.floor(trialEnvRaw)), MAX_TRIAL_DAYS) : MAX_TRIAL_DAYS;

// Bookkeeping rows that share the licenseActivation table but are NOT
// licenses. Every real-license lookup must exclude them — the __trial__
// row is created with status "active", so an unfiltered findFirst() would
// read it as a perpetual license and the trial lock would never engage.
const META_LICENSE_IDS = ["__device__", "__trial__"] as const;
function realLicenseWhere() {
  return { licenseId: { notIn: [...META_LICENSE_IDS] } };
}

export function licensingEnabled(): boolean {
  // Trial mode: always enabled for the public/GitHub build — the 5-day
  // trial runs WITHOUT vendor keys; after expiry the app locks until a
  // signed .lic file is activated (which requires the vendor keys).
  return true;
}

function aesKey(): Buffer {
  return Buffer.from(String(process.env.LICENSE_AES_KEY).trim(), "hex");
}

function signPubkey(): Buffer {
  return Buffer.from(String(process.env.LICENSE_SIGN_PUBKEY).trim(), "hex");
}

// ── file parsing ─────────────────────────────────────────────────────────────

export function parseLicenseFile(raw: string): LicensePayload {
  let envelope: { v?: number; alg?: string; iv?: string; ct?: string; tag?: string; sig?: string };
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error("The license file is not valid JSON.");
  }
  if (envelope.v !== 1 || envelope.alg !== "AES-256-GCM+Ed25519" || !envelope.iv || !envelope.ct || !envelope.tag || !envelope.sig) {
    throw new Error("Unrecognized license file format.");
  }

  // Verify the Ed25519 signature over the ciphertext first (needs only the
  // embedded public key) — this is the anti-forgery anchor.
  const { verifyEd25519 } = edHelpers();
  if (!verifyEd25519(Buffer.from(envelope.ct, "base64url"), Buffer.from(envelope.sig, "base64url"), signPubkey())) {
    throw new Error("License signature is invalid — the file was not issued by the vendor.");
  }

  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(envelope.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ct, "base64url")), decipher.final()]);
  } catch {
    throw new Error("License decryption failed — the file does not belong to this build.");
  }

  let payload: LicensePayload;
  try {
    payload = JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("License payload is corrupted.");
  }
  if (!payload.licenseId || !payload.server?.url) {
    throw new Error("License payload is missing required fields.");
  }
  return payload;
}

// Small indirection so the crypto import stays tree-shaken in disabled builds.
import { verify as edVerify, createPublicKey } from "crypto";
function edHelpers() {
  return {
    // Raw 32-byte Ed25519 public keys need an SPKI wrapper for Node's crypto.
    verifyEd25519: (data: Buffer, sig: Buffer, pubRaw: Buffer) =>
      edVerify(
        null,
        data,
        createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pubRaw]), format: "der", type: "spki" }),
        sig
      ),
  };
}

// ── stored-license integrity (v2 envelope) ───────────────────────────────────
// The payload column stores { v: 2, env, data }: `env` is the ORIGINAL signed
// envelope from the .lic file, `data` the working copy. Every gate read and
// every heartbeat re-verifies the Ed25519 signature over env.ct with the
// embedded vendor public key, re-decrypts it, and requires the commercial
// terms in `data` to match the decrypted original exactly. Only `server`
// may drift (the vendor can push a new endpoint). Anything else —
// direct SQLite edits, crafted rows, an expired license rewritten to
// perpetual — fails verification and the install locks.

interface StoredEnvelope {
  iv: string;
  ct: string;
  tag: string;
  sig: string;
}
interface StoredWrapper {
  v: 2;
  env: StoredEnvelope;
  data: LicensePayload;
}

/** Commercial fields that must never drift from the signed original. */
const SIGNED_TERMS: (keyof LicensePayload)[] = [
  "licenseId", "licensee", "plan", "issuedAt", "expiresAt", "deviceLimit", "usageLimit", "features",
];

function hasVendorKeys(): boolean {
  return Boolean(process.env.LICENSE_AES_KEY?.trim() && process.env.LICENSE_SIGN_PUBKEY?.trim());
}

export function verifyStoredLicense(row: { payload: string; signature: string }):
  | { ok: false; legacy?: boolean }
  | { ok: true; env: StoredEnvelope; data: LicensePayload } {
  if (!hasVendorKeys()) return { ok: false }; // keys vanished after activation → lock
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.payload);
  } catch {
    return { ok: false };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false };
  const wrapper = parsed as Partial<StoredWrapper> & { v?: number };
  if (wrapper.v !== 2 || !wrapper.env || !wrapper.data) {
    // Rows written by builds before the v2 wrapper: no envelope stored, so
    // they can no longer be proven — require one-time re-activation.
    return { ok: false, legacy: true };
  }
  const env = wrapper.env;
  if (![env.iv, env.ct, env.tag, env.sig].every((x) => typeof x === "string" && x.length > 0)) {
    return { ok: false };
  }
  const ct = Buffer.from(env.ct, "base64url");
  if (!edHelpers().verifyEd25519(ct, Buffer.from(env.sig, "base64url"), signPubkey())) {
    return { ok: false };
  }
  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(env.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(env.tag, "base64url"));
    plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    return { ok: false };
  }
  let original: LicensePayload;
  try {
    original = JSON.parse(plaintext.toString("utf8"));
  } catch {
    return { ok: false };
  }
  for (const key of SIGNED_TERMS) {
    if (JSON.stringify(original[key]) !== JSON.stringify(wrapper.data[key])) return { ok: false };
  }
  return { ok: true, env, data: wrapper.data };
}

function wrapForStorage(rawFile: string, payload: LicensePayload): string {
  let envelope: { iv?: string; ct?: string; tag?: string; sig?: string } = {};
  try {
    envelope = JSON.parse(rawFile);
  } catch {
    /* parseLicenseFile already validated it — unreachable */
  }
  const wrapper: StoredWrapper = {
    v: 2,
    env: { iv: String(envelope.iv), ct: String(envelope.ct), tag: String(envelope.tag), sig: String(envelope.sig) },
    data: payload,
  };
  return JSON.stringify(wrapper);
}

// ── activation & state ───────────────────────────────────────────────────────

/**
 * Persistent per-install UUID — the unit that multi-server licenses count.
 * The __trial__ row is bookkeeping, never a device source.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const rows = await db.licenseActivation.findMany({
    where: { licenseId: { not: "__trial__" } },
    select: { licenseId: true, deviceId: true },
  });
  const canonical = rows.find((r) => r.licenseId === "__device__") ?? rows[0];
  if (canonical) return canonical.deviceId;
  // Reserve the UUID via a placeholder row; activation rewrites it into the
  // real license record (deviceId carries a UNIQUE index).
  const id = randomUUID();
  try {
    await db.licenseActivation.create({
      data: { licenseId: "__device__", deviceId: id, payload: "{}" },
    });
  } catch {
    // Lost a concurrent creation race — re-read.
    const row = await db.licenseActivation.findFirst({
      where: { licenseId: { not: "__trial__" } },
      select: { deviceId: true },
    });
    if (row) return row.deviceId;
  }
  return id;
}

export async function activateLicense(rawFile: string): Promise<LicensePayload> {
  const payload = parseLicenseFile(rawFile);
  const deviceId = await getOrCreateDeviceId();
  if (payload.licenseId === "__device__") throw new Error("Invalid license id.");

  // Register with the licensing service (slots are counted server-side).
  const server = resolveServer(payload.server);
  const reg = await postJson(new URL("/v1/activate", server), {
    licenseId: payload.licenseId,
    deviceId,
  });
  if (!reg.ok) {
    throw new Error(reg.body?.error || `Activation rejected by the licensing service (HTTP ${reg.status}).`);
  }

  const envelopeSig = extractSig(rawFile);
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  if (expiresAt && expiresAt.getTime() < Date.now()) throw new Error("This license has already expired.");
  // Store the v2 wrapper (original signed envelope + working copy) so every
  // later gate read can re-verify the row against the vendor signature.
  const storedPayload = wrapForStorage(rawFile, payload);

  // Free the UUID reservation placeholder so the real row can claim the same
  // deviceId (it carries a UNIQUE index).
  await db.licenseActivation.deleteMany({ where: { licenseId: "__device__" } });
  await db.licenseActivation.upsert({
    where: { licenseId: payload.licenseId },
    update: {
      deviceId,
      payload: storedPayload,
      signature: envelopeSig,
      status: "active",
      failCount: 0,
      lastHeartbeatAt: new Date(),
      lastServerMessage: "activated",
    },
    create: {
      licenseId: payload.licenseId,
      deviceId,
      payload: storedPayload,
      signature: envelopeSig,
      status: "active",
      lastHeartbeatAt: new Date(),
      lastServerMessage: "activated",
    },
  });
  // Drop the device reservation placeholder and any older license rows.
  await db.licenseActivation.deleteMany({
    where: { licenseId: { notIn: [payload.licenseId] } },
  });
  invalidateGateCache();
  return payload;
}

function extractSig(raw: string): string {
  try {
    return String(JSON.parse(raw).sig || "");
  } catch {
    return "";
  }
}

function resolveServer(cfg: LicenseEndpointConfig): URL {
  const override = process.env.LICENSE_SERVER_URL?.trim();
  const base = override || cfg.url;
  const port = override ? "" : cfg.port ? `:${cfg.port}` : "";
  const url = new URL(`${base.replace(/\/+$/, "")}${port}`);
  assertPublicLicenseEndpoint(url);
  return url;
}

// ── SSRF guard for the licensing endpoint URL ────────────────────────────────
// The URL arrives inside the license file, so before this process contacts it
// we require a public http(s) target. The license file is vendor-signed, so
// this is defense-in-depth (e.g. a compromised/leaked AES key must not turn
// activations into an internal-network port scan). Self-hosters who actually
// run the licensing endpoint on a LAN/private address can opt out explicitly with
// LICENSE_ALLOW_PRIVATE_SERVERS=1.
const BLOCKED_HOST_PATTERNS = [/^localhost$/i, /\.local$/i, /\.internal$/i, /\.localhost$/i];

function isPrivateLiteralIp(host: string): boolean {
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if ([a, b, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return true;
    if (a === 10 || a === 127 || a === 0) return true; // private / loopback / this-network
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = host.toLowerCase();
  if (lower === "::1" || lower === "::" || lower === "0:0:0:0:0:0:0:1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
  if (lower.startsWith("::ffff:")) return isPrivateLiteralIp(lower.slice(7)); // IPv4-mapped
  return false;
}

function assertPublicLicenseEndpoint(url: URL): void {
  if (process.env.LICENSE_ALLOW_PRIVATE_SERVERS === "1") return;
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`License endpoint URL must use http(s), got "${url.protocol}".`);
  }
  const host = url.hostname.trim();
  if (isPrivateLiteralIp(host) || BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
    throw new Error(
      "License endpoint URL points at a private/internal address. Use a public hostname/IP, or set LICENSE_ALLOW_PRIVATE_SERVERS=1 if your licensing endpoint really is on this network."
    );
  }
}

async function postJson(url: URL, body: unknown): Promise<{ ok: boolean; status: number; body: { ok?: boolean; error?: string; [k: string]: unknown } | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error", // a redirect must never bounce the request inward
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    return { ok: res.ok, status: res.status, body: json };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

// ── heartbeat (runs every N minutes from instrumentation.ts) ────────────────

/**
 * One heartbeat tick: reports this install to the licensing service and updates
 * the local gate state. Returns the phase after the tick.
 *  - revoked / expired / not found / over slots / over usage → maintenance (immediately)
 *  - network failure → increment failCount; after LICENSE_GRACE_CHECKS → maintenance
 *  - success → active (self-heals a maintenance lock)
 */
export async function heartbeatTick(): Promise<LicenseGateState> {
  const gate = await readGateState();
  if (gate.phase === "disabled" || gate.phase === "unlicensed") return gate;

  const row = await db.licenseActivation.findFirst({ where: realLicenseWhere() });
  if (!row) return gate;

  // Re-verify the stored row against the vendor signature before trusting
  // or reporting anything. Tampered/legacy rows lock immediately.
  const verdict = verifyStoredLicense(row);
  if (!verdict.ok) {
    const reason = verdict.legacy
      ? "License record format is from an older build — please re-activate your license file (one-time)."
      : "License integrity check failed — the stored license was modified. Please re-activate with your original license file.";
    await db.licenseActivation.update({
      where: { id: row.id },
      data: { status: "maintenance", lastServerMessage: reason },
    });
    invalidateGateCache();
    return { ...gate, phase: "maintenance", reason };
  }
  const { env, data: payload } = verdict;

  // Local expiry check works even when the licensing service is unreachable.
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).getTime() : null;
  if (expiresAt && expiresAt < Date.now()) {
    await db.licenseActivation.update({
      where: { id: row.id },
      data: { status: "maintenance", lastServerMessage: "license expired" },
    });
    invalidateGateCache();
    return { ...gate, phase: "maintenance", reason: "License expired." };
  }

  // Report usage: the licensing service keeps the cumulative count (it decides
  // against usageLimit); we just send the total served sessions so far.
  const totalSessions = await db.visitSession.count();

  const server = resolveServer(payload.server);
  const res = await postJson(new URL("/v1/heartbeat", server), {
    licenseId: payload.licenseId,
    deviceId: row.deviceId,
    servedSessions: totalSessions,
  });

  if (res.ok && res.body?.ok) {
    const usage = Number(res.body.usageCount ?? 0);
    // Domain push: the licensing service may tell this install to use a new
    // URL from now on (owner changes the domain in the dashboard). Persist
    // it into the stored payload so future checks go straight there.
    const pushed = typeof res.body.server === "string" ? (res.body.server as string).trim() : "";
    if (pushed && /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(pushed)) {
      try {
        const next = new URL(pushed);
        const currentBase = `${server.protocol}//${server.hostname}${server.port ? ":" + server.port : ""}`;
        if (currentBase !== pushed.replace(/\/+$/, "")) {
          payload.server = {
            url: `${next.protocol}//${next.hostname}`,
            port: next.port ? Number(next.port) : next.protocol === "https:" ? 443 : 80,
          };
          console.log(`[p00rija-license] licensing endpoint updated by vendor push → ${pushed}`);
        }
      } catch {
        // malformed push — ignore and keep the current server
      }
    }
    await db.licenseActivation.update({
      where: { id: row.id },
      data: {
        status: "active",
        failCount: 0,
        usageCount: Number.isFinite(usage) ? usage : row.usageCount,
        lastHeartbeatAt: new Date(),
        lastServerMessage: String(res.body.message ?? "ok"),
        // Keep the v2 wrapper shape: env stays the signed original, only the
        // working copy's `server` endpoint may change.
        payload: JSON.stringify({ v: 2, env, data: payload } satisfies StoredWrapper),
      },
    });
    invalidateGateCache();
    return readGateState();
  }

  // Definitive server-side rejection → lock immediately.
  if (res.status >= 400 && res.status < 500 && res.status !== 429) {
    const reason = res.body?.error || `License rejected (HTTP ${res.status}).`;
    await db.licenseActivation.update({
      where: { id: row.id },
      data: { status: "maintenance", failCount: 0, lastServerMessage: reason },
    });
    invalidateGateCache();
    return { ...gate, phase: "maintenance", reason };
  }

  // Server unreachable — burn one grace slot before locking.
  const failCount = row.failCount + 1;
  const locked = failCount >= GRACE_CHECKS;
  await db.licenseActivation.update({
    where: { id: row.id },
    data: {
      failCount,
      status: locked ? "maintenance" : row.status,
      lastServerMessage: locked ? "licensing service unreachable" : "licensing service unreachable (grace)",
      lastHeartbeatAt: new Date(),
    },
  });
  invalidateGateCache();
  return readGateState();
}

// ── Trial mechanism (public/GitHub build — runs WITHOUT vendor keys) ────────

interface TrialInfo {
  startedAt: number;
  remaining: number;
  totalMs: number;
}

/** Fixed trial-file path — always inside the app's data directory. */
const TRIAL_FILE = "/app/db/.trial-stamp";
/** Random per-install key created on first boot. A third anchor: resetting the
 *  trial now requires wiping the DB row AND both files (the HMAC key under
 *  the stamp changes, so a re-forged stamp with the old key fails). */
const TRIAL_KEY_FILE = "/app/db/.trial-key";

async function trialHmacKey(): Promise<string> {
  const secret = process.env.AUTH_SECRET?.trim() || "trial-fallback";
  try {
    const fs = await import("fs");
    let key = fs.readFileSync(TRIAL_KEY_FILE, "utf8").trim();
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("bad key");
    return `${secret}:${key}`;
  } catch {
    try {
      const fs = await import("fs");
      const { randomBytes } = await import("crypto");
      const key = randomBytes(32).toString("hex");
      fs.mkdirSync("/app/db", { recursive: true });
      fs.writeFileSync(TRIAL_KEY_FILE, key, { mode: 0o600 });
      return `${secret}:${key}`;
    } catch {
      return secret; // non-writable FS (dev): fall back to AUTH_SECRET only
    }
  }
}

export async function getOrCreateTrialInfo(): Promise<TrialInfo> {
  const totalMs = TRIAL_DAYS * 24 * 3600 * 1000;
  const secret = await trialHmacKey();
  const dbRow = await db.licenseActivation.findFirst({ where: { licenseId: "__trial__" } });

  let fileStamp = 0;
  let fileOk = false;
  try {
    const raw = (await import("fs")).readFileSync(TRIAL_FILE, "utf8").trim();
    const [stamp, mac] = raw.split("|");
    const { createHmac } = await import("crypto");
    fileOk = mac === createHmac("sha256", secret).update(stamp).digest("hex").slice(0, 16);
    if (fileOk) fileStamp = Number(stamp);
  } catch { /* missing */ }

  let startedAt = 0;
  if (dbRow) {
    try { startedAt = (JSON.parse(dbRow.payload) as { trialStart?: number }).trialStart || 0; } catch { /* */ }
  }

  if (!startedAt && !fileStamp) {
    startedAt = Date.now();
    await db.licenseActivation.upsert({
      where: { licenseId: "__trial__" },
      update: { payload: JSON.stringify({ trialStart: startedAt }) },
      create: { licenseId: "__trial__", deviceId: "__trial__", payload: JSON.stringify({ trialStart: startedAt }) },
    });
    try {
      const fs = await import("fs");
      const { createHmac } = await import("crypto");
      fs.mkdirSync("/app/db", { recursive: true });
      fs.writeFileSync(TRIAL_FILE, `${startedAt}|${createHmac("sha256", secret).update(String(startedAt)).digest("hex").slice(0, 16)}`);
    } catch { /* */ }
  } else if (startedAt && fileOk && fileStamp !== startedAt) {
    startedAt = Math.min(startedAt, fileStamp);
  } else if (!fileOk && startedAt) {
    try {
      const fs = await import("fs");
      const { createHmac } = await import("crypto");
      fs.writeFileSync(TRIAL_FILE, `${startedAt}|${createHmac("sha256", secret).update(String(startedAt)).digest("hex").slice(0, 16)}`);
    } catch { /* */ }
  } else if (fileOk && !startedAt) {
    startedAt = fileStamp;
    await db.licenseActivation.upsert({
      where: { licenseId: "__trial__" },
      update: { payload: JSON.stringify({ trialStart: startedAt }) },
      create: { licenseId: "__trial__", deviceId: "__trial__", payload: JSON.stringify({ trialStart: startedAt }) },
    });
  }

  return { startedAt, remaining: Math.max(0, totalMs - (Date.now() - startedAt)), totalMs };
}

export async function describeTrial(): Promise<{ daysLeft: number; totalDays: number; expired: boolean } | null> {
  if (process.env.LICENSE_AES_KEY?.trim() && process.env.LICENSE_SIGN_PUBKEY?.trim()) return null;
  const t = await getOrCreateTrialInfo();
  return { daysLeft: Math.ceil(t.remaining / 86400000), totalDays: TRIAL_DAYS, expired: t.remaining <= 0 };
}

/** Cached snapshot for the proxy — at most one DB read per 10 seconds. */
let gateCache: { at: number; state: LicenseGateState } | null = null;
export function invalidateGateCache() {
  gateCache = null;
}

// Opportunistic heartbeat scheduling — timers started in the proxy context do
// not persist reliably, so ticks are also driven by incoming traffic: at most
// one in-flight tick per module instance, due once per heartbeat interval.
let lastTickAt = 0;
let tickInFlight = false;

function tickIntervalMs(): number {
  return Math.max(1, Number(process.env.LICENSE_HEARTBEAT_MINUTES ?? 10)) * 60_000;
}

function maybeTick(): void {
  if (tickInFlight || Date.now() - lastTickAt < tickIntervalMs()) return;
  lastTickAt = Date.now();
  tickInFlight = true;
  void heartbeatTick().catch(() => undefined).finally(() => {
    tickInFlight = false;
  });
}

export async function readGateState(): Promise<LicenseGateState> {
  if (!licensingEnabled()) {
    return { phase: "disabled", reason: "" };
  }
  // Lazy bootstrap: Guarantees the heartbeat loop runs even when the
  // instrumentation hook never fired (dev/HMR, exotic runtimes).
  startHeartbeatLoop();
  maybeTick();
  if (gateCache && Date.now() - gateCache.at < 10_000) return gateCache.state;

  const row = await db.licenseActivation.findFirst({ where: realLicenseWhere() });
  if (!row) {
    // ── TRIAL MODE (public/GitHub build) ──
    // No vendor keys + no license → run for TRIAL_DAYS from first boot.
    // After that, lock until a signed .lic file is activated.
    const vendorKeysPresent = hasVendorKeys();
    if (!vendorKeysPresent) {
      const trial = await getOrCreateTrialInfo();
      if (trial.remaining > 0) {
        gateCache = {
          at: Date.now(),
          state: { phase: "active", reason: "", plan: "trial", usageLimit: null, usageCount: 0 },
        };
        return gateCache.state;
      }
      gateCache = {
        at: Date.now(),
        state: { phase: "unlicensed", reason: `Trial expired after ${TRIAL_DAYS} days. Please purchase a license to continue using this software.` },
      };
      return gateCache.state;
    }
    gateCache = { at: Date.now(), state: { phase: "unlicensed", reason: "No license activated." } };
    return gateCache.state;
  }

  // A real license row exists — prove it against the vendor signature before
  // its terms are believed. Verification failure = tamper (or a pre-v2 row):
  // maintenance-lock with a re-activation prompt; only re-activating with a
  // genuine .lic file clears it.
  const verdict = verifyStoredLicense(row);
  const payload = verdict.ok ? (verdict.data as LicensePayload) : null;
  const base = {
    licenseId: row.licenseId,
    licensee: payload?.licensee,
    plan: payload?.plan,
    expiresAt: payload?.expiresAt ?? null,
    usageCount: row.usageCount,
    usageLimit: payload?.usageLimit ?? null,
  };
  if (!verdict.ok) {
    const reason = verdict.legacy
      ? "License record format is from an older build — please re-activate your license file (one-time)."
      : "License integrity check failed — the stored license was modified. Please re-activate with your original license file.";
    gateCache = { at: Date.now(), state: { ...base, phase: "maintenance", reason } };
    return gateCache.state;
  }
  if (row.status !== "active") {
    gateCache = {
      at: Date.now(),
      state: { ...base, phase: "maintenance", reason: row.lastServerMessage || "License is not active." },
    };
    return gateCache.state;
  }
  const expiresAt = payload?.expiresAt ? new Date(payload.expiresAt).getTime() : null;
  if (expiresAt && expiresAt < Date.now()) {
    gateCache = { at: Date.now(), state: { ...base, phase: "maintenance", reason: "License expired." } };
    return gateCache.state;
  }
  if (payload?.usageLimit != null && row.usageCount > payload.usageLimit) {
    gateCache = { at: Date.now(), state: { ...base, phase: "maintenance", reason: "Usage limit reached." } };
    return gateCache.state;
  }
  gateCache = { at: Date.now(), state: { ...base, phase: "active", reason: "" } };
  return gateCache.state;
}

/** Info for the activation/lock page. */
export async function describeGate(): Promise<LicenseGateState> {
  return readGateState();
}
