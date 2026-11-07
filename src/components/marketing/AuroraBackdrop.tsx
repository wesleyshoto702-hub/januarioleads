import { useEffect, useRef } from "react";

/**
 * Crimson Aurora, adapted from the supplied "Crimson Aurora SaaS Background".
 *
 * Unlike the former filament renderer, this draws only four filled ribbons
 * with a handful of gradients, plus a small particle field. No CDN, React
 * frame-by-frame state, global animation flag, or permanently running timer.
 */
type Color = Readonly<{ r: number; g: number; b: number; a: number }>;
type Ribbon = Readonly<{
  baseY: number;
  amplitude: number;
  frequency: number;
  speed: number;
  color: number;
  blend: GlobalCompositeOperation;
}>;
type Particle = {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  opacity: number;
  pulse: number;
};

const CRIMSON: readonly Color[] = [
  { r: 244, g: 63, b: 94, a: .35 },
  { r: 225, g: 29, b: 72, a: .45 },
  { r: 159, g: 18, b: 57, a: .30 },
  { r: 251, g: 113, b: 133, a: .15 },
];

const RIBBONS: readonly Ribbon[] = [
  { baseY: .25, amplitude: 70, frequency: .0020, speed: .7, color: 0, blend: "screen" },
  { baseY: .38, amplitude: 95, frequency: .0016, speed: .5, color: 1, blend: "lighter" },
  { baseY: .50, amplitude: 110, frequency: .0012, speed: .9, color: 2, blend: "screen" },
  { baseY: .32, amplitude: 60, frequency: .0025, speed: 1.2, color: 3, blend: "lighter" },
];

function rgba(color: Color, alpha: number): string {
  return "rgba(" + Math.round(color.r) + "," + Math.round(color.g) + "," +
    Math.round(color.b) + "," + Math.min(1, Math.max(0, alpha)) + ")";
}

function makeParticles(width: number, height: number, mobile: boolean): Particle[] {
  // The original HTML uses 70 glowing stars, all with a shadow blur.
  // A smaller field with inexpensive solid halos retains the atmosphere.
  return Array.from({ length: mobile ? 24 : 45 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: .5 + Math.random() * 1.5,
    speedY: .1 + Math.random() * .3,
    speedX: (Math.random() - .5) * .2,
    opacity: .2 + Math.random() * .7,
    pulse: Math.random() * Math.PI * 2,
  }));
}

function drawCrimsonAurora(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  mouse: Readonly<{ x: number; y: number }>,
  particles: Particle[],
  step: number,
  mobile: boolean,
) {
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;

  const centerX = width * .5 + (mouse.x - .5) * 100;
  const centerY = height * .35 + (mouse.y - .5) * 80;
  const radius = Math.max(width, height) * .65;
  const ambient = context.createRadialGradient(
    centerX, centerY, 50, centerX, centerY, radius,
  );
  ambient.addColorStop(0, rgba(CRIMSON[1]!, .22));
  ambient.addColorStop(.4, "rgba(135,0,20,.12)");
  ambient.addColorStop(1, "#050102");
  context.fillStyle = ambient;
  context.fillRect(0, 0, width, height);

  const segments = mobile ? 24 : 36;
  const segmentWidth = width / segments;
  for (const ribbon of RIBBONS) {
    const shade = CRIMSON[ribbon.color]!;
    const alpha = shade.a;
    context.save();
    context.globalCompositeOperation = ribbon.blend;
    context.beginPath();
    const startY = ribbon.baseY * height + Math.sin(time * ribbon.speed) * 20;
    context.moveTo(0, height);
    context.lineTo(0, startY);

    for (let i = 0; i <= segments; i++) {
      const x = i * segmentWidth;
      const wave1 = Math.sin(x * ribbon.frequency + time * ribbon.speed) * ribbon.amplitude;
      const wave2 = Math.cos(x * ribbon.frequency * 1.7 - time * ribbon.speed * .8) * ribbon.amplitude * .5;
      const wave3 = Math.sin(x * .001 + time * .2) * 40;
      const influence = Math.sin((x / width - mouse.x) * Math.PI * 2) * (mouse.y - .5) * 60;
      context.lineTo(x, ribbon.baseY * height + wave1 + wave2 + wave3 + influence);
    }
    context.lineTo(width, height);
    context.closePath();

    const gradient = context.createLinearGradient(
      0, (ribbon.baseY - .25) * height, 0, height,
    );
    gradient.addColorStop(0, rgba(shade, 0));
    gradient.addColorStop(.3, rgba(shade, alpha * .8));
    gradient.addColorStop(.7, rgba({
      r: shade.r * .7, g: shade.g * .1, b: shade.b * .2, a: shade.a,
    }, alpha * .4));
    gradient.addColorStop(1, "rgba(5,1,2,0)");
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = rgba(shade, alpha * .45);
    context.lineWidth = mobile ? 1 : 1.5;
    context.stroke();
    context.restore();
  }

  context.globalCompositeOperation = "source-over";
  // No per-particle shadowBlur: this would repeatedly rasterize many filters.
  for (const particle of particles) {
    if (step > 0) {
      particle.x += particle.speedX * step;
      particle.y -= particle.speedY * step;
      particle.pulse += .03 * step;
      if (particle.y < -2) particle.y = height + 2;
      if (particle.x < -2) particle.x = width + 2;
      if (particle.x > width + 2) particle.x = -2;
    }
    const opacity = (Math.sin(particle.pulse) * .4 + .6) * particle.opacity;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius * 2.2, 0, Math.PI * 2);
    context.fillStyle = "rgba(244,63,94," + (opacity * .09) + ")";
    context.fill();
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(254,205,211," + opacity + ")";
    context.fill();
  }
}

export function AuroraBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 700px)");
    const startedAt = performance.now();

    let width = 0;
    let height = 0;
    let ratio = 1;
    let particles: Particle[] = [];
    let frame = 0;
    let lastDrawAt = 0;
    let averageCost = 0;
    let yieldUntil = 0;
    let disposed = false;
    const mouse = { x: .5, y: .5, targetX: .5, targetY: .5 };

    function resizeCanvas() {
      const nextWidth = canvas!.clientWidth;
      const nextHeight = canvas!.clientHeight;
      if (nextWidth <= 0 || nextHeight <= 0) return false;

      const small = mobile.matches;
      // The reference's devicePixelRatio=2 can quadruple pixel work.
      // The effect is deliberately soft, so a bounded backing buffer suffices.
      const pixelBudget = small ? 600_000 : 900_000;
      const nextRatio = Math.min(
        window.devicePixelRatio || 1,
        small ? 1.25 : 1.1,
        Math.sqrt(pixelBudget / Math.max(1, nextWidth * nextHeight)),
      );
      const changed = width !== nextWidth || height !== nextHeight || ratio !== nextRatio;
      if (!changed) return true;

      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio;
      canvas!.width = Math.max(1, Math.round(width * ratio));
      canvas!.height = Math.max(1, Math.round(height * ratio));
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = makeParticles(width, height, small);
      return true;
    }

    function paint(now: number, animated: boolean) {
      if (!width || !height) return;
      const elapsed = lastDrawAt ? Math.min(3, (now - lastDrawAt) / (1000 / 60)) : 0;
      const easing = animated ? Math.min(.3, .05 * elapsed) : 0;
      mouse.x += (mouse.targetX - mouse.x) * easing;
      mouse.y += (mouse.targetY - mouse.y) * easing;
      drawCrimsonAurora(
        context!, width, height,
        animated ? (now - startedAt) / 1000 * .9 : 0,
        mouse, particles, animated ? elapsed : 0, mobile.matches,
      );
      lastDrawAt = now;
    }

    function tick(now: number) {
      if (disposed || motion.matches || document.visibilityState !== "visible") return;
      // Decorative work always yields while users scroll, type or tap.
      if (now >= yieldUntil) {
        const baseInterval = mobile.matches ? 1000 / 15 : 1000 / 22;
        const interval = Math.max(baseInterval, Math.min(1000 / 9, averageCost * 3));
        if (now - lastDrawAt >= interval) {
          const began = performance.now();
          paint(now, true);
          const cost = performance.now() - began;
          averageCost = averageCost ? averageCost * .8 + cost * .2 : cost;
        }
      }
      frame = window.requestAnimationFrame(tick);
    }

    function sync() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      if (document.visibilityState !== "visible") return;
      if (!resizeCanvas()) return;
      lastDrawAt = 0;
      averageCost = 0;
      paint(performance.now(), !motion.matches);
      if (!motion.matches) frame = window.requestAnimationFrame(tick);
    }

    function onPointerMove(event: PointerEvent) {
      // This changes only small JS variables, never React state or layout.
      mouse.targetX = Math.min(1, Math.max(0, event.clientX / Math.max(1, window.innerWidth)));
      mouse.targetY = Math.min(1, Math.max(0, event.clientY / Math.max(1, window.innerHeight)));
    }

    function yieldToInput() {
      yieldUntil = performance.now() + 320;
    }

    window.addEventListener("resize", sync, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", yieldToInput, { passive: true });
    window.addEventListener("wheel", yieldToInput, { passive: true });
    window.addEventListener("touchmove", yieldToInput, { passive: true });
    window.addEventListener("pointerdown", yieldToInput, { passive: true });
    window.addEventListener("keydown", yieldToInput, { passive: true });
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    sync();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", yieldToInput);
      window.removeEventListener("wheel", yieldToInput);
      window.removeEventListener("touchmove", yieldToInput);
      window.removeEventListener("pointerdown", yieldToInput);
      window.removeEventListener("keydown", yieldToInput);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      mobile.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div className="jl-aurora" data-ambient="crimson-ribbons" aria-hidden="true">
      <canvas ref={canvasRef} className="jl-aurora-canvas" data-aurora-engine="crimson-canvas" />
    </div>
  );
}
