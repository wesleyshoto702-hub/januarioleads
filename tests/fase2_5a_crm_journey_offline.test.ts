/// <reference lib="deno.ns" />
/** Fase 2.5a — SIMULATED, entirely offline CRM journey.
 * Only fake companies/accounts. No Supabase, Google, Geoapify or real calls.
 */
import { buildFoundLead } from "../src/features/leads/build-found-lead.ts";
import { createFoundLeadSaveGate } from "../src/features/leads/found-lead-save-gate.ts";
import {
  applyConfirmedContact,applyNextActionPatch,changeLeadStatus,toggleLeadFavorite,
} from "../src/features/next-actions/crm-journey.ts";
import {
  getLeadActionSummary,getSavedNextAction,DEFAULT_FOLLOW_UP_DAYS,
} from "../src/features/next-actions/next-actions.ts";
import { findBusinessDuplicate } from "../src/features/search-leads/identity.ts";
import { presenceFromBusiness } from "../src/features/business-presence/presence-transform.ts";
import { drainMutations, type PendingMutation } from "../src/lib/mutation-queue.ts";
import type { PersistedLead } from "../src/features/leads/remote-leads.ts";
import type { BusinessSearchResult } from "../src/features/search-leads/types.ts";

function assert(x:unknown,message:string):asserts x{if(!x)throw Error(message);}
function eq(a:unknown,b:unknown,message:string){
  if(JSON.stringify(a)!==JSON.stringify(b))
    throw Error(message+"; got "+JSON.stringify(a)+" expected "+JSON.stringify(b));
}
const DAY="2026-11-15";
const NOW=new Date("2026-11-15T12:00:00.000Z");
function business(id:string,changes:Partial<BusinessSearchResult>={}):BusinessSearchResult{
  return {
    placeId:"overture:"+id,source:"overture",
    sourceUrl:"https://explore.overturemaps.org/",
    name:"Barbearia Fictícia "+id,primaryCategory:"barber",
    categories:["barber"],description:null,address:"Rua Exemplo 25",
    neighborhood:null,city:"Lavras",state:"MG",
    phone:"(35) 98888-8888",internationalPhone:null,
    email:"falso@example.invalid",website:null,instagram:null,
    rating:null,reviewCount:null,isOpenNow:null,
    openingHours:[],googleMapsUrl:null,businessStatus:null,
    latitude:-21.24,longitude:-44.98,...changes,
  };
}
function lead(id="a",businessFields:Partial<BusinessSearchResult>={}):PersistedLead{
  return buildFoundLead(business(id,businessFields),"Barbearia",{
    id:"lead-"+id,now:NOW,
  });
}

Deno.test("Buscar → Salvar uses real transformation and immutable source/time/id",()=>{
  const source=business("01",{phone:null,internationalPhone:"5535999999999"});
  const saved=buildFoundLead(source,"Barbearia",{id:"crm-01",now:NOW});
  eq(saved.id,"crm-01","Injected fake UUID");
  eq(saved.placeId,"overture:01","Identity survives");
  eq(saved.source,"places-search","CRM internal source stays compatible");
  eq(saved.status,"send_message","New leads need a first message");
  eq(saved.firstContact,DAY,"Business creation day");
  eq(saved.createdAt,NOW.toISOString(),"CreatedAt clock");
  eq(saved.phone,"5535999999999","Fallback international phone");
  eq(saved.state,"MG","Preserve state");
  eq(saved.city,"Lavras","Preserve municipality");
  eq(saved.address,"Rua Exemplo 25","Preserve physical address");
  assert(saved.notes.includes("Lead encontrado"),"Search origin note kept");
  assert(saved.factualDescription?.includes("Lavras"),"Factual description kept");
  assert(!saved.isFavorite,"Favorite is opt-in");
  eq(source.phone,null,"Original search object is not mutated");
});

Deno.test("unverified Instagram stays medium/reviewed after saving, never invent Google provenance",()=>{
  const unknown=business("ig",{instagram:"https://instagram.com/nao_verificado/"});
  const presence=presenceFromBusiness(unknown);
  assert(presence,"Provider Instagram yields a candidate record");
  eq(presence.instagramConfidence,"medium","Unknown profile is NOT high confidence");
  eq(presence.instagramSource,"existing_data","Overture ID is not Google evidence");
  eq(presence.instagramNeedsReview,true,"Needs review if missing evidence");
  const saved=buildFoundLead(unknown,"Barbearia",{id:"crm-ig",now:NOW});
  eq(saved.instagramConfidence,"medium","CRM must not promote unknown confidence");
  eq(saved.instagramNeedsReview,true,"Review flag remains");
  eq(saved.instagramSource,"existing_data","CRM provenance is not fabricated");
  const high=business("ig-high",{instagram:"https://instagram.com/manual/",
    instagramConfidence:"high",instagramSource:"manual_confirmation",
    instagramNeedsReview:false});
  const confirmed=buildFoundLead(high,"Barbearia",{id:"crm-high",now:NOW});
  eq(confirmed.instagramConfidence,"high","Explicitly confirmed data stays high");
  eq(confirmed.instagramSource,"manual_confirmation","Keep manual source");
});

Deno.test("identity uses place ID or name+known address and city, never shared phone alone",()=>{
  const a=lead("01",{name:"Barbearia Única"});
  const stored=[a];
  eq(findBusinessDuplicate(business("01",{name:"Barbearia Única"}),stored)?.id,
    "lead-01","Same Overture ID");
  eq(findBusinessDuplicate(business("alias",{name:"Barbearia Única",
    address:"RUA EXEMPLO, 25"}),stored)?.id,
    "lead-01","Same normalized address/name/location");
  eq(findBusinessDuplicate(business("branch",{name:"Barbearia Única",
    address:"Rua Exemplo 27"}),stored),null,"Different branch address");
  eq(findBusinessDuplicate(business("other",{name:"Academia Total",
    phone:a.phone}),stored),null,"Shared phone alone not identity");
  eq(findBusinessDuplicate(business("another-city",{name:"Barbearia Única",
    city:"Varginha"}),stored),null,"Same street/name, different municipality");
});

Deno.test("parallel and rapid-repeat saves resolve once, including alias source IDs",async()=>{
  const gate=createFoundLeadSaveGate();
  const original=business("01",{name:"Barbearia Única"});
  const alias=business("alias",{name:"Barbearia Única",
    address:"Rua Exemplo, 25"});
  let releases!:(value:{ok:true,leadId:string})=>void;
  let writes=0;
  const promise=gate.run(original,()=>{
    writes++;
    return new Promise(resolve=>{releases=resolve;});
  });
  const duplicate=gate.run(original,async()=>{
    writes++;return {ok:true as const,leadId:"unexpected"};
  });
  const aliasDuplicate=gate.run(alias,async()=>{
    writes++;return {ok:true as const,leadId:"unexpected-alias"};
  });
  await Promise.resolve(); // begin asynchronous saver
  eq(writes,1,"Only one simulated persistence call");
  releases({ok:true,leadId:"saved-01"});
  const results=await Promise.all([promise,duplicate,aliasDuplicate]);
  assert(results.every(r=>r.ok&&r.leadId==="saved-01"),
    "All equivalent in-flight requests receive original ID");
  eq(writes,1,"No duplicate saved");
  const again=await gate.run(original,async()=>{
    writes++;return {ok:true,leadId:"second"};
  });
  assert(again.ok&&again.leadId==="saved-01","Repeat does not re-save after success");
  eq(writes,1,"Repeat does not write");
  gate.forgetSaved("saved-01");
  const afterDelete=await gate.run(original,async()=>{
    writes++;return {ok:true,leadId:"recreated"};
  });
  assert(afterDelete.ok&&afterDelete.leadId==="recreated",
    "After explicit delete, business can be re-added");
  gate.reset();
  const otherAccount=await gate.run(original,async()=>{
    writes++;return {ok:true,leadId:"other-account-lead"};
  });
  assert(otherAccount.ok&&otherAccount.leadId==="other-account-lead",
    "In-memory guard resets between fake accounts");
  eq(writes,3,"Fresh writes only after delete/reset");
});

Deno.test("same-name same-address shops with conflicting phone/category remain separate",async()=>{
  const gate=createFoundLeadSaveGate();
  const common={name:"Barbearia Mesmo Endereço",address:"Rua Exemplo 25"};
  const a=business("shop-a",common);
  const differentPhone=business("shop-b",{
    ...common,phone:"(35) 97777-7777",
  });
  const differentCategory=business("shop-c",{
    ...common,primaryCategory:"hair_salon",
  });
  let writes=0;
  const save=(id:string)=>async()=>{
    writes++;
    return {ok:true as const,leadId:id};
  };
  const results=await Promise.all([
    gate.run(a,save("crm-a")),
    gate.run(differentPhone,save("crm-b")),
    gate.run(differentCategory,save("crm-c")),
  ]);
  eq(results.map(x=>x.ok?x.leadId:null),["crm-a","crm-b","crm-c"],
    "Do not collapse different shops sharing known address");
  eq(writes,3,"Each distinct conflicting shop must have its own fake save");
});

Deno.test("reset during an in-flight save cannot leak old account's result",async()=>{
  const gate=createFoundLeadSaveGate();
  const company=business("tenant");
  let completeOld!:(result:{ok:true;leadId:string})=>void;
  const old=gate.run(company,()=>new Promise(resolve=>{completeOld=resolve;}));
  await Promise.resolve();
  gate.reset(); // Simulated logout/account switch while old request is in flight.
  const current=await gate.run(company,async()=>({
    ok:true as const,leadId:"current-account",
  }));
  assert(current.ok&&current.leadId==="current-account","New account has its own result");
  completeOld({ok:true,leadId:"previous-account"});
  await old;
  const repeated=await gate.run(company,async()=>({
    ok:true as const,leadId:"unexpected-third",
  }));
  assert(repeated.ok&&repeated.leadId==="current-account",
    "Old in-flight completion cannot overwrite new account identity");
});

Deno.test("failed save or remote unavailable does not mark lead as saved; retry possible",async()=>{
  const gate=createFoundLeadSaveGate();
  const company=business("fail");
  let attempts=0;
  const failed=await gate.run(company,async()=>{
    attempts++;
    return {ok:false as const,message:"Falha na sincronização"};
  });
  assert(!failed.ok,"Failed store must not mark as saved");
  const success=await gate.run(company,async()=>{
    attempts++;
    return {ok:true as const,leadId:"saved-after-retry"};
  });
  assert(success.ok && success.leadId==="saved-after-retry","Successful retry possible");
  eq(attempts,2,"No false success from prior failed request");
});

Deno.test("save → favorite ↔ unfavorite → status → next action preserves CRM identity",()=>{
  const saved=lead("journey",{name:"Empresa Fictícia Jornada"});
  const favorite=toggleLeadFavorite(saved);
  eq(favorite.isFavorite,true,"User favorited lead");
  eq(saved.isFavorite,undefined,"Original unchanged");
  const restored=toggleLeadFavorite(favorite);
  eq(restored.isFavorite,false,"Unfavorited by second click");
  const waiting=changeLeadStatus(favorite,"waiting");
  eq(waiting.status,"waiting","Lead changed status");
  const followUp=applyNextActionPatch(waiting,{
    nextActionType:"follow_up",nextActionDate:"2026-11-20",
    nextActionNotes:"Retomar conversa fictícia",
  });
  const summary=getLeadActionSummary(followUp,DAY);
  eq(summary.saved?.type,"follow_up","Saved follow-up visible");
  eq(summary.temporal.daysDelta,5,"Follow-up is five days later");
  eq(followUp.placeId,saved.placeId,"Original search identity preserved");
  eq(followUp.id,saved.id,"CRM ID preserved");
  eq(followUp.isFavorite,true,"Status/action do not erase favorite");
  eq(followUp.notes,saved.notes,"Original company notes preserved");
  const accepted=changeLeadStatus(followUp,"accepted");
  eq(accepted.nextActionType,undefined,"Accepted removes old follow-up");
  eq(accepted.nextActionDate,undefined,"Accepted clears obsolete date");
  const rejected=changeLeadStatus(followUp,"rejected");
  eq(rejected.nextActionType,undefined,"Rejected clears tasks");
  eq(rejected.isFavorite,true,"Rejected does not erase favorite");
  const unchanged=changeLeadStatus(rejected,"rejected");
  assert(unchanged===rejected,"No-op status transition returns same object");
});

Deno.test("opening WhatsApp alone never changes CRM; explicit confirmed send schedules follow-up",()=>{
  const initial=lead("whats");
  const preview={...initial}; // navigation/contact-opening event without confirmation
  eq(preview.status,"send_message","Opening WhatsApp is NOT confirmed delivery");
  eq(preview.lastContact,undefined,"No contact logged on open");
  const after=applyConfirmedContact(initial,DAY,false);
  eq(after.status,"waiting","Only user-confirmed send advances CRM");
  eq(after.lastContact,DAY,"Contact date after manual confirmation");
  eq(after.nextActionType,"follow_up","Default follow-up created");
  eq(after.nextActionDate,"2026-11-20","Five-day schedule");
  eq(DEFAULT_FOLLOW_UP_DAYS,5,"Follow-up config unchanged");
  eq(initial.nextActionType,undefined,"Original unchanged");
  const followUpConfirmed=applyConfirmedContact(after,"2026-11-20",true);
  eq(followUpConfirmed.status,"waiting","Follow-up keeps waiting status");
  eq(followUpConfirmed.lastContact,"2026-11-20","Last contact updated");
  eq(followUpConfirmed.nextActionType,undefined,"Completed follow-up cleared");
  const newAction=applyNextActionPatch(followUpConfirmed,{
    nextActionType:"send_proposal",nextActionDate:"2026-11-23",
  });
  eq(getSavedNextAction(newAction)?.label,"Enviar proposta","Next action label");
  const cleared=applyNextActionPatch(newAction,{nextActionType:undefined});
  eq(cleared.nextActionDate,undefined,"Clearing removes date too");
});

Deno.test("queue acknowledges exact revision; second edit during send is retained",async()=>{
  const first=lead("queue");
  const newer=toggleLeadFavorite(first);
  let pending:PendingMutation<PersistedLead>[]=[
    {id:first.id,revision:"r1",lead:first},
  ];
  const sent:string[]=[];
  let sameOwner=true;
  await drainMutations({
    read:()=>pending,
    write:next=>{pending=next;},
    sameOwner:async()=>sameOwner,
    send:async(item)=>{
      sent.push(item.revision);
      if(item.revision==="r1"){
        pending=[{id:first.id,revision:"r2",lead:newer}];
      }
      return true;
    },
  });
  eq(sent,["r1","r2"],"Both revisions sent");
  eq(pending,[],"Only acknowledged revisions removed");
  eq(sameOwner,true,"Same fake account throughout");
});

Deno.test("queue rejects account switch/failing backend without clearing pending update",async()=>{
  const value=lead("scoped");
  let pending:PendingMutation<PersistedLead>[]=[
    {id:value.id,revision:"rev-1",lead:value},
  ];
  let sends=0;
  const read=()=>pending,write=(rows:PendingMutation<PersistedLead>[])=>pending=rows;
  let differentAccount=false;
  try{
    await drainMutations({read,write,sameOwner:async()=>!differentAccount,
      send:async()=>{sends++;return false;}});
    throw Error("expected failure missing");
  }catch(err){
    eq((err as Error).message,"PENDING_WRITE_FAILED","Failure is propagated");
  }
  eq(sends,1,"One failed fake server call");
  eq(pending.length,1,"Failed write not discarded");
  differentAccount=true;
  try{
    await drainMutations({read,write,sameOwner:async()=>!differentAccount,
      send:async()=>{sends++;return true;}});
    throw Error("expected account change missing");
  }catch(err){
    eq((err as Error).message,"ACCOUNT_CHANGED","No cross-account sync");
  }
  eq(sends,1,"Account switch does not send anything");
  eq(pending.length,1,"Original pending operation intact");
});
