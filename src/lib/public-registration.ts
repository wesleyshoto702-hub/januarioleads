import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, USE_HTTPONLY_SESSION } from "./supabase-config";

export type RegistrationResult = { ok: true } | { ok: false; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeRedirect(origin: string, path: string): string | null {
  try {
    const url = new URL(origin);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash ||
        (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname))) {
      return null;
    }
    return new URL(path, url).toString();
  } catch {
    return null;
  }
}

function validAuthOrigin(): boolean {
  try {
    const url = new URL(SUPABASE_URL);
    return !USE_HTTPONLY_SESSION && url.protocol === "https:" &&
      /^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) &&
      !url.username && !url.password && !url.port &&
      url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/**
 * Requests an email/password identity without persisting any Auth session.
 * Email ownership confirmation must be enforced in Supabase Auth settings.
 * Creating a user never grants private_access or CRM data permissions.
 */
export async function requestPublicSignup(
  name: string, email: string, password: string, origin: string,
  requester: typeof fetch = fetch,
): Promise<RegistrationResult> {
  const fullName = name.trim().replace(/\s+/g, " ");
  const cleanEmail = email.trim().toLowerCase();
  if (fullName.length < 2 || fullName.length > 100) {
    return { ok: false, message: "Informe seu nome (entre 2 e 100 caracteres)." };
  }
  if (!EMAIL.test(cleanEmail) || cleanEmail.length > 320) {
    return { ok: false, message: "Informe um endereço de e-mail válido." };
  }
  if (password.length < 12 || password.length > 128) {
    return { ok: false, message: "A senha deve ter entre 12 e 128 caracteres." };
  }
  const redirect = safeRedirect(origin, "/login");
  if (!redirect || !validAuthOrigin()) {
    return { ok: false, message: "O cadastro não está configurado neste ambiente." };
  }
  try {
    const target = new URL(SUPABASE_URL + "/auth/v1/signup");
    target.searchParams.set("redirect_to", redirect);
    const response = await requester(target.toString(), {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        data: { full_name: fullName },
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        message: response.status === 429
          ? "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."
          : "Não foi possível solicitar o cadastro. Confira os dados ou tente novamente.",
      };
    }
    // A session may be returned if email confirmation is disabled. Deliberately
    // discard the entire response. Users must sign in via the guarded login.
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível conectar ao cadastro. Tente novamente." };
  }
}
