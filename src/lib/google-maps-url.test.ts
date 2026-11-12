import { buildGoogleMapsUrl } from "./google-maps-url.ts";

function expect(value: unknown, condition: boolean, label: string) {
  if (!condition) throw new Error(`${label}: ${String(value)}`);
}

Deno.test("all three providers have a Google Maps search link", () => {
  for (const source of ["overture", "geoapify", "google_places"] as const) {
    const result = buildGoogleMapsUrl({
      name: "Hotel São João", address: "Rua das Flores, 22, Lavras - MG",
      city: "Lavras", state: "MG", source, placeId: `${source}:example`,
      googleMapsUrl: null,
    });
    expect(result, Boolean(result?.startsWith(
      "https://www.google.com/maps/search/?api=1&query="
    )), source);
    const url = new URL(result!);
    expect(url.searchParams.get("query"), url.searchParams.get("query")?.includes("Hotel São João") ?? false, "name preserved");
    expect(url.searchParams.get("query_place_id"), url.searchParams.has("query_place_id") === false,
      "non-Google IDs never sent as Google Place IDs");
  }
});

Deno.test("Google Places result supports its verified Place ID", () => {
  const url = buildGoogleMapsUrl({
    name: "Hotel Ouro Lavras", source: "google_places",
    placeId: "ChIJAbC_123-Xyz", googleMapsUrl: null,
  });
  expect(url, new URL(url!).searchParams.get("query_place_id") === "ChIJAbC_123-Xyz",
    "google Place ID linked");
});

Deno.test("trusted direct Google Maps URL is used when provided", () => {
  const link = "https://www.google.com/maps/place/Hotel+Ouro+Lavras";
  expect(buildGoogleMapsUrl({ name: "Hotel Ouro Lavras", googleMapsUrl: link }),
    buildGoogleMapsUrl({ name: "Hotel Ouro Lavras", googleMapsUrl: link }) === link,
    "existing Google Maps deep link");
});

Deno.test("unsafe or spoofed Maps URLs fall back to official search", () => {
  for (const supplied of [
    "javascript:alert(1)",
    "https://www.google.com.evil.invalid/maps",
    "https://attacker.invalid/maps",
    "https://user:secret@www.google.com/maps",
    "https://google.com.evil.example/maps",
  ]) {
    const link = buildGoogleMapsUrl({ name: "Pizzaria Centro", city: "Lavras", googleMapsUrl: supplied });
    expect(link, link?.startsWith("https://www.google.com/maps/search/?api=1&query=") ?? false,
      "malicious direct Maps URL rejected");
  }
});

Deno.test("saved manual CRM leads use company name and city", () => {
  const link = buildGoogleMapsUrl({ company: "Barbearia Exemplo", city: "Lavras", state: "MG" });
  expect(link, Boolean(link), "saved lead link");
  const url = new URL(link!);
  expect(url.searchParams.get("query"), url.searchParams.get("query")?.includes("Barbearia Exemplo") ?? false,
    "company name");
  expect(url.searchParams.get("query"), url.searchParams.get("query")?.includes("Lavras") ?? false,
    "city");
});

Deno.test("no source identity and no company name yields no link", () => {
  expect(buildGoogleMapsUrl({ address: "Rua X, 1", googleMapsUrl: null }), 
    buildGoogleMapsUrl({ address: "Rua X, 1", googleMapsUrl: null }) === null,
    "empty lead");
});
