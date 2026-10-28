// ============================================================
// Activation-code normalizer (pure — no I/O, isomorphic:
// runs in the browser on /license and anywhere on the server).
//
// A license ships as either the signed .lic JSON envelope (file) or a
// compact one-line activation code: "P00LIC1.<base64url of the same
// envelope JSON>". Both forms end up in the same place: the envelope
// string that parseLicenseFile() (src/lib/licensing.ts) validates —
// Ed25519 signature check + AES-256-GCM decryption against the vendor
// keys baked into this build. This module only unpacks the packaging;
// it trusts nothing and forgives nothing.
// ============================================================

export const LICENSE_CODE_PREFIX = "P00LIC1.";

export class LicenseCodeError extends Error {}

/** base64url → bytes, using only cross-runtime primitives (atob exists in browsers and Node ≥16). */
function base64UrlDecodeBytes(packed: string): Uint8Array {
  const b64 = packed.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Accepts either form — a raw envelope JSON string or a P00LIC1 activation
 * code (whitespace/newlines tolerated) — and returns the envelope JSON.
 * Throws LicenseCodeError on anything that is not a well-formed code.
 */
export function normalizeLicenseInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(LICENSE_CODE_PREFIX)) return trimmed; // already envelope JSON
  const packed = trimmed.slice(LICENSE_CODE_PREFIX.length).replace(/\s+/g, "");
  if (!/^[A-Za-z0-9_-]+$/.test(packed) || packed.length < 24) {
    throw new LicenseCodeError("کد فعال‌سازی ناقص است — کل کد را کپی و جای‌گذاری کنید.");
  }
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(base64UrlDecodeBytes(packed));
    JSON.parse(decoded); // must unpack to the envelope JSON object — rejects garbage
  } catch {
    throw new LicenseCodeError("کد فعال‌سازی خراب است — آن را دوباره از داشبورد کپی کنید.");
  }
  return decoded;
}
