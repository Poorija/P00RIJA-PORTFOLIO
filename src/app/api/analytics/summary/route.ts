// CMS analytics — summary dashboard data. Auth required.
// GET /api/analytics/summary → totals, timeseries, referrers, browsers, devices, countries, live sessions

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { getServerGeo } from "@/lib/analytics";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    const dayAgo = new Date(now - 24 * 3600 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 3600 * 1000);
    const liveCutoff = new Date(now - 2 * 60 * 1000);

    const [totalHuman, totalBot, today, week, month, live, recent] = await Promise.all([
      db.visitSession.count({ where: { isBot: false } }),
      db.visitSession.count({ where: { isBot: true } }),
      db.visitSession.count({ where: { isBot: false, startedAt: { gte: dayAgo } } }),
      db.visitSession.count({ where: { isBot: false, startedAt: { gte: weekAgo } } }),
      db.visitSession.count({ where: { isBot: false, startedAt: { gte: monthAgo } } }),
      db.visitSession.findMany({
        where: { lastSeenAt: { gte: liveCutoff } },
        select: {
          sessionKey: true, startedAt: true, lastSeenAt: true, durationMs: true,
          ip: true, browser: true, os: true, device: true, country: true, city: true,
          path: true, isBot: true, language: true,
        },
        orderBy: { lastSeenAt: "desc" },
        take: 50,
      }),
      db.visitSession.findMany({
        where: { isBot: false, startedAt: { gte: monthAgo } },
        select: { startedAt: true, durationMs: true, browser: true, os: true, device: true, country: true, referrer: true },
      }),
    ]);

    // 30-day timeseries (visits + avg duration per day)
    const perDay = new Map<string, { visits: number; durationSum: number }>();
    for (let i = 29; i >= 0; i--) {
      perDay.set(dayKey(new Date(now - i * 24 * 3600 * 1000)), { visits: 0, durationSum: 0 });
    }
    const counter = new Map<string, number>();
    let durationTotal = 0;
    let durationSamples = 0;
    for (const s of recent) {
      const key = dayKey(s.startedAt);
      const bucket = perDay.get(key);
      if (bucket) {
        bucket.visits += 1;
        bucket.durationSum += s.durationMs;
      }
      durationTotal += s.durationMs;
      durationSamples += 1;

      if (s.browser) counter.set("b:" + s.browser, (counter.get("b:" + s.browser) ?? 0) + 1);
      if (s.os) counter.set("o:" + s.os, (counter.get("o:" + s.os) ?? 0) + 1);
      if (s.device) counter.set("d:" + s.device, (counter.get("d:" + s.device) ?? 0) + 1);
      if (s.country) counter.set("c:" + s.country, (counter.get("c:" + s.country) ?? 0) + 1);
      const ref = s.referrer ? safeHost(s.referrer) : "(direct)";
      counter.set("r:" + ref, (counter.get("r:" + ref) ?? 0) + 1);
    }

    const top = (prefix: string, n: number) =>
      Array.from(counter.entries())
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => ({ name: k.slice(prefix.length), value: v }))
        .sort((a, b) => b.value - a.value)
        .slice(0, n);

    const timeseries = Array.from(perDay.entries()).map(([date, v]) => ({
      date,
      visits: v.visits,
      avgMinutes: v.visits ? Math.round(v.durationSum / v.visits / 60000 * 10) / 10 : 0,
    }));

    const durationBuckets = [
      { name: "0-15s", value: 0 }, { name: "15-60s", value: 0 },
      { name: "1-5m", value: 0 }, { name: "5m+", value: 0 },
    ];
    for (const s of recent) {
      const sec = s.durationMs / 1000;
      if (sec < 15) durationBuckets[0].value++;
      else if (sec < 60) durationBuckets[1].value++;
      else if (sec < 300) durationBuckets[2].value++;
      else durationBuckets[3].value++;
    }

    // Where the app itself is running (public-IP geolocation, 24h cached).
    // Best-effort and non-blocking for the rest of the payload.
    const serverGeo = await getServerGeo().catch(() => null);

    return NextResponse.json({
      ok: true,
      server: serverGeo
        ? {
            ip: serverGeo.ip,
            country: serverGeo.country,
            region: serverGeo.region,
            city: serverGeo.city,
            lat: serverGeo.lat,
            lon: serverGeo.lon,
          }
        : null,
      totals: {
        human: totalHuman,
        bots: totalBot,
        today,
        week,
        month,
        live: live.length,
        avgMinutes: durationSamples ? Math.round(durationTotal / durationSamples / 60000 * 10) / 10 : 0,
      },
      timeseries,
      durationBuckets,
      browsers: top("b:", 8),
      osList: top("o:", 8),
      devices: top("d:", 6),
      countries: top("c:", 12),
      referrers: top("r:", 10),
      live: live.map((s) => ({
        sessionKey: s.sessionKey,
        startedAt: s.startedAt,
        lastSeenAt: s.lastSeenAt,
        durationMs: s.durationMs,
        ip: s.ip,
        browser: s.browser,
        os: s.os,
        device: s.device,
        country: s.country,
        city: s.city,
        path: s.path,
        isBot: s.isBot,
        language: s.language,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function safeHost(ref: string): string {
  try {
    return new URL(ref).host;
  } catch {
    return ref.slice(0, 40);
  }
}
