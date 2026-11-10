import {
  Check,
  ChevronDown,
  Edit3,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { PersistedLead as Lead, LeadStatus as Status } from "./remote-leads";
import {
  FINANCIAL_STATUS_LABEL,
  formatCurrency,
  type LeadFinanceSummary,
} from "../lead-finance/finance";
import { normalizeBrazilianStateCode } from "../../lib/brazil-locations";
import { ChanceBadge } from "../lead-chance/ChanceBadge";
import { calculateLeadChance, hasEnoughDataForLeadChance } from "../lead-chance/lead-chance";
import { LeadActionSummary } from "../next-actions/LeadNextActionSection";
import { STATUS_LABEL } from "./lead-status";
function LeadFinanceMarker({ summary }: { summary: LeadFinanceSummary }) {
  return (
    <div className="lead-finance-marker">
      <span className={`financial-status-badge ${summary.status}`}>
        {FINANCIAL_STATUS_LABEL[summary.status]}
      </span>
      <strong>{formatCurrency(summary.projectValue)}</strong>
      {summary.status !== "paid" && (
        <small>{formatCurrency(summary.remainingValue)} restante</small>
      )}
    </div>
  );
}

function LeadLocation({ lead }: { lead: Lead }) {
  const state = normalizeBrazilianStateCode(lead.state);
  const city = lead.city?.trim() ?? "";
  const location =
    city && state
      ? `${city} · ${state}`
      : city
        ? `${city} · UF não informada`
        : state
          ? `${state} · Cidade não informada`
          : "Localização não informada";

  return (
    <div
      className={`lead-location${city && state ? "" : " missing"}`}
      title={location}
      aria-label={`Localização: ${location}`}
    >
      <MapPin size={13} aria-hidden="true" />
      <span>{location}</span>
    </div>
  );
}

export function LeadRow({
  lead,
  finance,
  onStatus,
  onMessage,
  onDetails,
  updateCount,
  onFollowUp,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  finance: LeadFinanceSummary | null;
  onStatus: (id: string, status: Status) => void;
  onMessage: (lead: Lead) => void;
  onDetails: (lead: Lead) => void;
  updateCount: number;
  onFollowUp: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  const chance = hasEnoughDataForLeadChance(lead) ? calculateLeadChance(lead, lead.segment) : null;

  return (
    <article className="table-row">
      <div className="company-cell">
        <div className="lead-company-name-line">
          <strong>{lead.company}</strong>
          {chance && <ChanceBadge chance={chance} />}
        </div>
        <span className="lead-segment">{lead.segment}</span>
        {finance && <LeadFinanceMarker summary={finance} />}
        {lead.enrichedAt && <small className="enriched-badge">Dados enriquecidos</small>}
        {updateCount > 0 && (
          <small className="lead-update-badge">
            {updateCount} {updateCount === 1 ? "atualização" : "atualizações"}
          </small>
        )}
        {lead.notes && <small title={lead.notes}>{lead.notes}</small>}
      </div>
      <div className="lead-location-cell"><LeadLocation lead={lead} /></div>
      <div className="phone-cell">{lead.phone || "Sem telefone"}</div>
      <div className="lead-status-stack">
        <StatusControl lead={lead} onStatus={onStatus} />
      </div>
      <div className="lead-next-action-cell">
        <LeadActionSummary lead={lead} compact hideFollowUp />
      </div>
      <div className="lead-value-cell">{finance ? formatCurrency(finance.projectValue) : "—"}</div>
      <div className="date-cell">
        <span>{formatDate(lead.firstContact)}</span>
        <small>
          {lead.lastContact ? `Último: ${formatDate(lead.lastContact)}` : "Sem novo contato"}
        </small>
      </div>
      <div className="actions-cell">
        <button className="lead-details-button" onClick={() => onDetails(lead)} type="button">
          Ver empresa
        </button>
        {lead.phone && (
          <button
            className="message-button"
            onClick={() => onMessage(lead)}
            type="button"
            title="Mandar mensagem"
          >
            <MessageCircle size={16} />
            <span>Mandar mensagem</span>
          </button>
        )}
        {lead.status === "waiting" && Boolean(lead.phone) && (
          <button
            className="enrichment-button follow-up-action-button"
            onClick={() => onFollowUp(lead)}
            type="button"
            title="Fazer follow-up"
          >
            <MessageCircle size={15} />
            <span>Fazer follow-up</span>
          </button>
        )}
        <button className="row-icon" onClick={() => onEdit(lead)} type="button" title="Editar">
          <Edit3 size={16} />
        </button>
        <button
          className="row-icon danger"
          onClick={() => onDelete(lead)}
          type="button"
          title="Excluir"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

export function LeadCard({
  lead,
  finance,
  onStatus,
  onMessage,
  onDetails,
  updateCount,
  onFollowUp,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  finance: LeadFinanceSummary | null;
  onStatus: (id: string, status: Status) => void;
  onMessage: (lead: Lead) => void;
  onDetails: (lead: Lead) => void;
  updateCount: number;
  onFollowUp: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  const chance = hasEnoughDataForLeadChance(lead) ? calculateLeadChance(lead, lead.segment) : null;

  return (
    <article className="lead-card">
      <div className="card-top">
        <div>
          <div className="lead-company-name-line">
            <strong>{lead.company}</strong>
            {chance && <ChanceBadge chance={chance} />}
          </div>
          <span className="lead-segment">{lead.segment}</span>
          <LeadLocation lead={lead} />
          {lead.enrichedAt && <small className="enriched-badge">Dados enriquecidos</small>}
          {updateCount > 0 && (
            <small className="lead-update-badge">
              {updateCount} {updateCount === 1 ? "atualização" : "atualizações"}
            </small>
          )}
        </div>
        <span className={`status-badge ${lead.status}`}>{STATUS_LABEL[lead.status]}</span>
      </div>
      <div className="card-phone">{lead.phone || "Sem telefone disponível"}</div>
      {finance && <LeadFinanceMarker summary={finance} />}
      <StatusControl lead={lead} onStatus={onStatus} />
      <LeadActionSummary lead={lead} hideFollowUp />
      <div className="card-meta">
        <span>Primeiro contato: {formatDate(lead.firstContact)}</span>
        {lead.lastContact && <span>Último contato: {formatDate(lead.lastContact)}</span>}
      </div>
      {lead.notes && <p className="card-notes">{lead.notes}</p>}
      <div className="card-actions">
        <button className="lead-details-button" onClick={() => onDetails(lead)} type="button">
          Ver empresa
        </button>
        {lead.phone && (
          <button className="message-button" onClick={() => onMessage(lead)} type="button">
            <MessageCircle size={16} />
            Mandar mensagem
          </button>
        )}
        {lead.status === "waiting" && Boolean(lead.phone) && (
          <button
            className="enrichment-button follow-up-action-button"
            onClick={() => onFollowUp(lead)}
            type="button"
            title="Fazer follow-up"
          >
            <MessageCircle size={15} />
            Fazer follow-up
          </button>
        )}
        <button className="row-icon" onClick={() => onEdit(lead)} type="button" aria-label="Editar">
          <Edit3 size={17} />
        </button>
        <button
          className="row-icon danger"
          onClick={() => onDelete(lead)}
          type="button"
          aria-label="Excluir"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );
}

function StatusControl({
  lead,
  onStatus,
}: {
  lead: Lead;
  onStatus: (id: string, status: Status) => void;
}) {
  return (
    <div className="inline-status" aria-label="Alterar status">
      {(["send_message", "waiting", "accepted", "rejected"] as Status[]).map((status) => (
        <button
          key={status}
          type="button"
          className={`status-tick ${status} ${lead.status === status ? "selected" : ""}`}
          onClick={() => onStatus(lead.id, status)}
          title={STATUS_LABEL[status]}
          aria-label={STATUS_LABEL[status]}
        >
          {lead.status === status && <Check size={11} />}
        </button>
      ))}
      <span className={`status-text ${lead.status}`}>{STATUS_LABEL[lead.status]}</span>
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  ariaLabel: string;
}) {
  return (
    <label className="select-wrap">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}

export function Modal({
  children,
  onClose,
  title,
  compact = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={compact ? "modal-card compact" : "modal-card"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function EmptyState({ onNew, hasLeads }: { onNew: () => void; hasLeads: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{hasLeads ? <Search size={20} /> : <Plus size={20} />}</div>
      <strong>{hasLeads ? "Nenhum lead encontrado" : "Seu primeiro lead começa aqui"}</strong>
      <p>
        {hasLeads
          ? "Tente mudar a busca ou os filtros."
          : "Cadastre uma empresa e ela entra como Enviar mensagem."}
      </p>
      {!hasLeads && (
        <button className="secondary-button" type="button" onClick={onNew}>
          Adicionar lead
        </button>
      )}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
