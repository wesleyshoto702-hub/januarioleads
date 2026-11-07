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
  await expect(page.getByRole("heading", { name: "Cadastro solicitado" })).toBeVisible();
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


test("Google não configurado mostra orientação sem redirecionar e sem autenticar", async ({ page }) => {
  await page.route("**/*.supabase.co/**", (route) => {
    const u=new URL(route.request().url());
    if(u.pathname==="/auth/v1/settings"){
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({external:{google:false}})});
    }
    return route.abort();
  });
  await page.goto("/cadastro");
  await page.getByRole("button", { name:"Continuar com Google" }).click();
  await expect(page.getByRole("alert")).toContainText("não está ativado no Supabase");
  await expect(page).toHaveURL(/\/cadastro$/);
});

test("Google com identidade sem autorização de CRM bloqueia sessão após PKCE", async ({ page }) => {
  const id="22222222-2222-4222-8222-222222222222";
  const called:string[]=[];
  await page.route("**/*.supabase.co/**", (route) => {
    const url=new URL(route.request().url());
    called.push(url.pathname);
    if(url.pathname==="/auth/v1/settings"){
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({external:{google:true}})});
    }
    if(url.pathname==="/auth/v1/authorize"){
      expect(url.searchParams.get("provider")).toBe("google");
      expect(url.searchParams.get("flow_type")).toBe("pkce");
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      const redirect=new URL(url.searchParams.get("redirect_to")!);
      redirect.searchParams.set("code","00000000-0000-4000-8000-000000000001");
      return route.fulfill({status:302,headers:{Location:redirect.toString()}});
    }
    if(url.pathname==="/auth/v1/token"){
      expect(url.searchParams.get("grant_type")).toBe("pkce");
      const body=route.request().postDataJSON() as {code_verifier:string;auth_code:string};
      expect(body.code_verifier.length).toBeGreaterThan(43);
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({access_token:"auth-only-token",refresh_token:"auth-only-refresh",
          expires_in:3600,user:{id,email:"teste@example.invalid"}})});
    }
    if(url.pathname==="/auth/v1/user"){
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({id,email:"teste@example.invalid"})});
    }
    if(url.pathname==="/rest/v1/private_access"){
      return route.fulfill({status:200,contentType:"application/json",body:"[]"});
    }
    if(url.pathname==="/auth/v1/logout")return route.fulfill({status:204,body:""});
    return route.abort();
  });
  await page.goto("/cadastro");
  await page.getByRole("button", { name:"Continuar com Google" }).click();
  await expect(page.getByRole("heading",{name:"Acesso ainda não liberado"})).toBeVisible({timeout:12000});
  await expect(page.getByText(/O acesso ao CRM precisa ser liberado/)).toBeVisible();
  expect(called).toContain("/rest/v1/private_access");
  expect(await page.evaluate(()=>localStorage.getItem("januarioleads:auth-session"))).toBeNull();
});
