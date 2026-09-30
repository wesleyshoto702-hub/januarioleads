import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildFactualBusinessDescription } from "../business-presence/business-description";
import type { DeepEnrichmentApplied } from "../business-enrichment/types";
import type { BusinessPresence } from "../business-presence/types";
import { ChanceBadge } from "../lead-chance/ChanceBadge";
import { BusinessDetailsModal } from "./BusinessDetailsModal";
import {
  calculateLeadChance,
  type LeadChanceResult,
} from "../lead-chance/lead-chance";
import {
  businessAlreadyExists,
  findBusinessDuplicate,
  normalizeBrazilianPhone,
  type ExistingLeadIdentity,
} from "./identity";
import { searchBusinesses } from "./search-businesses";
import { normalizeSearchText, SEGMENT_GROUPS } from "./segments";
import type { BusinessSearchResult } from "./types";

export type SearchMessageTarget = {
  id?: string;
  company: string;
  phone: string;
};

type ResultFilter =
  | "all"
  | "phone"
  | "whatsapp"
  | "with-site"
  | "without-site"
  | "with-instagram"
  | "without-instagram";

type ResultSort =
  | "chance-desc"
  | "chance-asc"
  | "rating"
  | "reviews"
  | "az"
  | "za";

const RECENT_SEARCHES_KEY = "leadflow:recent-searches";

function getRecentSearches() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function storeRecentSearch(segment: string) {
  const next = [segment, ...getRecentSearches().filter((item) => item !== segment)].slice(0, 5);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export function SearchLeadsView({
  existingLeads,
  onAddLead,
  onMessage,
  onGeneratePrompt,
  onDeepEnrichmentApplied,
}: {
  existingLeads: ExistingLeadIdentity[];
  onAddLead: (business: BusinessSearchResult, selectedSegment: string) => void;
  onMessage: (target: SearchMessageTarget) => void;
  onGeneratePrompt: (business: BusinessSearchResult, selectedSegment: string) => void;
  onDeepEnrichmentApplied?: (
    leadId: string,
    value: DeepEnrichmentApplied,
  ) => void;
}) {
  const [categoryQuery, setCategoryQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [resultsSegment, setResultsSegment] = useState("");
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<"segments" | "results">("segments");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [sort, setSort] = useState<ResultSort>("rating");
  const [onlyNew, setOnlyNew] = useState(false);
  const [details, setDetails] = useState<BusinessSearchResult | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  function applyDeepToBusiness(
    current: BusinessSearchResult,
    value: DeepEnrichmentApplied,
  ): BusinessSearchResult {
    const nextInstagram = value.identityUpdates.instagram ?? current.instagram;
    return {
      ...current,
      verifiedContent: value.verifiedContent,
      verifiedImages: value.verifiedImages,
      confirmedChannels: value.confirmedChannels,
      deepEnrichmentStatus: value.status,
      deepEnrichmentQuality: value.quality,
      deepEnrichmentCheckedAt: value.checkedAt,
      website: value.identityUpdates.website ?? current.website,
      instagram: nextInstagram,
      ...(value.identityUpdates.instagram
        ? {
            instagramConfidence: "high" as const,
            instagramSource: "official_website" as const,
            instagramCheckedAt: value.checkedAt ?? new Date().toISOString(),
            instagramNeedsReview: false,
          }
        : {}),
    };
  }

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const filteredGroups = useMemo(() => {
    const query = normalizeSearchText(categoryQuery);
    if (!query) return SEGMENT_GROUPS;
    return SEGMENT_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => normalizeSearchText(item).includes(query)),
    })).filter((group) => group.items.length > 0);
  }, [categoryQuery]);

  const resultWithExisting = useMemo(
    () =>
      results.map((business) => {
        const existingLead = findBusinessDuplicate(business, existingLeads);
        return {
          business,
          alreadyAdded: Boolean(existingLead),
          existingLeadId: existingLead?.id,
          chance: calculateLeadChance(business, resultsSegment),
        };
      }),
    [results, existingLeads, resultsSegment],
  );

  const visibleResults = useMemo(() => {
    const filtered = resultWithExisting.filter(({ business, alreadyAdded }) => {
      if (onlyNew && alreadyAdded) return false;
      if (filter === "phone" || filter === "whatsapp") return Boolean(business.phone);
      if (filter === "with-site") return Boolean(business.website);
      if (filter === "without-site") return !business.website;
      if (filter === "with-instagram") return Boolean(business.instagram);
      if (filter === "without-instagram") return !business.instagram;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "chance-desc") return b.chance.score - a.chance.score;
      if (sort === "chance-asc") return a.chance.score - b.chance.score;
      if (sort === "reviews") return (b.business.reviewCount ?? -1) - (a.business.reviewCount ?? -1);
      if (sort === "az") return a.business.name.localeCompare(b.business.name, "pt-BR");
      if (sort === "za") return b.business.name.localeCompare(a.business.name, "pt-BR");
      return (b.business.rating ?? -1) - (a.business.rating ?? -1);
    });
  }, [resultWithExisting, filter, sort, onlyNew]);

  const alreadyAddedCount = resultWithExisting.filter((item) => item.alreadyAdded).length;
  const newCount = resultWithExisting.length - alreadyAddedCount;

  async function runSearch(segment: string, pageToken?: string, append = false) {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);

    const response = await searchBusinesses(
      pageToken ? { segment, pageToken } : { segment },
    );

    if (!response.ok) {
      setError({ code: response.code, message: response.message });
      append ? setLoadingMore(false) : setLoading(false);
      return;
    }

    setResults((current) => {
      const combined = append ? [...current, ...response.results] : response.results;
      const unique = new Map(combined.map((item) => [item.placeId, item]));
      return Array.from(unique.values());
    });
    setNextPageToken(response.nextPageToken);
    setResultsSegment(segment);
    setScreen("results");
    setRecentSearches(storeRecentSearch(segment));
    append ? setLoadingMore(false) : setLoading(false);
  }

  function startSearch() {
    if (!selectedSegment) return;
    setFilter("all");
    setOnlyNew(false);
    void runSearch(selectedSegment);
  }

  function repeatSearch(segment: string) {
    setSelectedSegment(segment);
    setFilter("all");
    setOnlyNew(false);
    void runSearch(segment);
  }

  function openWhatsApp(business: BusinessSearchResult) {
    if (!business.phone) return;
    const phone = normalizeBrazilianPhone(business.phone);
    window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
  }


  function updateBusinessPresence(
    placeId: string,
    presence: BusinessPresence,
  ) {
    const merge = (business: BusinessSearchResult): BusinessSearchResult => {
      if (business.placeId !== placeId) return business;

      const next: BusinessSearchResult = {
        ...business,
        instagramCheckedAt: presence.instagramCheckedAt,
        instagramUsername: presence.instagramUsername,
        instagramCandidates: presence.instagramCandidates,
        instagramRejectedUrls: presence.instagramRejectedUrls,
        instagramSearchSignature: presence.instagramSearchSignature,
        instagramNeedsReview: presence.instagramNeedsReview,
        ...(presence.instagramUrl
          ? {
              instagram: presence.instagramUrl,
              instagramConfidence: presence.instagramConfidence,
              instagramSource: presence.instagramSource,
            }
          : {
              instagram:
                business.instagramConfidence === "high"
                  ? business.instagram
                  : null,
              instagramConfidence:
                business.instagramConfidence === "high"
                  ? business.instagramConfidence
                  : null,
              instagramSource:
                business.instagramConfidence === "high"
                  ? business.instagramSource
                  : null,
            }),
      };

      return {
        ...next,
        factualDescription: buildFactualBusinessDescription(next),
      };
    };

    setResults((current) => current.map(merge));
    setDetails((current) => (current ? merge(current) : current));
  }

  if (screen === "segments") {
    return (
      <section className="page-wrap search-leads-page">
        <div className="page-heading search-page-heading">
          <div>
            <p className="eyebrow">LAVRAS · MINAS GERAIS</p>
            <h1>Encontre empresas em Lavras</h1>
            <p className="subtitle">Escolha um segmento para encontrar possíveis clientes.</p>
          </div>
        </div>

        {recentSearches.length > 0 && (
          <div className="recent-searches">
            <span>Buscas recentes</span>
            <div>
              {recentSearches.map((segment) => (
                <button key={segment} type="button" onClick={() => repeatSearch(segment)}>
                  {segment}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="segment-picker">
          <div className="segment-search">
            <Search size={17} />
            <input
              value={categoryQuery}
              onChange={(event) => setCategoryQuery(event.target.value)}
              placeholder="Buscar segmento"
              aria-label="Buscar segmento"
            />
          </div>

          <div className="segment-groups">
            {filteredGroups.length ? (
              filteredGroups.map((group) => (
                <section className="segment-group" key={group.label}>
                  <h2>{group.label}</h2>
                  <div className="segment-options">
                    {group.items.map((segment) => (
                      <button
                        key={segment}
                        type="button"
                        className={selectedSegment === segment ? "segment-option selected" : "segment-option"}
                        onClick={() => setSelectedSegment(segment)}
                      >
                        <span>{segment}</span>
                        {selectedSegment === segment && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="segment-empty">Nenhum segmento encontrado.</div>
            )}
          </div>
        </div>

        <div className="selection-bar">
          <div>
            <span>Segmento selecionado</span>
            <strong>{selectedSegment || "Nenhum"}</strong>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={!selectedSegment || loading}
            onClick={startSearch}
          >
            {loading ? "Buscando empresas..." : "Avançar"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </div>

        {error && <SearchError error={error} />}
      </section>
    );
  }

  return (
    <section className="page-wrap search-leads-page">
      <div className="results-heading">
        <button type="button" className="back-button" onClick={() => setScreen("segments")}>
          <ArrowLeft size={16} />
          Alterar segmento
        </button>
        <div>
          <p className="eyebrow">LAVRAS · MINAS GERAIS</p>
          <h1>{resultsSegment}</h1>
          <p className="subtitle">
            {results.length} {results.length === 1 ? "empresa encontrada" : "empresas encontradas"}.
            {" "}{newCount} ainda não {newCount === 1 ? "cadastrada" : "cadastradas"} e {alreadyAddedCount} já
            {" "}{alreadyAddedCount === 1 ? "está" : "estão"} nos seus leads.
          </p>
        </div>
      </div>

      <div className="results-toolbar">
        <div className="result-filters">
          {([
            ["all", "Todos"],
            ["phone", "Com telefone"],
            ["whatsapp", "Com WhatsApp"],
            ["with-site", "Com site"],
            ["without-site", "Sem site"],
            ["with-instagram", "Com Instagram"],
            ["without-instagram", "Sem Instagram"],
          ] as [ResultFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "filter-chip active" : "filter-chip"}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="result-controls">
          <label className="new-only-control">
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(event) => setOnlyNew(event.target.checked)}
            />
            <span>Somente novos</span>
          </label>
          <label className="select-wrap">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ResultSort)}
              aria-label="Ordenar resultados"
            >
              <option value="chance-desc">Maior Chance</option>
              <option value="chance-asc">Menor Chance</option>
              <option value="rating">Maior avaliação</option>
              <option value="reviews">Mais avaliações</option>
              <option value="az">Nome A-Z</option>
              <option value="za">Nome Z-A</option>
            </select>
          </label>
        </div>
      </div>

      {error && <SearchError error={error} />}

      {!loading && visibleResults.length === 0 && !error ? (
        <div className="search-state">
          <Search size={20} />
          <strong>Nenhuma empresa encontrada</strong>
          <p>Tente outro segmento ou altere os filtros atuais.</p>
        </div>
      ) : (
        <div className="business-results">
          {visibleResults.map(({ business, alreadyAdded, existingLeadId, chance }) => (
            <BusinessCard
              key={business.placeId}
              business={business}
              chance={chance}
              alreadyAdded={alreadyAdded}
              existingLeadId={existingLeadId}
              onDetails={setDetails}
              onWhatsApp={openWhatsApp}
              onMessage={onMessage}
              onGeneratePrompt={(item) => onGeneratePrompt(item, resultsSegment)}
              onAdd={(item) => onAddLead(item, resultsSegment)}
            />
          ))}
        </div>
      )}

      {nextPageToken && !error && (
        <div className="load-more-wrap">
          <button
            type="button"
            className="secondary-button"
            disabled={loadingMore}
            onClick={() => void runSearch(resultsSegment, nextPageToken, true)}
          >
            {loadingMore ? "Buscando mais..." : "Carregar mais"}
          </button>
        </div>
      )}

      {details && (() => {
        const duplicate = findBusinessDuplicate(details, existingLeads);
        return (
        <BusinessDetailsModal
          business={details}
          chance={calculateLeadChance(details, resultsSegment)}
          segmentLabel={resultsSegment}
          alreadyAdded={Boolean(duplicate)}
          activityLeadId={duplicate?.id ?? null}
          onClose={() => setDetails(null)}
          onWhatsApp={openWhatsApp}
          onMessage={(target) =>
            onMessage({
              ...target,
              id: findBusinessDuplicate(details, existingLeads)?.id,
            })
          }
          onGeneratePrompt={(item) => {
            setDetails(null);
            onGeneratePrompt(
              {
                ...item,
                factualDescription:
                  item.factualDescription ??
                  buildFactualBusinessDescription(item),
              },
              resultsSegment,
            );
          }}
          onPresenceUpdate={(presence) =>
            updateBusinessPresence(details.placeId, presence)
          }
          onDeepEnrichmentUpdate={(value) => {
            const enriched = applyDeepToBusiness(details, value);
            setDetails(enriched);
            setResults((current) =>
              current.map((item) =>
                item.placeId === details.placeId ? enriched : item,
              ),
            );
            if (duplicate?.id) {
              onDeepEnrichmentApplied?.(duplicate.id, value);
            }
          }}
          onAdd={(item) => onAddLead(item, resultsSegment)}
        />
        );
      })()}
    </section>
  );
}

function BusinessCard({
  business,
  chance,
  alreadyAdded,
  existingLeadId,
  onDetails,
  onWhatsApp,
  onMessage,
  onGeneratePrompt,
  onAdd,
}: {
  business: BusinessSearchResult;
  chance: LeadChanceResult;
  alreadyAdded: boolean;
  existingLeadId?: string;
  onDetails: (business: BusinessSearchResult) => void;
  onWhatsApp: (business: BusinessSearchResult) => void;
  onMessage: (target: SearchMessageTarget) => void;
  onGeneratePrompt: (business: BusinessSearchResult) => void;
  onAdd: (business: BusinessSearchResult) => void;
}) {
  return (
    <article className="business-card">
      <div className="business-card-main">
        <div className="business-title-row">
          <div>
            <div className="business-name-line">
              <h2>{business.name}</h2>
              <ChanceBadge chance={chance} />
            </div>
            {business.primaryCategory && <span>{business.primaryCategory}</span>}
          </div>
          {business.isOpenNow !== null && (
            <span className={business.isOpenNow ? "open-status open" : "open-status closed"}>
              {business.isOpenNow ? "Aberto" : "Fechado"}
            </span>
          )}
        </div>

        <div className="business-facts">
          {business.address && (
            <span>
              <MapPin size={14} />
              {business.address}
            </span>
          )}
          {business.phone && (
            <span>
              <Phone size={14} />
              {business.phone}
            </span>
          )}
          {business.rating !== null && (
            <span>
              <Star size={14} />
              {business.rating.toFixed(1)}
              {business.reviewCount !== null ? ` · ${business.reviewCount} avaliações` : ""}
            </span>
          )}
        </div>

        <div className="business-presence">
          {business.website ? (
            <a href={business.website} target="_blank" rel="noreferrer">
              Site <ExternalLink size={12} />
            </a>
          ) : (
            <span>Site não identificado</span>
          )}
          {business.googleMapsUrl && (
            <a href={business.googleMapsUrl} target="_blank" rel="noreferrer">
              Google Maps <ExternalLink size={12} />
            </a>
          )}
          {business.instagram && (
            <a href={business.instagram} target="_blank" rel="noreferrer">
              Instagram <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <div className="business-actions">
        <button type="button" className="secondary-button compact-button" onClick={() => onDetails(business)}>
          Ver empresa
        </button>
        {business.phone && (
          <>
            <button type="button" className="secondary-button compact-button" onClick={() => onWhatsApp(business)}>
              WhatsApp
            </button>
            <button
              type="button"
              className="message-button compact-button"
              onClick={() =>
                onMessage({
                  id: existingLeadId,
                  company: business.name,
                  phone: business.phone ?? "",
                })
              }
            >
              <MessageCircle size={14} />
              Mandar mensagem
            </button>
          </>
        )}
        <button
          type="button"
          className="secondary-button compact-button prompt-button"
          onClick={() => onGeneratePrompt(business)}
        >
          <Sparkles size={14} />
          Gerar prompt
        </button>
        <button
          type="button"
          className={alreadyAdded ? "secondary-button compact-button added-button" : "primary-button compact-button"}
          disabled={alreadyAdded}
          onClick={() => onAdd(business)}
        >
          {alreadyAdded ? "Já está nos seus leads" : "Adicionar aos meus leads"}
        </button>
      </div>
    </article>
  );
}

function SearchError({ error }: { error: { code: string; message: string } }) {
  const title =
    error.code === "NOT_CONFIGURED"
      ? "Integração de busca indisponível"
      : error.code === "QUOTA"
        ? "Limite da API atingido"
        : error.code === "BILLING_REQUIRED"
          ? "Faturamento necessário"
          : error.code === "API_NOT_ENABLED"
            ? "Places API indisponível"
            : error.code === "GOOGLE_AUTH"
              ? "Credencial do Google recusada"
              : error.code === "INVALID_REQUEST"
                ? "Busca inválida"
                : "Erro na busca";

  return (
    <div className="search-error">
      <strong>{title}</strong>
      <p>{error.message}</p>
    </div>
  );
}
