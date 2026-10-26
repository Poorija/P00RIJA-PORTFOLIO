"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useContent } from "@/lib/content-store";
import { OrbitalLoader } from "./orbital-loader";

const MIN_DISPLAY_MS = 120;
const FADE_MS = 260;
const HARD_TIMEOUT_MS = 3_500;
const STATUS_FA = ["در حال روشن کردن ستاره‌ها…", "چیدن مدار سیارات…", "دریافت محتوا از ایستگاه زمینی…", "گرم کردن موتور وارپ…", "تقریباً آماده‌ی پرواز…"];
const STATUS_EN = ["Igniting the stars…", "Laying out planetary orbits…", "Receiving content from ground control…", "Warming up the warp drive…", "Almost ready for launch…"];

export function PageLoader() {
  const loaded = useContent((state) => state.loaded);
  const lang = useContent((state) => state.lang);
  const brand = useContent((state) => state.content.site.brand);
  const [progress, setProgress] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [gone, setGone] = useState(false);
  const [forceDone, setForceDone] = useState(false);
  const done = (loaded && minElapsed) || forceDone;
  const rafRef = useRef(0);

  useEffect(() => {
    if (done) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const start = performance.now();
    const tick = () => {
      const time = (performance.now() - start) / 1000;
      setProgress((previous) => Math.max(previous, 92 * (1 - Math.exp(-time / 1.1))));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [done]);

  useEffect(() => {
    const minimum = window.setTimeout(() => setMinElapsed(true), MIN_DISPLAY_MS);
    const hard = window.setTimeout(() => setForceDone(true), HARD_TIMEOUT_MS);
    return () => {
      window.clearTimeout(minimum);
      window.clearTimeout(hard);
    };
  }, []);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setGone(true), FADE_MS + 80);
    return () => window.clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    if (gone) return;
    const previous = document.body.style.overflow;
    if (!done) document.body.style.overflow = "hidden";
    else document.body.style.overflow = previous;
    return () => { document.body.style.overflow = previous; };
  }, [done, gone]);

  if (gone) return null;
  const status = (lang === "fa" ? STATUS_FA : STATUS_EN)[Math.min(Math.floor(progress / 22), 4)];
  return (
    <AnimatePresence>
      {!done && (
        <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: FADE_MS / 1000, ease: "easeInOut" } }}>
          <OrbitalLoader fullScreen lang={lang} label={`${brand || "PORTFOLIO"} · ${status}`} progress={done ? 100 : progress} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
