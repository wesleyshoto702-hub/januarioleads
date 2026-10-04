import { getAccessToken } from "../../lib/auth";
import type {
  OpenNowCacheResponse,
  OpenNowRefreshResponse,
} from "./types";

const PUBLIC_SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

function endpoint() {
  const url =
    import.meta.env["VITE_SUPABASE_URL"]?.trim() || PUBLIC_SUPABASE_URL;
  return `${url.replace(/\/$/, "")}/functions/v1/open-now-niches`;
}

function publishableKey() {
  return (
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

async function callOpenNow<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("AUTH_REQUIRED");

  const response = await fetch(endpoint(), {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey(),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("REQUEST_FAILED");
  }

  if (
    payload &&
    typeof payload === "object" &&
    "ok" in payload
  ) {
    return payload as T;
  }

  throw new Error("REQUEST_FAILED");
}

export function fetchOpenNowCache(
  city: string,
  state: string,
  signal?: AbortSignal,
) {
  return callOpenNow<OpenNowCacheResponse>(
    { mode: "cache", city, state },
    signal,
  );
}

export function refreshOpenNowNiche(
  input: {
    city: string;
    state: string;
    segment: string;
    force?: boolean;
    pageToken?: string | null;
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
