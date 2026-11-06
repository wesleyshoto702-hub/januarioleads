import { expect, test } from "@playwright/test";

async function forbidExternal(page: import("@playwright/test").Page) {
  let supabaseRequests = 0;
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) supabaseRequests++;
    return ["localhost", "127.0.0.1"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
  return () => supabaseRequests;
}

test("Buscar Leads ocupa o hero à direita, sem seção repetida, preservando o tour", async ({ page }) => {
  const network = await forbidExternal(page);
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto("/");
  const copy = page.locator(".jl-hero-copy");
  const heroAnimation = page.locator(".jl-hero-search");
  await expect(heroAnimation.locator(".jl-demo-window")).toHaveAttribute("data-interactive", "true");
  await expect(page.locator(".jl-demo-window")).toHaveCount(1);
  await expect(page.locator(".jl-demo-section")).toHaveCount(0);
  await expect(heroAnimation.getByText("Januário Leads / Buscar Leads")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Como funciona o Januário Leads/ })).toBeVisible();
  await expect(page.locator(".jl-tour-stage")).toBeVisible();
  const copyBox = await copy.boundingBox();
  const animatedBox = await heroAnimation.boundingBox();
  expect(copyBox).not.toBeNull();
  expect(animatedBox).not.toBeNull();
  expect(animatedBox!.x).toBeGreaterThan(copyBox!.x + copyBox!.width - 12);
  expect(network()).toBe(0);
});

for (const width of [360, 390, 768]) {
  test("Buscar Leads no hero fica abaixo do texto sem overflow em " + width + "px", async ({ page }) => {
    const network = await forbidExternal(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const heroAnimation = page.locator(".jl-hero-search");
    await expect(heroAnimation.locator(".jl-demo-window")).toHaveAttribute("data-interactive", "true");
    const copyBox = await page.locator(".jl-hero-copy").boundingBox();
    const animatedBox = await heroAnimation.boundingBox();
    expect(copyBox).not.toBeNull();
    expect(animatedBox).not.toBeNull();
    expect(animatedBox!.y).toBeGreaterThan(copyBox!.y + copyBox!.height - 5);
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )).toBe(false);
    expect(network()).toBe(0);
  });
}

test("link Buscar Leads no menu leva à única animação do topo", async ({ page }) => {
  await forbidExternal(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("navigation", { name: "Navegação para celular" })
    .getByRole("link", { name: "Buscar Leads" }).click();
  await expect(page).toHaveURL(/#demonstracao$/);
  await expect(page.locator(".jl-hero-search")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação para celular" })).toHaveCount(0);
});
