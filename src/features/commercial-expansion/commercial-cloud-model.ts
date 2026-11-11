/** Cloud keys are explicitly allowlisted both in Postgres and in the browser. */
export const CLOUD_DOCUMENT_KEYS = [
  "proposals","campaigns","sequences","enrollments",
  "agenda","objections","projects","goals","digital-reports",
] as const;
export type CloudDocumentKey = (typeof CLOUD_DOCUMENT_KEYS)[number];
export const CLOUD_STORAGE_KEYS: Record<CloudDocumentKey,string> = {
  proposals:"proposals:v1",
  campaigns:"commercial:v1:campaigns",
  sequences:"commercial:v1:sequences",
  enrollments:"commercial:v1:enrollments",
  agenda:"commercial:v1:agenda",
  objections:"commercial:v1:objections",
  projects:"commercial:v1:projects",
  goals:"commercial:v1:goals",
  "digital-reports":"digital-presence:reports:v1",
};
export const CLOUD_CHANGE_EVENT = "januarioleads:cloud-document-change";

export function cloudKeyForStorage(key:string):CloudDocumentKey|null {
  return CLOUD_DOCUMENT_KEYS.find(kind=>CLOUD_STORAGE_KEYS[kind]===key)??null;
}

function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value!==null&&typeof value==="object"){
    const record=value as Record<string,unknown>;
    const sorted:Record<string,unknown>={};
    for(const key of Object.keys(record).sort())sorted[key]=canonical(record[key]);
    return sorted;
  }
  return value;
}
export function snapshotJson(items:unknown[]):string {
  return JSON.stringify(canonical(items));
}
/** Deterministic equality token; not a password/hash of confidential contents. */
export function snapshotFingerprint(items:unknown[]):string {
  const body=snapshotJson(items);
  let hash=2166136261;
  for(let index=0;index<body.length;index++){
    hash^=body.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16)+"-"+body.length.toString(16);
}
function identifier(key:CloudDocumentKey,item:unknown):string|null {
  if(!item||typeof item!=="object"||Array.isArray(item))return null;
  const data=item as Record<string,unknown>;
  if(key==="digital-reports"){
    return typeof data.url==="string"&&
      (data.device==="mobile"||data.device==="desktop")
      ?data.url+"\u0000"+data.device:null;
  }
  return typeof data.id==="string"&&data.id.length>0?data.id:null;
}
function modifiedAt(key:CloudDocumentKey,item:unknown):number {
  const data=item as Record<string,unknown>;
  const time=key==="digital-reports"?data.checkedAt:data.updatedAt;
  const value=typeof time==="string"?Date.parse(time):NaN;
  return Number.isFinite(value)?value:0;
}
/**
 * Conflict-safe additive merge: never silently drops unsynced local items.
 * Deletions on concurrent devices may need to be repeated after a conflict.
 */
export function mergeCommercialSnapshots(
  key:CloudDocumentKey,local:unknown[],remote:unknown[],
):unknown[]{
  const order:string[]=[];
  const byId=new Map<string,unknown>();
  function take(item:unknown,source:"local"|"remote",index:number){
    const id=identifier(key,item)??source+"-invalid-"+index;
    if(!byId.has(id)){byId.set(id,item);order.push(id);return;}
    if(source==="local"&&modifiedAt(key,item)>=modifiedAt(key,byId.get(id))){
      byId.set(id,item);
    }
  }
  remote.forEach((x,i)=>take(x,"remote",i));
  local.forEach((x,i)=>take(x,"local",i));
  return order.map(id=>byId.get(id));
}
export type CloudRevision={revision:number;fingerprint:string};
/**
 * Choose which snapshot to trust on login:
 * - unchanged local since last cloud ack -> newer remote wins;
 * - local changed against same remote revision -> local wins, including deletions;
 * - concurrent changes -> preserve both and select newer per item.
 */
export function chooseCommercialSnapshot(
  key:CloudDocumentKey,local:unknown[],remote:unknown[],
  last:CloudRevision|null,remoteRevision:number,
):{content:unknown[];conflict:boolean}{
  const localFingerprint=snapshotFingerprint(local);
  if(localFingerprint===snapshotFingerprint(remote))
    return {content:remote,conflict:false};
  if(localFingerprint===(last?.fingerprint??null))
    return {content:remote,conflict:false};
  if(!local.length&&!last)
    return {content:remote,conflict:false};
  if(last?.revision===remoteRevision)
    return {content:local,conflict:false};
  return {content:mergeCommercialSnapshots(key,local,remote),conflict:true};
}
