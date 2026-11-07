import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, USE_HTTPONLY_SESSION } from "./supabase-config";

export type RegistrationResult = { ok: true } | { ok: false; message: string };

const GOOGLE_PENDING = "januarioleads:google-oauth-pkce";

function safeRedirect(origin: string, path: string): string | null {
  try {
    const url = new URL(origin);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash ||
        (url.protocol === "http:" && !["localhost","127.0.0.1"].includes(url.hostname))) return null;
    return new URL(path, url).toString();
  } catch {
    return null;
  }
}

function validAuthOrigin() {
  try {
    const url = new URL(SUPABASE_URL);
    return !USE_HTTPONLY_SESSION && url.protocol === "https:" &&
      /^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) &&
      !url.username && !url.password && !url.port && url.pathname === "/" &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** Check the public GoTrue provider status before leaving for Google. */
export async function googleProviderStatus(
  requester: typeof fetch = fetch,
): Promise<RegistrationResult> {
  if (!validAuthOrigin()) return { ok: false, message: "Google não está disponível neste ambiente." };
  try {
    const response = await requester(SUPABASE_URL + "/auth/v1/settings", {
      method: "GET", cache: "no-store", credentials: "omit",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    if (!response.ok) return { ok: false, message: "Não foi possível verificar a conexão com Google." };
    const settings: unknown = await response.json();
    const external = (settings && typeof settings === "object")
      ? (settings as { external?: { google?: boolean } }).external : undefined;
    return external?.google === true
      ? { ok: true }
      : { ok: false, message: "Login Google ainda não está ativado no Supabase. Configure o provedor para continuar." };
  } catch {
    return { ok: false, message: "Não foi possível verificar a configuração do Google." };
  }
}

function b64url(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export type PendingGoogle = { state: string; verifier: string; createdAt: number };

/** Google OAuth with Supabase PKCE; authorization and CRM entitlement differ. */
export async function prepareGoogleOAuth(
  origin: string,
  storage: Pick<Storage,"setItem">,
): Promise<RegistrationResult & { url?: string }> {
  const callback = safeRedirect(origin, "/auth/retorno");
  if (!callback || !validAuthOrigin()) {
    return { ok: false, message: "Google não está disponível nesta configuração." };
  }
  try {
    const nonce = crypto.getRandomValues(new Uint8Array(24));
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))));
    const state = b64url(nonce);
    const redirect = new URL(callback);
    redirect.searchParams.set("state", state);
    const url = new URL(SUPABASE_URL + "/auth/v1/authorize");
    url.searchParams.set("provider","google");
    url.searchParams.set("redirect_to",redirect.toString());
    url.searchParams.set("flow_type","pkce");
    url.searchParams.set("code_challenge",challenge);
    url.searchParams.set("code_challenge_method","s256");
    storage.setItem(GOOGLE_PENDING,JSON.stringify({ state, verifier, createdAt: Date.now() }));
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, message: "Não foi possível iniciar a conexão com Google." };
  }
}

export async function exchangeGoogleCode(
  callbackUrl: string,
  storage: Pick<Storage,"getItem"|"removeItem">,
  requester: typeof fetch = fetch,
): Promise<
  | { ok: true; tokens: { access_token: string; refresh_token: string; expires_in: number; user?: { id?: string; email?: string } } }
  | { ok: false; message: string }
> {
  let pending: PendingGoogle | null = null;
  try {
    const raw = storage.getItem(GOOGLE_PENDING);
    storage.removeItem(GOOGLE_PENDING); // Single use, including errors
    pending = raw ? JSON.parse(raw) as PendingGoogle : null;
    const callback = new URL(callbackUrl);
    const state = callback.searchParams.get("state");
    const code = callback.searchParams.get("code");
    if (!pending || !state || !code || !/^[A-Za-z0-9_-]{20,}$/.test(code) ||
        state !== pending.state || !pending.verifier ||
        !Number.isFinite(pending.createdAt) || Date.now()-pending.createdAt > 10*60_000 ||
        Date.now() < pending.createdAt || callback.origin !== window.location.origin ||
        !validAuthOrigin()) {
      return { ok: false, message: "A autenticação expirou ou não foi iniciada neste navegador. Tente novamente." };
    }
    const response = await requester(SUPABASE_URL+"/auth/v1/token?grant_type=pkce", {
      method:"POST",cache:"no-store",credentials:"omit",
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({ auth_code:code,code_verifier:pending.verifier }),
    });
    if (!response.ok) return {ok:false,message:"Google não concluiu a autenticação. Tente novamente."};
    const data: unknown = await response.json();
    if (!data || typeof data!=="object") throw new Error("Invalid token response");
    const token=data as {access_token?:unknown;refresh_token?:unknown;expires_in?:unknown;user?:{id?:string;email?:string}};
    if (typeof token.access_token!=="string" || typeof token.refresh_token!=="string" ||
        typeof token.expires_in!=="number" || token.expires_in<=0) throw new Error("Invalid session");
    return {ok:true,tokens:{access_token:token.access_token,refresh_token:token.refresh_token,expires_in:token.expires_in,user:token.user}};
  } catch {
    return {ok:false,message:"Não foi possível concluir a autenticação do Google."};
  }
}
