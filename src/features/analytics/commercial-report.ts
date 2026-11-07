import type { PersistedLead, LeadStatus } from "../leads/remote-leads";
import type { LeadPayment } from "../lead-finance/finance";
import { crmToday } from "../next-actions/next-actions";

export type ReportPeriod = "30" | "90" | "all";
export type ReportGroup = { name: string; count: number; accepted: number };
export type StatusCount = { status: LeadStatus; count: number };

export type CommercialReport = {
  period: ReportPeriod;
  from: string | null;
  to: string;
  registered: number;
  worked: number;
  accepted: number;
  rejected: number;
  waiting: number;
  notContacted: number;
  acceptanceRate: number | null;
  paymentsCount: number;
  received: number;
  bySegment: ReportGroup[];
  byCity: ReportGroup[];
  byStatus: StatusCount[];
};

function dateOffset(dateKey: string, days: number) {
  const base = Date.parse(dateKey + "T00:00:00Z");
  if (!Number.isFinite(base)) return null;
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

function validDateKey(value: string) {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && dateOffset(date, 0) === date ? date : null;
}

function inPeriod(value: string, start: string | null, to: string) {
  const day = validDateKey(value);
  return day !== null && day <= to && (start === null || day >= start);
}

function summarizeBy(
  leads: PersistedLead[],
  nameOf: (lead: PersistedLead) => string,
): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const lead of leads) {
    const name = nameOf(lead).trim() || "Não informado";
    const old = map.get(name) ?? { name, count: 0, accepted: 0 };
    old.count++;
    if (lead.status === "accepted") old.accepted++;
    map.set(name, old);
  }
  return [...map.values()].sort((a, b) =>
    b.count - a.count || b.accepted - a.accepted || a.name.localeCompare(b.name, "pt-BR")
  ).slice(0, 6);
}

/**
 * Reports on the *current* status of leads created in the selected period.
 * Does not claim to track historical status transitions, actual WhatsApp
 * deliveries, proposals or revenue attributable to lead creation cohorts.
 * Payments are filtered independently by their own payment date.
 */
export function buildCommercialReport(
  leads: readonly PersistedLead[],
  payments: readonly LeadPayment[],
  period: ReportPeriod,
  today = crmToday(),
): CommercialReport {
  const from = period === "all" ? null : dateOffset(today, -(Number(period) - 1));
  const selected = leads.filter((lead) => inPeriod(lead.createdAt, from, today));
  const statuses: LeadStatus[] = ["send_message", "waiting", "accepted", "rejected"];
  const byStatus = statuses.map((status) => ({
    status, count: selected.filter((lead) => lead.status === status).length,
  }));
  const count = (status: LeadStatus) => byStatus.find((row) => row.status === status)!.count;
  const accepted = count("accepted");
  const waiting = count("waiting");
  const rejected = count("rejected");
  const worked = waiting + accepted + rejected;
  const periodPayments = payments.filter((payment) => inPeriod(payment.paymentDate, from, today));
  const received = periodPayments.reduce((sum, payment) =>
    sum + (Number.isFinite(payment.amount) && payment.amount > 0 ? payment.amount : 0), 0);

  return {
    period,
    from,
    to: today,
    registered: selected.length,
    worked,
    accepted,
    rejected,
    waiting,
    notContacted: count("send_message"),
    acceptanceRate: worked > 0 ? Math.round((accepted / worked) * 1000) / 10 : null,
    paymentsCount: periodPayments.length,
    received: Math.round((received + Number.EPSILON) * 100) / 100,
    bySegment: summarizeBy(selected, (lead) => lead.segment),
    byCity: summarizeBy(selected, (lead) =>
      lead.city ? lead.city + (lead.state ? " / " + lead.state : "") : "Cidade não informada"
    ),
    byStatus,
  };
}
