import { expect, test } from "@playwright/test";

/** Public demos are self-contained and must never request production data. */
function interceptExternal(page: import("@playwright/test").Page, onSupabase: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) onSupabase();
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? route.continue()
      : route.abort();
  });
}

test("homepage abre tour de quatro etapas sem chamadas ao Supabase", async ({ page }) => {
  let supabaseCalls = 0;
  await interceptExternal(page, () => supabaseCalls++);
  await page.goto("/");

  await page.getByRole("link", { name: /Explorar o Januário Leads/i }).click();
  await expect(page).toHaveURL(/#tour$/);
  const tour = page.locator(".jl-tour-stage");
  await expect(tour).toBeVisible();
  await expect(page.locator(".jl-tour-step-button")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: /Veja o Januário Leads funcionando, etapa por etapa/i })).toBeVisible();
  await expect(page.getByText(/Demonstração fictícia, sem buscas, contas ou mensagens reais/i)).toBeVisible();
  expect(supabaseCalls).toBe(0);
});

test("tour navega manualmente por seleção, CRM e follow-up sem enviar mensagens", async ({ page }) => {
  await interceptExternal(page, () => { throw new Error("Supabase called"); });
  await page.goto("/#tour");
  const player = page.locator(".jl-tour-stage");

  await page.getByRole("button", { name: /02 Escolher leads/ }).click();
  await expect(player).toHaveAttribute("data-stage", "1");
  await expect(page.getByText("2 empresas selecionadas")).toBeVisible();
  await expect(page.getByText("Salvar no CRM")).toBeVisible();

  await page.getByRole("button", { name: /03 Organizar no CRM/ }).click();
  await expect(player).toHaveAttribute("data-stage", "2");
  await expect(page.locator(".jl-tour-crm-columns")).toBeVisible();
  await expect(page.locator(".jl-tour-crm-lead")).toHaveCount(3);

  await page.getByRole("button", { name: /04 Planejar follow-up/ }).click();
  await expect(player).toHaveAttribute("data-stage", "3");
  await expect(page.getByText(/Follow-up organizado · envio manual/)).toBeVisible();
  await expect(page.getByText(/Modelo de mensagem disponível para revisar e adaptar/)).toBeVisible();

  await page.getByRole("button", { name: "Reiniciar demonstração" }).click();
  await expect(player).toHaveAttribute("data-stage", "0");
  await expect(player).toHaveAttribute("data-playing", "false");
  await expect(page.locator(".jl-tour-search-grid")).toBeVisible();
});

test("tour avança automaticamente, pausa e permite reprodução", async ({ page }) => {
  await interceptExternal(page, () => { throw new Error("Supabase called"); });
  await page.goto("/");
  const player = page.locator(".jl-tour-stage");
  await page.bringToFront();
  await player.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  await expect(player).toHaveAttribute("data-interactive", "true");
  const debug = await player.evaluate((node) => ({
    documentVisibility: document.visibilityState,
    inViewport: node.getAttribute("data-in-viewport"),
    tabVisible: node.getAttribute("data-tab-visible"),
    wantsPlay: node.getAttribute("data-wants-play"),
    reduced: node.getAttribute("data-reduced"),
    rect: node.getBoundingClientRect().toJSON(),
    viewportHeight: window.innerHeight,
  }));
  await expect(player, JSON.stringify(debug)).toHaveAttribute("data-playing", "true");

  const stage = await player.getAttribute("data-stage");
  await expect.poll(() => player.getAttribute("data-stage"), { timeout: 8500 }).not.toBe(stage);

  await page.getByRole("button", { name: "Pausar demonstração" }).click();
  await expect(player).toHaveAttribute("data-playing", "false");
  await page.getByRole("button", { name: "Reproduzir demonstração" }).click();
  await expect(player).toHaveAttribute("data-playing", "true");
});

test("preferência de movimento reduzido impede autoplay mas mantém controles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await interceptExternal(page, () => { throw new Error("Supabase called"); });
  await page.goto("/#tour");
  const player = page.locator(".jl-tour-stage");
  await expect(player).toHaveAttribute("data-reduced", "true");
  await expect(player).toHaveAttribute("data-playing", "false");
  await expect(page.getByRole("button", { name: "Reproduzir demonstração" })).toBeDisabled();
  await page.getByRole("button", { name: /04 Planejar follow-up/ }).click();
  await expect(player).toHaveAttribute("data-stage", "3");
});

test("menu de celular abre, direciona para demonstração e fecha", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await interceptExternal(page, () => { throw new Error("Supabase called"); });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Abrir menu" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Fechar menu" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation", { name: "Navegação para celular" }).getByRole("link", { name: "Assistir demonstração" }).click();
  await expect(page).toHaveURL(/#tour$/);
  await expect(page.getByRole("navigation", { name: "Navegação para celular" })).toHaveCount(0);
});

for (const width of [360, 390, 768, 1280]) {
  test("tour sem rolagem horizontal na largura " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await interceptExternal(page, () => { throw new Error("Supabase called"); });
    await page.goto("/");
    const tour = page.locator(".jl-tour-stage");
    await tour.scrollIntoViewIfNeeded();
    await expect(tour).toBeVisible();
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )).toBe(false);
  });
}
