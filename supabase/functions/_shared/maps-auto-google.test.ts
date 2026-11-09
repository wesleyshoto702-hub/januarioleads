import { ALL_SEARCH_SEGMENTS } from "./niche-catalog.ts";
import { BRAZIL_STATES } from "./brazil-locations.ts";
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


const capitals: Record<string, string> = {
  AC:"Rio Branco",AL:"Maceió",AP:"Macapá",AM:"Manaus",BA:"Salvador",
  CE:"Fortaleza",DF:"Brasília",ES:"Vitória",GO:"Goiânia",MA:"São Luís",
  MT:"Cuiabá",MS:"Campo Grande",MG:"Belo Horizonte",PA:"Belém",
  PB:"João Pessoa",PR:"Curitiba",PE:"Recife",PI:"Teresina",
  RJ:"Rio de Janeiro",RN:"Natal",RS:"Porto Alegre",RO:"Porto Velho",
  RR:"Boa Vista",SC:"Florianópolis",SP:"São Paulo",SE:"Aracaju",TO:"Palmas",
};

Deno.test("All 27 Brazilian states accept their own municipality, reject a wrong UF", () => {
  if (BRAZIL_STATES.length !== 27) throw new Error("Incomplete states");
  for (const state of BRAZIL_STATES) {
    const city = capitals[state.code];
    if (!city) throw new Error("No representative city for " + state.code);
    const place = {
      id:"capital-" + state.code,displayName:{text:"Empresa"},
      formattedAddress:"Centro, " + city + " - " + state.code + ", Brasil",
      addressComponents:[
        { longText:city, types:["locality"] },
        { longText:state.name, shortText:state.code, types:["administrative_area_level_1"] },
        { longText:"Brasil", shortText:"BR", types:["country"] },
      ],
    };
    if (!googlePlaceMatchesLocation(place,city,state.code)) {
      throw new Error("Correct capital discarded for " + state.code);
    }
    if (googlePlaceMatchesLocation(place,city,state.code === "MG" ? "SP" : "MG")) {
      throw new Error("Business from another state accepted: " + state.code);
    }
  }
});

Deno.test("Every currently selectable niche has a Google Text Search term", () => {
  if (ALL_SEARCH_SEGMENTS.length !== 196) throw new Error("Catalog changed: review mappings");
  for (const segment of ALL_SEARCH_SEGMENTS) {
    const term = mapsSearchTerm(segment);
    if (typeof term !== "string" || term.length < 2) {
      throw new Error("Search term absent for: " + segment);
    }
    // Only reviewed OSM categories can go through Geoapify; other niches
    // route to Google in exactly the same click, not a false no-match.
    const geo = shouldTryGeoapify(segment, "", true);
    if (typeof geo !== "boolean") throw new Error("Invalid routing for " + segment);
  }
});

Deno.test("Brasília/DF accepts district addresses but rejects other UFs and countries", () => {
  const place = {
    id:"taguatinga-123",displayName:{text:"Empresa"},
    formattedAddress:"Taguatinga, Brasília - DF, Brasil",
    addressComponents:[
      {longText:"Taguatinga",types:["locality"]},
      {longText:"Distrito Federal",shortText:"DF",types:["administrative_area_level_1"]},
      {longText:"Brasil",shortText:"BR",types:["country"]},
    ],
  };
  if (!googlePlaceMatchesLocation(place,"Brasília","DF")) {
    throw new Error("DF administrative region rejected");
  }
  if (googlePlaceMatchesLocation(place,"Brasília","GO")) {
    throw new Error("DF business accepted as Goiás");
  }
  const foreign = {...place,addressComponents:[
    ...place.addressComponents.filter((part)=>!part.types.includes("country")),
    {longText:"Argentina",shortText:"AR",types:["country"]},
  ]};
  if (googlePlaceMatchesLocation(foreign,"Brasília","DF")) {
    throw new Error("Foreign company accepted");
  }
});

Deno.test("Municipality can be reported in secondary address component", () => {
  const place = {
    id:"interior-123", displayName:{text:"Empresa"},
    formattedAddress:"Centro, Viçosa - MG",
    addressComponents:[
      {longText:"Centro",types:["locality"]},
      {longText:"Viçosa",types:["administrative_area_level_2"]},
      {longText:"Minas Gerais",shortText:"MG",types:["administrative_area_level_1"]},
    ],
  };
  if (!googlePlaceMatchesLocation(place,"Viçosa","MG")) {
    throw new Error("Municipality in admin level 2 was discarded");
  }
  if (googlePlaceMatchesLocation(place,"Uberlândia","MG")) {
    throw new Error("Other municipality was accepted");
  }
});
