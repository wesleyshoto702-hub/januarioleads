/// <reference lib="deno.ns" />
import { searchOverture, type OverturePlace } from
  "../supabase/functions/_shared/overture-search.ts";
import { requestSearchBusinesses } from
  "../src/features/search-leads/search-businesses-http.ts";
import { mergeSearchPageResults } from
  "../src/features/search-leads/search-page-merge.ts";
import {
  DEFAULT_RESULT_FILTERS,
  hasConfirmedInstagram,
  manualResultFilters,
  matchesResultFilters,
  type ResultWithContext,
  type ResultFilterState,
} from "../src/features/search-leads/search-result-filters.ts";
import { findBusinessDuplicate, type ExistingLeadIdentity } from
  "../src/features/search-leads/identity.ts";
import type { BusinessSearchResult } from "../src/features/search-leads/types.ts";

function assert(value:unknown,message:string):asserts value {
  if(!value)throw Error(message);
}
function equal(actual:unknown,expected:unknown,message:string) {
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    throw Error(message+": "+JSON.stringify(actual)+" != "+JSON.stringify(expected));
}
function mockPlace(i:number):OverturePlace{
  return {
    id:"mock-"+String(i).padStart(3,"0"),
    name:"Barbearia Fictícia "+i,category:"barber",city:"Lavras",state:"MG",
    address:"Rua Inventada, "+i,latitude:-21.24+i*0.0001,
    longitude:-44.98,phone:i%3===0?null:"(35) 98888-8888",
    email:i%4===0?"contato"+i+"@example.invalid":null,
    website:i%2===0?"https://example.invalid/empresa-"+i:null,
    instagram:null,confidence:0.8,operating_status:null,
  };
}
function business(id:string,changes:Partial<BusinessSearchResult>={}):BusinessSearchResult{
  return {
    placeId:"overture:"+id,
    source:"overture",sourceUrl:"https://explore.overturemaps.org/",
    name:"Empresa Fictícia "+id,primaryCategory:"barber",categories:["barber"],
    description:null,address:"Rua Teste 12",neighborhood:null,
    city:"Lavras",state:"MG",phone:null,internationalPhone:null,
    rating:null,reviewCount:null,isOpenNow:null,openingHours:[],
    website:null,email:null,instagram:null,googleMapsUrl:null,
    businessStatus:null,latitude:-21.24,longitude:-44.98,...changes,
  };
}
const LAVRAS={city:"Lavras",state:"MG"};
const mockEndpoint="https://example.invalid/functions/v1/search-places";
const fakePublicKey="sb_publishable_TEST_ONLY";
const fakeSession="synthetic-user-session-token";
const seenRequests:string[]=[];

function mockSearchTransport(rows:OverturePlace[]) {
  const requests:Array<{url:string;init:RequestInit}> = [];
  async function fakeBackend(url:string,init:RequestInit):Promise<Response>{
    requests.push({url,init});
    const params=JSON.parse(String(init.body)) as {
      segment:string;city:string;state:string;pageToken?:string;
    };
    const offset=params.pageToken?.startsWith("overture:")
      ? Number(params.pageToken.slice("overture:".length)):0;
    const output=await searchOverture({
      segment:params.segment,city:params.city,state:params.state,offset,
    },async path=>{
      seenRequests.push(path);
      return new Response(JSON.stringify(rows),{
        status:200,headers:{"content-type":"application/json"},
      });
    });
    if(!output.ok)
      return new Response(JSON.stringify({
        ok:false,code:"REQUEST_FAILED",message:"Busca indisponível",
      }),{status:503});
    return new Response(JSON.stringify({...output,provider:"overture"}),{
      status:200,headers:{"content-type":"application/json"},
    });
  }
  const doSearch=(pageToken?:string)=>requestSearchBusinesses({
    ...LAVRAS,segment:"Barbearia",...(pageToken?{pageToken}:{})
  },{
    fetcher:fakeBackend,endpoint:mockEndpoint,
    publishableKey:fakePublicKey,accessToken:fakeSession,
  });
  return {doSearch,requests};
}

Deno.test("searches three bounded pages with exact UF/city/niche and no provider calls",async()=>{
  seenRequests.length=0;
  const rows=Array.from({length:43},(_,i)=>mockPlace(i));
  const {doSearch,requests}=mockSearchTransport(rows);
  const first=await doSearch();
  assert(first.ok,"First mocked page must succeed");
  equal(first.results.length,20,"First page size");
  equal(first.nextPageToken,"overture:20","First continuation");
  const second=await doSearch(first.nextPageToken!);
  assert(second.ok,"Second mocked page must succeed");
  equal(second.results.length,20,"Second page size");
  equal(second.nextPageToken,"overture:40","Second continuation");
  const third=await doSearch(second.nextPageToken!);
  assert(third.ok,"Third mocked page must succeed");
  equal(third.results.length,3,"Last page size");
  equal(third.nextPageToken,null,"No fourth page");
  const combined=mergeSearchPageResults(
    mergeSearchPageResults([],first.results),second.results);
  const unique=mergeSearchPageResults(combined,third.results);
  equal(unique.length,43,"No duplication or loss across three pages");
  equal(new Set(unique.map(x=>x.placeId)).size,43,"Stable unique source IDs");
  equal(requests.length,3,"One HTTP request per page");
  equal(seenRequests.length,3,"Only one Overture table read per page");
  assert(seenRequests.every(x=>x.startsWith("overture_places?")),
    "Unexpected external provider request");
  for(const path of seenRequests){
    const qs=new URLSearchParams(path.split("?")[1]);
    equal(qs.get("state"),"eq.MG","UF filtering");
    equal(qs.get("city_key"),"eq.lavras","City filtering");
    assert(qs.get("category")?.includes("barber"),"Niche category absent");
    equal(qs.get("limit"),"250","Bounded database candidates");
    equal(qs.get("order"),"id.asc","Deterministic page ranking input");
  }
  for(const req of requests){
    equal(req.init.method,"POST","Client HTTP method");
    const headers=new Headers(req.init.headers);
    equal(headers.get("Authorization"),"Bearer "+fakeSession,"User token boundary");
    equal(headers.get("apikey"),fakePublicKey,"Only publishable key");
  }
});

Deno.test("returns honest zero results for mapped-but-empty and unmapped niches",async()=>{
  for(const niche of ["Barbearia","Açaiteria"]){
    let calls=0;
    const result=await searchOverture({segment:niche,...LAVRAS},
      async()=>{calls++;return new Response("[]",{status:200});});
    assert(result.ok && result.results.length===0,"Empty result must remain empty");
    equal(result.nextPageToken,null,"Zero-result next token");
    if(niche==="Açaiteria")equal(calls,0,"Unmapped niches must not query table");
    else equal(calls,1,"Mapped niche should inspect mock table");
  }
});

Deno.test("client does not call backend without session or valid public configuration",async()=>{
  let calls=0;
  const transport=async():Promise<Response>=>{calls++;throw Error("never called");};
  const base={fetcher:transport,endpoint:mockEndpoint,publishableKey:fakePublicKey};
  const missing=await requestSearchBusinesses({...LAVRAS,segment:"Barbearia"},
    {...base,accessToken:null});
  assert(!missing.ok && missing.code==="AUTH_REQUIRED","No session must stop search");
  const bad=await requestSearchBusinesses({...LAVRAS,segment:"Barbearia"},
    {...base,accessToken:fakeSession,endpoint:"http://unsafe.invalid"});
  assert(!bad.ok && bad.code==="NOT_CONFIGURED","Unsecured endpoint must be rejected");
  equal(calls,0,"No fetch called without session/config");
});

Deno.test("client handles 401, quota, 503, malformed data and thrown network",async()=>{
  const input={...LAVRAS,segment:"Barbearia"};
  const base={endpoint:mockEndpoint,publishableKey:fakePublicKey,accessToken:fakeSession};
  const cases:Array<[number,unknown,string]>=[
    [401,{ok:false,code:"FORBIDDEN",message:"blocked"},"AUTH_REQUIRED"],
    [429,{ok:false,code:"QUOTA",message:"Limite atingido"},"QUOTA"],
    [403,{ok:false,code:"FORBIDDEN",message:"Acesso negado"},"FORBIDDEN"],
    [503,{ok:true,results:[],nextPageToken:null},"REQUEST_FAILED"],
    [200,{ok:true,results:"invalid",nextPageToken:null},"REQUEST_FAILED"],
    [200,{ok:true,results:[{placeId:"foo"}],nextPageToken:null},"REQUEST_FAILED"],
    [200,{ok:true,results:[],nextPageToken:7},"REQUEST_FAILED"],
  ];
  for(const [status,payload,code] of cases){
    const result=await requestSearchBusinesses(input,{...base,fetcher:async()=>
      new Response(JSON.stringify(payload),{status})});
    assert(!result.ok && result.code===code,"HTTP failure contract "+status+" "+code);
  }
  const badJSON=await requestSearchBusinesses(input,{...base,
    fetcher:async()=>new Response("not-json",{status:200})});
  assert(!badJSON.ok && badJSON.code==="REQUEST_FAILED","Bad JSON must fail");
  const failure=await requestSearchBusinesses(input,{...base,
    fetcher:async()=>{throw Error("network down");}});
  assert(!failure.ok && failure.code==="REQUEST_FAILED","Offline transport must fail cleanly");
});

Deno.test("client passes continuation token exactly and never exposes paid APIs",async()=>{
  const calls:Array<{url:string;body:string}>=[];
  const out=await requestSearchBusinesses({
    ...LAVRAS,segment:"Hotel",pageToken:"overture:20"
  },{
    endpoint:mockEndpoint,publishableKey:fakePublicKey,accessToken:fakeSession,
    fetcher:async(url,init)=>{
      calls.push({url,body:String(init.body)});
      return new Response(JSON.stringify({ok:true,results:[],nextPageToken:null,
        provider:"overture"}),{status:200});
    },
  });
  assert(out.ok && out.results.length===0,"Empty continuation should succeed");
  equal(calls.length,1,"Exactly one mocked request");
  equal(JSON.parse(calls[0].body).pageToken,"overture:20","Token preserved");
  assert(!calls[0].url.includes("geoapify") &&
    !calls[0].url.includes("google"),"No external provider endpoint");
});

function context(b:BusinessSearchResult,existing:ExistingLeadIdentity|null=null,
  band:"high"|"low"="low"):ResultWithContext{
  return {business:b,existingLead:existing,alreadyAdded:Boolean(existing),
    chance:{score:band==="high"?78:20,band,reasons:[],breakdown:[]}};
}
const defaults=()=>({...DEFAULT_RESULT_FILTERS});

Deno.test("filters check already-loaded businesses, not API calls",()=>{
  const candidates=[
    context(business("phone",{phone:"(35) 98888-8888"})),
    context(business("email",{email:"contato@example.invalid"})),
    context(business("website",{website:"https://example.invalid"})),
    context(business("instagram-unverified",{
      instagram:"https://instagram.com/example",
      instagramConfidence:"medium",instagramNeedsReview:true
    })),
    context(business("instagram-unknown",{
      instagram:"https://instagram.com/example",
      instagramConfidence:null
    })),
    context(business("instagram-confirmed",{
      instagram:"https://instagram.com/example",
      instagramConfidence:"high",instagramNeedsReview:false
    })),
  ];
  function filtered(f:ResultFilterState){
    return candidates.filter(x=>matchesResultFilters(x,f,"all"))
      .map(x=>x.business.placeId);
  }
  equal(filtered({...defaults(),contact:"phone"}),["overture:phone"],"Phone filter");
  equal(filtered({...defaults(),contact:"whatsapp"}),["overture:phone"],
    "Compatible format only (not verified Whatsapp)");
  equal(filtered({...defaults(),contact:"email"}),["overture:email"],"Email filter");
  equal(filtered({...defaults(),website:"with-site"}),["overture:website"],"Site filter");
  equal(filtered({...defaults(),website:"without-site"}).length,5,"Unknown website");
  equal(filtered({...defaults(),instagram:"with-instagram"}),
    ["overture:instagram-confirmed"],"Only explicitly confirmed Instagram");
  equal(filtered({...defaults(),instagram:"without-instagram"}).length,5,
    "Unverified/unknown Instagram must not pass as confirmed");
  assert(!hasConfirmedInstagram(candidates[4].business),
    "No confidence must never be official proof");
  equal(manualResultFilters("email").contact,"email","UI manual filter");
  equal(manualResultFilters("all"),DEFAULT_RESULT_FILTERS,"Clear filter");
});

Deno.test("new/waiting/high chance filters and open-only use loaded data",()=>{
  const existing:ExistingLeadIdentity={
    id:"saved-1",company:"Empresa Fictícia saved",phone:"",status:"waiting",
    placeId:"overture:saved",city:"Lavras",state:"MG",address:"Rua Teste 12"
  };
  const entries=[
    context(business("new"),null,"high"),
    context(business("saved"),existing,"low"),
    context(business("closed",{isOpenNow:false}),null,"low"),
    context(business("unknown-hours",{isOpenNow:null}),null,"low"),
  ];
  equal(entries.filter(x=>matchesResultFilters(x,defaults(),"new")).length,3,
    "New leads exclude saved contacts");
  equal(entries.filter(x=>matchesResultFilters(x,defaults(),"waiting")).length,1,
    "Waiting status selects saved lead");
  equal(entries.filter(x=>matchesResultFilters(x,{...defaults(),chance:"high"},"all"))
    .map(x=>x.business.placeId),["overture:new"],"High chance only");
  equal(entries.filter(x=>x.business.isOpenNow===true).length,0,
    "Unknown hours are NOT open");
});

Deno.test("pagination merge preserves manually confirmed Instagram and unique IDs",()=>{
  const first=business("one",{instagram:"https://instagram.com/manual",
    instagramConfidence:"high",instagramNeedsReview:false,
    instagramSource:"manual_confirmation"});
  const repeated=business("one",{name:"Empresa Fictícia one - atualizado",
    instagram:"https://instagram.com/unverified",
    instagramConfidence:"medium",instagramNeedsReview:true});
  const next=business("two");
  const combined=mergeSearchPageResults([first],[repeated,next]);
  equal(combined.length,2,"Repeated place IDs should not render duplicate cards");
  equal(combined[0].instagram,first.instagram,"Manual confirmation must survive later page");
  equal(combined[0].name,repeated.name,"Newer factual name should be retained");
  const unknown=business("three",{instagram:"https://instagram.com/unknown",
    instagramConfidence:null});
  const newer=business("three");
  const merged=mergeSearchPageResults([unknown],[newer]);
  assert(merged[0].instagram===null,
    "Instagram without verification must not be promoted automatically");
});

Deno.test("CRM matches same place/source or same name and known address, NOT shared phone",()=>{
  const sharedPhone="(35) 98888-8888";
  const lead:ExistingLeadIdentity={
    id:"crm-1",company:"Barbearia Central",phone:sharedPhone,
    placeId:"overture:shop-one",address:"Rua A 25",city:"Lavras",state:"MG",
    status:"send_message"
  };
  const sameId=business("shop-one",{name:"Barbearia Central",phone:sharedPhone,
    address:"Rua A 25"});
  equal(findBusinessDuplicate(sameId,[lead])?.id,"crm-1","Exact source id dedup");
  const otherBusiness=business("other",{name:"Academia Nova",phone:sharedPhone,
    address:"Rua B 10"});
  equal(findBusinessDuplicate(otherBusiness,[lead]),null,
    "Shared phone must not hide an unrelated company in the same city");
  const otherBranch=business("branch",{name:"Barbearia Central",phone:sharedPhone,
    address:"Rua B 35"});
  equal(findBusinessDuplicate(otherBranch,[lead]),null,
    "Same franchise number but different address is not same lead");
  const samePhysical=business("new-place-id",{name:"Barbearia Central",
    phone:"(35) 97777-7777",address:"Rua A, 25"});
  equal(findBusinessDuplicate(samePhysical,[lead])?.id,"crm-1",
    "Equivalent name and address in same city can match");
  const diffCity=business("diff-city",{name:"Barbearia Central",
    phone:sharedPhone,address:"Rua A 25",city:"Varginha",state:"MG"});
  equal(findBusinessDuplicate(diffCity,[lead]),null,
    "Same street/company in another municipality is a different lead");
  const addressMissing=business("unknown-address",{name:"Barbearia Central",
    phone:sharedPhone,address:null});
  equal(findBusinessDuplicate(addressMissing,[lead]),null,
    "No known address does not justify merging by phone");
});
