import {
  geoapifyCategoryForSegment,
  normalizeGeoapifyPlaces,
  resolveGeoapifyCityId,
} from "./geoapify-adapter.ts";

Deno.test("mapeamento Geoapify é explícito e não dispara buscas genéricas", () => {
  if (geoapifyCategoryForSegment("Barbearia") !== "service.beauty.hairdresser") throw new Error("barbearia");
  if (geoapifyCategoryForSegment("Academia") !== "sport.fitness.gym") throw new Error("academia");
  if (geoapifyCategoryForSegment("Salão de Beleza") !== "service.beauty.hairdresser") throw new Error("acentos");
  if (geoapifyCategoryForSegment("Segmento inventado") !== null) throw new Error("unmapped segment accepted");
});

Deno.test("cidade homônima fora do estado ou país não pode direcionar a busca", () => {
  const data = { features: [
    { properties: { place_id: "1234", city: "Lavras", state: "Paraná", country_code: "br" } },
    { properties: { place_id: "5678", city: "Lavras", state: "Minas Gerais", country_code: "br" } },
    { properties: { place_id: "9999", city: "Lavras", state: "Minas Gerais", country_code: "us" } },
  ] };
  if (resolveGeoapifyCityId(data, "Lavras", "MG") !== "5678") throw new Error("wrong city");
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
