import {
  ArrowRight,
  CircleDollarSign,
  RefreshCw,
  Target,
} from "lucide-react";
import type { LeadUpdateRecord, PersistedLead } from "../../features/leads/remote-leads";
import type { OpportunityRecord } from "../../features/opportunities/types";
import { formatCurrency } from "../../features/lead-finance/finance";
import type { AppView } from "../app-shell/AppShell";
import { MetricCard } from "../app-shell/MetricCard";
import { PageHeader } from "../app-shell/PageHeader";

type Counts = {
  all: number;
  send_message: number;
  waiting: number;
  accepted: number;
  rejected: number;
};

type FinancialOverview = {
  receivedThisMonth: number;
  receivable: number;
  paidProjects: number;
  partialProjects: number;
  pendingProjects: number;
};

function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Data indisponível";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.max(1, Math.floor(diff / 60_000))} min`;
  if (diff < 86_400_000) return `há ${Math.max(1, Math.floor(diff / 3_600_000))}h`;
  const days = Math.max(1, Math.floor(diff / 86_400_000));
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(timestamp));
}

export function DashboardView({
  counts,
  financialOverview,
  financeLoaded,
  financeError,
  leadUpdates,
  leads,
  remoteReady,
  remoteError,
  opportunities,
  opportunitiesLoading,
  opportunitiesError,
  onOpenLead,
  onNavigate,
}: {
  counts: Counts;
  financialOverview: FinancialOverview;
  financeLoaded: boolean;
  financeError: string;
  leadUpdates: LeadUpdateRecord[];
  leads: PersistedLead[];
  remoteReady: boolean;
  remoteError: string;
  opportunities: OpportunityRecord[];
  opportunitiesLoading: boolean;
  opportunitiesError: string;
  onOpenLead: (lead: PersistedLead) => void;
  onNavigate: (view: AppView) => void;
}) {
  const workedContacts = counts.waiting + counts.accepted + counts.rejected;
  const conversion =
    workedContacts > 0 ? Math.round((counts.accepted / workedContacts) * 100) : null;
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const topOpportunities = [...opportunities]
    .filter((item) => !item.stale)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <section className="dashboard-view saas-page">
      <PageHeader
        eyebrow="VISÃO GERAL"
        title="Dashboard"
        description="Acompanhe sua prospecção, recebimentos e mudanças recentes."
        actions={
          <div className={remoteReady ? "saas-sync-pill active" : "saas-sync-pill"}>
            <RefreshCw size={13} />
            <span>{remoteReady ? "Sincronização ativa" : "Conectando"}</span>
            <small>A cada 8 horas</small>
          </div>
        }
      />

      {remoteError && <p className="saas-inline-notice">{remoteError}</p>}

      <div className="dashboard-metrics">
        <MetricCard label="Total de leads" value={counts.all} tone="primary" />
        <MetricCard label="Enviar mensagem" value={counts.send_message} />
        <MetricCard label="Aguardando" value={counts.waiting} tone="waiting" />
        <MetricCard label="Aceitos" value={counts.accepted} tone="accepted" />
        <MetricCard label="Recusados" value={counts.rejected} tone="rejected" />
      </div>

      <div className="dashboard-secondary-grid">
        <section className="dashboard-panel dashboard-performance">
          <div className="dashboard-panel-heading">
            <div>
              <span>PERFORMANCE COMERCIAL</span>
              <strong>Conversão dos contatos trabalhados</strong>
            </div>
          </div>
          <div className="dashboard-conversion">
            <strong>{conversion === null ? "—" : `${conversion}%`}</strong>
            <p>
              {workedContacts > 0
                ? `${counts.accepted} aceitos em ${workedContacts} contatos que já saíram de “Enviar mensagem”.`
                : "A taxa aparece quando houver contatos em andamento, aceitos ou recusados."}
            </p>
          </div>
          <small className="dashboard-formula">
            Fórmula: aceitos ÷ (aguardando + aceitos + recusados).
          </small>
        </section>

        <section className="dashboard-panel dashboard-financial">
          <div className="dashboard-panel-heading">
            <div>
              <span>FINANCEIRO</span>
              <strong>Resumo atual</strong>
            </div>
            <button type="button" onClick={() => onNavigate("finance")}>
              Ver financeiro <ArrowRight size={14} />
            </button>
          </div>
          {financeLoaded ? (
            <div className="dashboard-finance-grid">
              <div>
                <span>Recebido no mês</span>
                <strong>{formatCurrency(financialOverview.receivedThisMonth)}</strong>
              </div>
              <div>
                <span>A receber</span>
                <strong>{formatCurrency(financialOverview.receivable)}</strong>
              </div>
              <div>
                <span>Projetos pagos</span>
                <strong>{financialOverview.paidProjects}</strong>
              </div>
              <div>
                <span>Parciais</span>
                <strong>{financialOverview.partialProjects}</strong>
              </div>
            </div>
          ) : (
            <p className="dashboard-panel-empty">
              {financeError || "Carregando dados financeiros..."}
            </p>
          )}
        </section>
      </div>

      <div className="dashboard-columns">
        <section className="dashboard-panel dashboard-updates">
          <div className="dashboard-panel-heading">
            <div>
              <span>ATUALIZAÇÕES RECENTES</span>
              <strong>O que mudou nos seus leads</strong>
            </div>
          </div>

          {leadUpdates.length === 0 ? (
            <p className="dashboard-panel-empty">
              Nenhuma mudança automática detectada ainda.
            </p>
          ) : (
            <div className="dashboard-feed">
              {leadUpdates.slice(0, 7).map((update) => {
                const lead = leadById.get(update.leadId);
                return (
                  <button
                    type="button"
                    key={update.id}
                    onClick={() => lead && onOpenLead(lead)}
                    disabled={!lead}
                  >
                    <span className={update.importance === "high" ? "dashboard-feed-dot high" : "dashboard-feed-dot"} />
                    <span>
                      <strong>{update.message}</strong>
                      <small>
                        {lead?.company ?? "Lead"} · {formatRelativeDate(update.createdAt)}
                      </small>
                    </span>
                    {!update.isSeen && <b>Novo</b>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="dashboard-panel dashboard-opportunities">
          <div className="dashboard-panel-heading">
            <div>
              <span>OPORTUNIDADES</span>
              <strong>Maiores índices observados</strong>
            </div>
            <button type="button" onClick={() => onNavigate("opportunities")}>
              Ver todas <ArrowRight size={14} />
            </button>
          </div>

          {opportunitiesLoading ? (
            <p className="dashboard-panel-empty">Carregando amostras existentes...</p>
          ) : opportunitiesError ? (
            <p className="dashboard-panel-empty">{opportunitiesError}</p>
          ) : topOpportunities.length === 0 ? (
            <div className="dashboard-opportunity-empty">
              <Target size={18} />
              <p>
                Ainda não existem amostras suficientes para destacar oportunidades aqui.
              </p>
              <button type="button" onClick={() => onNavigate("search")}>
                Buscar leads
              </button>
            </div>
          ) : (
            <div className="dashboard-opportunity-list">
              {topOpportunities.map((item, index) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => onNavigate("opportunities")}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{item.segment}</strong>
                    <small>{item.city} · {item.state}</small>
                  </div>
                  <b>{item.score}</b>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {financeLoaded && financialOverview.receivedThisMonth > 0 && (
        <div className="dashboard-bottom-note">
          <CircleDollarSign size={15} />
          <span>
            Recebimentos deste mês são calculados diretamente dos pagamentos registrados.
          </span>
        </div>
      )}
    </section>
  );
}
