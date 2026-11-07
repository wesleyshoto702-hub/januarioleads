/** Optional experimental BFF: opt in only with a configured staging server. */
export const USE_HTTPONLY_SESSION = (
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[
    "VITE_HTTPONLY_SESSION"
  ] === "true"
);

/** Prevent a staging preview from silently falling back to production Auth. */
const PUBLIC_ENV = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const STAGING_SUPABASE_URL = "https://prlrxjothrslhswpkoza.supabase.co";

export function isValidStagingBackendConfig(env: Record<string, string> | undefined): boolean {
  const url = env?.["VITE_SUPABASE_URL"]?.trim().replace(/\/$/, "");
  const key = env?.["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? "";
  return env?.["VITE_HTTPONLY_SESSION"] !== "true" &&
    url === STAGING_SUPABASE_URL &&
    key.startsWith("sb_publishable_") &&
    key.length <= 512 &&
    key !== "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";
}

if (PUBLIC_ENV?.["VITE_DEPLOY_TARGET"] === "staging" &&
    !isValidStagingBackendConfig(PUBLIC_ENV)) {
  throw new Error("Staging requer a URL e a chave publicável do Supabase de testes; a produção não será usada como fallback.");
}

/** Public project configuration shared by authentication, REST and functions. */
export const SUPABASE_URL = USE_HTTPONLY_SESSION
  ? "/api/supabase"
  : (
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[
    "VITE_SUPABASE_URL"
  ]?.trim() || "https://czkazbianiflhldenhcj.supabase.co"
).replace(/\/$/, "");
export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[
    "VITE_SUPABASE_PUBLISHABLE_KEY"
  ]?.trim() || "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";
