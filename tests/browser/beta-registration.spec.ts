import { expect, test } from "@playwright/test";

function localOnly(page: import("@playwright/test").Page, count: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    count();
    return route.abort();
  });
}

test("cadastro aceita somente Google, sem formulário de e-mail ou senha", async ({ page }) => {
  let external = 0;
  await localOnly(page, () => external++);
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { name: "Crie sua conta no Januário Leads" })).toBeVisible();
  await expect(page.getByText("Seu e-mail, confirmado pelo Google.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar conta com Google" })).toBeEnabled();
  await expect(page.locator('input[type="email"],input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  await expect(page.locator(".jl-signup-page .jl-aurora-canvas")).toBeVisible();
  expect(external).toBe(0);
});

test("cadastro mantém aurora e não gera overflow no celular", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await localOnly(page, () => {});
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".jl-aurora-canvas")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test("Google não configurado informa o problema e não tenta cadastro por e-mail", async ({ page }) => {
  const called: string[] = [];
  await page.route("**/*.supabase.co/**", (route) => {
    const url = new URL(route.request().url());
    called.push(url.pathname);
    if (url.pathname === "/auth/v1/settings") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ external: { google: false } }),
      });
    }
    return route.abort();
  });
  await page.goto("/cadastro");
  await page.getByRole("button", { name: "Criar conta com Google" }).click();
  await expect(page.getByRole("alert")).toContainText("não está ativado no Supabase");
  expect(called).toEqual(["/auth/v1/settings"]);
  await expect(page).toHaveURL(/\/cadastro$/);
});

test("conta Google confirmada e sem private_access não ganha acesso ao CRM", async ({ page }) => {
  const id = "22222222-2222-4222-8222-222222222222";
  const called: string[] = [];
  await page.route("**/*.supabase.co/**", (route) => {
    const url = new URL(route.request().url());
    called.push(url.pathname);
    if (url.pathname === "/auth/v1/settings") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ external: { google: true } }),
      });
    }
    if (url.pathname === "/auth/v1/authorize") {
      expect(url.searchParams.get("provider")).toBe("google");
      expect(url.searchParams.get("flow_type")).toBe("pkce");
      expect(url.searchParams.get("code_challenge_method")).toBe("s256");
      const redirect = new URL(url.searchParams.get("redirect_to")!);
      redirect.searchParams.set("code", "00000000-0000-4000-8000-000000000001");
      return route.fulfill({ status: 302, headers: { Location: redirect.toString() } });
    }
    if (url.pathname === "/auth/v1/token") {
      expect(url.searchParams.get("grant_type")).toBe("pkce");
      const body = route.request().postDataJSON() as { code_verifier: string };
      expect(body.code_verifier.length).toBeGreaterThanOrEqual(43);
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          access_token: "test-google-token",
          refresh_token: "test-google-refresh",
          expires_in: 3600,
          user: { id, email: "teste@gmail.com" },
        }),
      });
    }
    if (url.pathname === "/auth/v1/user") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          id, email: "teste@gmail.com",
          email_confirmed_at: "2026-11-07T12:00:00Z",
          app_metadata: { provider: "google", providers: ["google"] },
          identities: [{ provider: "google" }],
        }),
      });
    }
    if (url.pathname === "/rest/v1/private_access") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (url.pathname === "/auth/v1/logout") {
      return route.fulfill({ status: 204, body: "" });
    }
    return route.abort();
  });
  await page.goto("/cadastro");
  await page.getByRole("button", { name: "Criar conta com Google" }).click();
  await expect(page.getByRole("heading", { name: "Acesso ainda não liberado" })).toBeVisible({ timeout: 12000 });
  await expect(page.getByText(/Conta Google verificada/)).toBeVisible();
  expect(called).toContain("/rest/v1/private_access");
  expect(called).not.toContain("/auth/v1/signup");
  expect(await page.evaluate(() => localStorage.getItem("januarioleads:auth-session"))).toBeNull();
});

test("token sem identidade Google confirmada é recusado antes da autorização", async ({ page }) => {
  const id = "22222222-2222-4222-8222-222222222222";
  const called: string[] = [];
  await page.route("**/*.supabase.co/**", (route) => {
    const url = new URL(route.request().url());
    called.push(url.pathname);
    if (url.pathname === "/auth/v1/settings") {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ external: { google: true } }) });
    }
    if (url.pathname === "/auth/v1/authorize") {
      const redirect = new URL(url.searchParams.get("redirect_to")!);
      redirect.searchParams.set("code", "00000000-0000-4000-8000-000000000001");
      return route.fulfill({ status: 302, headers: { Location: redirect.toString() } });
    }
    if (url.pathname === "/auth/v1/token") {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ access_token: "unverified-token", refresh_token: "unverified-refresh",
          expires_in: 3600, user: { id, email: "naoverificado@example.invalid" } }) });
    }
    if (url.pathname === "/auth/v1/user") {
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ id, email: "naoverificado@example.invalid",
          email_confirmed_at: null, app_metadata: { provider: "email", providers: ["email"] } }) });
    }
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
    return route.abort();
  });
  await page.goto("/cadastro");
  await page.getByRole("button", { name: "Criar conta com Google" }).click();
  await expect(page.getByRole("heading", { name: "Acesso ainda não liberado" })).toBeVisible({ timeout: 12000 });
  await expect(page.getByText(/não apresentou um e-mail confirmado/)).toBeVisible();
  expect(called).not.toContain("/rest/v1/private_access");
  expect(await page.evaluate(() => localStorage.getItem("januarioleads:auth-session"))).toBeNull();
});
