import {
  Bell, CheckCircle2, ChevronRight, Database,
  KeyRound, LogOut, MapPinned, Palette, RefreshCw, Settings2, ShieldCheck,
  SlidersHorizontal, Smartphone, UserRound, Users, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getValidSession, signOutOtherSessions } from "../../lib/auth";
import { useConfirmAction } from "../../components/app-shell/ConfirmActionProvider";
import { USE_HTTPONLY_SESSION } from "../../lib/supabase-config";
import { isLegacyWorkspaceOwner } from "../../lib/account-storage";
import type { PersistedLead } from "../leads/remote-leads";
import {
  browserGoogleMapsKeySource,
  clearBrowserGoogleMapsKey,
  isValidBrowserGoogleMapsKey,
  saveBrowserGoogleMapsKey,
  type BrowserMapsKeySource,
} from "../maps-leads/browser-map-key";
import type { AccentColor, UserSettings, SettingsHomeView } from "./user-settings";

type SectionId = "account" | "security" | "preferences" | "notifications"
  | "appearance" | "privacy" | "admin";
type Tab = { id: SectionId; label: string; icon: LucideIcon; detail: string };
const TABS: Tab[] = [
  {id:"account",label:"Minha conta",icon:UserRound,detail:"Identidade e perfil"},
  {id:"security",label:"Segurança",icon:ShieldCheck,detail:"Sessões e acesso"},
  {id:"preferences",label:"Preferências",icon:SlidersHorizontal,detail:"Como iniciar o Workspace"},
  {id:"notifications",label:"Notificações",icon:Bell,detail:"Lembretes dentro do aplicativo"},
  {id:"appearance",label:"Aparência",icon:Palette,detail:"Conforto de visualização"},
  {id:"privacy",label:"Privacidade e dados",icon:Database,detail:"Controle das suas informações"},
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
const ACCENT_OPTIONS: Array<{ value:AccentColor;label:string }> = [
  {value:"green",label:"Verde"},
  {value:"yellow",label:"Amarelo"},
  {value:"blue",label:"Azul"},
  {value:"red",label:"Vermelho"},
  {value:"white",label:"Branco"},
  {value:"black",label:"Preto grafite"},
];

function ConfigRow({title,description,children}:{
  title:string;description:string;children:ReactNode
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
  settings,loading,loadError,onRetry,onSave,
  onNavigate,onLogout,leads,
}:{
  settings:UserSettings;
  loading:boolean;
  loadError:string;
  onRetry:()=>Promise<void>;
  onSave:(next:UserSettings)=>Promise<void>;
  onNavigate:(view:"leads"|"maps")=>void;
  onLogout:()=>Promise<void>;
  leads:PersistedLead[];
}){
  const confirmAction=useConfirmAction();
  const [section,setSection]=useState<SectionId>("account");
  const [draft,setDraft]=useState<UserSettings>(settings);
  const [email,setEmail]=useState("");
  const [accountId,setAccountId]=useState("");
  const [saving,setSaving]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [browserKeyDraft,setBrowserKeyDraft]=useState("");
  const [browserKeySource,setBrowserKeySource]=useState<BrowserMapsKeySource>(browserGoogleMapsKeySource);
  const [browserKeyError,setBrowserKeyError]=useState("");
  const [browserKeyNotice,setBrowserKeyNotice]=useState("");
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
    if(!(await confirmAction({
      title:"Encerrar outras sessões?",
      description:"Os outros dispositivos serão desconectados. A sessão deste dispositivo continuará ativa. Tokens já emitidos podem permanecer válidos até expirarem.",
      confirmLabel:"Encerrar sessões",
      variant:"warning",
    })))return;
    setWorking(true);setError("");setNotice("");
    try{
      await signOutOtherSessions();
      setNotice("Outras sessões encerradas. Tokens de acesso já emitidos podem valer até expirar.");
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível encerrar outras sessões.");}
    finally{setWorking(false);}
  }
  function storeMapKey(){
    setBrowserKeyError("");
    setBrowserKeyNotice("");
    try {
      saveBrowserGoogleMapsKey(browserKeyDraft);
      setBrowserKeyDraft("");
      setBrowserKeySource(browserGoogleMapsKeySource());
      setBrowserKeyNotice("Chave salva neste navegador. Abra Buscar via Maps para testar a conexão.");
    } catch (reason) {
      setBrowserKeyError(reason instanceof Error ? reason.message : "Não foi possível salvar a chave.");
    }
  }
  async function removeMapKey(){
    if(!(await confirmAction({
      title:"Remover chave local do Maps?",
      description:"A chave pública do Google Maps será removida deste navegador. Se houver uma chave configurada no site, ela continuará disponível.",
      confirmLabel:"Remover chave",
    })))return;
    setBrowserKeyError("");
    setBrowserKeyNotice("");
    try {
      clearBrowserGoogleMapsKey();
      setBrowserKeySource(browserGoogleMapsKeySource());
      setBrowserKeyDraft("");
      setBrowserKeyNotice("Chave local removida. Se houver uma chave configurada no site, ela continuará disponível.");
    } catch(reason){
      setBrowserKeyError(reason instanceof Error?reason.message:"Não foi possível remover a chave.");
    }
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
          <div className="js-settings-color-section">
            <h3>Cor de destaque</h3>
            <p>O tema do Januário Leads permanece escuro. Escolha a cor dos botões, indicadores, ícones e elementos de destaque em todo o Workspace.</p>
            <div className="js-settings-color-options" role="group" aria-label="Cor de destaque do Workspace">
              {ACCENT_OPTIONS.map(option=><button type="button" key={option.value}
                className={"js-settings-color-choice is-"+option.value+(draft.accentColor===option.value?" is-selected":"")}
                disabled={loading} aria-pressed={draft.accentColor===option.value}
                aria-label={"Usar cor "+option.label}
                onClick={()=>change({accentColor:option.value})}>
                <span className="js-settings-color-swatch" aria-hidden="true"/>
                <span>{option.label}</span>
                {draft.accentColor===option.value&&<CheckCircle2 size={15} aria-hidden="true"/>}
              </button>)}
            </div>
            <small>A cor será aplicada após salvar. Fundos, cartões e textos continuam no modo escuro para manter a leitura.</small>
          </div>
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
        {section==="admin"&&owner&&<>
          <SectionHeading title="Administração" description="Ferramentas de gestão disponíveis somente para a conta original."/>
          <div className="js-settings-admin-stat"><Users size={21}/><div>
            <strong>{leads.length} leads na sua carteira</strong>
            <small>Seus registros carregados no CRM</small>
          </div></div>
          <div className="js-settings-map-config">
            <div className="js-settings-map-header">
              <MapPinned size={22} aria-hidden="true"/>
              <div>
                <strong>Mapa interativo</strong>
                <p>Recupere a exibição do Google Maps neste dispositivo.</p>
              </div>
            </div>
            <div className="js-settings-map-status" role="status">
              <span className="js-settings-status-dot" data-configured={browserKeySource!=="missing"}/>
              {browserKeySource==="browser"
                ? "Chave pública salva neste navegador (ainda não verificada)"
                : browserKeySource==="site"
                ? "Chave pública encontrada na configuração do site"
                : "Nenhuma chave pública disponível neste navegador"}
            </div>
            <form className="js-settings-map-form" onSubmit={event=>{event.preventDefault();storeMapKey();}}>
              <label htmlFor="js-settings-browser-maps-key">
                <KeyRound size={15} aria-hidden="true"/> Chave pública da Google Maps JavaScript API
              </label>
              <input id="js-settings-browser-maps-key" type="password" autoComplete="off"
                spellCheck={false} placeholder="AIza..." maxLength={128}
                value={browserKeyDraft} onChange={event=>{
                  setBrowserKeyDraft(event.target.value);
                  setBrowserKeyError("");setBrowserKeyNotice("");
                }}/>
              <div className="js-settings-map-actions">
                <button type="submit" className="js-settings-button primary"
                  disabled={!isValidBrowserGoogleMapsKey(browserKeyDraft)}>
                  <KeyRound size={15}/> Salvar chave do mapa
                </button>
                {browserKeySource==="browser"&&<button type="button"
                  className="js-settings-button secondary" onClick={()=>void removeMapKey()}>
                  Remover chave local
                </button>}
                {browserKeySource!=="missing"&&<button type="button"
                  className="js-settings-button secondary" onClick={()=>onNavigate("maps")}>
                  <MapPinned size={15}/> Abrir Buscar via Maps
                </button>}
              </div>
            </form>
            {browserKeyError&&<p className="js-settings-map-error" role="alert">{browserKeyError}</p>}
            {browserKeyNotice&&<p className="js-settings-map-confirmation" role="status">{browserKeyNotice}</p>}
            <p className="js-settings-map-origin">
              Endereço atual do Workspace: <code>{typeof window!=="undefined"?window.location.origin:""}</code>
            </p>
            <p className="js-settings-map-help">
              Use apenas uma chave <strong>pública de navegador</strong>, restrita ao domínio deste site
              e à <strong>Maps JavaScript API</strong> no Google Cloud. Nunca informe a chave privada
              do Google Places utilizada no servidor. A configuração fica neste navegador e não
              altera sua conta no Supabase. Em outro endereço ou dispositivo, pode ser necessário
              configurá-la novamente. A API também exige faturamento ativo no Google Cloud.
            </p>
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
