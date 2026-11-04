import { test, expect } from "@playwright/test";

// The default production/legacy CI must not exercise this opt-in staging mode.
test.skip(process.env["VITE_HTTPONLY_SESSION"] !== "true", "BFF-only browser scenario");

const testUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "staging@example.invalid",
};

test("HttpOnly frontend mode never stores tokens and proxies data same-origin", async ({ page }) => {
  let loggedIn = false;
  const externalCalls: string[] = [];
  await page.route("**/*.supabase.co/**", (route) => {
    externalCalls.push(route.request().url());
    return route.abort();
  });

  await page.route("**/api/session", (route) => {
    const method = route.request().method();
    if (method === "POST") {
      loggedIn = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, user: testUser, expiresAt: Date.now() + 3600000 }),
      });
    }
    if (method === "DELETE") {
      loggedIn = false;
      return route.fulfill({ status: 204, body: "" });
    }
    if (!loggedIn) {
      return route.fulfill({ status: 401, contentType: "application/json", body: '{"ok":false}' });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, user: testUser, expiresAt: Date.now() + 3600000 }),
    });
  });

  let proxied = 0;
  await page.route("**/api/supabase/**", (route) => {
    proxied++;
    const response = route.request().method() === "GET" ? "[]" : "{}";
    return route.fulfill({ status: 200, contentType: "application/json", body: response });
  });

  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill(testUser.email);
  await page.getByPlaceholder("Sua senha").fill("fictional-staging-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page.getByRole("button", { name: "Sair", exact: true })).toBeVisible();
  const browserAuth = await page.evaluate(() => localStorage.getItem("januarioleads:auth-session"));
  expect(browserAuth).not.toBeNull();
  const content = JSON.parse(browserAuth!);
  expect(content.user.id).toBe(testUser.id);
  expect(content.accessToken).toBe("http-only-server-proxy");
  expect(content.refreshToken).toBe("http-only-server-proxy");
  expect(browserAuth).not.toContain("test-access");
  expect(browserAuth).not.toContain("test-refresh");

  await page.getByRole("button", { name: "Meus Leads", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Meus Leads", exact: true })).toBeVisible();
  expect(proxied).toBeGreaterThan(0);
  expect(externalCalls).toHaveLength(0);

  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("januarioleads:auth-session"))).toBeNull();
});
