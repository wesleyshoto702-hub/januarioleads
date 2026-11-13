import { useEffect, useState } from "react";
import {
  BadgeCheck, Check, ClipboardCopy, ExternalLink, FileSearch, Globe2,
  Loader2, MapPin, Phone, RefreshCw, Search, ShieldAlert, ShieldCheck,
} from "lucide-react";
import { getAccessToken } from "../../lib/auth";
import { safeExternalHref } from "../../lib/safe-external-url";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";
import type { BusinessSearchResult } from "../search-leads/types";

type CheckRow={
  cnpj:string;corporate_name:string;trade_name:string|null;registration_status:string|null;
  status_date:string|null;city:string|null;state:string|null;
  contact_phone:string|null;contact_phone_alt:string|null;contact_email:string|null;
  identity_review_required:boolean;source_url:string;checked_at:string;
  whatsapp_status:"not_verified"|"confirmed_by_provider"|"not_confirmed_by_provider";
  whatsapp_checked_at:string|null;whatsapp_provider:string|null;
};
type Candidate={
  cnpj:string;corporate_name:string;trade_name:string|null;city:string;state:string;
  registration_status:string|null;source_url:string;confidence:"likely"|"review";score:number;
};
type SiteHint={website_url:string;email:string|null;phone:string|null;checked_at:string};
type Success={ok:true;record?:CheckRow|null;siteRecord?:SiteHint|null;
  candidates?:Candidate[];cached?:boolean;skipped?:boolean;message?:string;source?:string};
type Failure={ok:false;code:string;message:string};
const STAGING_URL="https://prlrxjothrslhswpkoza.supabase.co";
const IS_STAGING=SUPABASE_URL===STAGING_URL;
const DATASTONE_URL="https://www.datastone.com.br/consulta";

type Operation="status"|"lookup"|"name_search"|"site_contacts"|"whatsapp_status";
async function call(mode:Operation,leadId:string,payload:Record<string,string>={}):Promise<Success>{
  const token=await getAccessToken();
  if(!token)throw Error("Sua sessão expirou. Entre novamente.");
  const abort=new AbortController();
  const timer=window.setTimeout(()=>abort.abort(),18000);
  let response:Response;
  try{
    response=await fetch(SUPABASE_URL+"/functions/v1/verify-lead-company",{
      method:"POST",signal:abort.signal,
      headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY,
        Authorization:"Bearer "+token},
      body:JSON.stringify({mode,leadId,...payload}),
    });
  }catch(cause){
    if(cause instanceof DOMException&&cause.name==="AbortError")
      throw Error("A consulta demorou para responder. Tente novamente.");
    throw Error("Não foi possível conectar ao serviço de verificação.");
  }finally{window.clearTimeout(timer)}
  let result:Success|Failure;
  try{result=await response.json() as Success|Failure}
  catch{throw Error("O serviço respondeu de forma inesperada.")}
  if(!result.ok||!response.ok)throw Error(!result.ok?result.message:"A consulta não pôde ser concluída.");
  return result;
}
function displayCnpj(raw:string){
  const s=raw.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,14);
  return s.length===14?s.slice(0,2)+"."+s.slice(2,5)+"."+s.slice(5,8)+"/"+s.slice(8,12)+"-"+s.slice(12):s;
}
function formatDate(value:string|null){
  if(!value)return "Não informada";
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))
    return value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4);
  return value;
}
function CopyValue({label,value}:{label:string;value:string}){
  const [copied,setCopied]=useState(false);
  async function copy(){
    try{
      await navigator.clipboard.writeText(value);
      setCopied(true);window.setTimeout(()=>setCopied(false),1800);
    }catch{/* Clipboard not permitted; never pretend success. */}
  }
  return <div className="lc-check-contact">
    <div><small>{label}</small><strong>{value}</strong></div>
    <button className="lc-check-copy" type="button" onClick={()=>void copy()} aria-label={"Copiar "+label}>
      {copied?<Check size={14}/>:<ClipboardCopy size={14}/>} {copied?"Copiado":"Copiar"}
    </button>
  </div>;
}
export function LeadCompanyCheckSection({
  leadId,business,onApplyPhone,
}:{
  leadId:string;business:BusinessSearchResult;onApplyPhone?:((phone:string)=>void)|undefined;
}){
  const [cnpj,setCnpj]=useState("");
  const [searchTerm,setSearchTerm]=useState(business.name);
  const [candidates,setCandidates]=useState<Candidate[]|null>(null);
  const [record,setRecord]=useState<CheckRow|null>(null);
  const [siteRecord,setSiteRecord]=useState<SiteHint|null>(null);
  const [busy,setBusy]=useState<Operation|null>(null);
  const [initializing,setInitializing]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [appliedPhone,setAppliedPhone]=useState(false);
  const [nameCache,setNameCache]=useState(false);

  useEffect(()=>{
    if(!IS_STAGING)return;
    let mounted=true;
    setRecord(null);setSiteRecord(null);setCandidates(null);
    setCnpj("");setSearchTerm(business.name);
    setError("");setMessage("");setAppliedPhone(false);setInitializing(true);
    void call("status",leadId)
      .then(result=>{
        if(!mounted)return;
        setRecord(result.record??null);
        setSiteRecord(result.siteRecord??null);
        if(result.record)setCnpj(displayCnpj(result.record.cnpj));
      })
      .catch(()=>{if(mounted)setMessage("O histórico de consultas ainda não está disponível.")})
      .finally(()=>{if(mounted)setInitializing(false)});
    return()=>{mounted=false};
  },[leadId,business.name]);

  async function discoverName(){
    const query=searchTerm.trim();
    if(query.length<4){setError("Digite pelo menos quatro caracteres do nome da empresa.");return}
    setBusy("name_search");setError("");setMessage("");setCandidates(null);
    try{
      const result=await call("name_search",leadId,{searchTerm:query});
      setCandidates(result.candidates??[]);
      setNameCache(Boolean(result.cached));
      if(!(result.candidates?.length))setMessage(
        "Nenhum CNPJ compatível foi encontrado nesta cidade na primeira página da fonte. Informe o CNPJ manualmente ou refine o nome.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha na busca por nome.")}
    finally{setBusy(null)}
  }
  async function lookup(){
    const value=cnpj.toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(value)){
      setError("Informe um CNPJ com 14 caracteres.");
      return;
    }
    setBusy("lookup");setError("");setMessage("");setAppliedPhone(false);
    try{
      const result=await call("lookup",leadId,{cnpj:value});
      setRecord(result.record??null);
      setMessage(result.cached?"Resultado recente recuperado do cache.":
        "Dados consultados. Confira se o CNPJ pertence à empresa antes de utilizar os contatos.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao consultar CNPJ.")}
    finally{setBusy(null)}
  }
  async function discoverSite(){
    setBusy("site_contacts");setError("");setMessage("");
    try{
      const result=await call("site_contacts",leadId);
      setSiteRecord(result.siteRecord??null);
      setMessage(result.message??(result.cached?"Resultado do site recuperado do cache.":
        "Página consultada. Confira os contatos encontrados antes de utilizá-los."));
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao consultar site.")}
    finally{setBusy(null)}
  }
  async function whatsapp(){
    setBusy("whatsapp_status");setError("");setMessage("");
    try{
      const result=await call("whatsapp_status",leadId);
      setRecord(result.record??null);
      setSiteRecord(result.siteRecord??null);
      setMessage(result.message??"Verificação de WhatsApp ainda não configurada.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao consultar a integração.")}
    finally{setBusy(null)}
  }
  const phoneOnLead=Boolean(business.phone||business.internationalPhone);
  const cnpjPhone=record?.contact_phone||record?.contact_phone_alt||null;
  const canApply=Boolean(cnpjPhone&&!phoneOnLead&&!record?.identity_review_required&&onApplyPhone&&!appliedPhone);
  const hasCnpjContacts=Boolean(record?.contact_phone||record?.contact_phone_alt||record?.contact_email);
  const canCheckSite=Boolean(business.website)&&(!phoneOnLead&&!cnpjPhone||!record?.contact_email);
  const registration=record?.registration_status?.toUpperCase()||"NÃO INFORMADA";
  const whatsappWithEvidence=Boolean(record?.whatsapp_provider&&record.whatsapp_checked_at);
  const whatsappLabel=whatsappWithEvidence&&record?.whatsapp_status==="confirmed_by_provider"
    ?"Confirmado por provedor":whatsappWithEvidence&&record?.whatsapp_status==="not_confirmed_by_provider"
      ?"Não confirmado pelo provedor":"Não verificado";
  const officialSiteLink=business.website?safeExternalHref(business.website):null;

  return <section className="detail-section lc-check" aria-label="Verificação de empresa e contatos">
    <div className="lc-check-title">
      <div className="lc-check-icon"><ShieldCheck size={19}/></div>
      <div><span>IDENTIDADE E CONTATOS</span><h3>Enriquecer empresa</h3>
        <p>Verificações individuais, fontes identificadas e controle sobre os dados.</p></div>
    </div>
    {!IS_STAGING?(
      <div className="lc-check-test-note"><ShieldAlert size={16}/>
        Este recurso está em homologação. A produção permanece inalterada.
      </div>
    ):(
      <>
        <div className="lc-check-subhead"><span>01</span><strong>Encontrar o CNPJ pelo nome</strong></div>
        <p className="lc-check-note">Buscaremos possíveis cadastros pelo nome. A cidade e a UF são usadas para filtrar os resultados. Nenhum CNPJ será atribuído sem sua escolha.</p>
        <div className="lc-check-context"><MapPin size={14}/>{business.city||"Cidade não informada"} / {business.state||"UF não informada"}</div>
        <form className="lc-check-form" onSubmit={event=>{event.preventDefault();void discoverName()}}>
          <label htmlFor={"lc-search-"+leadId}>Nome ou razão social</label>
          <div className="lc-check-form-row">
            <input id={"lc-search-"+leadId} value={searchTerm} maxLength={90}
              onChange={event=>setSearchTerm(event.target.value)} autoComplete="off"
              disabled={Boolean(busy)} placeholder="Nome da empresa"/>
            <button type="submit" className="lc-check-primary" disabled={Boolean(busy)||initializing}>
              {busy==="name_search"?<Loader2 size={15} className="lc-check-spin"/>:<Search size={16}/>}
              Encontrar CNPJ
            </button>
          </div>
        </form>
        {candidates!==null&&<div className="lc-candidate-list">
          <div className="lc-candidate-summary">
            <strong>{candidates.length} correspondência(s) possível(is)</strong>
            {nameCache&&<small>Dados recentes em cache</small>}
          </div>
          {candidates.map(item=><div className="lc-candidate" key={item.cnpj}>
            <div className="lc-candidate-main">
              <strong>{item.trade_name||item.corporate_name}</strong>
              {item.trade_name&&<small>{item.corporate_name}</small>}
              <span>{displayCnpj(item.cnpj)} · {item.city}/{item.state}</span>
              <small className={item.confidence==="likely"?"lc-match-likely":"lc-match-review"}>
                {item.confidence==="likely"?"Semelhança alta — confirme a identidade":"Correspondência incerta — revise com atenção"}
              </small>
              <a href={item.source_url} target="_blank" rel="noopener noreferrer">Fonte: Consulta Data Stone <ExternalLink size={12}/></a>
            </div>
            <button type="button" className="lc-check-secondary" onClick={()=>{
              setCnpj(displayCnpj(item.cnpj));setMessage("CNPJ selecionado. Confira o cadastro antes de utilizá-lo.");
            }}>Selecionar CNPJ</button>
          </div>)}
          <a className="lc-check-source" href={DATASTONE_URL} target="_blank" rel="noopener noreferrer">
            Busca pública: Consulta Data Stone <ExternalLink size={12}/>
          </a>
        </div>}
        <div className="lc-check-subhead"><span>02</span><strong>Consultar situação cadastral</strong></div>
        <form className="lc-check-form" onSubmit={event=>{event.preventDefault();void lookup()}}>
          <label htmlFor={"lc-cnpj-"+leadId}>CNPJ selecionado ou informado manualmente</label>
          <div className="lc-check-form-row">
            <input id={"lc-cnpj-"+leadId} name="cnpj" value={cnpj} maxLength={20}
              onChange={event=>setCnpj(event.target.value.toUpperCase().slice(0,20))}
              autoComplete="off" placeholder="00.000.000/0001-00" disabled={Boolean(busy)}/>
            <button type="submit" className="lc-check-primary" disabled={Boolean(busy)||initializing}>
              {busy==="lookup"?<Loader2 className="lc-check-spin" size={15}/>:<FileSearch size={16}/>}
              Consultar cadastro
            </button>
          </div>
        </form>
        {initializing&&<p className="lc-check-muted">Carregando histórico deste lead...</p>}
        {record&&<div className="lc-check-result">
          <div className="lc-check-status">
            <BadgeCheck size={16}/><strong>Cadastro consultado</strong>
            <span className={registration==="ATIVA"?"lc-check-active":"lc-check-neutral"}>{registration}</span>
          </div>
          <div className="lc-check-facts">
            <div><small>CNPJ</small><strong>{displayCnpj(record.cnpj)}</strong></div>
            <div><small>Razão social</small><strong>{record.corporate_name}</strong></div>
            {record.trade_name&&<div><small>Nome fantasia</small><strong>{record.trade_name}</strong></div>}
            <div><small>Cidade / UF</small><strong>{[record.city,record.state].filter(Boolean).join(" / ")||"Não informado"}</strong></div>
            <div><small>Data da situação</small><strong>{formatDate(record.status_date)}</strong></div>
          </div>
          {record.identity_review_required&&<div className="lc-check-warning"><ShieldAlert size={16}/>
            O nome ou a localização não corresponderam claramente ao lead. Revise a identidade antes de copiar qualquer contato.
          </div>}
          <a href={record.source_url} target="_blank" rel="noopener noreferrer" className="lc-check-source">
            Fonte: BrasilAPI (cadastro público) <ExternalLink size={13}/>
          </a>
          <small className="lc-check-muted">Consultado em {new Date(record.checked_at).toLocaleString("pt-BR")}. Dados podem estar defasados.</small>
        </div>}
        <div className="lc-check-subhead"><span>03</span><strong>Contatos públicos ausentes</strong></div>
        <p className="lc-check-note">O sistema consulta apenas quando solicitado e reutiliza resultados recentes. Contatos cadastrais não são necessariamente atuais nem pertencem exclusivamente à empresa; respeite a privacidade e a LGPD.</p>
        {!record?<p className="lc-check-muted">Consulte o CNPJ para ver os telefones e o e-mail cadastrados.</p>:
          <div className="lc-check-contacts">
            {record.identity_review_required?<p className="lc-check-warning"><ShieldAlert size={15}/>
              Contatos ocultos até confirmar a identidade do CNPJ. Pesquise novamente com dados mais específicos.
            </p>:<>
              {record.contact_phone&&<CopyValue label="Telefone cadastral (BrasilAPI)" value={record.contact_phone}/>}
              {record.contact_phone_alt&&<CopyValue label="Telefone adicional (BrasilAPI)" value={record.contact_phone_alt}/>}
              {record.contact_email&&<CopyValue label="E-mail cadastral (BrasilAPI)" value={record.contact_email}/>}
              {!hasCnpjContacts&&<p className="lc-check-muted">Nenhum contato adicional na consulta cadastral.</p>}
              {canApply&&cnpjPhone&&<button className="lc-check-secondary" type="button" onClick={()=>{
                onApplyPhone?.(cnpjPhone);setAppliedPhone(true);
                setMessage("Telefone incluído no campo vazio do lead. WhatsApp não verificado.");
              }}><Phone size={14}/> Preencher telefone vazio no CRM</button>}
              {phoneOnLead&&<p className="lc-check-muted">O telefone existente no lead não será substituído.</p>}
            </>}
          </div>}
        <div className="lc-check-site">
          <div className="lc-check-site-head"><Globe2 size={17}/><strong>Buscar contatos no site informado no lead</strong></div>
          <p>Uma única página HTTPS, sem rastreamento em massa. Procuramos links públicos de e-mail e telefone apenas quando faltam contatos.</p>
          {officialSiteLink?<a href={officialSiteLink} target="_blank" rel="noopener noreferrer" className="lc-check-source">
            Site cadastrado <ExternalLink size={12}/>
          </a>:<small>Adicione o site oficial aos detalhes do lead para habilitar a consulta.</small>}
          <button className="lc-check-secondary" type="button"
            disabled={Boolean(busy)||!officialSiteLink||!canCheckSite||initializing}
            onClick={()=>void discoverSite()}>
            {busy==="site_contacts"?<Loader2 size={14} className="lc-check-spin"/>:<Globe2 size={14}/>}
            {canCheckSite?"Procurar contatos ausentes":"Contatos disponíveis — não consultar novamente"}
          </button>
          {siteRecord&&<div className="lc-check-site-results">
            {siteRecord.email&&<CopyValue label="E-mail encontrado em link do site (revisar)" value={siteRecord.email}/>}
            {siteRecord.phone&&<CopyValue label="Telefone encontrado em link do site (revisar)" value={siteRecord.phone}/>}
            {!siteRecord.email&&!siteRecord.phone&&<small>Nenhum contato nos links públicos desta página.</small>}
            <small>Fonte: {siteRecord.website_url} · Consultado em {new Date(siteRecord.checked_at).toLocaleString("pt-BR")}</small>
          </div>}
        </div>
        <div className="lc-check-subhead"><span>04</span><strong>WhatsApp</strong></div>
        <div className="lc-check-whatsapp">
          <div><strong>Conta WhatsApp: {whatsappLabel}</strong>
            <p>Ter telefone não garante conta WhatsApp ativa. Não há verificação de conta configurada.</p>
            {whatsappWithEvidence&&record?.whatsapp_checked_at&&<small>Fonte: {record.whatsapp_provider} · {new Date(record.whatsapp_checked_at).toLocaleString("pt-BR")}</small>}
          </div>
          <button type="button" className="lc-check-secondary" onClick={()=>void whatsapp()} disabled={Boolean(busy)}>
            {busy==="whatsapp_status"?<Loader2 className="lc-check-spin" size={14}/>:<RefreshCw size={14}/>}
            Consultar estado da integração
          </button>
          <small>Sem envio de mensagens e sem análise em massa. A verificação real depende de provedor autorizado.</small>
        </div>
        {error&&<p className="lc-check-error" role="alert">{error}</p>}
        {message&&<p className="lc-check-info" role="status">{message}</p>}
      </>
    )}
  </section>;
}
