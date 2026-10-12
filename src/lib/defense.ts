import { promises as fs } from "fs";
import path from "path";

/* ============================================================
 * Defense store — the "moat" in front of the site.
 *
 * Shared by src/proxy.ts (request gate) and the CMS defense API.
 * Next.js 16 proxy runs as its own bundle, so the source of truth
 * is a small JSON file next to the SQLite database (persists in
 * the /app/db Docker volume). Readers keep an mtime-checked
 * in-process cache; writers persist atomically (tmp + rename).
 *
 * Everything is tuned for a 1-core box: per-request work is two
 * map lookups + one regex sweep; the rate limiter is in-memory;
 * threat log is a capped ring (500 entries) written debounced.
 * ============================================================ */

export type DefenseMode = "off" | "log" | "balanced" | "strict";

export interface DefenseSettings {
  mode: DefenseMode;
  /** requests per minute per IP before a temporary ban */
  rateLimitPerMin: number;
  /** ban duration in minutes for rate-limit offenders */
  rateBanMinutes: number;
  /** block obvious scanners/attack tools by user-agent */
  blockBadBots: boolean;
  /** block requests to sensitive paths (.env, .git, wp-admin…) */
  blockSensitivePaths: boolean;
  /** hard ban list (IPs) */
  blocklist: string[];
  /** permanent allow list (IPs) — evaluated before every check */
  allowlist: string[];
}

export interface ThreatEvent {
  id: number;
  at: number; // epoch ms
  ip: string;
  ua: string;
  method: string;
  path: string;
  rule: string; // rate-limit | bad-bot | sensitive-path | blocklist | 404-storm
  action: "logged" | "blocked" | "allowed-goodbot";
  country: string;
}

interface DefenseState {
  settings: DefenseSettings;
  /** ip → banned-until epoch ms */
  bans: Record<string, number>;
  threats: ThreatEvent[];
  nextThreatId: number;
}

export const DEFAULT_SETTINGS: DefenseSettings = {
  mode: "balanced",
  rateLimitPerMin: 120,
  rateBanMinutes: 10,
  blockBadBots: true,
  blockSensitivePaths: true,
  blocklist: [],
  allowlist: [],
};

const STATE_FILE =
  process.env.P00RIJA_DEFENSE_FILE ||
  path.join(process.cwd(), "db", "defense-state.json");

const MAX_THREATS = 500;

/* ---------------- in-process cache ---------------- */

let cache: DefenseState | null = null;
let cacheMtimeMs = 0;
let lastLoadAt = 0;

async function loadState(force = false): Promise<DefenseState> {
  const now = Date.now();
  if (!force && cache && now - lastLoadAt < 5_000) return cache;
  lastLoadAt = now;
  try {
    const stat = await fs.stat(STATE_FILE);
    if (!force && cache && stat.mtimeMs === cacheMtimeMs) return cache;
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DefenseState>;
    cache = {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      bans: parsed.bans ?? {},
      threats: Array.isArray(parsed.threats) ? parsed.threats.slice(-MAX_THREATS) : [],
      nextThreatId: parsed.nextThreatId ?? 1,
    };
    cacheMtimeMs = stat.mtimeMs;
  } catch {
    cache = { settings: { ...DEFAULT_SETTINGS }, bans: {}, threats: [], nextThreatId: 1 };
    cacheMtimeMs = 0;
  }
  return cache;
}

let writeQueued = false;

async function persist(state: DefenseState): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    const tmp = STATE_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(state));
    await fs.rename(tmp, STATE_FILE);
    cache = state;
    cacheMtimeMs = Date.now();
  } catch {
    // state must never take the site down
  }
}

/** Coalesce bursts of writes (attack storms) into one per tick. */
function schedulePersist(state: DefenseState): void {
  cache = state;
  if (writeQueued) return;
  writeQueued = true;
  setTimeout(() => {
    writeQueued = false;
    void persist(cache as DefenseState);
  }, 1_200);
}

export async function readState(): Promise<DefenseState> {
  return loadState();
}

export async function updateSettings(patch: Partial<DefenseSettings>): Promise<DefenseSettings> {
  const state = await loadState(true);
  state.settings = { ...state.settings, ...patch };
  await persist(state);
  return state.settings;
}

export async function addThreat(event: Omit<ThreatEvent, "id" | "at">): Promise<ThreatEvent> {
  const state = await loadState();
  const threat: ThreatEvent = {
    ...event,
    id: state.nextThreatId++,
    at: Date.now(),
  };
  state.threats.push(threat);
  if (state.threats.length > MAX_THREATS) {
    state.threats = state.threats.slice(-MAX_THREATS);
  }
  schedulePersist(state);
  return threat;
}

export async function banIp(ip: string, minutes: number, rule: string, ua = "", pathReq = "", country = ""): Promise<void> {
  const state = await loadState();
  state.bans[ip] = Date.now() + minutes * 60_000;
  // keep the ban map bounded
  const entries = Object.entries(state.bans);
  if (entries.length > 2000) {
    const now = Date.now();
    state.bans = Object.fromEntries(entries.filter(([, until]) => until > now).slice(-1000));
  }
  await addThreat({ ip, ua, method: "GET", path: pathReq, rule, action: "blocked", country });
}

export async function unbanIp(ip: string): Promise<boolean> {
  const state = await loadState(true);
  if (!(ip in state.bans)) return false;
  delete state.bans[ip];
  await persist(state);
  return true;
}

export async function clearThreats(): Promise<void> {
  const state = await loadState(true);
  state.threats = [];
  await persist(state);
}

/* ---------------- request classification ---------------- */

const BAD_UA_PATTERNS: [RegExp, string][] = [
  [/sqlmap|nikto|nmap|masscan|zgrab|nuclei|gobuster|dirbuster|wfuzz|ffuf|feroxbuster|hakai|arjun|wpscan/i, "attack-scanner"],
  [/acunetix|netsparker|arachni|w3af/i, "vuln-scanner"],
  [/python-requests|python-urllib|scrapy|aiohttp|libwww-perl|go-http-client|java\/|curl\/|wget/i, "http-tool"],
  [/headlesschrome|puppeteer|playwright|phantomjs|selenium/i, "headless-browser"],
  [/semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|serpstatbot|megaindex/i, "seo-harvester"],
];

const GOOD_UA_PATTERNS: [RegExp, string][] = [
  [/Googlebot|Google-InspectionTool|GoogleOther/i, "googlebot"],
  [/bingbot|BingPreview/i, "bingbot"],
  [/DuckDuckBot/i, "duckduckbot"],
  [/YandexBot/i, "yandexbot"],
];

const SENSITIVE_PATH = /(?:^|\/)\.?%(?:2e|2f)|\.(?:env|git|svn|hg|aws|ssh|bak|sql|sqlite3?|db|ini|log|yml|yaml|pem|key)(?:$|[?#/?])|\/\.(?:git|env|htaccess|htpasswd|DS_Store)|wp-(?:admin|login|content|includes)|phpmyadmin|pma\/|xmlrpc\.php|\/vendor\/phpunit|\/cgi-bin\/|\/actuator\/|\/\.well-known\/(?:probing|sftp)|\/telescope|\/_profiler|\/config\.json|\/composer\.(?:json|lock)|\/package\.json$|\/web\.config$/i;

export interface Verdict {
  allow: boolean;
  action: "allow" | "log" | "block";
  rule: string;
  goodBot: boolean;
}

/** Pure classification — no I/O. settings + bans come preloaded. */
export function classify(
  ip: string,
  ua: string,
  methodPath: string,
  settings: DefenseSettings,
  bans: Record<string, number>
): Verdict {
  const mode = settings.mode;
  if (mode === "off") return { allow: true, action: "allow", rule: "", goodBot: false };

  if (settings.allowlist.includes(ip)) {
    return { allow: true, action: "allow", rule: "allowlist", goodBot: false };
  }
  if (settings.blocklist.includes(ip)) {
    return { allow: false, action: "block", rule: "blocklist", goodBot: false };
  }
  const bannedUntil = bans[ip];
  if (bannedUntil && bannedUntil > Date.now()) {
    return { allow: false, action: "block", rule: "rate-limit", goodBot: false };
  }

  const goodBot = GOOD_UA_PATTERNS.find(([re]) => re.test(ua))?.[1] ?? "";
  if (goodBot) {
    // search engines always pass in every mode (SEO) — only recorded
    return { allow: true, action: "log", rule: `good-bot:${goodBot}`, goodBot: true };
  }

  const badBot = BAD_UA_PATTERNS.find(([re]) => re.test(ua))?.[1] ?? "";
  if (badBot && settings.blockBadBots) {
    return {
      allow: mode === "log",
      action: mode === "log" ? "log" : "block",
      rule: `bad-bot:${badBot}`,
      goodBot: false,
    };
  }

  if (settings.blockSensitivePaths && SENSITIVE_PATH.test(methodPath)) {
    return {
      allow: mode === "log" || mode === "balanced",
      action: mode === "log" || mode === "balanced" ? "log" : "block",
      rule: "sensitive-path",
      goodBot: false,
    };
  }

  return { allow: true, action: "allow", rule: "", goodBot: false };
}

/* ---------------- in-memory rate limiter ---------------- */

const hits = new Map<string, number[]>();
let lastSweep = 0;

/** Sliding-window per-IP counter; returns true when over the limit. */
export function isRateLimited(ip: string, perMinute: number): boolean {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < 60_000);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }
  const times = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  times.push(now);
  hits.set(ip, times);
  return times.length > perMinute;
}

/** Check + record a hit; returns the reason a request should be blocked. */
export async function gateRequest(input: {
  ip: string;
  ua: string;
  method: string;
  path: string;
}): Promise<Verdict> {
  const state = await loadState();
  const { settings } = state;

  const verdict = classify(input.ip, input.ua, `${input.method} ${input.path}`, settings, state.bans);
  if (!verdict.allow) {
    if (verdict.rule !== "blocklist") {
      await addThreat({
        ip: input.ip,
        ua: input.ua,
        method: input.method,
        path: input.path,
        rule: verdict.rule,
        action: "blocked",
        country: "",
      });
      if (verdict.rule === "rate-limit" || verdict.rule === "sensitive-path") {
        const state2 = await loadState();
        state2.bans[input.ip] = Date.now() + settings.rateBanMinutes * 60_000;
        schedulePersist(state2);
      }
    }
    return verdict;
  }

  if (settings.mode !== "off" && verdict.rule !== "allowlist") {
    if (isRateLimited(input.ip, settings.rateLimitPerMin)) {
      const limited: Verdict = {
        allow: settings.mode === "log",
        action: settings.mode === "log" ? "log" : "block",
        rule: "rate-limit",
        goodBot: false,
      };
      if (!limited.allow) {
        await banIp(input.ip, settings.rateBanMinutes, "rate-limit", input.ua, input.path);
      }
      return limited;
    }
  }

  if (verdict.action === "log") {
    await addThreat({
      ip: input.ip,
      ua: input.ua,
      method: input.method,
      path: input.path,
      rule: verdict.rule,
      action: verdict.goodBot ? "allowed-goodbot" : "logged",
      country: "",
    });
  }

  return verdict;
}

export function stateFileForTests(): string {
  return STATE_FILE;
}
