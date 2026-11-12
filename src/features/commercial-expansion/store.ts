import { accountLocalStorage } from "../../lib/account-storage.ts";

/** Per-account, per-browser MVP records. No backend permissions implied. */
export type CommercialRecord = {id:string;createdAt:string;updatedAt:string};
export function nonemptyText(x:unknown,max=160):string {
  return typeof x==="string"?x.trim().slice(0,max):"";
}
export function isObject(x:unknown):x is Record<string,unknown> {
  return x!==null&&typeof x==="object"&&!Array.isArray(x);
}
export function isCommercialRecord(x:unknown):x is CommercialRecord & Record<string,unknown> {
  return isObject(x)&&typeof x["id"]==="string"&&/^[0-9a-f-]{36}$/i.test(x["id"])&&
    typeof x["createdAt"]==="string"&&Number.isFinite(Date.parse(x["createdAt"]))&&
    typeof x["updatedAt"]==="string"&&Number.isFinite(Date.parse(x["updatedAt"]));
}
export function loadCommercial<T extends CommercialRecord>(
  key:string,guard:(x:unknown)=>x is T,limit=300,
):T[]{
  if(typeof window==="undefined")return [];
  try{
    const value:unknown=JSON.parse(accountLocalStorage.getItem("commercial:v1:"+key)??"[]");
    return Array.isArray(value)?value.slice(0,limit).filter(guard):[];
  }catch{return [];}
}
export function saveCommercial<T extends CommercialRecord>(key:string,items:T[],limit=300):void {
  if(typeof window==="undefined")throw Error("Salvamento disponível somente no navegador.");
  if(items.length>limit)throw Error("Limite de registros atingido neste navegador.");
  const ids=new Set<string>();
  for(const x of items){
    if(!isCommercialRecord(x)||ids.has(x.id))throw Error("Os registros contêm IDs inválidos ou duplicados.");
    ids.add(x.id);
  }
  const value=JSON.stringify(items);
  try{
    accountLocalStorage.setItem("commercial:v1:"+key,value);
    if(accountLocalStorage.getItem("commercial:v1:"+key)!==value)
      throw Error("Armazenamento indisponível.");
  }catch{throw Error("Não foi possível salvar neste navegador. Verifique as permissões e o espaço disponível.");}
}
export function freshRecord():CommercialRecord {
  const now=new Date().toISOString();
  return {id:crypto.randomUUID(),createdAt:now,updatedAt:now};
}
export function brazilToday(date=new Date()):string {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
export function displayDate(date:string):string {
  const d=/^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(0,10):date.slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d)?d.split("-").reverse().join("/"):"—";
}
export function exportRecords<T extends CommercialRecord>(kind:string,items:T[]):void {
  const data=JSON.stringify({product:"JanuarioLeads",kind,version:1,exportedAt:new Date().toISOString(),items},null,2);
  const url=URL.createObjectURL(new Blob([data],{type:"application/json;charset=utf-8"}));
  const el=document.createElement("a");el.href=url;el.download="januarioleads-"+kind+"-"+brazilToday()+".json";
  document.body.append(el);el.click();el.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}
