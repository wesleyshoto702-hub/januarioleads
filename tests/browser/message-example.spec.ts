import { expect, test } from "@playwright/test";

test("modelos de mensagem trocam canal sem acessar API ou disparar contatos", async ({ page }) => {
  let supabaseCalls = 0;
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) supabaseCalls++;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? route.continue()
      : route.abort();
  });
  await page.goto("/");
  const demo = page.locator(".jl-message-card");
  await expect(demo).toBeVisible();
  await expect(demo.getByRole("tab", { name: "WhatsApp" })).toHaveAttribute("aria-selected", "true");
  await expect(demo.getByText(/Vi o trabalho da sua empresa/i)).toBeVisible();

  await demo.getByRole("tab", { name: "E-mail" }).click();
  await expect(demo.getByRole("tab", { name: "E-mail" })).toHaveAttribute("aria-selected", "true");
  await expect(demo.getByText(/Olá, equipe!/)).toBeVisible();

  await demo.getByRole("tab", { name: "Follow-up" }).click();
  await expect(demo.getByText(/Passando para saber se você teve a oportunidade/i)).toBeVisible();
  await expect(demo.getByText("Sem envio automático")).toBeVisible();
  expect(supabaseCalls).toBe(0);
});
