import { expect, test } from "@playwright/test";

function blockExternal(page: import("@playwright/test").Page, onSupabase?: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) onSupabase?.();
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
}

test("home publica apresenta os planos em preparação sem consultar Supabase ou ativar checkout", async ({ page }) => {
  let supabaseRequests = 0;
  await blockExternal(page, () => { supabaseRequests++; });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Boas oportunidades começam com uma busca direcionada/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Cada módulo com um papel no seu processo/ })).toBeVisible();
  await expect(page.getByText(/Prévia animada · nenhum dado real/i)).toBeVisible();
  await expect(page.locator(".jl-hero-search .jl-demo-window")).toBeVisible();
  await expect(page.locator(".jl-marketing-briefing")).toHaveCount(0);
  await expect(page.locator(".jl-access, .jl-bottom-cta")).toHaveCount(0);
  await expect(page.getByText(/Acesso atual por convite/i)).toHaveCount(0);
  await expect(page.locator(".jl-header-actions").getByRole("button", { name: "Acessar conta" })).toBeVisible();
  await expect(page.getByRole("button", { name: /cadastrar|assinar|pagar/i })).toHaveCount(0);
  expect(supabaseRequests).toBe(0);

  await expect(page.locator(".jl-demo-window")).toHaveAttribute("data-interactive", "true");
  const clinicas = page.getByRole("button", { name: "Clínicas", exact: true });
  await expect(clinicas).toBeEnabled();
  await clinicas.click();
  await expect(clinicas).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Clínica Exemplo A")).toBeVisible();
  await expect(page.getByText("Restaurante Exemplo A")).toHaveCount(0);
  await expect(page.getByText("Belo Horizonte · MG").first()).toBeVisible();
  expect(supabaseRequests).toBe(0);

  await page.locator(".jl-header-actions").getByRole("button", { name: "Acessar conta" }).click();
  const dialog = page.getByRole("dialog", { name: "Você já possui uma conta?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: /Já tenho conta/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
  await page.getByRole("link", { name: /Voltar ao Januário Leads/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("FAQ explica funcionamento das mensagens sem prometer automação", async ({ page }) => {
  await blockExternal(page);
  await page.goto("/");
  const faq = page.locator(".jl-faq-item").filter({ hasText: "O sistema envia mensagens automaticamente?" });
  await faq.locator("summary").click();
  await expect(faq.getByText(/O envio da abordagem continua sob seu controle/)).toBeVisible();
});

test("rota antiga /produto segue funcionando como pagina informativa", async ({ page }) => {
  await blockExternal(page);
  await page.goto("/produto");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".jl-hero-search .jl-demo-window")).toBeVisible();
  await expect(page.locator(".jl-header-actions").getByRole("button", { name: "Acessar conta" })).toBeVisible();
});

for (const width of [360, 390, 768, 1280]) {
  test("home responsiva sem overflow horizontal em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await blockExternal(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".jl-hero-search .jl-demo-window")).toBeVisible();
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasOverflow).toBe(false);
  });
}


test("planos Free Pro Advanced substituem o comparativo e respeitam preços e limites", async ({ page }) => {
  await blockExternal(page);
  await page.goto("/#planos");
  const section = page.getByRole("region", { name: /Um plano para cada ritmo de prospecção/i });
  const cards = section.locator(".jl-pricing-card");
  await expect(cards).toHaveCount(3);
  const expected = [
    { name: "Free", price: "R$ 0,00", limit: "5 novos leads por dia" },
    { name: "Pro", price: "R$ 14,90", limit: "25 novos leads por dia" },
    { name: "Advanced", price: "R$ 29,90", limit: "70 novos leads por dia" },
  ] as const;
  for (let index = 0; index < expected.length; index++) {
    const plan = cards.nth(index);
    await expect(plan.getByRole("heading", { level: 3 })).toHaveText(expected[index].name);
    await expect(plan.locator(".jl-pricing-price")).toContainText(expected[index].price);
    await expect(plan.getByText(expected[index].limit, { exact: true })).toBeVisible();
    await expect(plan.getByRole("link")).toHaveAttribute("href", "/cadastro");
  }
  await expect(cards.nth(1).getByText("Recomendado", { exact: true })).toBeVisible();
  await expect(cards.nth(0).getByText("Recomendado", { exact: true })).toHaveCount(0);
  await expect(cards.nth(2).getByText("Recomendado", { exact: true })).toHaveCount(0);
  await expect(section.getByText(/não contrata uma assinatura nem realiza cobrança/i)).toBeVisible();
  await expect(page.getByText("Prospecção manual", { exact: true })).toHaveCount(0);

  // Consistência com o visual vermelho da marca, incluindo a Aurora original.
  await expect(page.locator(".jl-aurora-canvas")).toBeVisible();
  await expect(section.locator(".jl-pricing-cta-arrow")).toHaveCount(0);
  for (const cta of await section.locator(".jl-pricing-cta").all()) {
    await expect(cta).not.toContainText("↗");
  }
  const sectionBackground = await section.evaluate((element) =>
    getComputedStyle(element).backgroundImage);
  expect(sectionBackground).toMatch(/226,\\s*37,\\s*79/);
  const proButtonBackground = await cards.nth(1).locator(".jl-pricing-cta")
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(proButtonBackground).toMatch(/222,\\s*48,\\s*79/);
});

for (const width of [320, 360, 390, 768, 900, 1280]) {
  test("cards de planos aparecem sem overflow horizontal em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await blockExternal(page);
    await page.goto("/#planos");
    const cards = page.locator(".jl-pricing-card");
    await expect(cards).toHaveCount(3);
    for (const card of await cards.all()) {
      await expect(card.getByRole("link")).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      .toBe(false);
  });
}

test("animação dos botões respeita preferência de movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await blockExternal(page);
  await page.goto("/#planos");
  const transition = await page.locator(".jl-pricing-card--pro .jl-pricing-cta")
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transition.split(",").every((duration) => parseFloat(duration) === 0)).toBe(true);
});
