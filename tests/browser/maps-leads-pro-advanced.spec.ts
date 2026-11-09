import { test, expect, type Page } from "@playwright/test";

// All network calls are mocked: neither Google, Geoapify nor production receives traffic.
const STAGING = "https://prlrxjothrslhswpkoza.supabase.co";
test.skip(process.env["VITE_SUPABASE_URL"] !== STAGING,
  "Requires isolated staging frontend configuration.");
const userId = "11111111-1111-1111-1111-111111111111";
type Plan = "free" | "pro" | "advanced";
type Scenario = "google-fallback" | "geo-found" | "provider-unavailable" | "crm-conflict" | "test-mode";
type Requests = { unified: Record<string,unknown>[]; googleSeparate: number; crmSaves: Record<string,unknown>[]; };

async function mockWorkspace(
  page: Page, plan: Plan, scenario: Scenario = "google-fallback",
): Promise<Requests> {
  const calls: Requests = {unified:[],googleSeparate:0,crmSaves:[]};
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    if (url.hostname === "servicodados.ibge.gov.br") {
      const uf = url.pathname.match(/\/estados\/(\d+)\/municipios/)?.[1];
      const cities: Record<string,string[]> = {
        "31":["Lavras","Belo Horizonte"],"35":["São Paulo"],
        "13":["Manaus"],"41":["Curitiba"],
      };
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify((cities[uf??""]??["Lavras"]).map(nome=>({nome})))});
    }
    if (url.hostname !== "prlrxjothrslhswpkoza.supabase.co") return route.abort();
    let payload: unknown = [];
    let status = 200;
    if (url.pathname === "/auth/v1/user") {
      payload = { id: userId, email: "maps@example.invalid" };
    } else if (url.pathname === "/rest/v1/private_access") {
      payload = [{ user_id: userId }];
    } else if (url.pathname === "/rest/v1/rpc/get_my_saas_entitlements") {
      payload = {
        plan,currency:"BRL",price_cents:{free:0,pro:1990,advanced:2990}[plan],
        daily_limit:{free:5,pro:25,advanced:70}[plan],
        used_today:scenario==="test-mode" ? 5 : 0,
        remaining_today:scenario==="test-mode" ? 0 : {free:5,pro:25,advanced:70}[plan],
        test_mode:scenario==="test-mode",
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
    } else if (url.pathname === "/rest/v1/leads" && route.request().method()==="POST") {
      const value=JSON.parse(route.request().postData()??"{}") as Record<string,unknown>;
      calls.crmSaves.push(value);
      status=scenario==="crm-conflict" ? 409 : 201;
      payload=scenario==="crm-conflict"
        ? {code:"23505",message:"duplicate user/place id"} : [];
    } else if (url.pathname === "/rest/v1/leads" &&
               route.request().method()==="GET" &&
               url.searchParams.get("place_id")==="eq.google-real-1" &&
               scenario==="crm-conflict") {
      payload=[{
        id:"22222222-2222-4222-8222-222222222222",user_id:userId,
        company:"Nome informado na outra aba",place_id:"google-real-1",
        segment:"Barbearia",phone:"",status:"send_message",
        first_contact:"2026-11-08",created_at:"2026-11-08T12:00:00Z",notes:"",
      }];
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
          ok:true,provider:"geoapify",limit:35,nextPageToken:null,
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
          ok:true,provider:"google",limit:35,nextPageToken:null,
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
      } else if (body.segment === "Barbearia" && body.mapMode !== true) {
        // Traditional Google search: a live preview; CRM must save only a user label.
        payload = {
          ok:true,nextPageToken:null,partial:false,
          results:[{
            placeId:"google-traditional-1",name:"Nome vindo do Google",
            primaryCategory:"Barbearia",categories:["hair_care"],
            description:"Conteúdo Google não persistente",
            address:"Rua Exemplo 42, Lavras - MG",neighborhood:"Centro",
            city:"Lavras",state:"MG",phone:"(35) 99999-9999",
            internationalPhone:"+5535999999999",rating:4.8,reviewCount:39,
            isOpenNow:true,openingHours:["Seg-Sex"],currentOpeningHours:null,
            regularOpeningHours:null,website:"https://example.com",
            instagram:null,googleMapsUrl:"https://google.com/maps",
            businessStatus:"OPERATIONAL",latitude:-21.245,longitude:-44.999,
          }],
        };
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
    const addToCrm=page.getByRole("button",{name:"Adicionar ao CRM"});
    await expect(addToCrm).toBeDisabled();
    await expect(page.getByLabel("Nome que você quer usar no CRM")).toBeVisible();
    await page.getByLabel("Nome que você quer usar no CRM").fill("Contato informado pelo cliente");
    await expect(addToCrm).toBeEnabled();
    await expect(page.locator(".bms-staging-google-detail")).toBeVisible();
    await expect(page.locator(".bms-staging-google-detail")).toContainText("Barbearia Google 1");
    await expect(page.locator(".bms-map-frame .bms-business-card")).toHaveCount(1);
    await expect(page.locator(".bms-map-frame .bms-business-card")).toContainText("Barbearia Google 1");
    await expect(page.getByText(/outros dados ficam somente na consulta/)).toBeVisible();
    await expect(page.locator(".bms-results-count")).toHaveText("2");
    await expect(page.getByText("2 créditos por lead").first()).toBeVisible();
    await expect(page.getByRole("button",{name:"Carregar mais empresas"})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  });
}

test("Geoapify com empresas exibe somente sua fonte e não faz consulta Google separada",async({page})=>{
 const calls=await mockWorkspace(page,"advanced","geo-found");
 await openMaps(page);
 await page.getByRole("button",{name:"Buscar no mapa"}).click();
 await expect(page.getByRole("article",{name:"Estabelecimento Geoapify: Barbearia OSM"})).toBeVisible();
 await expect(page.getByRole("article",{name:"Estabelecimento Geoapify: Barbearia OSM"})
   .getByRole("button",{name:"Adicionar ao CRM"})).toBeEnabled();
 await expect(page.locator(".bms-results .bms-provider-attribution")).toContainText("Powered by Geoapify");
 await expect(page.getByRole("link",{name:/OpenStreetMap/}).first()).toBeVisible();
 expect(calls.unified).toHaveLength(1);
 expect(calls.googleSeparate).toBe(0);
});

test("limite de orçamento mostra erro, sem empresas fictícias nem segunda busca",async({page})=>{
 const calls=await mockWorkspace(page,"advanced","provider-unavailable");
 await openMaps(page);
 await page.getByRole("button",{name:"Buscar no mapa"}).click();
 await expect(page.getByRole("alert")).toContainText("Limite seguro de buscas");
 await expect(page.locator(".bms-results-count")).toHaveText("0");
 expect(calls.unified).toHaveLength(1);
 expect(calls.googleSeparate).toBe(0);
 await expect(page.getByText(/Fictícia/)).toHaveCount(0);
});

test("bairro continua disponível sem oferecer escolha técnica de provedor",async({page})=>{
 const calls=await mockWorkspace(page,"advanced");
 await openMaps(page);
 await page.locator("#bms-neighborhood").fill("Centro");
 await page.getByRole("button",{name:"Buscar no mapa"}).click();
 await expect(page.getByText("Barbearia Google 1").first()).toBeVisible();
 expect(calls.unified[0]?.neighborhood).toBe("Centro");
 expect(calls.unified).toHaveLength(1);
});


test("Pro: Buscar via Maps está disponível com a mesma cobrança de 2 créditos por lead", async({page})=>{
 await mockWorkspace(page,"pro");
 await openMaps(page);
 await expect(page.getByText("Pro e Advanced · 2 créditos por lead")).toBeVisible();
});


test("Maps Google: CRM salva só Place ID e nome escolhido pelo usuário",async({page})=>{
  const calls=await mockWorkspace(page,"advanced");
  await openMaps(page);
  await page.getByRole("button",{name:"Buscar no mapa"}).click();
  await expect(page.getByRole("article",{name:/Empresa selecionada: Barbearia Google 1/})).toBeVisible();
  const manualName="Cliente cadastrado manualmente";
  await page.getByLabel("Nome que você quer usar no CRM").fill(manualName);
  await page.getByRole("button",{name:"Adicionar ao CRM"}).click();
  await expect.poll(()=>calls.crmSaves.length).toBe(1);
  const saved=calls.crmSaves[0]!;
  expect(saved["company"]).toBe(manualName);
  expect(saved["place_id"]).toBe("google-real-1");
  for(const key of ["address","city","state","latitude","longitude","google_maps_url","website"]) {
    expect(saved[key]??null,"Should not persist provider content: "+key).toBeNull();
  }
  await expect(page.getByRole("button",{name:"Lead já adicionado"})).toBeDisabled();
  expect(calls.crmSaves).toHaveLength(1);
});

test("Maps Geoapify: dados OSM, atribuição e ID são salvos no CRM",async({page})=>{
  const calls=await mockWorkspace(page,"advanced","geo-found");
  await openMaps(page);
  await page.getByRole("button",{name:"Buscar no mapa"}).click();
  await expect(page.getByRole("article",{name:/Estabelecimento Geoapify: Barbearia OSM/})).toBeVisible();
  await page.getByRole("article",{name:/Estabelecimento Geoapify: Barbearia OSM/})
    .getByRole("button",{name:"Adicionar ao CRM"}).click();
  await expect.poll(()=>calls.crmSaves.length).toBe(1);
  const saved=calls.crmSaves[0]!;
  expect(saved["place_id"]).toBe("geoapify:abc1");
  expect(saved["company"]).toBe("Barbearia OSM");
  expect(saved["notes"]).toContain("© OpenStreetMap contributors");
  await expect(page.getByRole("article",{name:/Estabelecimento Geoapify: Barbearia OSM/})
    .getByRole("button",{name:"Lead já adicionado"})).toBeDisabled();
  expect(calls.crmSaves).toHaveLength(1);
});

test("Maps: outra aba salvou o mesmo Google Place ID; não duplica nem informa falha genérica",async({page})=>{
  const calls=await mockWorkspace(page,"pro","crm-conflict");
  await openMaps(page);
  await page.getByRole("button",{name:"Buscar no mapa"}).click();
  await expect(page.getByRole("article",{name:/Empresa selecionada: Barbearia Google 1/})).toBeVisible();
  await page.getByLabel("Nome que você quer usar no CRM").fill("Nome informado manualmente");
  await page.getByRole("button",{name:"Adicionar ao CRM"}).click();
  await expect(page.getByText("Lead já adicionado ao CRM. Nenhum novo cadastro foi criado.")).toBeVisible();
  await expect(page.getByRole("button",{name:"Lead já adicionado"})).toBeDisabled();
  expect(calls.crmSaves).toHaveLength(1);
});

test("Buscar Leads: Google só permite salvar ID e nome informado, nunca conteúdo do provedor",async({page})=>{
  const calls=await mockWorkspace(page,"pro");
  await page.addInitScript((id)=>{
    localStorage.setItem("januarioleads:workspace:v2:"+id+":leadflow:recent-searches",
      JSON.stringify([{segment:"Barbearia",city:"Lavras",state:"MG"}]));
  },userId);
  await page.goto("/app");
  await page.getByRole("button",{name:"Buscar Leads",exact:true}).first().click();
  await page.locator(".recent-searches").getByRole("button",{name:/Barbearia/}).click();
  const card=page.locator(".business-card").filter({hasText:"Nome vindo do Google"});
  await expect(card).toBeVisible();
  const add=card.getByRole("button",{name:"Adicionar aos meus leads"});
  await expect(add).toBeDisabled();
  await card.getByPlaceholder("Digite o nome por conta própria").fill("Meu contato verificado");
  await expect(add).toBeEnabled();
  await add.click();
  await expect.poll(()=>calls.crmSaves.length).toBe(1);
  const saved=calls.crmSaves[0]!;
  expect(saved["company"]).toBe("Meu contato verificado");
  expect(saved["place_id"]).toBe("google-traditional-1");
  for (const key of ["address","city","state","latitude","longitude","phone",
    "website","google_maps_url","rating","review_count","description"]) {
    expect(saved[key]??null,"Google property leaked: "+key).toBeNull();
  }
  expect(String(saved["notes"]??"")).not.toContain("Rua Exemplo 42");
});


test("erro do Google Maps no marcador não derruba o CRM nem a lista",async({page})=>{
  // These tests require the public Maps JS browser key in the local staging build.
  // The SDK is mocked: no requests to Google are made.
  test.skip(!process.env["VITE_GOOGLE_MAPS_BROWSER_KEY"],
    "Set a public browser Maps key in staging test configuration to exercise the map canvas.");
  await page.addInitScript(()=>{
    Object.defineProperty(window,"google",{configurable:true,value:{maps:{
      Map:class {
        fitBounds() {}
        panTo() {}
        setZoom() {}
        getZoom() { return 12; }
      },
      Marker:class {
        constructor() { throw new Error("SDK Marker indisponível"); }
      },
      LatLngBounds:class { extend() {} },
    }}});
  });
  const calls=await mockWorkspace(page,"advanced");
  await openMaps(page);
  await page.getByRole("button",{name:"Buscar no mapa"}).click();
  await expect(page.locator(".bms-google-map")).toContainText(
    "Mapa visual indisponível. Os estabelecimentos continuam na lista ao lado.");
  await expect(page.locator(".bms-results-list")).toContainText("Barbearia Google 1");
  await expect(page.getByRole("heading",{name:"Não foi possível carregar esta página"})).toHaveCount(0);
  expect(calls.unified).toHaveLength(1);
});

test("SDK de mapas incompleto é tratado sem travar a lista de estabelecimentos",async({page})=>{
  test.skip(!process.env["VITE_GOOGLE_MAPS_BROWSER_KEY"],
    "Requires a browser Maps key in the staging test build.");
  await page.addInitScript(()=>{
    Object.defineProperty(window,"google",{configurable:true,value:{maps:{
      Map:class {
        fitBounds() {}
        panTo() {}
        setZoom() {}
        getZoom() { return 12; }
      },
      // Marker and importLibrary intentionally absent.
      LatLngBounds:class { extend() {} },
    }}});
  });
  await mockWorkspace(page,"pro");
  await openMaps(page);
  await page.getByRole("button",{name:"Buscar no mapa"}).click();
  await expect(page.locator(".bms-google-map")).toContainText(
    "Mapa visual indisponível. Os estabelecimentos continuam na lista ao lado.");
  await expect(page.locator(".bms-results-list")).toContainText("Barbearia Google 1");
  await expect(page.getByRole("heading",{name:"Não foi possível carregar esta página"})).toHaveCount(0);
});

test("Free: conta de homologação em modo testes pesquisa Maps sem débito ou bloqueio",async({page})=>{
  const calls=await mockWorkspace(page,"free","test-mode");
  await openMaps(page);
  await expect(page.getByText("Modo testes · créditos pausados")).toBeVisible();
  const search=page.getByRole("button",{name:"Buscar no mapa"});
  await expect(search).toBeEnabled();
  await search.click();
  await expect(page.getByText("Barbearia Google 1").first()).toBeVisible();
  await expect(page.getByText(/Modo testes: nenhuma pesquisa ou crédito descontado/)).toBeVisible();
  expect(calls.unified).toHaveLength(1);
  expect(calls.googleSeparate).toBe(0);
});
