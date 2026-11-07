import { isAllowedBrowserOrigin as isTrustedBrowserOrigin } from "../_shared/allowed-browser-origins.ts";
import type { OpeningHoursSnapshot } from "../_shared/open-now.ts";
import {
  findBrazilianState,
  normalizeBrazilianStateCode,
} from "../_shared/brazil-locations.ts";
import { resolveSearchSegment, searchTextForSegment } from "../_shared/niche-catalog.ts";
type BusinessSearchResult = {
  placeId: string;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  internationalPhone: string | null;
  rating: number | null;
  reviewCount: number | null;
  isOpenNow: boolean | null;
  openingHours: string[];
  currentOpeningHours: OpeningHoursSnapshot | null;
  regularOpeningHours: OpeningHoursSnapshot | null;
  website: string | null;
  instagram: string | null;
  googleMapsUrl: string | null;
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
};

type GoogleText = { text?: string };
type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};
type GoogleOpeningHours = OpeningHoursSnapshot;
type GooglePlace = {
  id?: string;
  displayName?: GoogleText;
  primaryTypeDisplayName?: GoogleText;
  types?: string[];
  editorialSummary?: GoogleText;
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: GoogleOpeningHours;
  regularOpeningHours?: GoogleOpeningHours;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};
type GoogleResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type EnrichmentMethod =
  | "placeId"
  | "phone"
  | "name-location"
  | "name-segment-location";
type EnrichmentConfidence = "high" | "probable" | "uncertain";
type EnrichmentCandidate = {
  business: BusinessSearchResult;
  method: EnrichmentMethod;
  confidence: EnrichmentConfidence;
  score: number;
  reasons: string[];
  phoneConflict: boolean;
};

const TEXT_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.editorialSummary",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.currentOpeningHours",
  "places.regularOpeningHours",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.location",
  "nextPageToken",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "primaryTypeDisplayName",
  "types",
  "editorialSummary",
  "formattedAddress",
  "addressComponents",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "rating",
  "userRatingCount",
  "businessStatus",
  "currentOpeningHours",
  "regularOpeningHours",
  "websiteUri",
  "googleMapsUri",
  "location",
].join(",");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function isAllowedBrowserOrigin(origin: string) {
  return isTrustedBrowserOrigin(
    origin,
    Deno.env.get("APP_ALLOWED_ORIGINS") ?? "",
  );
}

function withRequestCors(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin")?.trim() ?? "";
  headers.delete("Access-Control-Allow-Origin");

  if (origin && isAllowedBrowserOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    const currentVary = headers.get("Vary");
    headers.set("Vary", currentVary ? `${currentVary}, Origin` : "Origin");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsPreflight(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isAllowedBrowserOrigin(origin)) {
    return new Response(null, { status: 403 });
  }

  return withRequestCors(
    new Response(null, {
      status: 204,
      headers: corsHeaders,
    }),
    request,
  );
}


const LEGACY_DEFAULT_CITY = "Lavras";
const LEGACY_DEFAULT_STATE = "MG";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const MAX_REQUEST_BYTES = 64 * 1024;

async function readJsonBody(request: Request) {
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_REQUEST_BYTES) {
    return { ok: false as const, tooLarge: true as const };
  }

  try {
    return {
      ok: true as const,
      value: JSON.parse(bodyText) as unknown,
    };
  } catch {
    return { ok: false as const, tooLarge: false as const };
  }
}

async function claimApiBudget(
  userId: string,
  bucket: "places_search" | "lead_enrichment" | "presence_discovery" | "presence_site",
) {
  try {
    const response = await adminRest("rpc/claim_api_request_for_user", {
      method: "POST",
      body: JSON.stringify({
        p_user_id: userId,
        p_bucket: bucket,
      }),
    });
    if (!response?.ok) return null;
    return Boolean(await response.json());
  } catch {
    return null;
  }
}

type SaasQuota = {
  plan: "free" | "pro" | "advanced";
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  usage_date: string;
};
type SaasClaim = SaasQuota & { allowed_place_ids: string[]; newly_unlocked: number };
const SAAS_STAGING_URL = "https://prlrxjothrslhswpkoza.supabase.co";

function saasQuotasEnabled(): boolean {
  const projectUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  // Staging runs quotas by default. Production requires an explicit server flag.
  return projectUrl === SAAS_STAGING_URL ||
    Deno.env.get("SAAS_DAILY_QUOTAS_ENABLED") === "true";
}

async function peekSaasQuota(userId: string): Promise<SaasQuota | null> {
  try {
    const response = await adminRest("rpc/peek_daily_leads_for_user", {
      method: "POST",
      body: JSON.stringify({ p_user_id: userId }),
    });
    if (!response?.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const item = data as Partial<SaasQuota>;
    if (!["free", "pro", "advanced"].includes(item.plan ?? "") ||
        !Number.isInteger(item.daily_limit) || !Number.isInteger(item.used_today) ||
        !Number.isInteger(item.remaining_today) || typeof item.usage_date !== "string") {
      return null;
    }
    return item as SaasQuota;
  } catch {
    return null;
  }
}

async function claimSaasLeads(userId: string, placeIds: string[]): Promise<SaasClaim | null> {
  try {
    const response = await adminRest("rpc/claim_daily_leads_for_user", {
      method: "POST",
      body: JSON.stringify({ p_user_id: userId, p_place_ids: placeIds }),
    });
    if (!response?.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const item = data as Partial<SaasClaim>;
    if (!["free", "pro", "advanced"].includes(item.plan ?? "") ||
        !Number.isInteger(item.daily_limit) || !Number.isInteger(item.used_today) ||
        !Number.isInteger(item.remaining_today) || !Number.isInteger(item.newly_unlocked) ||
        !Array.isArray(item.allowed_place_ids) ||
        !item.allowed_place_ids.every((id) => typeof id === "string")) {
      return null;
    }
    return item as SaasClaim;
  } catch {
    return null;
  }
}

function failure(
  code:
    | "NOT_CONFIGURED"
    | "AUTH_REQUIRED"
    | "FORBIDDEN"
    | "GOOGLE_AUTH"
    | "API_NOT_ENABLED"
    | "BILLING_REQUIRED"
    | "INVALID_REQUEST"
    | "QUOTA"
    | "DAILY_LEAD_LIMIT"
    | "FEATURE_NOT_AVAILABLE"
    | "REQUEST_FAILED",
  message: string,
  status: number,
) {
  return json({ ok: false, code, message }, status);
}

function getAllowedPublishableKeys() {
  const keys: string[] = [];

  const currentKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (currentKeys) {
    try {
      const parsed = JSON.parse(currentKeys) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.trim()) keys.push(value.trim());
      }
    } catch {
      // Fall through to the legacy anon key when present.
    }
  }

  const legacyAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacyAnonKey?.trim()) keys.push(legacyAnonKey.trim());

  return Array.from(new Set(keys));
}

function hasValidClientKey(request: Request) {
  const allowedKeys = getAllowedPublishableKeys();
  if (allowedKeys.length === 0) return false;

  const providedKey = request.headers.get("apikey")?.trim();
  return Boolean(providedKey && allowedKeys.includes(providedKey));
}

function firstNamedSecret(raw: string | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const preferred = parsed.default;
    if (typeof preferred === "string" && preferred.trim()) {
      return preferred.trim();
    }
    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    return null;
  }
  return null;
}

function adminConfig() {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!url) return null;

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) {
    return {
      url,
      key: legacy,
      authorization: `Bearer ${legacy}`,
    };
  }

  const modern = firstNamedSecret(Deno.env.get("SUPABASE_SECRET_KEYS"));
  if (!modern) return null;
  return { url, key: modern, authorization: null };
}

async function adminRest(path: string, init: RequestInit = {}) {
  const config = adminConfig();
  if (!config) return null;

  return fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      ...(config.authorization
        ? { Authorization: config.authorization }
        : {}),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function component(place: GooglePlace, type: string, short = false) {
  const item = place.addressComponents?.find((entry) =>
    entry.types?.includes(type)
  );
  return (short ? item?.shortText : item?.longText)?.trim() || null;
}

function parseNeighborhood(place: GooglePlace) {
  return (
    component(place, "neighborhood") ??
    component(place, "sublocality_level_1") ??
    component(place, "sublocality")
  );
}

function parseCity(place: GooglePlace) {
  return (
    component(place, "locality") ??
    component(place, "administrative_area_level_2")
  );
}

function websiteAndInstagram(value: string | undefined) {
  const website = value?.trim() || null;
  if (!website) return { website: null, instagram: null };

  try {
    const host = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "instagram.com") {
      return { website: null, instagram: website };
    }
  } catch {
    return { website, instagram: null };
  }

  return { website, instagram: null };
}

function parsePlace(place: GooglePlace): BusinessSearchResult | null {
  const placeId = place.id?.trim();
  const name = place.displayName?.text?.trim();
  if (!placeId || !name) return null;

  const online = websiteAndInstagram(place.websiteUri);

  return {
    placeId,
    name,
    primaryCategory: place.primaryTypeDisplayName?.text?.trim() || null,
    categories: place.types ?? [],
    description: place.editorialSummary?.text?.trim() || null,
    address: place.formattedAddress?.trim() || null,
    neighborhood: parseNeighborhood(place),
    city: parseCity(place),
    state:
      normalizeBrazilianStateCode(
        component(place, "administrative_area_level_1", true) ??
          component(place, "administrative_area_level_1"),
      ) || component(place, "administrative_area_level_1"),
    phone: place.nationalPhoneNumber?.trim() || null,
    internationalPhone: place.internationalPhoneNumber?.trim() || null,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount:
      typeof place.userRatingCount === "number"
        ? place.userRatingCount
        : null,
    isOpenNow:
      typeof place.currentOpeningHours?.openNow === "boolean"
        ? place.currentOpeningHours.openNow
        : null,
    openingHours:
      place.regularOpeningHours?.weekdayDescriptions ??
      place.currentOpeningHours?.weekdayDescriptions ??
      [],
    currentOpeningHours: place.currentOpeningHours ?? null,
    regularOpeningHours: place.regularOpeningHours ?? null,
    website: online.website,
    instagram: online.instagram,
    googleMapsUrl: place.googleMapsUri?.trim() || null,
    businessStatus: place.businessStatus?.trim() || null,
    latitude:
      typeof place.location?.latitude === "number"
        ? place.location.latitude
        : null,
    longitude:
      typeof place.location?.longitude === "number"
        ? place.location.longitude
        : null,
  };
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCityInput(value: unknown) {
  if (typeof value !== "string") return null;
  const city = value.trim().replace(/\s+/g, " ");
  if (
    city.length < 2 ||
    city.length > 120 ||
    !/^[\p{L}\s.'’-]+$/u.test(city)
  ) {
    return null;
  }
  return city;
}

function normalizeStateInput(value: unknown) {
  if (typeof value !== "string") return null;
  return normalizeBrazilianStateCode(value) || null;
}

function addressHasState(
  address: string | null | undefined,
  state: string,
) {
  const stateInfo = findBrazilianState(state);
  if (!stateInfo) return false;

  const normalizedAddress = ` ${normalize(address)} `;
  return (
    normalizedAddress.includes(` ${normalize(stateInfo.name)} `) ||
    normalizedAddress.includes(` ${normalize(stateInfo.code)} `)
  );
}

function locationMatches(
  place: BusinessSearchResult,
  city: string,
  state: string,
) {
  const expectedCity = normalize(city);
  const expectedState = normalizeBrazilianStateCode(state);
  const actualCity = normalize(place.city);
  const normalizedAddress = normalize(place.address);

  const cityMatches = actualCity
    ? actualCity === expectedCity
    : normalizedAddress.includes(expectedCity);

  const actualState = normalizeBrazilianStateCode(place.state);
  const stateMatches = actualState
    ? actualState === expectedState
    : addressHasState(place.address, expectedState);

  return cityMatches && stateMatches;
}

function requiredSearchLocation(body: Record<string, unknown>) {
  const city = normalizeCityInput(body.city);
  const state = normalizeStateInput(body.state);
  if (!city || !state) return null;
  return { city, state };
}

function enrichmentLocation(lead: {
  city?: unknown;
  state?: unknown;
}) {
  const hasCity =
    typeof lead.city === "string" && Boolean(lead.city.trim());
  const hasState =
    typeof lead.state === "string" && Boolean(lead.state.trim());

  if (!hasCity && !hasState) {
    return { city: LEGACY_DEFAULT_CITY, state: LEGACY_DEFAULT_STATE };
  }

  if (!hasCity && hasState) return null;

  const city = normalizeCityInput(lead.city);
  const state = hasState
    ? normalizeStateInput(lead.state)
    : LEGACY_DEFAULT_STATE;

  if (!city || !state) return null;
  return { city, state };
}

function validSearchSegment(value: string) {
  return resolveSearchSegment(value) !== null;
}

function stateName(state: string) {
  return findBrazilianState(state)?.name ?? state;
}

function normalizeBrazilianPhone(value: string | null | undefined) {
  let digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  digits = digits.replace(/^0+/, "");
  if (!digits.startsWith("55")) digits = "55" + digits;

  return digits;
}

function phoneTextQuery(value: string) {
  const digits = normalizeBrazilianPhone(value);
  if (!digits || digits.length < 12 || digits.length > 13) return null;
  return `+55 ${digits.slice(2)}`;
}

function phoneMatch(
  manualPhone: string | null | undefined,
  business: BusinessSearchResult,
) {
  const manual = normalizeBrazilianPhone(manualPhone);
  if (!manual) return { exact: false, partial: false };

  const candidates = [business.phone, business.internationalPhone]
    .map(normalizeBrazilianPhone)
    .filter(Boolean);

  if (candidates.includes(manual)) return { exact: true, partial: false };

  const manualTail = manual.slice(-8);
  const partial = candidates.some(
    (candidate) =>
      manualTail.length === 8 && candidate.slice(-8) === manualTail,
  );

  return { exact: false, partial };
}

function tokenSimilarity(a: string, b: string) {
  const left = new Set(normalize(a).split(" ").filter((token) => token.length > 2));
  const right = new Set(normalize(b).split(" ").filter((token) => token.length > 2));

  if (!left.size || !right.size) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  return intersection / Math.max(left.size, right.size);
}

function nameScore(manualName: string, googleName: string) {
  const manual = normalize(manualName);
  const google = normalize(googleName);

  if (!manual || !google) return 0;
  if (manual === google) return 3;

  if (
    Math.min(manual.length, google.length) >= 5 &&
    (manual.includes(google) || google.includes(manual))
  ) {
    return 2;
  }

  const similarity = tokenSimilarity(manual, google);
  if (similarity >= 0.6) return 2;
  if (similarity >= 0.34) return 1;
  return 0;
}

function segmentCompatible(segment: string, business: BusinessSearchResult) {
  const wanted = normalize(segment);
  if (!wanted) return false;

  const haystack = normalize(
    [
      business.primaryCategory ?? "",
      ...business.categories.map((item) => item.replaceAll("_", " ")),
    ].join(" "),
  );

  if (!haystack) return false;
  const tokens = wanted.split(" ").filter((token) => token.length > 3);
  return tokens.some((token) => haystack.includes(token));
}

function scoreCandidate(
  business: BusinessSearchResult,
  lead: {
    company: string;
    segment: string;
    phone?: string | null;
    city: string;
    state: string;
  },
  method: EnrichmentMethod,
): EnrichmentCandidate {
  const phone = phoneMatch(lead.phone, business);
  const name = nameScore(lead.company, business.name);
  const sameLocation = locationMatches(
    business,
    lead.city,
    lead.state,
  );
  const segment = segmentCompatible(lead.segment, business);

  let score = 0;
  const reasons: string[] = [];

  if (method === "placeId") {
    score += 10;
    reasons.push("O placeId já associado ao lead identificou esta empresa.");
  }

  if (phone.exact) {
    score += 6;
    reasons.push(
      "O telefone encontrado no Google corresponde ao telefone cadastrado neste lead.",
    );
  } else if (phone.partial) {
    score += 2;
    reasons.push("O telefone possui os mesmos dígitos finais do número cadastrado.");
  }

  if (name === 3) {
    score += 3;
    reasons.push("O nome da empresa corresponde ao nome cadastrado.");
  } else if (name === 2) {
    score += 2;
    reasons.push("O nome encontrado é muito semelhante ao nome cadastrado.");
  } else if (name === 1) {
    score += 1;
    reasons.push("O nome encontrado possui termos em comum com o lead.");
  }

  if (sameLocation) {
    score += 1;
    reasons.push(
      `A empresa encontrada está na localização esperada: ${lead.city} - ${lead.state}.`,
    );
  }

  if (segment) {
    score += 1;
    reasons.push("A categoria encontrada é compatível com o segmento cadastrado.");
  }

  const confidence: EnrichmentConfidence =
    method === "placeId" || phone.exact
      ? "high"
      : score >= 4
        ? "probable"
        : "uncertain";

  const googlePhone =
    normalizeBrazilianPhone(business.phone) ||
    normalizeBrazilianPhone(business.internationalPhone);
  const manualPhone = normalizeBrazilianPhone(lead.phone);

  return {
    business,
    method,
    confidence,
    score,
    reasons:
      reasons.length > 0
        ? reasons
        : ["Há poucos sinais objetivos para confirmar esta correspondência."],
    phoneConflict: Boolean(
      manualPhone &&
        googlePhone &&
        manualPhone !== googlePhone &&
        !phone.partial,
    ),
  };
}

function uniqueCandidates(candidates: EnrichmentCandidate[]) {
  const priority: Record<EnrichmentMethod, number> = {
    placeId: 4,
    phone: 3,
    "name-location": 2,
    "name-segment-location": 1,
  };

  const map = new Map<string, EnrichmentCandidate>();

  for (const candidate of candidates) {
    const previous = map.get(candidate.business.placeId);
    if (
      !previous ||
      candidate.score > previous.score ||
      (candidate.score === previous.score &&
        priority[candidate.method] > priority[previous.method])
    ) {
      map.set(candidate.business.placeId, candidate);
    }
  }

  return Array.from(map.values())
    .filter((candidate) => candidate.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function classifyGoogleError(
  response: Response,
  payload: GoogleResponse | GooglePlace,
) {
  const error =
    "error" in payload && payload.error && typeof payload.error === "object"
      ? payload.error
      : undefined;
  const googleStatus = error?.status ?? "";
  const message = (error?.message ?? "").toLowerCase();

  if (response.status === 429 || googleStatus === "RESOURCE_EXHAUSTED") {
    return failure(
      "QUOTA",
      "O limite da busca foi atingido. Tente novamente mais tarde.",
      429,
    );
  }

  if (message.includes("billing")) {
    return failure(
      "BILLING_REQUIRED",
      "O faturamento do Google Maps Platform precisa estar ativo para realizar buscas.",
      503,
    );
  }

  if (
    message.includes("has not been used") ||
    message.includes("not enabled") ||
    message.includes("api has not been enabled")
  ) {
    return failure(
      "API_NOT_ENABLED",
      "A Places API (New) não está disponível no projeto Google configurado.",
      503,
    );
  }

  if (
    response.status === 401 ||
    googleStatus === "UNAUTHENTICATED" ||
    googleStatus === "PERMISSION_DENIED"
  ) {
    return failure(
      "GOOGLE_AUTH",
      "O Google recusou a credencial configurada para a busca.",
      502,
    );
  }

  if (response.status === 400 || googleStatus === "INVALID_ARGUMENT") {
    return failure(
      "INVALID_REQUEST",
      "A pesquisa enviada ao Google não pôde ser processada.",
      400,
    );
  }

  return failure(
    "REQUEST_FAILED",
    "Não foi possível consultar o Google Places agora. Tente novamente.",
    502,
  );
}

async function textSearch(
  googleApiKey: string,
  textQuery: string,
  pageSize = 10,
  pageToken?: string,
) {
  const body: Record<string, unknown> = {
    textQuery,
    pageSize,
    languageCode: "pt-BR",
    regionCode: "BR",
  };

  if (pageToken) body.pageToken = pageToken;

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
        "X-Goog-FieldMask": TEXT_FIELD_MASK,
      },
      body: JSON.stringify(body),
    },
  );

  let payload: GoogleResponse;
  try {
    payload = (await response.json()) as GoogleResponse;
  } catch {
    return {
      ok: false as const,
      response: failure(
        "REQUEST_FAILED",
        "O Google Places respondeu de forma inesperada.",
        502,
      ),
    };
  }

  if (!response.ok) {
    return {
      ok: false as const,
      response: classifyGoogleError(response, payload),
    };
  }

  return {
    ok: true as const,
    results: (payload.places ?? [])
      .map(parsePlace)
      .filter((place): place is BusinessSearchResult => Boolean(place)),
    nextPageToken: payload.nextPageToken ?? null,
  };
}

async function placeDetails(googleApiKey: string, placeId: string) {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    },
  );

  let payload: GooglePlace;
  try {
    payload = (await response.json()) as GooglePlace;
  } catch {
    return {
      ok: false as const,
      response: failure(
        "REQUEST_FAILED",
        "O Google Places respondeu de forma inesperada.",
        502,
      ),
    };
  }

  if (!response.ok) {
    return {
      ok: false as const,
      response: classifyGoogleError(response, payload),
    };
  }

  const parsed = parsePlace(payload);
  if (!parsed) {
    return {
      ok: false as const,
      response: failure(
        "REQUEST_FAILED",
        "O Google Places não retornou dados válidos para esta empresa.",
        502,
      ),
    };
  }

  return { ok: true as const, business: parsed };
}

async function runSegmentSearch(
  googleApiKey: string,
  body: Record<string, unknown>,
  userId: string,
) {
  const segment = body.segment;
  const pageToken = body.pageToken;
  const location = requiredSearchLocation(body);

  if (
    typeof segment !== "string" ||
    segment.trim().length < 2 ||
    segment.trim().length > 120 ||
    !validSearchSegment(segment)
  ) {
    return failure(
      "INVALID_REQUEST",
      "Informe um segmento válido para realizar a busca.",
      400,
    );
  }

  if (!location) {
    return failure(
      "INVALID_REQUEST",
      "Informe uma cidade e uma UF válidas do Brasil para realizar a busca.",
      400,
    );
  }

  if (
    pageToken !== undefined &&
    (typeof pageToken !== "string" ||
      pageToken.trim().length === 0 ||
      pageToken.length > 4096)
  ) {
    return failure(
      "INVALID_REQUEST",
      "O token de continuação da busca é inválido.",
      400,
    );
  }

  const searched = await textSearch(
    googleApiKey,
    `${searchTextForSegment(segment.trim()) ?? segment.trim()} em ${location.city}, ${stateName(location.state)}, Brasil`,
    20,
    typeof pageToken === "string" ? pageToken.trim() : undefined,
  );

  if (!searched.ok) return searched.response;

  const matchedResults = searched.results.filter((business) =>
    locationMatches(business, location.city, location.state)
  );

  if (!saasQuotasEnabled()) {
    return json({
      ok: true, results: matchedResults,
      nextPageToken: searched.nextPageToken,
    });
  }

  // Never return a Google business not authorized by the server's atomic quota.
  const claim = await claimSaasLeads(userId, matchedResults.map((business) => business.placeId));
  if (!claim) {
    return failure("REQUEST_FAILED", "Não foi possível registrar os leads na sua cota diária.", 503);
  }
  const allowed = new Set(claim.allowed_place_ids);
  return json({
    ok: true,
    results: matchedResults.filter((business) => allowed.has(business.placeId)),
    nextPageToken: claim.remaining_today > 0 ? searched.nextPageToken : null,
    quota: {
      plan: claim.plan,
      daily_limit: claim.daily_limit,
      used_today: claim.used_today,
      remaining_today: claim.remaining_today,
      usage_date: claim.usage_date,
    },
  });
}

async function runLeadEnrichment(
  googleApiKey: string,
  body: Record<string, unknown>,
) {
  const leadValue = body.lead;
  if (!leadValue || typeof leadValue !== "object") {
    return failure(
      "INVALID_REQUEST",
      "Informe os dados do lead para buscar informações.",
      400,
    );
  }

  const lead = leadValue as {
    company?: unknown;
    segment?: unknown;
    phone?: unknown;
    placeId?: unknown;
    city?: unknown;
    state?: unknown;
  };

  if (
    typeof lead.company !== "string" ||
    lead.company.trim().length < 2 ||
    lead.company.length > 180 ||
    typeof lead.segment !== "string" ||
    lead.segment.trim().length < 2 ||
    lead.segment.length > 160
  ) {
    return failure(
      "INVALID_REQUEST",
      "Nome e segmento do lead são necessários para buscar informações.",
      400,
    );
  }

  if (
    lead.phone !== undefined &&
    lead.phone !== null &&
    typeof lead.phone !== "string"
  ) {
    return failure(
      "INVALID_REQUEST",
      "O telefone informado para o lead é inválido.",
      400,
    );
  }

  if (
    lead.placeId !== undefined &&
    lead.placeId !== null &&
    (typeof lead.placeId !== "string" ||
      lead.placeId.trim().length < 3 ||
      lead.placeId.length > 300)
  ) {
    return failure(
      "INVALID_REQUEST",
      "O identificador Google desta empresa é inválido.",
      400,
    );
  }

  const location = enrichmentLocation(lead);
  if (!location) {
    return failure(
      "INVALID_REQUEST",
      "A cidade/UF deste lead não é válida para a busca no Brasil.",
      400,
    );
  }

  const normalizedLead = {
    company: lead.company.trim(),
    segment: lead.segment.trim(),
    phone: typeof lead.phone === "string" ? lead.phone.trim() : "",
    city: location.city,
    state: location.state,
  };

  const attemptedLayers: EnrichmentMethod[] = [];

  if (typeof lead.placeId === "string" && lead.placeId.trim()) {
    attemptedLayers.push("placeId");
    const details = await placeDetails(googleApiKey, lead.placeId.trim());
    if (!details.ok) return details.response;

    return json({
      ok: true,
      mode: "lead-enrichment",
      candidates: [
        scoreCandidate(details.business, normalizedLead, "placeId"),
      ],
      attemptedLayers,
    });
  }

  const combined: EnrichmentCandidate[] = [];
  const phoneQuery =
    normalizedLead.phone ? phoneTextQuery(normalizedLead.phone) : null;

  if (normalizedLead.phone && !phoneQuery) {
    return failure(
      "INVALID_REQUEST",
      "O telefone cadastrado não possui um formato brasileiro válido para pesquisa.",
      400,
    );
  }

  if (phoneQuery) {
    attemptedLayers.push("phone");
    const searched = await textSearch(googleApiKey, phoneQuery, 10);
    if (!searched.ok) return searched.response;

    for (const business of searched.results.filter((business) =>
      locationMatches(
        business,
        normalizedLead.city,
        normalizedLead.state,
      )
    )) {
      combined.push(
        scoreCandidate(business, normalizedLead, "phone"),
      );
    }

    const exactMatches = combined.filter((candidate) =>
      phoneMatch(normalizedLead.phone, candidate.business).exact
    );

    if (exactMatches.length > 0) {
      return json({
        ok: true,
        mode: "lead-enrichment",
        candidates: uniqueCandidates(exactMatches),
        attemptedLayers,
      });
    }
  }

  attemptedLayers.push("name-location");
  const byName = await textSearch(
    googleApiKey,
    `${normalizedLead.company} em ${normalizedLead.city}, ${stateName(normalizedLead.state)}, Brasil`,
    10,
  );
  if (!byName.ok) return byName.response;

  for (const business of byName.results.filter((business) =>
      locationMatches(
        business,
        normalizedLead.city,
        normalizedLead.state,
      )
    )) {
    combined.push(
      scoreCandidate(business, normalizedLead, "name-location"),
    );
  }

  let candidates = uniqueCandidates(combined);
  if (
    candidates.length > 0 &&
    candidates[0].confidence !== "uncertain"
  ) {
    return json({
      ok: true,
      mode: "lead-enrichment",
      candidates,
      attemptedLayers,
    });
  }

  attemptedLayers.push("name-segment-location");
  const bySegment = await textSearch(
    googleApiKey,
    `${normalizedLead.company} ${normalizedLead.segment} em ${normalizedLead.city}, ${stateName(normalizedLead.state)}, Brasil`,
    10,
  );
  if (!bySegment.ok) return bySegment.response;

  for (const business of bySegment.results.filter((business) =>
      locationMatches(
        business,
        normalizedLead.city,
        normalizedLead.state,
      )
    )) {
    combined.push(
      scoreCandidate(
        business,
        normalizedLead,
        "name-segment-location",
      ),
    );
  }

  candidates = uniqueCandidates(combined);

  return json({
    ok: true,
    mode: "lead-enrichment",
    candidates,
    attemptedLayers,
  });
}


type PresenceConfidence = "high" | "medium" | "low";
type PresenceSource =
  | "google_places"
  | "official_website"
  | "web_search"
  | "manual_confirmation"
  | "existing_data";

type InstagramCandidate = {
  url: string;
  username: string;
  displayName?: string | null;
  confidence: "medium" | "low";
  score: number;
  signals: string[];
  evidenceUrls: string[];
};

type BusinessPresence = {
  instagramUrl: string | null;
  instagramUsername: string | null;
  instagramDisplayName?: string | null;
  instagramConfidence: PresenceConfidence | null;
  instagramSource: PresenceSource | null;
  instagramCheckedAt: string;
  instagramCandidates: InstagramCandidate[];
  instagramRejectedUrls: string[];
  instagramSearchSignature: string | null;
  instagramNeedsReview: boolean;
};

type RawWebCandidate = {
  instagramUrl: string;
  username: string;
  publicName: string;
  publicText: string;
  phones: string[];
  locations: string[];
  websites: string[];
  categories: string[];
  associatedNames: string[];
  evidenceUrls: string[];
};

type OpenAIWebResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    action?: {
      type?: string;
      sources?: Array<{ url?: string }>;
    };
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; url?: string }>;
    }>;
  }>;
  error?: { message?: string; code?: string; type?: string };
};

const INSTAGRAM_RESERVED_PATHS = new Set([
  "accounts",
  "about",
  "developer",
  "developers",
  "direct",
  "directory",
  "explore",
  "legal",
  "p",
  "privacy",
  "reel",
  "reels",
  "stories",
  "terms",
  "tv",
  "share",
  "static",
  "challenge",
  "oauth",
  "api",
  "tags",
  "locations",
]);

const GENERIC_NAME_TOKENS = new Set([
  "studio",
  "clinica",
  "saude",
  "estetica",
  "restaurante",
  "gourmet",
  "barbearia",
  "central",
  "salao",
  "beleza",
  "center",
  "centro",
]);

function canonicalInstagramProfile(value: string | null | undefined) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
    if (host !== "instagram.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;

    const username = parts[0].trim();
    if (
      !username ||
      username.length > 30 ||
      INSTAGRAM_RESERVED_PATHS.has(username.toLowerCase()) ||
      !/^[A-Za-z0-9._]+$/.test(username)
    ) {
      return null;
    }

    return `https://www.instagram.com/${username}/`;
  } catch {
    return null;
  }
}

function instagramUsername(value: string | null | undefined) {
  const profile = canonicalInstagramProfile(value);
  if (!profile) return null;
  return new URL(profile).pathname.split("/").filter(Boolean)[0] ?? null;
}

function blockedIpv4(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((part) => part > 255)) return true;

  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function blockedIpv6(host: string) {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("2001:db8")
  );
}

function isBlockedWebsiteHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "metadata.google" ||
    host === "instance-data" ||
    blockedIpv4(host) ||
    blockedIpv6(host)
  );
}

async function hostnameResolvesPublicly(hostname: string) {
  if (blockedIpv4(hostname) || blockedIpv6(hostname)) return false;

  const results = await Promise.allSettled([
    Deno.resolveDns(hostname, "A"),
    Deno.resolveDns(hostname, "AAAA"),
  ]);
  const addresses = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  if (addresses.length === 0) return false;
  return addresses.every(
    (address) => !blockedIpv4(address) && !blockedIpv6(address),
  );
}

function safePublicWebsite(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (isBlockedWebsiteHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function readLimitedHtml(response: Response, maxBytes = 1_500_000) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const remaining = maxBytes - total;
      const chunk =
        value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.byteLength;

      if (value.byteLength > remaining) break;
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

async function fetchOfficialHtml(value: string, timeoutMs = 6_000) {
  let current = safePublicWebsite(value);
  if (!current) return null;

  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (!(await hostnameResolvesPublicly(current.hostname))) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "JanuarioLeads/1.0 business-presence-check",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        const next = safePublicWebsite(new URL(location, current).toString());
        if (!next) return null;
        current = next;
        continue;
      }

      if (!response.ok) return null;

      const contentType =
        response.headers.get("content-type")?.toLowerCase() ?? "";
      if (
        contentType &&
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        return null;
      }

      const length = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(length) && length > 2_000_000) return null;

      return {
        html: await readLimitedHtml(response),
        finalUrl: current,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

function htmlHrefValues(html: string) {
  const values: string[] = [];
  const regex = /href\s*=\s*(["'])(.*?)\1/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null && values.length < 500) {
    const href = match[2]
      .replace(/&amp;/gi, "&")
      .replace(/&#x2F;/gi, "/")
      .trim();
    if (href) values.push(href);
  }

  return values;
}

function instagramProfilesFromOfficialHtml(html: string, baseUrl: URL) {
  const profiles = new Set<string>();
  // Many sites embed social links inside JSON-LD or escaped JavaScript, not <a> tags.
  const decoded = html
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2f;|&#47;/gi, "/")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/%2f/gi, "/")
    .replace(/%3a/gi, ":");

  for (const href of htmlHrefValues(decoded)) {
    try {
      const profile = canonicalInstagramProfile(new URL(href, baseUrl).toString());
      if (profile) profiles.add(profile);
    } catch {
      // Ignore malformed public links.
    }
  }

  const mentions = /(?:https?:\/\/|\/\/)(?:www\.|m\.)?instagram\.com\/[A-Za-z0-9._]{1,30}(?:\/)?/gi;
  for (const match of decoded.matchAll(mentions)) {
    const profile = canonicalInstagramProfile(
      match[0].startsWith("//") ? "https:" + match[0] : match[0],
    );
    if (profile) profiles.add(profile);
    if (profiles.size >= 10) break;
  }

  return Array.from(profiles);
}

const OFFICIAL_SOCIAL_PAGES = /(?:^|[/_-])(contato|contact|fale-conosco|faleconosco|sobre|about|redes-sociais|social|links|link-na-bio)(?:[/_.-]|$)/i;
const BIO_LINK_HOSTS = new Set([
  "linktr.ee",
  "bio.site",
  "beacons.ai",
  "taplink.cc",
  "carrd.co",
  "lnk.bio",
  "linkbio.co",
  "msha.ke",
  "solo.to",
]);

function discoverOfficialSupplementaryPages(html: string, baseUrl: URL, quick = false) {
  const internal = new Set<string>();
  const bioLinks = new Set<string>();

  for (const href of htmlHrefValues(html)) {
    try {
      const url = new URL(href, baseUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      url.hash = "";
      if (
        url.origin === baseUrl.origin &&
        OFFICIAL_SOCIAL_PAGES.test(url.pathname + url.search) &&
        url.toString() !== baseUrl.toString()
      ) {
        internal.add(url.toString());
      } else if (
        BIO_LINK_HOSTS.has(url.hostname.toLowerCase().replace(/^www\./, ""))
      ) {
        // Only follow a link hub when the official site itself links to it.
        bioLinks.add(url.toString());
      }
    } catch {
      // Ignore malformed or unsupported links.
    }
  }

  // Keep requests bounded to protect latency, budgets and the target websites.
  return [...internal].slice(0, quick ? 1 : 2).concat([...bioLinks].slice(0, 1));
}

async function discoverInstagramOnOfficialWebsite(
  website: string,
  rejectedUrls: string[],
  quick = false,
) {
  const profiles = new Map<string, string[]>();
  const rejected = new Set(rejectedUrls);

  function collect(html: string, source: URL) {
    for (const profile of instagramProfilesFromOfficialHtml(html, source)) {
      if (rejected.has(profile)) continue;
      const evidence = profiles.get(profile) ?? [];
      if (!evidence.includes(source.toString())) evidence.push(source.toString());
      profiles.set(profile, evidence);
    }
  }

  const root = await fetchOfficialHtml(website, quick ? 4_000 : 6_000);
  if (!root) return profiles;
  collect(root.html, root.finalUrl);

  if (profiles.size === 1) return profiles;
  const pages = discoverOfficialSupplementaryPages(root.html, root.finalUrl, quick);
  const results = await Promise.all(
    pages.map((page) => fetchOfficialHtml(page, quick ? 3_000 : 6_000)),
  );
  for (const page of results) {
    if (page) collect(page.html, page.finalUrl);
  }
  return profiles;
}

function cleanString(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems = 8, maxLength = 300) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeWebsiteForSignature(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return normalize(value);
  }
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function instagramSearchSignature(business: {
  name: string;
  phone: string;
  internationalPhone: string;
  address: string;
  city: string;
  state: string;
  website: string;
  primaryCategory: string;
}) {
  return sha256Text(
    JSON.stringify({
      version: "instagram-discovery-v3",
      name: normalize(business.name),
      phone: normalizeBrazilianPhone(
        business.phone || business.internationalPhone,
      ),
      address: normalize(business.address),
      city: normalize(business.city),
      state: normalize(business.state),
      website: normalizeWebsiteForSignature(business.website),
      primaryCategory: normalize(business.primaryCategory),
    }),
  );
}

function websiteHost(value: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function significantTokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2)
    .filter(
      (token) =>
        ![
          "para",
          "com",
          "dos",
          "das",
          "uma",
          "the",
          "and",
          "dra",
          "dr",
        ].includes(token),
    );
}

function containsNormalized(haystack: string, needle: string) {
  const left = normalize(haystack);
  const right = normalize(needle);
  return Boolean(right && left.includes(right));
}

function extractProfessionalName(value: string) {
  const match = value.match(/\b(?:dra\.?|dr\.?|doutora|doutor)\s+([^|,;()]+)/i);
  if (!match?.[1]) return "";
  return match[1].trim().replace(/\s+-.*$/, "").slice(0, 100);
}

function addressSimilarity(address: string, locations: string[]) {
  if (!address || locations.length === 0) return false;
  const number = address.match(/\b\d{1,6}\b/)?.[0] ?? "";
  const addressTokens = significantTokens(address).filter(
    (token) => !["rua", "avenida", "av", "centro"].includes(token),
  );

  return locations.some((location) => {
    const normalizedLocation = normalize(location);
    const shared = addressTokens.filter((token) =>
      normalizedLocation.includes(token),
    ).length;
    const locationNumber = location.match(/\b\d{1,6}\b/)?.[0] ?? "";
    const numberMatches = !number || !locationNumber || number === locationNumber;
    return numberMatches && shared >= Math.min(2, Math.max(1, addressTokens.length));
  });
}

function rawCandidateSimilarity(
  businessName: string,
  candidate: RawWebCandidate,
) {
  const values = [
    candidate.publicName,
    ...candidate.associatedNames,
    candidate.username.replace(/[._]/g, " "),
  ].filter(Boolean);

  return Math.max(
    0,
    ...values.map((value) => tokenSimilarity(businessName, value)),
  );
}

function professionalSimilarity(
  professional: string,
  candidate: RawWebCandidate,
) {
  if (!professional) return 0;
  const values = [
    candidate.publicName,
    ...candidate.associatedNames,
    candidate.username.replace(/[._]/g, " "),
  ].filter(Boolean);

  return Math.max(
    0,
    ...values.map((value) => tokenSimilarity(professional, value)),
  );
}

function scoreInstagramCandidate(
  business: {
    name: string;
    phone: string;
    internationalPhone: string;
    address: string;
    city: string;
    state: string;
    website: string;
    primaryCategory: string;
  },
  candidate: RawWebCandidate,
): InstagramCandidate & { highEligible: boolean; locationConflict: boolean } {
  let score = 0;
  const signals: string[] = [];
  const phone = normalizeBrazilianPhone(
    business.phone || business.internationalPhone,
  );
  const candidatePhones = candidate.phones.map(normalizeBrazilianPhone);
  const phoneMatches = Boolean(phone && candidatePhones.includes(phone));

  const addressMatches = addressSimilarity(
    business.address,
    candidate.locations,
  );

  const officialHost = websiteHost(business.website);
  const websiteMatches = Boolean(
    officialHost &&
      candidate.websites.some((value) => websiteHost(value) === officialHost),
  );

  const nameSimilarity = rawCandidateSimilarity(business.name, candidate);
  const professional = extractProfessionalName(business.name);
  const professionalMatch = professionalSimilarity(professional, candidate);
  const city = normalize(business.city);
  const cityMatches = Boolean(
    city &&
      [candidate.publicText, ...candidate.locations].some((value) =>
        containsNormalized(value, business.city),
      ),
  );
  const otherLocation = Boolean(
    city &&
      candidate.locations.some((location) => {
        const normalized = normalize(location);
        return normalized && normalized !== "brasil";
      }) &&
      !cityMatches
  );
  // Public listings often show a chain's headquarters in another city.
  // Keep a strong phone/site/address match as a review candidate, never as
  // a fully confirmed profile for the requested branch.
  const locationConflict = Boolean(
    otherLocation && !phoneMatches && !addressMatches && !websiteMatches
  );

  const categoryTokens = significantTokens(business.primaryCategory);
  const categoryText = normalize(
    [...candidate.categories, candidate.publicText].join(" "),
  );
  const categoryMatches = categoryTokens.some((token) =>
    categoryText.includes(token),
  );

  const usernameText = candidate.username.replace(/[._]/g, " ");
  const usernameSimilarity = Math.max(
    tokenSimilarity(business.name, usernameText),
    professional ? tokenSimilarity(professional, usernameText) : 0,
  );

  if (phoneMatches) {
    score += 10;
    signals.push("Telefone público coincide");
  }
  if (addressMatches) {
    score += 9;
    signals.push("Endereço coincide");
  }
  if (websiteMatches) {
    score += 8;
    signals.push("Website associado coincide");
  }
  if (nameSimilarity >= 0.66) {
    score += 5;
    signals.push("Nome comercial coincide claramente");
  } else if (nameSimilarity >= 0.45) {
    score += 4;
    signals.push("Nome comercial é compatível");
  } else if (nameSimilarity >= 0.3) {
    score += 2;
    signals.push("Há termos relevantes do nome em comum");
  }
  if (professionalMatch >= 0.6) {
    score += 5;
    signals.push(
      professional
        ? `Nome profissional compatível: ${professional}`
        : "Nome profissional compatível",
    );
  }
  if (cityMatches) {
    score += 3;
    signals.push(
      business.state
        ? `${business.city} - ${business.state}`
        : business.city,
    );
  }
  if (categoryMatches) {
    score += 2;
    signals.push("Categoria/atividade compatível");
  }
  if (usernameSimilarity >= 0.55) {
    score += 3;
    signals.push("Nome de usuário compatível");
  }

  const nameTokens = significantTokens(business.name);
  const genericName =
    nameTokens.length <= 3 &&
    nameTokens.some((token) => GENERIC_NAME_TOKENS.has(token));

  if (genericName && !phoneMatches && !addressMatches && !websiteMatches) {
    score -= 2;
  }
  if (locationConflict) score -= 6;
  else if (otherLocation) {
    score -= 3;
    signals.push("Localidade diferente: confira a filial");
  }

  const veryStrong =
    phoneMatches || addressMatches || websiteMatches;
  const corroboratedName =
    nameSimilarity >= 0.45 &&
    cityMatches &&
    (professionalMatch >= 0.6 || categoryMatches || usernameSimilarity >= 0.55);

  const highEligible =
    !otherLocation &&
    score >= 9 &&
    (veryStrong || corroboratedName);

  const confidence: "medium" | "low" =
    !locationConflict && score >= 6 && signals.length >= 2
      ? "medium"
      : "low";

  return {
    url: candidate.instagramUrl,
    username: candidate.username,
    displayName: candidate.publicName?.trim().slice(0, 120) || null,
    confidence,
    score,
    signals: signals.slice(0, 5),
    evidenceUrls: candidate.evidenceUrls.slice(0, 4),
    highEligible,
    locationConflict,
  };
}

function extractOpenAIText(payload: OpenAIWebResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text.trim();
      }
    }
  }
  return "";
}

function extractedWebSources(payload: OpenAIWebResponse) {
  const urls = new Set<string>();

  for (const item of payload.output ?? []) {
    for (const source of item.action?.sources ?? []) {
      if (source.url) urls.add(source.url);
    }
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.url) urls.add(annotation.url);
      }
    }
  }

  return Array.from(urls);
}

function normalizedSourceUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

async function publicEvidenceMentionsUsername(
  username: string,
  evidenceUrls: string[],
) {
  const needle = username.toLowerCase();

  for (const value of evidenceUrls.slice(0, 2)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      continue;
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      host === "instagram.com" ||
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "maps.google.com"
    ) {
      continue;
    }

    const evidence = await fetchOfficialHtml(value);
    if (!evidence?.html) continue;

    const html = evidence.html.toLowerCase();
    if (
      html.includes(`@${needle}`) ||
      html.includes(`instagram.com/${needle}`) ||
      html.includes(`instagram.com%2f${needle}`) ||
      html.includes(`instagram%2ecom%2f${needle}`)
    ) {
      return true;
    }
  }

  return false;
}

const WEB_DISCOVERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "instagramUrl",
          "username",
          "publicName",
          "publicText",
          "phones",
          "locations",
          "websites",
          "categories",
          "associatedNames",
          "evidenceUrls",
        ],
        properties: {
          instagramUrl: { type: "string" },
          username: { type: "string" },
          publicName: { type: "string" },
          publicText: { type: "string" },
          phones: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
          locations: {
            type: "array",
            maxItems: 5,
            items: { type: "string" },
          },
          websites: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
          categories: {
            type: "array",
            maxItems: 5,
            items: { type: "string" },
          },
          associatedNames: {
            type: "array",
            maxItems: 5,
            items: { type: "string" },
          },
          evidenceUrls: {
            type: "array",
            maxItems: 6,
            items: { type: "string" },
          },
        },
      },
    },
  },
};

async function discoverInstagramOnWeb(
  openAiApiKey: string,
  business: {
    name: string;
    phone: string;
    internationalPhone: string;
    address: string;
    city: string;
    state: string;
    website: string;
    primaryCategory: string;
  },
  rejectedUrls: string[],
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_INSTAGRAM_MODEL")?.trim() || "gpt-6.1-terra",
      reasoning: { effort: "low" },
      max_output_tokens: 2400,
      max_tool_calls: 3,
      tools: [
        {
          type: "web_search",
          search_context_size: "low",
          external_web_access: true,
        },
      ],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Você pesquisa presença pública de empresas locais no Brasil para identificar possíveis perfis oficiais do Instagram. Use somente pesquisa web pública/indexada. Não faça login no Instagram, não use dados privados nem assuma que o primeiro resultado pertence à empresa. Diferencie filiais, homônimos e profissionais com nomes parecidos. Procure até 3 perfis plausíveis e retorne somente sinais públicos verificáveis para validação determinística posterior. Se não houver candidato plausível, retorne candidates vazio.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task:
                  "Encontre possíveis perfis oficiais do Instagram desta empresa no Brasil. Pesquise por nome exato + cidade + UF (site:instagram.com), variações do nome + nicho, telefone e endereço, além de links públicos de bio/contato quando necessário. Inclua profissionais e filiais apenas quando houver prova pública de ligação à empresa e à cidade. Compare páginas e fontes distintas antes de sugerir. Não invente URLs ou perfis.",
                business,
                rejectedInstagramUrls: rejectedUrls,
                rules: [
                  "Não escolha candidato apenas por nome parecido.",
                  "Diferencie nome comercial de nome do profissional.",
                  "Não retorne URLs de post/reel/story; somente perfil.",
                  "Em publicText, associatedNames, phones, locations, websites e categories, informe somente sinais realmente encontrados em resultados públicos.",
                  "evidenceUrls deve conter as páginas públicas que sustentam os sinais.",
                ],
              }),
            },
          ],
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "instagram_public_candidates",
          strict: true,
          schema: WEB_DISCOVERY_SCHEMA,
        },
      },
    }),
  });

  let payload: OpenAIWebResponse;
  try {
    payload = (await response.json()) as OpenAIWebResponse;
  } catch {
    throw new Error("OPENAI_INVALID_RESPONSE");
  }

  if (!response.ok) {
    if (response.status === 429) throw new Error("OPENAI_QUOTA");
    if (response.status === 401 || response.status === 403) {
      throw new Error("OPENAI_AUTH");
    }
    throw new Error("OPENAI_WEB_SEARCH_FAILED");
  }

  const outputText = extractOpenAIText(payload);
  if (!outputText) return [] as RawWebCandidate[];

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return [] as RawWebCandidate[];
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { candidates?: unknown }).candidates)
  ) {
    return [] as RawWebCandidate[];
  }

  const sourceUrls = extractedWebSources(payload);
  const sourceProfiles = new Set(
    sourceUrls
      .map(canonicalInstagramProfile)
      .filter((value): value is string => Boolean(value)),
  );
  const sourceSet = new Set(sourceUrls.map(normalizedSourceUrl));
  const rejected = new Set(
    rejectedUrls
      .map(canonicalInstagramProfile)
      .filter((value): value is string => Boolean(value)),
  );

  const candidates: RawWebCandidate[] = [];
  for (const value of (parsed as { candidates: unknown[] }).candidates) {
    if (!value || typeof value !== "object") continue;
    const raw = value as Record<string, unknown>;
    const profile = canonicalInstagramProfile(cleanString(raw.instagramUrl));
    if (!profile || rejected.has(profile)) continue;

    const username = instagramUsername(profile);
    if (!username) continue;

    const evidenceUrls = stringList(raw.evidenceUrls, 6, 600)
      .filter((url) => sourceSet.has(normalizedSourceUrl(url)))
      .slice(0, 4);

    const directlySourced = sourceProfiles.has(profile);
    const corroboratedByPublicPage =
      evidenceUrls.length > 0 &&
      (await publicEvidenceMentionsUsername(username, evidenceUrls));

    if (!directlySourced && !corroboratedByPublicPage) {
      continue;
    }

    candidates.push({
      instagramUrl: profile,
      username,
      publicName: cleanString(raw.publicName, 180),
      publicText: cleanString(raw.publicText, 900),
      phones: stringList(raw.phones, 4, 80),
      locations: stringList(raw.locations, 5, 240),
      websites: stringList(raw.websites, 4, 500),
      categories: stringList(raw.categories, 5, 160),
      associatedNames: stringList(raw.associatedNames, 5, 160),
      evidenceUrls:
        evidenceUrls.length > 0
          ? evidenceUrls
          : sourceUrls
              .filter((url) => canonicalInstagramProfile(url) === profile)
              .slice(0, 2),
    });
  }

  const unique = new Map<string, RawWebCandidate>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.instagramUrl)) {
      unique.set(candidate.instagramUrl, candidate);
    }
  }

  return Array.from(unique.values()).slice(0, 3);
}

function emptyPresence(
  checkedAt: string,
  signature: string,
  rejectedUrls: string[],
): BusinessPresence {
  return {
    instagramUrl: null,
    instagramUsername: null,
    instagramConfidence: null,
    instagramSource: null,
    instagramCheckedAt: checkedAt,
    instagramCandidates: [],
    instagramRejectedUrls: rejectedUrls,
    instagramSearchSignature: signature,
    instagramNeedsReview: false,
  };
}

async function runPresenceDiscovery(body: Record<string, unknown>) {
  const businessValue = body.business;
  if (!businessValue || typeof businessValue !== "object") {
    return failure(
      "INVALID_REQUEST",
      "Informe os dados da empresa para verificar a presença online.",
      400,
    );
  }

  const rawBusiness = businessValue as Record<string, unknown>;
  const name = cleanString(rawBusiness.name, 180);
  if (name.length < 2) {
    return failure(
      "INVALID_REQUEST",
      "O nome da empresa é necessário para verificar a presença online.",
      400,
    );
  }

  const business = {
    name,
    website: cleanString(rawBusiness.website, 500),
    instagram: cleanString(rawBusiness.instagram, 500),
    instagramDisplayName: cleanString(rawBusiness.instagramDisplayName, 120),
    instagramConfidence: cleanString(rawBusiness.instagramConfidence, 20),
    instagramSource: cleanString(rawBusiness.instagramSource, 40),
    phone: cleanString(rawBusiness.phone, 80),
    internationalPhone: cleanString(rawBusiness.internationalPhone, 80),
    address: cleanString(rawBusiness.address, 300),
    city: cleanString(rawBusiness.city, 120),
    state: cleanString(rawBusiness.state, 120),
    primaryCategory: cleanString(rawBusiness.primaryCategory, 160),
  };

  const rejectedUrls = stringList(
    rawBusiness.instagramRejectedUrls,
    12,
    500,
  )
    .map(canonicalInstagramProfile)
    .filter((value): value is string => Boolean(value));

  const checkedAt = new Date().toISOString();
  const signature = await instagramSearchSignature(business);
  const knownInstagram = canonicalInstagramProfile(business.instagram);
  const force = body.force === true;

  if (
    knownInstagram &&
    business.instagramConfidence === "high" &&
    (!force || business.instagramSource === "manual_confirmation")
  ) {
    const source: PresenceSource =
      business.instagramSource === "manual_confirmation"
        ? "manual_confirmation"
        : business.instagramSource === "official_website"
          ? "official_website"
          : business.instagramSource === "web_search"
            ? "web_search"
            : business.instagramSource === "google_places"
              ? "google_places"
              : "existing_data";

    const presence: BusinessPresence = {
      instagramUrl: knownInstagram,
      instagramUsername: instagramUsername(knownInstagram),
      instagramDisplayName: business.instagramDisplayName || null,
      instagramConfidence: "high",
      instagramSource: source,
      instagramCheckedAt: checkedAt,
      instagramCandidates: [],
      instagramRejectedUrls: rejectedUrls,
      instagramSearchSignature: signature,
      instagramNeedsReview: false,
    };
    return json({ ok: true, mode: "presence-discovery", presence });
  }

  if (knownInstagram && !business.instagramSource && !force) {
    const presence: BusinessPresence = {
      instagramUrl: knownInstagram,
      instagramUsername: instagramUsername(knownInstagram),
      instagramDisplayName: business.instagramDisplayName || null,
      instagramConfidence: "high",
      instagramSource: "google_places",
      instagramCheckedAt: checkedAt,
      instagramCandidates: [],
      instagramRejectedUrls: rejectedUrls,
      instagramSearchSignature: signature,
      instagramNeedsReview: false,
    };
    return json({ ok: true, mode: "presence-discovery", presence });
  }

  // A quick official-site pass already checked the website. Do not fetch it
  // again on the subsequent web pass when no official candidates were found.
  const skipWebsite =
    body.allowWebSearch === true && body.skipOfficialSite === true;
  const officialProfiles = business.website && !skipWebsite
    ? await discoverInstagramOnOfficialWebsite(
        business.website,
        rejectedUrls,
        body.allowWebSearch !== true,
      )
    : new Map<string, string[]>();

  // A single profile linked from the company's own website is first-party proof.
  if (officialProfiles.size === 1) {
    const profile = Array.from(officialProfiles.keys())[0];
    const presence: BusinessPresence = {
      instagramUrl: profile,
      instagramUsername: instagramUsername(profile),
      instagramDisplayName: null,
      instagramConfidence: "high",
      instagramSource: "official_website",
      instagramCheckedAt: checkedAt,
      instagramCandidates: [],
      instagramRejectedUrls: rejectedUrls,
      instagramSearchSignature: signature,
      instagramNeedsReview: false,
    };
    return json({ ok: true, mode: "presence-discovery", presence });
  }

  // If an official site links to several profiles (brands, branches or owners),
  // show them for human verification instead of picking the first link.
  const officialCandidates: InstagramCandidate[] = Array.from(officialProfiles)
    .slice(0, 3)
    .map(([url, evidenceUrls]) => ({
      url,
      username: instagramUsername(url) ?? "",
      confidence: "medium" as const,
      score: 8,
      signals: ["Perfil publicado no site oficial; confirme a unidade correta"],
      evidenceUrls: evidenceUrls.slice(0, 3),
    }));

  if (body.allowWebSearch !== true) {
    return json({
      ok: true,
      mode: "presence-discovery",
      presence: {
        ...emptyPresence(checkedAt, signature, rejectedUrls),
        instagramCandidates: officialCandidates,
      },
    });
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!openAiApiKey) {
    if (officialCandidates.length > 0) {
      return json({
        ok: true,
        mode: "presence-discovery",
        presence: {
          ...emptyPresence(checkedAt, signature, rejectedUrls),
          instagramCandidates: officialCandidates,
        },
      });
    }
    return failure(
      "NOT_CONFIGURED",
      "A busca pública complementar de Instagram não está configurada no backend. Configure OPENAI_API_KEY.",
      503,
    );
  }

  let rawCandidates: RawWebCandidate[];
  try {
    rawCandidates = await discoverInstagramOnWeb(
      openAiApiKey,
      business,
      rejectedUrls,
    );
  } catch (error) {
    if (officialCandidates.length > 0) {
      return json({
        ok: true,
        mode: "presence-discovery",
        presence: {
          ...emptyPresence(checkedAt, signature, rejectedUrls),
          instagramCandidates: officialCandidates,
        },
      });
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "OPENAI_QUOTA") {
      return failure(
        "QUOTA",
        "O limite da busca pública foi atingido. Tente novamente mais tarde.",
        429,
      );
    }
    if (message === "OPENAI_AUTH") {
      return failure(
        "REQUEST_FAILED",
        "A credencial da busca pública foi recusada.",
        502,
      );
    }
    return failure(
      "REQUEST_FAILED",
      "Não foi possível buscar Instagram agora. Tente novamente.",
      502,
    );
  }

  const scored = rawCandidates
    .map((candidate) => scoreInstagramCandidate(business, candidate))
    .filter((candidate) => !candidate.locationConflict)
    .sort((a, b) => b.score - a.score);

  const first = scored[0];
  const second = scored[1];
  const ambiguous = Boolean(
    first?.highEligible &&
      second &&
      second.score >= 6 &&
      first.score - second.score <= 2,
  );

  if (
    first?.highEligible &&
    !ambiguous &&
    (officialProfiles.size === 0 || officialProfiles.has(first.url))
  ) {
    const presence: BusinessPresence = {
      instagramUrl: first.url,
      instagramUsername: first.username,
      instagramDisplayName: first.displayName ?? null,
      instagramConfidence: "high",
      instagramSource: "web_search",
      instagramCheckedAt: checkedAt,
      instagramCandidates: [],
      instagramRejectedUrls: rejectedUrls,
      instagramSearchSignature: signature,
      instagramNeedsReview: false,
    };
    return json({ ok: true, mode: "presence-discovery", presence });
  }

  const candidates: InstagramCandidate[] = [
    ...officialCandidates,
    ...scored
      .filter((candidate) => candidate.score >= 4)
      .map((candidate) => ({
        url: candidate.url,
        username: candidate.username,
        displayName: candidate.displayName ?? null,
        confidence: candidate.confidence,
        score: candidate.score,
        signals: candidate.signals,
        evidenceUrls: candidate.evidenceUrls,
      })),
  ].filter(
    (candidate, index, items) =>
      items.findIndex((other) => other.url === candidate.url) === index,
  ).slice(0, 5);

  const presence: BusinessPresence = {
    ...emptyPresence(checkedAt, signature, rejectedUrls),
    instagramCandidates: candidates,
  };

  return json({ ok: true, mode: "presence-discovery", presence });
}
async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return failure(
      "INVALID_REQUEST",
      "Este serviço aceita somente requisições de busca.",
      405,
    );
  }

  if (!hasValidClientKey(request)) {
    return failure(
      "REQUEST_FAILED",
      "A aplicação não conseguiu autenticar a chamada ao serviço de busca.",
      401,
    );
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return failure(
      "AUTH_REQUIRED",
      "Sua sessão expirou. Entre novamente para buscar empresas.",
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return failure(
      "REQUEST_FAILED",
      "O serviço de autenticação não está disponível.",
      503,
    );
  }

  const authHeaders = {
    apikey: request.headers.get("apikey") ?? "",
    Authorization: authorization,
  };

  let userId: string;
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: authHeaders,
    });
    if (!userResponse.ok) {
      return failure(
        "AUTH_REQUIRED",
        "Sua sessão expirou. Entre novamente para buscar empresas.",
        401,
      );
    }

    const user: unknown = await userResponse.json();
    if (
      !user ||
      typeof user !== "object" ||
      !("id" in user) ||
      typeof user.id !== "string" ||
      !user.id
    ) {
      return failure(
        "AUTH_REQUIRED",
        "Sua sessão expirou. Entre novamente para buscar empresas.",
        401,
      );
    }

    userId = user.id;
  } catch {
    return failure(
      "REQUEST_FAILED",
      "Não foi possível validar sua sessão agora.",
      503,
    );
  }

  try {
    const accessResponse = await fetch(
      `${supabaseUrl}/rest/v1/private_access?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers: authHeaders },
    );

    if (!accessResponse.ok) {
      return failure(
        "REQUEST_FAILED",
        "Não foi possível verificar o acesso agora.",
        503,
      );
    }

    const rows: unknown = await accessResponse.json();
    if (
      !Array.isArray(rows) ||
      !rows.some(
        (row) =>
          row &&
          typeof row === "object" &&
          "user_id" in row &&
          row.user_id === userId,
      )
    ) {
      return failure(
        "FORBIDDEN",
        "Esta conta não está autorizada a acessar o JanuarioLeads.",
        403,
      );
    }
  } catch {
    return failure(
      "REQUEST_FAILED",
      "Não foi possível verificar o acesso agora.",
      503,
    );
  }

  const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!googleApiKey) {
    return failure(
      "NOT_CONFIGURED",
      "A credencial privada do Google Places não está configurada no backend.",
      500,
    );
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return failure(
      "INVALID_REQUEST",
      parsedBody.tooLarge
        ? "A solicitação de busca excede o tamanho permitido."
        : "A solicitação de busca está em formato inválido.",
      parsedBody.tooLarge ? 413 : 400,
    );
  }

  const body = parsedBody.value;
  if (!body || typeof body !== "object") {
    return failure(
      "INVALID_REQUEST",
      "Informe dados válidos para realizar a busca.",
      400,
    );
  }

  const requestBody = body as Record<string, unknown>;
  const mode =
    requestBody.mode === "lead-enrichment"
      ? "lead-enrichment"
      : requestBody.mode === "presence-discovery"
        ? "presence-discovery"
        : "segment-search";

  const rateLimitBucket =
    mode === "lead-enrichment"
      ? "lead_enrichment"
      : mode === "presence-discovery"
        ? requestBody.allowWebSearch === true
          ? "presence_discovery"
          : "presence_site"
        : "places_search";
  const withinBudget = await claimApiBudget(
    userId,
    rateLimitBucket,
  );
  if (withinBudget === null) {
    return failure(
      "REQUEST_FAILED",
      "Não foi possível validar o limite de uso agora.",
      503,
    );
  }
  if (!withinBudget) {
    return failure(
      "QUOTA",
      "Limite temporário de uso atingido. Aguarde alguns minutos antes de tentar novamente.",
      429,
    );
  }

  try {
    if (mode === "presence-discovery") {
      return await runPresenceDiscovery(requestBody);
    }

    if (mode === "lead-enrichment") {
      return await runLeadEnrichment(googleApiKey, requestBody);
    }

    return await runSegmentSearch(googleApiKey, requestBody);
  } catch {
    return failure(
      "REQUEST_FAILED",
      mode === "presence-discovery"
        ? "Não foi possível verificar a presença online agora."
        : "Não foi possível comunicar com o Google Places agora.",
      502,
    );
  }
}


Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return corsPreflight(request);
  }

  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isAllowedBrowserOrigin(origin)) {
    return withRequestCors(
      new Response(
        JSON.stringify({
          ok: false,
          code: "FORBIDDEN",
          message: "Origem não autorizada.",
        }),
        {
          status: 403,
          headers: corsHeaders,
        },
      ),
      request,
    );
  }

  return withRequestCors(await handleRequest(request), request);
});
