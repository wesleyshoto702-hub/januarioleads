import type { BusinessPresence, PresenceBusiness } from "./types";

const STORAGE_KEY = "januarioleads:business-presence";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PresenceCache = Record<string, BusinessPresence>;

function keyFor(business: PresenceBusiness) {
  if (business.placeId?.trim()) return `place:${business.placeId.trim()}`;
  if (business.website?.trim()) return `website:${business.website.trim().toLowerCase()}`;
  return `name:${business.name.trim().toLocaleLowerCase("pt-BR")}`;
}

function readCache(): PresenceCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PresenceCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getPresenceCache(
  business: PresenceBusiness,
  allowStale = false,
) {
  const cached = readCache()[keyFor(business)];
  if (!cached) return null;

  const checkedAt = new Date(cached.instagramCheckedAt).getTime();
  if (!Number.isFinite(checkedAt)) return null;

  if (!allowStale && Date.now() - checkedAt > CACHE_TTL_MS) return null;
  return cached;
}

export function savePresenceCache(
  business: PresenceBusiness,
  presence: BusinessPresence,
) {
  if (typeof window === "undefined") return;
  const all = readCache();
  all[keyFor(business)] = presence;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function presenceFromBusiness(
  business: PresenceBusiness,
): BusinessPresence | null {
  if (!business.instagram?.trim()) return null;

  return {
    instagramUrl: business.instagram.trim(),
    instagramConfidence: business.instagramConfidence ?? "high",
    instagramSource: business.instagramSource ?? "google_places",
    instagramCheckedAt:
      business.instagramCheckedAt ?? new Date().toISOString(),
  };
}
