import {
  ArrowRight, BarChart3, Building2, CalendarCheck2, Check, CheckCircle2,
  Clock3, Compass, FolderKanban, Globe2, Layers3, LayoutDashboard, MessageCircle,
  Search, ShieldCheck, Target, Users, WalletCards, ScanSearch, Files,
  ListOrdered, CalendarDays, BriefcaseBusiness, MessageSquareWarning,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Editorial marketing modules: real capability descriptions, no fabricated
 * testimonials or performance numbers. Changes are local-only UI state.
 */

const difficulties = [
  {
    title: "Pesquisa fragmentada",
    detail: "Informações de empresas espalhadas em pesquisas, abas e anotações.",
    resolution: "Busca por nicho e cidade no mesmo fluxo",
    icon: Search,
  },
  {
    title: "Carteira desorganizada",
    detail: "Histórico e situação de cada contato difíceis de acompanhar.",
    resolution: "Leads e atividades registrados no CRM",
    icon: Layers3,
  },
  {
    title: "Próxima ação indefinida",
    detail: "Retornos perdem prioridade quando não existe uma rotina clara.",
    resolution: "Datas de retorno e próximas ações visíveis no CRM",
    icon: Clock3,
  },
] as const;

export function ChallengeStory() {
  return (
    <section className="jl-section jl-editorial-challenge" aria-labelledby="challenge-title">
      <div className="jl-container jl-challenge-layout">
        <div className="jl-challenge-statement">
          <span className="jl-eyebrow">PROSPECÇÃO SEM ATRITO</span>
          <h2 id="challenge-title">Menos abas abertas. <span>Mais clareza sobre quem contatar.</span></h2>
          <p>
            Seu trabalho não termina quando uma empresa aparece na pesquisa.
            O Januário Leads conecta descoberta, organização e acompanhamento
            para que cada contato tenha um próximo passo.
          </p>
          <a className="jl-editorial-link" href="#recursos">
            Conheça os módulos
          </a>
        </div>
        <div className="jl-challenge-lines" aria-label="Problemas comuns e como a plataforma ajuda">
          {difficulties.map(({ title, detail, resolution, icon: Icon }) => (
            <div className="jl-challenge-line" key={title}>
              <div className="jl-challenge-line-copy">
                <div className="jl-challenge-line-heading">
                  <Icon size={18} aria-hidden="true" />
                  <strong>{title}</strong>
                </div>
                <p>{detail}</p>
                <span><Check size={14} aria-hidden="true" /> {resolution}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  { title: "Explore", description: "Escolha o segmento e a cidade.", icon: Compass },
  { title: "Organize", description: "Salve os negócios que importam.", icon: FolderKanban },
  { title: "Acompanhe", description: "Registre atividades e defina retornos.", icon: CalendarCheck2 },
] as const;

export function WorkflowRibbon() {
  const ribbonRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const ribbon = ribbonRef.current;
    if (!ribbon) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setActiveStep(2);
      return;
    }

    let started = false;
    let timers: number[] = [];
    let observer: IntersectionObserver | undefined;

    function checkVisibility() {
      if (started) return;
      const rect = ribbon!.getBoundingClientRect();
      if (rect.top < window.innerHeight - 16 && rect.bottom > 16) playSequence();
    }

    function playSequence() {
      if (started) return;
      started = true;
      setActiveStep(0);
      timers = [
        window.setTimeout(() => setActiveStep(1), 1050),
        window.setTimeout(() => setActiveStep(2), 2200),
      ];
      observer?.disconnect();
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
    }

    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("resize", checkVisibility);
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) playSequence();
      }, { threshold: 0.01 });
      observer.observe(ribbon);
    }
    // Hydration may happen after the section has already been scrolled into view.
    checkVisibility();

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <section
      ref={ribbonRef}
      className="jl-editorial-workflow"
      id="como-funciona"
      aria-labelledby="workflow-title"
    >
      <div className="jl-container">
        <div className="jl-editorial-workflow-head">
          <div>
            <span className="jl-eyebrow">DA PESQUISA À ROTINA</span>
            <h2 id="workflow-title">Um caminho claro para cada <span>oportunidade.</span></h2>
          </div>
          <p>Três movimentos que mantêm sua prospecção conectada. O tour acima mostra como eles se relacionam na plataforma.</p>
        </div>
        <ol className="jl-workflow-track" data-stage={activeStep}>
          {steps.map(({ title, description, icon: Icon }, index) => (
            <li key={title} className={activeStep >= index ? "jl-workflow-active" : ""}>
              <span className="jl-workflow-node"><Icon size={19} aria-hidden="true" /></span>
              <div className="jl-workflow-copy"><strong>{title}</strong><p>{description}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

type ModuleCategory = "prospecting" | "commercial";
const moduleCategories: {id:ModuleCategory;title:string;description:string}[] = [
  { id:"prospecting",title:"Prospecção e CRM",
    description:"A base da operação: pesquisar, selecionar e acompanhar seus contatos." },
  { id:"commercial",title:"Gestão Comercial",
    description:"Da análise de um negócio ao orçamento, aos retornos e à entrega de um projeto." },
];

/** Descriptions reflect implemented code, not a guarantee of public access. */
const productModules = [
  {
    id: "dashboard", category: "prospecting", icon: LayoutDashboard, name: "Dashboard", label: "Sua rotina em um painel",
    headline: "Visualize o que precisa de atenção na sua carteira.",
    description: "Consulte indicadores comerciais, ações agendadas ou atrasadas e sugestões de follow-up em um só painel.",
    bullets: ["Indicadores da carteira", "Próximas ações para hoje", "Retornos que precisam de atenção"],
    visual: ["Consultar indicadores", "Revisar retornos", "Abrir o lead"],
  },
  {
    id: "carteira", category: "prospecting", icon: Users, name: "Meus Leads", label: "Organize seus contatos",
    headline: "Tenha contexto para acompanhar cada empresa.",
    description: "Salve empresas na carteira e organize dados, status, anotações e histórico de atividades registradas no CRM. Conversas do WhatsApp não são sincronizadas automaticamente.",
    bullets: ["Leads em lista e cartões", "Anotações e atividades registradas", "Datas de retorno por lead"],
    visual: ["Adicionar empresa", "Registrar atividade", "Definir próxima ação"],
  },
  {
    id: "busca", category: "prospecting", icon: Search, name: "Buscar Leads", label: "Pesquise por cidade e nicho",
    headline: "Pesquise empresas no mercado que você escolhe.",
    description: "Selecione estado, município e segmento. Revise os resultados disponíveis na fonte consultada e escolha quais negócios adicionar à sua carteira.",
    bullets: ["Pesquisa por cidade e nicho", "Dados conforme disponibilidade da fonte", "Seleção manual de empresas"],
    visual: ["Defina uma região", "Escolha o segmento", "Revise as empresas"],
  },
  {
    id: "oportunidades", category: "prospecting", icon: Target, name: "Oportunidades", label: "Analise cidades e nichos",
    headline: "Identifique regiões e segmentos com sinais de oportunidade.",
    description: "Compare rankings de cidades e nichos a partir de amostras de empresas já pesquisadas. Os resultados dependem de dados disponíveis e de amostras suficientes; não é um funil de negociações.",
    bullets: ["Análise por cidade e segmento", "Indicadores baseados nas amostras", "Rankings conforme dados disponíveis"],
    visual: ["Pesquisas realizadas", "Análise de amostras", "Oportunidades identificadas"],
  },
  {
    id: "mensagens", category: "prospecting", icon: MessageCircle, name: "Mensagens", label: "Prepare abordagens",
    headline: "Personalize sua comunicação sem perder o contexto.",
    description: "Use modelos de abordagem, revise a mensagem e inicie a conversa pelo WhatsApp quando fizer sentido. O envio é manual.",
    bullets: ["Modelos reutilizáveis", "Comunicação personalizada", "Envio sempre sob seu controle"],
    visual: ["Selecionar modelo", "Personalizar texto", "Abrir conversa"],
  },
  {
    id: "financeiro", category: "prospecting", icon: WalletCards, name: "Financeiro", label: "Registre pagamentos",
    headline: "Acompanhe valores e pagamentos ligados aos seus leads.",
    description: "Registre valores de projetos e pagamentos por empresa e consulte o que foi recebido ou ainda falta receber. Não é um sistema de cobrança automática.",
    bullets: ["Valores registrados por lead", "Pagamentos e saldos", "Resumo financeiro da carteira"],
    visual: ["Registrar valor", "Anotar pagamento", "Consultar saldo"],
  },
  {
    id: "analise", category: "commercial", icon: ScanSearch, name: "Análise Digital", label: "Diagnostique sites",
    headline: "Transforme informações técnicas em contexto para conversar.",
    description: "Consulte indicadores disponíveis do PageSpeed para avaliar o site de uma empresa. O diagnóstico utiliza dados reais da fonte, quando disponíveis, e não substitui uma auditoria completa.",
    bullets: ["Consulta técnica de páginas", "Histórico de análises", "Subsídios para uma proposta"],
    visual: ["Informar o site", "Consultar indicadores", "Organizar achados"],
  },
  {
    id: "propostas", category: "commercial", icon: Files, name: "Propostas", label: "Prepare orçamentos",
    headline: "Apresente seus serviços com mais organização.",
    description: "Monte propostas ligadas a um lead ou avulsas, com escopo, serviços, valores, prazos e prévia para imprimir ou salvar em PDF. O envio e o aceite do cliente não são automáticos.",
    bullets: ["Modelos de serviços", "Valores e condições editáveis", "Prévia para PDF"],
    visual: ["Definir o escopo", "Adicionar serviços", "Preparar proposta"],
  },
  {
    id: "campanhas", category: "commercial", icon: FolderKanban, name: "Campanhas", label: "Agrupe suas ações",
    headline: "Dê um objetivo a cada grupo de empresas.",
    description: "Organize leads existentes em campanhas, defina metas e acompanhe os status registrados no CRM. Os indicadores não comprovam envio de mensagens.",
    bullets: ["Leads por campanha", "Metas de empresas", "Progresso do CRM"],
    visual: ["Criar campanha", "Vincular empresas", "Acompanhar status"],
  },
  {
    id: "sequencias", category: "commercial", icon: ListOrdered, name: "Sequências", label: "Planeje follow-ups",
    headline: "Saiba qual abordagem vem depois.",
    description: "Configure etapas de contato com prazos e modelos de mensagens, acompanhe cada lead e marque conclusões manualmente. Não existem disparos automáticos.",
    bullets: ["Etapas e prazos", "Modelos de mensagens", "Conclusão manual"],
    visual: ["Montar sequência", "Associar um lead", "Registrar etapas"],
  },
  {
    id: "agenda", category: "commercial", icon: CalendarDays, name: "Agenda", label: "Reúna compromissos",
    headline: "Veja suas atividades comerciais no calendário.",
    description: "Cadastre reuniões e tarefas e consulte próximos contatos do CRM e das sequências em visualizações de mês, semana ou dia. Não envia lembretes externos.",
    bullets: ["Calendário comercial", "Compromissos vinculados", "Acompanhamento dos retornos"],
    visual: ["Escolher a data", "Criar compromisso", "Conferir atividades"],
  },
  {
    id: "objecoes", category: "commercial", icon: MessageSquareWarning, name: "Objeções", label: "Entenda as recusas",
    headline: "Registre o contexto das respostas que recebeu.",
    description: "Anote motivos reais de objeção dentro da ficha do lead, com data opcional de retomada, e acompanhe a frequência desses motivos na carteira.",
    bullets: ["Histórico por empresa", "Motivos registrados", "Resumo por categoria"],
    visual: ["Registrar motivo", "Anotar contexto", "Revisar padrões"],
  },
  {
    id: "projetos", category: "commercial", icon: BriefcaseBusiness, name: "Projetos", label: "Organize entregas",
    headline: "Continue organizado depois de fechar um serviço.",
    description: "Acompanhe projetos e tarefas em um quadro de etapas, associe leads e propostas aceitas e registre entregas manualmente. Concluir um projeto não confirma pagamentos.",
    bullets: ["Quadro de etapas", "Checklist de tarefas", "Acompanhamento de prazos"],
    visual: ["Criar projeto", "Organizar tarefas", "Marcar entrega"],
  },
  {
    id: "metas", category: "commercial", icon: BarChart3, name: "Metas", label: "Acompanhe sua evolução",
    headline: "Meça a rotina com os registros que você faz.",
    description: "Defina objetivos semanais ou mensais e acompanhe contagens de leads, propostas, compromissos e projetos entregues a partir dos dados registrados.",
    bullets: ["Objetivos por período", "Progresso por indicador", "Dados registrados, sem estimativas"],
    visual: ["Definir indicador", "Estabelecer meta", "Ver progresso"],
  },
] as const;

export function FeatureExplorer() {
  const [category, setCategory] = useState<ModuleCategory>("prospecting");
  const [selected, setSelected] = useState<(typeof productModules)[number]["id"]>("dashboard");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const active = productModules.find((mod) => mod.id === selected) ?? productModules[0];
  const ActiveIcon = active.icon;
  const visibleModules = productModules.filter((mod) => mod.category === category);
  const categoryDetails = moduleCategories.find((item) => item.id === category)!;

  function selectCategory(next: ModuleCategory) {
    setCategory(next);
    const first = productModules.find((item) => item.category === next);
    if (first) setSelected(first.id);
  }

  return (
    <div className="jl-module-explorer">
      <div className="jl-module-groups" role="group" aria-label="Grupos de funcionalidades">
        {moduleCategories.map((item) => (
          <button key={item.id} type="button" disabled={!hydrated}
            aria-pressed={category === item.id}
            className={"jl-module-group" + (category === item.id ? " active" : "")}
            onClick={() => selectCategory(item.id)}>
            {item.id === "commercial" ? <BriefcaseBusiness size={17} aria-hidden="true" /> :
              <Search size={17} aria-hidden="true" />}
            <span>{item.title}</span>
          </button>
        ))}
      </div>
      <p className="jl-module-group-description">{categoryDetails.description}</p>
      <div className="jl-modules" aria-label="Explore os módulos do Januário Leads">
        <div className="jl-module-menu" role="group" aria-label="Módulos da plataforma">
          {visibleModules.map(({ id, icon: Icon, name, label }) => (
            <button
              key={id} type="button" id={"jl-module-tab-" + id}
              aria-controls="jl-module-panel" aria-pressed={selected === id}
              disabled={!hydrated}
              className={"jl-module-tab" + (selected === id ? " active" : "")}
              onClick={() => setSelected(id)}
            >
              <span className="jl-module-tab-icon"><Icon size={19} aria-hidden="true" /></span>
              <span><strong>{name}</strong><small>{label}</small></span>
            </button>
          ))}
        </div>
        <div className="jl-module-detail" role="region" aria-live="polite" id="jl-module-panel" aria-labelledby={"jl-module-tab-" + selected}>
          <div key={selected} className="jl-module-detail-inner">
            <span className="jl-module-eyebrow"><ActiveIcon size={18} aria-hidden="true" /> {active.name}</span>
            <h3>{active.headline}</h3>
            <p>{active.description}</p>
            <ul className="jl-module-bullets">
              {active.bullets.map((bullet) => <li key={bullet}><CheckCircle2 size={16} aria-hidden="true" />{bullet}</li>)}
            </ul>
            <div className="jl-module-visual" aria-label="Resumo das etapas do módulo">
              <span className="jl-module-visual-top"><span /> FLUXO DO MÓDULO</span>
              <div>
                {active.visual.map((v, i) => (
                  <span className="jl-module-visual-item" key={v}>
                    <strong>{v}</strong>
                    {i < active.visual.length - 1 && <ArrowRight size={13} aria-hidden="true" />}
                  </span>
                ))}
              </div>
            </div>
            {category === "commercial" && <p className="jl-module-availability">
              Ferramentas em validação para ampliação de acesso. A disponibilidade depende da autorização da conta e da liberação de cada módulo.
            </p>}
          </div>
        </div>
      </div>
    </div>
  );
}

const profiles = [
  {
    id: "agencias", title: "Agências e freelancers", icon: Globe2,
    eyebrow: "SERVIÇOS DIGITAIS",
    headline: "Prospecção com foco nos negócios que podem precisar de você.",
    text: "Encontre empresas por região, consulte informações disponíveis sobre sua presença digital e registre propostas e datas de retorno.",
    use: ["Websites e presença digital", "Marketing, design e conteúdo", "Consultoria e serviços recorrentes"],
  },
  {
    id: "vendas", title: "Profissionais de vendas", icon: BarChart3,
    eyebrow: "ROTINA COMERCIAL",
    headline: "Uma carteira que acompanha seu processo de venda.",
    text: "Pesquise potenciais clientes, acompanhe o andamento do contato e consulte o histórico antes de retomar conversas.",
    use: ["Prospecção ativa", "Análise de regiões e nichos", "Follow-up comercial"],
  },
  {
    id: "consultoria", title: "Consultores e prestadores", icon: Building2,
    eyebrow: "RELACIONAMENTO B2B",
    headline: "Menos informações soltas; mais contexto para conversar.",
    text: "Organize clientes potenciais e próximas ações em uma visão clara, mesmo quando você trabalha com diferentes nichos.",
    use: ["Serviços especializados", "Atendimento empresarial", "Carteira de contatos"],
  },
] as const;

export function AudienceSwitcher() {
  const [selected, setSelected] = useState<(typeof profiles)[number]["id"]>("agencias");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const active = profiles.find((x) => x.id === selected) ?? profiles[0];
  const Icon = active.icon;
  return (
    <section className="jl-section jl-editorial-audience" id="para-quem" aria-labelledby="audience-title">
      <div className="jl-container jl-audience-layout">
        <div className="jl-audience-selector">
          <span className="jl-eyebrow">FEITO PARA NEGÓCIOS B2B</span>
          <h2 id="audience-title">Cada negócio prospecta de <span>um jeito.</span></h2>
          <p>Escolha um perfil e veja como o Januário Leads se encaixa na rotina.</p>
          <div className="jl-audience-options" role="group" aria-label="Perfis de profissionais">
            {profiles.map(({ id, title, icon: ProfileIcon }) => (
              <button key={id} type="button" id={"jl-audience-tab-" + id}
                aria-controls="jl-audience-panel" aria-pressed={selected === id}
                disabled={!hydrated}
                className={"jl-audience-option" + (selected === id ? " active" : "")}
                onClick={() => setSelected(id)}>
                <ProfileIcon size={19} aria-hidden="true" />
                <span>{title}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="jl-audience-detail" id="jl-audience-panel" role="region" aria-live="polite" aria-labelledby={"jl-audience-tab-" + selected}>
          <div key={selected} className="jl-audience-detail-inner">
            <span className="jl-audience-category"><Icon size={17} aria-hidden="true" /> {active.eyebrow}</span>
            <h3>{active.headline}</h3>
            <p>{active.text}</p>
            <div className="jl-audience-use">
              <strong>Aplicações no dia a dia</strong>
              {active.use.map((entry) => <span key={entry}><Check size={15} aria-hidden="true" /> {entry}</span>)}
            </div>
            <span className="jl-audience-foot"><ShieldCheck size={16} aria-hidden="true" /> Funcionalidades disponíveis conforme autorização de acesso.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
