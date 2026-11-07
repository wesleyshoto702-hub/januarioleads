import type { PersistedLead } from "../leads/remote-leads";
import { crmToday, addDaysToDateKey } from "../next-actions/next-actions";
import { buildDailyProspectingQueue } from "../next-actions/daily-queue";
import { evaluateIdealCustomer, type IdealCustomerProfile } from "../qualification/ideal-customer-profile";

export type ReportTrendPoint = { start: string; end: string; label: string; count: number; accepted: number };
export type ProspectingInsight = {
  trend: ReportTrendPoint[];
  due: { overdue: number; today: number; unplanned: number };
  topSegments: { name: string; total: number; accepted: number; rate: number | null }[];
  highPriority: number;
};

function validCreatedDay(value: string) {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return Number.isFinite(Date.parse(day + "T00:00:00Z")) &&
    new Date(day + "T00:00:00Z").toISOString().slice(0, 10) === day ? day : null;
}

export function buildProspectingInsights(
  leads: readonly PersistedLead[],
  profile: IdealCustomerProfile,
  today = crmToday(),
): ProspectingInsight {
  const trend: ReportTrendPoint[] = Array.from({ length: 8 }, (_, index) => {
    const start = addDaysToDateKey(today, -(7 - index) * 7 - 6);
    const end = addDaysToDateKey(start, 6);
    const matching = leads.filter((lead) => {
      const date = validCreatedDay(lead.createdAt);
      return date !== null && date >= start && date <= end;
    });
    return {
      start, end, label: start.slice(8, 10) + "/" + start.slice(5, 7),
      count: matching.length,
      accepted: matching.filter((lead) => lead.status === "accepted").length,
    };
  });
  const queue = buildDailyProspectingQueue([...leads], today);
  const segments = new Map<string, { name: string; total: number; accepted: number }>();
  for (const lead of leads) {
    const name = lead.segment.trim() || "Não informado";
    const entry = segments.get(name) ?? { name, total: 0, accepted: 0 };
    entry.total++;
    if (lead.status === "accepted") entry.accepted++;
    segments.set(name, entry);
  }
  return {
    trend,
    due: {
      overdue: queue.filter((entry) => entry.category === "overdue").length,
      today: queue.filter((entry) => entry.category === "today").length,
      unplanned: queue.filter((entry) => entry.category === "suggested").length,
    },
    topSegments: [...segments.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 5).map((entry) => ({
        ...entry, rate: entry.total ? Math.round(entry.accepted / entry.total * 1000) / 10 : null,
      })),
    highPriority: leads.filter((lead) => lead.status !== "accepted" && lead.status !== "rejected" &&
      evaluateIdealCustomer(lead, profile).score >= 70).length,
  };
}
