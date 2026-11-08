import {
  geoapifyCategoryForSegment,
  geoapifyFeatureCount,
  normalizeGeoapifyPlaces,
  resolveGeoapifyCityId,
  resolveGeoapifyCityLocation,
} from "./geoapify-adapter.ts";

Deno.test("mapeamento Geoapify é explícito e não dispara buscas genéricas", () => {
  if (geoapifyCategoryForSegment("Barbearia") !== "service.beauty.hairdresser") throw new Error("barbearia");
  if (geoapifyCategoryForSegment("Academia") !== "sport.fitness.gym") throw new Error("academia");
  if (geoapifyCategoryForSegment("Salão de Beleza") !== "service.beauty.hairdresser") throw new Error("acentos");
  if (geoapifyCategoryForSegment("Segmento inventado") !== null) throw new Error("unmapped segment accepted");
});

Deno.test("cidade homônima fora do estado ou país não pode direcionar a busca", () => {
  const data = { features: [
    { properties: { place_id: "1234", city: "Lavras", state: "Paraná", country_code: "br", lon: -49, lat: -22 } },
    { properties: { place_id: "5678", city: "Lavras", state: "Minas Gerais", country_code: "br", lon: -44.9991978, lat: -21.2425512 } },
    { properties: { place_id: "9999", city: "Lavras", state: "Minas Gerais", country_code: "us", lon: -90, lat: 25 } },
  ] };
  if (resolveGeoapifyCityId(data, "Lavras", "MG") !== "5678") throw new Error("wrong city");
  const location = resolveGeoapifyCityLocation(data, "Lavras", "MG");
  if (location?.lon !== -44.9991978 || location?.lat !== -21.2425512) {
    throw new Error("city coordinates must belong to the exact validated city");
  }
  if (resolveGeoapifyCityId(data, "Lavras", "SP") !== null) throw new Error("unrelated state");
});

Deno.test("normalização descarta dados inválidos e mantém proveniência OSM", () => {
  const item = (place_id: string, name: string) => ({
    properties: { place_id, name, formatted: "Rua Exemplo" },
    geometry: { coordinates: [-44.5, -21.3] },
  });
  const data = { features: [
    item("abc123", "Barbearia"),
    item("abc123", "Duplicada"),
    item("invalid!", "Id inválido"),
    { properties: { place_id: "xyz", name: "Sem geo" } },
  ] };
  const places = normalizeGeoapifyPlaces(data, { city: "Lavras", state: "MG" });
  if (places.length !== 1 || places[0]?.source !== "geoapify" ||
      places[0]?.sourceId !== "geoapify:abc123" ||
      places[0]?.latitude !== -21.3 ||
      places[0]?.longitude !== -44.5) throw new Error("normalization failed");
  if ("phone" in places[0]!) throw new Error("contact data must not leak");
});


Deno.test("cidade com ID mas sem coordenadas não é aceita como localização", () => {
  const input = { features: [
    { properties: { city: "Lavras", state: "Minas Gerais", country_code: "br", place_id: "abc" } },
  ] };
  if (resolveGeoapifyCityLocation(input, "Lavras", "MG") !== null) {
    throw new Error("location without coordinates accepted");
  }
});

Deno.test("cobertura ausente é diferente de um payload inválido", () => {
  if (geoapifyFeatureCount({ features: [] }) !== 0) throw new Error("empty coverage");
  if (geoapifyFeatureCount({ features: [{ properties: {} }] }) !== 1) {
    throw new Error("nonempty raw data not counted");
  }
  if (geoapifyFeatureCount({ wrong: [] }) !== null) throw new Error("invalid response");
});

Deno.test("usa coordenadas e município reais quando presentes no Geoapify", () => {
  const data = { features: [{
    properties: {
      name: "Barbearia Exemplo", place_id: "5112345678",
      lon: -45.0, lat: -21.2, city: "Ribeirão Vermelho", state: "Minas Gerais",
    },
  }] };
  const places = normalizeGeoapifyPlaces(data, { city: "Lavras", state: "MG" });
  if (places.length !== 1 || places[0]?.city !== "Ribeirão Vermelho" ||
      places[0]?.state !== "MG" || places[0]?.latitude !== -21.2) {
    throw new Error("lost source locality or coordinates");
  }
});
