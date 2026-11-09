import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { findBrazilianState } from "../_shared/brazil-locations.ts";
import {
  filterGeoapifyForNiche, geoapifyCategoryForSegment,
  normalizeGeoapifyPlaces, resolveGeoapifyCityLocation,
  geoapifyFeatureCount,
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

Deno.serve(async(request:Request)=>{
  if(request.method==="OPTIONS")return new Response(null,{
    status:204,headers:{...HEADERS,...cors(request.headers.get("origin")??"")},
  });
  if(request.method!=="POST")return fail(request,"INVALID_REQUEST","Use POST.",405);
  const origin=request.headers.get("origin")??"";
  if(origin && !cors(origin)["Access-Control-Allow-Origin"])return fail(request,"FORBIDDEN","Origem não autorizada.",403);
  const key=Deno.env.get("GEOAPIFY_API_KEY")?.trim();
  if(!key)return fail(request,"NOT_CONFIGURED",
    "A fonte Geoapify ainda precisa de GEOAPIFY_API_KEY no Supabase original.",503);
  try{
    const auth=await authUser(request);
    if(!auth)return fail(request,"FORBIDDEN","Entre na conta pessoal original para usar o Maps.",403);
    const raw=await request.text();
    if(raw.length>3000)return fail(request,"INVALID_REQUEST","Pesquisa muito longa.",413);
    const body=asJson(JSON.parse(raw));
    const segment=text(body?.segment,120),city=text(body?.city,80),
      state=text(body?.state,4).toUpperCase();
    const uf=findBrazilianState(state);
    const category=geoapifyCategoryForSegment(segment);
    if(!uf||city.length<2||!segment)return fail(request,"INVALID_REQUEST",
      "Informe nicho, cidade e estado válidos.");
    if(!category)return fail(request,"UNSUPPORTED_SEGMENT",
      "Este nicho não tem categoria Geoapify validada; use Google Places.");

    const claim=await fetch(auth.host+"/rest/v1/rpc/claim_personal_geoapify_search",{
      method:"POST",headers:{...auth.headers,"content-type":"application/json"},
      body:"{}",signal:AbortSignal.timeout(5000),
    });
    if(!claim.ok)return fail(request,"QUOTA","Não foi possível validar o limite seguro das buscas Geoapify.",429);
    if(await claim.json()!==true)return fail(request,"QUOTA",
      "Limite pessoal de 10 buscas Geoapify por dia atingido.",429);

    const geo=new URL("https://api.geoapify.com/v1/geocode/search");
    geo.searchParams.set("text",city+", "+uf.name+", Brasil");
    geo.searchParams.set("filter","countrycode:br");
    geo.searchParams.set("type","city");
    geo.searchParams.set("lang","pt");
    geo.searchParams.set("limit","5");
    geo.searchParams.set("format","geojson");
    geo.searchParams.set("apiKey",key);
    const cityResponse=await fetch(geo,{signal:AbortSignal.timeout(7000)});
    if(!cityResponse.ok)return fail(request,"PROVIDER_UNAVAILABLE","Geoapify não conseguiu localizar o município.",502);
    const municipal=resolveGeoapifyCityLocation(await cityResponse.json(),city,uf.code);
    if(!municipal)return fail(request,"LOCATION_NOT_FOUND",
      "Não foi possível validar esta cidade e UF no Geoapify.",404);

    const places=new URL("https://api.geoapify.com/v2/places");
    places.searchParams.set("categories",category);
    places.searchParams.set("filter","place:"+municipal.placeId);
    places.searchParams.set("limit","25");
    places.searchParams.set("lang","pt");
    places.searchParams.set("apiKey",key);
    const placesResponse=await fetch(places,{signal:AbortSignal.timeout(8000)});
    if(!placesResponse.ok)return fail(request,"PROVIDER_UNAVAILABLE","Geoapify não conseguiu consultar estabelecimentos.",502);
    const data:unknown=await placesResponse.json();
    if(geoapifyFeatureCount(data)===null)return fail(request,"PROVIDER_UNAVAILABLE",
      "Resposta do provedor em formato inesperado.",502);
    let listed=filterGeoapifyForNiche(normalizeGeoapifyPlaces(data,{city,state:uf.code},25),segment);
    const neighborhood=text(body?.neighborhood,80);
    if(neighborhood){
      const norm=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      listed=listed.filter(x=>norm(x.address??"").includes(norm(neighborhood)));
    }
    return answer(request,{
      ok:true,provider:"geoapify",places:listed,partial:false,
      limit:25,source:"Geoapify / © OpenStreetMap contributors",
    });
  }catch{
    return fail(request,"REQUEST_FAILED","Busca temporariamente indisponível. Tente mais tarde.",503);
  }
});
