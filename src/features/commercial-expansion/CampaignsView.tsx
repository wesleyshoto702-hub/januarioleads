import { useMemo,useState } from "react";
import { Archive,Check,FolderKanban,Plus,Search,Target,Trash2,Users,Download } from "lucide-react";
import { PageHeader } from "../../components/app-shell/PageHeader";
import { useConfirmAction } from "../../components/app-shell/ConfirmActionProvider";
import type { PersistedLead } from "../leads/remote-leads";
import { exportRecords,freshRecord,loadCommercial,saveCommercial,nonemptyText } from "./store";
import { campaignCounts,isCampaign,type Campaign } from "./campaigns";

export function CampaignsView({leads,onOpenLead}:{
  leads:PersistedLead[];onOpenLead:(lead:PersistedLead)=>void;
}){
  const confirmAction=useConfirmAction();
  const [items,setItems]=useState<Campaign[]>(()=>loadCommercial("campaigns",isCampaign,100));
  const [active,setActive]=useState("");
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [target,setTarget]=useState(20);
  const [query,setQuery]=useState("");
  const [feedback,setFeedback]=useState("");
  const [error,setError]=useState("");
  const [showArchived,setShowArchived]=useState(false);
  const selected=items.find(x=>x.id===active)??null;
  const activeCampaigns=items.filter(x=>!x.archived);
  const displayed=items.filter(x=>showArchived||!x.archived);
  const filteredLeads=useMemo(()=>leads.filter(l=>
    [l.company,l.segment,l.city??"",l.state??""].some(v=>v.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")))).slice(0,300),[leads,query]);
  function commit(next:Campaign[],message:string) {
    try{saveCommercial("campaigns",next,100);setItems(next);setError("");setFeedback(message);return true;}
    catch(e){setError(e instanceof Error?e.message:"Erro ao salvar campanha.");setFeedback("");return false;}
  }
  function create(){
    const clean=nonemptyText(name,100);
    if(!clean){setError("Informe o nome da campanha.");return;}
    const entry:Campaign={...freshRecord(),name:clean,description:nonemptyText(description,800),
      target:Math.min(10000,Math.max(1,Math.trunc(target)||1)),leadIds:[],archived:false};
    if(commit([entry,...items],"Campanha criada.")){setActive(entry.id);setName("");setDescription("");setTarget(20);}
  }
  function update(c:Campaign,patch:Partial<Campaign>,message="Campanha atualizada."){
    commit(items.map(x=>x.id===c.id?{...x,...patch,updatedAt:new Date().toISOString()}:x),message);
  }
  function toggleLead(id:string){
    if(!selected)return;
    const current=new Set(selected.leadIds);
    if(current.has(id))current.delete(id);else current.add(id);
    if(current.size>300){setError("Limite de 300 leads por campanha.");return;}
    update(selected,{leadIds:[...current]},"Participantes atualizados.");
  }
  async function remove(c:Campaign){
    if(!(await confirmAction({
      title:"Excluir campanha?",
      subject:c.name,
      description:"A campanha e a seleção de participantes serão apagadas. Os leads continuarão no CRM.",
      confirmLabel:"Excluir campanha",
    })))return;
    if(commit(items.filter(x=>x.id!==c.id),"Campanha excluída. Seus leads foram preservados."))setActive("");
  }
  const currentCounts=selected?campaignCounts(selected,leads):null;
  return <section className="saas-page cx-page">
    <PageHeader eyebrow="GESTÃO COMERCIAL" title="Campanhas de prospecção"
      description="Organize empresas em campanhas por objetivo e acompanhe o progresso utilizando os status reais do seu CRM."
      actions={<button className="cx-button" type="button" disabled={!items.length} onClick={()=>exportRecords("campanhas",items)}><Download size={16}/> Backup JSON</button>}/>
    <div className="cx-metrics">
      <div><small>Campanhas ativas</small><strong>{activeCampaigns.length}</strong></div>
      <div><small>Leads no CRM</small><strong>{leads.length}</strong></div>
      <div><small>Empresas em campanhas</small><strong>{new Set(activeCampaigns.flatMap(c=>c.leadIds)).size}</strong></div>
    </div>
    <div className="cx-grid">
      <div className="cx-card">
        <h2><FolderKanban size={20}/> Minhas campanhas</h2>
        <form onSubmit={e=>{e.preventDefault();create();}} className="cx-form">
          <label>Nome da campanha<input maxLength={100} value={name} onChange={e=>setName(e.target.value)}
            placeholder="Ex.: Barbearias de Lavras" required/></label>
          <label>Objetivo<textarea rows={2} maxLength={800} value={description} onChange={e=>setDescription(e.target.value)}
            placeholder="O que você pretende alcançar?"/></label>
          <label>Meta de empresas<input type="number" min={1} max={10000} value={target} onChange={e=>setTarget(Number(e.target.value))}/></label>
          <button className="cx-button primary" type="submit"><Plus size={16}/> Criar campanha</button>
        </form>
        <label className="cx-checkbox"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Mostrar arquivadas</label>
        <div className="cx-list">
          {displayed.map(c=><button key={c.id} type="button" onClick={()=>{setActive(c.id);setQuery("");}}
            className={"cx-list-entry"+(active===c.id?" active":"")}>
            <strong>{c.name}</strong><span>{c.leadIds.length} participantes · {c.archived?"Arquivada":"Ativa"}</span>
          </button>)}
          {!displayed.length&&<p className="cx-muted">Nenhuma campanha cadastrada. Crie uma para começar.</p>}
        </div>
      </div>
      <div className="cx-card">
        {selected&&currentCounts?<>
          <div className="cx-split"><div><p className="cx-eyebrow">CAMPANHA SELECIONADA</p><h2>{selected.name}</h2>
            <p className="cx-muted">{selected.description||"Sem descrição"}</p></div>
            <div className="cx-inline-actions">
              <button className="cx-button" type="button" onClick={()=>update(selected,{archived:!selected.archived})}><Archive size={15}/>{selected.archived?"Reativar":"Arquivar"}</button>
              <button className="cx-button danger" type="button" onClick={()=>void remove(selected)}><Trash2 size={15}/>Excluir</button>
            </div></div>
          <div className="cx-kpis">
            <div><small>Atribuídos</small><strong>{currentCounts.assigned}</strong></div>
            <div><small>Abordados*</small><strong>{currentCounts.contacted}</strong></div>
            <div><small>Aceitos</small><strong>{currentCounts.accepted}</strong></div>
            <div><small>Recusados</small><strong>{currentCounts.rejected}</strong></div>
          </div>
          <p className="cx-muted"><Target size={14}/> Meta: {selected.target} empresas · {Math.min(100,Math.round(currentCounts.assigned/selected.target*100))}% cadastradas na campanha</p>
          <div className="cx-track"><div style={{width:Math.min(100,currentCounts.assigned/selected.target*100)+"%"}}/></div>
          <p className="cx-helper">*Abordados = leads cujo status atual deixou de ser “Enviar mensagem”; não comprova que uma mensagem foi efetivamente enviada.</p>
          <label className="cx-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Buscar leads do seu CRM" aria-label="Pesquisar empresas para adicionar à campanha"/></label>
          <div className="cx-lead-list">{filteredLeads.map(lead=><div className="cx-lead-row" key={lead.id}>
            <label><input type="checkbox" checked={selected.leadIds.includes(lead.id)}
              disabled={selected.archived} onChange={()=>toggleLead(lead.id)}/>
              <span><strong>{lead.company}</strong><small>{[lead.segment,lead.city,lead.state].filter(Boolean).join(" · ")}</small></span></label>
            <button type="button" className="cx-link" onClick={()=>onOpenLead(lead)}>Ver lead</button>
          </div>)}
          {!filteredLeads.length&&<p className="cx-muted">Nenhum lead correspondente no CRM.</p>}</div>
          {leads.length>300&&<p className="cx-helper">Mostrando até 300 empresas. Refine a busca para encontrar outras.</p>}
        </>:<div className="cx-blank"><Users size={34}/><h2>Organize sua prospecção</h2>
          <p>Crie ou selecione uma campanha para vincular seus leads existentes e acompanhar resultados reais.</p></div>}
      </div>
    </div>
    {error&&<p className="cx-alert" role="alert">{error}</p>}
    {feedback&&<p className="cx-notice" role="status"><Check size={16}/>{feedback}</p>}
    <p className="cx-footnote">Os dados das campanhas ficam no navegador desta conta nesta versão pessoal. O backup JSON preserva os registros; nada é enviado automaticamente aos leads.</p>
  </section>;
}
