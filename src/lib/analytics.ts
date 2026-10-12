/* ============================================================
 * Analytics server helpers — user-agent classification and a
 * cached, batched, rate-limited IP geolocation resolver.
 *
 * Everything here is tuned for a tiny server (1 CPU, ~900MB):
 *  - hand-rolled UA parsing (no heavy dependency)
 *  - geo lookups batched (ip-api.com, free tier) into one
 *    upstream call every few seconds, results cached in an
 *    LRU capped at 2000 entries, failures are silent and
 *    non-blocking (geo is best-effort decoration)
 * ============================================================ */

export interface UAInfo {
  browser: string;
  os: string;
  device: "desktop" | "mobile" | "tablet" | "bot";
  isBot: boolean;
  botReason: string;
}

/** Known "good" crawlers — we log them but never hard-block by default. */
const GOOD_BOTS: [RegExp, string][] = [
  [/Googlebot|Googlebot-Image|Googlebot-Video|Google-InspectionTool|GoogleOther/i, "googlebot"],
  [/bingbot|adidxbot|BingPreview/i, "bingbot"],
  [/DuckDuckBot/i, "duckduckbot"],
  [/YandexBot/i, "yandexbot"],
  [/Baiduspider/i, "baiduspider"],
];

/** Malicious / noisy scanners and obvious tooling. */
const BAD_BOTS: [RegExp, string][] = [
  [/sqlmap|nikto|nmap|masscan|zgrab|nuclei|gobuster|dirbuster|dirb|wfuzz|ffuf|feroxbuster/i, "scanner"],
  [/acunetix|netsparker|arachni|w3af|openvas|nessus|qualys/i, "vulnscanner"],
  [/python-requests|python-urllib|curl\/|wget|libwww-perl|httpclient|okhttp|go-http-client|aiohttp|scrapy/i, "http-lib"],
  [/headlesschrome|puppeteer|playwright|phantomjs|selenium/i, "headless"],
  [/semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|serpstatbot|megaindex|backlinkcheck/i, "seo-spider"],
  [/zgrab\/|censysinspect|internetmeasurement|simple-scan|masscan-portscanner/i, "research-scanner"],
  [/hakai|arjun|param-miner|x8|wpscan|joomscan/i, "attack-tool"],
];

/** Empty / fake UAs used by aggressive crawlers. */
const FAKE_UA_HINTS: RegExp = /(?:^["']?$)|java\/|curl\/7\.\d+\.\d+ \(x86_64\)|^-$|bot(?![a-z])/i;

export function parseUA(uaRaw: string | null | undefined): UAInfo {
  const ua = (uaRaw || "").trim();

  for (const [re, name] of BAD_BOTS) {
    if (re.test(ua)) {
      return { browser: ua.slice(0, 120) || name, os: "unknown", device: "bot", isBot: true, botReason: name };
    }
  }
  for (const [re, name] of GOOD_BOTS) {
    if (re.test(ua)) {
      return { browser: name, os: "crawler", device: "bot", isBot: true, botReason: name };
    }
  }
  if (!ua) {
    return { browser: "empty-ua", os: "unknown", device: "bot", isBot: true, botReason: "empty-ua" };
  }

  let browser = "Unknown";
  let os = "Unknown";
  let device: "desktop" | "mobile" | "tablet" = "desktop";

  if (/Edg(e|A|iOS)?\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Version\/[\d.]+.*Safari\//.test(ua)) browser = "Safari";
  else if (/Safari\//.test(ua)) browser = "Safari (webkit)";
  else if (/MSIE |Trident\//.test(ua)) browser = "IE";

  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone/.test(ua)) { os = "iOS"; device = "mobile"; }
  else if (/iPad/.test(ua)) { os = "iPadOS"; device = "tablet"; }
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) { os = "Android"; device = /Mobile/.test(ua) ? "mobile" : "tablet"; }
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return { browser, os, device, isBot: false, botReason: "" };
}

/* ---------------- geo lookup (best-effort) ---------------- */

export interface GeoInfo {
  country: string;
  region: string;
  city: string;
}

const geoCache = new Map<string, GeoInfo | null>();
const GEO_CACHE_MAX = 2000;
const pendingGeo = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastFlushAt = 0;

export function isPrivateIp(ip: string): boolean {
  return (
    !ip ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

/**
 * The deployment machine's own public IP, resolved once and cached for
 * 24h. Local/test visitors (private or missing IP) are attributed to this
 * IP so their geolocation reflects where the server actually runs
 * instead of showing "Local".
 */
let cachedPublicIp: string | null = null;
let publicIpFetchedAt = 0;

export async function serverPublicIp(): Promise<string> {
  const now = Date.now();
  if (cachedPublicIp !== null && now - publicIpFetchedAt < 24 * 3600 * 1000) {
    return cachedPublicIp;
  }
  publicIpFetchedAt = now;
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(4000),
    });
    const json = (await res.json()) as { ip?: string };
    if (json.ip && typeof json.ip === "string") {
      cachedPublicIp = json.ip;
    }
  } catch {
    // offline / blocked — keep previous or empty (geo falls back to Local)
  }
  return cachedPublicIp ?? "";
}

export function extractIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "";
}

/**
 * Queue an IP for geolocation. Returns the cached value when available,
 * otherwise "" and the lookup happens in a later batch flush. The CMS
 * simply shows "—" for a few seconds on brand-new IPs.
 */
export function geoFor(ip: string): GeoInfo {
  if (!ip || isPrivateIp(ip)) return { country: "Local", region: "", city: "" };
  if (geoCache.has(ip)) return geoCache.get(ip) ?? { country: "", region: "", city: "" };

  pendingGeo.add(ip);
  if (!flushTimer) {
    const wait = Math.max(0, 2500 - (Date.now() - lastFlushAt));
    flushTimer = setTimeout(flushGeoBatch, wait);
  }
  return { country: "", region: "", city: "" };
}

async function flushGeoBatch(): Promise<void> {
  flushTimer = null;
  lastFlushAt = Date.now();
  const batch = Array.from(pendingGeo).slice(0, 100);
  batch.forEach((ip) => pendingGeo.delete(ip));
  if (!batch.length) return;

  // LRU trim
  if (geoCache.size > GEO_CACHE_MAX) {
    const excess = geoCache.size - GEO_CACHE_MAX;
    let i = 0;
    for (const key of geoCache.keys()) {
      if (i++ >= excess) break;
      geoCache.delete(key);
    }
  }

  try {
    const res = await fetch(
      "http://ip-api.com/batch?fields=status,country,regionName,city,query",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) throw new Error(`geo http ${res.status}`);
    const rows = (await res.json()) as Array<{
      status: string;
      country?: string;
      regionName?: string;
      city?: string;
      query?: string;
    }>;
    for (const row of rows) {
      const ip = row.query;
      if (!ip) continue;
      const info: GeoInfo =
        row.status === "success"
          ? { country: row.country ?? "", region: row.regionName ?? "", city: row.city ?? "" }
          : { country: "", region: "", city: "" };
      geoCache.set(ip, info);
    }
    batch.forEach((ip) => {
      if (!geoCache.has(ip)) geoCache.set(ip, { country: "", region: "", city: "" });
    });
  } catch {
    // Best effort only — offline / rate-limited geo must never break tracking.
    batch.forEach((ip) => geoCache.set(ip, { country: "", region: "", city: "" }));
  }

  if (pendingGeo.size > 0 && !flushTimer) {
    flushTimer = setTimeout(flushGeoBatch, 2500);
  }
}

/**
 * Geolocation of the deployment machine itself (public IP → country/city/
 * lat/lon), cached for 24h. Feeds the "server node" on the CMS world map so
 * it always reflects where the app actually runs — never a hardcoded city.
 */
export interface ServerGeoInfo extends GeoInfo {
  ip: string;
  lat: number;
  lon: number;
}

let cachedServerGeo: ServerGeoInfo | null = null;
let serverGeoFetchedAt = 0;

export async function getServerGeo(): Promise<ServerGeoInfo | null> {
  const now = Date.now();
  if (cachedServerGeo && now - serverGeoFetchedAt < 24 * 3600 * 1000) {
    return cachedServerGeo;
  }
  const ip = await serverPublicIp();
  if (!ip || isPrivateIp(ip)) return null;
  serverGeoFetchedAt = now;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,lat,lon`,
      { signal: AbortSignal.timeout(5000) }
    );
    const row = (await res.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
      lat?: number;
      lon?: number;
    };
    if (row.status === "success") {
      cachedServerGeo = {
        ip,
        country: row.country ?? "",
        region: row.regionName ?? "",
        city: row.city ?? "",
        lat: typeof row.lat === "number" ? row.lat : 0,
        lon: typeof row.lon === "number" ? row.lon : 0,
      };
    }
  } catch {
    // Best effort — the map falls back to its default server marker.
  }
  return cachedServerGeo;
}

/** Housekeeping — keep the SQLite table tiny on the low-RAM server. */
export async function pruneSessions(db: {
  visitSession: {
    deleteMany: (args: { where: { lastSeenAt: { lt: Date } } }) => Promise<{ count: number }>;
  };
}): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  await db.visitSession.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
}
