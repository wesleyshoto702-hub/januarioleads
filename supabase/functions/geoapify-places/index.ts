import { isAllowedBrowserOrigin } from "../_shared/allowed-browser-origins.ts";
import { findBrazilianState } from "../_shared/brazil-locations.ts";
import {
  mapsSearchTerm, normalizeGooglePreview, routingReason, shouldTryGeoapify,
} from "../_shared/maps-auto-google.ts";
import {
  classifyGeoapifyCoverage,
  geoapifyCategoryForSegment,
  geoapifyFeatureCount,
  normalizeGeoapifyPlaces,
  resolveGeoapifyCityLocation,
} from "../_shared/geoapify-adapter.ts";

// This isolated adapter remains off until explicitly activated in staging.
// Do not merge provider content with Google data or Google Place IDs.
const STAGING_URL = "https://prlrxjothrslhswpkoza.supabase.co";
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function reply(request: Request, data: unknown, status = 200): Response {
  const headers = new Headers(corsHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  const origin = request.headers.get("origin");
  if (origin && allowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function fail(request: Request, code: string, message: string, status: number) {
  return reply(request, { ok: false, code, message }, status);
}

function allowedClientKeys() {
  const keys = new Set<string>();
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (anon) keys.add(anon);
  const supplied = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (supplied) {
    try {
      const parsed: unknown = JSON.parse(supplied);
      if (parsed && typeof parsed === "object") {
        for (const value of Object.values(parsed)) {
          if (typeof value === "string") keys.add(value);
        }
      }
    } catch { /* legacy key only */ }
  }
  return keys;
}

function adminCredentials() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return { apikey: legacy, Authorization: "Bearer " + legacy };
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const options = Object.values(parsed).filter(
      (value): value is string => typeof value === "string" && value.length > 10
    );
    if (options.length) return { apikey: options[0]!, Authorization: "" };
  } catch { /* missing secret */ }
  return null;
}

async function callPrivilegedRpc(name: string, data: Record<string, unknown>):
  Promise<unknown | null> {
  const cred = adminCredentials();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!cred || !supabaseUrl) return null;
  const response = await fetch(supabaseUrl + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: cred.apikey,
      ...(cred.Authorization ? { Authorization: cred.Authorization } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return response.ok ? await response.json() : null;
}

async function checkAuthorization(request: Request): Promise<
  { ok: true; userId: string; bearer: string; apiKey: string } |
  { ok: false; status: number; code: string; message: string }
> {
  const apiKey = request.headers.get("apikey") ?? "";
  const bearer = request.headers.get("Authorization") ?? "";
  if (!allowedClientKeys().has(apiKey)) {
    return { ok: false, status: 401, code: "AUTH_REQUIRED", message: "Cliente inválido." };
  }
  if (!/^Bearer\s+\S+$/i.test(bearer)) {
    return { ok: false, status: 401, code: "AUTH_REQUIRED", message: "Faça login novamente." };
  }
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!url) return { ok: false, status: 503, code: "NOT_CONFIGURED", message: "Serviço indisponível." };
  try {
    const headers = { apikey: apiKey, Authorization: bearer };
    const userResp = await fetch(url + "/auth/v1/user", { headers });
    if (!userResp.ok) return {
      ok: false, status: 401, code: "AUTH_REQUIRED", message: "Sessão inválida.",
    };
    const user: unknown = await userResp.json();
    if (!user || typeof user !== "object" ||
        !("id" in user) || typeof user.id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(user.id)) {
      return { ok: false, status: 401, code: "AUTH_REQUIRED", message: "Sessão inválida." };
    }
    const allowed = await fetch(
      url + "/rest/v1/private_access?select=user_id&user_id=eq." +
      encodeURIComponent(user.id) + "&limit=1", { headers }
    );
    if (!allowed.ok) return {
      ok: false, status: 503, code: "REQUEST_FAILED", message: "Acesso temporariamente indisponível.",
    };
    const rows: unknown = await allowed.json();
    if (!Array.isArray(rows) || !rows.some((row) =>
      row && typeof row === "object" &&
      "user_id" in row && row.user_id === user.id)) {
      return { ok: false, status: 403, code: "FORBIDDEN", message: "Conta sem acesso autorizado." };
    }
    return { ok: true, userId: user.id, bearer, apiKey };
  } catch {
    return { ok: false, status: 503, code: "REQUEST_FAILED", message: "Falha ao verificar a sessão." };
  }
}

function allowedOrigin(origin: string): boolean {
  if (isAllowedBrowserOrigin(origin, Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")) return true;
  // Scope preview hostname handling to the isolated staging Supabase only.
  if (Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") !== STAGING_URL) return false;
  try {
    const u = new URL(origin);
    return u.origin === origin && u.protocol === "https:" && u.port === "" &&
      /^januarioleads-[a-z0-9-]+-wesley-s-projects16\.vercel\.app$/.test(u.hostname.toLowerCase());
  } catch { return false; }
}

async function handle(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigin(origin)) {
    return fail(request, "FORBIDDEN", "Origem não autorizada.", 403);
  }
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204, headers: {
      ...corsHeaders,
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    },
  });
  if (request.method !== "POST") return fail(request, "INVALID_REQUEST", "Use POST.", 405);
  if (Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") !== STAGING_URL) {
    return fail(request, "NOT_ENABLED", "A integração Geoapify está restrita ao ambiente de testes.", 503);
  }
  const auth = await checkAuthorization(request);
  if (!auth.ok) return fail(request, auth.code, auth.message, auth.status);

  const keyConfigured = Boolean(Deno.env.get("GEOAPIFY_API_KEY")?.trim());
  const featureFlagEnabled = Deno.env.get("GEOAPIFY_HYBRID_ENABLED") === "true";
  const configured = featureFlagEnabled && keyConfigured;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 8192) {
    return fail(request, "INVALID_REQUEST", "Requisição muito grande.", 413);
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return fail(request, "INVALID_REQUEST", "JSON inválido.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail(request, "INVALID_REQUEST", "Dados inválidos.", 400);
  }
  const fields = body as Record<string, unknown>;

  if (fields.action === "status") {
    return reply(request, {
      ok: true, provider: "geoapify", enabled: configured,
      // Report only non-secret readiness bits for the authenticated staging owner.
      // Never return the API key or provider headers.
      keyConfigured,
      featureFlagEnabled,
      description: configured ? "Disponível somente em staging." : "Desativado por segurança.",
      supportedSegments: ["Barbearia", "Salão de Beleza", "Academia", "Restaurante", "Cafeteria", "Pizzaria", "Spa"],
      googlePlacesUnaffected: true,
    });
  }

  if (fields.action !== "search") return fail(request, "INVALID_REQUEST", "Ação não suportada.", 400);

  const segment = typeof fields.segment === "string" ? fields.segment.trim() : "";
  const city = typeof fields.city === "string" ? fields.city.trim() : "";
  const neighborhood = typeof fields.neighborhood === "string" ? fields.neighborhood.trim() : "";
  const state = typeof fields.state === "string" ? findBrazilianState(fields.state) : null;
  const category = geoapifyCategoryForSegment(segment);
  if (!mapsSearchTerm(segment) || city.length < 2 || city.length > 80 ||
      !/^[\p{L}\p{M}\p{N}\s.'-]+$/u.test(city) || !state ||
      neighborhood.length > 80 || !/^[\p{L}\p{M}\p{N}\s.,'()\/-]*$/u.test(neighborhood) ||
      fields.pageToken !== undefined || fields.offset !== undefined ||
      fields.mapMode !== true) {
    return fail(request, "INVALID_REQUEST",
      "Informe segmento, cidade e UF válidos para Buscar via Maps.", 400);
  }
  {
    const url = STAGING_URL + "/rest/v1/rpc/saas_my_feature_enabled";
    try {
      const permission = await fetch(url, {
        method: "POST", headers: {
          apikey: auth.apiKey, Authorization: auth.bearer, "Content-Type": "application/json",
        }, body: JSON.stringify({ p_feature_key: "maps_search" }),
      });
      if (!permission.ok) return fail(request, "REQUEST_FAILED", "Falha ao verificar plano.", 503);
      if (await permission.json() !== true) {
        return fail(request, "FEATURE_NOT_AVAILABLE", "Maps está disponível apenas no Pro e Advanced.", 403);
      }
    } catch { return fail(request, "REQUEST_FAILED", "Falha ao verificar plano.", 503); }
  }

  // A single search action claims user quotas ONCE. Individual provider
  // calls reserve independent monetary budgets and never cause a second plan claim.
  const peek = await callPrivilegedRpc("saas_free_search_quota", {
    p_user_id: auth.userId, p_claim: false,
  }) as { plan?: string; allowed?: boolean } | null;
  if (!peek) return fail(request, "REQUEST_FAILED", "Não foi possível verificar o limite de pesquisas.", 503);
  if (peek.plan === "free" && !peek.allowed) {
    return fail(request, "DAILY_SEARCH_LIMIT", "Suas 3 pesquisas gratuitas de hoje terminaram.", 429);
  }

  const rate = await callPrivilegedRpc("claim_api_request_for_user", {
    p_user_id: auth.userId, p_bucket: "places_search",
  });
  if (rate !== true) return fail(request, "QUOTA", "Muitas pesquisas. Tente novamente mais tarde.", 429);

  const claim = await callPrivilegedRpc("saas_free_search_quota", {
    p_user_id: auth.userId, p_claim: true,
  }) as { plan?: string; allowed?: boolean; remaining_today?: number } | null;
  if (!claim) return fail(request, "REQUEST_FAILED", "Falha ao registrar sua pesquisa.", 503);
  if (claim.plan === "free" && !claim.allowed) {
    return fail(request, "DAILY_SEARCH_LIMIT", "Suas 3 pesquisas gratuitas de hoje terminaram.", 429);
  }

  const geoKey = Deno.env.get("GEOAPIFY_API_KEY")?.trim() ?? "";
  let geoAttempted = false;

  if (shouldTryGeoapify(segment, neighborhood, configured) && category && geoKey) {
    geoAttempted = true;
    // Each outbound provider request requires a credit AND an aggregate RPS slot.
    const reserveGeo = async (operation: "geocode" | "places"): Promise<boolean> => {
      const budget = await callPrivilegedRpc("claim_saas_geoapify_api_budget", {
        p_user_id: auth.userId, p_operation: operation,
      });
      if (budget !== true) return false;
      const slot = await callPrivilegedRpc("claim_saas_geoapify_request_slot", {
        p_user_id: auth.userId,
      });
      return slot === true;
    };

    try {
      if (await reserveGeo("geocode")) {
        const geocode = new URL("https://api.geoapify.com/v1/geocode/search");
        geocode.searchParams.set("text", city + ", " + state.name + ", Brasil");
        geocode.searchParams.set("filter", "countrycode:br");
        geocode.searchParams.set("type", "city");
        geocode.searchParams.set("lang", "pt");
        geocode.searchParams.set("limit", "5");
        geocode.searchParams.set("format", "geojson");
        geocode.searchParams.set("apiKey", geoKey);
        const geoResponse = await fetch(geocode, { signal: AbortSignal.timeout(7000) });
        if (geoResponse.ok) {
          const cityData: unknown = await geoResponse.json();
          const cityLocation = resolveGeoapifyCityLocation(cityData, city, state.code);
          if (cityLocation && await reserveGeo("places")) {
            const placesUrl = new URL("https://api.geoapify.com/v2/places");
            placesUrl.searchParams.set("categories", category);
            placesUrl.searchParams.set("filter", "place:" + cityLocation.placeId);
            placesUrl.searchParams.set("limit", "20");
            placesUrl.searchParams.set("lang", "pt");
            placesUrl.searchParams.set("apiKey", geoKey);
            const placesResponse = await fetch(placesUrl, { signal: AbortSignal.timeout(7000) });
            if (placesResponse.ok) {
              const placesData: unknown = await placesResponse.json();
              const count = geoapifyFeatureCount(placesData);
              if (count !== null) {
                let matches = normalizeGeoapifyPlaces(placesData, {city, state: state.code});
                let sourceArea: "city" | "nearby-10km" = "city";
                if (count === 0 && await reserveGeo("places")) {
                  const nearby = new URL("https://api.geoapify.com/v2/places");
                  nearby.searchParams.set("categories", category);
                  nearby.searchParams.set("filter",
                    "circle:" + cityLocation.lon + "," + cityLocation.lat + ",10000");
                  nearby.searchParams.set("bias",
                    "proximity:" + cityLocation.lon + "," + cityLocation.lat);
                  nearby.searchParams.set("limit","20");
                  nearby.searchParams.set("lang","pt");
                  nearby.searchParams.set("apiKey",geoKey);
                  const radiusResponse = await fetch(nearby, {
                    signal: AbortSignal.timeout(7000),
                  });
                  if(radiusResponse.ok) {
                    const nearbyData: unknown = await radiusResponse.json();
                    if (geoapifyFeatureCount(nearbyData) !== null) {
                      matches = normalizeGeoapifyPlaces(nearbyData, {city,state:state.code});
                      sourceArea = "nearby-10km";
                    }
                  }
                }

                if (matches.length > 0) {
                  return reply(request,{
                    ok:true,provider:"geoapify",places:matches,limit:20,
                    nextPageToken:null, searchQuota:claim,
                    coverage:{
                      status:classifyGeoapifyCoverage(matches.length,sourceArea==="nearby-10km"),
                      searchArea:sourceArea,
                      message:sourceArea==="nearby-10km"
                        ? "Empresas encontradas nas proximidades. Confira o município indicado."
                        : null,
                    },
                    attribution:{
                      provider:"Powered by Geoapify",
                      providerUrl:"https://www.geoapify.com/",
                      data:"© OpenStreetMap contributors",
                      dataUrl:"https://www.openstreetmap.org/copyright",
                    },
                    note:"Dados de estabelecimentos para consulta, sem importação automática.",
                  });
                }
              }
            }
          }
        }
      }
    } catch {
      // Provider unavailable, malformed or slow: proceed to Google automatically.
      // Never use a broad OSM category to invent matching businesses.
    }
  }

  // Geoapify had no useful businesses (or was unavailable). ONE Google request,
  // only after the server-side budget gate; never repeat the plan search claim.
  const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim();
  if (!googleKey) {
    return fail(request, "NOT_CONFIGURED",
      "Busca temporariamente indisponível: a fonte complementar precisa ser configurada.", 503);
  }
  const googleBudget = await callPrivilegedRpc("claim_saas_google_api_budget", {
    p_user_id: auth.userId, p_operation: "text_search_pro",
  });
  if (googleBudget !== true) {
    return fail(request, "QUOTA",
      "Limite seguro de buscas atingido. Tente novamente após a renovação do orçamento.", 429);
  }

  const googleBody = {
    textQuery: mapsSearchTerm(segment) + " em " +
      (neighborhood ? neighborhood + ", " : "") + city + ", " + state.name + ", Brasil",
    pageSize:20,languageCode:"pt-BR",regionCode:"BR",
  };
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-Goog-Api-Key":googleKey,
        "X-Goog-FieldMask":[
          "places.id","places.displayName","places.primaryTypeDisplayName",
          "places.types","places.formattedAddress","places.addressComponents",
          "places.businessStatus","places.googleMapsUri","places.location",
        ].join(","),
      },
      body:JSON.stringify(googleBody),
      signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      // No credentials, billing or Google debug details in the browser response.
      return fail(request, "PROVIDER_ERROR",
        "O serviço de estabelecimentos não está disponível agora.", 502);
    }
    const responseData: unknown = await response.json();
    const googleResults = normalizeGooglePreview(responseData,city,state.code);
    if (googleResults === null) {
      return fail(request, "PROVIDER_RESPONSE_INVALID",
        "O serviço retornou dados inesperados. Tente novamente.", 502);
    }
    return reply(request,{
      ok:true,provider:"google",results:googleResults,
      limit:20,nextPageToken:null,searchQuota:claim,
      sourceSelection:routingReason(geoAttempted,false),
      attribution:{provider:"Google Maps"},
      note:"Resultados para consulta nesta homologação; contatos e importação ao CRM indisponíveis.",
    });
  } catch {
    return fail(request, "PROVIDER_ERROR",
      "Não foi possível concluir sua pesquisa. Tente novamente mais tarde.", 502);
  }
}

Deno.serve(handle);
