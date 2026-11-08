import { getAccessToken } from "../../lib/auth";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../lib/supabase-config";
import { SAAS_STAGING_ACTIVE, type SaasUsage, isSaasUsage } from "../search-leads/saas-usage";

export type PlanFeature =
  | "crm" | "basic_messages" | "manual_followup" | "kanban"
  | "custom_messages" | "followup_center" | "finance"
  | "lead_enrichment" | "advanced_reports"
  | "internal_automations" | "advanced_lead_prioritization";

export type SaasEntitlements = SaasUsage & {
  features: Partial<Record<PlanFeature, boolean>>;
  price_cents: number;
  currency: "BRL";
};

export function isSaasEntitlements(data: unknown): data is SaasEntitlements {
  if (!isSaasUsage(data)) return false;
  const value = data as Partial<SaasEntitlements>;
  return Number.isInteger(value.price_cents) &&
    value.price_cents! >= 0 &&
    value.currency === "BRL" &&
    typeof value.features === "object" &&
    value.features !== null &&
    !Array.isArray(value.features);
}

/** Fail closed in SaaS Staging; do not change legacy production access. */
export function canUseSaasFeature(
  rights: SaasEntitlements | null,
  feature: PlanFeature,
): boolean {
  if (!SAAS_STAGING_ACTIVE) return true;
  return rights?.features[feature] === true;
}

export async function fetchMySaasEntitlements(): Promise<SaasEntitlements | null> {
  if (!SAAS_STAGING_ACTIVE) return null;
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_my_saas_entitlements", {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    return isSaasEntitlements(json) ? json : null;
  } catch {
    return null;
  }
}
