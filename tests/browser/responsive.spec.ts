import { expect, test, type Page } from "@playwright/test";

// These browser checks use fictional accounts only. They never contact
// production Supabase, Google Places, OpenAI or WhatsApp.
const USER_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_LEAD = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  user_id: USER_ID,
  company: "Empresa de Teste com Nome Comprido para Responsividade",
  segment: "Consultoria Comercial",
  phone: "35999999999",
  status: "waiting",
  first_contact: "2026-11-01",
  last_contact: "2026-11-02",
  created_at: "2026-11-01T12:00:00.000Z",
  city: "Lavras",
  state: "MG",
  notes: "Observação de demonstração sem dados reais",
  source: "manual",
};

const NAVIGATION = [
  "Dashboard",
  "Meus Leads",
  "Buscar Leads",
  "Oportunidades",
  "Mensagens",
  "Financeiro",
] as const;

async function loginWithMockedSupabase(page: Page) {
  // Intercept everything from ONE handler: no route-order dependency and no
  // real production requests. Includes CORS preflights and optional local BFF.
  let signedIn = false;
  const trail: string[] = [];
  const headers = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS, DELETE",
    "Content-Type": "application/json",
  };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const local = url.hostname === "127.0.0.1";
    const isSupabase = url.hostname.endsWith(".supabase.co") ||
      (local && url.pathname.startsWith("/api/supabase/"));
    const session = local && url.pathname === "/api/session";

    if (isSupabase || session) {
      trail.push(method + " " + url.pathname);
      if (trail.length > 30) trail.shift();
      if (method === "OPTIONS") {
        return route.fulfill({status:204,headers});
      }
      if (session) {
        if (method === "POST") signedIn = true;
        if (method === "DELETE") signedIn = false;
        return route.fulfill({
          status: signedIn || method === "DELETE" ? 200 : 401,
          headers,
          body: JSON.stringify(signedIn ? {
            ok:true, user:{id:USER_ID,email:"fake@example.invalid"},
            expiresAt:Date.now()+3600_000,
          } : {ok:method==="DELETE"}),
        });
      }
      let data: unknown = [];
      if (url.pathname.endsWith("/auth/v1/token")) data = {
        access_token:"fictional-access",refresh_token:"fictional-refresh",
        expires_in:3600,user:{id:USER_ID,email:"fake@example.invalid"},
      };
      if (url.pathname.endsWith("/auth/v1/user")) data = {
        id:USER_ID,email:"fake@example.invalid",
      };
      if (url.pathname.endsWith("/rest/v1/private_access")) {
        data = [{user_id:USER_ID}];
      }
      if (url.pathname.endsWith("/rest/v1/leads")) {
        data = url.searchParams.get("offset")==="0" ? [DEMO_LEAD] : [];
      }
      return route.fulfill({
        status:200,headers,body:JSON.stringify(data),
      });
    }
    if (local) return route.continue();
    return route.abort("blockedbyclient");
  });
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("fake@example.invalid");
  await page.getByPlaceholder("Sua senha").fill("fictional-test-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  try {
    await expect(page.locator(".saas-shell")).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      title:document.title,
      text:document.body.innerText.slice(0,850),
      location:location.pathname,
    }));
    throw new Error("CRM workspace did not appear after mocked login: " +
      JSON.stringify({diagnostics,mockedRequests:trail}), {cause:error});
  }
}

async function navigateTo(page: Page, view: string, mobile: boolean) {
  if (mobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu principal" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: view, exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.locator(".saas-mobile-title strong")).toHaveText(view);
  } else {
    const sidebar = page.locator(".saas-sidebar");
    await sidebar.getByRole("button", { name: view, exact: true }).click();
    await expect(sidebar.getByRole("button", { name: view, exact: true })).toHaveAttribute("aria-current", "page");
  }
  await expect(page.locator(".saas-main h1").first()).toBeVisible();
}

async function assertNoPageOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const body = document.body;
    const offenders = Array.from(body.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.left < viewport &&
          bounds.right > viewport + 1 && style.position !== "fixed";
      })
      .slice(0, 7)
      .map((element) => ({
        tag: element.tagName,
        className: typeof element.className === "string" ? element.className.slice(0, 95) : "",
        right: Math.ceil(element.getBoundingClientRect().right),
      }));
    return {
      viewport,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: body.scrollWidth,
      offenders,
    };
  });
  expect(
    Math.max(metrics.documentWidth, metrics.bodyWidth),
    `${label}: unwanted horizontal overflow: ${JSON.stringify(metrics)}`,
  ).toBeLessThanOrEqual(metrics.viewport + 1);
}

for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
  test(`responsive navigation, content and no horizontal page overflow at ${width}px`, async ({ page }) => {
    test.setTimeout(150_000);
    const mobile = width <= 900;
    await page.setViewportSize({ width, height: mobile ? 844 : 900 });
    await loginWithMockedSupabase(page);
    await assertNoPageOverflow(page, `${width}px after login`);

    for (const view of NAVIGATION) {
      await navigateTo(page, view, mobile);
      await assertNoPageOverflow(page, `${width}px / ${view}`);
      if (view === "Dashboard") {
        // Keep one browser screenshot per resolution for visual QA.
        await page.screenshot({
          path: `test-results/responsive/${width}-dashboard.png`,
          fullPage: false,
        });
      }
    }
  });
}

test("Abertos Agora appears only inside Buscar Leads, never as a Workspace navigation item", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginWithMockedSupabase(page);

  await page.getByRole("button", { name: "Abrir menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu principal" });
  await expect(drawer.getByRole("button", { name: "Abertos Agora", exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Buscar Leads", exact: true })).toBeVisible();

  await drawer.getByRole("button", { name: "Buscar Leads", exact: true }).click();
  await expect(page.locator(".search-leads-page")).toBeVisible();
  await expect(page.locator(".search-mode-panel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buscar leads", exact: true })).toBeVisible();
});

test("small portrait: editable lead dialog remains within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await loginWithMockedSupabase(page);
  await navigateTo(page, "Meus Leads", true);
  await page.getByRole("button", { name: "Novo lead", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Novo lead", exact: true });
  await expect(modal).toBeVisible();
  const rect = await modal.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.width).toBeLessThanOrEqual(321);
  expect(rect!.x).toBeGreaterThanOrEqual(-1);
  await assertNoPageOverflow(page, "320px lead modal");
  await modal.getByRole("button", { name: "Fechar" }).click();
});

test("landscape phone: the drawer scrolls, closes with Escape and restores page scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await loginWithMockedSupabase(page);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu principal" });
  await expect(drawer).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await drawer.getByRole("button", { name: "Financeiro", exact: true }).scrollIntoViewIfNeeded();
  await expect(drawer.getByRole("button", { name: "Financeiro", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await assertNoPageOverflow(page, "landscape drawer closed");
});

test("phone: forms and navigation meet minimum comfortable touch sizes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginWithMockedSupabase(page);
  const menu = page.getByRole("button", { name: "Abrir menu" });
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);

  await navigateTo(page, "Mensagens", true);
  const tabs = page.getByRole("tablist", { name: "Tipo de mensagem" });
  await expect(tabs).toBeVisible();
  for (const tab of await tabs.getByRole("tab").all()) {
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await assertNoPageOverflow(page, "message category tabs at 390px");
});


test("SaaS visual refresh is visible: dashboard hero, KPI icons and styled active navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginWithMockedSupabase(page);
  const header = page.locator(".dashboard-view > .saas-page-header");
  await expect(header).toBeVisible();
  await expect(header.getByText("CENTRAL DE OPERAÇÕES")).toBeVisible();
  await expect(page.locator(".dashboard-metrics .saas-metric-icon")).toHaveCount(5);
  const style = await header.evaluate((node) => ({
    image: getComputedStyle(node).backgroundImage,
    radius: getComputedStyle(node).borderRadius,
  }));
  expect(style.image).toContain("gradient");
  expect(parseFloat(style.radius)).toBeGreaterThanOrEqual(15);
  const active = page.locator(".saas-sidebar .saas-nav-item.active");
  await expect(active).toBeVisible();
  const background = await active.evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(background).toContain("gradient");
});

for (const width of [320, 390, 1280]) {
  test(`search results and factual qualification stay legible at ${width}px`, async ({page}) => {
    test.setTimeout(150_000);
    const mobile = width <= 900;
    await page.setViewportSize({width,height:mobile?844:900});
    await loginWithMockedSupabase(page);
    // No real requests to IBGE or any paid provider: both responses are mocked.
    await page.route("**/api/v1/localidades/estados/*/municipios*",route=>
      route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify([{nome:"Lavras"}])}));
    let searchCalls=0;
    await page.route("**/functions/v1/search-places",route=>{
      searchCalls++;
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({ok:true,provider:"overture",nextPageToken:null,results:[
          {
            placeId:"overture:fixture-1",source:"overture",name:"Mercado Exemplo do Centro",
            primaryCategory:"grocery_store",categories:["grocery_store"],
            description:null,address:"Rua A, 123, Lavras, MG",neighborhood:null,
            city:"Lavras",state:"MG",phone:"(35) 99999-9999",internationalPhone:null,
            email:"contato.muito-comprido-para-teste-de-responsividade@mercadoexemplo.com.br",
            rating:null,reviewCount:null,isOpenNow:null,openingHours:[],
            website:null,instagram:null,
            instagramCandidates:[{url:"https://www.instagram.com/mercadoexemplo/",
              username:"mercadoexemplo",confidence:"medium",score:4,signals:["Diretório"],
              evidenceUrls:[]}],
            googleMapsUrl:null,businessStatus:"open",latitude:-21.2,longitude:-45.0,
          },
          {
            placeId:"overture:fixture-2",source:"overture",name:"Mercado com Site",
            primaryCategory:"grocery_store",categories:["grocery_store"],
            description:null,address:"Rua B, 45, Lavras, MG",neighborhood:null,
            city:"Lavras",state:"MG",phone:null,internationalPhone:null,email:null,
            rating:null,reviewCount:null,isOpenNow:null,openingHours:[],
            website:"https://mercadocomsite.example",instagram:null,
            instagramCandidates:[],googleMapsUrl:null,businessStatus:"open",
            latitude:-21.2,longitude:-45.0,
          },
        ]})});
    });
    await navigateTo(page,"Buscar Leads",mobile);
    await expect(page.locator(".search-location-help")).toContainText("Municípios oficiais do IBGE.");
    await page.getByRole("button",{name:"Mercado / Supermercado",exact:true}).click();
    await page.getByRole("button",{name:"Buscar leads",exact:true}).click();
    await expect(page.locator(".business-card")).toHaveCount(2);
    await expect(page.locator(".digital-opportunity-badge")).toHaveCount(2);
    await assertNoPageOverflow(page,`${width}px search results`);
    const filters=page.locator(".result-filters");
    await filters.getByRole("button",{name:"Sem site",exact:true}).click();
    await expect(page.locator(".business-card")).toHaveCount(1);
    await expect(page.locator(".business-card")).toContainText("Potencial para site");
    await filters.getByRole("button",{name:"Com e-mail",exact:true}).click();
    await expect(page.locator(".business-card")).toHaveCount(1);
    await expect(page.locator(".business-card")).toContainText("não verificado");
    await expect(page.locator(".business-card")).toContainText("Possível Instagram");
    expect(searchCalls).toBe(1);
    await page.getByRole("button",{name:"Ver empresa",exact:true}).first().click();
    const modal=page.getByRole("dialog",{name:"Mercado Exemplo do Centro"});
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("region",{name:"Análise de canais comerciais"})).toBeVisible();
    await assertNoPageOverflow(page,`${width}px search details`);
    const rect=await modal.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.width).toBeLessThanOrEqual(width+1);
  });
}

test("mobile favorite marker and filtered CRM wallet remain usable", async ({page}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({width:390,height:844});
  await loginWithMockedSupabase(page);
  await navigateTo(page,"Meus Leads",true);
  const original=page.getByRole("button",{
    name:/Adicionar aos favoritos: Empresa de Teste com Nome Comprido/
  }).first();
  await expect(original).toBeVisible();
  await original.click();
  await expect(page.getByRole("button",{
    name:/Remover dos favoritos: Empresa de Teste com Nome Comprido/
  }).first()).toHaveAttribute("aria-pressed","true");
  const controls=page.getByRole("group",{name:"Visualizar leads favoritos"});
  await controls.getByRole("button",{name:/Favoritos/}).click();
  await expect(controls.getByRole("button",{name:/Favoritos/})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".lead-card").filter({hasText:"Empresa de Teste com Nome Comprido"})).toBeVisible();
  await assertNoPageOverflow(page,"390px Meus Leads favorites");
  await controls.getByRole("button",{name:"Todos os leads"}).click();
  await expect(controls.getByRole("button",{name:"Todos os leads"})).toHaveAttribute("aria-pressed","true");

  // Check the main CRM modules without any paid provider calls.
  for(const view of ["Mensagens","Oportunidades","Dashboard"]) {
    await navigateTo(page,view,true);
    await assertNoPageOverflow(page,`390px ${view} after favorite change`);
  }
});
