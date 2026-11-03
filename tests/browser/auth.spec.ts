import { test, expect } from "@playwright/test";
const id = "11111111-1111-1111-1111-111111111111";
test.beforeEach(async ({ page }) => {
  // These tests must never call production, external APIs or paid services.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
});
test("anonymous visitor is redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
});
test("network failure allows retry instead of leaving login stuck", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("test@example.invalid");
  await page.getByPlaceholder("Sua senha").fill("test-only");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Não foi possível conectar.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
});
test("authorized login loads dashboard, leads and logout with mocked backend", async ({ page }) => {
  await page.route("**/*.supabase.co/**", (route) => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname === "/auth/v1/token")
      body = {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: 3600,
        user: { id, email: "test@example.invalid" },
      };
    if (url.pathname === "/auth/v1/user") body = { id, email: "test@example.invalid" };
    if (url.pathname === "/rest/v1/private_access") body = [{ user_id: id }];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("test@example.invalid");
  await page.getByPlaceholder("Sua senha").fill("test-only");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sair", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Meus Leads", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Meus Leads", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Novo lead", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Novo lead", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("januarioleads:auth-session"))).toBeNull();
});
