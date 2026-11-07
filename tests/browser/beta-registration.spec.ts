import { expect, test } from "@playwright/test";

const baseUrl = "https://czkazbianiflhldenhcj.supabase.co";
function blockExceptLocal(page: import("@playwright/test").Page, onExternal: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1","localhost"].includes(url.hostname)) return route.continue();
    onExternal();
    return route.abort();
  });
}

test("cadastro carmesim usa aurora real e formulário completo sem requisições durante a visita", async ({ page }) => {
  let externalCalls = 0;
  await blockExceptLocal(page,()=>externalCalls++);
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { name: "Crie sua conta no Januário Leads" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  for(const label of ["Nome","E-mail","Senha","Confirmar senha"]) {
    await expect(page.getByRole("textbox", { name: label, exact: true }).or(
      page.getByLabel(label,{exact:false}).first(),
    )).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
  await expect(page.locator(".jl-signup-page .jl-aurora-canvas")).toBeVisible();
  await expect(page.locator(".jl-signup-card")).toBeVisible();
  expect(externalCalls).toBe(0);
});

test("não envia cadastro quando as senhas diferem", async ({ page }) => {
  let external = 0;
  await blockExceptLocal(page,()=>external++);
  await page.goto("/cadastro");
  await page.getByPlaceholder("Seu nome completo").fill("Teste Pessoa");
  await page.getByPlaceholder("seuemail@empresa.com").fill("teste@example.invalid");
  await page.getByPlaceholder("Crie uma senha forte").fill("Senha-segura-teste-123");
  await page.getByPlaceholder("Repita sua senha").fill("Outra-senha-teste-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("alert")).toContainText("As senhas não coincidem");
  expect(external).toBe(0);
});

test("criação real de identidade usa somente Supabase Auth, nunca libera CRM automaticamente", async ({ page }) => {
  const called: string[] = [];
  await page.route("**/*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    called.push(url.pathname);
    if (url.pathname === "/auth/v1/signup") {
      expect(url.origin).toBe(baseUrl);
      expect(url.searchParams.get("redirect_to")).toContain("/login");
      const body = route.request().postDataJSON() as { email:string;password:string;data:{full_name:string} };
      expect(body.email).toBe("teste@example.invalid");
      expect(body.data.full_name).toBe("Teste Pessoa");
      expect(body.password.length).toBeGreaterThanOrEqual(12);
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({access_token:"fake-token-not-to-store",refresh_token:"fake-refresh"})});
    }
    return route.abort();
  });
  await page.goto("/cadastro");
  await page.getByPlaceholder("Seu nome completo").fill("Teste Pessoa");
  await page.getByPlaceholder("seuemail@empresa.com").fill("teste@example.invalid");
  await page.getByPlaceholder("Crie uma senha forte").fill("Senha-segura-teste-123");
  await page.getByPlaceholder("Repita sua senha").fill("Senha-segura-teste-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  expect(called).toEqual(["/auth/v1/signup"]);
  expect(await page.evaluate(() => localStorage.getItem("januarioleads:auth-session"))).toBeNull();
  await expect(page.getByRole("link",{name:/Ir para acessar conta/})).toHaveAttribute("href","/login");
});

test("cadastro mantém alinhamento e não gera rolagem horizontal em celular", async ({ page }) => {
  await page.setViewportSize({width:360,height:780});
  await blockExceptLocal(page,()=>{});
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".jl-aurora-canvas")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
});
