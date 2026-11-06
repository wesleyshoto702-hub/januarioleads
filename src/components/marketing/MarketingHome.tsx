import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  CirclePlay,
  Clock3,
  MapPin,
  MessageCircle,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatedProductTour } from "./AnimatedProductTour";
import { AuroraBackdrop } from "./AuroraBackdrop";
import { MessageExampleDemo } from "./MessageExampleDemo";
import { AudienceSwitcher, ChallengeStory, FeatureExplorer, WorkflowRibbon } from "./MarketingModules";

const scenarios = [
  {
    id: "restaurantes",
    label: "Restaurantes",
    location: "Curitiba · PR",
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

function SearchDemo() {
  const [selected, setSelected] = useState<(typeof scenarios)[number]["id"]>("restaurantes");
  const [interactive, setInteractive] = useState(false);
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => { setInteractive(true); }, []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(query.matches);
      if (query.matches) {
        setAutoplay(false);
        setPhase(2);
      }
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!autoplay || !pageVisible || reducedMotion) return;
    const timer = window.setInterval(() => {
      setPhase((previous) => (previous + 1) % 4);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [autoplay, pageVisible, reducedMotion, selected]);

  const scenario = scenarios.find((item) => item.id === selected) ?? scenarios[0];
  const stageText = [
    "Definindo segmento e região",
    "Pesquisando empresas de exemplo",
    "Resultados organizados",
    "Selecionando um contato para o CRM",
  ] as const;

  function changeSegment(next: (typeof scenarios)[number]["id"]) {
    setSelected(next);
    setPhase(0);
    setCycle((value) => value + 1);
  }

  function replay() {
    setPhase(0);
    setCycle((value) => value + 1);
    setAutoplay(!reducedMotion);
  }

  return (
    <div className="jl-demo-window" data-interactive={interactive ? "true" : "false"} data-phase={phase} data-cycle={cycle} data-playing={autoplay && pageVisible && !reducedMotion}>
      <div className="jl-demo-toolbar">
        <span><span className="jl-demo-signal" /> Buscar Leads</span>
        <span><CirclePlay size={13} aria-hidden="true" /> Prévia animada · nenhum dado real</span>
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
                  onClick={() => changeSegment(item.id)}
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
        <div className="jl-search-animation-panel">
          <div className="jl-search-animation-status">
            <div>
              <span className="jl-search-animation-label">BUSCA ILUSTRATIVA · ETAPA {phase + 1}/4</span>
              <strong>{stageText[phase] ?? stageText[0]}</strong>
            </div>
            <div className="jl-search-animation-controls">
              <button
                type="button"
                disabled={!interactive || reducedMotion}
                onClick={() => setAutoplay((old) => !old)}
                aria-label={autoplay && !reducedMotion ? "Pausar animação da busca" : "Reproduzir animação da busca"}
              >
                {autoplay && !reducedMotion ? "Pausar" : "Reproduzir"}
              </button>
              <button type="button" disabled={!interactive} onClick={replay} aria-label="Reiniciar animação da busca">Reiniciar</button>
            </div>
          </div>
          <div className="jl-search-animation-query" key={selected + "-" + cycle}>
            <span><Search size={15} aria-hidden="true" /> Pesquisando por <strong className="jl-search-animation-term">{scenario.label}</strong> em {scenario.location}</span>
            <span className="jl-search-animation-indicator" aria-hidden="true"><i /><i /><i /></span>
          </div>
          <div className="jl-search-animation-track" aria-hidden="true">
            <span className="jl-search-animation-fill" />
          </div>
          <div className="jl-search-animation-steps" aria-label="Etapas da busca ilustrativa">
            {["Definir", "Pesquisar", "Encontrar", "Organizar"].map((label, index) => (
              <span key={label} className={index <= phase ? "active" : ""}><CheckCircle2 size={12} aria-hidden="true" />{label}</span>
            ))}
          </div>
        </div>
        <div className="jl-demo-results" key={selected + "-" + cycle + "-results"}>
          <div className="jl-demo-results-title">
            <span><Search size={16} aria-hidden="true" /> Empresas para explorar</span>
            <small>Dados de demonstração</small>
          </div>
          {scenario.results.map((result, index) => (
            <div className={"jl-demo-result jl-demo-result-" + (index + 1)} key={result.name}>
              <span className="jl-demo-result-icon"><Building2 size={17} aria-hidden="true" /></span>
              <span className="jl-demo-result-copy">
                <strong>{result.name}</strong>
                <small>{result.niche} · {scenario.location}</small>
              </span>
              <span className="jl-demo-result-status">{phase === 3 && index === 0 ? "No CRM · prévia" : index === 0 ? "Descobrir" : index === 1 ? "Selecionar" : "Organizar"}</span>
            </div>
          ))}
          <div className="jl-demo-bottom">
            <span><ShieldCheck size={15} aria-hidden="true" /> Simulação local sem custos de API</span>
            
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingHome() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileReady, setMobileReady] = useState(false);
  useEffect(() => { setMobileReady(true); }, []);
  return (
    <div className="jl-site">
      <AuroraBackdrop />
      <a className="jl-skip" href="#conteudo">Pular para o conteúdo</a>
      <header className="jl-header">
        <div className="jl-container jl-header-inner">
          <Brand />
          <nav className="jl-nav" aria-label="Navegação principal">
            <a href="#tour">Como funciona</a>
            <a href="#demonstracao">Buscar Leads</a>
            <a href="#recursos">Funcionalidades</a>
            <a href="#para-quem">Para quem</a>
            <a href="#duvidas">Perguntas</a>
          </nav>
          <div className="jl-header-actions">
            <Link className="jl-nav-login" to="/login">Entrar</Link>
            <Link className="jl-button jl-button-small" to="/cadastro">Criar conta <ArrowUpRight size={15} aria-hidden="true" /></Link>
            <button
              type="button"
              className="jl-mobile-menu-toggle"
              aria-expanded={mobileOpen}
              aria-controls="jl-mobile-navigation"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              disabled={!mobileReady}
              onClick={() => setMobileOpen((previous) => !previous)}
            >
              {mobileOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="jl-mobile-menu" id="jl-mobile-navigation" aria-label="Navegação para celular">
            <div className="jl-mobile-menu-inner">
              <a href="#tour" onClick={() => setMobileOpen(false)}>Assistir demonstração</a>
              <a href="#demonstracao" onClick={() => setMobileOpen(false)}>Buscar Leads</a>
              <a href="#como-funciona" onClick={() => setMobileOpen(false)}>Como funciona</a>
              <a href="#recursos" onClick={() => setMobileOpen(false)}>Funcionalidades</a>
              <a href="#duvidas" onClick={() => setMobileOpen(false)}>Perguntas</a>
              <Link to="/cadastro" onClick={() => setMobileOpen(false)}>Criar conta</Link>
            </div>
          </nav>
        )}
      </header>
      <div className="jl-marketing-briefing">
        <div className="jl-container jl-marketing-briefing-inner">
          <span><CheckCircle2 size={14} aria-hidden="true" /> Pesquisa de empresas por cidade e segmento</span>
          <span><CheckCircle2 size={14} aria-hidden="true" /> CRM e acompanhamento de contatos</span>
          <Link to="/cadastro">Criar conta <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      </div>

      <main id="conteudo">
        <section className="jl-hero">
          <div className="jl-hero-shine" aria-hidden="true" />
          <div className="jl-container jl-hero-grid">
            <div className="jl-hero-copy">
              <span className="jl-kicker"><span className="jl-kicker-dot" /> PROSPECÇÃO B2B COM ORGANIZAÇÃO</span>
              <h1>Boas oportunidades começam com <em>contatos certos.</em></h1>
              <p className="jl-hero-description">
                Busque empresas por cidade e segmento, escolha oportunidades e organize
                os próximos contatos no CRM — tudo em um fluxo comercial mais claro.
              </p>
              <div className="jl-hero-highlights">
                <span><Check size={15} aria-hidden="true" /> Busca por cidade e nicho</span>
                <span><Check size={15} aria-hidden="true" /> CRM e próximos contatos</span>
                <span><Check size={15} aria-hidden="true" /> Acesso pelo navegador</span>
              </div>
              <p className="jl-hero-disclaimer"><ShieldCheck size={15} aria-hidden="true" /> Plataforma em evolução comercial. Acesso atual por convite.</p>
            </div>
            <div className="jl-hero-search" id="demonstracao" aria-label="Buscar Leads — demonstração animada do Januário Leads">
              <div className="jl-hero-search-glow" aria-hidden="true" />
              <div className="jl-hero-search-radar" aria-hidden="true"><i /><i /><i /></div>
              <div className="jl-hero-search-heading">
                <span className="jl-hero-search-icon"><Search size={16} aria-hidden="true" /></span>
                <div>
                  <strong>Januário Leads / Buscar Leads</strong>
                  <span>Veja uma pesquisa acontecer, sem dados reais</span>
                </div>
                <span className="jl-hero-search-live"><span /> ANIMADO</span>
              </div>
              <SearchDemo />
              <div className="jl-hero-search-caption">
                <span><CheckCircle2 size={14} aria-hidden="true" /> Busca por nicho e cidade</span>
                <span><CheckCircle2 size={14} aria-hidden="true" /> Escolha e organização no CRM</span>
              </div>
            </div>
          </div>
          <a href="#tour" className="jl-scroll-cue"><ArrowDown size={15} aria-hidden="true" /> Descubra o processo completo</a>
        </section>

        <section className="jl-section jl-tour-section" id="tour" aria-labelledby="tour-title">
          <div className="jl-container">
            <div className="jl-section-heading jl-centered">
              <span className="jl-eyebrow"><CirclePlay size={15} aria-hidden="true" /> DEMONSTRAÇÃO ANIMADA DO PRODUTO</span>
              <h2 id="tour-title">Como funciona o Januário Leads? <span>Veja na prática.</span></h2>
              <p>Uma prévia animada, feita especialmente para o Januário Leads. Da busca de empresas ao CRM e ao próximo contato, sem gravar dados ou realizar operações reais.</p>
            </div>
            <AnimatedProductTour />
          </div>
        </section>

        <ChallengeStory />
        <WorkflowRibbon />

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

            <MessageExampleDemo />

            <div className="jl-section-heading jl-centered jl-feature-subheading">
              <span className="jl-eyebrow">CONHEÇA A PLATAFORMA POR DENTRO</span>
              <h2 id="features-title">Cada módulo com um <span>papel no seu processo.</span></h2>
              <p>Explore as ferramentas por área: da primeira busca até o acompanhamento comercial.</p>
            </div>
            <FeatureExplorer />
          </div>
        </section>

        <AudienceSwitcher />

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
                <Link to="/cadastro" className="jl-button jl-button-outline">Criar conta <Sparkles size={16} aria-hidden="true"/></Link>
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
