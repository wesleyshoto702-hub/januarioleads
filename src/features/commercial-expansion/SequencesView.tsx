import {useMemo,useState} from "react";
import {CalendarClock,Check,CheckCircle2,ClipboardCopy,FileClock,Pause,Play,Plus,Trash2} from "lucide-react";
import {PageHeader} from "../../components/app-shell/PageHeader";
import type {PersistedLead} from "../leads/remote-leads";
import type {MessageTemplate} from "../messages/message-templates";
import {brazilToday,displayDate,exportRecords,freshRecord,loadCommercial,saveCommercial,nonemptyText} from "./store";
import {addDateDays,isEnrollment,isSequence,nextSequenceStep,sequenceProgress,type Sequence,type Enrollment,type SequenceStep,SEQUENCE_PLAN_KEY,ENROLLMENT_KEY} from "./sequences";
export function SequencesView({leads,messages,onOpenLead}:{
 leads:PersistedLead[];messages:MessageTemplate[];onOpenLead:(lead:PersistedLead)=>void;
}){
 const [plans,setPlans]=useState<Sequence[]>(()=>loadCommercial(SEQUENCE_PLAN_KEY,isSequence,60));
 const [entries,setEntries]=useState<Enrollment[]>(()=>loadCommercial(ENROLLMENT_KEY,isEnrollment,300));
 const [selectedId,setSelectedId]=useState("");
 const [newName,setNewName]=useState("");
 const [enrollLeadId,setEnrollLeadId]=useState("");
 const [feedback,setFeedback]=useState("");
 const [error,setError]=useState("");
 const selected=plans.find(x=>x.id===selectedId)??null;
 const indexedLeads=useMemo(()=>new Map(leads.map(l=>[l.id,l])),[leads]);
 const stats=entries.reduce((sum,item)=>{
   const plan=plans.find(p=>p.id===item.sequenceId);
   if(!plan||!nextSequenceStep(plan,item))sum.completed++;
   else if(!item.paused)sum.active++;
   return sum;
 },{active:0,completed:0});
 function savePlans(next:Sequence[],message="Sequência atualizada."){
   try{saveCommercial(SEQUENCE_PLAN_KEY,next,60);setPlans(next);setError("");setFeedback(message);return true;}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar.");setFeedback("");return false;}
 }
 function saveEntries(next:Enrollment[],message="Acompanhamento atualizado."){
   try{saveCommercial(ENROLLMENT_KEY,next,300);setEntries(next);setError("");setFeedback(message);return true;}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar.");setFeedback("");return false;}
 }
 function create(){
   const name=nonemptyText(newName,100);
   if(!name){setError("Dê um nome à sequência.");return;}
   const entry:Sequence={...freshRecord(),name,steps:[
     {id:crypto.randomUUID(),title:"Primeira abordagem",afterDays:0,templateId:null},
     {id:crypto.randomUUID(),title:"Primeiro follow-up",afterDays:3,templateId:null},
     {id:crypto.randomUUID(),title:"Segundo follow-up",afterDays:7,templateId:null},
   ]};
   if(savePlans([entry,...plans],"Sequência criada.")){setSelectedId(entry.id);setNewName("");}
 }
 function updateStep(plan:Sequence,id:string,patch:Partial<SequenceStep>){
   savePlans(plans.map(x=>x.id===plan.id?{...x,steps:x.steps.map(s=>s.id===id?{...s,...patch}:s),updatedAt:new Date().toISOString()}:x));
 }
 function addStep(plan:Sequence){
   if(plan.steps.length>=12){setError("Máximo de 12 etapas.");return;}
   const last=Math.max(0,...plan.steps.map(s=>s.afterDays));
   const step:SequenceStep={id:crypto.randomUUID(),title:"Novo contato",afterDays:last+3,templateId:null};
   savePlans(plans.map(x=>x.id===plan.id?{...x,steps:[...x.steps,step],updatedAt:new Date().toISOString()}:x));
 }
 function removeStep(plan:Sequence,id:string){
   if(entries.some(e=>e.sequenceId===plan.id)) {setError("Não é possível remover etapas de sequências já iniciadas. Crie outro modelo.");return;}
   savePlans(plans.map(x=>x.id===plan.id?{...x,steps:x.steps.filter(s=>s.id!==id)}:x));
 }
 function enroll(){
   if(!selected||!indexedLeads.has(enrollLeadId)){setError("Selecione uma empresa da sua carteira.");return;}
   if(!selected.steps.length){setError("A sequência precisa de pelo menos uma etapa.");return;}
   if(entries.some(e=>e.sequenceId===selected.id&&e.leadId===enrollLeadId&&nextSequenceStep(selected,e))){
     setError("Este lead já participa de uma execução ativa desta sequência.");return;
   }
   const entry:Enrollment={...freshRecord(),leadId:enrollLeadId,sequenceId:selected.id,startedAt:brazilToday(),
     completed:{},paused:false};
   if(saveEntries([entry,...entries],"Lead incluído na sequência. Os contatos continuam manuais."))setEnrollLeadId("");
 }
 function changeEntry(id:string,update:(e:Enrollment)=>Enrollment,message:string){
   saveEntries(entries.map(e=>e.id===id?{...update(e),updatedAt:new Date().toISOString()}:e),message);
 }
 function deletePlan(plan:Sequence){
   if(entries.some(e=>e.sequenceId===plan.id)){setError("Há leads vinculados a esta sequência. Remova os acompanhamentos primeiro.");return;}
   if(!window.confirm("Excluir este modelo de sequência?"))return;
   if(savePlans(plans.filter(p=>p.id!==plan.id),"Modelo excluído."))setSelectedId("");
 }
 async function copyTemplate(plan:Sequence,step:SequenceStep,lead:PersistedLead){
   const tpl=messages.find(m=>m.id===step.templateId);
   if(!tpl){setError("Nenhum modelo de mensagem selecionado nesta etapa.");return;}
   try {
     await navigator.clipboard.writeText(tpl.text.replaceAll("{empresa}",lead.company));
     setFeedback("Mensagem copiada. Envie manualmente pelo canal escolhido.");setError("");
   }catch {setError("Não foi possível copiar. Verifique a permissão da área de transferência.");}
 }
 return <section className="saas-page cx-page">
  <PageHeader eyebrow="MENSAGENS · ACOMPANHAMENTO" title="Sequências de prospecção"
   description="Planeje abordagens e retornos, acompanhe as etapas e copie modelos de mensagem sem envio automático."
   actions={<button className="cx-button" type="button" onClick={()=>exportRecords("sequencias",plans)} disabled={!plans.length}>Exportar modelos</button>}/>
  <div className="cx-metrics"><div><small>Modelos criados</small><strong>{plans.length}</strong></div>
   <div><small>Acompanhamentos ativos</small><strong>{stats.active}</strong></div>
   <div><small>Concluídos</small><strong>{stats.completed}</strong></div></div>
  <div className="cx-grid">
   <aside className="cx-card"><h2><FileClock size={19}/> Modelos de sequência</h2>
    <form className="cx-form" onSubmit={e=>{e.preventDefault();create();}}>
     <label>Nome da sequência<input maxLength={100} value={newName} onChange={e=>setNewName(e.target.value)}
       required placeholder="Ex.: Primeiro contato para criação de sites"/></label>
     <button type="submit" className="cx-button primary"><Plus size={16}/> Criar modelo</button>
    </form>
    <div className="cx-list">{plans.map(p=><button type="button" key={p.id}
       className={"cx-list-entry"+(p.id===selectedId?" active":"")} onClick={()=>setSelectedId(p.id)}>
       <strong>{p.name}</strong><span>{p.steps.length} etapas · {entries.filter(e=>e.sequenceId===p.id).length} execuções</span>
     </button>)}</div>
    {!plans.length&&<p className="cx-muted">Crie um modelo de abordagem e seus follow-ups.</p>}
   </aside>
   <div className="cx-card">{selected?<>
    <div className="cx-split"><h2><CalendarClock size={19}/>{selected.name}</h2>
      <button type="button" className="cx-button danger" onClick={()=>deletePlan(selected)}><Trash2 size={14}/> Excluir modelo</button></div>
    <p className="cx-helper">Os dias são contados a partir do início da sequência. Não há disparos automáticos.</p>
    <div className="cx-steps">{selected.steps.map((s,i)=><div className="cx-step" key={s.id}>
      <span className="cx-step-index">{i+1}</span>
      <label>Etapa<input value={s.title} maxLength={110} onChange={e=>updateStep(selected,s.id,{title:e.target.value})}/></label>
      <label>Dia da sequência<input type="number" min={0} max={365} value={s.afterDays}
        onChange={e=>updateStep(selected,s.id,{afterDays:Math.min(365,Math.max(0,Number(e.target.value)||0))})}/></label>
      <label>Mensagem associada
       <select value={s.templateId??""} onChange={e=>updateStep(selected,s.id,{templateId:e.target.value||null})}>
        <option value="">Sem modelo de mensagem</option>
        {messages.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
       </select></label>
      <button type="button" className="cx-button danger" disabled={entries.some(e=>e.sequenceId===selected.id)}
        onClick={()=>removeStep(selected,s.id)}><Trash2 size={14}/></button>
    </div>)}</div>
    <button type="button" className="cx-button" disabled={selected.steps.length>=12||entries.some(e=>e.sequenceId===selected.id)}
      onClick={()=>addStep(selected)}><Plus size={15}/> Adicionar etapa</button>
    <div className="cx-section"><h2>Iniciar sequência para um lead</h2>
      <div className="cx-inline-form">
       <select className="cx-control" aria-label="Escolher lead" value={enrollLeadId} onChange={e=>setEnrollLeadId(e.target.value)}>
        <option value="">Selecione uma empresa...</option>
        {[...leads].sort((a,b)=>a.company.localeCompare(b.company,"pt-BR")).map(l=><option key={l.id} value={l.id}>{l.company}</option>)}
       </select>
       <button className="cx-button primary" type="button" onClick={enroll}>Iniciar acompanhamento</button>
      </div>
    </div>
    <div className="cx-section"><h2>Leads acompanhados</h2>
      {entries.filter(e=>e.sequenceId===selected.id).map(e=>{
       const lead=indexedLeads.get(e.leadId);
       const next=nextSequenceStep(selected,e);
       const done=!next;
       return <div className="cx-enrollment" key={e.id}>
        <div><strong>{lead?.company??"Lead não encontrado"}</strong>
        <p>{done?"Todas as etapas concluídas":e.paused?"Pausada":`Próxima: ${next.step.title} · ${displayDate(next.due)}`}</p>
        <small>{sequenceProgress(selected,e)}% concluído</small></div>
        <div className="cx-inline-actions">
         {lead&&<button type="button" className="cx-link" onClick={()=>onOpenLead(lead)}>Ver lead</button>}
         {!done&&<button type="button" className="cx-button" onClick={()=>changeEntry(e.id,x=>({...x,paused:!x.paused}),e.paused?"Retomada.":"Pausada.")}>{e.paused?<Play size={14}/>:<Pause size={14}/>} {e.paused?"Retomar":"Pausar"}</button>}
         {!done&&!e.paused&&lead&&next?.step.templateId&&<button type="button" className="cx-button" onClick={()=>void copyTemplate(selected,next.step,lead)}><ClipboardCopy size={14}/>Copiar mensagem</button>}
         {!done&&!e.paused&&next&&<button type="button" className="cx-button primary" onClick={()=>
           changeEntry(e.id,x=>({...x,completed:{...x.completed,[next.step.id]:new Date().toISOString()}}),"Etapa concluída manualmente.")}>
           <CheckCircle2 size={14}/> Concluir etapa</button>}
         <button type="button" className="cx-button danger" onClick={()=>{
           if(window.confirm("Remover este acompanhamento, sem alterar o lead?"))saveEntries(entries.filter(x=>x.id!==e.id),"Acompanhamento removido.");
         }}><Trash2 size={14}/></button>
        </div>
       </div>;
      })}
      {!entries.some(e=>e.sequenceId===selected.id)&&<p className="cx-muted">Nenhuma empresa iniciou esta sequência.</p>}
    </div>
   </>:<div className="cx-blank"><CalendarClock size={34}/><h2>Construa seus follow-ups</h2>
    <p>Escolha um modelo para organizar contatos e tarefas por empresa.</p></div>}</div>
  </div>
  {error&&<p className="cx-alert" role="alert">{error}</p>}
  {feedback&&<p className="cx-notice" role="status"><Check size={16}/>{feedback}</p>}
  <p className="cx-footnote">Etapas e datas são locais ao navegador da conta. Uma tarefa não comprova contato realizado; você confirma cada conclusão manualmente.</p>
 </section>;
}
