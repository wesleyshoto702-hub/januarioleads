import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Compass,
  Globe2,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  MousePointer2,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";

const scenarios = [
  {
    id: "restaurantes",
    label: "Restaurantes",
    location: "Lavras · MG",
    results: [
      { name: "Restaurante Exemplo A", niche: "Alimentação", detail: "Contato a qualificar" },
      { name: "Bistrô Exemplo B", niche: "Alimentação", detail: "Pronto para salvar" },
      { name: "Cantina Exemplo C", niche: "Alimentação", detail: "Próximo passo: abordar" },
    ],
  },
  {
    id: "clinicas",
    label: "Clínicas",
    location: "Belo Horizonte · MG",
    results: [
      { name: "Clínica Exemplo A", niche: "Saúde", detail: "Contato a qualificar" },
      { name: "Centro Exemplo B", niche: "Saúde", detail: "Pronto para salvar" },
      { name: "Consultório Exemplo C", niche: "Saúde", detail: "Próximo passo: abordar" },
    ],
  },
  {
    id: "academias",
    label: "Academias",
    location: "Campinas · SP",
    results: [
      { name: "Academia Exemplo A", niche: "Bem-estar", detail: "Contato a qualificar" },
      { name: "Studio Exemplo B", niche: "Bem-estar", detail: "Pronto para salvar" },
      { name: "Espaço Exemplo C", niche: "Bem-estar", detail: "Próximo passo: abordar" },
    ],
  },
] as const;

const difficulties = [
  {
    icon: Search,
    title: "Horas espalhadas em pesquisas",
    description: "Achar empresas, conferir dados e organizar a lista manualmente toma tempo da prospecção.",
  },
  {
    icon: LayersIcon,
    title: "Contatos sem contexto",
    description: "Números, anotações e histórico em lugares diferentes dificultam uma abordagem relevante.",
  },
  {
    icon: Clock3,
    title: "Retornos esquecidos",
    description: "Sem uma próxima ação definida, oportunidades podem ficar paradas na carteira.",
  },
];

function LayersIcon(props: { size?: number; "aria-hidden"?: boolean | "true" | "false" }) {
  return <LayoutDashboard {...props} />;
}

const features = [
  {
    icon: Search,
    title: "Busca por região e nicho",
    description: "Pesquise empresas em municípios brasileiros e trabalhe com segmentos relevantes para seu serviço.",
  },
  {
    icon: Building2,
    title: "Detalhes da empresa",
    description: "Consulte os dados encontrados e complemente o contexto de cada negócio conforme a disponibilidade.",
  },
  {
    icon: Users,
    title: "CRM de prospecção",
    description: "Salve seus leads e acompanhe em que etapa está cada contato, com histórico organizado.",
  },
  {
    icon: CalendarCheck,
    title: "Próxima ação visível",
    description: "Agende retornos e identifique os contatos que merecem atenção na sua rotina.",
  },
  {
    icon: MessageCircle,
    title: "Mensagens para adaptar",
    description: "Prepare abordagens e abra uma conversa no WhatsApp. O envio continua sendo manual.",
  },
  {
    icon: WalletCards,
    title: "Visão das negociações",
    description: "Acompanhe oportunidades e registros financeiros relacionados aos seus negócios.",
  },
];

const faq = [
  {
    question: "O que é o Januário Leads?",
    answer:
      "Uma plataforma de prospecção e CRM. Você pesquisa empresas por região e nicho, escolhe quais salvar e organiza contatos, próximas ações e oportunidades.",
  },
  {
    question: "Posso buscar empresas de outras cidades?",
    answer:
      "Sim. A pesquisa foi preparada para cidades brasileiras, com estado, município e segmento. Os resultados dependem das informações disponíveis na fonte consultada.",
  },
  {
    question: "O sistema envia mensagens automaticamente?",
    answer:
      "Não. Você pode preparar modelos de mensagens e abrir o WhatsApp para conversar. O envio da abordagem continua sob seu controle.",
  },
  {
    question: "Preciso instalar algum programa?",
    answer:
      "Não para utilizar a plataforma. O Januário Leads foi desenvolvido para ser acessado em um navegador compatível.",
  },
  {
    question: "Já posso contratar uma assinatura?",
    answer:
      "Ainda não. Estamos preparando o cadastro comercial, os planos e a cobrança. Neste momento, o acesso ao sistema é concedido por convite.",
  },
];

function Brand() {
  return (
    <Link className="jl-brand" to="/" aria-label="Januário Leads — página inicial">
      <span className="jl-brand-mark">J</span>
      <span className="jl-brand-name">Januário<span>Leads</span></span>
    </Link>
  );
}

function ProductMock() {
  return (
    <div className="jl-hero-visual">
      <div className="jl-visual-glow" aria-hidden="true" />
      <div className="product-preview jl-app-preview" aria-label="Prévia ilustrativa do painel do Januário Leads">
        <div className="jl-app-top">
          <span className="jl-app-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="jl-app-window-title">Januário Leads / Visão geral</span>
          <span className="jl-app-demo-chip">Exemplo ilustrativo</span>
        </div>
        <div className="jl-app-layout">
          <aside className="jl-mock-sidebar" aria-hidden="true">
            <span className="jl-mock-sidebar-brand">J</span>
            <span className="jl-mock-sidebar-icon active"><LayoutDashboard size={15} /></span>
            <span className="jl-mock-sidebar-icon"><Search size={15} /></span>
            <span className="jl-mock-sidebar-icon"><Users size={15} /></span>
            <span className="jl-mock-sidebar-icon"><Target size={15} /></span>
            <span className="jl-mock-sidebar-icon"><MessageCircle size={15} /></span>
          </aside>
          <div className="jl-mock-content">
            <div className="jl-mock-heading">
              <div><span>ESPAÇO DE TRABALHO</span><strong>Sua prospecção, em ordem.</strong></div>
              <span className="jl-mock-online"><span /> Visão de exemplo</span>
            </div>
            <div className="jl-mock-stat-grid">
              <div className="jl-mock-stat"><Search size={15}/><span>Descobrir</span><strong>Pesquisar por nicho</strong></div>
              <div className="jl-mock-stat"><Users size={15}/><span>Organizar</span><strong>Salvar na carteira</strong></div>
              <div className="jl-mock-stat"><CalendarCheck size={15}/><span>Acompanhar</span><strong>Definir próxima ação</strong></div>
            </div>
            <div className="jl-mock-board">
              <div className="jl-mock-board-title">
                <span>Minha rotina comercial</span>
                <span className="jl-mock-board-tag">DEMONSTRAÇÃO</span>
              </div>
              <div className="jl-mock-board-row">
                <span className="jl-mock-avatar">A</span>
                <span className="jl-mock-row-info"><strong>Empresa Exemplo A</strong><small>Primeira abordagem</small></span>
                <span className="jl-mock-status awaiting">Preparar contato</span>
              </div>
              <div className="jl-mock-board-row">
                <span className="jl-mock-avatar">B</span>
                <span className="jl-mock-row-info"><strong>Empresa Exemplo B</strong><small>Contato realizado</small></span>
                <span className="jl-mock-status">Acompanhar</span>
              </div>
              <div className="jl-mock-board-row">
                <span className="jl-mock-avatar">C</span>
                <span className="jl-mock-row-info"><strong>Empresa Exemplo C</strong><small>Retorno agendado</small></span>
                <span className="jl-mock-status">Follow-up</span>
              </div>
            </div>
            <div className="jl-mock-bottom"><span><span className="jl-mock-line" /> Seu processo em um só lugar</span><span>CRM • Pesquisa • Ações</span></div>
          </div>
        </div>
      </div>
      <div className="jl-floating-note">
        <span className="jl-floating-icon"><CheckCircle2 size={17}/></span>
        <div><strong>Mais clareza na rotina</strong><small>Da primeira pesquisa ao retorno</small></div>
      </div>
    </div>
  );
}

function SearchDemo() {
  const [selected, setSelected] = useState<(typeof scenarios)[number]["id"]>("restaurantes");
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { setInteractive(true); }, []);
  const scenario = scenarios.find((item) => item.id === selected) ?? scenarios[0];

  return (
    <div className="jl-demo-window" data-interactive={interactive ? "true" : "false"}>
      <div className="jl-demo-toolbar">
        <span><span className="jl-demo-signal" /> Buscar Leads</span>
        <span>Exemplo interativo · sem consultas reais</span>
      </div>
      <div className="jl-demo-main">
        <div className="jl-demo-filter">
          <div>
            <span className="jl-mini-label">ESCOLHA UM SEGMENTO</span>
            <div className="jl-scenario-pills" aria-label="Exemplos de segmentos">
              {scenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!interactive}
                  aria-pressed={selected === item.id}
                  onClick={() => setSelected(item.id)}
                  className={selected === item.id ? "jl-scenario active" : "jl-scenario"}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="jl-demo-field">
            <MapPin size={16} aria-hidden="true" />
            <div><span>Cidade selecionada</span><strong>{scenario.location}</strong></div>
          </div>
        </div>
        <div className="jl-demo-results">
          <div className="jl-demo-results-title">
            <span><Search size={16} aria-hidden="true"/> Empresas para explorar</span>
            <small>Dados fictícios</small>
          </div>
          {scenario.results.map((result, index) => (
            <div className="jl-demo-result" key={result.name}>
              <span className="jl-demo-result-icon"><Building2 size={17} aria-hidden="true" /></span>
              <span className="jl-demo-result-copy">
                <strong>{result.name}</strong>
                <small>{result.niche} · {scenario.location}</small>
              </span>
              <span className="jl-demo-result-status">{index === 0 ? "Descobrir" : index === 1 ? "Selecionar" : "Organizar"}</span>
            </div>
          ))}
          <div className="jl-demo-bottom">
            <span><ShieldCheck size={15} aria-hidden="true" /> Simulação local sem custos de API</span>
            <Link to="/login">Acessar o sistema <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingHome() {
  return (
    <div className="jl-site">
      <a className="jl-skip" href="#conteudo">Pular para o conteúdo</a>
      <header className="jl-header">
        <div className="jl-container jl-header-inner">
          <Brand />
          <nav className="jl-nav" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Funcionalidades</a>
            <a href="#para-quem">Para quem</a>
            <a href="#duvidas">Perguntas</a>
          </nav>
          <div className="jl-header-actions">
            <Link className="jl-nav-login" to="/login">Entrar</Link>
            <a className="jl-button jl-button-small" href="#acesso">Conhecer o acesso <ArrowUpRight size={15} aria-hidden="true" /></a>
          </div>
        </div>
      </header>

      <main id="conteudo">
        <section className="jl-hero">
          <div className="jl-hero-shine" aria-hidden="true" />
          <div className="jl-container jl-hero-grid">
            <div className="jl-hero-copy">
              <span className="jl-kicker"><span className="jl-kicker-dot" /> PROSPECÇÃO B2B COM ORGANIZAÇÃO</span>
              <h1>Boas oportunidades começam com <em>contatos certos.</em></h1>
              <p className="jl-hero-description">
                Descubra empresas por segmento e região. Organize seus leads,
                prepare abordagens e saiba qual é o próximo passo de cada negociação.
              </p>
              <div className="jl-hero-ctas">
                <a className="jl-button jl-button-primary" href="#demonstracao">Explorar o Januário Leads <ArrowRight size={17} aria-hidden="true" /></a>
                <Link className="jl-button jl-button-outline" to="/login">Já tenho acesso <ArrowUpRight size={16} aria-hidden="true" /></Link>
              </div>
              <div className="jl-hero-highlights">
                <span><Check size={15} aria-hidden="true" /> Busca por cidade e nicho</span>
                <span><Check size={15} aria-hidden="true" /> CRM e próximos contatos</span>
                <span><Check size={15} aria-hidden="true" /> Acesso pelo navegador</span>
              </div>
              <p className="jl-hero-disclaimer"><ShieldCheck size={15} aria-hidden="true" /> Plataforma em evolução comercial. Acesso atual por convite.</p>
            </div>
            <ProductMock />
          </div>
          <a href="#demonstracao" className="jl-scroll-cue"><ArrowDown size={15} aria-hidden="true" /> Explore como funciona</a>
        </section>

        <section className="jl-section jl-demo-section" id="demonstracao" aria-labelledby="demo-title">
          <div className="jl-container">
            <div className="jl-section-heading jl-centered">
              <span className="jl-eyebrow">UM FLUXO MAIS SIMPLES</span>
              <h2 id="demo-title">Da busca ao próximo contato, <span>sem perder o contexto.</span></h2>
              <p>Conheça uma prévia do processo. Troque o segmento abaixo para explorar exemplos fictícios — sem acessar sua conta ou consumir API.</p>
            </div>
            <SearchDemo />
            <div className="jl-demo-steps" aria-label="Etapas do trabalho">
              <span><Search size={17} aria-hidden="true" /> Encontre empresas</span>
              <span><MousePointer2 size={17} aria-hidden="true" /> Escolha seus leads</span>
              <span><CalendarCheck size={17} aria-hidden="true" /> Planeje a próxima ação</span>
            </div>
          </div>
        </section>

        <section className="jl-section jl-challenge" aria-labelledby="challenge-title">
          <div className="jl-container">
            <div className="jl-section-heading jl-centered">
              <span className="jl-eyebrow">O DESAFIO DE PROSPECTAR</span>
              <h2 id="challenge-title">Seu tempo vale mais do que <span>uma planilha desatualizada.</span></h2>
              <p>O Januário Leads foi pensado para reunir as etapas que costumam ficar desconectadas.</p>
            </div>
            <div className="jl-problems">
              {difficulties.map(({ icon: Icon, title, description }) => (
                <article key={title} className="jl-problem-card">
                  <span className="jl-square-icon"><Icon size={20} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="jl-section jl-workflow" id="como-funciona" aria-labelledby="workflow-title">
          <div className="jl-container">
            <div className="jl-section-heading jl-centered">
              <span className="jl-eyebrow">COMO FUNCIONA</span>
              <h2 id="workflow-title">Uma rotina comercial que <span>faz sentido.</span></h2>
              <p>Três momentos para começar a prospectar com mais método, usando as ferramentas já presentes na plataforma.</p>
            </div>
            <div className="jl-flow-grid">
              <article className="jl-flow-card">
                <span className="jl-flow-number">01 <Compass size={20} aria-hidden="true" /></span>
                <h3>Descubra</h3>
                <p>Escolha o nicho e a cidade. Explore empresas e identifique quais vale a pena abordar.</p>
                <div className="jl-flow-mini"><Search size={16} aria-hidden="true" /> Empresas em uma região <ArrowRight size={15} aria-hidden="true" /></div>
              </article>
              <article className="jl-flow-card">
                <span className="jl-flow-number">02 <Users size={20} aria-hidden="true" /></span>
                <h3>Organize</h3>
                <p>Salve os contatos na sua carteira e mantenha situação, observações e histórico reunidos.</p>
                <div className="jl-flow-mini"><Building2 size={16} aria-hidden="true" /> Sua carteira de leads <ArrowRight size={15} aria-hidden="true" /></div>
              </article>
              <article className="jl-flow-card">
                <span className="jl-flow-number">03 <Target size={20} aria-hidden="true" /></span>
                <h3>Avance</h3>
                <p>Prepare sua abordagem, defina um retorno e acompanhe as oportunidades comerciais.</p>
                <div className="jl-flow-mini"><CalendarCheck size={16} aria-hidden="true" /> Próxima ação em foco <Check size={15} aria-hidden="true" /></div>
              </article>
            </div>
          </div>
        </section>

        <section className="jl-section jl-feature-section" id="recursos" aria-labelledby="features-title">
          <div className="jl-container">
            <div className="jl-feature-spotlight">
              <div className="jl-spotlight-text">
                <span className="jl-eyebrow">MAIS DO QUE ENCONTRAR CONTATOS</span>
                <h2>Encontrou um lead. <span>E agora?</span></h2>
                <p>O diferencial do Januário Leads é ajudar você a transformar uma lista de empresas em um acompanhamento comercial organizado.</p>
                <div className="jl-spotlight-points">
                  <span><CheckCircle2 size={17} aria-hidden="true" /> Histórico de contatos em um só lugar</span>
                  <span><CheckCircle2 size={17} aria-hidden="true" /> Retornos e próximas ações acompanhados</span>
                  <span><CheckCircle2 size={17} aria-hidden="true" /> Visão de oportunidades e negociações</span>
                </div>
                <a href="#acesso" className="jl-inline-link">Conheça o momento do produto <ArrowRight size={16} aria-hidden="true" /></a>
              </div>
              <div className="jl-followup-preview" aria-label="Exemplo ilustrativo de organização comercial">
                <div className="jl-followup-head"><span>Próximas ações</span><span>EXEMPLO</span></div>
                <div className="jl-followup-item"><span className="jl-followup-symbol"><MessageCircle size={17} /></span><div><strong>Preparar primeira abordagem</strong><small>Empresa Exemplo A · Contato inicial</small></div><span className="jl-followup-state">A fazer</span></div>
                <div className="jl-followup-item"><span className="jl-followup-symbol"><Clock3 size={17} /></span><div><strong>Retomar uma conversa</strong><small>Empresa Exemplo B · Follow-up</small></div><span className="jl-followup-state">Pendente</span></div>
                <div className="jl-followup-item"><span className="jl-followup-symbol"><Target size={17} /></span><div><strong>Revisar oportunidade</strong><small>Empresa Exemplo C · Negociação</small></div><span className="jl-followup-state">Em andamento</span></div>
                <div className="jl-followup-footer"><span className="jl-check-mark"><Check size={15}/></span> Sua carteira continua organizada após a busca.</div>
              </div>
            </div>

            <div className="jl-section-heading jl-centered jl-feature-subheading">
              <span className="jl-eyebrow">O QUE A PLATAFORMA OFERECE</span>
              <h2 id="features-title">Ferramentas para prospectar <span>em um só espaço.</span></h2>
            </div>
            <div className="jl-feature-grid">
              {features.map(({ icon: Icon, title, description }) => (
                <article key={title} className="jl-feature-card">
                  <span className="jl-feature-icon"><Icon size={20} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className="jl-feature-arrow" aria-hidden="true"><ArrowUpRight size={17}/></span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="jl-section jl-audience" id="para-quem" aria-labelledby="audience-title">
          <div className="jl-container">
            <div className="jl-section-heading jl-centered">
              <span className="jl-eyebrow">FEITO PARA QUEM VENDE SERVIÇOS</span>
              <h2 id="audience-title">Oportunidades para quem <span>precisa prospectar.</span></h2>
              <p>Para profissionais e equipes que encontram seus próximos clientes pesquisando outros negócios.</p>
            </div>
            <div className="jl-audience-grid">
              <article><span><Globe2 size={21}/></span><h3>Agências e freelancers</h3><p>Descubra empresas para apresentar sites, marketing, conteúdo e soluções digitais.</p></article>
              <article><span><Target size={21}/></span><h3>Vendas B2B</h3><p>Organize uma carteira de prospects e acompanhe abordagens e oportunidades.</p></article>
              <article><span><BarChart3 size={21}/></span><h3>Prestadores de serviços</h3><p>Trabalhe novos segmentos e regiões com um processo comercial mais claro.</p></article>
            </div>
          </div>
        </section>

        <section className="jl-section jl-comparison" aria-labelledby="compare-title">
          <div className="jl-container">
            <div className="jl-section-heading jl-centered">
              <span className="jl-eyebrow">UM JEITO MAIS ORGANIZADO DE TRABALHAR</span>
              <h2 id="compare-title">Menos ferramentas soltas. <span>Mais continuidade.</span></h2>
            </div>
            <div className="jl-compare-grid">
              <div className="jl-compare-panel muted">
                <span className="jl-compare-label">Quando tudo fica separado</span>
                <h3>Prospecção manual</h3>
                <ul>
                  <li>Pesquisar cada contato por conta própria</li>
                  <li>Copiar dados para anotações ou planilhas</li>
                  <li>Lembrar de cada retorno sem uma fila central</li>
                  <li>Buscar o histórico em ferramentas diferentes</li>
                </ul>
              </div>
              <div className="jl-compare-panel active">
                <span className="jl-compare-label">Com o Januário Leads</span>
                <h3>Prospecção conectada</h3>
                <ul>
                  <li><CheckCircle2 size={16}/> Pesquise empresas por região e nicho</li>
                  <li><CheckCircle2 size={16}/> Salve contatos direto no CRM</li>
                  <li><CheckCircle2 size={16}/> Organize retornos e próximas ações</li>
                  <li><CheckCircle2 size={16}/> Acompanhe oportunidades no mesmo lugar</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="jl-section jl-access" id="acesso" aria-labelledby="access-title">
          <div className="jl-container">
            <div className="jl-access-panel">
              <span className="jl-eyebrow"><Sparkles size={15} aria-hidden="true"/> EM EVOLUÇÃO PARA SAAS</span>
              <h2 id="access-title">A próxima fase da sua prospecção começa por aqui.</h2>
              <p>O Januário Leads já possui uma área de trabalho funcional. Estamos preparando o cadastro comercial, os planos e a abertura de assinaturas.</p>
              <div className="jl-access-actions">
                <Link to="/login" className="jl-button jl-button-primary">Já tenho acesso <ArrowRight size={17} aria-hidden="true"/></Link>
                <a className="jl-button jl-button-outline" href="#duvidas">Tirar dúvidas <CircleHelp size={16} aria-hidden="true"/></a>
              </div>
              <span className="jl-access-note"><ShieldCheck size={16} aria-hidden="true" /> Acesso por convite no momento. Não há checkout ou assinatura automática disponível.</span>
            </div>
          </div>
        </section>

        <section className="jl-section jl-faq" id="duvidas" aria-labelledby="faq-title">
          <div className="jl-container jl-faq-layout">
            <div className="jl-faq-intro">
              <span className="jl-eyebrow">PERGUNTAS FREQUENTES</span>
              <h2 id="faq-title">Antes de começar, <span>saiba como funciona.</span></h2>
              <p>Respostas claras sobre a ferramenta e a fase atual do produto.</p>
            </div>
            <div className="jl-faq-list">
              {faq.map((item) => (
                <details key={item.question} className="jl-faq-item">
                  <summary>{item.question}<span aria-hidden="true">+</span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="jl-container jl-bottom-cta" aria-labelledby="bottom-title">
          <div className="jl-bottom-deco" aria-hidden="true" />
          <span className="jl-eyebrow">JANUÁRIO LEADS</span>
          <h2 id="bottom-title">Transforme sua pesquisa em um <span>processo comercial.</span></h2>
          <p>Encontre empresas, organize sua carteira e mantenha o foco na próxima oportunidade.</p>
          <Link to="/login" className="jl-button jl-button-primary">Entrar na plataforma <ArrowUpRight size={17} aria-hidden="true"/></Link>
        </section>
      </main>

      <footer className="jl-footer">
        <div className="jl-container jl-footer-inner">
          <div><Brand/><p>Prospecção com clareza. Relacionamentos com método.</p></div>
          <nav aria-label="Links do rodapé">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Funcionalidades</a>
            <a href="#duvidas">Perguntas</a>
            <Link to="/login">Acessar conta</Link>
          </nav>
        </div>
        <div className="jl-container jl-footer-bottom">
          <span>© {new Date().getFullYear()} Januário Leads.</span>
          <span>Feito para encontrar oportunidades com organização.</span>
        </div>
      </footer>
    </div>
  );
}
