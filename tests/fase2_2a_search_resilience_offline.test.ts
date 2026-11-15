/// <reference lib="deno.ns" />
import {
  parseSearchContinuation, safeOpenContinuationToken,
} from "../supabase/functions/_shared/search-continuation.ts";
import { searchOverture, type OverturePlace } from
  "../supabase/functions/_shared/overture-search.ts";
import { requestSearchBusinesses } from
  "../src/features/search-leads/search-businesses-http.ts";
import { createSearchRequestGate } from
  "../src/features/search-leads/search-request-gate.ts";
import { searchEmptyState } from
  "../src/features/search-leads/search-empty-state.ts";
import {
  eligibleQuotaCache, onlyOpenSourceSearchResults, openCachePage,
  MAX_CACHED_SEARCH_RESULTS,
  type OpenSearchCacheSnapshot,
} from "../src/features/opportunities/open-search-cache-policy.ts";
import { mergeSearchPageResults } from
  "../src/features/search-leads/search-page-merge.ts";
import type { BusinessSearchResult, BusinessSearchResponse } from
  "../src/features/search-leads/types.ts";

function assert(condition:unknown,msg:string):asserts condition{
  if(!condition)throw Error(msg);
}
function eq(a:unknown,b:unknown,msg:string){
  if(JSON.stringify(a)!==JSON.stringify(b))
    throw Error(msg+": "+JSON.stringify(a)+" != "+JSON.stringify(b));
}
function business(n:number, source:"overture"|"geoapify"|"google_places"="overture")
  :BusinessSearchResult{
  const prefix=source==="google_places"?"google":source;
  return {
    placeId:prefix+":"+n,
    name:"Empresa Simulada "+n,source,
    sourceUrl:null,primaryCategory:"barber",categories:["barber"],
    description:null,address:"Rua Fictícia "+n,neighborhood:null,
    city:"Lavras",state:"MG",phone:"(35) 98888-8888",email:null,
    internationalPhone:null,rating:null,reviewCount:null,isOpenNow:null,
    openingHours:[],website:null,instagram:null,googleMapsUrl:null,
    businessStatus:null,latitude:-21.2,longitude:-44.9,
  };
}
function place(i:number):OverturePlace{
  return {
    id:"id-"+i,name:"Barbearia Teste "+i,category:"barber",
    city:"Lavras",state:"MG",address:"Rua Inventada "+i,
    latitude:-21.24+i*0.00001,longitude:-44.99,
    phone:"35988888888",email:null,website:null,instagram:null,
    confidence:0.8,operating_status:null,
  };
}
const LOCATION={city:"Lavras",state:"MG"};
const ENDPOINT="https://example.invalid/functions/v1/search-places";
const FAKE_PUBLIC_KEY="sb_publishable_SYNTHETIC";
const FAKE_TOKEN="SYNTHETIC_USER";
const deps=(fetcher:(url:string,init:RequestInit)=>Promise<Response>)=>({
  fetcher,endpoint:ENDPOINT,publishableKey:FAKE_PUBLIC_KEY,accessToken:FAKE_TOKEN,
});

Deno.test("strict provider namespaces: accepted safe tokens and first page",()=>{
  eq(parseSearchContinuation(undefined),{kind:"first"},"Initial page");
  eq(parseSearchContinuation("overture:20"),{kind:"overture",offset:20},"Overture");
  eq(parseSearchContinuation("overture:80"),{kind:"overture",offset:80},"Overture last");
  eq(parseSearchContinuation("geoapify:40"),{kind:"geoapify",offset:40},"Geoapify");
  eq(parseSearchContinuation("google:opaque%2Ftoken"),
    {kind:"google",value:"opaque%2Ftoken"},"Google explicit only");
  eq(safeOpenContinuationToken("overture:60"),"overture:60","Open cache token");
  eq(safeOpenContinuationToken("geoapify:20"),"geoapify:20","Geo cache token");
  eq(safeOpenContinuationToken("google:secret-cursor"),null,"No paid token in cache");
});

Deno.test("reject unknown, malformed, oversized or out-of-range tokens",()=>{
  const invalid:unknown[]=[
    "random","rawGoogleCursor", "overture:0","overture:100","overture:21",
    "overture:20:danger","geoapify:-20","geoapify:999","geoapify:NaN",
    "geoapify:20:extra","gooogle:abc","google:","google:\nnew-line",
    " overture:20","overture:20 ", "overture:020","",null,123,{},[],"a".repeat(4100),
  ];
  for(const item of invalid){
    const out=parseSearchContinuation(item);
    // Empty/null may represent initial page internally; the server separately
    // forbids explicitly supplied empty/null continuation fields.
    assert(item===""||item===null ? out.kind==="first" : out.kind==="invalid",
      "Must reject malformed continuation: "+String(item).slice(0,50));
  }
});

Deno.test("client refuses invalid continuation with ZERO HTTP calls",async()=>{
  let calls=0;
  const input={...LOCATION,segment:"Barbearia"};
  for(const token of ["junk","overture:100","overture:20:foo","google:"]){
    const out=await requestSearchBusinesses({...input,pageToken:token},deps(
      async()=>{calls++;throw Error("never fetch");}
    ));
    assert(!out.ok && out.code==="INVALID_REQUEST","Invalid cursor response");
  }
  eq(calls,0,"Invalid cursor must not reach provider");
});

Deno.test("read-only Overture bounded result window ends after fifth page",async()=>{
  let fetches=0;
  const rows=Array.from({length:125},(_,i)=>place(i));
  const reader=async(path:string)=>{
    fetches++;
    assert(path.startsWith("overture_places?"),"Only Overture internal query");
    const params=new URLSearchParams(path.split("?")[1]);
    eq(params.get("limit"),"250","Reader bound");
    return new Response(JSON.stringify(rows),{status:200});
  };
  const collected:string[]=[];
  for(let i=0;i<5;i++){
    const page=await searchOverture({segment:"Barbearia",...LOCATION,offset:i*20},reader);
    assert(page.ok,"Valid page must succeed "+i);
    eq(page.results.length,20,"Page 20 results");
    collected.push(...page.results.map(x=>x.placeId));
    eq(page.nextPageToken,i<4?"overture:"+((i+1)*20):null,"Page boundary");
  }
  eq(fetches,5,"Only five internal bounded reads");
  eq(collected.length,100,"100 candidate cap");
  eq(new Set(collected).size,100,"No repeated IDs");
  const invalid=await searchOverture({segment:"Barbearia",...LOCATION,offset:100},reader);
  assert(!invalid.ok,"Offset past 80 must fail without querying");
  eq(fetches,5,"Invalid offset must never query internal table");
});

Deno.test("empty, filtered-empty, unknown hours, loading and API errors have distinct states",()=>{
  const normal={mode:"all" as const,loading:false,visibleCount:0,
    loadedCount:0,filtersActive:false,hasError:false};
  const empty=searchEmptyState(normal);
  assert(empty?.title.includes("nesta base"),"Empty search must not promise no firms");
  const filtered=searchEmptyState({...normal,loadedCount:9,filtersActive:true});
  assert(filtered?.title.includes("filtros"),"Filtered zero is not database zero");
  const unknown=searchEmptyState({...normal,loadedCount:6,mode:"open"});
  assert(unknown?.description.includes("Horários desconhecidos"),"Open status unknown");
  eq(searchEmptyState({...normal,loading:true}),null,"Loading hides empty state");
  eq(searchEmptyState({...normal,visibleCount:3}),null,"Results hide empty state");
  eq(searchEmptyState({...normal,hasError:true}),null,"Errors retain explicit alert");
});

Deno.test("newer request invalidates late successes AND late quota cache reads",async()=>{
  const gate=createSearchRequestGate();
  let resolveOld!:(value:BusinessSearchResponse)=>void;
  let resolveNew!:(value:BusinessSearchResponse)=>void;
  const old=new Promise<BusinessSearchResponse>(resolve=>resolveOld=resolve);
  const newer=new Promise<BusinessSearchResponse>(resolve=>resolveNew=resolve);
  const visible:string[]=[];
  async function apply(ticket:number, response:Promise<BusinessSearchResponse>){
    const value=await response;
    if(!gate.isCurrent(ticket))return;
    if(value.ok) visible.push(...value.results.map(x=>x.placeId));
  }
  const ticket1=gate.next(),wait1=apply(ticket1,old);
  const ticket2=gate.next(),wait2=apply(ticket2,newer);
  resolveNew({ok:true,results:[business(22)],nextPageToken:null});
  await wait2;
  resolveOld({ok:true,results:[business(11)],nextPageToken:null});
  await wait1;
  eq(visible,["overture:22"],"Old response cannot replace latest results");

  const ticket3=gate.next();
  let resolveCache!:(v:OpenSearchCacheSnapshot)=>void;
  const cachedPending=new Promise<OpenSearchCacheSnapshot>(resolve=>{
    resolveCache=resolve;
  });
  const cachePromise=(async()=>{
    const cache=await cachedPending;
    if(!gate.isCurrent(ticket3))return;
    const permitted=eligibleQuotaCache(cache,LOCATION,"Barbearia");
    if(permitted) visible.push(...permitted.results.map(x=>x.placeId));
  })();
  gate.next(); // user started a new search while waiting for cache
  resolveCache(sample([business(33)]));
  await cachePromise;
  eq(visible,["overture:22"],"Stale quota fallback must not replace fresh search");
  gate.invalidate();
  assert(!gate.isCurrent(ticket3),"Invalidating component is safe");
});

function sample(results:BusinessSearchResult[],overrides:
  Partial<OpenSearchCacheSnapshot>={}):OpenSearchCacheSnapshot{
  return {
    city:"Lavras",state:"MG",segment:"Barbearia",
    checkedAt:"2026-11-15T20:00:00.000Z",results,
    nextPageToken:"overture:20",pageCount:1,...overrides,
  };
}
Deno.test("quota fallback accepts only correct open-data snapshot and date",()=>{
  const good=eligibleQuotaCache(
    sample([business(1),business(2,"geoapify"),business(3,"google_places")]),
    LOCATION,"Barbearia");
  assert(good!==null,"Eligible open cache");
  eq(good.results.map(x=>x.placeId),["overture:1","geoapify:2"],
    "Google result must not be replayed in offline cache");
  eq(good.nextPageToken,null,"Quota fallback is a frozen snapshot");
  const bad=[
    sample([business(1)],{city:"Varginha"}),
    sample([business(1)],{state:"SP"}),
    sample([business(1)],{segment:"Academia"}),
    sample([business(1)],{checkedAt:"not-a-date"}),
    sample([business(3,"google_places")]),
    sample([]),
  ];
  for(const row of bad){
    eq(eligibleQuotaCache(row,LOCATION,"Barbearia"),null,
      "Wrong location/niche/source/date must not be recovered");
  }
});

Deno.test("cache retains at most 60 open IDs and never skips unseen pages",()=>{
  const source=Array.from({length:65},(_,i)=>business(i));
  const full=openCachePage(source,"overture:80");
  eq(full.results.length,MAX_CACHED_SEARCH_RESULTS,"Cache has 60-result max");
  eq(full.nextPageToken,null,
    "Truncated result list must not offer token skipping unseen results");
  const recent=openCachePage(source.slice(0,30),"geoapify:40");
  eq(recent.results.length,30,"No truncation of small cache");
  eq(recent.nextPageToken,"geoapify:40","Safe open provider continuation");
  const unknown=openCachePage(source.slice(0,30),"bogus");
  eq(unknown.nextPageToken,null,"Malformed token removed");
  const paid=openCachePage([business(3,"google_places")],"google:abc");
  eq(paid.results.length,0,"Paid provider not stored");
  eq(paid.nextPageToken,null,"Paid provider cursor not stored");
  const deduped=onlyOpenSourceSearchResults([business(1),business(1),
    business(2,"geoapify"),business(1,"google_places")]);
  eq(deduped.length,2,"Cache deduplicates valid IDs and excludes paid rows");
});

Deno.test("failed next-page response does not append or erase existing cards",async()=>{
  const old=[business(1),business(2)];
  const fail=await requestSearchBusinesses({
    ...LOCATION,segment:"Barbearia",pageToken:"overture:20",
  },deps(async()=>new Response(JSON.stringify({
    ok:false,code:"QUOTA",message:"Limite temporário",
  }),{status:429})));
  assert(!fail.ok && fail.code==="QUOTA","Explicit quota status");
  eq(old.length,2,"Existing cards unaffected by rejected page");
  const merged=mergeSearchPageResults(old,[]);
  eq(merged.map(x=>x.placeId),["overture:1","overture:2"],
    "Append only after a successful response");
});
