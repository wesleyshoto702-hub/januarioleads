// Manual-only company research. No cron, bulk leads, or Overture writes.
// Authentication + per-lead ownership are required before every operation.
import {
  cleanText,normalize,sameBusinessName,companyCandidates,publicWebsiteUrl,
  publicIPv4,publicIPv6,listedWebsiteContacts,CNPJ_PATTERN,UUID_PATTERN,
} from "./matching.ts";

const BASE=(Deno.env.get("SUPABASE_URL")??"").replace(/\/$/,"");
const PUBLIC_KEY=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
const COMPANY_SEARCH="https://www.datastone.com.br/consulta/api/v1/busca";
const SEARCH_ATTRIBUTION="https://www.datastone.com.br/consulta";
const CNPJ_API="https://brasilapi.com.br/api/cnpj/v1/";
const USER_BUDGET=12;
type Json=Record<string,unknown>;
type OwnedLead={id:string;company:string;city:string|null;state:string|null;phone:string|null;website:string|null};
type Auth={userId:string;lead:OwnedLead};
type SavedCheck={cnpj:string;checked_at:string;contact_email?:string|null;contact_phone?:string|null;contact_phone_alt?:string|null;[key:string]:unknown};
type NameCache={query_signature:string;candidate_data:unknown;checked_at:string;source_url:string};
type SiteCache={website_url:string;email:string|null;phone:string|null;checked_at:string};

function allowedOrigin(origin:string):boolean{
  try{
    const u=new URL(origin),h=u.hostname.toLowerCase();
    if(u.origin!==origin||u.username||u.password||u.pathname!=="/"||u.search||u.hash)return false;
    const local=u.protocol==="http:"&&(h==="localhost"||h==="127.0.0.1");
    const hosted=u.protocol==="https:"&&!u.port&&(
      h==="januleads.vercel.app"||
      h==="lovable.app"||h.endsWith(".lovable.app")||
      h==="lovable.dev"||h.endsWith(".lovable.dev"));
    const configured=(Deno.env.get("APP_ALLOWED_ORIGINS")||"").split(",").some(x=>x.trim()===origin);
    return local||hosted||configured;
  }catch{return false}
}
function responseHeaders(req:Request){
  const h=new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods":"POST, OPTIONS"});
  const origin=req.headers.get("origin")??"";
  if(origin&&allowedOrigin(origin)){h.set("Access-Control-Allow-Origin",origin);h.set("Vary","Origin")}
  return h;
}
function json(req:Request,data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:responseHeaders(req)});
}
function failure(req:Request,code:string,message:string,status=400){
  return json(req,{ok:false,code,message},status);
}
function adminKey():{apikey:string;Authorization?:string}{
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if(legacy)return {apikey:legacy,Authorization:"Bearer "+legacy};
  const modern=Deno.env.get("SUPABASE_SECRET_KEY")?.trim();
  if(modern)return {apikey:modern};
  try{
    const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}") as Record<string,string>;
    const key=Object.values(keys).find(x=>typeof x==="string"&&x.startsWith("sb_secret_"));
    if(key)return {apikey:key};
  }catch{/* missing backend secret */}
  throw Error("ADMIN_KEY_MISSING");
}
async function adminRequest(path:string,init:RequestInit={}){
  return fetch(BASE+"/rest/v1/"+path,{...init,
    headers:{...adminKey(),"Content-Type":"application/json",...(init.headers??{})},
    signal:AbortSignal.timeout(8500)});
}
async function readOne<T>(table:string,userId:string,leadId:string):Promise<T|null>{
  const q=new URLSearchParams({select:"*",user_id:"eq."+userId,lead_id:"eq."+leadId,limit:"1"});
  const res=await adminRequest(table+"?"+q);
  if(!res.ok)throw Error("STORAGE_UNAVAILABLE");
  const rows=await res.json() as T[];
  return rows[0]??null;
}
async function writeRow(table:string,row:Json):Promise<Json>{
  const res=await adminRequest(table+"?on_conflict=user_id,lead_id",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify(row),
  });
  if(!res.ok)throw Error("STORAGE_UNAVAILABLE");
  const records=await res.json() as Json[];
  if(!records[0])throw Error("STORAGE_UNAVAILABLE");
  return records[0];
}
async function authenticate(req:Request,leadId:string):Promise<Auth|null>{
  const auth=req.headers.get("authorization")??"";
  if(!auth.startsWith("Bearer ")||auth.length>17000||!BASE||!PUBLIC_KEY)return null;
  const u=await fetch(BASE+"/auth/v1/user",{
    headers:{apikey:PUBLIC_KEY,Authorization:auth},signal:AbortSignal.timeout(6500),
  });
  if(!u.ok)return null;
  const user=await u.json() as {id?:string};
  if(!user.id||!UUID_PATTERN.test(user.id))return null;
  const q=new URLSearchParams({select:"id,company,city,state,phone,website",
    id:"eq."+leadId,user_id:"eq."+user.id,limit:"1"});
  const l=await fetch(BASE+"/rest/v1/leads?"+q,{
    headers:{apikey:PUBLIC_KEY,Authorization:auth},signal:AbortSignal.timeout(6500),
  });
  if(!l.ok)return null;
  const rows=await l.json() as OwnedLead[];
  return rows[0]?{userId:user.id,lead:rows[0]}:null;
}
function fresh(checkedAt:unknown,hours:number){
  const date=typeof checkedAt==="string"?Date.parse(checkedAt):NaN;
  const age=Date.now()-date;
  return Number.isFinite(age)&&age>=0&&age<hours*3600000;
}
async function claim(userId:string):Promise<boolean>{
  // RPC is atomic in Postgres. Every provider request, even a failed one,
  // claims its budget BEFORE a network call is started.
  const r=await adminRequest("rpc/claim_lead_company_request",{
    method:"POST",body:JSON.stringify({p_user_id:userId}),
  });
  if(!r.ok)throw Error("QUOTA_UNAVAILABLE");
  const result=await r.json() as unknown;
  return result===true;
}
function phone(input:unknown):string|null{
  const digits=String(input??"").replace(/\D/g,"");
  const d=digits.startsWith("55")&&digits.length>=12?digits.slice(2):digits;
  return /^\d{10,11}$/.test(d)?d:null;
}
function email(input:unknown):string|null{
  const value=cleanText(input,180);
  return value&&/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)?value.toLowerCase():null;
}
function registeredStatus(raw:Json){
  return cleanText(raw.descricao_situacao_cadastral,45)||
    ({"1":"NULA","2":"ATIVA","3":"SUSPENSA","4":"INAPTA","8":"BAIXADA"} as Record<string,string>)[String(raw.situacao_cadastral)]||null;
}
async function publicJson(url:string,timeoutMs=9000):Promise<Json>{
  const res=await fetch(url,{headers:{Accept:"application/json"},redirect:"error",
    signal:AbortSignal.timeout(timeoutMs)});
  if(res.status===400)throw Error("BAD_CNPJ");
  if(res.status===404)throw Error("NOT_FOUND");
  if(res.status===429)throw Error("PROVIDER_RATE_LIMIT");
  if(!res.ok)throw Error("PROVIDER_UNAVAILABLE");
  const max=120000;
  if(Number(res.headers.get("content-length")??0)>max)throw Error("PROVIDER_UNAVAILABLE");
  const raw=await res.text();
  if(raw.length>max)throw Error("PROVIDER_UNAVAILABLE");
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("PROVIDER_UNAVAILABLE");
  return value as Json;
}
async function findName(req:Request,auth:Auth,input:Json,leadId:string){
  const city=cleanText(auth.lead.city,100),state=cleanText(auth.lead.state,2);
  if(!city||!state||!/^[A-Z]{2}$/.test(state.toUpperCase()))
    return failure(req,"LOCATION_REQUIRED","Defina cidade e UF do lead antes de procurar CNPJs.");
  const query=cleanText(input.searchTerm,90)??cleanText(auth.lead.company,90);
  if(!query||normalize(query).length<4)
    return failure(req,"NAME_REQUIRED","Use pelo menos quatro caracteres do nome da empresa.");
  const signature=[normalize(query),normalize(city),normalize(state)].join("|");
  const cached=await readOne<NameCache>("lead_cnpj_name_searches",auth.userId,leadId);
  if(cached?.query_signature===signature&&fresh(cached.checked_at,24))
    return json(req,{ok:true,candidates:cached.candidate_data,cached:true,
      source:cached.source_url,city,state,query});
  if(!await claim(auth.userId))
    return failure(req,"RATE_LIMIT","Limite de 12 consultas externas por hora nesta conta. Tente mais tarde.",429);
  const url=new URL(COMPANY_SEARCH);
  url.searchParams.set("q",query);
  let payload:Json;
  try{payload=await publicJson(url.href,8000)}
  catch(cause){return providerError(req,cause)}
  const list=companyCandidates(payload,query,city,state);
  const saved=await writeRow("lead_cnpj_name_searches",{
    user_id:auth.userId,lead_id:leadId,query_signature:signature,
    candidate_data:list,source_url:SEARCH_ATTRIBUTION,checked_at:new Date().toISOString(),
  });
  return json(req,{ok:true,candidates:saved.candidate_data,cached:false,
    source:SEARCH_ATTRIBUTION,city,state,query});
}
function providerError(req:Request,cause:unknown){
  const why=cause instanceof Error?cause.message:"";
  if(why==="NOT_FOUND")return failure(req,"NOT_FOUND","Nenhum registro encontrado na fonte pública.",404);
  if(why==="BAD_CNPJ")return failure(req,"BAD_CNPJ","CNPJ rejeitado pela fonte pública.",400);
  if(why==="PROVIDER_RATE_LIMIT")return failure(req,"PROVIDER_RATE_LIMIT","Fonte pública atingiu o limite temporário. Tente depois.",429);
  return failure(req,"PROVIDER_UNAVAILABLE","Fonte pública temporariamente indisponível.",503);
}
async function lookupCnpj(req:Request,auth:Auth,input:Json,leadId:string){
  const raw=typeof input.cnpj==="string"?input.cnpj:"";
  const cnpj=raw.toUpperCase().replace(/[^0-9A-Z]/g,"");
  if(!CNPJ_PATTERN.test(cnpj))return failure(req,"BAD_CNPJ","Informe um CNPJ de 14 caracteres.",400);
  const existing=await readOne<SavedCheck>("lead_company_checks",auth.userId,leadId);
  if(existing?.cnpj===cnpj&&fresh(existing.checked_at,12))
    return json(req,{ok:true,record:existing,cached:true});
  if(existing&&fresh(existing.checked_at,10/60))
    return failure(req,"COOLDOWN","Aguarde dez minutos antes de consultar outro CNPJ neste lead.",429);
  if(!await claim(auth.userId))
    return failure(req,"RATE_LIMIT","Limite de 12 consultas externas por hora nesta conta. Tente mais tarde.",429);
  let data:Json;
  try{data=await publicJson(CNPJ_API+cnpj,10000)}
  catch(cause){return providerError(req,cause)}
  if(String(data.cnpj??"").replace(/[^0-9A-Z]/g,"")!==cnpj)
    return failure(req,"MISMATCH","A fonte respondeu com outro CNPJ. Nenhum dado foi salvo.",502);
  const corp=cleanText(data.razao_social,240);
  if(!corp)return failure(req,"INCOMPLETE","Não foi possível confirmar a razão social.",502);
  const trade=cleanText(data.nome_fantasia,240),city=cleanText(data.municipio,140),state=cleanText(data.uf,2);
  const nameConfirmed=sameBusinessName(auth.lead.company,corp,trade);
  const cityConfirmed=!auth.lead.city||!city||normalize(auth.lead.city)===normalize(city);
  const stateConfirmed=!auth.lead.state||!state||normalize(auth.lead.state)===normalize(state);
  const reviewRequired=!(nameConfirmed&&cityConfirmed&&stateConfirmed);
  const row={
    user_id:auth.userId,lead_id:leadId,cnpj,corporate_name:corp,
    trade_name:trade,registration_status:registeredStatus(data),
    status_date:cleanText(data.data_situacao_cadastral,10),city,state,
    contact_phone:phone(data.ddd_telefone_1),contact_phone_alt:phone(data.ddd_telefone_2),
    contact_email:email(data.email),identity_review_required:reviewRequired,
    source:"brasilapi",source_url:CNPJ_API+cnpj,checked_at:new Date().toISOString(),
    whatsapp_status:"not_verified",whatsapp_provider:null,whatsapp_checked_at:null,
  };
  const saved=await writeRow("lead_company_checks",row);
  return json(req,{ok:true,record:saved,cached:false});
}
async function checkPublicDns(hostname:string):Promise<boolean>{
  // Reject private/reserved IP destinations and networks before GET; no
  // redirects. If DNS validation is unavailable, fail closed.
  try{
    const results=await Promise.allSettled([
      Deno.resolveDns(hostname,"A"),Deno.resolveDns(hostname,"AAAA"),
    ]);
    const addresses=results.flatMap(r=>r.status==="fulfilled"?r.value:[]);
    return addresses.length>0 && addresses.every(ip=>
      ip.includes(":")?publicIPv6(ip):publicIPv4(ip));
  }catch{return false}
}
async function officialContacts(req:Request,auth:Auth,leadId:string,existing:SavedCheck|null){
  const url=publicWebsiteUrl(auth.lead.website);
  if(!url)return failure(req,"WEBSITE_REQUIRED","Salve o site oficial HTTPS no lead antes de consultar.",400);
  const hasPhone=Boolean(auth.lead.phone||existing?.contact_phone||existing?.contact_phone_alt);
  const hasEmail=Boolean(existing?.contact_email);
  if(hasPhone&&hasEmail)
    return json(req,{ok:true,skipped:true,message:"Telefone e e-mail já estão disponíveis. Nenhuma consulta foi feita.",siteRecord:null});
  const cached=await readOne<SiteCache>("lead_official_site_contacts",auth.userId,leadId);
  if(cached?.website_url===url.href&&fresh(cached.checked_at,168))
    return json(req,{ok:true,siteRecord:cached,cached:true});
  if(!await claim(auth.userId))
    return failure(req,"RATE_LIMIT","Limite de 12 consultas externas por hora nesta conta.",429);
  if(!await checkPublicDns(url.hostname))
    return failure(req,"UNSAFE_SITE","O site não passou pela verificação de endereço público.",400);
  try{
    const res=await fetch(url.href,{
      method:"GET",redirect:"error",
      headers:{Accept:"text/html,application/xhtml+xml"},
      signal:AbortSignal.timeout(8000),
    });
    if(!res.ok||!res.headers.get("content-type")?.includes("text/html"))
      return failure(req,"SITE_UNAVAILABLE","A página não forneceu HTML público.",503);
    const reader=res.body?.getReader();
    if(!reader)return failure(req,"SITE_UNAVAILABLE","O site não forneceu conteúdo.",503);
    const chunks:Uint8Array[]=[];let size=0;
    try{
      while(true){
        const next=await reader.read();
        if(next.done)break;
        if(next.value){size+=next.value.byteLength;if(size>100000)throw Error("TOO_LONG");chunks.push(next.value)}
      }
    }finally{reader.releaseLock()}
    const text=new TextDecoder().decode(Uint8Array.from(chunks.flatMap(c=>Array.from(c))));
    const hints=listedWebsiteContacts(text);
    const row={user_id:auth.userId,lead_id:leadId,website_url:url.href,
      email:hasEmail?null:hints.email,phone:hasPhone?null:hints.phone,
      checked_at:new Date().toISOString()};
    const saved=await writeRow("lead_official_site_contacts",row);
    return json(req,{ok:true,siteRecord:saved,cached:false});
  }catch{
    return failure(req,"SITE_UNAVAILABLE","O site oficial não pôde ser consultado. Confira manualmente.",503);
  }
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")??"";
  if(origin&&!allowedOrigin(origin))return failure(req,"ORIGIN","Origem não autorizada.",403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:responseHeaders(req)});
  if(req.method!=="POST")return failure(req,"METHOD","Método não permitido.",405);
  try{
    if(Number(req.headers.get("content-length")??0)>1500)
      return failure(req,"INPUT","Solicitação muito grande.",413);
    const raw=await req.text();
    if(raw.length>1500)return failure(req,"INPUT","Solicitação muito grande.",413);
    const input:unknown=JSON.parse(raw);
    if(!input||typeof input!=="object"||Array.isArray(input))
      return failure(req,"INPUT","Solicitação inválida.",400);
    const data=input as Json;
    const leadId=typeof data.leadId==="string"?data.leadId:"";
    const mode=typeof data.mode==="string"?data.mode:"";
    if(!UUID_PATTERN.test(leadId)||!["status","lookup","name_search","site_contacts","whatsapp_status"].includes(mode))
      return failure(req,"INPUT","Lead ou operação inválida.",400);
    const auth=await authenticate(req,leadId);
    if(!auth)return failure(req,"NO_ACCESS","Sessão inválida ou lead fora da sua conta.",403);
    if(mode==="status"||mode==="whatsapp_status"){
      const record=await readOne<SavedCheck>("lead_company_checks",auth.userId,leadId);
      const siteRecord=await readOne<SiteCache>("lead_official_site_contacts",auth.userId,leadId);
      return json(req,{ok:true,record,siteRecord,
        ...(mode==="whatsapp_status"?{available:false,
          message:"WhatsApp real não está configurado. Telefone válido não prova conta ativa."}:{})});
    }
    if(mode==="name_search")return await findName(req,auth,data,leadId);
    if(mode==="lookup")return await lookupCnpj(req,auth,data,leadId);
    const record=await readOne<SavedCheck>("lead_company_checks",auth.userId,leadId);
    if(mode==="site_contacts")return await officialContacts(req,auth,leadId,record);
    return failure(req,"INPUT","Operação não disponível.",400);
  }catch{
    return failure(req,"UNAVAILABLE","Não foi possível concluir esta consulta. Tente novamente.",503);
  }
});
