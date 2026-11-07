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

  await page.getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Como funciona" }).click();
  await expect(page).toHaveURL(/#tour$/);
  const tour = page.locator(".jl-tour-stage");
  await expect(tour).toBeVisible();
  await expect(page.locator(".jl-tour-step-indicator")).toHaveCount(4);
  await expect(page.locator(".jl-tour-step-buttons button")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Como funciona o Januário Leads\? Veja na prática/i })).toBeVisible();
  await expect(page.getByText(/Demonstração automática com dados simulados/i)).toBeVisible();
  expect(supabaseCalls).toBe(0);
});

test("tour não oferece pausa, reinício nem navegação manual", async ({ page }) => {
  await interceptExternal(page, () => { throw new Error("Supabase called"); });
  await page.goto("/#tour");
  const player = page.locator(".jl-tour-stage");
  const indicators = page.locator(".jl-tour-step-indicator");

  await expect(indicators).toHaveCount(4);
  await expect(indicators.nth(0)).toHaveAttribute("aria-current", "step");
  for (const label of ["Buscar empresas", "Escolher leads", "Organizar no CRM", "Planejar follow-up"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  await expect(page.locator(".jl-tour-play-controls, .jl-tour-arrow-controls")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pausar demonstração|Reproduzir demonstração|Reiniciar demonstração|Etapa anterior|Próxima etapa/i })).toHaveCount(0);
  await expect(player.getByRole("button")).toHaveCount(0);
  await expect(player).toHaveAttribute("data-stage", "0");
});

test("tour reproduz as quatro etapas automaticamente e retorna ao início", async ({ page }) => {
  test.setTimeout(30000);
  await interceptExternal(page, () => { throw new Error("Supabase called"); });
  await page.goto("/#tour");
  const player = page.locator(".jl-tour-stage");
  await page.bringToFront();
  await player.scrollIntoViewIfNeeded();
  await expect(player).toHaveAttribute("data-playing", "true");
  for (let next = 1; next <= 3; next++) {
    await expect(player).toHaveAttribute("data-stage", String(next), { timeout: 6500 });
    await expect(page.locator(".jl-tour-step-indicator").nth(next)).toHaveAttribute("aria-current", "step");
  }
  await expect(player).toHaveAttribute("data-stage", "0", { timeout: 6500 });
  await expect(page.locator(".jl-tour-search-grid")).toBeVisible();
});

test("preferência por movimento reduzido mantém a apresentação estática e legível", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await interceptExternal(page, () => { throw new Error("Supabase called"); });
  await page.goto("/#tour");
  const player = page.locator(".jl-tour-stage");
  await expect(player).toHaveAttribute("data-reduced", "true");
  await expect(player).toHaveAttribute("data-playing", "false");
  await expect(page.locator(".jl-tour-step-indicator")).toHaveCount(4);
  await expect(page.getByText(/Movimento reduzido ativado: o exemplo permanece estático/i)).toBeVisible();
  await expect(player).toHaveAttribute("data-stage", "0");
  await page.waitForTimeout(5100);
  await expect(player).toHaveAttribute("data-stage", "0");
  await expect(page.locator(".jl-tour-play-controls, .jl-tour-arrow-controls")).toHaveCount(0);
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


test("homepage apresenta etapas sem numeração decorativa no tour, busca e módulos", async ({ page }) => {
  await interceptExternal(page, () => { throw new Error("Supabase called"); });
  await page.goto("/");
  const titles = ["Buscar empresas", "Escolher leads", "Organizar no CRM", "Planejar follow-up"];
  const steps = page.locator(".jl-tour-step-buttons .jl-tour-step-indicator");
  await expect(steps).toHaveCount(4);
  for (let index = 0; index < titles.length; index++) {
    await expect(steps.nth(index)).toContainText(titles[index]!);
    await expect(steps.nth(index)).not.toContainText(/\b0[1-4]\b/);
  }
  await expect(page.locator(".jl-tour-step-number, .jl-module-visual-item small")).toHaveCount(0);
  await expect(page.locator(".jl-search-animation-label")).toHaveText("BUSCA ILUSTRATIVA");
  await expect(page.locator(".jl-tour-player-caption > span")).not.toContainText(/ETAPA \d+ DE \d+/);
  await expect(page.locator(".jl-module-eyebrow")).not.toContainText(/MÓDULO \d+ DE \d+/);
  await expect(page.locator(".jl-module-visual-item")).toHaveCount(3);
});
