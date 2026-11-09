import { expect, test } from "@playwright/test";

function isolatePublicPage(page: import("@playwright/test").Page, count: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) count();
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue() : route.abort();
  });
}

test("homepage tem Criar conta à esquerda de Acessar conta e mantém o hero enxuto", async ({ page }) => {
  let supabaseCalls = 0;
  await isolatePublicPage(page, () => supabaseCalls++);
  await page.goto("/");
  await expect(page.locator(".jl-hero-ctas")).toHaveCount(0);
  await expect(page.locator(".jl-demo-bottom").getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  const actions = page.locator(".jl-header-actions");
  await expect(actions.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
  await expect(actions.getByRole("button", { name: "Acessar conta" })).toBeVisible();
  expect(await actions.locator(".jl-button-small").allTextContents()).toEqual(["Criar conta", "Acessar conta"]);
  await expect(page.getByRole("heading", { name: /Como funciona o Januário Leads/i })).toBeVisible();
  await expect(page.getByText(/Lavras[·,/ ]+MG/i)).toHaveCount(0);
  expect(supabaseCalls).toBe(0);
});

test("Acessar conta mostra escolha central, sem presumir existência da conta", async ({ page }) => {
  let supabaseCalls = 0;
  await isolatePublicPage(page, () => supabaseCalls++);
  await page.goto("/");
  await page.locator(".jl-header-actions").getByRole("button", { name: "Acessar conta" }).click();
  const dialog = page.getByRole("dialog", { name: "Você já possui uma conta?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
  await expect(dialog.getByRole("link", { name: /Já tenho conta/ })).toHaveAttribute("href", "/login");
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.locator(".jl-header-actions").getByRole("button", { name: "Acessar conta" }).click();
  await dialog.getByRole("link", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "true");
  expect(supabaseCalls).toBe(0);
});

test("aviso permite que quem já tem conta entre normalmente", async ({ page }) => {
  await isolatePublicPage(page, () => {});
  await page.goto("/");
  await page.locator(".jl-header-actions").getByRole("button", { name: "Acessar conta" }).click();
  await page.getByRole("dialog", { name: "Você já possui uma conta?" })
    .getByRole("link", { name: /Já tenho conta/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("tab", { name: "Entrar" })).toHaveAttribute("aria-selected", "true");
});

test("navegação por âncoras usa rolagem suave e respeita movimento reduzido", async ({ page }) => {
  await isolatePublicPage(page, () => {});
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("smooth");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByRole("link", { name: "Perguntas" }).click();
  await expect(page).toHaveURL(/#duvidas$/);
  await expect.poll(() => page.evaluate(() => {
    const heading = document.getElementById("duvidas");
    return heading ? Math.round(heading.getBoundingClientRect().top) : -999;
  })).toBeLessThan(150);
  expect(await page.locator("#duvidas").evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(60);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("módulos interativos não repetem o grid antigo e exibem recursos reais", async ({ page }) => {
  await isolatePublicPage(page, () => {});
  await page.goto("/#recursos");
  await expect(page.locator(".jl-feature-grid")).toHaveCount(0);
  const modules = page.getByRole("group", { name: "Módulos da plataforma" });
  await expect(modules.getByRole("button")).toHaveCount(6);
  await modules.getByRole("button", { name: /Oportunidades/i }).click();
  await expect(page.getByRole("region", { name: /Oportunidades/i }).getByText(/Identifique regiões e segmentos com sinais de oportunidade/)).toBeVisible();
  await modules.getByRole("button", { name: /Mensagens/i }).click();
  await expect(page.getByRole("region", { name: /Mensagens/i }).getByText(/O envio é manual/)).toBeVisible();
});

test("perfis comerciais mudam o conteúdo da seção sem atualizar a página", async ({ page }) => {
  await isolatePublicPage(page, () => {});
  await page.goto("/#para-quem");
  const group = page.getByRole("group", { name: "Perfis de profissionais" });
  const button = group.getByRole("button", { name: /Profissionais de vendas/i });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Uma carteira que acompanha seu processo de venda/)).toBeVisible();
  await group.getByRole("button", { name: /Consultores e prestadores/i }).click();
  await expect(page.getByText(/Menos informações soltas/)).toBeVisible();
});

test("mensagem editável não exibe rotulagem de conteúdo fictício", async ({ page }) => {
  await isolatePublicPage(page, () => {});
  await page.goto("/#recursos");
  const demo = page.locator(".jl-message-card");
  await expect(demo.getByText("Mensagens personalizáveis")).toBeVisible();
  await expect(demo.getByRole("button", { name: /Copiar mensagem/ })).toBeVisible();
  await expect(demo.getByText("Exemplo fictício")).toHaveCount(0);
  await expect(demo.getByText("Sem envio automático")).toBeVisible();
});

test("login e cadastro compartilham um único cartão carmesim com abas locais", async ({ page }) => {
  let supabaseCalls = 0;
  await isolatePublicPage(page, () => supabaseCalls++);
  await page.goto("/login");

  const card = page.locator(".jl-signup-card");
  await expect(card).toHaveCount(1);
  await expect(page.locator(".jl-auth-main, .jl-auth-story, .jl-auth-form-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Acesse seu espaço de trabalho." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Entrar" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "false");
  await expect(card.locator('input[type="email"]')).toBeVisible();
  await expect(card.locator('input[type="password"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Continuar com Google" })).toHaveCount(0);

  const originalUrl = page.url();
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Crie sua conta no Januário Leads" })).toBeVisible();
  await expect(card.locator('input[type="password"]')).toHaveCount(2);
  await expect(page.getByPlaceholder("Seu nome completo")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "true");
  expect(page.url()).toBe(originalUrl);

  await page.getByRole("tab", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Acesse seu espaço de trabalho." })).toBeVisible();
  await expect(card.locator('input[type="password"]')).toHaveCount(1);
  expect(page.url()).toBe(originalUrl);
  expect(supabaseCalls).toBe(0);
});

test("a identidade do cadastro não exibe ícones de logotipo nem cadeado no badge", async ({ page }) => {
  await isolatePublicPage(page, () => {});
  await page.goto("/cadastro");
  await expect(page.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Crie sua conta no Januário Leads" })).toBeVisible();
  await expect(page.locator(".jl-signup-brand")).toContainText("Januário");
  await expect(page.locator(".jl-signup-brand svg, .jl-signup-brand-mark")).toHaveCount(0);
  await expect(page.locator(".jl-signup-safe-badge")).toContainText("PROSPECÇÃO ORGANIZADA");
  await expect(page.locator(".jl-signup-safe-badge svg")).toHaveCount(0);
  await expect(page.locator(".jl-auth-main, .jl-auth-story")).toHaveCount(0);
});

for (const width of [360, 390, 768, 1280]) {
  test("nova identidade não gera overflow na largura " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await isolatePublicPage(page, () => {});
    for (const route of ["/", "/login", "/cadastro"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasOverflow, "Overflow na rota " + route).toBe(false);
    }
  });
}

test("Entrar e Criar conta não exibem seta de avanço no botão principal", async ({ page }) => {
  await isolatePublicPage(page, () => {});
  await page.goto("/login");
  const submit = page.locator(".jl-signup-form .jl-signup-primary");
  await expect(submit).toBeVisible();
  await expect(submit.locator("svg.lucide-arrow-right")).toHaveCount(0);
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await expect(submit).toContainText("Criar conta");
  await expect(submit.locator("svg.lucide-arrow-right")).toHaveCount(0);
});


for (const width of [320, 360, 390, 430, 620]) {
  test(`Criar conta permanece visível no cabeçalho mobile a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await isolatePublicPage(page, () => {});
    await page.goto("/");
    const actions = page.locator(".jl-header-actions");
    const signup = actions.getByRole("link", { name: "Criar conta" });
    const login = actions.getByRole("button", { name: "Acessar conta" });
    await expect(signup).toBeVisible();
    await expect(login).toBeVisible();
    await expect(signup).toHaveAttribute("href", "/cadastro");

    const positions = await actions.evaluate((element) => {
      const signupRect = element.querySelector(".jl-header-signup")?.getBoundingClientRect();
      const loginRect = element.querySelector(".jl-header-login")?.getBoundingClientRect();
      return signupRect && loginRect ? {
        signupRight: signupRect.right,
        loginLeft: loginRect.left,
        signupBottom: signupRect.bottom,
        loginTop: loginRect.top,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      } : null;
    });
    expect(positions).not.toBeNull();
    expect(positions!.signupRight).toBeLessThanOrEqual(positions!.loginLeft);
    expect(positions!.signupBottom).toBeGreaterThan(positions!.loginTop);
    expect(positions!.pageWidth).toBeLessThanOrEqual(positions!.viewportWidth);

    await signup.click();
    await expect(page).toHaveURL(/\/cadastro$/);
    await expect(page.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "true");
  });
}
