import { isAllowedBrowserOrigin } from "./allowed-browser-origins.ts";

Deno.test("allows the actual JanuarioLeads production and Lovable origins", () => {
  const allowed = [
    "https://januleads.vercel.app",
    "https://lovable.dev",
    "https://preview.lovable.dev",
    "https://preview.lovable.app",
    "https://lovable.app",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ];
  for (const origin of allowed) {
    if (!isAllowedBrowserOrigin(origin)) {
      throw new Error("Legitimate app origin was blocked: " + origin);
    }
  }
});

Deno.test("rejects lookalike domains and unsafe origins", () => {
  const denied = [
    "https://evil.vercel.app",
    "https://januleads.vercel.app.evil.test",
    "http://januleads.vercel.app",
    "https://januleads.vercel.app:444",
    "https://evil-lovable.dev",
    "https://preview.lovable.dev.attacker.test",
    "https://user:pass@januleads.vercel.app",
    "https://januleads.vercel.app/redirect",
    "null",
    "file:///",
    "javascript:alert(1)",
    "",
  ];
  for (const origin of denied) {
    if (isAllowedBrowserOrigin(origin)) {
      throw new Error("Untrusted origin was accepted: " + origin);
    }
  }
});

Deno.test("additional domains require an exact explicit server configuration", () => {
  const configured = "https://cliente.example, https://app.example.org";
  if (!isAllowedBrowserOrigin("https://cliente.example", configured)) {
    throw new Error("Explicitly configured origin rejected");
  }
  if (isAllowedBrowserOrigin("https://cliente.example.evil.test", configured) ||
      isAllowedBrowserOrigin("https://cliente.example", "") ||
      isAllowedBrowserOrigin("http://cliente.example", configured)) {
    throw new Error("Unconfigured or lookalike origin accepted");
  }
});
