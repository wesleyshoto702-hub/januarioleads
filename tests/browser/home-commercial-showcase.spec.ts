import { expect, test } from "@playwright/test";

async function openPublicHomepage(page: import("@playwright/test").Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname)
      ? route.continue() : route.abort();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
}

test("existing homepage reveals eight real commercial modules without a new section", async ({ page }) => {
  await openPublicHomepage(page);
  const section = page.locator("#recursos");
  const groups = section.getByRole("group", { name: "Grupos de funcionalidades" });
  const modules = section.getByRole("group", { name: "Módulos da plataforma" });

  await expect(groups.getByRole("button", { name: "Prospecção e CRM" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(modules.getByRole("button")).toHaveCount(6);
  await groups.getByRole("button", { name: "Gestão Comercial" }).click();
  await expect(groups.getByRole("button", { name: "Gestão Comercial" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(modules.getByRole("button")).toHaveCount(8);

  for (const name of ["Análise Digital", "Propostas", "Campanhas", "Sequências",
    "Agenda", "Objeções", "Projetos", "Metas"]) {
    await expect(modules.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
  await modules.getByRole("button", { name: /Análise Digital/ }).click();
  await expect(page.locator("#jl-module-panel")).toContainText("PageSpeed");
  await modules.getByRole("button", { name: /Propostas/ }).click();
  await expect(page.locator("#jl-module-panel")).toContainText("PDF");
  await modules.getByRole("button", { name: /Sequências/ }).click();
  await expect(page.locator("#jl-module-panel")).toContainText("Não existem disparos automáticos");
  await expect(page.locator(".jl-module-availability")).toContainText("em validação");

  await groups.getByRole("button", { name: "Prospecção e CRM" }).click();
  await expect(modules.getByRole("button")).toHaveCount(6);
  await expect(page.locator(".jl-module-availability")).toHaveCount(0);
});

test("tour lets users jump to analysis/proposals and commercial management with keyboard", async ({ page }) => {
  await openPublicHomepage(page);
  const tour = page.locator("#tour");
  const steps = tour.getByRole("list", { name: "Etapas da demonstração automática" });
  const buttons = steps.getByRole("button");
  await expect(buttons).toHaveCount(6);
  const analysis = steps.getByRole("button", { name: "Mostrar etapa: Análise e proposta" });
  await analysis.focus();
  await page.keyboard.press("Enter");
  await expect(analysis).toHaveAttribute("aria-current", "step");
  await expect(tour.locator(".jl-tour-scene-heading")).toContainText("Da análise à proposta");
  await expect(tour.locator(".jl-tour-viewport-content")).toContainText("Prévia pronta para salvar em PDF");

  const commercial = steps.getByRole("button", { name: "Mostrar etapa: Gestão comercial" });
  await commercial.click();
  await expect(commercial).toHaveAttribute("aria-current", "step");
  await expect(tour.locator(".jl-tour-scene-heading")).toContainText("Do contato à entrega");
  await expect(tour.locator(".jl-tour-viewport-content")).toContainText("Campanha");
  await expect(tour.locator(".jl-tour-viewport-content")).toContainText("Projetos");
  await expect(tour.getByText(/dados simulados/i)).toBeVisible();
});

test("commercial showcase stays within the mobile viewport", async ({ page }) => {
  await page.setViewportSize({width:360,height:780});
  await openPublicHomepage(page);
  await page.locator("#recursos").getByRole("button", { name: "Gestão Comercial" }).click();
  await page.locator("#recursos").getByRole("group", { name: "Módulos da plataforma" })
    .getByRole("button", { name: /Projetos/ }).click();
  await page.locator("#tour").getByRole("button", { name: "Mostrar etapa: Gestão comercial" }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});

test("homepage does not advertise Maps as generally available or signup as instant", async ({ page }) => {
  await openPublicHomepage(page);
  const faq = page.locator("#duvidas");
  await expect(faq).toContainText("Criar uma conta libera todas as ferramentas?");
  await expect(faq).toContainText("A busca pelo mapa já está disponível para qualquer usuário?");
  await expect(page.locator(".jl-module-groups")).toBeVisible();
});
