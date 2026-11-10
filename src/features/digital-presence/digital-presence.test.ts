/// <reference lib="deno.ns" />
import { normalizePublicWebsite, parsePageSpeedResponse } from "./digital-presence.ts";

function check(ok:unknown,message:string) {
  if(!ok) throw new Error(message);
}
Deno.test("Digital analysis accepts public sites, strips fragments and secret query parameters",()=>{
  check(normalizePublicWebsite("empresa.com.br")==="https://empresa.com.br/","Should default to HTTPS");
  check(normalizePublicWebsite("https://site.example/page?token=PRIVATE#part")==="https://site.example/page",
    "Do not transmit private query parameters");
});
Deno.test("Digital analysis rejects private, local and non-web destinations",()=>{
  for(const raw of [
    "", "ftp://example.com","https://localhost","http://127.0.0.1/",
    "http://192.168.1.1/","https://user:pass@example.com",
    "https://staging.local/","https://example.com:5432/",
    "not a domain",
  ]){
    let rejected=false;
    try {normalizePublicWebsite(raw);}catch{rejected=true;}
    check(rejected,"Unsafe or malformed address accepted: "+raw);
  }
});
Deno.test("Lighthouse parser uses actual audit scores and returns honest missing results",()=>{
  const payload={
    id:"https://example.org/",
    analysisUTCTimestamp:"2026-11-10T19:00:00.000Z",
    lighthouseResult:{
      categories:{
        performance:{score:.82},accessibility:{score:.91},
        "best-practices":{score:null},seo:{score:1},
      },
      audits:{
        "largest-contentful-paint":{score:.45,title:"LCP alto",displayValue:"3,5 s",scoreDisplayMode:"numeric"},
        "first-contentful-paint":{score:1,title:"Primeiro conteúdo",displayValue:"1,1 s",scoreDisplayMode:"numeric"},
        "some-audit":{score:.3,title:"Melhorar imagens",scoreDisplayMode:"numeric"},
      },
    },
  };
  const report=parsePageSpeedResponse(payload,"https://example.org/","mobile");
  check(report.scores.performance===82&&report.scores.accessibility===91&&
    report.scores.bestPractices===null&&report.scores.seo===100,
    "Scores must come exclusively from Lighthouse");
  check(report.metrics.some(x=>x.id==="largest-contentful-paint"&&x.value==="3,5 s"),
    "Real Lighthouse metric missing");
  check(report.findings[0]?.title==="Melhorar imagens" &&
    report.findings[0]?.score===30,"Recommendations should be sorted by real score");
  check(report.findings.every(x=>x.title!=="Primeiro conteúdo"),"Perfect audits are not findings");
});
Deno.test("Incomplete responses fail closed rather than generating fabricated scores",()=>{
  let failed=false;
  try{parsePageSpeedResponse({lighthouseResult:{categories:{performance:{score:.91}}}},
    "https://example.org/","desktop");}catch{failed=true;}
  check(failed,"Missing audits must be rejected");
});
