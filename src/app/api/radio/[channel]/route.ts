// Same-origin proxy for the built-in SomaFM stations.
// Fixed channel map prevents SSRF while avoiding browser CORS/WebAudio silence.

const CHANNELS: Record<string, string[]> = {
  spacestation: [
    "https://ice2.somafm.com/spacestation-320-mp3",
    "https://ice6.somafm.com/spacestation-320-mp3",
    "https://ice5.somafm.com/spacestation-320-mp3",
  ],
  groovesalad: [
    "https://ice2.somafm.com/groovesalad-256-mp3",
    "https://ice6.somafm.com/groovesalad-256-mp3",
    "https://ice5.somafm.com/groovesalad-256-mp3",
  ],
  dronezone: [
    "https://ice2.somafm.com/dronezone-256-mp3",
    "https://ice6.somafm.com/dronezone-256-mp3",
    "https://ice5.somafm.com/dronezone-256-mp3",
  ],
  lush: [
    "https://ice2.somafm.com/lush-128-mp3",
    "https://ice6.somafm.com/lush-128-mp3",
    "https://ice5.somafm.com/lush-128-mp3",
  ],
};

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channel: string }> }
) {
  const { channel } = await params;
  const sources = CHANNELS[channel];
  if (!sources) return Response.json({ ok: false, error: "Unknown station" }, { status: 404 });

  for (const source of sources) {
    try {
      const upstream = await fetch(source, {
        cache: "no-store",
        headers: {
          Accept: "audio/mpeg,audio/aac,*/*;q=0.8",
          "Icy-MetaData": "0",
          "User-Agent": "P00RIJA-Portfolio-Radio/1.0",
        },
        signal: request.signal,
      });
      if (!upstream.ok || !upstream.body) continue;

      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Radio-Channel": channel,
        },
      });
    } catch {
      // Try next official mirror.
    }
  }

  return Response.json({ ok: false, error: "Station temporarily unavailable" }, { status: 503 });
}
