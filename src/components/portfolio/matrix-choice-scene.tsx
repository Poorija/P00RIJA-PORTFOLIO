"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

const MORPHEUS = String.raw`
                 .------------------------.
             .--'  THE LAST CHANCE       '--.
            /                                \
           |             .------.             |
           |            /        \            |
           |           |  .----.  |           |
           |           |  |    |  |           |
           |            \__|  |__/            |
           |          .----|  |----.          |
           |         /     |__|     \         |
           |        /   .--\  /--.   \        |
           |       /   /   \  /   \   \       |
           |      /   /     \/     \   \      |
           |     /   /             \   \     |
           |    /   /               \   \    |
           |   /___/                 \___\   |
           |      \                   /      |
            \      \                 /      /
             '------\_______________/------'
`;

const ERROR_ART = String.raw`
███████╗██████╗ ██████╗  ██████╗ ██████╗
██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
█████╗  ██████╔╝██████╔╝██║   ██║██████╔╝
██╔══╝  ██╔══██╗██╔══██╗██║   ██║██╔══██╗
███████╗██║  ██║██║  ██║╚██████╔╝██║  ██║
╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
`;

const CODE_CHARS = "01ｱｲｳｴｵｶｷｸｹｺABCDEF#@$%&*";
const achieve = (id: string) => {
  try { window.dispatchEvent(new CustomEvent("achieve", { detail: id })); } catch { /* optional achievement */ }
};
const randomLine = () => Array.from({ length: 54 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

export function MatrixChoiceScene({ pill, onChoose, onClose, lang }: { pill: "red" | "blue" | null; onChoose: (pill: "red" | "blue") => void; onClose: () => void; lang: "fa" | "en" }) {
  const reducedMotion = useReducedMotion();
  const [code, setCode] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const fa = lang === "fa";

  useEffect(() => {
    achieve("matrix-choice");
  }, []);

  useEffect(() => {
    if (pill !== "red") {
      setFailed(false);
      setCode([]);
      return;
    }
    if (reducedMotion) {
      const timer = window.setTimeout(() => { setFailed(true); achieve("matrix-red"); }, 150);
      return () => window.clearTimeout(timer);
    }
    const interval = window.setInterval(() => setCode((lines) => [...lines.slice(-15), randomLine()]), 85);
    const timer = window.setTimeout(() => {
      window.clearInterval(interval);
      setFailed(true);
      achieve("matrix-red");
    }, 2600);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [pill, reducedMotion]);

  useEffect(() => {
    if (pill === "blue") achieve("matrix-blue");
  }, [pill]);

  return (
    <div className="absolute inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-black p-3 font-mono text-[#75ff9c]" dir="ltr" onClick={(event) => event.stopPropagation()}>
      <div className="mb-2 flex shrink-0 items-center border-b border-[#75ff9c]/15 pb-2 text-[10px]">
        <span>MATRIX://PILL_PROTOCOL</span>
        <button type="button" onClick={onClose} className="ml-auto grid size-8 place-items-center rounded border border-[#75ff9c]/20 hover:bg-[#75ff9c]/10" aria-label={fa ? "بستن صحنه" : "Close scene"}><X className="size-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
        {!pill && (
          <div className="grid min-h-full content-center gap-3 lg:grid-cols-[1fr_1.05fr]">
            <pre className="mx-auto whitespace-pre text-[7px] leading-[7px] text-[#75ff9c]/80 sm:text-[9px] sm:leading-[9px]" aria-label="Morpheus in ASCII">{MORPHEUS}</pre>
            <div className="space-y-3 text-center text-[11px] leading-5 sm:text-xs">
              <p>“This is your last chance. After this, there is no turning back.”</p>
              <p className="text-[#75ff9c]/60">“You take the blue pill — the story ends, you wake up in your bed and believe whatever you want to believe.”</p>
              <p className="text-[#75ff9c]/60">“You take the red pill — you stay in Wonderland and I show you how deep the rabbit hole goes.”</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => onChoose("blue")} className="rounded border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sky-300 transition hover:bg-sky-400/20">[ BLUE ]<span className="mt-1 block text-[9px] opacity-60">WAKE UP</span></button>
                <button type="button" onClick={() => onChoose("red")} className="rounded border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-300 transition hover:bg-red-400/20">[ RED ]<span className="mt-1 block text-[9px] opacity-60">FOLLOW THE RABBIT</span></button>
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
        {pill === "red" && failed && (
          <div className="grid min-h-full place-content-center gap-5 text-center">
            <pre className="mx-auto whitespace-pre text-[clamp(3px,0.65vw,9px)] leading-[1.1] text-red-500" aria-label="ASCII ERROR">{ERROR_ART}</pre>
            <p className="text-xs text-red-400">REALITY.EXE HAS STOPPED WORKING</p>
            <button type="button" onClick={() => onChoose("blue")} className="mx-auto rounded border border-sky-400/30 px-4 py-2 text-xs text-sky-300">RESTORE REALITY</button>
          </div>
        )}
      </div>
    </div>
  );
}
