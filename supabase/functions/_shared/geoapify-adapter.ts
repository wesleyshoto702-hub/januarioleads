import { findBrazilianState } from "./brazil-locations.ts";
import { SEGMENT_GROUPS, resolveSearchSegment } from "./niche-catalog.ts";

/** Explicit OSM categories: a niche without a reviewed mapping does not trigger a broad query. */
const SEGMENT_CATEGORIES: Record<string, string> = {

  // Reviewed specific taxonomy values; unknown categories never invented.
  "clinica odontologica": "healthcare.dentist",
  "cardiologista": "healthcare.clinic_or_praxis.cardiology",
  "dermatologista": "healthcare.clinic_or_praxis.dermatology",
  "ginecologista": "healthcare.clinic_or_praxis.gynaecology",
  "ortopedista": "healthcare.clinic_or_praxis.orthopaedics",
  "pediatra": "healthcare.clinic_or_praxis.paediatrics",
  "psiquiatra": "healthcare.clinic_or_praxis.psychiatry",
  "farmacia": "healthcare.pharmacy",
  "otica": "commercial.health_and_beauty.optician",
  "bronzeamento": "service.beauty.tanning_salon",
  "estudio de tatuagem": "service.beauty.tattoo",
  "massoterapeuta": "service.beauty.massage",
  "chaveiro": "service.locksmith",
  "eletricista": "service.electrician",
  "lavanderia": "service.cleaning.laundry",
  "marcenaria": "service.carpenter",
  "serralheria": "service.metal_construction",
  "loja de tintas": "commercial.houseware_and_hardware.building_materials.paint",
  "loja de materiais de construcao": "commercial.houseware_and_hardware.building_materials",
  "locadora de veiculos": "rental.car",
  "lava-rapido": "service.vehicle.car_wash",
  "mecanica automotiva": "service.vehicle.repair.car",
  "oficina de motos": "service.vehicle.repair.motorcycle",
  "academia de artes marciais": "sport.dojo",
  "autoescola": "education.driving_school",
  "bercario / creche": "childcare.kindergarten",
  "escola de idiomas": "education.language_school",
  "escola de musica": "education.music_school",
  "escola de natacao": "sport.swimming_pool",
  "casa de festas": "activity.events_venue",
  "contabilidade": "office.accountant",
  "fotografo": "service.photographer",
  "fotografia de eventos": "service.photographer",
  "imobiliaria": "office.estate_agent",
  "consultoria financeira": "office.financial_advisor",
  "consultoria empresarial": "office.consulting",
  "coworking": "office.coworking",
  "agencia de publicidade": "office.advertising_agency",
  "empresa de recrutamento": "office.employment_agency",
  "servicos de ti para empresas": "office.it",
  "desenvolvimento de software": "office.it",
  "empresa de limpeza residencial": "service.cleaning",
  "empresa de limpeza comercial": "service.cleaning",
  "loja de informatica": "commercial.elektronics",
  "loja de instrumentos musicais": "commercial.hobby.music",
  "loja de moveis": "commercial.furniture_and_interior",
  "loja de colchoes": "commercial.furniture_and_interior.bed",
  "loja de suplementos": "commercial.health_and_beauty",
  "papelaria / artesanato": "commercial.stationery",
  "banho e tosa": "pet.service",
  "creche para caes": "pet.animal_boarding",
  "loja de racoes": "pet.shop",

  "clinica medica": "healthcare.clinic_or_praxis",
  barbearia: "service.beauty.hairdresser",
  "salao de beleza": "service.beauty.hairdresser",
  academia: "sport.fitness.gym",
  restaurante: "catering.restaurant",
  cafeteria: "catering.cafe",
  pizzaria: "catering.restaurant.pizza",
  spa: "service.beauty.spa",
  // Reviewed category keys from the official Geoapify Places taxonomy.
  // Ambiguous/specialized niches continue directly to Google Text Search.
  padaria: "commercial.food_and_drink.bakery",
  acougue: "commercial.food_and_drink.butcher",
  peixaria: "commercial.food_and_drink.seafood",
  hortifruti: "commercial.food_and_drink.fruit_and_vegetable",
  doceria: "commercial.food_and_drink.confectionery",
  sorveteria: "commercial.food_and_drink.ice_cream",
  floricultura: "commercial.florist",
  joalheria: "commercial.jewelry",
  "loja de roupas": "commercial.clothing.clothes",
  "loja de calcados": "commercial.clothing.shoes",
  "loja de moda infantil": "commercial.clothing.kids",
  "loja de bicicletas": "commercial.outdoor_and_sport.bicycle",
  "loja de presentes": "commercial.gift_and_souvenir",
  "loja de iluminacao": "commercial.furniture_and_interior.lighting",
  "loja de cortinas": "commercial.furniture_and_interior.curtain",
  "loja de produtos naturais": "commercial.food_and_drink.health_food",
  "loja agropecuaria": "commercial.agrarian",
  "pet shop": "pet.shop",
  "clinica veterinaria": "pet.veterinary",
  "hotel para pets": "pet.animal_boarding",
  hotel: "accommodation.hotel",
  hostel: "accommodation.hostel",
  "chales para temporada": "accommodation.chalet",
  pousada: "accommodation.guest_house",
  estacionamento: "parking.cars",
  "cartorio / servicos notariais": "office.notary",
  "escritorio de advocacia": "office.lawyer",
  "corretor de seguros": "office.insurance",
  "agencia de viagens": "office.travel_agent",
  transportadora: "office.logistics",
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

export function geoapifyCategoryForSegment(segment: string): string | null {
  return SEGMENT_CATEGORIES[normalize(segment)] ?? null;
}


/**
 * Every canonical niche can be queried by Geoapify. Exact category mappings
 * are preferred; other niches use a category constrained by their catalog
 * group plus a server-side place-name match. This is best-effort OSM coverage,
 * not proof that every activity/place exists in the source.
 */
export type GeoapifySearchPlan = {
  categories:string; name:string|null; matchMode:"category"|"name";
};
const GROUP_FALLBACK_CATEGORIES: Record<string,string> = {
  "Alimentação":"catering,commercial.food_and_drink",
  "Beleza e estética":"service.beauty,commercial.health_and_beauty",
  "Saúde":"healthcare,commercial.health_and_beauty",
  "Serviços residenciais":"service,office",
  "Construção e reformas":"service,office,commercial.houseware_and_hardware",
  "Casa e decoração":"commercial.furniture_and_interior,service,commercial",
  "Automotivo":"service.vehicle,commercial.vehicle,office",
  "Educação e esportes":"education,childcare,sport",
  "Eventos":"activity,entertainment,office,service",
  "Turismo e hospedagem":"accommodation,tourism,office",
  "Serviços profissionais":"office,service",
  "Serviços empresariais":"office,service",
  "Comércio":"commercial",
  "Pets":"pet,commercial.pet",
  "Agronegócio":"commercial.agrarian,office",
  "Logística":"office.logistics,service",
};
const NAME_TERMS:Record<string,string> = {
  "acaiteria":"açaí",
  "depilacao a laser":"depilação",
  "design de sobrancelhas":"sobrancelhas",
  "micropigmentacao":"micropigmentação",
  "clinica de pilates":"pilates",
  "estetica / depilacao":"depilação",
  "clinica de exames":"exames",
  "clinica de imagem":"imagem",
  "laboratorio de analises clinicas":"laboratório",
  "empresa de construcao de piscinas":"piscinas",
  "instalacao de portoes automaticos":"portões",
  "refrigeracao / ar condicionado":"ar condicionado",
  "seguranca eletronica / alarmes":"alarmes",
  "loja de veiculos seminovos":"seminovos",
  "assistencia tecnica de celular":"celular",
  "agencia de turismo receptivo":"turismo",
  "locadora de roupas / festas":"trajes",
  "sistemas de irrigacao":"irrigação",
  "motoboy / entregas":"motoboy",
};
export function geoapifySearchPlanForSegment(value:string):GeoapifySearchPlan|null{
  const canonical=resolveSearchSegment(value);
  if(!canonical)return null;
  const mapped=geoapifyCategoryForSegment(canonical);
  if(mapped)return {categories:mapped,name:null,matchMode:"category"};
  const group=SEGMENT_GROUPS.find(g=>g.items.includes(canonical));
  const categories=group ? GROUP_FALLBACK_CATEGORIES[group.label] : null;
  if(!categories)return null;
  const name=NAME_TERMS[normalize(canonical)]??canonical;
  return {categories,name:name.slice(0,80),matchMode:"name"};
}

/** Retain strict barber matches; distinguish uncertain related hairdressers. */
export function selectGeoapifyPlaces(candidates:GeoapifyPlacePreview[],segment:string,max=25):
  {places:GeoapifyPlacePreview[];matchMode:"category"|"related"}{
  const confirmed=filterGeoapifyForNiche(candidates,segment);
  if(confirmed.length>0)return {places:confirmed.slice(0,max),matchMode:"category"};
  if(normalize(segment)!=="barbearia")return {places:[],matchMode:"category"};
  // Not every OSM hairdresser has a barber-specific tag. Never label known
  // beauty salons as barbershops; remaining leads require manual checking.
  const related=candidates.filter(p=> !/\b(salao|beauty salon|salao feminino)\b/.test(normalize(p.name)));
  return {places:related.slice(0,max).map(p=>({...p,matchQuality:"related"})),matchMode:"related"};
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Avoid querying a homonymous city in another country or Brazilian state. */
export type GeoapifyCityLocation = { placeId: string; lon: number; lat: number };

/** Coordinates and boundary must come from the *same* validated city result. */
export function resolveGeoapifyCityLocation(
  geocodingGeoJson: unknown,
  city: string,
  stateCode: string,
): GeoapifyCityLocation | null {
  const envelope = record(geocodingGeoJson);
  const features = Array.isArray(envelope?.features) ? envelope.features : [];
  const state = findBrazilianState(stateCode);
  if (!state) return null;

  for (const feature of features) {
    const props = record(record(feature)?.properties);
    if (!props) continue;
    const country = stringField(props.country_code);
    const actualCity = stringField(props.city) ?? stringField(props.name);
    const actualState = stringField(props.state);
    const actualStateCode = stringField(props.state_code);
    const matchesState = Boolean(
      actualState && normalize(actualState) === normalize(state.name)
    ) || Boolean(
      actualStateCode && ["BR-" + state.code, state.code].includes(actualStateCode.toUpperCase())
    );
    const id = stringField(props.place_id);
    if (country?.toLowerCase() !== "br" || !actualCity ||
        normalize(actualCity) !== normalize(city) || !matchesState ||
        !id || !/^[a-zA-Z0-9]+$/.test(id)) continue;
    const geometry = record(record(feature)?.geometry);
    const coordinates = geometry?.coordinates;
    const lon = typeof props.lon === "number" ? props.lon
      : Array.isArray(coordinates) ? coordinates[0] : null;
    const lat = typeof props.lat === "number" ? props.lat
      : Array.isArray(coordinates) ? coordinates[1] : null;
    if (typeof lon !== "number" || typeof lat !== "number" ||
        !Number.isFinite(lon) || !Number.isFinite(lat) ||
        Math.abs(lon) > 180 || Math.abs(lat) > 90) continue;
    return { placeId: id, lon, lat };
  }
  return null;
}

/** Compatibility for consumers that only need the municipal boundary ID. */
export function resolveGeoapifyCityId(
  geocodingGeoJson: unknown,
  city: string,
  stateCode: string,
): string | null {
  return resolveGeoapifyCityLocation(geocodingGeoJson, city, stateCode)?.placeId ?? null;
}

/** Distinguish genuine Geoapify zero matches from an unexpected response schema. */
export function geoapifyFeatureCount(data: unknown): number | null {
  const payload = record(data);
  return Array.isArray(payload?.features) ? payload.features.length : null;
}

export type GeoapifyCoverageStatus =
  | "matches"
  | "no_osm_category_matches"
  | "unconfirmed_nearby";

/** A provider returning zero records must not be conflated with an API failure. */
export function classifyGeoapifyCoverage(
  resultCount: number,
  nearbyChecked: boolean,
): GeoapifyCoverageStatus {
  if (resultCount > 0) return "matches";
  return nearbyChecked ? "no_osm_category_matches" : "unconfirmed_nearby";
}

export type GeoapifyPlacePreview = {
  source: "geoapify";
  sourceId: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  matchQuality?: "related" | "name";
};

/** Provider provenance is retained. Never convert an OSM id into a Google Place ID. */
/** Geoapify groups all hairdressers under the same OSM category.
 * A barbershop query must not show unrelated salons as if they were barbers.
 * Ambiguous names go to the separate Google search instead of being mislabelled.
 */
export function filterGeoapifyForNiche(
  places: GeoapifyPlacePreview[], segment: string,
): GeoapifyPlacePreview[] {
  if (normalize(segment) !== "barbearia") return places;
  return places.filter((place) =>
    /\b(barbearia|barbeiro|barber|barbershop|barber shop)\b/.test(normalize(place.name))
  );
}

export function normalizeGeoapifyPlaces(
  data: unknown,
  location: { city: string; state: string },
  maxResults = 20,
): GeoapifyPlacePreview[] {
  const envelope = record(data);
  const features = Array.isArray(envelope?.features) ? envelope.features : [];
  const seen = new Set<string>();
  const output: GeoapifyPlacePreview[] = [];
  for (const feature of features) {
    const item = record(feature);
    const props = record(item?.properties);
    const geometry = record(item?.geometry);
    const coordinates = geometry?.coordinates;
    if (!props) continue;
    const name = stringField(props.name);
    const placeId = stringField(props.place_id);
    const lon = Array.isArray(coordinates) ? coordinates[0] : props.lon;
    const lat = Array.isArray(coordinates) ? coordinates[1] : props.lat;
    if (!name || !placeId || !/^[a-zA-Z0-9]+$/.test(placeId) ||
        typeof lat !== "number" || typeof lon !== "number" ||
        !Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180 ||
        seen.has(placeId)) continue;
    // Radius searches near borders can include businesses beyond the chosen UF.
    // Keep valid nearby towns in the selected state, but not another state/country.
    const country = stringField(props.country_code);
    if (country && country.toLowerCase() !== "br") continue;
    const reportedCity = stringField(props.city);
    const reportedState =
      findBrazilianState(stringField(props.state_code)?.replace(/^BR-/i, "")) ??
      findBrazilianState(stringField(props.state));
    if (reportedState && reportedState.code !== location.state) continue;
    const address = stringField(props.formatted) ?? stringField(props.address_line1);
    seen.add(placeId);
    output.push({
      source: "geoapify",
      sourceId: "geoapify:" + placeId,
      name,
      category: Array.isArray(props.categories) &&
        typeof props.categories[0] === "string" ? props.categories[0] : null,
      address,
      city: reportedCity ?? location.city,
      state: reportedState?.code ?? location.state,
      latitude: lat,
      longitude: lon,
    });
    if (output.length >= Math.min(200,Math.max(1,maxResults))) break;
  }
  return output;
}
