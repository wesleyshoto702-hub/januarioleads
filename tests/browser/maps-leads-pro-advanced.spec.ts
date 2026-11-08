import { test, expect, type Page } from "@playwright/test";

// Never call Google Places, Google Maps or production during these tests.
const STAGING = "https://prlrxjothrslhswpkoza.supabase.co";
test.skip(process.env["VITE_SUPABASE_URL"] !== STAGING, "Requires isolated Staging frontend configuration.");
const userId = "11111111-1111-1111-1111-111111111111";

async function mockWorkspace(page: Page, plan: "free" | "pro" | "advanced") {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    if (url.hostname !== "prlrxjothrslhswpkoza.supabase.co") return route.abort();
    let payload: unknown = [];
    if (url.pathname === "/auth/v1/user")
      payload = { id: userId, email: "maps@example.invalid" };
    else if (url.pathname === "/rest/v1/private_access")
      payload = [{ user_id: userId }];
    else if (url.pathname === "/rest/v1/rpc/get_my_saas_entitlements")
      payload = {
        plan, currency: "BRL", price_cents: { free:0, pro:1490, advanced:2990 }[plan],
        daily_limit:{ free:5, pro:25, advanced:70 }[plan],
        used_today:0, remaining_today:{free:5,pro:25,advanced:70}[plan],
        usage_date:"2026-11-07",
        features:{
          crm:true,basic_messages:true,manual_followup:true,
          maps_search:plan!=="free",
          kanban:plan!=="free",custom_messages:plan!=="free",
          finance:plan!=="free",followup_center:plan!=="free",
          lead_enrichment:plan!=="free",
          internal_automations:plan==="advanced",
          advanced_reports:plan==="advanced",
          advanced_lead_prioritization:plan==="advanced",
        },
      };
    else if (url.pathname === "/functions/v1/search-places") {
      const request = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
      expect(request.mapMode).toBe(true);
      expect(request.segment).toBe("Barbearia");
      expect(request.city).toBe("Lavras");
      payload = {
        ok:true, demo:true,nextPageToken:null,
        quota:{ plan, daily_limit:plan==="pro"?25:70,used_today:2,remaining_today:plan==="pro"?23:68,usage_date:"2026-11-07" },
        results:[1,2].map((n)=>({
          placeId:"staging-demo-map-"+n,name:"Barbearia Fictícia "+n,
          primaryCategory:"Barbearia",categories:[],description:null,
          address:"Rua Fictícia "+n+", Lavras - MG", neighborhood:null,
          city:"Lavras",state:"MG",phone:null,internationalPhone:null,
          rating:null,reviewCount:null,isOpenNow:null,openingHours:[],
          website:null,instagram:null,googleMapsUrl:null,businessStatus:null,
          latitude:null,longitude:null,
        })),
      };
    }
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload)});
  });
  await page.addInitScript((id) => {
    localStorage.setItem("januarioleads:auth-session", JSON.stringify({
      accessToken:"mock-token",refreshToken:"mock-refresh",
      expiresAt:Date.now()+3_600_000,user:{id,email:"maps@example.invalid"},
    }));
  },userId);
}

test("Free: Buscar via Maps não aparece no menu", async ({page}) => {
  await mockWorkspace(page,"free");
  await page.goto("/app");
  await expect(page.getByRole("button",{name:"Buscar via Maps"})).toHaveCount(0);
});

for (const plan of ["pro","advanced"] as const) {
  test(plan+" abre o mapa ilustrativo e filtra Barbearias por cidade", async ({page}) => {
    await mockWorkspace(page,plan);
    await page.goto("/app");
    await page.getByRole("button",{name:"Buscar via Maps"}).first().click();
    await expect(page.getByRole("heading",{name:"Buscar via Maps"})).toBeVisible();
    await expect(page.getByText(/empresas, posições e ruas são fictícias/)).toBeVisible();
    await page.getByRole("button",{name:"Buscar no mapa"}).click();
    await expect(page.getByText("Barbearia Fictícia 1").first()).toBeVisible();
    await expect(page.getByRole("button",{name:"Selecionar Barbearia Fictícia 2"})).toBeVisible();
    await page.getByRole("button",{name:"Selecionar Barbearia Fictícia 2"}).click();
    await expect(page.getByRole("article",{name:"Empresa selecionada: Barbearia Fictícia 2"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Adicionar ao CRM"})).toBeVisible();
    await expect(page.getByText("2 empresas no mapa")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  });
}
