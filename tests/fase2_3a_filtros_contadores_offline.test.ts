/// <reference lib="deno.ns" />
import { RESULT_FILTER_OPTIONS, SMART_FILTERS } from
  "../src/features/search-leads/search-filter-presentation.ts";
import {
  DEFAULT_RESULT_FILTERS, hasConfirmedInstagram,
  hasIdentifiedBusinessPhone, hasUsableWhatsApp,
  matchesResultFilters, manualResultFilters, type ResultWithContext,
} from "../src/features/search-leads/search-result-filters.ts";
import { hasUsableBusinessEmail } from "../src/features/search-leads/business-contact.ts";
import { countLoadedMatches, summarizeLoadedSearchResults } from
  "../src/features/search-leads/search-loaded-counts.ts";
import { calculateLeadChance } from "../src/features/lead-chance/lead-chance.ts";
import type { ExistingLeadIdentity } from
  "../src/features/search-leads/identity.ts";
import type { BusinessSearchResult } from
  "../src/features/search-leads/types.ts";
function assert(value:unknown,message:string):asserts value{
  if(!value)throw Error(message);
}
function eq(actual:unknown,expected:unknown,message:string){
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    throw Error(message+": "+JSON.stringify(actual)+" != "+JSON.stringify(expected));
}
function b(id:string,fields:Partial<BusinessSearchResult>={}):BusinessSearchResult{
  return {
    placeId:"overture:"+id,source:"overture",
    sourceUrl:"https://explore.overturemaps.org/",
    name:"Empresa Fictícia "+id,primaryCategory:"barber",categories:["barber"],
    description:null,address:"Rua Exemplo 12",neighborhood:null,
    city:"Lavras",state:"MG",phone:null,internationalPhone:null,email:null,
    rating:null,reviewCount:null,isOpenNow:null,openingHours:[],website:null,
    instagram:null,googleMapsUrl:null,businessStatus:null,
    latitude:-21.24,longitude:-44.99,...fields,
  };
}
const saved:ExistingLeadIdentity={
  id:"saved-fake",company:"Empresa Fictícia salvo",
  phone:"35988888888",placeId:"overture:salvo",
  address:"Rua Exemplo 12",city:"Lavras",state:"MG",status:"waiting",
};
function ctx(business:BusinessSearchResult,existingLead:ExistingLeadIdentity|null=null)
  :ResultWithContext{
  return {business,existingLead,alreadyAdded:!!existingLead,
    chance:calculateLeadChance(business,"Barbearia")};
}
Deno.test("8 real filter labels are accurate and explained; no false absence",()=>{
  eq(RESULT_FILTER_OPTIONS.length,8,"All filters remain accessible");
  const x=Object.fromEntries(RESULT_FILTER_OPTIONS.map(([id,label,description])=>
    [id,{label,description}]));
  assert(x["phone"].label.includes("Telefone informado"),"Phone listed, not validated");
  assert(x["whatsapp"].label.includes("Número compatível"),"WhatsApp is only a format");
  assert(x["whatsapp"].description.includes("não confirma conta ativa"),
    "No claim of WhatsApp registration");
  assert(x["email"].description.includes("entrega não verificada"),
    "Email syntax is not deliverability");
  assert(x["without-site"].label.includes("não identificado") &&
    x["without-site"].description.includes("pode ter"),
    "Unknown website is not verified absence");
  assert(x["without-instagram"].label.includes("não confirmado") &&
    x["without-instagram"].description.includes("não prova ausência"),
    "Unconfirmed candidate is not evidence of no Instagram");
  assert(x["with-instagram"].description.includes("não comprova titularidade"),
    "High confidence is not official identity");
  assert(x["with-site"].description.includes("não comprova"),
    "A website URL need not respond or be official");
});
Deno.test("phone listed and WhatsApp-compatible are distinct filters",()=>{
  const noPhone=ctx(b("none"));
  const shortPhone=ctx(b("short",{phone:"123"}));
  const brPhone=ctx(b("br",{phone:"(35) 98888-8888"}));
  const results=[noPhone,shortPhone,brPhone];
  eq(results.filter(item=>matchesResultFilters(item,{
    ...DEFAULT_RESULT_FILTERS,contact:"phone",
  },"all")).map(x=>x.business.placeId),
  ["overture:short","overture:br"],"Phone listed includes a malformed number");
  eq(results.filter(item=>matchesResultFilters(item,{
    ...DEFAULT_RESULT_FILTERS,contact:"whatsapp",
  },"all")).map(x=>x.business.placeId),
  ["overture:br"],"WhatsApp-format rejects malformed number");
  assert(hasIdentifiedBusinessPhone(shortPhone.business) &&
    !hasUsableWhatsApp(shortPhone.business),"No implied WhatsApp account");
});
Deno.test("email only tests structure, site only tests source presence",()=>{
  const invalid=ctx(b("invalid",{email:"not-an-email",website:null}));
  const possible=ctx(b("possible",{email:"contato@example.invalid",
    website:"https://example.invalid"}));
  assert(!hasUsableBusinessEmail(invalid.business.email),"Invalid syntax excluded");
  assert(hasUsableBusinessEmail(possible.business.email),
    "Syntactically valid e-mail remains unverified");
  assert(matchesResultFilters(invalid,{...DEFAULT_RESULT_FILTERS,
    website:"without-site"},"all"),"Missing website candidate included");
  assert(!matchesResultFilters(possible,{...DEFAULT_RESULT_FILTERS,
    website:"without-site"},"all"),"Source-listed website excluded");
});
Deno.test("Instagram high confidence only; absent confidence and needs-review never pass",()=>{
  const values=[
    ctx(b("candidate",{instagram:"https://instagram.com/teste",
      instagramConfidence:"medium",instagramNeedsReview:true})),
    ctx(b("unknown",{instagram:"https://instagram.com/teste",
      instagramConfidence:null})),
    ctx(b("needs-review",{instagram:"https://instagram.com/teste",
      instagramConfidence:"high",instagramNeedsReview:true})),
    ctx(b("high",{instagram:"https://instagram.com/teste",
      instagramConfidence:"high",instagramNeedsReview:false})),
    ctx(b("absent")),
  ];
  const yes=values.filter(item=>matchesResultFilters(item,{
    ...DEFAULT_RESULT_FILTERS,instagram:"with-instagram"},"all"));
  const no=values.filter(item=>matchesResultFilters(item,{
    ...DEFAULT_RESULT_FILTERS,instagram:"without-instagram"},"all"));
  eq(yes.map(x=>x.business.placeId),["overture:high"],
    "Only confirmed/high-confidence candidate passes");
  eq(no.length,4,"No high-confidence Instagram does NOT mean no Instagram exists");
  assert(!hasConfirmedInstagram(values[1].business),"Null confidence must not pass");
});
Deno.test("commercial chance uses verified-high data only, never unknown confidence",()=>{
  const base={website:null,phone:null,instagram:"https://instagram.com/example"};
  const missing=calculateLeadChance({...base,instagramConfidence:null});
  const medium=calculateLeadChance({...base,instagramConfidence:"medium"});
  const high=calculateLeadChance({...base,instagramConfidence:"high"});
  const flagged=calculateLeadChance({...base,instagramConfidence:"high",
    instagramNeedsReview:true});
  const absent=calculateLeadChance({...base,instagram:null});
  eq(missing.score,absent.score,"Missing confidence must not inflate prospect chance");
  eq(medium.score,absent.score,"Medium confidence must not inflate prospect chance");
  eq(flagged.score,absent.score,"High confidence flagged for review cannot inflate chance");
  assert(high.score>absent.score,"Reviewed high-confidence profile may add a signal");
});
Deno.test("loaded-only counts ignore future pages and preserve CRM/new totals",()=>{
  const loaded=[
    ctx(b("new",{isOpenNow:true})),
    ctx(b("salvo",{isOpenNow:false}),saved),
    ctx(b("unknown",{isOpenNow:null})),
  ];
  const first=summarizeLoadedSearchResults(loaded,2);
  eq(first,{loadedCount:3,displayedCount:2,savedCount:1,newCount:2,
    openCount:1,unknownHoursCount:1},"All totals relate to loaded cards");
  const more=ctx(b("later",{isOpenNow:true}));
  const after=summarizeLoadedSearchResults([...loaded,more],3);
  eq(after.loadedCount,4,"Count changes only when actual next page is loaded");
  eq(after.openCount,2,"Open results count uses loaded cards, not citywide inventory");
  eq(countLoadedMatches(loaded,DEFAULT_RESULT_FILTERS,"all","open"),1,
    "Open mode uses only known-open results");
  eq(countLoadedMatches(loaded,DEFAULT_RESULT_FILTERS,"waiting","all"),1,
    "Saved-status filter counts only local CRM statuses");
  eq(countLoadedMatches(loaded,DEFAULT_RESULT_FILTERS,"new","all"),2,
    "New leads counts only returned entries");
});
Deno.test("quick-filter chips count ONLY loaded cards and current mode",()=>{
  const entries=[
    ctx(b("a",{phone:"(35) 98888-8888",website:null,isOpenNow:true})),
    ctx(b("b",{phone:"123",website:null,isOpenNow:false})),
    ctx(b("c",{phone:"(35) 98888-8888",
      instagram:"https://instagram.com/example",
      instagramConfidence:"high",isOpenNow:null})),
  ];
  const phonePreset=SMART_FILTERS.find(p=>p.id==="no-site-phone");
  const whatsappPreset=SMART_FILTERS.find(p=>p.id==="no-site-whatsapp");
  assert(phonePreset&&whatsappPreset,"Required presets exist");
  eq(countLoadedMatches(entries,phonePreset.resultFilters,
    phonePreset.leadStatusFilter,"all"),2,"Phone present preset");
  eq(countLoadedMatches(entries,whatsappPreset.resultFilters,
    whatsappPreset.leadStatusFilter,"all"),1,"WhatsApp format preset");
  eq(countLoadedMatches(entries,phonePreset.resultFilters,
    phonePreset.leadStatusFilter,"open"),1,"Current open mode is respected");
  assert(SMART_FILTERS.every(p=>p.title.trim().length>12),
    "Every smart filter explains its evidence limit");
  eq(manualResultFilters("all"),DEFAULT_RESULT_FILTERS,"Clearing filters");
});
