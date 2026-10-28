// License heartbeat loop — started once per server process from
// instrumentation.ts. Checks in with the vendor's licensing service every
// heartbeatMinutes (from the license file, default 10) so the owner can
// revoke/suspend remotely; a failed check eventually flips the site into
// maintenance mode, and recovery is automatic once checks pass again.

let started = false;

export function startHeartbeatLoop() {
  if (started) return;
  started = true;
  const g = globalThis as unknown as { __licenseHeartbeatTimer?: ReturnType<typeof setInterval> };
  if (g.__licenseHeartbeatTimer) return;

  const run = async () => {
    try {
      const { licensingEnabled, heartbeatTick } = await import("@/lib/licensing");
      if (!licensingEnabled()) return;
      const state = await heartbeatTick();
      if (state.phase !== "active") {
        console.warn(`[p00rija-license] phase=${state.phase} ${state.reason}`);
      }
    } catch (error) {
      console.warn("[p00rija-license] heartbeat error:", error instanceof Error ? error.message : error);
    }
  };

  // First check shortly after boot, then on the configured cadence.
  setTimeout(() => {
    void run();
    const intervalMs = Math.max(1, Number(process.env.LICENSE_HEARTBEAT_MINUTES ?? 10)) * 60_000;
    const timer = setInterval(() => void run(), intervalMs) as unknown as { unref?: () => void };
    // Never keep the process alive just for the timer.
    timer.unref?.();
  }, 5_000);
}
