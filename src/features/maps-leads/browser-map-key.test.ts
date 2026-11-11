/// <reference lib="deno.ns" />
import { isValidBrowserGoogleMapsKey, chooseMapProvider, canDisplayGooglePlaces } from "./browser-map-key.ts";

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

Deno.test("Mapa aberto funciona sem nenhuma chave; Google só com chave do site", () => {
  check(chooseMapProvider("") === "open", "Missing site key must select OpenFreeMap");
  check(chooseMapProvider("AIza") === "open", "Malformed site key must not block the map");
  check(chooseMapProvider("AIza" + "A".repeat(35)) === "google",
    "A valid site-wide browser key can enable Google Maps");
  check(chooseMapProvider("sk_live_secret") === "open",
    "Never use a server or billing secret as a Google browser key");
  check(!canDisplayGooglePlaces("", false), "Never draw Google Places on non-Google basemap");
  check(!canDisplayGooglePlaces("AIza" + "A".repeat(35), true), "Google maps auth failure blocks Google Places display");
  check(canDisplayGooglePlaces("AIza" + "A".repeat(35), false), "Google Places only allowed with working Google basemap");
});
