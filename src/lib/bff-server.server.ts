import {
  allowsMutatingRequest,
  getSessionCookie,
  openSession,
  sealSession,
  sessionClearCookie,
  sessionSetCookie,
  type BffSession,
} from "./bff-session-cookie.server";

type Config = { base: string; key: string; secret: string };
const PROD_PROJECT = "czkazbianiflhldenhcj";

function envValue(env: unknown, name: string): string {
  if (env && typeof env === "object" && name in env) {
    const result = (env as Record<string, unknown>)[name];
    return typeof result === "string" ? result : "";
  }
  return typeof process !== "undefined" ? (process.env[name] ?? "") : "";
}

function getConfig(env: unknown): Config | null {
  if (envValue(env, "BFF_HTTPONLY_ENABLED") !== "true") return null;
  const base = envValue(env, "BFF_SUPABASE_URL").replace(/\/$/, "");
  const key = envValue(env, "BFF_SUPABASE_PUBLISHABLE_KEY");
  const secret = envValue(env, "BFF_SESSION_KEY");
  try {
    const u = new URL(base);
    if (
      u.protocol !== "https:" || !u.hostname.endsWith(".supabase.co") ||
      u.username || u.password || u.port || u.pathname !== "/" ||
      u.search || u.hash || !key || !secret
    ) return null;
    // Production rollout must be explicitly reviewed. Staging is the default.
    if (u.hostname === PROD_PROJECT + ".supabase.co" &&
        envValue(env, "BFF_ALLOW_PRODUCTION") !== "true") return null;
    return { base, key, secret };
  } catch {
    return null;
  }
}

function noStore(response: Response, cookie?: string): Response {
  const h = new Headers(response.headers);
  h.set("Cache-Control", "no-store");
  h.set("X-Content-Type-Options", "nosniff");
  if (cookie) h.append("Set-Cookie", cookie);
  return new Response(response.body, { status: response.status, headers: h });
}

function error(status: number, message: string, clear = false): Response {
  return noStore(Response.json({ ok: false, message }, { status }),
    clear ? sessionClearCookie() : undefined);
}

async function supabaseRequest(
  config: Config, path: string, method: string,
  accessToken?: string, body?: string, options?: Headers
): Promise<Response> {
  const headers = new Headers();
  headers.set("apikey", config.key);
  headers.set("Accept", options?.get("accept") ?? "application/json");
  if (accessToken) headers.set("Authorization", "Bearer " + accessToken);
  if (body !== undefined) headers.set("Content-Type", options?.get("content-type") ?? "application/json");
  for (const name of ["prefer", "range"]) {
    const value = options?.get(name);
    if (value) headers.set(name, value);
  }
  const init: RequestInit = { method, headers, redirect: "error", cache: "no-store" };
  if (body !== undefined) init.body = body;
  return fetch(config.base + path, init);
}

async function authorized(config: Config, session: BffSession) {
  const response = await supabaseRequest(config, "/auth/v1/user", "GET", session.accessToken);
  if (!response.ok) return false;
  const user = (await response.json()) as { id?: unknown };
  if (!user || user.id !== session.user.id) return false;
  const allow = await supabaseRequest(config,
    "/rest/v1/private_access?select=user_id&user_id=eq." +
      encodeURIComponent(session.user.id) + "&limit=1",
    "GET", session.accessToken);
  if (!allow.ok) return false;
  const records: unknown = await allow.json();
  return Array.isArray(records) && records.some((row) =>
    row && typeof row === "object" && "user_id" in row &&
      row.user_id === session.user.id);
}

async function authenticatedSession(config: Config, request: Request) {
  const cookie = getSessionCookie(request.headers.get("cookie"));
  if (!cookie) return null;
  let session = await openSession(cookie, config.secret);
  if (!session) return null;
  let renewed = false;
  if (session.expiresAt <= Date.now() + 60_000) {
    const result = await supabaseRequest(
      config, "/auth/v1/token?grant_type=refresh_token", "POST", undefined,
      JSON.stringify({ refresh_token: session.refreshToken }),
    );
    if (!result.ok) return null;
    const data = (await result.json()) as {
      access_token?: unknown; refresh_token?: unknown; expires_in?: unknown;
    };
    if (
      typeof data.access_token !== "string" ||
      typeof data.refresh_token !== "string" ||
      typeof data.expires_in !== "number" ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0
    ) return null;
    session = {
      ...session,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    renewed = true;
  }
  if (!(await authorized(config, session))) return null;
  return { session, renewed };
}

function validLogin(body: unknown): body is { email: string; password: string } {
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;
  return typeof obj["email"] === "string" && obj["email"].length <= 320 &&
    obj["email"].includes("@") && typeof obj["password"] === "string" &&
    obj["password"].length >= 1 && obj["password"].length <= 1024;
}

async function handleSession(request: Request, config: Config): Promise<Response> {
  if (request.method === "POST") {
    if (!allowsMutatingRequest(request)) return error(403, "Origem não autorizada");
    let data: unknown;
    try { data = await request.json(); } catch { return error(400, "Dados inválidos"); }
    if (!validLogin(data)) return error(400, "Dados inválidos");
    const auth = await supabaseRequest(
      config, "/auth/v1/token?grant_type=password", "POST", undefined,
      JSON.stringify(data),
    );
    if (!auth.ok) return error(401, "E-mail ou senha incorretos");
    const payload = (await auth.json()) as {
      access_token?: unknown; refresh_token?: unknown; expires_in?: unknown;
      user?: { id?: unknown; email?: unknown };
    };
    if (
      typeof payload.access_token !== "string" ||
      typeof payload.refresh_token !== "string" ||
      typeof payload.expires_in !== "number" ||
      !Number.isFinite(payload.expires_in) || payload.expires_in <= 0 ||
      typeof payload.user?.id !== "string"
    ) return error(401, "Não foi possível autenticar");
    const session: BffSession = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
      user: {
        id: payload.user.id,
        email: typeof payload.user.email === "string" ? payload.user.email : null,
      },
    };
    if (!(await authorized(config, session))) {
      await supabaseRequest(config, "/auth/v1/logout", "POST", session.accessToken);
      return error(403, "Conta não autorizada");
    }
    const sealed = await sealSession(session, config.secret);
    return noStore(Response.json({ ok: true, user: session.user, expiresAt: session.expiresAt }),
      sessionSetCookie(sealed));
  }

  if (request.method === "DELETE") {
    if (!allowsMutatingRequest(request)) return error(403, "Origem não autorizada");
    const cookie = getSessionCookie(request.headers.get("cookie"));
    const session = cookie ? await openSession(cookie, config.secret) : null;
    if (session) {
      try {
        const revoked = await supabaseRequest(config, "/auth/v1/logout", "POST", session.accessToken);
        if (!revoked.ok) return error(503, "Não foi possível encerrar a sessão. Tente novamente.");
      } catch {
        // Preserve the cookie so a retry can still revoke the remote session.
        return error(503, "Não foi possível encerrar a sessão. Tente novamente.");
      }
    }
    return noStore(new Response(null, { status: 204 }), sessionClearCookie());
  }

  if (request.method !== "GET") return error(405, "Método não permitido");
  const current = await authenticatedSession(config, request);
  if (!current) return error(401, "Sessão expirada", true);
  const cookie = current.renewed
    ? sessionSetCookie(await sealSession(current.session, config.secret))
    : undefined;
  return noStore(Response.json({
    ok: true, user: current.session.user, expiresAt: current.session.expiresAt,
  }), cookie);
}

async function proxy(request: Request, config: Config): Promise<Response> {
  const method = request.method.toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return error(405, "Método não permitido");
  }
  if (method !== "GET" && !allowsMutatingRequest(request)) {
    return error(403, "Origem não autorizada");
  }

  const url = new URL(request.url);
  const subpath = url.pathname.slice("/api/supabase".length);
  if (!subpath.startsWith("/rest/v1/") && !subpath.startsWith("/functions/v1/")) {
    return error(404, "Rota não disponível");
  }
  const current = await authenticatedSession(config, request);
  if (!current) return error(401, "Sessão expirada", true);

  let body: string | undefined;
  if (method !== "GET") {
    body = await request.text();
    if (body.length > 500_000) return error(413, "Requisição muito grande");
  }
  const response = await supabaseRequest(
    config, subpath + url.search, method,
    current.session.accessToken, body, request.headers,
  );
  const headers = new Headers();
  for (const name of ["content-type", "content-range", "preference-applied"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  const cookie = current.renewed
    ? sessionSetCookie(await sealSession(current.session, config.secret))
    : undefined;
  return noStore(new Response(response.body, { status: response.status, headers }), cookie);
}

export async function handleBffRequest(request: Request, env: unknown): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== "/api/session" && !path.startsWith("/api/supabase/")) return null;
  const config = getConfig(env);
  if (!config) return error(503, "Autenticação HttpOnly indisponível neste ambiente");
  try {
    return path === "/api/session"
      ? await handleSession(request, config)
      : await proxy(request, config);
  } catch {
    // No tokens, upstream error bodies, cookie values or secrets in logs.
    return error(503, "Não foi possível conectar ao serviço");
  }
}
