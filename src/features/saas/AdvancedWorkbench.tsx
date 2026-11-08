import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, Sparkles, Target } from "lucide-react";
import { getAccessToken, getValidSession } from "../../lib/auth";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../lib/supabase-config";
import type { PersistedLead } from "../leads/remote-leads";
import { evaluateIdealCustomer, loadIdealCustomerProfile } from "../qualification/ideal-customer-profile";

type Rules = {
  follow_up_enabled: boolean;
  follow_up_after_days: number;
};

const DEFAULT_RULES: Rules = { follow_up_enabled: false, follow_up_after_days: 3 };

export function AdvancedWorkbench({
  leads, onOpenLead,
}: {
  leads: PersistedLead[];
  onOpenLead: (lead: PersistedLead) => void;
}) {
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const ranked = useMemo(() => {
    const profile = loadIdealCustomerProfile();
    return leads
      .filter((lead) => lead.status !== "accepted" && lead.status !== "rejected")
      .map((lead) => ({ lead, evaluation: evaluateIdealCustomer(lead, profile) }))
      .sort((a, b) => b.evaluation.score - a.evaluation.score || a.lead.company.localeCompare(b.lead.company, "pt-BR"))
      .slice(0, 5);
  }, [leads]);

  const segments = useMemo(() => {
    const groups = new Map<string, { name: string; total: number; accepted: number }>();
    for (const lead of leads) {
      const name = lead.segment.trim() || "Não informado";
      const entry = groups.get(name) ?? { name, total: 0, accepted: 0 };
      entry.total++;
      if (lead.status === "accepted") entry.accepted++;
      groups.set(name, entry);
    }
    return [...groups.values()].filter((row) => row.total >= 2)
      .sort((a, b) => b.accepted / b.total - a.accepted / a.total || b.total - a.total)
      .slice(0, 5);
  }, [leads]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await getValidSession();
      if (!session) { if (active) setMessage("Entre novamente para consultar as automações."); return; }
      const response = await fetch(
        SUPABASE_URL + "/rest/v1/saas_automation_settings?select=follow_up_enabled,follow_up_after_days&user_id=eq." + encodeURIComponent(session.user.id) + "&limit=1",
        { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + session.accessToken }, cache: "no-store" },
      );
      if (!response.ok) throw new Error("Falha ao consultar regras.");
      const json: unknown = await response.json();
      const found = Array.isArray(json) ? json[0] as Partial<Rules> | undefined : undefined;
      if (active && found && typeof found.follow_up_enabled === "boolean"
          && Number.isInteger(found.follow_up_after_days)) {
        setRules({ follow_up_enabled: found.follow_up_enabled, follow_up_after_days: found.follow_up_after_days! });
      }
    })().catch(() => { if (active) setMessage("Não foi possível carregar as regras no momento."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function saveRules(next: Rules) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const session = await getValidSession();
      const token = await getAccessToken();
      if (!session || !token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch(SUPABASE_URL + "/rest/v1/saas_automation_settings?on_conflict=user_id", {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          user_id: session.user.id,
          follow_up_enabled: next.follow_up_enabled,
          follow_up_after_days: next.follow_up_after_days,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error("O plano não autorizou salvar a automação. Confira sua assinatura.");
      const payload: unknown = await response.json();
      if (!Array.isArray(payload) || payload.length !== 1) throw new Error("Não foi possível confirmar a gravação da regra.");
      setRules(next);
      setMessage("Preferência salva. A regra será aplicada quando um lead entrar no status Aguardando.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar automação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="saas-advanced-workbench dashboard-panel" aria-labelledby="advanced-title">
      <div className="dashboard-panel-heading">
        <div>
          <span>EXCLUSIVO ADVANCED</span>
          <strong id="advanced-title"><Sparkles size={17} aria-hidden="true" /> Inteligência e automações</strong>
        </div>
        <span className="saas-advanced-tag">Advanced</span>
      </div>
      <p className="saas-advanced-explainer">
        Prioridades calculadas a partir dos dados do seu CRM — não são previsões de vendas.
        As automações criam tarefas internas, sem enviar WhatsApp ou e-mail.
      </p>
      <div className="saas-advanced-layout">
        <div className="saas-advanced-panel">
          <h3><CalendarClock size={17} aria-hidden="true" /> Follow-up automático</h3>
          <p>Ao mudar um lead para <strong>Aguardando</strong>, agendar uma tarefa somente se não existir outra definida.</p>
          <label className="saas-advanced-switch">
            <input type="checkbox" checked={rules.follow_up_enabled} disabled={busy || saving}
              onChange={(event) => void saveRules({ ...rules, follow_up_enabled: event.target.checked })} />
            Habilitar agendamento automático
          </label>
          <label className="saas-advanced-days">
            Agendar após
            <select value={rules.follow_up_after_days} disabled={busy || saving}
              onChange={(event) => void saveRules({ ...rules, follow_up_after_days: Number(event.target.value) })}>
              {[1, 3, 5, 7, 14].map((days) => <option key={days} value={days}>{days} {days === 1 ? "dia" : "dias"}</option>)}
            </select>
          </label>
          {message && <p role="status" className="saas-advanced-feedback">{message}</p>}
        </div>
        <div className="saas-advanced-panel">
          <h3><Target size={17} aria-hidden="true" /> Próximos leads prioritários</h3>
          {ranked.length ? (
            <ol className="saas-advanced-ranked">
              {ranked.map(({ lead, evaluation }) => (
                <li key={lead.id}>
                  <button type="button" onClick={() => onOpenLead(lead)}>
                    <span><strong>{lead.company}</strong><small>{evaluation.reasons[0] || lead.segment}</small></span>
                    <b aria-label={`Pontuação ${evaluation.score} de 100`}>{evaluation.score}/100</b>
                  </button>
                </li>
              ))}
            </ol>
          ) : <p>Cadastre leads para visualizar prioridades.</p>}
        </div>
        <div className="saas-advanced-panel saas-advanced-segments">
          <h3><BadgeCheck size={17} aria-hidden="true" /> Comparação de segmentos</h3>
          <p>Percentuais indicativos de status <strong>Aceito</strong> por segmento, não vendas confirmadas.</p>
          {segments.length ? (
            <ul>{segments.map((row) => (
              <li key={row.name}>
                <span>{row.name} <small>({row.accepted} de {row.total} leads)</small></span>
                <strong>{Math.round(row.accepted / row.total * 100)}%</strong>
              </li>
            ))}</ul>
          ) : <p>São necessários pelo menos dois leads de um mesmo segmento.</p>}
        </div>
      </div>
    </section>
  );
}
