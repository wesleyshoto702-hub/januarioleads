import type { CSSProperties } from "react";

/**
 * Decorative, deterministic CSS-only ambient motion for public Januário Leads pages.
 *
 * No canvas, timers, random values, pointer listeners or external resources.
 * Animations are disabled for prefers-reduced-motion and simplified on mobile.
 * This is not mounted in the private CRM workspace.
 */
const particles = [
  { x: 4, y: 11, s: 4, dx: 18, dy: -34, t: 31, delay: -8, tone: "rose" },
  { x: 12, y: 24, s: 3, dx: -11, dy: 28, t: 26, delay: -17, tone: "soft" },
  { x: 19, y: 76, s: 4, dx: 12, dy: -35, t: 38, delay: -15, tone: "rose" },
  { x: 27, y: 9, s: 2, dx: 16, dy: 25, t: 29, delay: -12, tone: "soft" },
  { x: 36, y: 56, s: 3, dx: -15, dy: -26, t: 42, delay: -6, tone: "soft" },
  { x: 43, y: 91, s: 3, dx: -21, dy: 17, t: 34, delay: -13, tone: "rose" },
  { x: 52, y: 18, s: 2, dx: 22, dy: 35, t: 36, delay: -23, tone: "soft" },
  { x: 58, y: 70, s: 3, dx: -19, dy: -19, t: 33, delay: -3, tone: "rose" },
  { x: 65, y: 42, s: 3, dx: 24, dy: -32, t: 39, delay: -20, tone: "soft" },
  { x: 72, y: 6, s: 5, dx: -15, dy: 37, t: 47, delay: -27, tone: "rose" },
  { x: 79, y: 84, s: 2, dx: 13, dy: -23, t: 28, delay: -10, tone: "soft" },
  { x: 88, y: 31, s: 4, dx: -14, dy: -36, t: 40, delay: -25, tone: "rose" },
  { x: 95, y: 64, s: 3, dx: -18, dy: 36, t: 32, delay: -18, tone: "soft" },
  { x: 7, y: 49, s: 5, dx: 16, dy: 24, t: 45, delay: -21, tone: "rose" },
  { x: 18, y: 91, s: 2, dx: -17, dy: -24, t: 25, delay: -7, tone: "soft" },
  { x: 33, y: 34, s: 2, dx: 18, dy: -31, t: 29, delay: -19, tone: "soft" },
  { x: 47, y: 6, s: 4, dx: -16, dy: 28, t: 36, delay: -23, tone: "rose" },
  { x: 61, y: 95, s: 2, dx: 13, dy: -25, t: 43, delay: -32, tone: "soft" },
  { x: 77, y: 58, s: 4, dx: -19, dy: 27, t: 40, delay: -10, tone: "rose" },
  { x: 93, y: 12, s: 2, dx: -23, dy: 21, t: 30, delay: -16, tone: "soft" },
] as const;

export function AmbientParticles() {
  return (
    <div className="jl-ambient" aria-hidden="true" data-ambient="sitewide">
      <span className="jl-ambient-glow jl-ambient-glow--left" />
      <span className="jl-ambient-glow jl-ambient-glow--right" />
      <span className="jl-ambient-orbit jl-ambient-orbit--one" />
      <span className="jl-ambient-orbit jl-ambient-orbit--two" />
      {particles.map(({ x, y, s, dx, dy, t, delay, tone }, index) => (
        <span
          key={index}
          className={"jl-ambient-particle jl-ambient-particle--" + tone}
          style={{
            "--jl-x": x + "%",
            "--jl-y": y + "%",
            "--jl-size": s + "px",
            "--jl-drift-x": dx + "px",
            "--jl-drift-y": dy + "px",
            "--jl-duration": t + "s",
            "--jl-delay": delay + "s",
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
