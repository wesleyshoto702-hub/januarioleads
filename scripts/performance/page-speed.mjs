// Read-only best-effort PSI: report CrUX real-user INP/LCP/CLS only if returned.
// Do not treat Lighthouse simulated data as real-user metrics.
const site = "https://januleads.vercel.app/";
for (const strategy of ["mobile","desktop"]) {
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),35_000);
  try {
    const qs = new URLSearchParams({url:site,strategy,category:"performance"});
    const r = await fetch("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?"+qs, {
      signal:controller.signal,headers:{Accept:"application/json"},
    });
    if(!r.ok) {console.log("PAGESPEED_UNAVAILABLE "+JSON.stringify({strategy,http:r.status}));continue;}
    const j=await r.json();
    const field=j.loadingExperience?.metrics??j.originLoadingExperience?.metrics??null;
    const audits=j.lighthouseResult?.audits??{};
    console.log("PAGESPEED_METRICS "+JSON.stringify({
      strategy, site, fieldScope:j.loadingExperience?.metrics?"URL":field?"origin":null,
      crux:field?{
        lcpMs:field.LARGEST_CONTENTFUL_PAINT_MS?.percentile??null,
        inpMs:field.INTERACTION_TO_NEXT_PAINT?.percentile??null,
        clsHundredths:field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile??null,
      }:null,
      lighthouseLab:{
        lcpMs:audits["largest-contentful-paint"]?.numericValue??null,
        cls:audits["cumulative-layout-shift"]?.numericValue??null,
        tbtMs:audits["total-blocking-time"]?.numericValue??null,
        score:j.lighthouseResult?.categories?.performance?.score??null,
      },
    }));
  } catch(e) {
    console.log("PAGESPEED_UNAVAILABLE "+JSON.stringify({strategy,reason:e instanceof Error?e.name:"unknown"}));
  } finally{clearTimeout(timeout);}
}
