import { test, expect, type Page } from "@playwright/test";

// Every request to Supabase is mocked; these tests never access real CRM data.
const TEST_USER = "11111111-1111-1111-1111-111111111111";

async function openMockWorkspace(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue() : route.abort();
  });
  const cloud = new Map<string, Record<string, unknown>>();
  await page.route("**/*.supabase.co/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let status = 200;
    let body: unknown = [];
    if (url.pathname === "/auth/v1/token") {
      body = {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: 3600,
        user: { id: TEST_USER, email: "test@example.invalid" },
      };
    } else if (url.pathname === "/auth/v1/user") {
      body = { id: TEST_USER, email: "test@example.invalid" };
    } else if (url.pathname === "/rest/v1/private_access") {
      body = [{ user_id: TEST_USER }];
    } else if (url.pathname === "/rest/v1/commercial_workspace_documents") {
      if (req.method() === "GET") {
        const kind = url.searchParams.get("document_key")?.replace(/^eq\./, "");
        body = kind ? (cloud.has(kind) ? [cloud.get(kind)] : []) : [...cloud.values()];
      }
      if (req.method() === "POST") {
        const raw = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
        const kind = String(raw.document_key ?? "");
        const row = { ...raw, revision: 1 };
        cloud.set(kind, row);
        body = [row];
        status = 201;
      }
      if (req.method() === "PATCH") {
        const kind = String(url.searchParams.get("document_key")?.replace(/^eq\./, ""));
        const previous = cloud.get(kind);
        const expected = Number(url.searchParams.get("revision")?.replace(/^eq\./, ""));
        if (previous && previous.revision === expected) {
          const update = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
          const row = { ...previous, ...update };
          cloud.set(kind, row);
          body = [row];
        } else {
          body = [];
        }
      }
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("test@example.invalid");
  await page.getByPlaceholder("Sua senha").fill("fake-test-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".saas-shell")).toBeVisible();
  await page.locator(".saas-sidebar .saas-commercial-toggle").click();
}

test("Excluir campanha usa aviso Januário Leads: cancelar e Esc preservam a campanha", async ({ page }) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await openMockWorkspace(page);
  await page.locator(".saas-sidebar").getByRole("button", { name: "Campanhas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Campanhas de prospecção" })).toBeVisible();

  await page.getByPlaceholder("Ex.: Barbearias de Lavras").fill("Campanha de teste");
  await page.getByRole("button", { name: "Criar campanha" }).click();
  const saved = page.locator(".cx-list-entry").filter({ hasText: "Campanha de teste" });
  await expect(saved).toBeVisible();

  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Excluir campanha?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Campanha de teste");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(saved).toBeVisible();

  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(saved).toBeVisible();

  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await dialog.getByRole("button", { name: "Excluir campanha" }).click();
  await expect(saved).toHaveCount(0);
  expect(nativeDialogs).toEqual([]);
});

test("Excluir proposta mostra diálogo próprio e só apaga após confirmação", async ({ page }) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await openMockWorkspace(page);
  await page.locator(".saas-sidebar").getByRole("button", { name: "Propostas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Propostas comerciais" })).toBeVisible();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".pc-saved-item")).toHaveCount(1);

  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Excluir proposta comercial?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator(".pc-saved-item")).toHaveCount(1);

  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await dialog.getByRole("button", { name: "Excluir proposta" }).click();
  await expect(page.locator(".pc-saved-item")).toHaveCount(0);
  expect(nativeDialogs).toEqual([]);
});
