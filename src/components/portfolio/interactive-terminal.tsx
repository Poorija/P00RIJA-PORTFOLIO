"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Terminal as TerminalIcon } from "lucide-react";
import { toast } from "sonner";
import { useContent } from "@/lib/content-store";
import { openGameCenter } from "./game-center";
import { AsciiMediaPlayer } from "./ascii-media-player";
import { MatrixChoiceScene } from "./matrix-choice-scene";
import { CreativeLab, type LabExperiment } from "./creative-lab";
import { CREATIVE_COMMANDS } from "./creative-commands";

/* ============================================================
 * InteractiveTerminal — a simulated secure shell that boots
 * with the visitor's real browser/OS info and accepts typed
 * commands. Everything is client-side; no real shell is ever
 * executed. Commands live in a registry so `help`, `man` and
 * TAB-completion all derive from one source of truth.
 * ============================================================ */

type LineKind = "input" | "output" | "system" | "error" | "success" | "muted";

interface Line {
  id: number;
  kind: LineKind;
  text: string;
}

const MAX_LINES = 300;
const HOME_DIR = "/home/portfolio";

let _lineId = 0;
const nextId = () => ++_lineId;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* --- fake filesystem ---------------------------------------- */

const DIR_LISTING: Record<string, string[]> = {
  [HOME_DIR]: ["projects/", "certs/", "skills/", "logs/", "readme.md", ".secret", ".bashrc"],
  [`${HOME_DIR}/projects`]: ["web-app/", "api-gateway/", "audit-tool/", "firewall-rules.md", "waf.conf"],
  [`${HOME_DIR}/projects/web-app`]: ["src/", "Dockerfile", "hardening.md"],
  [`${HOME_DIR}/certs`]: ["OSCP.txt", "CISSP.txt", "CEH.txt", "OSWE.txt"],
  [`${HOME_DIR}/skills`]: ["pentest.md", "reverse-eng.md", "cloud-sec.md"],
  [`${HOME_DIR}/logs`]: ["auth.log", "threats.log", "access.log"],
};
const KNOWN_DIRS = new Set(Object.keys(DIR_LISTING));
const DIR_NAMES = new Set(
  Object.keys(DIR_LISTING)
    .filter((p) => p !== HOME_DIR)
    .map((p) => p.split("/").pop() as string)
);

const FILE_CONTENTS: Record<string, string> = {
  "readme.md":
    "# Security Engineer — Portfolio\n" +
    "\n" +
    "Hi! I'm a security engineer specializing in offensive\n" +
    "and defensive security. I break things so attackers can't.\n" +
    "\n" +
    "  - Penetration testing & red teaming\n" +
    "  - Threat modeling & secure architecture\n" +
    "  - Cloud security (AWS / GCP / k8s)\n" +
    "  - Incident response & forensics\n" +
    "\n" +
    "Type 'help' to explore this terminal.",
  ".secret":
    "🎉 You found a secret! Access code: 42\n" +
    "Tip: try 'hack mainframe' or enter the konami code.",
  ".bashrc": "export PS1='root@portfolio:\\w$ '\nalias ll='ls -la'\nalias audit='scan --full'",
  "firewall-rules.md":
    "# Firewall Rules (iptables)\n" +
    "ALLOW 22/tcp   from 10.0.0.0/8\n" +
    "ALLOW 443/tcp  from anywhere\n" +
    "ALLOW 80/tcp   from anywhere\n" +
    "DENY  all else\n" +
    "# default policy: DROP",
  "waf.conf":
    "# WAF profile: paranoid\n" +
    "sql_injection   = BLOCK\n" +
    "xss             = BLOCK\n" +
    "path_traversal  = BLOCK\n" +
    "bot_scorer      = ON (threshold 70)\n" +
    "rate_limit      = 240 req/min/ip",
  "OSCP.txt": "OSCP — Offensive Security Certified Professional (2023)\nID: OS-1337-42",
  "pentest.md":
    "# Pentest Methodology\n" +
    "1. Reconnaissance\n" +
    "2. Enumeration\n" +
    "3. Exploitation\n" +
    "4. Post-exploitation\n" +
    "5. Reporting",
  "auth.log":
    "Jan 12 03:14:07 sshd[1337]: Failed password for root from 203.0.113.66 port 42420\n" +
    "Jan 12 03:14:09 sshd[1337]: Failed password for root from 203.0.113.66 port 42421\n" +
    "Jan 12 03:14:12 fail2ban: BAN 203.0.113.66",
  "threats.log":
    "12:01:44 BOT   curl/8.4      /wp-admin           → challenged\n" +
    "12:03:02 SCAN  masscan/1.3    /.env               → blocked\n" +
    "12:07:19 BOT   python-requests /xmlrpc.php        → blocked\n" +
    "12:11:51 HUMAN Chrome/126      /                   → allowed",
  "access.log":
    "127.0.0.1 - - [12/Jan/2026:12:00:01] \"GET / HTTP/2\" 200 8123\n" +
    "127.0.0.1 - - [12/Jan/2026:12:00:04] \"GET /api/content HTTP/2\" 200 204",
  "hardening.md":
    "# Web App Hardening Checklist\n" +
    "[x] HSTS + security headers\n" +
    "[x] CSP\n" +
    "[x] rate limiting\n" +
    "[x] input validation\n" +
    "[x] parameterized queries\n" +
    "[ ] coffee intake >= 3/day",
};

/* --- fortune quotes ----------------------------------------- */

const FORTUNES = [
  "There are two types of companies: those that have been hacked, and those that will be. — Robert Mueller",
  "Security is always excessive until it's not enough. — Robbie Sinclair",
  "The only truly secure system is one that is powered off, cast in a block of concrete and sealed in a lead-lined room with armed guards. — Gene Spafford",
  "If you think technology can solve your security problems, then you don't understand the problems and you don't understand the technology. — Bruce Schneier",
  "Treat your password like your toothbrush: don't let anybody else use it, and get a new one every six months. — Clifford Stoll",
  "Amateurs hack systems, professionals hack people. — Bruce Schneier",
  "The weakest link in the security chain is the human element. — Kevin Mitnick",
  "You can't hack what you don't understand. — Anonymous",
];

const EIGHTBALL = [
  "It is certain.", "Without a doubt.", "Most likely.", "Ask again later.",
  "Better not tell you now.", "Don't count on it.", "Very doubtful.", "Signs point to yes.",
];

const SL_ART = [
  "      ====        ________                ___________",
  "  _D _|  |_______/        \\__I_I_____===__|_________|",
  "   |(_)---  |   H\\________/ |   |        =|___ ___|  ",
  "   /     |  |   H  |  |     |   |         ||_| |_||  ",
  "  |      |  |   H  |__--------------------| [___] |  ",
  "  | ________|___H__/__|_____/[][]~\\_______|       |  ",
  "  |/ |   |-----------I_____I [][] []  D   |=======|__",
];

function pseudoHash(input: string, salt = 0): string {
  let h1 = 0x811c9dc5 ^ salt;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 ^ input.charCodeAt(i), 2654435761);
  }
  return Array.from({ length: 8 }, (_, i) =>
    ((i % 2 ? h1 : h2) >>> ((i % 4) * 8)).toString(16).padStart(8, "0").slice(0, 8)
  ).join("");
}

function rot13(s: string): string {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function toMorse(s: string): string {
  const map: Record<string, string> = {
    a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....",
    i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.",
    q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-",
    y: "-.--", z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--",
    "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  };
  return s
    .toLowerCase()
    .split("")
    .map((c) => (c === " " ? "/" : map[c] ?? "?"))
    .join(" ");
}

/**
 * Safe arithmetic evaluator — a tiny recursive-descent parser over
 * digits and operators only. No dynamic code execution anywhere.
 */
function calcEval(expr: string): number | null {
  const s = expr.replace(/\s+/g, "");
  if (!s || !/^[0-9+\-*/%().]+$/.test(s)) return null;
  let pos = 0;

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (pos < s.length && (s[pos] === "+" || s[pos] === "-")) {
      const op = s[pos++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (pos < s.length && (s[pos] === "*" || s[pos] === "/" || s[pos] === "%")) {
      const op = s[pos++];
      const right = parseFactor();
      if (right === null) return null;
      left = op === "*" ? left * right : op === "/" ? (right === 0 ? NaN : left / right) : left % right;
    }
    return left;
  }
  function parseFactor(): number | null {
    if (s[pos] === "-") {
      pos++;
      const v = parseFactor();
      return v === null ? null : -v;
    }
    if (s[pos] === "+") {
      pos++;
      return parseFactor();
    }
    if (s[pos] === "(") {
      pos++;
      const v = parseExpr();
      if (v === null || s[pos] !== ")") return null;
      pos++;
      return v;
    }
    const start = pos;
    while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
    if (start === pos) return null;
    const n = Number(s.slice(start, pos));
    return Number.isFinite(n) ? n : null;
  }

  const result = parseExpr();
  if (result === null || pos !== s.length || !Number.isFinite(result)) return null;
  return result;
}

function genPassword(len = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  const rand = new Uint32Array(len);
  crypto.getRandomValues(rand);
  for (let i = 0; i < len; i++) out += chars[rand[i] % chars.length];
  return out;
}

/* --- user-agent parsing ------------------------------------- */

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) {
    const m = ua.match(/Edg\/([\d.]+)/);
    return `Microsoft Edge ${m?.[1] ?? ""}`.trim();
  }
  if (/OPR\//.test(ua) || /Opera\//.test(ua)) {
    const m = ua.match(/(?:OPR|Opera)\/([\d.]+)/);
    return `Opera ${m?.[1] ?? ""}`.trim();
  }
  if (/Firefox\//.test(ua)) {
    const m = ua.match(/Firefox\/([\d.]+)/);
    return `Mozilla Firefox ${m?.[1] ?? ""}`.trim();
  }
  if (/Chrome\//.test(ua)) {
    const m = ua.match(/Chrome\/([\d.]+)/);
    return `Google Chrome ${m?.[1] ?? ""}`.trim();
  }
  if (/Safari\//.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/);
    return `Apple Safari ${m?.[1] ?? ""}`.trim();
  }
  return "Unknown browser";
}

function detectOS(ua: string, platform: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1";
  if (/Windows NT 6\.2/.test(ua)) return "Windows 8";
  if (/Windows NT 6\.1/.test(ua)) return "Windows 7";
  if (/Windows/.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    return `macOS ${m?.[1]?.replace(/_/g, ".") ?? ""}`.trim();
  }
  if (/Android/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    return `Android ${m?.[1] ?? ""}`.trim();
  }
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return platform || "Unknown";
}

function promptPath(cwd: string): string {
  if (cwd === HOME_DIR) return "~";
  if (cwd.startsWith(HOME_DIR + "/")) return "~/" + cwd.slice(HOME_DIR.length + 1);
  return cwd;
}

/* --- command registry --------------------------------------- */

interface Ctx {
  lang: "fa" | "en";
  cwd: string;
  setCwd: (d: string) => void;
  args: string[];
  arg: string;
  clear: () => void;
  reboot: () => Promise<void>;
  push: (kind: LineKind, text: string) => void;
  pushMany: (kind: LineKind, texts: string[]) => void;
  isAlive: () => boolean;
  history: string[];
  openScene: (scene: "media" | "matrix" | "lab", experiment?: LabExperiment) => void;
  choosePill: (pill: "red" | "blue") => void;
  resize: (preset: string) => void;
  quest: (action: "start" | "solve", answer?: string) => void;
  profile: { name: string; role: string; email: string; location: string };
}

interface CommandDef {
  name: string;
  usage?: string;
  desc: string;
  hidden?: boolean;
  run: (ctx: Ctx) => void | Promise<void>;
}

const BOOT_MESSAGES = {
  fa: {
    init: "> در حال راه‌اندازی پوسته امن…",
    connected: "> اتصال برقرار شد",
    info: "> اطلاعات سامانه:",
    session: "> نشست: root@portfolio",
    hint: "> برای دیدن فرمان‌ها «help» را وارد کنید",
    browser: "مرورگر", os: "سیستم‌عامل", language: "زبان", screen: "نمایشگر",
    viewport: "نما", timezone: "منطقه زمانی", cores: "هسته‌ها", online: "برخط",
    yes: "بله", no: "خیر",
  },
  en: {
    init: "> initializing secure shell...",
    connected: "> connection established",
    info: "> system info:",
    session: "> session: root@portfolio",
    hint: "> type 'help' for available commands",
    browser: "browser", os: "os", language: "language", screen: "screen",
    viewport: "viewport", timezone: "timezone", cores: "cores", online: "online",
    yes: "yes", no: "no",
  },
};

const lsRun: CommandDef["run"] = ({ args, cwd, push }) => {
  const showHidden = args.some((a) => a.startsWith("-") && a.includes("a"));
  const list = DIR_LISTING[cwd] ?? DIR_LISTING[HOME_DIR];
  const filtered = showHidden ? list : list.filter((f) => !f.startsWith("."));
  push("output", filtered.join("   "));
};

const editorRun: CommandDef["run"] = ({ push }) => {
  push("muted", "Opening editor... just kidding. This is a web terminal.");
};

const COMMANDS: CommandDef[] = [
  /* ---------------- help & meta ---------------- */
  {
    name: "help", desc: "list commands (help <cmd> for details)",
    run: ({ args, push, pushMany }) => {
      if (args[0]) {
        const cmd = COMMANDS.find((c) => c.name === args[0]);
        if (!cmd) return push("error", `help: no help topics match '${args[0]}'`);
        return pushMany("output", [
          `${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ""}`,
          `  ${cmd.desc}`,
        ]);
      }
      pushMany("output", ["Available commands — use 'man <cmd>' for details:"]);
      const names = COMMANDS.filter((c) => !c.hidden).map((c) => c.name);
      for (let i = 0; i < names.length; i += 6) {
        push("output", "  " + names.slice(i, i + 6).map((n) => n.padEnd(14)).join(""));
      }
      push("muted", "  (+ a few undocumented ones…)");
    },
  },
  {
    name: "man", usage: "<cmd>", desc: "manual page for a command",
    run: ({ args, push, pushMany }) => {
      if (!args[0]) return push("error", "What manual page do you want? (man <cmd>)");
      const cmd = COMMANDS.find((c) => c.name === args[0]);
      if (!cmd) return push("error", `No manual entry for ${args[0]}`);
      pushMany("output", [
        `${cmd.name.toUpperCase()}(1)                    Portfolio Manual`,
        "",
        "NAME",
        `  ${cmd.name} — ${cmd.desc}`,
        "",
        "SYNOPSIS",
        `  ${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ""}`,
      ]);
    },
  },
  {
    name: "history", desc: "show recent commands",
    run: ({ history, push }) => history.slice(-15).forEach((h, i) => push("output", `  ${String(i + 1).padStart(3)}  ${h}`)),
  },

  /* ---------------- filesystem ---------------- */
  { name: "ls", usage: "[-a]", desc: "list directory contents", run: lsRun },
  { name: "dir", desc: "alias for ls", hidden: true, run: lsRun },
  {
    name: "cat", usage: "<file>", desc: "print file contents",
    run: ({ arg, cwd, push }) => {
      if (!arg) return push("error", "usage: cat <file>");
      if (DIR_NAMES.has(arg)) return push("error", `cat: ${arg}: Is a directory`);
      const listing = DIR_LISTING[cwd] ?? [];
      if (listing.some((f) => f.endsWith("/") && f.slice(0, -1) === arg)) {
        return push("error", `cat: ${arg}: Is a directory`);
      }
      const content = FILE_CONTENTS[arg];
      if (content === undefined) return push("error", `cat: ${arg}: No such file or directory`);
      content.split("\n").forEach((l) => push("output", l));
    },
  },
  {
    name: "cd", usage: "<dir>", desc: "change directory",
    run: ({ arg, cwd, setCwd, push }) => {
      const target = arg || HOME_DIR;
      let next: string | null = null;
      if (target === "~" || target === HOME_DIR || target === ".") next = HOME_DIR;
      else if (target === "..") next = cwd === HOME_DIR ? HOME_DIR : HOME_DIR;
      else if (target.startsWith("/")) next = KNOWN_DIRS.has(target) ? target : null;
      else {
        const candidate = `${cwd}/${target}`;
        next = KNOWN_DIRS.has(candidate) ? candidate : null;
      }
      if (next === null) push("error", `cd: ${target}: No such file or directory`);
      else setCwd(next);
    },
  },
  { name: "pwd", desc: "print working directory", run: ({ cwd, push }) => push("output", cwd) },
  { name: "touch", usage: "<file>", desc: "create an empty file (session only)", run: ({ arg, push }) => push(arg ? "output" : "error", arg ? `created '${arg}' (in memory)` : "usage: touch <file>") },
  { name: "mkdir", usage: "<dir>", desc: "create a directory (session only)", run: ({ arg, push }) => push(arg ? "output" : "error", arg ? `created '${arg}/' (in memory)` : "usage: mkdir <dir>") },
  {
    name: "grep", usage: "<pattern> [file]", desc: "search files for a pattern",
    run: ({ args, push }) => {
      const pattern = args[0];
      if (!pattern) return push("error", "usage: grep <pattern> [file]");
      const files = args[1] ? [args[1]] : Object.keys(FILE_CONTENTS);
      let hits = 0;
      for (const f of files) {
        const content = FILE_CONTENTS[f];
        if (!content) continue;
        content.split("\n").forEach((line) => {
          if (line.toLowerCase().includes(pattern.toLowerCase())) {
            hits++;
            push("output", `${f}: ${line}`);
          }
        });
      }
      if (!hits) push("muted", "no matches");
    },
  },
  {
    name: "head", usage: "<file>", desc: "first 5 lines of a file",
    run: ({ arg, push }) => {
      const content = FILE_CONTENTS[arg];
      if (!content) return push("error", `head: ${arg}: No such file`);
      push("output", content.split("\n").slice(0, 5).join("\n"));
    },
  },
  {
    name: "tail", usage: "<file>", desc: "last 5 lines of a file",
    run: ({ arg, push }) => {
      const content = FILE_CONTENTS[arg];
      if (!content) return push("error", `tail: ${arg}: No such file`);
      push("output", content.split("\n").slice(-5).join("\n"));
    },
  },
  {
    name: "tree", desc: "directory tree",
    run: ({ pushMany }) => pushMany("output", [
      HOME_DIR,
      "├── projects/",
      "│   ├── web-app/",
      "│   ├── api-gateway/",
      "│   └── audit-tool/",
      "├── certs/",
      "├── skills/",
      "├── logs/",
      "└── readme.md",
    ]),
  },
  { name: "rm", desc: "remove (denied)", run: ({ push }) => push("error", "rm: permission denied. Try 'sudo' (heh).") },

  /* ---------------- system ---------------- */
  { name: "whoami", desc: "print current user", run: ({ push }) => push("output", "security-engineer") },
  { name: "date", desc: "show current date/time", run: ({ push }) => push("output", new Date().toString()) },
  { name: "echo", usage: "<text>", desc: "echo text back", run: ({ arg, push }) => push("output", arg) },
  { name: "clear", desc: "clear the terminal", run: ({ clear }) => clear() },
  { name: "uname", desc: "system name", run: ({ push }) => push("output", "Linux portfolio 6.8.0-hardened #1 SMP x86_64 GNU/Linux") },
  { name: "hostname", desc: "show hostname", run: ({ push }) => push("output", "portfolio") },
  {
    name: "uptime", desc: "site session uptime",
    run: ({ push }) => {
      const sec = Math.floor(performance.now() / 1000);
      push("output", `up ${sec}s, 1 user, load average: 0.04, 0.08, 0.15, coffee: critical`);
    },
  },
  {
    name: "free", desc: "memory usage (simulated)",
    run: ({ push }) => pushManySafe(push, [
      "               total     used     free",
      "Mem:            8192     4096     2048  (+2048 cache)",
      "Swap:           2048        0     2048",
    ]),
  },
  {
    name: "df", desc: "disk usage (simulated)",
    run: ({ push }) => pushManySafe(push, [
      "Filesystem     1K-blocks     Used Available Use% Mounted on",
      "/dev/portfolio   8123456  3133712   4989744  39% /",
      "tmpfs             262144        0    262144   0% /tmp",
    ]),
  },
  {
    name: "env", desc: "environment variables",
    run: ({ lang, push }) => pushManySafe(push, [
      "USER=security-engineer",
      `HOME=${HOME_DIR}`,
      "SHELL=/bin/zsh-sim",
      "THEME=cyber-aurora",
      `LANG=${lang === "fa" ? "fa_IR.UTF-8" : "en_US.UTF-8"}`,
      "COFFEE_LEVEL=critical",
    ]),
  },
  {
    name: "ps", desc: "process snapshot",
    run: ({ push }) => pushManySafe(push, [
      "  PID TTY          TIME CMD",
      "    1 ?        00:00:01 init",
      "   42 ?        00:00:00 sshd",
      "  133 ?        00:00:02 nginx",
      "  256 ?        00:00:00 postgres",
      "  313 ?        00:00:00 redis-server",
      "  666 ?        00:00:13 auditd",
      " 1337 ?        00:00:42 portfolio",
    ]),
  },
  {
    name: "top", desc: "live-ish process snapshot",
    run: ({ push }) => pushManySafe(push, [
      "top - 13:37:42 up 42 days,  7 users,  load average: 0.04, 0.08, 0.15",
      "Tasks: 128 total,   1 running, 127 sleeping,   0 stopped",
      "%Cpu(s):  2.4 us,  0.7 sy, 96.9 id",
      "MiB Mem :  8192 total,  2048 free,  4096 used,  2048 buff/cache",
      "  PID USER      PR  NI    VIRT    RES  %CPU %MEM COMMAND",
      " 1337 root      20   0  256000  64000   4.2  0.8 portfolio",
      "  313 redis     20   0   62000  12000   0.7  0.1 redis-server",
    ]),
  },
  { name: "kill", usage: "<pid>", desc: "terminate a process (denied)", run: ({ push }) => push("error", "kill: operation not permitted — nice try though") },
  {
    name: "systemctl", usage: "<action> <unit>", desc: "service manager (simulated)",
    run: ({ args, push }) => {
      const unit = args[1] ?? "portfolio";
      push("output", `● ${unit}.service - ${unit} daemon`);
      push("output", `   Active: active (running) since boot`);
      push("output", "   Memory: 42.0M (simulated)");
    },
  },
  {
    name: "journalctl", desc: "read system journal (simulated)",
    run: ({ push }) => pushManySafe(push, [
      "-- Logs begin at boot --",
      "systemd[1]: Reached target Secure Web.",
      "nginx[133]: SSL handshake OK (TLSv1.3)",
      "portfolio[1337]: content cache warm (45s TTL)",
      "auditd[666]: nothing suspicious. yet.",
    ]),
  },
  {
    name: "docker", usage: "ps", desc: "container list (simulated)",
    run: ({ args, push, lang }) => {
      if (args[0] !== "ps") return push("muted", lang === "fa" ? "فقط «docker ps» شبیه‌سازی شده" : "only 'docker ps' is simulated");
      pushManySafe(push, [
        "CONTAINER ID   IMAGE            STATUS         NAMES",
        "9f2a1b3c4d5e   portfolio:live   Up 42 days     portfolio",
        "a1b2c3d4e5f6   nginx:alpine     Up 42 days     edge-proxy",
      ]);
    },
  },
  {
    name: "kubectl", desc: "kubernetes (simulated)",
    run: ({ push }) => pushManySafe(push, [
      "NAME              READY   STATUS    RESTARTS   AGE",
      "web-7d9f8b6c-x2   1/1     Running   0          42d",
      "api-5c4d3e2f-k9   1/1     Running   0          42d",
    ]),
  },

  /* ---------------- network ---------------- */
  {
    name: "nmap", usage: "<host>", desc: "scan a host",
    run: ({ arg, push }) => {
      if (!arg) return push("error", "usage: nmap <host>");
      pushManySafe(push, [
        "Starting Nmap ( https://nmap.org )",
        `Nmap scan report for ${arg}`,
        "Host is up (0.0042s latency).",
        "Not shown: 996 closed tcp ports (reset)",
        "PORT     STATE SERVICE",
        "22/tcp   open  ssh      OpenSSH 9.6p1",
        "80/tcp   open  http     nginx 1.27.2",
        "443/tcp  open  https    nginx 1.27.2",
        "8080/tcp open  http-proxy",
        "",
        "Nmap done: 1 IP address (1 host up) scanned in 4.20 seconds",
      ]);
    },
  },
  {
    name: "ping", usage: "<host>", desc: "send ICMP echo requests",
    run: async ({ arg, push, isAlive }) => {
      if (!arg) return push("error", "usage: ping <host>");
      push("output", `PING ${arg} (10.0.0.42): 56 data bytes`);
      for (let i = 0; i < 4; i++) {
        await sleep(500);
        if (!isAlive()) return;
        push("output", `64 bytes from ${arg}: icmp_seq=${i + 1} ttl=64 time=0.4${i} ms`);
      }
      if (!isAlive()) return;
      push("output", "");
      push("output", `--- ${arg} ping statistics ---`);
      push("output", "4 packets transmitted, 4 received, 0.0% packet loss");
      push("output", "round-trip min/avg/max = 0.40/0.42/0.43 ms");
    },
  },
  {
    name: "ifconfig", desc: "network interfaces",
    run: ({ push }) => pushManySafe(push, [
      "eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500",
      "        inet 10.0.0.42  netmask 255.255.255.0  broadcast 10.0.0.255",
      "        ether 02:42:ac:11:00:42  txqueuelen 1000  (Ethernet)",
      "",
      "lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536",
      "        inet 127.0.0.1  netmask 255.0.0.0",
    ]),
  },
  {
    name: "netstat", desc: "listening sockets",
    run: ({ push }) => pushManySafe(push, [
      "Proto Local Address          State       Program",
      "tcp   0.0.0.0:22             LISTEN      sshd",
      "tcp   0.0.0.0:80             LISTEN      nginx",
      "tcp   0.0.0.0:443            LISTEN      nginx",
      "tcp   127.0.0.1:3000         LISTEN      next",
    ]),
  },
  {
    name: "traceroute", usage: "<host>", desc: "trace a route",
    run: ({ arg, push }) => {
      if (!arg) return push("error", "usage: traceroute <host>");
      pushManySafe(push, [
        `traceroute to ${arg}, 30 hops max`,
        " 1  local-gateway      0.421 ms",
        " 2  edge-router        2.337 ms",
        " 3  backbone-core      8.104 ms",
        ` 4  ${arg}             13.370 ms`,
      ]);
    },
  },
  {
    name: "dig", usage: "<domain>", desc: "DNS lookup",
    run: ({ arg, push }) => {
      if (!arg) return push("error", "usage: dig <domain>");
      pushManySafe(push, [
        `; <<>> DiG 9.18 <<>> ${arg}`,
        ";; status: NOERROR",
        `${arg}.  300  IN  A     203.0.113.42`,
        `${arg}.  300  IN  AAAA  2001:db8::42`,
      ]);
    },
  },
  {
    name: "whois", usage: "<domain>", desc: "domain registry lookup (simulated)",
    run: ({ arg, push }) => {
      if (!arg) return push("error", "usage: whois <domain>");
      pushManySafe(push, [
        `Domain Name: ${arg}`,
        "Registrar: Simulated Registries, Inc.",
        "Creation Date: 2001-01-01T00:00:00Z",
        "Status: clientSimulatedProhibited",
        "DNSSEC: signedDelegation",
      ]);
    },
  },
  {
    name: "curl", usage: "<url>", desc: "fetch a tiny fake response",
    run: ({ arg, push }) => {
      if (!arg) return push("error", "usage: curl <url>");
      push("output", "HTTP/2 200");
      push("output", "content-type: application/json");
      push("output", "");
      push("output", JSON.stringify({ ok: true, url: arg, note: "simulated client-side response" }, null, 2));
    },
  },
  {
    name: "iptables", desc: "firewall rules (simulated)",
    run: ({ push }) => pushManySafe(push, [
      "Chain INPUT (policy DROP)",
      "target  prot opt source          destination",
      "ACCEPT  tcp  --  anywhere        anywhere    tcp dpt:https",
      "ACCEPT  tcp  --  10.0.0.0/8      anywhere    tcp dpt:ssh",
      "DROP    all  --  anywhere        anywhere    /* default deny */",
      "",
      "Chain f2b-ssh (1 references): 3 IPs banned",
    ]),
  },
  {
    name: "ufw", desc: "firewall status (simulated)",
    run: ({ push }) => pushManySafe(push, [
      "Status: active",
      "To                         Action      From",
      "--                         ------      ----",
      "22/tcp                     LIMIT       Anywhere",
      "80,443/tcp                 ALLOW       Anywhere",
    ]),
  },
  {
    name: "fail2ban", desc: "ban list (simulated)",
    run: ({ push }) => pushManySafe(push, [
      "Jail: sshd      → 3 banned IPs",
      "Jail: nginx-botsearch → 17 banned IPs",
      "Jail: portfolio-waf   → 4 banned IPs",
      "most recent: 203.0.113.66 (repeated /wp-admin probes)",
    ]),
  },
  {
    name: "waf", desc: "web application firewall status",
    run: ({ push }) => pushManySafe(push, [
      "waf.service — active (paranoid profile)",
      "  sql_injection  : BLOCK   (0 hits today)",
      "  xss            : BLOCK   (0 hits today)",
      "  path_traversal : BLOCK   (0 hits today)",
      "  bot_scorer     : ON      (threshold 70)",
      "try: cat waf.conf",
    ]),
  },
  {
    name: "scan", desc: "self security scan (simulated)",
    run: ({ lang, push }) => {
      push("system", lang === "fa" ? "> اسکن امنیتی شروع شد…" : "> starting self-scan…");
      push("success", "[✓] TLS 1.3 + HSTS");
      push("success", "[✓] security headers (nosniff, DENY, referrer-policy)");
      push("success", "[✓] rate-limited auth + 2FA");
      push("success", "[✓] parameterized DB access (Prisma)");
      push("success", "[✓] honeypot + bot scoring on public form");
      push("success", lang === "fa" ? "نتیجه: 98/100 — فقط تهدید واقعی، ته قهوه است" : "score: 98/100 — the only real threat is coffee depletion");
    },
  },

  /* ---------------- crypto / encoding ---------------- */
  { name: "hash", usage: "<text>", desc: "sha256-style fingerprint", run: ({ arg, push }) => push("output", pseudoHash(arg || "portfolio")) },
  { name: "md5", usage: "<text>", desc: "md5-style fingerprint (legacy!)", run: ({ arg, push }) => push("output", pseudoHash(arg || "portfolio", 7).slice(0, 32)) },
  {
    name: "base64", usage: "encode|decode <text>", desc: "base64 codec",
    run: ({ args, push }) => {
      const mode = args[0];
      const text = args.slice(1).join(" ");
      if (!text || (mode !== "encode" && mode !== "decode")) return push("error", "usage: base64 encode|decode <text>");
      try {
        const out = mode === "encode"
          ? btoa(unescape(encodeURIComponent(text)))
          : decodeURIComponent(escape(atob(text)));
        push("output", out);
      } catch {
        push("error", "base64: invalid input");
      }
    },
  },
  { name: "rot13", usage: "<text>", desc: "rotate letters by 13", run: ({ arg, push }) => push("output", rot13(arg || "n0p3")) },
  { name: "morse", usage: "<text>", desc: "translate to morse code", run: ({ arg, push }) => push("output", toMorse(arg || "sos")) },
  { name: "uuid", desc: "generate a UUIDv4", run: ({ push }) => push("output", crypto.randomUUID()) },
  {
    name: "pwgen", usage: "[len]", desc: "generate a strong password",
    run: ({ args, push }) => {
      const len = Math.min(64, Math.max(8, Number(args[0]) || 16));
      push("output", genPassword(len));
      push("muted", "(generated locally with crypto.getRandomValues — never transmitted)");
    },
  },
  {
    name: "jwt", desc: "decode a sample token",
    run: ({ push }) => pushManySafe(push, [
      "header:  { alg: 'HS256', typ: 'JWT' }",
      "payload: { sub: 'portfolio-admin', scope: 'cms:read', exp: 'demo' }",
      "verify:  skipped — demo token only",
    ]),
  },
  {
    name: "calc", usage: "<expr>", desc: "quick arithmetic (e.g. calc 2*(3+4))",
    run: ({ arg, push }) => {
      if (!arg) return push("error", "usage: calc <expr>");
      const value = calcEval(arg);
      push(value === null ? "error" : "output", value === null ? "calc: invalid expression" : `= ${value}`);
    },
  },

  /* ---------------- site integration ---------------- */
  {
    name: "games", desc: "open the Game Center arcade",
    run: ({ lang, push }) => {
      push("success", lang === "fa" ? "> در حال باز کردن مرکز بازی… 🎮" : "> launching the Game Center… 🎮");
      openGameCenter();
    },
  },
  {
    name: "play", usage: "<game-id>", desc: "open a specific game",
    run: ({ arg, push }) => {
      if (!arg) return push("error", "usage: play snake | 2048 | breakout | pong | ...");
      push("success", `> loading '${arg}'…`);
      openGameCenter(arg);
    },
  },
  {
    name: "goto", usage: "<section>", desc: "scroll to a section (graphics|security|ai|timeline|contact)",
    run: ({ arg, push }) => {
      const id = (arg || "").replace(/^#/, "");
      if (!id) return push("error", "usage: goto <section>");
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        push("success", `> jumping to #${id}`);
      } else push("error", `goto: section '${id}' not found`);
    },
  },
  {
    name: "lang", usage: "fa|en", desc: "switch site language",
    run: ({ arg, push }) => {
      if (arg !== "fa" && arg !== "en") return push("error", "usage: lang fa|en");
      try { window.dispatchEvent(new CustomEvent("set-lang", { detail: arg })); } catch {}
      push("success", `> language → ${arg.toUpperCase()}`);
    },
  },
  {
    name: "theme", desc: "spin the theme roulette",
    run: ({ push }) => {
      try { window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" })); } catch {}
      push("success", "> theme roulette spun 🎡");
    },
  },
  {
    name: "resume", desc: "open the résumé",
    run: ({ push }) => {
      push("success", "opening résumé… ☀️");
      try { window.dispatchEvent(new CustomEvent("open-profile")); } catch {}
    },
  },
  { name: "cv", desc: "alias for resume", hidden: true, run: ({ push }) => push("success", "opening résumé… ☀️") },
  {
    name: "visitor", desc: "your own session card",
    run: ({ lang, push }) => {
      const ua = navigator.userAgent;
      let tz = "UTC";
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch {}
      push("output", `${lang === "fa" ? "مرورگر" : "browser"}:  ${detectBrowser(ua)}`);
      push("output", `${lang === "fa" ? "سیستم‌عامل" : "os"}:       ${detectOS(ua, navigator.platform ?? "")}`);
      push("output", `${lang === "fa" ? "منطقه زمانی" : "timezone"}: ${tz}`);
      push("output", `${lang === "fa" ? "هسته‌ها" : "cores"}:     ${navigator.hardwareConcurrency || "?"}`);
      push("output", `${lang === "fa" ? "نشست" : "session"}:    root@portfolio (simulated)`);
    },
  },
  { name: "achievements", desc: "open the trophy vault", run: ({ push }) => push("success", "opening the trophy vault… 🏆") },
  {
    name: "rocket", desc: "initiate launch sequence",
    run: ({ push }) => {
      push("success", "initiating launch sequence… 3… 2… 1…");
      try { window.dispatchEvent(new CustomEvent("achieve", { detail: "terminal-secret" })); } catch {}
    },
  },
  {
    name: "42", desc: "the answer",
    run: ({ push }) => {
      push("output", "the answer to life, the universe and everything.");
      try { window.dispatchEvent(new CustomEvent("achieve", { detail: "answer-42" })); } catch {}
    },
  },

  /* ---------------- fun ---------------- */
  {
    name: "sudo", usage: "<cmd>", desc: "attempt elevated execution",
    run: ({ push }) => push("error", "user is not in the sudoers file. This incident will be reported. 😏"),
  },
  {
    name: "hack", usage: "<target>", desc: "hack a target (totally real)",
    run: async ({ arg, push, isAlive, lang }) => {
      if (!arg) return push("error", "usage: hack <target>");
      const steps = [
        `Targeting ${arg}...`,
        "Scanning ports... [12 open found]",
        "Cracking password... [██████████] 100%",
        "Bypassing firewall... [OK]",
        "Escalating privileges... [root]",
        "Covering tracks... [logs wiped]",
      ];
      for (const s of steps) {
        await sleep(330);
        if (!isAlive()) return;
        push("muted", s);
      }
      await sleep(300);
      if (!isAlive()) return;
      push("success", `*** ACCESS GRANTED to ${arg} ***`);
      push("muted", lang === "fa" ? "(شوخی کردم — این یک شبیه‌سازی است)" : "(just kidding, this is a simulation)");
    },
  },
  {
    name: "matrix", desc: "enter the matrix",
    run: async ({ push, isAlive }) => {
      const chars = "ｱｲｳｴｵｶｷｸｹｺ01ABCDEF#@$%&*";
      for (let i = 0; i < 36; i++) {
        if (!isAlive()) return;
        let line = "";
        for (let c = 0; c < 32; c++) line += chars[Math.floor(Math.random() * chars.length)];
        push("success", line);
        await sleep(80);
      }
      if (!isAlive()) return;
      push("muted", "> wake up, neo...");
    },
  },
  {
    name: "asciiquarium", desc: "open the interactive aquarium in Creative Lab",
    run: ({ openScene, push }) => {
      push("success", "> opening the interactive aquarium…");
      openScene("lab", "aquarium");
    },
  },
  {
    name: "camp", desc: "visit the animated forest campfire",
    run: ({ openScene, push }) => {
      push("success", "> entering the forest campsite…");
      openScene("lab", "camp");
    },
  },
  {
    name: "cowsay", usage: "<text>", desc: "important cow-based advisory",
    run: ({ arg, push }) => {
      const msg = arg || "Patch first. Panic later.";
      push("output", ` ${"_".repeat(Math.min(msg.length + 2, 44))}`);
      push("output", `< ${msg.slice(0, 42)} >`);
      push("output", ` ${"-".repeat(Math.min(msg.length + 2, 44))}`);
      push("output", "        \\   ^__^");
      push("output", "         \\  (oo)\\_______");
      push("output", "            (__)\\       )\\/\\");
      push("output", "                ||----w |");
      push("output", "                ||     ||");
    },
  },
  {
    name: "sl", desc: "steam locomotive (you meant ls?)",
    run: ({ push }) => pushManySafe(push, SL_ART),
  },
  {
    name: "coffee", desc: "brew a tiny coffee",
    run: ({ push }) => pushManySafe(push, [
      "      ( (",
      "       ) )",
      "    ........",
      "    |      |]",
      "    \\      /",
      "     `----'",
      "brew complete: +12 focus",
    ]),
  },
  {
    name: "banner", usage: "<text>", desc: "render block text",
    run: ({ arg, push }) => {
      push("success", `▛ ${arg || "P00RIJA"} ▜`);
      push("success", "▙" + "▄".repeat(Math.min((arg || "P00RIJA").length + 2, 48)) + "▟");
    },
  },
  { name: "fortune", desc: "random security quote", run: ({ push }) => push("output", FORTUNES[Math.floor(Math.random() * FORTUNES.length)]) },
  { name: "8ball", usage: "<question>", desc: "magic 8-ball", run: ({ push }) => push("output", `🎱 ${EIGHTBALL[Math.floor(Math.random() * EIGHTBALL.length)]}`) },
  { name: "dice", usage: "[sides]", desc: "roll a die", run: ({ args, push }) => push("output", `🎲 ${1 + Math.floor(Math.random() * (Number(args[0]) || 6))}`) },
  { name: "coin", desc: "flip a coin", run: ({ push }) => push("output", `🪙 ${Math.random() < 0.5 ? "heads" : "tails"}`) },
  {
    name: "weather", desc: "weather report (simulated)",
    run: ({ push }) => pushManySafe(push, [
      "┌────────────────────────────┐",
      "│  ☀  24°C  ·  feels 23°C    │",
      "│  wind 8 km/h  ·  ☁ 12%     │",
      "│  forecast: 99% chance of   │",
      "│  shipping on Friday        │",
      "└────────────────────────────┘",
    ]),
  },
  {
    name: "neofetch", desc: "show system card",
    run: ({ push }) => pushManySafe(push, [
      "      /\\        root@portfolio",
      "     /  \\       OS: P00RIJA Secure Web",
      "    / /\\ \\      Shell: simulated-zsh",
      "   / ____ \\     UI: React + Three.js",
      "  /_/    \\_\\    Theme: cyber aurora",
    ]),
  },
  {
    name: "ascii", desc: "render images, video, or a live camera with density control",
    run: ({ openScene, push }) => {
      push("success", "> ASCII decoder ready. Media and camera frames stay in your browser.");
      openScene("media");
    },
  },
  ...CREATIVE_COMMANDS,
  {
    name: "lab", desc: "open twelve interactive creative experiments",
    run: ({ openScene, push }) => {
      push("success", "> creative lab online: 12 local experiments, zero server load.");
      openScene("lab", "starfield");
    },
  },
  ...([
    ["starfield", "fly through an interactive warp starfield"],
    ["plasma", "generate a flowing procedural aurora"],
    ["fractal", "explore a zoomable Mandelbrot fractal"],
    ["life", "play Conway's Game of Life"],
    ["particles", "attract and repel a particle field"],
    ["harmonograph", "draw animated Lissajous curves"],
    ["fire", "run an ASCII fire simulation"],
    ["maze", "solve a newly generated maze"],
    ["synth", "play an eight-step Web Audio sequencer"],
    ["typing", "measure typing speed and accuracy"],
  ] satisfies [LabExperiment, string][]).map(([experiment, desc]): CommandDef => ({
    name: experiment,
    desc,
    run: ({ openScene, push }) => {
      push("success", `> launching ${experiment} in the creative lab…`);
      openScene("lab", experiment);
    },
  })),
  {
    name: "chose", desc: "Morpheus offers the blue or red pill",
    run: ({ openScene, push }) => {
      push("success", "> entering the pill protocol…");
      openScene("matrix");
    },
  },
  {
    name: "choose", desc: "alias for chose", hidden: true,
    run: ({ openScene }) => openScene("matrix"),
  },
  {
    name: "red", desc: "take the red pill",
    run: ({ choosePill }) => choosePill("red"),
  },
  {
    name: "blue", desc: "take the blue pill",
    run: ({ choosePill }) => choosePill("blue"),
  },
  {
    name: "resize", usage: "compact|normal|large|full", desc: "resize the terminal window",
    run: ({ resize, arg, push }) => {
      resize(arg || "normal");
      push("muted", `> window geometry: ${arg || "normal"}`);
    },
  },
  {
    name: "fullscreen", desc: "expand the terminal across the entire viewport",
    run: ({ resize, push }) => {
      resize("full");
      push("success", "> fullscreen enabled. Use `resize normal` or the minimize button to return.");
    },
  },
  {
    name: "whoami", desc: "identify the creator of this portfolio",
    run: ({ profile, push, pushMany }) => {
      pushMany("output", [profile.name, `role: ${profile.role}`, `location: ${profile.location}`, `contact: ${profile.email}`]);
      push("muted", "// three worlds, one signature — no privileged server session attached");
    },
  },
  {
    name: "comment", desc: "print a shell-side comment",
    run: ({ push }) => {
      const comments = [
        "// gravity is optional; backups are not.",
        "// CSS is just spells with better documentation.",
        "// 200+ servers hardened; zero coffee machines patched.",
        "// three planets orbit, but the deadlines follow me.",
        "// if (beauty && resilience && intelligence) return P00RIJA;",
        "// the firewall trusts no one — especially my old code.",
      ];
      push("output", comments[Math.floor(Math.random() * comments.length)]);
    },
  },
  {
    name: "quest", desc: "start the three-worlds key hunt",
    run: ({ quest, arg }) => quest("start", arg),
  },
  {
    name: "solve", usage: "<answer>", desc: "submit a quest key",
    run: ({ quest, arg, push }) => {
      if (!arg) return push("error", "usage: solve <answer>");
      quest("solve", arg.toLowerCase());
    },
  },
  {
    name: "p00rija", desc: "creator signature", hidden: true,
    run: ({ push, pushMany }) => {
      pushMany("success", ["  ____  ____  ____  ____  ____", " / P00RIJA // DESIGN·SEC·AI /", " ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾", "signature verified: one creator, three worlds."]);
      try { window.dispatchEvent(new CustomEvent("achieve", { detail: "creator-signature" })); } catch {}
    },
  },
  {
    name: "golden", desc: "golden egg hints", hidden: true,
    run: ({ push, pushMany }) => {
      pushMany("output", ["GOLDEN EGGS:", "  01 — a number hidden in .secret", "  02 — the order of three worlds", "  03 — a signature written in ROT13", "  04 — the year of the first ML model", "Use `quest` and `solve <answer>`."]);
      try { window.dispatchEvent(new CustomEvent("achieve", { detail: "golden-hunter" })); } catch {}
    },
  },
  {
    name: "exit", desc: "logout and reboot",
    run: async ({ push, reboot }) => {
      push("muted", "logout");
      await sleep(450);
      await reboot();
    },
  },
  { name: "logout", desc: "alias for exit", hidden: true, run: () => undefined },
  { name: "cls", desc: "alias for clear", hidden: true, run: ({ clear }) => clear() },
  { name: "ip", desc: "alias for ifconfig (ip a)", hidden: true, run: () => undefined },
  { name: "ss", desc: "alias for netstat", hidden: true, run: () => undefined },
  { name: "vim", desc: "editor (denied)", hidden: true, run: editorRun },
  { name: "emacs", desc: "editor (denied)", hidden: true, run: editorRun },
  { name: "nano", desc: "editor (denied)", hidden: true, run: editorRun },
];

function pushManySafe(push: Ctx["push"], lines: string[]) {
  lines.forEach((l) => push("output", l));
}

const COMMAND_NAMES = COMMANDS.map((c) => c.name);

/* --- component ---------------------------------------------- */

export function InteractiveTerminal() {
  const lang = useContent((s) => s.lang);
  const profileCfg = useContent((s) => s.content.profile);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [cwd, setCwd] = useState(HOME_DIR);
  const [busy, setBusy] = useState(true);
  const [tabHint, setTabHint] = useState<string | null>(null);
  const [asciiScene, setAsciiScene] = useState<"media" | "matrix" | "lab" | null>(null);
  const [matrixPill, setMatrixPill] = useState<"red" | "blue" | null>(null);
  const [labExperiment, setLabExperiment] = useState<LabExperiment>("starfield");
  const [questStage, setQuestStage] = useState(0);
  const [terminalSize, setTerminalSize] = useState<{ width: number | null; height: number }>({ width: null, height: 300 });
  const [isFullScreen, setIsFullScreen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const resizeDragRef = useRef<{ id: number; x: number; y: number; width: number; height: number } | null>(null);
  const runIdRef = useRef(0);
  const runCommandRef = useRef<(cmd: string) => void>(() => {});

  /* ---- line pushers (stable) ------------------------------ */
  const pushLine = useCallback((kind: LineKind, text: string) => {
    setLines((prev) => {
      const next = [...prev, { id: nextId(), kind, text }];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  const pushLines = useCallback((kind: LineKind, texts: string[]) => {
    setLines((prev) => {
      const added = texts.map((t) => ({ id: nextId(), kind, text: t }));
      const next = [...prev, ...added];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  const clearLines = useCallback(() => setLines([]), []);

  const openScene = useCallback((scene: "media" | "matrix" | "lab", experiment: LabExperiment = "starfield") => {
    setMatrixPill(null);
    setLabExperiment(experiment);
    setAsciiScene(scene);
  }, []);

  const choosePill = useCallback((pill: "red" | "blue") => {
    if (asciiScene !== "matrix") {
      pushLine("error", "no active pill protocol. Type `chose` first.");
      return;
    }
    setMatrixPill(pill);
  }, [asciiScene, pushLine]);

  const resizeTerminal = useCallback((preset: string) => {
    setIsFullScreen(preset === "full");
    if (preset === "compact") setTerminalSize({ width: 540, height: 260 });
    else if (preset === "large") setTerminalSize({ width: 1040, height: 540 });
    else if (preset === "full") setTerminalSize({ width: null, height: window.innerHeight });
    else setTerminalSize({ width: null, height: 340 });
  }, []);

  const toggleFullScreen = useCallback(() => setIsFullScreen((value) => !value), []);

  useEffect(() => {
    if (!isFullScreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isFullScreen]);

  const runQuest = useCallback((action: "start" | "solve", answer = "") => {
    const clues = [
      "KEY 01/04 — the number hidden in .secret. Use `cat .secret`, then `solve <number>`.",
      "KEY 02/04 — order the worlds: design → Linux security → artificial intelligence. `solve design-linux-ai`.",
      "KEY 03/04 — ROT13 of the creator signature P00RIJA (digits stay unchanged). `solve <rot13>`.",
      "KEY 04/04 — the year of the first machine-learning model in the résumé. `solve <year>`.",
    ];
    if (action === "start") {
      if (answer === "reset") setQuestStage(0);
      const stage = answer === "reset" ? 0 : questStage;
      if (stage >= 4) return pushLine("success", "QUEST COMPLETE — the three-worlds key is already yours. `quest reset` to replay.");
      pushLine("success", `THREE-WORLDS QUEST\n${clues[stage]}`);
      return;
    }
    const expected = ["42", "design-linux-ai", "c00ewvn", "2023"];
    if (answer !== expected[questStage]) {
      pushLine("error", `ACCESS DENIED — key ${questStage + 1} does not match. Use \`quest\` to read the clue again.`);
      return;
    }
    const next = questStage + 1;
    setQuestStage(next);
    if (next < 4) {
      pushLine("success", `KEY ACCEPTED.\n${clues[next]}`);
      return;
    }
    pushLines("success", [
      "  .------------------------.",
      "  | THREE WORLDS UNLOCKED |",
      "  '------------------------'",
      "  DESIGN + SECURITY + AI = P00RIJA",
      "  golden key accepted. Welcome, creator.",
    ]);
    try { window.dispatchEvent(new CustomEvent("achieve", { detail: "golden-p00rija" })); } catch {}
  }, [pushLine, pushLines, questStage]);

  /* ---- boot sequence -------------------------------------- */
  const runBoot = useCallback(async () => {
    const runId = ++runIdRef.current;
    const msg = lang === "fa" ? BOOT_MESSAGES.fa : BOOT_MESSAGES.en;
    setBusy(true);
    setLines([]);

    pushLine("system", msg.init);
    await sleep(280);
    if (runId !== runIdRef.current) return;
    pushLine("system", msg.connected);
    await sleep(220);
    if (runId !== runIdRef.current) return;
    pushLine("system", msg.info);

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const platform =
      typeof navigator !== "undefined" && "platform" in navigator
        ? String((navigator as Navigator & { platform?: string }).platform ?? "")
        : "";
    const navigatorLang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    const sw = typeof screen !== "undefined" ? screen.width : 0;
    const sh = typeof screen !== "undefined" ? screen.height : 0;
    const vw = typeof window !== "undefined" ? window.innerWidth : 0;
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    let tz = "UTC";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      tz = "UTC";
    }
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 0 : 0;
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;

    const info = [
      `  ${msg.browser}:  ${detectBrowser(ua)}`,
      `  ${msg.os}:  ${detectOS(ua, platform)}`,
      `  ${msg.language}: ${navigatorLang}`,
      `  ${msg.screen}:   ${sw}x${sh}`,
      `  ${msg.viewport}: ${vw}x${vh}`,
      `  ${msg.timezone}: ${tz}`,
      `  ${msg.cores}:    ${cores}`,
      `  ${msg.online}:   ${lang === "fa" ? (online ? msg.yes : msg.no) : String(online)}`,
    ];
    for (const line of info) {
      if (runId !== runIdRef.current) return;
      await sleep(70);
      pushLine("muted", line);
    }
    if (runId !== runIdRef.current) return;
    await sleep(220);
    pushLine("system", msg.session);
    await sleep(180);
    pushLine("muted", msg.hint);
    pushLine("muted", "// ascii decoder · pill protocol · three-worlds quest · harmless comments only");
    await sleep(120);
    if (runId !== runIdRef.current) return;
    setBusy(false);
  }, [pushLine, lang]);

  /* ---- command interpreter -------------------------------- */
  const runCommand = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      pushLine("input", `root@portfolio:${promptPath(cwd)}$ ${trimmed}`);

      if (!trimmed) return;

      const runId = ++runIdRef.current;
      const isAlive = () => runId === runIdRef.current;
      const parts = trimmed.split(/\s+/);
      const cmd = (parts[0] ?? "").toLowerCase();
      const args = parts.slice(1);
      const arg = args.join(" ");

      /* --- full-line easter eggs --- */
      const lower = trimmed.toLowerCase();
      if (lower === "sudo rm -rf /" || lower === "sudo rm -rf /*" || lower === "rm -rf /") {
        pushLine("error", "😂 Nice try. This is a portfolio, not a production server.");
        return;
      }

      const def = COMMANDS.find((c) => c.name === cmd);
      if (!def) {
        pushLine("error", `command not found: ${cmd}. Type 'help' for available commands.`);
        return;
      }
      if (def.name === "logout") {
        pushLine("muted", "logout");
        await sleep(450);
        if (!isAlive()) return;
        void runBoot();
        return;
      }
      if (def.name === "clear" || def.name === "cls") {
        setLines([]);
        return;
      }
      if (def.name === "ip" && args[0] !== "a" && args[0] !== "addr") {
        pushLine("muted", "usage: ip a");
        return;
      }

      const ctx: Ctx = {
        lang,
        cwd,
        setCwd,
        args,
        arg,
        clear: clearLines,
        reboot: runBoot,
        push: pushLine,
        pushMany: pushLines,
        isAlive,
        history,
        openScene,
        choosePill,
        resize: resizeTerminal,
        quest: runQuest,
        profile: {
          name: profileCfg?.name || "P00RIJA",
          role: profileCfg?.role || "Designer × Security engineer × AI developer",
          email: profileCfg?.email || "p00rija@tutamail.com",
          location: profileCfg?.location || "Tehran, Iran",
        },
      };
      await def.run(ctx);
    },
    [cwd, history, lang, pushLine, pushLines, runBoot, clearLines, openScene, choosePill, resizeTerminal, runQuest, profileCfg]
  );

  /* ---- effects -------------------------------------------- */

  // boot on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void runBoot();
    });
    return () => cancelAnimationFrame(id);
  }, [runBoot]);

  // keep latest runCommand for external triggers
  useEffect(() => {
    runCommandRef.current = runCommand;
  }, [runCommand]);

  // konami code: up up down down left right left right b a
  useEffect(() => {
    const seq = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
    ];
    let pos = 0;
    const handler = (e: KeyboardEvent) => {
      const expected = seq[pos];
      const key = e.key;
      const matches =
        key === expected ||
        (expected.length === 1 && key.toLowerCase() === expected.toLowerCase());
      if (matches) {
        pos++;
        if (pos === seq.length) {
          pos = 0;
          toast.success("🎮 KONAMI!", { description: lang === "fa" ? "ورود به ماتریکس…" : "Entering the matrix..." });
          runCommandRef.current("matrix");
        }
      } else {
        pos =
          key === seq[0] ||
          (seq[0].length === 1 && key.toLowerCase() === seq[0].toLowerCase())
            ? 1
            : 0;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lang]);

  // auto-scroll output to bottom on new lines
  useEffect(() => {
    if (outRef.current) {
      outRef.current.scrollTop = outRef.current.scrollHeight;
    }
  }, [lines, tabHint]);

  // keep input focused when idle (preventScroll to avoid auto-scrolling on page load)
  useEffect(() => {
    if (!busy) inputRef.current?.focus({ preventScroll: true });
  }, [busy]);

  /* ---- handlers ------------------------------------------- */

  const submitCommand = () => {
    if (busy) return;
    const cmd = input;
    setInput("");
    setHistIdx(-1);
    setTabHint(null);
    if (cmd.trim()) {
      setHistory((h) => [...h, cmd]);
    }
    void runCommand(cmd);
  };

  const complete = () => {
    const parts = input.split(/\s+/);
    const last = parts[parts.length - 1] ?? "";
    if (!last) return;
    const matches = COMMAND_NAMES.filter((n) => n.startsWith(last.toLowerCase()));
    if (matches.length === 1) {
      parts[parts.length - 1] = matches[0] + " ";
      setInput(parts.join(" "));
      setTabHint(null);
    } else if (matches.length > 1) {
      setTabHint(matches.join("  "));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitCommand();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitCommand();
    } else if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const newIdx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(newIdx);
      setInput(history[newIdx] ?? "");
      setTabHint(null);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const newIdx = histIdx + 1;
      if (newIdx >= history.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(newIdx);
        setInput(history[newIdx] ?? "");
      }
      setTabHint(null);
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setLines([]);
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      if (input.trim()) {
        pushLine("input", `root@portfolio:${promptPath(cwd)}$ ${input}^C`);
      }
      setInput("");
      setHistIdx(-1);
      setTabHint(null);
    }
  };

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const rect = terminalRef.current?.getBoundingClientRect();
    if (!rect) return;
    resizeDragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* window listeners are unnecessary for normal pointers */ }
  };
  const dragResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    event.stopPropagation();
    setTerminalSize({
      width: Math.round(Math.max(320, Math.min(window.innerWidth - 32, drag.width + event.clientX - drag.x))),
      height: Math.round(Math.max(220, Math.min(window.innerHeight - 32, drag.height + event.clientY - drag.y))),
    });
  };
  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeDragRef.current?.id === event.pointerId) resizeDragRef.current = null;
  };
  const keyResize = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    setTerminalSize((size) => ({
      width: event.key === "ArrowLeft" || event.key === "ArrowRight"
        ? Math.max(320, Math.min(window.innerWidth - 32, (size.width ?? terminalRef.current?.clientWidth ?? 720) + (event.key === "ArrowRight" ? 32 : -32)))
        : size.width,
      height: Math.max(220, Math.min(window.innerHeight - 32, size.height + (event.key === "ArrowDown" ? 32 : event.key === "ArrowUp" ? -32 : 0))),
    }));
  };

  const prompt = `root@portfolio:${promptPath(cwd)}$`;
  const commandCount = useMemo(() => COMMANDS.filter((c) => !c.hidden).length, []);

  /* ---- render --------------------------------------------- */

  const terminal = (
    <div
      ref={terminalRef}
      data-interactive-terminal
      className={isFullScreen ? "fixed inset-0 z-[240] flex flex-col overflow-hidden border-0 bg-[#010504]" : "relative mx-auto flex flex-col overflow-hidden rounded-2xl border border-border bg-[oklch(0.1_0.02_165/0.92)] backdrop-blur"}
      style={isFullScreen ? { width: "100vw", height: "100dvh", maxWidth: "none" } : { boxShadow: "0 0 60px -20px var(--sec-glow)", width: terminalSize.width ?? "100%", height: terminalSize.height, maxWidth: "100%" }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-red-400/70" />
        <span className="h-3 w-3 rounded-full bg-amber-400/70" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
        <span className="mr-auto flex items-center gap-2 font-mono text-[10px] text-white/50">
          <TerminalIcon className="h-3 w-3" />
          root@portfolio:~ · {commandCount} cmds · TAB
        </span>
        <button type="button" onClick={(event) => { event.stopPropagation(); toggleFullScreen(); }} className="grid size-7 place-items-center rounded border border-white/10 text-white/50 hover:bg-white/5 hover:text-white" aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"} title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}>
          {isFullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>

      <div
        ref={outRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed no-scrollbar"
        dir="ltr"
        data-lenis-prevent
      >
        {lines.map((l) => (
          <LineView key={l.id} line={l} />
        ))}

        {tabHint && (
          <div className="whitespace-pre-wrap break-words text-white/40">{tabHint}</div>
        )}

        <form onSubmit={onSubmit} className="flex items-center gap-1.5" autoComplete="off">
          <span
            style={{ color: "var(--sec-1)" }}
            className="shrink-0 whitespace-pre"
          >
            {prompt}{" "}
          </span>
          <div className="relative flex min-h-[1em] flex-1 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={busy}
              aria-label={lang === "fa" ? "ورودی پایانه" : "Terminal input"}
              className="absolute inset-0 w-full bg-transparent font-mono text-xs text-transparent outline-none"
              style={{ caretColor: "transparent" }}
            />
            <div
              className="pointer-events-none select-none whitespace-pre font-mono text-xs leading-relaxed text-white/90"
              aria-hidden
            >
              {input}
              {!busy && (
                <span
                  className="ml-px inline-block h-3 w-[7px] animate-blink align-middle"
                  style={{ background: "var(--sec-1)" }}
                />
              )}
            </div>
          </div>
        </form>
      </div>
      {asciiScene === "media" && <AsciiMediaPlayer lang={lang} onClose={() => setAsciiScene(null)} />}
      {asciiScene === "matrix" && <MatrixChoiceScene lang={lang} pill={matrixPill} onChoose={setMatrixPill} onClose={() => { setAsciiScene(null); setMatrixPill(null); }} />}
      {asciiScene === "lab" && <CreativeLab initialExperiment={labExperiment} onClose={() => setAsciiScene(null)} />}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={lang === "fa" ? "تغییر اندازه ترمینال" : "Resize terminal"}
        tabIndex={0}
        onPointerDown={beginResize}
        onPointerMove={dragResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={keyResize}
        className="absolute bottom-0 end-0 z-20 grid size-5 cursor-nwse-resize place-items-center text-white/35 outline-none hover:text-white/80 focus:text-white/80"
      >
        <span className="font-mono text-sm">↘</span>
      </div>
    </div>
  );

  return isFullScreen && typeof document !== "undefined" ? createPortal(terminal, document.body) : terminal;
}

/* --- line renderer ----------------------------------------- */

function LineView({ line }: { line: Line }) {
  let color = "rgba(255,255,255,0.85)";
  switch (line.kind) {
    case "input":
      color = "var(--sec-1)";
      break;
    case "output":
      color = "color-mix(in oklch, var(--sec-1) 88%, white 12%)";
      break;
    case "system":
      color = "color-mix(in oklch, var(--sec-1) 70%, transparent)";
      break;
    case "muted":
      color = "rgba(255,255,255,0.45)";
      break;
    case "error":
      color = "#f87171";
      break;
    case "success":
      color = "var(--sec-1)";
      break;
  }
  return (
    <div className="whitespace-pre-wrap break-words" style={{ color }}>
      {line.text === "" ? "\u00A0" : line.text}
    </div>
  );
}
