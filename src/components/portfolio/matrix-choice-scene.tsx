"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_OPTIONS } from "asciify-engine";
import { useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { renderContainedAsciiImage } from "@/lib/ascii-image-renderer";

const ERROR_ART = String.raw`
███████╗██████╗ ██████╗  ██████╗ ██████╗
██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
█████╗  ██████╔╝██████╔╝██║   ██║██████╔╝
██╔══╝  ██╔══██╗██╔══██╗██║   ██║██╔══██╗
███████╗██║  ██║██║  ██║╚██████╔╝██║  ██║
╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
`;

const QUOTES = [
  "There is a difference between knowing the path and walking the path.",
  "Welcome to the real world.",
  "Free your mind.",
  "The Matrix is everywhere. It is all around us.",
  "Unfortunately, no one can be told what the Matrix is. You have to see it for yourself.",
  "I'm trying to free your mind, Neo. But I can only show you the door. You're the one that has to walk through it.",
  "You have to let it all go, Neo. Fear, doubt, and disbelief.",
];
const CODE_CHARS = "01ｱｲｳｴｵｶｷｸｹｺABCDEF#@$%&*";
const randomLine = () => Array.from({ length: 58 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const randomQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];
const achieve = (id: string) => {
  try { window.dispatchEvent(new CustomEvent("achieve", { detail: id })); } catch { /* optional achievement */ }
};

function AsciiStill({ src, label, fontSize, className = "" }: { src: string; label: string; fontSize: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    const image = new Image();
    const render = () => {
      if (disposed || !canvasRef.current || !hostRef.current) return;
      renderContainedAsciiImage(image, canvasRef.current, hostRef.current, {
        ...DEFAULT_OPTIONS,
        fontSize,
        colorMode: "fullcolor",
        charAspect: 0.55,
        normalize: true,
        contrast: 0.08,
      });
    };
    const observer = new ResizeObserver(render);
    if (hostRef.current) observer.observe(hostRef.current);
    image.src = src;
    void image.decode().then(render).catch(() => undefined);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [src, fontSize]);
  return (
    <div ref={hostRef} className="grid h-full w-full place-items-center overflow-hidden">
      <canvas ref={canvasRef} className={`block max-h-full max-w-full object-contain ${className}`} aria-label={label} />
    </div>
  );
}

export function MatrixChoiceScene({ pill, onChoose, onClose, lang }: { pill: "red" | "blue" | null; onChoose: (pill: "red" | "blue") => void; onClose: () => void; lang: "fa" | "en" }) {
  const reducedMotion = useReducedMotion();
  const [code, setCode] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [quote, setQuote] = useState(QUOTES[0]);
  const [glitch, setGlitch] = useState(false);
  const fa = lang === "fa";

  useEffect(() => {
    achieve("matrix-choice");
  }, []);

  useEffect(() => {
    if (pill !== "red") {
      setFailed(false);
      setHidden(false);
      setCode([]);
      return;
    }
    if (reducedMotion) {
      const timer = window.setTimeout(() => {
        setFailed(true);
        setHidden(true);
        achieve("matrix-red");
        achieve("matrix-hidden");
      }, 200);
      return () => window.clearTimeout(timer);
    }
    const rain = window.setInterval(() => setCode((lines) => [...lines.slice(-15), randomLine()]), 85);
    const errorTimer = window.setTimeout(() => {
      setFailed(true);
      achieve("matrix-red");
    }, 2200);
    const hiddenTimer = window.setTimeout(() => {
      setHidden(true);
      achieve("matrix-hidden");
    }, 3600);
    return () => {
      window.clearInterval(rain);
      window.clearTimeout(errorTimer);
      window.clearTimeout(hiddenTimer);
    };
  }, [pill, reducedMotion]);

  useEffect(() => {
    if (pill === "blue") achieve("matrix-blue");
  }, [pill]);

  useEffect(() => {
    if (pill !== "red" || !hidden) return;
    setQuote(randomQuote());
    const dialogue = window.setInterval(() => setQuote(randomQuote()), 4800);
    const rain = window.setInterval(() => setCode((lines) => [...lines.slice(-12), randomLine()]), 110);
    const burst = window.setInterval(() => setGlitch(Math.random() > 0.58), 260);
    return () => {
      window.clearInterval(dialogue);
      window.clearInterval(rain);
      window.clearInterval(burst);
    };
  }, [pill, hidden]);

  return (
    <div data-matrix-scene className="absolute inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-black font-mono text-[#75ff9c]" dir="ltr" onClick={(event) => event.stopPropagation()}>
      <div className="relative z-10 flex shrink-0 items-center border-b border-[#75ff9c]/15 bg-black/90 px-3 py-2 text-[10px]">
        <span>{hidden ? "ZION://HIDDEN_SHELL" : "NEBUCHADNEZZAR://PILL_PROTOCOL"}</span>
        <span className="ml-3 hidden text-[#75ff9c]/40 sm:inline">CHANNEL 09 · ENCRYPTED</span>
        <button type="button" onClick={onClose} className="ml-auto grid size-8 place-items-center rounded border border-[#75ff9c]/20 hover:bg-[#75ff9c]/10" aria-label={fa ? "بستن صحنه" : "Close scene"}><X className="size-4" /></button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_center,rgba(20,100,45,.09),transparent_65%)] p-3" data-lenis-prevent>
        {!pill && (
          <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-4">
            <div className="h-[clamp(190px,34vh,420px)] w-full shrink-0">
              <AsciiStill src="/assets/morpheus-pills.jpg" label="Morpheus hands offering red and blue pills in ASCII" fontSize={5} />
            </div>
            <div className="space-y-3 text-center">
              <p className="text-sm leading-6">“This is your last chance. After this, there is no turning back.”</p>
              <p className="text-xs leading-5 text-[#75ff9c]/60">“You take the blue pill — the story ends, you wake up in your bed and believe whatever you want to believe.”</p>
              <p className="text-xs leading-5 text-[#75ff9c]/60">“You take the red pill — you stay in Wonderland and I show you how deep the rabbit hole goes.”</p>
              <div className="mx-auto grid max-w-md grid-cols-2 gap-4 pt-1">
                <button type="button" onClick={() => onChoose("blue")} className="rounded border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sky-300 shadow-[0_0_30px_rgba(56,189,248,.12)] transition hover:bg-sky-400/20">[ BLUE ]<span className="mt-1 block text-[9px] opacity-60">WAKE UP</span></button>
                <button type="button" onClick={() => onChoose("red")} className="rounded border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-300 shadow-[0_0_30px_rgba(248,113,113,.12)] transition hover:bg-red-400/20">[ RED ]<span className="mt-1 block text-[9px] opacity-60">FOLLOW THE RABBIT</span></button>
              </div>
              <p className="text-[9px] text-[#75ff9c]/35">OR TYPE `blue` / `red` IN THE SHELL</p>
            </div>
          </div>
        )}
        {pill === "blue" && (
          <div className="grid min-h-full place-content-center gap-6 text-center">
            <pre className="whitespace-pre text-[#75ff9c]">{String.raw`
   ____  ____  _      ____  _____
  / __ \|  _ \| |    / __ \|  _  |
 / /  \ \ |_) | |   / /  \ \ |_) |
 \ \__/ /  __/| |___\ \__/ /  __/
  \____/|_|   |______\____/|_|
`}</pre>
            <div className="space-y-2 text-sm">
              <p className="text-emerald-300">SYSTEM STATUS: OK</p>
              <p>GRAPHICS ONLINE · SECURITY ONLINE · AI ONLINE</p>
              <p className="text-[#75ff9c]/55">Everything is fine. Welcome home, Poorija.</p>
            </div>
            <button type="button" onClick={onClose} className="mx-auto rounded border border-sky-400/25 px-4 py-2 text-xs text-sky-300">CONTINUE</button>
          </div>
        )}
        {pill === "red" && !failed && (
          <div className="ascii-glitch space-y-1 text-[10px] leading-4 text-[#75ff9c]/75" aria-label="Matrix code rain">
            {code.map((line, index) => <div key={index}>{line}</div>)}
            <style>{`@keyframes ascii-glitch{0%,100%{transform:translate(0)}25%{transform:translate(1px,-1px);filter:hue-rotate(35deg)}50%{transform:translate(-2px,1px)}75%{transform:translate(1px,1px);opacity:.7}}.ascii-glitch{animation:ascii-glitch .13s steps(2) infinite}@media(prefers-reduced-motion:reduce){.ascii-glitch{animation:none}}`}</style>
          </div>
        )}
        {pill === "red" && failed && !hidden && (
          <div className="grid min-h-full place-content-center gap-5 text-center">
            <pre className="mx-auto whitespace-pre text-[clamp(3px,0.65vw,9px)] leading-[1.1] text-red-500" aria-label="ASCII ERROR">{ERROR_ART}</pre>
            <p className="text-xs text-red-400">REALITY.EXE HAS STOPPED WORKING</p>
            <button type="button" onClick={() => setHidden(true)} className="mx-auto rounded border border-[#75ff9c]/30 px-4 py-2 text-xs text-[#75ff9c]">ENTER HIDDEN SHELL</button>
          </div>
        )}
        {pill === "red" && hidden && (
          <div className="grid min-h-full content-center gap-4" style={{ transform: glitch ? "translateX(2px) skewX(-0.6deg)" : "none", filter: glitch ? "hue-rotate(35deg)" : "none" }}>
            <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="max-h-48 overflow-hidden border border-[#75ff9c]/15 bg-black/70 p-3 text-[9px] leading-4 text-[#75ff9c]/45">
                {code.map((line, index) => <div key={index}>{line}</div>)}
              </div>
              <blockquote key={quote} className="grid min-h-40 place-content-center border border-[#75ff9c]/30 bg-[#75ff9c]/5 p-6 text-center text-sm leading-7 text-[#75ff9c] shadow-[0_0_45px_rgba(70,255,140,.08)]">
                <span className="mb-3 text-[9px] text-[#75ff9c]/40">INCOMING TRANSMISSION · MORPHEUS</span>
                “{quote}”
              </blockquote>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px] text-[#75ff9c]/45">
              <span>root@zion:hidden$ reality --unmask</span>
              <button type="button" onClick={onClose} className="rounded border border-[#75ff9c]/25 px-3 py-2 text-[#75ff9c] hover:bg-[#75ff9c]/10">DISCONNECT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
