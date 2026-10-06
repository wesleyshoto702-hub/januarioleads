import type { ReactNode } from "react";

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
        {icon}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
