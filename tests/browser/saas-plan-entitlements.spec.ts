import { test, expect, type Page } from "@playwright/test";

// Run with VITE_SUPABASE_URL set to the staging project and no external services.
const stagingUrl = "https://prlrxjothrslhswpkoza.supabase.co";
const staging = process.env["VITE_SUPABASE_URL"] === stagingUrl;
test.skip(!staging, "Requires isolated Supabase staging preview env; never run against production.");

const userId = "11111111-1111-1111-1111-111111111111";
const flags: Record<string, boolean> = {
  crm: true, basic_messages: true, manual_followup: true, maps_search: false, kanban: false,
  custom_messages: false, followup_center: false, finance: false,
  lead_enrichment: false, advanced_reports: false,
  internal_automations: false, advanced_lead_prioritization: false,
};

type Plan = "free" | "pro" | "advanced";
function rights(plan: Plan) {
  const f = { ...flags };
  if (plan !== "free") {
    for (const key of ["kanban","custom_messages","followup_center","finance","lead_enrichment"]) f[key] = true;
  }
  if (plan === "advanced") {
    for (const key of ["advanced_reports","internal_automations","advanced_lead_prioritization","maps_search"]) f[key] = true;
  }
  return {
    plan, price_cents: { free:0,pro:1990,advanced:2990 }[plan],
    daily_limit: { free:5,pro:25,advanced:70 }[plan],
    used_today:0,remaining_today:{ free:5,pro:25,advanced:70 }[plan],
    usage_date:"2026-11-07", currency:"BRL", features:f,
  };
}

async function mockStaging(page: Page, plan: Plan) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    if (url.hostname !== "prlrxjothrslhswpkoza.supabase.co") return route.abort();
    const path = url.pathname;
    let data: unknown = [];
    if (path === "/auth/v1/user") data = { id:userId,email:"tester@example.invalid" };
    if (path === "/rest/v1/private_access") data = [{ user_id:userId }];
    if (path === "/rest/v1/rpc/get_my_saas_entitlements") data = rights(plan);
    if (path === "/rest/v1/saas_automation_settings") data = [];
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
  });
  await page.addInitScript((id) => {
    localStorage.setItem("januarioleads:auth-session", JSON.stringify({
      accessToken:"mock-jwt",refreshToken:"mock-refresh",expiresAt:Date.now()+3_600_000,
      user:{id,email:"tester@example.invalid"},
    }));
  },userId);
}

test("Free: lista, templates essenciais; sem financeiro, Kanban ou Advanced", async ({page}) => {
  await mockStaging(page,"free");
  await page.goto("/app");
  await expect(page.getByText(/Plano FREE/i)).toBeVisible();
  await expect(page.getByRole("button",{name:"Financeiro",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Oportunidades",exact:true})).toHaveCount(0);
  await expect(page.getByText("Inteligência e automações")).toHaveCount(0);
  await page.getByRole("button",{name:"Meus Leads",exact:true}).first().click();
  await expect(page.getByRole("button",{name:"Kanban",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Mensagens",exact:true}).first().click();
  await expect(page.getByText(/modelos essenciais prontos para consulta/i)).toBeVisible();
  await expect(page.getByRole("button",{name:/Adicionar mensagem/i})).toHaveCount(0);
});

test("Pro: libera Kanban, mensagens personalizadas, oportunidades e financeiro", async ({page}) => {
  await mockStaging(page,"pro");
  await page.goto("/app");
  await expect(page.getByText(/Plano PRO/i)).toBeVisible();
  await expect(page.getByRole("button",{name:"Financeiro",exact:true}).first()).toBeVisible();
  await expect(page.getByRole("button",{name:"Oportunidades",exact:true}).first()).toBeVisible();
  await expect(page.getByText("Inteligência e automações")).toHaveCount(0);
  await page.getByRole("button",{name:"Meus Leads",exact:true}).first().click();
  await expect(page.getByRole("button",{name:"Kanban",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Mensagens",exact:true}).first().click();
  await expect(page.getByRole("button",{name:/Adicionar mensagem/i})).toBeVisible();
});

test("Advanced: expõe automação opt-in e painel de prioridades", async ({page}) => {
  await mockStaging(page,"advanced");
  await page.goto("/app");
  await expect(page.getByText(/Plano ADVANCED/i)).toBeVisible();
  await expect(page.getByRole("heading",{name:/Inteligência e automações/i})).toBeVisible();
  await expect(page.getByText("Follow-up automático")).toBeVisible();
  await expect(page.getByText("Próximos leads prioritários")).toBeVisible();
  await expect(page.getByText("Comparação de segmentos")).toBeVisible();
  await expect(page.getByRole("checkbox",{name:/Habilitar agendamento automático/i})).toBeEnabled();
});
