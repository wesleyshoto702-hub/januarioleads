import type { BusinessSearchResponse, SaasSearchQuota } from "./types";
import { getAccessToken } from "../../lib/auth";
import { SAAS_STAGING_ACTIVE } from "./saas-usage";
import type { SearchLocation } from "./search-location";

type SearchBusinessesInput = SearchLocation & {
  segment: string;
  pageToken?: string;
  neighborhood?: string;
  mapMode?: boolean;
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
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sua sessão expirou. Entre novamente para buscar empresas.",
      };
    }

    const response = await fetch(config.functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        segment: input.segment,
        city: input.city,
        state: input.state,
        ...(input.pageToken ? { pageToken: input.pageToken } : {}),
        ...(input.neighborhood?.trim() ? { neighborhood: input.neighborhood.trim() } : {}),
        ...(input.mapMode ? { mapMode: true } : {}),
        ...(SAAS_STAGING_ACTIVE ? { stagingDemo: true } : {}),
      }),
    });

    if (response.status === 401) {
      return {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sua sessão expirou. Entre novamente para buscar empresas.",
      };
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        code: "REQUEST_FAILED",
        message: "A busca respondeu de forma inesperada. Tente novamente.",
      };
    }

    if (
      payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      typeof (payload as { ok?: unknown }).ok === "boolean"
    ) {
      return payload as BusinessSearchResponse;
    }

    return {
      ok: false,
      code: "REQUEST_FAILED",
      message: "Não foi possível buscar empresas agora. Tente novamente.",
    };
  } catch {
    return {
      ok: false,
      code: "REQUEST_FAILED",
      message: "Não foi possível conectar ao serviço de busca. Tente novamente.",
    };
  }
}

/** Refreshes the Free search counter without consuming a search. */
export async function loadMySearchQuota(): Promise<SaasSearchQuota | null> {
  if (!SAAS_STAGING_ACTIVE) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const config = getSupabaseConfig();
  try {
    const response = await fetch(config.functionUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        apikey: config.publishableKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode: "search-quota" }),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" ||
        !("searchQuota" in payload)) return null;
    const quota = (payload as { searchQuota?: unknown }).searchQuota;
    if (!quota || typeof quota !== "object") return null;
    const item = quota as Partial<SaasSearchQuota>;
    if (!["free", "pro", "advanced"].includes(item.plan ?? "") ||
        typeof item.allowed !== "boolean" ||
        item.max_results !== 20 ||
        (item.plan === "free" && (item.daily_limit !== 3 ||
          !Number.isInteger(item.remaining_today)))) return null;
    return item as SaasSearchQuota;
  } catch {
    return null;
  }
}
