import { useEffect, useState } from "react";
import { BadgeCheck, Check, ClipboardCopy, ExternalLink, FileSearch, Loader2, Phone, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { getAccessToken } from "../../lib/auth";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";
import type { BusinessSearchResult } from "../search-leads/types";

type CheckRow = {
  cnpj:string;
  corporate_name:string;
  trade_name:string|null;
  registration_status:string|null;
  status_date:string|null;
  city:string|null;
  state:string|null;
  contact_phone:string|null;
  contact_phone_alt:string|null;
  contact_email:string|null;
  identity_review_required:boolean;
  source_url:string;
  checked_at:string;
  whatsapp_status:"not_verified"|"confirmed_by_provider"|"not_confirmed_by_provider";
  whatsapp_checked_at:string|null;
  whatsapp_provider:string|null;
};
type Success = {ok:true;record:CheckRow|null;cached?:boolean;available?:boolean;message?:string};
type Failure = {ok:false;code:string;message:string};
type Reply = Success | Failure;
const IS_STAGING = SUPABASE_URL === "https://prlrxjothrslhswpkoza.supabase.co";

async function request(mode:"status"|"lookup"|"whatsapp_status",leadId:string,cnpj?:string):Promise<Success>{
  const token=await getAccessToken();
  if(!token)throw Error("Sua sessão expirou. Entre novamente.");
  const abort=new AbortController();
  const timeout=window.setTimeout(()=>abort.abort(),18000);
  let response:Response;
  try{
    response=await fetch(SUPABASE_URL+"/functions/v1/verify-lead-company",{
      method:"POST",signal:abort.signal,
      headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+token},
      body:JSON.stringify({mode,leadId,...(cnpj?{cnpj}:{})}),
    });
  }catch(cause){
    if(cause instanceof DOMException&&cause.name==="AbortError")throw Error("A fonte demorou para responder. Tente novamente.");
    throw Error("Não foi possível conectar ao serviço de verificação.");
  }finally{window.clearTimeout(timeout)}
  let payload:Reply;
  try{payload=await response.json() as Reply}catch{throw Error("O serviço respondeu de forma inesperada.")}
  if(!response.ok||!payload.ok)throw Error(payload.ok?"A consulta não pôde ser concluída.":payload.message);
  return payload;
}
function maskedCnpj(raw:string){
  const s=raw.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,14);
  return s.length===14?s.slice(0,2)+"."+s.slice(2,5)+"."+s.slice(5,8)+"/"+s.slice(8,12)+"-"+s.slice(12):s;
}
function formatDate(value:string|null){
  if(!value)return "Não informada";
  try{return new Date(value).toLocaleDateString("pt-BR")}catch{return value}
}
async function copy(text:string,onSuccess:()=>void){
  try{await navigator.clipboard.writeText(text);onSuccess();}
  catch{/* Clipboard permissions may be unavailable; no false confirmation. */}
}
function CopyValue({label,value}:{label:string;value:string}){
  const [copied,setCopied]=useState(false);
  return <div className="lc-check-contact"><div><small>{label}</small><strong>{value}</strong></div>
    <button className="lc-check-copy" type="button" aria-label={"Copiar "+label} onClick={()=>void copy(value,()=>{setCopied(true);window.setTimeout(()=>setCopied(false),2000)})}>
      {copied?<Check size={15}/>:<ClipboardCopy size={15}/>} {copied?"Copiado":"Copiar"}
    </button>
  </div>;
}

/** One business, one requested lookup. Never starts queries for a city, state,
 * another account's lead, or an Overture place. */
export function LeadCompanyCheckSection({
  leadId,business,onApplyPhone,
}:{
  leadId:string;
  business:BusinessSearchResult;
  onApplyPhone?:(phone:string)=>void;
}){
  const [cnpj,setCnpj]=useState("");
  const [record,setRecord]=useState<CheckRow|null>(null);
  const [loading,setLoading]=useState(false);
  const [checkingStatus,setCheckingStatus]=useState(false);
  const [checkingWhatsApp,setCheckingWhatsApp]=useState(false);
  const [error,setError]=useState("");
  const [info,setInfo]=useState("");
  const [appliedPhone,setAppliedPhone]=useState(false);

  useEffect(()=>{
    if(!IS_STAGING)return;
    let alive=true;
    setRecord(null);
    setCnpj("");
    setError("");
    setInfo("");
    setCheckingStatus(true);
    void request("status",leadId).then(result=>{
      if(!alive)return;
      setRecord(result.record);
      if(result.record)setCnpj(maskedCnpj(result.record.cnpj));
    }).catch(()=>{
      if(alive)setInfo("Ainda não foi possível consultar o histórico de verificações.");
    }).finally(()=>{if(alive)setCheckingStatus(false)});
    return ()=>{alive=false};
  },[leadId]);

  async function checkCnpj(){
    const digits=cnpj.toUpperCase().replace(/[^0-9A-Z]/g,"");
    if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(digits)){
      setError("Informe um CNPJ válido com 14 caracteres.");
      return;
    }
    setLoading(true);setError("");setInfo("");setAppliedPhone(false);
    try{
      const response=await request("lookup",leadId,digits);
      setRecord(response.record);
      setInfo(response.cached?"Resultado recente recuperado sem uma nova consulta.":"Consulta concluída. Confirme se os dados pertencem à empresa.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível consultar CNPJ.")}
    finally{setLoading(false)}
  }
  async function checkWhatsApp(){
    setCheckingWhatsApp(true);setError("");setInfo("");
    try{
      const response=await request("whatsapp_status",leadId);
      setInfo(response.message||"Verificação de WhatsApp ainda não configurada.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível verificar disponibilidade.")}
    finally{setCheckingWhatsApp(false)}
  }
  const suggestedPhone=record?.contact_phone||record?.contact_phone_alt||null;
  const currentPhone=business.phone||business.internationalPhone||"";
  const canApply=Boolean(record&&!record.identity_review_required&&!currentPhone&&suggestedPhone&&onApplyPhone&&!appliedPhone);
  const registration=record?.registration_status?.toUpperCase()||"NÃO INFORMADA";

  return <section className="detail-section lc-check" aria-label="Verificação e enriquecimento de empresa">
    <div className="lc-check-title">
      <div className="lc-check-icon"><ShieldCheck size={19}/></div>
      <div><span>IDENTIFICAÇÃO E CONTATOS</span><h3>Verificar empresa</h3>
        <p>Consultas individuais, fontes públicas e nenhum preenchimento automático.</p></div>
    </div>
    {!IS_STAGING?(
      <div className="lc-check-test-note"><ShieldAlert size={16}/>
        Esta funcionalidade está em homologação. Os dados da produção permanecem intactos.
      </div>
    ):(
      <>
        <div className="lc-check-subhead"><span>01</span><strong>CNPJ e situação cadastral</strong></div>
        <form className="lc-check-form" onSubmit={event=>{event.preventDefault();void checkCnpj()}}>
          <label htmlFor={"lc-cnpj-"+leadId}>CNPJ da empresa</label>
          <div className="lc-check-form-row">
            <input id={"lc-cnpj-"+leadId} name="cnpj" autoComplete="off" value={cnpj}
              onChange={event=>setCnpj(event.target.value.toUpperCase().slice(0,20))}
              placeholder="00.000.000/0001-00" disabled={loading} maxLength={20}/>
            <button type="submit" className="lc-check-primary" disabled={loading||checkingStatus}>
              {loading?<Loader2 size={15} className="lc-check-spin"/>:<FileSearch size={16}/>}
              {loading?"Consultando...":"Consultar CNPJ"}
            </button>
          </div>
        </form>
        {checkingStatus&&<p className="lc-check-muted">Carregando última consulta desta empresa...</p>}
        {record&&<div className="lc-check-result">
          <div className="lc-check-status">
            <BadgeCheck size={16}/>
            <strong>Cadastro consultado</strong>
            <span className={registration==="ATIVA"?"lc-check-active":"lc-check-neutral"}>{registration}</span>
          </div>
          <div className="lc-check-facts">
            <div><small>CNPJ</small><strong>{maskedCnpj(record.cnpj)}</strong></div>
            <div><small>Razão social</small><strong>{record.corporate_name}</strong></div>
            {record.trade_name&&<div><small>Nome fantasia</small><strong>{record.trade_name}</strong></div>}
            <div><small>Cidade / UF</small><strong>{[record.city,record.state].filter(Boolean).join(" / ")||"Não informado"}</strong></div>
            <div><small>Data da situação</small><strong>{formatDate(record.status_date)}</strong></div>
          </div>
          {record.identity_review_required&&<div className="lc-check-warning"><ShieldAlert size={16}/>
            O nome ou a localidade não correspondem claramente ao lead. Confirme que é a mesma empresa antes de utilizar os contatos.
          </div>}
          <a href={record.source_url} target="_blank" rel="noopener noreferrer" className="lc-check-source">
            Fonte: BrasilAPI / dados cadastrais públicos <ExternalLink size={13}/>
          </a>
          <small className="lc-check-muted">Consultado em {new Date(record.checked_at).toLocaleString("pt-BR")}. A situação pode não estar atualizada em tempo real.</small>
        </div>}
        <div className="lc-check-subhead"><span>02</span><strong>Enriquecimento de contatos</strong></div>
        <p className="lc-check-note">Exibimos somente contatos comerciais presentes na consulta do CNPJ. Não são telefones ou e-mails pessoais de sócios.</p>
        {!record?<p className="lc-check-muted">Informe um CNPJ para descobrir possíveis telefones e e-mail públicos.</p>:
        <div className="lc-check-contacts">
          {record.contact_phone&&<CopyValue label="Telefone cadastral" value={record.contact_phone}/>}
          {record.contact_phone_alt&&<CopyValue label="Telefone adicional" value={record.contact_phone_alt}/>}
          {record.contact_email&&<CopyValue label="E-mail cadastral" value={record.contact_email}/>}
          {!record.contact_phone&&!record.contact_phone_alt&&!record.contact_email&&
            <p className="lc-check-muted">A fonte não informou contatos adicionais para este CNPJ.</p>}
          {canApply&&suggestedPhone&&<button className="lc-check-secondary" type="button"
            onClick={()=>{onApplyPhone?.(suggestedPhone);setAppliedPhone(true);setInfo("Telefone registrado no lead. Não foi realizada verificação de WhatsApp.")}}>
            <Phone size={14}/> Preencher telefone ausente no lead
          </button>}
          {currentPhone&&suggestedPhone&&<small className="lc-check-muted">
            O telefone já existente no lead não será substituído. Compare os dados antes de atualizar.
          </small>}
        </div>}
        <div className="lc-check-subhead"><span>03</span><strong>Verificação real do WhatsApp</strong></div>
        <div className="lc-check-whatsapp">
          <div><strong>WhatsApp ativo: não verificado</strong>
            <p>Um número com formato brasileiro válido não confirma a existência de conta no WhatsApp.</p>
          </div>
          <button type="button" className="lc-check-secondary" disabled={checkingWhatsApp} onClick={()=>void checkWhatsApp()}>
            {checkingWhatsApp?<Loader2 className="lc-check-spin" size={15}/>:<RefreshCw size={15}/>}
            Consultar disponibilidade
          </button>
          <small>Integração com provedor autorizado reservada para uma etapa futura. Não envia mensagens nem consulta números em massa.</small>
        </div>
        {error&&<p className="lc-check-error" role="alert">{error}</p>}
        {info&&<p className="lc-check-info" role="status">{info}</p>}
      </>
    )}
  </section>;
}
