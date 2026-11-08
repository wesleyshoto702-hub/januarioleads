import { test, expect, type Page } from "@playwright/test";

const STAGING = "https://prlrxjothrslhswpkoza.supabase.co";
test.skip(process.env["VITE_SUPABASE_URL"] !== STAGING,
  "Runs only with staging frontend configuration; never contacts production.");
const userId = "11111111-1111-1111-1111-111111111111";
type Plan = "free" | "pro" | "advanced";

type RequestLog = { geoapify: number; google: number; googlePayloads: Record<string, unknown>[] };
type Scenario = "geoapify-empty" | "geoapify-two" | "google-not-configured";

async function mockWorkspace(page: Page, plan: Plan, scenario: Scenario = "geoapify-empty"): Promise<RequestLog> {
  const calls: RequestLog = { geoapify: 0, google: 0, googlePayloads: [] };
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    if (url.hostname !== "prlrxjothrslhswpkoza.supabase.co") return route.abort();
    let payload: unknown = [];
    let status = 200;
    if (url.pathname === "/auth/v1/user")
      payload = { id: userId, email: "maps@example.invalid" };
    else if (url.pathname === "/rest/v1/private_access")
      payload = [{ user_id: userId }];
    else if (url.pathname === "/rest/v1/rpc/get_my_saas_entitlements")
      payload = {
        plan, currency: "BRL", price_cents: { free:0, pro:1990, advanced:2990 }[plan],
        daily_limit: { free:5, pro:25, advanced:70 }[plan],
        used_today:0, remaining_today: {free:5,pro:25,advanced:70}[plan],
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
    else if (url.pathname === "/functions/v1/geoapify-places") {
      calls.geoapify++;
      const request = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
      expect(request.action).toBe("search");
      expect(request.mapMode).toBe(true);
      expect(request.segment).toBe("Barbearia");
      expect(request.city).toBe("Lavras");
      payload = {
        ok:true,provider:"geoapify",limit:20,nextPageToken:null,
        places:scenario === "geoapify-two"
          ? [1,2].map((n) => ({
              source:"geoapify",sourceId:"geoapify:abc"+n,
              name:"Barbearia OSM "+n,category:"service.beauty.hairdresser",
              address:"Rua Real "+n+", Lavras", city:"Lavras",state:"MG",
              latitude:-21.25+n/1000, longitude:-44.99-n/1000,
            }))
          : [],
        coverage: {
          status:scenario === "geoapify-two" ? "matches" : "no_osm_category_matches",
          searchArea:"nearby-10km",cityBoundaryChecked:true,
          nearbyRadiusMeters:10000,nearbyRadiusChecked:true,nearbySkippedReason:null,
          message:scenario === "geoapify-two" ? null :
            "Geoapify não possui empresas dessa categoria catalogadas nesta área.",
          alternativeSource:scenario === "geoapify-two" ? null : "google_places_manual",
        },
        attribution:{provider:"Powered by Geoapify",providerUrl:"https://www.geoapify.com/",
          data:"© OpenStreetMap contributors",dataUrl:"https://www.openstreetmap.org/copyright"},
      };
    } else if (url.pathname === "/functions/v1/search-places") {
      const req = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
      if (req.mode === "search-quota") {
        payload = {ok:true,searchQuota:{
          plan,daily_limit:null,used_today:null,remaining_today:null,
          usage_date:"2026-11-08",max_results:20,allowed:true,reset_at:null,
        }};
      } else {
        calls.google++;
        calls.googlePayloads.push(req);
        expect(req.mapMode).toBe(true);
        expect(req.stagingDemo).not.toBe(true);
        expect(req.segment).toBe("Barbearia");
        expect(req.city).toBe("Lavras");
        if (scenario === "google-not-configured") {
          status = 503;
          payload = {ok:false,code:"NOT_CONFIGURED",
            message:"A credencial privada do Google Places não está configurada."};
        } else {
          payload = {
            ok:true,demo:false,nextPageToken:null,
            quota: { plan,daily_limit:25,used_today:1,remaining_today:24,usage_date:"2026-11-08" },
            results:[1,2].map((n)=>({
              placeId:"google-place-"+n,name:"Barbearia Google "+n,
              primaryCategory:"Barbearia",categories:[],description:null,
              address:"Rua Exemplo "+n+", Lavras - MG",neighborhood:null,
              city:"Lavras",state:"MG",phone:null,internationalPhone:null,
              rating:null,reviewCount:null,isOpenNow:null,openingHours:[],
              website:null,instagram:null,googleMapsUrl:"https://www.google.com/maps",
              businessStatus:null,latitude:null,longitude:null,
            })),
          };
        }
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

async function goToMaps(page: Page) {
  await page.goto("/app");
  await page.getByRole("button",{name:"Buscar via Maps"}).first().click();
  await expect(page.getByRole("heading",{name:"Buscar via Maps"})).toBeVisible();
}

test("Free: Buscar via Maps não aparece no menu", async ({page}) => {
  await mockWorkspace(page,"free");
  await page.goto("/app");
  await expect(page.getByRole("button",{name:"Buscar via Maps"})).toHaveCount(0);
});

for (const plan of ["pro","advanced"] as const) {
  test(plan+" só consulta Google depois do clique explícito de alternativa", async ({page}) => {
    const calls = await mockWorkspace(page,plan);
    await goToMaps(page);
    await expect(page.getByRole("group",{name:"Fonte de estabelecimentos"})).toBeVisible();
    await expect(page.getByRole("button",{name:/Geoapify · OpenStreetMap/})).toHaveAttribute("aria-pressed","true");
    await page.getByRole("button",{name:"Buscar no mapa"}).click();
    await expect(page.getByText(/Geoapify não possui empresas dessa categoria/).first()).toBeVisible();
    expect(calls.geoapify).toBe(1);
    expect(calls.google).toBe(0);
    await page.getByRole("button",{name:"Buscar no Google Places"}).click();
    await expect(page.getByText("Barbearia Google 1").first()).toBeVisible();
    expect(calls.geoapify).toBe(1);
    expect(calls.google).toBe(1);
    await expect(page.getByRole("button",{name:"Adicionar ao CRM"})).toHaveCount(0);
    await expect(page.getByText(/importação de dados do Google no CRM fica desativada/)).toBeVisible();
    await expect(page.locator(".bms-results .bms-provider-attribution")).toContainText("Google Maps");
    await expect(page.getByText(/Desenho ilustrativo · sem marcadores geográficos reais/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  });
}

test("Geoapify com empresas apresenta somente OSM e não chama Google", async ({page}) => {
  const calls = await mockWorkspace(page,"pro","geoapify-two");
  await goToMaps(page);
  await page.getByRole("button",{name:"Buscar no mapa"}).click();
  await expect(page.getByText("Barbearia OSM 1").first()).toBeVisible();
  await expect(page.getByRole("article",{name:"Estabelecimento Geoapify: Barbearia OSM 1"})).toBeVisible();
  await expect(page.getByRole("link",{name:/Ver localização no OpenStreetMap/})).toHaveAttribute(
    "href",/www\.openstreetmap\.org/
  );
  await expect(page.locator(".bms-results .bms-provider-attribution")).toContainText("Powered by Geoapify");
  await expect(page.getByRole("button",{name:"Buscar no Google Places"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Adicionar ao CRM"})).toHaveCount(0);
  expect(calls.geoapify).toBe(1);
  expect(calls.google).toBe(0);
});

test("Trocar a fonte não realiza consulta e erro real do Google não gera empresas fictícias", async ({page}) => {
  const calls = await mockWorkspace(page,"pro","google-not-configured");
  await goToMaps(page);
  await page.getByRole("button",{name:/Google Places · busca real/}).click();
  expect(calls.geoapify).toBe(0);
  expect(calls.google).toBe(0);
  await page.getByRole("button",{name:"Buscar no mapa"}).click();
  await expect(page.getByRole("alert")).toContainText("credencial privada do Google Places");
  expect(calls.google).toBe(1);
  await expect(page.getByText(/Fictícia/)).toHaveCount(0);
  await expect(page.locator(".bms-results-count")).toHaveText("0");
});
