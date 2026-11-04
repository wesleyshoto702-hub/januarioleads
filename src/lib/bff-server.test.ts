import { handleBffRequest } from "./bff-server.server.ts";
import { COOKIE_NAME } from "./bff-session-cookie.server.ts";

const sessionKey = btoa("0123456789abcdef0123456789abcdef")
  .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const project = "https://staging-bff.supabase.co";
const origin = "https://my-staging.example.test";
const uid = "11111111-1111-1111-1111-111111111111";
const config = {
  BFF_HTTPONLY_ENABLED: "true",
  BFF_SUPABASE_URL: project,
  BFF_SUPABASE_PUBLISHABLE_KEY: "public-test",
  BFF_SESSION_KEY: sessionKey,
};

function fakeSupabase() {
  const calls: Array<{ path: string; method: string; auth: string | null }> = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = (async (target: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof target === "string" ? target : target.toString());
    const auth = new Headers(init?.headers).get("Authorization");
    calls.push({ path: url.pathname, method: init?.method ?? "GET", auth });
    if (url.pathname === "/auth/v1/token") {
      return Response.json({
        access_token: "test-access", refresh_token: "test-refresh",
        expires_in: 3600, user: { id: uid, email: "a@example.invalid" },
      });
    }
    if (url.pathname === "/auth/v1/user") {
      return Response.json({ id: uid, email: "a@example.invalid" });
    }
    if (url.pathname === "/rest/v1/private_access") {
      return Response.json([{ user_id: uid }]);
    }
    if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    if (url.pathname === "/rest/v1/leads") return Response.json([{ company: "mocked" }]);
    return Response.json({ error: "Unexpected mock route" }, { status: 404 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = oldFetch; } };
}

Deno.test("BFF login returns opaque encrypted HttpOnly cookie, never actual tokens", async () => {
  const mock = fakeSupabase();
  try {
    const request = new Request(origin + "/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email: "a@example.invalid", password: "test-only" }),
    });
    const res = await handleBffRequest(request, config);
    if (!res || res.status !== 200) throw new Error("BFF login failed");
    const setCookie = res.headers.get("set-cookie") ?? "";
    const body = await res.text();
    if (!setCookie.startsWith(COOKIE_NAME + "=") || !setCookie.includes("HttpOnly") ||
        !setCookie.includes("Secure") || body.includes("test-access") ||
        body.includes("test-refresh") || setCookie.includes("test-access")) {
      throw new Error("Browser token disclosure");
    }
    const cookie = setCookie.split(";")[0];
    const get = await handleBffRequest(new Request(origin + "/api/session", {
      headers: { cookie },
    }), config);
    if (!get || get.status !== 200) throw new Error("HttpOnly session not restored");
    const data = await get.text();
    if (!data.includes(uid) || data.includes("test-refresh") || data.includes("test-access")) {
      throw new Error("Session API leaked a token");
    }
    const proxy = await handleBffRequest(new Request(origin + "/api/supabase/rest/v1/leads?select=company", {
      headers: { cookie, Authorization: "Bearer forged" },
    }), config);
    if (!proxy || proxy.status !== 200) throw new Error("Supabase proxy failed");
    if (mock.calls.some((c) => c.auth === "Bearer forged")) {
      throw new Error("Client Authorization header reached upstream");
    }
    if (!mock.calls.some((c) => c.path === "/rest/v1/leads" && c.auth === "Bearer test-access")) {
      throw new Error("Proxy did not use the actual authorized session");
    }
    const logout = await handleBffRequest(new Request(origin + "/api/session", {
      method: "DELETE", headers: { cookie, Origin: origin },
    }), config);
    if (!logout || logout.status !== 204 ||
        !(logout.headers.get("set-cookie") ?? "").includes("Max-Age=0")) {
      throw new Error("Logout did not clear cookie");
    }
  } finally {
    mock.restore();
  }
});

Deno.test("BFF blocks cross-site mutation and accidental production activation", async () => {
  const mock = fakeSupabase();
  try {
    const request = new Request(origin + "/api/session", {
      method: "POST", headers: { Origin: "https://attacker.example.test" },
      body: JSON.stringify({ email: "a@example.invalid", password: "test-only" }),
    });
    const denied = await handleBffRequest(request, config);
    if (!denied || denied.status !== 403 || mock.calls.length !== 0) {
      throw new Error("Cross-origin login reached upstream");
    }
    const production = await handleBffRequest(new Request(origin + "/api/session"),
      { ...config, BFF_SUPABASE_URL: "https://czkazbianiflhldenhcj.supabase.co" });
    if (!production || production.status !== 503) {
      throw new Error("Production BFF accidentally enabled");
    }
    const disabled = await handleBffRequest(new Request(origin + "/api/session"),
      { ...config, BFF_HTTPONLY_ENABLED: "false" });
    if (!disabled || disabled.status !== 503) {
      throw new Error("Disabled BFF accepted request");
    }
  } finally {
    mock.restore();
  }
});

Deno.test("BFF logout retains cookie on upstream rejection or network failure and allows retry", async () => {
  const mock = fakeSupabase();
  try {
    const login = await handleBffRequest(new Request(origin + "/api/session", {
      method: "POST", headers: { Origin: origin },
      body: JSON.stringify({ email: "a@example.invalid", password: "test-only" }),
    }), config);
    const cookie = login!.headers.get("set-cookie")!.split(";")[0]!;
    const successfulFetch = globalThis.fetch;
    for (const status of [401, 403, 429, 500, 503, 0]) {
      globalThis.fetch = () => status
        ? Promise.resolve(new Response("private upstream details", { status }))
        : Promise.reject(new Error("network"));
      const result = await handleBffRequest(new Request(origin + "/api/session", {
        method: "DELETE", headers: { cookie, Origin: origin },
      }), config);
      if (result?.status !== 503 || result.headers.has("set-cookie")) {
        throw new Error("Failed revocation claimed success or destroyed retry cookie");
      }
      if ((await result.text()).includes("private upstream details")) throw new Error("Upstream leak");
    }
    globalThis.fetch = successfulFetch;
    const retry = await handleBffRequest(new Request(origin + "/api/session", {
      method: "DELETE", headers: { cookie, Origin: origin },
    }), config);
    if (retry?.status !== 204 || !retry.headers.get("set-cookie")?.includes("Max-Age=0")) {
      throw new Error("Confirmed revocation did not clear cookie");
    }
  } finally { mock.restore(); }
});
