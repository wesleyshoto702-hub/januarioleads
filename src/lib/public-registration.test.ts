import { requestPublicSignup } from "./public-registration.ts";

const origin = "http://127.0.0.1:5173";
const email = "teste@example.invalid";
const password = "Senha-segura-exemplo-123";

Deno.test("cadastro normaliza nome e e-mail e usa o endpoint Auth com redirect local", async () => {
  let requests = 0;
  const fetchMock = (async (request: string | URL | Request, init?: RequestInit) => {
    requests++;
    const target = new URL(String(request));
    if (target.pathname !== "/auth/v1/signup" ||
        target.searchParams.get("redirect_to") !== origin + "/login" ||
        init?.method !== "POST" || init.credentials !== "omit") {
      throw new Error("Unexpected Auth request");
    }
    const data = JSON.parse(String(init.body)) as {
      email: string; password: string; data: { full_name: string };
    };
    if (data.email !== email || data.password !== password ||
        data.data.full_name !== "Teste Pessoa") throw new Error("Signup was not normalized");
    return Response.json({
      access_token: "do-not-use-this-access-token",
      refresh_token: "do-not-use-this-refresh-token",
    });
  }) as typeof fetch;
  const result = await requestPublicSignup("  Teste    Pessoa ", " TESTE@EXAMPLE.INVALID ", password, origin, fetchMock);
  if (!result.ok || requests !== 1 || Object.keys(result).length !== 1) {
    throw new Error("Signup must only return generic success and never a session");
  }
});

Deno.test("campos inválidos ou origem insegura não fazem requisição Auth", async () => {
  let requests = 0;
  const reject = (async () => {
    requests++;
    throw new Error("Unexpected network call");
  }) as typeof fetch;
  const cases = [
    ["", email, password, origin],
    ["Teste Pessoa", "invalid", password, origin],
    ["Teste Pessoa", email, "curta", origin],
    ["Teste Pessoa", email, password, "http://example.com"],
    ["Teste Pessoa", email, password, "https://app.test/another-path"],
    ["Teste Pessoa", email, password, "https://evil.test@real.test"],
  ];
  for (const [name, address, pass, site] of cases) {
    const result = await requestPublicSignup(name!, address!, pass!, site!, reject);
    if (result.ok) throw new Error("Invalid signup was accepted");
  }
  if (requests !== 0) throw new Error("Unsafe signup contacted Auth");
});

Deno.test("respostas de erro não revelam se um e-mail já existe", async () => {
  const response = await requestPublicSignup("Teste Pessoa", email, password, origin,
    (async () => Response.json({ msg: "User already registered" }, { status: 400 })) as typeof fetch);
  if (response.ok || /already registered/i.test(response.message)) {
    throw new Error("Account enumeration message leaked");
  }
  const throttled = await requestPublicSignup("Teste Pessoa", email, password, origin,
    (async () => new Response("", { status: 429 })) as typeof fetch);
  if (throttled.ok || !throttled.message.includes("Aguarde")) {
    throw new Error("Throttling needs a friendly error");
  }
});
