import {useMemo,useState} from "react";
import {MessageSquareWarning} from "lucide-react";
import {loadCommercial} from "./store";
import {isObjection,summarizeObjections} from "./objections";
export function ObjectionsSummary({leadIds}:{leadIds:readonly string[]}){
 const [records]=useState(()=>loadCommercial("objections",isObjection,500));
 const allowed=useMemo(()=>new Set(leadIds),[leadIds]);
 const counts=useMemo(()=>summarizeObjections(records,allowed),[records,allowed]);
 const total=counts.reduce((sum,x)=>sum+x.count,0);
 return <section className="cx-objection-summary" aria-label="Principais objeções da carteira">
  <div><MessageSquareWarning size={20}/><div><h2>Objeções comerciais registradas</h2>
   <p>Motivos de recusa informados manualmente nas fichas de leads selecionados.</p></div></div>
  <strong className="cx-objection-total">{total} registros</strong>
  <div className="cx-objection-bars">{counts.map(x=><div className="cx-objection-bar" key={x.reason}>
   <span>{x.label}</span><div className="cx-track"><div style={{width:total?100*x.count/total+"%":"0%"}}/></div>
   <strong>{x.count}</strong>
  </div>)}</div>
  <small>Contagem de registros, não de empresas únicas. As estatísticas não são estimativas automáticas.</small>
 </section>;
}
