import { safeExternalHref } from "../../lib/safe-external-url";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./open-now.css";
import {
  brazilClock,
  evaluateOpenNow,
  isOpenNowCacheFresh,
  isOpenState,
  type OpenNowEvaluation,
} from "../../../supabase/functions/_shared/open-now.ts";
import type { BusinessPresence } from "../business-presence/types";
import { ChanceBadge } from "../lead-chance/ChanceBadge";
import { calculateLeadChance } from "../lead-chance/lead-chance";
import type { PersistedLead } from "../leads/remote-leads";
import { BusinessDetailsModal } from "../search-leads/BusinessDetailsModal";
import { findBusinessDuplicate, normalizeBrazilianPhone } from "../search-leads/identity";
import { normalizeSearchText, searchSegmentMatchesQuery } from "../search-leads/segments";
import type { BusinessSearchResult } from "../search-leads/types";
import type { SearchMessageTarget } from "../search-leads/SearchLeadsView";
import { NICHE_FAMILY_LABELS, OPEN_NOW_CATALOG, OPEN_NOW_FAMILIES } from "./catalog";
import {
  loadOpenNowLocation,
  loadRecentBusinessSearches,
  saveOpenNowLocation,
} from "./local-cache";
import {
  fetchOpenNowCache,
  OpenNowServiceError,
  openNowServiceErrorMessage,
  refreshOpenNowNiche,
} from "./open-now-service";
import type { OpenNowBusiness, OpenNowNicheCache } from "./types";
import { openWhatsAppLink } from "../../lib/whatsapp";
import {
  BRAZIL_STATES,
  DEFAULT_BRAZIL_STATE,
  findBrazilianState,
} from "../../lib/brazil-locations";
import {
  loadBrazilianMunicipalities,
  resolveMunicipality,
  withSearchLocation,
} from "../search-leads/search-location";

type NicheSort = "open-desc" | "chance-desc" | "az";
type NicheFilter =
  "all" | "with-whatsapp" | "without-site" | "with-instagram" | "without-instagram";
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
  onPresenceDiscovered?: (leadId: string, presence: BusinessPresence) => void;
};

type OpenBusinessRow = {
  business: OpenNowBusiness;
  evaluation: OpenNowEvaluation;
  chance: ReturnType<typeof calculateLeadChance>;
  existingLead: PersistedLead | null;
  segment: string;
};

const GLOBAL_REFRESH_INTERVAL_MS = 1_250;
const GLOBAL_STOP_CODES = new Set(["GOOGLE_QUOTA", "RATE_LIMIT", "RATE_LIMIT_CHECK_FAILED"]);

function mergeBusinessWithLead(
  business: OpenNowBusiness,
  lead: PersistedLead | null,
): OpenNowBusiness {
  if (!lead) return business;
  return {
    ...business,
    website: lead.website ?? business.website,
    instagram: lead.instagram ?? business.instagram,
    instagramConfidence: lead.instagramConfidence ?? business.instagramConfidence,
    instagramSource: lead.instagramSource ?? business.instagramSource,
    instagramCheckedAt: lead.instagramCheckedAt ?? business.instagramCheckedAt,
    instagramUsername: lead.instagramUsername ?? business.instagramUsername,
    instagramDisplayName: lead.instagramDisplayName ?? business.instagramDisplayName,
    instagramCandidates: lead.instagramCandidates ?? business.instagramCandidates,
    instagramRejectedUrls: lead.instagramRejectedUrls ?? business.instagramRejectedUrls,
    instagramSearchSignature: lead.instagramSearchSignature ?? business.instagramSearchSignature,
    instagramNeedsReview: lead.instagramNeedsReview ?? business.instagramNeedsReview,
    verifiedContent: lead.verifiedContent ?? business.verifiedContent,
    verifiedImages: lead.verifiedImages ?? business.verifiedImages,
    confirmedChannels: lead.confirmedChannels ?? business.confirmedChannels,
    deepEnrichmentStatus: lead.deepEnrichmentStatus ?? business.deepEnrichmentStatus,
    deepEnrichmentQuality: lead.deepEnrichmentQuality ?? business.deepEnrichmentQuality,
    deepEnrichmentCheckedAt: lead.deepEnrichmentCheckedAt ?? business.deepEnrichmentCheckedAt,
  };
}

function cacheIsStale(cache: OpenNowNicheCache | undefined, now: Date) {
  return !cache?.checkedAt || !isOpenNowCacheFresh(cache.checkedAt, now);
}

function hasStructuredPeriods(business: OpenNowBusiness) {
  return Boolean(
    business.currentOpeningHours?.periods?.length || business.regularOpeningHours?.periods?.length,
  );
}

function evaluationFor(business: OpenNowBusiness, cache: OpenNowNicheCache, now: Date) {
  const stale = cacheIsStale(cache, now);

  if (hasStructuredPeriods(business)) {
    return evaluateOpenNow(business.currentOpeningHours, business.regularOpeningHours, now, {
      preferReportedOpenNow: false,
    });
  }

  // A point-in-time openNow boolean is only trustworthy inside the short TTL.
  // Without structured periods we cannot advance it safely with the clock.
  if (stale) {
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

  if (business.openNow) return business.openNow;

  if (!stale && typeof business.isOpenNow === "boolean") {
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
    business.confirmedChannels?.whatsappUrl || business.phone || business.internationalPhone,
  );
}

function openWhatsapp(business: BusinessSearchResult) {
  const phone = normalizeBrazilianPhone(business.phone ?? business.internationalPhone);
  if (phone && openWhatsAppLink({ phone })) return;

  const confirmed = business.confirmedChannels?.whatsappUrl;
  if (confirmed) {
    const href = safeExternalHref(confirmed);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }
}

function localCacheRows(city: string, state: string): OpenNowNicheCache[] {
  return loadRecentBusinessSearches(city, state).map((local) => {
    const catalog = OPEN_NOW_CATALOG.find((item) => item.segment === local.segment);
    const now = new Date();
    const results = local.results.map((business) => {
      const openNow = evaluateOpenNow(
        business.currentOpeningHours,
        business.regularOpeningHours,
        now,
        { preferReportedOpenNow: false },
      );
      return { ...business, openNow } as OpenNowBusiness;
    });
    const openCount = results.filter(
      (business) => business.openNow && isOpenState(business.openNow.state),
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
  onPresenceDiscovered,
}: Props) {
  const initialLocation = useMemo(() => loadOpenNowLocation(), []);
  const [city, setCity] = useState(initialLocation.city);
  const [state, setState] = useState(initialLocation.state);
  const [draftCity, setDraftCity] = useState(initialLocation.city);
  const [draftState, setDraftState] = useState(initialLocation.state);
  const draftStateInfo = findBrazilianState(draftState) ?? DEFAULT_BRAZIL_STATE;
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(true);
  const [municipalitiesError, setMunicipalitiesError] = useState("");
  const [cache, setCache] = useState<Map<string, OpenNowNicheCache>>(() => new Map());
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
  const [refreshingSegments, setRefreshingSegments] = useState<Set<string>>(() => new Set());
  const [globalProgress, setGlobalProgress] = useState<{
    running: boolean;
    done: number;
    total: number;
    errors: number;
  }>({ running: false, done: 0, total: 0, errors: 0 });
  const globalAbort = useRef<AbortController | null>(null);
  const businessPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setMunicipalities([]);
    setMunicipalitiesLoading(true);
    setMunicipalitiesError("");

    void loadBrazilianMunicipalities(draftStateInfo.code, controller.signal)
      .then(setMunicipalities)
      .catch((error) => {
        if ((error as Error)?.name !== "AbortError") {
          setMunicipalitiesError(
            `Não foi possível carregar os municípios de ${draftStateInfo.name} agora.`,
          );
        }
      })
      .finally(() => setMunicipalitiesLoading(false));

    return () => controller.abort();
  }, [draftStateInfo.code, draftStateInfo.name]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      globalAbort.current?.abort();
      globalAbort.current = null;
    };
  }, []);

  useEffect(() => {
    if (!expandedSegment) return;

    const frame = window.requestAnimationFrame(() => {
      businessPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expandedSegment]);

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
            const previousTime = previous?.checkedAt ? new Date(previous.checkedAt).getTime() : 0;
            const rowTime = row.checkedAt ? new Date(row.checkedAt).getTime() : 0;
            if (!previous || rowTime >= previousTime) {
              next.set(row.segment, row);
            }
          }
          return next;
        });
      })
      .catch((error) => {
        if ((error as Error)?.name !== "AbortError") {
          setPageError(openNowServiceErrorMessage(error));
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
          (findBusinessDuplicate(raw, existingLeads) as PersistedLead | null) ?? null;
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
        const unknownRows = rows.filter((row) => row.evaluation.state === "UNKNOWN");
        const averageChance = openRows.length
          ? Math.round(openRows.reduce((sum, row) => sum + row.chance.score, 0) / openRows.length)
          : 0;
        return [
          catalog.segment,
          {
            cache: nicheCache,
            openRows,
            unknownRows,
            openCount: openRows.length,
            closingSoon: openRows.filter((row) => row.evaluation.state === "CLOSING_SOON").length,
            averageChance,
            withWhatsapp: openRows.filter((row) => hasWhatsapp(row.business)).length,
            withoutSite: openRows.filter((row) => !row.business.website).length,
            withInstagram: openRows.filter((row) => row.business.instagram).length,
            withoutInstagram: openRows.filter((row) => !row.business.instagram).length,
          },
        ] as const;
      }),
    );
  }, [cache, rowsBySegment]);

  const visibleNiches = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return OPEN_NOW_CATALOG.filter((item) => {
      if (normalizedQuery && !searchSegmentMatchesQuery(item.segment, normalizedQuery)) {
        return false;
      }
      if (family !== "all" && item.family !== family) return false;
      const stats = nicheStats.get(item.segment)!;
      if (
        hideZero &&
        Boolean(stats.cache?.checkedAt) &&
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
        return Boolean(value?.checkedAt && isOpenNowCacheFresh(value.checkedAt, clock));
      }).length,
    [cache, clock],
  );
  const errorCount = useMemo(
    () => OPEN_NOW_CATALOG.filter((item) => cache.get(item.segment)?.status === "error").length,
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
        return Boolean(value?.checkedAt && isOpenNowCacheFresh(value.checkedAt, clock));
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
  }, [cache, nicheStats, clock]);

  const prospectNow = useMemo(() => {
    const unique = new Map<string, OpenBusinessRow>();
    for (const item of OPEN_NOW_CATALOG) {
      const nicheCache = cache.get(item.segment);
      if (!nicheCache || cacheIsStale(nicheCache, clock)) continue;
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
  }, [cache, nicheStats, clock]);

  async function refreshOne(
    segment: string,
    options: {
      force?: boolean | undefined;
      pageToken?: string | null | undefined;
      signal?: AbortSignal;
      silent?: boolean;
    } = {},
  ): Promise<{ ok: boolean; code?: string; message?: string }> {
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
        if (!options.silent) setPageError(response.message);
        return {
          ok: false,
          code: response.code,
          message: response.message,
        };
      }
      if (!options.silent) setPageError("");
      return { ok: true };
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        return { ok: false, code: "ABORTED" };
      }

      const message = openNowServiceErrorMessage(error);
      if (!options.silent) setPageError(message);

      return {
        ok: false,
        code: error instanceof OpenNowServiceError ? error.code : "REQUEST_FAILED",
        message,
      };
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
      return !value?.checkedAt || cacheIsStale(value, clock) || value.status === "error";
    }).map((item) => item.segment);

    if (!segments.length) return;

    const controller = new AbortController();
    globalAbort.current = controller;
    setPageError("");
    setGlobalProgress({
      running: true,
      done: 0,
      total: segments.length,
      errors: 0,
    });

    for (let index = 0; index < segments.length; index += 1) {
      if (controller.signal.aborted) break;

      const result = await refreshOne(segments[index]!, {
        signal: controller.signal,
        silent: true,
      });

      setGlobalProgress((current) => ({
        ...current,
        done: current.done + 1,
        errors: current.errors + (result.ok ? 0 : 1),
      }));

      if (!result.ok && result.code && GLOBAL_STOP_CODES.has(result.code)) {
        setPageError(
          result.message ?? "A atualização global foi pausada por um limite temporário.",
        );
        break;
      }

      if (index < segments.length - 1 && !controller.signal.aborted) {
        await new Promise((resolve) => window.setTimeout(resolve, GLOBAL_REFRESH_INTERVAL_MS));
      }
    }

    setGlobalProgress((current) => ({ ...current, running: false }));
    globalAbort.current = null;
  }

  function cancelGlobalRefresh() {
    globalAbort.current?.abort();
    globalAbort.current = null;
    setGlobalProgress((current) => ({ ...current, running: false }));
  }

  function applyLocation() {
    const nextState = findBrazilianState(draftState);
    const canonicalCity = resolveMunicipality(draftCity, municipalities);
    const allowCachedCurrentCity =
      Boolean(municipalitiesError) &&
      draftCity.trim().localeCompare(city, "pt-BR", { sensitivity: "base" }) === 0 &&
      nextState?.code === state;

    const nextCity = canonicalCity ?? (allowCachedCurrentCity ? city : "");
    if (!nextState || !nextCity) {
      setPageError(`Selecione uma cidade válida de ${draftStateInfo.name}.`);
      return;
    }

    saveOpenNowLocation(nextCity, nextState.code);
    setDraftCity(nextCity);
    setCity(nextCity);
    setState(nextState.code);
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

  function applyPresence(business: OpenNowBusiness, presence: BusinessPresence) {
    patchBusiness(business.placeId, {
      instagram: presence.instagramUrl,
      instagramConfidence: presence.instagramConfidence,
      instagramSource: presence.instagramSource,
      instagramCheckedAt: presence.instagramCheckedAt,
      instagramUsername: presence.instagramUsername,
      instagramDisplayName: presence.instagramDisplayName ?? null,
      instagramCandidates: presence.instagramCandidates,
      instagramRejectedUrls: presence.instagramRejectedUrls,
      instagramSearchSignature: presence.instagramSearchSignature,
      instagramNeedsReview: presence.instagramNeedsReview,
    });
  }

  const expandedStats = expandedSegment ? nicheStats.get(expandedSegment) : null;
  const expandedRows = useMemo(() => {
    if (!expandedSegment) return [] as OpenBusinessRow[];
    const stats = nicheStats.get(expandedSegment);
    if (!stats) return [];
    const base = showUnknown ? [...stats.openRows, ...stats.unknownRows] : stats.openRows;
    return base
      .filter((row) => {
        const business = row.business;
        if (companyFilter === "phone")
          return Boolean(business.phone || business.internationalPhone);
        if (companyFilter === "whatsapp") return hasWhatsapp(business);
        if (companyFilter === "with-site") return Boolean(business.website);
        if (companyFilter === "without-site") return !business.website;
        if (companyFilter === "with-instagram") return Boolean(business.instagram);
        if (companyFilter === "without-instagram") return !business.instagram;
        if (companyFilter === "new") return !row.existingLead;
        if (companyFilter === "closing-soon") return row.evaluation.state === "CLOSING_SOON";
        return true;
      })
      .sort((a, b) => b.chance.score - a.chance.score);
  }, [expandedSegment, nicheStats, companyFilter, showUnknown]);

  return (
    <section className="page-wrap open-now-page">
      <header className="open-now-heading">
        <div>
          <p className="eyebrow">OPERAÇÃO COMERCIAL</p>
          <h1>Abertos agora</h1>
          <p className="subtitle">
            Acompanhe nichos e empresas funcionando neste momento na localização selecionada.
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
          <label className="open-now-state-input">
            <span>Estado</span>
            <select
              value={draftStateInfo.code}
              onChange={(event) => {
                setDraftState(event.target.value);
                setDraftCity("");
                setMunicipalities([]);
                setMunicipalitiesError("");
              }}
              aria-label="Estado"
            >
              {BRAZIL_STATES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Cidade</span>
            <input
              list={`open-now-city-options-${draftStateInfo.code}`}
              value={draftCity}
              onChange={(event) => setDraftCity(event.target.value)}
              onBlur={() => {
                const canonical = resolveMunicipality(draftCity, municipalities);
                if (canonical) setDraftCity(canonical);
              }}
              placeholder={
                municipalitiesLoading
                  ? "Carregando municípios..."
                  : `Município de ${draftStateInfo.name}`
              }
              autoComplete="off"
            />
            <datalist id={`open-now-city-options-${draftStateInfo.code}`}>
              {municipalities.map((municipality) => (
                <option key={municipality} value={municipality} />
              ))}
            </datalist>
            {municipalitiesError && (
              <small className="open-now-location-error">{municipalitiesError}</small>
            )}
          </label>
          <button
            className="secondary-button"
            type="button"
            onClick={applyLocation}
            disabled={municipalitiesLoading}
          >
            Aplicar
          </button>
        </div>

        <div className="open-now-coverage">
          <div>
            <strong>
              {freshCount}/{OPEN_NOW_CATALOG.length}
            </strong>
            <span>nichos atualizados</span>
          </div>
          <div>
            <strong>{errorCount}</strong>
            <span>com erro</span>
          </div>
          <div>
            <strong>
              {lastUpdated ? relativeUpdatedAt(lastUpdated, clock).replace("Atualizado ", "") : "—"}
            </strong>
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
              onClick={() => void runGlobalRefresh(false)}
            >
              <RefreshCw size={15} />
              Atualizar nichos abertos
            </button>
          )}
          {!globalProgress.running && errorCount > 0 && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => void runGlobalRefresh(true)}
            >
              Tentar novamente erros
            </button>
          )}
        </div>
      </section>

      {pageError && (
        <p className="activity-inline-error" role="status">
          {pageError}
        </p>
      )}

      {familySummary.length > 0 && (
        <section className="open-now-family-summary" aria-label="Resumo por família">
          {familySummary.map((item) => (
            <button
              key={item.family}
              type="button"
              onClick={() => setFamily(item.family)}
              className={family === item.family ? "active" : ""}
            >
              <span>{item.label}</span>
              <strong>{item.open}</strong>
              <small>
                {item.checked}/{item.total} nichos atuais
              </small>
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
            {prospectNow.map((row, index) => (
              <article key={row.business.placeId}>
                <span className="prospect-rank">{String(index + 1).padStart(2, "0")}</span>
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
                    <button type="button" onClick={() => openWhatsapp(row.business)}>
                      <MessageCircle size={14} />
                      WhatsApp
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetails({ business: row.business, segment: row.segment })}
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
            <h2>
              {city}, {state}
            </h2>
          </div>
          <small>
            Abrir esta página não consulta o Google. Atualizações são explícitas, progressivas e
            cacheadas por 15 minutos.
          </small>
        </div>

        <div className="open-now-toolbar">
          <label className="open-now-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nicho..."
              aria-label="Buscar nicho"
            />
          </label>

          <label className="select-wrap">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as NicheSort)}
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
              onChange={(event) => setHideZero(event.target.checked)}
            />
            Ocultar sem resultados
          </label>
        </div>

        <div className="open-now-filter-row">
          <button
            type="button"
            className={family === "all" ? "active" : ""}
            onClick={() => setFamily("all")}
          >
            Todas as famílias
          </button>
          {OPEN_NOW_FAMILIES.map((item) => (
            <button
              key={item}
              type="button"
              className={family === item ? "active" : ""}
              onClick={() => setFamily(item)}
            >
              {NICHE_FAMILY_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="open-now-filter-row compact">
          {(
            [
              ["all", "Todos"],
              ["with-whatsapp", "Com WhatsApp"],
              ["without-site", "Sem site"],
              ["with-instagram", "Com Instagram"],
              ["without-instagram", "Sem Instagram"],
            ] as Array<[NicheFilter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={nicheFilter === value ? "active" : ""}
              onClick={() => setNicheFilter(value)}
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
            {visibleNiches.map((item) => {
              const stats = nicheStats.get(item.segment)!;
              const nicheCache = stats.cache;
              const refreshing = refreshingSegments.has(item.segment);
              const status = nicheCache?.status ?? "not_checked";
              return (
                <article className={`open-now-niche-card ${status}`} key={item.segment}>
                  <div className="open-now-niche-top">
                    <div>
                      <small>{item.familyLabel}</small>
                      <h3>{item.segment}</h3>
                    </div>
                    {nicheCache?.checkedAt && cacheIsStale(nicheCache, clock) && (
                      <span className="open-now-stale">Desatualizado</span>
                    )}
                  </div>

                  <div className="open-now-main-number">
                    {refreshing || status === "checking" ? (
                      <>
                        <Loader2 size={15} className="auth-spinner" />
                        <strong>Consultando...</strong>
                      </>
                    ) : status === "error" ? (
                      <>
                        <AlertCircle size={15} />
                        <strong>Erro ao atualizar</strong>
                      </>
                    ) : !nicheCache?.checkedAt ? (
                      <strong>Ainda não consultado</strong>
                    ) : stats.openCount > 0 ? (
                      <>
                        <strong>{stats.openCount}</strong>
                        <span>abertas encontradas agora</span>
                      </>
                    ) : (
                      <strong>Nenhuma aberta encontrada</strong>
                    )}
                  </div>

                  {status === "error" && nicheCache?.errorMessage && (
                    <p className="open-now-card-error">{nicheCache.errorMessage}</p>
                  )}

                  {nicheCache?.checkedAt && (
                    <div className="open-now-niche-stats">
                      <span>
                        Fechando em breve <b>{stats.closingSoon}</b>
                      </span>
                      <span>
                        Chance média <b>{stats.averageChance || "—"}</b>
                      </span>
                      <span>
                        Com WhatsApp <b>{stats.withWhatsapp}</b>
                      </span>
                      <span>
                        Sem site <b>{stats.withoutSite}</b>
                      </span>
                    </div>
                  )}

                  <div className="open-now-niche-meta">
                    <span>{relativeUpdatedAt(nicheCache?.checkedAt ?? null, clock)}</span>
                    {nicheCache?.pageCount ? (
                      <span>
                        {nicheCache.pageCount}{" "}
                        {nicheCache.pageCount === 1 ? "página consultada" : "páginas consultadas"}
                      </span>
                    ) : null}
                  </div>

                  <div className="open-now-niche-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={refreshing}
                      onClick={() => void refreshOne(item.segment, { force: true })}
                    >
                      <RefreshCw size={13} />
                      Atualizar
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!nicheCache?.checkedAt}
                      onClick={() => {
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
        <section ref={businessPanelRef} className="open-now-business-panel">
          <div className="open-now-business-heading">
            <div>
              <span>{expandedSegment.toUpperCase()}</span>
              <h2>{expandedStats.openCount} abertas encontradas agora</h2>
              <p>
                {expandedStats.cache?.nextPageToken
                  ? "Há mais resultados do Google disponíveis para este nicho."
                  : "Resultados atualmente consultados para este nicho."}
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setExpandedSegment(null)}
            >
              Fechar lista
            </button>
          </div>

          <div className="open-now-filter-row compact">
            {(
              [
                ["all", "Todos"],
                ["phone", "Com telefone"],
                ["whatsapp", "Com WhatsApp"],
                ["with-site", "Com site"],
                ["without-site", "Sem site"],
                ["with-instagram", "Com Instagram"],
                ["without-instagram", "Sem Instagram"],
                ["new", "Somente novos"],
                ["closing-soon", "Fecha em breve"],
              ] as Array<[CompanyFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={companyFilter === value ? "active" : ""}
                onClick={() => setCompanyFilter(value)}
              >
                {label}
              </button>
            ))}
            <label className="open-now-toggle inline">
              <input
                type="checkbox"
                checked={showUnknown}
                onChange={(event) => setShowUnknown(event.target.checked)}
              />
              Mostrar horários desconhecidos
            </label>
          </div>

          <div className="open-now-business-list">
            {expandedRows.length ? (
              expandedRows.map((row) => (
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
                        {row.evaluation.state === "UNKNOWN"
                          ? "Horário desconhecido"
                          : "Aberto agora"}
                      </strong>
                      <small>{closingLabel(row.evaluation)}</small>
                    </div>
                  </div>
                  <div className="open-now-business-proof">
                    <strong>
                      {row.business.rating !== null
                        ? row.business.rating.toFixed(1).replace(".", ",")
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
                      <button type="button" onClick={() => openWhatsapp(row.business)}>
                        WhatsApp
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetails({ business: row.business, segment: row.segment })}
                    >
                      Ver empresa
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(row.existingLead)}
                      onClick={() =>
                        onAddLead(withSearchLocation(row.business, { city, state }), row.segment)
                      }
                    >
                      {row.existingLead ? (
                        <>
                          <Check size={13} />
                          Já adicionado
                        </>
                      ) : (
                        "Adicionar aos meus leads"
                      )}
                    </button>
                  </div>
                </article>
              ))
            ) : (
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
                onClick={() =>
                  void refreshOne(expandedSegment, {
                    pageToken: expandedStats.cache?.nextPageToken,
                  })
                }
              >
                {refreshingSegments.has(expandedSegment)
                  ? "Carregando..."
                  : "Carregar mais empresas"}
              </button>
            </div>
          )}
        </section>
      )}

      {details &&
        (() => {
          const existingLead =
            (findBusinessDuplicate(details.business, existingLeads) as PersistedLead | null) ??
            null;
          const chance = calculateLeadChance(details.business, details.segment);
          return (
            <BusinessDetailsModal
              business={details.business}
              chance={chance}
              segmentLabel={details.segment}
              alreadyAdded={Boolean(existingLead)}
              activityLeadId={existingLead?.id ?? null}
              onClose={() => setDetails(null)}
              onWhatsApp={openWhatsapp}
              onMessage={onMessage}
              onPresenceUpdate={(presence) => {
                applyPresence(details.business, presence);
                if (existingLead?.id) {
                  onPresenceDiscovered?.(existingLead.id, presence);
                }
              }}
              onAdd={(business) =>
                onAddLead(withSearchLocation(business, { city, state }), details.segment)
              }
            />
          );
        })()}
    </section>
  );
}
