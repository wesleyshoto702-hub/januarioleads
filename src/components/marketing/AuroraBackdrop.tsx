import { useEffect, useRef } from "react";

/**
 * A restrained, real-time northern-lights curtain drawn BEHIND the public site.
 * No images, particles, canvas interaction, network calls or CRM dependencies.
 * Unlike full-screen gradient washes, light is confined to irregular red ribbons,
 * so the page remains predominantly black and text colors stay untouched.
 */

type Curtain = {
  top: number;
  length: number;
  center: number;
  spread: number;
  phase: number;
  speed: number;
  brightness: number;
};

// Localized, independently drifting ribbons leave black gaps between them.
// The last two bands intentionally illuminate the lower half of the viewport.
const CURTAINS: readonly Curtain[] = [
  { top: .07, length: .24, center: .18, spread: .31, phase: .4, speed: 1.72, brightness: 1.02 },
  { top: .18, length: .30, center: .77, spread: .30, phase: 1.9, speed: -1.14, brightness: .84 },
  { top: .34, length: .34, center: .39, spread: .29, phase: 3.6, speed: 1.48, brightness: .78 },
  { top: .52, length: .28, center: .76, spread: .27, phase: 5.2, speed: -.92, brightness: .74 },
  { top: .66, length: .22, center: .21, spread: .28, phase: 6.7, speed: 1.18, brightness: .65 },
];

function flowingWave(x: number, time: number, phase: number, speed: number) {
  return (
    Math.sin(x * 8.7 + time * speed * .62 + phase) * .48 +
    Math.sin(x * 15.6 - time * speed * .91 + phase * 1.7) * .24 +
    Math.sin(x * 32.5 + time * speed * .41 + phase * 2.9) * .16 +
    Math.sin(x * 61 - time * speed * .22 + phase * 4.2) * .09
  );
}

function drawCurtains(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  mobile: boolean,
) {
  context.clearRect(0, 0, width, height);
  // An aurora moves slowly: fewer, wider overlapping rays retain its soft
  // curtains while avoiding thousands of Canvas strokes per second.
  const spacing = mobile ? 16 : 12;
  const rayCount = Math.ceil(width / spacing);
  context.lineCap = "round";

  for (let layer = CURTAINS.length - 1; layer >= 0; layer--) {
    const curtain = CURTAINS[layer];
    if (!curtain) continue;
    // The horizontal envelope drifts at the curtain's speed, not the ray's.
    // Compute it once per curtain instead of recalculating it for every ray.
    const centerDrift = Math.sin(time * curtain.speed * .19 + curtain.phase) * .06;
    // Neighboring rays share the same vertical color palette. Reusing it over
    // four nearby filaments avoids rebuilding five gradient stops per ray.
    let nearbyGradient: CanvasGradient | null = null;
    let raysUsingGradient = 0;

    // Narrow vertical light rays form an undulating, torn aurora curtain.
    // Every ray has a different height and bend; the shape continuously changes.
    for (let index = 0; index <= rayCount; index++) {
      const x = index * spacing;
      const u = x / width;
      // Most outer rays are almost transparent. Skip them before evaluating
      // four trigonometric waves, shape bends, gradients and three strokes.
      const distance = (u - curtain.center - centerDrift) / curtain.spread;
      if (Math.abs(distance) > 1.32) continue;
      const separation = Math.exp(-Math.pow(distance, 4) * 1.25);
      if (separation < .025) continue;
      const wave = flowingWave(u, time, curtain.phase, curtain.speed);
      const micro = Math.sin(u * 103 + time * curtain.speed * .42 + curtain.phase * 3.9);
      // Small independent ripples, not global canvas jitter. Signed speeds let
      // neighboring curtains and individual filaments drift against one another.
      const twitch = Math.sin(u * 171 - time * curtain.speed * 1.8 + curtain.phase * 5.2) * .06;
      const envelope = .28 + .72 * (.5 + .5 * Math.sin(u * 12.8 + curtain.phase + time * curtain.speed * .24));
      const flicker = .68 + .32 * Math.sin(u * 67 + time * curtain.speed * 1.1 + curtain.phase * 1.4);
      // A localized bell-shaped envelope makes each band distinct instead
      // of drawing five overlapping full-width red blankets.
      const rayOpacity = curtain.brightness * envelope * flicker * separation;

      const startY = height * (curtain.top + wave * .095 + twitch * .65);
      const curtainLength = height * curtain.length * (.74 + .24 * wave + .16 * micro + .08 * twitch);
      const endY = Math.min(height * .98, startY + curtainLength);
      if (endY <= startY + 8) continue;

      const bend = Math.sin(u * 15.5 - time * curtain.speed * .72 + curtain.phase) * width * .04;
      const shift =
        Math.sin(u * 27.5 + time * curtain.speed * .55 + curtain.phase) * width * .014 +
        Math.sin(u * 59 - time * curtain.speed * .92 + curtain.phase * 2.4) * width * .006;
      if (raysUsingGradient === 0 || !nearbyGradient) {
        nearbyGradient = context.createLinearGradient(x, startY, x, endY);
        nearbyGradient.addColorStop(0, "rgba(160, 5, 22, 0)");
        nearbyGradient.addColorStop(.14, "rgba(196, 11, 30, .23)");
        nearbyGradient.addColorStop(.38, "rgba(248, 32, 48, .85)");
        nearbyGradient.addColorStop(.61, "rgba(223, 15, 38, .47)");
        nearbyGradient.addColorStop(1, "rgba(112, 0, 18, 0)");
        raysUsingGradient = 4;
      }
      raysUsingGradient--;

      context.beginPath();
      context.moveTo(x + shift, startY);
      context.bezierCurveTo(
        x + shift + bend * .15, startY + curtainLength * .27,
        x + shift - bend * .63, startY + curtainLength * .66,
        x + shift + bend, endY,
      );
      context.strokeStyle = nearbyGradient;
      // Halo + narrow filament: luminosity without painting the whole viewport.
      // A broad but translucent halo emulates the soft CSS gradients from
      // the reference without washing the entire background red.
      context.lineWidth = spacing * 6.3;
      context.globalAlpha = Math.min(.9, .18 * rayOpacity);
      context.stroke();
      // A halo and a bright filament supply depth without a third full
      // Canvas stroke for every ray. Their visual span overlaps adjacent rays.
      context.lineWidth = mobile ? 4.6 : 5.1;
      context.globalAlpha = Math.min(.92, .88 * rayOpacity);
      context.stroke();
    }
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
}

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
