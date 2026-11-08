import { test, expect, type Page } from "@playwright/test";

// All network calls are mocked: neither Google, Geoapify nor production receives traffic.
const STAGING = "https://prlrxjothrslhswpkoza.supabase.co";
test.skip(process.env["VITE_SUPABASE_URL"] !== STAGING,
  "Requires isolated staging frontend configuration.");
const userId = "11111111-1111-1111-1111-111111111111";
type Plan = "free" | "pro" | "advanced";
type Scenario = "google-fallback" | "geo-found" | "provider-unavailable";
type Requests = { unified: Record<string,unknown>[]; googleSeparate: number; };

async function mockWorkspace(
  page: Page, plan: Plan, scenario: Scenario = "google-fallback",
): Promise<Requests> {
  const calls: Requests = {unified:[],googleSeparate:0};
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    if (url.hostname !== "prlrxjothrslhswpkoza.supabase.co") return route.abort();
    let payload: unknown = [];
    let status = 200;
    if (url.pathname === "/auth/v1/user") {
      payload = { id: userId, email: "maps@example.invalid" };
    } else if (url.pathname === "/rest/v1/private_access") {
      payload = [{ user_id: userId }];
    } else if (url.pathname === "/rest/v1/rpc/get_my_saas_entitlements") {
      payload = {
        plan,currency:"BRL",price_cents:{free:0,pro:1490,advanced:2990}[plan],
        daily_limit:{free:5,pro:25,advanced:70}[plan],
        used_today:0,remaining_today:{free:5,pro:25,advanced:70}[plan],
        usage_date:"2026-11-08",
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
    } else if (url.pathname === "/functions/v1/geoapify-places") {
      const body = JSON.parse(route.request().postData() ?? "{}") as Record<string,unknown>;
      expect(body.action).toBe("search");
      expect(body.mapMode).toBe(true);
      expect(body.segment).toBe("Barbearia");
      expect(body.city).toBe("Lavras");
      expect(body.state).toBe("MG");
      calls.unified.push(body);
      if (scenario === "provider-unavailable") {
        status = 429;
        payload = {ok:false,code:"QUOTA",message:"Limite seguro de buscas atingido."};
      } else if (scenario === "geo-found") {
        payload = {
          ok:true,provider:"geoapify",limit:20,nextPageToken:null,
          places:[{
            source:"geoapify",sourceId:"geoapify:abc1",name:"Barbearia OSM",
            category:"service.beauty.hairdresser",
            address:"Rua OSM, Lavras - MG",city:"Lavras",state:"MG",
            latitude:-21.245,longitude:-44.99,
          }],
          coverage:{status:"matches",searchArea:"city",message:null},
          attribution:{provider:"Powered by Geoapify",providerUrl:"https://www.geoapify.com/",
            data:"© OpenStreetMap contributors",dataUrl:"https://www.openstreetmap.org/copyright"},
        };
      } else {
        payload = {
          ok:true,provider:"google",limit:20,nextPageToken:null,
          sourceSelection:"google_fallback",
          attribution:{provider:"Google Maps"},
          results:[1,2].map(n=>({
            placeId:"google-real-"+n,name:"Barbearia Google "+n,
            primaryCategory:"Barbearia",categories:[],
            description:null,address:"Rua de Lavras "+n+", Lavras - MG",
            neighborhood:null,city:"Lavras",state:"MG",
            phone:null,internationalPhone:null,rating:null,reviewCount:null,
            isOpenNow:null,openingHours:[],currentOpeningHours:null,regularOpeningHours:null,
            website:null,instagram:null,
            googleMapsUrl:"https://www.google.com/maps",
            businessStatus:null,latitude:-21.245,longitude:-44.99,previewOnly:true,
          })),
        };
      }
    } else if (url.pathname === "/functions/v1/search-places") {
      const body = JSON.parse(route.request().postData() ?? "{}") as Record<string,unknown>;
      if (body.mode === "search-quota") {
        payload = {ok:true,searchQuota:{plan,daily_limit:null,used_today:null,
          remaining_today:null,usage_date:"2026-11-08",max_results:20,allowed:true,reset_at:null}};
      } else {
        calls.googleSeparate++;
        status = 500;
        payload = {ok:false,code:"TEST_FAILED",message:"A second query must not happen"};
      }
    }
    return route.fulfill({status,contentType:"application/json",body:JSON.stringify(payload)});
  });
  await page.addInitScript((id) => {
    localStorage.setItem("januarioleads:auth-session", JSON.stringify({
      accessToken:"mock-token",refreshToken:"mock-refresh",
      expiresAt:Date.now()+3_600_000,user:{id,email:"maps@example.invalid"},
    }));
  },userId);
  return calls;
}
async function openMaps(page:Page) {
  await page.goto("/app");
  await page.getByRole("button",{name:"Buscar via Maps"}).first().click();
  await expect(page.getByRole("heading",{name:"Buscar via Maps"})).toBeVisible();
}

test("Free: Buscar via Maps continua indisponível", async({page})=>{
  await mockWorkspace(page,"free");
  await page.goto("/app");
  await expect(page.getByRole("button",{name:"Buscar via Maps"})).toHaveCount(0);
});

for (const plan of ["pro","advanced"] as const) {
  test(plan+": um clique exibe resultados Google após fallback automático",async({page})=>{
    const calls=await mockWorkspace(page,plan);
    await openMaps(page);
    await expect(page.getByRole("group",{name:"Fonte de estabelecimentos"})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Buscar no Google Places"})).toHaveCount(0);
    await page.getByRole("button",{name:"Buscar no mapa"}).click();
    await expect(page.getByText("Barbearia Google 1").first()).toBeVisible();
    expect(calls.unified).toHaveLength(1);
    expect(calls.googleSeparate).toBe(0);
    await expect(page.locator(".bms-results .bms-provider-attribution")).toContainText("Google Maps");
    await expect(page.getByRole("button",{name:"Adicionar ao CRM"})).toHaveCount(0);
    await expect(page.getByText(/importação de dados do Google no CRM fica desativada/)).toBeVisible();
    await expect(page.locator(".bms-results-count")).toHaveText("2");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  });
}

test("Geoapify com empresas exibe somente sua fonte e não faz consulta Google separada",async({page})=>{
 const calls=await mockWorkspace(page,"pro","geo-found");
 await openMaps(page);
 await page.getByRole("button",{name:"Buscar no mapa"}).click();
 await expect(page.getByRole("article",{name:"Estabelecimento Geoapify: Barbearia OSM"})).toBeVisible();
 await expect(page.locator(".bms-results .bms-provider-attribution")).toContainText("Powered by Geoapify");
 await expect(page.getByRole("link",{name:/OpenStreetMap/}).first()).toBeVisible();
 expect(calls.unified).toHaveLength(1);
 expect(calls.googleSeparate).toBe(0);
});

test("limite de orçamento mostra erro, sem empresas fictícias nem segunda busca",async({page})=>{
 const calls=await mockWorkspace(page,"pro","provider-unavailable");
 await openMaps(page);
 await page.getByRole("button",{name:"Buscar no mapa"}).click();
 await expect(page.getByRole("alert")).toContainText("Limite seguro de buscas");
 await expect(page.locator(".bms-results-count")).toHaveText("0");
 expect(calls.unified).toHaveLength(1);
 expect(calls.googleSeparate).toBe(0);
 await expect(page.getByText(/Fictícia/)).toHaveCount(0);
});

test("bairro continua disponível sem oferecer escolha técnica de provedor",async({page})=>{
 const calls=await mockWorkspace(page,"pro");
 await openMaps(page);
 await page.locator("#bms-neighborhood").fill("Centro");
 await page.getByRole("button",{name:"Buscar no mapa"}).click();
 await expect(page.getByText("Barbearia Google 1").first()).toBeVisible();
 expect(calls.unified[0]?.neighborhood).toBe("Centro");
 expect(calls.unified).toHaveLength(1);
});
