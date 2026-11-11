import {useEffect,useState,type ReactNode} from "react";
import {CloudOff,CloudUpload,RotateCcw} from "lucide-react";
import {getValidSession} from "../../lib/auth";
import {accountLocalStorage,currentWorkspaceUserId} from "../../lib/account-storage";
import {SUPABASE_PUBLISHABLE_KEY,SUPABASE_URL,USE_HTTPONLY_SESSION} from "../../lib/supabase-config";
import {isAgendaItem} from "./agenda";
import {isCampaign} from "./campaigns";
import {isEnrollment,isSequence} from "./sequences";
import {isObjection} from "./objections";
import {isClientProject} from "./projects";
import {isCommercialGoal} from "./goals";
import {parseProposalBackup} from "../proposals/proposals";
import {
  CLOUD_DOCUMENT_KEYS,CLOUD_STORAGE_KEYS,CLOUD_CHANGE_EVENT,
  cloudKeyForStorage,chooseCommercialSnapshot,
  snapshotFingerprint,snapshotJson,
  type CloudRevision,type CloudDocumentKey,
} from "./commercial-cloud-model";

const META_KEY="commercial:cloud:revisions:v1";
const BACKUP_PREFIX="commercial:cloud:rescue:v1:";
const MAX_REQUEST_BYTES=450_000;
type VersionTable=Partial<Record<CloudDocumentKey,CloudRevision>>;
type Row={document_key:CloudDocumentKey;content:unknown[];revision:number};
type ApiSession={id:string;token:string|null};
const allowed=new Set<string>(CLOUD_DOCUMENT_KEYS);

function safeData(kind:CloudDocumentKey,raw:unknown):unknown[]{
  if(!Array.isArray(raw))throw new Error("Formato inválido em "+kind);
  const limit=kind==="proposals"?120:
    kind==="campaigns"?100:kind==="sequences"?60:
    kind==="projects"?150:kind==="goals"?20:kind==="digital-reports"?15:
    kind==="objections"?500:300;
  if(raw.length>limit)throw new Error("Há registros acima do limite de "+kind);
  if(kind==="proposals"){
    return parseProposalBackup(JSON.stringify({
      product:"JanuarioLeads",section:"proposals",version:1,proposals:raw,
    }));
  }
  const guard:Record<Exclude<CloudDocumentKey,"proposals"|"digital-reports">,
    (item:unknown)=>boolean>={
    campaigns:isCampaign,sequences:isSequence,enrollments:isEnrollment,
    agenda:isAgendaItem,objections:isObjection,projects:isClientProject,goals:isCommercialGoal,
  };
  if(kind==="digital-reports"){
    return raw.filter((item)=>{
      if(!item||typeof item!=="object"||Array.isArray(item))return false;
      const d=item as Record<string,unknown>;
      return typeof d.url==="string"&&d.url.length<=500&&
        (d.device==="mobile"||d.device==="desktop")&&
        typeof d.checkedAt==="string"&&Number.isFinite(Date.parse(d.checkedAt))&&
        d.scores!==null&&typeof d.scores==="object"&&
        Array.isArray(d.metrics)&&Array.isArray(d.findings);
    });
  }
  const validator=guard[kind];
  if(!raw.every(validator))throw new Error("Há registros inválidos na coleção "+kind);
  return raw;
}
function localSnapshot(kind:CloudDocumentKey):unknown[]{
  const raw=accountLocalStorage.getItem(CLOUD_STORAGE_KEYS[kind]);
  if(raw===null)return [];
  try{return safeData(kind,JSON.parse(raw));}
  catch(error){
    throw new Error("Dados locais de "+kind+" precisam ser revisados antes da migração: "+
      (error instanceof Error?error.message:"arquivo inválido"));
  }
}
function writeLocal(kind:CloudDocumentKey,data:unknown[]){
  const value=JSON.stringify(data);
  const key=CLOUD_STORAGE_KEYS[kind];
  const previous=accountLocalStorage.getItem(key);
  if(previous!==value)accountLocalStorage.setItem(key,value);
}
function readMeta():VersionTable{
  try{
    const raw:unknown=JSON.parse(accountLocalStorage.getItem(META_KEY)??"{}");
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
    const data=raw as Record<string,unknown>;
    const meta:VersionTable={};
    for(const kind of CLOUD_DOCUMENT_KEYS){
      const val=data[kind];
      if(val&&typeof val==="object"&&!Array.isArray(val)){
        const entry=val as Record<string,unknown>;
        if(typeof entry.revision==="number"&&Number.isInteger(entry.revision)&&
          entry.revision>=0&&typeof entry.fingerprint==="string"){
          meta[kind]={revision:entry.revision,fingerprint:entry.fingerprint};
        }
      }
    }
    return meta;
  }catch{return {};}
}
function saveMeta(meta:VersionTable){
  accountLocalStorage.setItem(META_KEY,JSON.stringify(meta));
}
function keepRecovery(kind:CloudDocumentKey,previous:unknown[]){
  // Never silently overwrite an unsynced browser copy; keep one rescue snapshot
  // per kind. We never remove that copy automatically after upload.
  const key=BACKUP_PREFIX+kind;
  if(!accountLocalStorage.getItem(key))
    accountLocalStorage.setItem(key,JSON.stringify(previous));
}
async function authSession():Promise<ApiSession>{
  const session=await getValidSession();
  if(!session||!currentWorkspaceUserId()||session.user.id!==currentWorkspaceUserId())
    throw new Error("Entre novamente na sua conta para sincronizar os dados comerciais.");
  return {id:session.user.id,token:USE_HTTPONLY_SESSION?null:session.accessToken};
}
async function request(session:ApiSession,path:string,method="GET",body?:unknown):Promise<Response>{
  const headers:Record<string,string>={apikey:SUPABASE_PUBLISHABLE_KEY};
  if(session.token)headers.Authorization="Bearer "+session.token;
  if(body!==undefined)headers["Content-Type"]="application/json";
  if(method==="POST"||method==="PATCH")headers.Prefer="return=representation";
  return fetch(SUPABASE_URL+"/rest/v1/commercial_workspace_documents"+path,{
    method,cache:"no-store",credentials:"same-origin",headers,
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  });
}
function decodeRows(value:unknown):Row[]{
  if(!Array.isArray(value))throw new Error("Resposta inválida do banco de dados.");
  return value.map(raw=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))
      throw new Error("Registro do Supabase inválido.");
    const d=raw as Record<string,unknown>;
    const key=d.document_key;
    if(typeof key!=="string"||!allowed.has(key)||typeof d.revision!=="number"||!Number.isInteger(d.revision)||
      (d.revision as number)<1)
      throw new Error("Registro do Supabase fora do esquema esperado.");
    return {document_key:key as CloudDocumentKey,
      revision:d.revision as number,
      content:safeData(key as CloudDocumentKey,d.content)};
  });
}
async function allRemote(session:ApiSession):Promise<Map<CloudDocumentKey,Row>>{
  const result=await request(session,"?select=document_key,content,revision&user_id=eq."+
    encodeURIComponent(session.id));
  if(!result.ok)throw new Error("Supabase recusou a leitura dos dados comerciais (HTTP "+result.status+").");
  const rows=decodeRows(await result.json());
  return new Map(rows.map(x=>[x.document_key,x]));
}
async function singleRemote(session:ApiSession,kind:CloudDocumentKey):Promise<Row|null>{
  const result=await request(session,"?select=document_key,content,revision&user_id=eq."+
    encodeURIComponent(session.id)+"&document_key=eq."+encodeURIComponent(kind));
  if(!result.ok)throw new Error("Não foi possível conferir a versão de "+kind+".");
  return decodeRows(await result.json())[0]??null;
}
async function insertRemote(session:ApiSession,kind:CloudDocumentKey,
  content:unknown[]):Promise<Row|null>{
  checkSize(content);
  const result=await request(session,"?select=document_key,content,revision","POST",{
    user_id:session.id,document_key:kind,content,revision:1,
  });
  if(result.status===409)return null;
  if(!result.ok)throw new Error("Supabase recusou o primeiro envio de "+kind+" (HTTP "+result.status+").");
  return decodeRows(await result.json())[0]??null;
}
function checkSize(items:unknown[]){
  if(new TextEncoder().encode(JSON.stringify(items)).length>MAX_REQUEST_BYTES)
    throw new Error("Os dados excedem 450 KB; exporte um backup e divida o conjunto antes de sincronizar.");
}
async function updateRemote(session:ApiSession,kind:CloudDocumentKey,content:unknown[],
  expectedRevision:number):Promise<Row|null>{
  checkSize(content);
  const result=await request(session,
    "?select=document_key,content,revision&user_id=eq."+encodeURIComponent(session.id)+
    "&document_key=eq."+encodeURIComponent(kind)+
    "&revision=eq."+expectedRevision,
    "PATCH",{content,revision:expectedRevision+1,updated_at:new Date().toISOString()});
  if(!result.ok)throw new Error("Supabase recusou a atualização de "+kind+" (HTTP "+result.status+").");
  return decodeRows(await result.json())[0]??null;
}
async function applySnapshot(session:ApiSession,kind:CloudDocumentKey,
  local:unknown[],remote:Row|null,last:CloudRevision|null,
):Promise<{content:unknown[];row:Row|null;conflict:boolean}>{
  if(!remote){
    if(!local.length)return {content:local,row:null,conflict:false};
    const inserted=await insertRemote(session,kind,local);
    if(inserted)return {content:local,row:inserted,conflict:false};
    const latest=await singleRemote(session,kind);
    if(!latest)throw new Error("A coleção "+kind+" foi alterada durante a importação.");
    return applySnapshot(session,kind,local,latest,last);
  }
  const decision=chooseCommercialSnapshot(kind,local,remote.content,last,remote.revision);
  const candidate=safeData(kind,decision.content);
  if(snapshotJson(candidate)===snapshotJson(remote.content))
    return {content:remote.content,row:remote,conflict:decision.conflict};
  let updated=await updateRemote(session,kind,candidate,remote.revision);
  if(!updated){
    const latest=await singleRemote(session,kind);
    if(!latest)throw new Error("Não foi possível verificar a atualização concorrente de "+kind);
    // Do not silently discard either device's records after concurrent writes.
    const merged=safeData(kind,chooseCommercialSnapshot(kind,local,latest.content,last,
      latest.revision).content);
    updated=await updateRemote(session,kind,merged,latest.revision);
    if(!updated)throw new Error("Outro dispositivo está editando "+kind+". Recarregue e tente novamente.");
    return {content:merged,row:updated,conflict:true};
  }
  return {content:candidate,row:updated,conflict:decision.conflict};
}
async function bootstrap(session:ApiSession,active:()=>boolean):Promise<boolean>{
  const remote=await allRemote(session);
  const meta=readMeta();
  let conflicted=false;
  for(const kind of CLOUD_DOCUMENT_KEYS){
    if(!active())return conflicted;
    const local=localSnapshot(kind);
    const current=remote.get(kind)??null;
    const applied=await applySnapshot(session,kind,local,current,meta[kind]??null);
    if(!active())return conflicted;
    if(applied.conflict){
      keepRecovery(kind,local);
      conflicted=true;
    }
    // Only replace local data once server has acknowledged its exact snapshot.
    writeLocal(kind,applied.content);
    meta[kind]={
      revision:applied.row?.revision??0,
      fingerprint:snapshotFingerprint(applied.content),
    };
    saveMeta(meta);
  }
  return conflicted;
}
async function flushOne(session:ApiSession,kind:CloudDocumentKey,active:()=>boolean):Promise<boolean>{
  if(!active())return false;
  const data=localSnapshot(kind);
  const before=snapshotFingerprint(data);
  const meta=readMeta();
  const current=meta[kind]??{revision:0,fingerprint:snapshotFingerprint([])};
  if(before===current.fingerprint)return true;
  let row:Row|null;
  if(current.revision===0){
    row=await insertRemote(session,kind,data);
    if(!row)return false;
  }else{
    row=await updateRemote(session,kind,data,current.revision);
    if(!row)return false;
  }
  if(!active())return true;
  meta[kind]={revision:row.revision,fingerprint:before};
  saveMeta(meta);
  return snapshotFingerprint(localSnapshot(kind))===before;
}
export function CommercialCloudGate({children}:{children:ReactNode}){
  const [cycle,setCycle]=useState(0);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  const [syncing,setSyncing]=useState(false);
  useEffect(()=>{
    let live=true;
    let session:ApiSession|null=null;
    let booting=true;
    let timer:number|null=null;
    let busy=false;
    const pending=new Set<CloudDocumentKey>();
    const stillActive=()=>live;
    function queue(kind:CloudDocumentKey){
      if(!live)return;
      pending.add(kind);
      if(!booting&&!timer)timer=window.setTimeout(()=>{timer=null;void flush();},650);
    }
    async function flush(){
      if(!live||booting||busy||!session)return;
      busy=true;setSyncing(true);
      try{
        while(pending.size&&live){
          const key=pending.values().next().value as CloudDocumentKey;
          pending.delete(key);
          try{
            const done=await flushOne(session,key,stillActive);
            if(!done){
              // A concurrent update may exist. Never overwrite it blindly.
              setError("Outra sessão alterou os dados de "+key+
                ". Use Sincronizar novamente para reconciliar sem apagar a cópia local.");
              break;
            }
            setError("");
          }catch(reason){
            pending.add(key);
            setError(reason instanceof Error?reason.message:
              "Falha na sincronização. Os dados continuam neste navegador.");
            break;
          }
        }
      }finally{
        busy=false;if(live)setSyncing(false);
      }
    }
    const onChanged=(e:Event)=>{
      if(!live||booting)return;
      const event=e as CustomEvent<{key?:string}>;
      const kind=typeof event.detail?.key==="string"?
        cloudKeyForStorage(event.detail.key):null;
      if(kind)queue(kind);
    };
    const onOnline=()=>{if(!booting&&pending.size)void flush();};
    const onStorage=(event:StorageEvent)=>{
      if(!live||booting||!event.key)return;
      const account=currentWorkspaceUserId();
      if(!account)return;
      const rawPrefix="januarioleads:workspace:v2:"+account+":";
      if(event.key.startsWith(rawPrefix)){
        const kind=cloudKeyForStorage(event.key.slice(rawPrefix.length));
        if(kind)queue(kind);
      }
    };
    window.addEventListener(CLOUD_CHANGE_EVENT,onChanged);
    window.addEventListener("online",onOnline);
    window.addEventListener("storage",onStorage);
    setReady(false);setError("");
    void (async()=>{
      try{
        session=await authSession();
        const conflicts=await bootstrap(session,stillActive);
        if(live&&conflicts)setError(
          "Dados de dois dispositivos foram conciliados. Confira seus registros; uma cópia local de recuperação foi mantida.");
      }catch(reason){
        if(live)setError((reason instanceof Error?reason.message:
          "Supabase indisponível.")+" Os dados locais foram preservados.");
      }finally{
        booting=false;
        if(live){setReady(true);if(pending.size)void flush();}
      }
    })();
    return ()=>{
      live=false;
      if(timer!==null)window.clearTimeout(timer);
      window.removeEventListener(CLOUD_CHANGE_EVENT,onChanged);
      window.removeEventListener("online",onOnline);
      window.removeEventListener("storage",onStorage);
    };
  },[cycle]);
  if(!ready)return <section className="saas-page" role="status" aria-live="polite">
    <div className="cx-cloud-loading"><CloudUpload size={24}/>
      <strong>Carregando seus dados comerciais</strong>
      <p>Conferindo a sua conta no Supabase sem apagar os registros deste navegador.</p>
    </div>
  </section>;
  return <>
    {(error||syncing)&&<div className={"cx-cloud-banner"+(error?" error":"")} role="status">
      {error?<CloudOff size={16}/>:<CloudUpload size={16}/>}
      <span>{error||"Salvando alterações comerciais no Supabase..."}</span>
      {error&&<button type="button" onClick={()=>setCycle(c=>c+1)}>
        <RotateCcw size={14}/> Sincronizar novamente
      </button>}
    </div>}
    {children}
  </>;
}
