// CMS defense center API — all auth-guarded.
// GET  /api/defense                 → settings + stats + recent threats + bans
// PUT  /api/defense                 → update settings (partial patch)
// POST /api/defense                 → actions: { op: "unban"|"ban"|"clear-threats"|"test", ... }

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  readState,
  updateSettings,
  clearThreats,
  unbanIp,
  banIp,
  classify,
  DEFAULT_SETTINGS,
  type DefenseMode,
  type DefenseSettings,
} from "@/lib/defense";

const MODES: DefenseMode[] = ["off", "log", "balanced", "strict"];

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const state = await readState();
    const now = Date.now();

    // prune expired bans from the view (and lazily from state)
    const activeBans = Object.entries(state.bans)
      .filter(([, until]) => until > now)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([ip, until]) => ({ ip, until }));

    const threats = state.threats.slice(-120).reverse();
    const blockedToday = state.threats.filter(
      (t) => t.action === "blocked" && now - t.at < 24 * 3600 * 1000
    );
    const byRule = new Map<string, number>();
    for (const t of blockedToday) byRule.set(t.rule, (byRule.get(t.rule) ?? 0) + 1);
    const topAttackers = new Map<string, number>();
    for (const t of state.threats) {
      if (t.action === "blocked") topAttackers.set(t.ip, (topAttackers.get(t.ip) ?? 0) + 1);
    }

    return NextResponse.json({
      ok: true,
      settings: state.settings,
      stats: {
        blockedToday: blockedToday.length,
        loggedToday: state.threats.filter((t) => t.action !== "blocked" && now - t.at < 24 * 3600 * 1000).length,
        activeBans: Object.values(state.bans).filter((until) => until > now).length,
        totalEvents: state.threats.length,
        byRule: Array.from(byRule.entries()).map(([name, value]) => ({ name, value })),
        topAttackers: Array.from(topAttackers.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ip, value]) => ({ ip, value })),
      },
      bans: activeBans,
      threats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as Partial<DefenseSettings> | null;
    if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

    const patch: Partial<DefenseSettings> = {};
    if (typeof body.mode === "string" && MODES.includes(body.mode as DefenseMode)) {
      patch.mode = body.mode as DefenseMode;
    }
    if (body.rateLimitPerMin !== undefined) {
      const n = Number(body.rateLimitPerMin);
      if (Number.isFinite(n)) patch.rateLimitPerMin = Math.min(6000, Math.max(10, Math.round(n)));
    }
    if (body.rateBanMinutes !== undefined) {
      const n = Number(body.rateBanMinutes);
      if (Number.isFinite(n)) patch.rateBanMinutes = Math.min(1440, Math.max(1, Math.round(n)));
    }
    if (typeof body.blockBadBots === "boolean") patch.blockBadBots = body.blockBadBots;
    if (typeof body.blockSensitivePaths === "boolean") patch.blockSensitivePaths = body.blockSensitivePaths;
    if (Array.isArray(body.blocklist)) {
      patch.blocklist = body.blocklist
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => /^(\d{1,3}\.){3}\d{1,3}$|[a-f0-9:]+:+[a-f0-9]+$/i.test(v) && v.length <= 45)
        .slice(0, 500);
    }
    if (Array.isArray(body.allowlist)) {
      patch.allowlist = body.allowlist
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => /^(\d{1,3}\.){3}\d{1,3}$|[a-f0-9:]+:+[a-f0-9]+$/i.test(v) && v.length <= 45)
        .slice(0, 500);
    }

    const settings = await updateSettings(patch);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as
      | { op?: string; ip?: string; minutes?: number; ua?: string; path?: string }
      | null;
    if (!body?.op) return NextResponse.json({ ok: false, error: "Missing op" }, { status: 400 });

    switch (body.op) {
      case "ban": {
        if (!body.ip || !/^(\d{1,3}\.){3}\d{1,3}$|[a-f0-9:]+:+[a-f0-9]+$/i.test(body.ip)) {
          return NextResponse.json({ ok: false, error: "Invalid IP" }, { status: 400 });
        }
        const minutes = Math.min(1440, Math.max(1, Number(body.minutes) || 60));
        await banIp(body.ip, minutes, "manual", body.ua ?? "", body.path ?? "");
        const state = await readState();
        const settings = state.settings;
        return NextResponse.json({ ok: true, settings: settings ?? DEFAULT_SETTINGS });
      }
      case "unban": {
        if (!body.ip) return NextResponse.json({ ok: false, error: "Missing ip" }, { status: 400 });
        const removed = await unbanIp(body.ip);
        return NextResponse.json({ ok: true, removed });
      }
      case "clear-threats": {
        await clearThreats();
        return NextResponse.json({ ok: true });
      }
      case "test": {
        // dry-run the classifier against a sample request (great for learning rules)
        const state = await readState();
        const verdict = classify(
          body.ip || "203.0.113.9",
          body.ua || "sqlmap/1.8",
          `GET ${body.path || "/.env"}`,
          state.settings,
          state.bans
        );
        return NextResponse.json({ ok: true, verdict });
      }
      default:
        return NextResponse.json({ ok: false, error: "Unknown op" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
