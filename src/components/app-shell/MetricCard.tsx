import type { ReactNode } from "react";
import { AnimatedNumber } from "./AnimatedNumber";

export function MetricCard({
  label,
  value,
  tone = "neutral",
  detail,
  icon,
  title,
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "primary" | "waiting" | "accepted" | "rejected";
  detail?: ReactNode;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <article className={`saas-metric-card ${tone}`} title={title}>
      <div className="saas-metric-label">
        <span>{label}</span>
        {icon && <span className="saas-metric-icon" aria-hidden="true">{icon}</span>}
      </div>
      <strong>{typeof value === "number" ? <AnimatedNumber value={value} /> : value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
