import { expect, test } from "@playwright/test";

function localOnly(page: import("@playwright/test").Page, report: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) report();
    return ["localhost", "127.0.0.1"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
}

for (const path of ["/", "/produto", "/login", "/cadastro"]) {
  test("atmosfera animada aparece na página pública " + path, async ({ page }) => {
    let requests = 0;
    await localOnly(page, () => requests++);
    await page.goto(path);
    const ambient = page.locator(".jl-ambient");
    await expect(ambient).toBeAttached();
    await expect(ambient).toHaveAttribute("aria-hidden", "true");
    await expect(ambient).toHaveAttribute("data-ambient", "sitewide");
    await expect(ambient.locator(".jl-ambient-particle")).toHaveCount(20);
    await expect(ambient.locator(".jl-ambient-glow")).toHaveCount(2);
    await expect(ambient.locator(".jl-ambient-orbit")).toHaveCount(2);
    const styles = await ambient.evaluate((el) => {
      const dot = el.querySelector<HTMLElement>(".jl-ambient-particle");
      return {
        pointerEvents: window.getComputedStyle(el).pointerEvents,
        position: window.getComputedStyle(el).position,
        animation: window.getComputedStyle(dot!).animationName,
      };
    });
    expect(styles.pointerEvents).toBe("none");
    expect(styles.position).toBe("fixed");
    expect(styles.animation).toContain("jlAmbientFloat");
    expect(requests).toBe(0);
  });
}

test("partículas continuam no viewport após rolar a homepage", async ({ page }) => {
  await localOnly(page, () => { throw new Error("Supabase called from public site"); });
  await page.goto("/");
  const ambient = page.locator(".jl-ambient");
  const before = await ambient.boundingBox();
  await page.locator("#duvidas").scrollIntoViewIfNeeded();
  const after = await ambient.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(before!.y - after!.y)).toBeLessThan(2);
  await expect(page.locator("#duvidas")).toBeVisible();
  await expect(page.locator(".jl-tour-stage")).toBeAttached();
});

test("movimento reduzido desativa partículas, halos e órbitas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await localOnly(page, () => {});
  await page.goto("/");
  const animations = await page.locator(".jl-ambient").evaluate((ambient) => [
    ".jl-ambient-particle", ".jl-ambient-glow", ".jl-ambient-orbit",
  ].map((selector) => window.getComputedStyle(ambient.querySelector(selector)!).animationName));
  expect(animations).toEqual(["none", "none", "none"]);
});

for (const width of [320, 360, 390, 768, 1280]) {
  test("fundo decorativo não gera overflow nem bloqueia navegação em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await localOnly(page, () => {});
    await page.goto("/");
    await expect(page.locator(".jl-ambient-particle")).toHaveCount(20);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1,
    )).toBe(false);
    // Wait for React hydration before clicking TanStack Router links in WebKit.
    await expect(page.locator(".jl-mobile-menu-toggle")).toBeEnabled();
    if (width >= 380) {
      await page.locator(".jl-header-actions").getByRole("link", { name: "Criar conta" }).click();
      await expect(page).toHaveURL(/\/cadastro$/);
      await expect(page.locator(".jl-auth-shell > .jl-ambient")).toBeAttached();
    } else {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.getByRole("navigation", { name: "Navegação para celular" })
        .getByRole("link", { name: "Criar conta" }).click();
      await expect(page).toHaveURL(/\/cadastro$/);
    }
  });
}
