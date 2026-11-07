import {
  getBetaSignupConfig, requestBetaSignup, type BetaSignupConfig,
} from "./beta-registration.ts";

const stagingRef = "aaaaaaaaaaaaaaaaaaaa";
const stagingUrl = "https://" + stagingRef + ".supabase.co";
const prodRef = "czkazbianiflhldenhcj";
const publishable = "sb_publishable_test_only_123456789";
const baseEnv = {
  VITE_BETA_SIGNUP_ENABLED: "true",
  VITE_BETA_SUPABASE_URL: stagingUrl,
  VITE_BETA_SUPABASE_PUBLISHABLE_KEY: publishable,
  VITE_BETA_SIGNUP_PROJECT_REF: stagingRef,
};

function config(): BetaSignupConfig {
  const settings = getBetaSignupConfig(baseEnv);
  if (!settings) throw new Error("Valid staging config rejected");
  return settings;
}

Deno.test("cadastro beta fica fechado por padrao, inclusive se existir URL de producao", () => {
  if (getBetaSignupConfig({ ...baseEnv, VITE_BETA_SIGNUP_ENABLED: "false" })) {
    throw new Error("Disabled beta should never allow signup");
  }
  if (getBetaSignupConfig({ ...baseEnv, VITE_BETA_SIGNUP_ENABLED: undefined })) {
    throw new Error("Missing flag should not allow signup");
  }
  if (getBetaSignupConfig({ ...baseEnv, VITE_HTTPONLY_SESSION: "true" })) {
    throw new Error("BFF cannot sign up through the browser proxy");
  }
  if (getBetaSignupConfig({
    ...baseEnv,
    VITE_BETA_SUPABASE_URL: "https://" + prodRef + ".supabase.co",
    VITE_BETA_SIGNUP_PROJECT_REF: prodRef,
  })) {
    throw new Error("Production must never accept signups");
  }
});

Deno.test("cadastro beta exige URL staging HTTPS, ref idêntica e chave publicavel", () => {
  const invalid = [
    { VITE_BETA_SUPABASE_URL: "https://" + prodRef + ".supabase.co" },
    { VITE_BETA_SUPABASE_URL: "https://" + stagingRef + ".supabase.co.evil.test" },
    { VITE_BETA_SUPABASE_URL: "https://" + stagingRef + ".supabase.co/prefix" },
    { VITE_BETA_SUPABASE_URL: "http://" + stagingRef + ".supabase.co" },
    { VITE_BETA_SUPABASE_URL: "https://evil@" + stagingRef + ".supabase.co" },
    { VITE_BETA_SUPABASE_URL: "https://" + stagingRef + ".supabase.co:444" },
    { VITE_BETA_SIGNUP_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb" },
    { VITE_BETA_SIGNUP_PROJECT_REF: "" },
    { VITE_BETA_SUPABASE_PUBLISHABLE_KEY: "service_role" },
    { VITE_BETA_SUPABASE_PUBLISHABLE_KEY: "" },
  ];
  for (const altered of invalid) {
    if (getBetaSignupConfig({ ...baseEnv, ...altered })) {
      throw new Error("Unsafe registration config accepted: " + Object.keys(altered).join(","));
    }
  }
  if (config().projectRef !== stagingRef) throw new Error("Wrong staging project");
});

Deno.test("cadastro em staging chama apenas Auth, nao armazena token nem altera CRM", async () => {
  let calls = 0;
  const requester = (async (input: string | URL | Request, init?: RequestInit) => {
    calls++;
    const url = new URL(String(input));
    if (url.hostname !== stagingRef + ".supabase.co" ||
        url.pathname !== "/auth/v1/signup" || init?.method !== "POST" ||
        init?.credentials !== "omit" || init?.cache !== "no-store") {
      throw new Error("Wrong signup endpoint or method");
    }
    if (url.searchParams.get("redirect_to") !== "http://127.0.0.1:5173/login") {
      throw new Error("Bad email redirect");
    }
    const headers = init.headers as Record<string, string>;
    if (headers.apikey !== publishable || headers["Content-Type"] !== "application/json") {
      throw new Error("Incorrect publishable headers");
    }
    const body = JSON.parse(String(init.body)) as { email: string; password: string };
    if (body.email !== "teste@gmail.com" || body.password !== "my strong password 123") {
      throw new Error("Wrong signup request");
    }
    return Response.json({ access_token: "IGNORE-THIS-FAKE-TOKEN", refresh_token: "IGNORE" });
  }) as typeof fetch;

  const result = await requestBetaSignup(
    config(), "  TESTE@GMAIL.COM ", "my strong password 123",
    "http://127.0.0.1:5173", requester,
  );
  if (!result.ok || calls !== 1 || Object.keys(result).length !== 1) {
    throw new Error("Successful signup must discard returned tokens");
  }
});

Deno.test("erro, senha fraca e redirecionamento inseguro nao vazam respostas Auth", async () => {
  let calls = 0;
  const requester = (async () => {
    calls++;
    return Response.json(
      { msg: "User already registered (private server message)" },
      { status: 400 },
    );
  }) as typeof fetch;

  const weak = await requestBetaSignup(config(), "ok@gmail.com", "short", "https://app.test", requester);
  if (weak.ok || calls) throw new Error("Weak password accepted or sent");

  const badRedirect = await requestBetaSignup(config(), "ok@gmail.com", "long example password", "https://evil.test/steal", requester);
  if (badRedirect.ok || calls) throw new Error("Invalid redirect accepted or sent");

  const error = await requestBetaSignup(config(), "ok@gmail.com", "long example password", "https://app.test", requester);
  if (error.ok || error.message.includes("User already registered") || calls !== 1) {
    throw new Error("Auth error exposes account state");
  }

  const throttled = await requestBetaSignup(
    config(), "ok@gmail.com", "long example password", "https://app.test",
    (async () => new Response("", { status: 429 })) as typeof fetch,
  );
  if (throttled.ok || !throttled.message.includes("Aguarde")) {
    throw new Error("Rate limit not handled");
  }

  const offline = await requestBetaSignup(
    config(), "ok@gmail.com", "long example password", "https://app.test",
    (async () => { throw new Error("network down"); }) as typeof fetch,
  );
  if (offline.ok || offline.message.includes("network down")) {
    throw new Error("Network failure leaks details");
  }
});
