import { useMemo, useState } from "react";
import { SlidersHorizontal, Target } from "lucide-react";
import type { PersistedLead } from "../leads/remote-leads";
import {
  DEFAULT_ICP, evaluateIdealCustomer, loadIdealCustomerProfile,
  saveIdealCustomerProfile, type ProspectingFocus,
} from "./ideal-customer-profile";

export function IdealCustomerPanel({
  leads,
  onOpenLead,
}: {
  leads: PersistedLead[];
  onOpenLead: (lead: PersistedLead) => void;
}) {
  const [profile, setProfile] = useState(loadIdealCustomerProfile);
  const [editor, setEditor] = useState(false);
  const [draft, setDraft] = useState(profile);
  const ranked = useMemo(
    () => leads.filter((lead) => lead.status !== "rejected" && lead.status !== "accepted")
      .map((lead) => ({ lead, priority: evaluateIdealCustomer(lead, profile) }))
      .filter(({ priority }) => priority.score > 0)
      .sort((a, b) => b.priority.score - a.priority.score || a.lead.company.localeCompare(b.lead.company, "pt-BR"))
      .slice(0, 5),
    [leads, profile],
  );

  return (
    <section className="dashboard-panel icp-panel" aria-labelledby="icp-heading">
      <div className="dashboard-panel-heading icp-heading">
        <div>
          <span>QUALIFICAÇÃO PERSONALIZADA</span>
          <strong id="icp-heading">Perfil de cliente ideal</strong>
        </div>
        <button type="button" onClick={() => { setDraft(profile); setEditor((open) => !open); }}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          {editor ? "Fechar" : "Configurar"}
        </button>
      </div>
      {editor && (
        <form className="icp-form" onSubmit={(event) => {
          event.preventDefault();
          setProfile(saveIdealCustomerProfile(draft));
          setEditor(false);
        }}>
          <label>Serviço que você oferece
            <select value={draft.focus} onChange={(e) => setDraft((p) => ({ ...p, focus: e.target.value as ProspectingFocus }))}>
              <option value="general">Prospecção geral</option>
              <option value="websites">Criação de websites</option>
              <option value="social">Redes sociais</option>
            </select>
          </label>
          <label>Nicho preferido (opcional)
            <input maxLength={80} placeholder="Ex.: restaurantes" value={draft.segment}
              onChange={(e) => setDraft((p) => ({ ...p, segment: e.target.value }))} />
          </label>
          <label>Cidade preferida (opcional)
            <input maxLength={80} placeholder="Ex.: Lavras" value={draft.city}
              onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} />
          </label>
          <div className="icp-actions">
            <button type="button" onClick={() => setDraft(DEFAULT_ICP)}>Limpar preferências</button>
            <button type="submit" className="primary-button">Aplicar perfil</button>
          </div>
        </form>
      )}
      <p className="icp-explainer">
        Prioridade estimada por critérios transparentes, não probabilidade de venda.
        Preferências salvas somente neste navegador e nesta conta.
      </p>
      {ranked.length === 0 ? (
        <p className="dashboard-panel-empty">Salve leads ativos para ver sugestões de prioridade.</p>
      ) : (
        <div className="icp-ranked" aria-label="Leads priorizados pelo perfil">
          {ranked.map(({ lead, priority }) => (
            <button type="button" key={lead.id} onClick={() => onOpenLead(lead)}>
              <span className="icp-score"><Target size={14} aria-hidden="true" /> {priority.score}/100</span>
              <span className="icp-lead-name"><strong>{lead.company}</strong><small>{lead.segment} · {lead.city || "Cidade não informada"}</small></span>
              <span className="icp-reasons">{priority.reasons.slice(0, 2).join(" · ") || "Sem critérios específicos identificados"}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
