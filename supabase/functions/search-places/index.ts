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
type GoogleOpeningHours = {
  openNow?: boolean;
  weekdayDescriptions?: string[];
};
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
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

function component(place: GooglePlace, type: string) {
  return (
    place.addressComponents?.find((item) => item.types?.includes(type))
      ?.longText ?? null
  );
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
    state: component(place, "administrative_area_level_1"),
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

function isLavras(place: BusinessSearchResult) {
  return (
    normalize(place.city) === "lavras" ||
    normalize(place.address).includes("lavras")
  );
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
  lead: { company: string; segment: string; phone?: string | null },
  method: EnrichmentMethod,
): EnrichmentCandidate {
  const phone = phoneMatch(lead.phone, business);
  const name = nameScore(lead.company, business.name);
  const lavras = isLavras(business);
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

  if (lavras) {
    score += 1;
    reasons.push("A empresa encontrada está em Lavras - MG.");
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
) {
  const segment = body.segment;
  const pageToken = body.pageToken;

  if (
    typeof segment !== "string" ||
    segment.trim().length < 2 ||
    segment.trim().length > 120
  ) {
    return failure(
      "INVALID_REQUEST",
      "Informe um segmento válido para realizar a busca.",
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
    `${segment.trim()} em Lavras, Minas Gerais, Brasil`,
    20,
    typeof pageToken === "string" ? pageToken.trim() : undefined,
  );

  if (!searched.ok) return searched.response;

  return json({
    ok: true,
    results: searched.results.filter(isLavras),
    nextPageToken: searched.nextPageToken,
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

  const normalizedLead = {
    company: lead.company.trim(),
    segment: lead.segment.trim(),
    phone: typeof lead.phone === "string" ? lead.phone.trim() : "",
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

    for (const business of searched.results.filter(isLavras)) {
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
    `${normalizedLead.company} em Lavras, Minas Gerais, Brasil`,
    10,
  );
  if (!byName.ok) return byName.response;

  for (const business of byName.results.filter(isLavras)) {
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
    `${normalizedLead.company} ${normalizedLead.segment} em Lavras, Minas Gerais, Brasil`,
    10,
  );
  if (!bySegment.ok) return bySegment.response;

  for (const business of bySegment.results.filter(isLavras)) {
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

Deno.serve(async (request) => {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(
      "INVALID_REQUEST",
      "A solicitação de busca está em formato inválido.",
      400,
    );
  }

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
      : "segment-search";

  try {
    if (mode === "lead-enrichment") {
      return await runLeadEnrichment(googleApiKey, requestBody);
    }

    return await runSegmentSearch(googleApiKey, requestBody);
  } catch {
    return failure(
      "REQUEST_FAILED",
      "Não foi possível comunicar com o Google Places agora.",
      502,
    );
  }
});
