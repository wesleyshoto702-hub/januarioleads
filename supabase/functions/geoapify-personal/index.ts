import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { findBrazilianState } from "../_shared/brazil-locations.ts";
import { searchTextForSegment } from "../_shared/niche-catalog.ts";
import {
  geoapifySearchPlanForSegment, geoapifyNameFallbackPlanForSegment,
  selectGeoapifyPlaces, normalizeGeoapifyPlaces, resolveGeoapifyCityLocation,
  geoapifyFeatureCount, type GeoapifySearchPlan, type GeoapifyPlacePreview,
} from "../_shared/geoapify-adapter.ts";

const PERSONAL_OWNER = "531d0690-bdb5-4549-b07a-76da37e2ff96";
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function cors(origin: string): Record<string,string> {
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" && (u.hostname === "lovable.app" || u.hostname.endsWith(".lovable.app")) ||
      (u.protocol === "http:" && ["localhost","127.0.0.1"].includes(u.hostname))) {
      return { "Access-Control-Allow-Origin": origin, Vary:"Origin" };
    }
  } catch { /* non-browser requests must still supply a valid JWT */ }
  return {};
}
function answer(request:Request, data:unknown, status=200):Response {
  return new Response(JSON.stringify(data),{status,headers:{...HEADERS,...cors(request.headers.get("origin")??"")}});
}
const fail=(r:Request,code:string,message:string,status=400)=>answer(r,{ok:false,code,message},status);
function text(value:unknown,max=100):string { return typeof value==="string"?value.trim().slice(0,max):""; }

async function authUser(request:Request) {
  const host=Deno.env.get("SUPABASE_URL")?.replace(/\/$/,"");
  const authorization=request.headers.get("authorization")??"";
  const apikey=request.headers.get("apikey")??"";
  if (!host || !/^Bearer\s+\S+$/.test(authorization) || !apikey) return null;
  const headers={authorization,apikey};
  const auth=await fetch(host+"/auth/v1/user",{headers,signal:AbortSignal.timeout(4500)});
  if(!auth.ok)return null;
  const user=await auth.json() as {id?:string};
  if (user.id!==PERSONAL_OWNER) return null;
  const own=await fetch(host+"/rest/v1/private_access?select=user_id&user_id=eq."+
    encodeURIComponent(user.id)+"&limit=1",{headers,signal:AbortSignal.timeout(4500)});
  if(!own.ok)return null;
  const rows=await own.json() as Array<{user_id:string}>;
  if(!Array.isArray(rows)||!rows.some(x=>x.user_id===user.id))return null;
  return {host,headers};
}
function asJson(value:unknown):Record<string,unknown>|null {
  return value!==null && typeof value==="object" && !Array.isArray(value)
    ? value as Record<string,unknown>:null;
}


/**
 * Small personal-use OSM fallback when GEOAPIFY_API_KEY is absent.
 * Never runs for public users, never issues a broad unrestricted query, and
 * shares the existing owner-authenticated 10-searches/day server quota.
 * Community Overpass is not an SLA-backed provider for a public SaaS.
 */
type OsmPlace = {
  source:"osm"; sourceId:string; name:string; category:string|null;
  address:string|null; city:string; state:string;
  latitude:number; longitude:number;
};
type OSMSearchResult =
  | {ok:true;places:OsmPlace[]}
  | {ok:false;code:string;message:string};
const OSM_TAG_FILTERS:Record<string,readonly string[]> = {
  "clinica medica": ['["amenity"="clinic"]','["healthcare"="clinic"]','["healthcare"="doctor"]'],
  "barbearia": ['["shop"="hairdresser"]'],
  "salao de beleza": ['["shop"="hairdresser"]','["shop"="beauty"]'],
  "academia": ['["leisure"="fitness_centre"]'],
  "restaurante": ['["amenity"="restaurant"]'],
  "cafeteria": ['["amenity"="cafe"]'],
  "pizzaria": ['["amenity"="restaurant"]["cuisine"~"pizza",i]'],
  "padaria": ['["shop"="bakery"]'],
  "acougue": ['["shop"="butcher"]'],
  "pet shop": ['["shop"="pet"]'],
  "clinica veterinaria": ['["amenity"="veterinary"]'],
  "floricultura": ['["shop"="florist"]'],
  "hotel": ['["tourism"="hotel"]'],
  "pousada": ['["tourism"="guest_house"]'],
  "loja de roupas": ['["shop"="clothes"]'],
  "loja de calcados": ['["shop"="shoes"]'],
  "escritorio de advocacia": ['["office"="lawyer"]'],
  "estacionamento": ['["amenity"="parking"]'],
};
// Use one documented community endpoint for bounded personal searches.
 // Public overpass-api.de often rejects cloud workers or rate-limits shared IPs.
const OSM_OVERPASS_URL="https://overpass.private.coffee/api/interpreter";
const osmCache=new Map<string,{until:number;places:OsmPlace[]}>();
const normalizeOs=(value:string)=>value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g," ");
const osmString=(value:unknown)=>typeof value==="string"?value.trim().slice(0,180):"";
const osmObj=(value:unknown):Record<string,unknown> =>
  value!==null && typeof value==="object" && !Array.isArray(value)
    ? value as Record<string,unknown> : {};

async function searchPersonalOsm(
  city:string,state:string,segment:string,neighborhood:string,
):Promise<OSMSearchResult>{
  const filters=OSM_TAG_FILTERS[normalizeOs(segment)];
  if(!filters)return {ok:false,code:"UNSUPPORTED_SEGMENT",
    message:"Este nicho ainda não está disponível na busca aberta sem chave."};
  const cacheKey=[city,state,segment,neighborhood].map(normalizeOs).join("|");
  const cached=osmCache.get(cacheKey);
  if(cached && cached.until>Date.now())return {ok:true,places:cached.places};
  // Fixed tag allowlist + escaped exact municipality name prevents QL injection.
  const quotedCity=JSON.stringify(city);
  const ql=[
    "[out:json][timeout:14];",
    'area["ISO3166-2"='+JSON.stringify("BR-"+state)+']["boundary"="administrative"]["admin_level"="4"]->.uf;',
    'rel(area.uf)["boundary"="administrative"]["admin_level"="8"]["name"='+quotedCity+']->.municipality;',
    ".municipality out tags;",
    ".municipality map_to_area->.municipalArea;",
    "(",
    ...filters.map(filter=>'nwr'+filter+'["name"](area.municipalArea);'),
    ");",
    "out center 90;",
  ].join("\n");
  try{
    const response=await fetch(OSM_OVERPASS_URL,{
      method:"POST",
      headers:{
        "content-type":"application/x-www-form-urlencoded",
        "accept":"application/json",
        "User-Agent":"JanuarioLeadsPersonal/1.1 (private OSM search via Supabase)",
      },
      body:new URLSearchParams({data:ql}),
      signal:AbortSignal.timeout(17000),
    });
    if(!response.ok){
      // Server-only diagnostics; do not log auth headers, query or place names.
      console.warn("personal_osm_upstream_http",response.status);
      if(response.status===400)return {ok:false,code:"PROVIDER_QUERY_INVALID",
        message:"O servidor OpenStreetMap recusou o formato da consulta (HTTP 400)."};
      if(response.status===403||response.status===406)return {ok:false,code:"PROVIDER_ACCESS_BLOCKED",
        message:"O servidor comunitário recusou esta origem de acesso."};
      if(response.status===429)return {ok:false,code:"PROVIDER_RATE_LIMIT",
        message:"A fonte comunitária atingiu seu limite temporário de solicitações."};
      return {ok:false,code:"PROVIDER_UNAVAILABLE",
        message:"O servidor comunitário OpenStreetMap está temporariamente indisponível (HTTP "+response.status+")."};
    }
    const raw=await response.text();
    if(raw.length>750000)return {ok:false,code:"PROVIDER_UNAVAILABLE",
      message:"A resposta comunitária excedeu o limite seguro."};
    const payload=osmObj(JSON.parse(raw));
    if(typeof payload.remark==="string"&&payload.remark){
      console.warn("personal_osm_overpass_remark");
      return {ok:false,code:"PROVIDER_UNAVAILABLE",
        message:"A consulta comunitária não pôde ser concluída dentro dos limites do servidor."};
    }
    const elements:unknown=payload.elements;
    if(!Array.isArray(elements))throw Error("INVALID_OSM_RESPONSE");
    const municipalFound=elements.some(value=>{
      const e=osmObj(value),tags=osmObj(e.tags);
      return e.type==="relation" && tags.boundary==="administrative" &&
        normalizeOs(osmString(tags.name))===normalizeOs(city);
    });
    if(!municipalFound)return {ok:false,code:"LOCATION_NOT_FOUND",
      message:"O município não foi localizado na base comunitária para a UF selecionada."};
    const seen=new Set<string>();
    const places:OsmPlace[]=[];
    for(const value of elements){
      const e=osmObj(value),tags=osmObj(e.tags),center=osmObj(e.center);
      const kind=e.type,id=e.id;
      if(!["node","way","relation"].includes(String(kind)) ||
         typeof id!=="number" || !Number.isSafeInteger(id) || id<1)continue;
      const name=osmString(tags.name);
      const lat=typeof e.lat==="number"?e.lat:center.lat;
      const lon=typeof e.lon==="number"?e.lon:center.lon;
      if(!name||typeof lat!=="number"||typeof lon!=="number"||
         !Number.isFinite(lat)||!Number.isFinite(lon)||
         Math.abs(lat)>90||Math.abs(lon)>180)continue;
      if(normalizeOs(segment)==="barbearia" &&
        !/\b(barbearia|barbeiro|barber|barbershop)\b/.test(normalizeOs(name)))continue;
      const address=[
        osmString(tags["addr:street"]),
        osmString(tags["addr:housenumber"]),
        osmString(tags["addr:suburb"])||osmString(tags["addr:neighbourhood"]),
      ].filter(Boolean).join(", ");
      if(neighborhood && !normalizeOs(address).includes(normalizeOs(neighborhood)))continue;
      const sourceId="osm:"+kind+"/"+id;
      if(seen.has(sourceId))continue;
      seen.add(sourceId);
      places.push({source:"osm",sourceId,name,category:
        osmString(tags.amenity)||osmString(tags.healthcare)||
        osmString(tags.shop)||osmString(tags.leisure)||osmString(tags.tourism)||null,
        address:address||null,city,state,latitude:lat,longitude:lon});
      if(places.length>=25)break;
    }
    // Memory-only per-isolate cache; short expiry and bounded size.
    if(osmCache.size>=25)osmCache.delete(osmCache.keys().next().value!);
    osmCache.set(cacheKey,{until:Date.now()+3*60*60*1000,places});
    return {ok:true,places};
  }catch(error:unknown){
    console.warn("personal_osm_upstream_fetch",error instanceof Error?error.name:"unknown");
    return {ok:false,code:"PROVIDER_UNAVAILABLE",
      message:"Não foi possível conectar ao servidor comunitário OpenStreetMap."};
  }
}


/**
 * The search engine may return Google Places results without a Google basemap,
 * but the browser MUST show them in a Google-attributed list-only panel.
 * Google data must never be plotted on OpenFreeMap / OpenStreetMap tiles.
 *
 * Only essential identity/location data is requested. This call happens
 * after a single authenticated daily quota claim in the outer handler.
 */
type GooglePersonalPlace={
  placeId:string;name:string;address:string|null;city:string;state:string;
  latitude:number;longitude:number;googleMapsUrl:string|null;
};
const GOOGLE_TEXT_FIELD_MASK=[
  "places.id","places.displayName","places.formattedAddress",
  "places.addressComponents","places.location","places.googleMapsUri",
].join(",");
function normalizedCompare(value:string):string{
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .trim().toLocaleLowerCase("pt-BR").replace(/\s+/g," ");
}
function validGoogleLocation(place:Record<string,unknown>,city:string,uf:string):boolean{
  const components=Array.isArray(place.addressComponents)?place.addressComponents:[];
  let googleCity="", googleState="", googleCountry="";
  for(const item of components){
    const row=asJson(item);
    const types=Array.isArray(row?.types)?row.types:[];
    if(types.includes("locality")||types.includes("administrative_area_level_2"))
      googleCity=typeof row?.longText==="string"?row.longText:googleCity;
    if(types.includes("administrative_area_level_1"))
      googleState=typeof row?.shortText==="string"?row.shortText:googleState;
    if(types.includes("country"))
      googleCountry=typeof row?.shortText==="string"?row.shortText:googleCountry;
  }
  // An explicit locality/UF must match. Never return homonymous cities
  // or nearby businesses from another state.
  if(googleCountry && normalizedCompare(googleCountry)!=="br")return false;
  if(googleState && normalizedCompare(googleState)!==normalizedCompare(uf))return false;
  if(googleCity && normalizedCompare(googleCity)!==normalizedCompare(city))return false;
  if(googleCity && googleState)return true;
  const address=typeof place.formattedAddress==="string"?place.formattedAddress:"";
  const n=normalizedCompare(address);
  return Boolean(n&&n.includes(normalizedCompare(city))&&
    (n.includes(" - "+normalizedCompare(uf))||n.includes(", "+normalizedCompare(uf)+",")));
}

async function searchPersonalGoogle(
  request:Request,key:string|undefined,city:string,uf:string,
  segment:string,neighborhood:string,
):Promise<Response>{
  if(!key)return fail(request,"NOT_CONFIGURED",
    "O Google Places complementar não está configurado no Supabase original.",503);
  const state=findBrazilianState(uf);
  if(!state)return fail(request,"INVALID_REQUEST","Estado inválido.",400);
  const q=searchTextForSegment(segment)??segment;
  const body={
    textQuery:q+" em "+city+", "+state.name+", Brasil",
    languageCode:"pt-BR",regionCode:"BR",pageSize:20,
  };
  try{
    const google=await fetch("https://places.googleapis.com/v1/places:searchText",{
      method:"POST",
      headers:{
        "content-type":"application/json","X-Goog-Api-Key":key,
        "X-Goog-FieldMask":GOOGLE_TEXT_FIELD_MASK,
      },
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(9000),
    });
    const raw:unknown=await google.json();
    const payload=asJson(raw);
    if(!google.ok){
      const err=asJson(payload?.error);
      const status=typeof err?.status==="string"?err.status:"";
      console.warn("personal_google_http",google.status,status.slice(0,40));
      if(google.status===429||status==="RESOURCE_EXHAUSTED")
        return fail(request,"QUOTA","O Google Places atingiu seu limite de uso.",429);
      if(status==="BILLING_NOT_ENABLED"||status==="FAILED_PRECONDITION")
        return fail(request,"BILLING_REQUIRED","O projeto Google Places exige faturamento habilitado.",503);
      if(google.status===401||google.status===403)
        return fail(request,"GOOGLE_AUTH","O Google Places não autorizou a chave ou este serviço.",503);
      return fail(request,"PROVIDER_UNAVAILABLE","A consulta ao Google Places não foi concluída.",502);
    }
    if(!payload||!Array.isArray(payload.places))
      return fail(request,"PROVIDER_UNAVAILABLE","O Google Places retornou dados inesperados.",502);
    const seen=new Set<string>();
    const places:GooglePersonalPlace[]=[];
    for(const rawPlace of payload.places){
      const place=asJson(rawPlace);
      if(!place||!validGoogleLocation(place,city,uf))continue;
      const id=typeof place.id==="string"?place.id.trim():"";
      const display=asJson(place.displayName);
      const name=typeof display?.text==="string"?display.text.trim():"";
      const location=asJson(place.location);
      const lat=location?.latitude,lon=location?.longitude;
      if(!id||!name||seen.has(id)||typeof lat!=="number"||
        typeof lon!=="number"||!Number.isFinite(lat)||!Number.isFinite(lon)||
        Math.abs(lat)>90||Math.abs(lon)>180)continue;
      const address=typeof place.formattedAddress==="string"?place.formattedAddress:null;
      if(neighborhood&& !normalizedCompare(address??"").includes(normalizedCompare(neighborhood)))continue;
      seen.add(id);
      const mapsUri=typeof place.googleMapsUri==="string"&&
        /^https:\/\/(?:www\.)?google\.[^/]+\/maps\b|^https:\/\/maps\.google\./i.test(place.googleMapsUri)
        ? place.googleMapsUri:null;
      places.push({placeId:id,name,address,city,state:uf,
        latitude:lat,longitude:lon,googleMapsUrl:mapsUri});
    }
    return answer(request,{ok:true,provider:"google",places,limit:20,
      matchMode:"category",source:"Google Maps"});
  }catch(error:unknown){
    console.warn("personal_google_failure",error instanceof Error?error.name:"unknown");
    return fail(request,"PROVIDER_UNAVAILABLE",
      "Não foi possível conectar ao Google Places.",503);
  }
}

Deno.serve(async(request:Request)=>{
  if(request.method==="OPTIONS")return new Response(null,{
    status:204,headers:{...HEADERS,...cors(request.headers.get("origin")??"")},
  });
  if(request.method!=="POST")return fail(request,"INVALID_REQUEST","Use POST.",405);
  const origin=request.headers.get("origin")??"";
  if(origin && !cors(origin)["Access-Control-Allow-Origin"])return fail(request,"FORBIDDEN","Origem não autorizada.",403);
  try{
    const auth=await authUser(request);
    if(!auth)return fail(request,"FORBIDDEN","Entre na conta pessoal original para usar o Maps.",403);
    const raw=await request.text();
    if(raw.length>3000)return fail(request,"INVALID_REQUEST","Pesquisa muito longa.",413);
    const body=asJson(JSON.parse(raw));
    if(!body)return fail(request,"INVALID_REQUEST","Envie um objeto JSON.",400);
    const key=Deno.env.get("GEOAPIFY_API_KEY")?.trim();
    // Owner-authenticated, zero-cost preflight: no provider call and no quota debit.
    // Do not expose the secret value or any part of it.
    if(body.action==="status")return answer(request,{
      ok:true,provider:"geoapify",configured:Boolean(key),fallback:"osm",dailyLimit:10,
    });
    const segment=text(body?.segment,120),city=text(body?.city,80),
      state=text(body?.state,4).toUpperCase();
    const uf=findBrazilianState(state);
    const plan=geoapifySearchPlanForSegment(segment);
    if(!uf||city.length<2||!segment)return fail(request,"INVALID_REQUEST",
      "Informe nicho, cidade e estado válidos.");
    if(!plan)return fail(request,"UNSUPPORTED_SEGMENT",
      "Selecione um nicho do catálogo do Januário Leads.");

    const claim=await fetch(auth.host+"/rest/v1/rpc/claim_personal_geoapify_search",{
      method:"POST",headers:{...auth.headers,"content-type":"application/json"},
      body:"{}",signal:AbortSignal.timeout(5000),
    });
    if(!claim.ok)return fail(request,"QUOTA","Não foi possível validar o limite seguro das buscas Geoapify.",429);
    if(await claim.json()!==true)return fail(request,"QUOTA",
      "Limite pessoal de 10 buscas por dia atingido.",429);
    if(!key){
      const osm=await searchPersonalOsm(city,uf.code,segment,text(body?.neighborhood,80));
      if(!osm.ok)return fail(request,osm.code,osm.message,
        osm.code==="LOCATION_NOT_FOUND"?404:
        osm.code==="UNSUPPORTED_SEGMENT"?400:
        osm.code==="PROVIDER_RATE_LIMIT"?429:503);
      return answer(request,{ok:true,provider:"osm",places:osm.places,partial:false,
        limit:25,source:"OpenStreetMap / Overpass · © OpenStreetMap contributors"});
    }

    const geo=new URL("https://api.geoapify.com/v1/geocode/search");
    geo.searchParams.set("text",city+", "+uf.name+", Brasil");
    geo.searchParams.set("filter","countrycode:br");
    geo.searchParams.set("lang","pt");
    geo.searchParams.set("limit","10");
    geo.searchParams.set("format","geojson");
    geo.searchParams.set("apiKey",key);
    const cityResponse=await fetch(geo,{signal:AbortSignal.timeout(7000)});
    if(!cityResponse.ok)return fail(request,"PROVIDER_UNAVAILABLE","Geoapify não conseguiu localizar o município.",502);
    const municipal=resolveGeoapifyCityLocation(await cityResponse.json(),city,uf.code);
    if(!municipal)return fail(request,"LOCATION_NOT_FOUND",
      "Não foi possível validar esta cidade e UF no Geoapify.",404);


    // Every search is constrained to the geocoded municipality's place ID.
    // A larger source page is ranked BEFORE truncation to 25 results.
    const fetchPlaces=async(searchPlan:GeoapifySearchPlan,providerLimit:number):
      Promise<{ok:true;places:GeoapifyPlacePreview[]}
      |{ok:false;httpStatus:number}>=>{
      const endpoint=new URL("https://api.geoapify.com/v2/places");
      endpoint.searchParams.set("categories",searchPlan.categories);
      endpoint.searchParams.set("filter","place:"+municipal.placeId);
      endpoint.searchParams.set("limit",String(providerLimit));
      endpoint.searchParams.set("lang","pt");
      if(searchPlan.name)endpoint.searchParams.set("name",searchPlan.name);
      endpoint.searchParams.set("apiKey",key);
      const result=await fetch(endpoint,{signal:AbortSignal.timeout(9000)});
      if(!result.ok)return {ok:false,httpStatus:result.status};
      const json:unknown=await result.json();
      if(geoapifyFeatureCount(json)===null)return {ok:false,httpStatus:502};
      return {ok:true,places:normalizeGeoapifyPlaces(json,{city,state:uf.code},providerLimit)};
    };
    const primary=await fetchPlaces(plan,plan.matchMode==="category"?150:75);
    if(!primary.ok)return fail(request,primary.httpStatus===429?"QUOTA":"PROVIDER_UNAVAILABLE",
      primary.httpStatus===429
        ?"Geoapify atingiu seu limite de consultas. A busca foi interrompida."
        :"Geoapify não conseguiu consultar os estabelecimentos deste município.",
      primary.httpStatus===429?429:502);
    let selected:GeoapifyPlacePreview[];
    let matchMode:"category"|"related"|"name";
    if(plan.matchMode==="name"){
      selected=primary.places.slice(0,25).map(p=>({...p,matchQuality:"name"}));
      matchMode="name";
    }else{
      const ranked=selectGeoapifyPlaces(primary.places,segment,25);
      selected=ranked.places;
      matchMode=ranked.matchMode;
    }
    // A non-specific category can contain many candidates with no barber
    // label. Before returning related hairdressers, request a precise name
    // match. This second call only happens for zero/uncertain results.
    if(plan.matchMode==="category" && (selected.length===0||matchMode==="related")){
      const fallback=geoapifyNameFallbackPlanForSegment(segment);
      if(fallback){
        const byName=await fetchPlaces(fallback,75);
        if(byName.ok && byName.places.length>0){
          selected=byName.places.slice(0,25).map(p=>({...p,matchQuality:"name"}));
          matchMode="name";
        }else if(!byName.ok && selected.length===0){
          return fail(request,byName.httpStatus===429?"QUOTA":"PROVIDER_UNAVAILABLE",
            byName.httpStatus===429
              ?"Geoapify atingiu seu limite de consultas."
              :"A consulta por categoria não encontrou registros e a busca complementar falhou.",
            byName.httpStatus===429?429:502);
        }
      }
    }
    const neighborhood=text(body?.neighborhood,80);
    if(neighborhood){
      const norm=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      selected=selected.filter(x=>norm(x.address??"").includes(norm(neighborhood)));
    }
    return answer(request,{
      ok:true,provider:"geoapify",places:selected,partial:matchMode!=="category",
      matchMode,limit:25,source:"Geoapify / © OpenStreetMap contributors",
    });
  }catch{
    return fail(request,"REQUEST_FAILED","Busca temporariamente indisponível. Tente mais tarde.",503);
  }
});
