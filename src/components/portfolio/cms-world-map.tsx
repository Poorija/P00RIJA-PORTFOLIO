"use client";

/* ============================================================
 * WorldMap — real-world neon visitor map for the CMS.
 *
 * Landmasses come from a real, public-domain Natural-Earth-derived
 * GeoJSON, pre-projected (equirectangular) into a compact static asset
 * (public/assets/world-land.json — 121KB, fetched once, browser-cached).
 *
 * Three render styles (toggle on the card header):
 *   • dots    — GitHub-style dotted continents (the classic "tech" look)
 *   • outline — neon wireframe countries
 *   • solid   — filled continents with glow
 *
 * Visitor markers are sized by request count and every recorded
 * connection gets its own animated great-circle-ish arc flowing into
 * the server node, with a travelling "data packet" on each arc.
 * ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Map as MapIcon } from "lucide-react";

// country name (as produced by ip-api, lowercase) → [lat, lng]
const GEO: Record<string, [number, number]> = {
  iran: [32, 53], germany: [51, 10], "united states": [39, -98], france: [46, 2],
  netherlands: [52, 5], "united kingdom": [54, -2], turkey: [39, 35], canada: [56, -106],
  russia: [61, 90], china: [35, 104], japan: [36, 138], india: [21, 78], italy: [42, 12],
  spain: [40, -4], sweden: [62, 15], switzerland: [46.8, 8.2], austria: [47.5, 14.5],
  "united arab emirates": [24, 54], iraq: [33, 44], armenia: [40, 45], ukraine: [49, 32],
  poland: [52, 19], finland: [64, 26], norway: [61, 9], denmark: [56, 10], brazil: [-10, -52],
  australia: [-25, 134], "south korea": [36, 128], singapore: [1.3, 103.8],
  portugal: [39.5, -8], belgium: [50.6, 4.6], "czech republic": [49.8, 15.5], romania: [46, 25],
  hungary: [47.2, 19.4], greece: [39, 22], "saudi arabia": [24, 45], qatar: [25.3, 51.2],
  georgia: [42, 43.5], azerbaijan: [40.4, 47.5], "south africa": [-29, 24], egypt: [26.5, 29.9],
  mexico: [23.6, -102.5], indonesia: [-2.5, 118], thailand: [15, 101], vietnam: [14.1, 108.3],
  malaysia: [4.2, 102], pakistan: [30.4, 69.3], afghanistan: [33.8, 66], uzbekistan: [41.4, 64.6],
  tajikistan: [38.9, 71], turkmenistan: [38.9, 59.6], kyrgyzstan: [41.2, 74.8], kazakhstan: [48, 68],
};

const SERVER_FALLBACK: [number, number] = [35.7, 51.4]; // Tehran — only until the server's own public-IP lookup resolves

export interface MapServerInfo {
  country?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

const project = (lat: number, lng: number): [number, number] => [
  (lng + 180) * (1000 / 360),
  (90 - lat) * (500 / 180),
];

export interface MapConnection {
  country: string;
  city?: string;
  ts?: number | string;
}

type MapStyle = "dots" | "outline" | "solid";

let landCache: string | null = null;
let landPromise: Promise<string | null> | null = null;
function loadLand(): Promise<string | null> {
  if (landCache !== null) return Promise.resolve(landCache);
  if (!landPromise) {
    landPromise = fetch("/assets/world-land.json")
      .then((r) => r.json())
      .then((j: { path?: string }) => {
        landCache = j.path ?? null;
        return landCache;
      })
      .catch(() => null);
  }
  return landPromise;
}

/** Dotted-grid landmass derived from the real path via canvas sampling. */
function useLandDots(landPath: string | null) {
  return useMemo(() => {
    if (!landPath || typeof document === "undefined") return [] as [number, number][];
    const dots: [number, number][] = [];
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 500;
    const ctx = c.getContext("2d");
    if (!ctx) return dots;
    const p = new Path2D(landPath);
    ctx.fillStyle = "#fff";
    ctx.fill(p, "evenodd");
    const step = 6; // dot grid step (svg units)
    const data = ctx.getImageData(0, 0, 1000, 500).data;
    for (let y = step / 2; y < 500; y += step) {
      for (let x = step / 2; x < 1000; x += step) {
        if (data[(Math.floor(y) * 1000 + Math.floor(x)) * 4 + 3] > 120) {
          dots.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
        }
      }
    }
    return dots;
  }, [landPath]);
}

export function WorldMap({
  countries,
  connections = [],
  server = null,
  fa,
}: {
  countries: { name: string; value: number }[];
  connections?: MapConnection[];
  /** Geolocation of the deployment machine (from /api/analytics/summary). */
  server?: MapServerInfo | null;
  fa: boolean;
}) {
  const [style, setStyle] = useState<MapStyle>("dots");
  const [landPath, setLandPath] = useState<string | null>(null);

  useEffect(() => {
    void loadLand().then(setLandPath);
  }, []);

  const dots = useLandDots(style === "dots" ? landPath : null);

  const max = useMemo(() => Math.max(1, ...countries.map((c) => c.value)), [countries]);

  // The server node follows the app's real public-IP geolocation; "Local"
  // visitors sit on that same node.
  const serverCoords: [number, number] = useMemo(() => {
    if (server && typeof server.lat === "number" && typeof server.lon === "number" && (server.lat !== 0 || server.lon !== 0)) {
      return [server.lat, server.lon];
    }
    return SERVER_FALLBACK;
  }, [server]);

  const geoAt = (name: string): [number, number] | undefined => {
    const key = name.toLowerCase();
    if (key === "local") return serverCoords;
    return GEO[key];
  };

  const markers = useMemo(
    () =>
      countries
        .map((c) => {
          const geo = geoAt(c.name);
          if (!geo) return null;
          const [x, y] = project(geo[0], geo[1]);
          return { ...c, x, y };
        })
        .filter((m): m is { name: string; value: number; x: number; y: number } => m !== null),
     
    [countries, serverCoords]
  );

  const [serverX, serverY] = project(serverCoords[0], serverCoords[1]);

  const arcs = useMemo(() => {
    const mkArc = (m: { x: number; y: number; name: string }, seed: number) => {
      const mx = (m.x + serverX) / 2;
      const bend = 0.16 + ((seed * 37) % 10) / 60;
      const my = (m.y + serverY) / 2 - Math.abs(m.x - serverX) * bend - 10;
      return { ...m, d: `M ${serverX} ${serverY} Q ${mx} ${my} ${m.x} ${m.y}` };
    };
    const connArcs = connections
      .map((c, idx) => {
        const geo = geoAt(c.country);
        if (!geo) return null;
        const [x, y] = project(geo[0], geo[1]);
        return mkArc({ x, y, name: c.city ? `${c.country} · ${c.city}` : c.country }, idx);
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .slice(0, 60);
    if (connArcs.length) return connArcs;
    return markers.map((m, i) => mkArc(m, i));
     
  }, [markers, connections, serverX, serverY]);

  const styles: { id: MapStyle; fa: string; en: string }[] = [
    { id: "dots", fa: "نقطه‌چین", en: "Dots" },
    { id: "outline", fa: "خط‌نئون", en: "Outline" },
    { id: "solid", fa: "توپر", en: "Solid" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold text-foreground">
          <MapIcon className="size-3.5" style={{ color: "oklch(0.78 0.15 165)" }} />
          {fa ? `🗺 نقشه‌ی اتصال‌ها — ${arcs.length} کانکشن زنده به سرور` : `🗺 Connection map — ${arcs.length} live connections to the server`}
        </p>
        <div className="flex gap-1 rounded-full border border-border p-0.5" dir="ltr">
          {styles.map((st) => (
            <button
              key={st.id}
              onClick={() => setStyle(st.id)}
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] transition ${style === st.id ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
              style={style === st.id ? { background: "oklch(0.7 0.15 165 / 0.8)" } : undefined}
            >
              {fa ? st.fa : st.en}
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-[oklch(0.09 0.02 260)]" dir="ltr">
        <svg viewBox="0 0 1000 500" className="block w-full" style={{ aspectRatio: "2 / 1" }}>
          <defs>
            <radialGradient id="map-glow" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stopColor="oklch(0.35 0.08 260 / 0.5)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <rect width="1000" height="500" fill="url(#map-glow)" />

          {/* graticule */}
          <g stroke="oklch(0.55 0.05 260 / 0.14)" strokeWidth="0.6">
            {Array.from({ length: 11 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 50} x2="1000" y2={i * 50} />
            ))}
            {Array.from({ length: 21 }, (_, i) => (
              <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="500" />
            ))}
          </g>

          {/* landmass — real-world geometry */}
          {landPath && style === "dots" && (
            <g fill="oklch(0.6 0.09 260 / 0.85)">
              {dots.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="1.7" />
              ))}
            </g>
          )}
          {landPath && style === "outline" && (
            <path
              d={landPath}
              fill="none"
              stroke="oklch(0.72 0.12 200 / 0.8)"
              strokeWidth="0.7"
              fillRule="evenodd"
            />
          )}
          {landPath && style === "solid" && (
            <>
              <path d={landPath} fill="oklch(0.3 0.05 260 / 0.55)" fillRule="evenodd" />
              <path d={landPath} fill="none" stroke="oklch(0.72 0.12 200 / 0.6)" strokeWidth="0.6" fillRule="evenodd" />
            </>
          )}
          {!landPath && (
            <text x="500" y="250" textAnchor="middle" fill="oklch(0.7 0.02 260)" fontSize="13" fontFamily="monospace">
              loading map…
            </text>
          )}

          {/* arcs + travelling packets */}
          {arcs.map((a, ai) => (
            <g key={`arc-${ai}-${a.name}`}>
              <path
                d={a.d}
                fill="none"
                stroke="oklch(0.78 0.15 165 / 0.35)"
                strokeWidth="1.2"
                strokeDasharray="3 5"
              >
                <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1.2s" repeatCount="indefinite" />
              </path>
              <circle r="2.6" fill="oklch(0.85 0.18 165)">
                <animateMotion dur={`${2 + (ai % 5) / 2}s`} repeatCount="indefinite" path={a.d} />
              </circle>
            </g>
          ))}

          {/* server node */}
          <g>
            <circle cx={serverX} cy={serverY} r="10" fill="none" stroke="oklch(0.85 0.18 165 / 0.6)" strokeWidth="1">
              <animate attributeName="r" values="6;16" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={serverX} cy={serverY} r="4.5" fill="oklch(0.85 0.18 165)" stroke="#fff" strokeWidth="1" />
            <text x={serverX + 10} y={serverY + 3} fill="oklch(0.9 0.05 165)" fontSize="11" fontFamily="monospace">
              {server?.city ? `SERVER · ${server.city}` : "SERVER"}
            </text>
          </g>

          {/* visitor markers */}
          {markers.map((m) => {
            const r = 3 + Math.sqrt(m.value / max) * 7;
            return (
              <motion.g
                key={m.name}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                style={{ transformOrigin: `${m.x}px ${m.y}px` }}
              >
                <circle cx={m.x} cy={m.y} r={r} fill="oklch(0.75 0.2 350 / 0.9)" stroke="#fff" strokeWidth="0.8">
                  <animate attributeName="r" values={`${r};${r + 3};${r}`} dur="2.2s" repeatCount="indefinite" />
                </circle>
                <title>{`${m.name} — ${m.value}`}</title>
              </motion.g>
            );
          })}
        </svg>

        {/* legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2">
          {markers.slice(0, 8).map((m) => (
            <span key={m.name} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.75 0.2 350)" }} />
              {m.name} · {m.value}
            </span>
          ))}
          {countries.some((c) => !GEO[c.name.toLowerCase()]) && (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              +{countries.filter((c) => !GEO[c.name.toLowerCase()]).length} {fa ? "کشور بدون مختصات" : "unmapped"}
            </span>
          )}
        </div>

        {/* empty state */}
        {!markers.length && !arcs.length && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="max-w-xs px-4 text-center font-mono text-[10px] leading-5 text-muted-foreground">
              {fa
                ? "هنوز اتصال ثبت‌شده‌ای نیست — با اولین بازدید واقعی، کمان‌ها روی نقشه ظاهر می‌شوند"
                : "No recorded connections yet — arcs appear here with the first real visit"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
