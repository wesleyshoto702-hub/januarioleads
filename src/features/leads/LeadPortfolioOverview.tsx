import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  ListChecks,
  PieChart,
  RefreshCw,
  Send,
  UsersRound,
  X,
} from "lucide-react";
import type { FinancialStatus } from "../lead-finance/finance";
import type { LeadStatus } from "./remote-leads";

export type LeadActionView = "all" | "today" | "follow-up" | "overdue";

type PortfolioOverviewProps = {
  statusCounts: Record<"all" | LeadStatus, number>;
  selectedStatus: "all" | LeadStatus;
  onStatusChange: (status: "all" | LeadStatus) => void;
  actionCounts: { all: number; today: number; followUp: number; overdue: number };
  selectedAction: LeadActionView;
  onActionChange: (filter: LeadActionView) => void;
  financeCounts: { all: number; pending: number; partial: number; paid: number };
  financeLoaded: boolean;
  selectedFinance: "all" | FinancialStatus;
  onFinanceChange: (filter: "all" | FinancialStatus) => void;
};

/**
 * Three independently interactive filter groups. Values and filtering rules
 * are provided by the existing CRM; these are not fabricated statistics.
 */
export function LeadPortfolioOverview({
  statusCounts,
  selectedStatus,
  onStatusChange,
  actionCounts,
  selectedAction,
  onActionChange,
  financeCounts,
  financeLoaded,
  selectedFinance,
  onFinanceChange,
}: PortfolioOverviewProps) {
  const statuses = [
    { id: "all", label: "Todos", value: statusCounts.all, icon: UsersRound, tone: "all" },
    { id: "send_message", label: "Enviar mensagem", value: statusCounts.send_message, icon: Send, tone: "message" },
    { id: "waiting", label: "Aguardando", value: statusCounts.waiting, icon: Clock3, tone: "waiting" },
    { id: "accepted", label: "Aceitos", value: statusCounts.accepted, icon: BadgeCheck, tone: "accepted" },
    { id: "rejected", label: "Recusados", value: statusCounts.rejected, icon: X, tone: "rejected" },
  ] as const;

  const actions = [
    { id: "all", label: "Todas as ações", value: actionCounts.all, icon: ListChecks, tone: "all" },
    { id: "today", label: "Ações para hoje", value: actionCounts.today, icon: CalendarDays, tone: "today" },
    { id: "follow-up", label: "Follow-up", value: actionCounts.followUp, icon: RefreshCw, tone: "follow-up" },
    { id: "overdue", label: "Atrasadas", value: actionCounts.overdue, icon: AlertTriangle, tone: "overdue" },
  ] as const;

  const finances = [
    { id: "all", label: "Todos", value: financeCounts.all, icon: Coins, tone: "all" },
    { id: "pending", label: "Pendente", value: financeCounts.pending, icon: Clock3, tone: "pending" },
    { id: "partial", label: "Parcial", value: financeCounts.partial, icon: PieChart, tone: "partial" },
    { id: "paid", label: "Pago", value: financeCounts.paid, icon: CheckCircle2, tone: "paid" },
  ] as const;

  return (
    <div className="jl-portfolio-overview">
      <section className="jl-portfolio-status" aria-labelledby="jl-portfolio-status-heading">
        <div className="jl-portfolio-section-heading">
          <span className="jl-portfolio-heading-icon" aria-hidden="true"><BarChart3 size={22} /></span>
          <div>
            <h2 id="jl-portfolio-status-heading">Status dos leads</h2>
            <p>Visão geral do andamento dos seus contatos</p>
          </div>
        </div>
        <div className="jl-portfolio-status-grid" role="group" aria-label="Filtrar por status">
          {statuses.map(({ id, label, value, icon: Icon, tone }) => (
            <button
              key={id}
              type="button"
              className={"jl-portfolio-metric jl-portfolio-metric--" + tone +
                (selectedStatus === id ? " is-active" : "")}
              aria-pressed={selectedStatus === id}
              aria-label={label + ": " + value + " leads"}
              onClick={() => onStatusChange(id)}
            >
              <span className="jl-portfolio-metric-icon" aria-hidden="true"><Icon size={25} strokeWidth={1.9} /></span>
              <span className="jl-portfolio-metric-copy">
                <span className="jl-portfolio-metric-label">{label}</span>
                <strong>{value}</strong>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="jl-portfolio-groups">
        <section className="jl-portfolio-group" aria-labelledby="jl-portfolio-action-heading">
          <div className="jl-portfolio-group-heading">
            <span className="jl-portfolio-heading-icon" aria-hidden="true"><CalendarDays size={21} /></span>
            <div>
              <h2 id="jl-portfolio-action-heading">Acompanhamento</h2>
              <p>Gerencie as ações e próximos passos</p>
            </div>
          </div>
          <div className="jl-portfolio-group-grid" role="group" aria-label="Filtrar por acompanhamento">
            {actions.map(({ id, label, value, icon: Icon, tone }) => (
              <button
                key={id}
                type="button"
                className={"jl-portfolio-mini jl-portfolio-mini--" + tone +
                  (selectedAction === id ? " is-active" : "")}
                aria-pressed={selectedAction === id}
                aria-label={label + ": " + value + " leads"}
                onClick={() => onActionChange(id)}
              >
                <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
                <span><span className="jl-portfolio-mini-label">{label}</span><strong>{value}</strong></span>
              </button>
            ))}
          </div>
        </section>

        <section className="jl-portfolio-group" aria-labelledby="jl-portfolio-finance-heading">
          <div className="jl-portfolio-group-heading">
            <span className="jl-portfolio-heading-icon" aria-hidden="true"><Coins size={21} /></span>
            <div>
              <h2 id="jl-portfolio-finance-heading">Financeiro</h2>
              <p>Controle o status financeiro dos seus leads</p>
            </div>
          </div>
          <div className="jl-portfolio-group-grid" role="group" aria-label="Filtrar por financeiro">
            {finances.map(({ id, label, value, icon: Icon, tone }) => {
              const unavailable = !financeLoaded && id !== "all";
              return (
                <button
                  key={id}
                  type="button"
                  className={"jl-portfolio-mini jl-portfolio-mini--" + tone +
                    (selectedFinance === id ? " is-active" : "")}
                  aria-pressed={selectedFinance === id}
                  aria-label={label + ": " + (unavailable ? "dados indisponíveis" : value + " leads")}
                  disabled={unavailable}
                  onClick={() => onFinanceChange(id)}
                >
                  <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
                  <span><span className="jl-portfolio-mini-label">{label}</span>
                    <strong>{unavailable ? "—" : value}</strong>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
