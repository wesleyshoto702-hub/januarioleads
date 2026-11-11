import { useMemo, useState } from "react";
import { BarChart3, Filter } from "lucide-react";
import type { ExistingLeadIdentity } from "./identity";
import { ProspectingInformationPanel } from "./ProspectingInformationPanel";
import { ObjectionsSummary } from "../commercial-expansion/ObjectionsSummary";
import type { ProspectingDetailMode } from "./prospecting-regions";

type ProspectingInformationViewProps = {
  leads: readonly ExistingLeadIdentity[];
  touchedLeadIds: ReadonlySet<string> | null;
  touchState: "loading" | "ready" | "error";
};

/**
 * Dedicated workspace page, independent from paid prospecting searches.
 * Uses only the already-hydrated CRM and its per-user message-click history.
 */
export function ProspectingInformationView({
  leads,
  touchedLeadIds,
  touchState,
}: ProspectingInformationViewProps) {
  const [selectedNiche, setSelectedNiche] = useState("");
  const [detailMode, setDetailMode] = useState<ProspectingDetailMode>("segment");
  const niches = useMemo(
    () => [...new Set(leads.map((lead) => (lead.segment ?? "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [leads],
  );
  // If the last lead of a segment is deleted, revert safely to all niches.
  const currentNiche = selectedNiche && niches.includes(selectedNiche) ? selectedNiche : "";

  return (
    <section className="page-wrap prospecting-information-page">
      <div className="page-heading prospecting-information-page-heading">
        <div>
          <p className="eyebrow">CARTEIRA COMERCIAL · BRASIL</p>
          <h1>Informações de Prospecção</h1>
          <p className="subtitle">
            Acompanhe sua atuação em todo o país, organizada por estado e cidade, com detalhamento por nicho ou bairro.
            Veja suas tentativas de contato e o andamento dos leads cadastrados.
          </p>
        </div>
      </div>

      <div className="prospecting-information-filter">
        <Filter size={17} aria-hidden="true" />
        <label htmlFor="prospecting-information-niche">Filtrar por nicho</label>
        <select
          id="prospecting-information-niche"
          value={currentNiche}
          onChange={(event) => setSelectedNiche(event.target.value)}
        >
          <option value="">Todos os nichos</option>
          {niches.map((niche) => (
            <option key={niche} value={niche}>{niche}</option>
          ))}
        </select>
        <div className="prospecting-information-filter-divider" aria-hidden="true"/>
        <label htmlFor="prospecting-information-detail-mode">Detalhamento das cidades</label>
        <select
          id="prospecting-information-detail-mode"
          value={detailMode}
          onChange={(event) => setDetailMode(event.target.value as ProspectingDetailMode)}
        >
          <option value="segment">Nichos (padrão)</option>
          <option value="neighborhood">Bairros</option>
        </select>
        <span className="prospecting-information-filter-detail">
          <BarChart3 size={15} aria-hidden="true" />
          {currentNiche ? `Exibindo apenas ${currentNiche}` : "Resumo geral dos seus leads"}
        </span>
      </div>

      <ObjectionsSummary leadIds={leads.filter(lead=>!currentNiche||lead.segment===currentNiche)
        .map(lead=>lead.id).filter((id):id is string=>typeof id==="string")} />
      <ProspectingInformationPanel
        leads={leads}
        touchedLeadIds={touchedLeadIds}
        touchState={touchState}
        selectedNiche={currentNiche}
        detailMode={detailMode}
      />
    </section>
  );
}
