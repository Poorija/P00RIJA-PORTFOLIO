"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useContent } from "@/lib/content-store";
import { THEMES, themeMeta } from "@/lib/themes";
import { cn } from "@/lib/utils";

/* ThemeToggle — 7-theme picker (popover grid with live swatches).
   The button shows the active theme's emoji; cycling via keyboard "T"
   is handled by the easter-egg manager. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const lang = useContent((s) => s.lang);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const active = themeMeta(theme);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-cursor-hover
          aria-label={lang === "fa" ? "انتخاب تم" : "Pick a theme"}
          title={lang === "fa" ? "انتخاب تم" : "Pick a theme"}
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground/80 transition-colors hover:text-foreground"
          style={{ background: "var(--surface-1)", borderColor: "var(--hairline)" }}
        >
          {mounted ? (
            <motion.span
              key={active.id}
              initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="text-sm leading-none"
            >
              {active.emoji}
            </motion.span>
          ) : (
            <Palette className="h-4 w-4" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        className="w-64 rounded-2xl border-border bg-popover/95 p-2 backdrop-blur-xl"
      >
        <p className="px-2 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {lang === "fa" ? "تم فضایی خود را انتخاب کن" : "Choose your space theme"}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((t, i) => {
            const isActive = theme === t.id;
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setTheme(t.id)}
                data-cursor-hover
                className={cn(
                  "group relative flex items-center gap-2 rounded-xl border px-2.5 py-2 text-start transition-colors",
                  isActive
                    ? "border-transparent"
                    : "border-transparent hover:bg-surface-1"
                )}
                style={isActive ? { background: "var(--surface-2)" } : undefined}
              >
                <span className="flex -space-x-1.5">
                  {t.swatch.map((c, j) => (
                    <span
                      key={j}
                      className="h-4 w-4 rounded-full border border-background/60"
                      style={{ background: c, zIndex: 3 - j }}
                    />
                  ))}
                </span>
                <span className="flex-1 truncate text-xs font-medium text-foreground">
                  {lang === "fa" ? t.fa : t.en}
                </span>
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="text-primary"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
        <p className="px-2 pb-1 pt-2 text-[10px] text-muted-foreground">
          {lang === "fa" ? "کلید T برای چرخش سریع تم‌ها" : "Press T to cycle themes"}
        </p>
      </PopoverContent>
    </Popover>
  );
}
