"use client";

import { useEffect, useRef, useState } from "react";
import { asciifyVideo, DEFAULT_OPTIONS, imageToAsciiFrame, renderFrameToCanvas, snapshotAndDownload } from "asciify-engine";
import { Camera, CameraOff, FileUp, Pause, Play, X } from "lucide-react";
import { renderContainedAsciiImage } from "@/lib/ascii-image-renderer";

type AsciiColorMode = "matrix" | "fullcolor" | "grayscale";
type MediaKind = "image" | "video" | "camera";

const optionsFor = (colorMode: AsciiColorMode, density: number) => ({
  ...DEFAULT_OPTIONS,
  fontSize: Math.max(3, 17 - density * 1.4),
  colorMode,
  charAspect: 0.55,
  normalize: true,
  contrast: 0.08,
});

export function AsciiMediaPlayer({ lang, onClose }: { lang: "fa" | "en"; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const disposedRef = useRef(false);
  const fileRef = useRef<File | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const colorModeRef = useRef<AsciiColorMode>("matrix");
  const densityRef = useRef(7);
  const [colorMode, setColorMode] = useState<AsciiColorMode>("matrix");
  const [density, setDensity] = useState(7);
  const [kind, setKind] = useState<MediaKind | null>(null);
  const [fileName, setFileName] = useState("");
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fa = lang === "fa";

  const mediaError = fa ? "این فایل یا فرمت رسانه قابل خواندن نیست." : "This media file or format cannot be decoded.";

  const releaseMedia = () => {
    stopRef.current?.();
    stopRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    imageRef.current = null;
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.srcObject = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  useEffect(() => () => {
    disposedRef.current = true;
    releaseMedia();
  }, []);

  useEffect(() => {
    if (kind !== "image") return;
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      const image = imageRef.current;
      const canvas = canvasRef.current;
      if (image && canvas) renderContainedAsciiImage(image, canvas, host, optionsFor(colorModeRef.current, densityRef.current));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [kind]);

  useEffect(() => {
    if (kind !== "camera") return;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const video = videoRef.current;
    if (!canvas || !host || !video) return;
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const rect = host.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const describeError = (reason: unknown) => {
      const name = reason instanceof DOMException ? reason.name : "Error";
      if (name === "NotAllowedError" || name === "SecurityError") return fa ? `دسترسی دوربین در مرورگر مسدود است. اجازه دسترسی را فعال کنید. (${name})` : `Camera access is blocked. Allow camera permission in the browser. (${name})`;
      if (name === "NotFoundError" || name === "DevicesNotFoundError") return fa ? "هیچ دوربینی روی این دستگاه پیدا نشد." : "No camera was found on this device.";
      if (name === "NotReadableError" || name === "TrackStartError") return fa ? "دوربین در برنامه دیگری در حال استفاده است یا قابل خواندن نیست." : "The camera is busy or cannot be read.";
      const detail = reason instanceof Error ? reason.message : String(reason);
      return fa ? `رندر دوربین ممکن نشد: ${detail}` : `Camera rendering failed: ${detail}`;
    };
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia is unavailable in this browser");
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } }, audio: false });
        } catch (reason) {
          if (reason instanceof DOMException && (reason.name === "NotAllowedError" || reason.name === "SecurityError")) throw reason;
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();
        let previous = 0;
        let announced = false;
        const render = (now: number) => {
          if (cancelled) return;
          raf = requestAnimationFrame(render);
          if (now - previous < 1000 / 15 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          previous = now;
          const width = canvas.width / dpr;
          const height = canvas.height / dpr;
          const options = optionsFor(colorModeRef.current, densityRef.current);
          const { frame } = imageToAsciiFrame(video, options, width, height);
          context.save();
          context.translate(width, 0);
          context.scale(-1, 1);
          renderFrameToCanvas(context, frame, options, width, height);
          context.restore();
          if (!announced) {
            announced = true;
            setReady(true);
            try { window.dispatchEvent(new CustomEvent("achieve", { detail: "terminal-ascii" })); } catch { /* optional achievement */ }
          }
        };
        raf = requestAnimationFrame(render);
      } catch (reason) {
        stream?.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (!cancelled) {
          setError(describeError(reason));
          setKind(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [kind, fa]);

  const unlock = () => {
    try { window.dispatchEvent(new CustomEvent("achieve", { detail: "terminal-ascii" })); } catch { /* optional achievement */ }
  };

  const startCamera = () => {
    releaseMedia();
    fileRef.current = null;
    disposedRef.current = false;
    setReady(false);
    setError(null);
    setPaused(false);
    setFileName("LIVE CAMERA");
    setKind("camera");
  };

  const stopCamera = () => {
    releaseMedia();
    setReady(false);
    setFileName("");
    setKind(null);
  };

  const loadFile = (file?: File, mode = colorMode, detail = density) => {
    if (!file) return;
    fileRef.current = file;
    colorModeRef.current = mode;
    densityRef.current = detail;
    releaseMedia();
    disposedRef.current = false;
    setReady(false);
    setError(null);
    setPaused(false);
    setFileName(file.name);
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setKind(null);
      setError(mediaError);
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setKind(isImage ? "image" : "video");
    const options = optionsFor(mode, detail);
    void (async () => {
      try {
        if (isImage) {
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = canvasRef.current;
          const host = hostRef.current;
          if (disposedRef.current || objectUrlRef.current !== url || !canvas || !host) return;
          imageRef.current = image;
          if (!renderContainedAsciiImage(image, canvas, host, options)) throw new Error("Image rendering failed");
          setReady(true);
          unlock();
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.src = url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        const stop = await asciifyVideo(video, canvasRef.current!, {
          fitTo: hostRef.current ?? undefined,
          fps: 12,
          options,
          onReady: () => {
            if (disposedRef.current || objectUrlRef.current !== url) return;
            setReady(true);
            unlock();
          },
        });
        if (disposedRef.current || objectUrlRef.current !== url) return stop();
        stopRef.current = stop;
      } catch {
        if (!disposedRef.current && objectUrlRef.current === url) setError(mediaError);
      }
    })();
  };

  const changeColorMode = (mode: AsciiColorMode) => {
    setColorMode(mode);
    colorModeRef.current = mode;
    const image = imageRef.current;
    if (kind === "image" && image && canvasRef.current && hostRef.current) {
      renderContainedAsciiImage(image, canvasRef.current, hostRef.current, optionsFor(mode, densityRef.current));
    } else if (kind !== "camera" && fileRef.current) {
      loadFile(fileRef.current, mode, densityRef.current);
    }
  };

  const changeDensity = (value: number) => {
    setDensity(value);
    densityRef.current = value;
    const image = imageRef.current;
    if (kind === "image" && image && canvasRef.current && hostRef.current) {
      renderContainedAsciiImage(image, canvasRef.current, hostRef.current, optionsFor(colorModeRef.current, value));
    } else if (kind === "video" && fileRef.current) {
      loadFile(fileRef.current, colorModeRef.current, value);
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video || kind !== "video") return;
    if (video.paused) {
      void video.play();
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  return (
    <div data-ascii-player className="absolute inset-0 z-40 flex min-h-0 flex-col bg-[#010504] p-3 text-[#75ff9c]" dir="ltr" onClick={(event) => event.stopPropagation()}>
      <div className="mb-2 flex shrink-0 items-center gap-2 border-b border-[#75ff9c]/15 pb-2 font-mono text-[10px]">
        <span className="truncate">ASCII://MEDIA_DECODER</span>
        <button type="button" onClick={onClose} className="ml-auto grid size-8 place-items-center rounded border border-[#75ff9c]/20 hover:bg-[#75ff9c]/10" aria-label={fa ? "بستن" : "Close"}><X className="size-4" /></button>
      </div>
      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { loadFile(event.target.files?.[0]); event.target.value = ""; }} />
      {!kind && (
        <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#75ff9c]/25 bg-[#75ff9c]/5 font-mono text-xs hover:bg-[#75ff9c]/10">
            <FileUp className="size-7" />
            <span>{fa ? "انتخاب تصویر یا ویدیو از دستگاه" : "Choose an image or video from this device"}</span>
            <span className="text-[9px] text-[#75ff9c]/50">LOCAL ONLY · NO UPLOAD</span>
          </button>
          <button type="button" onClick={startCamera} className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-cyan-300/25 bg-cyan-300/5 font-mono text-xs text-cyan-200 hover:bg-cyan-300/10">
            <Camera className="size-7" />
            <span>{fa ? "روشن کردن دوربین و رندر زنده" : "Start live camera ASCII"}</span>
            <span className="text-[9px] text-cyan-200/50">PERMISSION REQUIRED · LOCAL ONLY</span>
          </button>
        </div>
      )}
      {kind && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center gap-2 font-mono text-[9px] text-[#75ff9c]/60">
            <span className="truncate">{fileName}</span>
            {kind === "camera" ? (
              <button type="button" onClick={stopCamera} className="ml-auto flex items-center gap-1 rounded border border-red-300/25 px-2 py-1 text-red-300 hover:bg-red-300/10"><CameraOff className="size-3" />{fa ? "توقف دوربین" : "STOP CAMERA"}</button>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()} className="ml-auto rounded border border-[#75ff9c]/20 px-2 py-1 text-[#75ff9c]">{fa ? "فایل دیگر" : "Replace"}</button>
            )}
            {kind === "video" && <button type="button" onClick={togglePlayback} className="grid size-7 place-items-center rounded border border-[#75ff9c]/20" aria-label={paused ? (fa ? "پخش" : "Play") : (fa ? "توقف" : "Pause")}>{paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</button>}
          </div>
          <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1 font-mono text-[8px]">
            {(["matrix", "fullcolor", "grayscale"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => changeColorMode(mode)} className={`rounded border px-2 py-1 ${colorMode === mode ? "border-[#75ff9c]/60 bg-[#75ff9c]/15" : "border-[#75ff9c]/15 hover:bg-[#75ff9c]/5"}`}>{mode === "matrix" ? "MATRIX" : mode === "fullcolor" ? "RGB" : "MONO"}</button>
            ))}
            <button type="button" disabled={!ready} onClick={() => void snapshotAndDownload(canvasRef.current!, { filename: `ascii-${fileName || "art"}.png` })} className="ml-auto rounded border border-[#75ff9c]/25 px-2 py-1 hover:bg-[#75ff9c]/10 disabled:opacity-30">SAVE PNG</button>
          </div>
          <div className="mb-2 flex shrink-0 items-center gap-2 font-mono text-[8px] text-[#75ff9c]/55">
            <span>DENSITY</span>
            <input type="range" min="1" max="10" step="1" value={density} onChange={(event) => changeDensity(Number(event.target.value))} className="min-w-0 flex-1 accent-emerald-400" aria-label="ASCII character density" />
            <span className="w-24 text-right">{density}/10 · {optionsFor(colorMode, density).fontSize.toFixed(1)}px</span>
          </div>
          <div ref={hostRef} className="grid min-h-0 flex-1 place-items-center overflow-hidden" data-lenis-prevent>
            <canvas ref={canvasRef} className="block max-h-full max-w-full object-contain" aria-label={fa ? "رندر ASCII رسانه" : "ASCII media rendering"} />
            {!ready && !error && <p className="absolute font-mono text-xs">{kind === "camera" ? "REQUESTING CAMERA…" : "DECODING PIXELS…"}</p>}
          </div>
        </div>
      )}
      {error && <p className="mt-2 font-mono text-xs text-red-400">{error}</p>}
      <video ref={videoRef} className="pointer-events-none fixed left-0 top-0 size-px opacity-0" aria-hidden />
    </div>
  );
}
