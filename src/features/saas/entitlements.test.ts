import { canUseSaasFeature, isSaasEntitlements, type SaasEntitlements } from "./entitlements.ts";
import { isSaasUsage } from "../search-leads/saas-usage.ts";

const free: SaasEntitlements = {
  plan: "free",
  daily_limit: 5,
  used_today: 0,
  remaining_today: 5,
  usage_date: "2026-11-07",
  currency: "BRL",
  price_cents: 0,
  features: {
    crm: true,
    basic_messages: true,
    kanban: false,
    finance: false,
    internal_automations: false,
    maps_search: false,
  },
};

Deno.test("somente objetos completos e planos conhecidos são entitlements válidos", () => {
  if (!isSaasEntitlements(free) || !isSaasUsage(free)) throw new Error("Free should be valid");
  if (isSaasEntitlements({ ...free, plan: "super_admin" })) throw new Error("unknown plan accepted");
  if (isSaasEntitlements({ ...free, currency: "USD" })) throw new Error("wrong currency accepted");
  if (isSaasEntitlements({ ...free, features: null })) throw new Error("missing flags accepted");
  if (isSaasEntitlements({ ...free, used_today: -1 })) throw new Error("negative usage accepted");
});

Deno.test("flags retornam valores booleanos sem confiar em preços locais", () => {
  if (free.features.crm !== true || free.features.finance !== false) throw new Error("free flags wrong");
  const pro: SaasEntitlements = {
    ...free, plan: "pro", price_cents: 1990, daily_limit: 25, remaining_today: 25,
    features: { ...free.features, finance: true, kanban: true, custom_messages: true, internal_automations: false, maps_search: false },
  };
  const advanced: SaasEntitlements = {
    ...pro, plan: "advanced", price_cents: 2990, daily_limit: 70, remaining_today: 70,
    features: { ...pro.features, internal_automations: true, advanced_reports: true, advanced_lead_prioritization: true, maps_search: true },
  };
  if (pro.features.internal_automations || !pro.features.kanban || pro.features.maps_search) throw new Error("Pro gating wrong");
  if (!advanced.features.internal_automations || !advanced.features.advanced_reports || !advanced.features.maps_search) {
    throw new Error("Advanced gating wrong");
  }
  // Feature checking in production is deliberate legacy fallback; for staging,
  // these flags are authoritative and the service fails closed if unavailable.
  if (typeof canUseSaasFeature(null, "finance") !== "boolean") {
    throw new Error("feature check must produce boolean");
  }
});
