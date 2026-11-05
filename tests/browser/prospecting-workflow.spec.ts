import { expect, test, type Page } from "@playwright/test";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const LEAD_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WAITING_LEAD = {
  id: LEAD_ID,
  user_id: USER_ID,
  company: "Oficina Exemplo",
  segment: "Oficina",
  phone: "35999999999",
  status: "waiting",
  first_contact: "2026-11-01",
  last_contact: "2026-11-02",
  created_at: "2026-11-01T12:00:00.000Z",
  city: "Lavras",
  state: "MG",
  notes: "",
  source: "manual",
};

function business(placeId: string, name: string) {
  return {
    placeId,
    name,
    primaryCategory: "business",
    categories: ["business"],
    description: null,
    address: "Rua Exemplo 12, Lavras, MG",
    neighborhood: null,
    city: "Lavras",
    state: "MG",
    phone: "35999999999",
    internationalPhone: "+5535999999999",
    rating: 4.6,
    reviewCount: 10,
    isOpenNow: true,
    openingHours: [],
    website: null,
    instagram: null,
    googleMapsUrl: null,
    businessStatus: "OPERATIONAL",
    latitude: null,
    longitude: null,
  };
}

async function loginWithMocks(
  page: Page,
  options: {
    leads?: unknown[];
    onRequest?: (routeUrl: URL, method: string) => boolean | Promise<boolean>;
    onLeadWrite?: () => boolean;
  } = {},
) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.route("**/api/v1/localidades/estados/*/municipios*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ nome: "Lavras" }]),
    }),
  );
  await page.route("**/*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (await options.onRequest?.(url, route.request().method())) return;
    let data: unknown = [];
    if (url.pathname === "/auth/v1/token") {
      data = {
        access_token: "fake-access",
        refresh_token: "fake-refresh",
        expires_in: 3600,
        user: { id: USER_ID, email: "fake@example.invalid" },
      };
    } else if (url.pathname === "/auth/v1/user") {
      data = { id: USER_ID, email: "fake@example.invalid" };
    } else if (url.pathname === "/rest/v1/private_access") {
      data = [{ user_id: USER_ID }];
    } else if (url.pathname === "/rest/v1/leads") {
      if (route.request().method() === "POST") {
        const ok = options.onLeadWrite?.() ?? true;
        return route.fulfill({
          status: ok ? 201 : 503,
          contentType: "application/json",
          body: ok ? "[]" : '{"message":"simulated error"}',
        });
      }
      data = url.searchParams.get("offset") === "0" ? (options.leads ?? [WAITING_LEAD]) : [];
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("fake@example.invalid");
  await page.getByPlaceholder("Sua senha").fill("test-only");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".saas-shell")).toBeVisible();
}

test("WhatsApp handoff never marks a follow-up as sent until user confirmation", async ({ page }) => {
  let leadWrites = 0;
  await page.addInitScript(() => {
    // No real WhatsApp tab is opened. Simulate a successful popup handoff.
    window.open = (() => ({ opener: null })) as typeof window.open;
  });
  await loginWithMocks(page, { onLeadWrite: () => { leadWrites += 1; return true; } });

  await page.getByRole("button", { name: "Meus Leads", exact: true }).first().click();
  const row = page.locator(".desktop-table .table-row").filter({ hasText: "Oficina Exemplo" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Fazer follow-up" }).click();
  const modal = page.getByRole("dialog", { name: "Fazer follow-up" });
  await expect(modal.getByRole("button", { name: /Follow-up 1/ })).toBeVisible();

  await modal.getByRole("button", { name: "Abrir no WhatsApp" }).click();
  await expect(modal.getByRole("button", { name: "Confirmar envio" })).toBeVisible();
  await expect(modal.getByText("O JanuarioLeads não consegue verificar", { exact: false })).toBeVisible();
  expect(leadWrites, "Opening WhatsApp must not record contact or change status").toBe(0);

  await modal.getByRole("button", { name: "Não enviei" }).click();
  await expect(modal).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Fazer follow-up" })).toBeVisible();
  expect(leadWrites, "Cancelling the handoff must not change the lead").toBe(0);

  await row.getByRole("button", { name: "Fazer follow-up" }).click();
  const nextModal = page.getByRole("dialog", { name: "Fazer follow-up" });
  await nextModal.getByRole("button", { name: "Abrir no WhatsApp" }).click();
  await nextModal.getByRole("button", { name: "Confirmar envio" }).click();
  await expect(nextModal).toHaveCount(0);
  await expect(page.getByText("Follow-up confirmado para Oficina Exemplo.")).toBeVisible();
  expect(leadWrites, "Confirmed follow-up should persist to Supabase mock exactly once").toBe(1);
});

test("failed lead persistence keeps WhatsApp confirmation open for retry", async ({ page }) => {
  let leadWrites = 0;
  await page.addInitScript(() => {
    window.open = (() => ({ opener: null })) as typeof window.open;
  });
  await loginWithMocks(page, { onLeadWrite: () => { leadWrites += 1; return false; } });
  await page.getByRole("button", { name: "Meus Leads", exact: true }).first().click();
  await page.locator(".desktop-table .table-row").filter({ hasText: "Oficina Exemplo" })
    .getByRole("button", { name: "Fazer follow-up" }).click();
  const modal = page.getByRole("dialog", { name: "Fazer follow-up" });
  await modal.getByRole("button", { name: "Abrir no WhatsApp" }).click();
  await modal.getByRole("button", { name: "Confirmar envio" }).click();
  await expect(modal.getByText("não foi possível registrar o contato agora", { exact: false })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Confirmar envio" })).toBeEnabled();
  expect(leadWrites).toBe(1);
});

test("two competing recent searches keep only results from the newest request", async ({ page }) => {
  let firstRequestStarted = false;
  let releaseSlowSearch: (() => void) | undefined;
  const slowSearchDone = new Promise<void>((resolve) => { releaseSlowSearch = resolve; });

  await loginWithMocks(page, {
    onRequest: async (url, method) => {
      if (url.pathname !== "/functions/v1/search-places" || method !== "POST") return false;
      return false;
    },
    leads: [],
  });

  await page.evaluate((uid) => {
    localStorage.setItem(
      `januarioleads:workspace:v2:${uid}:leadflow:recent-searches`,
      JSON.stringify([
        { segment: "Restaurante", city: "Lavras", state: "MG" },
        { segment: "Barbearia", city: "Lavras", state: "MG" },
      ]),
    );
  }, USER_ID);

  await page.route("**/functions/v1/search-places", async (route) => {
    const request = route.request().postDataJSON() as { segment?: string };
    if (request.segment === "Restaurante") {
      firstRequestStarted = true;
      await slowSearchDone;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, results: [business("place-slow", "Empresa Antiga")], nextPageToken: null }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, results: [business("place-new", "Empresa Atual")], nextPageToken: null }),
    });
  });

  await page.getByRole("button", { name: "Buscar Leads", exact: true }).first().click();
  const recents = page.locator(".recent-searches");
  await expect(recents.getByRole("button", { name: /Restaurante/ })).toBeVisible();
  await recents.getByRole("button", { name: /Restaurante/ }).click();
  await expect.poll(() => firstRequestStarted).toBe(true);
  await recents.getByRole("button", { name: /Barbearia/ }).click();
  await expect(page.getByRole("heading", { name: "Barbearia", exact: true })).toBeVisible();
  await expect(page.getByText("Empresa Atual", { exact: true })).toBeVisible();

  releaseSlowSearch?.();
  await page.waitForTimeout(200);
  await expect(page.getByRole("heading", { name: "Barbearia", exact: true })).toBeVisible();
  await expect(page.getByText("Empresa Antiga", { exact: true })).toHaveCount(0);
});


test("Dashboard shows the CRM connection and recent leads, never an eight-hour Places promise", async ({ page }) => {
  await loginWithMocks(page);
  await expect(page.getByText("CRM conectado")).toBeVisible();
  await expect(page.locator(".dashboard-updates")).toContainText("Leads cadastrados recentemente");
  await expect(page.locator(".dashboard-updates")).toContainText("Oficina Exemplo");
  await expect(page.getByText("Sincronização ativa")).toHaveCount(0);
  await expect(page.getByText("A cada 8 horas")).toHaveCount(0);
});

test("Meus Leads keeps its commercial controls but removes the obsolete automatic sync panel", async ({ page }) => {
  await loginWithMocks(page);
  await page.getByRole("button", { name: "Meus Leads", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Meus Leads" })).toBeVisible();
  await expect(page.locator(".recent-updates-panel")).toHaveCount(0);
  await expect(page.locator(".desktop-table .table-row").filter({ hasText: "Oficina Exemplo" })).toBeVisible();
});

test("CRM ignores historical synchronization errors when loading relevant lead changes", async ({ page }) => {
  const updateRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/rest/v1/lead_updates")) {
      updateRequests.push(request.url());
    }
  });

  await loginWithMocks(page);
  await expect.poll(() => updateRequests.length).toBeGreaterThan(0);
  expect(updateRequests.every((url) =>
    new URL(url).searchParams.get("change_type") === "neq.sync_error",
  )).toBe(true);
});


test("Abertos Agora appears only after searching for companies in a niche", async ({ page }) => {
  await loginWithMocks(page);

  await page.evaluate((uid) => {
    localStorage.setItem(
      `januarioleads:workspace:v2:${uid}:leadflow:recent-searches`,
      JSON.stringify([{ segment: "Restaurante", city: "Lavras", state: "MG" }]),
    );
  }, USER_ID);

  await page.route("**/functions/v1/search-places", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        results: [{ ...business("place-test", "Restaurante Exemplo"), isOpenNow: true }],
        nextPageToken: null,
      }),
    });
  });

  const workspaceNav = page.locator(".saas-sidebar .saas-nav");
  await expect(workspaceNav.getByRole("button", { name: "Abertos Agora" })).toHaveCount(0);

  await workspaceNav.getByRole("button", { name: "Buscar Leads" }).click();
  await expect(page.locator(".search-leads-page")).toBeVisible();
  await expect(page.locator(".search-mode-panel")).toHaveCount(0);
  await expect(page.locator(".selection-bar")).toContainText("Buscar leads");

  await page.locator(".recent-searches").getByRole("button", { name: /Restaurante/ }).click();
  await expect(page.getByRole("heading", { name: "Restaurante", exact: true })).toBeVisible();
  await expect(page.locator(".search-mode-panel")).toBeVisible();
  await expect(page.locator(".search-mode-option").filter({ hasText: "Todas as empresas" }))
    .toHaveAttribute("aria-pressed", "true");

  await page.locator(".search-mode-option").filter({ hasText: "Abertos Agora" }).click();
  await expect(page.locator(".search-mode-option").filter({ hasText: "Abertos Agora" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(workspaceNav.getByRole("button", { name: "Buscar Leads" }))
    .toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Alterar busca" }).click();
  await expect(page.locator(".search-mode-panel")).toHaveCount(0);
  await expect(page.locator(".selection-bar")).toContainText("Buscar leads");

  // A new niche search should start in the 'Todas as empresas' mode.
  await page.locator(".recent-searches").getByRole("button", { name: /Restaurante/ }).click();
  await expect(page.locator(".search-mode-option").filter({ hasText: "Todas as empresas" }))
    .toHaveAttribute("aria-pressed", "true");
});

test("open-now filter preserves the same loaded companies and does not repeat the Google search", async ({ page }) => {
  await loginWithMocks(page, { leads: [] });
  await page.evaluate((uid) => {
    localStorage.setItem(
      `januarioleads:workspace:v2:${uid}:leadflow:recent-searches`,
      JSON.stringify([{ segment: "Restaurante", city: "Lavras", state: "MG" }]),
    );
  }, USER_ID);

  let searchRequests = 0;
  await page.route("**/functions/v1/search-places", async (route) => {
    searchRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        results: [
          { ...business("place-open", "Empresa Aberta"), isOpenNow: true },
          { ...business("place-closed", "Empresa Fechada"), isOpenNow: false },
          { ...business("place-unknown", "Horário Desconhecido"), isOpenNow: null },
        ],
        nextPageToken: null,
      }),
    });
  });

  await page.locator(".saas-sidebar .saas-nav-item").filter({ hasText: "Buscar Leads" }).click();
  await page.locator(".recent-searches").getByRole("button", { name: /Restaurante/ }).click();
  await expect(page.getByRole("heading", { name: "Restaurante", exact: true })).toBeVisible();
  await expect(page.getByText("Empresa Aberta", { exact: true })).toBeVisible();
  await expect(page.getByText("Empresa Fechada", { exact: true })).toBeVisible();
  await expect(page.getByText("Horário Desconhecido", { exact: true })).toBeVisible();
  expect(searchRequests).toBe(1);

  await page.locator(".search-mode-option").filter({ hasText: "Abertos Agora" }).click();
  await expect(page.getByText("Empresa Fechada", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Horário Desconhecido", { exact: true })).toHaveCount(0);
  await expect(page.locator(".search-mode-count")).toContainText("1 empresa marcada como aberta");
  expect(searchRequests).toBe(1);

  await page.locator(".search-mode-option").filter({ hasText: "Todas as empresas" }).click();
  await expect(page.getByText("Empresa Fechada", { exact: true })).toBeVisible();
  await expect(page.getByText("Horário Desconhecido", { exact: true })).toBeVisible();
  expect(searchRequests).toBe(1);

  await page.locator(".search-mode-option").filter({ hasText: "Abertos Agora" }).click();
  await expect(page.getByText("Empresa Fechada", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Empresa Aberta", { exact: true })).toBeVisible();
  await expect(page.locator(".saas-sidebar .saas-nav-item").filter({ hasText: "Buscar Leads" }))
    .toHaveAttribute("aria-current", "page");
  expect(searchRequests).toBe(1);
});
