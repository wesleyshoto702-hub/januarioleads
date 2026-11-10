import { useEffect, useRef, useState } from "react";

/**
 * Animate the first meaningful metric reading, not every CRM/filter update.
 * Keeps assistive technology on the real final value throughout the animation.
 * Matches the Workspace's per-account reduced-motion setting.
 */
const brazilNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const brazilCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function AnimatedNumber({
  value,
  format = "integer",
}: {
  value: number;
  format?: "integer" | "currency";
}) {
  const finalValue = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState(finalValue);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      Boolean(document.querySelector(".saas-shell.js-settings-reduce-motion"));
    if (reduced || hasAnimated.current || finalValue <= 0) {
      setDisplayValue(finalValue);
      if (reduced) hasAnimated.current = true;
      return;
    }

    hasAnimated.current = true;
    let raf = 0;
    const duration = format === "currency" ? 760 : 650;
    const start = performance.now();
    setDisplayValue(0);
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      // Cubic ease-out gives the numbers a polished but readable finish.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(finalValue * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setDisplayValue(finalValue);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [finalValue, format]);

  const formatter = format === "currency" ? brazilCurrency : brazilNumber;
  const readable = formatter.format(finalValue);
  const visible = formatter.format(displayValue);

  return (
    <span className="jl-motion-count">
      <span aria-hidden="true">{visible}</span>
      <span className="jl-motion-sr-only">{readable}</span>
    </span>
  );
}
