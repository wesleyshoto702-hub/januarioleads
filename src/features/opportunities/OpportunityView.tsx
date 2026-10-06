import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Info,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeepEnrichmentApplied } from "../business-enrichment/types";
import type { BusinessPresence } from "../business-presence/types";
import type { PersistedLead } from "../leads/remote-leads";
import {
  BusinessDetailsModal,
  type BusinessAddResult,
} from "../search-leads/BusinessDetailsModal";
import {
  findBusinessDuplicate,
  normalizeBrazilianPhone,
} from "../search-leads/identity";
import type { BusinessSearchResult } from "../search-leads/types";
import {
  hasBusinessPhone,
  hasIdentifiedWebsite,
  hasStableActivitySignal,
  sortPriorityBusinesses,
} from "./opportunity-businesses";
import { loadOpportunityData } from "./opportunity-data";
import type {
  OpportunityRecord,
  OpportunitySort,
  OpportunitySummary,
} from "./types";
import "./opportunities.css";
import { openWhatsAppLink } from "../../lib/whatsapp";
import {
  BRAZIL_STATES,
  DEFAULT_BRAZIL_STATE,
  findBrazilianState,
} from "../../lib/brazil-locations";

type RankingMode = "city" | "segment";
type BusinessFilter =
  | "priority"
  | "all"
  | "without-site"
  | "phone"
  | "added";

type MessageTarget = {
  id?: string;
  company: string;
  phone: string;
};

const LEVEL_LABEL = {
  low: "Baixa",
  moderate: "Moderada",
  high: "Alta",
  very_high: "Muito alta",
} as const;

const CONFIDENCE_LABEL = {
  insufficient: "Amostra insuficiente",
  low: "Amostra baixa",
  medium: "Amostra média",
  good: "Amostra boa",
} as const;

const EMPTY_SUMMARY: OpportunitySummary = {
  cities: 0,
  segments: 0,
  uniqueBusinesses: 0,
  withoutSiteBusinesses: 0,
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRelative(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  const diffDays = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 86_400_000),
  );
  if (diffDays === 0) return "Atualizado hoje";
  if (diffDays === 1) return "Atualizado há 1 dia";
  if (diffDays <= 29) return `Atualizado há ${diffDays} dias`;
  return `Dados coletados em ${new Intl.DateTimeFormat("pt-BR").format(date)}`;
}

function directWhatsApp(business: BusinessSearchResult) {
  const phone = normalizeBrazilianPhone(
    business.phone || business.internationalPhone,
  );
  if (phone.length !== 12 && phone.length !== 13) return;
  openWhatsAppLink({ phone });
}

export function OpportunityView({
  existingLeads,
  onAddLead,
  onMessage,
  onDeepEnrichmentApplied,
  onGoSearch,
}: {
  existingLeads: PersistedLead[];
  onAddLead: (
    business: BusinessSearchResult,
    selectedSegment: string,
  ) => Promise<BusinessAddResult>;
  onMessage: (target: MessageTarget) => void;
  onDeepEnrichmentApplied?: (
    leadId: string,
    value: DeepEnrichmentApplied,
  ) => void;
  onGoSearch: () => void;
}) {
  const [records, setRecords] = useState<OpportunityRecord[]>([]);
  const [summary, setSummary] = useState<OpportunitySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<RankingMode>("city");
  const [state, setState] = useState(DEFAULT_BRAZIL_STATE.code);
  const [city, setCity] = useState("");
  const [segment, setSegment] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sufficientOnly, setSufficientOnly] = useState(false);
  const [highOnly, setHighOnly] = useState(false);
  const [sort, setSort] = useState<OpportunitySort>("score");
  const [selected, setSelected] = useState<OpportunityRecord | null>(null);
  const [businessFilter, setBusinessFilter] =
    useState<BusinessFilter>("priority");
  const [details, setDetails] = useState<BusinessSearchResult | null>(null);
  const businessPanelRef = useRef<HTMLElement | null>(null);
  const existingLeadIdentities = useMemo(
    () =>
      existingLeads.map((lead) => ({
        id: lead.id,
        company: lead.company,
        phone: lead.phone,
        status: lead.status,
        ...(lead.placeId ? { placeId: lead.placeId } : {}),
        ...(lead.address ? { address: lead.address } : {}),
      })),
    [existingLeads],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void loadOpportunityData(existingLeads)
      .then((value) => {
        if (!active) return;
        setRecords(value.records);
        setSummary(value.summary);
        setPartial(value.partial);
      })
      .catch(() => {
        if (!active) return;
        setError("Não foi possível carregar as amostras de oportunidades agora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [existingLeads]);

  const availableStates = useMemo(
    () =>
      BRAZIL_STATES.filter((item) =>
        records.some((record) => record.state === item.code),
      ),
    [records],
  );

  useEffect(() => {
    const firstState = availableStates[0]?.code ?? DEFAULT_BRAZIL_STATE.code;
    if (!availableStates.some((item) => item.code === state)) {
      setState(
        availableStates.some((item) => item.code === DEFAULT_BRAZIL_STATE.code)
          ? DEFAULT_BRAZIL_STATE.code
          : firstState,
      );
    }
  }, [availableStates, state]);

  const cities = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .filter((record) => record.state === state)
            .map((record) => record.city),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [records, state],
  );

  const segments = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .filter((record) => record.state === state)
            .map((record) => record.segment),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [records, state],
  );

  useEffect(() => {
    const firstCity = cities[0] ?? "";
    if (!city && firstCity) setCity(firstCity);
    if (city && !cities.includes(city)) setCity(firstCity);
  }, [cities, city]);

  useEffect(() => {
    const firstSegment = segments[0] ?? "";
    if (!segment && firstSegment) setSegment(firstSegment);
    if (segment && !segments.includes(segment)) setSegment(firstSegment);
  }, [segments, segment]);

  const ranking = useMemo(() => {
    const filtered = records.filter((record) => {
      if (record.state !== state) return false;
      if (mode === "city" && record.city !== city) return false;
      if (mode === "segment" && record.segment !== segment) return false;
      if (record.score < minScore) return false;
      if (
        sufficientOnly &&
        record.sampleConfidence === "insufficient"
      ) {
        return false;
      }
      if (highOnly && record.score < 60) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "without-site") {
        return b.withoutSiteCount - a.withoutSiteCount;
      }
      if (sort === "without-site-rate") {
        return b.withoutSiteRate - a.withoutSiteRate;
      }
      if (sort === "sample") return b.sampleSize - a.sampleSize;
      if (sort === "recent") {
        return b.lastObservedAt.localeCompare(a.lastObservedAt);
      }

      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      if (a.stale !== b.stale) return a.stale ? 1 : -1;
      return b.lastObservedAt.localeCompare(a.lastObservedAt);
    });
  }, [
    records,
    state,
    mode,
    city,
    segment,
    minScore,
    sufficientOnly,
    highOnly,
    sort,
  ]);

  useEffect(() => {
    if (!selected) return;
    const frame = window.requestAnimationFrame(() => {
      businessPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  const selectedBusinesses = useMemo(() => {
    if (!selected) return [];
    const prioritized = sortPriorityBusinesses(selected.businesses);
    return prioritized.filter((business) => {
      const existing = findBusinessDuplicate(business, existingLeadIdentities);
      if (businessFilter === "priority") {
        return !hasIdentifiedWebsite(business) && hasBusinessPhone(business);
      }
      if (businessFilter === "without-site") {
        return !hasIdentifiedWebsite(business);
      }
      if (businessFilter === "phone") return hasBusinessPhone(business);
      if (businessFilter === "added") return Boolean(existing);
      return true;
    });
  }, [selected, existingLeadIdentities, businessFilter]);

  function patchBusiness(
    placeId: string,
    patch: Partial<BusinessSearchResult>,
  ) {
    setRecords((current) =>
      current.map((record) => ({
        ...record,
        businesses: record.businesses.map((business) =>
          business.placeId === placeId
            ? { ...business, ...patch }
            : business,
        ),
      })),
    );
    setSelected((current) =>
      current
        ? {
            ...current,
            businesses: current.businesses.map((business) =>
              business.placeId === placeId
                ? { ...business, ...patch }
                : business,
            ),
          }
        : current,
    );
    setDetails((current) =>
      current?.placeId === placeId ? { ...current, ...patch } : current,
    );
  }

  function applyPresence(
    business: BusinessSearchResult,
    presence: BusinessPresence,
  ) {
    patchBusiness(business.placeId, {
      instagram: presence.instagramUrl,
      instagramConfidence: presence.instagramConfidence,
      instagramSource: presence.instagramSource,
      instagramCheckedAt: presence.instagramCheckedAt,
      instagramUsername: presence.instagramUsername,
      instagramCandidates: presence.instagramCandidates,
      instagramRejectedUrls: presence.instagramRejectedUrls,
      instagramSearchSignature: presence.instagramSearchSignature,
      instagramNeedsReview: presence.instagramNeedsReview,
    });
  }

  const detailsLead = details
    ? findBusinessDuplicate(details, existingLeadIdentities)
    : null;

  return (
    <section className="page-wrap opportunity-page">
      <div className="page-heading opportunity-heading">
        <div>
          <p className="eyebrow">INTELIGÊNCIA COMERCIAL · BRASIL</p>
          <h1>Oportunidades</h1>
          <p className="subtitle">
            Identifique regiões e segmentos com maior potencial de prospecção usando
            apenas amostras reais já observadas pelo JanuarioLeads.
          </p>
        </div>
        <span
          className="opportunity-info"
          title="O Índice de Oportunidade considera ausência de site identificado, disponibilidade de contato, sinais de atividade e tamanho da amostra."
          aria-label="Como o Índice de Oportunidade é calculado"
        >
          <Info size={15} />
          Como é calculado
        </span>
      </div>

      {partial && (
        <p className="opportunity-notice">
          Parte das fontes não pôde ser carregada. O ranking abaixo usa somente
          as amostras disponíveis.
        </p>
      )}
      {error && <p className="activity-inline-error">{error}</p>}

      <div className="opportunity-summary">
        <OpportunitySummaryItem label="Cidades analisadas" value={summary.cities} />
        <OpportunitySummaryItem label="Nichos analisados" value={summary.segments} />
        <OpportunitySummaryItem
          label="Empresas únicas"
          value={summary.uniqueBusinesses}
        />
        <OpportunitySummaryItem
          label="Sem site identificado"
          value={summary.withoutSiteBusinesses}
        />
      </div>

      <div className="opportunity-mode-tabs" role="tablist">
        <button
          type="button"
          className={mode === "city" ? "active" : ""}
          onClick={() => setMode("city")}
        >
          Melhores nichos por cidade
        </button>
        <button
          type="button"
          className={mode === "segment" ? "active" : ""}
          onClick={() => setMode("segment")}
        >
          Melhores cidades por nicho
        </button>
      </div>

      <div className="opportunity-filters">
        <OpportunitySelect
          label="Estado"
          value={state}
          onChange={(value) => {
            setState(value);
            setSelected(null);
          }}
          options={availableStates.map(
            (item) => [item.code, `${item.name} (${item.code})`] as [string, string],
          )}
        />

        {mode === "city" ? (
          <OpportunitySelect
            label="Cidade"
            value={city}
            onChange={setCity}
            options={cities.map((value) => [value, value] as [string, string])}
          />
        ) : (
          <OpportunitySelect
            label="Segmento"
            value={segment}
            onChange={setSegment}
            options={segments.map(
              (value) => [value, value] as [string, string],
            )}
          />
        )}

        <OpportunitySelect
          label="Índice mínimo"
          value={String(minScore)}
          onChange={(value) => setMinScore(Number(value))}
          options={[
            ["0", "Qualquer índice"],
            ["40", "40+"],
            ["60", "60+"],
            ["80", "80+"],
          ]}
        />

        <OpportunitySelect
          label="Ordenar por"
          value={sort}
          onChange={(value) => setSort(value as OpportunitySort)}
          options={[
            ["score", "Maior oportunidade"],
            ["without-site", "Mais empresas sem site"],
            ["without-site-rate", "Maior % sem site"],
            ["sample", "Maior amostra"],
            ["recent", "Mais recentes"],
          ]}
        />

        <label className="opportunity-check">
          <input
            type="checkbox"
            checked={sufficientOnly}
            onChange={(event) => setSufficientOnly(event.target.checked)}
          />
          <span>Somente amostra suficiente</span>
        </label>

        <label className="opportunity-check">
          <input
            type="checkbox"
            checked={highOnly}
            onChange={(event) => setHighOnly(event.target.checked)}
          />
          <span>Somente oportunidades altas</span>
        </label>
      </div>

      {loading ? (
        <div className="opportunity-empty">Carregando amostras existentes...</div>
      ) : ranking.length === 0 ? (
        <div className="opportunity-empty">
          <Building2 size={22} />
          <strong>
            Ainda não há dados suficientes para calcular oportunidades nesta
            região.
          </strong>
          <p>
            O ranking só aparece depois que empresas reais foram observadas nas
            pesquisas do JanuarioLeads.
          </p>
          <button className="primary-button" type="button" onClick={onGoSearch}>
            <Search size={16} />
            Buscar leads
          </button>
        </div>
      ) : (
        <div className="opportunity-ranking">
          {ranking.map((record, index) => (
            <OpportunityCard
              key={record.key}
              rank={index + 1}
              record={record}
              onOpen={() => {
                setBusinessFilter("priority");
                setSelected(record);
              }}
            />
          ))}
        </div>
      )}

      {selected && (
        <section className="opportunity-business-panel" ref={businessPanelRef}>
          <button
            className="back-button"
            type="button"
            onClick={() => {
              setSelected(null);
              setDetails(null);
            }}
          >
            <ArrowLeft size={15} />
            Voltar ao ranking
          </button>

          <div className="opportunity-business-heading">
            <div>
              <p className="eyebrow">
                {selected.city.toLocaleUpperCase("pt-BR")} · {selected.state}
              </p>
              <h2>{selected.segment}</h2>
              <p>
                Empresas que originaram esta amostra, priorizadas por ausência
                de site identificado, contato e sinais de atividade.
              </p>
            </div>
            <div>
              <strong>{selected.score}/100</strong>
              <span>{LEVEL_LABEL[selected.level]}</span>
            </div>
          </div>

          <div className="opportunity-company-filters">
            {([
              ["priority", "Maior oportunidade"],
              ["all", "Todas"],
              ["without-site", "Sem site identificado"],
              ["phone", "Com telefone"],
              ["added", "Já adicionadas"],
            ] as Array<[BusinessFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={businessFilter === value ? "active" : ""}
                onClick={() => setBusinessFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="opportunity-company-list">
            {selectedBusinesses.length === 0 ? (
              <div className="opportunity-empty compact">
                Nenhuma empresa corresponde a este filtro.
              </div>
            ) : (
              selectedBusinesses.map((business) => {
                const existingLead = findBusinessDuplicate(
                  business,
                  existingLeadIdentities,
                );
                return (
                  <article
                    className="opportunity-company-card"
                    key={business.placeId}
                  >
                    <div className="opportunity-company-main">
                      <div>
                        <h3>{business.name}</h3>
                        <p>
                          <MapPin size={13} />
                          {business.address || `${selected.city} · ${selected.state}`}
                        </p>
                      </div>
                      <div className="opportunity-company-badges">
                        {!hasIdentifiedWebsite(business) && (
                          <span>Sem site identificado</span>
                        )}
                        {hasBusinessPhone(business) && (
                          <span className="positive">Telefone disponível</span>
                        )}
                        {hasStableActivitySignal(business) && (
                          <span className="positive">Atividade identificada</span>
                        )}
                        {existingLead && <span>Já adicionado</span>}
                      </div>
                    </div>

                    <div className="opportunity-company-metrics">
                      <span>
                        <Star size={14} />
                        {business.rating?.toFixed(1) ?? "—"}
                      </span>
                      <span>
                        {business.reviewCount ?? 0} avaliações
                      </span>
                      {business.phone && (
                        <span>
                          <Phone size={13} />
                          {business.phone}
                        </span>
                      )}
                    </div>

                    <div className="opportunity-company-actions">
                      <button
                        type="button"
                        className="lead-details-button"
                        onClick={() => setDetails(business)}
                      >
                        Ver empresa
                      </button>
                      {existingLead ? (
                        <button type="button" className="added-button" disabled>
                          Já adicionado
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() =>
                            void onAddLead(business, selected.segment)
                          }
                        >
                          Adicionar aos leads
                        </button>
                      )}
                      {existingLead && hasBusinessPhone(business) && (
                        <button
                          type="button"
                          className="message-button"
                          onClick={() =>
                            onMessage({
                              ...(existingLead.id
                                ? { id: existingLead.id }
                                : {}),
                              company: business.name,
                              phone:
                                business.phone ||
                                business.internationalPhone ||
                                "",
                            })
                          }
                        >
                          <MessageCircle size={15} />
                          Enviar mensagem
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {details && (
        <BusinessDetailsModal
          business={details}
          chance={null}
          segmentLabel={selected?.segment ?? null}
          alreadyAdded={Boolean(detailsLead)}
          activityLeadId={detailsLead?.id ?? null}
          onClose={() => setDetails(null)}
          onWhatsApp={directWhatsApp}
          onMessage={(target) => onMessage(target)}
          onPresenceUpdate={(presence) => applyPresence(details, presence)}
          {...(detailsLead?.id && onDeepEnrichmentApplied
            ? {
                onDeepEnrichmentUpdate: (value: DeepEnrichmentApplied) =>
                  onDeepEnrichmentApplied(detailsLead.id!, value),
              }
            : {})}
          {...(!detailsLead && selected
            ? {
                onAdd: (business: BusinessSearchResult) =>
                  onAddLead(business, selected.segment),
              }
            : {})}
        />
      )}
    </section>
  );
}

function OpportunitySummaryItem({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OpportunitySelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="opportunity-select">
      <span>{label}</span>
      <div>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </div>
    </label>
  );
}

function OpportunityCard({
  rank,
  record,
  onOpen,
}: {
  rank: number;
  record: OpportunityRecord;
  onOpen: () => void;
}) {
  return (
    <article className="opportunity-card">
      <div className="opportunity-card-top">
        <span className="opportunity-rank">#{rank}</span>
        <div>
          <small>{record.city} · {record.state}</small>
          <h3>{record.segment}</h3>
        </div>
        {record.stale && <span className="opportunity-stale">Desatualizado</span>}
      </div>

      <div className="opportunity-score">
        <div>
          <span>Índice de oportunidade</span>
          <strong>{record.score}/100</strong>
        </div>
        <b className={`level-${record.level}`}>
          {LEVEL_LABEL[record.level]}
        </b>
      </div>

      <div className="opportunity-card-stats">
        <div>
          <strong>{record.sampleSize}</strong>
          <span>empresas analisadas</span>
        </div>
        <div>
          <strong>{record.withoutSiteCount}</strong>
          <span>sem site identificado</span>
        </div>
        <div>
          <strong>{percent(record.withoutSiteRate)}</strong>
          <span>sem site identificado</span>
        </div>
        <div>
          <strong>{record.withPhoneCount}</strong>
          <span>com telefone</span>
        </div>
        <div className="emphasis">
          <strong>{record.withoutSiteWithPhoneCount}</strong>
          <span>sem site + telefone</span>
        </div>
      </div>

      <div className="opportunity-card-footer">
        <div>
          <span>{CONFIDENCE_LABEL[record.sampleConfidence]}</span>
          <small>{formatRelative(record.lastObservedAt)}</small>
        </div>
        <button className="secondary-button" type="button" onClick={onOpen}>
          Ver empresas
        </button>
      </div>

      <details className="opportunity-reasons">
        <summary>Por que recebeu este índice?</summary>
        <ul>
          {record.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}
