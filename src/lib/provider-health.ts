/* ============================================================
 * Provider Health — automatic API fallback system.
 *
 * Tracks which AI providers are currently up/down in memory (fast, no DB).
 * When a provider fails (quota, timeout, error), it's marked DOWN with a
 * cooldown. After cooldown expires, it's retried on the next message; if
 * it succeeds, it's back in rotation. The chain order comes from the CMS.
 * ============================================================ */

export interface ProviderStatus {
  down: boolean;
  downAt: number;
  reason: string;
  cooldownMs: number;
}

// module-level singleton — survives across requests in the same process
const globalForHealth = globalThis as unknown as { __providerHealth?: Map<string, ProviderStatus> };
if (!globalForHealth.__providerHealth) globalForHealth.__providerHealth = new Map();
const health = globalForHealth.__providerHealth;

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function isAvailable(provider: string): boolean {
  const s = health.get(provider);
  if (!s || !s.down) return true;
  // cooldown expired → retry on next message
  if (Date.now() - s.downAt > s.cooldownMs) return true;
  return false;
}

export function markDown(provider: string, reason: string): void {
  health.set(provider, { down: true, downAt: Date.now(), reason: reason.slice(0, 200), cooldownMs: DEFAULT_COOLDOWN_MS });
}

export function markUp(provider: string): void {
  const s = health.get(provider);
  if (s) s.down = false;
}

export function getStatuses(): Record<string, { down: boolean; reason: string; downAt: number; cooldownRemainingMs: number }> {
  const out: Record<string, { down: boolean; reason: string; downAt: number; cooldownRemainingMs: number }> = {};
  for (const [id, s] of health) {
    out[id] = {
      down: s.down && Date.now() - s.downAt < s.cooldownMs,
      reason: s.reason,
      downAt: s.downAt,
      cooldownRemainingMs: Math.max(0, s.cooldownMs - (Date.now() - s.downAt)),
    };
  }
  return out;
}

/** Parse the CMS fallback chain: "google,pollinations,groq" → ["google","pollinations","groq"] */
export function parseChain(raw: string): string[] {
  const chain = raw.split(",").map((s) => s.trim()).filter(Boolean);
  // always append pollinations as last resort (free, no key)
  if (!chain.includes("pollinations")) chain.push("pollinations");
  return chain;
}
