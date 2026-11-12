import { SEGMENT_GROUPS } from "./niche-catalog.ts";
import { GEOAPIFY_CATEGORIES, geoapifyCategoryForSegment, validateGeoapifyCoverage } from "./geoapify-niche-categories.ts";
import { needsGoogleSupplement, searchGeoapifyFirst } from "./geoapify-search.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
Deno.test("all 196 niches are intentionally mapped, or explicitly delegated to Google",()=>{
  assert(validateGeoapifyCoverage(), "Geoapify strategy does not cover full canonical catalog");
  const labels=SEGMENT_GROUPS.flatMap(g=>g.items);
  assert(labels.length===196, "Review niches before deploying");
  assert(Object.keys(GEOAPIFY_CATEGORIES).length===labels.length,"Unexpected mapping");
  for(const label of labels){
    const value=GEOAPIFY_CATEGORIES[label];
    assert(value===null || (Array.isArray(value)&&value.length>0),
      "Every niche must have a deliberate category or Google fallback: "+label);
  }
  assert(geoapifyCategoryForSegment("Academia")?.categories.includes("sport.fitness.fitness_centre"),
    "Academia must map to fitness");
  assert(geoapifyCategoryForSegment("Chaveiro")?.categories.includes("service.locksmith"),
    "Chaveiro must map to locksmith");
  assert(geoapifyCategoryForSegment("Barbearia")?.nameFilter?.test("Barbearia da Esquina"),
    "Barbearia result name must be checked");
  assert(geoapifyCategoryForSegment("Consultoria de RH")===null,
    "Unclear niche must go to Google, never an overly broad Geo category");
});
Deno.test("phone-quality check avoids Google for useful Geoapify leads",()=>{
  const withPhone=(i:number)=>({
    name:"Empresa "+i,phone:"(35) 99999-"+String(1000+i),internationalPhone:null,
  });
  assert(needsGoogleSupplement([]),"Empty Geo requires Google");
  assert(needsGoogleSupplement(Array.from({length:7},(_,i)=>withPhone(i))),
    "Seven results are not enough");
  assert(needsGoogleSupplement(Array.from({length:8},(_,i)=>i<4?withPhone(i):
    {name:"Empresa "+i,phone:null,internationalPhone:null})),
    "Four phone contacts are not enough");
  assert(!needsGoogleSupplement(Array.from({length:8},(_,i)=>i<5?withPhone(i):
    {name:"Empresa "+i,phone:null,internationalPhone:null})),
    "Eight records with five phones should avoid Google");
});
Deno.test("Geoapify without a server key safely falls back without network",async()=>{
  const response=await searchGeoapifyFirst({
    apiKey:null,segment:"Chaveiro",city:"Lavras",state:"MG",
  });
  assert(!response.ok&&response.reason==="NOT_CONFIGURED","Missing server key must be handled");
  const unsupported=await searchGeoapifyFirst({
    apiKey:"example_key",segment:"Consultoria de RH",city:"Lavras",state:"MG",
  });
  assert(!unsupported.ok&&unsupported.reason==="UNSUPPORTED","Unsupported niche falls back");
});
Deno.test("municipality is geocoded before category search and records are source-isolated",async()=>{
  const original=globalThis.fetch;
  const called:string[]=[];
  globalThis.fetch=(async (request:RequestInfo | URL)=>{
    const url=new URL(request.toString());
    called.push(url.pathname);
    assert(url.searchParams.get("apiKey")==="example_key","Only server-side key is used");
    if(url.pathname.endsWith("/geocode/search")){
      return new Response(JSON.stringify({results:[
        {country_code:"br",state_code:"SP",state:"São Paulo",city:"Lavras",place_id:"other_city"},
        {country_code:"br",state_code:"MG",state:"Minas Gerais",city:"Lavras",place_id:"lavras_mg"},
      ]}),{headers:{"Content-Type":"application/json"}});
    }
    assert(url.searchParams.get("filter")==="place:lavras_mg",
      "Only requested municipality boundary can be queried");
    assert(url.searchParams.get("categories")==="service.locksmith",
      "Niche-specific Geo category is required");
    return new Response(JSON.stringify({features:[{
      properties:{
        place_id:"geoapify-abc",osm_type:"n",osm_id:42,
        name:"Chaveiro Lavras",country_code:"br",
        city:"Lavras",state_code:"MG",
        contact:{phone:"(35) 99999-1111"},
        formatted:"Rua A, Centro, Lavras, MG",
        categories:["service.locksmith"],
      },
      geometry:{coordinates:[-44.99,-21.25]},
    },{
      properties:{name:"Empresa em outra cidade",place_id:"excluded",
        city:"Varginha",state_code:"MG"},
    }]}),{headers:{"Content-Type":"application/json"}});
  }) as typeof fetch;
  try{
    const result=await searchGeoapifyFirst({
      apiKey:"example_key",segment:"Chaveiro",city:"Lavras",state:"MG",
    });
    assert(result.ok,"Valid city-scoped Geoapify result must be parsed");
    if(!result.ok) return;
    assert(called.length===2,"Exactly geocode then Places calls");
    assert(result.results.length===1,"Reject unrelated municipality records");
    assert(result.results[0].placeId==="geoapify:geoapify-abc","Provider-prefixed ID");
    assert(result.results[0].source==="geoapify","Data origin must be explicit");
    assert(result.results[0].googleMapsUrl===null,"No synthetic Google attribution");
    assert(result.results[0].phone==="(35) 99999-1111","Geoapify contact phone retained");
  }finally{
    globalThis.fetch=original;
  }
});
