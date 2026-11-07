import { expect, test } from "@playwright/test";

function blockExternal(page: import("@playwright/test").Page, onExternal: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1"].includes(url.hostname)) return route.continue();
    onExternal();
    return route.abort();
  });
}

test("cadastro por e-mail e senha mantém a aurora e não oferece login Google", async ({ page }) => {
  let outsideRequests = 0;
  await blockExternal(page, () => outsideRequests++);
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { name: "Crie sua conta no Januário Leads" })).toBeVisible();
  for (const placeholder of [
    "Seu nome completo", "seunome@gmail.com", "Crie uma senha forte", "Repita sua senha",
  ]) await expect(page.getByPlaceholder(placeholder)).toBeVisible();
  await expect(page.getByRole("button", { name: /Criar conta/ })).toBeEnabled();
  await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
  await expect(page.locator(".jl-signup-page .jl-aurora-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: /Google/i })).toHaveCount(0);
  expect(outsideRequests).toBe(0);
});

test("senhas diferentes não acionam o serviço de cadastro", async ({ page }) => {
  let calls = 0;
  await blockExternal(page, () => calls++);
  await page.goto("/cadastro");
  await page.getByPlaceholder("Seu nome completo").fill("Teste Pessoa");
  await page.getByPlaceholder("seunome@gmail.com").fill("teste@gmail.com");
  await page.getByPlaceholder("Crie uma senha forte").fill("Senha-segura-exemplo-123");
  await page.getByPlaceholder("Repita sua senha").fill("Senha-segura-exemplo-124");
  await page.getByRole("button", { name: /Criar conta/ }).click();
  await expect(page.getByRole("alert")).toContainText("As senhas não coincidem");
  expect(calls).toBe(0);
});

test("cadastro chama somente o endpoint Supabase Auth sem guardar tokens ou conceder CRM", async ({ page }) => {
  const paths: string[] = [];
  await page.route("**/*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    paths.push(url.pathname);
    if (url.pathname === "/auth/v1/signup") {
      expect(url.searchParams.get("redirect_to")).toContain("/login");
      const data = route.request().postDataJSON() as {
        email: string; password: string; data: { full_name: string };
      };
      expect(data.email).toBe("teste@gmail.com");
      expect(data.data.full_name).toBe("Teste Pessoa");
      expect(data.password.length).toBeGreaterThanOrEqual(12);
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ access_token: "must-not-store", refresh_token: "must-not-store" }),
      });
    }
    return route.abort();
  });
  await page.goto("/cadastro");
  await page.getByPlaceholder("Seu nome completo").fill("Teste Pessoa");
  await page.getByPlaceholder("seunome@gmail.com").fill("teste@gmail.com");
  await page.getByPlaceholder("Crie uma senha forte").fill("Senha-segura-exemplo-123");
  await page.getByPlaceholder("Repita sua senha").fill("Senha-segura-exemplo-123");
  await page.getByRole("button", { name: /Criar conta/ }).click();
  await expect(page.getByRole("heading", { name: "Cadastro solicitado" })).toBeVisible();
  await expect(page.getByText(/O acesso ao CRM depende de liberação separada/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar na minha conta" })).toBeVisible();
  expect(paths).toEqual(["/auth/v1/signup"]);
  expect(await page.evaluate(() => localStorage.getItem("januarioleads:auth-session"))).toBeNull();
});

test("erro do Supabase não revela se o e-mail já foi registrado", async ({ page }) => {
  await page.route("**/*.supabase.co/**", (route) => {
    return route.fulfill({
      status: 400, contentType: "application/json",
      body: JSON.stringify({ msg: "User already registered" }),
    });
  });
  await page.goto("/cadastro");
  await page.getByPlaceholder("Seu nome completo").fill("Teste Pessoa");
  await page.getByPlaceholder("seunome@gmail.com").fill("teste@gmail.com");
  await page.getByPlaceholder("Crie uma senha forte").fill("Senha-segura-exemplo-123");
  await page.getByPlaceholder("Repita sua senha").fill("Senha-segura-exemplo-123");
  await page.getByRole("button", { name: /Criar conta/ }).click();
  await expect(page.getByRole("alert")).toContainText("Não foi possível solicitar o cadastro");
  await expect(page.getByRole("alert")).not.toContainText("User already registered");
});

test("cadastro rejeita Outlook no próprio formulário, sem chamadas ao Supabase", async ({ page }) => {
  let calls = 0;
  await blockExternal(page, () => calls++);
  await page.goto("/cadastro");
  await page.getByPlaceholder("Seu nome completo").fill("Pessoa Teste");
  await page.getByPlaceholder("seunome@gmail.com").fill("pessoa@outlook.com");
  await page.getByPlaceholder("Crie uma senha forte").fill("Senha-segura-exemplo-123");
  await page.getByPlaceholder("Repita sua senha").fill("Senha-segura-exemplo-123");
  await page.getByRole("button", { name: /Criar conta/ }).click();
  await expect(page.getByRole("alert")).toContainText("@gmail.com");
  expect(calls).toBe(0);
});

test("cadastro em celular não produz overflow horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await blockExternal(page, () => {});
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".jl-aurora-canvas")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
});
