import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck2,
  ChartNoAxesCombined,
  Check,
  CircleDot,
  Clock3,
  Globe2,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/produto")({
  head: () => ({
    meta: [
      { title: "JanuarioLeads — Prospecção e CRM em um só lugar" },
      {
        name: "description",
        content:
          "Descubra como o JanuarioLeads ajuda a encontrar empresas, organizar contatos, acompanhar oportunidades e planejar próximas ações.",
      },
      {
        property: "og:title",
        content: "JanuarioLeads — Transforme buscas em oportunidades",
      },
      {
        property: "og:description",
        content: "Busca de empresas, CRM e acompanhamento comercial para quem prospecta negócios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

const features = [
  {
    icon: Search,
    title: "Encontre empresas por região",
    description:
      "Pesquise negócios por nicho, cidade e estado. Explore os resultados antes de decidir quais contatos salvar.",
  },
  {
    icon: Users,
    title: "Organize seus leads",
    description:
      "Guarde empresas no seu CRM, acompanhe os estágios de contato e mantenha as informações reunidas.",
  },
  {
    icon: CalendarCheck2,
    title: "Lembre-se do próximo contato",
    description:
      "Defina próximas ações e acompanhe o que precisa de atenção em sua carteira comercial.",
  },
  {
    icon: MessageCircle,
    title: "Prepare suas abordagens",
    description:
      "Use modelos de mensagens e abra o WhatsApp para conversar. O envio continua sob seu controle.",
  },
  {
    icon: Target,
    title: "Acompanhe oportunidades",
    description:
      "Tenha uma visão das empresas em negociação e mantenha o histórico comercial em contexto.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Visualize seu progresso",
    description:
      "Consulte indicadores do CRM e registre informações financeiras dos negócios acompanhados.",
  },
];

const steps = [
  {
    number: "01",
    title: "Pesquise",
    description: "Escolha o segmento e a cidade para descobrir empresas.",
  },
  {
    number: "02",
    title: "Selecione",
    description: "Salve os contatos relevantes na sua carteira.",
  },
  {
    number: "03",
    title: "Acompanhe",
    description: "Organize abordagens, follow-ups e oportunidades.",
  },
];

function ProductPage() {
  return (
    <div className="product-page">
      <a className="product-skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className="product-header">
        <Link to="/produto" className="product-logo" aria-label="JanuarioLeads — apresentação">
          <span className="product-logo-mark">J</span>
          <span>
            Januario<strong>Leads</strong>
          </span>
        </Link>
        <nav className="product-nav" aria-label="Menu da apresentação">
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#como-funciona">Como funciona</a>
          <Link to="/login" className="product-nav-login">
            Entrar <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main id="conteudo">
        <section className="product-hero" aria-labelledby="product-title">
          <div className="product-hero-copy">
            <p className="product-eyebrow">
              <CircleDot size={14} aria-hidden="true" />
              Sua prospecção, do primeiro contato à oportunidade
            </p>
            <h1 id="product-title">
              Encontre empresas.
              <span> Organize contatos.</span>
              <br />
              Venda com mais direção.
            </h1>
            <p className="product-intro">
              Busque negócios por região, construa sua carteira de leads e acompanhe
              cada próxima ação em um único espaço de trabalho.
            </p>
            <div className="product-hero-actions">
              <Link to="/login" className="product-primary-link">
                Já tenho acesso <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a href="#funcionalidades" className="product-secondary-link">
                Conhecer funcionalidades
              </a>
            </div>
            <p className="product-access-note">
              <ShieldCheck size={16} aria-hidden="true" />
              Em fase de preparação comercial. O acesso ainda é concedido por convite.
            </p>
          </div>

          <div className="product-preview" aria-label="Ilustração conceitual do fluxo comercial">
            <div className="product-preview-topbar">
              <span className="product-preview-appname">
                <span className="product-preview-dot" />
                Visão do seu trabalho
              </span>
              <span className="product-preview-demo">Exemplo ilustrativo</span>
            </div>

            <div className="product-preview-body">
              <div className="product-preview-heading">
                <div>
                  <span className="product-preview-overline">FLUXO DE PROSPECÇÃO</span>
                  <strong>Da descoberta ao relacionamento</strong>
                </div>
                <LayoutDashboard size={22} aria-hidden="true" />
              </div>

              <div className="product-preview-stages">
                <div className="product-preview-stage">
                  <span className="product-preview-stage-icon">
                    <Search size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Buscar</strong>
                    <small>Descobrir empresas</small>
                  </span>
                </div>
                <ArrowRight className="product-preview-arrow" size={17} aria-hidden="true" />
                <div className="product-preview-stage">
                  <span className="product-preview-stage-icon">
                    <Users size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Salvar</strong>
                    <small>Montar carteira</small>
                  </span>
                </div>
                <ArrowRight className="product-preview-arrow" size={17} aria-hidden="true" />
                <div className="product-preview-stage">
                  <span className="product-preview-stage-icon">
                    <Target size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Avançar</strong>
                    <small>Gerar oportunidades</small>
                  </span>
                </div>
              </div>

              <div className="product-preview-panel">
                <div className="product-preview-panel-title">
                  <strong>Uma rotina mais organizada</strong>
                  <span>Exemplo</span>
                </div>
                <div className="product-preview-tasks">
                  <div>
                    <span className="product-task-indicator product-task-indicator-search" />
                    <span>Encontrar novos negócios</span>
                    <Search size={16} aria-hidden="true" />
                  </div>
                  <div>
                    <span className="product-task-indicator product-task-indicator-contact" />
                    <span>Preparar abordagem</span>
                    <MessageCircle size={16} aria-hidden="true" />
                  </div>
                  <div>
                    <span className="product-task-indicator product-task-indicator-followup" />
                    <span>Revisar próximos contatos</span>
                    <Clock3 size={16} aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="product-preview-foot">
                <span><MapPin size={14} aria-hidden="true" /> Cidades de todo o Brasil</span>
                <span><Globe2 size={14} aria-hidden="true" /> Pesquisa por nicho</span>
              </div>
            </div>
          </div>
        </section>

        <section id="funcionalidades" className="product-section" aria-labelledby="features-title">
          <div className="product-section-heading">
            <p className="product-section-kicker">RECURSOS DO PRODUTO</p>
            <h2 id="features-title">Ferramentas para prospectar com consistência.</h2>
            <p>
              Da pesquisa de empresas à gestão de contatos, sem precisar espalhar
              sua operação por várias planilhas.
            </p>
          </div>
          <div className="product-feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="product-feature-card">
                <div className="product-feature-icon">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="product-section product-steps" aria-labelledby="steps-title">
          <div className="product-section-heading">
            <p className="product-section-kicker">SIMPLES DE COMEÇAR</p>
            <h2 id="steps-title">Um processo comercial mais claro.</h2>
          </div>
          <div className="product-steps-grid">
            {steps.map((step) => (
              <article key={step.number} className="product-step">
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
          <p className="product-steps-footnote">
            <Check size={16} aria-hidden="true" />
            A ferramenta apoia a prospecção; ela não envia mensagens automaticamente nem garante vendas.
          </p>
        </section>

        <section className="product-final-cta" aria-labelledby="product-cta-title">
          <div>
            <p className="product-section-kicker">PRÓXIMA ETAPA</p>
            <h2 id="product-cta-title">O JanuarioLeads está evoluindo para um SaaS.</h2>
            <p>
              O espaço de trabalho já existe. Cadastro público, planos e assinaturas
              estão sendo preparados para uma abertura comercial responsável.
            </p>
          </div>
          <Link to="/login" className="product-primary-link">
            Entrar com minha conta <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="product-footer">
        <span>© JanuarioLeads. Plataforma de prospecção e CRM.</span>
        <Link to="/login">Acesso à plataforma</Link>
      </footer>
    </div>
  );
}
