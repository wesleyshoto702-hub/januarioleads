import { getAccessToken } from "../../lib/auth";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";
import type { BusinessSearchResult } from "../search-leads/types";

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

export type GeoapifySearchResponse =
  | { ok: true; provider: "geoapify"; places: GeoapifyPreview[];
      limit: 20; nextPageToken: null;
      coverage: {
        status: "matches" | "no_osm_category_matches" | "unconfirmed_nearby";
        searchArea: "city" | "nearby-10km";
        cityBoundaryChecked: boolean;
        nearbyRadiusMeters: number | null;
        nearbyRadiusChecked: boolean;
        nearbySkippedReason: "budget" | "throttle" | "provider" | null;
        message: string | null;
        alternativeSource: "google_places_manual" | null;
      };
      attribution: { provider: string; providerUrl: string; data: string; dataUrl: string } }
  | { ok: true; provider: "google"; results: BusinessSearchResult[];
      limit: 20; nextPageToken: null; sourceSelection: "google_direct" | "google_fallback";
      attribution: { provider: string }; note: string }
  | { ok: false; code: string; message: string };

export async function searchAutomaticMaps(input: {
  segment: string;
  city: string;
  state: string;
  neighborhood?: string;
}): Promise<GeoapifySearchResponse> {
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
      return { ok: false, code: "INVALID_RESPONSE", message: "Resposta Geoapify inválida." };
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
      return { ok: false, code: "INVALID_RESPONSE", message: "Resposta Geoapify inválida." };
    }
    return payload as GeoapifySearchResponse;
  } catch {
    return { ok: false, code: "REQUEST_FAILED", message: "Não foi possível consultar o Geoapify." };
  }
}
