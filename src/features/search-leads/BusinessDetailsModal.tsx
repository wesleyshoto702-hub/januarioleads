import { safeExternalHref } from "../../lib/safe-external-url";
import {
  ExternalLink,
  Globe,
  Instagram,
  MessageCircle,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { displayBusinessDescription } from "../business-presence/business-description";
import { normalizeBrazilianStateCode } from "../../lib/brazil-locations";
import { discoverBusinessPresence } from "../business-presence/discover-business-presence";
import { canonicalManualInstagramUrl, presenceFromBusiness } from "../business-presence/storage";
import type {
  BusinessPresence,
  InstagramCandidate,
  InstagramSource,
} from "../business-presence/types";
import { LeadActivityTimeline } from "../lead-activities/LeadActivityTimeline";
import { ObjectionsPanel } from "../commercial-expansion/ObjectionsPanel";
import { LeadFinancialSection } from "../lead-finance/LeadFinancialSection";
import {
  LeadNextActionSection,
  type NextActionPatch,
} from "../next-actions/LeadNextActionSection";
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
import { BusinessSourceCredit } from "./BusinessSourceCredit";
import { GoogleMapsLink } from "./GoogleMapsLink";
import { LeadCompanyCheckSection } from "../lead-verification/LeadCompanyCheckSection";

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

function formatBusinessStatus(value: string | null) {
  if (value === "CLOSED_PERMANENTLY") return "Fechada permanentemente";
  if (value === "CLOSED_TEMPORARILY") return "Fechada temporariamente";
  if (value === "OPERATIONAL") return "Em funcionamento";
  return null;
}

const INSTAGRAM_SOURCE_LABEL: Record<InstagramSource, string> = {
  google_places: "Pesquisa automática",
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
  onPresenceUpdate,
  onContactPhoneApply,
  financeLead,
  financePayments = [],
  onFinanceUpdate,
  onPaymentSaved,
  followUpLead,
  onNextActionSave,
  onNextActionComplete,
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
  onPresenceUpdate?: (presence: BusinessPresence) => void;
  onContactPhoneApply?: (phone: string) => void;
  financeLead?: PersistedLead | null;
  financePayments?: LeadPayment[];
  onFinanceUpdate?: (
    leadId: string,
    patch: Pick<PersistedLead, "projectValue" | "financialNotes">,
  ) => void;
  onPaymentSaved?: (payment: LeadPayment) => void;
  followUpLead?: PersistedLead | null;
  onNextActionSave?: (patch: NextActionPatch) => void | Promise<void>;
  onNextActionComplete?: () => void | Promise<void>;
  onAdd?: (
    business: BusinessSearchResult,
  ) => Promise<BusinessAddResult> | BusinessAddResult | void;
}) {
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [presenceError, setPresenceError] = useState("");
  const [manualInstagramOpen, setManualInstagramOpen] = useState(false);
  const [manualInstagram, setManualInstagram] = useState("");
  const [manualInstagramError, setManualInstagramError] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "history">("info");
  const [addingLead, setAddingLead] = useState(false);
  const [commercialError, setCommercialError] = useState("");

  const factualDescription =
    displayBusinessDescription(business, segmentLabel);
  const confirmedInstagram =
    business.instagram &&
    business.instagramConfidence !== "medium" &&
    business.instagramConfidence !== "low"
      ? business.instagram
      : null;
  const candidates = business.instagramCandidates ?? [];
  const googleInstagramSearch = `https://www.google.com/search?q=${encodeURIComponent(
    ["site:instagram.com", `"${business.name}"`, business.city, business.state, business.phone]
      .filter(Boolean).join(" "),
  )}`;
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

  function confirmManualInstagram() {
    const profile = canonicalManualInstagramUrl(manualInstagram);
    if (!profile) {
      setManualInstagramError(
        "Informe um perfil do Instagram ou @usuario. Links de posts e reels não são aceitos.",
      );
      return;
    }
    const current = presenceFromBusiness(business);
    onPresenceUpdate?.({
      instagramUrl: profile,
      instagramUsername: new URL(profile).pathname.split("/").filter(Boolean)[0] ?? null,
      instagramDisplayName: null,
      instagramConfidence: "high",
      instagramSource: "manual_confirmation",
      instagramCheckedAt: new Date().toISOString(),
      instagramCandidates: [],
      instagramRejectedUrls: (current?.instagramRejectedUrls ?? []).filter((url) => url !== profile),
      instagramSearchSignature: current?.instagramSearchSignature ??
        business.instagramSearchSignature ?? null,
      instagramNeedsReview: false,
    });
    setManualInstagram("");
    setManualInstagramError("");
    setManualInstagramOpen(false);
  }

  function confirmInstagram(candidate: InstagramCandidate) {
    const current = presenceFromBusiness(business);
    onPresenceUpdate?.({
      instagramUrl: candidate.url,
      instagramUsername: candidate.username,
      instagramDisplayName: candidate.displayName ?? null,
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
      instagramDisplayName: current?.instagramDisplayName ?? null,
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
    setManualInstagram("");
    setManualInstagramError("");
    setManualInstagramOpen(false);
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
              {segmentLabel ?? "Empresa local"}
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
            {(business.city || business.state) && (
              <DetailItem
                label="Cidade / UF"
                value={[
                  business.city,
                  normalizeBrazilianStateCode(business.state) || business.state,
                ].filter(Boolean).join(" · ")}
              />
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

          {activityLeadId && (
            <LeadCompanyCheckSection
              key={activityLeadId}
              leadId={activityLeadId}
              business={business}
              onApplyPhone={onContactPhoneApply}
            />
          )}

          {financeLead && onFinanceUpdate && onPaymentSaved && (
            <LeadFinancialSection
              lead={financeLead}
              payments={financePayments}
              onFinanceUpdate={onFinanceUpdate}
              onPaymentSaved={onPaymentSaved}
            />
          )}

          {activityLeadId && <ObjectionsPanel key={activityLeadId} leadId={activityLeadId} />}

          {followUpLead && onNextActionSave && onNextActionComplete && (
            <LeadNextActionSection
              lead={followUpLead}
              onSave={onNextActionSave}
              onComplete={onNextActionComplete}
            />
          )}

          <div className="detail-section">
            <h3>Presença online</h3>
            <div className="detail-links">
              <GoogleMapsLink business={business} />
              {business.website ? (
                <a href={safeExternalHref(business.website) ?? undefined} target="_blank" rel="noopener noreferrer">
                  <Globe size={15} /> Site <ExternalLink size={13} />
                </a>
              ) : (
                <span>Site não identificado</span>
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
                    href={safeExternalHref(confirmedInstagram) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
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
                      ? "Possível perfil do Instagram"
                      : "Perfis encontrados para conferência"}
                  </strong>

                  {candidates.map((candidate) => (
                    <article
                      className="instagram-candidate"
                      key={candidate.url}
                    >
                      <div className="instagram-candidate-main">
                        <b>@{candidate.username}</b>
                        {candidate.confidence === "low" && (
                          <small className="instagram-low-confidence">
                            Evidência limitada — confira antes de confirmar
                          </small>
                        )}
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
                                href={safeExternalHref(url) ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
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
                          href={safeExternalHref(candidate.url) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
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
                  <span>{business.instagramCheckedAt
                    ? "Nenhum perfil confirmado nesta pesquisa"
                    : "Busca de Instagram ainda não realizada"}</span>
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
                    ? "Ampliar busca de Instagram"
                    : "Buscar Instagram na web"}
                </button>
              ) : null}

              <div className="instagram-manual-actions">
                <a href={safeExternalHref(googleInstagramSearch) ?? undefined} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} /> Pesquisar no Google
                </a>
                <button type="button" onClick={() => {
                  setManualInstagramOpen((current) => !current);
                  setManualInstagramError("");
                }}>
                  <Instagram size={14} /> Informar perfil manualmente
                </button>
              </div>
              {manualInstagramOpen && (
                <form className="instagram-manual-form" onSubmit={(event) => {
                  event.preventDefault();
                  confirmManualInstagram();
                }}>
                  <label htmlFor="manual-instagram-profile">
                    Cole o perfil oficial encontrado (URL ou @usuario)
                  </label>
                  <div>
                    <input
                      id="manual-instagram-profile"
                      value={manualInstagram}
                      onChange={(event) => {
                        setManualInstagram(event.target.value);
                        setManualInstagramError("");
                      }}
                      placeholder="https://www.instagram.com/empresa/"
                      autoComplete="off"
                      required
                    />
                    <button type="submit">Confirmar perfil</button>
                  </div>
                  {manualInstagramError && <small role="alert">{manualInstagramError}</small>}
                </form>
              )}
            </div>
          </div>

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
          <BusinessSourceCredit source={business.source} />
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
