import {
  Bell, CheckCircle2, ChevronRight, Database, ExternalLink,
  Layers, LogOut, MapPinned, Palette, RefreshCw, Settings2, ShieldCheck,
  SlidersHorizontal, Smartphone, UserRound, Users, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getValidSession, signOutOtherSessions } from "../../lib/auth";
import { USE_HTTPONLY_SESSION } from "../../lib/supabase-config";
import { accountLocalStorage, isLegacyWorkspaceOwner } from "../../lib/account-storage";
import { ENV_GOOGLE_MAPS_BROWSER_KEY } from "../maps-leads/RealGoogleMap";
import type { PersistedLead } from "../leads/remote-leads";
import type { UserSettings, SettingsHomeView } from "./user-settings";

type SectionId = "account" | "security" | "preferences" | "notifications"
  | "appearance" | "privacy" | "integrations" | "admin";
type Tab = { id: SectionId; label: string; icon: LucideIcon; detail: string };
const TABS: Tab[] = [
  {id:"account",label:"Minha conta",icon:UserRound,detail:"Identidade e perfil"},
  {id:"security",label:"Segurança",icon:ShieldCheck,detail:"Sessões e acesso"},
  {id:"preferences",label:"Preferências",icon:SlidersHorizontal,detail:"Como iniciar o Workspace"},
  {id:"notifications",label:"Notificações",icon:Bell,detail:"Lembretes dentro do aplicativo"},
  {id:"appearance",label:"Aparência",icon:Palette,detail:"Conforto de visualização"},
  {id:"privacy",label:"Privacidade e dados",icon:Database,detail:"Controle das suas informações"},
  {id:"integrations",label:"Integrações",icon:Layers,detail:"Serviços conectados"},
  {id:"admin",label:"Administração",icon:Users,detail:"Gerenciamento do proprietário"},
];
const HOME_OPTIONS: {id:SettingsHomeView;label:string}[] = [
  {id:"dashboard",label:"Dashboard"},
  {id:"leads",label:"Meus Leads"},
  {id:"search",label:"Buscar Leads"},
  {id:"prospecting",label:"Informações de Prospecção"},
  {id:"opportunities",label:"Oportunidades"},
  {id:"messages",label:"Mensagens"},
  {id:"finance",label:"Financeiro"},
];

function ConfigRow({title,description,children}:{
  title:string;description:string;children:React.ReactNode
}) {
  return <div className="js-settings-row">
    <div><strong>{title}</strong><p>{description}</p></div>
    <div className="js-settings-row-control">{children}</div>
  </div>;
}
function Toggle({checked,onChange,label}:{
  checked:boolean;onChange:(value:boolean)=>void;label:string
}) {
  return <button type="button" className={"js-settings-toggle"+(checked?" is-active":"")}
    onClick={()=>onChange(!checked)} role="switch" aria-checked={checked} aria-label={label}>
    <span/>
  </button>;
}
function SectionHeading({title,description}:{
  title:string;description:string
}){
  return <div className="js-settings-section-head"><h2>{title}</h2><p>{description}</p></div>;
}

export function SettingsView({
  settings,theme,loading,loadError,onRetry,onSave,onThemeChange,
  onNavigate,onLogout,leads,
}:{
  settings:UserSettings;
  theme:"light"|"dark";
  loading:boolean;
  loadError:string;
  onRetry:()=>Promise<void>;
  onSave:(next:UserSettings)=>Promise<void>;
  onThemeChange:(value:"light"|"dark")=>void;
  onNavigate:(view:"leads"|"maps")=>void;
  onLogout:()=>Promise<void>;
  leads:PersistedLead[];
}){
  const [section,setSection]=useState<SectionId>("account");
  const [draft,setDraft]=useState<UserSettings>(settings);
  const [email,setEmail]=useState("");
  const [accountId,setAccountId]=useState("");
  const [saving,setSaving]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const owner=isLegacyWorkspaceOwner();
  useEffect(()=>setDraft(settings),[settings]);
  useEffect(()=>{
    let active=true;
    void getValidSession().then(session=>{
      if(active){setEmail(session?.user.email??"");setAccountId(session?.user.id??"");}
    });
    return ()=>{active=false};
  },[]);
  const changed=useMemo(()=>JSON.stringify(draft)!==JSON.stringify(settings),[draft,settings]);
  const initials=(draft.displayName.trim()||email.split("@")[0]||"JL").slice(0,2).toUpperCase();
  const googleMapKeyAvailable=Boolean(ENV_GOOGLE_MAPS_BROWSER_KEY ||
    accountLocalStorage.getItem("maps-personal-browser-api-key"));

  const change=(patch:Partial<UserSettings>)=>{
    setDraft(current=>({...current,...patch}));
    setNotice("");setError("");
  };
  async function save(){
    if(saving||loading||!changed)return;
    setSaving(true);setError("");setNotice("");
    try {
      await onSave(draft);
      setNotice("Alterações salvas na sua conta.");
    }catch(err){
      setError(err instanceof Error?err.message:"Não foi possível salvar as alterações.");
    }finally {setSaving(false);}
  }
  async function otherSessions(){
    if(working)return;
    if(!window.confirm("Encerrar as outras sessões da sua conta? O dispositivo atual continuará conectado."))return;
    setWorking(true);setError("");setNotice("");
    try{
      await signOutOtherSessions();
      setNotice("Outras sessões encerradas. Tokens de acesso já emitidos podem valer até expirar.");
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível encerrar outras sessões.");}
    finally{setWorking(false);}
  }
  const activeTab=TABS.find(x=>x.id===section)!;
  const Icon=activeTab.icon;

  return <section className="saas-page js-settings-page" aria-labelledby="js-settings-title">
    <header className="js-settings-hero">
      <div className="js-settings-hero-mark"><Settings2 size={23}/></div>
      <div>
        <p className="saas-page-eyebrow">PREFERÊNCIAS DO WORKSPACE</p>
        <h1 id="js-settings-title">Configurações</h1>
        <p>Gerencie sua conta e personalize sua experiência no Januário Leads.</p>
      </div>
    </header>
    {loadError&&<div className="js-settings-alert" role="alert">
      <span>{loadError}</span>
      <button type="button" disabled={loading} onClick={()=>void onRetry()}>
        <RefreshCw size={15}/> {loading?"Carregando...":"Tentar novamente"}
      </button>
    </div>}
    {notice&&<p className="js-settings-success" role="status"><CheckCircle2 size={17}/>{notice}</p>}
    {error&&<p className="js-settings-alert" role="alert">{error}</p>}
    <div className="js-settings-layout">
      <nav className="js-settings-tabs" aria-label="Categorias de configurações">
        {TABS.filter(tab=>tab.id!=="admin"||owner).map(tab=>{
          const TabIcon=tab.icon;
          return <button type="button" key={tab.id}
            className={"js-settings-tab"+(section===tab.id?" is-selected":"")}
            onClick={()=>{setSection(tab.id);setError("");setNotice("");}}
            aria-current={section===tab.id?"page":undefined}>
            <TabIcon size={18} strokeWidth={1.8}/>
            <span><strong>{tab.label}</strong><small>{tab.detail}</small></span>
            <ChevronRight size={15} className="js-settings-tab-chevron"/>
          </button>;
        })}
      </nav>
      <div className="js-settings-panel">
        <div className="js-settings-panel-heading">
          <Icon size={20}/><strong>{activeTab.label}</strong>
        </div>
        {section==="account"&&<>
          <SectionHeading title="Meu perfil" description="Dados de identificação da sua conta. Seu e-mail de acesso continua protegido pelo sistema de autenticação."/>
          <div className="js-settings-profile">
            <span className="js-settings-avatar">{initials}</span>
            <div><strong>{draft.displayName||"Sua conta"}</strong><small>{email||"Conta autenticada"}</small></div>
          </div>
          <label className="js-settings-field">
            <span>Nome de exibição</span>
            <input maxLength={80} value={draft.displayName} placeholder="Como você quer ser identificado?"
              disabled={loading} onChange={e=>change({displayName:e.target.value})}/>
          </label>
          <label className="js-settings-field">
            <span>E-mail de acesso</span>
            <input type="email" value={email} disabled readOnly/>
            <small>Alterações de e-mail e senha exigem um fluxo seguro de confirmação e não são feitas por esta tela.</small>
          </label>
          <div className="js-settings-inline-note">O nome de exibição é uma preferência do Workspace. Ele não modifica as credenciais de acesso.</div>
        </>}
        {section==="security"&&<>
          <SectionHeading title="Segurança da conta" description="Acompanhe sua sessão e mantenha o controle dos dispositivos conectados."/>
          <div className="js-settings-security-status">
            <ShieldCheck size={22}/><div><strong>Sessão autenticada</strong><span>{email||"Usuário conectado"}</span></div>
          </div>
          <ConfigRow title="Encerrar outras sessões"
            description="Revoga as sessões de outros navegadores e dispositivos. Sua sessão atual permanece ativa.">
            <button type="button" className="js-settings-button secondary" disabled={working||USE_HTTPONLY_SESSION}
              onClick={()=>void otherSessions()}><Smartphone size={16}/>{working?"Encerrando...":"Encerrar outras"}</button>
          </ConfigRow>
          {USE_HTTPONLY_SESSION&&<p className="js-settings-inline-note">O servidor de autenticação deste ambiente ainda não permite gerenciar outras sessões por aqui.</p>}
          <ConfigRow title="Sair desta conta" description="Finaliza a sessão e retorna à tela de login.">
            <button type="button" className="js-settings-button secondary"
              onClick={()=>void onLogout()}><LogOut size={16}/>Sair</button>
          </ConfigRow>
          <p className="js-settings-inline-note">A revogação de sessões pode não invalidar imediatamente tokens de acesso já emitidos.</p>
          {accountId&&<div className="js-settings-readonly"><span>Identificador da conta</span><code>{accountId}</code></div>}
        </>}
        {section==="preferences"&&<>
          <SectionHeading title="Preferências gerais" description="Configure o comportamento inicial da sua área de trabalho."/>
          <ConfigRow title="Página inicial" description="Página exibida quando você entra no Workspace.">
            <select aria-label="Página inicial após login" value={draft.homeView}
              disabled={loading} onChange={e=>change({homeView:e.target.value as SettingsHomeView})}>
              {HOME_OPTIONS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </ConfigRow>
          <ConfigRow title="Idioma" description="Idioma atual da interface.">
            <span className="js-settings-value">Português (Brasil)</span>
          </ConfigRow>
          <ConfigRow title="Formato e fuso horário" description="Referência padrão utilizada pelo sistema atualmente.">
            <span className="js-settings-value">Brasil · São Paulo (UTC−3)</span>
          </ConfigRow>
        </>}
        {section==="notifications"&&<>
          <SectionHeading title="Notificações no aplicativo" description="Escolha os avisos que aparecem ao abrir o Dashboard. Não são enviadas notificações por e-mail ou push."/>
          <ConfigRow title="Tarefas para hoje" description="Exibir um lembrete quando houver leads com ações agendadas para hoje.">
            <Toggle label="Avisos de tarefas para hoje" checked={draft.notifyDueToday}
              onChange={v=>change({notifyDueToday:v})}/>
          </ConfigRow>
          <ConfigRow title="Tarefas atrasadas" description="Exibir um lembrete de ações que passaram da data prevista.">
            <Toggle label="Avisos de tarefas atrasadas" checked={draft.notifyOverdue}
              onChange={v=>change({notifyOverdue:v})}/>
          </ConfigRow>
          <p className="js-settings-inline-note">As preferências serão aplicadas no Dashboard depois de salvar.</p>
        </>}
        {section==="appearance"&&<>
          <SectionHeading title="Aparência" description="Ajustes visuais para deixar o Workspace confortável em qualquer tamanho de tela."/>
          <ConfigRow title="Tema" description="O tema já existente continua acessível no menu lateral.">
            <div className="js-settings-segmented" aria-label="Tema do aplicativo">
              <button type="button" className={theme==="dark"?"active":""} onClick={()=>onThemeChange("dark")}>Escuro</button>
              <button type="button" className={theme==="light"?"active":""} onClick={()=>onThemeChange("light")}>Claro</button>
            </div>
          </ConfigRow>
          <ConfigRow title="Modo compacto" description="Diminui espaçamentos para mostrar mais informações na tela.">
            <Toggle checked={draft.compactMode} label="Ativar modo compacto" onChange={v=>change({compactMode:v})}/>
          </ConfigRow>
          <ConfigRow title="Reduzir animações" description="Reduz movimentos e transições no Workspace.">
            <Toggle checked={draft.reduceMotion} label="Reduzir animações" onChange={v=>change({reduceMotion:v})}/>
          </ConfigRow>
        </>}
        {section==="privacy"&&<>
          <SectionHeading title="Privacidade e dados" description="Seus leads continuam associados à sua conta, sujeitos às permissões do Supabase."/>
          <ConfigRow title="Seus contatos" description="Importar e exportar contatos próprios usando a ferramenta já disponível em Meus Leads.">
            <button type="button" className="js-settings-button secondary" onClick={()=>onNavigate("leads")}>
              <Database size={16}/>Abrir Meus Leads
            </button>
          </ConfigRow>
          <div className="js-settings-insight"><strong>{leads.length} leads no Workspace</strong><span>Esta contagem se refere apenas aos registros carregados na sua sessão.</span></div>
          <p className="js-settings-inline-note">A exportação existente exclui dados obtidos por provedores externos quando seu armazenamento ou redistribuição é restrito. A exclusão de conta e dados requer um fluxo de confirmação separado antes de ser disponibilizada.</p>
        </>}
        {section==="integrations"&&<>
          <SectionHeading title="Integrações" description="Visão geral dos serviços utilizados. Credenciais privadas não são exibidas ou editadas aqui."/>
          <div className="js-settings-integration"><Database size={22}/>
            <div><strong>Supabase</strong><small>Autenticação e sincronização dos dados do CRM</small></div>
            <span className="js-settings-pill">Em uso</span>
          </div>
          <div className="js-settings-integration"><MapPinned size={22}/>
            <div><strong>Google Maps</strong><small>Mapa geográfico e visualização de empresas</small></div>
            <span className="js-settings-pill">{googleMapKeyAvailable?"Chave no ambiente":"Sem chave neste navegador"}</span>
          </div>
          <div className="js-settings-integration"><Layers size={22}/>
            <div><strong>Fontes de estabelecimentos</strong><small>Geoapify e Google Places são gerenciados pelo servidor e pelos limites de uso.</small></div>
            <span className="js-settings-pill">Automático</span>
          </div>
          {owner&&<button type="button" className="js-settings-button secondary"
            onClick={()=>onNavigate("maps")}><MapPinned size={16}/>Abrir Buscar via Maps</button>}
          <p className="js-settings-inline-note">A presença de uma integração não comprova disponibilidade, saldo ou faturamento; falhas são informadas durante as consultas.</p>
        </>}
        {section==="admin"&&owner&&<>
          <SectionHeading title="Administração" description="Ferramentas de gestão disponíveis somente para a conta original."/>
          <div className="js-settings-admin-stat"><Users size={21}/><div>
            <strong>{leads.length} leads na sua carteira</strong>
            <small>Seus registros carregados no CRM</small>
          </div></div>
          <div className="js-settings-admin-links">
            <a href="https://supabase.com/dashboard/project/czkazbianiflhldenhcj" target="_blank" rel="noopener noreferrer">Gerenciar Supabase <ExternalLink size={15}/></a>
            <a href="https://github.com/wesleyshoto702-hub/januarioleads" target="_blank" rel="noopener noreferrer">Repositório GitHub <ExternalLink size={15}/></a>
            <a href="https://lovable.dev/projects/cfc45a7b-7f48-4b0a-82fc-daf876974a6f" target="_blank" rel="noopener noreferrer">Editor Lovable <ExternalLink size={15}/></a>
          </div>
          <p className="js-settings-inline-note">Controles públicos de usuários, planos, cobrança e cotas devem ser implementados separadamente com autorização no servidor antes do lançamento.</p>
        </>}
        {(["account","preferences","notifications","appearance"] as SectionId[]).includes(section)&&
          <div className="js-settings-savebar">
            <span>{changed?"Alterações ainda não salvas":"Suas preferências estão atualizadas"}</span>
            <button type="button" className="js-settings-button primary"
              onClick={()=>void save()} disabled={!changed||loading||saving||!!loadError}>
              {saving?"Salvando...":"Salvar alterações"}
            </button>
          </div>}
      </div>
    </div>
  </section>;
}

/** Small, on-screen-only reminders; no email/push scheduler is implied. */
export function SettingsReminders({settings,leads,onShow}:{
  settings:UserSettings;leads:PersistedLead[];
  onShow:(type:"today"|"overdue")=>void;
}){
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",
    year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const scheduled=leads.filter(lead=>typeof lead.nextActionDate==="string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(lead.nextActionDate));
  const due=scheduled.filter(x=>x.nextActionDate===today).length;
  const late=scheduled.filter(x=>x.nextActionDate! < today).length;
  if((!settings.notifyDueToday||due===0)&&(!settings.notifyOverdue||late===0))return null;
  return <div className="js-settings-reminders" role="status">
    <Bell size={18}/>
    <div><strong>Acompanhamentos pendentes</strong><p>Confira as próximas ações dos seus leads.</p></div>
    <div className="js-settings-reminder-buttons">
      {settings.notifyDueToday&&due>0&&<button type="button" onClick={()=>onShow("today")}>{due} para hoje</button>}
      {settings.notifyOverdue&&late>0&&<button type="button" onClick={()=>onShow("overdue")}>{late} atrasado{late===1?"":"s"}</button>}
    </div>
  </div>;
}
