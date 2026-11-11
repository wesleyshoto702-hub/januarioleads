import {useMemo,useState} from "react";
import {ChartNoAxesCombined,Check,CirclePlus,Target,Trash2} from "lucide-react";
import type {PersistedLead} from "../leads/remote-leads";
import {loadProposals} from "../proposals/proposals";
import {brazilToday,displayDate,freshRecord,loadCommercial,saveCommercial} from "./store";
import {isAgendaItem} from "./agenda";
import {isClientProject} from "./projects";
import {countInPeriod,goalPeriodRange,isCommercialGoal,GOAL_METRICS,type CommercialGoal,type GoalMetric,type GoalPeriod} from "./goals";
export function GoalsPanel({leads}:{leads:PersistedLead[]}){
 const [goals,setGoals]=useState<CommercialGoal[]>(()=>loadCommercial("goals",isCommercialGoal,20));
 const [proposals]=useState(loadProposals);
 const [appointments]=useState(()=>loadCommercial("agenda",isAgendaItem,300));
 const [projects]=useState(()=>loadCommercial("projects",isClientProject,150));
 const [metric,setMetric]=useState<GoalMetric>("new_leads");
 const [period,setPeriod]=useState<GoalPeriod>("week");
 const [target,setTarget]=useState(10);
 const [error,setError]=useState("");
 const [feedback,setFeedback]=useState("");
 const day=brazilToday();
 const records=useMemo(()=>({
  new_leads:leads.map(x=>x.createdAt),
  new_proposals:proposals.map(x=>x.createdAt),
  new_appointments:appointments.map(x=>x.createdAt),
  delivered_projects:projects.map(x=>x.deliveredAt),
 }),[leads,proposals,appointments,projects]);
 const sorted=useMemo(()=>[...goals].sort((a,b)=>a.metric.localeCompare(b.metric,"pt-BR")),[goals]);
 function commit(next:CommercialGoal[],msg:string){
   try{saveCommercial("goals",next,20);setGoals(next);setError("");setFeedback(msg);}
   catch(e){setError(e instanceof Error?e.message:"Erro ao salvar metas.");setFeedback("");}
 }
 function add(){
   if(!Number.isInteger(target)||target<1||target>100000){setError("Defina uma meta inteira entre 1 e 100.000.");return;}
   const previous=goals.find(g=>g.metric===metric&&g.period===period);
   if(previous){
    commit(goals.map(g=>g.id===previous.id?{...g,target,updatedAt:new Date().toISOString()}:g),"Meta existente atualizada.");
   }else{
    if(goals.length>=20){setError("Limite de 20 metas.");return;}
    commit([...goals,{...freshRecord(),metric,period,target}],"Meta criada.");
   }
 }
 function current(g:CommercialGoal){return countInPeriod(records[g.metric],day,g.period);}
 return <section className="cx-goals" aria-labelledby="cx-goals-title">
   <div className="cx-goals-head">
     <div><p className="cx-goals-eyebrow">EVOLUÇÃO COMERCIAL</p>
       <h2 id="cx-goals-title"><ChartNoAxesCombined size={22}/> Metas e produtividade</h2>
       <p>Acompanhe objetivos semanais ou mensais com registros reais da sua carteira.</p>
     </div><span>{goals.length} metas configuradas</span>
   </div>
   <form className="cx-goals-form" onSubmit={e=>{e.preventDefault();add();}}>
     <label>Indicador
      <select value={metric} onChange={e=>setMetric(e.target.value as GoalMetric)}>
        {Object.entries(GOAL_METRICS).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select></label>
     <label>Período<select value={period} onChange={e=>setPeriod(e.target.value as GoalPeriod)}>
       <option value="week">Semana atual</option><option value="month">Mês atual</option>
     </select></label>
     <label>Meta<input type="number" min={1} max={100000} step={1} value={target}
       onChange={e=>setTarget(Number(e.target.value))}/></label>
     <button type="submit" className="cx-goals-add"><CirclePlus size={16}/> Salvar meta</button>
   </form>
   <div className="cx-goals-cards">
     {sorted.map(g=>{const count=current(g),ratio=Math.round(count/g.target*100),range=goalPeriodRange(day,g.period);
       return <article key={g.id} className="cx-goal-card">
        <div className="cx-goal-card-top"><small>{g.period==="week"?"META SEMANAL":"META MENSAL"}</small>
         <button type="button" aria-label={"Excluir meta "+GOAL_METRICS[g.metric]} onClick={()=>{
           if(window.confirm("Remover esta meta? Os dados reais continuam preservados."))commit(goals.filter(x=>x.id!==g.id),"Meta removida.");
         }}><Trash2 size={14}/></button></div>
        <h3>{GOAL_METRICS[g.metric]}</h3>
        <div className="cx-goal-numbers"><strong>{count}</strong><span>/ {g.target}</span></div>
        <div className="cx-goal-track"><div style={{width:Math.min(100,ratio)+"%"}}/></div>
        <div className="cx-goal-bottom"><span>{ratio}% do objetivo</span>
          <span>{displayDate(range.start)} a {displayDate(addDay(range.end,-1))}</span></div>
       </article>;
     })}
     {!sorted.length&&<div className="cx-goals-empty"><Target size={27}/>
       <strong>Defina sua primeira meta</strong><p>Escolha um indicador e o resultado desejado para acompanhar sua evolução.</p></div>}
   </div>
   {error&&<p className="cx-goals-alert" role="alert">{error}</p>}
   {feedback&&<p className="cx-goals-success" role="status"><Check size={15}/>{feedback}</p>}
   <p className="cx-goals-footer">Leads e propostas são contabilizados pela data de criação. Compromissos contam pela data de registro, não pela data agendada. Projetos contam pela data de entrega registrada. Nenhum resultado é estimado; as metas ficam neste navegador.</p>
 </section>;
}
function addDay(day:string,n:number):string{
 const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
}
