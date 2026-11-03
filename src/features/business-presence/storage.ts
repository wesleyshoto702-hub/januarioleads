import type {
  BusinessPresence,
  PresenceBusiness,
} from "./types";

const STORAGE_KEY = "januarioleads:business-presence";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INCONCLUSIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type PresenceCache = Record<string, BusinessPresence>;

function keyFor(business: PresenceBusiness) {
  if (business.placeId?.trim()) return `place:${business.placeId.trim()}`;
  if (business.website?.trim()) {
    return `website:${business.website.trim().toLowerCase()}`;
  }
  return `name:${business.name.trim().toLocaleLowerCase("pt-BR")}`;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return digits.startsWith("55") ? digits : digits ? `55${digits}` : "";
}

function normalizeWebsite(value: string | null | undefined) {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value.trim());
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return normalizeText(value);
  }
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function presenceSearchSignature(business: PresenceBusiness) {
  return sha256Text(
    JSON.stringify({
      version: "instagram-discovery-v3",
      name: normalizeText(business.name),
      phone: normalizePhone(
        business.phone?.trim() || business.internationalPhone?.trim(),
      ),
      address: normalizeText(business.address),
      city: normalizeText(business.city),
      state: normalizeText(business.state),
      website: normalizeWebsite(business.website),
      primaryCategory: normalizeText(business.primaryCategory),
    }),
  );
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
  expectedSignature: string,
  allowStale = false,
) {
  const cached = readCache()[keyFor(business)];
  if (!cached) return null;
  if (cached.instagramSearchSignature !== expectedSignature) return null;

  const checkedAt = new Date(cached.instagramCheckedAt).getTime();
  if (!Number.isFinite(checkedAt)) return null;

  const ttl = cached.instagramUrl ? CACHE_TTL_MS : INCONCLUSIVE_CACHE_TTL_MS;
  if (!allowStale && Date.now() - checkedAt > ttl) return null;
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

/** Accept an Instagram profile URL or @handle, never a post or unrelated domain. */
export function canonicalManualInstagramUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const raw = trimmed.startsWith("@")
    ? `https://www.instagram.com/${trimmed.slice(1)}/`
    : trimmed.startsWith("instagram.com/") ||
        trimmed.startsWith("www.instagram.com/")
      ? `https://${trimmed}`
      : trimmed;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");
    const pieces = url.pathname.split("/").filter(Boolean);
    const username = pieces[0] ?? "";
    if (
      url.protocol !== "https:" && url.protocol !== "http:" ||
      host !== "instagram.com" ||
      pieces.length !== 1 ||
      username.length > 30 ||
      !/^[A-Za-z0-9._]+$/.test(username) ||
      [
        "accounts", "about", "developer", "direct", "explore",
        "legal", "p", "reel", "reels", "stories", "tv",
      ].includes(username.toLowerCase())
    ) return null;
    return `https://www.instagram.com/${username}/`;
  } catch {
    return null;
  }
}

function usernameFromInstagram(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 1 ? parts[0] : null;
  } catch {
    return null;
  }
}

export function presenceFromBusiness(
  business: PresenceBusiness,
): BusinessPresence | null {
  const hasStoredAttempt = Boolean(
    business.instagram?.trim() ||
      business.instagramCheckedAt ||
      business.instagramCandidates?.length ||
      business.instagramSearchSignature,
  );
  if (!hasStoredAttempt) return null;

  const instagramUrl = business.instagram?.trim() || null;

  return {
    instagramUrl,
    instagramUsername:
      business.instagramUsername?.trim() ||
      usernameFromInstagram(instagramUrl),
    instagramDisplayName: business.instagramDisplayName?.trim() || null,
    instagramConfidence: instagramUrl
      ? business.instagramConfidence ?? "high"
      : null,
    instagramSource: instagramUrl
      ? business.instagramSource ??
        (business.placeId?.trim() ? "google_places" : "existing_data")
      : null,
    instagramCheckedAt:
      business.instagramCheckedAt ?? new Date(0).toISOString(),
    instagramCandidates: business.instagramCandidates ?? [],
    instagramRejectedUrls: business.instagramRejectedUrls ?? [],
    instagramSearchSignature: business.instagramSearchSignature ?? null,
    instagramSearchScope: business.instagramSearchScope,
    instagramNeedsReview: business.instagramNeedsReview ?? false,
  };
}
