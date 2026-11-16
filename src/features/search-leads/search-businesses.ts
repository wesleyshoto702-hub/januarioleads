import type { BusinessSearchResponse } from "./types";
import { requestSearchBusinesses } from "./search-businesses-http";
import type { SearchHttpObservation } from "./search-metrics";
import { getAccessToken } from "../../lib/auth";
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

  return {
    functionUrl: `${url.replace(/\/$/, "")}/functions/v1/search-places`,
    publishableKey,
  };
}

export async function searchBusinesses(
  input: SearchBusinessesInput,
  onObservation?: (event:SearchHttpObservation)=>void,
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
    const accessToken=await getAccessToken();
    return requestSearchBusinesses(input,{
      fetcher:fetch,
      endpoint:config.functionUrl,
      publishableKey:config.publishableKey,
      accessToken,
      ...(onObservation ? {onObservation} : {}),
    });
  }catch{
    return {
      ok:false,code:"REQUEST_FAILED",
      message:"Não foi possível conectar ao serviço de busca. Tente novamente.",
    };
  }
}
