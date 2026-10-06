import {
  ExternalLink,
  Globe,
  Instagram,
  MapPin,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { buildFactualBusinessDescription } from "../business-presence/business-description";
import { BusinessDeepEnrichmentSection } from "../business-enrichment/BusinessDeepEnrichmentSection";
import type { DeepEnrichmentApplied } from "../business-enrichment/types";
import { discoverBusinessPresence } from "../business-presence/discover-business-presence";
import { presenceFromBusiness } from "../business-presence/storage";
import type {
  BusinessPresence,
  InstagramCandidate,
  InstagramSource,
} from "../business-presence/types";
import { LeadActivityTimeline } from "../lead-activities/LeadActivityTimeline";
import { LeadFinancialSection } from "../lead-finance/LeadFinancialSection";
import type { LeadPayment } from "../lead-finance/finance";
import { ChanceBadge } from "../lead-chance/ChanceBadge";
import type { LeadChanceResult } from "../lead-chance/lead-chance";
import type {
  LeadStatus,
  LeadUpdateRecord,
  PersistedLead,
} from "../leads/remote-leads";
import { STATUS_LABEL } from "../leads/lead-status";
import { normalizeBrazilianPhone } from "./identity";
import type { BusinessSearchResult } from "./types";

export type BusinessDetailsMessageTarget = {
  id?: string;
  company: string;
  phone: string;
};

export type BusinessAddResult =
  | { ok: true; leadId: string }
  | { ok: false; message: string };

export type BusinessCommercialLead = {
  id: string;
  status: LeadStatus;
  phone: string;
};

function formatGoogleType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBusinessStatus(value: string | null) {
  if (value === "CLOSED_PERMANENTLY") return "Fechada permanentemente";
  if (value === "CLOSED_TEMPORARILY") return "Fechada temporariamente";
  if (value === "OPERATIONAL") return "Em funcionamento";
  return null;
}

const INSTAGRAM_SOURCE_LABEL: Record<InstagramSource, string> = {
  google_places: "Google Places",
  official_website: "Website oficial",
  web_search: "Busca pública",
  manual_confirmation: "Confirmação manual",
  existing_data: "Dados existentes",
};

function instagramUsername(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    return parts.length === 1 ? parts[0] : null;
  } catch {
    return null;
  }
}

export function BusinessDetailsModal({
  business,
  chance,
  segmentLabel,
  alreadyAdded = false,
  commercialLead,
  lastSyncedAt,
  updates = [],
  activityLeadId,
  onClose,
  onWhatsApp,
  onMessage,
  onGeneratePrompt,
  onPresenceUpdate,
  onDeepEnrichmentUpdate,
  financeLead,
  financePayments = [],
  onFinanceUpdate,
  onPaymentSaved,
  onAdd,
}: {
  business: BusinessSearchResult;
  chance?: LeadChanceResult | null;
  segmentLabel?: string | null;
  alreadyAdded?: boolean;
  commercialLead?: BusinessCommercialLead | null;
  lastSyncedAt?: string | null;
  updates?: LeadUpdateRecord[];
  activityLeadId?: string | null;
  onClose: () => void;
  onWhatsApp: (business: BusinessSearchResult) => void;
  onMessage: (target: BusinessDetailsMessageTarget) => void;
  onGeneratePrompt: (business: BusinessSearchResult) => void;
  onPresenceUpdate?: (presence: BusinessPresence) => void;
  onDeepEnrichmentUpdate?: (value: DeepEnrichmentApplied) => void;
  financeLead?: PersistedLead | null;
  financePayments?: LeadPayment[];
  onFinanceUpdate?: (
    leadId: string,
    patch: Pick<PersistedLead, "projectValue" | "financialNotes">,
  ) => void;
  onPaymentSaved?: (payment: LeadPayment) => void;
  onAdd?: (
    business: BusinessSearchResult,
  ) => Promise<BusinessAddResult> | BusinessAddResult | void;
}) {
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [presenceError, setPresenceError] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "history">("info");
  const [addingLead, setAddingLead] = useState(false);
  const [commercialError, setCommercialError] = useState("");

  const factualDescription =
    business.factualDescription ?? buildFactualBusinessDescription(business);
  const confirmedInstagram =
    business.instagram &&
    business.instagramConfidence !== "medium" &&
    business.instagramConfidence !== "low"
      ? business.instagram
      : null;
  const candidates = (business.instagramCandidates ?? []).filter(
    (candidate) => candidate.confidence === "medium",
  );
  const commercialPhone =
    commercialLead?.phone ||
    business.phone ||
    business.internationalPhone ||
    "";
  const normalizedCommercialPhone =
    normalizeBrazilianPhone(commercialPhone);
  const canOpenCommercialWhatsApp =
    normalizedCommercialPhone.length === 12 ||
    normalizedCommercialPhone.length === 13;

  async function verifyPresence(force = false) {
    setPresenceLoading(true);
    setPresenceError("");
    try {
      const presence = await discoverBusinessPresence(business, {
        force,
        allowWebSearch: true,
      });
      if (presence) onPresenceUpdate?.(presence);
    } catch (error) {
      setPresenceError(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível buscar Instagram agora.",
      );
    } finally {
      setPresenceLoading(false);
    }
  }

  function confirmInstagram(candidate: InstagramCandidate) {
    const current = presenceFromBusiness(business);
    onPresenceUpdate?.({
      instagramUrl: candidate.url,
      instagramUsername: candidate.username,
      instagramConfidence: "high",
      instagramSource: "manual_confirmation",
      instagramCheckedAt: new Date().toISOString(),
      instagramCandidates: [],
      instagramRejectedUrls: current?.instagramRejectedUrls ?? [],
      instagramSearchSignature:
        current?.instagramSearchSignature ??
        business.instagramSearchSignature ??
        null,
      instagramNeedsReview: false,
    });
  }

  function rejectInstagram(candidate: InstagramCandidate) {
    const current = presenceFromBusiness(business);
    const rejected = Array.from(
      new Set([
        ...(current?.instagramRejectedUrls ?? []),
        candidate.url,
      ]),
    );
    onPresenceUpdate?.({
      instagramUrl: current?.instagramUrl ?? null,
      instagramUsername: current?.instagramUsername ?? null,
      instagramConfidence: current?.instagramConfidence ?? null,
      instagramSource: current?.instagramSource ?? null,
      instagramCheckedAt:
        current?.instagramCheckedAt ?? new Date().toISOString(),
      instagramCandidates: candidates.filter(
        (item) => item.url !== candidate.url,
      ),
      instagramRejectedUrls: rejected,
      instagramSearchSignature:
        current?.instagramSearchSignature ??
        business.instagramSearchSignature ??
        null,
      instagramNeedsReview: false,
    });
  }

  async function addToLeads() {
    if (!onAdd || addingLead || alreadyAdded) return;

    setAddingLead(true);
    setCommercialError("");
    try {
      const result = await onAdd(business);
      if (result && !result.ok) {
        setCommercialError(result.message);
      }
    } catch {
      setCommercialError(
        "Não foi possível adicionar esta empresa aos leads agora.",
      );
    } finally {
      setAddingLead(false);
    }
  }

  useEffect(() => {
    setActiveTab("info");
    setPresenceError("");
    setPresenceLoading(false);
    setAddingLead(false);
    setCommercialError("");
  }, [business.placeId]);

  useEffect(() => {
    if (alreadyAdded) setCommercialError("");
  }, [alreadyAdded]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card business-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={business.name}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="detail-kicker">
              {business.primaryCategory ?? segmentLabel ?? "Empresa local"}
            </span>
            <div className="business-name-line detail-name-line">
              <h2>{business.name}</h2>
              {chance && <ChanceBadge chance={chance} />}
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            type="button"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {activityLeadId && (
          <div className="business-detail-tabs" role="tablist" aria-label="Detalhes da empresa">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "info"}
              className={activeTab === "info" ? "active" : ""}
              onClick={() => setActiveTab("info")}
            >
              Informações
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              className={activeTab === "history" ? "active" : ""}
              onClick={() => setActiveTab("history")}
            >
              Histórico
            </button>
          </div>
        )}

        {activeTab === "info" ? (
        <div className="business-detail-content">
          <div className="detail-grid">
            {segmentLabel && (
              <DetailItem label="Segmento" value={segmentLabel} />
            )}
            {business.address && (
              <DetailItem label="Endereço" value={business.address} />
            )}
            {business.neighborhood && (
              <DetailItem label="Bairro" value={business.neighborhood} />
            )}
            {business.city && (
              <DetailItem label="Cidade" value={business.city} />
            )}
            {business.phone && (
              <DetailItem label="Telefone" value={business.phone} />
            )}
            {business.rating !== null && (
              <DetailItem
                label="Avaliação"
                value={`${business.rating.toFixed(1)}${
                  business.reviewCount !== null
                    ? ` · ${business.reviewCount} avaliações`
                    : ""
                }`}
              />
            )}
            {business.isOpenNow !== null && (
              <DetailItem
                label="Status agora"
                value={business.isOpenNow ? "Aberto" : "Fechado"}
              />
            )}
            {lastSyncedAt !== undefined && (
              <DetailItem
                label="Última atualização"
                value={
                  lastSyncedAt
                    ? formatDateTime(lastSyncedAt)
                    : "Ainda não sincronizado"
                }
              />
            )}
          </div>

          {business.categories.length > 0 && (
            <div className="detail-section">
              <h3>Categorias relacionadas</h3>
              <div className="category-tags">
                {business.categories.slice(0, 8).map((category) => (
                  <span key={category}>{formatGoogleType(category)}</span>
                ))}
              </div>
            </div>
          )}

          {business.businessStatus &&
            formatBusinessStatus(business.businessStatus) && (
              <div className="detail-section">
                <h3>Situação da empresa</h3>
                <p className="detail-note">
                  {formatBusinessStatus(business.businessStatus)}
                </p>
              </div>
            )}

          {business.openingHours.length > 0 && (
            <div className="detail-section">
              <h3>Horários de funcionamento</h3>
              <div className="opening-hours">
                {business.openingHours.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section business-about">
            <h3>Sobre a empresa</h3>
            <p>{factualDescription}</p>
          </div>

          {financeLead && onFinanceUpdate && onPaymentSaved && (
            <LeadFinancialSection
              lead={financeLead}
              payments={financePayments}
              onFinanceUpdate={onFinanceUpdate}
              onPaymentSaved={onPaymentSaved}
            />
          )}

          <div className="detail-section">
            <h3>Presença online</h3>
            <div className="detail-links">
              {business.website ? (
                <a href={business.website} target="_blank" rel="noreferrer">
                  <Globe size={15} /> Site <ExternalLink size={13} />
                </a>
              ) : (
                <span>Site não identificado</span>
              )}
              {business.googleMapsUrl && (
                <a
                  href={business.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={15} /> Google Maps e avaliações{" "}
                  <ExternalLink size={13} />
                </a>
              )}
            </div>

            <div className="instagram-presence">
              <div className="instagram-presence-heading">
                <span>INSTAGRAM</span>
                {business.instagramNeedsReview && (
                  <small>Os dados da empresa mudaram; vale verificar novamente.</small>
                )}
              </div>

              {confirmedInstagram ? (
                <div className="instagram-confirmed">
                  <div>
                    <strong>Instagram identificado</strong>
                    <span>
                      @{business.instagramUsername ??
                        instagramUsername(confirmedInstagram)}
                    </span>
                    {business.instagramSource && (
                      <small>
                        Fonte: {INSTAGRAM_SOURCE_LABEL[business.instagramSource]}
                      </small>
                    )}
                  </div>
                  <a
                    className="instagram-identified-link"
                    href={confirmedInstagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Abrir Instagram em nova aba"
                  >
                    <Instagram size={14} aria-hidden="true" />
                    <span>Abrir Instagram</span>
                  </a>
                </div>
              ) : candidates.length > 0 ? (
                <div className="instagram-candidates">
                  <strong>
                    {candidates.length === 1
                      ? "Instagram provável"
                      : "Possíveis Instagrams"}
                  </strong>

                  {candidates.map((candidate) => (
                    <article
                      className="instagram-candidate"
                      key={candidate.url}
                    >
                      <div className="instagram-candidate-main">
                        <b>@{candidate.username}</b>
                        {candidate.signals.length > 0 && (
                          <div className="instagram-signals">
                            <span>Sinais encontrados:</span>
                            <ul>
                              {candidate.signals.map((signal) => (
                                <li key={signal}>{signal}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {candidate.evidenceUrls.length > 0 && (
                          <div className="instagram-evidence">
                            {candidate.evidenceUrls.slice(0, 2).map((url, index) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Fonte pública {index + 1}
                                <ExternalLink size={11} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="instagram-candidate-actions">
                        <a
                          href={candidate.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir perfil
                        </a>
                        <button
                          type="button"
                          onClick={() => confirmInstagram(candidate)}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectInstagram(candidate)}
                        >
                          Não é este
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="instagram-not-found">
                  <span>Instagram não identificado</span>
                </div>
              )}

              {presenceError ? (
                <div className="instagram-search-error">
                  <span>{presenceError}</span>
                  <button
                    type="button"
                    onClick={() => void verifyPresence(true)}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : presenceLoading ? (
                <span className="presence-checking">
                  Buscando Instagram...
                </span>
              ) : !confirmedInstagram ||
                (business.instagramSource !== "manual_confirmation" &&
                  business.instagramCheckedAt) ? (
                <button
                  className="presence-retry"
                  type="button"
                  onClick={() =>
                    void verifyPresence(Boolean(business.instagramCheckedAt))
                  }
                >
                  {business.instagramCheckedAt
                    ? "Buscar novamente"
                    : "Buscar Instagram"}
                </button>
              ) : null}
            </div>
          </div>

          <BusinessDeepEnrichmentSection
            business={business}
            segment={segmentLabel ?? business.primaryCategory ?? "Empresa local"}
            leadId={activityLeadId}
            {...(onDeepEnrichmentUpdate
              ? { onApply: onDeepEnrichmentUpdate }
              : {})}
          />

          {updates.length > 0 && (
            <div className="detail-section lead-update-history">
              <h3>Atualizações recentes</h3>
              <div className="lead-update-history-list">
                {updates.slice(0, 8).map((update) => (
                  <div
                    className={
                      update.importance === "high"
                        ? "lead-update-history-item important"
                        : "lead-update-history-item"
                    }
                    key={update.id}
                  >
                    <div>
                      <strong>{update.message}</strong>
                      <span>{formatDateTime(update.createdAt)}</span>
                    </div>
                    {!update.isSeen && <small>Novo</small>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-actions">
            {commercialLead ? (
              <>
                <button
                  type="button"
                  className="secondary-button added-button"
                  disabled
                >
                  Já adicionado
                </button>
                <span
                  className={`status-badge commercial-status-badge ${commercialLead.status}`}
                  aria-label={`Status: ${STATUS_LABEL[commercialLead.status]}`}
                >
                  {STATUS_LABEL[commercialLead.status]}
                </span>
                {canOpenCommercialWhatsApp ? (
                  <button
                    type="button"
                    className={
                      commercialLead.status === "send_message"
                        ? "message-button"
                        : "secondary-button"
                    }
                    onClick={() =>
                      onMessage({
                        id: commercialLead.id,
                        company: business.name,
                        phone: commercialPhone,
                      })
                    }
                  >
                    <MessageCircle size={15} />
                    {commercialLead.status === "send_message"
                      ? "Enviar mensagem"
                      : "Abrir WhatsApp"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled
                    title="Este lead não possui telefone válido."
                  >
                    Sem telefone
                  </button>
                )}
              </>
            ) : (
              <>
                {business.phone && (
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onWhatsApp(business)}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      className="message-button"
                      onClick={() =>
                        onMessage({
                          company: business.name,
                          phone: business.phone ?? "",
                        })
                      }
                    >
                      <MessageCircle size={15} />
                      Mandar mensagem
                    </button>
                  </>
                )}
              </>
            )}
            <button
              type="button"
              className="secondary-button prompt-button"
              onClick={() => onGeneratePrompt(business)}
            >
              <Sparkles size={15} />
              Gerar prompt
            </button>
            {!commercialLead && (onAdd || alreadyAdded) && (
              <button
                type="button"
                className={alreadyAdded ? "secondary-button added-button" : "primary-button"}
                disabled={alreadyAdded || addingLead}
                onClick={() => void addToLeads()}
              >
                {alreadyAdded
                  ? "Já está nos seus leads"
                  : addingLead
                    ? "Adicionando..."
                    : "Adicionar aos meus leads"}
              </button>
            )}
          </div>
          {commercialError && (
            <p className="detail-action-error" role="status">
              {commercialError}
            </p>
          )}
        </div>
        ) : activityLeadId ? (
          <div className="business-detail-content business-history-content">
            <LeadActivityTimeline leadId={activityLeadId} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
