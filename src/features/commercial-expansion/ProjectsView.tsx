import {useMemo,useState} from "react";
import {BriefcaseBusiness,Check,CheckCircle2,ClipboardList,Download,Plus,Trash2} from "lucide-react";
import {PageHeader} from "../../components/app-shell/PageHeader";
import type {PersistedLead} from "../leads/remote-leads";
import {formatCurrency} from "../lead-finance/finance";
import {loadProposals,proposalTotal} from "../proposals/proposals";
import {exportRecords,freshRecord,loadCommercial,saveCommercial,displayDate} from "./store";
import {isClientProject,PROJECT_STAGES,projectProgress,type ClientProject,type ProjectStatus} from "./projects";
export function ProjectsView({leads,onOpenLead,onFinance,onProposals}:{
 leads:PersistedLead[];onOpenLead:(lead:PersistedLead)=>void;
 onFinance:()=>void;onProposals:()=>void;
}){
 const [projects,setProjects]=useState<ClientProject[]>(()=>loadCommercial("projects",isClientProject,150));
 const [proposals]=useState(loadProposals);
 const [selectedId,setSelectedId]=useState("");
 const [newName,setNewName]=useState("");
 const [leadId,setLeadId]=useState("");
 const [proposalId,setProposalId]=useState("");
 const [taskTitle,setTaskTitle]=useState("");
 const [error,setError]=useState("");
 const [feedback,setFeedback]=useState("");
 const selected=projects.find(p=>p.id===selectedId)??null;
 const leadsById=useMemo(()=>new Map(leads.map(l=>[l.id,l])),[leads]);
 const acceptedProposals=proposals.filter(p=>p.status==="accepted");
 const stages=Object.entries(PROJECT_STAGES) as Array<[ProjectStatus,string]>;
 function commit(next:ClientProject[],message:string){
  try{saveCommercial("projects",next,150);setProjects(next);setFeedback(message);setError("");return true;}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar.");setFeedback("");return false;}
 }
 function create(){
  const name=newName.trim().slice(0,160);
  if(!name){setError("Informe o nome do projeto.");return;}
  if(proposalId&&projects.some(p=>p.proposalId===proposalId)){setError("Esta proposta já está vinculada a um projeto.");return;}
  const record:ClientProject={...freshRecord(),name,description:"",leadId:leadId||null,
    proposalId:proposalId||null,status:"briefing",dueDate:"",deliveredAt:null,tasks:[]};
  if(commit([record,...projects],"Projeto criado sem alterar os dados do CRM.")){setSelectedId(record.id);setNewName("");setLeadId("");setProposalId("");}
 }
 function patch(id:string,updates:Partial<ClientProject>,message="Projeto atualizado."){
  commit(projects.map(p=>p.id===id?{...p,...updates,updatedAt:new Date().toISOString()}:p),message);
 }
 function chooseProposal(id:string){
  setProposalId(id);
  const proposal=acceptedProposals.find(x=>x.id===id);
  if(proposal){
    setLeadId(proposal.leadId??"");
    setNewName(proposal.title||"Projeto para "+proposal.clientName);
  }
 }
 function changeStage(project:ClientProject,status:ProjectStatus){
  if(status==="delivered"&&!window.confirm("Marcar o projeto como entregue? Isso não registra recebimentos financeiros."))return;
  patch(project.id,{status,deliveredAt:status==="delivered"?new Date().toISOString():null},
    status==="delivered"?"Projeto marcado como entregue; Financeiro inalterado.":"Etapa atualizada.");
 }
 function addTask(){
  if(!selected)return;
  const title=taskTitle.trim().slice(0,160);
  if(!title){setError("Informe o nome da tarefa.");return;}
  if(selected.tasks.length>=60){setError("Máximo de 60 tarefas.");return;}
  patch(selected.id,{tasks:[...selected.tasks,{id:crypto.randomUUID(),title,done:false}]},"Tarefa adicionada.");
  setTaskTitle("");
 }
 function deleteProject(project:ClientProject){
  if(!window.confirm("Excluir este projeto? Isso não exclui o lead nem a proposta vinculada."))return;
  if(commit(projects.filter(p=>p.id!==project.id),"Projeto excluído. Lead e proposta preservados."))setSelectedId("");
 }
 return <section className="saas-page cx-page">
  <PageHeader eyebrow="PÓS-VENDA" title="Gestão de projetos"
   description="Acompanhe entregas e tarefas de projetos fechados, mantendo o CRM e o Financeiro independentes."
   actions={<button className="cx-button" type="button" disabled={!projects.length}
     onClick={()=>exportRecords("projetos",projects)}><Download size={15}/> Backup JSON</button>}/>
  <div className="cx-metrics"><div><small>Projetos na carteira</small><strong>{projects.length}</strong></div>
   <div><small>Em execução</small><strong>{projects.filter(p=>p.status!=="delivered"&&p.status!=="paused").length}</strong></div>
   <div><small>Entregues</small><strong>{projects.filter(p=>p.status==="delivered").length}</strong></div></div>
  <div className="cx-card cx-project-create">
   <h2><BriefcaseBusiness size={19}/> Novo projeto</h2>
   <form className="cx-project-form" onSubmit={e=>{e.preventDefault();create();}}>
     <label>Proposta aceita (opcional)<select value={proposalId} onChange={e=>chooseProposal(e.target.value)}>
       <option value="">Sem proposta vinculada</option>
       {acceptedProposals.map(p=><option key={p.id} value={p.id}>{p.clientName} · {p.title} · {formatCurrency(proposalTotal(p.lines))}</option>)}
     </select></label>
     <label>Lead vinculado<select value={leadId} onChange={e=>setLeadId(e.target.value)}>
       <option value="">Sem lead vinculado</option>{leads.map(l=><option key={l.id} value={l.id}>{l.company}</option>)}
     </select></label>
     <label>Nome do projeto<input value={newName} maxLength={160} required onChange={e=>setNewName(e.target.value)}
       placeholder="Ex.: Site institucional da barbearia"/></label>
     <button type="submit" className="cx-button primary"><Plus size={15}/> Criar projeto</button>
   </form>
   <p className="cx-helper">Somente propostas marcadas como aceitas são listadas. Criar um projeto não altera a proposta, o lead nem o valor financeiro.</p>
  </div>
  <div className="cx-board" aria-label="Quadro Kanban de projetos">
   {stages.map(([key,label])=><section className="cx-board-stage" key={key} aria-label={label}>
     <h2><span>{label}</span><small>{projects.filter(p=>p.status===key).length}</small></h2>
     <div className="cx-board-items">{projects.filter(p=>p.status===key).map(p=><button type="button" key={p.id}
       className={"cx-board-project"+(p.id===selectedId?" active":"")} onClick={()=>setSelectedId(p.id)}>
       <strong>{p.name}</strong>
       <small>{p.leadId?leadsById.get(p.leadId)?.company??"Lead removido":"Projeto avulso"}</small>
       <div className="cx-track"><div style={{width:projectProgress(p)+"%"}}/></div>
       <span>{p.tasks.filter(t=>t.done).length}/{p.tasks.length} tarefas</span>
     </button>)}
     {!projects.some(p=>p.status===key)&&<p className="cx-muted">Sem projetos</p>}</div>
   </section>)}
  </div>
  {selected&&<section className="cx-card cx-project-details">
   <div className="cx-split"><div><p className="cx-eyebrow">PROJETO SELECIONADO</p><h2>{selected.name}</h2>
    <p className="cx-muted">Criado em {displayDate(selected.createdAt)} · {projectProgress(selected)}% das tarefas concluídas</p></div>
    <div className="cx-inline-actions">
      {selected.leadId&&leadsById.has(selected.leadId)&&<button className="cx-button" type="button"
        onClick={()=>onOpenLead(leadsById.get(selected.leadId!)!)}>Ver lead</button>}
      {selected.proposalId&&<button className="cx-button" type="button" onClick={onProposals}>Abrir propostas</button>}
      <button className="cx-button" type="button" onClick={onFinance}>Financeiro</button>
      <button className="cx-button danger" type="button" onClick={()=>deleteProject(selected)}><Trash2 size={15}/> Excluir</button>
    </div></div>
   <div className="cx-project-form cx-project-details-form">
    <label>Fase<select value={selected.status} onChange={e=>changeStage(selected,e.target.value as ProjectStatus)}>
      {stages.map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></label>
    <label>Previsão de entrega<input type="date" value={selected.dueDate}
      onChange={e=>patch(selected.id,{dueDate:e.target.value})}/></label>
    <label className="cx-project-wide">Descrição / briefing<textarea rows={3} maxLength={4000}
      value={selected.description} onChange={e=>patch(selected.id,{description:e.target.value.slice(0,4000)})}
      placeholder="Objetivo, materiais necessários e informações do projeto"/></label>
   </div>
   <div className="cx-section"><h2><ClipboardList size={17}/> Checklist de tarefas</h2>
    <form className="cx-inline-form" onSubmit={e=>{e.preventDefault();addTask();}}>
     <input className="cx-control" maxLength={160} value={taskTitle} required
       placeholder="Ex.: Aprovar layout inicial" onChange={e=>setTaskTitle(e.target.value)}/>
     <button className="cx-button primary" type="submit"><Plus size={15}/> Adicionar tarefa</button>
    </form>
    <div className="cx-project-tasks">{selected.tasks.map(t=><div key={t.id}>
      <label className="cx-checkbox"><input type="checkbox" checked={t.done}
        onChange={()=>patch(selected.id,{tasks:selected.tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x)})}/>
       <span className={t.done?"done":""}>{t.title}</span></label>
      <button type="button" className="cx-button danger" aria-label={"Remover tarefa "+t.title}
        onClick={()=>patch(selected.id,{tasks:selected.tasks.filter(x=>x.id!==t.id)})}><Trash2 size={14}/></button>
    </div>)}
    {!selected.tasks.length&&<p className="cx-muted">Adicione tarefas concretas para acompanhar o avanço real do projeto.</p>}</div>
   </div>
  </section>}
  {error&&<p className="cx-alert" role="alert">{error}</p>}
  {feedback&&<p className="cx-notice" role="status"><Check size={16}/>{feedback}</p>}
  <p className="cx-footnote">Projetos e checklists são registros locais por conta/navegador. Marcar um projeto como entregue não confirma pagamento, não gera nota fiscal nem avisa o cliente.</p>
 </section>;
}
