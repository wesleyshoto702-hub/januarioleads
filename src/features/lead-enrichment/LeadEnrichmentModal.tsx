import {
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  Search,
  Star,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  findBusinessDuplicate,
  type ExistingLeadIdentity,
} from "../search-leads/identity";
import type { BusinessSearchResult } from "../search-leads/types";
import { searchLeadInformation } from "./search-lead-information";
import type {
  EnrichmentLead,
  LeadEnrichmentCandidate,
  LeadEnrichmentConfidence,
  LeadEnrichmentMethod,
} from "./types";

const CONFIDENCE_LABEL: Record<LeadEnrichmentConfidence, string> = {
  high: "Correspondência alta",
  probable: "Correspondência provável",
  uncertain: "Correspondência incerta",
};

const METHOD_LABEL: Record<LeadEnrichmentMethod, string> = {
  placeId: "placeId já associado",
  phone: "Telefone",
  "name-location": "Nome + localização",
  "name-segment-location": "Nome + segmento + localização",
};

export function LeadEnrichmentModal({
  lead,
  existingLeads,
  onConfirm,
  onClose,
}: {
  lead: EnrichmentLead;
  existingLeads: ExistingLeadIdentity[];
  onConfirm: (business: BusinessSearchResult) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EnrichmentLead>(lead);
  const [candidates, setCandidates] = useState<LeadEnrichmentCandidate[]>([]);
  const [attempted, setAttempted] = useState<LeadEnrichmentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function runSearch(target: EnrichmentLead) {
    if (loading && searched) return;

    setLoading(true);
    setError("");
    setSearched(true);
    setCandidates([]);
    setAttempted([]);

    const response = await searchLeadInformation(target);
    setLoading(false);

    if (!response.ok) {
      setError(response.message);
      return;
    }

    setCandidates(response.candidates);
    setAttempted(response.attemptedLayers);
  }

  useEffect(() => {
    void runSearch(lead);
    // The modal represents one lead at a time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  function retry() {
    void runSearch({
      ...draft,
      company: draft.company.trim(),
      segment: draft.segment.trim(),
      phone: draft.phone.trim(),
      placeId: lead.placeId,
    });
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="modal-card enrichment-modal"
        role="dialog"
        aria-modal="true"
        aria-label={lead.placeId ? "Atualizar informações" : "Buscar informações"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header enrichment-header">
          <div>
            <span className="detail-kicker">GOOGLE PLACES</span>
            <h2>{lead.placeId ? "Atualizar informações" : "Buscar informações"}</h2>
            <p>{lead.company}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="enrichment-content">
          {loading ? (
            <div className="enrichment-loading" aria-live="polite">
              <Loader2 size={20} className="auth-spinner" />
              <div>
                <strong>
                  {lead.placeId
                    ? "Atualizando dados da empresa..."
                    : "Buscando informações da empresa..."}
                </strong>
                <span>
                  {lead.placeId
                    ? "Consultando o placeId já confirmado."
                    : draft.phone
                      ? "Começando pelo telefone e usando nome/localização como fallback."
                      : "Sem telefone disponível. Usando nome, segmento e localização."}
                </span>
              </div>
            </div>
          ) : candidates.length > 0 ? (
            <>
              <div className="enrichment-result-heading">
                <div>
                  <strong>
                    {candidates.length === 1
                      ? "Empresa encontrada"
                      : `Encontramos ${candidates.length} possíveis empresas`}
                  </strong>
                  <span>
                    Confira os dados antes de associar qualquer resultado ao lead.
                  </span>
                </div>
                {attempted.length > 0 && (
                  <small>
                    Busca: {attempted.map((item) => METHOD_LABEL[item]).join(" → ")}
                  </small>
                )}
              </div>

              <div className="enrichment-candidates">
                {candidates.map((candidate) => {
                  const duplicate = findBusinessDuplicate(
                    candidate.business,
                    existingLeads,
                    lead.id,
                  );
                  const googlePhone =
                    candidate.business.phone ??
                    candidate.business.internationalPhone ??
                    "";

                  return (
                    <article
                      className="enrichment-candidate"
                      key={candidate.business.placeId}
                    >
                      <div className="enrichment-candidate-top">
                        <div>
                          <span
                            className={`confidence-badge ${candidate.confidence}`}
                          >
                            {CONFIDENCE_LABEL[candidate.confidence]}
                          </span>
                          <h3>{candidate.business.name}</h3>
                          {candidate.business.primaryCategory && (
                            <p>{candidate.business.primaryCategory}</p>
                          )}
                        </div>
                        <span className="enrichment-method">
                          Como encontramos: {METHOD_LABEL[candidate.method]}
                        </span>
                      </div>

                      <div className="enrichment-facts">
                        {candidate.business.address && (
                          <span>
                            <MapPin size={14} />
                            {candidate.business.address}
                          </span>
                        )}
                        {googlePhone && (
                          <span>
                            <Phone size={14} />
                            {googlePhone}
                          </span>
                        )}
                        {candidate.business.rating !== null && (
                          <span>
                            <Star size={14} />
                            {candidate.business.rating.toFixed(1)}
                            {candidate.business.reviewCount !== null
                              ? ` · ${candidate.business.reviewCount} avaliações`
                              : ""}
                          </span>
                        )}
                      </div>

                      <div className="enrichment-reasons">
                        {candidate.reasons.map((reason, index) => (
                          <span key={index}>{reason}</span>
                        ))}
                      </div>

                      {candidate.phoneConflict && (
                        <div className="enrichment-conflict">
                          <strong>Telefone diferente</strong>
                          <div>
                            <span>
                              Telefone cadastrado
                              <b>{lead.phone || "Não informado"}</b>
                            </span>
                            <span>
                              Telefone encontrado no Google
                              <b>{googlePhone || "Não informado"}</b>
                            </span>
                          </div>
                          <p>
                            O número só será atualizado se você confirmar esta empresa.
                          </p>
                        </div>
                      )}

                      {duplicate && (
                        <div className="enrichment-duplicate">
                          <strong>Esta empresa parece já existir nos seus leads.</strong>
                          <span>
                            Lead encontrado: {duplicate.company}
                            {duplicate.phone ? ` · ${duplicate.phone}` : ""}
                          </span>
                          <p>
                            Nada será mesclado ou apagado automaticamente. Se confirmar,
                            este lead continuará separado.
                          </p>
                        </div>
                      )}

                      <div className="enrichment-links">
                        {candidate.business.website && (
                          <a
                            href={candidate.business.website}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Site <ExternalLink size={12} />
                          </a>
                        )}
                        {candidate.business.googleMapsUrl && (
                          <a
                            href={candidate.business.googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Google Maps <ExternalLink size={12} />
                          </a>
                        )}
                      </div>

                      {candidate.business.openingHours.length > 0 && (
                        <details className="enrichment-hours">
                          <summary>Ver horários</summary>
                          <div>
                            {candidate.business.openingHours.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        </details>
                      )}

                      <button
                        className="primary-button enrichment-confirm"
                        type="button"
                        onClick={() => onConfirm(candidate.business)}
                      >
                        {candidates.length > 1
                          ? "Selecionar esta empresa"
                          : "Confirmar empresa"}
                      </button>
                    </article>
                  );
                })}
              </div>

              {candidates.length > 1 && (
                <button
                  className="secondary-button enrichment-none"
                  type="button"
                  onClick={() => setCandidates([])}
                >
                  Nenhuma destas
                </button>
              )}
            </>
          ) : (
            <div className="enrichment-empty">
              <Search size={22} />
              <strong>
                {error
                  ? "Não foi possível concluir a busca."
                  : "Não encontramos uma correspondência confiável para este lead."}
              </strong>
              <p>
                {error ||
                  "Nenhum dado foi alterado. Ajuste os dados abaixo se necessário e tente novamente."}
              </p>

              {!lead.placeId && (
                <div className="enrichment-retry-fields">
                  <label>
                    <span>Nome</span>
                    <input
                      value={draft.company}
                      onChange={(event) =>
                        setDraft({ ...draft, company: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Segmento</span>
                    <input
                      value={draft.segment}
                      onChange={(event) =>
                        setDraft({ ...draft, segment: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Telefone</span>
                    <input
                      value={draft.phone}
                      onChange={(event) =>
                        setDraft({ ...draft, phone: event.target.value })
                      }
                      placeholder="Opcional"
                    />
                  </label>
                </div>
              )}

              <button
                className="primary-button"
                type="button"
                onClick={retry}
                disabled={!draft.company.trim() || !draft.segment.trim()}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && candidates.length > 0 && (
            <div className="enrichment-footer-note">
              A confirmação associa os dados públicos retornados pelo Google Places a
              este lead. Observações, status e histórico interno não são alterados.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
