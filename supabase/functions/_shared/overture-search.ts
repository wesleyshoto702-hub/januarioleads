import { resolveSearchSegment } from "./niche-catalog.ts";
import {providerInstagramCandidate,type PublicInstagramCandidate} from "./public-instagram-candidate.ts";

/**
 * Commercially focused, conservative category mapping for the Overture
 * Places dataset already imported into private Supabase STAGING.
 * Unmapped niches return no Overture candidates and fall back to Geoapify.
 * No guessed category contains; only explicit exact taxonomy keys.
 */
export const OVERTURE_CATEGORIES: Record<string, readonly string[]> = {
  "Açougue": ["butcher_shop"], "Cafeteria": ["coffee_shop","cafe"],
  "Confeitaria": ["bakery","dessert_shop"],"Doceria":["dessert_shop","candy_store"],
  "Hamburgueria": ["hamburger_restaurant","burger_restaurant"],
  "Hortifruti": ["fruit_and_vegetable_store","greengrocer","produce_store"],
  "Padaria": ["bakery"],"Peixaria":["seafood_market"],
  "Pizzaria": ["pizza_restaurant"],"Restaurante":["restaurant","brazilian_restaurant","barbecue_restaurant","steakhouse"],
  "Sorveteria":["ice_cream_shop"],
  "Barbearia":["barber"],"Salão de Beleza":["beauty_salon","hair_salon"],
  "Estúdio de Tatuagem":["tattoo_shop","tattoo_and_piercing"],"Spa":["spa"],
  "Manicure":["nail_salon"],
  "Clínica Odontológica":["dental_clinic","dentist","general_dentistry"],
  "Clínica Médica":["medical_clinic","doctors_office","outpatient_care_facility"],"Farmácia":["pharmacy"],
  "Fisioterapeuta":["physical_therapy_clinic","physiotherapist","physical_therapy"],
  "Ótica":["optician","optical_store","eyewear_store"],"Psicólogo / Terapeuta":["psychologist"],
  "Chaveiro":["locksmith"],"Eletricista":["electrician"],
  "Lavanderia":["laundry","dry_cleaner"],"Marcenaria":["carpenter"],
  "Serralheria":["metal_workshop"],
  "Arquiteto / Escritório de Arquitetura":["architect","architectural_designer"],
  "Construtora":["construction_company"],"Loja de Tintas":["paint_store"],
  "Estacionamento":["parking"],"Estética Automotiva":["car_wash","auto_detailing"],
  "Lava-Rápido":["car_wash"],"Locadora de Veículos":["car_rental"],
  "Loja de Pneus":["tire_shop","tire_dealer_and_repair"],"Loja de Veículos Seminovos":["car_dealer","used_car_dealer","auto_dealer"],
  "Mecânica Automotiva":["automotive_repair","auto_repair"],
  "Oficina de Motos":["motorcycle_repair_shop","motorcycle_repair"],
  "Academia":["gym","fitness_center"],"Academia de Artes Marciais":["martial_arts_school"],
  "Autoescola":["driving_school"],"Berçário / Creche":["day_care_center"],
  "Escola de Idiomas":["language_school"],"Escola de Música":["music_school"],
  "Escola Infantil":["preschool"],"Casa de Festas":["event_venue"],
  "Agência de Viagens":["travel_agency"],"Hostel":["hostel"],
  "Hotel":["hotel"],"Pousada":["inn","guest_house","bed_and_breakfast"],
  "Resort":["resort"],
  "Contabilidade":["accountant"],"Escritório de Advocacia":["attorney_or_law_firm"],
  "Gráfica Rápida":["printing_service"],"Clínica de Pilates":["pilates_studio"],
  "Loja de Moda Infantil":["childrens_clothing_store"],
  "Laboratório de Análises Clínicas":["laboratory_testing"],
  "Fotógrafo":["photographer"],"Coworking":["coworking_space"],
  "Floricultura":["florist","flowers_and_gifts_store"],"Imobiliária":["real_estate_agency","real_estate_service","real_estate_agent"],
  "Joalheria":["jewelry_store"],"Loja de Bicicletas":["bicycle_store"],
  "Loja de Calçados":["shoe_store"],"Loja de Informática":["computer_store"],
  "Loja de Instrumentos Musicais":["musical_instrument_store"],
  "Loja de Materiais de Construção":["building_materials_store","building_supply_store","hardware_store"],
  "Loja de Móveis":["furniture_store"],"Loja de Presentes":["gift_shop"],
  "Loja de Roupas":["clothing_store","womens_clothing_store","mens_clothing_store","fashion_boutique"],"Papelaria / Artesanato":["stationery_store"],
  "Clínica Veterinária":["veterinary_care","veterinarian"],"Pet Shop":["pet_store"],
  "Loja Agropecuária":["agricultural_supply_store"],
  "Transportadora":["trucking_company","transportation_service"],
  "Agência de Turismo Receptivo":["tour_operator"],
  "Aluguel de Temporada":["holiday_rental_home"],
  "Assistência Técnica de Celular":["mobile_phone_repair"],
};
export type OverturePlace = {
  id: string; name: string; category: string | null; city: string;
  state: string; address: string | null; latitude: number | null;
  longitude: number | null; phone: string | null; email: string | null;
  website: string | null; instagram: string | null;
  confidence: number | null; operating_status: string | null;
};
export type OvertureBusiness = {
  placeId: string; source: "overture"; sourceUrl: string | null;
  name: string; primaryCategory: string | null; categories: string[];
  description: string | null; address: string | null; neighborhood: null;
  city: string | null; state: string | null;
  phone: string | null; internationalPhone: null;
  rating: null; reviewCount: null; isOpenNow: null;
  openingHours: string[]; currentOpeningHours: null; regularOpeningHours: null;
  website: string | null; email: string | null; instagram: null;
  instagramCandidates: PublicInstagramCandidate[];
  instagramConfidence: null;
  googleMapsUrl: null; businessStatus: string | null;
  latitude: number | null; longitude: number | null;
};
export type OvertureOutcome =
  | { ok: true; results: OvertureBusiness[]; allCount: number; nextPageToken: string | null }
  | { ok: false; reason: "UNAVAILABLE" };

const PAGE_SIZE=20;
const MAX_OFFSET=80;
function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function phoneUseful(value: string|null) {
  const n=(value||"").replace(/\D/g,"");
  return n.length>=10 && n.length<=13;
}
function validPlace(value: unknown): value is OverturePlace {
  const p=value as Partial<OverturePlace>|null;
  return Boolean(p && typeof p.id==="string" && p.id.length>0 &&
    typeof p.name==="string" && p.name.length>0 &&
    typeof p.city==="string" && typeof p.state==="string");
}
function leadScore(place: OverturePlace) {
  return Number(phoneUseful(place.phone))*12 + Number(Boolean(place.email))*7 +
    Number(Boolean(place.website))*5 + Number(Boolean(place.instagram))*3 +
    Number(place.confidence||0)*4;
}
function toBusiness(p: OverturePlace): OvertureBusiness {
  return {
    placeId:"overture:"+p.id, source:"overture",
    sourceUrl:"https://explore.overturemaps.org/", name:p.name, primaryCategory:p.category,
    categories:p.category?[p.category]:[],description:null,
    address:p.address,neighborhood:null,city:p.city,state:p.state,
    phone:p.phone,internationalPhone:null,rating:null,reviewCount:null,
    isOpenNow:null,openingHours:[],currentOpeningHours:null,regularOpeningHours:null,
    website:p.website,email:p.email,instagram:null,
    instagramCandidates:providerInstagramCandidate(p.instagram,"Overture")
      ? [providerInstagramCandidate(p.instagram,"Overture")!] : [],
    instagramConfidence:null,googleMapsUrl:null,
    businessStatus:p.operating_status,
    latitude:p.latitude,longitude:p.longitude,
  };
}
/** Exported for offline testing. */
export function categoriesForOverture(segment: string): readonly string[] {
  const canonical=resolveSearchSegment(segment);
  return canonical ? OVERTURE_CATEGORIES[canonical]??[] : [];
}
export function isRelevantOverture(place: OverturePlace,segment: string) {
  const cats=categoriesForOverture(segment);
  if(!cats.includes(place.category||""))return false;
  const key=resolveSearchSegment(segment);
  if (key==="Barbearia") return (
    normalized(place.name).includes("barbearia") ||
    normalized(place.name).includes("barber") ||
    normalized(place.name).includes("barbeiro") ||
    place.category==="barber"
  );
  return true;
}
export function enoughRelevantResults(results: readonly {
  name: string; phone: string|null; internationalPhone: string|null;
}[]) {
  return results.length>=8 &&
    results.filter(x=>phoneUseful(x.phone||x.internationalPhone)).length>=5;
}
/**
 * Query private Overture through service-role PostgREST on the server ONLY.
 * When an exact niche has no mapping, deliberately return 0, not a broad
 * unrelated category. Fresh imports are visible immediately.
 */
export async function searchOverture(
  input: { segment:string; city:string; state:string; offset?:number },
  adminRest:(path:string,init?:RequestInit)=>Promise<Response|null>
):Promise<OvertureOutcome>{
  const categories=categoriesForOverture(input.segment);
  const offset=input.offset??0;
  if(!Number.isInteger(offset)||offset<0||offset>MAX_OFFSET||offset%PAGE_SIZE!==0)
    return {ok:false,reason:"UNAVAILABLE"};
  if(!categories.length) return {ok:true,results:[],allCount:0,nextPageToken:null};
  const query=new URLSearchParams({
    select:"id,name,category,city,state,address,latitude,longitude,phone,email,website,instagram,confidence,operating_status",
    state:"eq."+input.state.toUpperCase(),
    city_key:"eq."+normalized(input.city),
    category:"in.("+categories.join(",")+")",
    limit:"100",
  });
  let response:Response|null;
  try{response=await adminRest("overture_places?"+query.toString());}
  catch{return {ok:false,reason:"UNAVAILABLE"};}
  if(!response?.ok)return {ok:false,reason:"UNAVAILABLE"};
  try{
    const payload:unknown=await response.json();
    if(!Array.isArray(payload))return {ok:false,reason:"UNAVAILABLE"};
    const filtered=payload.filter(validPlace).filter(p=>isRelevantOverture(p,input.segment))
      .filter(p=>p.operating_status!=="permanently_closed")
      .sort((a,b)=>leadScore(b)-leadScore(a)||a.name.localeCompare(b.name,"pt-BR"));
    const unique:OverturePlace[]=[];
    const seen=new Set<string>();
    for(const p of filtered){
      const signature=normalized(p.name)+"|"+normalized(p.address||"")+"|"+p.city+"|"+p.state;
      if(seen.has(signature))continue;
      seen.add(signature);
      unique.push(p);
    }
    return {ok:true,results:unique.slice(offset,offset+PAGE_SIZE).map(toBusiness),
      allCount:unique.length,
      nextPageToken:unique.length>offset+PAGE_SIZE&&offset+PAGE_SIZE<=MAX_OFFSET
        ?"overture:"+(offset+PAGE_SIZE):null};
  }catch{return {ok:false,reason:"UNAVAILABLE"};}
}
