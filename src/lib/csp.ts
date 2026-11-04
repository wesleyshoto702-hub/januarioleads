/**
 * Per-response CSP for TanStack Start's generated SSR/hydration scripts.
 * The router must receive the same nonce through global request middleware.
 * No session material or authorization data belongs in this policy.
 */
export function createCspNonce(): string {
  const random = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...random));
}

export function buildCsp(nonce: string): string {
  if (!/^[A-Za-z0-9+/]{22}==$/.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }
  return [
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self' https://lovable.app https://*.lovable.app https://lovable.dev https://*.lovable.dev",
    "form-action 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' https:`,
    "script-src-attr 'none'",
  ].join("; ");
}
