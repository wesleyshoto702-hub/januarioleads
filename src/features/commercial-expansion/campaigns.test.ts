/// <reference lib="deno.ns" />
import {campaignCounts,isCampaign} from "./campaigns.ts";
import {freshRecord,isCommercialRecord} from "./store.ts";
Deno.test("Campaign record has stable identity and does not change CRM data",()=>{
  const c={...freshRecord(),name:"Lavras",description:"",target:12,leadIds:["one"],archived:false};
  if(!isCampaign(c)||!isCommercialRecord(c))throw Error("Campaign rejected");
  const leads=[{id:"one",status:"waiting"},{id:"two",status:"accepted"}] as never[];
  const result=campaignCounts(c,leads);
  if(result.assigned!==1||result.contacted!==1||result.accepted!==0)throw Error("Counts not tied to campaign membership");
});
