import {isCommercialRecord,isObject,type CommercialRecord} from "./store.ts";
export type ObjectionReason="price"|"timing"|"supplier"|"no_interest"|"no_reply"|"other";
export type Objection=CommercialRecord&{leadId:string;reason:ObjectionReason;details:string;revisitOn:string;resolved:boolean};
export const OBJECTION_REASONS:Record<ObjectionReason,string>={
 price:"Preço / orçamento",timing:"Momento inadequado",supplier:"Já possui fornecedor",
 no_interest:"Sem interesse",no_reply:"Sem resposta",other:"Outro motivo",
};
export function isObjection(x:unknown):x is Objection{
 return isCommercialRecord(x)&&isObject(x)&&typeof x["leadId"]==="string"&&
  Object.hasOwn(OBJECTION_REASONS,String(x["reason"]))&&
 typeof x["details"]==="string"&&x["details"].length<=2000&&typeof x["revisitOn"]==="string"&&
 (x["revisitOn"]===""||/^\d{4}-\d{2}-\d{2}$/.test(x["revisitOn"]))&&typeof x["resolved"]==="boolean";
}
export function summarizeObjections(records:readonly Objection[],eligibleIds?:ReadonlySet<string>){
 const filtered=eligibleIds?records.filter(x=>eligibleIds.has(x.leadId)):records;
 return Object.entries(OBJECTION_REASONS).map(([reason,label])=>({
   reason:reason as ObjectionReason,label,
   count:filtered.filter(x=>x.reason===reason).length,
 })).sort((a,b)=>b.count-a.count);
}
