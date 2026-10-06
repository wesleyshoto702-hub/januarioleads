import type { PersistedLead } from "../leads/remote-leads";
import type { NextActionType } from "./types";

export const FOLLOW_UP_RECOMMENDED_AFTER_DAYS = 5;
export const FOLLOW_UP_SOON_AFTER_DAYS = 3;
export const DEFAULT_FOLLOW_UP_DAYS = 5;

export type NextActionUrgency = "normal" | "upcoming" | "today" | "overdue";

export const NEXT_ACTION_OPTIONS: Array<[NextActionType, string]> = [
  ["initial_contact", "Enviar mensagem"],
  ["follow_up", "Fazer follow-up"],
  ["send_proposal", "Enviar proposta"],
  ["wait", "Aguardar"],
  ["meeting", "Reunião / conversa"],
  ["collect_payment", "Cobrar pagamento"],
  ["other", "Outra ação"],
];

export const NEXT_ACTION_LABEL: Record<NextActionType, string> =
  Object.fromEntries(NEXT_ACTION_OPTIONS) as Record<NextActionType, string>;

function brazilDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

export function crmToday(date = new Date()) {
  const { year, month, day } = brazilDateParts(date);
  return `${year}-${month}-${day}`;
}

function dateKeyToUtc(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

export function daysBetweenDateKeys(from: string, to: string) {
  const left = dateKeyToUtc(from);
  const right = dateKeyToUtc(to);
  if (left === null || right === null) return null;
  return Math.round((right - left) / 86_400_000);
}

export function addDaysToDateKey(value: string, days: number) {
  const timestamp = dateKeyToUtc(value);
  if (timestamp === null) return value;
  const date = new Date(timestamp + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

export function formatActionDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}`;
}

export function formatFullActionDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function getDaysSinceLastContact(
  lead: Pick<PersistedLead, "lastContact">,
  today = crmToday(),
) {
  if (!lead.lastContact) return null;
  const days = daysBetweenDateKeys(lead.lastContact, today);
  return days === null ? null : Math.max(0, days);
}

export function getWaitingLabel(
  lead: Pick<PersistedLead, "status" | "lastContact">,
  today = crmToday(),
) {
  if (lead.status !== "waiting") return null;
  const days = getDaysSinceLastContact(lead, today);
  if (days === null) return "Aguardando · contato sem data";
  if (days === 0) return "Aguardando hoje";
  if (days === 1) return "Aguardando há 1 dia";
  return `Aguardando há ${days} dias`;
}

export function getFollowUpState(
  lead: Pick<PersistedLead, "status" | "lastContact">,
  today = crmToday(),
) {
  const daysWaiting =
    lead.status === "waiting" ? getDaysSinceLastContact(lead, today) : null;
  const recommended =
    daysWaiting !== null && daysWaiting >= FOLLOW_UP_RECOMMENDED_AFTER_DAYS;
  const urgency =
    recommended
      ? "upcoming"
      : daysWaiting !== null && daysWaiting >= FOLLOW_UP_SOON_AFTER_DAYS
        ? "upcoming"
        : "normal";

  return {
    daysWaiting,
    recommended,
    urgency,
  } as const;
}

export function getNextActionTemporalState(
  date: string | undefined,
  today = crmToday(),
) {
  if (!date) {
    return {
      urgency: "normal" as NextActionUrgency,
      daysDelta: null,
      label: null,
    };
  }

  const daysDelta = daysBetweenDateKeys(today, date);
  if (daysDelta === null) {
    return {
      urgency: "normal" as NextActionUrgency,
      daysDelta: null,
      label: formatActionDate(date),
    };
  }

  if (daysDelta < 0) {
    const overdueDays = Math.abs(daysDelta);
    return {
      urgency: "overdue" as NextActionUrgency,
      daysDelta,
      label:
        overdueDays === 1
          ? "Atrasada há 1 dia"
          : `Atrasada há ${overdueDays} dias`,
    };
  }

  if (daysDelta === 0) {
    return {
      urgency: "today" as NextActionUrgency,
      daysDelta,
      label: "Hoje",
    };
  }

  if (daysDelta === 1) {
    return {
      urgency: "upcoming" as NextActionUrgency,
      daysDelta,
      label: "Amanhã",
    };
  }

  if (daysDelta <= 7) {
    return {
      urgency: "upcoming" as NextActionUrgency,
      daysDelta,
      label: `Em ${daysDelta} dias`,
    };
  }

  return {
    urgency: "normal" as NextActionUrgency,
    daysDelta,
    label: formatActionDate(date),
  };
}

export function getSavedNextAction(lead: Pick<
  PersistedLead,
  "status" | "nextActionType" | "nextActionDate" | "nextActionNotes"
>) {
  if (!lead.nextActionType) return null;
  if (lead.status === "rejected") return null;
  if (
    lead.status === "accepted" &&
    (lead.nextActionType === "follow_up" ||
      lead.nextActionType === "initial_contact")
  ) {
    return null;
  }

  return {
    type: lead.nextActionType,
    label: NEXT_ACTION_LABEL[lead.nextActionType],
    date: lead.nextActionDate,
    notes: lead.nextActionNotes,
    source: "saved" as const,
  };
}

export function getSuggestedNextAction(
  lead: Pick<
    PersistedLead,
    "status" | "lastContact" | "nextActionType" | "nextActionDate" | "nextActionNotes"
  >,
  today = crmToday(),
) {
  if (getSavedNextAction(lead)) return null;

  if (lead.status === "send_message") {
    return {
      type: "initial_contact" as NextActionType,
      label: NEXT_ACTION_LABEL.initial_contact,
      date: undefined,
      notes: undefined,
      source: "suggestion" as const,
    };
  }

  const followUp = getFollowUpState(lead, today);
  if (lead.status === "waiting" && followUp.recommended) {
    return {
      type: "follow_up" as NextActionType,
      label: NEXT_ACTION_LABEL.follow_up,
      date: undefined,
      notes: undefined,
      source: "suggestion" as const,
    };
  }

  return null;
}

export function getLeadActionSummary(
  lead: Pick<
    PersistedLead,
    | "status"
    | "lastContact"
    | "nextActionType"
    | "nextActionDate"
    | "nextActionNotes"
  >,
  today = crmToday(),
) {
  const saved = getSavedNextAction(lead);
  const suggested = saved ? null : getSuggestedNextAction(lead, today);
  const action = saved ?? suggested;
  const temporal = getNextActionTemporalState(saved?.date, today);
  const waitingLabel = getWaitingLabel(lead, today);
  const followUp = getFollowUpState(lead, today);

  return {
    action,
    saved,
    suggested,
    temporal,
    waitingLabel,
    followUp,
  };
}

export function clearActionForStatus(
  lead: PersistedLead,
  status: PersistedLead["status"],
) {
  if (status === "rejected") {
    return {
      ...lead,
      status,
      nextActionType: undefined,
      nextActionDate: undefined,
      nextActionNotes: undefined,
    };
  }

  if (
    status === "accepted" &&
    (lead.nextActionType === "follow_up" ||
      lead.nextActionType === "initial_contact")
  ) {
    return {
      ...lead,
      status,
      nextActionType: undefined,
      nextActionDate: undefined,
      nextActionNotes: undefined,
    };
  }

  return { ...lead, status };
}

export function nextActionSortValue(lead: PersistedLead, today = crmToday()) {
  const saved = getSavedNextAction(lead);
  if (!saved?.date) return Number.MAX_SAFE_INTEGER;
  const delta = daysBetweenDateKeys(today, saved.date);
  if (delta === null) return Number.MAX_SAFE_INTEGER;
  return delta;
}
