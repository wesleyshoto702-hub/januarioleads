import { buildCsp, createCspNonce } from "./csp.ts";

Deno.test("nonce has 128 bits of randomness and varies across requests", () => {
  const one = createCspNonce();
  const two = createCspNonce();
  if (!/^[A-Za-z0-9+/]{22}==$/.test(one) || one === two) {
    throw new Error("Invalid or repeated nonce");
  }
});

Deno.test("nonce CSP blocks unsafe inline scripts and object embedding", () => {
  const nonce = createCspNonce();
  const csp = buildCsp(nonce);
  if (!csp.includes(`script-src 'nonce-${nonce}' 'strict-dynamic'`)) {
    throw new Error("Expected strict nonce policy");
  }
  if (csp.includes("'unsafe-inline'") || csp.includes("'unsafe-eval'")) {
    throw new Error("Unsafe script permission");
  }
  if (!csp.includes("object-src 'none'") || !csp.includes("script-src-attr 'none'")) {
    throw new Error("Security directives missing");
  }
  if (!csp.includes("https://lovable.dev")) {
    throw new Error("Preview frame policy changed unexpectedly");
  }
});

Deno.test("CSP refuses an untrusted nonce", () => {
  for (const bad of ["", "bad", "abc'; script-src *", "a".repeat(500)]) {
    let threw = false;
    try { buildCsp(bad); } catch { threw = true; }
    if (!threw) throw new Error("Unsafe nonce accepted");
  }
});
