import { getAccessToken } from "../../lib/auth";
import {
  getPresenceCache,
  presenceFromBusiness,
  savePresenceCache,
} from "./storage";
import type {
  BusinessPresence,
  PresenceBusiness,
  PresenceDiscoveryResponse,
} from "./types";

const PUBLIC_SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

export async function discoverBusinessPresence(
  business: PresenceBusiness,
  options?: { force?: boolean },
): Promise<BusinessPresence | null> {
  const known = presenceFromBusiness(business);
  if (known?.instagramConfidence === "high" && !options?.force) {
    savePresenceCache(business, known);
    return known;
  }

  if (!options?.force) {
    const cached = getPresenceCache(business);
    if (cached) return cached;
  }

  if (!business.website?.trim()) {
    const checked: BusinessPresence = {
      instagramUrl: known?.instagramUrl ?? null,
      instagramConfidence: known?.instagramConfidence ?? null,
      instagramSource: known?.instagramSource ?? null,
      instagramCheckedAt: new Date().toISOString(),
    };
    savePresenceCache(business, checked);
    return checked;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return known;

  const url =
    import.meta.env["VITE_SUPABASE_URL"]?.trim() || PUBLIC_SUPABASE_URL;
  const publishableKey =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
          mode: "presence-discovery",
          business: {
            placeId: business.placeId,
            name: business.name,
            website: business.website,
            instagram: business.instagram,
            phone: business.phone,
            internationalPhone: business.internationalPhone,
            address: business.address,
            city: business.city,
            state: business.state,
            primaryCategory: business.primaryCategory,
          },
        }),
      },
    );

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return known;
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !("ok" in payload) ||
      (payload as { ok?: unknown }).ok !== true
    ) {
      return known;
    }

    const presence = (payload as PresenceDiscoveryResponse & { ok: true })
      .presence;
    savePresenceCache(business, presence);
    return presence;
  } catch {
    return known;
  }
}
