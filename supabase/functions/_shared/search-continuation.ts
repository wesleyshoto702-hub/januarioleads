/** Offline-testable Buscar Leads continuation token gate.
 *
 * Never treat an unknown or malformed token as an external-provider request:
 * doing that could spend a paid Google API quota on a typo/stale cache value.
 * Tokens are opaque to callers, but Google tokens MUST be namespaced.
 */
export type SearchContinuation =
  | { kind: "first" }
  | { kind: "overture" | "geoapify"; offset: number }
  | { kind: "google"; value: string }
  | { kind: "invalid" };

const OFFSETS = new Set([20, 40, 60, 80]);
const MAX_TOKEN_LENGTH = 4096;

export function parseSearchContinuation(value: unknown): SearchContinuation {
  if (value === undefined || value === null || value === "") return { kind: "first" };
  if (typeof value !== "string" || !value.trim() ||
      value.length > MAX_TOKEN_LENGTH || value !== value.trim()) {
    return { kind: "invalid" };
  }
  const parts = value.split(":", 2);
  const prefix = parts[0];
  if (prefix === "overture" || prefix === "geoapify") {
    const offset = parts[1] ?? "";
    if (!/^(20|40|60|80)$/.test(offset)) return { kind: "invalid" };
    const number = Number(offset);
    if (!OFFSETS.has(number)) return { kind: "invalid" };
    return { kind: prefix, offset: number };
  }
  if (value.startsWith("google:")) {
    const token = value.slice("google:".length);
    // Opaque provider cursor, no control chars/newlines or empty payloads.
    if (!token || /[\x00-\x1f\x7f]/.test(token)) return { kind: "invalid" };
    return { kind: "google", value: token };
  }
  return { kind: "invalid" };
}

/** Stored/replayed cache should never continue to paid Google Places.
 * Only accept next tokens from explicitly open-data providers. */
export function safeOpenContinuationToken(value: unknown): string | null {
  const parsed = parseSearchContinuation(value);
  return parsed.kind === "overture" || parsed.kind === "geoapify"
    ? parsed.kind + ":" + parsed.offset
    : null;
}
