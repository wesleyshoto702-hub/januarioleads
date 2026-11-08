import { isAllowedBrowserOrigin } from "../_shared/allowed-browser-origins.ts";
import { findBrazilianState } from "../_shared/brazil-locations.ts";
import {
  geoapifyCategoryForSegment,
  normalizeGeoapifyPlaces,
  resolveGeoapifyCityId,
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
  if (origin && isAllowedBrowserOrigin(origin, Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")) {
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

async function handle(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && !isAllowedBrowserOrigin(origin, Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")) {
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

  const configured = Deno.env.get("GEOAPIFY_HYBRID_ENABLED") === "true" &&
    Boolean(Deno.env.get("GEOAPIFY_API_KEY")?.trim());
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
      description: configured ? "Disponível somente em staging." : "Desativado por segurança.",
      supportedSegments: ["Barbearia", "Salão de Beleza", "Academia", "Restaurante", "Cafeteria", "Pizzaria", "Spa"],
      googlePlacesUnaffected: true,
    });
  }

  if (fields.action !== "search") return fail(request, "INVALID_REQUEST", "Ação não suportada.", 400);
  if (!configured) return fail(request, "NOT_ENABLED", "Geoapify ainda não foi ativado neste ambiente.", 503);

  const segment = typeof fields.segment === "string" ? fields.segment.trim() : "";
  const city = typeof fields.city === "string" ? fields.city.trim() : "";
  const state = typeof fields.state === "string" ? findBrazilianState(fields.state) : null;
  const category = geoapifyCategoryForSegment(segment);
  if (!category || city.length < 2 || city.length > 80 ||
      !/^[\p{L}\p{M}\p{N}\s.'-]+$/u.test(city) || !state ||
      fields.pageToken !== undefined || fields.offset !== undefined) {
    return fail(request, "INVALID_REQUEST",
      "Informe um nicho suportado, cidade e UF válidos, sem paginação.", 400);
  }
  if (fields.mapMode === true) {
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

  // Preflight before quotas and network calls. A search is only one provider's
  // operation: no automatic Google fallback that charges the customer twice.
  const peek = await callPrivilegedRpc("saas_free_search_quota", {
    p_user_id: auth.userId, p_claim: false,
  }) as { plan?: string; allowed?: boolean } | null;
  if (!peek) return fail(request, "REQUEST_FAILED", "Não foi possível verificar o limite de buscas.", 503);
  if (peek.plan === "free" && peek.allowed !== true) {
    return fail(request, "DAILY_SEARCH_LIMIT", "Você já usou as 3 pesquisas gratuitas de hoje.", 429);
  }
  const rate = await callPrivilegedRpc("claim_api_request_for_user", {
    p_user_id: auth.userId, p_bucket: "places_search",
  });
  if (rate !== true) return fail(request, "QUOTA", "Muitas consultas. Tente novamente mais tarde.", 429);

  const claim = await callPrivilegedRpc("saas_free_search_quota", {
    p_user_id: auth.userId, p_claim: true,
  }) as { plan?: string; allowed?: boolean; remaining_today?: number } | null;
  if (!claim) return fail(request, "REQUEST_FAILED", "Falha ao registrar sua pesquisa.", 503);
  if (claim.plan === "free" && claim.allowed !== true) {
    return fail(request, "DAILY_SEARCH_LIMIT", "Você já usou as 3 pesquisas gratuitas de hoje.", 429);
  }

  const geocodeBudget = await callPrivilegedRpc("claim_saas_geoapify_api_budget", {
    p_user_id: auth.userId, p_operation: "geocode",
  });
  if (geocodeBudget !== true) {
    return fail(request, "PROVIDER_BUDGET", "Limite seguro do Geoapify atingido ou desativado.", 429);
  }

  const key = Deno.env.get("GEOAPIFY_API_KEY")!.trim();
  try {
    const geocode = new URL("https://api.geoapify.com/v1/geocode/search");
    geocode.searchParams.set("text", city + ", " + state.name + ", Brasil");
    geocode.searchParams.set("filter", "countrycode:br");
    geocode.searchParams.set("type", "city");
    geocode.searchParams.set("lang", "pt");
    geocode.searchParams.set("limit", "5");
    geocode.searchParams.set("format", "geojson");
    geocode.searchParams.set("apiKey", key);

    const cityResponse = await fetch(geocode, { signal: AbortSignal.timeout(7000) });
    if (!cityResponse.ok) return fail(request, "PROVIDER_ERROR", "Geoapify indisponível para localizar a cidade.", 502);
    const cityData: unknown = await cityResponse.json();
    const cityId = resolveGeoapifyCityId(cityData, city, state.code);
    if (!cityId) return fail(request, "LOCATION_NOT_FOUND", "Cidade não encontrada no estado indicado.", 404);

    const placesBudget = await callPrivilegedRpc("claim_saas_geoapify_api_budget", {
      p_user_id: auth.userId, p_operation: "places",
    });
    if (placesBudget !== true) {
      return fail(request, "PROVIDER_BUDGET", "Limite seguro da busca Geoapify atingido.", 429);
    }

    const places = new URL("https://api.geoapify.com/v2/places");
    places.searchParams.set("categories", category);
    places.searchParams.set("filter", "place:" + cityId);
    places.searchParams.set("limit", "20");
    places.searchParams.set("lang", "pt");
    places.searchParams.set("apiKey", key);
    const response = await fetch(places, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return fail(request, "PROVIDER_ERROR", "Busca Geoapify temporariamente indisponível.", 502);
    const data: unknown = await response.json();

    return reply(request, {
      ok: true,
      provider: "geoapify",
      places: normalizeGeoapifyPlaces(data, { city, state: state.code }),
      limit: 20, nextPageToken: null,
      quota: claim,
      attribution: {
        provider: "Powered by Geoapify",
        providerUrl: "https://www.geoapify.com/",
        data: "© OpenStreetMap contributors",
        dataUrl: "https://www.openstreetmap.org/copyright",
      },
      note: "Somente descoberta de estabelecimentos; contatos não são exportados nem liberados.",
    });
  } catch {
    return fail(request, "PROVIDER_ERROR", "Não foi possível consultar o Geoapify agora.", 502);
  }
}

Deno.serve(handle);
