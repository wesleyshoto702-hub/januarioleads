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
import { discoverBusinessPresence } from "../business-presence/discover-business-presence";
import type { BusinessPresence } from "../business-presence/types";
import { LeadActivityTimeline } from "../lead-activities/LeadActivityTimeline";
import { ChanceBadge } from "../lead-chance/ChanceBadge";
import type { LeadChanceResult } from "../lead-chance/lead-chance";
import type { LeadUpdateRecord } from "../leads/remote-leads";
import type { BusinessSearchResult } from "./types";

export type BusinessDetailsMessageTarget = {
  company: string;
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

export function BusinessDetailsModal({
  business,
  chance,
  segmentLabel,
  alreadyAdded = false,
  lastSyncedAt,
  updates = [],
  activityLeadId,
  onClose,
  onWhatsApp,
  onMessage,
  onGeneratePrompt,
  onPresenceUpdate,
  onAdd,
}: {
  business: BusinessSearchResult;
  chance?: LeadChanceResult | null;
  segmentLabel?: string | null;
  alreadyAdded?: boolean;
  lastSyncedAt?: string | null;
  updates?: LeadUpdateRecord[];
  activityLeadId?: string | null;
  onClose: () => void;
  onWhatsApp: (business: BusinessSearchResult) => void;
  onMessage: (target: BusinessDetailsMessageTarget) => void;
  onGeneratePrompt: (business: BusinessSearchResult) => void;
  onPresenceUpdate?: (presence: BusinessPresence) => void;
  onAdd?: (business: BusinessSearchResult) => void;
}) {
  const [presenceLoading, setPresenceLoading] = useState(
    Boolean(business.instagram || business.website),
  );
  const [activeTab, setActiveTab] = useState<"info" | "history">("info");

  const factualDescription =
    business.factualDescription ?? buildFactualBusinessDescription(business);

  async function verifyPresence(force = false) {
    setPresenceLoading(true);
    try {
      const presence = await discoverBusinessPresence(business, { force });
      if (presence) onPresenceUpdate?.(presence);
    } finally {
      setPresenceLoading(false);
    }
  }

  useEffect(() => {
    setActiveTab("info");

    if (business.instagram || business.website) {
      void verifyPresence(false);
    } else {
      setPresenceLoading(false);
    }
    // One automatic verification per opened business. Cache prevents repeat requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.placeId]);

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
              {business.instagram &&
              business.instagramConfidence !== "low" ? (
                <a
                  className="instagram-identified-link"
                  href={business.instagram}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Instagram size={15} />
                  Instagram identificado <ExternalLink size={13} />
                </a>
              ) : (
                <span>Instagram não identificado</span>
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

            {presenceLoading ? (
              <span className="presence-checking">
                Verificando presença online...
              </span>
            ) : !business.instagram && business.website ? (
              <button
                className="presence-retry"
                type="button"
                onClick={() => void verifyPresence(true)}
              >
                Buscar Instagram novamente
              </button>
            ) : null}
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
            <button
              type="button"
              className="secondary-button prompt-button"
              onClick={() => onGeneratePrompt(business)}
            >
              <Sparkles size={15} />
              Gerar prompt
            </button>
            {(onAdd || alreadyAdded) && (
              <button
                type="button"
                className={alreadyAdded ? "secondary-button added-button" : "primary-button"}
                disabled={alreadyAdded}
                onClick={() => onAdd?.(business)}
              >
                {alreadyAdded ? "Já está nos seus leads" : "Adicionar aos meus leads"}
              </button>
            )}
          </div>
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
