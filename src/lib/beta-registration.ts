/**
 * Beta sign-up is an explicit staging-only experiment.
 *
 * This NEVER uses the production Supabase project or the main app's credentials.
 * Creating an Auth user does not grant private_access/CRM permissions.
 */
const PRODUCTION_PROJECT_REF = "czkazbianiflhldenhcj";
type PublicEnv = Record<string, string | undefined>;

export type BetaSignupConfig = Readonly<{
  baseUrl: string;
  publishableKey: string;
  projectRef: string;
}>;

export function getBetaSignupConfig(env: PublicEnv | undefined): BetaSignupConfig | null {
  if (env?.VITE_BETA_SIGNUP_ENABLED !== "true" ||
      env.VITE_HTTPONLY_SESSION === "true") return null;

  const base = env.VITE_BETA_SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.VITE_BETA_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const expectedRef = env.VITE_BETA_SIGNUP_PROJECT_REF?.trim() ?? "";
  if (!base || !publishableKey.startsWith("sb_publishable_") ||
      publishableKey.length > 512 || !expectedRef ||
      expectedRef === PRODUCTION_PROJECT_REF) return null;

  try {
    const url = new URL(base);
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        url.pathname !== "/" || url.search || url.hash ||
        !match || match[1] !== expectedRef || match[1] === PRODUCTION_PROJECT_REF) {
      return null;
    }
    return Object.freeze({
      baseUrl: url.origin,
      publishableKey,
      projectRef: match[1],
    });
  } catch {
    return null;
  }
}

export const BETA_SIGNUP_CONFIG = getBetaSignupConfig(
  (import.meta as ImportMeta & { env?: PublicEnv }).env,
);

export type SignupResult =
  | { ok: true }
  | { ok: false; message: string };

export async function requestBetaSignup(
  config: BetaSignupConfig,
  email: string,
  password: string,
  redirectOrigin: string,
  requester: typeof fetch = fetch,
): Promise<SignupResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      password.length < 12 || password.length > 128) {
    return { ok: false, message: "Informe um e-mail válido e uma senha entre 12 e 128 caracteres." };
  }

  // Defense in depth: do not allow a caller to substitute production config.
  const active = getBetaSignupConfig({
    VITE_BETA_SIGNUP_ENABLED: "true",
    VITE_BETA_SUPABASE_URL: config.baseUrl,
    VITE_BETA_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
    VITE_BETA_SIGNUP_PROJECT_REF: config.projectRef,
  });
  if (!active) {
    return { ok: false, message: "O cadastro beta não está disponível neste ambiente." };
  }

  let redirectUrl: URL;
  try {
    const origin = new URL(redirectOrigin);
    if (!["https:", "http:"].includes(origin.protocol) ||
        origin.username || origin.password || origin.pathname !== "/" ||
        origin.search || origin.hash ||
        (origin.protocol === "http:" && !["localhost", "127.0.0.1"].includes(origin.hostname))) {
      throw new Error("invalid redirect");
    }
    redirectUrl = new URL("/login", origin);
  } catch {
    return { ok: false, message: "O ambiente de cadastro não está configurado corretamente." };
  }

  const target = new URL("/auth/v1/signup", active.baseUrl);
  target.searchParams.set("redirect_to", redirectUrl.toString());

  try {
    const response = await requester(target.toString(), {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        apikey: active.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    // Do not parse or save returned access/refresh tokens. Auth != entitlement.
    if (!response.ok) {
      return {
        ok: false,
        message: response.status === 429
          ? "Muitas tentativas. Aguarde antes de tentar novamente."
          : "Não foi possível concluir o cadastro agora. Verifique os dados ou tente novamente.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível conectar ao cadastro beta. Tente novamente." };
  }
}
