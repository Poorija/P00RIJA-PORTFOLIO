#!/usr/bin/env node
// ============================================================
// P00RIJA License CLI — vendor-side tooling (run on YOUR machine).
//
//   node scripts/license-cli.mjs keygen
//        → prints LICENSE_AES_KEY + LICENSE_SIGN keys (store safely!)
//
//   node scripts/license-cli.mjs create --licensee "Acme" \
//        --plan annual --devices 2 --uses 100000 \
//        --server-url http://licenses.example.com --server-port 7800 \
//        --out acme.lic [--expires 2027-01-01] [--notes "..."] [--features a,b]
//
//   node scripts/license-cli.mjs list
//   node scripts/license-cli.mjs show    --license-id P00-…
//   node scripts/license-cli.mjs revoke|suspend|activate --license-id P00-…
//   node scripts/license-cli.mjs extend  --license-id P00-… --months 3
//   node scripts/license-cli.mjs set     --license-id P00-… [--devices 3] [--uses 5000] [--expires 2027-06-01|none] [--licensee "…"]
//   node scripts/license-cli.mjs reset-devices --license-id P00-…
//
// Admin commands talk to the license server using:
//   LICENSE_ADMIN_URL (http://host:port) + LICENSE_ADMIN_TOKEN env vars.
// File creation needs LICENSE_AES_KEY + LICENSE_SIGN_PRIVKEY (keygen output).
// ============================================================

import {
  createCipheriv, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign as edSign,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const cmd = args[0];
const get = (name) => {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const need = (value, name) => {
  if (value === undefined || value === "") {
    console.error(`ERROR: --${name} is required (or set the corresponding env var).`);
    process.exit(1);
  }
  return value;
};

const b64 = (buf) => buf.toString("base64url");

function fatal(message) {
  console.error("ERROR:", message);
  process.exit(1);
}

// ── keygen ───────────────────────────────────────────────────────────────────
function keygen() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privHex = privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32).toString("hex"); // last 32 bytes = raw seed
  const pubHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
  const aes = randomBytes(32).toString("hex");
  console.log(`
══════════════════════════════════════════════════════════════
  KEEP THESE SECRET — they are the root of your license system.
══════════════════════════════════════════════════════════════

# 1) Baked into EVERY SOLD image (env of the app container):
LICENSE_AES_KEY=${aes}
LICENSE_SIGN_PUBKEY=${pubHex}

# 2) ONLY on your machine — never leave this machine/repo:
LICENSE_SIGN_PRIVKEY=${privHex}

# 3) License server admin (dashboard + CLI admin commands):
#    set ADMIN_TOKEN in license-server.config.json / compose env
`);
}

// ── create a license file ────────────────────────────────────────────────────
function createLicense() {
  const aesHex = process.env.LICENSE_AES_KEY;
  const privHex = process.env.LICENSE_SIGN_PRIVKEY;
  if (!aesHex || !privHex) fatal("Set LICENSE_AES_KEY and LICENSE_SIGN_PRIVKEY (see `keygen`).");

  const licensee = get("licensee") || "";
  const plan = get("plan") || "custom";
  const devices = Number(get("devices") ?? 1);
  const uses = get("uses");
  const serverUrl = need(get("server-url"), "server-url");
  const serverPort = Number(get("server-port") ?? 7800);
  const out = need(get("out"), "out");
  const notes = get("notes") || "";
  const features = (get("features") || "*").split(",").map((f) => f.trim()).filter(Boolean);

  let expiresAt = null;
  if (get("expires")) {
    expiresAt = new Date(get("expires")).toISOString();
  } else {
    const months = Number(get("months") ?? { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[plan] ?? 0);
    if (months > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      expiresAt = d.toISOString();
    }
  }

  const raw = randomBytes(6).toString("hex").toUpperCase();
  const licenseId = get("license-id") || `P00-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;

  const payload = {
    licenseId,
    licensee,
    plan,
    issuedAt: new Date().toISOString(),
    expiresAt,
    deviceLimit: Math.max(1, devices),
    usageLimit: uses == null ? null : Number(uses),
    features,
    server: { url: serverUrl, port: serverPort, heartbeatMinutes: Number(get("heartbeat-minutes") ?? 10) },
    notes,
  };
  const payloadJson = JSON.stringify(payload);

  // Ed25519 signature over the exact ciphertext bytes.
  const aesKey = Buffer.from(aesHex.trim(), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const ct = Buffer.concat([cipher.update(payloadJson, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const privKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(privHex.trim(), "hex"),
    ]),
    type: "pkcs8",
    format: "der",
  });
  const sig = edSign(null, ct, privKey);

  const file = JSON.stringify(
    { v: 1, alg: "AES-256-GCM+Ed25519", iv: b64(iv), ct: b64(ct), tag: b64(tag), sig: b64(sig) },
    null,
    2
  );
  writeFileSync(out, file + "\n");

  console.log(`✔ license file written: ${out}
  licenseId   : ${licenseId}
  licensee    : ${licensee || "(none)"}
  plan        : ${plan}${expiresAt ? `\n  expiresAt   : ${expiresAt}` : "\n  expiresAt   : never"}
  deviceLimit : ${devices}
  usageLimit  : ${uses == null ? "unlimited" : uses}
  server      : ${serverUrl}:${serverPort}

IMPORTANT: also register this license on the license server (dashboard →
"+ لایسنس جدید" with the SAME id "${licenseId}", or set --license-id there,
or use admin API). The file alone is not enough — the server must know it.`);
}

// ── admin API helpers ────────────────────────────────────────────────────────
function adminBase() {
  const base = process.env.LICENSE_ADMIN_URL;
  const token = process.env.LICENSE_ADMIN_TOKEN;
  if (!base || !token) fatal("Set LICENSE_ADMIN_URL (http://host:port) and LICENSE_ADMIN_TOKEN.");
  return { base: base.replace(/\/+$/, ""), token };
}

async function adminCall(path, init = {}) {
  const { base, token } = adminBase();
  const res = await fetch(base + "/admin/api" + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) fatal(json.error || `HTTP ${res.status}`);
  return json;
}

async function adminMain() {
  const sub = cmd;
  const id = get("license-id");
  if (sub === "list") {
    const { licenses } = await adminCall("/licenses");
    console.table(
      licenses.map((l) => ({
        licenseId: l.licenseId,
        licensee: l.licensee,
        plan: l.plan,
        status: l.status,
        expiresAt: l.expiresAt || "∞",
        devices: (l.devices || []).length + "/" + l.deviceLimit,
        usage: (l.usageCount || 0) + (l.usageLimit != null ? "/" + l.usageLimit : ""),
        lastHeartbeat: l.lastHeartbeatAt || "—",
      }))
    );
    return;
  }
  if (!id) fatal("--license-id is required for this command.");
  if (["revoke", "suspend", "activate"].includes(sub)) {
    const { license } = await adminCall(`/licenses/${encodeURIComponent(id)}/${sub}`, { method: "POST" });
    console.log(`✔ ${license.licenseId} → ${license.status}`);
  } else if (sub === "extend") {
    const months = Number(need(get("months"), "months"));
    const { license } = await adminCall(`/licenses/${encodeURIComponent(id)}/extend`, {
      method: "POST",
      body: JSON.stringify({ months, reactivate: true }),
    });
    console.log(`✔ extended → expiresAt: ${license.expiresAt}`);
  } else if (sub === "reset-devices") {
    const { license } = await adminCall(`/licenses/${encodeURIComponent(id)}/reset-devices`, { method: "POST" });
    console.log(`✔ devices reset (was ${(license.devices || []).length}).`);
  } else if (sub === "set") {
    const body = {};
    if (get("licensee") !== undefined) body.licensee = get("licensee");
    if (get("devices") !== undefined) body.deviceLimit = Number(get("devices"));
    if (get("uses") !== undefined) body.usageLimit = Number(get("uses"));
    if (get("usage-count") !== undefined) body.usageCount = Number(get("usage-count"));
    if (get("expires") !== undefined) body.expiresAt = get("expires") === "none" ? null : new Date(get("expires")).toISOString();
    if (get("notes") !== undefined) body.notes = get("notes");
    if (get("status") !== undefined) body.status = get("status");
    const { license } = await adminCall(`/licenses/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
    console.log("✔ updated:", JSON.stringify(license, null, 2));
  } else if (sub === "show") {
    const { licenses } = await adminCall("/licenses");
    const license = licenses.find((l) => l.licenseId === id);
    if (!license) fatal("not found");
    console.log(JSON.stringify(license, null, 2));
  } else {
    fatal(`unknown command "${sub}" — try keygen | create | list | show | revoke | suspend | activate | extend | set | reset-devices`);
  }
}

// ── dispatch ─────────────────────────────────────────────────────────────────
if (cmd === "keygen") keygen();
else if (cmd === "create") createLicense();
else adminMain().catch((e) => fatal(e.message));
