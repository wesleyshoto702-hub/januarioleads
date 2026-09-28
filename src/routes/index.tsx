import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Edit3,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  component: LeadFlowApp,
});

type Status = "waiting" | "accepted" | "rejected";

type Lead = {
  id: string;
  company: string;
  segment: string;
  phone: string;
  status: Status;
  firstContact: string;
  lastContact?: string;
  notes: string;
  createdAt: string;
};

type LeadForm = Omit<Lead, "id" | "createdAt" | "lastContact">;

const SEGMENTS = [
  "Açaiteria",
  "Hamburgueria",
  "Barbearia",
  "Odontologia",
  "Pastelaria",
  "Restaurante",
  "Academia",
  "Loja",
  "Imobiliária",
  "Outro",
];

const DEFAULT_MESSAGES = [
  "Olá! Meu nome é Wesley. Conheci um pouco do trabalho da {empresa} e gostaria de saber se teriam interesse em ter um site profissional para a empresa.",
  "Olá! Trabalho com criação de sites e landing pages para negócios e queria apresentar uma ideia que poderia fortalecer a presença online da {empresa}.",
  "Olá! Tudo bem? Trabalho desenvolvendo sites para empresas e gostaria de saber se vocês teriam interesse em conhecer uma proposta para a {empresa}.",
];

const EMPTY_FORM: LeadForm = {
  company: "",
  segment: "",
  phone: "",
  status: "waiting",
  firstContact: new Date().toISOString().slice(0, 10),
  notes: "",
};

const STORAGE = {
  leads: "leadflow:leads",
  messages: "leadflow:messages",
  theme: "leadflow:theme",
};

const STATUS_LABEL: Record<Status, string> = {
  waiting: "Aguardando",
  accepted: "Aceito",
  rejected: "Recusado",
};

function LeadFlowApp() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<"leads" | "messages">("leads");
  const [leadModal, setLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [messageLead, setMessageLead] = useState<Lead | null>(null);
  const [selectedMessage, setSelectedMessage] = useState(0);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    try {
      const storedLeads = localStorage.getItem(STORAGE.leads);
      const storedMessages = localStorage.getItem(STORAGE.messages);
      const storedTheme = localStorage.getItem(STORAGE.theme) as "light" | "dark" | null;
      if (storedLeads) setLeads(JSON.parse(storedLeads));
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        if (Array.isArray(parsed) && parsed.length === 3) setMessages(parsed);
      }
      if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
    } catch {
      // If localStorage is corrupted, keep safe defaults instead of breaking the app.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.leads, JSON.stringify(leads));
  }, [leads, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.messages, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.theme, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, hydrated]);

  const counts = useMemo(
    () => ({
      all: leads.length,
      waiting: leads.filter((lead) => lead.status === "waiting").length,
      accepted: leads.filter((lead) => lead.status === "accepted").length,
      rejected: leads.filter((lead) => lead.status === "rejected").length,
    }),
    [leads],
  );

  const availableSegments = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.segment).filter(Boolean))).sort(),
    [leads],
  );

  const visibleLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      const matchesSearch =
        !query ||
        lead.company.toLowerCase().includes(query) ||
        lead.segment.toLowerCase().includes(query) ||
        lead.phone.replace(/\D/g, "").includes(query.replace(/\D/g, ""));
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesSegment = segmentFilter === "all" || lead.segment === segmentFilter;
      return matchesSearch && matchesStatus && matchesSegment;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "az") return a.company.localeCompare(b.company, "pt-BR");
      if (sort === "za") return b.company.localeCompare(a.company, "pt-BR");
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [leads, search, statusFilter, segmentFilter, sort]);

  function openNewLead() {
    setEditingLead(null);
    setForm({ ...EMPTY_FORM, firstContact: new Date().toISOString().slice(0, 10) });
    setLeadModal(true);
  }

  function openEditLead(lead: Lead) {
    setEditingLead(lead);
    setForm({
      company: lead.company,
      segment: lead.segment,
      phone: lead.phone,
      status: lead.status,
      firstContact: lead.firstContact,
      notes: lead.notes,
    });
    setLeadModal(true);
  }

  function saveLead(event: FormEvent) {
    event.preventDefault();
    if (!form.company.trim() || !form.segment.trim() || !form.phone.trim()) return;

    if (editingLead) {
      setLeads((current) =>
        current.map((lead) =>
          lead.id === editingLead.id
            ? { ...lead, ...form, company: form.company.trim(), segment: form.segment.trim() }
            : lead,
        ),
      );
    } else {
      const newLead: Lead = {
        ...form,
        company: form.company.trim(),
        segment: form.segment.trim(),
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setLeads((current) => [newLead, ...current]);
    }

    setLeadModal(false);
    setEditingLead(null);
  }

  function changeStatus(id: string, status: Status) {
    setLeads((current) =>
      current.map((lead) => (lead.id === id ? { ...lead, status } : lead)),
    );
  }

  function confirmDelete() {
    if (!deleteLead) return;
    setLeads((current) => current.filter((lead) => lead.id !== deleteLead.id));
    setDeleteLead(null);
  }

  function normalizeBrazilianPhone(value: string) {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
    if (!digits.startsWith("55")) digits = "55" + digits;
    return digits;
  }

  function openWhatsApp() {
    if (!messageLead) return;
    const phone = normalizeBrazilianPhone(messageLead.phone);
    const personalized = messages[selectedMessage].replaceAll("{empresa}", messageLead.company);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(personalized)}`;
    const today = new Date().toISOString().slice(0, 10);
    setLeads((current) =>
      current.map((lead) =>
        lead.id === messageLead.id ? { ...lead, lastContact: today } : lead,
      ),
    );
    window.open(url, "_blank", "noopener,noreferrer");
    setMessageLead(null);
  }

  function saveMessages() {
    localStorage.setItem(STORAGE.messages, JSON.stringify(messages));
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => setView("leads")} type="button">
            <span className="brand-mark">L</span>
            <span>LeadFlow</span>
          </button>

          <nav className="topnav" aria-label="Navegação principal">
            <button
              className={view === "leads" ? "nav-link active" : "nav-link"}
              onClick={() => setView("leads")}
              type="button"
            >
              Meus Leads
            </button>
            <button
              className={view === "messages" ? "nav-link active" : "nav-link"}
              onClick={() => setView("messages")}
              type="button"
            >
              Mensagens
            </button>
          </nav>

          <button
            className="icon-button"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            type="button"
            aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
            title={theme === "light" ? "Tema escuro" : "Tema claro"}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {view === "leads" ? (
        <section className="page-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">PROSPECÇÃO PESSOAL</p>
              <h1>Meus leads</h1>
              <p className="subtitle">Cadastre, acompanhe e abra conversas no WhatsApp sem complicação.</p>
            </div>
            <button className="primary-button" onClick={openNewLead} type="button">
              <Plus size={17} />
              Novo lead
            </button>
          </div>

          <div className="stats-strip">
            <Stat label="Total de leads" value={counts.all} tone="neutral" />
            <Stat label="Aguardando" value={counts.waiting} tone="waiting" />
            <Stat label="Aceitos" value={counts.accepted} tone="accepted" />
            <Stat label="Recusados" value={counts.rejected} tone="rejected" />
          </div>

          <div className="lead-panel">
            <div className="panel-toolbar">
              <div className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar empresa..."
                  aria-label="Buscar empresa"
                />
              </div>

              <div className="toolbar-selects">
                <Select
                  value={segmentFilter}
                  onChange={setSegmentFilter}
                  ariaLabel="Filtrar por segmento"
                  options={[
                    ["all", "Todos os segmentos"],
                    ...availableSegments.map((segment) => [segment, segment] as [string, string]),
                  ]}
                />
                <Select
                  value={sort}
                  onChange={setSort}
                  ariaLabel="Ordenar leads"
                  options={[
                    ["recent", "Mais recentes"],
                    ["oldest", "Mais antigos"],
                    ["az", "Nome A-Z"],
                    ["za", "Nome Z-A"],
                  ]}
                />
              </div>
            </div>

            <div className="filter-row">
              {([
                ["all", "Todos", counts.all],
                ["waiting", "Aguardando", counts.waiting],
                ["accepted", "Aceitos", counts.accepted],
                ["rejected", "Recusados", counts.rejected],
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className={statusFilter === value ? "filter-chip active" : "filter-chip"}
                  onClick={() => setStatusFilter(value)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>

            <div className="desktop-table">
              <div className="table-head">
                <span>Empresa</span>
                <span>WhatsApp</span>
                <span>Status</span>
                <span>Contato</span>
                <span>Ações</span>
              </div>
              {visibleLeads.length ? (
                visibleLeads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    onStatus={changeStatus}
                    onMessage={(item) => {
                      setSelectedMessage(0);
                      setMessageLead(item);
                    }}
                    onEdit={openEditLead}
                    onDelete={setDeleteLead}
                  />
                ))
              ) : (
                <EmptyState onNew={openNewLead} hasLeads={leads.length > 0} />
              )}
            </div>

            <div className="mobile-list">
              {visibleLeads.length ? (
                visibleLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onStatus={changeStatus}
                    onMessage={(item) => {
                      setSelectedMessage(0);
                      setMessageLead(item);
                    }}
                    onEdit={openEditLead}
                    onDelete={setDeleteLead}
                  />
                ))
              ) : (
                <EmptyState onNew={openNewLead} hasLeads={leads.length > 0} />
              )}
            </div>
          </div>
        </section>
      ) : (
        <MessagesView
          messages={messages}
          setMessages={setMessages}
          onSave={saveMessages}
          savedNotice={savedNotice}
        />
      )}

      {leadModal && (
        <Modal onClose={() => setLeadModal(false)} title={editingLead ? "Editar lead" : "Novo lead"}>
          <form className="lead-form" onSubmit={saveLead}>
            <label>
              <span>Nome da empresa</span>
              <input
                required
                value={form.company}
                onChange={(event) => setForm({ ...form, company: event.target.value })}
                placeholder="Ex.: Texas Burguer"
              />
            </label>

            <label>
              <span>Tipo de negócio</span>
              <input
                required
                list="segments"
                value={form.segment}
                onChange={(event) => setForm({ ...form, segment: event.target.value })}
                placeholder="Selecione ou digite"
              />
              <datalist id="segments">
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment} />
                ))}
              </datalist>
            </label>

            <label>
              <span>Telefone / WhatsApp</span>
              <input
                required
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="(35) 99999-9999"
              />
            </label>

            <label>
              <span>Data do primeiro contato</span>
              <input
                type="date"
                required
                value={form.firstContact}
                onChange={(event) => setForm({ ...form, firstContact: event.target.value })}
              />
            </label>

            <fieldset className="status-field">
              <legend>Status</legend>
              <div className="status-options">
                {(["waiting", "accepted", "rejected"] as Status[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`status-option ${status} ${form.status === status ? "selected" : ""}`}
                    onClick={() => setForm({ ...form, status })}
                  >
                    <span className="check-box">{form.status === status && <Check size={13} />}</span>
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="full-field">
              <span>Observações</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Ex.: Visualizou e não respondeu. Mandar portfólio."
              />
            </label>

            <div className="modal-actions full-field">
              <button type="button" className="secondary-button" onClick={() => setLeadModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="primary-button">
                {editingLead ? "Salvar alterações" : "Salvar lead"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {messageLead && (
        <Modal onClose={() => setMessageLead(null)} title="Mandar mensagem">
          <div className="message-picker">
            <p className="modal-copy">
              Escolha uma mensagem para <strong>{messageLead.company}</strong>. A conversa será aberta
              com o texto preenchido, mas nada será enviado automaticamente.
            </p>
            <div className="message-options">
              {messages.map((message, index) => (
                <button
                  key={index}
                  type="button"
                  className={selectedMessage === index ? "message-option selected" : "message-option"}
                  onClick={() => setSelectedMessage(index)}
                >
                  <span>Mensagem {index + 1}</span>
                  <p>{message.replaceAll("{empresa}", messageLead.company)}</p>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setMessageLead(null)}>
                Cancelar
              </button>
              <button type="button" className="whatsapp-button" onClick={openWhatsApp}>
                <MessageCircle size={17} />
                Abrir no WhatsApp
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteLead && (
        <Modal onClose={() => setDeleteLead(null)} title="Excluir lead" compact>
          <p className="modal-copy">
            Tem certeza que deseja excluir <strong>{deleteLead.company}</strong>? Esta ação não pode
            ser desfeita.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setDeleteLead(null)}>
              Cancelar
            </button>
            <button type="button" className="danger-button" onClick={confirmDelete}>
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | Status;
}) {
  return (
    <div className="stat-item">
      <span className={`stat-dot ${tone}`} />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  onStatus,
  onMessage,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  onStatus: (id: string, status: Status) => void;
  onMessage: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  return (
    <article className="table-row">
      <div className="company-cell">
        <strong>{lead.company}</strong>
        <span>{lead.segment}</span>
        {lead.notes && <small title={lead.notes}>{lead.notes}</small>}
      </div>
      <div className="phone-cell">{lead.phone}</div>
      <StatusControl lead={lead} onStatus={onStatus} />
      <div className="date-cell">
        <span>{formatDate(lead.firstContact)}</span>
        <small>
          {lead.lastContact ? `Último: ${formatDate(lead.lastContact)}` : "Sem novo contato"}
        </small>
      </div>
      <div className="actions-cell">
        <button className="message-button" onClick={() => onMessage(lead)} type="button">
          <MessageCircle size={16} />
          Mandar mensagem
        </button>
        <button className="row-icon" onClick={() => onEdit(lead)} type="button" title="Editar">
          <Edit3 size={16} />
        </button>
        <button className="row-icon danger" onClick={() => onDelete(lead)} type="button" title="Excluir">
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function LeadCard({
  lead,
  onStatus,
  onMessage,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  onStatus: (id: string, status: Status) => void;
  onMessage: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  return (
    <article className="lead-card">
      <div className="card-top">
        <div>
          <strong>{lead.company}</strong>
          <span>{lead.segment}</span>
        </div>
        <span className={`status-badge ${lead.status}`}>{STATUS_LABEL[lead.status]}</span>
      </div>
      <div className="card-phone">{lead.phone}</div>
      <StatusControl lead={lead} onStatus={onStatus} />
      <div className="card-meta">
        <span>Primeiro contato: {formatDate(lead.firstContact)}</span>
        {lead.lastContact && <span>Último contato: {formatDate(lead.lastContact)}</span>}
      </div>
      {lead.notes && <p className="card-notes">{lead.notes}</p>}
      <div className="card-actions">
        <button className="message-button" onClick={() => onMessage(lead)} type="button">
          <MessageCircle size={16} />
          Mandar mensagem
        </button>
        <button className="row-icon" onClick={() => onEdit(lead)} type="button" aria-label="Editar">
          <Edit3 size={17} />
        </button>
        <button
          className="row-icon danger"
          onClick={() => onDelete(lead)}
          type="button"
          aria-label="Excluir"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );
}

function StatusControl({
  lead,
  onStatus,
}: {
  lead: Lead;
  onStatus: (id: string, status: Status) => void;
}) {
  return (
    <div className="inline-status" aria-label="Alterar status">
      {(["waiting", "accepted", "rejected"] as Status[]).map((status) => (
        <button
          key={status}
          type="button"
          className={`status-tick ${status} ${lead.status === status ? "selected" : ""}`}
          onClick={() => onStatus(lead.id, status)}
          title={STATUS_LABEL[status]}
          aria-label={STATUS_LABEL[status]}
        >
          {lead.status === status && <Check size={11} />}
        </button>
      ))}
      <span className={`status-text ${lead.status}`}>{STATUS_LABEL[lead.status]}</span>
    </div>
  );
}

function Select({
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
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>
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

function MessagesView({
  messages,
  setMessages,
  onSave,
  savedNotice,
}: {
  messages: string[];
  setMessages: (messages: string[]) => void;
  onSave: () => void;
  savedNotice: boolean;
}) {
  return (
    <section className="page-wrap messages-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ATALHOS DE ABORDAGEM</p>
          <h1>Mensagens</h1>
          <p className="subtitle">
            Edite seus três textos fixos. Use <code>{"{empresa}"}</code> para inserir o nome do lead.
          </p>
        </div>
        <button className="primary-button" onClick={onSave} type="button">
          {savedNotice ? <Check size={17} /> : null}
          {savedNotice ? "Salvo" : "Salvar mensagens"}
        </button>
      </div>

      <div className="messages-grid">
        {messages.map((message, index) => (
          <label className="message-editor" key={index}>
            <div className="editor-heading">
              <strong>Mensagem {index + 1}</strong>
              <span>{message.length} caracteres</span>
            </div>
            <textarea
              value={message}
              onChange={(event) => {
                const next = [...messages];
                next[index] = event.target.value;
                setMessages(next);
              }}
              rows={8}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function Modal({
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

function EmptyState({ onNew, hasLeads }: { onNew: () => void; hasLeads: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{hasLeads ? <Search size={20} /> : <Plus size={20} />}</div>
      <strong>{hasLeads ? "Nenhum lead encontrado" : "Seu primeiro lead começa aqui"}</strong>
      <p>
        {hasLeads
          ? "Tente mudar a busca ou os filtros."
          : "Cadastre uma empresa e ela já entra como Aguardando."}
      </p>
      {!hasLeads && (
        <button className="secondary-button" type="button" onClick={onNew}>
          Adicionar lead
        </button>
      )}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
