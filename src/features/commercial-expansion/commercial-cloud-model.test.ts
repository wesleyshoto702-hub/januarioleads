/// <reference lib="deno.ns" />
import {
  cloudKeyForStorage,CLOUD_DOCUMENT_KEYS,CLOUD_STORAGE_KEYS,
  snapshotFingerprint,mergeCommercialSnapshots,chooseCommercialSnapshot,
} from "./commercial-cloud-model.ts";

function check(condition:unknown,message:string){if(!condition)throw new Error(message);}

Deno.test("Cloud collection whitelist excludes API keys, auth, and other sensitive storage",()=>{
  check(CLOUD_DOCUMENT_KEYS.length===9,"All commercial collections must be explicitly allowed");
  check(cloudKeyForStorage("proposals:v1")==="proposals","Proposals should migrate");
  check(cloudKeyForStorage("commercial:v1:objections")==="objections","Objections should migrate");
  check(cloudKeyForStorage("digital-presence:reports:v1")==="digital-reports","Digital reports should migrate");
  for(const name of ["maps-personal-browser-api-key","januarioleads:auth-session",
    "commercial:cloud:revisions:v1","personal-geoapify-key"]){
    check(cloudKeyForStorage(name)===null,"Secret or internal state must never be synced");
  }
  check(Object.keys(CLOUD_STORAGE_KEYS).length===CLOUD_DOCUMENT_KEYS.length,
    "Every document needs a unique local storage key");
});
Deno.test("Snapshots have stable fingerprints despite JSONB property reordering",()=>{
  const left=[{id:"a",updatedAt:"2026-11-10",info:{z:1,a:2}}];
  const right=[{info:{a:2,z:1},updatedAt:"2026-11-10",id:"a"}];
  check(snapshotFingerprint(left)===snapshotFingerprint(right),
    "JSONB key ordering must not trigger phantom edits");
});
Deno.test("Clean local browser adopts newer cloud snapshot",()=>{
  const old=[{id:"a",updatedAt:"2026-11-09",name:"Old"}];
  const newer=[{id:"a",updatedAt:"2026-11-10",name:"New"}];
  const decision=chooseCommercialSnapshot("campaigns",old,newer,
    {revision:1,fingerprint:snapshotFingerprint(old)},2);
  check(!decision.conflict&&decision.content===newer,
    "Unedited browser should adopt more recent server content");
});
Deno.test("Local deletion against same revision is preserved, not resurrected",()=>{
  const cloud=[{id:"a",updatedAt:"2026-11-09",name:"Old"}];
  const choice=chooseCommercialSnapshot("campaigns",[],cloud,
    {revision:3,fingerprint:snapshotFingerprint(cloud)},3);
  check(choice.content.length===0&&!choice.conflict,"Confirmed deletion should remain deleted");
});
Deno.test("Conflicting devices merge independent records and newer edits",()=>{
  const remote=[
    {id:"a",updatedAt:"2026-11-10T19:00:00Z",name:"Old A"},
    {id:"b",updatedAt:"2026-11-10T20:00:00Z",name:"B"},
  ];
  const local=[
    {id:"a",updatedAt:"2026-11-10T21:00:00Z",name:"Edited A"},
    {id:"c",updatedAt:"2026-11-10T21:00:00Z",name:"C"},
  ];
  const merged=mergeCommercialSnapshots("projects",local,remote);
  check(merged.length===3,"Concurrent records should be retained");
  check((merged.find(x=>(x as {id:string}).id==="a") as {name:string})?.name==="Edited A",
    "Newest edit of same record must win");
  const choice=chooseCommercialSnapshot("projects",local,remote,null,7);
  check(choice.conflict&&choice.content.length===3,"Unknown divergence should be flagged");
});
Deno.test("Report snapshots deduplicate by normalized site and device",()=>{
  const remote=[{url:"https://site.com/",device:"mobile",checkedAt:"2026-11-10T10:00:00Z"}];
  const local=[{url:"https://site.com/",device:"mobile",checkedAt:"2026-11-10T12:00:00Z"},
    {url:"https://site.com/",device:"desktop",checkedAt:"2026-11-10T12:00:00Z"}];
  const merged=mergeCommercialSnapshots("digital-reports",local,remote);
  check(merged.length===2,"Reports for each device should be kept separately");
});
