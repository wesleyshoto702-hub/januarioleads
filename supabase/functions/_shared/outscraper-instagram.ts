import {
  canonicalPublicInstagram,
  type PublicInstagramCandidate,
} from "./public-instagram-candidate.ts";

const BLOCKED_HOSTS = new Set([
  "instagram.com", "facebook.com", "wa.me", "whatsapp.com",
  "linktr.ee", "bit.ly", "tiktok.com", "youtube.com", "x.com",
  "google.com", "sites.google.com", "wixsite.com", "blogspot.com",
  "localhost", "127.0.0.1", "0.0.0.0",
]);

/** Outscraper Emails & Contacts accepts a company DOMAIN, not a business name.
 * Never submit provider searches for businesses without a valid own domain.
 */
export function outscraperCompanyDomain(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 600) return null;
  try {
    const url = new URL(input.trim());
    if (!["https:", "http:"].includes(url.protocol) ||
        url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host.length < 4 || host.length > 253 ||
        !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) ||
        host.endsWith(".local") || host.endsWith(".internal") ||
        host.endsWith(".test") || host.endsWith(".localhost") ||
        BLOCKED_HOSTS.has(host) ||
        [...BLOCKED_HOSTS].some((block) => host.endsWith("." + block))) return null;
    return host;
  } catch {
    return null;
  }
}

function recordsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as {data?: unknown}).data;
  const result: Record<string, unknown>[] = [];

  function collect(value: unknown, depth: number) {
    if (depth > 3 || result.length >= 5) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 8)) collect(item, depth + 1);
    } else if (value && typeof value === "object") {
      result.push(value as Record<string, unknown>);
    }
  }
  collect(data, 0);
  return result;
}

function socialValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(socialValues).slice(0, 8);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return socialValues(obj.value ?? obj.url ?? obj.link);
  }
  return [];
}

/** Store only Instagram candidates, never returned emails, people or phones. */
export function outscraperInstagramCandidates(payload: unknown): PublicInstagramCandidate[] {
  const result: PublicInstagramCandidate[] = [];
  const seen = new Set<string>();

  for (const record of recordsFromPayload(payload)) {
    const socials = record.socials;
    const social = socials && typeof socials === "object"
      ? socials as Record<string, unknown> : {};
    const possibilities = [
      ...socialValues(social.instagram),
      ...socialValues(social.instagram_url),
      ...socialValues(record.instagram),
    ];
    for (const candidate of possibilities) {
      const url = canonicalPublicInstagram(candidate);
      if (!url || seen.has(url)) continue;
      result.push({
        url,
        username: new URL(url).pathname.split("/").filter(Boolean)[0],
        confidence: "medium",
        score: 5,
        signals: [
          "Outscraper encontrou este perfil ao pesquisar o domínio da empresa; confirme a identidade e a unidade",
        ],
        evidenceUrls: [],
      });
      seen.add(url);
      if (result.length >= 3) return result;
    }
  }
  return result;
}

export type OutscraperResponseStatus = "pending" | "complete" | "failed";

/** Outscraper can return HTTP 202 with a request ID, or data when complete. */
export function outscraperResponseStatus(payload: unknown): OutscraperResponseStatus {
  const status = typeof payload === "object" && payload !== null &&
    typeof (payload as {status?: unknown}).status === "string"
    ? (payload as {status:string}).status.toLowerCase() : "";
  if (["success", "completed", "finished"].includes(status)) return "complete";
  if (["failure", "failed", "error"].includes(status)) return "failed";
  return "pending";
}
