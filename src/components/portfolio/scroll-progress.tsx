"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{
        scaleX,
        background: "linear-gradient(to left, var(--scroll-color-from, var(--gfx-1)), var(--scroll-color-to, var(--sec-1)))",
      }}
      className="fixed left-0 right-0 top-0 z-[90] h-[3px] origin-left transition-[background] duration-500"
    />
  );
}
