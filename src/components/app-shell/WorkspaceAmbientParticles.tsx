import { useEffect, useRef } from "react";
import type { AccentColor } from "../../features/settings/user-settings";

/**
 * Adapted from the user's connected-particles HTML reference.
 * Decoration only: always behind application content, never in navigation.
 */
export function WorkspaceAmbientParticles({
  accentColor,
  reduceMotion,
}: {
  accentColor: AccentColor;
  reduceMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let color = { r: 241, g: 45, b: 70 };
    let particles: Array<{x:number;y:number;vx:number;vy:number;r:number}> = [];

    function readThemeColor() {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--primary").trim();
      const hex = /^#([0-9a-f]{6})$/i.exec(raw);
      if (hex) {
        const value = hex[1]!;
        color = { r: parseInt(value.slice(0, 2), 16),
          g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
        return;
      }
      const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(raw);
      if (rgb) color = { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Responsive density is intentionally lower than the reference demo.
      const count = Math.min(width < 640 ? 22 : 54, Math.max(14, Math.floor(width / 24)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: 1.1 + Math.random() * 1.0,
      }));
      draw(false);
    }

    function draw(move: boolean) {
      context!.clearRect(0, 0, width, height); // Never paint over the workspace background.
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (move) {
          p.x = (p.x + p.vx + width) % width;
          p.y = (p.y + p.vy + height) % height;
        }
        context!.beginPath();
        context!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        context!.fillStyle = `rgba(${color.r},${color.g},${color.b},0.65)`;
        context!.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]!;
          const distance = Math.hypot(p.x - q.x, p.y - q.y);
          if (distance >= 145) continue;
          context!.beginPath();
          context!.moveTo(p.x, p.y);
          context!.lineTo(q.x, q.y);
          context!.lineWidth = 0.85;
          context!.strokeStyle = `rgba(${color.r},${color.g},${color.b},${(1-distance/145)*0.28})`;
          context!.stroke();
        }
      }
    }

    const motionAllowed = () => !reduceMotion && !media.matches && !document.hidden;
    function tick() {
      if (!motionAllowed()) { frame = 0; return; }
      draw(true);
      frame = requestAnimationFrame(tick);
    }
    function updateMotion() {
      cancelAnimationFrame(frame);
      frame = 0;
      draw(false);
      if (motionAllowed()) frame = requestAnimationFrame(tick);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    // Theme class/attribute is assigned by the authenticated route on mount.
    // A rAF sees the final CSS variable after React's effects have finished.
    const setup = requestAnimationFrame(() => {
      readThemeColor();
      resize();
      updateMotion();
    });
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateMotion);
    return () => {
      cancelAnimationFrame(setup);
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateMotion);
    };
  }, [accentColor, reduceMotion]);

  // When the user removes animations, do not render particles at all.
  return reduceMotion ? null : <canvas ref={canvasRef} className="jl-workspace-ambient-particles"
    aria-hidden="true" role="presentation" data-accent={accentColor} />;
}
