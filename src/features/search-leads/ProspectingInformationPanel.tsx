import { ChevronDown, ChevronRight, Info, Layers, MapPin, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { ExistingLeadIdentity } from "./identity";
import { buildProspectingHierarchy, type ProspectingMetrics, type ProspectingRegion } from "./prospecting-regions";

type TouchState = "loading" | "ready" | "error";

function pct(number: number) {
  return `${number.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function ProgressTrack({
  value, label, ready,
}: { value: number; label: string; ready: boolean }) {
  return (
    <div className="prospecting-info-track"
      role={ready ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={ready ? 0 : undefined}
      aria-valuemax={ready ? 100 : undefined}
      aria-valuenow={ready ? value : undefined}>
      <span style={{ width: `${ready ? value : 0}%` }}/>
    </div>
  );
}

function RegionRow({
  item, level, ready,
}: { item: ProspectingRegion; level: "state" | "city" | "neighborhood"; ready: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const expandable = item.children.length > 0;
  return (
    <div className={`prospecting-info-region prospecting-info-${level}`}>
      <button type="button"
        className={`prospecting-info-region-row${expanded ? " is-expanded" : ""}`}
        aria-expanded={expandable ? expanded : undefined}
        onClick={() => { if (expandable) setExpanded((open) => !open); }}
        disabled={!expandable}>
        <span className="prospecting-info-region-label">
          {expandable
            ? expanded ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />
            : <span className="prospecting-info-spacer" />}
          {level === "state" ? <Layers size={18} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}
          <strong>{item.name}</strong>
        </span>
        <ProgressTrack value={item.metrics.touchedPercent} ready={ready}
          label={`Ações Mandar mensagem em ${item.name}`}/>
        <strong className="prospecting-info-rate">{ready ? pct(item.metrics.touchedPercent) : "—"}</strong>
        <span className="prospecting-info-count">
          {ready ? item.metrics.touched : "—"} de {item.metrics.total} leads
        </span>
      </button>
      {expanded && expandable && (
        <div className="prospecting-info-children">
          {item.children.map((child) => (
            <RegionRow key={child.key} item={child}
              level={level === "state" ? "city" : "neighborhood"} ready={ready}/>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusCard({
  title, count, percent, tone, total,
}: {title: string; count: number; percent: number; tone: string; total: number}) {
  return (
    <div className={`prospecting-info-status prospecting-info-status-${tone}`}>
      <span>{title}</span>
      <strong>{pct(percent)}</strong>
      <small>{count} de {total} leads</small>
      <div className="prospecting-info-status-track" role="progressbar" aria-label={title}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ width: `${percent}%` }}/>
      </div>
    </div>
  );
}

export function ProspectingInformationPanel({
  leads, touchedLeadIds, touchState, selectedNiche,
}: {
  leads: readonly ExistingLeadIdentity[];
  touchedLeadIds: ReadonlySet<string> | null;
  touchState: TouchState;
  selectedNiche: string;
}) {
  // This component now belongs to its own workspace page. The page owns
  // the niche selector; the panel always reflects the selected CRM slice.
  const hierarchy = useMemo(
    () => buildProspectingHierarchy(leads, touchedLeadIds ?? new Set<string>(), selectedNiche || undefined),
    [leads, touchedLeadIds, selectedNiche],
  );
  const m: ProspectingMetrics = hierarchy.metrics;
  const ready = touchState === "ready";

  return (
    <section className="prospecting-info-panel" aria-label="Informações de Prospecção">
      <div className="prospecting-info-header">
        <div className="prospecting-info-heading">
          <Layers size={27} aria-hidden="true"/>
          <div>
            <h2>Informações de Prospecção</h2>
            <p>Acompanhe onde você já prospectou no Brasil, por estado, cidade e bairro.</p>
          </div>
        </div>
      </div>

      <div className="prospecting-info-overview" aria-label="Indicadores gerais do CRM">
        <div className="prospecting-info-touched">
          <span><MessageCircle size={15} aria-hidden="true"/> Mandar mensagem</span>
          <strong>{ready ? pct(m.touchedPercent) : "—"}</strong>
          <small>{ready ? m.touched : "—"} de {m.total} leads com ação iniciada</small>
          <ProgressTrack value={m.touchedPercent} label="Ações Mandar mensagem no CRM"
            ready={ready}/>
        </div>
        <StatusCard title="Aguardando" tone="waiting" count={m.waiting}
          percent={m.waitingPercent} total={m.total}/>
        <StatusCard title="Aceitos" tone="accepted" count={m.accepted}
          percent={m.acceptedPercent} total={m.total}/>
        <StatusCard title="Recusados" tone="rejected" count={m.rejected}
          percent={m.rejectedPercent} total={m.total}/>
      </div>

      <div className="prospecting-info-regions">
        {hierarchy.states.length ? hierarchy.states.map((state) => (
          <RegionRow key={state.key} item={state} level="state" ready={ready}/>
        )) : (
          <p className="prospecting-info-empty">
            {selectedNiche ? "Nenhum lead cadastrado neste nicho." : "Cadastre leads para começar a acompanhar suas regiões."}
          </p>
        )}
      </div>

      <p className="prospecting-info-footnote">
        <Info size={16} aria-hidden="true"/>
        {touchState === "loading"
          ? "Carregando o histórico de ações do WhatsApp..."
          : touchState === "error"
            ? "Não foi possível carregar as ações de mensagem. Os status continuam corretos, mas a taxa de abordagem fica indisponível."
            : "O clique em “Mandar mensagem” conta como ação iniciada, não como envio comprovado. Cada lead conta uma vez; alterações de status e exclusões atualizam as porcentagens automaticamente."}
      </p>
    </section>
  );
}
