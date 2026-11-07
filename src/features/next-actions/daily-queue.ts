import type { PersistedLead } from "../leads/remote-leads";
import { crmToday, getLeadActionSummary } from "./next-actions";

export type DailyQueueEntry = {
  lead: PersistedLead;
  label: string;
  detail: string;
  category: "overdue" | "today" | "suggested";
  date: string;
};

export function buildDailyProspectingQueue(leads: PersistedLead[], today = crmToday()): DailyQueueEntry[] {
  const entries: DailyQueueEntry[] = [];
  for (const lead of leads) {
    if (lead.status === "accepted" || lead.status === "rejected") continue;
    const next = getLeadActionSummary(lead, today);
    if (next.saved?.date && next.temporal.daysDelta !== null && next.temporal.daysDelta <= 0) {
      const overdue = next.temporal.daysDelta < 0;
      entries.push({
        lead, label: next.saved.label, detail: next.temporal.label ?? (overdue ? "Atrasada" : "Hoje"),
        category: overdue ? "overdue" : "today", date: next.saved.date,
      });
    } else if (!next.saved && (lead.status === "send_message" || (lead.status === "waiting" && next.followUp.recommended))) {
      entries.push({
        lead,
        label: lead.status === "waiting" ? "Follow-up sugerido" : "Primeira abordagem",
        detail: lead.status === "waiting" ? (next.waitingLabel ?? "Aguardando resposta") : "Sem contato agendado",
        category: "suggested", date: "",
      });
    }
  }
  const priority = { overdue: 0, today: 1, suggested: 2 };
  return entries.sort((a, b) =>
    priority[a.category] - priority[b.category] ||
    a.date.localeCompare(b.date) ||
    a.lead.company.localeCompare(b.lead.company, "pt-BR")
  );
}
