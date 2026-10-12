import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";

const COOKIE = "developer_owner";
const TTL_SECONDS = 5 * 60;

function secret() {
  return process.env.AUTH_SECRET?.trim() || "developer-owner-local-only";
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyDeveloperOwnerKey(key: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(key)) return false;
  const encoded = process.env.DEVELOPER_OWNER_KEY_HASH?.trim() || "";
  const [prefix, iterationsRaw, salt, expected] = encoded.split("$");
  const iterations = Number(iterationsRaw);
  if (prefix !== "pbkdf2_sha256" || !Number.isFinite(iterations) || !salt || !expected) return false;
  const actual = pbkdf2Sync(key.toLowerCase(), salt, iterations, 32, "sha256").toString("base64url");
  return safeEqual(actual, expected);
}

function encryptionKey() {
  return createHash("sha256").update(`developer-owner:${secret()}`).digest();
}

function encrypt(payload: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

function decrypt(token: string) {
  const [version, ivRaw, ciphertextRaw, tagRaw] = token.split(".");
  if (version !== "v1" || !ivRaw || !ciphertextRaw || !tagRaw) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export async function unlockDeveloperOwner() {
  const payload = JSON.stringify({ exp: Date.now() + TTL_SECONDS * 1000, nonce: randomBytes(16).toString("base64url") });
  const store = await cookies();
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const secure = forwardedProto === "https" || requestHeaders.get("x-forwarded-ssl")?.toLowerCase() === "on";
  store.set(COOKIE, encrypt(payload), { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: TTL_SECONDS });
}

export async function isDeveloperOwnerUnlocked() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const payload = decrypt(token);
  if (!payload) return false;
  try { return Date.now() < JSON.parse(payload).exp; } catch { return false; }
}

export async function lockDeveloperOwner() {
  (await cookies()).delete(COOKIE);
}
