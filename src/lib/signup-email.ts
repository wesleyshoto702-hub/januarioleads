/** Regra compartilhada pelos formulários de criação de conta. */
export const GMAIL_SIGNUP_ERROR = "Para criar sua conta, informe um endereço @gmail.com válido.";

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isGmailSignupEmail(email: string): boolean {
  const normalized = normalizeSignupEmail(email);
  return normalized.length <= 320 && /^[^\s@]+@gmail\.com$/.test(normalized);
}
