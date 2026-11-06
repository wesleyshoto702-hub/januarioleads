import { expect, test } from "@playwright/test";

test("cadastro beta publico permanece fechado e nunca chama Auth em producao", async ({ page }) => {
  let externalCalls = 0;
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    if (url.hostname.endsWith(".supabase.co")) externalCalls++;
    return route.abort();
  });

  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { name: "Comece sua jornada com o Januário Leads." })).toBeVisible();
  await expect(page.getByText(/Cadastro público em preparação/i)).toBeVisible();
  await expect(page.getByText(/A criação de contas ainda não está aberta nesta versão/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /cadastrar no ambiente de teste/i })).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(externalCalls).toBe(0);

  await page.getByRole("link", { name: /Já tenho uma conta/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("home liga a pagina de beta sem prometer inscricoes abertas", async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.abort();
  });
  await page.goto("/");
  await page.locator(".jl-header-actions").getByRole("link", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByRole("heading", { name: /Comece sua jornada com o Januário Leads/ })).toBeVisible();
});

test("cadastro beta nao tem overflow em celular", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.abort();
  });
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 1,
  )).toBe(false);
});
