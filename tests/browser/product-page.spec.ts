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

test("home publica vende o produto sem consultar Supabase ou prometer planos", async ({ page }) => {
  let supabaseRequests = 0;
  await blockExternal(page, () => { supabaseRequests++; });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Boas oportunidades começam com contatos certos/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Cada módulo com um papel no seu processo/ })).toBeVisible();
  await expect(page.getByText(/Prévia animada · nenhum dado real/i)).toBeVisible();
  await expect(page.locator(".jl-hero-search .jl-demo-window")).toBeVisible();
  await expect(page.getByText(/Acesso atual por convite/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Já tenho acesso/i }).first()).toBeVisible();
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

  await page.getByRole("link", { name: /Já tenho acesso/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
  await page.getByRole("link", { name: /Conhecer a plataforma/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("FAQ deixa claro que assinaturas nao estao abertas", async ({ page }) => {
  await blockExternal(page);
  await page.goto("/");
  const faq = page.locator(".jl-faq-item").filter({ hasText: "Já posso contratar uma assinatura?" });
  await faq.locator("summary").click();
  await expect(faq.getByText(/Ainda não.*planos e a cobrança/)).toBeVisible();
});

test("rota antiga /produto segue funcionando como pagina informativa", async ({ page }) => {
  await blockExternal(page);
  await page.goto("/produto");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".jl-hero-search .jl-demo-window")).toBeVisible();
  await expect(page.locator(".jl-header-actions").getByRole("link", { name: "Criar conta" })).toBeVisible();
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
