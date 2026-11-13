/**
 * Normalize public Instagram profile references from independent directories.
 * Provider-supplied social links are leads to VERIFY, not evidence of
 * ownership. Only a company's official site or manual review can confirm.
 */
export type PublicInstagramCandidate = {
  url: string;
  username: string;
  confidence: "medium";
  score: number;
  signals: string[];
  evidenceUrls: string[];
};

const RESERVED = new Set([
  "about", "accounts", "api", "developer", "direct", "explore",
  "legal", "p", "reel", "reels", "stories", "tv", "directory",
]);

export function canonicalPublicInstagram(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value || value.length > 400) return null;
  const raw = value.startsWith("@")
    ? "https://www.instagram.com/" + value.slice(1) + "/"
    : /^(?:www\.|m\.)?instagram\.com\//i.test(value)
      ? "https://" + value
      : value;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
    const parts = parsed.pathname.split("/").filter(Boolean);
    const username = parts[0] ?? "";
    if (!["http:", "https:"].includes(parsed.protocol) ||
        parsed.username || parsed.password ||
        host !== "instagram.com" || parts.length !== 1 ||
        username.length < 2 || username.length > 30 ||
        !/^[A-Za-z0-9._]+$/.test(username) ||
        RESERVED.has(username.toLowerCase())) return null;
    return "https://www.instagram.com/" + username + "/";
  } catch {
    return null;
  }
}

export function providerInstagramCandidate(
  raw: unknown,
  label: "Overture" | "Geoapify" | "Google Places",
): PublicInstagramCandidate | null {
  const url = canonicalPublicInstagram(raw);
  if (!url) return null;
  const username = new URL(url).pathname.slice(1, -1);
  return {
    url,
    username,
    confidence: "medium",
    score: 4,
    signals: [
      "Instagram informado em dados de " + label +
      "; confira se pertence à empresa e à unidade correta",
    ],
    evidenceUrls: [],
  };
}

/** Unify optional contact/social fields without exposing raw provider metadata. */
export function firstProviderInstagram(...values: unknown[]): string | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      const hit = firstProviderInstagram(...value);
      if (hit) return hit;
    } else {
      const hit = canonicalPublicInstagram(value);
      if (hit) return hit;
    }
  }
  return null;
}
