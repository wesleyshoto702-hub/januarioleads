import { useEffect, useRef } from "react";
import { drawCurtains } from "./aurora-draw";

/**
 * A restrained, real-time northern-lights curtain drawn BEHIND the public site.
 * No network calls or CRM dependencies.
 */

export function AuroraBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 700px)");
    let frame = 0;
    let lastPaint = 0;
    const startedAt = performance.now();
    // Avoid querying layout twice on every animation frame. Canvas dimensions
    // only change on resize/zoom (or media-query changes), never per stroke.
    let cssWidth = 0;
    let cssHeight = 0;
    let lastRatio = 0;
    // Base cadence is deliberately below a 60 Hz display refresh because
    // diffuse northern lights do not need 38 full-canvas repaints per second.
    // When drawing gets expensive, the cadence backs off automatically.
    let frameInterval = mobile.matches ? 1000 / 14 : 1000 / 18;
    let averagePaintCost = 0;
    let deferPaintingUntil = 0;

    // Interactions take priority over decorative animation. A wheel, swipe,
    // keyboard action or pointer press temporarily yields the main thread so
    // scrolling, input and button feedback remain responsive.
    function yieldToUser() {
      deferPaintingUntil = performance.now() + 300;
    }

    function paint(time: number) {
      if (cssWidth <= 0 || cssHeight <= 0) return;
      drawCurtains(context!, cssWidth, cssHeight, time, mobile.matches);
    }

    function resize() {
      const width = canvas!.clientWidth;
      const height = canvas!.clientHeight;
      // The effect is intentionally diffuse. Rendering 4+ million physical
      // pixels on large retina desktops wastes fill-rate without visible gain.
      const pixelBudget = mobile.matches ? 600_000 : 1_000_000;
      const pixelRatioBudget = Math.sqrt(pixelBudget / Math.max(1, width * height));
      const pixelRatioCap = mobile.matches ? 1.35 : 1;
      const resolution = Math.min(window.devicePixelRatio || 1, pixelRatioCap, pixelRatioBudget);
      if (width <= 0 || height <= 0) {
        cssWidth = 0;
        cssHeight = 0;
        return;
      }
      if (width !== cssWidth || height !== cssHeight || resolution !== lastRatio) {
        cssWidth = width;
        cssHeight = height;
        lastRatio = resolution;
        canvas!.width = Math.max(1, Math.round(width * resolution));
        canvas!.height = Math.max(1, Math.round(height * resolution));
        context!.setTransform(resolution, 0, 0, resolution, 0, 0);
      }
      paint(reducedMotion.matches ? 0 : (performance.now() - startedAt) / 1000);
    }

    function tick(now: number) {
      if (now < deferPaintingUntil) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      if (now - lastPaint >= frameInterval) {
        const beganAt = performance.now();
        paint((now - startedAt) / 1000);
        const paintCost = performance.now() - beganAt;
        averagePaintCost = averagePaintCost
          ? averagePaintCost * .75 + paintCost * .25
          : paintCost;
        const baseInterval = mobile.matches ? 1000 / 19 : 1000 / 24;
        // Protect input/scroll responsiveness if software Canvas becomes slow.
        frameInterval = Math.max(baseInterval, Math.min(1000 / 9, averagePaintCost * 3));
        lastPaint = now;
      }
      frame = window.requestAnimationFrame(tick);
    }

    function syncAnimation() {
      window.cancelAnimationFrame(frame);
      resize();
      // Pause when offscreen/tab hidden or user requests reduced motion.
      if (!reducedMotion.matches && document.visibilityState === "visible") {
        lastPaint = 0;
        averagePaintCost = 0;
        frameInterval = mobile.matches ? 1000 / 19 : 1000 / 24;
        frame = window.requestAnimationFrame(tick);
      }
    }

    window.addEventListener("resize", syncAnimation, { passive: true });
    window.addEventListener("scroll", yieldToUser, { passive: true });
    window.addEventListener("wheel", yieldToUser, { passive: true });
    window.addEventListener("touchmove", yieldToUser, { passive: true });
    window.addEventListener("pointerdown", yieldToUser, { passive: true });
    window.addEventListener("keydown", yieldToUser, { passive: true });
    document.addEventListener("visibilitychange", syncAnimation);
    reducedMotion.addEventListener("change", syncAnimation);
    mobile.addEventListener("change", syncAnimation);
    syncAnimation();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncAnimation);
      window.removeEventListener("scroll", yieldToUser);
      window.removeEventListener("wheel", yieldToUser);
      window.removeEventListener("touchmove", yieldToUser);
      window.removeEventListener("pointerdown", yieldToUser);
      window.removeEventListener("keydown", yieldToUser);
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotion.removeEventListener("change", syncAnimation);
      mobile.removeEventListener("change", syncAnimation);
    };
  }, []);

  return (
    <div className="jl-aurora" aria-hidden="true" data-ambient="aurora">
      <span className="jl-aurora-wisp jl-aurora-wisp--left" />
      <span className="jl-aurora-wisp jl-aurora-wisp--right" />
      <span className="jl-aurora-wisp jl-aurora-wisp--lower-left" />
      <span className="jl-aurora-wisp jl-aurora-wisp--lower-right" />
      <canvas ref={canvasRef} className="jl-aurora-canvas" />
    </div>
  );
}
