import { test, expect, type Page } from "@playwright/test";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const WAITING_LEAD = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  user_id: USER_ID,
  company: "Oficina Exemplo",
  segment: "Oficina",
  phone: "35999999999",
  status: "waiting",
  first_contact: "2026-11-01",
  last_contact: "2026-11-02",
  created_at: "2026-11-01T12:00:00.000Z",
  city: "Lavras",
  state: "MG",
  notes: "",
  source: "manual",
};

async function signInWithMockedData(page: Page) {
  // Deny all traffic off localhost except explicitly mocked Supabase requests.
  // Tests must never use production data, paid APIs or real WhatsApp messages.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.route("**/*.supabase.co/**", (route) => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname === "/auth/v1/token") {
      body = {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: 3600,
        user: { id: USER_ID, email: "test@example.invalid" },
      };
    }
    if (url.pathname === "/auth/v1/user") {
      body = { id: USER_ID, email: "test@example.invalid" };
    }
    if (url.pathname === "/rest/v1/private_access") {
      body = [{ user_id: USER_ID }];
    }
    if (url.pathname === "/rest/v1/leads")
      body = url.searchParams.get("offset") === "0" ? [WAITING_LEAD] : [];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("test@example.invalid");
  await page.getByPlaceholder("Sua senha").fill("fake-test-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".saas-shell")).toBeVisible();
}

test("follow-up templates can be added, edited, favorited and restored in their own category", async ({ page }) => {
  await signInWithMockedData(page);
  await page.getByRole("button", { name: "Mensagens", exact: true }).first().click();

  await expect(page.getByRole("tab", { name: /Mensagem inicial/ })).toBeVisible();
  await page.getByRole("tab", { name: /Follow-up/ }).click();
  await expect(page.getByText("Follow-up 1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar follow-up", exact: true }).click();
  await page.getByRole("textbox", { name: "Nome da mensagem" }).fill("Retorno comercial");
  await page.getByRole("textbox", { name: "Conteúdo" }).fill("Olá {empresa}, podemos retomar nossa conversa?");
  await page.getByRole("checkbox", { name: "Fixar como favorita" }).check();
  await page.getByRole("button", { name: "Salvar follow-up" }).click();

  const followUp = page.locator(".message-summary-card").filter({ hasText: "Retorno comercial" });
  await expect(followUp).toBeVisible();
  await expect(followUp.getByText("Favorita", { exact: true })).toBeVisible();

  await followUp.getByRole("button", { name: /Editar/ }).click();
  await page.getByRole("textbox", { name: "Conteúdo" }).fill("Oi {empresa}, gostaria de acompanhar nossa proposta.");
  await page.getByRole("button", { name: "Salvar follow-up" }).click();
  await expect(page.getByText("Oi {empresa}, gostaria de acompanhar nossa proposta.")).toBeVisible();

  await page.getByRole("tab", { name: /Mensagem inicial/ }).click();
  await expect(page.getByText("Retorno comercial", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: /Follow-up/ }).click();

  await page.reload();
  await page.getByRole("button", { name: "Mensagens", exact: true }).first().click();
  await page.getByRole("tab", { name: /Follow-up/ }).click();
  const persisted = page.locator(".message-summary-card").filter({ hasText: "Retorno comercial" });
  await expect(persisted).toBeVisible();
  await persisted.getByRole("button", { name: "Excluir Retorno comercial" }).click();
  await page.getByRole("button", { name: "Excluir mensagem", exact: true }).click();
  await expect(page.getByText("Retorno comercial", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Recuperar" }).filter({ hasText: "Recuperar" }).last().click();
  await expect(page.locator(".message-summary-card").filter({ hasText: "Retorno comercial" })).toBeVisible();
});

test("Meus Leads replaces enrichment button with follow-up, opening editable follow-up templates", async ({ page }) => {
  await signInWithMockedData(page);
  await page.getByRole("button", { name: "Meus Leads", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Meus Leads", exact: true })).toBeVisible();
  const leadRow = page.locator(".desktop-table .table-row").filter({ hasText: "Oficina Exemplo" });
  await expect(leadRow).toBeVisible();
  await expect(leadRow.getByRole("button", { name: "Atualizar informações" })).toHaveCount(0);
  await expect(leadRow.getByText("Próxima ação", { exact: true })).toHaveCount(0);
  await leadRow.getByRole("button", { name: "Fazer follow-up" }).click();

  const dialog = page.getByRole("dialog", { name: "Fazer follow-up" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Follow-up 1/ })).toBeVisible();
  await expect(dialog.locator(".modal-copy strong").first()).toHaveText("Oficina Exemplo");
  // Sending is a user action: these tests never launch WhatsApp.
});

test("mobile lead card provides a follow-up action in the old enrichment position", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithMockedData(page);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("dialog", { name: "Menu principal" })
    .getByRole("button", { name: "Meus Leads", exact: true }).click();
  const card = page.locator(".mobile-list .lead-card").filter({ hasText: "Oficina Exemplo" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Fazer follow-up" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Atualizar informações" })).toHaveCount(0);
});
