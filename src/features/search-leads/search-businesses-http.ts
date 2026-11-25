import type { BusinessSearchResponse } from "./types.ts";
import type { SearchLocation } from "./search-location.ts";
import { httpStatusClass, type SearchHttpObservation } from "./search-metrics.ts";
import { parseSearchContinuation } from "../../../supabase/functions/_shared/search-continuation.ts";

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
  /** Optional in-memory telemetry sink, no PII or external delivery. */
  onObservation?: (value:SearchHttpObservation)=>void;
  /** Inject a deterministic clock for offline tests; do not persist timings. */
  clockNowMs?: ()=>number;
  /** Bound the entire fetch + JSON parse, including transports ignoring AbortSignal. */
  requestTimeoutMs?: number;
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
  timedOut: {
    ok: false as const, code: "REQUEST_FAILED" as const,
    message: "A busca demorou mais do que o esperado. Verifique a conexão e tente novamente.",
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
  // The observer only receives duration/status/count; never request body,
  // headers, credentials, search text, city, phone or lead metadata.
  const observe=deps.onObservation;
  const clock=deps.clockNowMs??Date.now;
  const started=observe?clock():0;
  let httpAttempts:0|1=0;
  let observedHttpStatus:number|null=null;

  async function request():Promise<BusinessSearchResponse>{
    if(!deps.accessToken?.trim()) return failures.missingSession;
    if(input.pageToken!==undefined && parseSearchContinuation(input.pageToken).kind==="invalid")
      return {ok:false,code:"INVALID_REQUEST",message:"O token de continuação da busca é inválido."};

    if(!deps.endpoint.startsWith("https://") || !deps.publishableKey.trim())
      return {
        ok: false, code: "NOT_CONFIGURED",
        message: "A conexão pública com o Supabase ainda não está configurada neste ambiente.",
      };
    // A stuck network call or body reader must not leave "Buscando..." forever.
    // Exactly one request: never automatically retry paid-capable providers.
    const timeoutMs = typeof deps.requestTimeoutMs === "number" &&
      Number.isFinite(deps.requestTimeoutMs)
      ? Math.max(1, Math.min(30_000, Math.floor(deps.requestTimeoutMs)))
      : 20_000;
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const singleAttempt = async (): Promise<BusinessSearchResponse> => {
      try {
        httpAttempts=1;
        const response=await deps.fetcher(deps.endpoint,{
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            apikey:deps.publishableKey,
            Authorization:`Bearer ${deps.accessToken}`,
          },
          signal:controller.signal,
          body:JSON.stringify({
            segment:input.segment,
            city:input.city,
            state:input.state,
            ...(input.pageToken?{pageToken:input.pageToken}:{}),
          }),
        });
        observedHttpStatus=response.status;
        if(response.status===401) return failures.missingSession;
        let payload:unknown;
        try{payload=await response.json();}
        catch{return failures.malformed;}
        const parsed=parseSearchResponse(payload);
        if(!response.ok){
          if(parsed && !parsed.ok)return parsed;
          return failures.malformed;
        }
        return parsed??failures.malformed;
      }catch{
        return failures.unavailable;
      }
    };
    const timeout = new Promise<BusinessSearchResponse>((resolve) => {
      timeoutHandle=setTimeout(() => {
        controller.abort();
        resolve(failures.timedOut);
      },timeoutMs);
    });
    try {
      return await Promise.race([singleAttempt(),timeout]);
    } finally {
      if(timeoutHandle!==undefined)clearTimeout(timeoutHandle);
    }
  }
  const outcome=await request();
  if(observe){
    try{
      observe({
        page:input.pageToken?"continuation":"initial",
        outcome:outcome.ok?"ok":outcome.code,
        elapsedMs:Math.max(0,clock()-started),
        httpAttempts,
        httpStatusClass:httpStatusClass(observedHttpStatus),
        returnedCount:outcome.ok?outcome.results.length:0,
      });
    }catch{
      // Measurements must never break business search or leak private data.
    }
  }
  return outcome;
}
