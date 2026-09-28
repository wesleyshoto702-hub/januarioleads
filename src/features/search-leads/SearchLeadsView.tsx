import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { businessAlreadyExists, type ExistingLeadIdentity } from "./identity";
import { searchBusinesses } from "./search-businesses";
import { normalizeSearchText, SEGMENT_GROUPS } from "./segments";
import type { BusinessSearchResult } from "./types";

export type SearchMessageTarget = {
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

type ResultSort = "rating" | "reviews" | "az" | "za";

const RECENT_SEARCHES_KEY = "leadflow:recent-searches";

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
}: {
  existingLeads: ExistingLeadIdentity[];
  onAddLead: (business: BusinessSearchResult, selectedSegment: string) => void;
  onMessage: (target: SearchMessageTarget) => void;
  onGeneratePrompt: (business: BusinessSearchResult, selectedSegment: string) => void;
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
      results.map((business) => ({
        business,
        alreadyAdded: businessAlreadyExists(business, existingLeads),
      })),
    [results, existingLeads],
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
    const phone = normalizePhone(business.phone);
    window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
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
          {visibleResults.map(({ business, alreadyAdded }) => (
            <BusinessCard
              key={business.placeId}
              business={business}
              alreadyAdded={alreadyAdded}
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

      {details && (
        <BusinessDetails
          business={details}
          alreadyAdded={businessAlreadyExists(details, existingLeads)}
          onClose={() => setDetails(null)}
          onWhatsApp={openWhatsApp}
          onMessage={onMessage}
          onGeneratePrompt={(item) => {
            setDetails(null);
            onGeneratePrompt(item, resultsSegment);
          }}
          onAdd={(item) => onAddLead(item, resultsSegment)}
        />
      )}
    </section>
  );
}

function BusinessCard({
  business,
  alreadyAdded,
  onDetails,
  onWhatsApp,
  onMessage,
  onGeneratePrompt,
  onAdd,
}: {
  business: BusinessSearchResult;
  alreadyAdded: boolean;
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
            <h2>{business.name}</h2>
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
              onClick={() => onMessage({ company: business.name, phone: business.phone ?? "" })}
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

function BusinessDetails({
  business,
  alreadyAdded,
  onClose,
  onWhatsApp,
  onMessage,
  onGeneratePrompt,
  onAdd,
}: {
  business: BusinessSearchResult;
  alreadyAdded: boolean;
  onClose: () => void;
  onWhatsApp: (business: BusinessSearchResult) => void;
  onMessage: (target: SearchMessageTarget) => void;
  onGeneratePrompt: (business: BusinessSearchResult) => void;
  onAdd: (business: BusinessSearchResult) => void;
}) {
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
            <span className="detail-kicker">{business.primaryCategory ?? "Empresa local"}</span>
            <h2>{business.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="business-detail-content">
          {business.description && <p className="business-description">{business.description}</p>}

          <div className="detail-grid">
            {business.address && (
              <DetailItem label="Endereço" value={business.address} />
            )}
            {business.neighborhood && <DetailItem label="Bairro" value={business.neighborhood} />}
            {business.city && <DetailItem label="Cidade" value={business.city} />}
            {business.phone && <DetailItem label="Telefone" value={business.phone} />}
            {business.rating !== null && (
              <DetailItem
                label="Avaliação"
                value={`${business.rating.toFixed(1)}${business.reviewCount !== null ? ` · ${business.reviewCount} avaliações` : ""}`}
              />
            )}
            {business.isOpenNow !== null && (
              <DetailItem label="Status agora" value={business.isOpenNow ? "Aberto" : "Fechado"} />
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

          {business.businessStatus && formatBusinessStatus(business.businessStatus) && (
            <div className="detail-section">
              <h3>Situação da empresa</h3>
              <p className="detail-note">{formatBusinessStatus(business.businessStatus)}</p>
            </div>
          )}

          {business.openingHours.length > 0 && (
            <div className="detail-section">
              <h3>Horários de funcionamento</h3>
              <div className="opening-hours">
                {business.openingHours.map((line) => <span key={line}>{line}</span>)}
              </div>
            </div>
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
              {business.instagram ? (
                <a href={business.instagram} target="_blank" rel="noreferrer">
                  Instagram <ExternalLink size={13} />
                </a>
              ) : (
                <span>Instagram não identificado</span>
              )}
              {business.googleMapsUrl && (
                <a href={business.googleMapsUrl} target="_blank" rel="noreferrer">
                  <MapPin size={15} /> Google Maps e avaliações <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>

          <div className="detail-actions">
            {business.phone && (
              <>
                <button type="button" className="secondary-button" onClick={() => onWhatsApp(business)}>
                  WhatsApp
                </button>
                <button
                  type="button"
                  className="message-button"
                  onClick={() => onMessage({ company: business.name, phone: business.phone ?? "" })}
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
            <button
              type="button"
              className={alreadyAdded ? "secondary-button added-button" : "primary-button"}
              disabled={alreadyAdded}
              onClick={() => onAdd(business)}
            >
              {alreadyAdded ? "Já está nos seus leads" : "Adicionar aos meus leads"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
