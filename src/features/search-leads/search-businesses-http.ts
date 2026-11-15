import type { BusinessSearchResponse } from "./types.ts";
import type { SearchLocation } from "./search-location.ts";

/** HTTP contract for a single Buscar Leads request.
 * Pure dependency injection: no auth provider, credentials, real endpoint,
 * external network or browser APIs are read unless injected by the caller.
 */
export type SearchRequestInput = SearchLocation & {
  segment: string;
  pageToken?: string;
};
export type SearchHttpDependencies = {
  fetcher: (url: string, init: RequestInit) => Promise<Response>;
  endpoint: string;
  publishableKey: string;
  accessToken: string | null;
};
const failures = {
  missingSession: {
    ok: false as const, code: "AUTH_REQUIRED" as const,
    message: "Sua sessão expirou. Entre novamente para buscar empresas.",
  },
  malformed: {
    ok: false as const, code: "REQUEST_FAILED" as const,
    message: "A busca respondeu de forma inesperada. Tente novamente.",
  },
  unavailable: {
    ok: false as const, code: "REQUEST_FAILED" as const,
    message: "Não foi possível conectar ao serviço de busca. Tente novamente.",
  },
};
const FAILURE_CODES = new Set([
  "NOT_CONFIGURED", "AUTH_REQUIRED", "FORBIDDEN", "GOOGLE_AUTH",
  "API_NOT_ENABLED", "BILLING_REQUIRED", "INVALID_REQUEST", "QUOTA",
  "REQUEST_FAILED",
]);
function parseSearchResponse(value: unknown): BusinessSearchResponse | null {
  if(!value || typeof value!=="object") return null;
  const p=value as Record<string, unknown>;
  if(p["ok"]===false && typeof p["code"]==="string" && FAILURE_CODES.has(p["code"]) &&
    typeof p["message"]==="string")
    return p as BusinessSearchResponse;
  if(p["ok"]!==true || !Array.isArray(p["results"]) ||
    !(p["nextPageToken"]===null || typeof p["nextPageToken"]==="string") ||
    !p["results"].every(row=>row && typeof row==="object" &&
      typeof row.placeId==="string" && row.placeId.length>0 &&
      typeof row.name==="string" && row.name.length>0 &&
      Array.isArray(row.categories)))
    return null;
  return p as BusinessSearchResponse;
}
export async function requestSearchBusinesses(
  input: SearchRequestInput,
  deps: SearchHttpDependencies,
): Promise<BusinessSearchResponse> {
  // Do not send requests if the user has no current session.
  if(!deps.accessToken?.trim()) return failures.missingSession;
  if(!deps.endpoint.startsWith("https://") || !deps.publishableKey.trim())
    return {
      ok: false, code: "NOT_CONFIGURED",
      message: "A conexão pública com o Supabase ainda não está configurada neste ambiente.",
    };
  try {
    const response=await deps.fetcher(deps.endpoint,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        apikey:deps.publishableKey,
        Authorization:`Bearer ${deps.accessToken}`,
      },
      body:JSON.stringify({
        segment:input.segment,
        city:input.city,
        state:input.state,
        ...(input.pageToken?{pageToken:input.pageToken}:{}),
      }),
    });
    if(response.status===401) return failures.missingSession;
    let payload:unknown;
    try{payload=await response.json();}
    catch{return failures.malformed;}
    const parsed=parseSearchResponse(payload);
    // A non-2xx response cannot be accepted as success, even if malformed
    // upstream code sends {ok:true} with HTTP 500.
    if(!response.ok){
      if(parsed && !parsed.ok)return parsed;
      return failures.malformed;
    }
    return parsed??failures.malformed;
  }catch{
    return failures.unavailable;
  }
}
