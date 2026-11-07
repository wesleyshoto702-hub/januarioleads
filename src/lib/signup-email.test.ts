import { GMAIL_SIGNUP_ERROR, isGmailSignupEmail, normalizeSignupEmail } from "./signup-email.ts";

Deno.test("cadastro aceita somente endereços Gmail normalizados", () => {
  for (const value of ["pessoa@gmail.com", " PESSOA@GMAIL.COM ", "nome.sobrenome+crm@gmail.com"]) {
    if (!isGmailSignupEmail(value)) throw new Error("Gmail válido foi rejeitado: " + value);
  }
  if (normalizeSignupEmail(" NOME@GMAIL.COM ") !== "nome@gmail.com") {
    throw new Error("E-mail deveria ser normalizado");
  }
});

Deno.test("cadastro rejeita domínios diferentes, e-mails malformados e falsos Gmail", () => {
  const invalid = [
    "", "sem-arroba", "pessoa@outlook.com", "pessoa@yahoo.com",
    "pessoa@googlemail.com", "pessoa@gmail.com.evil.test", "pessoa@sub.gmail.com",
    "pessoa@fakegmail.com", "pessoa@@gmail.com", "pessoa @gmail.com",
    "pessoa@gmail.com lixo", "pessoa@ gmail.com",
  ];
  for (const value of invalid) {
    if (isGmailSignupEmail(value)) throw new Error("Cadastro inválido aceito: " + value);
  }
  if (!GMAIL_SIGNUP_ERROR.includes("@gmail.com")) throw new Error("Mensagem pouco clara");
});
