import { getValidSession } from "../../lib/auth";
import type { PersistedLead } from "../leads/remote-leads";

const SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

export type PaymentMethod = "pix" | "cash" | "card" | "transfer" | "other";
export type FinancialStatus = "pending" | "partial" | "paid";

export type LeadPayment = {
  id: string;
  leadId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentMethodOther: string | null;
  notes: string | null;
  createdAt: string;
};

export type LeadFinanceSummary = {
  projectValue: number;
  receivedValue: number;
  remainingValue: number;
  status: FinancialStatus;
  lastPayment: LeadPayment | null;
};

type RemoteLeadPayment = {
  id: string;
  lead_id: string;
  amount: number | string;
  payment_date: string;
  payment_method: PaymentMethod;
  payment_method_other: string | null;
  notes: string | null;
  created_at: string;
};

export const PAYMENT_METHOD_OPTIONS: Array<[PaymentMethod, string]> = [
  ["pix", "PIX"],
  ["cash", "Dinheiro"],
  ["card", "Cartão"],
  ["transfer", "Transferência"],
  ["other", "Outro"],
];

export const FINANCIAL_STATUS_LABEL: Record<FinancialStatus, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
};

async function authedRequest(path: string, init: RequestInit = {}) {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function amountFromRemote(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function fromRemote(row: RemoteLeadPayment): LeadPayment {
  return {
    id: row.id,
    leadId: row.lead_id,
    amount: amountFromRemote(row.amount),
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    paymentMethodOther: row.payment_method_other,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function paymentTimestamp(payment: LeadPayment) {
  return `${payment.paymentDate}T${payment.createdAt.split("T")[1] ?? "00:00:00"}`;
}

export function sortPaymentsNewestFirst(payments: LeadPayment[]) {
  return [...payments].sort((a, b) =>
    paymentTimestamp(b).localeCompare(paymentTimestamp(a)),
  );
}

export function summarizeLeadFinance(
  lead: Pick<PersistedLead, "projectValue">,
  payments: LeadPayment[],
): LeadFinanceSummary | null {
  const projectValue =
    typeof lead.projectValue === "number" && Number.isFinite(lead.projectValue)
      ? cents(Math.max(0, lead.projectValue))
      : 0;

  if (projectValue <= 0) return null;

  const receivedValue = cents(
    payments.reduce((total, payment) => total + Math.max(0, payment.amount), 0),
  );
  const remainingValue = cents(Math.max(0, projectValue - receivedValue));
  const status: FinancialStatus =
    receivedValue <= 0
      ? "pending"
      : receivedValue >= projectValue
        ? "paid"
        : "partial";

  return {
    projectValue,
    receivedValue,
    remainingValue,
    status,
    lastPayment: sortPaymentsNewestFirst(payments)[0] ?? null,
  };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPaymentMethod(payment: LeadPayment | null) {
  if (!payment) return "—";
  const label =
    PAYMENT_METHOD_OPTIONS.find(([value]) => value === payment.paymentMethod)?.[1] ??
    "Outro";
  if (payment.paymentMethod === "other" && payment.paymentMethodOther?.trim()) {
    return `${label} · ${payment.paymentMethodOther.trim()}`;
  }
  return label;
}

export function monthKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 7);
}

export function localToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export async function fetchLeadPayments() {
  const response = await authedRequest(
    "lead_payments?select=id,lead_id,amount,payment_date,payment_method,payment_method_other,notes,created_at&order=payment_date.desc,created_at.desc",
  );
  if (!response.ok) {
    throw new Error(`LEAD_PAYMENTS_${response.status}`);
  }
  return ((await response.json()) as RemoteLeadPayment[]).map(fromRemote);
}

export async function createLeadPayment(input: {
  leadId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentMethodOther?: string | null;
  notes?: string | null;
}) {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");

  const response = await authedRequest("lead_payments", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      lead_id: input.leadId,
      user_id: session.user.id,
      amount: cents(input.amount),
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod,
      payment_method_other:
        input.paymentMethod === "other"
          ? input.paymentMethodOther?.trim() || null
          : null,
      notes: input.notes?.trim() || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`LEAD_PAYMENT_CREATE_${response.status}`);
  }

  const rows = (await response.json()) as RemoteLeadPayment[];
  if (!rows[0]) throw new Error("LEAD_PAYMENT_CREATE_EMPTY");
  return fromRemote(rows[0]);
}
