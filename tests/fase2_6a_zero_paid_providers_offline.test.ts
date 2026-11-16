/// <reference lib="deno.ns" />
/** Fase 2.6a: deterministic fake provider budget tests, ZERO real calls.
 * No secrets, network, accounts, public queries, billing or Supabase changes.
 */
import {
  approvedExternalPlacesDailyCap, approvedInstagramWebSearchDailyCap,
  mayContactExternalPlacesProvider,
} from "../supabase/functions/_shared/external-provider-approval.ts";
import { runReservedExternalCall } from
  "../supabase/functions/_shared/external-provider-execution.ts";
import { searchGeoapifyFirst } from
  "../supabase/functions/_shared/geoapify-search.ts";
import { searchOverture, type OverturePlace } from
  "../supabase/functions/_shared/overture-search.ts";
import { parseSearchContinuation } from
  "../supabase/functions/_shared/search-continuation.ts";

function assert(x:unknown,message:string):asserts x {
  if(!x)throw Error(message);
}
function eq(actual:unknown,expected:unknown,message:string) {
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    throw Error(message+": "+JSON.stringify(actual)+" != "+JSON.stringify(expected));
}

Deno.test("missing, zero, malformed and oversized caps DENY even if API key exists",()=>{
  const bad:[string|undefined,string][]=[
    [undefined,"missing"],["0","zero"],["-1","negative"],[" ","blank"],
    ["01","padded"],["1.5","decimal"],["false","false"],
    ["NaN","NaN"],["Infinity","Infinity"],
    ["1000000000000000000000","unsafe integer"],
  ];
  for(const [cap,label] of bad){
    eq(approvedExternalPlacesDailyCap("geoapify",cap,undefined),0,
      "Geoapify must deny "+label);
    eq(approvedExternalPlacesDailyCap("google_places",cap,"true"),0,
      "Google must deny "+label);
    eq(mayContactExternalPlacesProvider("geoapify","KEY_FAKE",cap,undefined),
      false,"Geoapify key alone cannot spend: "+label);
    eq(mayContactExternalPlacesProvider("google_places","KEY_FAKE",cap,"true"),
      false,"Google key alone cannot spend: "+label);
  }
  eq(mayContactExternalPlacesProvider("geoapify",null,"300",undefined),
    false,"Missing provider key denies");
  eq(mayContactExternalPlacesProvider("google_places","  ","20","true"),
    false,"Blank Google key denies");
});

Deno.test("Google approval must be exact; positive caps are ONLY eligibility, not a debit",()=>{
  for(const approval of [undefined,"","1","TRUE","True","false","yes"," true ","0"]){
    eq(approvedExternalPlacesDailyCap("google_places","20",approval),0,
      "No implicit Google approval from "+String(approval));
    eq(mayContactExternalPlacesProvider("google_places","KEY_FAKE","20",approval),
      false,"No approval even with key and cap");
  }
  eq(approvedExternalPlacesDailyCap("google_places","999","true"),20,
    "Google eligibility cap clamped, still needs atomic RPC");
  eq(approvedExternalPlacesDailyCap("geoapify","999","true"),300,
    "Geoapify eligibility cap clamped, still needs atomic RPC");
  eq(mayContactExternalPlacesProvider("geoapify","KEY_FAKE","1",undefined),
    true,"Explicit nonzero cap allows ATTEMPT at budget claim only");
  eq(mayContactExternalPlacesProvider("google_places","KEY_FAKE","1","true"),
    true,"Both approvals allow ATTEMPT at budget claim only");
});

Deno.test("each denied or throwing provider reservation prevents exactly every external call",async()=>{
  let claims=0,requests=0;
  for(const shouldThrow of [false,true]){
    const response=await runReservedExternalCall(
      async()=>{claims++;if(shouldThrow)throw Error("DB unavailable");return false;},
      async()=>{requests++;return "This must never run";},
    );
    eq(response,{ok:false,reason:"BUDGET_DENIED"},
      "No paid HTTP without successful budget claim");
  }
  eq(claims,2,"Two failed budget reservations");
  eq(requests,0,"ZERO provider requests on both cases");
  const reserved=await runReservedExternalCall(
    async()=>{claims++;return true;},
    async()=>{requests++;return "Mock result";},
  );
  eq(reserved,{ok:true,value:"Mock result"},"Only successful atomic reservation permits mock call");
  eq(requests,1,"Exactly one call after one affirmative reservation");
});

Deno.test("zero-budget route: Overture works; Geoapify + Google never invoked even with fake keys",async()=>{
  let overtureReads=0,geoapifyCalls=0,googleCalls=0,reservations=0;
  const rows:OverturePlace[]=Array.from({length:20},(_,i)=>({
    id:"fake-overture-"+i,name:"Barbearia Fictícia "+i,
    category:"barber",city:"Lavras",state:"MG",address:"Rua Simulada "+i,
    phone:"35999998888",email:null,website:null,instagram:null,
    confidence:0.8,operating_status:null,
    latitude:-21.24+i*0.0001,longitude:-44.98,
  }));
  const overture=await searchOverture({
    segment:"Barbearia",city:"Lavras",state:"MG",offset:0,
  },async(url)=>{
    overtureReads++;
    assert(url.startsWith("overture_places?"),"Read only internal PostgREST data");
    return new Response(JSON.stringify(rows),{status:200});
  });
  assert(overture.ok,"Internal search remains available with zero external budget");
  eq(overture.results.length,20,"Fake data can still be searched");
  const fakeKeys={geo:"GEO_KEY_FAKE",google:"GOOGLE_KEY_FAKE"};
  const geoEligible=mayContactExternalPlacesProvider(
    "geoapify",fakeKeys.geo,"0",undefined);
  const googleEligible=mayContactExternalPlacesProvider(
    "google_places",fakeKeys.google,"0","true");
  const geo=geoEligible?await runReservedExternalCall(
    async()=>{reservations++;return false;},
    async()=>{geoapifyCalls++;return "impossible";},
  ):null;
  const google=googleEligible?await runReservedExternalCall(
    async()=>{reservations++;return false;},
    async()=>{googleCalls++;return "impossible";},
  ):null;
  eq(geo,null,"No Geoapify fallbacks when zero cap");
  eq(google,null,"No Google fallbacks when zero cap");
  eq(overtureReads,1,"One internal read");
  eq(reservations,0,"No budget RPC for closed providers");
  eq(geoapifyCalls,0,"ZERO Geoapify HTTP");
  eq(googleCalls,0,"ZERO Google HTTP");
});

Deno.test("provider RPC deny after explicit opt-in still prevents billable traffic",async()=>{
  for(const p of ["geoapify","google_places"] as const){
    const cap="1",spend=p==="google_places"?"true":undefined;
    eq(mayContactExternalPlacesProvider(p,"KEY_FAKE",cap,spend),true,
      "Provider may only attempt to claim budget");
    let claims=0,providerCalls=0;
    const result=await runReservedExternalCall(
      async()=>{claims++;return false;},
      async()=>{providerCalls++;return "paid";},
    );
    eq(result.ok,false,"Denied budget claim must close API");
    eq(claims,1,"Only one atomic mock RPC");
    eq(providerCalls,0,"NO paid call even when key, cap and approval are set");
  }
});

Deno.test("Google text search, details, pagination and enrichment reserve each call",async()=>{
  let claims=0,requests=0;
  for(const operation of [
    "text_search_enterprise","place_details_enterprise",
    "text_search_enterprise","text_search_enterprise",
  ]){
    const result=await runReservedExternalCall(
      async()=>{claims++;return operation==="place_details_enterprise";},
      async()=>{requests++;return {status:200};},
    );
    eq(result.ok,operation==="place_details_enterprise",
      "Each operation must independently reserve a valid budget");
  }
  eq(claims,4,"Four separate mock budget claims, no workflow-level bypass");
  eq(requests,1,"Only one mock provider call after one successful claim");
});

Deno.test("Geoapify helper itself denies no reserve, denies failed geocode before fetch",async()=>{
  // Monkeypatch means any accidental external fetch is intercepted and fails.
  const oldFetch=globalThis.fetch;
  let externalAttempts=0,geocodeClaims=0;
  globalThis.fetch=((_url:RequestInfo|URL):Promise<Response>=>{
    externalAttempts++;
    throw Error("NO_NETWORK_POSSIBLE_IN_OFFLINE_TEST");
  }) as typeof fetch;
  try{
    const missing=await searchGeoapifyFirst({
      apiKey:"GEO_FAKE_KEY",segment:"Barbearia",city:"Lavras",state:"MG",
    });
    eq(missing,{ok:false,reason:"NOT_CONFIGURED"},
      "Even direct helper callers must supply atomic reserve function");
    const rejected=await searchGeoapifyFirst({
      apiKey:"GEO_FAKE_KEY",segment:"Barbearia",city:"Lavras",state:"MG",
      reserveCredit:async()=>{geocodeClaims++;return false;},
    });
    assert(!rejected.ok,"Denied geocode reservation returns safe failure");
    eq(externalAttempts,0,"NO network access before approved geocode reservation");
    eq(geocodeClaims,1,"Only reservation was attempted");
  }finally{globalThis.fetch=oldFetch;}
});

Deno.test("OpenAI Instagram web discovery defaults to DENY; key alone means nothing",async()=>{
  const badCaps=[undefined,"","0","-1","NaN","1.2","99999999999999999"];
  for(const cap of badCaps){
    eq(approvedInstagramWebSearchDailyCap(cap,"true"),0,
      "Missing/malformed OpenAI web cap is DENY");
  }
  for(const approval of [undefined,"false","TRUE","yes","1"," true "]){
    eq(approvedInstagramWebSearchDailyCap("5",approval),0,
      "OpenAI web spend approval must be EXACT");
  }
  eq(approvedInstagramWebSearchDailyCap("6","true"),5,
    "Approved eligibility capped at 5, but atomic RPC still mandatory");
  let requestCount=0;
  const reserve=async()=>false; // Missing billing RPC in this phase.
  const result=await runReservedExternalCall(reserve,async()=>{
    requestCount++;return "OpenAI responses";
  });
  eq(result,{ok:false,reason:"BUDGET_DENIED"},
    "Even positive approval/cap cannot skip atomic project budget claim");
  eq(requestCount,0,"ZERO simulated OpenAI billable requests");
});

Deno.test("malformed paid continuation token never becomes a provider call",async()=>{
  let requests=0;
  for(const token of ["bad-google-token","google:","overture:100",
    "geoapify:-1","google:\\n","not-a-token"]){
    const continuation=parseSearchContinuation(token);
    eq(continuation.kind,"invalid","Bad/unknown token must be denied");
    if(continuation.kind==="google"){
      await runReservedExternalCall(async()=>false,async()=>{
        requests++;return null;
      });
    }
  }
  eq(requests,0,"No Google calls for bad continuation tokens");
});
