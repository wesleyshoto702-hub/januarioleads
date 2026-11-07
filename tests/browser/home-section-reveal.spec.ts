import { expect, test } from "@playwright/test";

function isolateExternal(page: import("@playwright/test").Page) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
}

test("homepage reveals visible sections after opening and refreshing", async ({ page }) => {
  await isolateExternal(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 780 });
  await page.goto("/");

  const sections = page.locator("#conteudo > section");
  await expect(sections).toHaveCount(8);
  const hero = sections.first();
  await expect(hero).toHaveAttribute("data-jl-reveal", "visible");
  await expect(hero.locator(":scope > .jl-container")).toHaveCSS("opacity", "1");
  await expect(page.locator(".jl-aurora-canvas")).toHaveCount(1);

  await page.reload();
  await expect(sections).toHaveCount(8);
  await expect(sections.first()).toHaveAttribute("data-jl-reveal", "visible");
  await expect(sections.first().locator(":scope > .jl-container")).toHaveCSS("opacity", "1");
});

test("each homepage section fades in on first arrival and stays visible when scrolling back", async ({ page }) => {
  await isolateExternal(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  const sections = page.locator("#conteudo > section");
  await expect(sections.first()).toHaveAttribute("data-jl-reveal", "visible");
  for (let index = 1; index < 8; index++) {
    const section = sections.nth(index);
    const content = section.locator(":scope > .jl-container");
    await section.evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" }));
    await expect(section).toHaveAttribute("data-jl-reveal", "visible");
    await expect(content).toHaveCSS("opacity", "1");
    await expect(content).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(sections.first()).toHaveAttribute("data-jl-reveal", "visible");
  await expect(sections.nth(6)).toHaveAttribute("data-jl-reveal", "visible");
  await expect(page.locator(".jl-aurora-canvas")).toHaveCount(1);
});

test("reduced motion keeps content visible without section reveal effects", async ({ page }) => {
  await isolateExternal(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const sections = page.locator("#conteudo > section");
  await expect(sections).toHaveCount(8);
  await expect(page.locator('#conteudo > section[data-jl-reveal]')).toHaveCount(0);
  for (const index of [0, 3, 5, 7]) {
    const content = sections.nth(index).locator(":scope > .jl-container");
    await expect(content).toHaveCSS("opacity", "1");
  }
});

test("fallback without IntersectionObserver does not hide homepage sections", async ({ page }) => {
  await isolateExternal(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true, value: undefined,
    });
  });
  await page.goto("/");
  await expect(page.locator("#conteudo > section")).toHaveCount(8);
  await expect(page.locator('#conteudo > section[data-jl-reveal]')).toHaveCount(0);
  await expect(page.locator("#conteudo > section").last().locator(":scope > .jl-container"))
    .toHaveCSS("opacity", "1");
});

test("mobile sections reveal without horizontal overflow or blocking interaction", async ({ page }) => {
  await isolateExternal(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.locator("#conteudo > section").first()).toHaveAttribute("data-jl-reveal", "visible");
  await page.locator("#duvidas").evaluate((section) =>
    section.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await expect(page.locator("#duvidas")).toHaveAttribute("data-jl-reveal", "visible");
  await expect(page.locator("#duvidas > .jl-container")).toHaveCSS("opacity", "1");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
  await page.locator("#duvidas summary").first().click();
  await expect(page.locator("#duvidas details").first()).toHaveAttribute("open", "");
});
