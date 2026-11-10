/// <reference lib="deno.ns" />
import { isValidBrowserGoogleMapsKey } from "./browser-map-key.ts";

function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}

Deno.test("Maps JavaScript browser API keys accept the standard public format", () => {
  const valid = "AIza" + "A".repeat(35);
  check(isValidBrowserGoogleMapsKey(valid), "Standard browser key was rejected");
  check(isValidBrowserGoogleMapsKey(" " + valid + " "), "Pasted whitespace should be trimmed");
  check(isValidBrowserGoogleMapsKey("AIza" + "-_".repeat(17) + "-"),
    "Allowed URL-safe characters should be accepted");
});

Deno.test("Google Maps key recovery rejects server secrets and malformed input", () => {
  const values = [
    "", "AIza", "AIza" + "x".repeat(34), "AIza" + "x".repeat(36),
    "sk_live_" + "x".repeat(30), "GEOAPIFY_API_KEY", "not-a-maps-key",
    "<script>alert(1)</script>", "\n", "AIza" + "x".repeat(34) + "!",
  ];
  for (const value of values) {
    check(!isValidBrowserGoogleMapsKey(value), "Malformed public browser key was accepted");
  }
});
