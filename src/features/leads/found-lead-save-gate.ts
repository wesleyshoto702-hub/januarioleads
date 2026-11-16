/** Prevent overlapping or quickly repeated save requests for the same lead.
 * Scoped to one mounted CRM workspace. Never caches credentials or logs PII.
 * This only prevents client-side races; database uniqueness/RLS still need
 * E2E verification after Fase 0. Do not treat phone as an identity key.
 */
import { normalizeLocationText } from "../../lib/location.ts";
import type { BusinessSearchResult } from "../search-leads/types.ts";
export type FoundLeadSaveResult = {ok:true;leadId:string} | {ok:false;message:string};

function keys(business:BusinessSearchResult):string[]{
  const result:string[]=[];
  if(business.placeId?.trim())result.push("place:"+business.placeId.trim());
  const name=normalizeLocationText(business.name);
  const address=normalizeLocationText(business.address);
  const city=normalizeLocationText(business.city);
  const state=normalizeLocationText(business.state);
  // No phone-only merging: separate branches often share switchboard numbers.
  if(name&&address&&city&&state)
    result.push("location:"+[state,city,name,address].join("|"));
  return result;
}
export function createFoundLeadSaveGate(){
  const inFlight=new Map<string,Promise<FoundLeadSaveResult>>();
  const confirmed=new Map<string,string>();
  const confirmedByLead=new Map<string,Set<string>>();
  // Logout/account reset invalidates results from old in-flight requests.
  let generation=0;

  function run(business:BusinessSearchResult,
    save:()=>Promise<FoundLeadSaveResult>):Promise<FoundLeadSaveResult>{
    const ids=keys(business);
    const currentGeneration=generation;
    for(const key of ids){
      const leadId=confirmed.get(key);
      if(leadId)return Promise.resolve({ok:true,leadId});
    }
    for(const key of ids){
      const same=inFlight.get(key);
      if(same)return same;
    }
    // Enqueue synchronously before invoking the async saver.
    const task=Promise.resolve()
      .then(()=>currentGeneration===generation?save():{
        ok:false as const,message:"A sessão mudou. Repita a ação na conta atual.",
      })
      .then(result=>{
        if(result.ok && currentGeneration===generation){
          let group=confirmedByLead.get(result.leadId);
          if(!group){group=new Set();confirmedByLead.set(result.leadId,group);}
          for(const key of ids){confirmed.set(key,result.leadId);group.add(key);}
        }
        return result;
      }).finally(()=>{
        for(const key of ids)if(inFlight.get(key)===task)inFlight.delete(key);
      });
    for(const key of ids)inFlight.set(key,task);
    return task;
  }

  function forgetSaved(leadId:string){
    const oldKeys=confirmedByLead.get(leadId);
    if(oldKeys)for(const key of oldKeys) {
      if(confirmed.get(key)===leadId)confirmed.delete(key);
    }
    confirmedByLead.delete(leadId);
  }
  function reset(){
    generation++;
    inFlight.clear();
    confirmed.clear();
    confirmedByLead.clear();
  }
  return {run,forgetSaved,reset};
}
