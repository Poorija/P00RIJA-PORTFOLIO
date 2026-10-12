"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Check, Trophy } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useContent } from "@/lib/content-store";

const BEST_KEY = "cm-best-score";
const MAX_DIST = Math.sqrt(3 * 255 * 255); // ~441.67

type RGB = { r: number; g: number; b: number };

function randChannel() {
  return Math.floor(Math.random() * 256);
}

function randTarget(): RGB {
  return { r: randChannel(), g: randChannel(), b: randChannel() };
}

function rgbStr({ r, g, b }: RGB) {
  return `rgb(${r}, ${g}, ${b})`;
}

function distance(a: RGB, b: RGB) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function scoreFor(d: number) {
  const norm = (d / MAX_DIST) * 100; // 0..100
  return Math.max(0, Math.min(100, Math.round(100 - norm)));
}

export function ColorMixerGame() {
  const lang = useContent((s) => s.lang);
  const t = useContent((s) => s.t);

  // Deterministic initial target — avoids SSR/CSR hydration mismatch.
  const [target, setTarget] = useState<RGB>({ r: 232, g: 74, b: 155 });
  const [rgb, setRgb] = useState<RGB>({ r: 128, g: 128, b: 128 });
  const [score, setScore] = useState<number | null>(null);
  const [best, setBest] = useState(0);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(BEST_KEY) || "0");
      if (!Number.isNaN(v)) {
        // defer setState to avoid set-state-in-effect lint warning
        requestAnimationFrame(() => setBest(v));
      }
    } catch {
      // ignore
    }
    // First randomized round after mount (deferred to avoid sync setState lint)
    requestAnimationFrame(() => setTarget(randTarget()));
  }, []);

  const newRound = useCallback(() => {
    setTarget(randTarget());
    setRgb({ r: 128, g: 128, b: 128 });
    setScore(null);
  }, []);

  const submit = useCallback(() => {
    const s = scoreFor(distance(target, rgb));
    setScore(s);
    if (s >= 80) {
      try { window.dispatchEvent(new CustomEvent("achieve", { detail: "color-alchemist" })); } catch {}
    }
    if (s > best) {
      setBest(s);
      try {
        localStorage.setItem(BEST_KEY, String(s));
      } catch {
        // ignore
      }
    }
  }, [target, rgb, best]);

  const labels =
    lang === "fa"
      ? {
          title: "تطبیق رنگ",
          subtitle: "با اسلایدرهای RGB رنگ هدف را بساز",
          r: "قرمز",
          g: "سبز",
          b: "آبی",
          target: "هدف",
          mix: "ترکیب شما",
        }
      : {
          title: "Color Match",
          subtitle: "Mix the RGB sliders to match the target swatch",
          r: "Red",
          g: "Green",
          b: "Blue",
          target: "Target",
          mix: "Your mix",
        };

  const channels: { key: "r" | "g" | "b"; label: string }[] = [
    { key: "r", label: labels.r },
    { key: "g", label: labels.g },
    { key: "b", label: labels.b },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold" style={{ color: "var(--gfx-1)" }}>
            {labels.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
        <button
          onClick={newRound}
          data-cursor-hover
          className="btn-outline-gfx inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
          aria-label={t("newGame")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("newGame")}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface-1 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {labels.target}
          </div>
          <div
            className="h-20 w-full rounded-lg border border-border"
            style={{ background: rgbStr(target) }}
            role="img"
            aria-label={`${labels.target}: ${rgbStr(target)}`}
          />
        </div>
        <div className="rounded-xl border border-border bg-surface-1 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {labels.mix}
          </div>
          <div
            className="h-20 w-full rounded-lg border border-border transition-colors"
            style={{ background: rgbStr(rgb) }}
            role="img"
            aria-label={`${labels.mix}: ${rgbStr(rgb)}`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {channels.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span
              className="w-10 shrink-0 font-mono text-[10px] uppercase tracking-wider"
              style={{ color: "var(--gfx-1)" }}
            >
              {label}
            </span>
            <Slider
              value={[rgb[key]]}
              min={0}
              max={255}
              step={1}
              onValueChange={(v) => setRgb((p) => ({ ...p, [key]: v[0] }))}
              aria-label={lang === "fa" ? `کانال ${label}` : `${label} channel`}
              className="flex-1"
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {rgb[key]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={submit}
          data-cursor-hover
          className="btn-solid-gfx inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-transform hover:scale-[1.02]"
        >
          <Check className="h-3.5 w-3.5" />
          {t("play")}
        </button>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col items-end">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("score")}
            </span>
            <span className="font-mono text-sm font-bold" style={{ color: "var(--gfx-1)" }}>
              {score ?? "—"}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("best")}
            </span>
            <span className="flex items-center gap-1 font-mono text-sm font-bold text-foreground">
              <Trophy className="h-3 w-3" style={{ color: "var(--gfx-1)" }} />
              {best}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
