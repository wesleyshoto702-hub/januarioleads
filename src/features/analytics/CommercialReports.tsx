import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, CalendarDays, Info } from "lucide-react";
import type { PersistedLead } from "../leads/remote-leads";
import type { LeadPayment } from "../lead-finance/finance";
import { formatCurrency } from "../lead-finance/finance";
import { STATUS_LABEL } from "../leads/lead-status";
import {
  buildCommercialReport,
  type ReportGroup,
  type ReportPeriod,
} from "./commercial-report";

function ReportBars({ entries, caption }: { entries: ReportGroup[]; caption: string }) {
  const max = Math.max(1, ...entries.map((entry) => entry.count));
  return (
    <div className="commercial-bars" aria-label={caption}>
      {entries.length === 0 ? (
        <p className="commercial-empty">Ainda não há leads cadastrados neste período.</p>
      ) : entries.map((entry) => (
        <div className="commercial-bar-row" key={entry.name}>
          <div className="commercial-bar-label">
            <span title={entry.name}>{entry.name}</span>
            <strong>{entry.count}</strong>
          </div>
          <div className="commercial-bar-track" role="meter"
            aria-label={entry.name} aria-valuemin={0} aria-valuemax={max}
            aria-valuenow={entry.count}>
            <span style={{ width: ((entry.count / max) * 100) + "%" }} />
          </div>
          <small>{entry.accepted} {entry.accepted === 1 ? "aceito" : "aceitos"}</small>
        </div>
      ))}
    </div>
  );
}

export function CommercialReports({
  leads,
  payments,
  financeLoaded,
  financeError,
  onViewLeads,
}: {
  leads: PersistedLead[];
  payments: LeadPayment[];
  financeLoaded: boolean;
  financeError: string;
  onViewLeads: () => void;
}) {
  const [period, setPeriod] = useState<ReportPeriod>("90");
  const report = useMemo(
    () => buildCommercialReport(leads, payments, period),
    [leads, payments, period],
  );
  const description = period === "all" ? "Todo o histórico disponível" :
    period === "30" ? "Últimos 30 dias" : "Últimos 90 dias";

  return (
    <section className="dashboard-panel commercial-reports" aria-labelledby="commercial-reports-title">
      <div className="dashboard-panel-heading commercial-reports-heading">
        <div>
          <span>ANÁLISE COMERCIAL</span>
          <strong id="commercial-reports-title">Relatórios comerciais</strong>
        </div>
        <button type="button" onClick={onViewLeads}>
          Ver carteira <ArrowRight size={14} aria-hidden="true"/>
        </button>
      </div>
      <div className="commercial-reports-toolbar">
        <span><CalendarDays size={16} aria-hidden="true" /> {description}</span>
        <div role="group" aria-label="Período do relatório" className="commercial-period-picker">
          {([
            ["30", "30 dias"],
            ["90", "90 dias"],
            ["all", "Tudo"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="commercial-reports-note">
        <Info size={15} aria-hidden="true"/>
        Os status exibidos são os atuais dos leads cadastrados no período, e não um histórico de mudanças.
        Contato por WhatsApp e proposta enviada não são presumidos. Pagamentos usam a data do recebimento,
        independentemente da data de cadastro do lead.
      </p>
      <div className="commercial-report-kpis">
        <div><span>Leads cadastrados</span><strong>{report.registered}</strong></div>
        <div><span>Em acompanhamento*</span><strong>{report.worked}</strong></div>
        <div><span>Leads aceitos</span><strong>{report.accepted}</strong></div>
        <div>
          <span>Taxa de aceite indicativa*</span>
          <strong>{report.acceptanceRate === null ? "—" : report.acceptanceRate.toLocaleString("pt-BR") + "%"}</strong>
        </div>
        <div>
          <span>Recebimentos no período</span>
          <strong>{financeLoaded ? formatCurrency(report.received) : "—"}</strong>
          <small>{financeLoaded ? report.paymentsCount + " pagamentos registrados" :
            financeError || "Carregando dados financeiros..."}</small>
        </div>
      </div>
      <p className="commercial-report-formula">
        *Em acompanhamento = aguardando + aceitos + recusados.
        Taxa indicativa = aceitos ÷ em acompanhamento (status atuais, não taxa de vendas fechadas).
      </p>
      <div className="commercial-statuses" aria-label="Distribuição dos status atuais">
        {report.byStatus.map((item) => (
          <div key={item.status}>
            <span>{STATUS_LABEL[item.status]}</span>
            <strong>{item.count}</strong>
            <div className="commercial-bar-track" role="meter"
              aria-label={STATUS_LABEL[item.status]} aria-valuemin={0}
              aria-valuemax={Math.max(1, report.registered)} aria-valuenow={item.count}>
              <span style={{ width: (item.count / Math.max(1, report.registered) * 100) + "%" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="commercial-report-breakdowns">
        <section aria-label="Leads por segmento">
          <h3><BarChart3 size={16} aria-hidden="true"/> Por segmento</h3>
          <ReportBars entries={report.bySegment} caption="Distribuição dos leads por segmento"/>
        </section>
        <section aria-label="Leads por cidade">
          <h3><BarChart3 size={16} aria-hidden="true"/> Por cidade</h3>
          <ReportBars entries={report.byCity} caption="Distribuição dos leads por cidade"/>
        </section>
      </div>
      <small className="commercial-report-footer">
        Dados exclusivos do CRM da sua conta. As contagens consideram leads cadastrados no período selecionado,
        sem consultar novamente o Google Places.
      </small>
    </section>
  );
}
