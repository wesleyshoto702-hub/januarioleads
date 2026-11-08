import { getAccessToken } from "../../lib/auth";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";
import type { BusinessSearchResult } from "../search-leads/types";
import type { SaasUsage } from "../search-leads/saas-usage";

/** One authenticated search: backend decides the provider without another user click. */
export type GeoapifyPreview = {
  source: "geoapify";
  sourceId: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export type MapsAutoSearchResponse =
  | { ok: true; provider: "geoapify"; places: GeoapifyPreview[];
      limit: 35; nextPageToken: null; quota?: SaasUsage; creditCost?: 2; creditsSpent?: number;
      coverage: {
        status: "matches";
        searchArea: "city" | "nearby-10km";
        message: string | null;
      };
      attribution: { provider: string; providerUrl: string; data: string; dataUrl: string } }
  | { ok: true; provider: "google"; results: BusinessSearchResult[];
      limit: 35; nextPageToken: null; quota?: SaasUsage; creditCost?: 2; creditsSpent?: number; partial?: boolean; sourceSelection: "google_direct" | "google_fallback";
      attribution: { provider: string }; note: string }
  | { ok: false; code: string; message: string };

export async function searchAutomaticMaps(input: {
  segment: string;
  city: string;
  state: string;
  neighborhood?: string;
}): Promise<MapsAutoSearchResponse> {
  const accessToken = await getAccessToken();
  if (!accessToken) return {
    ok: false, code: "AUTH_REQUIRED", message: "Sua sessão expirou.",
  };
  try {
    const response = await fetch(
      SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/geoapify-places",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: "Bearer " + accessToken,
        },
        body: JSON.stringify({
          action: "search",
          city: input.city,
          state: input.state,
          segment: input.segment,
          mapMode: true,
          ...(input.neighborhood?.trim() ? { neighborhood: input.neighborhood.trim() } : {}),
        }),
      },
    );
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("ok" in payload)) {
      return { ok: false, code: "INVALID_RESPONSE", message: "O serviço de busca retornou uma resposta inválida." };
    }
    if ((payload as { ok: unknown }).ok === false) {
      const error = payload as { code?: unknown; message?: unknown };
      return {
        ok: false, code: typeof error.code === "string" ? error.code : "REQUEST_FAILED",
        message: typeof error.message === "string" ? error.message : "Busca indisponível.",
      };
    }
    if ((payload as { ok: unknown }).ok !== true ||
        !(("provider" in payload) && (
          (payload.provider === "geoapify" && "places" in payload &&
            Array.isArray(payload.places)) ||
          (payload.provider === "google" && "results" in payload &&
            Array.isArray(payload.results))
        ))) {
      return { ok: false, code: "INVALID_RESPONSE", message: "O serviço de busca retornou uma resposta inválida." };
    }
    return payload as MapsAutoSearchResponse;
  } catch {
    return { ok: false, code: "REQUEST_FAILED", message: "Não foi possível consultar o serviço de busca." };
  }
}
