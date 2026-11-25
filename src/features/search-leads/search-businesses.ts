import type { BusinessSearchResponse } from "./types";
import { requestSearchBusinesses, requestOvertureFallback } from "./search-businesses-http";
import type { SearchHttpObservation } from "./search-metrics";
import { getAccessToken, getFreshRequestAccessToken } from "../../lib/auth";
import type { SearchLocation } from "./search-location";

type SearchBusinessesInput = SearchLocation & {
  segment: string;
  pageToken?: string;
};

import {
  SUPABASE_URL as PUBLIC_SUPABASE_URL,
  USE_HTTPONLY_SESSION,
  SUPABASE_PUBLISHABLE_KEY as PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} from "../../lib/supabase-config";

function getSupabaseConfig() {
  const url = (USE_HTTPONLY_SESSION
    ? PUBLIC_SUPABASE_URL
    : import.meta.env["VITE_SUPABASE_URL"]?.trim() || PUBLIC_SUPABASE_URL);
  const publishableKey =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() || PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const onLovable = typeof window !== "undefined" &&
    /(^|\.)lovable\.(app|dev)$/.test(window.location.hostname);
  const production = url.replace(/\/$/, "") === "https://czkazbianiflhldenhcj.supabase.co";
  return {
    functionUrl: !USE_HTTPONLY_SESSION && onLovable && production
      ? "/api/search-places"
      : `${url.replace(/\/$/, "")}/functions/v1/search-places`,
    publishableKey,
    fallbackUrl: production && !USE_HTTPONLY_SESSION
      ? `${url.replace(/\/$/, "")}/rest/v1/rpc/search_overture_fallback` : null,
  };
}

/** Bound session validation as well as the HTTP request. A paused Auth
 * backend must not leave the Buscar Leads button spinning indefinitely.
 */
async function getSearchAccessToken(): Promise<string | null> {
  const fresh = getFreshRequestAccessToken();
  if (fresh) return fresh;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AUTH_TIMEOUT")), 5_000);
  });
  try {
    return await Promise.race([getAccessToken(), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function searchBusinesses(
  input: SearchBusinessesInput,
  onObservation?: (event:SearchHttpObservation)=>void,
  onLocalResults?: (response: Extract<BusinessSearchResponse,{ok:true}>)=>void,
): Promise<BusinessSearchResponse> {
  const config = getSupabaseConfig();

  if (!config) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "A conexão pública com o Supabase ainda não está configurada neste ambiente.",
    };
  }

  try {
    const accessToken=await getSearchAccessToken();
    const fallbackAllowed = Boolean(config.fallbackUrl && accessToken && !input.pageToken);
    // Read local Overture first; do not hold visible results behind a
    // potentially slow external provider. Both paths enforce server auth.
    const local = fallbackAllowed && config.fallbackUrl && accessToken
      ? await requestOvertureFallback(input,{
          fetcher:fetch, endpoint:config.fallbackUrl,
          publishableKey:config.publishableKey, accessToken,
        })
      : null;
    if (local?.ok && local.results.length > 0) {
      onLocalResults?.(local);
    }
    const response = await requestSearchBusinesses(input,{
      fetcher:fetch,
      endpoint:config.functionUrl,
      publishableKey:config.publishableKey,
      accessToken,
      requestTimeoutMs: 20_000,
      ...(onObservation ? {onObservation} : {}),
    });
    if (!fallbackAllowed || !config.fallbackUrl || !accessToken ||
        (response.ok && response.results.length > 0) ||
        (!response.ok && ["AUTH_REQUIRED","FORBIDDEN","INVALID_REQUEST"].includes(response.code))) {
      return response;
    }
    return local?.ok && local.results.length > 0
      ? {...local,providerNotice:"Exibindo empresas da base Overture. A consulta complementar não retornou resultados nesta tentativa."}
      : response;
  }catch{
    return {
      ok:false,code:"REQUEST_FAILED",
      message:"Não foi possível conectar ao serviço de busca. Tente novamente.",
    };
  }
}
