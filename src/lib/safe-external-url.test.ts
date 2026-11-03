import { safeExternalHref } from "./safe-external-url.ts";

Deno.test("accepts only absolute http(s) links", () => {
  const links = [
    "https://empresa.com.br/contato?q=1",
    "http://www.google.com/maps",
    "  https://www.instagram.com/exemplo/  ",
  ];
  for (const link of links) {
    const result = safeExternalHref(link);
    if (!result || !result.startsWith("http")) {
      throw new Error("Valid external link was rejected");
    }
  }
});

Deno.test("rejects script, data, file, relative and protocol-relative URLs", () => {
  for (const candidate of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "mailto:someone@example.com",
    "blob:https://empresa.com.br/abc",
    "//evil.example",
    "/internal/path",
    "empresa.com.br",
    "",
    "  ",
  ]) {
    if (safeExternalHref(candidate) !== null) {
      throw new Error("Unsafe external URL accepted");
    }
  }
});

Deno.test("rejects credentials and control characters in external links", () => {
  for (const candidate of [
    "https://username:password@empresa.com.br",
    "https://empresa.com.br/\nattack",
    "https://empresa.com.br/\tattack",
    "https://empresa.com.br/\u0000attack",
  ]) {
    if (safeExternalHref(candidate) !== null) {
      throw new Error("Unsafe external URL accepted");
    }
  }
});

Deno.test("invalid inputs are handled safely", () => {
  if (safeExternalHref(null) !== null || safeExternalHref(undefined) !== null) {
    throw new Error("Missing URL should not be rendered");
  }
  if (safeExternalHref("https://") !== null) {
    throw new Error("Malformed URL should not be rendered");
  }
});
