import { getAccessToken } from "../../lib/auth";
import type { OpenNowCacheResponse, OpenNowRefreshResponse } from "./types";

export class OpenNowServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OpenNowServiceError";
    this.code = code;
  }
}

export function openNowServiceErrorMessage(error: unknown) {
  if (error instanceof OpenNowServiceError) return error.message;
  if ((error as Error)?.name === "AbortError") return "";
  return "Não foi possível acessar Nichos Abertos Agora.";
}

import {
  SUPABASE_URL as PUBLIC_SUPABASE_URL,
  USE_HTTPONLY_SESSION,
  SUPABASE_PUBLISHABLE_KEY as PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} from "../../lib/supabase-config";

function endpoint() {
  const url = (USE_HTTPONLY_SESSION
    ? PUBLIC_SUPABASE_URL
    : import.meta.env["VITE_SUPABASE_URL"]?.trim() || PUBLIC_SUPABASE_URL);
  return `${url.replace(/\/$/, "")}/functions/v1/open-now-niches`;
}

function publishableKey() {
  return (
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() || PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

async function callOpenNow<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("AUTH_REQUIRED");

  const response = await fetch(endpoint(), {
    method: "POST",
    signal: signal ?? null,
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey(),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Some platform-level failures can return a non-JSON body.
  }

  if (payload && typeof payload === "object" && "ok" in payload) {
    return payload as T;
  }

  if (response.status === 401) {
    throw new OpenNowServiceError(
      "AUTH_REQUIRED",
      "Sua sessão expirou. Entre novamente para continuar.",
    );
  }

  if (response.status === 403) {
    throw new OpenNowServiceError(
      "PRIVATE_ACCESS_DENIED",
      "Sua conta não possui acesso a este recurso.",
    );
  }

  throw new OpenNowServiceError("REQUEST_FAILED", "Não foi possível acessar Nichos Abertos Agora.");
}

export function fetchOpenNowCache(city: string, state: string, signal?: AbortSignal) {
  return callOpenNow<OpenNowCacheResponse>({ mode: "cache", city, state }, signal);
}

export function refreshOpenNowNiche(
  input: {
    city: string;
    state: string;
    segment: string;
    force?: boolean | undefined;
    pageToken?: string | null | undefined;
  },
  signal?: AbortSignal,
) {
  return callOpenNow<OpenNowRefreshResponse>(
    {
      mode: "refresh",
      city: input.city,
      state: input.state,
      segment: input.segment,
      ...(input.force ? { force: true } : {}),
      ...(input.pageToken ? { pageToken: input.pageToken } : {}),
    },
    signal,
  );
}
