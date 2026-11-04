// Server-only encrypted HttpOnly session cookie for the optional BFF staging mode.
// No service_role keys, credentials or tokens may be exposed in the browser bundle.
export type BffSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; email: string | null };
};

export const COOKIE_NAME = "__Host-januarioleads-session";
const MAX_COOKIE_BYTES = 3800;

function toBase64Url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join(""))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > MAX_COOKIE_BYTES) {
    throw new Error("Malformed session cookie");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(padded + "=".repeat((4 - padded.length % 4) % 4)),
    (char) => char.charCodeAt(0));
}

function validSession(session: unknown): session is BffSession {
  if (!session || typeof session !== "object") return false;
  const s = session as Partial<BffSession>;
  return (
    typeof s.accessToken === "string" && s.accessToken.length > 0 &&
    s.accessToken.length < 3000 &&
    typeof s.refreshToken === "string" && s.refreshToken.length > 0 &&
    s.refreshToken.length < 1000 &&
    typeof s.expiresAt === "number" && Number.isFinite(s.expiresAt) &&
    s.expiresAt > 0 &&
    !!s.user && typeof s.user.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.user.id) &&
    (s.user.email === null ||
      (typeof s.user.email === "string" && s.user.email.length <= 320))
  );
}

async function keyFromSecret(secret: string): Promise<CryptoKey> {
  // Configured per request from a private hosting secret, not from VITE_*.
  const bytes = fromBase64Url(secret);
  if (bytes.byteLength !== 32) throw new Error("BFF_SESSION_KEY must be 32 random bytes");
  const raw = new Uint8Array(bytes.byteLength);
  raw.set(bytes);
  return crypto.subtle.importKey("raw", raw.buffer, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealSession(session: BffSession, secret: string): Promise<string> {
  if (!validSession(session)) throw new Error("Invalid session");
  const key = await keyFromSecret(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(session));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)
  );
  const joined = new Uint8Array(iv.length + encrypted.length);
  joined.set(iv);
  joined.set(encrypted, iv.length);
  const value = toBase64Url(joined);
  if (value.length > MAX_COOKIE_BYTES) throw new Error("Session too large for browser cookie");
  return value;
}

export async function openSession(value: string, secret: string): Promise<BffSession | null> {
  try {
    const data = fromBase64Url(value);
    if (data.length < 28) return null;
    const key = await keyFromSecret(secret);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: data.slice(0, 12) }, key, data.slice(12)
    );
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plain));
    return validSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getSessionCookie(header: string | null): string | null {
  if (!header) return null;
  const prefix = COOKIE_NAME + "=";
  for (const segment of header.split(";")) {
    const item = segment.trim();
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }
  return null;
}

export function sessionSetCookie(value: string): string {
  if (!value || value.length > MAX_COOKIE_BYTES) throw new Error("Invalid cookie payload");
  return COOKIE_NAME + "=" + value +
    "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=43200";
}

export function sessionClearCookie(): string {
  return COOKIE_NAME + "=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0";
}

export function allowsMutatingRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === new URL(request.url).origin;
  // Fetch Metadata fallback for same-origin browsers without Origin.
  return request.headers.get("sec-fetch-site") === "same-origin";
}
