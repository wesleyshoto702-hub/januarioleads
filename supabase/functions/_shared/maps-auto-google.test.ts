import {
  googlePlaceMatchesLocation,
  mapsSearchTerm,
  normalizeGooglePreview,
  routingReason,
  shouldTryGeoapify,
} from "./maps-auto-google.ts";

const lavrasComponents = [
  { longText: "Lavras", shortText: "Lavras", types: ["locality"] },
  { longText: "Minas Gerais", shortText: "MG", types: ["administrative_area_level_1"] },
];
const lavrasPlace = (id: string, name: string) => ({
  id,
  displayName: { text: name },
  primaryTypeDisplayName: { text: "Barbearia" },
  formattedAddress: "Rua das Flores, Lavras - MG, Brasil",
  addressComponents: lavrasComponents,
  googleMapsUri: "https://www.google.com/maps/place/" + id,
  location: { latitude: -21.242, longitude: -44.999 },
});

Deno.test("search routing picks Geo for supported niches, Google directly for unavailable categories or neighborhood", () => {
  if (!shouldTryGeoapify("Barbearia", "", true)) throw new Error("Expected Geo");
  if (shouldTryGeoapify("Barbearia", "Centro", true)) throw new Error("Bairro must route directly to Google");
  if (shouldTryGeoapify("Funilaria", "", true)) throw new Error("Unknown OSM category should use Google");
  if (shouldTryGeoapify("Barbearia", "", false)) throw new Error("Disabled OSM provider must not be called");
  if (routingReason(false,false)!=="google_direct") throw new Error("Wrong direct status");
  if (routingReason(true,false)!=="google_fallback") throw new Error("No fallback selection");
  if (routingReason(true,true)!=="geoapify") throw new Error("Wrong Geo status");
  if (mapsSearchTerm("barbearia") !== "Barbearia" ||
      mapsSearchTerm("NOT IN CATALOG") !== null) throw new Error("Segment validation");
});

Deno.test("Google preview keeps only correct city/state, without contact data", () => {
  const otherState = {
    ...lavrasPlace("wrong", "Outra Barbearia"),
    addressComponents: [
      { longText: "Lavras", types: ["locality"] },
      { longText: "Paraná", shortText: "PR", types: ["administrative_area_level_1"] },
    ],
  };
  const results = normalizeGooglePreview({
    places: [
      lavrasPlace("1234", "Barbearia Lavras"),
      lavrasPlace("1234", "Duplicada"),
      otherState,
      lavrasPlace("", "Sem ID"),
      { ...lavrasPlace("nameless", "Foo"), displayName: {} },
    ],
  }, "Lavras", "MG");
  if (results?.length !== 1 || results[0]?.placeId !== "1234" ||
      results[0]?.latitude !== -21.242 || results[0]?.previewOnly !== true ||
      results[0]?.phone !== null || results[0]?.website !== null) {
    throw new Error("Malformed/duplicate/wrong state place was accepted");
  }
});

Deno.test("provider empty JSON is zero results; malformed places is not silently empty", () => {
  if (normalizeGooglePreview({}, "Lavras","MG")?.length !== 0) throw new Error("Empty payload should have no places");
  if (normalizeGooglePreview({places: "invalid"}, "Lavras","MG") !== null)
    throw new Error("Invalid payload cannot be presented as empty");
  if (!googlePlaceMatchesLocation(lavrasPlace("abc","Barbearia"),"Lavras","MG"))
    throw new Error("Correct city rejected");
  if (googlePlaceMatchesLocation(lavrasPlace("abc","Barbearia"),"Belo Horizonte","MG"))
    throw new Error("Wrong city accepted");
});

Deno.test("Google returns at most twenty display-only previews",()=>{
 const many = {places:Array.from({length:30},(_,i)=>lavrasPlace(String(i+1),"Barbearia "+i))};
 const rows=normalizeGooglePreview(many,"Lavras","MG");
 if(rows?.length!==20)throw new Error("Result cap is not enforced");
});
