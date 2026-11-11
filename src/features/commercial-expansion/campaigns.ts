import type { PersistedLead } from "../leads/remote-leads.ts";
import {isCommercialRecord,isObject,type CommercialRecord} from "./store.ts";
export type Campaign=CommercialRecord&{
 name:string;description:string;target:number;leadIds:string[];archived:boolean;
};
export function isCampaign(x:unknown):x is Campaign {
 return isCommercialRecord(x)&&isObject(x)&&typeof x.name==="string"&&typeof x.description==="string"&&
 typeof x.target==="number"&&Number.isInteger(x.target)&&x.target>=1&&x.target<=10000&&
 typeof x.archived==="boolean"&&Array.isArray(x.leadIds)&&x.leadIds.length<=300&&
 x.leadIds.every(id=>typeof id==="string");
}
export function campaignCounts(c:Campaign,leads:readonly PersistedLead[]){
 const members=leads.filter(l=>c.leadIds.includes(l.id));
 return {assigned:members.length,contacted:members.filter(l=>l.status!=="send_message").length,
 accepted:members.filter(l=>l.status==="accepted").length,
 rejected:members.filter(l=>l.status==="rejected").length};
}
