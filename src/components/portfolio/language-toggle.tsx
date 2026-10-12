"use client";

import { Languages } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { motion } from "framer-motion";

export function LanguageToggle() {
  const lang = useContent((s) => s.lang);
  const setLang = useContent((s) => s.setLang);
  const switchLanguage = () => {
    const update = () => setLang(lang === "fa" ? "en" : "fa");
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(update);
    } else {
      update();
    }
    window.dispatchEvent(new CustomEvent("achieve", { detail: "polyglot" }));
  };

  return (
    <button
      onClick={switchLanguage}
      data-cursor-hover
      aria-label={lang === "fa" ? "تغییر زبان به انگلیسی" : "Switch language to Persian"}
      title={lang === "fa" ? "تغییر زبان به انگلیسی" : "Switch language to Persian"}
      className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-border text-foreground/80 transition-colors hover:text-foreground"
      style={{ background: "var(--surface-1)", borderColor: "var(--hairline)" }}
    >
      <motion.span
        key={lang}
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -14, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-1 text-[11px] font-bold"
      >
        <Languages className="h-4 w-4" />
      </motion.span>
    </button>
  );
}
