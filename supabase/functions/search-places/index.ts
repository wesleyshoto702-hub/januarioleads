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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    place.addressComponents?.find((item) => item.types?.includes(type))?.longText ??
    null
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
      typeof place.userRatingCount === "number" ? place.userRatingCount : null,
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

function normalize(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isLavras(place: BusinessSearchResult) {
  return (
    normalize(place.city) === "lavras" ||
    normalize(place.address).includes("lavras")
  );
}

function classifyGoogleError(response: Response, payload: GoogleResponse) {
  const googleStatus = payload.error?.status ?? "";
  const message = (payload.error?.message ?? "").toLowerCase();

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
      "Informe um segmento válido para realizar a busca.",
      400,
    );
  }

  const { segment, pageToken } = body as {
    segment?: unknown;
    pageToken?: unknown;
  };

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

  const googleRequest: Record<string, unknown> = {
    textQuery: `${segment.trim()} em Lavras, Minas Gerais, Brasil`,
    pageSize: 20,
    languageCode: "pt-BR",
    regionCode: "BR",
  };

  if (typeof pageToken === "string") {
    googleRequest.pageToken = pageToken.trim();
  }

  try {
    const googleResponse = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          "X-Goog-FieldMask": [
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
          ].join(","),
        },
        body: JSON.stringify(googleRequest),
      },
    );

    let payload: GoogleResponse;

    try {
      payload = (await googleResponse.json()) as GoogleResponse;
    } catch {
      return failure(
        "REQUEST_FAILED",
        "O Google Places respondeu de forma inesperada.",
        502,
      );
    }

    if (!googleResponse.ok) {
      return classifyGoogleError(googleResponse, payload);
    }

    const results = (payload.places ?? [])
      .map(parsePlace)
      .filter((place): place is BusinessSearchResult => Boolean(place))
      .filter(isLavras);

    return json({
      ok: true,
      results,
      nextPageToken: payload.nextPageToken ?? null,
    });
  } catch {
    return failure(
      "REQUEST_FAILED",
      "Não foi possível comunicar com o Google Places agora.",
      502,
    );
  }
});
