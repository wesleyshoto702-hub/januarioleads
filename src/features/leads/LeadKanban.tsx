import { useState, type DragEvent } from "react";
import { CalendarClock, GripVertical } from "lucide-react";
import type { PersistedLead, LeadStatus } from "./remote-leads";
import { STATUS_LABEL } from "./lead-status";
import { getLeadActionSummary } from "../next-actions/next-actions";
import { LeadFavoriteButton } from "./LeadFavoriteButton";
import { LeadNicheIcon } from "./LeadNicheIcon";

const COLUMNS: readonly LeadStatus[] = ["send_message", "waiting", "accepted", "rejected"];

/**
 * Kanban backed by existing CRM statuses. No shadow database or fabricated
 * negotiation stages. Updates use existing persistence + activity history.
 */
export function LeadKanban({
  leads, onChangeStatus, onOpenLead, onFavorite,
}: {
  leads: PersistedLead[];
  onChangeStatus: (id: string, status: LeadStatus) => void;
  onOpenLead: (lead: PersistedLead) => void;
  onFavorite: (lead: PersistedLead) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<LeadStatus | null>(null);

  function drop(event: DragEvent<HTMLElement>, status: LeadStatus) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragId;
    setDropColumn(null);
    setDragId(null);
    if (!id || !leads.some((lead) => lead.id === id)) return;
    onChangeStatus(id, status);
  }

  return (
    <section className="lead-kanban" aria-label="Funil de status dos leads">
      <p className="lead-kanban-guide">
        Arraste cartões entre colunas no computador ou escolha um status no cartão.
        As quatro etapas refletem os status reais do CRM; isto não é um funil automatizado de propostas.
      </p>
      <div className="lead-kanban-grid">
        {COLUMNS.map((status) => {
          const items = leads.filter((lead) => lead.status === status);
          return (
            <section
              key={status}
              className={"lead-kanban-column" + (dropColumn === status ? " is-target" : "")}
              aria-label={STATUS_LABEL[status] + ": " + items.length + " leads"}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
              onDragEnter={() => { if (dragId) setDropColumn(status); }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropColumn(null);
              }}
              onDrop={(event) => drop(event, status)}
            >
              <div className="lead-kanban-header">
                <strong>{STATUS_LABEL[status]}</strong>
                <span>{items.length}</span>
              </div>
              <div className="lead-kanban-items">
                {items.length === 0 && <p className="lead-kanban-empty">Nenhum lead nesta etapa</p>}
                {items.map((lead) => {
                  const next = getLeadActionSummary(lead);
                  return (
                    <article
                      key={lead.id}
                      className={"lead-kanban-card" + (dragId === lead.id ? " is-dragging" : "")}
                      draggable
                      onDragStart={(event) => {
                        setDragId(lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", lead.id);
                      }}
                      onDragEnd={() => { setDragId(null); setDropColumn(null); }}
                    >
                      <div className="lead-kanban-card-top">
                        <GripVertical size={15} aria-hidden="true"/>
                        <LeadNicheIcon segment={lead.segment} compact/>
                        <strong>{lead.company}</strong>
                        <LeadFavoriteButton
                          company={lead.company}
                          isFavorite={lead.isFavorite === true}
                          onToggle={() => onFavorite(lead)}
                        />
                      </div>
                      <small>{lead.segment}{lead.city ? " · " + lead.city : ""}</small>
                      {next.saved && (
                        <span className="lead-kanban-action"><CalendarClock size={13} aria-hidden="true" />
                          {next.saved.label}{next.saved.date ? " · " + next.saved.date.split("-").reverse().join("/") : ""}
                        </span>
                      )}
                      <div className="lead-kanban-card-actions">
                        <button type="button" onClick={() => onOpenLead(lead)}>Ver empresa</button>
                        <label>
                          <span className="sr-only">Mover {lead.company} para</span>
                          <select aria-label={"Status de " + lead.company} value={lead.status}
                            onChange={(e) => onChangeStatus(lead.id, e.target.value as LeadStatus)}>
                            {COLUMNS.map((target) => (
                              <option key={target} value={target}>{STATUS_LABEL[target]}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
