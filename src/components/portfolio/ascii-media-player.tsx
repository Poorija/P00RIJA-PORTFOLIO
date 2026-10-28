"use client";

import { useEffect, useRef, useState } from "react";
import { asciify, asciifyVideo } from "asciify-engine";
import { FileUp, Pause, Play, X } from "lucide-react";

export function AsciiMediaPlayer({ lang, onClose }: { lang: "fa" | "en"; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const disposedRef = useRef(false);
  const [kind, setKind] = useState<"image" | "video" | null>(null);
  const [fileName, setFileName] = useState("");
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(false);
  const fa = lang === "fa";

  const releaseMedia = () => {
    stopRef.current?.();
    stopRef.current = null;
    videoRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  useEffect(() => () => {
    disposedRef.current = true;
    releaseMedia();
  }, []);

  const unlock = () => {
    try { window.dispatchEvent(new CustomEvent("achieve", { detail: "terminal-ascii" })); } catch { /* optional achievement */ }
  };

  const loadFile = (file?: File) => {
    if (!file) return;
    releaseMedia();
    disposedRef.current = false;
    setReady(false);
    setError(false);
    setPaused(false);
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setError(true);
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setFileName(file.name);
    setKind(isImage ? "image" : "video");
    const options = { colorMode: "matrix" as const, charAspect: 0.55, normalize: true, contrast: 0.08 };
    void (async () => {
      try {
        if (isImage) {
          const stop = await asciify(url, canvasRef.current!, { fontSize: 7, options });
          if (disposedRef.current || objectUrlRef.current !== url) return stop();
          stopRef.current = stop;
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
        if (!disposedRef.current && objectUrlRef.current === url) setError(true);
      }
    })();
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
        <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#75ff9c]/25 bg-[#75ff9c]/5 font-mono text-xs hover:bg-[#75ff9c]/10">
          <FileUp className="size-7" />
          <span>{fa ? "انتخاب تصویر یا ویدیو از دستگاه" : "Choose an image or video from this device"}</span>
          <span className="text-[9px] text-[#75ff9c]/50">LOCAL ONLY · NO UPLOAD · ASCIIFY ENGINE</span>
        </button>
      )}
      {kind && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center gap-2 font-mono text-[9px] text-[#75ff9c]/60">
            <span className="truncate">{fileName}</span>
            <button type="button" onClick={() => inputRef.current?.click()} className="ml-auto rounded border border-[#75ff9c]/20 px-2 py-1 text-[#75ff9c]">{fa ? "فایل دیگر" : "Replace"}</button>
            {kind === "video" && <button type="button" onClick={togglePlayback} className="grid size-7 place-items-center rounded border border-[#75ff9c]/20" aria-label={paused ? (fa ? "پخش" : "Play") : (fa ? "توقف" : "Pause")}>{paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</button>}
          </div>
          <div ref={hostRef} className="grid min-h-0 flex-1 place-items-center overflow-hidden" data-lenis-prevent>
            <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" aria-label={fa ? "رندر ASCII رسانه" : "ASCII media rendering"} />
            {!ready && !error && <p className="absolute font-mono text-xs">DECODING PIXELS…</p>}
          </div>
        </div>
      )}
      {error && <p className="mt-2 font-mono text-xs text-red-400">{fa ? "این فایل یا فرمت رسانه قابل خواندن نیست." : "This media file or format cannot be decoded."}</p>}
      <video ref={videoRef} className="hidden" aria-hidden />
    </div>
  );
}
