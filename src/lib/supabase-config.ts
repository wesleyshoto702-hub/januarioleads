/** Public project configuration shared by authentication, REST and functions. */
export const SUPABASE_URL = (
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[
    "VITE_SUPABASE_URL"
  ]?.trim() || "https://czkazbianiflhldenhcj.supabase.co"
).replace(/\/$/, "");
export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[
    "VITE_SUPABASE_PUBLISHABLE_KEY"
  ]?.trim() || "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";
