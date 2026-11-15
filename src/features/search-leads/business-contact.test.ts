import { hasUsableBusinessEmail } from "./business-contact.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
Deno.test("Overture contacts: show valid unverified emails without external calls", () => {
  assert(hasUsableBusinessEmail("contato@empresa.com.br"), "Regular email");
  assert(hasUsableBusinessEmail("  suporte@loja.com  "), "Trimmed email");
  for (const invalid of [null, undefined, "", "não informado", "nome@", "@site.com",
    "contato@localhost", "alguem@site.com\r\nBcc:xx@site.com", "contato @site.com",
    "mailto:alguem@site.com"]) {
    assert(!hasUsableBusinessEmail(invalid), "Invalid/untrusted directory email should be filtered");
  }
});
