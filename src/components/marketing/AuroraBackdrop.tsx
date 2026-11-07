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
  phase: number;
  speed: number;
  brightness: number;
};

const CURTAINS: readonly Curtain[] = [
  { top: .16, length: .42, phase: .4, speed: .69, brightness: 1 },
  { top: .34, length: .29, phase: 2.3, speed: -.57, brightness: .72 },
  { top: .07, length: .25, phase: 4.8, speed: .43, brightness: .48 },
];

function flowingWave(x: number, time: number, phase: number, speed: number) {
  return (
    Math.sin(x * 7.2 + time * speed * .27 + phase) * .54 +
    Math.sin(x * 13.7 - time * speed * .38 + phase * 1.8) * .30 +
    Math.sin(x * 27.3 + time * speed * .15 + phase * 2.4) * .16
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
  const spacing = mobile ? 10 : 7;
  const rayCount = Math.ceil(width / spacing);

  for (let layer = CURTAINS.length - 1; layer >= 0; layer--) {
    const curtain = CURTAINS[layer];

    // Narrow vertical light rays form an undulating, torn aurora curtain.
    // Every ray has a different height and bend; the shape continuously changes.
    for (let index = 0; index <= rayCount; index++) {
      const x = index * spacing;
      const u = x / width;
      const wave = flowingWave(u, time, curtain.phase, curtain.speed);
      const micro = Math.sin(u * 89 + time * .16 + curtain.phase * 3.4);
      const envelope = .36 + .64 * (.5 + .5 * Math.sin(u * 10.1 + curtain.phase + time * .085));
      const flicker = .79 + .21 * Math.sin(u * 53 + time * .26 + curtain.phase);
      const rayOpacity = curtain.brightness * envelope * flicker;

      const startY = height * (curtain.top + wave * .105);
      const curtainLength = height * curtain.length * (.72 + .2 * wave + .1 * micro);
      const endY = Math.min(height * .82, startY + curtainLength);
      if (endY <= startY + 5) continue;

      const bend = Math.sin(u * 11.5 - time * curtain.speed * .26 + curtain.phase) * width * .027;
      const shift = Math.sin(u * 24.3 + time * .13 + curtain.phase) * width * .009;
      const gradient = context.createLinearGradient(x, startY, x, endY);
      gradient.addColorStop(0, "rgba(160, 5, 22, 0)");
      gradient.addColorStop(.14, "rgba(196, 11, 30, .18)");
      gradient.addColorStop(.38, "rgba(248, 32, 48, .73)");
      gradient.addColorStop(.61, "rgba(223, 15, 38, .37)");
      gradient.addColorStop(1, "rgba(112, 0, 18, 0)");

      context.beginPath();
      context.moveTo(x + shift, startY);
      context.bezierCurveTo(
        x + shift + bend * .15, startY + curtainLength * .27,
        x + shift - bend * .63, startY + curtainLength * .66,
        x + shift + bend, endY,
      );
      context.strokeStyle = gradient;
      context.lineCap = "round";
      // Halo + narrow filament: luminosity without painting the whole viewport.
      context.lineWidth = spacing * (mobile ? 2 : 2.2);
      context.globalAlpha = .055 * rayOpacity;
      context.stroke();
      context.lineWidth = mobile ? 2.1 : 2.8;
      context.globalAlpha = .36 * rayOpacity;
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

    function paint(time: number) {
      const width = canvas!.clientWidth;
      const height = canvas!.clientHeight;
      if (width <= 0 || height <= 0) return;
      drawCurtains(context!, width, height, time, mobile.matches);
    }

    function resize() {
      const width = canvas!.clientWidth;
      const height = canvas!.clientHeight;
      const resolution = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas!.width = Math.max(1, Math.round(width * resolution));
      canvas!.height = Math.max(1, Math.round(height * resolution));
      context!.setTransform(resolution, 0, 0, resolution, 0, 0);
      paint(reducedMotion.matches ? 0 : (performance.now() - startedAt) / 1000);
    }

    function tick(now: number) {
      if (now - lastPaint >= (mobile.matches ? 1000 / 18 : 1000 / 24)) {
        paint((now - startedAt) / 1000);
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
        frame = window.requestAnimationFrame(tick);
      }
    }

    window.addEventListener("resize", syncAnimation, { passive: true });
    document.addEventListener("visibilitychange", syncAnimation);
    reducedMotion.addEventListener("change", syncAnimation);
    mobile.addEventListener("change", syncAnimation);
    syncAnimation();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncAnimation);
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotion.removeEventListener("change", syncAnimation);
      mobile.removeEventListener("change", syncAnimation);
    };
  }, []);

  return (
    <div className="jl-aurora" aria-hidden="true" data-ambient="aurora">
      <canvas ref={canvasRef} className="jl-aurora-canvas" />
    </div>
  );
}
