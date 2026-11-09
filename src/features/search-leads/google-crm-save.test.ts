import { googleCrmNeedsOwnName, googlePlaceIdAndOwnName } from "./google-crm-save.ts";
import type { BusinessSearchResult } from "./types.ts";

const google: BusinessSearchResult = {
  placeId: "ChIJ-checked-google-1234", equivalentPlaceId: "geoapify:osm1234",
  name: "Nome obtido do Google", primaryCategory: "Loja", categories: ["store"],
  description: "Descrição que não pode ser copiada",
  address: "Rua de Exemplo 42", neighborhood: "Centro",
  city: "Lavras", state: "MG", phone: "(35) 99999-9999",
  internationalPhone: "+5535999999999", rating: 4.9, reviewCount: 200,
  isOpenNow: true, openingHours: ["Seg-Sex"],
  currentOpeningHours: null, regularOpeningHours: null,
  website: "https://provider.example", instagram: "https://instagram.com/example",
  googleMapsUrl: "https://maps.google.com/test", businessStatus: "OPERATIONAL",
  latitude: -21.24, longitude: -44.99,
  factualDescription: "Descrição derivada", previewOnly: false,
  verifiedContent: { title: "Não persistir" } as BusinessSearchResult["verifiedContent"],
};

Deno.test("staging Google CRM saves only own name and allowed Place ID", () => {
  if (!googleCrmNeedsOwnName(google)) throw new Error("Expected Google input");
  const saved=googlePlaceIdAndOwnName(google,"  Nome digitado pelo cliente  ");
  if(!saved) throw new Error("Expected sanitized result");
  if(saved.name!=="Nome digitado pelo cliente" ||
      saved.placeId!==google.placeId || saved.crmManualName!==true ||
      saved.equivalentPlaceId!==google.equivalentPlaceId)
    throw new Error("Own name/IDs were not preserved");
  for(const field of ["address","neighborhood","city","state","phone",
    "internationalPhone","website","instagram","googleMapsUrl","latitude",
    "longitude","description","primaryCategory","rating","reviewCount",
    "businessStatus","factualDescription","verifiedContent"] as const) {
    if(saved[field] != null) throw new Error("Copied Google content: "+field);
  }
  if(saved.categories.length || saved.openingHours.length ||
      saved.isOpenNow!==null || saved.currentOpeningHours!==null ||
      saved.regularOpeningHours!==null) throw new Error("Copied Google provider lists or state");
});

Deno.test("Google CRM rejects missing or invalid manually entered labels", () => {
  if(googlePlaceIdAndOwnName(google,"")) throw new Error("Empty label accepted");
  if(googlePlaceIdAndOwnName(google,"ok")) throw new Error("Short label accepted");
  if(googlePlaceIdAndOwnName(google,"X".repeat(121))) throw new Error("Overlong label accepted");
});

Deno.test("Google helper never changes an OSM/Geoapify record", () => {
  const osm={...google,placeId:"geoapify:osm1234"};
  if(googleCrmNeedsOwnName(osm)) throw new Error("OSM incorrectly classified as Google");
  if(googlePlaceIdAndOwnName(osm,"Nome digitado"))
    throw new Error("Google conversion accepted an OSM ID");
});
