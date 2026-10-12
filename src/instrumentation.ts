// Next.js instrumentation — runs once per server process start.
// Boots the license heartbeat loop when commercial licensing is enabled
// (vendor keys present in the environment). Dev/free builds: no-op.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.LICENSE_AES_KEY?.trim() || !process.env.LICENSE_SIGN_PUBKEY?.trim()) return;
  const { startHeartbeatLoop } = await import("@/lib/license-heartbeat");
  startHeartbeatLoop();
}
