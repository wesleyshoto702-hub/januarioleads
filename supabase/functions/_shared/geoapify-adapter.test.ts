/// <reference lib="deno.ns" />
import {
  geoapifyCategoryForSegment,
  filterGeoapifyForNiche,
  normalizeGeoapifyPlaces,
  resolveGeoapifyCityLocation,
  geoapifyFeatureCount,
  type GeoapifyPlacePreview,
} from "./geoapify-adapter.ts";

function assert(value: unknown, detail: string) {
  if (!value) throw new Error(detail);
}

Deno.test("Geoapify maps only reviewed niches and normalizes accents", () => {
  assert(geoapifyCategoryForSegment("Barbearia") === "service.beauty.hairdresser", "barbershop");
  assert(geoapifyCategoryForSegment("Salão de Beleza") === "service.beauty.hairdresser", "accented salon");
  assert(geoapifyCategoryForSegment("Nicho Desconhecido") === null, "unknown niches must not run broad queries");
});

Deno.test("Geoapify city geocoding rejects wrong state, country and city", () => {
  const feature = (city: string, state: string, country = "br") => ({
    type: "Feature",
    properties: {
      city, country_code: country, state, place_id: "1234abcd",
      lon: -45.0000, lat: -21.2500,
    },
    geometry: { type: "Point", coordinates: [-45, -21.25] },
  });
  const data = { type: "FeatureCollection", features: [
    feature("Lavras", "São Paulo"),
    feature("Lavras", "Minas Gerais", "pt"),
    feature("São João del-Rei", "Minas Gerais"),
    feature("Lavras", "Minas Gerais"),
  ] };
  const result = resolveGeoapifyCityLocation(data, "Lavras", "MG");
  assert(result?.placeId === "1234abcd" && result.lon === -45 && result.lat === -21.25,
    "Should find only the matching Brazilian city and UF");
  assert(resolveGeoapifyCityLocation({ features: [feature("Lavras", "São Paulo")] }, "Lavras", "MG") === null,
    "Wrong state should be rejected");
  assert(resolveGeoapifyCityLocation({}, "Lavras", "MG") === null, "Malformed response");
});

Deno.test("Geoapify places normalization retains source IDs and valid geolocation only", () => {
  const business = (place_id: string, name: string, coordinates: unknown, state_code = "MG", country_code = "br") => ({
    type: "Feature", properties: {
      place_id, name, city: "Lavras", state_code, country_code,
      formatted: "Rua Exemplo, Lavras - MG", categories: ["service.beauty.hairdresser"],
    }, geometry: { type: "Point", coordinates },
  });
  const data = { features: [
    business("aa11bb", "Barbearia Central", [-45, -21.25]),
    business("aa11bb", "Duplicada", [-45, -21.25]),
    business("cc22dd", "Fora de MG", [-46, -23], "SP"),
    business("ee33ff", "Sem GPS", [null, null]),
    business("1122ff", "Outra Barbearia", [-44.99, -21.26]),
  ] };
  const results = normalizeGeoapifyPlaces(data, {city:"Lavras",state:"MG"},25);
  assert(results.length === 2, "Invalid, out-of-state and repeated providers should be excluded");
  assert(results[0]?.sourceId === "geoapify:aa11bb" &&
    results[0]?.latitude === -21.25 && results[0]?.longitude === -45, "Source and real coordinates");
  assert(results[1]?.sourceId === "geoapify:1122ff", "Second valid result");
  assert(geoapifyFeatureCount(data) === 5 && geoapifyFeatureCount({ invalid: true }) === null,
    "Distinguish valid empty set from API failure");
});

Deno.test("Barber niche excludes generic salons without fabricating a classification", () => {
  const base: GeoapifyPlacePreview = {
    source: "geoapify", sourceId: "geoapify:1", name: "Barbearia do Centro",
    category: "service.beauty.hairdresser", address: null, city: "Lavras",
    state: "MG", latitude: -21, longitude: -45,
  };
  const places = [
    base, { ...base, sourceId: "geoapify:2", name: "Salão de Beleza" },
  ];
  assert(filterGeoapifyForNiche(places, "Barbearia").length === 1,
    "Generic salons must not be listed as barbershops");
  assert(filterGeoapifyForNiche(places, "Salão de Beleza").length === 2,
    "Salons can retain mixed hairdresser results");
});
