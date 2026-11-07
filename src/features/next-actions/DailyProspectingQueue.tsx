import { useState } from "react";
import { CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import type { PersistedLead } from "../leads/remote-leads";
import type { NextActionType } from "./types";
import { addDaysToDateKey, crmToday } from "./next-actions";
import { buildDailyProspectingQueue } from "./daily-queue";

const GROUPS = [
  { key: "overdue", label: "Atrasadas", tone: "overdue" },
  { key: "today", label: "Para hoje", tone: "today" },
  { key: "suggested", label: "Sem ação definida", tone: "suggested" },
] as const;

export function DailyProspectingQueue({
  leads, onOpenLead, onShowAll, onSchedule, onComplete,
}: {
  leads: PersistedLead[];
  onOpenLead: (lead: PersistedLead) => void;
  onShowAll: () => void;
  onSchedule: (id: string, type: NextActionType, date: string) => void;
  onComplete: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const all = buildDailyProspectingQueue(leads);
  const visible = showAll ? all : all.slice(0, 9);
  const today = crmToday();
  return (
    <section className="dashboard-panel daily-routine" aria-labelledby="daily-routine-title">
      <div className="dashboard-panel-heading daily-routine-heading">
        <div>
          <span>ROTINA DE PROSPECÇÃO</span>
          <strong id="daily-routine-title">Próximos contatos em ordem de prioridade</strong>
        </div>
        <button type="button" onClick={onShowAll}>Filtrar em Meus Leads</button>
      </div>
      <p className="daily-routine-caption">
        A fila usa suas datas e status registrados. Não envia mensagens nem cria notificações externas automaticamente.
      </p>
      <div className="daily-routine-summary">
        {GROUPS.map(({ key, label }) => (
          <span key={key}><strong>{all.filter((item) => item.category === key).length}</strong> {label}</span>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="dashboard-panel-empty">
          Nenhuma atividade pendente. Defina a próxima ação em um lead para manter sua rotina organizada.
        </p>
      ) : (
        <div className="daily-routine-groups">
          {GROUPS.map(({ key, label, tone }) => {
            const items = visible.filter((item) => item.category === key);
            if (items.length === 0) return null;
            return (
              <section className={"daily-routine-group " + tone} key={key} aria-label={label}>
                <h3>{label}</h3>
                {items.map((item) => (
                  <div className="daily-routine-item" key={item.lead.id}>
                    <div className="daily-routine-item-info">
                      <Clock3 size={15} aria-hidden="true"/>
                      <div>
                        <strong>{item.lead.company}</strong>
                        <small>{item.label} · {item.detail}</small>
                      </div>
                    </div>
                    <div className="daily-routine-actions">
                      <button type="button" onClick={() => onOpenLead(item.lead)}>Abrir</button>
                      {item.category === "suggested" ? (
                        <button type="button" onClick={() => onSchedule(
                          item.lead.id,
                          item.lead.status === "waiting" ? "follow_up" : "initial_contact",
                          item.lead.status === "waiting" ? addDaysToDateKey(today, 1) : today,
                        )}>
                          <CalendarClock size={13} aria-hidden="true" />
                          {item.lead.status === "waiting" ? "Agendar amanhã" : "Agendar hoje"}
                        </button>
                      ) : (
                        <>
                          <button type="button" onClick={() => {
                            if (!item.lead.nextActionType) return;
                            onSchedule(item.lead.id, item.lead.nextActionType, addDaysToDateKey(item.date, 1));
                          }}>Adiar 1 dia</button>
                          <button type="button" onClick={() => onComplete(item.lead.id)}>
                            <CheckCircle2 size={13} aria-hidden="true"/> Concluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {all.length > 9 && (
        <button type="button" className="daily-routine-more" onClick={() => setShowAll((old) => !old)}>
          {showAll ? "Mostrar menos" : "Exibir todas as " + all.length + " ações"}
        </button>
      )}
    </section>
  );
}
