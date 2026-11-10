import { ArrowRight, WalletCards } from "lucide-react";
import {
  FINANCIAL_STATUS_LABEL,
  formatCurrency,
  type LeadFinanceSummary,
} from "../../features/lead-finance/finance";
import type { PersistedLead } from "../../features/leads/remote-leads";
import { MetricCard } from "../app-shell/MetricCard";
import { PageHeader } from "../app-shell/PageHeader";

type FinancialOverview = {
  receivedThisMonth: number;
  receivable: number;
  paidProjects: number;
  partialProjects: number;
  pendingProjects: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return value;
}

export function FinanceView({
  leads,
  financeByLead,
  overview,
  loaded,
  error,
  onOpenLead,
  onOpenLeads,
}: {
  leads: PersistedLead[];
  financeByLead: Map<string, LeadFinanceSummary>;
  overview: FinancialOverview;
  loaded: boolean;
  error: string;
  onOpenLead: (lead: PersistedLead) => void;
  onOpenLeads?: () => void;
}) {
  const rows = leads
    .map((lead) => {
      const summary = financeByLead.get(lead.id);
      return summary ? { lead, summary } : null;
    })
    .filter((item): item is { lead: PersistedLead; summary: LeadFinanceSummary } => Boolean(item))
    .sort((a, b) => b.summary.projectValue - a.summary.projectValue);

  return (
    <section className="finance-view saas-page">
      <PageHeader
        eyebrow="RECEBIMENTOS"
        title="Financeiro"
        description="Valores de projeto e pagamentos registrados nos seus leads."
      />

      {error && <p className="saas-inline-notice">{error}</p>}

      <div className="finance-metrics">
        <MetricCard
          label="Recebido no mês"
          value={loaded ? formatCurrency(overview.receivedThisMonth) : "—"}
          tone="accepted"
        />
        <MetricCard
          label="A receber"
          value={loaded ? formatCurrency(overview.receivable) : "—"}
          tone="primary"
        />
        <MetricCard label="Projetos pagos" value={loaded ? overview.paidProjects : "—"} />
        <MetricCard label="Parciais" value={loaded ? overview.partialProjects : "—"} tone="waiting" />
        <MetricCard label="Pendentes" value={loaded ? overview.pendingProjects : "—"} />
      </div>

      <section className="finance-panel">
        <div className="finance-panel-heading">
          <div>
            <span>PROJETOS</span>
            <strong>Leads com dados financeiros</strong>
          </div>
          <small>{rows.length} {rows.length === 1 ? "projeto" : "projetos"}</small>
        </div>

        {!loaded ? (
          <div className="finance-empty">Carregando dados financeiros...</div>
        ) : rows.length === 0 ? (
          <div className="finance-empty finance-empty-premium">
            <span className="finance-empty-icon"><WalletCards size={26} aria-hidden="true" /></span>
            <strong>Nenhum projeto com valor registrado.</strong>
            <p>
              O financeiro continua sendo preenchido dentro de “Ver empresa” de cada lead.
            </p>
            {onOpenLeads && (
              <button type="button" className="primary-button" onClick={onOpenLeads}>
                Abrir Meus Leads
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="finance-table desktop-finance-table">
              <div className="finance-table-head">
                <span>Empresa</span>
                <span>Projeto</span>
                <span>Recebido</span>
                <span>Restante</span>
                <span>Status</span>
                <span>Último pagamento</span>
                <span />
              </div>
              {rows.map(({ lead, summary }) => (
                <button
                  type="button"
                  className="finance-table-row"
                  key={lead.id}
                  onClick={() => onOpenLead(lead)}
                >
                  <span>
                    <strong>{lead.company}</strong>
                    <small>{lead.segment}</small>
                  </span>
                  <b>{formatCurrency(summary.projectValue)}</b>
                  <b>{formatCurrency(summary.receivedValue)}</b>
                  <b>{formatCurrency(summary.remainingValue)}</b>
                  <span>
                    <i className={`financial-status-badge ${summary.status}`}>
                      {FINANCIAL_STATUS_LABEL[summary.status]}
                    </i>
                  </span>
                  <span>
                    {summary.lastPayment
                      ? formatDate(summary.lastPayment.paymentDate)
                      : "Nenhum"}
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>

            <div className="finance-mobile-list">
              {rows.map(({ lead, summary }) => (
                <button
                  type="button"
                  key={lead.id}
                  onClick={() => onOpenLead(lead)}
                >
                  <div>
                    <strong>{lead.company}</strong>
                    <span>{lead.segment}</span>
                  </div>
                  <div className="finance-mobile-values">
                    <span>
                      Projeto <b>{formatCurrency(summary.projectValue)}</b>
                    </span>
                    <span>
                      Restante <b>{formatCurrency(summary.remainingValue)}</b>
                    </span>
                  </div>
                  <div className="finance-mobile-footer">
                    <i className={`financial-status-badge ${summary.status}`}>
                      {FINANCIAL_STATUS_LABEL[summary.status]}
                    </i>
                    <ArrowRight size={15} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  );
}
