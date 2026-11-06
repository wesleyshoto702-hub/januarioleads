import { expect, test } from "@playwright/test";

test("apresentacao publica explica o produto sem solicitar login ou dados", async ({ page }) => {
  let supabaseRequests = 0;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) {
      supabaseRequests++;
      return route.abort();
    }
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return route.continue();
    }
    return route.abort();
  });

  await page.goto("/produto");

  await expect(
    page.getByRole("heading", { level: 1, name: /Encontre empresas/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Ferramentas para prospectar/ })).toBeVisible();
  await expect(page.getByText("Exemplo ilustrativo")).toBeVisible();
  await expect(page.getByText(/acesso ainda é concedido por convite/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /cadastrar|assinar|pagar/i })).toHaveCount(0);
  expect(supabaseRequests).toBe(0);

  await page.getByRole("link", { name: /Já tenho acesso/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
  await page.getByRole("link", { name: /Conhecer o JanuarioLeads/i }).click();
  await expect(page).toHaveURL(/\/produto$/);
});

test("apresentacao publica e acessivel em celular sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" || url.hostname === "localhost"
      ? route.continue()
      : route.abort();
  });

  await page.goto("/produto");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /Já tenho acesso/i })).toBeVisible();
  await expect(page.locator(".product-preview")).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
