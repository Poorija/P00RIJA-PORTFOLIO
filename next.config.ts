import type { NextConfig } from "next";
import { availableParallelism } from "node:os";

const hideDevIndicator =
  process.env.HIDE_NEXT_DEV_INDICATOR === "1" ||
  process.env.NEXT_DEV_INDICATOR === "0";

// File-watcher polling interval (ms). Required for hot reload inside Docker
// on macOS/Windows where bind mounts don't propagate native FS events.
// Enabled only when WATCH_POLL_INTERVAL_MS is set (see docker-compose.dev.yml).
const watchPollMs = Number(process.env.WATCH_POLL_INTERVAL_MS || 0);
const detectedBuildCpus = Math.max(1, Math.min(8, availableParallelism()));
const buildCpus = Math.max(1, Number(process.env.NEXT_BUILD_CPUS || detectedBuildCpus));

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev server runs inside Docker (container port 3000, host port 7890), so
  // the browser's Origin (…:7890) differs from the port Next bound to (3000).
  // Without this, Next 16 rejects the HMR websocket with "Unauthorized" and
  // dev hydration never completes. Wildcards cover OrbStack/LAN domains
  // (e.g. portfolio-dev.p00rija-portfolio.orb.local) used to reach the
  // container from other devices.
  ...(process.env.NODE_ENV === "development"
    ? {
        allowedDevOrigins: [
          "localhost", "127.0.0.1", "0.0.0.0",
          "localhost:7890", "127.0.0.1:7890", "0.0.0.0:7890",
          // OrbStack/LAN container domains — wildcards are single-level in
          // Next, so cover both x.orb.local and x.y.orb.local shapes.
          "*.orb.local", "*.*.orb.local", "*.*.*.orb.local",
          "portfolio-dev.p00rija-portfolio.orb.local",
          "*.local", "*.*.local",
        ],
      }
    : {}),
  ...(watchPollMs > 0 ? { watchOptions: { pollIntervalMs: watchPollMs } } : {}),
  // Explicit for low-resource hosting: gzip/brotli responses and emit weak
  // ETags so cheap CDN/browser revalidation never re-downloads payloads.
  compress: true,
  generateEtags: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    cpus: buildCpus,
    memoryBasedWorkersCount: false,
    workerThreads: false,
    staticGenerationMaxConcurrency: Math.min(4, buildCpus),
    staticGenerationMinPagesPerWorker: 1,
  },
  devIndicators: hideDevIndicator ? false : { position: "bottom-left" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" },
        ],
      },
      // /api/content Cache-Control is set per-method inside the route handler:
      // GET is publicly cacheable (public, max-age=45, stale-while-revalidate=300),
      // writes (POST/PUT/DELETE) stay uncached by default. /api/auth/* and
      // /api/contact must never be cached.
      {
        source: "/api/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/contact",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  reactStrictMode: true,
};

export default nextConfig;
