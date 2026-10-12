"use client";

import { useEffect, useRef, type ReactNode } from "react";

/* MagneticButton — wraps a child and makes it "attract" toward the cursor
   within a radius, with a smooth lerp. Falls back to a normal element on touch. */
export function MagneticButton({
  children,
  strength = 0.35,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
  as?: "div" | "button" | "a";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    let raf = 0;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      target.x = (e.clientX - cx) * strength;
      target.y = (e.clientY - cy) * strength;
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
    };
    const loop = () => {
      current.x += (target.x - current.x) * 0.15;
      current.y += (target.y - current.y) * 0.15;
      el.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    el.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [strength]);

  const Comp = Tag as any;
  return (
    <Comp ref={ref as any} className={className} style={{ willChange: "transform", display: "inline-block" }}>
      {children}
    </Comp>
  );
}
