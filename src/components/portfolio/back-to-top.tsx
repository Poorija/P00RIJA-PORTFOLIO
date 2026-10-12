"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useContent } from "@/lib/content-store";

export function BackToTop() {
  const lang = useContent((s) => s.lang);
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const sy = window.scrollY;
      const max = document.body.scrollHeight - window.innerHeight;
      setShow(sy > 400);
      setProgress(max > 0 ? Math.min(1, sy / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Position: bottom-right in RTL (fa), bottom-left in LTR (en)
  const isRtl = lang === "fa";

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          data-cursor-hover
          aria-label={lang === "fa" ? "بازگشت به بالا" : "Back to top"}
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 z-[85] grid h-12 w-12 place-items-center rounded-full border border-border bg-card/70 backdrop-blur-md transition-colors hover:bg-card"
          style={
            isRtl
              ? { right: "1.5rem", bottom: "1.5rem" }
              : { left: "1.5rem", bottom: "1.5rem" }
          }
        >
          {/* circular progress ring */}
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 48 48">
            <circle
              cx="24" cy="24" r="22"
              fill="none"
              stroke="var(--scroll-color, var(--gfx-1))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress)}`}
              style={{ transition: "stroke-dashoffset 0.15s ease" }}
            />
          </svg>
          {/* arrow */}
          <ArrowUp
            className="relative h-5 w-5"
            style={{ color: "var(--scroll-color, var(--gfx-1))" }}
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
