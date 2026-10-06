import { CalendarCheck2, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { PersistedLead } from "../leads/remote-leads";
import {
  DEFAULT_FOLLOW_UP_DAYS,
  NEXT_ACTION_LABEL,
  NEXT_ACTION_OPTIONS,
  addDaysToDateKey,
  crmToday,
  formatFullActionDate,
  getLeadActionSummary,
} from "./next-actions";
import type { NextActionType } from "./types";

export type NextActionPatch = Pick<
  PersistedLead,
  "nextActionType" | "nextActionDate" | "nextActionNotes"
>;

export function LeadActionSummary({
  lead,
  compact = false,
}: {
  lead: PersistedLead;
  compact?: boolean;
}) {
  const summary = getLeadActionSummary(lead);
  const action = summary.action;

  return (
    <div className={compact ? "lead-action-summary compact" : "lead-action-summary"}>
      {summary.waitingLabel && (
        <span className="lead-waiting-label">{summary.waitingLabel}</span>
      )}
      {action ? (
        <span
          className={
            summary.saved
              ? `lead-next-action ${summary.temporal.urgency}`
              : "lead-next-action suggestion"
          }
        >
          <b>{summary.saved ? "Próxima ação" : "Sugestão"}</b>
          <strong>{action.label}</strong>
          {summary.saved?.date && (
            <small>{summary.temporal.label ?? formatFullActionDate(summary.saved.date)}</small>
          )}
          {!summary.saved && summary.followUp.recommended && (
            <small>Follow-up recomendado</small>
          )}
        </span>
      ) : null}
    </div>
  );
}

export function LeadNextActionSection({
  lead,
  onSave,
  onComplete,
  onFollowUp,
}: {
  lead: PersistedLead;
  onSave: (patch: NextActionPatch) => void | Promise<void>;
  onComplete: () => void | Promise<void>;
  onFollowUp?: () => void;
}) {
  const summary = getLeadActionSummary(lead);
  const [editing, setEditing] = useState(false);
  const [actionType, setActionType] = useState<NextActionType | "">(
    lead.nextActionType ?? "",
  );
  const [actionDate, setActionDate] = useState(lead.nextActionDate ?? "");
  const [actionNotes, setActionNotes] = useState(lead.nextActionNotes ?? "");

  useEffect(() => {
    setEditing(false);
    setActionType(lead.nextActionType ?? "");
    setActionDate(lead.nextActionDate ?? "");
    setActionNotes(lead.nextActionNotes ?? "");
  }, [
    lead.id,
    lead.nextActionType,
    lead.nextActionDate,
    lead.nextActionNotes,
  ]);

  function beginEdit() {
    const suggested = summary.suggested;
    const today = crmToday();
    setActionType(lead.nextActionType ?? suggested?.type ?? "");
    setActionDate(
      lead.nextActionDate ??
        (suggested?.type === "follow_up"
          ? addDaysToDateKey(today, DEFAULT_FOLLOW_UP_DAYS)
          : suggested?.type === "initial_contact"
            ? today
            : ""),
    );
    setActionNotes(lead.nextActionNotes ?? "");
    setEditing(true);
  }

  function save() {
    if (!actionType || !actionDate) return;
    void onSave({
      nextActionType: actionType,
      nextActionDate: actionDate,
      nextActionNotes: actionNotes.trim() || undefined,
    });
    setEditing(false);
  }

  function clear() {
    void onSave({
      nextActionType: undefined,
      nextActionDate: undefined,
      nextActionNotes: undefined,
    });
    setEditing(false);
  }

  return (
    <section className="detail-section lead-follow-up-section">
      <div className="lead-follow-up-heading">
        <div>
          <span>ACOMPANHAMENTO</span>
          <h3>Próxima ação</h3>
        </div>
        {summary.saved && (
          <span className={`next-action-state ${summary.temporal.urgency}`}>
            {summary.temporal.label ?? "Agendada"}
          </span>
        )}
      </div>

      <div className="follow-up-overview">
        <div>
          <span>Status</span>
          <strong>{lead.status === "send_message" ? "Enviar mensagem" : lead.status === "waiting" ? "Aguardando" : lead.status === "accepted" ? "Aceito" : "Recusado"}</strong>
        </div>
        <div>
          <span>Último contato</span>
          <strong>
            {lead.lastContact ? formatFullActionDate(lead.lastContact) : "Não registrado"}
          </strong>
        </div>
        <div>
          <span>Tempo sem resposta</span>
          <strong>{summary.waitingLabel ?? "—"}</strong>
        </div>
      </div>

      {!editing && (
        <div className="next-action-current">
          {summary.saved ? (
            <>
              <div>
                <span>Ação salva</span>
                <strong>{summary.saved.label}</strong>
                {summary.saved.date && (
                  <small>{formatFullActionDate(summary.saved.date)}</small>
                )}
                {summary.saved.notes && <p>{summary.saved.notes}</p>}
              </div>
            </>
          ) : summary.suggested ? (
            <div>
              <span>Sugestão do sistema</span>
              <strong>{summary.suggested.label}</strong>
              {summary.followUp.recommended && (
                <small>Follow-up recomendado pelo tempo de espera.</small>
              )}
            </div>
          ) : (
            <div>
              <span>Próxima ação</span>
              <strong>Sem próxima ação definida</strong>
            </div>
          )}

          <div className="next-action-buttons">
            <button type="button" className="secondary-button" onClick={beginEdit}>
              {summary.saved ? "Editar próxima ação" : "Definir próxima ação"}
            </button>
            {summary.saved && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onComplete()}
              >
                <CalendarCheck2 size={14} />
                Concluir ação
              </button>
            )}
            {lead.status === "waiting" && lead.phone && onFollowUp && (
              <button type="button" className="message-button" onClick={onFollowUp}>
                <MessageCircle size={14} />
                Fazer follow-up
              </button>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="next-action-form">
          <label>
            <span>Próxima ação</span>
            <select
              value={actionType}
              onChange={(event) =>
                setActionType(event.target.value as NextActionType | "")
              }
            >
              <option value="">Selecione</option>
              {NEXT_ACTION_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Data</span>
            <input
              type="date"
              value={actionDate}
              onChange={(event) => setActionDate(event.target.value)}
            />
          </label>
          <label className="next-action-notes">
            <span>Observação da ação</span>
            <textarea
              rows={3}
              maxLength={500}
              value={actionNotes}
              onChange={(event) => setActionNotes(event.target.value)}
              placeholder="Contexto opcional para esta próxima ação."
            />
          </label>
          <div className="next-action-form-actions">
            {summary.saved && (
              <button type="button" className="secondary-button" onClick={clear}>
                Remover ação
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!actionType || !actionDate}
              onClick={save}
            >
              Salvar próxima ação
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
