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
    const startedAt = performance.now();
    let cssWidth = 0;
    let cssHeight = 0;
    let resolution = 1;
    let desiredPixelWidth = 0;
    let desiredPixelHeight = 0;
    let frame = 0;
    let lastPaint = 0;
    let averageCost = 0;
    let deferUntil = 0;
    let resumeTimer: number | undefined;
    let readyTimer: number | undefined;
    let disposed = false;
    let worker: Worker | null = null;

    function fallback() {
      if (disposed || !worker) return;
      worker.terminate();
      worker = null;
      window.clearTimeout(readyTimer);
      canvas!.dataset.renderer = "main";
      cssWidth = 0;
      cssHeight = 0;
      resize();
      syncAnimation();
    }

    // A worker renders into its own OffscreenCanvas and transfers ImageBitmaps.
    // The visible canvas remains 2D, so screenshots, static fallback and
    // existing accessibility/visual tests still work without special modes.
    try {
      if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
        const candidate = new Worker(new URL("./aurora.worker.ts", import.meta.url), { type: "module" });
        worker = candidate;
        canvas.dataset.renderer = "worker";
        readyTimer = window.setTimeout(() => fallback(), 4500);
        candidate.onmessage = (event: MessageEvent<{ type: string; bitmap?: ImageBitmap }>) => {
          if (disposed || worker !== candidate || event.data.type !== "frame" || !event.data.bitmap) return;
          const bitmap = event.data.bitmap;
          window.clearTimeout(readyTimer);
          try {
            if (canvas.width !== desiredPixelWidth || canvas.height !== desiredPixelHeight) {
              canvas.width = desiredPixelWidth;
              canvas.height = desiredPixelHeight;
            }
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          } finally {
            bitmap.close();
            candidate.postMessage({ type: "ack" });
          }
        };
        candidate.onerror = (event) => {
          event.preventDefault();
          fallback();
        };
        candidate.onmessageerror = () => fallback();
      } else {
        canvas.dataset.renderer = "main";
      }
    } catch {
      canvas.dataset.renderer = "main";
    }

    function paintFallback(time: number) {
      if (worker || cssWidth <= 0 || cssHeight <= 0) return;
      drawCurtains(context!, cssWidth, cssHeight, time, mobile.matches);
    }

    function resize() {
      const width = canvas!.clientWidth;
      const height = canvas!.clientHeight;
      if (width <= 0 || height <= 0) return;
      const budget = mobile.matches ? 600_000 : 1_000_000;
      const pixelCap = mobile.matches ? 1.35 : 1;
      const ratio = Math.min(window.devicePixelRatio || 1, pixelCap,
        Math.sqrt(budget / Math.max(1, width * height)));
      const changed = width !== cssWidth || height !== cssHeight || ratio !== resolution;
      cssWidth = width;
      cssHeight = height;
      resolution = ratio;
      desiredPixelWidth = Math.max(1, Math.round(width * ratio));
      desiredPixelHeight = Math.max(1, Math.round(height * ratio));
      if (changed) {
        if (worker) {
          worker.postMessage({ type: "resize", width, height, pixelRatio: ratio, mobile: mobile.matches });
        } else {
          canvas!.width = desiredPixelWidth;
          canvas!.height = desiredPixelHeight;
          context!.setTransform(ratio, 0, 0, ratio, 0, 0);
        }
      }
      if (!worker) paintFallback(reducedMotion.matches ? 0 : (performance.now() - startedAt) / 1000);
    }

    function tick(now: number) {
      if (worker || disposed) return;
      if (now >= deferUntil) {
        const minimum = mobile.matches ? 1000 / 14 : 1000 / 18;
        const interval = Math.max(minimum, Math.min(1000 / 9, averageCost * 3));
        if (now - lastPaint >= interval) {
          const begin = performance.now();
          paintFallback((now - startedAt) / 1000);
          const cost = performance.now() - begin;
          averageCost = averageCost ? averageCost * .75 + cost * .25 : cost;
          lastPaint = now;
        }
      }
      frame = window.requestAnimationFrame(tick);
    }

    function syncAnimation() {
      window.cancelAnimationFrame(frame);
      resize();
      if (worker) {
        worker.postMessage({
          type: reducedMotion.matches || document.visibilityState !== "visible" ? "pause" : "resume",
          staticFrame: reducedMotion.matches,
        });
      } else if (!reducedMotion.matches && document.visibilityState === "visible") {
        lastPaint = 0;
        averageCost = 0;
        frame = window.requestAnimationFrame(tick);
      }
    }

    function yieldToUser() {
      const now = performance.now();
      const alreadyYielding = now < deferUntil;
      deferUntil = now + 320;
      if (!alreadyYielding) worker?.postMessage({ type: "pause" });
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        if (worker && document.visibilityState === "visible" && !reducedMotion.matches) {
          worker.postMessage({ type: "resume" });
        }
      }, 330);
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
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resumeTimer);
      window.clearTimeout(readyTimer);
      worker?.terminate();
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
