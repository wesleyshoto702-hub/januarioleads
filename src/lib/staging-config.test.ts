import { isValidStagingBackendConfig } from "./supabase-config.ts";

const staging = {
  VITE_HTTPONLY_SESSION: "false",
  VITE_SUPABASE_URL: "https://prlrxjothrslhswpkoza.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging_test_example",
};

Deno.test("staging exige URL de staging e chave publicável, sem fallback para produção", () => {
  if (!isValidStagingBackendConfig(staging)) {
    throw new Error("Configuração correta de staging rejeitada");
  }
  const invalid = [
    undefined,
    { ...staging, VITE_SUPABASE_URL: "" },
    { ...staging, VITE_SUPABASE_URL: "https://czkazbianiflhldenhcj.supabase.co" },
    { ...staging, VITE_SUPABASE_URL: "https://prlrxjothrslhswpkoza.supabase.co.evil.test" },
    { ...staging, VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    { ...staging, VITE_SUPABASE_PUBLISHABLE_KEY: "service_role_example" },
    { ...staging, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p" },
    { ...staging, VITE_HTTPONLY_SESSION: "true" },
  ];
  for (const env of invalid) {
    if (isValidStagingBackendConfig(env)) {
      throw new Error("Configuração insegura de staging foi aceita");
    }
  }
});
