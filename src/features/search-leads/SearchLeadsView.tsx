import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildFactualBusinessDescription } from "../business-presence/business-description";
import type { DeepEnrichmentApplied } from "../business-enrichment/types";
import { STATUS_LABEL } from "../leads/lead-status";
import type { LeadStatus } from "../leads/remote-leads";
import type { BusinessPresence } from "../business-presence/types";
import { ChanceBadge } from "../lead-chance/ChanceBadge";
import {
  BusinessDetailsModal,
  type BusinessAddResult,
} from "./BusinessDetailsModal";
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
import {
  DEFAULT_SEARCH_LOCATION,
  loadBrazilianMunicipalities,
  loadSearchLocation,
  resolveMunicipality,
  saveSearchLocation,
  searchLocationKey,
  type SearchLocation,
} from "./search-location";
import {
  BRAZIL_STATES,
  DEFAULT_BRAZIL_STATE,
  findBrazilianState,
  normalizeBrazilianStateCode,
} from "../../lib/brazil-locations";
import { normalizeSearchText, SEGMENT_GROUPS } from "./segments";
import type { BusinessSearchResult } from "./types";
import { storeRecentBusinessSearch } from "../open-now-niches/local-cache";
import {
  fetchCachedPlacesSearchSample,
  fetchRecentPlacesSearchSamples,
  persistPlacesSearchSample,
} from "../opportunities/places-search-cache";
import { isValidWhatsAppPhone, openWhatsAppLink } from "../../lib/whatsapp";

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

type LeadStatusFilter = "all" | "new" | LeadStatus;

type ContactFilter = "all" | "phone" | "whatsapp";
type WebsiteFilter = "all" | "with-site" | "without-site";
type InstagramFilter = "all" | "with-instagram" | "without-instagram";
type ChanceFilter = "all" | "high";

type ResultFilterState = {
  contact: ContactFilter;
  website: WebsiteFilter;
  instagram: InstagramFilter;
  chance: ChanceFilter;
};

type SmartFilterId =
  | "no-site-phone"
  | "no-site-whatsapp"
  | "high-chance-no-site"
  | "not-contacted"
  | "waiting"
  | "instagram-no-site";

type ResultWithContext = {
  business: BusinessSearchResult;
  existingLead: ExistingLeadIdentity | null;
  alreadyAdded: boolean;
  chance: LeadChanceResult;
};

type SmartFilterPreset = {
  id: SmartFilterId;
  label: string;
  title: string;
  resultFilters: ResultFilterState;
  leadStatusFilter: LeadStatusFilter;
};

const DEFAULT_RESULT_FILTERS: ResultFilterState = {
  contact: "all",
  website: "all",
  instagram: "all",
  chance: "all",
};

const SEARCH_LEADS_SESSION_KEY = "leadflow:search-leads-session:v1";

type SearchLeadsSession = {
  searchLocation: SearchLocation;
  resultsLocation: SearchLocation;
  cityInput: string;
  categoryQuery: string;
  selectedSegment: string;
  resultsSegment: string;
  results: BusinessSearchResult[];
  nextPageToken: string | null;
  screen: "segments" | "results";
  resultFilters: ResultFilterState;
  sort: ResultSort;
  leadStatusFilter: LeadStatusFilter;
  searchNotice: string;
};

function loadSearchLeadsSession(): SearchLeadsSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(SEARCH_LEADS_SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SearchLeadsSession>;
    const filters = saved?.resultFilters;

    if (
      !saved ||
      !saved.searchLocation ||
      typeof saved.searchLocation.city !== "string" ||
      typeof saved.searchLocation.state !== "string" ||
      !saved.resultsLocation ||
      typeof saved.resultsLocation.city !== "string" ||
      typeof saved.resultsLocation.state !== "string" ||
      typeof saved.cityInput !== "string" ||
      typeof saved.categoryQuery !== "string" ||
      typeof saved.selectedSegment !== "string" ||
      typeof saved.resultsSegment !== "string" ||
      !Array.isArray(saved.results) ||
      !saved.results.every(
        (item) => item && typeof item.placeId === "string" && typeof item.name === "string",
      ) ||
      (saved.nextPageToken !== null && typeof saved.nextPageToken !== "string") ||
      (saved.screen !== "segments" && saved.screen !== "results") ||
      !filters ||
      !["all", "phone", "whatsapp"].includes(filters.contact) ||
      !["all", "with-site", "without-site"].includes(filters.website) ||
      !["all", "with-instagram", "without-instagram"].includes(filters.instagram) ||
      !["all", "high"].includes(filters.chance) ||
      (typeof saved.sort !== "string" ||
        !["chance-desc", "chance-asc", "rating", "reviews", "az", "za"].includes(saved.sort)) ||
      (typeof saved.leadStatusFilter !== "string" ||
        !["all", "new", "send_message", "waiting", "accepted", "rejected"].includes(saved.leadStatusFilter)) ||
      typeof saved.searchNotice !== "string"
    ) {
      return null;
    }

    return saved as SearchLeadsSession;
  } catch {
    return null;
  }
}

const RESULT_FILTER_OPTIONS: Array<[ResultFilter, string]> = [
  ["all", "Todos"],
  ["phone", "Com telefone"],
  ["whatsapp", "Com WhatsApp"],
  ["with-site", "Com site"],
  ["without-site", "Sem site"],
  ["with-instagram", "Com Instagram"],
  ["without-instagram", "Sem Instagram"],
];

const SMART_FILTERS: SmartFilterPreset[] = [
  {
    id: "no-site-phone",
    label: "Sem site + telefone",
    title: "Empresas sem site identificado e com telefone válido.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      contact: "phone",
      website: "without-site",
    },
    leadStatusFilter: "all",
  },
  {
    id: "no-site-whatsapp",
    label: "Sem site + WhatsApp",
    title: "Empresas sem site identificado e com número utilizável no WhatsApp.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      contact: "whatsapp",
      website: "without-site",
    },
    leadStatusFilter: "all",
  },
  {
    id: "high-chance-no-site",
    label: "Alta Chance + sem site",
    title: "Empresas com Chance alta ou muito alta e sem site identificado.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      website: "without-site",
      chance: "high",
    },
    leadStatusFilter: "all",
  },
  {
    id: "not-contacted",
    label: "Não contatados",
    title: "Empresas já salvas com status Enviar mensagem.",
    resultFilters: DEFAULT_RESULT_FILTERS,
    leadStatusFilter: "send_message",
  },
  {
    id: "waiting",
    label: "Aguardando",
    title: "Empresas já salvas com status Aguardando.",
    resultFilters: DEFAULT_RESULT_FILTERS,
    leadStatusFilter: "waiting",
  },
  {
    id: "instagram-no-site",
    label: "Instagram + sem site",
    title: "Empresas com Instagram confirmado e sem site identificado.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      website: "without-site",
      instagram: "with-instagram",
    },
    leadStatusFilter: "all",
  },
];

function normalizedBusinessPhone(business: BusinessSearchResult) {
  return normalizeBrazilianPhone(
    business.phone?.trim() || business.internationalPhone?.trim(),
  );
}

function hasValidBusinessPhone(business: BusinessSearchResult) {
  return isValidWhatsAppPhone(normalizedBusinessPhone(business));
}

function hasUsableWhatsApp(business: BusinessSearchResult) {
  return isValidWhatsAppPhone(normalizedBusinessPhone(business));
}

function hasIdentifiedWebsite(business: BusinessSearchResult) {
  return Boolean(business.website?.trim());
}

function hasConfirmedInstagram(business: BusinessSearchResult) {
  return Boolean(
    business.instagram?.trim() &&
      business.instagramConfidence !== "medium" &&
      business.instagramConfidence !== "low" &&
      !business.instagramNeedsReview,
  );
}

function hasHighChance(chance: LeadChanceResult) {
  return chance.band === "high" || chance.band === "very-high";
}

function sameResultFilters(
  left: ResultFilterState,
  right: ResultFilterState,
) {
  return (
    left.contact === right.contact &&
    left.website === right.website &&
    left.instagram === right.instagram &&
    left.chance === right.chance
  );
}

function manualResultFilters(value: ResultFilter): ResultFilterState {
  if (value === "phone") {
    return { ...DEFAULT_RESULT_FILTERS, contact: "phone" };
  }
  if (value === "whatsapp") {
    return { ...DEFAULT_RESULT_FILTERS, contact: "whatsapp" };
  }
  if (value === "with-site") {
    return { ...DEFAULT_RESULT_FILTERS, website: "with-site" };
  }
  if (value === "without-site") {
    return { ...DEFAULT_RESULT_FILTERS, website: "without-site" };
  }
  if (value === "with-instagram") {
    return { ...DEFAULT_RESULT_FILTERS, instagram: "with-instagram" };
  }
  if (value === "without-instagram") {
    return { ...DEFAULT_RESULT_FILTERS, instagram: "without-instagram" };
  }
  return DEFAULT_RESULT_FILTERS;
}

function isManualResultFilterActive(
  value: ResultFilter,
  filters: ResultFilterState,
) {
  if (value === "all") return sameResultFilters(filters, DEFAULT_RESULT_FILTERS);
  if (value === "phone") return filters.contact === "phone";
  if (value === "whatsapp") return filters.contact === "whatsapp";
  if (value === "with-site") return filters.website === "with-site";
  if (value === "without-site") return filters.website === "without-site";
  if (value === "with-instagram") return filters.instagram === "with-instagram";
  return filters.instagram === "without-instagram";
}

function matchesResultFilters(
  item: ResultWithContext,
  filters: ResultFilterState,
  leadStatusFilter: LeadStatusFilter,
) {
  const { business, existingLead } = item;

  if (leadStatusFilter === "new" && existingLead) return false;
  if (
    leadStatusFilter !== "all" &&
    leadStatusFilter !== "new" &&
    existingLead?.status !== leadStatusFilter
  ) {
    return false;
  }

  if (filters.contact === "phone" && !hasValidBusinessPhone(business)) {
    return false;
  }
  if (filters.contact === "whatsapp" && !hasUsableWhatsApp(business)) {
    return false;
  }

  const hasWebsite = hasIdentifiedWebsite(business);
  if (filters.website === "with-site" && !hasWebsite) return false;
  if (filters.website === "without-site" && hasWebsite) return false;

  const hasInstagram = hasConfirmedInstagram(business);
  if (filters.instagram === "with-instagram" && !hasInstagram) return false;
  if (filters.instagram === "without-instagram" && hasInstagram) return false;

  if (filters.chance === "high" && !hasHighChance(item.chance)) return false;

  return true;
}

const RECENT_SEARCHES_KEY = "leadflow:recent-searches";

type RecentSearch = SearchLocation & {
  segment: string;
};

function recentSearchKey(value: RecentSearch) {
  return `${searchLocationKey(value)}|${normalizeSearchText(value.segment)}`;
}

function getRecentSearches() {
  if (typeof window === "undefined") return [] as RecentSearch[];

  try {
    const stored = JSON.parse(
      localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(stored)) return [];

    const parsed: RecentSearch[] = [];
    let migratedLegacy = false;

    for (const item of stored) {
      if (typeof item === "string" && item.trim()) {
        migratedLegacy = true;
        parsed.push({
          ...DEFAULT_SEARCH_LOCATION,
          segment: item.trim(),
        });
        continue;
      }

      if (!item || typeof item !== "object") continue;
      const row = item as {
        city?: unknown;
        state?: unknown;
        segment?: unknown;
      };
      const state = normalizeBrazilianStateCode(
        typeof row.state === "string" ? row.state : DEFAULT_BRAZIL_STATE.code,
      );
      if (
        typeof row.city !== "string" ||
        !row.city.trim() ||
        typeof row.segment !== "string" ||
        !row.segment.trim() ||
        !state
      ) {
        continue;
      }

      if (row.state !== state) migratedLegacy = true;
      parsed.push({
        city: row.city.trim(),
        state,
        segment: row.segment.trim(),
      });
    }

    const unique = new Map<string, RecentSearch>();
    for (const item of parsed) {
      const key = recentSearchKey(item);
      if (!unique.has(key)) unique.set(key, item);
    }

    const result = Array.from(unique.values()).slice(0, 5);
    if (migratedLegacy) {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(result));
    }
    return result;
  } catch {
    return [];
  }
}

function storeRecentSearch(search: RecentSearch) {
  const key = recentSearchKey(search);
  const next = [
    search,
    ...getRecentSearches().filter((item) => recentSearchKey(item) !== key),
  ].slice(0, 5);

  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export function SearchLeadsView({
  existingLeads,
  onAddLead,
  onMessage,
  onDeepEnrichmentApplied,
}: {
  existingLeads: ExistingLeadIdentity[];
  onAddLead: (
    business: BusinessSearchResult,
    selectedSegment: string,
  ) => Promise<BusinessAddResult>;
  onMessage: (target: SearchMessageTarget) => void;
  onDeepEnrichmentApplied?: (
    leadId: string,
    value: DeepEnrichmentApplied,
  ) => void;
}) {
  const initialSearchSession = useMemo(() => loadSearchLeadsSession(), []);
  const initialSearchLocation = useMemo(
    () => initialSearchSession?.searchLocation ?? loadSearchLocation(),
    [initialSearchSession],
  );
  const [searchLocation, setSearchLocation] =
    useState<SearchLocation>(initialSearchLocation);
  const [resultsLocation, setResultsLocation] =
    useState<SearchLocation>(initialSearchSession?.resultsLocation ?? initialSearchLocation);
  const [cityInput, setCityInput] = useState(initialSearchSession?.cityInput ?? initialSearchLocation.city);
  const selectedState =
    findBrazilianState(searchLocation.state) ?? DEFAULT_BRAZIL_STATE;
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(true);
  const [municipalitiesError, setMunicipalitiesError] = useState("");
  const [categoryQuery, setCategoryQuery] = useState(initialSearchSession?.categoryQuery ?? "");
  const [selectedSegment, setSelectedSegment] = useState(initialSearchSession?.selectedSegment ?? "");
  const [resultsSegment, setResultsSegment] = useState(initialSearchSession?.resultsSegment ?? "");
  const [results, setResults] = useState<BusinessSearchResult[]>(initialSearchSession?.results ?? []);
  const [nextPageToken, setNextPageToken] = useState<string | null>(initialSearchSession?.nextPageToken ?? null);
  const [screen, setScreen] = useState<"segments" | "results">(initialSearchSession?.screen ?? "segments");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [searchNotice, setSearchNotice] = useState(initialSearchSession?.searchNotice ?? "");
  const [resultFilters, setResultFilters] =
    useState<ResultFilterState>(initialSearchSession?.resultFilters ?? DEFAULT_RESULT_FILTERS);
  const [sort, setSort] = useState<ResultSort>(initialSearchSession?.sort ?? "rating");
  const [leadStatusFilter, setLeadStatusFilter] =
    useState<LeadStatusFilter>(initialSearchSession?.leadStatusFilter ?? "all");
  const [details, setDetails] = useState<BusinessSearchResult | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const hasActiveSearchRef = useRef(Boolean(initialSearchSession));

  useEffect(() => {
    // Do not replace the remote last search with an empty default session.
    if (!selectedSegment && !resultsSegment) return;

    const snapshot: SearchLeadsSession = {
      searchLocation,
      resultsLocation,
      cityInput,
      categoryQuery,
      selectedSegment,
      resultsSegment,
      results,
      nextPageToken,
      screen,
      resultFilters,
      sort,
      leadStatusFilter,
      searchNotice,
    };

    try {
      window.sessionStorage.setItem(SEARCH_LEADS_SESSION_KEY, JSON.stringify(snapshot));
    } catch {
      // Browsers with disabled/full session storage can still use the current view.
    }
  }, [
    searchLocation,
    resultsLocation,
    cityInput,
    categoryQuery,
    selectedSegment,
    resultsSegment,
    results,
    nextPageToken,
    screen,
    resultFilters,
    sort,
    leadStatusFilter,
    searchNotice,
  ]);

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
    let active = true;
    let refreshInFlight = false;
    setRecentSearches(getRecentSearches());

    async function refreshRemoteSearchState() {
      if (!active || refreshInFlight) return;
      refreshInFlight = true;

      try {
        const samples = await fetchRecentPlacesSearchSamples(5);
        if (!active || samples.length === 0) return;

        const localRecent = getRecentSearches();
        const remoteRecent: RecentSearch[] = [];
        const seen = new Set<string>();

        for (const sample of samples) {
          const state = normalizeBrazilianStateCode(sample.state);
          const city = sample.city.trim();
          const segment = sample.segment.trim();
          if (!state || !city || !segment) continue;

          const recent: RecentSearch = { city, state, segment };
          const key = recentSearchKey(recent);
          if (seen.has(key)) continue;
          seen.add(key);
          remoteRecent.push(recent);
        }

        const combined = [
          ...remoteRecent,
          ...localRecent.filter((item) => !seen.has(recentSearchKey(item))),
        ].slice(0, 5);

        try {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(combined));
        } catch {
          // Remote state remains authoritative even if local cache is unavailable.
        }
        setRecentSearches(combined);

        // Refresh recents without replacing the user's current prospecting session.
        if (hasActiveSearchRef.current) return;

        const latest = samples.find((sample) => sample.results.length > 0);
        if (!latest) return;

        const state = normalizeBrazilianStateCode(latest.state);
        const city = latest.city.trim();
        const segment = latest.segment.trim();
        if (!state || !city || !segment) return;

        hasActiveSearchRef.current = true;
        const location: SearchLocation = { city, state };
        saveSearchLocation(location);
        setSearchLocation(location);
        setCityInput(city);
        setSelectedSegment(segment);
        setResultsLocation(location);
        setResultsSegment(segment);
        setResults(latest.results);
        setNextPageToken(latest.nextPageToken);
        setScreen("results");

        const checkedAt = new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(latest.checkedAt));
        setSearchNotice(
          `Mostrando ${latest.results.length} resultados sincronizados da última busca (${checkedAt}).`,
        );
      } catch {
        // Local recent searches remain available as an offline fallback.
      } finally {
        refreshInFlight = false;
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshRemoteSearchState();
      }
    }

    function refreshAfterPageRestore(event: PageTransitionEvent) {
      if (event.persisted) {
        void refreshRemoteSearchState();
      }
    }

    void refreshRemoteSearchState();
    window.addEventListener("focus", refreshRemoteSearchState);
    window.addEventListener("online", refreshRemoteSearchState);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("pageshow", refreshAfterPageRestore);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshRemoteSearchState);
      window.removeEventListener("online", refreshRemoteSearchState);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshAfterPageRestore);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setMunicipalities([]);
    setMunicipalitiesLoading(true);
    setMunicipalitiesError("");

    void loadBrazilianMunicipalities(searchLocation.state, controller.signal)
      .then((values) => {
        setMunicipalities(values);
        const canonical = resolveMunicipality(searchLocation.city, values);
        if (canonical) {
          setCityInput(canonical);
          setSearchLocation((current) => ({
            city: canonical,
            state: current.state,
          }));
        }
      })
      .catch((error) => {
        if ((error as Error)?.name !== "AbortError") {
          setMunicipalitiesError(
            `Não foi possível carregar os municípios de ${selectedState.name} agora.`,
          );
        }
      })
      .finally(() => setMunicipalitiesLoading(false));

    return () => controller.abort();
  }, [searchLocation.state, searchLocation.city, selectedState.name]);

  const selectedCity = useMemo(() => {
    const official = resolveMunicipality(cityInput, municipalities);
    if (official) return official;

    if (
      municipalitiesError &&
      cityInput.trim().localeCompare(searchLocation.city, "pt-BR", {
        sensitivity: "base",
      }) === 0
    ) {
      return searchLocation.city;
    }

    return null;
  }, [cityInput, municipalities, municipalitiesError, searchLocation.city]);

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
          existingLead,
          alreadyAdded: Boolean(existingLead),
          chance: calculateLeadChance(business, resultsSegment),
        };
      }),
    [results, existingLeads, resultsSegment],
  );

  const visibleResults = useMemo(() => {
    const filtered = resultWithExisting.filter((item) =>
      matchesResultFilters(item, resultFilters, leadStatusFilter),
    );

    return [...filtered].sort((a, b) => {
      if (sort === "chance-desc") return b.chance.score - a.chance.score;
      if (sort === "chance-asc") return a.chance.score - b.chance.score;
      if (sort === "reviews") return (b.business.reviewCount ?? -1) - (a.business.reviewCount ?? -1);
      if (sort === "az") return a.business.name.localeCompare(b.business.name, "pt-BR");
      if (sort === "za") return b.business.name.localeCompare(a.business.name, "pt-BR");
      return (b.business.rating ?? -1) - (a.business.rating ?? -1);
    });
  }, [resultWithExisting, resultFilters, sort, leadStatusFilter]);

  const quickFilterCounts = useMemo(
    () =>
      Object.fromEntries(
        SMART_FILTERS.map((preset) => [
          preset.id,
          resultWithExisting.filter((item) =>
            matchesResultFilters(
              item,
              preset.resultFilters,
              preset.leadStatusFilter,
            ),
          ).length,
        ]),
      ) as Record<SmartFilterId, number>,
    [resultWithExisting],
  );

  const activeSmartFilter =
    SMART_FILTERS.find(
      (preset) =>
        preset.leadStatusFilter === leadStatusFilter &&
        sameResultFilters(preset.resultFilters, resultFilters),
    )?.id ?? null;

  const hasActiveFilters =
    leadStatusFilter !== "all" ||
    !sameResultFilters(resultFilters, DEFAULT_RESULT_FILTERS);

  const alreadyAddedCount = resultWithExisting.filter((item) => item.alreadyAdded).length;
  const newCount = resultWithExisting.length - alreadyAddedCount;

  function clearResultFilters() {
    setResultFilters(DEFAULT_RESULT_FILTERS);
    setLeadStatusFilter("all");
  }

  function applySmartFilter(preset: SmartFilterPreset) {
    if (activeSmartFilter === preset.id) {
      clearResultFilters();
      return;
    }

    setResultFilters(preset.resultFilters);
    setLeadStatusFilter(preset.leadStatusFilter);
  }

  async function runSearch(
    segment: string,
    location: SearchLocation,
    pageToken?: string,
    append = false,
  ) {
    // A user-initiated search takes precedence over a pending cache refresh.
    hasActiveSearchRef.current = true;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    if (!append) setSearchNotice("");

    const response = await searchBusinesses({
      segment,
      city: location.city,
      state: location.state,
      ...(pageToken ? { pageToken } : {}),
    });

    if (!response.ok) {
      if (!append && response.code === "QUOTA") {
        const cached = await fetchCachedPlacesSearchSample(
          location,
          segment,
        ).catch(() => null);

        if (cached?.results.length) {
          const checkedAt = new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(cached.checkedAt));

          setResults(cached.results);
          setResultsLocation(location);
          setResultsSegment(segment);
          setNextPageToken(null);
          setResultFilters(DEFAULT_RESULT_FILTERS);
          setLeadStatusFilter("all");
          setScreen("results");
          setSearchNotice(
            `O Google Places atingiu o limite temporário. Mostrando ${cached.results.length} resultados salvos da última busca (${checkedAt}).`,
          );
          setRecentSearches(
            storeRecentSearch({
              ...location,
              segment,
            }),
          );
          setLoading(false);
          return;
        }
      }

      setError({ code: response.code, message: response.message });
      if (append) setLoadingMore(false);
      else setLoading(false);
      return;
    }

    const combinedResults = append
      ? [...results, ...response.results]
      : response.results;
    const uniqueResults = Array.from(
      new Map(
        combinedResults.map((item) => [item.placeId, item]),
      ).values(),
    );

    setResults(uniqueResults);
    setSearchNotice("");
    storeRecentBusinessSearch(segment,response.results,{
      city: location.city,
      state: location.state,
      append,
    });
    void persistPlacesSearchSample({
      location,
      segment,
      results: uniqueResults,
      nextPageToken: response.nextPageToken,
      append,
    }).catch(() => {
      // Opportunity persistence is auxiliary and must not break lead search.
    });
    saveSearchLocation(location);
    setSearchLocation(location);
    setCityInput(location.city);
    setResultsLocation(location);
    setNextPageToken(response.nextPageToken);
    setResultsSegment(segment);
    setScreen("results");
    setRecentSearches(
      storeRecentSearch({
        ...location,
        segment,
      }),
    );
    if (append) setLoadingMore(false);
    else setLoading(false);
  }

  function startSearch() {
    if (!selectedSegment || !selectedCity || !selectedState) return;
    const location: SearchLocation = {
      city: selectedCity,
      state: selectedState.code,
    };
    setResultFilters(DEFAULT_RESULT_FILTERS);
    setLeadStatusFilter("all");
    void runSearch(selectedSegment, location);
  }

  function repeatSearch(search: RecentSearch) {
    setSelectedSegment(search.segment);
    setCityInput(search.city);
    setSearchLocation({
      city: search.city,
      state: search.state,
    });
    setResultFilters(DEFAULT_RESULT_FILTERS);
    setLeadStatusFilter("all");
    void runSearch(search.segment, {
      city: search.city,
      state: search.state,
    });
  }

  function openWhatsApp(business: BusinessSearchResult) {
    if (!business.phone) return;
    const phone = normalizeBrazilianPhone(business.phone);
    openWhatsAppLink({ phone });
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
            <p className="eyebrow">
              {selectedState.name.toLocaleUpperCase("pt-BR")} · {selectedState.code}
            </p>
            <h1>
              Encontre empresas em {(selectedCity ?? cityInput.trim()) || searchLocation.city}
            </h1>
            <p className="subtitle">
              Escolha a cidade e o segmento para encontrar possíveis clientes.
            </p>
          </div>
        </div>

        <div className="search-location-panel">
          <label className="search-location-field">
            <span>Estado</span>
            <div className="search-location-select">
              <select
                value={selectedState.code}
                onChange={(event) => {
                  const state = findBrazilianState(event.target.value);
                  if (!state) return;
                  setSearchLocation({
                    city: "",
                    state: state.code,
                  });
                  setCityInput("");
                  setMunicipalities([]);
                  setMunicipalitiesError("");
                }}
                aria-label="Estado"
              >
                {BRAZIL_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name} ({state.code})
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="search-location-field">
            <span>Cidade</span>
            <div className="search-city-input">
              <MapPin size={15} />
              <input
                list={`city-options-${selectedState.code}`}
                value={cityInput}
                onChange={(event) => setCityInput(event.target.value)}
                onBlur={() => {
                  const canonical = resolveMunicipality(
                    cityInput,
                    municipalities,
                  );
                  if (canonical) setCityInput(canonical);
                }}
                placeholder={`Digite um município de ${selectedState.name}`}
                autoComplete="off"
                aria-label={`Cidade de ${selectedState.name}`}
              />
              <datalist id={`city-options-${selectedState.code}`}>
                {municipalities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
            <small
              className={
                !municipalitiesLoading &&
                cityInput.trim() &&
                !selectedCity
                  ? "search-location-help error"
                  : "search-location-help"
              }
            >
              {municipalitiesLoading
                ? "Carregando municípios do IBGE..."
                : municipalitiesError
                  ? municipalitiesError
                  : cityInput.trim() && !selectedCity
                    ? `Selecione um município válido de ${selectedState.name}.`
                    : "Municípios oficiais do IBGE."}
            </small>
          </label>
        </div>

        {recentSearches.length > 0 && (
          <div className="recent-searches">
            <span>Buscas recentes</span>
            <div>
              {recentSearches.map((search) => (
                <button
                  key={recentSearchKey(search)}
                  type="button"
                  onClick={() => repeatSearch(search)}
                >
                  {search.segment} · {search.city} · {search.state}
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
                        onClick={() => { hasActiveSearchRef.current = true; setSelectedSegment(segment); }}
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

        {error && <SearchError error={error} />}

        <div className="selection-bar">
          <div>
            <span>Busca selecionada</span>
            <strong>
              {selectedCity
                ? `${selectedSegment || "Selecione um segmento"} · ${selectedCity} / ${selectedState.code}`
                : "Selecione uma cidade válida"}
            </strong>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={
              !selectedSegment ||
              !selectedCity ||
              loading ||
              municipalitiesLoading
            }
            onClick={startSearch}
          >
            {loading ? "Buscando empresas..." : "Buscar leads"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-wrap search-leads-page">
      <div className="results-heading">
        <button type="button" className="back-button" onClick={() => setScreen("segments")}>
          <ArrowLeft size={16} />
          Alterar busca
        </button>
        <div>
          <p className="eyebrow">
            {resultsLocation.city.toLocaleUpperCase("pt-BR")} · {findBrazilianState(resultsLocation.state)?.name.toLocaleUpperCase("pt-BR") ?? resultsLocation.state}
          </p>
          <h1>{resultsSegment}</h1>
          <p className="subtitle">
            {results.length} {results.length === 1 ? "empresa encontrada" : "empresas encontradas"}.
            {" "}{newCount} ainda não {newCount === 1 ? "cadastrada" : "cadastradas"} e {alreadyAddedCount} já
            {" "}{alreadyAddedCount === 1 ? "está" : "estão"} nos seus leads.
          </p>
        </div>
      </div>

      {searchNotice && (
        <div className="search-cache-notice" role="status">
          <strong>Resultados salvos</strong>
          <span>{searchNotice}</span>
        </div>
      )}

      <div className="results-toolbar">
        <div className="quick-filters">
          <div className="quick-filters-heading">
            <span>Atalhos de prospecção</span>
            {hasActiveFilters && (
              <button
                type="button"
                className="quick-filter-clear"
                onClick={clearResultFilters}
              >
                Limpar
              </button>
            )}
          </div>
          <div className="quick-filter-list" aria-label="Atalhos de prospecção">
            {SMART_FILTERS.map((preset) => {
              const active = activeSmartFilter === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    active ? "quick-filter-chip active" : "quick-filter-chip"
                  }
                  aria-pressed={active}
                  title={preset.title}
                  onClick={() => applySmartFilter(preset)}
                >
                  {active && <Check size={12} aria-hidden="true" />}
                  <span>{preset.label}</span>
                  <small>{quickFilterCounts[preset.id]}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="result-filters">
          {RESULT_FILTER_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                isManualResultFilterActive(value, resultFilters)
                  ? "filter-chip active"
                  : "filter-chip"
              }
              aria-pressed={isManualResultFilterActive(value, resultFilters)}
              onClick={() => setResultFilters(manualResultFilters(value))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="result-controls">
          <label className="new-only-control">
            <input
              type="checkbox"
              checked={leadStatusFilter === "new"}
              onChange={(event) =>
                setLeadStatusFilter(event.target.checked ? "new" : "all")
              }
            />
            <span>Somente novos</span>
          </label>
          <label className="select-wrap">
            <select
              value={leadStatusFilter}
              onChange={(event) =>
                setLeadStatusFilter(event.target.value as LeadStatusFilter)
              }
              aria-label="Filtrar por status do lead"
            >
              <option value="all">Todos os status</option>
              <option value="new">Novos</option>
              <option value="send_message">Enviar mensagem</option>
              <option value="waiting">Aguardando</option>
              <option value="accepted">Aceitos</option>
              <option value="rejected">Recusados</option>
            </select>
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
          {visibleResults.map(({ business, existingLead, chance }) => (
            <BusinessCard
              key={business.placeId}
              business={business}
              chance={chance}
              existingLead={existingLead}
              onDetails={setDetails}
              onWhatsApp={openWhatsApp}
              onMessage={onMessage}
              onAdd={(item) => {
                void onAddLead(item, resultsSegment);
              }}
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
            onClick={() =>
              void runSearch(resultsSegment, resultsLocation, nextPageToken, true)
            }
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
          commercialLead={
            duplicate?.id && duplicate.status
              ? {
                  id: duplicate.id,
                  status: duplicate.status,
                  phone: duplicate.phone,
                }
              : null
          }
          activityLeadId={duplicate?.id ?? null}
          onClose={() => setDetails(null)}
          onWhatsApp={openWhatsApp}
          onMessage={(target) => {
            const leadId =
              target.id ??
              findBusinessDuplicate(details, existingLeads)?.id;
            onMessage({
              company: target.company,
              phone: target.phone,
              ...(leadId ? { id: leadId } : {}),
            });
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
  existingLead,
  onDetails,
  onWhatsApp,
  onMessage,
  onAdd,
}: {
  business: BusinessSearchResult;
  chance: LeadChanceResult;
  existingLead: ExistingLeadIdentity | null;
  onDetails: (business: BusinessSearchResult) => void;
  onWhatsApp: (business: BusinessSearchResult) => void;
  onMessage: (target: SearchMessageTarget) => void;
  onAdd: (business: BusinessSearchResult) => void;
}) {
  const commercialPhone = existingLead?.phone || business.phone || "";
  const normalizedCommercialPhone = normalizeBrazilianPhone(commercialPhone);
  const canSendPreparedMessage =
    normalizedCommercialPhone.length === 12 ||
    normalizedCommercialPhone.length === 13;
  const showPreparedMessageAction =
    canSendPreparedMessage &&
    (!existingLead || existingLead.status === "send_message");

  return (
    <article className="business-card">
      <div className="business-card-main">
        <div className="business-title-row">
          <div>
            <div className="business-name-line">
              <h2>{business.name}</h2>
              {existingLead?.status && (
                <span
                  className={`status-badge ${existingLead.status}`}
                  aria-label={`Status do lead: ${STATUS_LABEL[existingLead.status]}`}
                >
                  {STATUS_LABEL[existingLead.status]}
                </span>
              )}
              <ChanceBadge chance={chance} />
            </div>
            {business.primaryCategory && <span>{business.primaryCategory}</span>}
            {existingLead && <span>Nos seus leads</span>}
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
          <button type="button" className="secondary-button compact-button" onClick={() => onWhatsApp(business)}>
            WhatsApp
          </button>
        )}
        {showPreparedMessageAction && (
          <button
            type="button"
            className="message-button compact-button"
            onClick={() =>
              onMessage({
                company: business.name,
                phone: commercialPhone,
                ...(existingLead?.id ? { id: existingLead.id } : {}),
              })
            }
          >
            <MessageCircle size={14} />
            {existingLead?.status === "send_message"
              ? "Enviar mensagem"
              : "Mandar mensagem"}
          </button>
        )}
        {!existingLead && (
          <button
            type="button"
            className="primary-button compact-button"
            onClick={() => onAdd(business)}
          >
            Adicionar aos meus leads
          </button>
        )}
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
    <div className="search-error" role="alert" aria-live="assertive">
      <strong>{title}</strong>
      <p>{error.message}</p>
    </div>
  );
}
