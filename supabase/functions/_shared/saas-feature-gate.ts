/** Fail-closed plan check for authenticated Supabase Edge Functions.
 *  Production retains the legacy access model until explicitly enabled
 *  after verified migrations. Staging always uses plan gates.
 */
const STAGING = "https://prlrxjothrslhswpkoza.supabase.co";

export function saasFeatureGatesEnabled(): boolean {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  return url === STAGING || Deno.env.get("SAAS_DAILY_QUOTAS_ENABLED") === "true";
}

export async function saasAllowsFeature(
  request: Request,
  feature: string,
): Promise<boolean> {
  if (!saasFeatureGatesEnabled()) return true;
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim()
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim()
    || request.headers.get("apikey")?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  if (!url || !apiKey || !authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return false;
  }
  try {
    const res = await fetch(url + "/rest/v1/rpc/saas_my_feature_enabled", {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: apiKey,
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_feature_key: feature }),
    });
    return res.ok && await res.json() === true;
  } catch {
    return false;
  }
}
