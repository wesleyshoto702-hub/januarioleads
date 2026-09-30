import { getAccessToken } from "../../lib/auth";
import type { BusinessSearchResult } from "../search-leads/types";
import type { DeepEnrichmentSnapshot } from "./types";

const PUBLIC_SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

type ResponsePayload =
  | { ok: true; snapshot: DeepEnrichmentSnapshot; identityChanged?: boolean }
  | { ok: false; code?: string; message?: string };

async function request(payload: Record<string, unknown>) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");

  const url =
    import.meta.env["VITE_SUPABASE_URL"]?.trim() || PUBLIC_SUPABASE_URL;
  const publishableKey =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 150_000);

  let response: Response;
  try {
    response = await fetch(
      `${url.replace(/\/$/, "")}/functions/v1/deep-enrich-business`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      },
    );
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new Error(
        "A pesquisa excedeu o tempo esperado. Verifique o resultado novamente antes de repetir.",
      );
    }
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }

  let result: ResponsePayload;
  try {
    result = (await response.json()) as ResponsePayload;
  } catch {
    throw new Error("A pesquisa aprofundada respondeu de forma inesperada.");
  }

  if (!response.ok || !result.ok) {
    throw new Error(
      !result.ok && result.message
        ? result.message
        : "Não foi possível concluir a pesquisa aprofundada.",
    );
  }

  return result;
}

function businessPayload(business: BusinessSearchResult, segment: string) {
  return {
    ...business,
    company: business.name,
    segment,
  };
}

export async function getDeepEnrichmentStatus(input: {
  business: BusinessSearchResult;
  segment: string;
  leadId?: string | null;
}) {
  return request({
    mode: "status",
    business: businessPayload(input.business, input.segment),
    segment: input.segment,
    leadId: input.leadId ?? null,
  });
}

export async function deepenBusiness(input: {
  business: BusinessSearchResult;
  segment: string;
  leadId?: string | null;
  force?: boolean;
}) {
  return request({
    mode: "run",
    force: input.force === true,
    business: businessPayload(input.business, input.segment),
    segment: input.segment,
    leadId: input.leadId ?? null,
  });
}

export async function reviewDeepEnrichmentFact(input: {
  factId: string;
  decision: "confirm" | "reject";
}) {
  return request({
    mode: "review",
    factId: input.factId,
    decision: input.decision,
  });
}
