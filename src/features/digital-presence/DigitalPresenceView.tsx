import { Activity, BarChart3, CheckCircle2, ExternalLink, Gauge, Globe2, Info, LoaderCircle, Monitor, Search, ShieldCheck, Smartphone, TriangleAlert, Accessibility, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "../../components/app-shell/PageHeader";
import type { PersistedLead } from "../leads/remote-leads";
import {
  analyzeDigitalPresence, getCachedDigitalReport, normalizePublicWebsite,
  officialPageSpeedUrl, remainingDigitalAnalyses,
  type AuditCategory, type AuditDevice, type DigitalReport,
} from "./digital-presence";

const CATEGORY_DETAILS: Array<{
  id: AuditCategory; label: string; description: string; icon: LucideIcon;
}> = [
  {id:"performance",label:"Desempenho",description:"Velocidade e resposta da página",icon:Gauge},
  {id:"accessibility",label:"Acessibilidade",description:"Boas práticas de uso",icon:Accessibility},
  {id:"bestPractices",label:"Boas práticas",description:"Qualidade técnica observada",icon:ShieldCheck},
  {id:"seo",label:"SEO",description:"Aspectos básicos de busca",icon:Search},
];

function scoreClass(score: number | null): string {
  if (score===null) return "unavailable";
  if (score>=90) return "high";
  if (score>=50) return "medium";
  return "low";
}

export function DigitalPresenceView({
  leads,onOpenLead,onOpenLeads,
}:{
  leads:PersistedLead[];
  onOpenLead:(lead:PersistedLead)=>void;
  onOpenLeads:()=>void;
}){
  const [selectedLeadId,setSelectedLeadId]=useState("");
  const [website,setWebsite]=useState("");
  const [device,setDevice]=useState<AuditDevice>("mobile");
  const [report,setReport]=useState<DigitalReport|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [source,setSource]=useState<"cache"|"live"|null>(null);
  const [remaining,setRemaining]=useState(8);
  const controller=useRef<AbortController|null>(null);
  const sortedLeads=useMemo(()=>
    [...leads].sort((a,b)=>a.company.localeCompare(b.company,"pt-BR")),
  [leads]);
  const selectedLead=leads.find(lead=>lead.id===selectedLeadId)??null;
  const validWebsite=useMemo(()=>{
    try{return normalizePublicWebsite(website);}catch{return "";}
  },[website]);
  useEffect(()=>{setRemaining(remainingDigitalAnalyses());},[]);
  useEffect(()=>{
    return ()=>controller.current?.abort();
  },[]);
  useEffect(()=>{
    if(!validWebsite){setReport(null);setSource(null);return;}
    const saved=getCachedDigitalReport(validWebsite,device);
    setReport(saved);
    setSource(saved?"cache":null);
    setError("");
  },[validWebsite,device]);

  function cancelRequest(){
    controller.current?.abort();
    controller.current=null;
    setLoading(false);
  }
  function chooseLead(value:string){
    cancelRequest();
    setSelectedLeadId(value);
    const lead=leads.find(item=>item.id===value);
    setWebsite(lead?.website??"");
    setError("");
    setReport(null);
  }
  function changeWebsite(value:string){
    cancelRequest();
    setWebsite(value);
    setError("");
    setReport(null);
  }
  async function analyze(event?:FormEvent<HTMLFormElement>){
    event?.preventDefault();
    if(loading)return;
    let url:string;
    try{url=normalizePublicWebsite(website);}
    catch(reason){setError(reason instanceof Error?reason.message:"Informe uma URL pública válida.");return;}
    controller.current?.abort();
    const request=new AbortController();
    controller.current=request;
    setLoading(true);setError("");
    try{
      const data=await analyzeDigitalPresence(url,device,request.signal);
      if(request.signal.aborted)return;
      setReport(data);setSource("live");
    }catch(reason){
      if(!request.signal.aborted)setError(reason instanceof Error?reason.message:"A análise não pôde ser concluída.");
    }finally{
      if(controller.current===request){setLoading(false);controller.current=null;}
      setRemaining(remainingDigitalAnalyses());
    }
  }
  const date=report&&Number.isFinite(Date.parse(report.checkedAt))
    ?new Date(report.checkedAt).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"";
  const reportUrl=report?.url??validWebsite;
  return <section className="saas-page dp-page">
    <PageHeader eyebrow="INTELIGÊNCIA COMERCIAL"
      title="Análise de presença digital"
      description="Identifique melhorias técnicas em sites públicos e prepare abordagens comerciais baseadas em evidências."
      actions={<button type="button" className="dp-secondary" onClick={onOpenLeads}>Abrir Meus Leads</button>}
    />
    <div className="dp-layout">
      <section className="dp-panel dp-form-panel" aria-labelledby="dp-form-title">
        <div className="dp-panel-head">
          <div className="dp-icon"><Globe2 size={20}/></div>
          <div><h2 id="dp-form-title">Analisar um site</h2><p>Selecione um lead ou informe um domínio público.</p></div>
        </div>
        <form onSubmit={event=>void analyze(event)} className="dp-form">
          <label htmlFor="dp-lead">Lead da sua carteira</label>
          <select id="dp-lead" value={selectedLeadId} onChange={event=>chooseLead(event.target.value)}>
            <option value="">Análise avulsa (sem vincular lead)</option>
            {sortedLeads.map(lead=><option key={lead.id} value={lead.id}>
              {lead.company}{lead.website?" · site cadastrado":""}
            </option>)}
          </select>
          {selectedLead&&!selectedLead.website&&<p className="dp-inline-note">Este lead não possui site cadastrado. Você pode informar um endereço manualmente, mas isso não altera o cadastro.</p>}
          <label htmlFor="dp-url">Endereço do site</label>
          <input id="dp-url" type="text" inputMode="url" maxLength={500} spellCheck={false}
            placeholder="https://empresa.com.br" value={website}
            onChange={event=>changeWebsite(event.target.value)} required/>
          <div className="dp-device-picker" role="group" aria-label="Tipo de dispositivo">
            <button type="button" aria-pressed={device==="mobile"}
              className={device==="mobile"?"active":""} disabled={loading}
              onClick={()=>setDevice("mobile")}><Smartphone size={16}/>Celular</button>
            <button type="button" aria-pressed={device==="desktop"}
              className={device==="desktop"?"active":""} disabled={loading}
              onClick={()=>setDevice("desktop")}><Monitor size={16}/>Computador</button>
          </div>
          <div className="dp-actions">
            <button type="submit" className="dp-primary" disabled={loading||!website.trim()||remaining===0}>
              {loading?<LoaderCircle className="dp-spin" size={17}/>:<Activity size={17}/>}
              {loading?"Analisando site...":report?"Analisar novamente":"Analisar site"}
            </button>
            {loading&&<button className="dp-secondary" type="button" onClick={cancelRequest}>Cancelar</button>}
          </div>
          <p className="dp-limit"><Info size={14}/> {remaining} de 8 novas consultas disponíveis hoje neste navegador. Relatórios recentes podem ser reabertos sem nova consulta.</p>
          {validWebsite&&<a className="dp-official-link" href={officialPageSpeedUrl(validWebsite,device)}
            target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14}/> Abrir a análise no PageSpeed oficial
          </a>}
        </form>
        {selectedLead&&<div className="dp-lead-context">
          <div><strong>{selectedLead.company}</strong>
          <span>{[selectedLead.segment,selectedLead.city,selectedLead.state].filter(Boolean).join(" · ")}</span></div>
          <button type="button" className="dp-secondary" onClick={()=>onOpenLead(selectedLead)}>Ver lead</button>
        </div>}
        <div className="dp-disclaimer">
          <ShieldCheck size={17}/>
          <p>Consulta sob demanda ao Google PageSpeed Insights. A URL informada é enviada ao Google. Nenhum dado de contato do lead é enviado e nenhum valor é cobrado pelo Januário Leads nesta versão.</p>
        </div>
      </section>
      <section className="dp-report-column" aria-label="Resultado da análise de presença digital">
        {error&&<div className="dp-alert" role="alert"><TriangleAlert size={19}/><span>{error}</span></div>}
        {loading&&<div className="dp-panel dp-loading" role="status">
          <LoaderCircle className="dp-spin" size={29}/>
          <strong>Analisando o site público</strong>
          <p>O PageSpeed executa medições reais. Isso pode levar alguns instantes.</p>
        </div>}
        {report&&!loading?<>
          <div className="dp-panel dp-results-header">
            <div className="dp-result-title">
              <div className="dp-icon"><CheckCircle2 size={20}/></div>
              <div><p>DIAGNÓSTICO DISPONÍVEL</p><h2>Resultado da análise</h2>
                <span>{report.finalUrl}</span></div>
            </div>
            <div className="dp-result-meta">
              <span>{report.device==="mobile"?"Celular":"Computador"} · {date}</span>
              {source==="cache"&&<span className="dp-cache-label">Relatório salvo</span>}
            </div>
          </div>
          <div className="dp-scores">
            {CATEGORY_DETAILS.map(category=>{
              const Icon=category.icon;
              const score=report.scores[category.id];
              return <div className={"dp-score-card "+scoreClass(score)} key={category.id}>
                <div className="dp-score-label"><Icon size={17}/><span>{category.label}</span></div>
                <strong>{score===null?"—":score}<small>{score!==null?"/100":""}</small></strong>
                <div className="dp-progress" aria-hidden="true"><span style={{width:(score??0)+"%"}}/></div>
                <p>{category.description}</p>
              </div>;
            })}
          </div>
          <div className="dp-panel">
            <div className="dp-panel-head"><div className="dp-icon"><BarChart3 size={20}/></div>
            <div><h2>Métricas observadas</h2><p>Resultados de laboratório do Lighthouse.</p></div></div>
            {report.metrics.length?<div className="dp-metrics">
              {report.metrics.map(metric=><div key={metric.id}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}
            </div>:<p className="dp-muted">A ferramenta não retornou métricas detalhadas para esta página.</p>}
          </div>
          <div className="dp-panel">
            <div className="dp-panel-head"><div className="dp-icon"><TriangleAlert size={20}/></div>
              <div><h2>Possíveis melhorias</h2><p>Itens apontados pela análise, não promessas de resultado comercial.</p></div></div>
            {report.findings.length?<ul className="dp-findings">
              {report.findings.map(f=><li key={f.id}><span className="dp-finding-point"/>
                <span>{f.title}</span><b>{f.score}/100</b></li>)}
            </ul>:<p className="dp-muted">Nenhuma recomendação prioritária foi identificada entre os testes disponíveis.</p>}
            <div className="dp-report-footer">
              <a href={officialPageSpeedUrl(reportUrl,report.device)} target="_blank"
                rel="noopener noreferrer" className="dp-secondary">
                <ExternalLink size={15}/> Ver relatório completo no PageSpeed
              </a>
            </div>
          </div>
          <p className="dp-muted dp-small">O diagnóstico é uma medição pontual. Pontuações podem variar conforme rede, dispositivo e condições do teste. Um resultado baixo não comprova, sozinho, perda de clientes.</p>
        </>:!loading&&<div className="dp-panel dp-empty">
          <div className="dp-empty-icon"><Gauge size={34}/></div>
          <h2>Uma análise antes da proposta</h2>
          <p>Escolha um lead ou digite a URL de um site para visualizar desempenho, acessibilidade, SEO e melhorias técnicas reais.</p>
          <span>Sem consultas automáticas. Sem pontuações inventadas.</span>
        </div>}
      </section>
    </div>
  </section>;
}
