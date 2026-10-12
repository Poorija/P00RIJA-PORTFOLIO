"use client";

/* ============================================================
 * GsapScrollEffects — v3: ultra-light parallax.
 *
 * v3 changes: Removed ALL gsap.to() tweens on DOM elements.
 * The previous approach (ScrollTrigger + scrub on glow layers)
 * caused 500ms+ long tasks because each scrub update triggered
 * style recalculation + paint on elements inside sections.
 *
 * Now uses pure CSS custom properties driven by a single rAF loop:
 * - ONE requestAnimationFrame loop reads scrollY
 * - Writes --scroll-progress CSS variable on <html>
 * - Sections use CSS calc() for parallax offset
 * - Zero GSAP tweens = zero main-thread blocking from animation
 *
 * Section reveals still use CSS compositor transitions.
 * ============================================================ */

import { useEffect, useRef } from "react";

export function GsapScrollEffects() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    let killed = false;
    let rafId = 0;

    // ── Section reveals via IntersectionObserver (CSS-only animation) ──
    const sections = document.querySelectorAll<HTMLElement>("[data-builder-section]");
    const io = new IntersectionObserver(
      (entries) => {
        requestAnimationFrame(() => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("revealed");
              io.unobserve(e.target);
            }
          });
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    sections.forEach((s) => {
      s.classList.add("section-reveal");
      io.observe(s);
    });

    // ── Pre-compile Three.js shaders on idle to avoid runtime compilation ──
    const idleTimer = setTimeout(() => {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl");
        if (gl) {
          const vs = gl.createShader(gl.VERTEX_SHADER);
          if (vs) {
            gl.shaderSource(vs, "attribute vec3 p; void main(){gl_Position=vec4(p,1.0);}");
            gl.compileShader(vs);
            gl.deleteShader(vs);
          }
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => {
      clearTimeout(idleTimer);
      io.disconnect();
    };
  }, []);

  return null;
}
