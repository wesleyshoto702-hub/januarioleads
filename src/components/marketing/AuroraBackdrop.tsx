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
  { top: .10, length: .44, phase: .4, speed: 1.55, brightness: 1.18 },
  { top: .24, length: .33, phase: 2.2, speed: -1.28, brightness: .92 },
  { top: .04, length: .28, phase: 4.7, speed: 1.92, brightness: .72 },
  { top: .18, length: .22, phase: 6.1, speed: -.96, brightness: .58 },
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
      const micro = Math.sin(u * 103 + time * curtain.speed * .42 + curtain.phase * 3.9);
      // Small independent ripples, not global canvas jitter. Signed speeds let
      // neighboring curtains and individual filaments drift against one another.
      const twitch = Math.sin(u * 171 - time * curtain.speed * 1.8 + curtain.phase * 5.2) * .06;
      const envelope = .28 + .72 * (.5 + .5 * Math.sin(u * 12.8 + curtain.phase + time * curtain.speed * .24));
      const flicker = .68 + .32 * Math.sin(u * 67 + time * curtain.speed * 1.1 + curtain.phase * 1.4);
      const rayOpacity = curtain.brightness * envelope * flicker;

      const startY = height * (curtain.top + wave * .125 + twitch);
      const curtainLength = height * curtain.length * (.68 + .25 * wave + .16 * micro + .08 * twitch);
      const endY = Math.min(height * .86, startY + curtainLength);
      if (endY <= startY + 8) continue;

      const bend = Math.sin(u * 15.5 - time * curtain.speed * .72 + curtain.phase) * width * .04;
      const shift =
        Math.sin(u * 27.5 + time * curtain.speed * .55 + curtain.phase) * width * .014 +
        Math.sin(u * 59 - time * curtain.speed * .92 + curtain.phase * 2.4) * width * .006;
      const gradient = context.createLinearGradient(x, startY, x, endY);
      gradient.addColorStop(0, "rgba(160, 5, 22, 0)");
      gradient.addColorStop(.14, "rgba(196, 11, 30, .23)");
      gradient.addColorStop(.38, "rgba(248, 32, 48, .85)");
      gradient.addColorStop(.61, "rgba(223, 15, 38, .47)");
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
      // A broad but translucent halo emulates the soft CSS gradients from
      // the reference without washing the entire background red.
      context.lineWidth = spacing * 6.3;
      context.globalAlpha = Math.min(.9, .18 * rayOpacity);
      context.stroke();
      context.lineWidth = spacing * 3;
      context.globalAlpha = Math.min(.9, .34 * rayOpacity);
      context.stroke();
      // Brighter filament, still bounded so the site stays predominantly black.
      context.lineWidth = mobile ? 3.8 : 4.8;
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
      if (now - lastPaint >= (mobile.matches ? 1000 / 26 : 1000 / 38)) {
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
      <span className="jl-aurora-wisp jl-aurora-wisp--left" />
      <span className="jl-aurora-wisp jl-aurora-wisp--right" />
      <canvas ref={canvasRef} className="jl-aurora-canvas" />
    </div>
  );
}
