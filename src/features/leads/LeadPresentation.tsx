import {
  BadgeCheck,
  Ban,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock3,
  Edit3,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Send,
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
import { getLeadActionSummary } from "../next-actions/next-actions";
import { LeadNicheIcon } from "./LeadNicheIcon";
import { STATUS_LABEL } from "./lead-status";
import { LeadFavoriteButton } from "./LeadFavoriteButton";
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


/**
 * Spacious lead row: all information is column-aligned, while the selected
 * status and elapsed waiting time stay together in a vertical stack.
 */
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
  onFavorite,
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
  onFavorite: (lead: Lead) => void;
}) {
  const chance = hasEnoughDataForLeadChance(lead) ? calculateLeadChance(lead, lead.segment) : null;
  const contactDate = lead.lastContact || lead.firstContact;

  return (
    <article className="table-row jl-lead-row">
      <div className="company-cell jl-lead-company">
        <LeadNicheIcon segment={lead.segment} />
        <div className="jl-lead-company-copy">
          <strong className="jl-lead-company-name" title={lead.company}>{lead.company}</strong>
          <span className="lead-segment">{lead.segment || "Nicho não informado"}</span>
          {chance && <ChanceBadge chance={chance} />}
          {lead.enrichedAt && <small className="enriched-badge">Dados enriquecidos</small>}
          {updateCount > 0 && (
            <small className="lead-update-badge">
              {updateCount} {updateCount === 1 ? "atualização" : "atualizações"}
            </small>
          )}
          {lead.notes && <small className="jl-lead-company-note" title={lead.notes}>{leadNotePreview(lead.notes)}</small>}
        </div>
      </div>

      <div className="lead-location-cell"><LeadLocation lead={lead} /></div>
      <div className="phone-cell jl-lead-phone">
        <Phone size={14} aria-hidden="true" />
        <span>{lead.phone || "Sem telefone"}</span>
      </div>
      <div className="lead-status-stack">
        <StatusControl lead={lead} onStatus={onStatus} />
      </div>
      <div className="lead-next-action-cell">
        <LeadActionPreview lead={lead} />
      </div>
      <div className="lead-value-cell">
        {finance ? formatCurrency(finance.projectValue) : "—"}
      </div>
      <div className="date-cell jl-lead-date">
        <div><CalendarDays size={14} aria-hidden="true"/>
          <time dateTime={contactDate}>{formatDate(contactDate)}</time>
        </div>
        <small>{lead.lastContact ? "Último contato" : "Primeiro contato · sem retorno"}</small>
      </div>
      <LeadCardActions
        lead={lead}
        onFavorite={onFavorite}
        onDetails={onDetails}
        onMessage={onMessage}
        onFollowUp={onFollowUp}
        onEdit={onEdit}
        onDelete={onDelete}
        desktop
      />
    </article>
  );
}

/** Mobile cards use the same niche icon, statuses and actions as desktop. */
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
  onFavorite,
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
  onFavorite: (lead: Lead) => void;
}) {
  const chance = hasEnoughDataForLeadChance(lead) ? calculateLeadChance(lead, lead.segment) : null;
  const contactDate = lead.lastContact || lead.firstContact;

  return (
    <article className="lead-card jl-lead-mobile-card">
      <div className="jl-lead-mobile-top">
        <div className="jl-lead-mobile-company">
          <LeadNicheIcon segment={lead.segment} />
          <div className="jl-lead-company-copy">
            <strong className="jl-lead-company-name" title={lead.company}>{lead.company}</strong>
            <span className="lead-segment">{lead.segment || "Nicho não informado"}</span>
            {chance && <ChanceBadge chance={chance} />}
            {lead.enrichedAt && <small className="enriched-badge">Dados enriquecidos</small>}
            {updateCount > 0 && (
              <small className="lead-update-badge">{updateCount} {updateCount === 1 ? "atualização" : "atualizações"}</small>
            )}
          </div>
        </div>
        <StatusControl lead={lead} onStatus={onStatus} />
      </div>
      <div className="jl-lead-mobile-details">
        <LeadLocation lead={lead}/>
        <div className="jl-lead-phone"><Phone size={14} aria-hidden="true" /><span>{lead.phone || "Sem telefone disponível"}</span></div>
      </div>
      <div className="jl-lead-mobile-action">
        <LeadActionPreview lead={lead} />
        {finance && <LeadFinanceMarker summary={finance} />}
      </div>
      <div className="jl-lead-mobile-contact">
        <CalendarDays size={14} aria-hidden="true"/>
        <span>{lead.lastContact ? "Último contato" : "Primeiro contato"}: {formatDate(contactDate)}</span>
      </div>
      {lead.notes && <p className="card-notes jl-lead-note-preview" title={lead.notes}>{leadNotePreview(lead.notes)}</p>}
      <LeadCardActions
        lead={lead}
        onFavorite={onFavorite}
        onDetails={onDetails}
        onMessage={onMessage}
        onFollowUp={onFollowUp}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </article>
  );
}

function LeadCardActions({
  lead, onFavorite, onDetails, onMessage, onFollowUp, onEdit, onDelete, desktop = false,
}: {
  lead: Lead;
  onFavorite: (lead: Lead) => void;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onFollowUp: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  desktop?: boolean;
}) {
  return (
    <div className={desktop ? "actions-cell jl-lead-actions" : "card-actions jl-lead-actions"}>
      <div className="jl-lead-actions-top">
        <LeadFavoriteButton
          company={lead.company}
          isFavorite={lead.isFavorite === true}
          onToggle={() => onFavorite(lead)}
        />
        <button className="lead-details-button" onClick={() => onDetails(lead)} type="button">
          Ver empresa <ExternalLink size={13} aria-hidden="true"/>
        </button>
      </div>
      <div className="jl-lead-actions-bottom">
        {lead.phone && (
          <button className="message-button" onClick={() => onMessage(lead)} type="button">
            <MessageCircle size={15} aria-hidden="true"/>
            <span>Mandar mensagem</span>
          </button>
        )}
        {lead.status === "waiting" && Boolean(lead.phone) && (
          <button className="enrichment-button follow-up-action-button"
            onClick={() => onFollowUp(lead)}
            type="button" title="Fazer follow-up">
            <CalendarClock size={15} aria-hidden="true"/>
            <span>Fazer follow-up</span>
          </button>
        )}
        <button className="row-icon" onClick={() => onEdit(lead)} type="button"
          title="Editar" aria-label={"Editar " + lead.company}>
          <Edit3 size={16} aria-hidden="true"/>
        </button>
        <button className="row-icon danger" onClick={() => onDelete(lead)} type="button"
          title="Excluir" aria-label={"Excluir " + lead.company}>
          <Trash2 size={16} aria-hidden="true"/>
        </button>
      </div>
    </div>
  );
}

function LeadActionPreview({ lead }: { lead: Lead }) {
  const summary = getLeadActionSummary(lead);
  const action = summary.action;
  const label = action?.label ??
    (lead.status === "waiting" ? "Aguardando retorno" : "Sem próxima ação");
  const context = summary.saved?.date
    ? summary.temporal.label || "Ação registrada"
    : summary.saved
      ? "Ação registrada"
      : summary.suggested
        ? "Sugestão do sistema"
        : "Nenhuma próxima ação agendada";
  const Icon = lead.status === "waiting" ? CalendarClock : MessageCircle;
  return (
    <div className="jl-lead-action-preview">
      <div className="jl-lead-action-title"><Icon size={16} aria-hidden="true"/><strong>{label}</strong></div>
      <small>{context}</small>
    </div>
  );
}

function StatusControl({ lead, onStatus }: {
  lead: Lead;
  onStatus: (id: string, status: Status) => void;
}) {
  const waitingLabel = getLeadActionSummary(lead).waitingLabel;
  const Icon = lead.status === "waiting" ? Clock3 :
    lead.status === "accepted" ? BadgeCheck :
    lead.status === "rejected" ? Ban : Send;
  return (
    <div className="jl-lead-status-control">
      <label className={"jl-lead-status-pill jl-lead-status-pill--" + lead.status}>
        <Icon size={15} aria-hidden="true"/>
        <select value={lead.status}
          onChange={(event) => onStatus(lead.id, event.target.value as Status)}
          aria-label={"Alterar status de " + lead.company}>
          {(["send_message", "waiting", "accepted", "rejected"] as Status[]).map((status) => (
            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
          ))}
        </select>
        <ChevronDown size={13} aria-hidden="true"/>
      </label>
      {waitingLabel && <small className="jl-lead-waiting-help">{waitingLabel}</small>}
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

/** Keep search-generated URLs and raw metadata out of the lead card summary.
 * Complete notes remain intact in CRM and the Ver empresa detail view.
 */
function leadNotePreview(notes: string) {
  const withoutLinks = notes
    .replace(/(?:Google Maps\s*:\s*)?https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return withoutLinks.length > 124 ? withoutLinks.slice(0, 121).trimEnd() + "…" : withoutLinks;
}

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
