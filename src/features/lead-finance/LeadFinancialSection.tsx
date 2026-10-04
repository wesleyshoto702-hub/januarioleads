import { Check, Plus, Wallet, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PersistedLead } from "../leads/remote-leads";
import {
  createLeadPayment,
  FINANCIAL_STATUS_LABEL,
  formatCurrency,
  formatPaymentMethod,
  localToday,
  PAYMENT_METHOD_OPTIONS,
  sortPaymentsNewestFirst,
  summarizeLeadFinance,
  type LeadPayment,
  type PaymentMethod,
} from "./finance";

type Props = {
  lead: PersistedLead;
  payments: LeadPayment[];
  onFinanceUpdate: (
    leadId: string,
    patch: Pick<PersistedLead, "projectValue" | "financialNotes">,
  ) => void;
  onPaymentSaved: (payment: LeadPayment) => void;
};

function parseMoneyInput(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const amount = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function inputMoney(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2).replace(".", ",")
    : "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function LeadFinancialSection({
  lead,
  payments,
  onFinanceUpdate,
  onPaymentSaved,
}: Props) {
  const summary = useMemo(
    () => summarizeLeadFinance(lead, payments),
    [lead, payments],
  );
  const orderedPayments = useMemo(
    () => sortPaymentsNewestFirst(payments),
    [payments],
  );
  const [editingProject, setEditingProject] = useState(!summary);
  const [projectValue, setProjectValue] = useState(inputMoney(lead.projectValue));
  const [financialNotes, setFinancialNotes] = useState(lead.financialNotes ?? "");
  const [projectError, setProjectError] = useState("");
  const [paymentModal, setPaymentModal] = useState(false);

  useEffect(() => {
    setProjectValue(inputMoney(lead.projectValue));
    setFinancialNotes(lead.financialNotes ?? "");
  }, [lead.id, lead.projectValue, lead.financialNotes]);

  useEffect(() => {
    if (!summary) setEditingProject(true);
  }, [summary]);

  function saveProject(event: FormEvent) {
    event.preventDefault();
    const parsed = parseMoneyInput(projectValue);
    if (parsed === null || parsed <= 0) {
      setProjectError("Informe um valor de projeto maior que zero.");
      return;
    }
    onFinanceUpdate(lead.id, {
      projectValue: parsed,
      financialNotes: financialNotes.trim(),
    });
    setProjectError("");
    setEditingProject(false);
  }

  return (
    <div className="detail-section lead-finance-section">
      <div className="lead-finance-heading">
        <div>
          <span className="detail-kicker">CONTROLE SIMPLES</span>
          <h3>Financeiro</h3>
        </div>
        {summary && (
          <span className={`financial-status-badge ${summary.status}`}>
            {FINANCIAL_STATUS_LABEL[summary.status]}
          </span>
        )}
      </div>

      {summary ? (
        <>
          <div className="lead-finance-summary">
            <div>
              <span>Valor do projeto</span>
              <strong>{formatCurrency(summary.projectValue)}</strong>
            </div>
            <div>
              <span>Recebido</span>
              <strong>{formatCurrency(summary.receivedValue)}</strong>
            </div>
            <div>
              <span>Restante</span>
              <strong>{formatCurrency(summary.remainingValue)}</strong>
            </div>
          </div>

          <div className="lead-finance-meta">
            <div>
              <span>Último recebimento</span>
              <strong>{formatDate(summary.lastPayment?.paymentDate)}</strong>
            </div>
            <div>
              <span>Forma de pagamento</span>
              <strong>{formatPaymentMethod(summary.lastPayment)}</strong>
            </div>
          </div>

          {lead.financialNotes && !editingProject && (
            <p className="lead-finance-notes">{lead.financialNotes}</p>
          )}

          <div className="lead-finance-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditingProject((current) => !current)}
            >
              Editar projeto
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => setPaymentModal(true)}
            >
              <Plus size={14} />
              Registrar recebimento
            </button>
          </div>
        </>
      ) : (
        <div className="lead-finance-empty">
          <Wallet size={18} />
          <div>
            <strong>Nenhum valor de projeto registrado</strong>
            <span>Defina o valor para começar a acompanhar os recebimentos.</span>
          </div>
        </div>
      )}

      {editingProject && (
        <form className="lead-finance-project-form" onSubmit={saveProject}>
          <label>
            <span>Valor do projeto</span>
            <div className="money-input">
              <b>R$</b>
              <input
                value={projectValue}
                onChange={(event) => setProjectValue(event.target.value)}
                inputMode="decimal"
                placeholder="800,00"
                aria-label="Valor do projeto"
              />
            </div>
          </label>
          <label className="lead-finance-notes-field">
            <span>Observações financeiras</span>
            <textarea
              rows={2}
              value={financialNotes}
              onChange={(event) => setFinancialNotes(event.target.value)}
              placeholder="Ex.: 50% na entrada e 50% na entrega."
            />
          </label>
          {projectError && <p className="finance-inline-error">{projectError}</p>}
          <div className="lead-finance-form-actions">
            {summary && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditingProject(false)}
              >
                Cancelar
              </button>
            )}
            <button type="submit" className="primary-button">
              <Check size={14} />
              Salvar financeiro
            </button>
          </div>
        </form>
      )}

      {orderedPayments.length > 0 && (
        <div className="lead-payment-history">
          <div className="lead-payment-history-heading">
            <strong>Recebimentos</strong>
            <span>{orderedPayments.length}</span>
          </div>
          <div className="lead-payment-list">
            {orderedPayments.map((payment) => (
              <article key={payment.id}>
                <div>
                  <strong>{formatCurrency(payment.amount)}</strong>
                  <span>{formatDate(payment.paymentDate)}</span>
                </div>
                <div>
                  <strong>{formatPaymentMethod(payment)}</strong>
                  {payment.notes && <span>{payment.notes}</span>}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {paymentModal && summary && (
        <RegisterPaymentModal
          leadId={lead.id}
          remainingValue={summary.remainingValue}
          onClose={() => setPaymentModal(false)}
          onSaved={(payment) => {
            onPaymentSaved(payment);
            setPaymentModal(false);
          }}
        />
      )}
    </div>
  );
}

function RegisterPaymentModal({
  leadId,
  remainingValue,
  onClose,
  onSaved,
}: {
  leadId: string;
  remainingValue: number;
  onClose: () => void;
  onSaved: (payment: LeadPayment) => void;
}) {
  const [amount, setAmount] = useState(
    remainingValue > 0 ? inputMoney(remainingValue) : "",
  );
  const [paymentDate, setPaymentDate] = useState(localToday());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [paymentMethodOther, setPaymentMethodOther] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseMoneyInput(amount);
    if (parsed === null || parsed <= 0) {
      setError("Informe um valor recebido maior que zero.");
      return;
    }
    if (!paymentDate) {
      setError("Informe a data do recebimento.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payment = await createLeadPayment({
        leadId,
        amount: parsed,
        paymentDate,
        paymentMethod,
        paymentMethodOther:
          paymentMethod === "other" ? paymentMethodOther.slice(0, 80) : null,
        notes: notes.slice(0, 500),
      });
      onSaved(payment);
    } catch {
      setError("Não foi possível salvar este recebimento agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-payment-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="finance-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Registrar recebimento"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="finance-payment-modal-heading">
          <div>
            <span>FINANCEIRO</span>
            <h3>Registrar recebimento</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        <form onSubmit={save} className="finance-payment-form">
          <label>
            <span>Valor recebido</span>
            <div className="money-input">
              <b>R$</b>
              <input
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="400,00"
              />
            </div>
          </label>

          <label>
            <span>Data</span>
            <input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
            />
          </label>

          <label>
            <span>Forma de pagamento</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
            >
              {PAYMENT_METHOD_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          {paymentMethod === "other" && (
            <label>
              <span>Qual forma?</span>
              <input
                value={paymentMethodOther}
                onChange={(event) => setPaymentMethodOther(event.target.value)}
                maxLength={80}
                placeholder="Opcional"
              />
            </label>
          )}

          <label className="finance-payment-notes">
            <span>Observação</span>
            <textarea
              rows={3}
              value={notes}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional"
            />
          </label>

          {error && <p className="finance-inline-error">{error}</p>}

          <div className="finance-payment-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar recebimento"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
