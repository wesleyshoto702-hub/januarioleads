import { useMemo, useState } from "react";
import { BarChart3, Download, Info, ListTodo } from "lucide-react";
import type { PersistedLead } from "../leads/remote-leads";
import { loadIdealCustomerProfile } from "../qualification/ideal-customer-profile";
import { buildProspectingInsights } from "./prospecting-insights";

function exportSummary(rows: string[][]) {
  const text = "\uFEFF" + rows.map((row) => row.map((cell) => {
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(cell) ? "'" + cell : cell;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(";")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "januarioleads-relatorio-agregado.csv";
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProspectingInsights({
  leads, onViewLeads,
}: {
  leads: PersistedLead[];
  onViewLeads: () => void;
}) {
  const [mode, setMode] = useState<"weekly" | "segments">("weekly");
  const insights = useMemo(() => buildProspectingInsights(leads, loadIdealCustomerProfile()), [leads]);
  const max = Math.max(1, ...insights.trend.map((point) => point.count));
  return (
    <section className="dashboard-panel prospecting-insights" aria-labelledby="prospecting-insights-title">
      <div className="dashboard-panel-heading prospecting-insights-heading">
        <div>
          <span>INTELIGÊNCIA DA CARTEIRA</span>
          <strong id="prospecting-insights-title">Tendências e prioridades</strong>
        </div>
        <button type="button" onClick={() => exportSummary([
          ["metrica", "valor"],
          ["Leads sem ação definida", String(insights.due.unplanned)],
          ["Ações atrasadas", String(insights.due.overdue)],
          ["Ações para hoje", String(insights.due.today)],
          ["Leads com prioridade heurística 70+", String(insights.highPriority)],
          ...insights.trend.map((point) => ["Leads cadastrados " + point.start + " a " + point.end, String(point.count)]),
          ...insights.topSegments.map((item) => ["Segmento " + item.name, String(item.total)]),
        ])}>
          <Download size={14} aria-hidden="true" /> Exportar resumo
        </button>
      </div>
      <p className="prospecting-insights-note"><Info size={14} aria-hidden="true"/>
        Dados agregados do CRM. Não exporta empresas, contatos, dados do Google Places ou histórico individual.
        Status de aceito é o estado atual, não a data de fechamento de uma venda.
      </p>
      <div className="prospecting-insights-kpis">
        <div><strong>{insights.due.overdue}</strong><span>Atrasadas</span></div>
        <div><strong>{insights.due.today}</strong><span>Para hoje</span></div>
        <div><strong>{insights.due.unplanned}</strong><span>Sem agenda</span></div>
        <div><strong>{insights.highPriority}</strong><span>Prioridade 70+</span></div>
      </div>
      <div className="prospecting-insights-tabs" role="group" aria-label="Tipo de análise">
        <button type="button" aria-pressed={mode === "weekly"} onClick={() => setMode("weekly")}>
          <BarChart3 size={14} aria-hidden="true"/> Cadastros por semana
        </button>
        <button type="button" aria-pressed={mode === "segments"} onClick={() => setMode("segments")}>
          <ListTodo size={14} aria-hidden="true"/> Segmentos
        </button>
      </div>
      {mode === "weekly" ? (
        <div className="prospecting-weekly-chart" role="img" aria-label="Cadastros de leads por semana nas últimas oito semanas">
          {insights.trend.map((point) => (
            <div key={point.start} className="prospecting-weekly-column">
              <strong>{point.count}</strong>
              <div className="prospecting-weekly-bar-wrap">
                <span style={{ height: (point.count / max * 100) + "%" }} />
              </div>
              <small>{point.label}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="prospecting-segment-table">
          {insights.topSegments.length === 0 ? (
            <p className="dashboard-panel-empty">Cadastre leads para visualizar os segmentos.</p>
          ) : insights.topSegments.map((item) => (
            <div key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.total} cadastrados</span>
              <small>{item.accepted} aceitos ({item.rate ?? 0}% dos cadastrados)</small>
            </div>
          ))}
        </div>
      )}
      <div className="prospecting-insights-footer">
        <small>Os gráficos usam a data de cadastro; a prioridade é uma heurística, não uma previsão de venda.</small>
        <button type="button" onClick={onViewLeads}>Abrir carteira</button>
      </div>
    </section>
  );
}
