/// <reference lib="deno.ns" />
const read=(path:string)=>Deno.readTextFileSync(new URL(path,import.meta.url));
const assert=(ok:unknown,why:string)=>{if(!ok)throw new Error(why)};
const component=read("./HeaderLightTrails.tsx");
const pageHeader=read("./PageHeader.tsx");
const css=read("../../styles/workspace-header-light-trails.css");
const routeCss=read("../../lib/route-styles.ts");
const direct:Record<string,string>={
  "leads":"../../routes/app.tsx",
  "search":"../../features/search-leads/SearchLeadsView.tsx",
  "prospecting":"../../features/search-leads/ProspectingInformationView.tsx",
  "opportunities":"../../features/opportunities/OpportunityView.tsx",
  "messages":"../../features/messages/MessagesView.tsx",
  "settings":"../../features/settings/SettingsView.tsx"
};
const shared:Record<string,string>={
  "dashboard":"Dashboard","finance":"Financeiro",
  "digital":"Análise de presença digital","proposals":"Propostas comerciais",
  "campaigns":"Campanhas de prospecção","sequences":"Sequências de prospecção",
  "agenda":"Agenda comercial","projects":"Gestão de projetos"
};
Deno.test("each of 14 banners has its own fixed SVG paths and pulse animation",()=>{
  for(const variant of [...Object.keys(direct),...Object.keys(shared)]){
    assert(component.includes(variant+": ["),"Missing distinct geometry: "+variant);
  }
  const paths=[...component.matchAll(/"M [^"]+"/g)].map(x=>x[0]);
  assert(new Set(paths).size===paths.length,"Each line must have unique geometry");
  assert(component.includes('stroke="var(--primary)"')&&component.includes('stopColor="var(--primary)"'),
    "Lines and traveling light must follow selected accent");
  assert(component.includes('pathLength={1000}')&&css.includes("stroke-dashoffset"),
    "Pulse must travel on static lines");
});
Deno.test("all authenticated modules mount an effect inside their own header",()=>{
  for(const [variant,path] of Object.entries(direct)){
    assert(read(path).includes('<HeaderLightTrails variant="'+variant+'" />'),
      "Missing light overlay in "+variant);
  }
  for(const [variant,title] of Object.entries(shared)){
    assert(pageHeader.includes('"'+title+'": "'+variant+'"')||
      pageHeader.includes(title+": "+'"'+variant+'"'),
      "Shared header missing "+variant);
  }
  assert(routeCss.includes("stylesheet(workspaceHeaderLightCss)"),"App styles not wired");
  assert(!routeCss.slice(routeCss.indexOf("export const MARKETING_STYLES")).includes("workspaceHeaderLightCss"),
    "Never animate public homepage");
});
Deno.test("header effect stays below controls, behind text, with reduced-motion support",()=>{
  assert(css.includes("pointer-events: none")&&css.includes("overflow: hidden"),
    "Animation must not intercept clicks or escape banner");
  assert(css.includes("> :not(.jl-header-beams)")&&css.includes("z-index: 1"),
    "Text and buttons remain in front of light effect");
  assert(css.includes("prefers-reduced-motion")&&css.includes("js-settings-reduce-motion"),
    "Respect system and user accessibility preferences");
});
