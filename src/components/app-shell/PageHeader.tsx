import type { ReactNode } from "react";
import { HeaderLightTrails, type BeamVariant } from "./HeaderLightTrails";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const paths: Record<string, BeamVariant> = {
    Dashboard: "dashboard", Financeiro: "finance",
    "Análise de presença digital": "digital", "Propostas comerciais": "proposals",
    "Campanhas de prospecção": "campaigns", "Sequências de prospecção": "sequences",
    "Agenda comercial": "agenda", "Gestão de projetos": "projects",
  };
  return (
    <header className="saas-page-header">
      <HeaderLightTrails variant={paths[title] ?? "dashboard"} />
      <div>
        {eyebrow && <p className="saas-page-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="saas-page-actions">{actions}</div>}
    </header>
  );
}
