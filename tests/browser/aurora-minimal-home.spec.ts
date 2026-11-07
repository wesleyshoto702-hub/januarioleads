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
  test("aurora orgânica com fundo preto e sem partículas em " + path, async ({ page }) => {
    let supabaseRequests = 0;
    await isolate(page, () => supabaseRequests++);
    await page.goto(path);

    const aurora = page.locator(".jl-aurora");
    await expect(aurora).toHaveCount(1);
    await expect(aurora).toHaveAttribute("aria-hidden", "true");
    await expect(aurora).toHaveAttribute("data-ambient", "aurora");
    await expect(aurora.locator("canvas.jl-aurora-canvas")).toHaveCount(1);
    await expect(aurora.locator(".jl-aurora-veil, .jl-aurora-haze")).toHaveCount(0);
    await expect(page.locator(".jl-ambient, .jl-ambient-particle")).toHaveCount(0);
    const actual = await aurora.evaluate((node) => ({
      position: getComputedStyle(node).position,
      pointerEvents: getComputedStyle(node).pointerEvents,
      background: getComputedStyle(node).backgroundColor,
      z: getComputedStyle(node).zIndex,
      canvasWidth: (node.querySelector("canvas") as HTMLCanvasElement).width,
    }));
    expect(actual.position).toBe("fixed");
    expect(actual.pointerEvents).toBe("none");
    expect(actual.z).toBe("0");
    expect(actual.background).toBe("rgb(5, 6, 8)");
    expect(actual.canvasWidth).toBeGreaterThan(0);
    expect(supabaseRequests).toBe(0);
  });
}

test("faixas vermelhas realmente se movem atrás da homepage inteira", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await isolate(page, () => {});
  await page.goto("/");

  const canvas = page.locator(".jl-site .jl-aurora-canvas");
  await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(300);
  const first = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(1000);
  const second = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  expect(second).not.toBe(first);

  const layering = await page.evaluate(() => {
    const aurora = document.querySelector<HTMLElement>(".jl-site > .jl-aurora")!;
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".jl-site > main > section"));
    return {
      auroraZ: Number(getComputedStyle(aurora).zIndex),
      mainZ: Number(getComputedStyle(document.querySelector(".jl-site > main")!).zIndex),
      headerZ: Number(getComputedStyle(document.querySelector(".jl-site > header")!).zIndex),
      canvasOpacity: Number(getComputedStyle(aurora.querySelector("canvas")!).opacity),
      sections: sections.map((section) => ({
        name: section.className,
        bg: getComputedStyle(section).backgroundColor,
      })),
    };
  });
  expect(layering.mainZ).toBeGreaterThan(layering.auroraZ);
  expect(layering.headerZ).toBeGreaterThan(layering.auroraZ);
  expect(layering.canvasOpacity).toBeLessThan(.90);
  expect(layering.sections.length).toBeGreaterThanOrEqual(8);
  for (const section of layering.sections) {
    const match = section.bg.match(/rgba?\(([^)]+)\)/);
    expect(match, section.name).not.toBeNull();
    const parts = match![1].split(/[,/]/).map((part) => part.trim());
    const alpha = parts.length === 4 ? Number(parts[3]) : 1;
    expect(alpha, section.name).toBeGreaterThanOrEqual(.50);
    expect(alpha, section.name).toBeLessThan(.85);
  }

  const before = await page.locator(".jl-aurora").boundingBox();
  await page.locator("#duvidas").scrollIntoViewIfNeeded();
  const after = await page.locator(".jl-aurora").boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(before!.y - after!.y)).toBeLessThan(2);
  await expect(page.locator("#duvidas")).toBeVisible();
});

test("hero compacto, beta e CTAs repetidos removidos; ícone FAQ centrado", async ({ page }) => {
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
  const offset = await plus.evaluate((node) => {
    const outer = node.getBoundingClientRect();
    const svg = node.querySelector("svg")!.getBoundingClientRect();
    return Math.abs((outer.top + outer.bottom) / 2 - (svg.top + svg.bottom) / 2);
  });
  expect(offset).toBeLessThan(2);
});

test("Explore, Organize, Acompanhe acendem em ordem no scroll", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/");
  await expect(page.locator(".jl-demo-window")).toHaveAttribute("data-interactive", "true", { timeout: 15000 });
  const section = page.locator(".jl-editorial-workflow");
  await section.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(section.locator(".jl-workflow-track")).toHaveAttribute("data-stage", "2", { timeout: 9500 });
  await expect(section.locator("li.jl-workflow-active")).toHaveCount(3);
});

test("movimento reduzido preserva aurora estática e etapas concluídas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await isolate(page, () => {});
  await page.goto("/");
  const canvas = page.locator(".jl-site .jl-aurora-canvas");
  await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(300);
  const first = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(700);
  const second = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  expect(second).toBe(first);
  await expect(page.locator(".jl-workflow-track")).toHaveAttribute("data-stage", "2");
  await expect(page.locator(".jl-workflow-active")).toHaveCount(3);
});

for (const width of [320, 360, 390, 768, 1280]) {
  test("aurora não causa overflow nem bloqueia cliques em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await isolate(page, () => {});
    await page.goto("/");
    await expect(page.locator(".jl-aurora-canvas")).toBeAttached();
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
    await expect(page.locator(".jl-auth-shell > .jl-aurora-canvas")).toBeAttached();
  });
}
