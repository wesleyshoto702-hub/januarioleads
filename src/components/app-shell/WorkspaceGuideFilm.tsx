import {
  Activity, ArrowRight, BarChart3, Bell, CalendarCheck2, CalendarDays,
  Check, CheckCircle2, ChevronDown, ClipboardCheck, Copy, FileCheck2,
  FileText, FolderKanban, Globe, LayoutDashboard, ListChecks,
  MapPin, MessageCircle, MousePointer2, Plus, Search, Settings2,
  ShieldCheck, Star, Target, Users, WalletCards, type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
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
        "action": "Crie um follow-up",
        "narration": "Depois da mensagem inicial, abra Follow-up, escreva um retorno e salve o modelo. Personalize e envie manualmente."
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

function SearchView({p}:{p:number}) {
  return <div className="jlf-view jlf-search" data-phase={p}>
    <Header title="Buscar Leads" icon={Search}/>
    <div className="jlf-search-form">
      <Field label="SEGMENTO" value="Barbearia" active={p===0}/>
      <Field label="ESTADO" value={p>=1?"Minas Gerais":"Selecione"} active={p===1}/>
      <Field label="MUNICÍPIO" value={p>=1?"Lavras":"Selecione"} active={p===1}/>
      <Button selected={p>=2}><Search size={14}/> Buscar empresas</Button>
    </div>
    <div className="jlf-search-output jlf-search-flow">
      <div className="jlf-search-prompt"><MapPin size={25}/>Selecione segmento, estado e município</div>
      <div className="jlf-search-processing"><span className="jlf-search-loader"/><strong>Consultando empresas disponíveis</strong><small>Buscando na cidade selecionada…</small></div>
      <div className="jlf-search-found">
        <strong>Resultados da pesquisa <small>Exemplos fictícios</small></strong>
        {["Barbearia Exemplo A","Corte Exemplo B"].map((n,i)=>
          <div className={"jlf-company"+(i===0&&p===3?" is-selected":"")} key={n}>
            <span>{n.charAt(0)}</span><b>{n}</b>
            <small>{i===0&&p===3?"✓ Salvo na carteira":i===0?"Adicionar":"Detalhes"}</small>
          </div>
        )}
      </div>
    </div>
    
  </div>;
}

function LeadsView({p}:{p:number}) {
  return <div className="jlf-view jlf-leads" data-phase={p}>
    <Header title="Meus Leads" icon={Users}/>
    <div className="jlf-leads-toolbar"><b>Minha carteira</b><Button selected={p===0}><Plus size={13}/>Novo lead</Button></div>
    <div className="jlf-lead-flow">
      <div className="jlf-leads-edit">
        <Field label="EMPRESA" value="Estúdio Exemplo" active={p===0}/>
        <Field label="CIDADE" value="Lavras — MG"/>
        <Button selected><Check size={13}/>Salvar</Button>
      </div>
      <div className="jlf-leads-record">
        <div className="jlf-leads-card">
          <span className="jlf-monogram">E</span>
          <div><b>Estúdio Exemplo</b><small>Lavras · MG</small></div>
          <Star size={20} className={p>=3?"jlf-starred":""} fill={p>=3?"currentColor":"none"}/>
        </div>
        <div className="jlf-lead-profile">
          <div><small>Contato</small><b>Telefone disponível</b></div>
          <div><small>Status</small><b className={p>=2?"jlf-status":""}>{p>=2?"Aguardando":"Enviar mensagem"}</b></div>
          <div><small>Próxima ação</small><b>{p>=3?"Retornar contato":"Sem data definida"}</b></div>
        </div>
      </div>
    </div>
    <div className="jlf-ledger-track">
      {["Cadastrar","Revisar","Status","Favorito"].map((x,i)=><span className={p>=i?"done":""} key={x}>{x}</span>)}
    </div>
    
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
  const scores=[["Desempenho",72],["Acessibilidade",89],["Boas práticas",94],["SEO",86]] as const;
  return <div className="jlf-view jlf-digital" data-phase={p}>
    <Header title="Análise Digital" icon={Globe}/>
    <div className="jlf-address"><Globe size={14}/>empresa-exemplo.com.br
      <Button selected={p>=1}>{p===1?"Analisando...":"Analisar site"}</Button>
    </div>
    <div className="jlf-digital-workflow">
      <div className="jlf-digital-empty"><Search size={37}/><b>Informe um site público</b><span>Exemplo de avaliação técnica</span></div>
      <div className="jlf-digital-scan"><i/><Activity size={34}/><strong>Consultando indicadores...</strong><small>Simulação visual</small></div>
      <div className="jlf-digital-diagnosis">
        <div className="jlf-digital-scores">
          {scores.map(([n,v])=><div key={n}><span style={{"--value":String(v)} as CSSProperties}><b>{v}</b></span><small>{n}</small></div>)}
        </div>
        <div className="jlf-digital-advice"><ClipboardCheck size={15}/>Revise melhorias apontadas antes da proposta.</div>
      </div>
    </div>
  </div>;
}
function ProposalsView({p}:{p:number}) {
  return <div className="jlf-view jlf-proposals" data-phase={p}>
    <Header title="Propostas" icon={FileText}/><div className="jlf-document"><div className="jlf-doc-head"><span>JANUÁRIO LEADS</span><b>PROPOSTA COMERCIAL</b></div><div className="jlf-doc-client"><small>PARA</small><strong>{p===0?"Selecionando cliente...":"Estúdio Exemplo"}</strong></div>
      <div className="jlf-doc-lines"><small>SERVIÇOS</small>{p>=1?<><div><span>Site institucional</span><b>R$ 900,00</b></div><div><span>Configuração inicial</span><b>R$ 300,00</b></div></>:<p>Adicione os serviços do orçamento</p>}</div>
      <div className={"jlf-doc-total"+(p>=2?" active":"")}><span>TOTAL</span><b>{p>=2?"R$ 1.200,00":"—"}</b></div>
      {p>=2&&<p className="jlf-doc-term">Prazo: 15 dias úteis após aprovação.</p>}{p===3&&<div className="jlf-doc-ready"><FileCheck2 size={17}/>Pronto para imprimir / salvar como PDF</div>}
    </div>
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
  const followUp = p === 3;
  return <div className="jlf-view jlf-messages" data-phase={p}>
    <Header title="Mensagens" icon={MessageCircle}/>
    <div className="jlf-message-modes">
      <span className={!followUp?"on":""}>Mensagem inicial</span>
      <span className={followUp?"on":""}>Follow-up</span>
    </div>
    <div className="jlf-message-editor">
      <small>NOME DO MODELO</small>
      <strong>{followUp?"Segundo contato — retorno":"Primeiro contato — apresentação"}</strong>
      <div className="jlf-message-content">
        {followUp ? <>
          <p>Olá! Tudo bem?</p>
          <p>Passando para saber se conseguiu ver minha mensagem sobre o site.</p>
          <p>Posso te mostrar uma ideia?</p>
        </> : <>
          <p>Olá, tudo bem?</p>
          {p>=1 ? <>
            <p>Trabalho com criação de sites e vi sua empresa.</p>
            <p>Teriam interesse em conhecer uma ideia?</p>
          </> : <i>Escreva o conteúdo da mensagem...</i>}
        </>}
      </div>
      <footer>
        <span className={p>=2&&!followUp?"on":""}>
          <Star size={15} fill={p>=2&&!followUp?"currentColor":"none"}/> Favorita
        </span>
        <Button selected={p>=2}><Check size={14}/>{followUp?"Salvar follow-up":"Salvar modelo"}</Button>
      </footer>
    </div>
    <div className="jlf-copy-hint">
      <Copy size={16}/> Follow-up: copie, personalize para a empresa e envie manualmente depois da primeira abordagem.
    </div>
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
    <div className="jlf-agenda-day"><strong>Dia 13</strong>{p===0?<p>Selecione uma data no calendário.</p>:<div className="jlf-appointment"><small>14:30 · Reunião</small><b>Apresentar proposta</b>{p>=2&&<span>Estúdio Exemplo · lead vinculado</span>}</div>}{p===3&&<p className="jlf-calendar-reminder"><Bell size={13}/> Ação do CRM também aparece no calendário</p>}</div></div>
  </div>;
}

function ProjectsView({p}:{p:number}) {
  return <div className="jlf-view jlf-projects" data-phase={p}>
    <Header title="Gestão de projetos" icon={FolderKanban}/>
    <div className="jlf-project-kanban jlf-moving-kanban">
      {["Planejado","Em andamento","Entregue"].map((x)=>
        <div key={x}><strong>{x}</strong></div>
      )}
      <div className="jlf-project-moving">
        <b>Site institucional</b><small>Estúdio Exemplo</small>
        <CheckCircle2 size={17} className="jlf-project-delivered"/>
      </div>
    </div>
    <div className="jlf-project-tasks">
      <b><ClipboardCheck size={16}/>Checklist de entrega</b>
      {["Definir estrutura","Aprovar layout","Revisar entrega"].map((x,i)=>
        <div key={x}><span className={p>=2&&i<(p===2?2:3)?"on":""}>{p>=2&&i<(p===2?2:3)&&<Check size={12}/>}</span>{x}</div>
      )}
    </div>
    <small className="jlf-project-hint">Entrega concluída. O Financeiro não é alterado.</small>
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
    <Header title="Configurações" icon={Settings2}/>
    <div className="jlf-settings-cols">
      <nav>{["Conta","Aparência","Preferências","Salvar"].map((x,i)=>
        <span className={p===i?"on":""} key={x}>{x}</span>
      )}</nav>
      <div className="jlf-settings-panel jlf-settings-flow">
        <div className="jlf-settings-profile">
          <strong>Minha conta</strong><Field label="NOME DE EXIBIÇÃO" value="Minha empresa" active={p===0}/>
        </div>
        <div className="jlf-settings-appearance">
          <strong>Aparência</strong><small>Cor de destaque</small>
          <div className="jlf-swatches"><i/><i/><i/><i/></div>
          <span>Modo compacto <b className="jlf-toggle on"/></span>
        </div>
        <div className="jlf-settings-motion">
          <strong>Conforto visual</strong>
          <span>Reduzir animações <b className="jlf-toggle on"/></span>
          <small>Escolha menos movimento no workspace.</small>
          <Button selected><Check size={14}/>Salvar alterações</Button>
        </div>
        <div className="jlf-settings-saved">
          <CheckCircle2 size={34}/><strong>Alterações salvas</strong><span>Preferências aplicadas ao workspace</span>
        </div>
      </div>
    </div>
  </div>;
}

type CursorStop = readonly [selector: string, label: string, x?: number, y?: number];
/** The guide cursor targets actual mock UI elements, not fixed screen pixels. */
const MOUSE_TRACKS: Record<AppView, readonly [CursorStop, CursorStop, CursorStop, CursorStop]> = {
  "dashboard": [
    [
      ".jlf-dash-stats > div:first-child",
      "Leads"
    ],
    [
      ".jlf-dash-stats > div:nth-child(2)",
      "Tarefas"
    ],
    [
      ".jlf-dash-plot",
      "Gráfico",
      0.6,
      0.4
    ],
    [
      ".jlf-dash-queue",
      "Abrir contato",
      0.8,
      0.5
    ]
  ],
  "leads": [
    [
      ".jlf-leads-edit .jlf-button",
      "Salvar lead"
    ],
    [
      ".jlf-leads-card",
      "Ver ficha"
    ],
    [
      ".jlf-lead-profile > div:nth-child(2)",
      "Mudar status"
    ],
    [
      ".jlf-leads-card > svg",
      "Favoritar"
    ]
  ],
  "search": [
    [
      ".jlf-search-form .jlf-field:first-child",
      "Escolher nicho"
    ],
    [
      ".jlf-search-form .jlf-field:nth-child(3)",
      "Escolher cidade"
    ],
    [
      ".jlf-search-form .jlf-button",
      "Pesquisar"
    ],
    [
      ".jlf-search-output",
      "Salvar empresa",
      0.86,
      0.65
    ]
  ],
  "prospecting": [
    [
      ".jlf-region-stats",
      "Ver distribuição",
      0.5,
      0.3
    ],
    [
      ".jlf-region-filters .jlf-field:first-child",
      "Filtrar nicho"
    ],
    [
      ".jlf-region-filters .jlf-field:nth-child(2)",
      "Detalhar cidades"
    ],
    [
      ".jlf-region-stats > div:first-of-type",
      "Ver cidade"
    ]
  ],
  "opportunities": [
    [
      ".jlf-segment-switch > span:first-child",
      "Ver cidades"
    ],
    [
      ".jlf-segment-switch > span:last-child",
      "Ver segmentos"
    ],
    [
      ".jlf-opportunity-cols article",
      "Ver detalhes",
      0.6,
      0.4
    ],
    [
      ".jlf-opportunity-cols article .jlf-button",
      "Salvar lead"
    ]
  ],
  "digital-presence": [
    [
      ".jlf-address",
      "Informar site",
      0.4
    ],
    [
      ".jlf-address .jlf-button",
      "Analisar site"
    ],
    [
      ".jlf-digital-workflow",
      "Ler resultado",
      0.5,
      0.5
    ],
    [
      ".jlf-digital-workflow",
      "Ver melhorias",
      0.7,
      0.7
    ]
  ],
  "proposals": [
    [
      ".jlf-doc-client",
      "Escolher cliente"
    ],
    [
      ".jlf-doc-lines",
      "Adicionar serviços",
      0.5,
      0.5
    ],
    [
      ".jlf-doc-total",
      "Conferir valor",
      0.75
    ],
    [
      ".jlf-document",
      "Preparar PDF",
      0.75,
      0.83
    ]
  ],
  "campaigns": [
    [
      ".jlf-campaign-form .jlf-field:first-child",
      "Criar campanha"
    ],
    [
      ".jlf-campaign-participants > div:first-of-type",
      "Selecionar lead",
      0.13
    ],
    [
      ".jlf-campaign-progress",
      "Ver progresso",
      0.7
    ],
    [
      ".jlf-campaign-progress",
      "Acompanhar meta",
      0.5,
      0.8
    ]
  ],
  "messages": [
    [
      ".jlf-message-modes > span:first-child",
      "Mensagem inicial"
    ],
    [
      ".jlf-message-content",
      "Escrever modelo",
      0.42,
      0.4
    ],
    [
      ".jlf-message-editor footer .jlf-button",
      "Salvar mensagem"
    ],
    [
      ".jlf-message-modes > span:nth-child(2)",
      "Abrir follow-up"
    ]
  ],
  "sequences": [
    [
      ".jlf-sequence-name",
      "Criar modelo",
      0.4
    ],
    [
      ".jlf-sequence-line > div:nth-child(2)",
      "Agendar retorno"
    ],
    [
      ".jlf-sequence-line",
      "Incluir empresa",
      0.7,
      0.75
    ],
    [
      ".jlf-sequence-lead",
      "Copiar mensagem",
      0.85
    ]
  ],
  "agenda": [
    [
      ".jlf-days > span:nth-of-type(13)",
      "Escolher dia"
    ],
    [
      ".jlf-agenda-day",
      "Criar evento",
      0.57,
      0.7
    ],
    [
      ".jlf-agenda-day",
      "Vincular lead",
      0.55,
      0.65
    ],
    [
      ".jlf-agenda-day",
      "Revisar agenda",
      0.55,
      0.8
    ]
  ],
  "projects": [
    [
      ".jlf-project-moving",
      "Criar projeto"
    ],
    [
      ".jlf-project-kanban > div:nth-child(2)",
      "Mover etapa",
      0.47,
      0.65
    ],
    [
      ".jlf-project-tasks > div:nth-of-type(2)",
      "Marcar tarefa",
      0.15
    ],
    [
      ".jlf-project-kanban > div:nth-child(3)",
      "Concluir projeto",
      0.48,
      0.67
    ]
  ],
  "finance": [
    [
      ".jlf-finance-stats > div:first-child",
      "Valor do projeto"
    ],
    [
      ".jlf-finance-main",
      "Registrar pagamento",
      0.78,
      0.6
    ],
    [
      ".jlf-finance-ring",
      "Ver saldo"
    ],
    [
      ".jlf-finance-stats > div:nth-child(2)",
      "Recebimentos"
    ]
  ],
  "settings": [
    [
      ".jlf-settings-profile .jlf-field",
      "Editar perfil"
    ],
    [
      ".jlf-settings-appearance .jlf-swatches",
      "Escolher cor",
      0.15
    ],
    [
      ".jlf-settings-motion .jlf-toggle",
      "Reduzir movimento"
    ],
    [
      ".jlf-settings-cols nav > span:last-child",
      "Salvar ajustes"
    ]
  ]
};

function GuidedCursor({
  view, phase, shownPhase, clickId, host,
}: {
  view: AppView;
  phase: number;
  shownPhase: number;
  clickId: number;
  host: RefObject<HTMLDivElement | null>;
}) {
  const stop = MOUSE_TRACKS[view][phase] ?? MOUSE_TRACKS[view][0];
  const [selector, label, ratioX = .5, ratioY = .5] = stop;
  const [point, setPoint] = useState({ x: 22, y: 25 });
  const [onRight, setOnRight] = useState(false);
  const currentTarget = useRef<Element | null>(null);

  useLayoutEffect(() => {
    const container = host.current;
    if (!container) return;
    const measure = () => {
      const element = container.querySelector(selector);
      currentTarget.current = element;
      if (!element) return;
      const rect = container.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const x = box.left - rect.left + box.width * ratioX;
      const y = box.top - rect.top + box.height * ratioY;
      if (rect.width > 35 && rect.height > 35) {
        setPoint({
          x: Math.max(15, Math.min(rect.width - 20, x)),
          y: Math.max(15, Math.min(rect.height - 20, y)),
        });
        setOnRight(x > rect.width * .66);
      }
    };
    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [host, selector, ratioX, ratioY, phase, shownPhase]);

  useEffect(() => {
    if (!clickId) return;
    const target = currentTarget.current;
    target?.classList.add("jlf-guided-hit");
    const timeout = window.setTimeout(() => target?.classList.remove("jlf-guided-hit"), 720);
    return () => {
      window.clearTimeout(timeout);
      target?.classList.remove("jlf-guided-hit");
    };
  }, [clickId]);

  return (
    <span className={"jlf-guided-mouse" + (onRight ? " is-right" : "")} style={{ left: point.x, top: point.y }} aria-hidden="true">
      <MousePointer2 className="jlf-guided-arrow" size={24} fill="#fff" stroke="#141b22" strokeWidth={1.5}/>
      {clickId > 0 && <span className="jlf-guided-ring" key={clickId}/>}
      <span className="jlf-guided-caption">{label}</span>
    </span>
  );
}

/** The cursor moves to the next control; only after its click does the
 * persistent demo UI update, so each stage teaches an actual interaction. */
export function WorkspaceGuideFilm({view,phase,motionDisabled=false}:{
  view:AppView;
  phase:number;
  motionDisabled?:boolean;
}){
  const host = useRef<HTMLDivElement>(null);
  const [shownPhase,setShownPhase] = useState(0);
  const [clickId,setClickId] = useState(0);

  useEffect(() => {
    if (motionDisabled) {
      setShownPhase(phase);
      return;
    }
    const timer = window.setTimeout(() => {
      setShownPhase(phase);
      setClickId((value) => value + 1);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [view,phase,motionDisabled]);

  let film: ReactNode;
  switch(view){
    case "dashboard": film = <DashboardView p={shownPhase}/>; break;
    case "leads": film = <LeadsView p={shownPhase}/>; break;
    case "search": film = <SearchView p={shownPhase}/>; break;
    case "prospecting": film = <ProspectingView p={shownPhase}/>; break;
    case "opportunities": film = <OpportunitiesView p={shownPhase}/>; break;
    case "digital-presence": film = <DigitalView p={shownPhase}/>; break;
    case "proposals": film = <ProposalsView p={shownPhase}/>; break;
    case "campaigns": film = <CampaignsView p={shownPhase}/>; break;
    case "messages": film = <MessagesView p={shownPhase}/>; break;
    case "sequences": film = <SequencesView p={shownPhase}/>; break;
    case "agenda": film = <AgendaView p={shownPhase}/>; break;
    case "projects": film = <ProjectsView p={shownPhase}/>; break;
    case "finance": film = <FinanceView p={shownPhase}/>; break;
    case "settings": film = <SettingsView p={shownPhase}/>; break;
    default: film = null;
  }
  return <div className="jlf-film-host" ref={host}>
    {film}
    <GuidedCursor view={view} phase={phase} shownPhase={shownPhase} clickId={clickId} host={host}/>
  </div>;
}
