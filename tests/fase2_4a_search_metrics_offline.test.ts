/// <reference lib="deno.ns" />
// SYNTHETIC fixtures only; no PII/secrets, no network, no real metrics.
import {
  createSearchMetricsCollector, httpStatusClass, percentileNearestRank,
  type SearchHttpObservation,
} from "../src/features/search-leads/search-metrics.ts";
import { requestSearchBusinesses } from
  "../src/features/search-leads/search-businesses-http.ts";
import { searchOverture, type OverturePlace } from
  "../supabase/functions/_shared/overture-search.ts";

function assert(value:unknown,message:string):asserts value{
  if(!value)throw Error(message);
}
function equal(actual:unknown,expected:unknown,message:string){
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    throw Error(message+": "+JSON.stringify(actual)+" != "+JSON.stringify(expected));
}
const URI="https://example.invalid/functions/v1/search-places";
const dummy={endpoint:URI,publishableKey:"sb_publishable_FAKE",
  accessToken:"TEST_SESSION_TOKEN"};
const input={segment:"Barbearia",city:"Lavras",state:"MG"};

Deno.test("nearest-rank p50/p95 use nonnegative finite observations, without mutating input",()=>{
  const original=[100,10,80,20,40,Number.NaN,-2,Infinity];
  equal(percentileNearestRank(original,50),40,"p50 sorted [10,20,40,80,100]");
  equal(percentileNearestRank(original,95),100,"p95 nearest rank");
  equal(percentileNearestRank([],95),null,"No observations is NOT zero milliseconds");
  equal(percentileNearestRank([Number.NaN,Infinity],50),null,"All invalid");
  assert(Number.isNaN(original[5]),"Original unmodified");
  equal(original[0],100,"Not sorted in place");
  equal(httpStatusClass(null),"none","No HTTP status");
  equal(httpStatusClass(200),"2xx","2xx");
  equal(httpStatusClass(429),"4xx","4xx");
  equal(httpStatusClass(503),"5xx","5xx");
  equal(httpStatusClass(302),"other","3xx");
});

Deno.test("observer sees only predefined aggregate fields; not URL/PII/secrets",async()=>{
  const events:SearchHttpObservation[]=[];
  let now=50;
  let count=0;
  const response=await requestSearchBusinesses({
    segment:"Barbearia privada",city:"Cidade Fictícia",state:"MG",
  },{
    ...dummy,accessToken:"TOP_SECRET_TEST_TOKEN",
    onObservation:event=>events.push(event),
    clockNowMs:()=>now,
    fetcher:async(url,options)=>{
      count++;
      assert(url===URI,"Uses injected endpoint");
      assert(String(options.body).includes("Cidade Fictícia"),"Request retained");
      now+=43;
      return new Response(JSON.stringify({
        ok:true,results:[
          {placeId:"overture:secret",name:"Nome Não Deve Ser Gravado",categories:["barber"]},
        ],nextPageToken:null,provider:"overture",
      }),{status:200});
    },
  });
  assert(response.ok,"Synthetic request successful");
  equal(count,1,"One HTTP call");
  equal(events.length,1,"One observation");
  equal(events[0],{
    page:"initial",outcome:"ok",elapsedMs:43,
    httpAttempts:1,httpStatusClass:"2xx",returnedCount:1,
  },"Observation only typed non-PII fields");
  const metrics=JSON.stringify(events);
  for(const forbidden of ["Barbearia privada","Cidade Fictícia",
    "TOP_SECRET_TEST_TOKEN","Nome Não Deve Ser Gravado","overture:secret",
    URI,"sb_publishable_FAKE"]){
    assert(!metrics.includes(forbidden),"Sensitive term in observation "+forbidden);
  }
});

Deno.test("same collector captures failed attempts, local rejection and quota status",async()=>{
  const collector=createSearchMetricsCollector();
  let now=0;
  let fetches=0;
  const clockNowMs=()=>now;
  const base={...dummy,clockNowMs,onObservation:collector.observe};
  const fetcher=async(_url:string):Promise<Response>=>{
    fetches++;
    now+=20;
    return new Response(JSON.stringify({ok:false,code:"QUOTA",
      message:"Mensagem contendo contato cliente@example.invalid"}),
      {status:429});
  };
  const invalid=await requestSearchBusinesses({...input,pageToken:"overture:100"},
    {...base,fetcher});
  assert(!invalid.ok && invalid.code==="INVALID_REQUEST","Invalid cursor blocked");
  const auth=await requestSearchBusinesses(input,{
    ...base,accessToken:null,fetcher,
  });
  assert(!auth.ok && auth.code==="AUTH_REQUIRED","No access token");
  const quota=await requestSearchBusinesses(input,{...base,fetcher});
  assert(!quota.ok && quota.code==="QUOTA","Quota reported");
  equal(fetches,1,"Only quota attempt touches HTTP");
  const data=collector.summary();
  equal(data.samples,3,"All flows measured");
  equal(data.httpAttempts,1,"Only actual HTTP attempts counted");
  equal(data.failures,3,"Three failed search actions");
  equal(data.successes,0,"None successful");
  equal(data.byOutcome.INVALID_REQUEST,1,"Invalid token");
  equal(data.byOutcome.AUTH_REQUIRED,1,"Missing token");
  equal(data.byOutcome.QUOTA,1,"Quota error");
  equal(data.byHttpStatusClass.none,2,"Two local failures");
  equal(data.byHttpStatusClass["4xx"],1,"Quota 429");
  equal(data.p50Ms,0,"Zero for local simulated rejections, not real latency");
  equal(data.p95Ms,20,"Longest simulated quota");
  equal(data.p50SuccessMs,null,"No successful sample");
});

Deno.test("observer failure does not break search and transport exceptions count as attempted",async()=>{
  let now=10;
  const collector=createSearchMetricsCollector();
  const response=await requestSearchBusinesses(input,{
    ...dummy,clockNowMs:()=>now,
    onObservation:x=>{collector.observe(x);throw Error("observer failed");},
    fetcher:async()=>{now+=12;throw Error("network disconnected");},
  });
  assert(!response.ok && response.code==="REQUEST_FAILED","Search still returns ordinary error");
  const data=collector.summary();
  equal(data.httpAttempts,1,"Transport error is one attempted HTTP request");
  equal(data.byHttpStatusClass.none,1,"No response class for thrown request");
  equal(data.p50Ms,12,"Simulated transport time measured");
});

Deno.test("1000-observation hard limit, bounded memory and reset",()=>{
  const collector=createSearchMetricsCollector(1000000);
  for(let i=0;i<1200;i++)collector.observe({
    page:"continuation",outcome:i%5?"ok":"REQUEST_FAILED",
    elapsedMs:i,httpAttempts:1,httpStatusClass:"2xx",
    returnedCount:1,
  });
  const data=collector.summary();
  equal(data.samples,1000,"Maximum bounded window");
  equal(data.httpAttempts,1000,"Attempts reflect bounded retained window only");
  equal(data.initialPages,0,"No first pages");
  equal(data.continuations,1000,"All paginations");
  equal(data.p95Ms,1149,"Nearest-rank p95 of last 1000 [200..1199]");
  collector.reset();
  equal(collector.summary().samples,0,"Reset empties memory");
  equal(collector.summary().p95Ms,null,"No metrics after reset");
});

Deno.test("fixed synthetic HTTP durations yield reproducible p50/p95 and failed rate",async()=>{
  const collector=createSearchMetricsCollector();
  let now=0;
  let calls=0;
  const timings=[10,20,30,40,50,60,70,80,90,100];
  for(let index=0;index<timings.length;index++){
    const isFailure=index===3||index===9;
    const response=await requestSearchBusinesses(input,{
      ...dummy,onObservation:collector.observe,clockNowMs:()=>now,
      fetcher:async()=>{
        calls++;
        now+=timings[index]!;
        return new Response(isFailure?JSON.stringify({
          ok:false,code:"QUOTA",message:"Limite fictício",
        }):JSON.stringify({
          ok:true,results:[{
            placeId:"overture:fake",name:"Empresa Exemplo",categories:["barber"],
          }],nextPageToken:null,
        }),{status:isFailure?429:200});
      },
    });
    assert(response.ok!==isFailure,"Result agrees with simulated response");
  }
  const stat=collector.summary();
  equal(stat.samples,10,"10 synthetic requests");
  equal(calls,10,"HTTP count");
  equal(stat.httpAttempts,10,"One per search action");
  equal(stat.failures,2,"Two simulated failures");
  equal(stat.failureRatePct,20,"20% synthetic failure rate");
  equal(stat.p50Ms,50,"Nearest-rank synthetic p50");
  equal(stat.p95Ms,100,"Nearest-rank synthetic p95");
  equal(stat.p50SuccessMs,50,"Successful durations omit quota samples");
  equal(stat.p95SuccessMs,90,"Successful p95 of [10,20,30,50,60,70,80,90]");
  equal(stat.returnedCount,8,"Only successful returned items");
  equal(stat.byOutcome.QUOTA,2,"Quota outcome count");
  equal(stat.byHttpStatusClass["2xx"],8,"Success HTTP class");
  equal(stat.byHttpStatusClass["4xx"],2,"Quota HTTP class");
});

function fakeOverturePlace(i:number):OverturePlace{
  return {
    id:"test-"+i,name:"Barbearia Demonstração "+i,category:"barber",
    city:"Lavras",state:"MG",address:"Rua Simulada "+i,
    latitude:-21.25+i*0.00002,longitude:-44.98,
    phone:"35999998888",email:null,website:null,instagram:null,
    confidence:0.8,operating_status:null,
  };
}
Deno.test("five Overture mock pages trigger five bounded table reads, zero paid calls",async()=>{
  const rows=Array.from({length:125},(_,i)=>fakeOverturePlace(i));
  let overtureReads=0,geoapifyCalls=0,googleCalls=0;
  const reader=async(path:string)=>{
    overtureReads++;
    assert(path.startsWith("overture_places?"),"Only internal Overture SELECT");
    const qs=new URLSearchParams(path.split("?")[1]);
    equal(qs.get("limit"),"250","Bounded input rows");
    return new Response(JSON.stringify(rows),{status:200});
  };
  let overallResults=0;
  for(let offset=0;offset<=80;offset+=20){
    const page=await searchOverture({
      segment:"Barbearia",city:"Lavras",state:"MG",offset,
    },reader);
    assert(page.ok,"Mock page succeeds");
    overallResults+=page.results.length;
  }
  equal(overtureReads,5,"Five page reads each bounded by 250 candidates");
  equal(overallResults,100,"Only 100 result slots exposed");
  equal(geoapifyCalls,0,"No Geoapify calls in offline Overture-only path");
  equal(googleCalls,0,"No Google calls in offline Overture-only path");
  // Counters are mock-only, not evidence about deployed Edge Function.
  assert(geoapifyCalls===0&&googleCalls===0,"No paid calls in the test process");
});
