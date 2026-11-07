import { expect, test } from "@playwright/test";

function isolatePublicPage(page: import("@playwright/test").Page, count: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) count();
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue() : route.abort();
  });
}

test("homepage tem CTA Acessar conta no cabeçalho e hero sem os dois botões", async ({ page }) => {
  let supabaseCalls = 0;
  await isolatePublicPage(page, () => supabaseCalls++);
  await page.goto("/");
  await expect(page.locator(".jl-hero-ctas")).toHaveCount(0);
  await expect(page.locator(".jl-demo-bottom").getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page.locator(".jl-header-actions").getByRole("link", { name: "Acessar conta" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("heading", { name: /Como funciona o Januário Leads/i })).toBeVisible();
  await expect(page.getByText(/Lavras[·,/ ]+MG/i)).toHaveCount(0);
  expect(supabaseCalls).toBe(0);
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

test("login público apresenta indisponibilidade de cadastro sem oferecer inscrição", async ({ page }) => {
  let supabaseCalls = 0;
  await isolatePublicPage(page, () => supabaseCalls++);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Um só lugar para descobrir/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Acesse seu espaço de trabalho/i })).toBeVisible();
  await expect(page.getByText(/Acesso para contas já autorizadas/)).toBeVisible();
  await expect(page.locator(".jl-auth-shell a[href='/cadastro']")).toHaveCount(0);
  expect(supabaseCalls).toBe(0);
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
