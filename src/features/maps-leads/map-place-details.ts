import { getAccessToken } from "../../lib/auth";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";
import type { BusinessSearchResult } from "../search-leads/types";

export type PlaceDetailsResult =
  | { ok: true; business: BusinessSearchResult }
  | { ok: false; message: string };

/**
 * One explicit Place Details (Enterprise) call. Never run automatically when
 * a pin is selected: requires prior lead unlock, Pro/Advanced, and API budgets.
 */
export async function loadMapPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  if (!/^[a-zA-Z0-9_-]{4,255}$/.test(placeId)) {
    return { ok: false, message: "Identificador inválido para consultar detalhes." };
  }
  const token = await getAccessToken();
  if (!token) return { ok: false, message: "Faça login novamente para consultar os detalhes." };
  try {
    const response = await fetch(SUPABASE_URL + "/functions/v1/search-places", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "place-details", placeId }),
    });
    const data: unknown = await response.json();
    if (!response.ok || !data || typeof data !== "object") {
      const message = data && typeof data === "object" && "message" in data &&
        typeof data.message === "string" ? data.message : "Não foi possível consultar dados adicionais.";
      return { ok: false, message };
    }
    if (!("ok" in data) || data.ok !== true || !("business" in data) ||
        !data.business || typeof data.business !== "object" ||
        !("placeId" in data.business) || data.business.placeId !== placeId) {
      return { ok: false, message: "Resposta inválida ao consultar dados adicionais." };
    }
    return { ok: true, business: data.business as BusinessSearchResult };
  } catch {
    return { ok: false, message: "Falha de conexão ao consultar dados adicionais." };
  }
}
