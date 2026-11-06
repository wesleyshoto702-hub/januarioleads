import { expect, test } from "@playwright/test";

test("Buscar Leads demonstra todas as etapas automaticamente sem API real", async ({ page }) => {
  let supabaseCalls = 0;
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) supabaseCalls++;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? route.continue() : route.abort();
  });

  await page.goto("/#demonstracao");
  const demo = page.locator(".jl-demo-window");
  await expect(page.locator(".jl-hero-search")).toBeVisible();
  await expect(demo).toBeVisible();
  await expect(page.locator(".jl-hero-search .jl-demo-window")).toHaveCount(1);
  await expect(page.locator(".jl-demo-section")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: /Boas oportunidades começam/i })).toBeVisible();
  await expect(demo).toHaveAttribute("data-interactive", "true");
  await expect(demo).toHaveAttribute("data-playing", "true");
  await expect(demo.locator(".jl-search-animation-panel")).toBeVisible();
  await expect(demo.locator(".jl-demo-result")).toHaveCount(3);

  await page.getByRole("button", { name: "Clínicas", exact: true }).click();
  await expect(demo).toHaveAttribute("data-phase", "0");
  await expect(demo.getByText("Clínica Exemplo A")).toBeVisible();
  await expect(demo.getByText("Belo Horizonte · MG").first()).toBeVisible();

  await expect(demo).toHaveAttribute("data-phase", "2", { timeout: 8000 });
  await expect(demo.getByText("Resultados organizados")).toBeVisible();
  await expect(demo).toHaveAttribute("data-phase", "3", { timeout: 5000 });
  await expect(demo.getByText("No CRM · exemplo")).toBeVisible();
  expect(supabaseCalls).toBe(0);
});

test("Buscar Leads permite pausa, reinício e troca de segmento", async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? route.continue() : route.abort();
  });
  await page.goto("/#demonstracao");

  const demo = page.locator(".jl-demo-window");
  await expect(demo).toHaveAttribute("data-interactive", "true");
  await page.getByRole("button", { name: "Pausar animação da busca" }).click();
  await expect(demo).toHaveAttribute("data-playing", "false");
  const paused = await demo.getAttribute("data-phase");
  await page.waitForTimeout(2700);
  await expect(demo).toHaveAttribute("data-phase", String(paused));

  await page.getByRole("button", { name: "Academias", exact: true }).click();
  await expect(demo.getByText("Academia Exemplo A")).toBeVisible();
  await expect(demo).toHaveAttribute("data-phase", "0");
  await page.getByRole("button", { name: "Reiniciar animação da busca" }).click();
  await expect(demo).toHaveAttribute("data-playing", "true");
  await expect(demo).toHaveAttribute("data-phase", "0");
});

test("com movimento reduzido ambas as animações oferecem navegação manual", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? route.continue() : route.abort();
  });
  await page.goto("/#demonstracao");
  const demo = page.locator(".jl-demo-window");
  await expect(demo).toHaveAttribute("data-playing", "false");
  await expect(demo.getByRole("button", { name: "Reproduzir animação da busca" })).toBeDisabled();
  await expect(demo.getByText("Restaurante Exemplo A")).toBeVisible();
  await page.getByRole("button", { name: "Academias", exact: true }).click();
  await expect(demo.getByText("Academia Exemplo A")).toBeVisible();
  await expect(page.locator(".jl-tour-stage")).toHaveAttribute("data-reduced", "true");
});
