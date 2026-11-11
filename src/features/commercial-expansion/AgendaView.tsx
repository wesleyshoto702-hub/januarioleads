import {useMemo,useState} from "react";
import {CalendarDays,Check,CheckCircle2,ChevronLeft,ChevronRight,Clock3,Plus,Trash2} from "lucide-react";
import {PageHeader} from "../../components/app-shell/PageHeader";
import {useConfirmAction} from "../../components/app-shell/ConfirmActionProvider";
import type {PersistedLead} from "../leads/remote-leads";
import {brazilToday,displayDate,freshRecord,loadCommercial,saveCommercial} from "./store";
import {isAgendaItem,calendarVisibleDays,type AgendaItem,type AgendaKind,type CalendarMode} from "./agenda";
import {addDateDays,isEnrollment,isSequence,nextSequenceStep} from "./sequences";
type ReadOnlyEvent={id:string;date:string;time:string;title:string;description:string;leadId:string|null;source:"crm"|"sequence"};
const KINDS:Record<AgendaKind,string>={call:"Ligação / contato",meeting:"Reunião",task:"Tarefa"};
const today=brazilToday();
function longMonth(date:string):string{
 return new Date(date+"T12:00:00Z").toLocaleDateString("pt-BR",{timeZone:"UTC",month:"long",year:"numeric"});
}
export function AgendaView({leads,onOpenLead}:{
 leads:PersistedLead[];onOpenLead:(lead:PersistedLead)=>void;
}){
 const confirmAction=useConfirmAction();
 const [items,setItems]=useState<AgendaItem[]>(()=>loadCommercial("agenda",isAgendaItem,300));
 const [sequences]=useState(()=>loadCommercial("sequences",isSequence,60));
 const [enrollments]=useState(()=>loadCommercial("enrollments",isEnrollment,300));
 const [mode,setMode]=useState<CalendarMode>("month");
 const [anchor,setAnchor]=useState(today);
 const [selectedDate,setSelectedDate]=useState(today);
 const [title,setTitle]=useState("");
 const [time,setTime]=useState("09:00");
 const [kind,setKind]=useState<AgendaKind>("call");
 const [leadId,setLeadId]=useState("");
 const [notes,setNotes]=useState("");
 const [error,setError]=useState("");
 const [feedback,setFeedback]=useState("");
 const knownLeads=useMemo(()=>new Map(leads.map(l=>[l.id,l])),[leads]);
 const calculated=useMemo<ReadOnlyEvent[]>(()=>{
   const result:ReadOnlyEvent[]=[];
   for(const l of leads)if(l.nextActionDate&&/^\d{4}-\d{2}-\d{2}$/.test(l.nextActionDate)){
     result.push({id:"crm:"+l.id,date:l.nextActionDate,time:"",title:l.nextActionType??"Próximo contato",
       description:"Acompanhamento registrado no CRM",leadId:l.id,source:"crm"});
   }
   for(const e of enrollments){
     if(e.paused)continue;
     const plan=sequences.find(p=>p.id===e.sequenceId);
     if(!plan)continue;
     const next=nextSequenceStep(plan,e);
     if(next)result.push({id:"seq:"+e.id,date:next.due,time:"",title:next.step.title,
       description:"Sequência: "+plan.name,leadId:e.leadId,source:"sequence"});
   }
   return result;
 },[leads,enrollments,sequences]);
 const days=useMemo(()=>calendarVisibleDays(anchor,mode),[anchor,mode]);
 const dayEntries=useMemo(()=>[
   ...items.filter(x=>x.date===selectedDate).map(x=>({id:x.id,date:x.date,time:x.time,
     title:x.title,description:KINDS[x.kind]+(x.notes?" · "+x.notes:""),leadId:x.leadId,source:"personal" as const,done:x.done})),
   ...calculated.filter(x=>x.date===selectedDate).map(x=>({...x,done:false})),
 ].sort((a,b)=>a.time.localeCompare(b.time)),[items,calculated,selectedDate]);
 const countIn= (date:string)=>items.filter(x=>x.date===date&&!x.done).length+
   calculated.filter(x=>x.date===date).length;
 const remaining=items.filter(x=>!x.done).length;
 function commit(next:AgendaItem[],msg:string){
   try{saveCommercial("agenda",next,300);setItems(next);setError("");setFeedback(msg);return true;}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar.");setFeedback("");return false;}
 }
 function create(){
   if(!title.trim()){setError("Informe o título do compromisso.");return;}
   const entry:AgendaItem={...freshRecord(),title:title.trim().slice(0,120),date:selectedDate,
     time,kind,leadId:leadId||null,notes:notes.trim().slice(0,1200),done:false};
   if(commit([entry,...items],"Compromisso salvo.")){setTitle("");setNotes("");setLeadId("");}
 }
 function nextPeriod(offset:number){
   let next:string;
   if(mode==="day")next=addDateDays(anchor,offset);
   else if(mode==="week")next=addDateDays(anchor,offset*7);
   else {
     const d=new Date(anchor.slice(0,7)+"-01T12:00:00Z");
     d.setUTCMonth(d.getUTCMonth()+offset);
     next=d.toISOString().slice(0,10);
   }
   setAnchor(next);setSelectedDate(next);
 }
 return <section className="saas-page cx-page">
  <PageHeader eyebrow="ACOMPANHAMENTO COMERCIAL" title="Agenda comercial"
    description="Visualize compromissos, próximos contatos do CRM e etapas pendentes das sequências em um único calendário."/>
  <div className="cx-metrics"><div><small>Compromissos pendentes</small><strong>{remaining}</strong></div>
    <div><small>Próximas ações do CRM</small><strong>{calculated.filter(x=>x.source==="crm").length}</strong></div>
    <div><small>Etapas de sequências pendentes</small><strong>{calculated.filter(x=>x.source==="sequence").length}</strong></div></div>
  <div className="cx-grid cx-agenda-layout">
   <div className="cx-card"><div className="cx-calendar-toolbar">
    <h2><CalendarDays size={19}/>{mode==="month"?longMonth(anchor):mode==="week"?"Semana de "+displayDate(days[0]??anchor):displayDate(anchor)}</h2>
    <div className="cx-inline-actions">
      <button type="button" className="cx-button" onClick={()=>{setAnchor(today);setSelectedDate(today);}}>Hoje</button>
      <button type="button" className="cx-button" aria-label="Período anterior" onClick={()=>nextPeriod(-1)}><ChevronLeft size={16}/></button>
      <button type="button" className="cx-button" aria-label="Próximo período" onClick={()=>nextPeriod(1)}><ChevronRight size={16}/></button>
    </div></div>
    <div className="cx-mode-tabs" role="group" aria-label="Modo de calendário">
      {(["month","week","day"] as CalendarMode[]).map(m=><button key={m} type="button"
        aria-pressed={mode===m} className={mode===m?"active":""} onClick={()=>{setMode(m);setAnchor(selectedDate);}}>
        {m==="month"?"Mês":m==="week"?"Semana":"Dia"}</button>)}
    </div>
    <div className="cx-day-head">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d=><span key={d}>{d}</span>)}</div>
    <div className={"cx-calendar-grid mode-"+mode}>
      {mode==="day"?<button type="button" className="cx-day active" onClick={()=>setSelectedDate(anchor)}>
        <strong>{anchor.slice(8)}</strong><span>{countIn(anchor)} atividades</span></button>
        :days.map(d=><button key={d} type="button" onClick={()=>setSelectedDate(d)}
          aria-pressed={selectedDate===d}
          className={"cx-day"+(d.slice(0,7)!==anchor.slice(0,7)&&mode==="month"?" offmonth":"")+
            (selectedDate===d?" active":"")+(d===today?" is-today":"")}>
          <strong>{Number(d.slice(8))}</strong>{countIn(d)>0&&<span>{countIn(d)}</span>}
        </button>)}
    </div>
    <p className="cx-helper">Clique em uma data para consultar tarefas e registrar um compromisso. A agenda não envia lembretes externos.</p>
   </div>
   <div className="cx-card">
    <h2><Clock3 size={19}/> {displayDate(selectedDate)} · Atividades</h2>
    <div className="cx-activity-list">{dayEntries.map(entry=><div className={"cx-activity"+(entry.done?" done":"")} key={entry.source+entry.id}>
      <div><strong>{entry.title}</strong>
        <p>{entry.time?entry.time+" · ":""}{entry.description}</p>
        {entry.source!=="personal"&&<small>{entry.source==="crm"?"Origem: Meus Leads":"Origem: Sequências"}</small>}
      </div>
      <div className="cx-inline-actions">
        {entry.leadId&&knownLeads.has(entry.leadId)&&<button type="button" className="cx-link"
          onClick={()=>onOpenLead(knownLeads.get(entry.leadId!)!)}>Ver lead</button>}
        {entry.source==="personal"&&<>
          <button type="button" className="cx-button" onClick={()=>commit(items.map(x=>x.id===entry.id?{
            ...x,done:!x.done,updatedAt:new Date().toISOString()}:x),"Atividade atualizada.")}>
            <CheckCircle2 size={14}/>{entry.done?"Reabrir":"Concluir"}</button>
          <button type="button" className="cx-button danger" onClick={async()=>{
            if(await confirmAction({
              title:"Excluir compromisso?",
              subject:entry.title,
              description:"Este compromisso será removido da agenda. O lead vinculado, se houver, será preservado.",
              confirmLabel:"Excluir compromisso",
            }))commit(items.filter(x=>x.id!==entry.id),"Compromisso excluído.");
          }}><Trash2 size={14}/></button>
        </>}
      </div>
    </div>)}
    {!dayEntries.length&&<p className="cx-muted">Sem compromissos ou próximos contatos para esta data.</p>}</div>
    <div className="cx-section"><h2><Plus size={17}/> Novo compromisso</h2>
      <form className="cx-form" onSubmit={e=>{e.preventDefault();create();}}>
       <label>Descrição<input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}
         placeholder="Ex.: Apresentar proposta" required/></label>
       <div className="cx-form-cols">
         <label>Data<input type="date" value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);setAnchor(e.target.value);}} required/></label>
         <label>Horário<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
       </div>
       <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as AgendaKind)}>
         <option value="call">Ligação / contato</option><option value="meeting">Reunião</option><option value="task">Tarefa</option></select></label>
       <label>Vincular lead<select value={leadId} onChange={e=>setLeadId(e.target.value)}>
         <option value="">Sem lead vinculado</option>
         {leads.map(l=><option key={l.id} value={l.id}>{l.company}</option>)}</select></label>
       <label>Observações<textarea rows={2} maxLength={1200} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
       <button className="cx-button primary" type="submit"><Plus size={15}/> Salvar compromisso</button>
      </form>
    </div>
   </div>
  </div>
  {error&&<p className="cx-alert" role="alert">{error}</p>}
  {feedback&&<p className="cx-notice" role="status"><Check size={16}/>{feedback}</p>}
  <p className="cx-footnote">Compromissos próprios ficam neste navegador. Atividades originadas do CRM e das sequências são exibidas somente para consulta; conclua-as nas áreas de origem.</p>
 </section>;
}
