import {
  evaluateOpenNow,
  isOpenNowCacheFresh,
  OPEN_NOW_CACHE_TTL_MS,
  type OpeningHoursSnapshot,
} from "../_shared/open-now.ts";
import { ALL_SEARCH_SEGMENTS } from "../_shared/niche-catalog.ts";
import {
  CURRENT_NICHE_COVERAGE,
  type NicheFamily,
} from "../_shared/niche-strategies.ts";

type CacheStatus =
  | "open_results"
  | "no_open_results"
  | "not_checked"
  | "checking"
  | "error";

type OpenNowBusiness = {
  placeId: string;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  internationalPhone: string | null;
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  instagram: string | null;
  googleMapsUrl: string | null;
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  currentOpeningHours: OpeningHoursSnapshot | null;
  regularOpeningHours: OpeningHoursSnapshot | null;
  isOpenNow: boolean | null;
  openingHours: string[];
  openNow: ReturnType<typeof evaluateOpenNow>;
};

type GoogleText = { text?: string };
type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};
type GooglePlace = {
  id?: string;
  displayName?: GoogleText;
  primaryTypeDisplayName?: GoogleText;
  types?: string[];
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: OpeningHoursSnapshot;
  regularOpeningHours?: OpeningHoursSnapshot;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  location?: { latitude?: number; longitude?: number };
};
type GoogleResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: { code?: number; message?: string; status?: string };
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryTypeDisplayName",
  "places.types",
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const familyBySegment = new Map<string, NicheFamily>(
  CURRENT_NICHE_COVERAGE.map((item) => [
    item.segment,
    item.family as NicheFamily,
  ]),
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function failure(code: string, message: string, status: number, extra?: object) {
  return json({ ok: false, code, message, ...(extra ?? {}) }, status);
}

const SAFE_ERRORS: Record<string, { message: string; status: number }> = {
  AUTH_REQUIRED: {
    message: "Sua sessão expirou. Entre novamente para continuar.",
    status: 401,
  },
  INVALID_CLIENT_KEY: {
    message: "O cliente não está autorizado a acessar este serviço.",
    status: 401,
  },
  PRIVATE_ACCESS_DENIED: {
    message: "Sua conta não possui acesso a este recurso.",
    status: 403,
  },
  PRIVATE_ACCESS_CHECK_FAILED: {
    message: "Não foi possível validar seu acesso agora.",
    status: 502,
  },
  CACHE_READ_FAILED: {
    message: "Não foi possível carregar o cache de nichos agora.",
    status: 502,
  },
  CACHE_WRITE_FAILED: {
    message: "Não foi possível salvar a atualização deste nicho.",
    status: 502,
  },
  RATE_LIMIT_CHECK_FAILED: {
    message: "Não foi possível validar o limite de atualizações agora.",
    status: 502,
  },
  RATE_LIMIT: {
    message: "Limite temporário de atualizações atingido. Tente novamente em alguns minutos.",
    status: 429,
  },
  GOOGLE_NOT_CONFIGURED: {
    message: "O Google Places não está configurado para este serviço.",
    status: 503,
  },
  GOOGLE_QUOTA: {
    message: "Limite temporário do Google Places atingido. Tente novamente em alguns minutos.",
    status: 429,
  },
  GOOGLE_INVALID_REQUEST: {
    message: "O Google Places recusou a pesquisa deste nicho.",
    status: 400,
  },
  GOOGLE_REQUEST_FAILED: {
    message: "Não foi possível acessar o Google Places agora.",
    status: 502,
  },
  REQUEST_FAILED: {
    message: "Não foi possível consultar Nichos Abertos Agora.",
    status: 502,
  },
};

function errorCode(error: unknown) {
  return error instanceof Error && error.message ? error.message : "REQUEST_FAILED";
}

function safeFailure(code: string, extra?: object) {
  const resolved = SAFE_ERRORS[code] ?? SAFE_ERRORS.REQUEST_FAILED;
  return failure(code, resolved.message, resolved.status, extra);
}

function logDiagnostic(event: string, details: Record<string, unknown>) {
  console.error(
    `[open-now-niches] ${event}`,
    JSON.stringify(details),
  );
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function locationKey(city: string, state: string) {
  return `${normalize(city)}|${normalize(state)}`;
}

function cleanLocation(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validLocation(body: Record<string, unknown>) {
  const city = cleanLocation(body.city, 120);
  const state = cleanLocation(body.state, 2).toUpperCase();
  if (city.length < 2 || !/^[A-Z]{2}$/.test(state)) return null;
  return { city, state, key: locationKey(city, state) };
}

function component(place: GooglePlace, type: string, short = false) {
  const item = place.addressComponents?.find((entry) => entry.types?.includes(type));
  return (short ? item?.shortText : item?.longText)?.trim() || null;
}

function cityOf(place: GooglePlace) {
  return (
    component(place, "locality") ??
    component(place, "administrative_area_level_2")
  );
}

function stateOf(place: GooglePlace) {
  return (
    component(place, "administrative_area_level_1", true) ??
    component(place, "administrative_area_level_1")
  );
}

function neighborhoodOf(place: GooglePlace) {
  return (
    component(place, "neighborhood") ??
    component(place, "sublocality_level_1") ??
    component(place, "sublocality")
  );
}

function websiteAndInstagram(value: string | undefined) {
  const website = value?.trim() || null;
  if (!website) return { website: null, instagram: null };
  try {
    const host = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "instagram.com") return { website: null, instagram: website };
  } catch {
    return { website, instagram: null };
  }
  return { website, instagram: null };
}

function sanitizeOpeningHours(value: OpeningHoursSnapshot | undefined) {
  if (!value || typeof value !== "object") return null;
  return {
    ...(typeof value.openNow === "boolean" ? { openNow: value.openNow } : {}),
    periods: Array.isArray(value.periods) ? value.periods.slice(0, 24) : [],
    weekdayDescriptions: Array.isArray(value.weekdayDescriptions)
      ? value.weekdayDescriptions.filter((item): item is string => typeof item === "string").slice(0, 7)
      : [],
    specialDays: Array.isArray(value.specialDays) ? value.specialDays.slice(0, 14) : [],
  } satisfies OpeningHoursSnapshot;
}

function parsePlace(place: GooglePlace, now: Date): OpenNowBusiness | null {
  const placeId = place.id?.trim();
  const name = place.displayName?.text?.trim();
  if (!placeId || !name) return null;

  const currentOpeningHours = sanitizeOpeningHours(place.currentOpeningHours);
  const regularOpeningHours = sanitizeOpeningHours(place.regularOpeningHours);
  const online = websiteAndInstagram(place.websiteUri);
  const openNow = evaluateOpenNow(currentOpeningHours, regularOpeningHours, now);

  return {
    placeId,
    name,
    primaryCategory: place.primaryTypeDisplayName?.text?.trim() || null,
    categories: place.types ?? [],
    address: place.formattedAddress?.trim() || null,
    neighborhood: neighborhoodOf(place),
    city: cityOf(place),
    state: stateOf(place),
    phone: place.nationalPhoneNumber?.trim() || null,
    internationalPhone: place.internationalPhoneNumber?.trim() || null,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount:
      typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    website: online.website,
    instagram: online.instagram,
    googleMapsUrl: place.googleMapsUri?.trim() || null,
    businessStatus: place.businessStatus?.trim() || null,
    latitude:
      typeof place.location?.latitude === "number" ? place.location.latitude : null,
    longitude:
      typeof place.location?.longitude === "number" ? place.location.longitude : null,
    currentOpeningHours,
    regularOpeningHours,
    isOpenNow: openNow.isOpen,
    openingHours:
      regularOpeningHours?.weekdayDescriptions ??
      currentOpeningHours?.weekdayDescriptions ??
      [],
    openNow,
  };
}

function locationMatches(
  business: OpenNowBusiness,
  city: string,
  state: string,
) {
  const wantedCity = normalize(city);
  const wantedState = normalize(state);
  return (
    normalize(business.city) === wantedCity &&
    (
      !business.state ||
      normalize(business.state) === wantedState
    )
  ) || (
    normalize(business.address).includes(wantedCity) &&
    normalize(business.address).includes(wantedState)
  );
}

function uniqueBusinesses(values: OpenNowBusiness[]) {
  const map = new Map<string, OpenNowBusiness>();
  for (const value of values) map.set(value.placeId, value);
  return Array.from(map.values());
}

async function googleSearch(
  apiKey: string,
  segment: string,
  city: string,
  state: string,
  pageToken?: string,
) {
  const body: Record<string, unknown> = {
    textQuery: `${segment} em ${city}, ${state}, Brasil`,
    pageSize: 20,
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
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    },
  );

  let payload: GoogleResponse;
  try {
    payload = await response.json() as GoogleResponse;
  } catch {
    logDiagnostic("google_invalid_response", {
      segment,
      city,
      state,
      httpStatus: response.status,
    });
    throw new Error("GOOGLE_REQUEST_FAILED");
  }

  if (!response.ok) {
    const googleStatus = payload.error?.status ?? "";
    const code =
      response.status === 429 || googleStatus === "RESOURCE_EXHAUSTED"
        ? "GOOGLE_QUOTA"
        : googleStatus === "INVALID_ARGUMENT" || response.status === 400
          ? "GOOGLE_INVALID_REQUEST"
          : "GOOGLE_REQUEST_FAILED";

    logDiagnostic("google_request_failed", {
      code,
      segment,
      city,
      state,
      httpStatus: response.status,
      googleStatus: googleStatus || null,
      googleCode: payload.error?.code ?? null,
      retryAfter: response.headers.get("retry-after"),
      googleMessage: payload.error?.message?.slice(0, 500) ?? null,
    });

    throw new Error(code);
  }

  const now = new Date();
  return {
    results: (payload.places ?? [])
      .map((place) => parsePlace(place, now))
      .filter((place): place is OpenNowBusiness => Boolean(place))
      .filter((place) => locationMatches(place, city, state)),
    nextPageToken: payload.nextPageToken ?? null,
  };
}

function getAllowedPublishableKeys() {
  const keys: string[] = [];
  const current = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (current) {
    try {
      const parsed = JSON.parse(current) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.trim()) keys.push(value.trim());
      }
    } catch {
      logDiagnostic("publishable_keys_parse_failed", {});
    }
  }

  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy?.trim()) keys.push(legacy.trim());
  return Array.from(new Set(keys));
}

function hasValidClientKey(request: Request) {
  const provided = request.headers.get("apikey")?.trim();
  return Boolean(provided && getAllowedPublishableKeys().includes(provided));
}

type AuthResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      code:
        | "AUTH_REQUIRED"
        | "INVALID_CLIENT_KEY"
        | "PRIVATE_ACCESS_DENIED"
        | "PRIVATE_ACCESS_CHECK_FAILED";
      message: string;
      status: number;
    };

async function authenticate(request: Request): Promise<AuthResult> {
  if (!hasValidClientKey(request)) {
    return {
      ok: false,
      code: "INVALID_CLIENT_KEY",
      message: SAFE_ERRORS.INVALID_CLIENT_KEY.message,
      status: SAFE_ERRORS.INVALID_CLIENT_KEY.status,
    };
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: SAFE_ERRORS.AUTH_REQUIRED.message,
      status: SAFE_ERRORS.AUTH_REQUIRED.status,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    logDiagnostic("supabase_url_missing", {});
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: SAFE_ERRORS.AUTH_REQUIRED.message,
      status: SAFE_ERRORS.AUTH_REQUIRED.status,
    };
  }

  const headers = {
    apikey: request.headers.get("apikey") ?? "",
    Authorization: authorization,
  };

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!userResponse.ok) {
    logDiagnostic("auth_user_lookup_failed", {
      httpStatus: userResponse.status,
    });
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: SAFE_ERRORS.AUTH_REQUIRED.message,
      status: SAFE_ERRORS.AUTH_REQUIRED.status,
    };
  }

  const user = await userResponse.json() as { id?: string };
  if (!user.id) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: SAFE_ERRORS.AUTH_REQUIRED.message,
      status: SAFE_ERRORS.AUTH_REQUIRED.status,
    };
  }

  const access = await fetch(
    `${supabaseUrl}/rest/v1/private_access?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers },
  );
  if (!access.ok) {
    logDiagnostic("private_access_check_failed", {
      userId: user.id,
      httpStatus: access.status,
    });
    return {
      ok: false,
      code: "PRIVATE_ACCESS_CHECK_FAILED",
      message: SAFE_ERRORS.PRIVATE_ACCESS_CHECK_FAILED.message,
      status: SAFE_ERRORS.PRIVATE_ACCESS_CHECK_FAILED.status,
    };
  }

  const rows = await access.json() as unknown[];
  if (!rows.length) {
    return {
      ok: false,
      code: "PRIVATE_ACCESS_DENIED",
      message: SAFE_ERRORS.PRIVATE_ACCESS_DENIED.message,
      status: SAFE_ERRORS.PRIVATE_ACCESS_DENIED.status,
    };
  }

  return { ok: true, userId: user.id };
}

function firstNamedSecret(raw: string | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const preferred = parsed.default;
    if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    logDiagnostic("secret_keys_parse_failed", {});
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
  if (!config) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");

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

async function claimRefreshBudget(userId: string, key: string) {
  const response = await adminRest("rpc/claim_open_now_refresh", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: userId,
      p_location_key: key,
      p_limit: 140,
      p_window_seconds: 900,
    }),
  });
  if (!response.ok) {
    logDiagnostic("rate_limit_check_failed", {
      httpStatus: response.status,
      locationKey: key,
    });
    throw new Error("RATE_LIMIT_CHECK_FAILED");
  }
  return Boolean(await response.json());
}

async function cleanupExpiredCache(userId: string) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await adminRest(
    `open_now_niche_cache?user_id=eq.${encodeURIComponent(userId)}&updated_at=lt.${encodeURIComponent(cutoff)}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    },
  ).catch(() => undefined);
}

async function readCache(
  userId: string,
  key: string,
  segment?: string,
) {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("user_id", `eq.${userId}`);
  params.set("location_key", `eq.${key}`);
  if (segment) params.set("segment", `eq.${segment}`);
  params.set("order", "segment.asc");
  const response = await adminRest(`open_now_niche_cache?${params.toString()}`);
  if (!response.ok) throw new Error("CACHE_READ_FAILED");
  return await response.json() as Array<Record<string, unknown>>;
}

function serializeCacheRow(row: Record<string, unknown>) {
  return {
    segment: String(row.segment ?? ""),
    family: String(row.family ?? "generic_local_business"),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    status: String(row.status ?? "not_checked") as CacheStatus,
    checkedAt: typeof row.checked_at === "string" ? row.checked_at : null,
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    nextPageToken:
      typeof row.next_page_token === "string" ? row.next_page_token : null,
    pageCount: Number(row.page_count ?? 0),
    requestCount: Number(row.request_count ?? 0),
    results: Array.isArray(row.results) ? row.results : [],
    errorCode: typeof row.error_code === "string" ? row.error_code : null,
    errorMessage:
      typeof row.error_message === "string" ? row.error_message : null,
    stale: !isOpenNowCacheFresh(
      typeof row.checked_at === "string" ? row.checked_at : null,
    ),
  };
}

async function upsertCache(row: Record<string, unknown>) {
  const response = await adminRest(
    "open_now_niche_cache?on_conflict=user_id,location_key,segment",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(row),
    },
  );
  if (!response.ok) throw new Error("CACHE_WRITE_FAILED");
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows[0] ?? row;
}

async function runRefresh(
  userId: string,
  location: { city: string; state: string; key: string },
  body: Record<string, unknown>,
) {
  const segment =
    typeof body.segment === "string" ? body.segment.trim() : "";
  if (!ALL_SEARCH_SEGMENTS.includes(segment)) {
    return failure("INVALID_SEGMENT", "O nicho informado não existe no catálogo atual.", 400);
  }

  const pageToken =
    typeof body.pageToken === "string" && body.pageToken.trim()
      ? body.pageToken.trim()
      : null;
  const force = body.force === true;
  const currentRows = await readCache(userId, location.key, segment);
  const current = currentRows[0] ?? null;
  const currentCheckedAt =
    current && typeof current.checked_at === "string" ? current.checked_at : null;

  if (!pageToken && !force && current && isOpenNowCacheFresh(currentCheckedAt)) {
    return json({ ok: true, cached: true, cache: serializeCacheRow(current) });
  }

  if (
    !pageToken &&
    force &&
    currentCheckedAt &&
    Date.now() - new Date(currentCheckedAt).getTime() < 45_000
  ) {
    return failure(
      "COOLDOWN",
      "Este nicho foi atualizado há poucos segundos.",
      429,
      { cache: serializeCacheRow(current) },
    );
  }

  const lockedUntil =
    current && typeof current.locked_until === "string"
      ? new Date(current.locked_until).getTime()
      : 0;
  if (lockedUntil > Date.now()) {
    return failure(
      "ALREADY_REFRESHING",
      "Este nicho já está sendo atualizado.",
      409,
      current ? { cache: serializeCacheRow(current) } : undefined,
    );
  }

  const allowedByRateLimit = await claimRefreshBudget(userId, location.key);
  if (!allowedByRateLimit) {
    return failure(
      "RATE_LIMIT",
      "Muitas atualizações foram iniciadas nesta localidade. Aguarde alguns minutos.",
      429,
      current ? { cache: serializeCacheRow(current) } : undefined,
    );
  }

  const family =
    (familyBySegment.get(segment) ?? "generic_local_business") as NicheFamily;
  const now = new Date();
  const lockExpiry = new Date(now.getTime() + 90_000).toISOString();

  await upsertCache({
    user_id: userId,
    location_key: location.key,
    city: location.city,
    state: location.state,
    segment,
    family,
    status: "checking",
    locked_until: lockExpiry,
    updated_at: now.toISOString(),
    ...(current ? {} : { results: [] }),
  });

  const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim();
  if (!googleApiKey) {
    await upsertCache({
      user_id: userId,
      location_key: location.key,
      city: location.city,
      state: location.state,
      segment,
      family,
      status: "error",
      locked_until: null,
      error_code: "GOOGLE_NOT_CONFIGURED",
      error_message: "Google Places não está configurado.",
      updated_at: new Date().toISOString(),
    });
    return failure("GOOGLE_NOT_CONFIGURED", "Google Places não está configurado.", 503);
  }

  try {
    const searched = await googleSearch(
      googleApiKey,
      segment,
      location.city,
      location.state,
      pageToken ?? undefined,
    );

    const previousResults =
      pageToken && current && Array.isArray(current.results)
        ? current.results as OpenNowBusiness[]
        : [];
    const results = uniqueBusinesses([
      ...previousResults,
      ...searched.results,
    ]);
    const checkedAt = new Date().toISOString();
    const openCount = results.filter((business) =>
      business.openNow?.isOpen === true
    ).length;

    const saved = await upsertCache({
      user_id: userId,
      location_key: location.key,
      city: location.city,
      state: location.state,
      segment,
      family,
      status: openCount > 0 ? "open_results" : "no_open_results",
      checked_at: checkedAt,
      expires_at: new Date(Date.now() + OPEN_NOW_CACHE_TTL_MS).toISOString(),
      next_page_token: searched.nextPageToken,
      page_count: pageToken ? Number(current?.page_count ?? 1) + 1 : 1,
      request_count: Number(current?.request_count ?? 0) + 1,
      results,
      error_code: null,
      error_message: null,
      locked_until: null,
      updated_at: checkedAt,
    });

    return json({
      ok: true,
      cached: false,
      googleRequests: 1,
      cache: serializeCacheRow(saved),
    });
  } catch (error) {
    const rawCode = errorCode(error);
    const code =
      rawCode === "GOOGLE_QUOTA" ||
      rawCode === "GOOGLE_INVALID_REQUEST" ||
      rawCode === "GOOGLE_REQUEST_FAILED"
        ? rawCode
        : "GOOGLE_REQUEST_FAILED";
    const resolved = SAFE_ERRORS[code];

    const saved = await upsertCache({
      user_id: userId,
      location_key: location.key,
      city: location.city,
      state: location.state,
      segment,
      family,
      status: "error",
      error_code: code,
      error_message: resolved.message,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });

    return safeFailure(code, {
      cache: serializeCacheRow(saved),
    });
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return failure("INVALID_REQUEST", "Este serviço aceita somente POST.", 405);
  }

  const auth = await authenticate(request);
  if (!auth.ok) {
    return failure(auth.code, auth.message, auth.status);
  }
  const userId = auth.userId;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return failure("INVALID_REQUEST", "A solicitação está em formato inválido.", 400);
  }

  const location = validLocation(body);
  if (!location) {
    return failure("INVALID_LOCATION", "Informe cidade e UF válidas.", 400);
  }

  const mode = body.mode === "refresh" ? "refresh" : "cache";

  try {
    if (mode === "refresh") {
      return await runRefresh(userId, location, body);
    }

    await cleanupExpiredCache(userId);
    const rows = await readCache(userId, location.key);
    return json({
      ok: true,
      city: location.city,
      state: location.state,
      timeZone: "America/Sao_Paulo",
      cacheTtlMinutes: OPEN_NOW_CACHE_TTL_MS / 60_000,
      niches: rows.map(serializeCacheRow),
    });
  } catch (error) {
    const code = errorCode(error);
    logDiagnostic("request_failed", { code });
    return safeFailure(code);
  }
});
