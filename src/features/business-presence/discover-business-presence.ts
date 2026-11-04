import { getAccessToken } from "../../lib/auth";
import {
  getPresenceCache,
  presenceFromBusiness,
  presenceSearchSignature,
  savePresenceCache,
} from "./storage";
import type { BusinessPresence, PresenceBusiness, PresenceDiscoveryResponse } from "./types";

import {
  SUPABASE_URL as PUBLIC_SUPABASE_URL,
  USE_HTTPONLY_SESSION,
  SUPABASE_PUBLISHABLE_KEY as PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} from "../../lib/supabase-config";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INCONCLUSIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isFresh(value: string | null | undefined, confirmed: boolean) {
  if (!value) return false;
  const checkedAt = new Date(value).getTime();
  return (
    Number.isFinite(checkedAt) &&
    Date.now() - checkedAt <= (confirmed ? CACHE_TTL_MS : INCONCLUSIVE_CACHE_TTL_MS)
  );
}

export async function discoverBusinessPresence(
  business: PresenceBusiness,
  options?: {
    force?: boolean;
    allowWebSearch?: boolean;
    skipOfficialSite?: boolean;
    signal?: AbortSignal;
  },
): Promise<BusinessPresence | null> {
  const known = presenceFromBusiness(business);
  const wantsWeb = options?.allowWebSearch === true;
  const sufficient = (presence: BusinessPresence) =>
    Boolean(presence.instagramUrl) || !wantsWeb || presence.instagramSearchScope !== "site";

  // A user-confirmed Instagram is authoritative until the user explicitly
  // chooses a different profile.
  if (known?.instagramConfidence === "high" && known.instagramSource === "manual_confirmation") {
    savePresenceCache(business, known);
    return known;
  }

  const signature = await presenceSearchSignature(business);

  if (
    !options?.force &&
    known &&
    known.instagramSearchSignature === signature &&
    !known.instagramNeedsReview &&
    isFresh(known.instagramCheckedAt, Boolean(known.instagramUrl)) &&
    sufficient(known)
  ) {
    savePresenceCache(business, known);
    return known;
  }

  if (!options?.force && known?.instagramConfidence === "high" && !known.instagramNeedsReview) {
    savePresenceCache(business, known);
    return known;
  }

  if (!options?.force) {
    const cached = getPresenceCache(business, signature);
    if (cached && sufficient(cached)) return cached;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Sua sessão expirou. Entre novamente para buscar Instagram.");
  }

  const url = (USE_HTTPONLY_SESSION
    ? PUBLIC_SUPABASE_URL
    : import.meta.env["VITE_SUPABASE_URL"]?.trim() || PUBLIC_SUPABASE_URL);
  const publishableKey =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() || PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/search-places`, {
      method: "POST",
      ...(options?.signal ? { signal: options.signal } : {}),
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        mode: "presence-discovery",
        allowWebSearch: wantsWeb,
        skipOfficialSite: wantsWeb && options?.skipOfficialSite === true,
        force: options?.force === true,
        business: {
          placeId: business.placeId,
          name: business.name,
          website: business.website,
          instagram: business.instagram,
          instagramDisplayName: business.instagramDisplayName ?? null,
          instagramConfidence: business.instagramConfidence,
          instagramSource: business.instagramSource,
          phone: business.phone,
          internationalPhone: business.internationalPhone,
          address: business.address,
          city: business.city,
          state: business.state,
          primaryCategory: business.primaryCategory,
          instagramRejectedUrls: business.instagramRejectedUrls ?? [],
        },
      }),
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("A busca respondeu de forma inesperada. Tente novamente.");
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !("ok" in payload) ||
      (payload as { ok?: unknown }).ok !== true
    ) {
      const message =
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : "Não foi possível buscar Instagram agora.";
      throw new Error(message);
    }

    const presence: BusinessPresence = {
      ...(payload as PresenceDiscoveryResponse & { ok: true }).presence,
      instagramSearchScope: wantsWeb ? "web" : "site",
    };
    savePresenceCache(business, presence);
    return presence;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Não foi possível buscar Instagram agora.");
  }
}
