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
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.route("**/*.supabase.co/**", (route) => {
    const url = new URL(route.request().url());
    let data: unknown = [];
    if (url.pathname === "/auth/v1/token") {
      data = {
        access_token: "fictional-access",
        refresh_token: "fictional-refresh",
        expires_in: 3600,
        user: { id: USER_ID, email: "fake@example.invalid" },
      };
    }
    if (url.pathname === "/auth/v1/user") {
      data = { id: USER_ID, email: "fake@example.invalid" };
    }
    if (url.pathname === "/rest/v1/private_access") {
      data = [{ user_id: USER_ID }];
    }
    if (url.pathname === "/rest/v1/leads") {
      data = url.searchParams.get("offset") === "0" ? [DEMO_LEAD] : [];
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("fake@example.invalid");
  await page.getByPlaceholder("Sua senha").fill("fictional-test-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".saas-shell")).toBeVisible();
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
