import type { BusinessSearchResponse } from "./types";

type SearchBusinessesInput = {
  segment: string;
  pageToken?: string;
};

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;

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
    const response = await fetch(config.functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.publishableKey,
      },
      body: JSON.stringify({
        segment: input.segment,
        ...(input.pageToken ? { pageToken: input.pageToken } : {}),
      }),
    });

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
        response.status === 401
          ? "A aplicação não conseguiu autenticar a chamada ao serviço de busca."
          : "Não foi possível buscar empresas agora. Tente novamente.",
    };
  } catch {
    return {
      ok: false,
      code: "REQUEST_FAILED",
      message: "Não foi possível conectar ao serviço de busca. Tente novamente.",
    };
  }
}
