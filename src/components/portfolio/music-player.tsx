"use client";

/* ==================================================================
 * MusicPlayer — floating space player.
 *
 *  ▸ Uploaded tracks (CMS → /api/uploads) played through a Web Audio
 *    graph: source → 10-band peaking EQ (BiquadFilterNode chain) →
 *    analyser → output.
 *  ▸ Spotify playlist via the official embed iframe (30s previews /
 *    full tracks for logged-in premium users). Spotify audio cannot be
 *    analysed (CORS/DRM), so it intentionally does not fake a beat.
 *  ▸ Visualizer canvas: bars / orbit (pseudo-3D particles around a
 *    pulsing core) / wave.
 *  ▸ Audio-reactive: writes bass/mid/treble into `liveAudio` every
 *    frame — planets & ambient 3D objects dance to it (configurable).
 * ================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music2,
  SlidersHorizontal,
  Radio,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useContent } from "@/lib/content-store";
import type { PlayerConfig } from "@/lib/content-types";
import { liveAudio, resetLiveAudio } from "@/lib/audio-energy";
import { cn } from "@/lib/utils";
import { useSuspendLenis } from "./smooth-scroll";

/* 10-band EQ: standard ISO-ish centers (Hz) */
const EQ_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const EQ_LABELS = ["60", "170", "310", "600", "1k", "3k", "6k", "12k", "14k", "16k"];

const EQ_PRESETS: Record<PlayerConfig["equalizer"]["preset"], number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [8, 7, 5, 2, -1, -2, 0, 1, 2, 2],
  vocal: [-3, -2, 0, 2, 4, 4, 3, 1, -1, -2],
  space: [6, 4, 0, -2, -3, 0, 3, 5, 6, 7],
  custom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

function bandsFor(eq: PlayerConfig["equalizer"]): number[] {
  if (Array.isArray(eq.bands) && eq.bands.length === 10) return eq.bands.map((n) => Number(n) || 0);
  return EQ_PRESETS[eq.preset] ?? EQ_PRESETS.flat;
}

/** Extract a Spotify playlist id from any URL/URI form. */
function spotifyPlaylistId(url: string): string | null {
  const m = url.match(/playlist[/:]([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export function MusicPlayer() {
  const cfg = useContent((s) => s.content.music);
  const lang = useContent((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"tracks" | "spotify" | "radio">("tracks");
  // radio streams that fail CORS-analysed playback fall back to plain mode
  const radioDirectRef = useRef(false);
  // visitor-side planet-dancing switch (persisted; CMS default still wins
  // when this is ON — turning it OFF hard-disables the reactivity)
  const [danceOn, setDanceOn] = useState(true);
  useEffect(() => {
    // read the persisted switch after mount (rAF keeps SSR markup stable)
    const raf = requestAnimationFrame(() => {
      if (window.localStorage.getItem("p00rija-dance") === "0") setDanceOn(false);
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const toggleDance = () => {
    setDanceOn((v) => {
      window.localStorage.setItem("p00rija-dance", v ? "0" : "1");
      return !v;
    });
  };
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [showEq, setShowEq] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);

  // Freeze the page while the player panel is open — wheel over the playlist
  // must scroll the playlist only.
  useSuspendLenis(open);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const freqRef = useRef<Uint8Array | null>(null);
  const waveRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef(0);
  const beatRef = useRef({
    previous: null as Float32Array | null,
    fluxMean: 0,
    fluxDeviation: 0,
    envelope: 0,
    previousLevel: 0,
    lastFrame: 0,
    lastBeat: 0,
  });
  const telemetryRef = useRef(0);

  const tracks = cfg?.tracks ?? [];
  const hasTracks = tracks.length > 0;
  const stations = cfg?.radio?.stations ?? [];
  const [stationIndex, setStationIndex] = useState(0);
  const currentStation = stations[stationIndex];
  const spotifyId = useMemo(() => spotifyPlaylistId(cfg?.spotifyPlaylistUrl || ""), [cfg?.spotifyPlaylistUrl]);
  const equalizer = cfg?.equalizer;

  /* keep volume in sync with the CMS default (after mount) */
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setVolume(Math.min(100, Math.max(0, Number(cfg?.defaultVolume ?? 70))))
    );
    return () => cancelAnimationFrame(raf);
  }, [cfg?.defaultVolume]);
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  /* ---------- Web Audio graph (built lazily on first play) ---------- */
  const ensureGraph = useCallback((): AnalyserNode | null => {
    const el = audioRef.current;
    if (!el || typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const source = ctx.createMediaElementSource(el);
      // 10 peaking filters chained
      const nodes = EQ_FREQS.map((freq) => {
        const f = ctx.createBiquadFilter();
        f.type = "peaking";
        f.frequency.value = freq;
        f.Q.value = 1.1;
        f.gain.value = 0;
        return f;
      });
      const configuredGains = equalizer?.enabled === false
        ? EQ_PRESETS.flat
        : equalizer ? bandsFor(equalizer) : EQ_PRESETS.flat;
      nodes.forEach((node, index) => {
        node.gain.value = Math.max(-12, Math.min(12, configuredGains[index] ?? 0));
      });
      let prev: AudioNode = source;
      nodes.forEach((n) => {
        prev.connect(n);
        prev = n;
      });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.62;
      prev.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      eqNodesRef.current = nodes;
      freqRef.current = new Uint8Array(analyser.frequencyBinCount);
      waveRef.current = new Uint8Array(analyser.fftSize);
    }
    return analyserRef.current;
  }, [equalizer]);

  /* apply EQ bands whenever config changes */
  useEffect(() => {
    if (!equalizer) return;
    const gains = equalizer.enabled === false ? EQ_PRESETS.flat : bandsFor(equalizer);
    eqNodesRef.current.forEach((node, i) => {
      node.gain.value = Math.max(-12, Math.min(12, gains[i] ?? 0));
    });
  }, [equalizer]);

  /* ---------- analysis + visualizer loop ---------- */
  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d") ?? null;
    const style = cfg?.visualizer?.style ?? "orbit";
    const sens = Math.max(0.2, Math.min(3, Number(cfg?.visualizer?.sensitivity) || 1));

    const particles = Array.from({ length: 42 }, (_, i) => ({
      angle: (i / 42) * Math.PI * 2,
      radius: 0.32 + (i % 5) * 0.11,
      speed: 0.22 + ((i * 7) % 9) / 40,
      size: 1 + ((i * 13) % 7) / 3,
    }));

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const analyser = analyserRef.current;
      let bass = 0;
      let mid = 0;
      let treble = 0;
      let level = 0;
      const now = performance.now();
      const tabSpotifyOrDirectRadio = () => tab === "spotify" || (tab === "radio" && radioDirectRef.current);
      const realAudio = playing && !tabSpotifyOrDirectRadio();
      if (analyser && realAudio && freqRef.current) {
        analyser.getByteFrequencyData(freqRef.current as Uint8Array<ArrayBuffer>);
        const bins = freqRef.current;
        const sampleRate = ctxRef.current?.sampleRate ?? 44100;
        const hzPerBin = sampleRate / analyser.fftSize;
        const bassEnd = Math.max(2, Math.round(180 / hzPerBin));
        const midEnd = Math.min(bins.length - 1, Math.round(2500 / hzPerBin));
        const avg = (from: number, to: number) => {
          let sum = 0;
          for (let i = from; i <= Math.min(to, bins.length - 1); i++) sum += bins[i];
          return sum / Math.max(1, Math.min(to, bins.length - 1) - from + 1) / 255;
        };
        bass = avg(0, bassEnd);
        mid = avg(bassEnd + 1, midEnd);
        treble = avg(midEnd + 1, bins.length - 1);
        level = bass * 0.45 + mid * 0.35 + treble * 0.2;
        if (level < 0.008) {
          resetLiveAudio();
        } else {
          // Adaptive spectral-flux onset detection. Because the analyser is
          // downstream of the EQ, both the bands and beat reflect the user's
          // active preset instead of a timer or random pulse.
          const detector = beatRef.current;
          const dt = detector.lastFrame > 0 ? Math.min(0.1, (now - detector.lastFrame) / 1000) : 1 / 60;
          detector.lastFrame = now;
          if (!detector.previous || detector.previous.length !== bins.length) {
            detector.previous = new Float32Array(bins.length);
          }
          let positiveFlux = 0;
          let spectralMass = 0;
          let weightedBin = 0;
          for (let i = 1; i < bins.length; i++) {
            const normalized = bins[i] / 255;
            positiveFlux += Math.max(0, normalized - detector.previous[i]);
            detector.previous[i] = normalized;
            spectralMass += normalized;
            weightedBin += normalized * i;
          }
          const flux = positiveFlux / Math.max(1, bins.length - 1);
          const previousMean = detector.fluxMean;
          detector.fluxMean += (flux - detector.fluxMean) * (1 - Math.exp(-dt * 2.8));
          detector.fluxDeviation += (Math.abs(flux - previousMean) - detector.fluxDeviation) * (1 - Math.exp(-dt * 3.2));
          const threshold = detector.fluxMean + detector.fluxDeviation * 1.25 + 0.0015;
          const levelRise = Math.max(0, level - detector.previousLevel);
          const onsetStrength = Math.max(
            (flux - threshold) / Math.max(0.006, detector.fluxDeviation * 3.5),
            levelRise * 7
          );
          detector.previousLevel += (level - detector.previousLevel) * (1 - Math.exp(-dt * 12));
          detector.envelope *= Math.exp(-dt * 7.5);
          if (onsetStrength > 0.12 && now - detector.lastBeat > 135) {
            detector.envelope = Math.max(detector.envelope, Math.min(1, 0.25 + onsetStrength));
            detector.lastBeat = now;
          }
          liveAudio.active = true;
          liveAudio.simulated = false;
          liveAudio.bass = bass;
          liveAudio.mid = mid;
          liveAudio.treble = treble;
          liveAudio.level = level;
          liveAudio.beat = detector.envelope;
          liveAudio.flux = Math.min(1, flux * 35);
          liveAudio.brightness = spectralMass > 0
            ? Math.min(1, (weightedBin / spectralMass) / Math.max(1, bins.length - 1))
            : 0;
        }
      } else {
        resetLiveAudio();
      }
      if (!danceOn) resetLiveAudio(); // visitor switch wins over everything
      if (now - telemetryRef.current > 250) {
        telemetryRef.current = now;
        document.documentElement.dataset.audioReactive = !liveAudio.active
          ? "idle"
          : "real";
        document.documentElement.dataset.audioEnergy = liveAudio.level.toFixed(3);
        document.documentElement.dataset.audioBeat = liveAudio.beat.toFixed(3);
        document.documentElement.dataset.audioFlux = liveAudio.flux.toFixed(3);
      }

      /* draw */
      if (ctx2d && canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx2d.clearRect(0, 0, w, h);
        const accent = getComputedStyle(document.documentElement).getPropertyValue("--ai-1").trim() || "#4a8aff";
        const accent2 = getComputedStyle(document.documentElement).getPropertyValue("--gfx-1").trim() || "#e84a9b";

        if (style === "bars") {
          const bins = freqRef.current;
          const count = 24;
          const bw = w / count;
          for (let i = 0; i < count; i++) {
            const v = bins && realAudio ? bins[Math.floor((i / count) * bins.length)] / 255 : 0;
            const bh = Math.max(2, v * h * 0.95);
            ctx2d.fillStyle = i % 3 === 0 ? accent2 : accent;
            ctx2d.globalAlpha = 0.35 + v * 0.6;
            ctx2d.fillRect(i * bw + 1, h - bh, bw - 2, bh);
          }
          ctx2d.globalAlpha = 1;
        } else if (style === "wave") {
          ctx2d.strokeStyle = accent;
          ctx2d.lineWidth = 1.6;
          ctx2d.beginPath();
          const wave = waveRef.current;
          if (wave && analyser && realAudio) analyser.getByteTimeDomainData(wave as Uint8Array<ArrayBuffer>);
          for (let x = 0; x <= w; x += 3) {
            const v = wave && realAudio ? wave[Math.floor((x / w) * wave.length)] / 128 - 1 : Math.sin(x / 30 + performance.now() / 300) * level * 0.8;
            const y = h / 2 + v * h * 0.42;
            if (x === 0) ctx2d.moveTo(x, y);
            else ctx2d.lineTo(x, y);
          }
          ctx2d.stroke();
        } else {
          // orbit — pseudo-3D particles around a pulsing core
          const t = performance.now() / 1000;
          const cx = w / 2;
          const cy = h / 2;
          const coreR = Math.min(w, h) * (0.1 + bass * 0.16 * sens);
          const glow = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.4);
          glow.addColorStop(0, accent);
          glow.addColorStop(1, "transparent");
          ctx2d.globalAlpha = 0.5 + bass * 0.5;
          ctx2d.fillStyle = glow;
          ctx2d.fillRect(0, 0, w, h);
          ctx2d.globalAlpha = 1;
          ctx2d.beginPath();
          ctx2d.arc(cx, cy, coreR, 0, Math.PI * 2);
          ctx2d.fillStyle = accent;
          ctx2d.fill();
          particles.forEach((p) => {
            const a = p.angle + t * p.speed;
            const r = Math.min(w, h) * p.radius * (1 + bass * 0.35 * sens);
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r * 0.36; // squashed orbit → depth
            const depth = 0.45 + 0.55 * (Math.sin(a) * 0.5 + 0.5);
            ctx2d.globalAlpha = depth;
            ctx2d.fillStyle = p.size % 2 ? accent2 : "#ffffff";
            ctx2d.beginPath();
            ctx2d.arc(x, y, p.size * (0.7 + mid * 0.9 * sens), 0, Math.PI * 2);
            ctx2d.fill();
          });
          ctx2d.globalAlpha = 1;
        }
      }
    };
    loop();
  }, [cfg?.visualizer?.style, cfg?.visualizer?.sensitivity, cfg?.visualizer?.reactive3d, playing, spotifyPlaying, tab, danceOn]);

  useEffect(() => {
    startLoop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [startLoop]);

  useEffect(() => () => resetLiveAudio(), []);

  /* ---------- controls ---------- */
  const playTrack = useCallback(
    (index: number) => {
      const el = audioRef.current;
      if (!el || !tracks[index]) return;
      setTrackIndex(index);
      setTab("tracks");
      el.src = tracks[index].uploadUrl;
      ensureGraph();
      ctxRef.current?.resume().catch(() => {});
      el.play()
        .then(() => setPlaying(true))
        .catch(() => toast(lang === "fa" ? "پخش نیاز به کلیک دارد" : "Click play to start"));
    },
    [tracks, ensureGraph, lang]
  );

  const playStation = useCallback(
    (index: number) => {
      const el = audioRef.current;
      const station = stations[index];
      if (!el || !station) return;
      setStationIndex(index);
      setTab("radio");
      // try analysed playback first (CORS); on error the audio element
      // handler below retries once without crossOrigin in direct mode.
      radioDirectRef.current = false;
      el.crossOrigin = "anonymous";
      el.src = station.url;
      ensureGraph();
      ctxRef.current?.resume().catch(() => {});
      el.play()
        .then(() => setPlaying(true))
        .catch(() => {
          // CORS or codec issue → plain direct playback (no EQ analysis)
          radioDirectRef.current = true;
          el.removeAttribute("crossOrigin");
          el.src = station.url;
          el.play().then(() => setPlaying(true)).catch(() => {
            toast(lang === "fa" ? "پخش ایستگاه ممکن نشد" : "Could not play station");
          });
        });
    },
    [stations, ensureGraph, lang]
  );

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (tab === "spotify") {
      // The embed cannot be remote-controlled or analysed. Keep this state
      // only for the UI; reactive scenes deliberately remain idle.
      setSpotifyPlaying((v) => !v);
      return;
    }
    if (tab === "radio") {
      if (currentStation && (!el.src || el.paused)) playStation(stationIndex);
      else if (!el.paused) {
        el.pause();
        setPlaying(false);
      } else if (currentStation) playStation(stationIndex);
      return;
    }
    if (!el.src || !(el.src.includes("/api/uploads/") || el.src.includes("ice") || el.src.includes("http"))) {
      if (hasTracks) playTrack(trackIndex);
      return;
    }
    ensureGraph();
    ctxRef.current?.resume().catch(() => {});
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const skip = (dir: 1 | -1) => {
    if (!hasTracks) return;
    playTrack((trackIndex + dir + tracks.length) % tracks.length);
  };

  if (cfg?.enabled === false) return null;
  const isFa = lang === "fa";
  const posClass = (cfg?.position ?? "end") === "start" ? "start-5" : "end-5";
  const current = tracks[trackIndex];
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <>
      <audio
        ref={audioRef}
        onError={() => {
          const el = audioRef.current;
          if (tab === "radio" && el && !radioDirectRef.current && el.src) {
            // first failure (often CORS): retry once in plain direct mode
            radioDirectRef.current = true;
            el.removeAttribute("crossOrigin");
            const retry = el.src;
            el.src = retry;
            el.play().then(() => setPlaying(true)).catch(() => {});
          } else if (el && el.src) {
            // final failure: stop retrying, release the element
            el.removeAttribute("src");
            el.load();
            setPlaying(false);
          }
        }}
        onEnded={() => {
          // radio streams are endless (duration Infinity) — only uploaded
          // tracks advance the playlist
          if (tab !== "radio" && hasTracks) playTrack((trackIndex + 1) % tracks.length);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress({ current: el.currentTime, duration: el.duration || 0 });
        }}
        preload="none"
        crossOrigin="anonymous"
      />

      {/* collapsed pill */}
      <motion.button
        layout
        onClick={() => setOpen((v) => !v)}
        data-cursor-hover
        aria-label={isFa ? "پخش‌کننده موسیقی" : "Music player"}
        className={cn("fixed bottom-20 z-[84] flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-2.5 shadow-2xl backdrop-blur-xl sm:px-4", posClass)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
      >
        <motion.span
          animate={playing || spotifyPlaying ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 3.2, repeat: playing || spotifyPlaying ? Infinity : 0, ease: "linear" }}
        >
          <Music2 className="h-4 w-4" style={{ color: "var(--ai-1)" }} />
        </motion.span>
        <span className="hidden max-w-32 truncate text-xs font-semibold text-foreground sm:block">
          {tab === "spotify" && spotifyId
            ? isFa ? "پلی‌لیست Spotify" : "Spotify playlist"
            : tab === "radio" && currentStation
              ? currentStation.name
              : current?.title || (isFa ? "موسیقی فضایی" : "Space music")}
        </span>
        {/* mini equalizer bars */}
        {(playing || spotifyPlaying) && (
          <span className="flex h-3.5 items-end gap-[2px]">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-[3px] rounded-full"
                style={{ background: "var(--ai-1)" }}
                animate={{ height: [4, 13, 6, 11, 4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </span>
        )}
      </motion.button>

      {/* expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className={cn("fixed bottom-36 z-[84] w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-border bg-card/90 shadow-2xl backdrop-blur-2xl", posClass)}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                🎵 {isFa ? "پخش‌کننده فضایی" : "SPACE PLAYER"}
              </p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* tabs */}
            <div className="flex gap-1 px-4 pt-3">
              {(["tracks", "spotify", "radio"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "tracks" ? <Music2 className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
                  {t === "tracks" ? (isFa ? "آهنگ‌ها" : "Tracks") : t === "spotify" ? "Spotify" : (isFa ? "رادیو" : "Radio")}
                </button>
              ))}
              <button
                onClick={toggleDance}
                aria-pressed={danceOn}
                aria-label={isFa ? (danceOn ? "توقف رقص سیارات" : "فعال‌کردن رقص سیارات") : (danceOn ? "Pause planet dancing" : "Enable planet dancing")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border text-xs transition-colors",
                  danceOn ? "border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                )}
                title={isFa ? "رقص سیارات (روشن/خاموش)" : "Planet dancing (on/off)"}
              >
                🪐
              </button>
              <button
                onClick={() => setShowEq((v) => !v)}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border transition-colors",
                  showEq ? "border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                )}
                title={isFa ? "اکولایزر" : "Equalizer"}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[52vh] space-y-3 overflow-y-auto p-4" data-lenis-prevent>
              {/* EQ panel */}
              <AnimatePresence>
                {showEq && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-border bg-background/50 p-3">
                      <div className="mb-2 flex flex-wrap gap-1">
                        {(Object.keys(EQ_PRESETS) as (keyof typeof EQ_PRESETS)[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => {
                              /* presets apply instantly for the current session; save custom via CMS */
                              eqNodesRef.current.forEach((node, i) => {
                                node.gain.value = EQ_PRESETS[p][i];
                              });
                              toast(isFa ? `پریست ${p} اعمال شد` : `Preset ${p} applied`);
                            }}
                            className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        {EQ_LABELS.map((label, i) => (
                          <label key={label} className="flex flex-1 flex-col items-center gap-1">
                            <input
                              type="range"
                              min={-12}
                              max={12}
                              step={1}
                              defaultValue={bandsFor(cfg?.equalizer ?? { enabled: true, preset: "flat", bands: [] })[i]}
                              onChange={(e) => {
                                const node = eqNodesRef.current[i];
                                if (node) node.gain.value = Number(e.target.value);
                              }}
                              className="h-24 w-4 accent-primary"
                              style={{ writingMode: "vertical-lr", direction: "rtl" }}
                            />
                            <span className="text-[8px] text-muted-foreground">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {tab === "tracks" ? (
                <>
                  {/* visualizer */}
                  {cfg?.visualizer?.enabled !== false && (
                    <div className="h-24 overflow-hidden rounded-2xl border border-border bg-background/60">
                      <canvas ref={canvasRef} width={340} height={96} className="h-full w-full" />
                    </div>
                  )}

                  {/* seek + controls */}
                  {hasTracks && tab === "tracks" && (
                    <div>
                      <div
                        className="group relative h-1.5 w-full cursor-pointer rounded-full bg-surface-2"
                        onClick={(e) => {
                          const el = audioRef.current;
                          if (!el || !progress.duration) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const ratio = (e.clientX - rect.left) / rect.width;
                          el.currentTime = ratio * progress.duration;
                        }}
                      >
                        <div
                          className="absolute inset-y-0 start-0 rounded-full"
                          style={{
                            width: `${progress.duration ? (progress.current / progress.duration) * 100 : 0}%`,
                            background: "linear-gradient(to right, var(--gfx-1), var(--ai-1))",
                          }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
                        <span>{fmt(progress.current)}</span>
                        <span>{fmt(progress.duration)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => skip(-1)} disabled={!hasTracks} className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground disabled:opacity-40" aria-label="previous">
                      <SkipBack className="h-4 w-4" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, var(--gfx-1), var(--ai-1))", color: "white" }}
                      aria-label="play/pause"
                    >
                      {(playing && tab === "tracks") ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <button onClick={() => skip(1)} disabled={!hasTracks} className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground disabled:opacity-40" aria-label="next">
                      <SkipForward className="h-4 w-4" />
                    </button>
                  </div>

                  {/* track list */}
                  <div className="space-y-1">
                    {hasTracks ? (
                      tracks.map((t, i) => (
                        <button
                          key={t.id}
                          onClick={() => playTrack(i)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs transition-colors",
                            i === trackIndex && tab === "tracks" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                          )}
                        >
                          <span className="font-mono text-[9px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
                          {t.artist && <span className="truncate text-[10px] opacity-60">{t.artist}</span>}
                        </button>
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        {isFa
                          ? "هنوز آهنگی آپلود نشده — از CMS ← بخش موسیقی فایل MP3 آپلود کنید."
                          : "No tracks yet — upload MP3s from CMS → Music."}
                      </p>
                    )}
                  </div>

                  {/* volume */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMuted((v) => !v)} className="text-muted-foreground hover:text-foreground" aria-label="mute">
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={muted ? 0 : volume}
                      onChange={(e) => {
                        setMuted(false);
                        setVolume(Number(e.target.value));
                      }}
                      className="h-1 flex-1 accent-primary"
                    />
                    <span className="w-8 text-end font-mono text-[10px] text-muted-foreground">{muted ? 0 : volume}%</span>
                  </div>
                </>
              ) : tab === "radio" ? (
                <div className="space-y-3">
                  {cfg?.visualizer?.enabled !== false && (
                    <div className="h-24 overflow-hidden rounded-2xl border border-border bg-background/60">
                      <canvas ref={canvasRef} width={340} height={96} className="h-full w-full" />
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => currentStation && playStation((stationIndex - 1 + stations.length) % stations.length)}
                      disabled={!stations.length}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground disabled:opacity-40"
                      aria-label="previous station"
                    >
                      <SkipBack className="h-4 w-4" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, var(--sec-1), var(--ai-1))", color: "white" }}
                      aria-label="play/pause"
                    >
                      {playing && tab === "radio" ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => currentStation && playStation((stationIndex + 1) % stations.length)}
                      disabled={!stations.length}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground disabled:opacity-40"
                      aria-label="next station"
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {stations.length ? (
                      stations.map((st, i) => (
                        <button
                          key={st.id}
                          onClick={() => playStation(i)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs transition-colors",
                            i === stationIndex && tab === "radio" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", playing && tab === "radio" && i === stationIndex ? "animate-pulse bg-emerald-400" : "bg-border")} />
                          <span className="min-w-0 flex-1 truncate font-semibold">{st.name}</span>
                          <span className="font-mono text-[9px] opacity-60">{isFa ? "زنده" : "LIVE"}</span>
                        </button>
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        {isFa ? "ایستگاهی تنظیم نشده — از CMS ← موسیقی اضافه کنید." : "No stations — add them in CMS → Music."}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {isFa
                      ? "رادیوهای فضایی رایگان SomaFM — پخش کامل و بی‌پایان بدون نیاز به حساب. ایستگاه دلخواه با URL استریم از CMS قابل افزودن است."
                      : "Free space radio from SomaFM — endless full playback, no account. Add your own stream URLs from the CMS."}
                  </p>
                </div>
              ) : (
                /* Spotify tab */
                <div className="space-y-2">
                  {spotifyId ? (
                    <iframe
                      title="Spotify playlist"
                      src={`https://open.spotify.com/embed/playlist/${spotifyId}?utm_source=generator&theme=0`}
                      width="100%"
                      height="360"
                      frameBorder={0}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-2xl"
                    />
                  ) : (
                    <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      {isFa
                        ? "لینک پلی‌لیست Spotify را در CMS ← بخش موسیقی وارد کنید."
                        : "Enter your Spotify playlist link in CMS → Music."}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://open.spotify.com/playlist/${spotifyId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-[var(--chart-1)] hover:text-foreground"
                    >
                      🎧 {isFa ? "ورود به Spotify برای پخش کامل (رایگان)" : "Log in to Spotify for full playback (free)"}
                    </a>
                    <button
                      onClick={() => setSpotifyPlaying((v) => !v)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                        spotifyPlaying ? "border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      💃 {spotifyPlaying
                        ? (isFa ? "ریتم روشن — سیارات می‌رقصند" : "Beat on — planets dancing")
                        : (isFa ? "روشن کردن رقص سیارات" : "Turn on planet dancing")}
                    </button>
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {isFa
                      ? "با ورود رایگان به Spotify در همین مرورگر، پلی‌لیست‌های رایگان به‌صورت کامل (شافل) پخش می‌شوند — دکمه بالا را بزنید، وارد شوید و برگردید. بدون ورود فقط پیش‌نمایش ۳۰ ثانیه‌ای است (محدودیت Spotify)."
                      : "Log in to a free Spotify account in this browser and free playlists play in full (shuffle) — click above, log in, come back. Without login you get 30s previews (Spotify's policy)."}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
