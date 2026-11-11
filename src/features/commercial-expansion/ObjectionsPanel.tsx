import {useState} from "react";
import {Check,MessageSquareWarning,Plus,RotateCcw,Trash2} from "lucide-react";
import {brazilToday,displayDate,freshRecord,loadCommercial,saveCommercial} from "./store";
import {isObjection,OBJECTION_REASONS,type Objection,type ObjectionReason} from "./objections";
const KEY="objections";
export function ObjectionsPanel({leadId}: {leadId:string}){
 const [records,setRecords]=useState<Objection[]>(()=>loadCommercial(KEY,isObjection,500));
 const [reason,setReason]=useState<ObjectionReason>("price");
 const [details,setDetails]=useState("");
 const [revisitOn,setRevisitOn]=useState("");
 const [error,setError]=useState("");
 const [feedback,setFeedback]=useState("");
 const items=records.filter(x=>x.leadId===leadId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 function commit(next:Objection[],message:string){
  try{saveCommercial(KEY,next,500);setRecords(next);setFeedback(message);setError("");}
  catch(e){setError(e instanceof Error?e.message:"Erro ao salvar.");setFeedback("");}
 }
 function add(){
  const clean=details.trim();
  if(!clean){setError("Descreva a resposta ou objeção observada.");return;}
  const row:Objection={...freshRecord(),leadId,reason,details:clean.slice(0,2000),revisitOn,resolved:false};
  commit([row,...records],"Objeção registrada neste lead.");setDetails("");setRevisitOn("");
 }
 return <section className="detail-section cx-objection" aria-labelledby="cx-objection-heading">
  <h3 id="cx-objection-heading"><MessageSquareWarning size={17}/> Histórico de objeções</h3>
  <p>Registre motivos reais de recusa e planeje quando retomar contato. Não altera o status do CRM.</p>
  <form className="cx-objection-form" onSubmit={e=>{e.preventDefault();add();}}>
   <label>Motivo<select value={reason} onChange={e=>setReason(e.target.value as ObjectionReason)}>
    {Object.entries(OBJECTION_REASONS).map(([key,label])=><option value={key} key={key}>{label}</option>)}
   </select></label>
   <label>Detalhes da conversa<textarea rows={2} required value={details} maxLength={2000}
     onChange={e=>setDetails(e.target.value)} placeholder="Ex.: Cliente vai avaliar orçamento após o próximo mês."/></label>
   <label>Retomar em (opcional)<input type="date" value={revisitOn} onChange={e=>setRevisitOn(e.target.value)}/></label>
   <button className="cx-objection-save" type="submit"><Plus size={15}/> Registrar objeção</button>
  </form>
  <div className="cx-objection-history">{items.map(o=><article key={o.id} className={o.resolved?"resolved":""}>
    <div><strong>{OBJECTION_REASONS[o.reason]}</strong>
      <small>{displayDate(o.createdAt)}{o.revisitOn?" · Retomar: "+displayDate(o.revisitOn):""}</small>
      <p>{o.details}</p></div>
    <div className="cx-objection-actions">
      <button type="button" onClick={()=>commit(records.map(x=>x.id===o.id?{...x,resolved:!x.resolved,updatedAt:new Date().toISOString()}:x),"Situação atualizada.")}>
       {o.resolved?<RotateCcw size={14}/>:<Check size={14}/>} {o.resolved?"Reabrir":"Resolvida"}</button>
      <button type="button" onClick={()=>{
       if(window.confirm("Excluir este registro de objeção?"))commit(records.filter(x=>x.id!==o.id),"Objeção excluída.");
      }}><Trash2 size={14}/></button>
    </div>
  </article>)}
  {!items.length&&<p>Este lead ainda não tem objeções registradas.</p>}</div>
  {error&&<p role="alert" className="cx-objection-error">{error}</p>}
  {feedback&&<p role="status" className="cx-objection-success">{feedback}</p>}
  <small>Histórico guardado no navegador desta conta; prazos de retorno não são enviados automaticamente à agenda do servidor.</small>
 </section>;
}
