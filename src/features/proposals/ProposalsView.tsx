import {
  BadgeCheck, BookOpen, Check, CirclePlus, ClipboardList, Copy, Download, FileCheck2,
  FileText, FolderOpen, Info, PencilLine, Plus, Printer, Save, Search,
  Trash2, Upload, X, type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type { PersistedLead } from "../leads/remote-leads";
import { PageHeader } from "../../components/app-shell/PageHeader";
import { formatCurrency } from "../lead-finance/finance";
import { getCachedDigitalReport, normalizePublicWebsite, type DigitalReport } from "../digital-presence/digital-presence";
import {
  applyProposalTemplate, duplicateProposal, loadProposals, makeProposal,
  parseProposalBackup, serializeProposalBackup,
  PROPOSAL_STATUS_LABEL, PROPOSAL_TEMPLATES, proposalCode, proposalLine,
  proposalTotal, saveProposals, validateProposalForSending,
  type ProposalRecord, type ProposalStatus, type ProposalTemplateId,
} from "./proposals";

const STATUSES: Array<{id:ProposalStatus;icon:LucideIcon}> = [
  {id:"draft",icon:PencilLine},
  {id:"sent",icon:FileText},
  {id:"accepted",icon:BadgeCheck},
  {id:"rejected",icon:X},
];
function formatDate(value:string):string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  const [y,m,d]=value.split("-");
  return y&&m&&d?`${d}/${m}/${y}`:"—";
}
function formatDateTime(value:string):string {
  const date=new Date(value);
  return Number.isFinite(date.getTime())
    ?date.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—";
}
function formattedDiagnostic(report:DigitalReport):string {
  const headings=[
    ["performance","Desempenho"],["accessibility","Acessibilidade"],
    ["bestPractices","Boas práticas"],["seo","SEO"],
  ] as const;
  const scores=headings.map(([key,label])=>
    `${label}: ${report.scores[key]===null?"não medido":report.scores[key]+"/100"}`).join(" · ");
  const date=formatDateTime(report.checkedAt);
  const improvements=report.findings.slice(0,3).map(x=>x.title).join("; ");
  return `Diagnóstico técnico (${report.device==="mobile"?"celular":"computador"}) do site ${report.url}, consultado em ${date}: ${scores}.${improvements?" Oportunidades apontadas pelo Lighthouse: "+improvements+".":""} Os resultados são pontuais e precisam de validação antes de qualquer promessa comercial.`;
}
function proposalCore(value:ProposalRecord) {
  const { revision: _revision, updatedAt: _updatedAt, status: _status, ...core }=value;
  return core;
}
function statusAllowed(record:ProposalRecord,status:ProposalStatus):string|null {
  if(status==="draft")return null;
  return validateProposalForSending(record);
}

function InputField({label,value,onChange,placeholder,maxLength=200,type="text",required=false}:{
  label:string;value:string;onChange:(value:string)=>void;placeholder?:string;
  maxLength?:number;type?:string;required?:boolean;
}){
  return <label className="pc-field"><span>{label}{required?" *":""}</span>
    <input type={type} value={value} maxLength={maxLength} required={required}
      placeholder={placeholder} onChange={event=>onChange(event.target.value)}/>
  </label>;
}
function TextField({label,value,onChange,placeholder,rows=3,maxLength=2400}:{
  label:string;value:string;onChange:(value:string)=>void;placeholder?:string;
  rows?:number;maxLength?:number;
}){
  return <label className="pc-field"><span>{label}</span>
    <textarea rows={rows} maxLength={maxLength} value={value} placeholder={placeholder}
      onChange={event=>onChange(event.target.value)} />
  </label>;
}

export function ProposalsView({leads,sellerName,onOpenLead}:{
  leads:PersistedLead[];
  sellerName:string;
  onOpenLead:(lead:PersistedLead)=>void;
}){
  const [proposals,setProposals]=useState<ProposalRecord[]>(loadProposals);
  const [selectedId,setSelectedId]=useState<string|null>(proposals[0]?.id??null);
  const [draft,setDraft]=useState<ProposalRecord>(
    ()=>proposals[0]??makeProposal(null,sellerName),
  );
  const backupInput=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<ProposalStatus|"all">("all");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const currentSaved=proposals.find(p=>p.id===selectedId)??null;
  const isDirty=!currentSaved||JSON.stringify(proposalCore(draft))!==JSON.stringify(proposalCore(currentSaved))||
    draft.status!==currentSaved.status;
  const linkedLead=leads.find(lead=>lead.id===draft.leadId)??null;
  const total=proposalTotal(draft.lines);
  const sorted=useMemo(()=>[...proposals].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[proposals]);
  const filtered=useMemo(()=>sorted.filter(p=>(filter==="all"||p.status===filter) &&
    (!query.trim()||[p.clientName,p.title,proposalCode(p)].some(value=>
      value.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))))),[sorted,filter,query]);
  const diagnostic=useMemo(()=>{
    if(!linkedLead?.website)return null;
    try {
      const url=normalizePublicWebsite(linkedLead.website);
      return getCachedDigitalReport(url,"mobile")??getCachedDigitalReport(url,"desktop");
    }catch{return null;}
  },[linkedLead?.website]);

  function abandonIfDirty():boolean {
    return !isDirty || window.confirm("Há alterações não salvas nesta proposta. Descartar as alterações?");
  }
  function patch<K extends keyof ProposalRecord>(key:K,value:ProposalRecord[K]){
    setDraft(current=>({...current,[key]:value}));
    setError("");setMessage("");
  }
  function editLine(id:string,updates:Partial<{description:string;quantity:number;unitPrice:number}>){
    setDraft(current=>({...current,lines:current.lines.map(line=>
      line.id===id?{...line,...updates}:line)}));
    setError("");setMessage("");
  }
  function newProposal(){
    if(!abandonIfDirty())return;
    setSelectedId(null);setDraft(makeProposal(null,sellerName));
    setMessage("");setError("");
  }
  function selectProposal(proposal:ProposalRecord){
    if(selectedId===proposal.id)return;
    if(!abandonIfDirty())return;
    setSelectedId(proposal.id);setDraft({...proposal});
    setMessage("");setError("");
  }
  function commit(proposal:ProposalRecord,notice:string):boolean {
    const prior=proposals.find(p=>p.id===proposal.id);
    const revision=prior && JSON.stringify(proposalCore(prior))!==JSON.stringify(proposalCore(proposal))
      ?Math.min(9999,prior.revision+1):(prior?.revision??1);
    const final={...proposal,revision,updatedAt:new Date().toISOString()};
    const next=[final,...proposals.filter(p=>p.id!==final.id)];
    try{
      saveProposals(next);
      setProposals(next);setSelectedId(final.id);setDraft(final);
      setMessage(notice);setError("");
      return true;
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Não foi possível salvar.");
      setMessage("");
      return false;
    }
  }
  function save(){
    if(draft.status!=="draft"){
      const message=statusAllowed(draft,draft.status);
      if(message){setError(message);setMessage("");return;}
    }
    commit(draft,"Proposta salva neste navegador.");
  }
  function changeStatus(status:ProposalStatus) {
    const message=statusAllowed(draft,status);
    if(message){setError(message);setMessage("");return;}
    if(status==="accepted" && !window.confirm("Confirmar que o cliente aceitou esta proposta? O Financeiro não será alterado automaticamente."))return;
    commit({...draft,status},
      status==="sent"?"Proposta marcada como enviada. Nenhuma mensagem foi enviada pelo Januário Leads.":
      "Status atualizado na proposta.");
  }
  function deleteProposal(){
    if(!selectedId){newProposal();return;}
    if(!window.confirm("Excluir definitivamente esta proposta salva neste navegador?"))return;
    const next=proposals.filter(p=>p.id!==selectedId);
    try{
      saveProposals(next);
      setProposals(next);
      const first=next[0];
      setSelectedId(first?.id??null);
      setDraft(first??makeProposal(null,sellerName));
      setMessage("Proposta excluída deste navegador.");
      setError("");
    }catch(reason){setError(reason instanceof Error?reason.message:"Erro ao excluir.");}
  }
  function duplicate(){
    if(!abandonIfDirty())return;
    const copy=duplicateProposal(draft);
    commit(copy,"Cópia criada como novo rascunho.");
  }
  function chooseLead(value:string){
    const lead=leads.find(l=>l.id===value);
    setDraft(current=>({...current,leadId:lead?.id??null,
      clientName:lead?.company??current.clientName}));
    setError("");setMessage("");
  }
  function useTemplate(id:string){
    const template=PROPOSAL_TEMPLATES.find(t=>t.id===id);
    if(!template)return;
    if((draft.scope.trim() || draft.lines.some(line=>line.description.trim()))&&
      !window.confirm("Aplicar este modelo vai substituir título, descrição e serviços desta proposta. Continuar?"))return;
    setDraft(current=>applyProposalTemplate(current,id as ProposalTemplateId));
    setError("");setMessage("");
  }
  function addDiagnostic(){
    if(!diagnostic)return;
    const note=formattedDiagnostic(diagnostic);
    setDraft(current=>({...current,scope:(current.scope.trim()?current.scope.trim()+"\n\n":"")+note}));
    setMessage("Resultados reais do diagnóstico salvo incluídos no escopo.");
    setError("");
  }
  function printProposal(){
    if(draft.status!=="draft"){
      const e=validateProposalForSending(draft);
      if(e){setError(e);return;}
    }
    window.print();
  }
  function addLine(){
    if(draft.lines.length>=30){setError("Limite de 30 serviços por proposta.");return;}
    patch("lines",[...draft.lines,proposalLine()]);
  }
  function removeLine(id:string){
    patch("lines",draft.lines.filter(line=>line.id!==id));
  }
  function replacePrice(id:string,event:ChangeEvent<HTMLInputElement>){
    editLine(id,{unitPrice:Number(event.target.value)});
  }
  function exportBackup(){
    try{
      const data=serializeProposalBackup(proposals);
      const blob=new Blob([data],{type:"application/json;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const element=document.createElement("a");
      element.href=url;
      element.download="januarioleads-propostas-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(element);
      element.click();element.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1200);
      setMessage("Backup JSON gerado. Guarde o arquivo em um lugar seguro.");
      setError("");
    }catch{
      setError("Não foi possível gerar o backup das propostas.");
    }
  }
  async function importBackup(file:File){
    if(!abandonIfDirty())return;
    setError("");setMessage("");
    try{
      if(file.size>3_000_000)throw new Error("O arquivo excede o limite de 3 MB.");
      const imported=parseProposalBackup(await file.text());
      const existing=new Set(proposals.map(item=>item.id));
      const added=imported.filter(item=>!existing.has(item.id));
      if(added.length===0){setMessage("Nenhuma proposta nova para importar. As existentes foram preservadas.");return;}
      if(proposals.length+added.length>120)
        throw new Error("O backup excederia o limite de 120 propostas. Exclua propostas antigas antes de importar.");
      if(!window.confirm("Importar "+added.length+" proposta(s) deste backup? Propostas já existentes não serão substituídas."))return;
      const next=[...added,...proposals];
      saveProposals(next);
      setProposals(next);
      setSelectedId(added[0]!.id);
      setDraft(added[0]!);
      setMessage(added.length+" proposta(s) importada(s). Nenhum registro anterior foi substituído.");
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Não foi possível importar o backup.");
    }
  }

  return <section className="saas-page pc-page">
    <PageHeader eyebrow="GESTÃO COMERCIAL" title="Propostas comerciais"
      description="Crie propostas profissionais a partir dos seus leads, organize negociações e imprima ou salve o documento em PDF."
      actions={<button type="button" className="pc-button pc-primary" onClick={newProposal}>
        <CirclePlus size={17}/> Nova proposta
      </button>}/>
    <div className="pc-workspace">
      <aside className="pc-sidebar pc-panel" aria-label="Propostas salvas">
        <div className="pc-sidebar-title"><div><FolderOpen size={18}/><strong>Propostas</strong></div>
          <span>{proposals.length}</span></div>
        <div className="pc-filters">
          <label className="pc-query"><Search size={15}/><input type="search" value={query}
            onChange={event=>setQuery(event.target.value)} placeholder="Buscar propostas..."
            aria-label="Buscar propostas salvas"/></label>
          <select aria-label="Filtrar propostas por status" value={filter}
            onChange={event=>setFilter(event.target.value as typeof filter)}>
            <option value="all">Todos os status</option>
            {STATUSES.map(status=><option key={status.id} value={status.id}>{PROPOSAL_STATUS_LABEL[status.id]}</option>)}
          </select>
        </div>
        <div className="pc-sidebar-list">
          {filtered.length===0?<div className="pc-empty-list">
            <ClipboardList size={26}/><strong>Nenhuma proposta encontrada</strong>
            <p>Crie sua primeira proposta ou altere os filtros.</p>
          </div>:filtered.map(record=>
            <button type="button" key={record.id} onClick={()=>selectProposal(record)}
              className={"pc-saved-item"+(selectedId===record.id?" selected":"")}>
              <span className="pc-item-head"><strong>{record.clientName||"Cliente não informado"}</strong>
                <span className={"pc-state "+record.status}>{PROPOSAL_STATUS_LABEL[record.status]}</span></span>
              <span className="pc-item-title">{record.title||"Proposta sem título"}</span>
              <span className="pc-item-foot"><small>{proposalCode(record)}</small>
                <b>{formatCurrency(proposalTotal(record.lines))}</b></span>
            </button>)}
        </div>
        <div className="pc-backup-actions">
          <button type="button" className="pc-button pc-secondary" disabled={!proposals.length}
            onClick={exportBackup}><Download size={15}/> Exportar backup</button>
          <button type="button" className="pc-button pc-secondary"
            onClick={()=>backupInput.current?.click()}><Upload size={15}/> Importar backup</button>
          <input ref={backupInput} type="file" accept="application/json,.json"
            className="pc-hidden-file" aria-label="Arquivo de backup das propostas"
            onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void importBackup(file);}}/>
        </div>
        <p className="pc-storage-notice"><Info size={14}/> Nesta primeira versão, as propostas ficam neste navegador e nesta conta. Exporte um backup JSON para recuperar edições em outro dispositivo; PDFs servem para compartilhar com clientes.</p>
      </aside>
      <div className="pc-editor pc-panel">
        <div className="pc-editor-top">
          <div><span className="pc-overline">EDITOR DE PROPOSTA</span>
            <h2>{currentSaved?proposalCode(currentSaved):"Nova proposta"}</h2>
            <p>{isDirty?"Alterações ainda não salvas":"Última atualização: "+formatDateTime(draft.updatedAt)}</p></div>
          <div className="pc-editor-actions">
            <button type="button" className="pc-button pc-secondary" onClick={duplicate}><Copy size={15}/> Duplicar</button>
            <button type="button" className="pc-button pc-secondary pc-danger" onClick={deleteProposal}
              disabled={!selectedId}><Trash2 size={15}/> Excluir</button>
            <button type="button" className="pc-button pc-primary" onClick={save}><Save size={15}/> Salvar</button>
          </div>
        </div>
        {error&&<p className="pc-feedback error" role="alert">{error}</p>}
        {message&&<p className="pc-feedback success" role="status"><Check size={15}/>{message}</p>}
        <div className="pc-form-section">
          <h3><BookOpen size={17}/> Modelo e cliente</h3>
          <label className="pc-field"><span>Modelo de serviço</span>
            <select defaultValue="" onChange={e=>{if(e.target.value)useTemplate(e.target.value);e.target.value="";}}>
              <option value="">Selecionar um modelo (opcional)</option>
              {PROPOSAL_TEMPLATES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="pc-field"><span>Vincular a um lead</span>
            <select value={draft.leadId??""} onChange={e=>chooseLead(e.target.value)}>
              <option value="">Proposta avulsa (sem lead)</option>
              {[...leads].sort((a,b)=>a.company.localeCompare(b.company,"pt-BR")).map(l=>
                <option key={l.id} value={l.id}>{l.company}</option>)}
            </select>
          </label>
          {linkedLead&&<div className="pc-lead-connector">
            <span>Vinculada a <strong>{linkedLead.company}</strong></span>
            <button type="button" onClick={()=>onOpenLead(linkedLead)}>Ver lead</button>
          </div>}
          <div className="pc-two-col">
            <InputField label="Nome da empresa / cliente" value={draft.clientName} maxLength={160}
              onChange={v=>patch("clientName",v)} required/>
            <InputField label="E-mail do cliente (opcional)" type="email" value={draft.clientEmail}
              onChange={v=>patch("clientEmail",v)}/>
          </div>
          <InputField label="Título da proposta" value={draft.title} maxLength={160}
            onChange={v=>patch("title",v)} required/>
          <div className="pc-two-col">
            <InputField label="Responsável / prestador" value={draft.sellerName} maxLength={160}
              onChange={v=>patch("sellerName",v)} placeholder="Seu nome ou empresa" required/>
            <InputField label="Contato do responsável" value={draft.sellerContact} maxLength={180}
              onChange={v=>patch("sellerContact",v)} placeholder="E-mail ou telefone (opcional)"/>
          </div>
        </div>
        <div className="pc-form-section">
          <h3><FileText size={17}/> Escopo e entregas</h3>
          <TextField label="Apresentação" value={draft.introduction} rows={3}
            onChange={v=>patch("introduction",v)} placeholder="Apresente brevemente a proposta..."/>
          <TextField label="Escopo do serviço" value={draft.scope} maxLength={6000} rows={5}
            onChange={v=>patch("scope",v)} placeholder="Descreva o que será realizado e entregue."/>
          {diagnostic&&<div className="pc-diagnostic-attach">
            <span><BadgeCheck size={16}/> Diagnóstico recente disponível para {linkedLead?.company}</span>
            <button type="button" className="pc-button pc-secondary" onClick={addDiagnostic}>
              Usar diagnóstico salvo
            </button>
          </div>}
          <TextField label="Prazo estimado" value={draft.deadline} rows={2} maxLength={300}
            onChange={v=>patch("deadline",v)} placeholder="Ex.: 15 dias úteis após aprovação e recebimento do material."/>
        </div>
        <div className="pc-form-section">
          <h3><ClipboardList size={17}/> Serviços e valores</h3>
          <div className="pc-lines">
            {draft.lines.map((line,index)=><div className="pc-line" key={line.id}>
              <div className="pc-line-head"><strong>Serviço {index+1}</strong>
                <button type="button" className="pc-icon-button" aria-label={"Remover serviço "+(index+1)}
                  onClick={()=>removeLine(line.id)}><Trash2 size={15}/></button></div>
              <label className="pc-field pc-line-description"><span>Descrição</span>
                <input type="text" value={line.description} maxLength={300}
                  placeholder="Descreva o serviço" onChange={e=>editLine(line.id,{description:e.target.value})}/></label>
              <div className="pc-line-numbers">
                <label className="pc-field"><span>Quantidade</span>
                  <input inputMode="numeric" type="number" min={1} max={999} step={1} value={line.quantity}
                    onChange={e=>editLine(line.id,{quantity:Number(e.target.value)})}/></label>
                <label className="pc-field"><span>Valor unitário (R$)</span>
                  <input inputMode="decimal" type="number" min={0} max={10000000} step=".01"
                    value={line.unitPrice} onChange={e=>replacePrice(line.id,e)}/></label>
              </div>
            </div>)}
          </div>
          <div className="pc-lines-footer">
            <button type="button" className="pc-button pc-secondary" disabled={draft.lines.length>=30}
              onClick={addLine}><Plus size={15}/> Adicionar serviço</button>
            <span>Total da proposta <strong>{formatCurrency(total)}</strong></span>
          </div>
        </div>
        <div className="pc-form-section">
          <h3><FileCheck2 size={17}/> Condições e acompanhamento</h3>
          <div className="pc-two-col">
            <InputField label="Validade da proposta" type="date" value={draft.validUntil}
              onChange={v=>patch("validUntil",v)}/>
            <label className="pc-field"><span>Situação comercial</span>
              <select value={draft.status} onChange={e=>changeStatus(e.target.value as ProposalStatus)}>
                {STATUSES.map(x=><option value={x.id} key={x.id}>{PROPOSAL_STATUS_LABEL[x.id]}</option>)}
              </select>
            </label>
          </div>
          <TextField label="Condições de pagamento" value={draft.paymentTerms} rows={3} maxLength={1200}
            onChange={v=>patch("paymentTerms",v)} placeholder="Ex.: entrada de 50% e saldo após entrega."/>
          <TextField label="Observações adicionais" value={draft.notes} rows={3} maxLength={2500}
            onChange={v=>patch("notes",v)} placeholder="Informações ou condições complementares."/>
          <p className="pc-inline-tip"><Info size={15}/> Alterar a situação é um registro manual. Não envia mensagens ao cliente nem registra pagamentos no Financeiro.</p>
        </div>
      </div>
      <div className="pc-preview-column">
        <div className="pc-preview-toolbar"><span><FileText size={17}/> Prévia do documento</span>
          <button type="button" className="pc-button pc-primary" onClick={printProposal}>
            <Printer size={16}/> Imprimir / Salvar PDF
          </button>
        </div>
        <article className="pc-sheet" aria-label="Prévia profissional da proposta">
          <header className="pc-sheet-header">
            <div className="pc-sheet-brand"><span className="pc-sheet-monogram">JL</span>
              <div><strong>PROPOSTA COMERCIAL</strong><small>Documento preparado no Januário Leads</small></div></div>
            <div className="pc-sheet-code"><span>{proposalCode(draft)}</span><small>Revisão {draft.revision}</small></div>
          </header>
          <div className="pc-sheet-intro">
            <div className="pc-sheet-kicker">PROPOSTA DE SERVIÇOS</div>
            <h2>{draft.title.trim()||"Título da proposta"}</h2>
            {draft.introduction&&<p>{draft.introduction}</p>}
          </div>
          <div className="pc-sheet-meta">
            <div><span>PREPARADO PARA</span><strong>{draft.clientName.trim()||"Cliente a definir"}</strong>
              {draft.clientEmail&&<small>{draft.clientEmail}</small>}</div>
            <div><span>RESPONSÁVEL</span><strong>{draft.sellerName.trim()||"Responsável a definir"}</strong>
              {draft.sellerContact&&<small>{draft.sellerContact}</small>}</div>
          </div>
          {draft.scope&&<section className="pc-sheet-section">
            <h3>Escopo do projeto</h3><p className="pc-sheet-text">{draft.scope}</p>
          </section>}
          <section className="pc-sheet-section">
            <h3>Investimento</h3>
            <table className="pc-sheet-table">
              <thead><tr><th>Serviço</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr></thead>
              <tbody>{draft.lines.map(line=><tr key={line.id}>
                <td>{line.description||"Serviço a detalhar"}</td>
                <td>{line.quantity}</td>
                <td>{formatCurrency(line.unitPrice)}</td>
                <td>{formatCurrency(proposalTotal([line]))}</td>
              </tr>)}</tbody>
            </table>
            <div className="pc-sheet-total"><span>VALOR TOTAL</span><strong>{formatCurrency(total)}</strong></div>
          </section>
          {(draft.deadline||draft.validUntil||draft.paymentTerms)&&<section className="pc-sheet-section">
            <h3>Prazos e condições</h3>
            <dl className="pc-sheet-terms">
              {draft.deadline&&<><dt>Prazo estimado</dt><dd>{draft.deadline}</dd></>}
              {draft.validUntil&&<><dt>Validade</dt><dd>{formatDate(draft.validUntil)}</dd></>}
              {draft.paymentTerms&&<><dt>Pagamento</dt><dd>{draft.paymentTerms}</dd></>}
            </dl>
          </section>}
          {draft.notes&&<section className="pc-sheet-section">
            <h3>Observações</h3><p className="pc-sheet-text">{draft.notes}</p>
          </section>}
          <footer className="pc-sheet-footer">
            <span>Emitida em {formatDate(draft.createdAt.slice(0,10))}</span>
            <span>Situação: {PROPOSAL_STATUS_LABEL[draft.status]}</span>
          </footer>
        </article>
        <p className="pc-print-tip">Para criar o PDF, escolha “Salvar como PDF” na janela de impressão do navegador. Nenhuma proposta é enviada automaticamente.</p>
      </div>
    </div>
  </section>;
}
