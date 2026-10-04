import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  brazilClock,
  evaluateOpenNow,
  isOpenNowCacheFresh,
  isOpenState,
  type OpenNowEvaluation,
} from "../../../supabase/functions/_shared/open-now.ts";
import type { DeepEnrichmentApplied } from "../business-enrichment/types";
import type { BusinessPresence } from "../business-presence/types";
import { ChanceBadge } from "../lead-chance/ChanceBadge";
import { calculateLeadChance } from "../lead-chance/lead-chance";
import type { PersistedLead } from "../leads/remote-leads";
import { BusinessDetailsModal } from "../search-leads/BusinessDetailsModal";
import {
  findBusinessDuplicate,
  normalizeBrazilianPhone,
} from "../search-leads/identity";
import { normalizeSearchText } from "../search-leads/segments";
import type {
  BusinessSearchResult,
} from "../search-leads/types";
import type { SearchMessageTarget } from "../search-leads/SearchLeadsView";
import {
  NICHE_FAMILY_LABELS,
  OPEN_NOW_CATALOG,
  OPEN_NOW_FAMILIES,
} from "./catalog";
import {
  loadOpenNowLocation,
  loadRecentBusinessSearches,
  saveOpenNowLocation,
} from "./local-cache";
import {
  fetchOpenNowCache,
  refreshOpenNowNiche,
} from "./open-now-service";
import type {
  OpenNowBusiness,
  OpenNowNicheCache,
} from "./types";

type NicheSort = "open-desc" | "chance-desc" | "az";
type NicheFilter =
  | "all"
  | "with-whatsapp"
  | "without-site"
  | "with-instagram"
  | "without-instagram";
type CompanyFilter =
  | "all"
  | "phone"
  | "whatsapp"
  | "with-site"
  | "without-site"
  | "with-instagram"
  | "without-instagram"
  | "new"
  | "closing-soon";

type Props = {
  existingLeads: PersistedLead[];
  onAddLead: (business: BusinessSearchResult, selectedSegment: string) => void;
  onMessage: (target: SearchMessageTarget) => void;
  onGeneratePrompt: (
    business: BusinessSearchResult,
    selectedSegment: string,
  ) => void;
  onDeepEnrichmentApplied?: (
    leadId: string,
    value: DeepEnrichmentApplied,
  ) => void;
};

type OpenBusinessRow = {
  business: OpenNowBusiness;
  evaluation: OpenNowEvaluation;
  chance: ReturnType<typeof calculateLeadChance>;
  existingLead: PersistedLead | null;
  segment: string;
};

const CONCURRENCY = 4;

function mergeBusinessWithLead(
  business: OpenNowBusiness,
  lead: PersistedLead | null,
): OpenNowBusiness {
  if (!lead) return business;
  return {
    ...business,
    website: lead.website ?? business.website,
    instagram: lead.instagram ?? business.instagram,
    instagramConfidence:
      lead.instagramConfidence ?? business.instagramConfidence,
    instagramSource: lead.instagramSource ?? business.instagramSource,
    instagramCheckedAt:
      lead.instagramCheckedAt ?? business.instagramCheckedAt,
    instagramUsername:
      lead.instagramUsername ?? business.instagramUsername,
    instagramCandidates:
      lead.instagramCandidates ?? business.instagramCandidates,
    instagramRejectedUrls:
      lead.instagramRejectedUrls ?? business.instagramRejectedUrls,
    instagramSearchSignature:
      lead.instagramSearchSignature ?? business.instagramSearchSignature,
    instagramNeedsReview:
      lead.instagramNeedsReview ?? business.instagramNeedsReview,
    verifiedContent: lead.verifiedContent ?? business.verifiedContent,
    verifiedImages: lead.verifiedImages ?? business.verifiedImages,
    confirmedChannels:
      lead.confirmedChannels ?? business.confirmedChannels,
    deepEnrichmentStatus:
      lead.deepEnrichmentStatus ?? business.deepEnrichmentStatus,
    deepEnrichmentQuality:
      lead.deepEnrichmentQuality ?? business.deepEnrichmentQuality,
    deepEnrichmentCheckedAt:
      lead.deepEnrichmentCheckedAt ?? business.deepEnrichmentCheckedAt,
  };
}

function evaluationFor(
  business: OpenNowBusiness,
  cache: OpenNowNicheCache,
  now: Date,
) {
  if (business.currentOpeningHours || business.regularOpeningHours) {
    return evaluateOpenNow(
      business.currentOpeningHours,
      business.regularOpeningHours,
      now,
    );
  }

  if (!cache.stale && business.openNow) return business.openNow;

  if (!cache.stale && typeof business.isOpenNow === "boolean") {
    return {
      state: business.isOpenNow ? "OPEN" : "CLOSED",
      isOpen: business.isOpenNow,
      source: "current",
      is24Hours: false,
      closingAt: null,
      minutesUntilClose: null,
      evaluatedAt: now.toISOString(),
    } satisfies OpenNowEvaluation;
  }

  return {
    state: "UNKNOWN",
    isOpen: null,
    source: "unknown",
    is24Hours: false,
    closingAt: null,
    minutesUntilClose: null,
    evaluatedAt: now.toISOString(),
  } satisfies OpenNowEvaluation;
}

function relativeUpdatedAt(value: string | null, now: Date) {
  if (!value) return "Ainda não consultado";
  const ms = now.getTime() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "Atualização desconhecida";
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "Atualizado agora";
  if (minutes === 1) return "Atualizado há 1 min";
  if (minutes < 60) return `Atualizado há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `Atualizado há ${hours}h`;
}

function closingLabel(value: OpenNowEvaluation) {
  if (value.is24Hours) return "Aberto 24h";
  if (value.state === "CLOSING_SOON" && value.minutesUntilClose !== null) {
    return `Fecha em ${value.minutesUntilClose} min`;
  }
  if (value.closingAt) return `Fecha ${value.closingAt}`;
  return value.isOpen ? "Aberto agora" : "Horário desconhecido";
}

function hasWhatsapp(business: OpenNowBusiness) {
  return Boolean(
    business.confirmedChannels?.whatsappUrl ||
      business.phone ||
      business.internationalPhone,
  );
}

function openWhatsapp(business: OpenNowBusiness) {
  const confirmed = business.confirmedChannels?.whatsappUrl;
  if (confirmed) {
    window.open(confirmed, "_blank", "noopener,noreferrer");
    return;
  }
  const phone = normalizeBrazilianPhone(
    business.phone ?? business.internationalPhone,
  );
  if (phone) {
    window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
  }
}

function localCacheRows(city: string, state: string): OpenNowNicheCache[] {
  return loadRecentBusinessSearches(city, state).map((local) => {
    const catalog = OPEN_NOW_CATALOG.find(
      (item) => item.segment === local.segment,
    );
    const now = new Date();
    const results = local.results.map((business) => {
      const openNow = evaluateOpenNow(
        business.currentOpeningHours,
        business.regularOpeningHours,
        now,
      );
      return { ...business, openNow } as OpenNowBusiness;
    });
    const openCount = results.filter((business) =>
      business.openNow && isOpenState(business.openNow.state)
    ).length;

    return {
      segment: local.segment,
      family: catalog?.family ?? "generic_local_business",
      city,
      state,
      status: openCount > 0 ? "open_results" : "no_open_results",
      checkedAt: local.checkedAt,
      expiresAt: null,
      nextPageToken: null,
      pageCount: 1,
      requestCount: 0,
      results,
      errorCode: null,
      errorMessage: null,
      stale: !isOpenNowCacheFresh(local.checkedAt),
      local: true,
    };
  });
}

export function OpenNowNichesView({
  existingLeads,
  onAddLead,
  onMessage,
  onGeneratePrompt,
  onDeepEnrichmentApplied,
}: Props) {
  const initialLocation = useMemo(() => loadOpenNowLocation(), []);
  const [city, setCity] = useState(initialLocation.city);
  const [state, setState] = useState(initialLocation.state);
  const [draftCity, setDraftCity] = useState(initialLocation.city);
  const [draftState, setDraftState] = useState(initialLocation.state);
  const [cache, setCache] = useState<Map<string, OpenNowNicheCache>>(
    () => new Map(),
  );
  const [loadingCache, setLoadingCache] = useState(true);
  const [pageError, setPageError] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [sort, setSort] = useState<NicheSort>("open-desc");
  const [nicheFilter, setNicheFilter] = useState<NicheFilter>("all");
  const [hideZero, setHideZero] = useState(true);
  const [showUnknown, setShowUnknown] = useState(false);
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>("all");
  const [details, setDetails] = useState<{
    business: OpenNowBusiness;
    segment: string;
  } | null>(null);
  const [refreshingSegments, setRefreshingSegments] = useState<Set<string>>(
    () => new Set(),
  );
  const [globalProgress, setGlobalProgress] = useState<{
    running: boolean;
    done: number;
    total: number;
    errors: number;
  }>({ running: false, done: 0, total: 0, errors: 0 });
  const globalAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingCache(true);
    setPageError("");

    const localRows = localCacheRows(city, state);
    const localMap = new Map(localRows.map((item) => [item.segment, item]));
    setCache(localMap);

    void fetchOpenNowCache(city, state, controller.signal)
      .then((response) => {
        if (!response.ok) {
          setPageError(response.message);
          return;
        }
        setCache((current) => {
          const next = new Map(current);
          for (const row of response.niches) {
            const previous = next.get(row.segment);
            const previousTime = previous?.checkedAt
              ? new Date(previous.checkedAt).getTime()
              : 0;
            const rowTime = row.checkedAt
              ? new Date(row.checkedAt).getTime()
              : 0;
            if (!previous || rowTime >= previousTime) {
              next.set(row.segment, row);
            }
          }
          return next;
        });
      })
      .catch((error) => {
        if ((error as Error)?.name !== "AbortError") {
          setPageError("Não foi possível carregar o cache de nichos agora.");
        }
      })
      .finally(() => setLoadingCache(false));

    return () => controller.abort();
  }, [city, state]);

  const updateCache = (row: OpenNowNicheCache) => {
    setCache((current) => {
      const next = new Map(current);
      next.set(row.segment, row);
      return next;
    });
  };

  const rowsBySegment = useMemo(() => {
    const map = new Map<string, OpenBusinessRow[]>();
    for (const catalog of OPEN_NOW_CATALOG) {
      const nicheCache = cache.get(catalog.segment);
      if (!nicheCache) {
        map.set(catalog.segment, []);
        continue;
      }
      const rows = nicheCache.results.map((raw) => {
        const existingLead =
          (findBusinessDuplicate(raw, existingLeads) as PersistedLead | null) ??
          null;
        const business = mergeBusinessWithLead(raw, existingLead);
        return {
          business,
          evaluation: evaluationFor(business, nicheCache, clock),
          chance: calculateLeadChance(business, catalog.segment),
          existingLead,
          segment: catalog.segment,
        };
      });
      map.set(catalog.segment, rows);
    }
    return map;
  }, [cache, existingLeads, clock]);

  const nicheStats = useMemo(() => {
    return new Map(
      OPEN_NOW_CATALOG.map((catalog) => {
        const nicheCache = cache.get(catalog.segment);
        const rows = rowsBySegment.get(catalog.segment) ?? [];
        const openRows = rows.filter((row) => isOpenState(row.evaluation.state));
        const unknownRows = rows.filter(
          (row) => row.evaluation.state === "UNKNOWN",
        );
        const averageChance = openRows.length
          ? Math.round(
              openRows.reduce((sum, row) => sum + row.chance.score, 0) /
                openRows.length,
            )
          : 0;
        return [
          catalog.segment,
          {
            cache: nicheCache,
            openRows,
            unknownRows,
            openCount: openRows.length,
            closingSoon: openRows.filter(
              (row) => row.evaluation.state === "CLOSING_SOON",
            ).length,
            averageChance,
            withWhatsapp: openRows.filter((row) => hasWhatsapp(row.business))
              .length,
            withoutSite: openRows.filter((row) => !row.business.website).length,
            withInstagram: openRows.filter((row) => row.business.instagram).length,
            withoutInstagram: openRows.filter((row) => !row.business.instagram)
              .length,
          },
        ] as const;
      }),
    );
  }, [cache, rowsBySegment]);

  const visibleNiches = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return OPEN_NOW_CATALOG.filter((item) => {
      if (
        normalizedQuery &&
        !normalizeSearchText(item.segment).includes(normalizedQuery)
      ) {
        return false;
      }
      if (family !== "all" && item.family !== family) return false;
      const stats = nicheStats.get(item.segment)!;
      if (
        hideZero &&
        stats.cache?.status !== "not_checked" &&
        stats.cache?.status !== "checking" &&
        stats.cache?.status !== "error" &&
        stats.openCount === 0
      ) {
        return false;
      }
      if (nicheFilter === "with-whatsapp" && stats.withWhatsapp === 0) return false;
      if (nicheFilter === "without-site" && stats.withoutSite === 0) return false;
      if (nicheFilter === "with-instagram" && stats.withInstagram === 0) return false;
      if (nicheFilter === "without-instagram" && stats.withoutInstagram === 0) return false;
      return true;
    }).sort((a, b) => {
      const left = nicheStats.get(a.segment)!;
      const right = nicheStats.get(b.segment)!;
      if (sort === "open-desc") return right.openCount - left.openCount;
      if (sort === "chance-desc") return right.averageChance - left.averageChance;
      return a.segment.localeCompare(b.segment, "pt-BR");
    });
  }, [query, family, nicheFilter, hideZero, sort, nicheStats]);

  const freshCount = useMemo(
    () =>
      OPEN_NOW_CATALOG.filter((item) => {
        const value = cache.get(item.segment);
        return Boolean(value?.checkedAt && !value.stale);
      }).length,
    [cache],
  );
  const errorCount = useMemo(
    () =>
      OPEN_NOW_CATALOG.filter(
        (item) => cache.get(item.segment)?.status === "error",
      ).length,
    [cache],
  );
  const lastUpdated = useMemo(() => {
    const times = Array.from(cache.values())
      .map((item) => item.checkedAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
  }, [cache]);

  const familySummary = useMemo(() => {
    return OPEN_NOW_FAMILIES.map((familyKey) => {
      const entries = OPEN_NOW_CATALOG.filter((item) => item.family === familyKey);
      const checked = entries.filter((item) => {
        const value = cache.get(item.segment);
        return Boolean(value?.checkedAt && !value.stale);
      });
      const open = checked.reduce(
        (sum, item) => sum + (nicheStats.get(item.segment)?.openCount ?? 0),
        0,
      );
      return {
        family: familyKey,
        label: NICHE_FAMILY_LABELS[familyKey],
        checked: checked.length,
        total: entries.length,
        open,
      };
    }).filter((item) => item.checked > 0);
  }, [cache, nicheStats]);

  const prospectNow = useMemo(() => {
    const unique = new Map<string, OpenBusinessRow>();
    for (const item of OPEN_NOW_CATALOG) {
      const nicheCache = cache.get(item.segment);
      if (!nicheCache || nicheCache.stale) continue;
      for (const row of nicheStats.get(item.segment)?.openRows ?? []) {
        if (!hasWhatsapp(row.business) && !row.business.phone) continue;
        const previous = unique.get(row.business.placeId);
        if (!previous || row.chance.score > previous.chance.score) {
          unique.set(row.business.placeId, row);
        }
      }
    }
    return Array.from(unique.values())
      .sort((a, b) => b.chance.score - a.chance.score)
      .slice(0, 8);
  }, [cache, nicheStats]);

  async function refreshOne(
    segment: string,
    options: { force?: boolean; pageToken?: string | null; signal?: AbortSignal } = {},
  ) {
    setRefreshingSegments((current) => new Set(current).add(segment));
    try {
      const response = await refreshOpenNowNiche(
        {
          city,
          state,
          segment,
          force: options.force,
          pageToken: options.pageToken,
        },
        options.signal,
      );
      if (response.cache) updateCache(response.cache);
      if (!response.ok) {
        if (response.code !== "COOLDOWN" && response.code !== "ALREADY_REFRESHING") {
          throw new Error(response.message);
        }
        return false;
      }
      return true;
    } finally {
      setRefreshingSegments((current) => {
        const next = new Set(current);
        next.delete(segment);
        return next;
      });
    }
  }

  async function runGlobalRefresh(onlyErrors = false) {
    if (globalProgress.running) return;
    const segments = OPEN_NOW_CATALOG.filter((item) => {
      const value = cache.get(item.segment);
      if (onlyErrors) return value?.status === "error";
      return !value?.checkedAt || value.stale || value.status === "error";
    }).map((item) => item.segment);

    if (!segments.length) return;

    const controller = new AbortController();
    globalAbort.current = controller;
    setGlobalProgress({
      running: true,
      done: 0,
      total: segments.length,
      errors: 0,
    });

    let cursor = 0;
    const worker = async () => {
      while (!controller.signal.aborted) {
        const index = cursor;
        cursor += 1;
        if (index >= segments.length) break;
        let ok = false;
        try {
          ok = await refreshOne(segments[index], {
            signal: controller.signal,
          });
        } catch (error) {
          if ((error as Error)?.name === "AbortError") break;
        }
        setGlobalProgress((current) => ({
          ...current,
          done: current.done + 1,
          errors: current.errors + (ok ? 0 : 1),
        }));
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENCY, segments.length) },
        () => worker(),
      ),
    );

    setGlobalProgress((current) => ({ ...current, running: false }));
    globalAbort.current = null;
  }

  function cancelGlobalRefresh() {
    globalAbort.current?.abort();
    globalAbort.current = null;
    setGlobalProgress((current) => ({ ...current, running: false }));
  }

  function applyLocation() {
    const nextCity = draftCity.trim();
    const nextState = draftState.trim().toUpperCase();
    if (nextCity.length < 2 || !/^[A-Z]{2}$/.test(nextState)) {
      setPageError("Informe uma cidade e UF válidas.");
      return;
    }
    saveOpenNowLocation(nextCity, nextState);
    setCity(nextCity);
    setState(nextState);
    setExpandedSegment(null);
    setPageError("");
  }

  function patchBusiness(placeId: string, patch: Partial<OpenNowBusiness>) {
    setCache((current) => {
      const next = new Map(current);
      for (const [segment, nicheCache] of next) {
        const results = nicheCache.results.map((business) =>
          business.placeId === placeId ? { ...business, ...patch } : business,
        );
        next.set(segment, { ...nicheCache, results });
      }
      return next;
    });
    setDetails((current) =>
      current?.business.placeId === placeId
        ? { ...current, business: { ...current.business, ...patch } }
        : current,
    );
  }

  function applyPresence(
    business: OpenNowBusiness,
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

  function applyDeep(
    row: { business: OpenNowBusiness; existingLead: PersistedLead | null },
    value: DeepEnrichmentApplied,
  ) {
    patchBusiness(row.business.placeId, {
      verifiedContent: value.verifiedContent,
      verifiedImages: value.verifiedImages,
      confirmedChannels: value.confirmedChannels,
      deepEnrichmentStatus: value.status,
      deepEnrichmentQuality: value.quality,
      deepEnrichmentCheckedAt: value.checkedAt,
      ...(value.identityUpdates.website
        ? { website: value.identityUpdates.website }
        : {}),
      ...(value.identityUpdates.instagram
        ? {
            instagram: value.identityUpdates.instagram,
            instagramConfidence: "high",
            instagramSource: "official_website",
          }
        : {}),
    });
    if (row.existingLead?.id) {
      onDeepEnrichmentApplied?.(row.existingLead.id, value);
    }
  }

  const expandedStats = expandedSegment
    ? nicheStats.get(expandedSegment)
    : null;
  const expandedRows = useMemo(() => {
    if (!expandedSegment) return [] as OpenBusinessRow[];
    const stats = nicheStats.get(expandedSegment);
    if (!stats) return [];
    const base = showUnknown
      ? [...stats.openRows, ...stats.unknownRows]
      : stats.openRows;
    return base
      .filter((row) => {
        const business = row.business;
        if (companyFilter === "phone") return Boolean(business.phone || business.internationalPhone);
        if (companyFilter === "whatsapp") return hasWhatsapp(business);
        if (companyFilter === "with-site") return Boolean(business.website);
        if (companyFilter === "without-site") return !business.website;
        if (companyFilter === "with-instagram") return Boolean(business.instagram);
        if (companyFilter === "without-instagram") return !business.instagram;
        if (companyFilter === "new") return !row.existingLead;
        if (companyFilter === "closing-soon") return row.evaluation.state === "CLOSING_SOON";
        return true;
      })
      .sort((a,b)=>b.chance.score-a.chance.score);
  }, [expandedSegment, nicheStats, companyFilter, showUnknown]);

  return (
    <section className="page-wrap open-now-page">
      <header className="open-now-heading">
        <div>
          <p className="eyebrow">PROSPECÇÃO EM TEMPO REAL</p>
          <h1>Nichos abertos agora</h1>
          <p className="subtitle">
            Encontre empresas funcionando neste momento e aproveite a disponibilidade
            real para entrar no fluxo de prospecção.
          </p>
        </div>
        <div className="open-now-clock">
          <span>Horário de Brasília</span>
          <strong>{brazilClock(clock)}</strong>
          <small>America/Sao_Paulo</small>
        </div>
      </header>

      <section className="open-now-control-panel">
        <div className="open-now-location">
          <label>
            <span>Cidade</span>
            <input
              value={draftCity}
              onChange={(event)=>setDraftCity(event.target.value)}
              placeholder="Lavras"
            />
          </label>
          <label className="open-now-state-input">
            <span>UF</span>
            <input
              value={draftState}
              maxLength={2}
              onChange={(event)=>setDraftState(event.target.value.toUpperCase())}
              placeholder="MG"
            />
          </label>
          <button className="secondary-button" type="button" onClick={applyLocation}>
            Aplicar
          </button>
        </div>

        <div className="open-now-coverage">
          <div>
            <strong>{freshCount}/{OPEN_NOW_CATALOG.length}</strong>
            <span>nichos atualizados</span>
          </div>
          <div>
            <strong>{errorCount}</strong>
            <span>com erro</span>
          </div>
          <div>
            <strong>{lastUpdated ? relativeUpdatedAt(lastUpdated,clock).replace("Atualizado ","") : "—"}</strong>
            <span>última atualização</span>
          </div>
        </div>

        <div className="open-now-refresh-actions">
          {globalProgress.running ? (
            <>
              <span className="open-now-progress">
                <Loader2 size={14} className="auth-spinner" />
                Atualizando {globalProgress.done}/{globalProgress.total}
              </span>
              <button className="secondary-button" type="button" onClick={cancelGlobalRefresh}>
                <Square size={13} />
                Cancelar
              </button>
            </>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={()=>void runGlobalRefresh(false)}
            >
              <RefreshCw size={15} />
              Atualizar nichos abertos
            </button>
          )}
          {!globalProgress.running && errorCount > 0 && (
            <button className="secondary-button" type="button" onClick={()=>void runGlobalRefresh(true)}>
              Tentar novamente erros
            </button>
          )}
        </div>
      </section>

      {pageError && (
        <p className="activity-inline-error" role="status">{pageError}</p>
      )}

      {familySummary.length > 0 && (
        <section className="open-now-family-summary" aria-label="Resumo por família">
          {familySummary.map((item)=>(
            <button
              key={item.family}
              type="button"
              onClick={()=>setFamily(item.family)}
              className={family===item.family ? "active" : ""}
            >
              <span>{item.label}</span>
              <strong>{item.open}</strong>
              <small>{item.checked}/{item.total} nichos atuais</small>
            </button>
          ))}
        </section>
      )}

      {prospectNow.length > 0 && (
        <section className="prospect-now">
          <div className="open-now-section-heading">
            <div>
              <span>PROSPECTAR AGORA</span>
              <h2>Oportunidades abertas neste momento</h2>
            </div>
            <small>Ordenadas pela Chance existente. Nenhum score novo é criado.</small>
          </div>
          <div className="prospect-now-list">
            {prospectNow.map((row,index)=>(
              <article key={row.business.placeId}>
                <span className="prospect-rank">{String(index+1).padStart(2,"0")}</span>
                <div className="prospect-company">
                  <strong>{row.business.name}</strong>
                  <small>{row.segment}</small>
                </div>
                <ChanceBadge chance={row.chance} />
                <div className={`open-now-status ${row.evaluation.state.toLowerCase()}`}>
                  <span className="open-now-dot" />
                  <span>{closingLabel(row.evaluation)}</span>
                </div>
                <div className="prospect-actions">
                  {hasWhatsapp(row.business) && (
                    <button type="button" onClick={()=>openWhatsapp(row.business)}>
                      <MessageCircle size={14} />
                      WhatsApp
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={()=>setDetails({business:row.business,segment:row.segment})}
                  >
                    Ver empresa
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="open-now-catalog-section">
        <div className="open-now-section-heading">
          <div>
            <span>TODOS OS NICHOS</span>
            <h2>{city}, {state}</h2>
          </div>
          <small>
            Abrir esta página não consulta o Google. Atualizações são explícitas,
            progressivas e cacheadas por 15 minutos.
          </small>
        </div>

        <div className="open-now-toolbar">
          <label className="open-now-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event)=>setQuery(event.target.value)}
              placeholder="Buscar nicho..."
              aria-label="Buscar nicho"
            />
          </label>

          <label className="select-wrap">
            <select
              value={sort}
              onChange={(event)=>setSort(event.target.value as NicheSort)}
              aria-label="Ordenar nichos"
            >
              <option value="open-desc">Mais empresas abertas</option>
              <option value="chance-desc">Maior Chance média</option>
              <option value="az">Nome A–Z</option>
            </select>
            <ChevronDown size={15} />
          </label>

          <label className="open-now-toggle">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(event)=>setHideZero(event.target.checked)}
            />
            Ocultar sem resultados
          </label>
        </div>

        <div className="open-now-filter-row">
          <button
            type="button"
            className={family==="all" ? "active" : ""}
            onClick={()=>setFamily("all")}
          >
            Todas as famílias
          </button>
          {OPEN_NOW_FAMILIES.map((item)=>(
            <button
              key={item}
              type="button"
              className={family===item ? "active" : ""}
              onClick={()=>setFamily(item)}
            >
              {NICHE_FAMILY_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="open-now-filter-row compact">
          {([
            ["all","Todos"],
            ["with-whatsapp","Com WhatsApp"],
            ["without-site","Sem site"],
            ["with-instagram","Com Instagram"],
            ["without-instagram","Sem Instagram"],
          ] as Array<[NicheFilter,string]>).map(([value,label])=>(
            <button
              key={value}
              type="button"
              className={nicheFilter===value ? "active" : ""}
              onClick={()=>setNicheFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingCache && cache.size === 0 ? (
          <div className="open-now-loading">
            <Loader2 size={18} className="auth-spinner" />
            Carregando cache recente...
          </div>
        ) : (
          <div className="open-now-niche-grid">
            {visibleNiches.map((item)=>{
              const stats=nicheStats.get(item.segment)!;
              const nicheCache=stats.cache;
              const refreshing=refreshingSegments.has(item.segment);
              const status=nicheCache?.status ?? "not_checked";
              return (
                <article
                  className={`open-now-niche-card ${status}`}
                  key={item.segment}
                >
                  <div className="open-now-niche-top">
                    <div>
                      <small>{item.familyLabel}</small>
                      <h3>{item.segment}</h3>
                    </div>
                    {nicheCache?.stale && nicheCache.checkedAt && (
                      <span className="open-now-stale">Desatualizado</span>
                    )}
                  </div>

                  <div className="open-now-main-number">
                    {refreshing || status==="checking" ? (
                      <>
                        <Loader2 size={15} className="auth-spinner" />
                        <strong>Consultando...</strong>
                      </>
                    ) : status==="error" ? (
                      <>
                        <AlertCircle size={15} />
                        <strong>Erro ao atualizar</strong>
                      </>
                    ) : !nicheCache?.checkedAt ? (
                      <strong>Ainda não consultado</strong>
                    ) : stats.openCount > 0 ? (
                      <>
                        <strong>{stats.openCount}</strong>
                        <span>abertas agora</span>
                      </>
                    ) : (
                      <strong>Nenhuma aberta encontrada</strong>
                    )}
                  </div>

                  {nicheCache?.checkedAt && (
                    <div className="open-now-niche-stats">
                      <span>Fechando em breve <b>{stats.closingSoon}</b></span>
                      <span>Chance média <b>{stats.averageChance || "—"}</b></span>
                      <span>Com WhatsApp <b>{stats.withWhatsapp}</b></span>
                      <span>Sem site <b>{stats.withoutSite}</b></span>
                    </div>
                  )}

                  <div className="open-now-niche-meta">
                    <span>{relativeUpdatedAt(nicheCache?.checkedAt ?? null,clock)}</span>
                    {nicheCache?.pageCount ? (
                      <span>
                        {nicheCache.pageCount} {nicheCache.pageCount===1 ? "página consultada" : "páginas consultadas"}
                      </span>
                    ) : null}
                  </div>

                  <div className="open-now-niche-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={refreshing}
                      onClick={()=>void refreshOne(item.segment,{force:true})}
                    >
                      <RefreshCw size={13} />
                      Atualizar
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!nicheCache?.checkedAt}
                      onClick={()=>{
                        setExpandedSegment(item.segment);
                        setCompanyFilter("all");
                      }}
                    >
                      Ver empresas
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {expandedSegment && expandedStats && (
        <section className="open-now-business-panel">
          <div className="open-now-business-heading">
            <div>
              <span>{expandedSegment.toUpperCase()}</span>
              <h2>{expandedStats.openCount} abertas agora</h2>
              <p>
                {expandedStats.cache?.nextPageToken
                  ? "Há mais resultados do Google disponíveis para este nicho."
                  : "Resultados atualmente consultados para este nicho."}
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={()=>setExpandedSegment(null)}
            >
              Fechar lista
            </button>
          </div>

          <div className="open-now-filter-row compact">
            {([
              ["all","Todos"],
              ["phone","Com telefone"],
              ["whatsapp","Com WhatsApp"],
              ["with-site","Com site"],
              ["without-site","Sem site"],
              ["with-instagram","Com Instagram"],
              ["without-instagram","Sem Instagram"],
              ["new","Somente novos"],
              ["closing-soon","Fecha em breve"],
            ] as Array<[CompanyFilter,string]>).map(([value,label])=>(
              <button
                key={value}
                type="button"
                className={companyFilter===value ? "active" : ""}
                onClick={()=>setCompanyFilter(value)}
              >
                {label}
              </button>
            ))}
            <label className="open-now-toggle inline">
              <input
                type="checkbox"
                checked={showUnknown}
                onChange={(event)=>setShowUnknown(event.target.checked)}
              />
              Mostrar horários desconhecidos
            </label>
          </div>

          <div className="open-now-business-list">
            {expandedRows.length ? expandedRows.map((row)=>(
              <article key={row.business.placeId} className="open-now-business-row">
                <div className="open-now-business-name">
                  <div>
                    <strong>{row.business.name}</strong>
                    <ChanceBadge chance={row.chance} />
                  </div>
                  <span>{row.business.neighborhood ?? row.business.address ?? city}</span>
                </div>
                <div className={`open-now-status ${row.evaluation.state.toLowerCase()}`}>
                  <span className="open-now-dot" />
                  <div>
                    <strong>
                      {row.evaluation.state==="UNKNOWN" ? "Horário desconhecido" : "Aberto agora"}
                    </strong>
                    <small>{closingLabel(row.evaluation)}</small>
                  </div>
                </div>
                <div className="open-now-business-proof">
                  <strong>
                    {row.business.rating !== null
                      ? row.business.rating.toFixed(1).replace(".",",")
                      : "—"}
                  </strong>
                  <span>
                    {row.business.reviewCount !== null
                      ? `${row.business.reviewCount} avaliações`
                      : "Sem avaliações"}
                  </span>
                </div>
                <div className="open-now-business-actions">
                  {hasWhatsapp(row.business) && (
                    <button type="button" onClick={()=>openWhatsapp(row.business)}>
                      WhatsApp
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={()=>setDetails({business:row.business,segment:row.segment})}
                  >
                    Ver empresa
                  </button>
                  <button
                    type="button"
                    onClick={()=>onGeneratePrompt(row.business,row.segment)}
                  >
                    <Sparkles size={13} />
                    Gerar prompt
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(row.existingLead)}
                    onClick={()=>onAddLead(row.business,row.segment)}
                  >
                    {row.existingLead ? (
                      <>
                        <Check size={13} />
                        Já adicionado
                      </>
                    ) : "Adicionar aos meus leads"}
                  </button>
                </div>
              </article>
            )) : (
              <div className="open-now-empty-list">
                Nenhuma empresa corresponde aos filtros atuais.
              </div>
            )}
          </div>

          {expandedStats.cache?.nextPageToken && (
            <div className="open-now-load-more">
              <button
                className="secondary-button"
                type="button"
                disabled={refreshingSegments.has(expandedSegment)}
                onClick={()=>void refreshOne(expandedSegment,{
                  pageToken:expandedStats.cache?.nextPageToken,
                })}
              >
                {refreshingSegments.has(expandedSegment)
                  ? "Carregando..."
                  : "Carregar mais empresas"}
              </button>
            </div>
          )}
        </section>
      )}

      {details && (() => {
        const existingLead =
          (findBusinessDuplicate(details.business, existingLeads) as PersistedLead | null) ??
          null;
        const chance = calculateLeadChance(details.business,details.segment);
        const row = {
          business:details.business,
          existingLead,
        };
        return (
          <BusinessDetailsModal
            business={details.business}
            chance={chance}
            segmentLabel={details.segment}
            alreadyAdded={Boolean(existingLead)}
            activityLeadId={existingLead?.id ?? null}
            onClose={()=>setDetails(null)}
            onWhatsApp={openWhatsapp}
            onMessage={onMessage}
            onGeneratePrompt={(business)=>onGeneratePrompt(business,details.segment)}
            onPresenceUpdate={(presence)=>applyPresence(details.business,presence)}
            onDeepEnrichmentUpdate={(value)=>applyDeep(row,value)}
            onAdd={(business)=>onAddLead(business,details.segment)}
          />
        );
      })()}
    </section>
  );
}
