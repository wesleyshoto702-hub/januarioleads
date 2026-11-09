import { getAccessToken } from "../../lib/auth";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";

export const SAAS_STAGING_ACTIVE =
  SUPABASE_URL === "https://prlrxjothrslhswpkoza.supabase.co";

export type SaasUsage = {
  plan: "free" | "pro" | "advanced";
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  usage_date: string;
  /** Staging-only account flag: daily SaaS debits and plan gates are paused. */
  test_mode?: boolean;
};

export function isSaasUsage(value: unknown): value is SaasUsage {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SaasUsage>;
  return (
    (item.plan === "free" || item.plan === "pro" || item.plan === "advanced") &&
    Number.isInteger(item.daily_limit) && (item.daily_limit ?? -1) >= 0 &&
    Number.isInteger(item.used_today) && (item.used_today ?? -1) >= 0 &&
    Number.isInteger(item.remaining_today) && (item.remaining_today ?? -1) >= 0 &&
    typeof item.usage_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.usage_date)
  );
}

export async function loadMySaasUsage(): Promise<SaasUsage | null> {
  if (!SAAS_STAGING_ACTIVE) return null;

  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/get_my_saas_entitlements",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isSaasUsage(data) ? data : null;
  } catch {
    return null;
  }
}
