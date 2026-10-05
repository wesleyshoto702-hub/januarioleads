import { getAccessToken } from "../../lib/auth";
import type { LeadEnrichmentResponse, EnrichmentLead } from "./types";

const PUBLIC_SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

export async function searchLeadInformation(
  lead: EnrichmentLead,
): Promise<LeadEnrichmentResponse> {
  const url =
    import.meta.env["VITE_SUPABASE_URL"]?.trim() || PUBLIC_SUPABASE_URL;
  const publishableKey =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Sua sessão expirou. Entre novamente para buscar informações.",
    };
  }

  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/functions/v1/search-places`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: "lead-enrichment",
          lead: {
            company: lead.company,
            segment: lead.segment,
            phone: lead.phone || null,
            placeId: lead.placeId || null,
            city: lead.city || null,
            state: lead.state || null,
          },
        }),
      },
    );

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
      return payload as LeadEnrichmentResponse;
    }

    return {
      ok: false,
      code: response.status === 401 ? "AUTH_REQUIRED" : "REQUEST_FAILED",
      message:
        response.status === 401
          ? "Sua sessão expirou. Entre novamente para buscar informações."
          : "Não foi possível buscar informações agora. Tente novamente.",
    };
  } catch {
    return {
      ok: false,
      code: "REQUEST_FAILED",
      message: "Não foi possível conectar ao serviço de busca. Tente novamente.",
    };
  }
}
