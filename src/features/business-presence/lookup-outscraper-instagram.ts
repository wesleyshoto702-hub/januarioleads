import { getAccessToken } from "../../lib/auth";
import {
  SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, USE_HTTPONLY_SESSION,
} from "../../lib/supabase-config";
import type { InstagramCandidate, PresenceBusiness } from "./types";

type OutscraperResult = {
  ok: true;
  mode: "outscraper-instagram";
  status: "pending" | "complete" | "failed";
  candidates: InstagramCandidate[];
  message: string;
};

/** Explicit per-business fallback; no API key ever reaches the browser. */
export async function lookupOutscraperInstagram(
  business: PresenceBusiness,
): Promise<OutscraperResult> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente para pesquisar.");

  const baseUrl = USE_HTTPONLY_SESSION ? SUPABASE_URL
    : import.meta.env["VITE_SUPABASE_URL"]?.trim() || SUPABASE_URL;
  const publicKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    SUPABASE_PUBLISHABLE_KEY;

  let response: Response;
  try {
    response = await fetch(baseUrl.replace(/\/$/, "") + "/functions/v1/search-places", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publicKey,
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        mode: "outscraper-instagram",
        business: {
          name: business.name,
          website: business.website,
        },
      }),
    });
  } catch {
    throw new Error("Não foi possível consultar o Outscraper agora.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Outscraper respondeu em formato inesperado.");
  }
  const data = payload as Partial<OutscraperResult> & {
    ok?: boolean; message?: string;
  };
  if (!response.ok || !data?.ok ||
      !["pending", "complete", "failed"].includes(data.status || "")) {
    throw new Error(data?.message || "Não foi possível consultar o Outscraper.");
  }
  return {
    ok: true,
    mode: "outscraper-instagram",
    status: data.status!,
    candidates: Array.isArray(data.candidates) ? data.candidates.slice(0, 3) : [],
    message: data.message || "",
  };
}
