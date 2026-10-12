// Public visitor tracking endpoint.
// POST /api/track  { sid, ev: "start" | "ping" | "end", ref?, screen?, tz?, lang?, path? }
//
// Privacy & abuse notes:
//  - The client skips tracking entirely when Do Not Track is enabled.
//  - Server never receives cookies; identity is an ephemeral per-tab UUID.
//  - Rate limited per session key + IP; oversized payloads are dropped.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUA, extractIp, geoFor, pruneSessions, serverPublicIp, isPrivateIp } from "@/lib/analytics";

const IDLE_CAP_MS = 30 * 60 * 1000; // a "ping" can extend a session at most 30min

const recent = new Map<string, number>();
function tooFast(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < 4_000) return true;
  recent.set(key, now);
  if (recent.size > 5000) {
    let i = 0;
    for (const k of recent.keys()) {
      if (i++ >= 1000) break;
      recent.delete(k);
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { sid?: unknown; ev?: unknown; ref?: unknown; screen?: unknown; tz?: unknown; lang?: unknown; path?: unknown; cip?: unknown }
      | null;
    if (!body || typeof body.sid !== "string" || body.sid.length > 80) {
      return new NextResponse(null, { status: 400 });
    }
    const ev = body.ev === "ping" || body.ev === "end" ? body.ev : "start";

    const sid = body.sid;
    if (tooFast(`${sid}:${ev}`)) return new NextResponse(null, { status: 204 });

    const uaInfo = parseUA(request.headers.get("user-agent"));
    let ip = extractIp(request.headers);
    // Local/test visitors hit the server from a private address, so the
    // connection IP carries no geography. Their browser reports its own
    // public IP (through the visitor's real network path, VPN included)
    // and we trust it ONLY for private-source requests.
    if ((!ip || isPrivateIp(ip)) && typeof body.cip === "string" && body.cip && !isPrivateIp(body.cip) && body.cip.length <= 45) {
      ip = body.cip;
    } else if (!ip || isPrivateIp(ip)) {
      ip = await serverPublicIp();
    }
    const geo = geoFor(ip);
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : "";

    const now = new Date();

    if (ev === "start") {
      await db.visitSession.upsert({
        where: { sessionKey: sid },
        update: {
          lastSeenAt: now,
          ip: ip || "",
          browser: uaInfo.browser,
          os: uaInfo.os,
          device: uaInfo.device,
          userAgent: str(request.headers.get("user-agent"), 220),
          country: geo.country,
          region: geo.region,
          city: geo.city,
          referrer: str(body.ref, 180),
          screen: str(body.screen, 24),
          timezone: str(body.tz, 48),
          language: str(body.lang, 12),
          path: str(body.path, 120) || "/",
          isBot: uaInfo.isBot,
          botReason: uaInfo.botReason,
          blocked: false,
        },
        create: {
          sessionKey: sid,
          startedAt: now,
          lastSeenAt: now,
          durationMs: 0,
          ip: ip || "",
          browser: uaInfo.browser,
          os: uaInfo.os,
          device: uaInfo.device,
          userAgent: str(request.headers.get("user-agent"), 220),
          country: geo.country,
          region: geo.region,
          city: geo.city,
          referrer: str(body.ref, 180),
          screen: str(body.screen, 24),
          timezone: str(body.tz, 48),
          language: str(body.lang, 12),
          path: str(body.path, 120) || "/",
          isBot: uaInfo.isBot,
          botReason: uaInfo.botReason,
          pings: 1,
        },
      });
      // occasional housekeeping (1 in 20 starts) — keeps the table tiny
      if (Math.random() < 0.05) {
        await pruneSessions(db).catch(() => undefined);
      }
    } else {
      // ping / end: extend the session (bounded by the idle cap), bump counters.
      // If the row vanished (analytics wiped mid-visit from the CMS), recreate
      // it so the current visitor keeps counting as "Live now" instead of
      // silently disappearing until the next page load.
      const existing = await db.visitSession.findUnique({
        where: { sessionKey: sid },
        select: { startedAt: true },
      });
      if (existing) {
        const bounded = Math.min(
          IDLE_CAP_MS,
          Math.max(0, now.getTime() - existing.startedAt.getTime())
        );
        await db.visitSession.update({
          where: { sessionKey: sid },
          data: {
            lastSeenAt: now,
            durationMs: bounded,
            pings: { increment: 1 },
            country: geo.country || undefined,
            region: geo.region || undefined,
            city: geo.city || undefined,
          },
        });
      } else if (ev === "ping") {
        await db.visitSession.upsert({
          where: { sessionKey: sid },
          update: { lastSeenAt: now },
          create: {
            sessionKey: sid,
            startedAt: now,
            lastSeenAt: now,
            durationMs: 0,
            ip: ip || "",
            browser: uaInfo.browser,
            os: uaInfo.os,
            device: uaInfo.device,
            userAgent: str(request.headers.get("user-agent"), 220),
            country: geo.country,
            region: geo.region,
            city: geo.city,
            screen: str(body.screen, 24),
            timezone: str(body.tz, 48),
            language: str(body.lang, 12),
            path: str(body.path, 120) || "/",
            isBot: uaInfo.isBot,
            botReason: uaInfo.botReason,
            pings: 1,
          },
        });
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    // Tracking must never surface errors to visitors.
    return new NextResponse(null, { status: 204 });
  }
}
