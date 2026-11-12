import { safeExternalHref } from "../../lib/safe-external-url";
import { accountLocalStorage, accountSessionStorage } from "../../lib/account-storage";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildFactualBusinessDescription } from "../business-presence/business-description";
import { discoverBusinessPresence } from "../business-presence/discover-business-presence";
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
import { SearchResultsAttribution } from "./BusinessSourceCredit";
import { GoogleMapsLink } from "./GoogleMapsLink";
import {
  DEFAULT_SEARCH_LOCATION,
  loadBrazilianMunicipalities,
  loadSearchLocation,
  resolveMunicipality,
  saveSearchLocation,
  searchLocationKey,
  withSearchLocation,
  type SearchLocation,
} from "./search-location";
import {
  BRAZIL_STATES,
  DEFAULT_BRAZIL_STATE,
  findBrazilianState,
  normalizeBrazilianStateCode,
} from "../../lib/brazil-locations";
import { normalizeSearchText, resolveSearchSegment, searchSegmentMatchesQuery, SEGMENT_GROUPS } from "./segments";
import type { BusinessSearchResult } from "./types";
import { storeRecentBusinessSearch } from "../open-now-niches/local-cache";
import {
  fetchCachedPlacesSearchSample,
  fetchRecentPlacesSearchSamples,
  persistPlacesSearchSample,
} from "../opportunities/places-search-cache";
import { isValidWhatsAppPhone, openWhatsAppLink } from "../../lib/whatsapp";

export type SearchMode = "all" | "open";

export type SearchMessageTarget = {
  id?: string;
  company: string;
  phone: string;
};

type ResultFilter =
  | "all"
  | "phone"
  | "email"
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

type ContactFilter = "all" | "phone" | "email" | "whatsapp";
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
  | "no-site-email"
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
// Automatic site-only Instagram checks. No OpenAI/web search is launched here.
const MAX_AUTOMATIC_INSTAGRAM_SITE_CHECKS = 4;
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
    const raw = accountSessionStorage.getItem(SEARCH_LEADS_SESSION_KEY);
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
      !["all", "phone", "email", "whatsapp"].includes(filters.contact) ||
      !["all", "with-site", "without-site"].includes(filters.website) ||
      !["all", "with-instagram", "without-instagram"].includes(filters.instagram) ||
      !["all", "high"].includes(filters.chance) ||
      (typeof saved.sort !== "string" ||
        !["chance-desc", "chance-asc", "rating", "reviews", "az", "za"].includes(saved.sort)) ||
      (typeof saved.leadStatusFilter !== "string" ||
        !["all", "new", "send_message", "waiting", "accepted", "rejected"].includes(
          saved.leadStatusFilter,
        )) ||
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
  ["email", "Com e-mail"],
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
    id: "no-site-email",
    label: "Sem site + e-mail",
    title: "Empresas sem site identificado, mas com um e-mail cadastrado.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      contact: "email",
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
  const value = business.website?.trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const nonWebsites = [
      "wa.me", "whatsapp.com", "instagram.com", "facebook.com", "fb.me",
      "linktr.ee", "bit.ly", "tinyurl.com", "youtube.com", "tiktok.com",
      "beacons.ai", "goo.gl",
    ];
    return ["http:", "https:"].includes(url.protocol) && !nonWebsites.some(
      (blocked) => host === blocked || host.endsWith("." + blocked)
    );
  } catch {
    return false;
  }
}

function hasBusinessEmail(business: BusinessSearchResult) {
  return Boolean(business.email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.email.trim()));
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
  if (value === "email") {
    return { ...DEFAULT_RESULT_FILTERS, contact: "email" };
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
  if (value === "email") return filters.contact === "email";
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
  if (filters.contact === "email" && !hasBusinessEmail(business)) {
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
  return `${searchLocationKey(value)}|${normalizeSearchText(resolveSearchSegment(value.segment) ?? value.segment)}`;
}

function getRecentSearches() {
  if (typeof window === "undefined") return [] as RecentSearch[];

  try {
    const stored = JSON.parse(
      accountLocalStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(stored)) return [];

    const parsed: RecentSearch[] = [];
    let migratedLegacy = false;

    for (const item of stored) {
      if (typeof item === "string" && item.trim()) {
        migratedLegacy = true;
        parsed.push({
          ...DEFAULT_SEARCH_LOCATION,
          segment: resolveSearchSegment(item.trim()) ?? item.trim(),
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

      const canonicalSegment = resolveSearchSegment(row.segment.trim()) ?? row.segment.trim();
      if (row.state !== state || canonicalSegment !== row.segment.trim()) migratedLegacy = true;
      parsed.push({
        city: row.city.trim(),
        state,
        segment: canonicalSegment,
      });
    }

    const unique = new Map<string, RecentSearch>();
    for (const item of parsed) {
      const key = recentSearchKey(item);
      if (!unique.has(key)) unique.set(key, item);
    }

    const result = Array.from(unique.values()).slice(0, 5);
    if (migratedLegacy) {
      accountLocalStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(result));
    }
    return result;
  } catch {
    return [];
  }
}

function storeRecentSearch(search: RecentSearch) {
  search = { ...search, segment: resolveSearchSegment(search.segment) ?? search.segment };
  const key = recentSearchKey(search);
  const next = [
    search,
    ...getRecentSearches().filter((item) => recentSearchKey(item) !== key),
  ].slice(0, 5);

  accountLocalStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export function SearchLeadsView({
  existingLeads,
  onAddLead,
  onMessage,
  onPresenceDiscovered,
  mode,
  onModeChange,
}: {
  existingLeads: ExistingLeadIdentity[];
  onAddLead: (
    business: BusinessSearchResult,
    selectedSegment: string,
  ) => Promise<BusinessAddResult>;
  onMessage: (target: SearchMessageTarget) => void;
  onPresenceDiscovered?: (leadId: string, presence: BusinessPresence) => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
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
  const [cityInput, setCityInput] = useState(
    initialSearchSession?.cityInput ?? initialSearchLocation.city,
  );
  const selectedState =
    findBrazilianState(searchLocation.state) ?? DEFAULT_BRAZIL_STATE;
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(true);
  const [municipalitiesError, setMunicipalitiesError] = useState("");
  const [categoryQuery, setCategoryQuery] = useState(
    initialSearchSession?.categoryQuery ?? "",
  );
  const [selectedSegment, setSelectedSegment] = useState(
    resolveSearchSegment(initialSearchSession?.selectedSegment ?? "") ?? "",
  );
  const [resultsSegment, setResultsSegment] = useState(
    resolveSearchSegment(initialSearchSession?.resultsSegment ?? "") ?? initialSearchSession?.resultsSegment ?? "",
  );
  const [results, setResults] = useState<BusinessSearchResult[]>(
    initialSearchSession?.results ?? [],
  );
  const [nextPageToken, setNextPageToken] = useState<string | null>(
    initialSearchSession?.nextPageToken ?? null,
  );
  const [screen, setScreen] = useState<"segments" | "results">(
    initialSearchSession?.screen ?? "segments",
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [searchNotice, setSearchNotice] = useState(initialSearchSession?.searchNotice ?? "");
  const [providerNotice, setProviderNotice] = useState("");
  const [instagramCheckingIds, setInstagramCheckingIds] = useState<string[]>([]);
  const [resultFilters, setResultFilters] = useState<ResultFilterState>(
    initialSearchSession?.resultFilters ?? DEFAULT_RESULT_FILTERS,
  );
  const [sort, setSort] = useState<ResultSort>(initialSearchSession?.sort ?? "rating");
  const [leadStatusFilter, setLeadStatusFilter] =
    useState<LeadStatusFilter>(initialSearchSession?.leadStatusFilter ?? "all");
  const [details, setDetails] = useState<BusinessSearchResult | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const hasActiveSearchRef = useRef(Boolean(initialSearchSession));
  // A slower search must never replace results from a newer user request.
  const searchRequestIdRef = useRef(0);
  const instagramSiteScanRef = useRef({
    scope: "",
    checked: new Set<string>(),
  });
  const instagramSiteControllersRef = useRef(new Set<AbortController>());

  useEffect(() => {
    return () => {
      for (const controller of instagramSiteControllersRef.current) controller.abort();
      instagramSiteControllersRef.current.clear();
    };
  }, []);

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
      accountSessionStorage.setItem(SEARCH_LEADS_SESSION_KEY, JSON.stringify(snapshot));
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
          const segment = resolveSearchSegment(sample.segment.trim()) ?? sample.segment.trim();
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
          accountLocalStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(combined));
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
        const segment = resolveSearchSegment(latest.segment.trim()) ?? latest.segment.trim();
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
      items: group.items.filter((item) => searchSegmentMatchesQuery(item, query)),
    })).filter((group) => group.items.length > 0);
  }, [categoryQuery]);

  const resultWithExisting = useMemo(
    () =>
      results.map((business) => {
        const located = withSearchLocation(business, resultsLocation);
        const existingLead = findBusinessDuplicate(located, existingLeads);
        const savedInstagramIsConfirmed = Boolean(
          existingLead?.instagram?.trim() &&
          existingLead.instagramConfidence !== "medium" &&
          existingLead.instagramConfidence !== "low" &&
          !existingLead.instagramNeedsReview,
        );
        const hydratedBusiness =
          savedInstagramIsConfirmed &&
          (!hasConfirmedInstagram(business) ||
            existingLead?.instagramSource === "manual_confirmation")
            ? {
                ...business,
                instagram: existingLead?.instagram ?? null,
                instagramConfidence: existingLead?.instagramConfidence ?? "high",
                instagramSource: existingLead?.instagramSource ?? "existing_data",
                instagramUsername: existingLead?.instagramUsername ?? null,
                instagramDisplayName: existingLead?.instagramDisplayName ?? null,
                instagramCheckedAt: existingLead?.instagramCheckedAt ?? null,
                instagramNeedsReview: false,
              }
            : business;

        // Social and short links are not verified company websites, even when
        // a provider filled its generic "website" field with those URLs.
        const cleanBusiness = hasIdentifiedWebsite(hydratedBusiness)
          ? hydratedBusiness
          : { ...hydratedBusiness, website: null };
        return {
          business: cleanBusiness,
          existingLead,
          alreadyAdded: Boolean(existingLead),
          chance: calculateLeadChance(cleanBusiness, resultsSegment),
        };
      }),
    [results, existingLeads, resultsSegment, resultsLocation],
  );

  // The mode only filters data already returned by Buscar Leads.
  // Switching modes never calls the Google API or spends an extra request.
  const visibleResults = useMemo(() => {
    const filtered = resultWithExisting.filter((item) =>
      (mode !== "open" || item.business.isOpenNow === true) &&
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
  }, [resultWithExisting, resultFilters, sort, leadStatusFilter, mode]);

  const resultsInsights = useMemo(() => ({
    visible: visibleResults.length,
    noSite: visibleResults.filter(({ business }) => !hasIdentifiedWebsite(business)).length,
    withSite: visibleResults.filter(({ business }) => hasIdentifiedWebsite(business)).length,
    withEmail: visibleResults.filter(({ business }) => hasBusinessEmail(business)).length,
    withPhone: visibleResults.filter(({ business }) => hasValidBusinessPhone(business)).length,
    instagramConfirmed: visibleResults.filter(({ business }) => hasConfirmedInstagram(business)).length,
    instagramPossible: visibleResults.filter(({ business }) =>
      !hasConfirmedInstagram(business) && Boolean(business.instagramCandidates?.length)
    ).length,
    overture: visibleResults.filter(({ business }) => business.source === "overture").length,
    geoapify: visibleResults.filter(({ business }) => business.source === "geoapify").length,
    google: visibleResults.filter(({ business }) => business.source === "google_places").length,
  }), [visibleResults]);

  const quickFilterCounts = useMemo(
    () =>
      Object.fromEntries(
        SMART_FILTERS.map((preset) => [
          preset.id,
          resultWithExisting.filter((item) =>
            (mode !== "open" || item.business.isOpenNow === true) &&
            matchesResultFilters(
              item,
              preset.resultFilters,
              preset.leadStatusFilter,
            ),
          ).length,
        ]),
      ) as Record<SmartFilterId, number>,
    [resultWithExisting, mode],
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
  const openCount = resultWithExisting.filter((item) => item.business.isOpenNow === true).length;
  const unknownHoursCount = resultWithExisting.filter((item) => item.business.isOpenNow === null).length;

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
    // A fresh niche search starts with all results. The "Abertos Agora"
    // filter is offered only after the user sees the fetched companies.
    // Loading another page retains the selected filter.
    if (!append) {
      onModeChange("all");
    }
    // A user-initiated search takes precedence over a pending cache refresh.
    hasActiveSearchRef.current = true;
    const requestId = ++searchRequestIdRef.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLoadingMore(false);
    }
    setError(null);
    if (!append) {
      setSearchNotice("");
      setProviderNotice("");
    }

    const response = await searchBusinesses({
      segment,
      city: location.city,
      state: location.state,
      ...(pageToken ? { pageToken } : {}),
    });

    // Out-of-order network responses must not overwrite the latest search.
    if (requestId !== searchRequestIdRef.current) return;

    if (!response.ok) {
      if (!append && response.code === "QUOTA") {
        const cached = await fetchCachedPlacesSearchSample(
          location,
          segment,
        ).catch(() => null);

        if (requestId !== searchRequestIdRef.current) return;
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
            `A consulta atingiu um limite temporário. Mostrando ${cached.results.length} resultados salvos da última busca (${checkedAt}).`,
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
    // A repeated Places ID on the next page must never erase an Instagram
    // already confirmed by the automatic or manual discovery.
    const uniqueByPlace = new Map<string, BusinessSearchResult>();
    for (const item of combinedResults) {
      const previous = uniqueByPlace.get(item.placeId);
      if (previous && hasConfirmedInstagram(previous) && !hasConfirmedInstagram(item)) {
        uniqueByPlace.set(item.placeId, {
          ...item,
          instagram: previous.instagram,
          instagramConfidence: previous.instagramConfidence,
          instagramSource: previous.instagramSource,
          instagramUsername: previous.instagramUsername,
          instagramDisplayName: previous.instagramDisplayName,
          instagramCheckedAt: previous.instagramCheckedAt,
          instagramSearchSignature: previous.instagramSearchSignature,
          instagramNeedsReview: false,
        });
      } else {
        uniqueByPlace.set(item.placeId, item);
      }
    }
    const uniqueResults = [...uniqueByPlace.values()];

    setResults(uniqueResults);
    setSearchNotice("");
    setProviderNotice(response.providerNotice ?? "");
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
        instagramDisplayName: presence.instagramDisplayName ?? (
          presence.instagramUrl && presence.instagramUrl === business.instagram
            ? business.instagramDisplayName ?? null
            : null
        ),
        // Keep provider-supplied possible profiles for manual review when
        // the official website yields no verified profile, except rejections.
        instagramCandidates: presence.instagramUrl ? [] : [
          ...presence.instagramCandidates,
          ...(business.instagramCandidates ?? []).filter((candidate) =>
            !presence.instagramRejectedUrls.includes(candidate.url) &&
            !presence.instagramCandidates.some((item) => item.url === candidate.url)
          ),
        ].slice(0, 3),
        instagramRejectedUrls: presence.instagramRejectedUrls,
        instagramSearchSignature: presence.instagramSearchSignature,
        ...(presence.instagramSearchScope
          ? { instagramSearchScope: presence.instagramSearchScope }
          : {}),
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

  // Progressive first-party verification: after showing search results, inspect
  // at most four public business websites per loaded page. Never trigger the
  // paid web/AI discovery, and never mark a third-party directory link verified.
  useEffect(() => {
    if (screen !== "results" || loading) {
      setInstagramCheckingIds([]);
      for (const controller of instagramSiteControllersRef.current) controller.abort();
      instagramSiteControllersRef.current.clear();
      return;
    }
    const scope = [
      searchRequestIdRef.current,
      resultsSegment,
      resultsLocation.city,
      resultsLocation.state,
    ].join("|");
    if (instagramSiteScanRef.current.scope !== scope) {
      setInstagramCheckingIds([]);
      for (const controller of instagramSiteControllersRef.current) controller.abort();
      instagramSiteControllersRef.current.clear();
      instagramSiteScanRef.current = { scope, checked: new Set<string>() };
    }

    const checked = instagramSiteScanRef.current.checked;
    const remaining = MAX_AUTOMATIC_INSTAGRAM_SITE_CHECKS - checked.size;
    if (remaining <= 0) return;
    const targets = results.filter((business) =>
      Boolean(business.website) &&
      hasIdentifiedWebsite(business) &&
      !hasConfirmedInstagram(business) &&
      !business.instagramNeedsReview &&
      !business.instagramCheckedAt &&
      !checked.has(business.placeId)
    ).slice(0, remaining);

    for (const business of targets) checked.add(business.placeId);
    if (targets.length) {
      setInstagramCheckingIds((old) => [
        ...new Set([...old, ...targets.map((item) => item.placeId)]),
      ]);
    }
    // Two sequential workers, never four simultaneous site requests.
    const workers = Array.from({ length: Math.min(2, targets.length) }, (_, worker) =>
      (async () => {
        for (let index = worker; index < targets.length; index += 2) {
          if (instagramSiteScanRef.current.scope !== scope) return;
          const business = targets[index];
          const controller = new AbortController();
          instagramSiteControllersRef.current.add(controller);
          try {
            const presence = await discoverBusinessPresence(business, {
              allowWebSearch: false,
              signal: controller.signal,
            });
            if (presence && !controller.signal.aborted &&
                instagramSiteScanRef.current.scope === scope) {
              updateBusinessPresence(business.placeId, presence);
            }
          } catch {
            // A website that cannot be checked must not block lead search.
          } finally {
            instagramSiteControllersRef.current.delete(controller);
            setInstagramCheckingIds((old) => old.filter((id) => id !== business.placeId));
          }
        }
      })()
    );
    void Promise.allSettled(workers);
  }, [screen, loading, results, resultsSegment, resultsLocation.city, resultsLocation.state]);

  if (screen === "segments") {
    return (
      <section className="page-wrap search-leads-page">
        <div className="page-heading search-page-heading">
          <div>
            <p className="eyebrow">
              PROSPECÇÃO NACIONAL · BRASIL · {selectedState.name.toLocaleUpperCase("pt-BR")} ({selectedState.code})
            </p>
            <h1>
              Encontre empresas em {(selectedCity ?? cityInput.trim()) || searchLocation.city}
            </h1>
            <p className="subtitle">
              Pesquise empresas em qualquer município do Brasil: selecione a UF, a cidade e o nicho.
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
                        onClick={() => {
                          hasActiveSearchRef.current = true;
                          setSelectedSegment(segment);
                        }}
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

      {/* The geographical information panel lives on the niche-selection screen. */}
      {/* Choose the open-now filter only after the niche search has returned. */}
      <SearchModeSwitcher mode={mode} onModeChange={onModeChange} />
      {mode === "open" && (
        <p className="search-mode-count" role="status">
          <Clock3 size={15} aria-hidden="true" />
          <span>
            <strong>{openCount} {openCount === 1 ? "empresa marcada como aberta" : "empresas marcadas como abertas"}</strong>
            {" "}entre {results.length} {results.length === 1 ? "resultado carregado" : "resultados carregados"}.
            {unknownHoursCount > 0 && (
              <> {unknownHoursCount} {unknownHoursCount === 1 ? "empresa está" : "empresas estão"} sem horário confirmado.</>
            )}
          </span>
        </p>
      )}

      {providerNotice && (
        <p className="search-provider-notice" role="status">{providerNotice}</p>
      )}
      {searchNotice && (
        <div className="search-cache-notice" role="status">
          <strong>Resultados salvos</strong>
          <span>{searchNotice}</span>
        </div>
      )}

      <div className="search-leads-insights" role="status" aria-label="Resumo dos resultados filtrados">
        <span>Exibidos <strong>{resultsInsights.visible}</strong> de {results.length}</span>
        <span>Sem site identificado <strong>{resultsInsights.noSite}</strong></span>
        <span>Com site <strong>{resultsInsights.withSite}</strong></span>
        <span>Com telefone <strong>{resultsInsights.withPhone}</strong></span>
        <span>Com e-mail <strong>{resultsInsights.withEmail}</strong></span>
        <span>Instagram confirmado <strong>{resultsInsights.instagramConfirmed}</strong></span>
        <span>Instagram possível <strong>{resultsInsights.instagramPossible}</strong></span>
        <span>Fontes: Overture <strong>{resultsInsights.overture}</strong> · Geoapify <strong>{resultsInsights.geoapify}</strong> · Google <strong>{resultsInsights.google}</strong></span>
      </div>

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
          <strong>{mode === "open" ? "Nenhuma empresa marcada como aberta nesta pesquisa" : "Nenhuma empresa encontrada"}</strong>
          <p>
            {mode === "open"
              ? "O resultado considera somente empresas sinalizadas como abertas na última busca. Alterne para Todas as empresas sem realizar outra consulta."
              : "Tente outro segmento ou altere os filtros atuais."}
          </p>
        </div>
      ) : (
        <div className="business-results-shell">
          <div className="business-results">
            {visibleResults.map(({ business, existingLead, chance }) => (
              <BusinessCard
                key={business.placeId}
                business={business}
                segmentLabel={resultsSegment}
                chance={chance}
                existingLead={existingLead}
                onDetails={setDetails}
                instagramChecking={instagramCheckingIds.includes(business.placeId)}
                onWhatsApp={openWhatsApp}
                onMessage={onMessage}
                onAdd={(item) =>
                  onAddLead(withSearchLocation(item, resultsLocation), resultsSegment)
                }
              />
            ))}
          </div>
          <SearchResultsAttribution sources={visibleResults.map(({ business }) => business.source)} />
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
          onPresenceUpdate={(presence) => {
            updateBusinessPresence(details.placeId, presence);
            if (duplicate?.id) onPresenceDiscovered?.(duplicate.id, presence);
          }}
          onAdd={(item) => onAddLead(withSearchLocation(item, resultsLocation), resultsSegment)}
        />
        );
      })()}
    </section>
  );
}

function SearchModeSwitcher({
  mode,
  onModeChange,
}: {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}) {
  return (
    <section className="search-mode-panel" aria-label="Escolha o modo da busca">
      <div className="search-mode-heading">
        <span>COMO VOCÊ QUER PROSPECTAR?</span>
        <p>A mesma pesquisa, duas formas de visualizar os resultados.</p>
      </div>
      <div className="search-mode-options" role="group" aria-label="Modo de prospecção">
        <button
          type="button"
          className={mode === "all" ? "search-mode-option selected" : "search-mode-option"}
          aria-pressed={mode === "all"}
          onClick={() => onModeChange("all")}
        >
          <Search size={19} aria-hidden="true" />
          <span>
            <strong>Todas as empresas</strong>
            <small>Veja todos os resultados e o status de funcionamento.</small>
          </span>
          {mode === "all" && <Check size={16} className="search-mode-check" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={mode === "open" ? "search-mode-option selected" : "search-mode-option"}
          aria-pressed={mode === "open"}
          onClick={() => onModeChange("open")}
        >
          <Clock3 size={19} aria-hidden="true" />
          <span>
            <strong>Abertos Agora</strong>
            <small>Mostre apenas empresas identificadas como abertas.</small>
          </span>
          {mode === "open" && <Check size={16} className="search-mode-check" aria-hidden="true" />}
        </button>
      </div>
      <p className="search-mode-note">
        {mode === "open"
          ? "Filtro aplicado aos resultados já carregados. A indicação de aberto vem da última pesquisa e pode mudar; alternar o modo não realiza outra consulta."
          : "O status de aberto ou fechado aparece nos resultados disponíveis. Mudar o modo não cria uma nova pesquisa."}
      </p>
    </section>
  );
}

function instagramHandle(business: BusinessSearchResult) {
  if (business.instagramUsername?.trim()) return business.instagramUsername.trim().replace(/^@/, "");
  try {
    return new URL(business.instagram ?? "").pathname.split("/").filter(Boolean)[0] ?? "Instagram";
  } catch {
    return "Instagram";
  }
}

function BusinessCard({
  business,
  segmentLabel,
  chance,
  existingLead,
  onDetails,
  instagramChecking,
  onWhatsApp,
  onMessage,
  onAdd,
}: {
  business: BusinessSearchResult;
  segmentLabel: string;
  chance: LeadChanceResult;
  existingLead: ExistingLeadIdentity | null;
  onDetails: (business: BusinessSearchResult) => void;
  instagramChecking: boolean;
  onWhatsApp: (business: BusinessSearchResult) => void;
  onMessage: (target: SearchMessageTarget) => void;
  onAdd: (business: BusinessSearchResult) => Promise<BusinessAddResult>;
}) {
  const commercialPhone = existingLead?.phone || business.phone || "";
  const normalizedCommercialPhone = normalizeBrazilianPhone(commercialPhone);
  const canSendPreparedMessage =
    normalizedCommercialPhone.length === 12 ||
    normalizedCommercialPhone.length === 13;
  const showPreparedMessageAction =
    canSendPreparedMessage &&
    (!existingLead || existingLead.status === "send_message");
  const [addingLead, setAddingLead] = useState(false);
  const [addError, setAddError] = useState("");

  async function addBusiness() {
    if (addingLead || existingLead) return;
    setAddingLead(true);
    setAddError("");
    try {
      const result = await onAdd(business);
      if (!result.ok) setAddError(result.message);
    } catch {
      setAddError("Não foi possível adicionar a empresa. Tente novamente.");
    } finally {
      setAddingLead(false);
    }
  }

  return (
    <article className={"business-card business-card--" + (business.source === "geoapify" || business.source === "overture" ? "open" : "places")}>
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
            <span className="business-category-label">{segmentLabel}</span>
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
          <GoogleMapsLink business={business} />
          {hasIdentifiedWebsite(business) ? (
            <a href={safeExternalHref(business.website) ?? undefined} target="_blank" rel="noopener noreferrer">
              Site <ExternalLink size={12} />
            </a>
          ) : (
            <span>Site não identificado</span>
          )}
          {hasConfirmedInstagram(business) && business.instagram ? (
            <a
              className="business-instagram-handle"
              href={safeExternalHref(business.instagram) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir Instagram confirmado"
            >
              <Instagram size={12} aria-hidden="true" />
              @{instagramHandle(business)} <ExternalLink size={12} />
            </a>
          ) : (business.instagramCandidates?.length ?? 0) > 0 ? (
            <a
              className="business-instagram-handle"
              href={safeExternalHref(business.instagramCandidates?.[0]?.url) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              title="Possível perfil do Instagram — identidade da empresa ainda não confirmada"
            >
              <Instagram size={12} aria-hidden="true" />
              @{business.instagramCandidates?.[0]?.username}
              <span className="business-instagram-possible">possível</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : instagramChecking ? (
            <span role="status">Verificando Instagram…</span>
          ) : business.instagramCheckedAt ? (
            <span>Instagram não identificado</span>
          ) : (
            <span>Instagram não pesquisado</span>
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
            onClick={() => void addBusiness()}
            disabled={addingLead}
          >
            {addingLead ? "Salvando..." : "Adicionar aos meus leads"}
          </button>
        )}
        {addError && <p className="business-card-save-error" role="alert">{addError}</p>}
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
              ? "Credencial da pesquisa indisponível"
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
