import { prepareGoogleOAuth, googleProviderStatus } from "./public-registration.ts";

const origin = "http://127.0.0.1:5173";

Deno.test("cadastro Google não possui chamada para signup de email e usa PKCE S256", async () => {
  const pending: Record<string, string> = {};
  const storage = { setItem: (key: string, value: string) => { pending[key] = value; } };
  const result = await prepareGoogleOAuth(origin, storage);
  if (!result.ok || !result.url) throw new Error("Google OAuth should start on local origin");
  const url = new URL(result.url);
  if (url.pathname !== "/auth/v1/authorize" ||
      url.searchParams.get("provider") !== "google" ||
      url.searchParams.get("flow_type") !== "pkce" ||
      url.searchParams.get("code_challenge_method") !== "s256" ||
      !url.searchParams.get("code_challenge")) {
    throw new Error("A Google-only PKCE challenge is mandatory");
  }
  const callback = new URL(url.searchParams.get("redirect_to")!);
  const stored = JSON.parse(Object.values(pending)[0]!) as {
    state: string; verifier: string; createdAt: number;
  };
  if (callback.origin !== origin || callback.pathname !== "/auth/retorno" ||
      callback.searchParams.get("state") !== stored.state ||
      stored.verifier.length < 43 || Math.abs(Date.now() - stored.createdAt) > 5000) {
    throw new Error("OAuth state or code verifier missing");
  }
});

Deno.test("Google OAuth rejeita redirecionamentos externos ou origem insegura", async () => {
  const saved: string[] = [];
  const storage = { setItem: (key: string) => { saved.push(key); } };
  for (const origin of ["https://evil.test/path", "http://evil.test", "https://evil@host.test"]) {
    const result = await prepareGoogleOAuth(origin, storage);
    if (result.ok) throw new Error("Invalid Google callback was accepted");
  }
  if (saved.length !== 0) throw new Error("Invalid redirects must never write verifier");
});

Deno.test("Google desativado é recusado antes de qualquer redirecionamento", async () => {
  const mock = (async (url: string | Request | URL) => {
    if (!String(url).endsWith("/auth/v1/settings")) throw new Error("Unexpected endpoint");
    return Response.json({ external: { google: false } });
  }) as typeof fetch;
  const status = await googleProviderStatus(mock);
  if (status.ok || !status.message.includes("não está ativado")) {
    throw new Error("Unconfigured Google provider must fail closed");
  }
});

Deno.test("somente Google ativo é aceito após verificação de configuração", async () => {
  const mock = (async () => Response.json({ external: { google: true } })) as typeof fetch;
  const status = await googleProviderStatus(mock);
  if (!status.ok) throw new Error("Configured Google provider was rejected");
});
