import { Link, useNavigate } from "@tanstack/react-router";
import { getValidSession, hasPreviouslySignedInOnThisBrowser } from "../../lib/auth";
import {
  Building2,
  Check,
  CheckCircle2,
  CirclePlay,
  Clock3,
  MapPin,
  MessageCircle,
  Menu,
  Plus,
  Search,
  Target,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
      "Uma plataforma de prospecção e CRM. Você pesquisa empresas por região e nicho, salva negócios na carteira, registra atividades e datas de retorno e consulta oportunidades com base nas pesquisas realizadas.",
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
];

const pricingPlans = [
  {
    code: "free",
    name: "Free",
    summary: "O primeiro passo para encontrar e organizar oportunidades.",
    price: "R$ 0,00",
    highlights: [
      "3 pesquisas gratuitas por dia",
      "Até 5 contatos completos por dia",
      "Busca por cidade e segmento",
      "CRM básico para seus contatos",
      "Modelos de mensagens essenciais",
    ],
    action: "Começar grátis",
  },
  {
    code: "pro",
    name: "Pro",
    summary: "Mais contatos e organização para quem prospecta todos os dias.",
    price: "R$ 19,90",
    highlights: [
      "25 créditos diários · 1 por lead tradicional",
      "Buscar via Maps: 2 créditos por lead",
      "CRM completo com Kanban",
      "Modelos de mensagens personalizados",
      "Central de acompanhamento",
      "Relatórios comerciais básicos",
    ],
    action: "Solicitar acesso Pro",
  },
  {
    code: "advanced",
    name: "Advanced",
    summary: "Maior volume e ferramentas para decisões comerciais mais rápidas.",
    price: "R$ 29,90",
    highlights: [
      "70 créditos diários · 1 por lead tradicional",
      "Todos os recursos do Pro",
      "Buscar via Maps: 2 créditos por lead",
      "Priorização de leads por critérios",
      "Relatórios comerciais avançados",
      "Follow-ups automáticos configuráveis",
    ],
    action: "Solicitar acesso Advanced",
  },
] as const;

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
              <span className="jl-search-animation-label">BUSCA ILUSTRATIVA</span>
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
        </div>
      </div>
    </div>
  );
}

export function MarketingHome() {
  const navigate = useNavigate();
  const [checkingAccount, setCheckingAccount] = useState(false);
  const accessInFlightRef = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileReady, setMobileReady] = useState(false);
  const [accountPromptOpen, setAccountPromptOpen] = useState(false);
  const accountPromptRef = useRef<HTMLDialogElement>(null);
  const homepageMainRef = useRef<HTMLElement>(null);
  useEffect(() => { setMobileReady(true); }, []);

  useEffect(() => {
    const main = homepageMainRef.current;
    // Keep all content visible without JS, IntersectionObserver, or when the
    // visitor requests reduced motion. No timers or scroll-event handlers.
    if (!main || typeof IntersectionObserver === "undefined" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sections = Array.from(main.querySelectorAll<HTMLElement>(":scope > section"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const section = entry.target as HTMLElement;
        section.dataset.jlReveal = "visible";
        observer.unobserve(section); // Each section reveals only once.
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });

    for (const section of sections) {
      section.dataset.jlReveal = "waiting";
      observer.observe(section);
    }
    return () => {
      observer.disconnect();
      for (const section of sections) delete section.dataset.jlReveal;
    };
  }, []);

  // The signup prompt is reserved for visitors with no known login history.
  // Native modal handles focus containment, Escape and background interactions.
  useEffect(() => {
    const dialog = accountPromptRef.current;
    if (!dialog) return;
    if (accountPromptOpen && !dialog.open) dialog.showModal();
    if (!accountPromptOpen && dialog.open) dialog.close();
  }, [accountPromptOpen]);

  async function accessAccount() {
    if (accessInFlightRef.current) return;
    accessInFlightRef.current = true;
    setCheckingAccount(true);
    setMobileOpen(false);

    try {
      // A valid, authorized session may take the visitor straight to the CRM.
      // A previous login is only a UX hint, never permission to skip authentication.
      const session = await getValidSession().catch(() => null);
      if (session) {
        await navigate({ to: "/app" });
      } else if (hasPreviouslySignedInOnThisBrowser()) {
        await navigate({ to: "/login" });
      } else {
        setAccountPromptOpen(true);
      }
    } finally {
      accessInFlightRef.current = false;
      setCheckingAccount(false);
    }
  }
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
            <Link className="jl-button jl-button-small jl-button-outline jl-header-signup" to="/cadastro">Criar conta</Link>
            <button type="button" className="jl-button jl-button-small jl-header-login"
              onClick={() => void accessAccount()} disabled={checkingAccount}>Acessar conta</button>
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
              <a href="#para-quem" onClick={() => setMobileOpen(false)}>Para quem</a>
              <a href="#duvidas" onClick={() => setMobileOpen(false)}>Perguntas</a>
            </div>
          </nav>
        )}
      </header>
      <main id="conteudo" ref={homepageMainRef}>
        <section className="jl-hero">
          <div className="jl-container jl-hero-grid">
            <div className="jl-hero-copy">
              <span className="jl-kicker"><span className="jl-kicker-dot" /> PROSPECÇÃO B2B COM ORGANIZAÇÃO</span>
              <h1>Boas oportunidades começam com <em>uma busca direcionada.</em></h1>
              <p className="jl-hero-description">
                Busque empresas por cidade e segmento, selecione negócios para sua carteira
                e organize os próximos contatos no CRM — com mais clareza em cada etapa.
              </p>
              <div className="jl-hero-highlights">
                <span><Check size={15} aria-hidden="true" /> Busca por cidade e nicho</span>
                <span><Check size={15} aria-hidden="true" /> CRM e próximos contatos</span>
                <span><Check size={15} aria-hidden="true" /> Acesso pelo navegador</span>
              </div>
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
            </div>
          </div>
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
                  <span><CheckCircle2 size={17} aria-hidden="true" /> Histórico de atividades e anotações por empresa</span>
                  <span><CheckCircle2 size={17} aria-hidden="true" /> Datas de retorno e próximas ações no CRM</span>
                  <span><CheckCircle2 size={17} aria-hidden="true" /> Análise de oportunidades por cidade e nicho</span>
                </div>
              </div>
              <div className="jl-followup-preview" aria-label="Exemplo ilustrativo de organização comercial">
                <div className="jl-followup-head"><span>Próximas ações</span><span>EXEMPLO</span></div>
                <div className="jl-followup-item"><span className="jl-followup-symbol"><MessageCircle size={17} /></span><div><strong>Preparar primeira abordagem</strong><small>Empresa Exemplo A · Contato inicial</small></div><span className="jl-followup-state">A fazer</span></div>
                <div className="jl-followup-item"><span className="jl-followup-symbol"><Clock3 size={17} /></span><div><strong>Retomar uma conversa</strong><small>Empresa Exemplo B · Follow-up</small></div><span className="jl-followup-state">Pendente</span></div>
                <div className="jl-followup-item"><span className="jl-followup-symbol"><Target size={17} /></span><div><strong>Revisar proposta</strong><small>Empresa Exemplo C · Próxima ação</small></div><span className="jl-followup-state">Em andamento</span></div>
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

        <section className="jl-section jl-pricing-section" id="planos" aria-labelledby="jl-pricing-title">
          <div className="jl-container">
            <div className="jl-section-heading jl-centered jl-pricing-heading">
              <span className="jl-eyebrow">PLANOS JANUÁRIO LEADS</span>
              <h2 id="jl-pricing-title">Um plano para cada <span>ritmo de prospecção.</span></h2>
              <p>Comece gratuitamente e escolha mais recursos conforme sua operação crescer.</p>
            </div>

            <div className="jl-pricing-grid">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.code}
                  className={`jl-pricing-card jl-pricing-card--${plan.code}`}
                  aria-label={`Plano ${plan.name}`}
                >
                  <div className="jl-pricing-card-top">
                    {plan.code === "pro" && <span className="jl-pricing-recommended">Recomendado</span>}
                  </div>
                  <h3>{plan.name}</h3>
                  <p className="jl-pricing-summary">{plan.summary}</p>
                  <div className="jl-pricing-price" aria-label={`${plan.price} por mês`}>
                    <strong>{plan.price}</strong>
                    <span>/mês</span>
                  </div>
                  <Link
                    to="/cadastro"
                    className="jl-pricing-cta"
                    aria-label={`${plan.action} — plano ${plan.name}`}
                  >
                    <span>{plan.action}</span>
                  </Link>
                  <div className="jl-pricing-rule" aria-hidden="true" />
                  <ul className="jl-pricing-feature-list">
                    {plan.highlights.map((feature) => (
                      <li key={feature}><Check size={17} strokeWidth={2.2} aria-hidden="true" /><span>{feature}</span></li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="jl-pricing-footnote">
              Planos em preparação. A solicitação de acesso não contrata uma assinatura nem realiza cobrança.
              Os recursos apresentados serão liberados após os testes e a abertura comercial.
            </p>
          </div>
        </section>

        <section className="jl-section jl-faq" id="duvidas" aria-labelledby="faq-title">
          <div className="jl-container jl-faq-layout">
            <div className="jl-faq-intro">
              <span className="jl-eyebrow">PERGUNTAS FREQUENTES</span>
              <h2 id="faq-title">Antes de começar, <span>saiba como funciona.</span></h2>
              <p>Respostas diretas sobre a pesquisa de empresas e a organização de contatos.</p>
            </div>
            <div className="jl-faq-list">
              {faq.map((item) => (
                <details key={item.question} className="jl-faq-item">
                  <summary>{item.question}<span aria-hidden="true"><Plus size={16} strokeWidth={2} /></span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer className="jl-footer">
        <div className="jl-container jl-footer-inner">
          <div><Brand/><p>Prospecção com clareza. Relacionamentos com método.</p></div>
          <nav aria-label="Links do rodapé">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Funcionalidades</a>
            <a href="#duvidas">Perguntas</a>
            <Link to="/cadastro">Criar conta</Link>
            <button type="button" className="jl-footer-account-login" onClick={() => void accessAccount()} disabled={checkingAccount}>Acessar conta</button>
          </nav>
        </div>
        <div className="jl-container jl-footer-bottom">
          <span>© {new Date().getFullYear()} Januário Leads.</span>
          <span>Feito para encontrar oportunidades com organização.</span>
        </div>
      </footer>

      <dialog ref={accountPromptRef} className="jl-account-dialog"
        aria-labelledby="jl-account-dialog-title"
        aria-describedby="jl-account-dialog-description"
        onClose={() => setAccountPromptOpen(false)}
        onCancel={() => setAccountPromptOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setAccountPromptOpen(false);
        }}>
        <div className="jl-account-dialog-card">
          <button type="button" className="jl-account-dialog-dismiss"
            aria-label="Fechar aviso" onClick={() => setAccountPromptOpen(false)}>
            <X size={19} aria-hidden="true" />
          </button>
          <span className="jl-account-dialog-eyebrow">BEM-VINDO AO JANUÁRIO LEADS</span>
          <h2 id="jl-account-dialog-title">Você já possui uma conta?</h2>
          <p id="jl-account-dialog-description">
            Ainda não tem cadastro? Crie sua conta para começar a organizar sua prospecção.
            Se já é cliente, continue com seu e-mail e senha.
          </p>
          <div className="jl-account-dialog-actions">
            <Link to="/cadastro" className="jl-account-dialog-primary"
              onClick={() => setAccountPromptOpen(false)}>Criar conta</Link>
            <Link to="/login" className="jl-account-dialog-secondary"
              onClick={() => setAccountPromptOpen(false)}>Já tenho conta — Entrar</Link>
          </div>
        </div>
      </dialog>
    </div>
  );
}
