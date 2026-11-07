import { expect, test } from "@playwright/test";

function isolate(page: import("@playwright/test").Page, report: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) report();
    return ["localhost", "127.0.0.1"].includes(url.hostname)
      ? route.continue() : route.abort();
  });
}

for (const path of ["/", "/produto", "/login", "/cadastro"]) {
  test("aurora de fundo real, sem partículas sobre o conteúdo, em " + path, async ({ page }) => {
    let supabaseRequests = 0;
    await isolate(page, () => supabaseRequests++);
    await page.goto(path);

    const aurora = page.locator(".jl-aurora");
    await expect(aurora).toHaveCount(1);
    await expect(aurora).toHaveAttribute("aria-hidden", "true");
    await expect(aurora).toHaveAttribute("data-ambient", "aurora");
    await expect(aurora.locator(".jl-aurora-veil")).toHaveCount(4);
    await expect(aurora.locator(".jl-aurora-haze")).toHaveCount(1);
    await expect(page.locator(".jl-ambient, .jl-ambient-particle")).toHaveCount(0);

    const actual = await aurora.evaluate((node) => ({
      position: getComputedStyle(node).position,
      pointerEvents: getComputedStyle(node).pointerEvents,
      z: Number(getComputedStyle(node).zIndex),
      animation: getComputedStyle(node.querySelector(".jl-aurora-veil")!).animationName,
    }));
    expect(actual.position).toBe("fixed");
    expect(actual.pointerEvents).toBe("none");
    expect(actual.z).toBe(0);
    expect(actual.animation).toContain("jlAurora");
    expect(supabaseRequests).toBe(0);
  });
}

test("aurora fica ATRÁS das seções e continua no fundo ao rolar", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/");
  const aurora = page.locator(".jl-aurora");
  const layer = await page.evaluate(() => ({
    backgroundZ: Number(getComputedStyle(document.querySelector(".jl-aurora")!).zIndex),
    contentZ: Number(getComputedStyle(document.querySelector(".jl-site > main")!).zIndex),
    headerZ: Number(getComputedStyle(document.querySelector(".jl-site > header")!).zIndex),
  }));
  expect(layer.contentZ).toBeGreaterThan(layer.backgroundZ);
  expect(layer.headerZ).toBeGreaterThan(layer.backgroundZ);

  const before = await aurora.boundingBox();
  await page.locator("#duvidas").scrollIntoViewIfNeeded();
  const after = await aurora.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(before!.y - after!.y)).toBeLessThan(2);
  await expect(page.locator("#duvidas")).toBeVisible();
});

test("hero compacto, aviso de beta e CTAs repetidos removidos; FAQ alinhado", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/");
  await expect(page.locator(".jl-marketing-briefing, .jl-hero-disclaimer, .jl-access, .jl-bottom-cta")).toHaveCount(0);
  await expect(page.getByText(/plataforma em evolução comercial|acesso atual por convite|a próxima fase da sua prospecção|transforme sua pesquisa em um processo comercial/i)).toHaveCount(0);
  const highlights = page.locator(".jl-hero-highlights span");
  await expect(highlights).toHaveCount(3);
  await expect(highlights.nth(0)).toContainText("Busca por cidade e nicho");
  await expect(highlights.nth(1)).toContainText("CRM e próximos contatos");
  await expect(highlights.nth(2)).toContainText("Acesso pelo navegador");
  await expect(page.locator(".jl-faq-item")).toHaveCount(4);
  const plus = page.locator(".jl-faq-item summary > span").first();
  const centers = await plus.evaluate((node) => {
    const square = node.getBoundingClientRect();
    const svg = node.querySelector("svg")!.getBoundingClientRect();
    return { dx: Math.abs((square.left + square.right) / 2 - (svg.left + svg.right) / 2),
      dy: Math.abs((square.top + square.bottom) / 2 - (svg.top + svg.bottom) / 2) };
  });
  expect(centers.dx).toBeLessThan(2);
  expect(centers.dy).toBeLessThan(2);
});

test("Explore, Organize e Acompanhe acendem em vermelho na ordem ao aparecer", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/");
  await expect(page.locator(".jl-demo-window")).toHaveAttribute("data-interactive", "true", { timeout: 15000 });
  const section = page.locator(".jl-editorial-workflow");
  await section.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  const track = section.locator(".jl-workflow-track");
  await expect(track).toHaveAttribute("data-stage", "0", { timeout: 6500 });
  await expect(track).toHaveAttribute("data-stage", "2", { timeout: 7500 });
  await expect(track.locator("li.jl-workflow-active")).toHaveCount(3);
  await expect(track.getByText("Explore", { exact: true })).toBeVisible();
  await expect(track.getByText("Organize", { exact: true })).toBeVisible();
  await expect(track.getByText("Acompanhe", { exact: true })).toBeVisible();
});

test("movimento reduzido deixa a aurora parada e as três etapas concluídas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await isolate(page, () => {});
  await page.goto("/");
  const values = await page.locator(".jl-aurora").evaluate((root) =>
    [".jl-aurora-veil", ".jl-aurora-haze"].map((selector) =>
      getComputedStyle(root.querySelector(selector)!).animationName));
  expect(values).toEqual(["none", "none"]);
  await expect(page.locator(".jl-workflow-track")).toHaveAttribute("data-stage", "2");
  await expect(page.locator(".jl-workflow-active")).toHaveCount(3);
});

for (const width of [320, 360, 390, 768, 1280]) {
  test("aurora não causa overflow ou intercepta navegação em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await isolate(page, () => {});
    await page.goto("/");
    await expect(page.locator(".jl-aurora")).toBeAttached();
    await expect(page.locator(".jl-mobile-menu-toggle")).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    if (width <= 370) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.getByRole("navigation", { name: "Navegação para celular" })
        .getByRole("link", { name: "Criar conta" }).click();
    } else {
      await page.locator(".jl-header-actions").getByRole("link", { name: "Criar conta" }).click();
    }
    await expect(page).toHaveURL(/\/cadastro$/);
    await expect(page.locator(".jl-auth-shell > .jl-aurora")).toBeAttached();
  });
}
