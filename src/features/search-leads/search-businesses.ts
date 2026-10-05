import type { BusinessSearchResponse } from "./types";
import { getAccessToken } from "../../lib/auth";

type SearchBusinessesInput = {
  segment: string;
  city: string;
  state: "MG";
  pageToken?: string;
};

const PUBLIC_SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

function getSupabaseConfig() {
  const url =
    import.meta.env["VITE_SUPABASE_URL"]?.trim() || PUBLIC_SUPABASE_URL;
  const publishableKey =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
      message:
        "A conexão pública com o Supabase ainda não está configurada neste ambiente.",
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
      message:
        "Não foi possível buscar empresas agora. Tente novamente.",
    };
  } catch {
    return {
      ok: false,
      code: "REQUEST_FAILED",
      message: "Não foi possível conectar ao serviço de busca. Tente novamente.",
    };
  }
}
