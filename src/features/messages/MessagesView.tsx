import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { ArrowLeft, Check, Edit3, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  orderMessageTemplates,
  type MessageTemplate,
} from "./message-templates";

type DeletedMessage = { template: MessageTemplate; deletedAt: string };
const TRASH_KEY = "leadflow:messages:trash:v1";
const TRASH_LIMIT = 30;

function loadTrash(): DeletedMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(TRASH_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((row): row is DeletedMessage => {
      if (!row || typeof row !== "object") return false;
      const entry = row as Partial<DeletedMessage>;
      const template = entry.template;
      return Boolean(
        typeof entry.deletedAt === "string" &&
        template &&
        typeof template.id === "string" &&
        typeof template.title === "string" &&
        typeof template.text === "string" &&
        typeof template.favorite === "boolean",
      );
    }).slice(0, TRASH_LIMIT);
  } catch {
    return [];
  }
}

export function MessagesView({
  messages,
  onCommit,
  savedNotice,
}: {
  messages: MessageTemplate[];
  onCommit: (nextMessages: MessageTemplate[]) => void;
  savedNotice: boolean;
}) {
  const [editor, setEditor] = useState<MessageTemplate | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validation, setValidation] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);
  const [trash, setTrash] = useState<DeletedMessage[]>(loadTrash);
  const [feedback, setFeedback] = useState("");

  const missingDefaults = DEFAULT_MESSAGE_TEMPLATES.filter(
    (template) => !messages.some((message) => message.id === template.id),
  );

  function updateTrash(next: DeletedMessage[]) {
    const limited = next.slice(0, TRASH_LIMIT);
    setTrash(limited);
    try {
      localStorage.setItem(TRASH_KEY, JSON.stringify(limited));
    } catch {
      setFeedback("A lixeira não pôde ser armazenada neste navegador.");
    }
  }

  function startNew() {
    setEditingId(null);
    setValidation("");
    setFeedback("");
    setEditor({
      id: crypto.randomUUID(),
      title: `Mensagem ${messages.length + 1}`,
      text: "",
      favorite: false,
    });
  }

  function startEdit(message: MessageTemplate) {
    setEditingId(message.id);
    setValidation("");
    setFeedback("");
    setEditor({ ...message });
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const title = editor.title.trim();
    const text = editor.text.trim();
    if (!title || !text) {
      setValidation("Informe o título e o conteúdo da mensagem antes de salvar.");
      return;
    }
    const updated = { ...editor, title, text };
    if (editingId) {
      onCommit(messages.map((message) => message.id === editingId ? updated : message));
    } else {
      onCommit([...messages, updated]);
    }
    setEditor(null);
    setEditingId(null);
    setValidation("");
    setFeedback("Mensagem salva e disponível na sua lista.");
  }

  function toggleFavorite(message: MessageTemplate) {
    onCommit(messages.map((row) =>
      row.id === message.id ? { ...row, favorite: !row.favorite } : row
    ));
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    updateTrash([
      { template: deleteTarget, deletedAt: new Date().toISOString() },
      ...trash.filter((entry) => entry.template.id !== deleteTarget.id),
    ]);
    onCommit(messages.filter((message) => message.id !== deleteTarget.id));
    setDeleteTarget(null);
    setFeedback("Mensagem excluída. É possível recuperá-la pela lixeira abaixo.");
  }

  function restoreDeleted(entry: DeletedMessage) {
    if (!messages.some((message) => message.id === entry.template.id)) {
      onCommit([...messages, entry.template]);
    }
    updateTrash(trash.filter((row) => row.template.id !== entry.template.id));
    setFeedback("Mensagem recuperada da lixeira.");
  }

  function restoreDefaults() {
    if (!missingDefaults.length) return;
    onCommit([...messages, ...missingDefaults.map((message) => ({ ...message }))]);
    setFeedback(`${missingDefaults.length} mensagem(ns) original(is) restaurada(s).`);
  }

  if (editor) {
    return (
      <section className="page-wrap messages-page message-compose-page">
        <div className="message-compose-header">
          <button className="back-button" type="button" onClick={() => setEditor(null)}>
            <ArrowLeft size={17} />
            Voltar às mensagens
          </button>
          <p className="eyebrow">MENSAGENS · {editingId ? "EDITAR" : "NOVA MENSAGEM"}</p>
          <h1>{editingId ? "Editar mensagem" : "Adicionar mensagem"}</h1>
          <p className="subtitle">
            Escreva a mensagem e salve para que ela apareça na seção Mensagens.
            Use <code>{"{empresa}"}</code> para incluir o nome do lead automaticamente.
          </p>
        </div>
        <form className="message-compose-card" onSubmit={saveDraft}>
          <label className="message-compose-field">
            <span>Nome da mensagem</span>
            <input
              autoFocus
              required
              maxLength={80}
              placeholder="Ex.: Primeiro contato — apresentação"
              value={editor.title}
              onChange={(event) => setEditor({ ...editor, title: event.target.value })}
            />
          </label>
          <label className="message-compose-field">
            <span>Conteúdo</span>
            <textarea
              required
              rows={11}
              placeholder="Olá! Tudo bem? Gostaria de apresentar..."
              value={editor.text}
              onChange={(event) => setEditor({ ...editor, text: event.target.value })}
            />
          </label>
          <div className="message-compose-meta">
            <span>{editor.text.length} caracteres</span>
            <label className="message-compose-favorite">
              <input
                type="checkbox"
                checked={editor.favorite}
                onChange={(event) => setEditor({ ...editor, favorite: event.target.checked })}
              />
              <Star size={15} fill={editor.favorite ? "currentColor" : "none"} />
              Fixar como favorita
            </label>
          </div>
          {validation && <p className="message-form-error" role="alert">{validation}</p>}
          <div className="message-compose-actions">
            <button className="secondary-button" type="button" onClick={() => setEditor(null)}>
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              <Check size={16} /> Salvar mensagem
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="page-wrap messages-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ATALHOS DE ABORDAGEM</p>
          <h1>Mensagens</h1>
          <p className="subtitle">
            Organize mensagens prontas para enviar aos leads. Use <code>{"{empresa}"}</code> para
            inserir o nome do lead; suas favoritas ficam em primeiro lugar.
          </p>
        </div>
        <div className="messages-page-actions">
          <button className="primary-button" onClick={startNew} type="button">
            <Plus size={17} /> Adicionar mensagem
          </button>
        </div>
      </div>

      {(feedback || savedNotice) && (
        <div className="message-inline-feedback" role="status">
          <Check size={16} />
          {feedback || "Mensagens salvas"}
        </div>
      )}

      {messages.length === 0 && (
        <div className="message-empty-state">
          <strong>Nenhuma mensagem cadastrada</strong>
          <p>Crie uma nova mensagem ou recupere as mensagens originais do JanuarioLeads.</p>
        </div>
      )}

      <div className="messages-grid">
        {orderMessageTemplates(messages).map((message) => (
          <article className={`message-editor message-summary-card${message.favorite ? " favorite" : ""}`} key={message.id}>
            <div className="editor-heading">
              <div className="message-summary-title">
                <strong>{message.title.trim() || "Mensagem sem título"}</strong>
                {message.favorite && <span className="message-summary-pinned"><Star size={13} fill="currentColor" /> Favorita</span>}
              </div>
              <div className="message-editor-actions">
                <button
                  type="button"
                  className="message-favorite-button"
                  onClick={() => toggleFavorite(message)}
                  aria-pressed={message.favorite}
                  aria-label={message.favorite ? "Desfavoritar mensagem" : "Favoritar mensagem"}
                >
                  <Star size={16} fill={message.favorite ? "currentColor" : "none"} />
                </button>
                <button type="button" className="message-favorite-button" onClick={() => startEdit(message)}>
                  <Edit3 size={15} /> Editar
                </button>
                <button
                  type="button"
                  className="message-remove-button"
                  onClick={() => setDeleteTarget(message)}
                  aria-label={`Excluir ${message.title || "mensagem"}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="message-summary-text">{message.text || "Mensagem sem conteúdo"}</p>
            <div className="message-summary-footer">
              <span>{message.text.length} caracteres</span>
              <button type="button" onClick={() => startEdit(message)}>Abrir editor</button>
            </div>
          </article>
        ))}
      </div>

      {(missingDefaults.length > 0 || trash.length > 0) && (
        <div className="message-recovery-section">
          <div>
            <h2>Recuperação de mensagens</h2>
            <p>
              Mensagens apagadas daqui para frente ficam na lixeira deste navegador.
              As mensagens padrão também podem ser recuperadas.
            </p>
          </div>
          {missingDefaults.length > 0 && (
            <button type="button" className="secondary-button" onClick={restoreDefaults}>
              <RotateCcw size={16} /> Restaurar {missingDefaults.length} mensagem(ns) original(is)
            </button>
          )}
          {trash.length > 0 && (
            <div className="message-trash-list">
              <strong>Lixeira local</strong>
              {trash.map((entry) => (
                <div className="message-trash-row" key={entry.template.id}>
                  <span>{entry.template.title || "Mensagem sem título"}</span>
                  <button className="secondary-button" type="button" onClick={() => restoreDeleted(entry)}>
                    <RotateCcw size={14} /> Recuperar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AlertDialog.Root
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="message-delete-overlay" />
          <AlertDialog.Content className="message-delete-dialog">
            <AlertDialog.Title>Excluir mensagem?</AlertDialog.Title>
            <AlertDialog.Description>
              A mensagem <strong>{deleteTarget?.title || "sem título"}</strong> será movida
              para a lixeira local. Você poderá recuperá-la nesta seção.
            </AlertDialog.Description>
            <div className="message-delete-actions">
              <AlertDialog.Cancel className="secondary-button">Cancelar</AlertDialog.Cancel>
              <AlertDialog.Action className="message-delete-confirm" onClick={confirmDelete}>
                <Trash2 size={15} /> Excluir mensagem
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
