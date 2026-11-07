/** Shared, deterministic aurora canvas renderer for worker and fallback. */
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

export function drawCurtains(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
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

