/**
 * Staging-only plan simulator. Never deployed to production.
 * Validated Supabase JWT + private_access; no checkout, no provider events.
 */
const STAGING = "https://prlrxjothrslhswpkoza.supabase.co";

function getAdminKey(): { key: string; bearer: boolean } | null {
  // Modern Edge Functions receive named secret keys, not necessarily a legacy JWT.
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const key = typeof parsed.default === "string" ? parsed.default.trim() :
        Object.values(parsed).find((value) => typeof value === "string" && value.startsWith("sb_secret_"));
      if (typeof key === "string" && key.startsWith("sb_secret_")) {
        return { key, bearer: false };
      }
    } catch { /* Fall back to legacy service role if available. */ }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  return legacy ? { key: legacy, bearer: true } : null;
}

function allowedOrigin(value: string): boolean {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.origin === value &&
      ((u.protocol === "https:" && /^januarioleads-[a-z0-9]+-wesley-s-projects16\.vercel\.app$/.test(u.hostname))
        || (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")));
  } catch { return false; }
}

function reply(request: Request, body: unknown, status = 200): Response {
  const origin = request.headers.get("origin") ?? "";
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  });
  if (origin && allowedOrigin(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  if (url !== STAGING) return reply(request, { ok: false, code: "NOT_AVAILABLE" }, 404);
  const origin = request.headers.get("origin") ?? "";
  if (!allowedOrigin(origin)) return reply(request, { ok: false, code: "FORBIDDEN" }, 403);
  if (request.method === "OPTIONS") return reply(request, { ok: true }, 204);
  if (request.method !== "POST") return reply(request, { ok: false, code: "INVALID_METHOD" }, 405);

  const auth = request.headers.get("authorization") ?? "";
  const publishable = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();
  const admin = getAdminKey();
  if (!/^Bearer\s+\S+$/i.test(auth) || !publishable || !admin) {
    return reply(request, { ok: false, code: "AUTH_REQUIRED" }, 401);
  }
  let plan: string;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" ||
        !("plan" in parsed) || typeof parsed.plan !== "string") throw new Error("Bad plan");
    plan = parsed.plan;
  } catch { return reply(request, { ok: false, code: "INVALID_REQUEST" }, 400); }
  if (!["free", "pro", "advanced"].includes(plan)) {
    return reply(request, { ok: false, code: "INVALID_PLAN" }, 400);
  }

  try {
    const headers = { apikey: publishable, Authorization: auth };
    const u = await fetch(STAGING + "/auth/v1/user", { headers });
    if (!u.ok) return reply(request, { ok: false, code: "AUTH_REQUIRED" }, 401);
    const user: unknown = await u.json();
    if (!user || typeof user !== "object" || !("id" in user) ||
        typeof user.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id)) {
      return reply(request, { ok: false, code: "AUTH_REQUIRED" }, 401);
    }
    const id = user.id;
    const access = await fetch(
      STAGING + "/rest/v1/private_access?select=user_id&user_id=eq." + encodeURIComponent(id) + "&limit=1",
      { headers },
    );
    if (!access.ok) return reply(request, { ok: false, code: "AUTH_FAILED" }, 503);
    const rows: unknown = await access.json();
    if (!Array.isArray(rows) || !rows.some((r) =>
      r && typeof r === "object" && "user_id" in r && r.user_id === id)) {
      return reply(request, { ok: false, code: "FORBIDDEN" }, 403);
    }

    const adminHeaders: Record<string, string> = {
      apikey: admin.key,
      "Content-Type": "application/json",
    };
    if (admin.bearer) adminHeaders.Authorization = "Bearer " + admin.key;
    const target = STAGING + "/rest/v1/saas_subscriptions";
    const result = plan === "free"
      ? await fetch(target + "?user_id=eq." + encodeURIComponent(id), {
          method: "DELETE", headers: adminHeaders,
        })
      : await fetch(target + "?on_conflict=user_id", {
          method: "POST",
          headers: { ...adminHeaders, Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({
            user_id: id,
            plan_code: plan,
            status: "active",
            period_start: new Date().toISOString(),
            period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
            provider: "staging_preview",
            provider_subscription_id: "demo:" + id,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          }),
        });
    if (!result.ok) return reply(request, { ok: false, code: "SIMULATION_FAILED" }, 503);
    return reply(request, { ok: true, plan, simulation: true });
  } catch {
    return reply(request, { ok: false, code: "REQUEST_FAILED" }, 503);
  }
});
