import {
  Edit3,
  FileText,
  MessageCircle,
  PenLine,
  RefreshCw,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createLeadActivity,
  deleteManualNote,
  fetchLeadActivities,
  updateManualNote,
} from "./lead-activities";
import type { LeadActivity } from "./types";

function ActivityIcon({ type }: { type: LeadActivity["type"] }) {
  if (type === "whatsapp_opened") return <MessageCircle size={14} />;
  if (type === "prompt_generated") return <FileText size={14} />;
  if (type === "status_changed") return <RefreshCw size={14} />;
  if (type === "company_updated") return <RefreshCw size={14} />;
  if (type === "lead_edited") return <Edit3 size={14} />;
  if (type === "manual_note") return <StickyNote size={14} />;
  return <PenLine size={14} />;
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startToday.getTime() - startTarget.getTime()) / 86400000,
  );

  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (diffDays === 0) return `Hoje, ${time}`;
  if (diffDays === 1) return `Ontem, ${time}`;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LeadActivityTimeline({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<LeadActivity[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editing, setEditing] = useState<LeadActivity | null>(null);
  const [editText, setEditText] = useState("");

  async function loadInitial() {
    setLoading(true);
    setError("");
    try {
      const page = await fetchLeadActivities(leadId);
      setItems(page.items);
      setNextOffset(page.nextOffset);
      setHasMore(page.hasMore);
    } catch {
      setError("Não foi possível carregar o histórico agora.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
    // History is loaded only when this tab is rendered for a lead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const manualCount = useMemo(
    () => items.filter((item) => item.type === "manual_note").length,
    [items],
  );

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError("");

    try {
      const page = await fetchLeadActivities(leadId, nextOffset);
      setItems((current) => [...current, ...page.items]);
      setNextOffset(page.nextOffset);
      setHasMore(page.hasMore);
    } catch {
      setError("Não foi possível carregar atividades anteriores.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function saveNewNote() {
    const text = noteText.trim();
    if (!text || savingNote) return;

    setSavingNote(true);
    setError("");
    try {
      const activity = await createLeadActivity({
        leadId,
        type: "manual_note",
        title: "Anotação",
        description: text,
      });

      if (!activity) {
        throw new Error("NOTE_NOT_SAVED");
      }

      setItems((current) => [activity, ...current]);
      setNextOffset((current) => current + 1);
      setNoteText("");
      setNoteOpen(false);
    } catch {
      setError("Não foi possível salvar a anotação.");
    } finally {
      setSavingNote(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const text = editText.trim();
    if (!text) return;

    setSavingNote(true);
    setError("");
    try {
      const updated = await updateManualNote(editing.id, text);
      if (!updated) throw new Error("NOTE_NOT_UPDATED");

      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditing(null);
      setEditText("");
    } catch {
      setError("Não foi possível editar a anotação.");
    } finally {
      setSavingNote(false);
    }
  }

  async function removeNote(activity: LeadActivity) {
    if (
      activity.type !== "manual_note" ||
      !window.confirm("Excluir esta anotação?")
    ) {
      return;
    }

    setError("");
    try {
      const ok = await deleteManualNote(activity.id);
      if (!ok) throw new Error("NOTE_NOT_DELETED");

      setItems((current) =>
        current.filter((item) => item.id !== activity.id),
      );
      setNextOffset((current) => Math.max(0, current - 1));
    } catch {
      setError("Não foi possível excluir a anotação.");
    }
  }

  return (
    <section className="lead-activity-panel" aria-label="Histórico de atividades">
      <div className="lead-activity-heading">
        <div>
          <span>HISTÓRICO</span>
          <strong>Atividades comerciais</strong>
          {manualCount > 0 && <small>{manualCount} anotações carregadas</small>}
        </div>
        <button
          className="secondary-button activity-add-note"
          type="button"
          onClick={() => {
            setNoteOpen((current) => !current);
            setEditing(null);
          }}
        >
          <StickyNote size={14} />
          Adicionar anotação
        </button>
      </div>

      {noteOpen && (
        <div className="activity-note-editor">
          <label>
            <span>Adicionar anotação</span>
            <textarea
              rows={3}
              maxLength={1200}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Ex.: Cliente pediu para entrar em contato novamente semana que vem."
            />
          </label>
          <div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setNoteOpen(false);
                setNoteText("");
              }}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={!noteText.trim() || savingNote}
              onClick={() => void saveNewNote()}
            >
              {savingNote ? "Salvando..." : "Salvar anotação"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="lead-activity-error">{error}</p>}

      {loading ? (
        <p className="lead-activity-empty">Carregando histórico...</p>
      ) : items.length === 0 ? (
        <p className="lead-activity-empty">Nenhuma atividade registrada ainda.</p>
      ) : (
        <div className="lead-activity-timeline">
          {items.map((activity) => (
            <article className="lead-activity-item" key={activity.id}>
              <span className="lead-activity-dot" aria-hidden="true">
                <ActivityIcon type={activity.type} />
              </span>
              <div className="lead-activity-main">
                <div className="lead-activity-title-row">
                  <strong>{activity.title}</strong>
                  <time dateTime={activity.createdAt}>
                    {formatActivityDate(activity.createdAt)}
                  </time>
                </div>

                {editing?.id === activity.id ? (
                  <div className="activity-note-editor inline">
                    <textarea
                      rows={3}
                      maxLength={1200}
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                    />
                    <div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setEditText("");
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={!editText.trim() || savingNote}
                        onClick={() => void saveEdit()}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {activity.description && (
                      <p>{activity.description}</p>
                    )}

                    {activity.type === "manual_note" && (
                      <div className="lead-activity-note-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(activity);
                            setEditText(activity.description ?? "");
                            setNoteOpen(false);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeNote(activity)}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <button
          className="secondary-button lead-activity-load-more"
          type="button"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Carregando..." : "Carregar anteriores"}
        </button>
      )}
    </section>
  );
}
