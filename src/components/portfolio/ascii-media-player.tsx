"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Pause, Play, X } from "lucide-react";

const RAMP = " .:-=+*#%@";

export function AsciiMediaPlayer({ lang, onClose }: { lang: "fa" | "en"; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const frameRef = useRef(0);
  const [ascii, setAscii] = useState("");
  const [kind, setKind] = useState<"image" | "video" | null>(null);
  const [fileName, setFileName] = useState("");
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(false);
  const fa = lang === "fa";

  const releaseMedia = () => {
    cancelAnimationFrame(frameRef.current);
    videoRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  useEffect(() => releaseMedia, []);

  const draw = (source: CanvasImageSource, sourceWidth: number, sourceHeight: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context || !sourceWidth || !sourceHeight) return;
    const width = 120;
    const height = Math.max(1, Math.round(width * sourceHeight / sourceWidth * 0.48));
    canvas.width = width;
    canvas.height = height;
    context.drawImage(source, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const rows: string[] = [];
    for (let y = 0; y < height; y++) {
      let row = "";
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const luminance = pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
        row += RAMP[Math.min(RAMP.length - 1, Math.floor(luminance / 256 * RAMP.length))];
      }
      rows.push(row);
    }
    setAscii(rows.join("\n"));
  };

  const unlock = () => {
    try { window.dispatchEvent(new CustomEvent("achieve", { detail: "terminal-ascii" })); } catch { /* optional achievement */ }
  };

  const loadFile = (file?: File) => {
    if (!file) return;
    releaseMedia();
    setReady(false);
    setError(false);
    setAscii("");
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
    if (isImage) {
      const image = new Image();
      image.onload = () => {
        draw(image, image.naturalWidth, image.naturalHeight);
        setReady(true);
        unlock();
      };
      image.onerror = () => setError(true);
      image.src = url;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      setReady(true);
      unlock();
      void video.play();
      let previous = 0;
      const tick = (time: number) => {
        if (objectUrlRef.current !== url) return;
        if (!video.paused && time - previous > 90) {
          draw(video, video.videoWidth, video.videoHeight);
          previous = time;
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    };
    video.onerror = () => setError(true);
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
    <div className="absolute inset-0 z-40 flex min-h-0 flex-col bg-[#010504] p-3 text-[#75ff9c]" dir="ltr" onClick={(event) => event.stopPropagation()}>
      <div className="mb-2 flex shrink-0 items-center gap-2 border-b border-[#75ff9c]/15 pb-2 font-mono text-[10px]">
        <span className="truncate">ASCII://MEDIA_DECODER</span>
        <button type="button" onClick={onClose} className="ml-auto grid size-8 place-items-center rounded border border-[#75ff9c]/20 hover:bg-[#75ff9c]/10" aria-label={fa ? "بستن" : "Close"}><X className="size-4" /></button>
      </div>
      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { loadFile(event.target.files?.[0]); event.target.value = ""; }} />
      {!kind && (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#75ff9c]/25 bg-[#75ff9c]/5 font-mono text-xs hover:bg-[#75ff9c]/10">
          <FileUp className="size-7" />
          <span>{fa ? "انتخاب تصویر یا ویدیو از دستگاه" : "Choose an image or video from this device"}</span>
          <span className="text-[9px] text-[#75ff9c]/50">LOCAL ONLY · NO UPLOAD · CANVAS → ASCII</span>
        </button>
      )}
      {kind && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center gap-2 font-mono text-[9px] text-[#75ff9c]/60">
            <span className="truncate">{fileName}</span>
            <button type="button" onClick={() => inputRef.current?.click()} className="ml-auto rounded border border-[#75ff9c]/20 px-2 py-1 text-[#75ff9c]">{fa ? "فایل دیگر" : "Replace"}</button>
            {kind === "video" && <button type="button" onClick={togglePlayback} className="grid size-7 place-items-center rounded border border-[#75ff9c]/20" aria-label={paused ? (fa ? "پخش" : "Play") : (fa ? "توقف" : "Pause")}>{paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</button>}
          </div>
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto" data-lenis-prevent>
            {ascii && <pre className="whitespace-pre font-mono text-[7px] leading-[7px] text-[#75ff9c] sm:text-[9px] sm:leading-[9px]" aria-label={fa ? "رندر ASCII رسانه" : "ASCII media rendering"}>{ascii}</pre>}
            {!ready && !error && <p className="font-mono text-xs">DECODING PIXELS…</p>}
          </div>
        </div>
      )}
      {error && <p className="mt-2 font-mono text-xs text-red-400">{fa ? "این فایل یا فرمت رسانه قابل خواندن نیست." : "This media file or format cannot be decoded."}</p>}
      <video ref={videoRef} className="hidden" aria-hidden />
      <canvas ref={canvasRef} className="hidden" aria-hidden />
    </div>
  );
}
