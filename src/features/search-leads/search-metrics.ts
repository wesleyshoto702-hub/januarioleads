/** Fase 2.4a — privacy-safe, in-memory search HTTP observations.
 *
 * No network, storage, logging, user ID, search terms, tokens, addresses,
 * phone, email, query strings, URLs or location data. Never use these values
 * to claim production latency unless they were measured in an authorized
 * production/staging session. A simulated clock yields SIMULATED p50/p95.
 */
import type { BusinessSearchFailure } from "./types.ts";

export type SearchMetricOutcome = "ok" | BusinessSearchFailure["code"];
export type SearchMetricPage = "initial" | "continuation";
export type SearchMetricHttpClass = "none" | "2xx" | "4xx" | "5xx" | "other";
export type SearchHttpObservation = Readonly<{
  page: SearchMetricPage;
  outcome: SearchMetricOutcome;
  elapsedMs: number;
  httpAttempts: 0 | 1;
  httpStatusClass: SearchMetricHttpClass;
  returnedCount: number;
}>;

export type SearchMetricsSummary = Readonly<{
  samples: number;
  httpAttempts: number;
  successes: number;
  failures: number;
  failureRatePct: number;
  p50Ms: number | null;
  p95Ms: number | null;
  p50SuccessMs: number | null;
  p95SuccessMs: number | null;
  initialPages: number;
  continuations: number;
  returnedCount: number;
  byOutcome: Record<SearchMetricOutcome, number>;
  byHttpStatusClass: Record<SearchMetricHttpClass, number>;
}>;

const outcomeList: SearchMetricOutcome[]=[
  "ok","NOT_CONFIGURED","AUTH_REQUIRED","FORBIDDEN","GOOGLE_AUTH",
  "API_NOT_ENABLED","BILLING_REQUIRED","INVALID_REQUEST","QUOTA","REQUEST_FAILED",
];
const httpStatusList:SearchMetricHttpClass[]=["none","2xx","4xx","5xx","other"];
export function httpStatusClass(status:number|null):SearchMetricHttpClass{
  if(status===null)return "none";
  if(status>=200&&status<300)return "2xx";
  if(status>=400&&status<500)return "4xx";
  if(status>=500&&status<600)return "5xx";
  return "other";
}
export function percentileNearestRank(
  observations: readonly number[], percent:50|95,
):number|null{
  const clean=observations.filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
  if(clean.length===0)return null;
  return clean[Math.max(0,Math.ceil(percent*clean.length/100)-1)]!;
}
export function createSearchMetricsCollector(maxSamples=256){
  // Bounded in memory; overwrites the oldest values, no persistent logs.
  const cap=Number.isInteger(maxSamples)&&maxSamples>0?
    Math.min(maxSamples,1000):256;
  let observations:SearchHttpObservation[]=[];
  function observe(value:SearchHttpObservation):void{
    const event:SearchHttpObservation={
      page:value.page==="continuation"?"continuation":"initial",
      outcome:outcomeList.includes(value.outcome)?value.outcome:"REQUEST_FAILED",
      elapsedMs:Number.isFinite(value.elapsedMs)
        ?Math.max(0,Math.round(value.elapsedMs*100)/100):0,
      httpAttempts:value.httpAttempts===1?1:0,
      httpStatusClass:httpStatusList.includes(value.httpStatusClass)
        ?value.httpStatusClass:"other",
      returnedCount:Number.isFinite(value.returnedCount)
        ?Math.max(0,Math.trunc(value.returnedCount)):0,
    };
    observations=[...observations,event].slice(-cap);
  }
  function summary():SearchMetricsSummary{
    const byOutcome=Object.fromEntries(outcomeList.map(x=>[x,0])) as
      Record<SearchMetricOutcome,number>;
    const byHttpStatusClass=Object.fromEntries(httpStatusList.map(x=>[x,0])) as
      Record<SearchMetricHttpClass,number>;
    for(const x of observations){
      byOutcome[x.outcome]++;
      byHttpStatusClass[x.httpStatusClass]++;
    }
    const successes=byOutcome.ok;
    const failures=observations.length-successes;
    return {
      samples:observations.length,
      httpAttempts:observations.reduce((n,x)=>n+x.httpAttempts,0),
      successes,failures,
      failureRatePct:observations.length?
        Math.round(failures/observations.length*10000)/100:0,
      p50Ms:percentileNearestRank(observations.map(x=>x.elapsedMs),50),
      p95Ms:percentileNearestRank(observations.map(x=>x.elapsedMs),95),
      p50SuccessMs:percentileNearestRank(observations.filter(x=>x.outcome==="ok").map(x=>x.elapsedMs),50),
      p95SuccessMs:percentileNearestRank(observations.filter(x=>x.outcome==="ok").map(x=>x.elapsedMs),95),
      initialPages:observations.filter(x=>x.page==="initial").length,
      continuations:observations.filter(x=>x.page==="continuation").length,
      returnedCount:observations.reduce((n,x)=>n+x.returnedCount,0),
      byOutcome,byHttpStatusClass,
    };
  }
  return {observe,summary,reset(){observations=[];}};
}
