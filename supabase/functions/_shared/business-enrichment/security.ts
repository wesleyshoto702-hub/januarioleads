import type { BusinessIdentityFingerprint, BusinessInput } from "./types.ts";

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits && !digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = "55" + digits;
  }
  return digits;
}

export function domainOf(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    return new URL(value.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function blockedIpv4(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a,b,c,d] = match.slice(1).map(Number);
  if ([a,b,c,d].some((part) => part > 255)) return true;
  return a === 0 || a === 10 || (a === 100 && b >= 64 && b <= 127) ||
    a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) || (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) || a >= 224;
}

function blockedIpv6(host: string) {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  return value === "::" || value === "::1" || value.startsWith("fc") ||
    value.startsWith("fd") || /^fe[89ab]/.test(value) || value.startsWith("2001:db8");
}

export function blockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host.endsWith(".internal") || host === "metadata.google.internal" ||
    host === "metadata.google" || host === "instance-data" ||
    blockedIpv4(host) || blockedIpv6(host);
}

export function safePublicUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (blockedHost(url.hostname)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export async function hostnameResolvesPublicly(hostname: string) {
  if (blockedHost(hostname)) return false;
  const results = await Promise.allSettled([
    Deno.resolveDns(hostname, "A"),
    Deno.resolveDns(hostname, "AAAA"),
  ]);
  const addresses = results.flatMap((item) => item.status === "fulfilled" ? item.value : []);
  if (!addresses.length) return false;
  return addresses.every((address) => !blockedIpv4(address) && !blockedIpv6(address));
}

export async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function canonicalInstagram(value: unknown) {
  const url = safePublicUrl(value);
  if (!url) return "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "instagram.com") return "";
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 1 || !/^[A-Za-z0-9._]+$/.test(parts[0])) return "";
  return `https://www.instagram.com/${parts[0]}/`;
}

export function buildFingerprint(
  business: BusinessInput,
  nicheKey: string,
): BusinessIdentityFingerprint {
  const name = String(business.company ?? business.name ?? "").trim();
  const website = safePublicUrl(business.website);
  return {
    placeId: String(business.placeId ?? "").trim(),
    canonicalName: name,
    aliases: Array.from(new Set([name, ...(business.categories ?? [])].filter(Boolean))).slice(0, 8),
    phone: normalizePhone(business.internationalPhone || business.phone),
    officialDomain: website?.hostname.toLowerCase().replace(/^www\./, "") ?? "",
    address: String(business.address ?? "").trim(),
    city: String(business.city ?? "").trim(),
    state: String(business.state ?? "").trim(),
    postalCode:
      String(business.postalCode ?? "").trim() ||
      (String(business.address ?? "").match(/\b\d{5}-?\d{3}\b/)?.[0] ?? ""),
    confirmedInstagram:
      business.instagramConfidence === "medium" || business.instagramConfidence === "low"
        ? ""
        : canonicalInstagram(business.instagram),
    category: String(business.primaryCategory ?? business.segment ?? "").trim(),
    nicheKey,
  };
}

export async function identitySignature(fingerprint: BusinessIdentityFingerprint) {
  return sha256Text(JSON.stringify({
    version: "business-deep-enrichment-v1",
    placeId: fingerprint.placeId,
    name: normalizeText(fingerprint.canonicalName),
    phone: fingerprint.phone,
    domain: fingerprint.officialDomain,
    address: normalizeText(fingerprint.address),
    city: normalizeText(fingerprint.city),
    state: normalizeText(fingerprint.state),
    instagram: fingerprint.confirmedInstagram.toLowerCase(),
    nicheKey: fingerprint.nicheKey,
  }));
}

export async function businessKey(fingerprint: BusinessIdentityFingerprint) {
  if (fingerprint.placeId) return `place:${fingerprint.placeId}`;
  return "identity:" + await sha256Text(JSON.stringify({
    name: normalizeText(fingerprint.canonicalName),
    phone: fingerprint.phone,
    address: normalizeText(fingerprint.address),
    city: normalizeText(fingerprint.city),
  }));
}

export function tokenSimilarity(a: string, b: string) {
  const left = new Set(normalizeText(a).split(" ").filter((x) => x.length > 2));
  const right = new Set(normalizeText(b).split(" ").filter((x) => x.length > 2));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

export function branchIdentityScoreFromText(
  fingerprint: BusinessIdentityFingerprint,
  text: string,
) {
  const normalized = normalizeText(text);
  let score = 0;

  const nameSimilarity = tokenSimilarity(fingerprint.canonicalName, text);
  if (nameSimilarity >= 0.6) score += 20;
  else if (nameSimilarity >= 0.35) score += 10;

  if (fingerprint.phone) {
    const digits = String(text).replace(/\D/g, "");
    if (digits.includes(fingerprint.phone.slice(-10))) score += 60;
  }

  if (fingerprint.city && normalized.includes(normalizeText(fingerprint.city))) {
    score += 20;
  }

  const number = fingerprint.address.match(/\b\d{1,6}\b/)?.[0];
  if (number && String(text).includes(number)) score += 20;

  return Math.min(100, score);
}

export function identityScoreFromText(
  fingerprint: BusinessIdentityFingerprint,
  sourceUrl: string,
  text: string,
) {
  const domain = domainOf(sourceUrl);
  if (fingerprint.officialDomain && domain === fingerprint.officialDomain) return 100;
  if (fingerprint.confirmedInstagram && sourceUrl.replace(/\/$/, "") === fingerprint.confirmedInstagram.replace(/\/$/, "")) return 98;

  let score = 0;
  const normalized = normalizeText(text);
  const nameSimilarity = tokenSimilarity(fingerprint.canonicalName, text);
  if (nameSimilarity >= 0.6) score += 45;
  else if (nameSimilarity >= 0.35) score += 28;

  if (fingerprint.phone) {
    const digits = String(text).replace(/\D/g, "");
    if (digits.includes(fingerprint.phone.slice(-10))) score += 35;
  }
  if (fingerprint.city && normalized.includes(normalizeText(fingerprint.city))) score += 15;
  const number = fingerprint.address.match(/\b\d{1,6}\b/)?.[0];
  if (number && String(text).includes(number)) score += 10;
  return Math.min(100, score);
}
