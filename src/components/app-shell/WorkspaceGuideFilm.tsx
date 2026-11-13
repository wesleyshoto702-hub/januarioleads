import {
  Activity, ArrowRight, BarChart3, Bell, CalendarCheck2, CalendarDays,
  Check, CheckCircle2, ChevronDown, ClipboardCheck, Copy, FileCheck2,
  FileText, FolderKanban, Globe, LayoutDashboard, ListChecks,
  MapPin, MessageCircle, MousePointer2, Plus, Search, Settings2,
  ShieldCheck, Star, Target, Users, WalletCards, type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { AppView } from "./AppShell";

export type FilmScene = { action: string; narration: string };
export type FilmScript = {
  title: string;
  subtitle: string;
  scenes: readonly [FilmScene, FilmScene, FilmScene, FilmScene];
};
/** Each scripted example has its own visual structure. No user data or API calls. */
export const WORKSPACE_FILMS: Record<AppView, FilmScript> = {
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Do resumo às tarefas do dia",
    "scenes": [
      {
        "action": "Visão geral",
        "narration": "Veja os totais reais da carteira registrados no Dashboard."
      },
      {
        "action": "Fila do dia",
        "narration": "Identifique contatos com retorno ou acompanhamento pendente."
      },
      {
        "action": "Indicadores",
        "narration": "Compare os status comerciais e os resultados já registrados."
      },
      {
        "action": "Próxima ação",
        "narration": "Abra o lead que precisa de atenção e atualize o seu histórico."
      }
    ]
  },
  "leads": {
    "title": "Meus Leads",
    "subtitle": "Acompanhe cada empresa no CRM",
    "scenes": [
      {
        "action": "Cadastre um contato",
        "narration": "Adicione uma empresa encontrada ou um contato próprio."
      },
      {
        "action": "Confira a ficha",
        "narration": "Verifique o telefone, a cidade e as observações salvas."
      },
      {
        "action": "Atualize o status",
        "narration": "Mude a situação conforme a negociação evoluir."
      },
      {
        "action": "Favorite e agende",
        "narration": "Destaque o lead e defina quando realizar o próximo contato."
      }
    ]
  },
  "search": {
    "title": "Buscar Leads",
    "subtitle": "Pesquise com segmento e localização",
    "scenes": [
      {
        "action": "Selecione o segmento",
        "narration": "Escolha o nicho comercial desejado."
      },
      {
        "action": "Escolha a cidade",
        "narration": "Defina primeiro o estado e depois um município válido."
      },
      {
        "action": "Execute a pesquisa",
        "narration": "Espere os resultados retornarem e examine as empresas."
      },
      {
        "action": "Revise e salve",
        "narration": "Veja os detalhes antes de adicionar uma empresa à carteira."
      }
    ]
  },
  "prospecting": {
    "title": "Informações de Prospecção",
    "subtitle": "Entenda a distribuição da sua carteira",
    "scenes": [
      {
        "action": "Visão regional",
        "narration": "Os dados vêm dos leads já salvos no seu CRM."
      },
      {
        "action": "Filtre o nicho",
        "narration": "Selecione o segmento que deseja comparar."
      },
      {
        "action": "Detalhe cidades",
        "narration": "Alterne o nível de detalhamento da análise."
      },
      {
        "action": "Planeje a prospecção",
        "narration": "Use a distribuição para definir prioridades comerciais."
      }
    ]
  },
  "opportunities": {
    "title": "Oportunidades",
    "subtitle": "Escolha o recorte e avalie os dados",
    "scenes": [
      {
        "action": "Escolha o recorte",
        "narration": "Alterne a análise entre cidade e segmento."
      },
      {
        "action": "Compare regiões",
        "narration": "Explore os agrupamentos com oportunidades disponíveis."
      },
      {
        "action": "Revise os sinais",
        "narration": "Confira telefone, presença digital e dados apresentados."
      },
      {
        "action": "Inclua no CRM",
        "narration": "Adicione somente empresas relevantes aos seus leads."
      }
    ]
  },
  "digital-presence": {
    "title": "Análise Digital",
    "subtitle": "Um diagnóstico técnico, sem promessas automáticas",
    "scenes": [
      {
        "action": "Informe o site",
        "narration": "Selecione um lead com site ou digite um domínio público."
      },
      {
        "action": "Inicie a análise",
        "narration": "Consulte os indicadores técnicos disponíveis."
      },
      {
        "action": "Leia os resultados",
        "narration": "Avalie desempenho, acessibilidade, boas práticas e SEO."
      },
      {
        "action": "Prepare a proposta",
        "narration": "Use os pontos de melhoria como contexto para uma conversa."
      }
    ]
  },
  "proposals": {
    "title": "Propostas",
    "subtitle": "Monte, revise e compartilhe um orçamento",
    "scenes": [
      {
        "action": "Selecione o cliente",
        "narration": "Vincule um lead ou crie uma proposta avulsa."
      },
      {
        "action": "Adicione os serviços",
        "narration": "Descreva os itens e o escopo que será entregue."
      },
      {
        "action": "Revise os valores",
        "narration": "Confira total, prazos e condições."
      },
      {
        "action": "Gere a apresentação",
        "narration": "Salve e prepare um PDF para enviar manualmente."
      }
    ]
  },
  "campaigns": {
    "title": "Campanhas",
    "subtitle": "Agrupe seus leads por objetivo",
    "scenes": [
      {
        "action": "Crie uma campanha",
        "narration": "Informe nome, objetivo e meta comercial."
      },
      {
        "action": "Escolha participantes",
        "narration": "Selecione empresas existentes no CRM."
      },
      {
        "action": "Acompanhe os status",
        "narration": "O painel utiliza as situações registradas nos leads."
      },
      {
        "action": "Confira a meta",
        "narration": "Observe a evolução da campanha e ajuste sua estratégia."
      }
    ]
  },
  "messages": {
    "title": "Mensagens",
    "subtitle": "Escreva modelos para reutilizar",
    "scenes": [
      {
        "action": "Escolha o tipo",
        "narration": "Crie uma mensagem inicial ou um follow-up."
      },
      {
        "action": "Escreva a abordagem",
        "narration": "Preencha o título e o texto do modelo."
      },
      {
        "action": "Salve nos favoritos",
        "narration": "Mantenha os modelos mais usados organizados."
      },
      {
        "action": "Personalize e copie",
        "narration": "Revise para cada empresa; o envio é manual."
      }
    ]
  },
  "sequences": {
    "title": "Sequências",
    "subtitle": "Organize follow-ups sem disparos automáticos",
    "scenes": [
      {
        "action": "Crie um modelo",
        "narration": "Dê um nome à sequência de contatos."
      },
      {
        "action": "Defina as etapas",
        "narration": "Escolha os dias e associe modelos de mensagem."
      },
      {
        "action": "Associe o lead",
        "narration": "Inicie o acompanhamento de uma empresa da carteira."
      },
      {
        "action": "Siga o plano",
        "narration": "Copie o texto na etapa certa e registre seu progresso."
      }
    ]
  },
  "agenda": {
    "title": "Agenda",
    "subtitle": "Organize compromissos em datas",
    "scenes": [
      {
        "action": "Escolha o dia",
        "narration": "Navegue pelo calendário para selecionar a data."
      },
      {
        "action": "Crie o compromisso",
        "narration": "Informe título, horário e tipo de atividade."
      },
      {
        "action": "Associe uma empresa",
        "narration": "Vincule o compromisso a um lead se necessário."
      },
      {
        "action": "Revise a agenda",
        "narration": "Consulte também atividades do CRM e das sequências."
      }
    ]
  },
  "projects": {
    "title": "Projetos",
    "subtitle": "Acompanhe entregas após a negociação",
    "scenes": [
      {
        "action": "Cadastre o projeto",
        "narration": "Vincule uma proposta aceita ou um lead, se desejar."
      },
      {
        "action": "Mova entre fases",
        "narration": "Acompanhe o trabalho no quadro de projetos."
      },
      {
        "action": "Marque as tarefas",
        "narration": "Use o checklist para registrar o que foi feito."
      },
      {
        "action": "Conclua a entrega",
        "narration": "Marcar como entregue não registra pagamento."
      }
    ]
  },
  "finance": {
    "title": "Financeiro",
    "subtitle": "Valores e pagamentos registrados",
    "scenes": [
      {
        "action": "Defina o valor",
        "narration": "Registre o valor acordado com o cliente no lead."
      },
      {
        "action": "Lance o pagamento",
        "narration": "Informe um recebimento realmente ocorrido."
      },
      {
        "action": "Confira o saldo",
        "narration": "O painel atualiza recebido e pendente."
      },
      {
        "action": "Acompanhe os totais",
        "narration": "Use os registros para sua gestão; não há movimentação bancária."
      }
    ]
  },
  "settings": {
    "title": "Configurações",
    "subtitle": "Personalize e controle sua experiência",
    "scenes": [
      {
        "action": "Ajuste o perfil",
        "narration": "Confira e altere seu nome de exibição."
      },
      {
        "action": "Escolha o visual",
        "narration": "Defina cor de destaque e modo compacto."
      },
      {
        "action": "Reduza movimento",
        "narration": "Ative a opção quando preferir menos animações."
      },
      {
        "action": "Salve as mudanças",
        "narration": "Confirme para aplicar as preferências na sua conta."
      }
    ]
  }
};

function Header({title,icon:Icon}:{title:string;icon:LucideIcon}) {
  return <header className="jlf-head"><span><Icon size={18}/><b>{title}</b></span><small>DEMONSTRAÇÃO</small></header>;
}
function Field({label,value,active=false}:{label:string;value:string;active?:boolean}) {
  return <div className={"jlf-field"+(active?" active":"")}><small>{label}</small><span>{value}</span><ChevronDown size={13}/></div>;
}
function Button({children,selected=false}:{children:ReactNode;selected?:boolean}) {
  return <span className={"jlf-button"+(selected?" selected":"")}>{children}</span>;
}
function Cursor({step}:{step:number}) {
  return <span className={"jlf-cursor phase-"+step} aria-hidden="true"><MousePointer2 size={21} fill="#fafafa" stroke="#16171c"/></span>;
}
function SearchView({p}:{p:number}) {
  return <div className="jlf-view jlf-search" data-phase={p}>
    <Header title="Buscar Leads" icon={Search}/>
    <div className="jlf-search-form"><Field label="SEGMENTO" value="Barbearia" active={p===0}/><Field label="ESTADO" value={p>=1?"Minas Gerais":"Selecione"} active={p===1}/><Field label="MUNICÍPIO" value={p>=1?"Lavras":"Selecione"} active={p===1}/><Button selected={p>=2}><Search size={14}/> Buscar empresas</Button></div>
    <div className="jlf-search-output">{p<2?<div className="jlf-blank"><MapPin size={24}/>A pesquisa começará após selecionar cidade e nicho</div>:p===2?<div className="jlf-skeleton"><i/><i/><i/><small>Consultando fontes disponíveis...</small></div>:<><strong>Empresas encontradas <small>Exemplo fictício</small></strong>{["Barbearia Exemplo A","Corte Exemplo B"].map((n,i)=><div className="jlf-company" key={n}><span>{n.charAt(0)}</span><b>{n}</b><small>{i===0?"Salvar lead":"Detalhes"}</small></div>)}</>}</div>
    <Cursor step={p}/>
  </div>;
}
function LeadsView({p}:{p:number}) {
  return <div className="jlf-view jlf-leads" data-phase={p}>
    <Header title="Meus Leads" icon={Users}/><div className="jlf-leads-toolbar"><b>Minha carteira</b><Button selected={p===0}><Plus size={13}/>Novo lead</Button></div>
    {p===0?<div className="jlf-leads-edit"><Field label="EMPRESA" value="Estúdio Exemplo" active/><Field label="CIDADE" value="Lavras — MG"/><Button selected><Check size={13}/>Salvar</Button></div>:<div className="jlf-leads-card"><span className="jlf-monogram">E</span><div><b>Estúdio Exemplo</b><small>Lavras · MG</small></div><Star size={20} className={p>=3?"jlf-starred":""} fill={p>=3?"currentColor":"none"}/></div>}
    {p>=1&&<div className="jlf-lead-profile"><div><small>Contato</small><b>Telefone disponível</b></div><div><small>Status</small><b className={p>=2?"jlf-status":""}>{p>=2?"Aguardando":"Enviar mensagem"}</b></div><div><small>Próxima ação</small><b>{p>=3?"Retornar contato":"Sem data definida"}</b></div></div>}
    <div className="jlf-ledger-track">{["Cadastrar","Revisar","Status","Favorito"].map((x,i)=><span className={p>=i?"done":""} key={x}>{x}</span>)}</div><Cursor step={p}/>
  </div>;
}
function DashboardView({p}:{p:number}) {
  return <div className="jlf-view jlf-dashboard" data-phase={p}>
    <Header title="Dashboard" icon={LayoutDashboard}/><div className="jlf-dash-stats">{[["24","LEADS"],["5","HOJE"],["7","ACEITOS"]].map(([v,n],i)=><div className={p===i?"focus":""} key={n}><small>{n}</small><strong>{v}</strong></div>)}</div>
    <div className="jlf-dash-plot"><div><b>Evolução da carteira</b><BarChart3 size={17}/></div><svg viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true"><path className="jlf-chart-grid" d="M0 28H400M0 60H400M0 92H400"/><path className="jlf-chart-area" d="M0 95C65 93 110 75 170 77S260 50 315 37S368 30 400 12V110H0Z"/><path className="jlf-chart-line" d="M0 95C65 93 110 75 170 77S260 50 315 37S368 30 400 12"/></svg></div>
    <div className={"jlf-dash-queue"+(p===1||p===3?" focus":"")}><Clock3Icon/><span>Retornar contato com Estúdio Exemplo</span>{p===3&&<Button selected>Abrir lead <ArrowRight size={14}/></Button>}</div>
  </div>;
}
function Clock3Icon(){return <CalendarCheck2 size={17}/>;}
function ProspectingView({p}:{p:number}) {
  const names=p>=2?["Lavras","Varginha","Belo Horizonte","Outras"]:["MG","SP","RJ","PR"];
  return <div className="jlf-view jlf-prospecting" data-phase={p}>
    <Header title="Informações de Prospecção" icon={BarChart3}/>
    <div className="jlf-region-filters"><Field label="Nicho" value={p>=1?"Barbearias":"Todos os nichos"} active={p===1}/><Field label="Detalhamento" value={p>=2?"Por cidade":"Por segmento"} active={p===2}/></div>
    <div className="jlf-region-flex"><svg className="jlf-brazil-map" viewBox="0 0 180 210" aria-label="Mapa estilizado do Brasil"><path d="M60 10L90 18 113 8 150 38 170 80 144 117 127 146 102 191 81 205 65 175 37 151 20 112 5 91 19 58 14 28Z"/><path d="M18 59L95 91 147 114 M41 153L96 91 103 187M91 18L96 91L14 28"/></svg><div className="jlf-region-stats"><b>{p>=2?"Cidades da carteira":"Estados da carteira"}</b>{names.map((x,i)=><div className={p===3&&i===0?"focus":""} key={x}><span>{x}</span><i><em style={{width:[88,66,50,31][i]+"%"}}/></i><small>{[24,17,12,8][i]}</small></div>)}</div></div>
    {p===3&&<div className="jlf-region-footer"><Target size={15}/> Lavras concentra parte dos registros do exemplo.</div>}
  </div>;
}
function OpportunitiesView({p}:{p:number}) {
  return <div className="jlf-view jlf-opportunities" data-phase={p}>
    <Header title="Oportunidades" icon={Target}/><div className="jlf-segment-switch"><span className={p===0?"on":""}>Por cidade</span><span className={p>=1?"on":""}>Por segmento</span></div>
    <div className="jlf-opportunity-cols"><div><strong>{p===0?"Cidades analisadas":"Segmentos analisados"}</strong>{["Serviços","Alimentação","Bem-estar"].map((x,i)=><div className={p>=1&&i===0?"on":""} key={x}><em>0{i+1}</em><span>{p===0?["Lavras","Varginha","Pouso Alegre"][i]:x}</span><ArrowRight size={14}/></div>)}</div>
    <article className={p>=2?"on":""}><small>EXEMPLO FICTÍCIO</small><b>Negócio Exemplo</b><p><Globe size={15}/> Site informado</p><p><MessageCircle size={15}/> Contato disponível</p>{p>=3?<Button selected><Plus size={14}/>Salvar lead</Button>:<Button>Ver detalhes</Button>}</article></div>
  </div>;
}
function DigitalView({p}:{p:number}) {
  const scores=[["Desempenho",72],["Acessibilidade",89],["Boas práticas",94],["SEO",86]];
  return <div className="jlf-view jlf-digital" data-phase={p}>
    <Header title="Análise Digital" icon={Globe}/><div className="jlf-address"><Globe size={14}/>empresa-exemplo.com.br<Button selected={p>=1}>{p===1?"Analisando...":"Analisar site"}</Button></div>
    {p===0?<div className="jlf-digital-empty"><Search size={37}/><b>Informe um site público</b><span>Exemplo de avaliação técnica</span></div>:p===1?<div className="jlf-digital-scan"><i/><Activity size={34}/><strong>Consultando indicadores...</strong><small>Simulação visual</small></div>:<><div className="jlf-digital-scores">{scores.map(([n,v])=><div key={n}><span style={{"--value":String(v)} as CSSProperties}><b>{v}</b></span><small>{n}</small></div>)}</div>{p>=3&&<div className="jlf-digital-advice"><ClipboardCheck size={15}/>Revise melhorias apontadas antes da proposta.</div>}</>}
  </div>;
}
function ProposalsView({p}:{p:number}) {
  return <div className="jlf-view jlf-proposals" data-phase={p}>
    <Header title="Propostas" icon={FileText}/><div className="jlf-document"><div className="jlf-doc-head"><span>JANUÁRIO LEADS</span><b>PROPOSTA COMERCIAL</b></div><div className="jlf-doc-client"><small>PARA</small><strong>{p===0?"Selecionando cliente...":"Estúdio Exemplo"}</strong></div>
      <div className="jlf-doc-lines"><small>SERVIÇOS</small>{p>=1?<><div><span>Site institucional</span><b>R$ 900,00</b></div><div><span>Configuração inicial</span><b>R$ 300,00</b></div></>:<p>Adicione os serviços do orçamento</p>}</div>
      <div className={"jlf-doc-total"+(p>=2?" active":"")}><span>TOTAL</span><b>{p>=2?"R$ 1.200,00":"—"}</b></div>
      {p>=2&&<p className="jlf-doc-term">Prazo: 15 dias úteis após aprovação.</p>}{p===3&&<div className="jlf-doc-ready"><FileCheck2 size={17}/>Pronto para imprimir / salvar como PDF</div>}
    </div><Cursor step={p}/>
  </div>;
}
function CampaignsView({p}:{p:number}) {
  return <div className="jlf-view jlf-campaigns" data-phase={p}>
    <Header title="Campanhas" icon={FolderKanban}/><div className="jlf-campaign-form"><Field label="Nome da campanha" value="Barbearias de Lavras" active={p===0}/><Field label="Meta" value="20 empresas"/></div>
    <div className="jlf-campaign-participants"><b>Leads da carteira</b>{["Barbearia Exemplo A","Estúdio Exemplo B","Corte Exemplo C"].map((n,i)=><div key={n}><span className={p>=1&&i<2?"checked":""}>{p>=1&&i<2&&<Check size={12}/>}</span>{n}</div>)}</div>
    <div className="jlf-campaign-progress"><span>EMPRESAS NA CAMPANHA</span><strong>{p>=2?"2":"0"} <small>/ 20</small></strong><i><em style={{width:p>=2?"10%":"0%"}}/></i></div>
    {p===3&&<small className="jlf-campaign-note">Status atualizado a partir do CRM · sem envios automáticos</small>}
  </div>;
}
function MessagesView({p}:{p:number}) {
  return <div className="jlf-view jlf-messages" data-phase={p}>
    <Header title="Mensagens" icon={MessageCircle}/><div className="jlf-message-modes"><span className={p<3?"on":""}>Mensagem inicial</span><span className={p===3?"on":""}>Follow-up</span></div>
    <div className="jlf-message-editor"><small>NOME DO MODELO</small><strong>Primeiro contato — apresentação</strong><div className="jlf-message-content"><p>Olá, tudo bem?</p>{p>=1?<><p>Trabalho com criação de sites e vi sua empresa.</p><p>Teriam interesse em conhecer uma ideia?</p></>:<i>Escreva o conteúdo da mensagem...</i>}</div><footer><span className={p>=2?"on":""}><Star size={15} fill={p>=2?"currentColor":"none"}/> Favorita</span><Button selected={p>=2}><Check size={14}/>Salvar modelo</Button></footer></div>
    {p===3&&<div className="jlf-copy-hint"><Copy size={16}/> Modelo salvo: personalize e copie para enviar manualmente.</div>}
  </div>;
}
function SequencesView({p}:{p:number}) {
  const steps=[["DIA 0","Primeiro contato"],["DIA 3","Follow-up"],["DIA 7","Último retorno"]];
  return <div className="jlf-view jlf-sequences" data-phase={p}>
    <Header title="Sequências" icon={ListChecks}/><div className="jlf-sequence-name"><small>MODELO</small><strong>Prospecção de sites</strong><span>3 etapas</span></div>
    <div className="jlf-sequence-line">{steps.map(([day,title],i)=><div className={p>=1&&i<=(p===1?1:2)?"active":""} key={day}><span className="jlf-step-number">{i+1}</span><small>{day}</small><b>{title}</b>{p===3&&i===1&&<CheckCircle2 size={17}/>}</div>)}</div>
    {p>=2&&<div className="jlf-sequence-lead"><Users size={17}/><span><b>Estúdio Exemplo</b><small>Lead em acompanhamento</small></span>{p===3?<Copy size={17}/>:<Check size={17}/>}</div>}
    <small className="jlf-sequence-note">Contatos manuais · nenhum envio programado</small>
  </div>;
}
function AgendaView({p}:{p:number}) {
  return <div className="jlf-view jlf-agenda" data-phase={p}>
    <Header title="Agenda comercial" icon={CalendarDays}/><div className="jlf-agenda-cols"><div className="jlf-month"><header><b>Novembro</b><span>2026</span></header><div className="jlf-days">{["S","T","Q","Q","S","S","D"].map((x,i)=><small key={i}>{x}</small>)}{Array.from({length:28},(_,i)=><span className={i===12?"chosen":""} key={i}>{i+1}{p>=1&&i===12&&<i/>}</span>)}</div></div>
    <div className="jlf-agenda-day"><strong>Dia 13</strong>{p===0?<p>Selecione uma data no calendário.</p>:<div className="jlf-appointment"><small>14:30 · Reunião</small><b>Apresentar proposta</b>{p>=2&&<span>Estúdio Exemplo · lead vinculado</span>}</div>}{p===3&&<p className="jlf-calendar-reminder"><Bell size={13}/> Ação do CRM também aparece no calendário</p>}</div></div><Cursor step={p}/>
  </div>;
}
function ProjectsView({p}:{p:number}) {
  return <div className="jlf-view jlf-projects" data-phase={p}>
    <Header title="Gestão de projetos" icon={FolderKanban}/><div className="jlf-project-kanban">{["Planejado","Em andamento","Entregue"].map((x,i)=><div key={x}><strong>{x}</strong>{((p===0&&i===0)||(p>=1&&p<3&&i===1)||(p===3&&i===2))&&<div className="jlf-project-card"><b>Site institucional</b><small>Estúdio Exemplo</small>{p>=3&&<CheckCircle2 size={17}/>}</div>}</div>)}</div>
    <div className="jlf-project-tasks"><b><ClipboardCheck size={16}/>Checklist de entrega</b>{["Definir estrutura","Aprovar layout","Revisar entrega"].map((x,i)=><div key={x}><span className={p>=2&&i<(p===2?2:3)?"on":""}>{p>=2&&i<(p===2?2:3)&&<Check size={12}/>}</span>{x}</div>)}</div>
    {p===3&&<small className="jlf-project-hint">Entrega concluída. O Financeiro não é alterado.</small>}
  </div>;
}
function FinanceView({p}:{p:number}) {
  return <div className="jlf-view jlf-finance" data-phase={p}>
    <Header title="Financeiro" icon={WalletCards}/><div className="jlf-finance-stats">{[["VALOR","R$ 1.200"],["RECEBIDO",p>=1?"R$ 300":"R$ 0"],["PENDENTE",p>=1?"R$ 900":"R$ 1.200"]].map(([n,v],i)=><div className={p>=2&&i===1?"focus":""} key={n}><small>{n}</small><strong>{v}</strong></div>)}</div>
    <div className="jlf-finance-main"><div className="jlf-finance-ring" style={{"--fill":p>=1?"25%":"0%"} as CSSProperties}><strong>{p>=1?"25%":"0%"}</strong><span>recebido</span></div><div><strong>Histórico de recebimentos</strong>{p===0?<p>Registre um pagamento realizado.</p>:<p className="jlf-payment"><CheckCircle2 size={15}/> Entrada registrada <b>R$ 300</b></p>}{p===3&&<small>Resumo atualizado pelos registros informados.</small>}</div></div>
  </div>;
}
function SettingsView({p}:{p:number}) {
  return <div className="jlf-view jlf-settings" data-phase={p}>
    <Header title="Configurações" icon={Settings2}/><div className="jlf-settings-cols"><nav>{["Conta","Aparência","Preferências","Salvar"].map((x,i)=><span className={p===i?"on":""} key={x}>{x}</span>)}</nav><div className="jlf-settings-panel">
      {p===0?<><strong>Minha conta</strong><Field label="NOME DE EXIBIÇÃO" value="Minha empresa" active/></>:p===1?<><strong>Aparência</strong><small>Cor de destaque</small><div className="jlf-swatches"><i/><i/><i/><i/></div><span>Modo compacto <b className="jlf-toggle on"/></span></>:p===2?<><strong>Conforto visual</strong><span>Reduzir animações <b className="jlf-toggle on"/></span><small>Respeite sua preferência de movimento.</small></>:<div className="jlf-settings-saved"><CheckCircle2 size={34}/><strong>Alterações salvas</strong><span>Preferências aplicadas ao workspace</span></div>}
      {p<3&&<Button selected={p===2}><Check size={14}/>Salvar alterações</Button>}
    </div></div>
  </div>;
}
export function WorkspaceGuideFilm({view,phase}:{view:AppView;phase:number}){
  switch(view){
    case "dashboard":return <DashboardView p={phase}/>;
    case "leads":return <LeadsView p={phase}/>;
    case "search":return <SearchView p={phase}/>;
    case "prospecting":return <ProspectingView p={phase}/>;
    case "opportunities":return <OpportunitiesView p={phase}/>;
    case "digital-presence":return <DigitalView p={phase}/>;
    case "proposals":return <ProposalsView p={phase}/>;
    case "campaigns":return <CampaignsView p={phase}/>;
    case "messages":return <MessagesView p={phase}/>;
    case "sequences":return <SequencesView p={phase}/>;
    case "agenda":return <AgendaView p={phase}/>;
    case "projects":return <ProjectsView p={phase}/>;
    case "finance":return <FinanceView p={phase}/>;
    case "settings":return <SettingsView p={phase}/>;
  }
}
