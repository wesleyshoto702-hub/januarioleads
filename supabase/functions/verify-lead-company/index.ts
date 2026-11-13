// Manual-only consultation. Nothing here writes to Overture or CRM leads.
const BASE=(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/,"");
const PUB=Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const UUID=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const CNPJ=/^[0-9A-Z]{12}[0-9]{2}$/;
function allowed(origin:string){
  try{
    const x=new URL(origin), h=x.hostname;
    if(x.origin!==origin || x.username || x.password || x.pathname!=="/" || x.search || x.hash)return false;
    return (x.protocol==="http:" && (h==="localhost"||h==="127.0.0.1")) ||
      (x.protocol==="https:" && (h==="januleads.vercel.app" || h==="lovable.app" || h.endsWith(".lovable.app") || h==="lovable.dev" || h.endsWith(".lovable.dev"))) ||
      (Deno.env.get("APP_ALLOWED_ORIGINS")||"").split(",").some(v=>v.trim()===origin);
  }catch{return false}
}
function headers(req:Request){
  const h=new Headers({"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
    "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"OPTIONS, POST"});
  const origin=req.headers.get("origin")||"";
  if(origin&&allowed(origin)){h.set("Access-Control-Allow-Origin",origin);h.set("Vary","Origin")}
  return h;
}
function json(req:Request,obj:unknown,status=200){return new Response(JSON.stringify(obj),{status,headers:headers(req)})}
function fail(req:Request,code:string,message:string,status=400){return json(req,{ok:false,code,message},status)}
function adminKey(){
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if(legacy)return {apikey:legacy,Authorization:"Bearer "+legacy};
  const modern=Deno.env.get("SUPABASE_SECRET_KEY")?.trim();
  if(modern)return {apikey:modern};
  try{
    const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}") as Record<string,string>;
    const key=Object.values(keys).find(v=>typeof v==="string" && v.startsWith("sb_secret_"));
    if(key)return {apikey:key};
  }catch{/* no admin key */}
  throw Error("Missing backend key");
}
async function admin(path:string,init:RequestInit={}){
  return fetch(BASE+"/rest/v1/"+path,{...init,
    headers:{...adminKey(),"Content-Type":"application/json",...(init.headers||{})},
    signal:AbortSignal.timeout(8000)});
}
async function owner(req:Request,leadId:string){
  const authorization=req.headers.get("authorization")||"";
  if(!authorization.startsWith("Bearer ")||authorization.length>17000||!BASE||!PUB)return null;
  const userRes=await fetch(BASE+"/auth/v1/user",{headers:{apikey:PUB,Authorization:authorization},signal:AbortSignal.timeout(6500)});
  if(!userRes.ok)return null;
  const user=await userRes.json() as {id?:string};
  if(!user.id||!UUID.test(user.id))return null;
  const q=new URLSearchParams({select:"id,company,city,state",id:"eq."+leadId,user_id:"eq."+user.id,limit:"1"});
  const leadRes=await fetch(BASE+"/rest/v1/leads?"+q,{headers:{apikey:PUB,Authorization:authorization},signal:AbortSignal.timeout(6500)});
  if(!leadRes.ok)return null;
  const rows=await leadRes.json() as {id:string;company:string;city:string|null;state:string|null}[];
  if(!rows.length)return null;
  return {userId:user.id,lead:rows[0]};
}
type Saved={cnpj:string;checked_at:string;[key:string]:unknown};
async function read(userId:string,leadId:string):Promise<Saved|null>{
  const q=new URLSearchParams({select:"*",user_id:"eq."+userId,lead_id:"eq."+leadId,limit:"1"});
  const r=await admin("lead_company_checks?"+q);
  if(!r.ok)throw Error("READ");
  const rows=await r.json() as Saved[];
  return rows[0]||null;
}
function str(v:unknown,max=200){return typeof v==="string"&&v.trim()?v.trim().slice(0,max):null}
function norm(v:unknown){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi," ").trim().toUpperCase()}
function similar(a:unknown,b:unknown){
  const x=norm(a),y=norm(b);
  return Boolean(x&&y&&(x===y||(x.length>=8&&y.length>=8&&(x.includes(y)||y.includes(x)))));
}
function phone(v:unknown){const digits=String(v||"").replace(/\D/g,"");return /^\d{10,11}$/.test(digits)?digits:null}
function email(v:unknown){const x=str(v,180);return x&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x)?x.toLowerCase():null}
function status(raw:Record<string,unknown>){
  return str(raw.descricao_situacao_cadastral,45)||
    ({"1":"NULA","2":"ATIVA","3":"SUSPENSA","4":"INAPTA","8":"BAIXADA"} as Record<string,string>)[String(raw.situacao_cadastral)]||null;
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  if(origin&&!allowed(origin))return fail(req,"ORIGIN_BLOCKED","Origem não autorizada.",403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=="POST")return fail(req,"METHOD","Método indisponível.",405);
  try{
    if(Number(req.headers.get("content-length")||0)>1024)return fail(req,"LARGE","Solicitação muito grande.",413);
    const body=await req.text();
    if(body.length>1024)return fail(req,"LARGE","Solicitação muito grande.",413);
    const input=JSON.parse(body) as {mode?:string;leadId?:string;cnpj?:string};
    if(!input||!UUID.test(input.leadId||"")||!["status","lookup","whatsapp_status"].includes(input.mode||""))
      return fail(req,"INPUT","Informe um lead e operação válida.");
    const user=await owner(req,input.leadId||"");
    if(!user)return fail(req,"NO_ACCESS","Lead não encontrado nesta conta ou sessão expirada.",403);
    const existing=await read(user.userId,input.leadId||"");
    if(input.mode==="status")return json(req,{ok:true,record:existing});
    if(input.mode==="whatsapp_status")return json(req,{ok:true,available:false,record:existing,
      message:"Não existe verificação real configurada. O formato de um número não comprova WhatsApp ativo."});
    const cnpj=(input.cnpj||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(!CNPJ.test(cnpj))return fail(req,"CNPJ_INVALID","Digite um CNPJ com 14 caracteres válidos.");
    const age=existing?Date.now()-new Date(existing.checked_at).getTime():Infinity;
    if(existing?.cnpj===cnpj&&age>=0&&age<12*3600000)return json(req,{ok:true,record:existing,cached:true});
    if(existing&&age>=0&&age<10*60000)return fail(req,"WAIT","Aguarde 10 minutos antes de consultar outro CNPJ.",429);
    const q=new URLSearchParams({select:"lead_id",user_id:"eq."+user.userId,
      checked_at:"gte."+new Date(Date.now()-3600000).toISOString(),limit:"12"});
    const budget=await admin("lead_company_checks?"+q);
    if(!budget.ok)return fail(req,"LIMIT_UNAVAILABLE","Não foi possível consultar o limite.",503);
    const prior=await budget.json() as unknown[];
    if(prior.length>=12)return fail(req,"RATE_LIMIT","Limite de 12 consultas individuais por hora.",429);
    let result:Response;
    try{result=await fetch("https://brasilapi.com.br/api/cnpj/v1/"+cnpj,
      {headers:{Accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(10000)})}
    catch{return fail(req,"CNPJ_UNAVAILABLE","A fonte pública está indisponível.",503)}
    if(result.status===404)return fail(req,"CNPJ_NOT_FOUND","CNPJ não encontrado.",404);
    if(result.status===429)return fail(req,"CNPJ_RATE_LIMIT","Limite temporário da BrasilAPI.",429);
    if(!result.ok)return fail(req,"CNPJ_UNAVAILABLE","A fonte pública está indisponível.",503);
    const rawText=await result.text();
    if(rawText.length>250000)return fail(req,"CNPJ_RESPONSE","Resposta excessiva.",502);
    const data=JSON.parse(rawText) as Record<string,unknown>;
    if(!data||String(data.cnpj||"").replace(/[^0-9A-Z]/g,"")!==cnpj)
      return fail(req,"CNPJ_MISMATCH","O CNPJ retornado não corresponde ao solicitado.",502);
    const company=str(data.razao_social,240);
    if(!company)return fail(req,"CNPJ_RESPONSE","Cadastro incompleto na fonte pública.",502);
    const trade=str(data.nome_fantasia,240);
    const city=str(data.municipio,140),state=str(data.uf,2);
    const needsReview=!(similar(user.lead.company,trade)||similar(user.lead.company,company))||
      (Boolean(user.lead.city&&city)&&norm(user.lead.city)!==norm(city))||
      (Boolean(user.lead.state&&state)&&norm(user.lead.state)!==norm(state));
    const row={user_id:user.userId,lead_id:input.leadId,cnpj,corporate_name:company,
      trade_name:trade,registration_status:status(data),
      status_date:str(data.data_situacao_cadastral,10),city,state,
      contact_phone:phone(data.ddd_telefone_1),contact_phone_alt:phone(data.ddd_telefone_2),
      contact_email:email(data.email),identity_review_required:needsReview,
      source:"brasilapi",source_url:"https://brasilapi.com.br/api/cnpj/v1/"+cnpj,
      checked_at:new Date().toISOString(),whatsapp_status:"not_verified",whatsapp_provider:null,whatsapp_checked_at:null};
    const save=await admin("lead_company_checks?on_conflict=user_id,lead_id",{
      method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)});
    if(!save.ok)return fail(req,"SAVE_ERROR","Não foi possível guardar a consulta na homologação.",503);
    const rows=await save.json() as Saved[];
    return json(req,{ok:true,record:rows[0]||row,cached:false});
  }catch{return fail(req,"UNAVAILABLE","Consulta temporariamente indisponível.",503)}
});
